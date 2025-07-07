import { Notice, MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from './main';
import { findImageElement, errorLog } from './utils';

export function setModifierKeyState(this: PixelPerfectImage, isHeld: boolean) {
	this.isModifierKeyHeld = isHeld;
}

export function registerWheelEvents(this: PixelPerfectImage, currentWindow: Window) {
	// If already registered previously, clean it up first
	if (this.wheelEventCleanup) {
		this.wheelEventCleanup();
		this.wheelEventCleanup = null;
	}

	const doc = currentWindow.document;

	// Handle modifier key press
	const keydownHandler = (evt: KeyboardEvent) => {
		if (isModifierKeyMatch.call(this, evt)) {
			setModifierKeyState.call(this, true);
		}
	};

	// Handle modifier key release
	const keyupHandler = (evt: KeyboardEvent) => {
		if (isModifierKeyMatch.call(this, evt)) {
			setModifierKeyState.call(this, false);
		}
	};

	// Handle window blur to reset state
	const blurHandler = () => {
		if (this.isModifierKeyHeld) {
			setModifierKeyState.call(this, false);
		}
	};

	// Create bound event handler for cleanup
	const wheelHandler = async (ev: WheelEvent) => {
		// If zoom is not enabled or modifier not held, let default scroll happen
		if (!this.settings.enableWheelZoom || !this.isModifierKeyHeld) return;

		// Verify key is still held (handles Alt+Tab cases)
		if (!isModifierKeyStillHeld.call(this, ev)) {
			setModifierKeyState.call(this, false);
			return;
		}

		const img = findImageElement(ev.target);
		if (!img) return;

		// Prevent default immediately when we'll handle the zoom
		ev.preventDefault();
		
		// Call handleImageWheel directly
		try {
			await handleImageWheel.call(this, ev, img);
		} catch (error) {
			errorLog('Error handling wheel event:', error);
			new Notice('Failed to resize image');
		}
	};

	// Register all event handlers
	this.registerDomEvent(doc, "keydown", keydownHandler);
	this.registerDomEvent(doc, "keyup", keyupHandler);
	this.registerDomEvent(window, "blur", blurHandler);
	
	// For wheel event, we need passive: false to prevent scrolling
	// Store the handler and cleanup function for manual management
	const wheelEventController = new AbortController();
	doc.addEventListener("wheel", wheelHandler, { 
		passive: false,
		signal: wheelEventController.signal 
	});
	
	// Register cleanup via Obsidian's register method
	this.register(() => wheelEventController.abort());
	
	// Store cleanup function for re-registration scenarios
	this.wheelEventCleanup = () => {
		wheelEventController.abort();
	};
}

export function isModifierKeyMatch(this: PixelPerfectImage, evt: KeyboardEvent): boolean {
	const key = this.settings.wheelModifierKey.toLowerCase();
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

export function isModifierKeyStillHeld(this: PixelPerfectImage, evt: WheelEvent): boolean {
	switch (this.settings.wheelModifierKey.toLowerCase()) {
		case 'alt': return evt.altKey;
		case 'ctrl': return evt.ctrlKey;
		case 'shift': return evt.shiftKey;
		default: return false;
	}
}

export async function handleImageWheel(this: PixelPerfectImage, evt: WheelEvent, target: HTMLImageElement) {
	if (!this.settings.enableWheelZoom) return;
	
	const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
	if (!markdownView?.file) return;

	const result = await this.getImageFileWithErrorHandling(target);
	if (!result) return;

	const { width } = await this.readImageDimensions(result.imgFile);
	const customWidth = this.getCurrentImageWidth(target, result.activeFile, result.imgFile);
	
	// Use the custom width if set, otherwise use original width
	const currentWidth = customWidth ?? width;
	
	// Calculate scale factor based on delta magnitude (smaller deltas = smaller changes)
	const deltaScale = Math.min(1.0, Math.abs(evt.deltaY) / 10);
	
	// Apply the scale factor to the base step size
	const stepSize = Math.max(1, Math.round(currentWidth * (this.settings.wheelZoomPercentage / 100) * deltaScale));
	
	// Adjust width based on scroll direction
	const scrollingUp = evt.deltaY < 0;
	const shouldIncrease = this.settings.invertScrollDirection ? !scrollingUp : scrollingUp;
	const newWidth = shouldIncrease
		? currentWidth + stepSize
		: Math.max(1, currentWidth - stepSize);

	// Only update if the width has actually changed
	if (newWidth !== currentWidth) {
		await this.updateImageLinkWidth(result.imgFile, newWidth);
	}
}

/**
 * Handles click events on images, performing the configured action when CMD/CTRL is pressed
 */
export function handleImageClick(this: PixelPerfectImage, ev: MouseEvent): void {
	// Check if CMD (Mac) or CTRL (Windows/Linux) is held
	if (!(ev.metaKey || ev.ctrlKey)) return;

	const img = findImageElement(ev.target);
	if (!img) return;

	// Prevent default click behavior
	ev.preventDefault();

	// Get the image file and perform the configured action
	this.getImageFileWithErrorHandling(img)
		.then((result: { activeFile: TFile; imgFile: TFile } | null) => {
			if (result) {
				if (this.settings.cmdCtrlClickBehavior === 'open-in-new-tab') {
					this.app.workspace.openLinkText(result.imgFile.path, '', true);
				} else if (this.settings.cmdCtrlClickBehavior === 'open-in-default-app') {
					this.openInDefaultApp(result.imgFile);
				} else if (this.settings.cmdCtrlClickBehavior === 'open-in-external-editor') {
					this.openInExternalEditor(result.imgFile.path);
				}
			}
		})
		.catch((error: any) => {
			let action = 'perform action';
			if (this.settings.cmdCtrlClickBehavior === 'open-in-new-tab') {
				action = 'open image in new tab';
			} else if (this.settings.cmdCtrlClickBehavior === 'open-in-default-app') {
				action = 'open image in default app';
			} else if (this.settings.cmdCtrlClickBehavior === 'open-in-external-editor') {
				const editorName = this.settings.externalEditorName.trim() || 'external editor';
				action = `open image in ${editorName}`;
			}
			errorLog(`Failed to ${action}:`, error);
			new Notice(`Failed to ${action}`);
		});
}