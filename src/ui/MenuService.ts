import { FileSystemAdapter, Menu, Notice, Platform, normalizePath } from 'obsidian';
import type PixelPerfectImage from '../main';
import { findImageElement, errorLog, isRemoteImage } from '../utils/utils';
import { getExternalEditorPath } from './settings';
import { join } from 'path';

/**
 * Service for managing context menus and menu interactions
 */
export class MenuService {
    private plugin: PixelPerfectImage;
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    /**
     * Registers a context menu handler for images in the editor.
     * The menu provides options to view image dimensions and resize the image.
     */
    registerImageContextMenu(): void {
        // Add support for both desktop right-click and mobile long-press
        this.plugin.registerDomEvent(document, 'contextmenu', this.handleContextMenu.bind(this), true);
        
        // Add mobile long-press support
        let longPressTimer: NodeJS.Timeout;
        
        this.plugin.registerDomEvent(document, 'touchstart', (ev: TouchEvent) => {
            // Ignore multi-touch events to avoid interfering with pinch zooming
            if (ev.touches.length > 1) return;
            
            const img = findImageElement(ev.target);
            if (!img) return;
            
            longPressTimer = setTimeout(() => {
                this.handleContextMenu(ev);
            }, 500); // 500ms long press
        }, true);
        
        this.plugin.registerDomEvent(document, 'touchend', () => {
            clearTimeout(longPressTimer);
        }, true);
        
        this.plugin.registerDomEvent(document, 'touchmove', () => {
            clearTimeout(longPressTimer);
        }, true);
    }

    async handleContextMenu(ev: MouseEvent | TouchEvent) {
        // For touch events, ignore multi-touch to prevent triggering during pinch zoom
        if ('touches' in ev && ev.touches.length > 1) return;
        
        const img = findImageElement(ev.target);
        if (!img) return;

        // Prevent default context menu
        ev.preventDefault();

        const menu = new Menu();
        
        // Check if this is a remote image
        const isRemote = isRemoteImage(img);
        
        if (isRemote) {
            // For remote images, show indicator and limited options
            this.addInfoMenuItem(menu, 'Remote image', 'globe');
            
            // Copy URL option for remote images
            this.addMenuItem(
                menu,
                'Copy image URL',
                'link',
                async () => {
                    await navigator.clipboard.writeText(img.src);
                    new Notice('Image URL copied to clipboard');
                },
                'Failed to copy image URL'
            );
        } else {
            // For local images, show all normal options
            await this.addDimensionsMenuItem(menu, img);
            await this.addResizeMenuItems(menu, ev);
            
            // Only add file operations on desktop
            if (!Platform.isMobile) {
                menu.addSeparator();
                this.addFileOperationMenuItems(menu, img);
            }
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
    addInfoMenuItem(menu: Menu, title: string, icon: string): void {
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
    async addDimensionsMenuItem(menu: Menu, img: HTMLImageElement): Promise<void> {
        // Only add file info if the setting is enabled
        if (!this.plugin.settings.showFileInfo) return;

        try {
            const result = await this.plugin.fileService.getImageFileWithErrorHandling(img);
            if (!result) return;

            const { width, height } = await this.plugin.imageService.readImageDimensions(result.imgFile);

            // Get current scale if set
            const currentScale = this.plugin.imageService.calculateImageScale(result.activeFile, result.imgFile, width);
            const scaleText = currentScale !== null ? ` @ ${currentScale}%` : '';

            // Add filename menu item with scale
            this.addInfoMenuItem(menu, `${result.imgFile.name}${scaleText}`, "image-file");

            // Add dimensions menu item
            this.addInfoMenuItem(menu, `${width} × ${height} px`, "info");
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
    createMenuClickHandler(action: () => Promise<void>, errorMessage: string): () => Promise<void> {
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
    addMenuItem(
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
                .onClick(this.createMenuClickHandler(action, errorMessage));
        });
    }

    /**
     * Adds resize percentage options to the context menu.
     * Each option will resize the image to the specified percentage of its original size.
     * @param menu - The context menu to add items to
     * @param ev - The original mouse event
     */
    async addResizeMenuItems(menu: Menu, ev: MouseEvent | TouchEvent): Promise<void> {
        const img = findImageElement(ev.target);
        if (!img) return;

        // Add copy to clipboard option first
        this.addMenuItem(
            menu,
            'Copy image',
            'copy',
            async () => {
                await this.plugin.imageService.copyImageToClipboard(img);
                new Notice('Image copied to clipboard');
            },
            'Failed to copy image to clipboard'
        );

        // Add copy local path option
        this.addMenuItem(
            menu,
            'Copy local path',
            'link',
            async () => {
                const result = await this.plugin.fileService.getImageFileWithErrorHandling(img);
                if (!result) return;
                
                // Get vault path from adapter
                const adapter = this.plugin.app.vault.adapter;
                if (!(adapter instanceof FileSystemAdapter)) {
                    new Notice('Cannot copy path - not using file system adapter');
                    return;
                }
                const vaultPath = adapter.getBasePath();
                const fullPath = join(vaultPath, normalizePath(result.imgFile.path));
                await navigator.clipboard.writeText(fullPath);
                new Notice('File path copied to clipboard');
            },
            'Failed to copy file path'
        );

        // Add separator before resize options
        menu.addSeparator();

        // Get current scale and file info
        const result = await this.plugin.fileService.getImageFileWithErrorHandling(img);
        let currentScale: number | null = null;
        let currentWidth: number | null = null;
        
        if (result) {
            const { width } = await this.plugin.imageService.readImageDimensions(result.imgFile);
            currentWidth = this.plugin.imageService.getCurrentImageWidth(result.activeFile, result.imgFile);
            currentScale = currentWidth !== null ? Math.round((currentWidth / width) * 100) : null;
        }

        // Add resize options from settings
        if (this.plugin.settings.customResizeSizes.length > 0) {
            this.plugin.settings.customResizeSizes.forEach(sizeStr => {
                const match = sizeStr.match(/^(\d+)(px|%)$/);
                if (!match) return; // Skip invalid formats
                
                const value = parseInt(match[1]);
                const unit = match[2];
                const label = `Resize to ${sizeStr}`;
                const isPercentage = unit === '%';
                const disabled = isPercentage ? (currentScale === value) : (currentWidth === value);
                
                this.addMenuItem(
                    menu,
                    label,
                    'image',
                    async () => await this.plugin.imageService.resizeImage(img, value, !isPercentage),
                    `Failed to resize image to ${sizeStr}`,
                    disabled
                );
            });
        }

        // Add option to remove custom size if one is set
        if (result && currentScale !== null) {
            this.addMenuItem(
                menu,
                'Remove custom size',
                'reset',
                async () => {
                    await this.plugin.imageService.removeImageWidth(result.imgFile);
                    new Notice('Removed custom size from image');
                },
                'Failed to remove custom size from image'
            );
        }
    }

    /**
     * Adds file operation menu items like Show in Finder/Explorer and Open in Default App
     */
    addFileOperationMenuItems(menu: Menu, target: HTMLImageElement): void {
        // Skip all desktop-only operations on mobile
        if (Platform.isMobile) return;

        const isMac = Platform.isMacOS;

        // Add show in system explorer option
        if (this.plugin.settings.showShowInFileExplorer) {
            this.addMenuItem(
                menu,
                isMac ? 'Show in Finder' : 'Show in Explorer',
                'folder-open',
                async () => {
                    const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
                    if (!result) return;
                    await this.plugin.fileService.showInSystemExplorer(result.imgFile);
                },
                'Failed to open system explorer'
            );
        }

        // Add rename option
        if (this.plugin.settings.showRenameOption) {
            this.addMenuItem(
                menu,
                'Rename image',
                'pencil',
                async () => {
                    const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
                    if (!result) return;
                    await this.plugin.fileService.renameImage(result.imgFile);
                },
                'Failed to rename image'
            );
        }

        // Add delete option
        if (this.plugin.settings.showDeleteImageOption) {
            this.addMenuItem(
                menu,
                'Delete image and link',
                'trash',
                async () => {
                    const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
                    if (!result) return;
                    await this.plugin.fileService.deleteImageAndLink(result.imgFile);
                },
                'Failed to delete image'
            );
        }

        // Add separator if any file operation was added
        if (this.plugin.settings.showRenameOption || this.plugin.settings.showDeleteImageOption || this.plugin.settings.showShowInFileExplorer) {
            menu.addSeparator();
        }

        // Add open in new tab option
        if (this.plugin.settings.showOpenInNewTab) {
            this.addMenuItem(
                menu,
                'Open in new tab',
                'link-2',
                async () => {
                    const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
                    if (!result) return;
                    await this.plugin.app.workspace.openLinkText(result.imgFile.path, '', true);
                },
                'Failed to open image in new tab'
            );
        }

        // Add open in default app option
        if (this.plugin.settings.showOpenInDefaultApp) {
            this.addMenuItem(
                menu,
                'Open in default app',
                'image',
                async () => {
                    const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
                    if (!result) return;
                    await this.plugin.fileService.openInDefaultApp(result.imgFile);
                },
                'Failed to open in default app'
            );
        }

        // Add external editor option if path is set
        const editorPath = getExternalEditorPath(this.plugin.settings);
        if (editorPath?.trim()) {
            const editorName = this.plugin.settings.externalEditorName.trim() || "external editor";
            this.addMenuItem(
                menu,
                `Open in ${editorName}`,
                'edit',
                async () => {
                    const result = await this.plugin.fileService.getImageFileWithErrorHandling(target);
                    if (!result) return;
                    await this.plugin.fileService.openInExternalEditor(result.imgFile.path);
                },
                `Failed to open image in ${editorName}`
            );
        }
    }
}