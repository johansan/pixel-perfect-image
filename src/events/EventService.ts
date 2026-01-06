import { Notice, MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { findImageElement, errorLog, findLastObsidianImageSizeParam, isRemoteImage } from '../utils/utils';
import { strings } from '../i18n';
import { DEFAULT_EXTERNAL_IMAGE_FALLBACK_WIDTH_PX } from '../utils/constants';

type WheelImageTarget =
	| { kind: 'local'; imgFile: TFile }
	| { kind: 'remote'; url: string };

export class EventService {
	private plugin: PixelPerfectImage;
	private isModifierKeyHeld = false;
	private wheelEventCleanup: (() => void) | null = null;
	private wheelWidthCache = new Map<string, number>();
	private wheelPendingWidth = new Map<string, number>();
	private wheelDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private wheelMaxWaitTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private wheelTargets = new Map<string, { activeFile: TFile; target: WheelImageTarget }>();
	// Tracks which DOM image element we applied a temporary inline width to (for immediate visual feedback).
	// This is keyed by active note + image file, and is cleared after the queued markdown update flushes.
	private wheelDomTargets = new Map<string, HTMLImageElement>();
	// Serializes wheel computations per image so rapid wheel events don't race width calculations.
	private wheelComputeQueue = new Map<string, Promise<void>>();
	// Serializes writes per image so we never overlap markdown link updates for the same target.
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
			// Persist any pending wheel resizes before swapping listeners, so we don't lose the last change.
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
		const wheelHandler = (ev: WheelEvent) => {
			if (!this.plugin.settings.enableWheelZoom) return;

			// We track modifier key state via keydown/keyup for responsiveness, but also re-check the
			// wheel event flags to handle focus changes (e.g. Alt+Tab) and input devices that only
			// surface modifier state on the wheel event itself.
			const modifierHeld = this.isModifierKeyHeld || this.isModifierKeyStillHeld(ev);
			if (!modifierHeld) return;

			// Verify key is still held (handles Alt+Tab cases).
			if (!this.isModifierKeyStillHeld(ev)) {
				if (this.isModifierKeyHeld) {
					this.setModifierKeyState(false);
					this.flushAllPendingWheelWrites();
				}
				return;
			}

			if (!this.isModifierKeyHeld) {
				this.setModifierKeyState(true);
			}

			const img = findImageElement(ev.target);
			if (!img) return;

			// Wheel events can originate from non-active markdown panes; resolve the owning markdown
			// file by walking open markdown views and checking DOM containment.
			const activeFile = this.getMarkdownFileForElement(img);
			if (!activeFile) return;

			let target: WheelImageTarget | null = null;

			// Resolve the vault image file from the DOM element + active note context.
			const imgFile = this.plugin.fileService.getFileForImage(img, activeFile);
			if (imgFile) {
				target = { kind: 'local', imgFile };
			} else if (isRemoteImage(img)) {
				const url = img.currentSrc || img.src;
				if (url) {
					target = { kind: 'remote', url };
				}
			}

			if (!target) return;

			// Only prevent scrolling once we're sure we're handling an image zoom.
			ev.preventDefault();
			ev.stopPropagation();

			void this.handleImageWheel(ev, img, activeFile, target).catch((error) => {
				errorLog('Error handling wheel event:', error);
				new Notice(strings.notices.failedToResize);
			});
		};

		// Register handlers with an AbortController so re-registering on layout changes
		// doesn't accumulate duplicate listeners.
		const wheelEventController = new AbortController();
		doc.addEventListener('keydown', keydownHandler, { signal: wheelEventController.signal });
		doc.addEventListener('keyup', keyupHandler, { signal: wheelEventController.signal });
		currentWindow.addEventListener('blur', blurHandler, { signal: wheelEventController.signal });

		// For wheel event, we need passive: false to prevent scrolling.
		// Capture on window so we can intercept before Obsidian's own handlers scroll the view.
		currentWindow.addEventListener('wheel', wheelHandler, {
			passive: false,
			capture: true,
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

	private getMarkdownFileForElement(element: HTMLElement): TFile | null {
		// Map a rendered DOM element back to the markdown file that owns it.
		// This avoids relying on "active file", which may not match the pane being scrolled.
		for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			if (!view.file) continue;
			if (view.containerEl.contains(element)) return view.file;
		}
		return null;
	}

	private getWheelWidthCacheKey(activeFile: TFile, target: WheelImageTarget): string {
		if (target.kind === 'local') {
			return `${activeFile.path}::local::${target.imgFile.path}`;
		}
		return `${activeFile.path}::remote::${target.url}`;
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

	private scheduleWheelWidthFlush(cacheKey: string, activeFile: TFile, target: WheelImageTarget) {
		this.wheelTargets.set(cacheKey, { activeFile, target });

		// Debounce frequent wheel events into fewer markdown writes.
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
		const tracked = this.wheelTargets.get(cacheKey);
		if (!tracked) {
			this.wheelPendingWidth.delete(cacheKey);
			return;
		}

		const { activeFile, target } = tracked;
		// Chain writes per image so link updates are applied in order and never overlap.
		const writeTask = (this.wheelWriteQueue.get(cacheKey) ?? Promise.resolve())
			.catch(() => undefined)
			.then(async () => {
				const pendingWidth = this.wheelPendingWidth.get(cacheKey);
				if (pendingWidth === undefined) return;

				if (target.kind === 'local') {
					await this.plugin.imageService.updateImageLinkWidth(target.imgFile, pendingWidth, activeFile);
				} else {
					await this.plugin.imageService.updateExternalImageLinkWidth(activeFile, target.url, pendingWidth);
				}
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
					this.scheduleWheelWidthFlush(cacheKey, activeFile, target);
				} else {
					this.wheelTargets.delete(cacheKey);
				}

				// Avoid letting our temporary inline style block future non-wheel resizes.
				if (!this.wheelPendingWidth.has(cacheKey) && !this.wheelDebounceTimers.has(cacheKey)) {
					this.clearWheelInlineWidth(cacheKey);
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

	private clearWheelInlineWidth(cacheKey: string) {
		const img = this.wheelDomTargets.get(cacheKey);
		if (!img) return;

		// Only remove inline width that we applied during wheel-resize; don't clobber user styles.
		if (img.dataset.ppiWheelInlineWidth === 'true') {
			img.style.removeProperty('width');
			delete img.dataset.ppiWheelInlineWidth;
		}

		this.wheelDomTargets.delete(cacheKey);
	}

	async handleImageWheel(evt: WheelEvent, domTarget: HTMLImageElement, activeFile: TFile, target: WheelImageTarget) {
		if (!this.plugin.settings.enableWheelZoom) return;
		const cacheKey = this.getWheelWidthCacheKey(activeFile, target);

		// Serialize wheel computations per image to keep width math consistent during fast scrolling.
		const deltaY = evt.deltaY;
		const queued = (this.wheelComputeQueue.get(cacheKey) ?? Promise.resolve())
			.catch(() => undefined)
			.then(async () => {
				let width: number;
				try {
					// Prefer DOM naturalWidth when available (avoids async vault reads on hot path).
					if (domTarget.naturalWidth > 0) {
						width = domTarget.naturalWidth;
					} else if (target.kind === 'local') {
						width = (await this.plugin.imageService.readImageDimensions(target.imgFile)).width;
					} else {
						width = DEFAULT_EXTERNAL_IMAGE_FALLBACK_WIDTH_PX;
					}
				} catch {
					return;
				}

				const altWidth = this.parseWidthFromImageAlt(domTarget);
				const cachedWidth = this.wheelWidthCache.get(cacheKey);
				const pendingWidth = this.wheelPendingWidth.get(cacheKey);

				// Determine "current width" using the fastest/safest sources first, and only fall back to
				// scanning the editor text as a last resort (slow, but should be rare).
				// Best-effort current width:
				// 1) Parse from DOM alt (fast + reflects manual edits once rendered)
				// 2) Use our pending value (covers render lag + debounce window)
				// 3) Use our last applied value
				// 4) Fallback to scanning editor text (slow; should happen rarely)
				const customWidth = altWidth !== null
					? altWidth
					: pendingWidth ?? cachedWidth ?? (
						target.kind === 'local'
							? this.plugin.imageService.getCurrentImageWidth(activeFile, target.imgFile)
							: this.plugin.imageService.getCurrentExternalImageWidth(activeFile, target.url)
					);

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
					// Give immediate visual feedback while the markdown link update is debounced/queued.
					domTarget.style.width = `${newWidth}px`;
					domTarget.dataset.ppiWheelInlineWidth = 'true';
					domTarget.removeAttribute('height');
					domTarget.setAttribute('width', String(newWidth));
					this.wheelDomTargets.set(cacheKey, domTarget);

					this.setWheelWidthCache(cacheKey, newWidth);
					this.wheelPendingWidth.set(cacheKey, newWidth);
					// Schedule a debounced write to persist the new width in the markdown image link.
					this.scheduleWheelWidthFlush(cacheKey, activeFile, target);
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
		for (const cacheKey of this.wheelDomTargets.keys()) {
			this.clearWheelInlineWidth(cacheKey);
		}
		this.wheelComputeQueue.clear();
		this.wheelWriteQueue.clear();
		if (this.wheelEventCleanup) {
			this.wheelEventCleanup();
			this.wheelEventCleanup = null;
		}
	}
}
