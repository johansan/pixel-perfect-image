import { Notice, MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { findImageElement, errorLog } from '../utils/utils';

export class EventService {
	private plugin: PixelPerfectImage;
	private isModifierKeyHeld = false;
	private wheelEventCleanup: (() => void) | null = null;

	constructor(plugin: PixelPerfectImage) {
		this.plugin = plugin;
	}

	setModifierKeyState(isHeld: boolean) {
		this.isModifierKeyHeld = isHeld;
	}

	registerWheelEvents(currentWindow: Window) {
		// If already registered previously, clean it up first
		if (this.wheelEventCleanup) {
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
			}
		};

		// Handle window blur to reset state
		const blurHandler = () => {
			if (this.isModifierKeyHeld) {
				this.setModifierKeyState(false);
			}
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
				new Notice('Failed to resize image');
			}
		};

		// Register all event handlers
		this.plugin.registerDomEvent(doc, "keydown", keydownHandler);
		this.plugin.registerDomEvent(doc, "keyup", keyupHandler);
		this.plugin.registerDomEvent(window, "blur", blurHandler);
		
		// For wheel event, we need passive: false to prevent scrolling
		// Store the handler and cleanup function for manual management
		const wheelEventController = new AbortController();
		doc.addEventListener("wheel", wheelHandler, { 
			passive: false,
			signal: wheelEventController.signal 
		});
		
		// Register cleanup via Obsidian's register method
		this.plugin.register(() => wheelEventController.abort());
		
		// Store cleanup function for re-registration scenarios
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

	async handleImageWheel(evt: WheelEvent, target: HTMLImageElement) {
		if (!this.plugin.settings.enableWheelZoom) return;
		
		const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView?.file) return;

		const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
		if (!result) return;

		const { width } = await this.plugin.imageService.readImageDimensions(result.imgFile);
		const customWidth = this.plugin.imageService.getCurrentImageWidth(result.activeFile, result.imgFile);
		
		// Use the custom width if set, otherwise use original width
		const currentWidth = customWidth ?? width;
		
		// Calculate scale factor based on delta magnitude (smaller deltas = smaller changes)
		const deltaScale = Math.min(1.0, Math.abs(evt.deltaY) / 10);
		
		// Apply the scale factor to the base step size
		const stepSize = Math.max(1, Math.round(currentWidth * (this.plugin.settings.wheelZoomPercentage / 100) * deltaScale));
		
		// Adjust width based on scroll direction
		const scrollingUp = evt.deltaY < 0;
		const shouldIncrease = this.plugin.settings.invertScrollDirection ? !scrollingUp : scrollingUp;
		const newWidth = shouldIncrease
			? currentWidth + stepSize
			: Math.max(1, currentWidth - stepSize);

		// Only update if the width has actually changed
		if (newWidth !== currentWidth) {
			await this.plugin.imageService.updateImageLinkWidth(result.imgFile, newWidth);
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
				let action = 'perform action';
				if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-new-tab') {
					action = 'open image in new tab';
				} else if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-default-app') {
					action = 'open image in default app';
				} else if (this.plugin.settings.cmdCtrlClickBehavior === 'open-in-external-editor') {
					const editorName = this.plugin.settings.externalEditorName.trim() || 'external editor';
					action = `open image in ${editorName}`;
				}
				errorLog(`Failed to ${action}:`, error);
				new Notice(`Failed to ${action}`);
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
		if (this.wheelEventCleanup) {
			this.wheelEventCleanup();
			this.wheelEventCleanup = null;
		}
	}
}