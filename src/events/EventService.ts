import { Notice, MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { findImageElement, errorLog, findLastObsidianImageSizeParam } from '../utils/utils';
import { strings } from '../i18n';

export class EventService {
	private plugin: PixelPerfectImage;
	private isModifierKeyHeld = false;
	private wheelEventCleanup: (() => void) | null = null;
	private wheelWidthCache = new Map<string, number>();
	private wheelPendingWidth = new Map<string, number>();
	private wheelDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private wheelMaxWaitTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private wheelTargets = new Map<string, { activeFile: TFile; imgFile: TFile }>();
	private wheelComputeQueue = new Map<string, Promise<void>>();
	private wheelWriteQueue = new Map<string, Promise<void>>();
	private static readonly WHEEL_WIDTH_CACHE_MAX_ENTRIES = 300;
	private static readonly WHEEL_WRITE_DEBOUNCE_MS = 250;
	private static readonly WHEEL_WRITE_MAX_WAIT_MS = 2000;

	constructor(plugin: PixelPerfectImage) {
		this.plugin = plugin;
	}

	setModifierKeyState(isHeld: boolean) {
		this.isModifierKeyHeld = isHeld;
	}

	registerWheelEvents(currentWindow: Window) {
		// If already registered previously, clean it up first
		if (this.wheelEventCleanup) {
			this.flushAllPendingWheelWrites();
			this.wheelEventCleanup();
			this.wheelEventCleanup = null;
		}

		const doc = currentWindow.document;

		// Handle modifier key press
		const keydownHandler = (evt: KeyboardEvent) => {
			if (this.isModifierKeyMatch(evt)) {
				this.setModifierKeyState(true);
			}
		};

		// Handle modifier key release
		const keyupHandler = (evt: KeyboardEvent) => {
			if (this.isModifierKeyMatch(evt)) {
				this.setModifierKeyState(false);
				this.flushAllPendingWheelWrites();
			}
		};

		// Handle window blur to reset state
		const blurHandler = () => {
			if (this.isModifierKeyHeld) {
				this.setModifierKeyState(false);
			}
			this.flushAllPendingWheelWrites();
		};

		// Create bound event handler for cleanup
		const wheelHandler = async (ev: WheelEvent) => {
			// If zoom is not enabled or modifier not held, let default scroll happen
			if (!this.plugin.settings.enableWheelZoom || !this.isModifierKeyHeld) return;

			// Verify key is still held (handles Alt+Tab cases)
			if (!this.isModifierKeyStillHeld(ev)) {
				this.setModifierKeyState(false);
				return;
			}

			const img = findImageElement(ev.target);
			if (!img) return;

			// Prevent default immediately when we'll handle the zoom
			ev.preventDefault();
			
			// Call handleImageWheel directly
			try {
				await this.handleImageWheel(ev, img);
			} catch (error) {
				errorLog('Error handling wheel event:', error);
				new Notice(strings.notices.failedToResize);
			}
		};

		// Register handlers with an AbortController so re-registering on layout changes
		// doesn't accumulate duplicate listeners.
		const wheelEventController = new AbortController();
		doc.addEventListener('keydown', keydownHandler, { signal: wheelEventController.signal });
		doc.addEventListener('keyup', keyupHandler, { signal: wheelEventController.signal });
		currentWindow.addEventListener('blur', blurHandler, { signal: wheelEventController.signal });

		// For wheel event, we need passive: false to prevent scrolling.
		doc.addEventListener('wheel', wheelHandler, {
			passive: false,
			signal: wheelEventController.signal
		});

		// Store cleanup function for re-registration scenarios (and plugin unload via EventService.cleanup()).
		this.wheelEventCleanup = () => {
			wheelEventController.abort();
		};
	}

	isModifierKeyMatch(evt: KeyboardEvent): boolean {
		const key = this.plugin.settings.wheelModifierKey.toLowerCase();
		const eventKey = evt.key.toLowerCase();
		
		// Handle different key representations
		switch (key) {
			case 'alt':
				return eventKey === 'alt' || eventKey === 'option';
			case 'ctrl':
				return eventKey === 'ctrl' || eventKey === 'control';
			case 'shift':
				return eventKey === 'shift';
			default:
				return false;
		}
	}

	isModifierKeyStillHeld(evt: WheelEvent): boolean {
		switch (this.plugin.settings.wheelModifierKey.toLowerCase()) {
			case 'alt': return evt.altKey;
			case 'ctrl': return evt.ctrlKey;
			case 'shift': return evt.shiftKey;
			default: return false;
		}
	}

	private getWheelWidthCacheKey(activeFile: TFile, imgFile: TFile): string {
		return `${activeFile.path}::${imgFile.path}`;
	}

	private setWheelWidthCache(key: string, width: number) {
		this.wheelWidthCache.set(key, width);
		if (this.wheelWidthCache.size <= EventService.WHEEL_WIDTH_CACHE_MAX_ENTRIES) return;
		const oldestKey = this.wheelWidthCache.keys().next().value as string | undefined;
		if (oldestKey) this.wheelWidthCache.delete(oldestKey);
	}

	private parseWidthFromImageAlt(img: HTMLImageElement): number | null {
		const alt = img.getAttribute('alt') ?? '';
		if (!alt) return null;
		const parts = alt.split('|').map((part) => part.trim()).filter(Boolean);
		return findLastObsidianImageSizeParam(parts)?.width ?? null;
	}

	private scheduleWheelWidthFlush(cacheKey: string, activeFile: TFile, imgFile: TFile) {
		this.wheelTargets.set(cacheKey, { activeFile, imgFile });

		const existingDebounce = this.wheelDebounceTimers.get(cacheKey);
		if (existingDebounce) clearTimeout(existingDebounce);

		const debounceTimer = setTimeout(() => {
			this.wheelDebounceTimers.delete(cacheKey);
			this.flushWheelPendingWidth(cacheKey);
		}, EventService.WHEEL_WRITE_DEBOUNCE_MS);
		this.wheelDebounceTimers.set(cacheKey, debounceTimer);

		// During continuous scrolling, still persist occasionally (at most once per max-wait window).
		if (!this.wheelMaxWaitTimers.has(cacheKey)) {
			const maxWaitTimer = setTimeout(() => {
				this.wheelMaxWaitTimers.delete(cacheKey);
				this.flushWheelPendingWidth(cacheKey);
			}, EventService.WHEEL_WRITE_MAX_WAIT_MS);
			this.wheelMaxWaitTimers.set(cacheKey, maxWaitTimer);
		}
	}

	private flushWheelPendingWidth(cacheKey: string) {
		const target = this.wheelTargets.get(cacheKey);
		if (!target) {
			this.wheelPendingWidth.delete(cacheKey);
			return;
		}

		const { activeFile, imgFile } = target;
		const writeTask = (this.wheelWriteQueue.get(cacheKey) ?? Promise.resolve())
			.catch(() => undefined)
			.then(async () => {
				const pendingWidth = this.wheelPendingWidth.get(cacheKey);
				if (pendingWidth === undefined) return;

				await this.plugin.imageService.updateImageLinkWidth(imgFile, pendingWidth, activeFile);
				this.setWheelWidthCache(cacheKey, pendingWidth);

				if (this.wheelPendingWidth.get(cacheKey) === pendingWidth) {
					this.wheelPendingWidth.delete(cacheKey);
				}
			})
			.catch((error) => {
				// Never throw on a queued write; avoid unhandled rejections and keep wheel interactions responsive.
				errorLog('Wheel resize write failed:', error);
			})
			.finally(() => {
				if (this.wheelWriteQueue.get(cacheKey) === writeTask) {
					this.wheelWriteQueue.delete(cacheKey);
				}

				// Reset max-wait window after a flush. If something changed while writing, ensure we flush again.
				const maxWaitTimer = this.wheelMaxWaitTimers.get(cacheKey);
				if (maxWaitTimer) {
					clearTimeout(maxWaitTimer);
					this.wheelMaxWaitTimers.delete(cacheKey);
				}

				if (this.wheelPendingWidth.has(cacheKey)) {
					this.scheduleWheelWidthFlush(cacheKey, activeFile, imgFile);
				} else {
					this.wheelTargets.delete(cacheKey);
				}
			});

		this.wheelWriteQueue.set(cacheKey, writeTask);
	}

	private flushAllPendingWheelWrites() {
		for (const cacheKey of this.wheelPendingWidth.keys()) {
			const debounceTimer = this.wheelDebounceTimers.get(cacheKey);
			if (debounceTimer) clearTimeout(debounceTimer);
			this.wheelDebounceTimers.delete(cacheKey);

			const maxWaitTimer = this.wheelMaxWaitTimers.get(cacheKey);
			if (maxWaitTimer) clearTimeout(maxWaitTimer);
			this.wheelMaxWaitTimers.delete(cacheKey);

			this.flushWheelPendingWidth(cacheKey);
		}
	}

	async handleImageWheel(evt: WheelEvent, target: HTMLImageElement) {
		if (!this.plugin.settings.enableWheelZoom) return;
		
		const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView?.file) return;

		// Avoid spamming notices on the wheel hot-path; failures can happen during rerenders.
		const result = await this.plugin.fileService.getImageFileWithErrorHandling(target, false);
		if (!result) return;

		const cacheKey = this.getWheelWidthCacheKey(result.activeFile, result.imgFile);

		// Serialize wheel computations per image to keep width math consistent during fast scrolling.
		const deltaY = evt.deltaY;
		const queued = (this.wheelComputeQueue.get(cacheKey) ?? Promise.resolve())
			.catch(() => undefined)
			.then(async () => {
				let width: number;
				try {
					// Prefer DOM naturalWidth when available (avoids async vault reads on hot path).
					width =
						target.naturalWidth > 0
							? target.naturalWidth
							: (await this.plugin.imageService.readImageDimensions(result.imgFile)).width;
				} catch {
					return;
				}

				const altWidth = this.parseWidthFromImageAlt(target);
				const cachedWidth = this.wheelWidthCache.get(cacheKey);
				const pendingWidth = this.wheelPendingWidth.get(cacheKey);

				// Best-effort current width:
				// 1) Parse from DOM alt (fast + reflects manual edits once rendered)
				// 2) Use our pending value (covers render lag + debounce window)
				// 3) Use our last applied value
				// 4) Fallback to scanning editor text (slow; should happen rarely)
				const customWidth =
					altWidth !== null
						? altWidth
						: (pendingWidth ?? cachedWidth ?? this.plugin.imageService.getCurrentImageWidth(result.activeFile, result.imgFile));

				if (altWidth !== null) {
					this.setWheelWidthCache(cacheKey, altWidth);
					this.wheelPendingWidth.delete(cacheKey);
				} else if (cachedWidth !== undefined) {
					// keep as-is
				} else if (customWidth !== null) {
					this.setWheelWidthCache(cacheKey, customWidth);
				}

				// Use the custom width if set, otherwise use original width
				const currentWidth = customWidth ?? width;

				// Calculate scale factor based on delta magnitude (smaller deltas = smaller changes)
				const deltaScale = Math.min(1.0, Math.abs(deltaY) / 10);

				// Apply the scale factor to the base step size
				const stepSize = Math.max(
					1,
					Math.round(currentWidth * (this.plugin.settings.wheelZoomPercentage / 100) * deltaScale)
				);

				// Adjust width based on scroll direction
				const scrollingUp = deltaY < 0;
				const shouldIncrease = this.plugin.settings.invertScrollDirection ? !scrollingUp : scrollingUp;
				const newWidth = shouldIncrease ? currentWidth + stepSize : Math.max(1, currentWidth - stepSize);

				// Only update if the width has actually changed
				if (newWidth !== currentWidth) {
					this.setWheelWidthCache(cacheKey, newWidth);
					this.wheelPendingWidth.set(cacheKey, newWidth);
					this.scheduleWheelWidthFlush(cacheKey, result.activeFile, result.imgFile);
				}
			});

		this.wheelComputeQueue.set(cacheKey, queued);
		try {
			await queued;
		} finally {
			if (this.wheelComputeQueue.get(cacheKey) === queued) {
				this.wheelComputeQueue.delete(cacheKey);
			}
		}
	}

	/**
	 * Handles click events on images, performing the configured action when CMD/CTRL is pressed
	 */
	handleImageClick(ev: MouseEvent): void {
		// Check if CMD (Mac) or CTRL (Windows/Linux) is held
		if (!(ev.metaKey || ev.ctrlKey)) return;

		const img = findImageElement(ev.target);
		if (!img) return;

		// If behavior is set to 'do-nothing', return early
		if (this.plugin.settings.cmdCtrlClickBehavior === 'do-nothing') {
			return;
		}

		// Prevent default click behavior
		ev.preventDefault();

		// Get the image file and perform the configured action
		this.plugin.fileService.getImageFileWithErrorHandling(img)
			.then((result: { activeFile: TFile; imgFile: TFile } | null) => {
				if (result) {
					if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-new-tab') {
						this.plugin.app.workspace.openLinkText(result.imgFile.path, '', true);
					} else if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-default-app') {
						this.plugin.fileService.openInDefaultApp(result.imgFile);
					} else if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-external-editor') {
						this.plugin.fileService.openInExternalEditor(result.imgFile.path);
					}
				}
			})
			.catch((error: unknown) => {
				let action = strings.actions.performAction;
				if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-new-tab') {
					action = strings.actions.openInNewTab;
				} else if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-default-app') {
					action = strings.actions.openInDefaultApp;
				} else if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-external-editor') {
					const editorName = this.plugin.settings.externalEditorName.trim() || 'external editor';
					action = strings.actions.openInEditor.replace('{editor}', editorName);
				}
				errorLog(`Failed to ${action}:`, error);
				new Notice(strings.notices.failedToPerformAction.replace('{action}', action));
			});
	}

	// Public method to register all events
	registerEvents() {
		// Add click handler for CMD/CTRL + click
		this.plugin.registerDomEvent(document, 'click', (ev) => this.handleImageClick(ev));
		
		// Register mousewheel zoom events
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => this.registerWheelEvents(window))
		);
		this.registerWheelEvents(window);
	}

	// Cleanup method
	cleanup() {
		this.isModifierKeyHeld = false;
		this.flushAllPendingWheelWrites();
		this.wheelWidthCache.clear();
		this.wheelPendingWidth.clear();
		for (const timer of this.wheelDebounceTimers.values()) clearTimeout(timer);
		for (const timer of this.wheelMaxWaitTimers.values()) clearTimeout(timer);
		this.wheelDebounceTimers.clear();
		this.wheelMaxWaitTimers.clear();
		this.wheelTargets.clear();
		this.wheelComputeQueue.clear();
		this.wheelWriteQueue.clear();
		if (this.wheelEventCleanup) {
			this.wheelEventCleanup();
			this.wheelEventCleanup = null;
		}
	}
}
