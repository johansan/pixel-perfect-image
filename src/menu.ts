import { Menu, Notice, Platform } from 'obsidian';
import type PixelPerfectImage from './main';
import { findImageElement, errorLog } from './utils';
import { getExternalEditorPath } from './settings';

/**
 * Registers a context menu handler for images in the editor.
 * The menu provides options to view image dimensions and resize the image.
 */
export function registerImageContextMenu(this: PixelPerfectImage): void {
	// Add support for both desktop right-click and mobile long-press
	this.registerDomEvent(document, 'contextmenu', handleContextMenu.bind(this), true);
	
	// Add mobile long-press support
	let longPressTimer: NodeJS.Timeout;
	let isLongPress = false;
	
	this.registerDomEvent(document, 'touchstart', (ev: TouchEvent) => {
		// Ignore multi-touch events to avoid interfering with pinch zooming
		if (ev.touches.length > 1) return;
		
		const img = findImageElement(ev.target);
		if (!img) return;
		
		isLongPress = false;
		longPressTimer = setTimeout(() => {
			isLongPress = true;
			handleContextMenu.call(this, ev);
		}, 500); // 500ms long press
	}, true);
	
	this.registerDomEvent(document, 'touchend', () => {
		clearTimeout(longPressTimer);
	}, true);
	
	this.registerDomEvent(document, 'touchmove', () => {
		clearTimeout(longPressTimer);
	}, true);
}

export async function handleContextMenu(this: PixelPerfectImage, ev: MouseEvent | TouchEvent) {
	// For touch events, ignore multi-touch to prevent triggering during pinch zoom
	if ('touches' in ev && ev.touches.length > 1) return;
	
	const img = findImageElement(ev.target);
	if (!img) return;

	// Prevent default context menu
	ev.preventDefault();

	const menu = new Menu();
	await addDimensionsMenuItem.call(this, menu, img);
	await addResizeMenuItems.call(this, menu, ev);
	
	// Only add file operations on desktop
	if (!Platform.isMobile) {
		menu.addSeparator();
		addFileOperationMenuItems.call(this, menu, img);
	}

	// Position menu at event coordinates
	const position = {
		x: ev instanceof MouseEvent ? ev.pageX : ev.touches[0].pageX,
		y: ev instanceof MouseEvent ? ev.pageY : ev.touches[0].pageY
	};
	menu.showAtPosition(position);
}

/**
 * Helper to create a disabled menu item for displaying information
 * @param menu - The menu to add the item to
 * @param title - The title of the menu item
 * @param icon - The icon to use
 */
export function addInfoMenuItem(menu: Menu, title: string, icon: string): void {
	menu.addItem((item) => {
		item.setTitle(title)
			.setIcon(icon)
			.setDisabled(true);
	});
}

/**
 * Adds an informational menu item showing the actual dimensions of the image.
 * Reads dimensions from the image file in the vault.
 * @param menu - The context menu to add the item to
 * @param img - The HTML image element that was right-clicked
 */
export async function addDimensionsMenuItem(this: PixelPerfectImage, menu: Menu, img: HTMLImageElement): Promise<void> {
	// Only add file info if the setting is enabled
	if (!this.settings.showFileInfo) return;

	try {
		const result = await this.getImageFileWithErrorHandling(img);
		if (!result) return;

		const { width, height } = await this.readImageDimensions(result.imgFile);

		// Get current scale if set
		const currentScale = this.calculateImageScale(img, result.activeFile, result.imgFile, width);
		const scaleText = currentScale !== null ? ` @ ${currentScale}%` : '';

		// Add filename menu item with scale
		addInfoMenuItem(menu, `${result.imgFile.name}${scaleText}`, "image-file");

		// Add dimensions menu item
		addInfoMenuItem(menu, `${width} × ${height} px`, "info");
	} catch (error) {
		errorLog('Could not read dimensions:', error);
		new Notice("Could not read image dimensions");
	}
}

/**
 * Helper to wrap menu item click handlers with common error handling
 * @param action - The action to perform
 * @param errorMessage - The message to show on error
 * @returns An async function that can be used as a click handler
 */
export function createMenuClickHandler(this: PixelPerfectImage, action: () => Promise<void>, errorMessage: string): () => Promise<void> {
	return async () => {
		try {
			await action();
		} catch (error) {
			errorLog(errorMessage, error);
			// Use the actual error message if available, otherwise fall back to the generic message
			const displayMessage = error instanceof Error ? error.message : errorMessage;
			new Notice(displayMessage);
		}
	};
}

/**
 * Helper to create a menu item with consistent patterns
 * @param menu - The menu to add the item to
 * @param title - The title of the menu item
 * @param icon - The icon to use
 * @param action - The action to perform when clicked
 * @param errorMessage - The error message to show if the action fails
 * @param disabled - Whether the item should be disabled
 */
export function addMenuItem(
	this: PixelPerfectImage,
	menu: Menu,
	title: string,
	icon: string,
	action: () => Promise<void>,
	errorMessage: string,
	disabled = false
): void {
	menu.addItem((item) => {
		item.setTitle(title)
			.setIcon(icon)
			.setDisabled(disabled)
			.onClick(createMenuClickHandler.call(this, action, errorMessage));
	});
}

/**
 * Adds resize percentage options to the context menu.
 * Each option will resize the image to the specified percentage of its original size.
 * @param menu - The context menu to add items to
 * @param ev - The original mouse event
 */
export async function addResizeMenuItems(this: PixelPerfectImage, menu: Menu, ev: MouseEvent | TouchEvent): Promise<void> {
	const img = findImageElement(ev.target);
	if (!img) return;

	// Add copy to clipboard option first
	addMenuItem.call(
		this,
		menu,
		'Copy image',
		'copy',
		async () => {
			await this.copyImageToClipboard(img);
			new Notice('Image copied to clipboard');
		},
		'Failed to copy image to clipboard'
	);

	// Add copy local path option
	addMenuItem.call(
		this,
		menu,
		'Copy local path',
		'link',
		async () => {
			const result = await this.getImageFileWithErrorHandling(img);
			if (!result) return;
			
			// @ts-ignore - Using Electron's __dirname global
			const vaultPath = (this.app.vault.adapter as any).basePath;
			const fullPath = join(vaultPath, normalizePath(result.imgFile.path));
			await navigator.clipboard.writeText(fullPath);
			new Notice('File path copied to clipboard');
		},
		'Failed to copy file path'
	);

	// Add separator before resize options
	menu.addSeparator();

	// Get current scale and file info
	const result = await this.getImageFileWithErrorHandling(img);
	let currentScale: number | null = null;
	let currentWidth: number | null = null;
	
	if (result) {
		const { width } = await this.readImageDimensions(result.imgFile);
		currentWidth = this.getCurrentImageWidth(img, result.activeFile, result.imgFile);
		currentScale = currentWidth !== null ? Math.round((currentWidth / width) * 100) : null;
	}

	// Add resize options from settings
	if (this.settings.customResizeSizes.length > 0) {
		this.settings.customResizeSizes.forEach(sizeStr => {
			const match = sizeStr.match(/^(\d+)(px|%)$/);
			if (!match) return; // Skip invalid formats
			
			const value = parseInt(match[1]);
			const unit = match[2];
			const label = `Resize to ${sizeStr}`;
			const isPercentage = unit === '%';
			const disabled = isPercentage ? (currentScale === value) : (currentWidth === value);
			
			addMenuItem.call(
				this,
				menu,
				label,
				'image',
				async () => await this.resizeImage(img, value, !isPercentage),
				`Failed to resize image to ${sizeStr}`,
				disabled
			);
		});
	}

	// Add option to remove custom size if one is set
	if (result && currentScale !== null) {
		addMenuItem.call(
			this,
			menu,
			'Remove custom size',
			'reset',
			async () => {
				await this.removeImageWidth(result.imgFile);
				new Notice('Removed custom size from image');
			},
			'Failed to remove custom size from image'
		);
	}
}

/**
 * Adds file operation menu items like Show in Finder/Explorer and Open in Default App
 */
export function addFileOperationMenuItems(this: PixelPerfectImage, menu: Menu, target: HTMLImageElement): void {
	// Skip all desktop-only operations on mobile
	if (Platform.isMobile) return;

	const isMac = Platform.isMacOS;

	// Add show in system explorer option
	if (this.settings.showShowInFileExplorer) {
		addMenuItem.call(
			this,
			menu,
			isMac ? 'Show in Finder' : 'Show in Explorer',
			'folder-open',
			async () => {
				const result = await this.getImageFileWithErrorHandling(target);
				if (!result) return;
				await this.showInSystemExplorer(result.imgFile);
			},
			'Failed to open system explorer'
		);
	}

	// Add rename option
	if (this.settings.showRenameOption) {
		addMenuItem.call(
			this,
			menu,
			'Rename image',
			'pencil',
			async () => {
				const result = await this.getImageFileWithErrorHandling(target);
				if (!result) return;
				await this.renameImage(result.imgFile);
			},
			'Failed to rename image'
		);
	}

	// Add delete option
	if (this.settings.showDeleteImageOption) {
		addMenuItem.call(
			this,
			menu,
			'Delete image and link',
			'trash',
			async () => {
				const result = await this.getImageFileWithErrorHandling(target);
				if (!result) return;
				await this.deleteImageAndLink(result.imgFile);
			},
			'Failed to delete image'
		);
	}

	// Add separator if any file operation was added
	if (this.settings.showRenameOption || this.settings.showDeleteImageOption || this.settings.showShowInFileExplorer) {
		menu.addSeparator();
	}

	// Add open in new tab option
	if (this.settings.showOpenInNewTab) {
		addMenuItem.call(
			this,
			menu,
			'Open in new tab',
			'link-2',
			async () => {
				const result = await this.getImageFileWithErrorHandling(target);
				if (!result) return;
				await this.app.workspace.openLinkText(result.imgFile.path, '', true);
			},
			'Failed to open image in new tab'
		);
	}

	// Add open in default app option
	if (this.settings.showOpenInDefaultApp) {
		addMenuItem.call(
			this,
			menu,
			'Open in default app',
			'image',
			async () => {
				const result = await this.getImageFileWithErrorHandling(target);
				if (!result) return;
				await this.openInDefaultApp(result.imgFile);
			},
			'Failed to open in default app'
		);
	}

	// Add external editor option if path is set
	const editorPath = getExternalEditorPath(this.settings);
	if (editorPath?.trim()) {
		const editorName = this.settings.externalEditorName.trim() || "external editor";
		addMenuItem.call(
			this,
			menu,
			`Open in ${editorName}`,
			'edit',
			async () => {
				const result = await this.getImageFileWithErrorHandling(target);
				if (!result) return;
				await this.openInExternalEditor(result.imgFile.path);
			},
			`Failed to open image in ${editorName}`
		);
	}
}

// Import necessary functions from node modules for join and normalizePath
import { join } from 'path';
import { normalizePath } from 'obsidian';