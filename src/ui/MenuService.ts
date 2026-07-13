import { FileSystemAdapter, Menu, Notice, Platform, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import {
    errorLog,
    findImageElement,
    findLastObsidianImageSizeParam,
    findMarkdownViewForElement,
    getBestHttpImageSource,
    getImageSourceCandidates,
    getWorkspaceWindows,
    isRemoteImage,
    isUserVisibleError
} from '../utils/utils';
import { getExternalEditorPath, parseResizeSize } from './settings';
import { strings } from '../i18n';

/**
 * Service for managing context menus and menu interactions
 */
export class MenuService {
    private plugin: PixelPerfectImage;
    private windowEventCleanups = new Map<Window, () => void>();
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    private getRemoteImageUrlForLinkMatching(img: HTMLImageElement): string {
        return getBestHttpImageSource(img);
    }

    private getRasterNaturalDimensions(img: HTMLImageElement): { width: number; height: number } | null {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (width > 0 && height > 0) return { width, height };
        return null;
    }

    private isSvgUrl(url: string): boolean {
        const normalized = url.trim().toLowerCase();
        if (!normalized) return false;

        if (normalized.startsWith('data:image/svg+xml')) return true;
        if (normalized.includes('image/svg+xml')) return true;

        try {
            const parsedUrl = new URL(url);
            return parsedUrl.pathname.toLowerCase().endsWith('.svg');
        } catch {
            // URL can be relative or otherwise non-parseable; fall back to string check.
            const withoutQueryOrHash = normalized.split(/[?#]/, 1)[0];
            return withoutQueryOrHash.endsWith('.svg');
        }
    }

    private isSvgBySrc(img: HTMLImageElement): boolean {
        return getImageSourceCandidates(img).some((source) => this.isSvgUrl(source));
    }

    private parseWidthFromImageAlt(img: HTMLImageElement): number | null {
        const alt = img.getAttribute('alt') ?? '';
        if (!alt) return null;
        const parts = alt.split('|').map((part) => part.trim()).filter(Boolean);
        return findLastObsidianImageSizeParam(parts)?.width ?? null;
    }

    async addRemoteResizeMenuItems(menu: Menu, img: HTMLImageElement, activeFile: TFile, imageUrl: string): Promise<void> {
        const isSvg = this.isSvgBySrc(img);
        const customWidth =
            this.parseWidthFromImageAlt(img)
            ?? this.plugin.imageService.getCurrentExternalImageWidth(activeFile, imageUrl);

        let actualWidth: number | null = null;
        if (!isSvg) {
            actualWidth = this.getRasterNaturalDimensions(img)?.width ?? null;
        }
        const currentScale = customWidth !== null && actualWidth !== null ? Math.round((customWidth / actualWidth) * 100) : null;

        // Add resize options from settings
        if (this.plugin.settings.customResizeSizes.length > 0) {
            this.plugin.settings.customResizeSizes.forEach((sizeStr) => {
                const parsed = parseResizeSize(sizeStr);
                if (!parsed) return; // Skip invalid formats

                const value = parsed.amount;
                const unit = parsed.unit;
                const label = strings.menu.resizeTo.replace('{size}', sizeStr);
                const isPercentage = unit === '%';
                const disabled = isPercentage
                    ? (isSvg && actualWidth === null ? true : (currentScale === value))
                    : (customWidth === value);

                let icon = 'image';
                if (isPercentage) {
                    icon = value === 100 ? 'image' : 'percent';
                } else {
                    icon = 'ruler';
                }

                this.addMenuItem(
                    menu,
                    label,
                    icon,
                    () => this.plugin.imageService.resizeExternalImage(activeFile, imageUrl, img, value, !isPercentage),
                    strings.notices.failedToResizeTo.replace('{size}', sizeStr),
                    disabled
                );
            });
        }

        if (customWidth !== null) {
            this.addMenuItem(
                menu,
                strings.menu.removeCustomSize,
                'reset',
                async () => {
                    await this.plugin.imageService.removeExternalImageWidth(activeFile, imageUrl);
                    new Notice(strings.notices.customSizeRemoved);
                },
                strings.notices.failedToRemoveSize
            );
        }
    }

    /**
     * Registers a context menu handler for images in the editor.
     * The menu provides options to view image dimensions and resize the image.
     */
    registerImageContextMenu(): void {
        for (const currentWindow of getWorkspaceWindows(this.plugin.app)) {
            this.registerImageContextMenuForWindow(currentWindow);
        }

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('window-open', (_workspaceWindow, currentWindow) => {
                this.registerImageContextMenuForWindow(currentWindow);
            })
        );
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('window-close', (_workspaceWindow, currentWindow) => {
                this.unregisterImageContextMenuForWindow(currentWindow);
            })
        );
    }

    private registerImageContextMenuForWindow(currentWindow: Window): void {
        if (this.windowEventCleanups.has(currentWindow)) return;

        const doc = currentWindow.document;
        const handleContextMenu = (ev: MouseEvent | TouchEvent): void => {
            void this.handleContextMenu(ev).catch(error => {
                errorLog('Failed to open image context menu:', error);
                new Notice(strings.notices.failedToPerformAction.replace('{action}', strings.actions.performAction));
            });
        };

        let longPressTimer: number | null = null;

        const clearLongPress = (): void => {
            if (longPressTimer !== null) currentWindow.clearTimeout(longPressTimer);
            longPressTimer = null;
        };
        const contextMenuHandler = (ev: MouseEvent): void => handleContextMenu(ev);
        const touchStartHandler = (ev: TouchEvent): void => {
            // Ignore multi-touch events to avoid interfering with pinch zooming
            if (ev.touches.length > 1) {
                clearLongPress();
                return;
            }

            const img = findImageElement(ev.target);
            if (!img) return;

            clearLongPress();
            longPressTimer = currentWindow.setTimeout(() => {
                longPressTimer = null;
                handleContextMenu(ev);
            }, 500); // 500ms long press
        };

        doc.addEventListener('contextmenu', contextMenuHandler, true);
        doc.addEventListener('touchstart', touchStartHandler, true);
        doc.addEventListener('touchend', clearLongPress, true);
        doc.addEventListener('touchmove', clearLongPress, true);

        this.windowEventCleanups.set(currentWindow, () => {
            clearLongPress();
            doc.removeEventListener('contextmenu', contextMenuHandler, true);
            doc.removeEventListener('touchstart', touchStartHandler, true);
            doc.removeEventListener('touchend', clearLongPress, true);
            doc.removeEventListener('touchmove', clearLongPress, true);
        });
    }

    private unregisterImageContextMenuForWindow(currentWindow: Window): void {
        const cleanup = this.windowEventCleanups.get(currentWindow);
        if (!cleanup) return;

        cleanup();
        this.windowEventCleanups.delete(currentWindow);
    }

    cleanup(): void {
        for (const cleanup of this.windowEventCleanups.values()) {
            cleanup();
        }
        this.windowEventCleanups.clear();
    }

    async handleContextMenu(ev: MouseEvent | TouchEvent) {
        // For touch events, ignore multi-touch to prevent triggering during pinch zoom
        if ('touches' in ev && ev.touches.length > 1) return;
        
        const img = findImageElement(ev.target);
        if (!img) return;

        // Resolve the markdown view that owns this image element (supports multiple panes).
        const markdownView = findMarkdownViewForElement(this.plugin.app, img);
        if (!markdownView) return;

        const menu = new Menu();
        
        // Check if this is a remote image
        const isRemote = isRemoteImage(img);
        const activeFile = markdownView.file;

        if (isRemote && !activeFile) return;

        // Suppress the native image menu once we've confirmed PPI will handle the event.
        ev.preventDefault();
        ev.stopPropagation();
        
        if (isRemote) {
            const remoteActiveFile = activeFile;
            if (!remoteActiveFile) return;
            const imageUrl = this.getRemoteImageUrlForLinkMatching(img);

            // For remote images, show indicator and limited options
            this.addInfoMenuItem(menu, strings.menu.remoteImage, 'globe');
            if (!this.isSvgBySrc(img)) {
                this.addCopyImageMenuItem(menu, img);
            }

            // Copy URL option for remote images
            this.addMenuItem(
                menu,
                strings.menu.copyImageUrl,
                'link',
                async () => {
                    const urlToCopy = this.getRemoteImageUrlForLinkMatching(img);
                    await navigator.clipboard.writeText(urlToCopy);
                    new Notice(strings.notices.imageUrlCopied);
                },
                strings.notices.failedToCopyUrl
            );

            // Resize options for remote images (updates markdown link by URL)
            menu.addSeparator();
            await this.addRemoteResizeMenuItems(menu, img, remoteActiveFile, imageUrl);
        } else {
            const resolvedImage = activeFile
                ? await this.plugin.fileService.getImageFileWithErrorHandling(img, true, activeFile)
                : await this.plugin.fileService.getImageFileWithErrorHandling(img);
            const currentWidth = resolvedImage
                ? this.plugin.imageService.getCurrentImageWidth(resolvedImage.activeFile, resolvedImage.imgFile)
                : null;
            // For local images, show all normal options
            await this.addDimensionsMenuItem(menu, img, resolvedImage, currentWidth);
            await this.addResizeMenuItems(menu, img, resolvedImage, currentWidth);
            
            // Only add file operations on desktop
            if (!Platform.isMobile) {
                menu.addSeparator();
                this.addFileOperationMenuItems(menu, resolvedImage?.imgFile ?? null);
            }
        }

        if (ev.instanceOf(MouseEvent)) {
            menu.showAtMouseEvent(ev);
            return;
        }

        const position = {
            x: ev.touches[0].pageX,
            y: ev.touches[0].pageY
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
    async addDimensionsMenuItem(
        menu: Menu,
        img: HTMLImageElement,
        resolvedImage?: { activeFile: TFile; imgFile: TFile } | null,
        currentWidth?: number | null
    ): Promise<void> {
        // Only add file info if the setting is enabled
        if (!this.plugin.settings.showFileInfo) return;

        try {
            const result = resolvedImage !== undefined
                ? resolvedImage
                : null;
            if (!result) return;

            const isSvg = result.imgFile.extension.toLowerCase() === 'svg' || this.isSvgBySrc(img);
            let width: number;
            let height: number;
            const rasterDimensions = !isSvg ? this.getRasterNaturalDimensions(img) : null;
            if (rasterDimensions) {
                ({ width, height } = rasterDimensions);
            } else {
                ({ width, height } = await this.plugin.imageService.readImageDimensions(result.imgFile));
            }

            // Get current scale if set
            const widthOverride = currentWidth !== undefined
                ? currentWidth
                : this.plugin.imageService.getCurrentImageWidth(result.activeFile, result.imgFile);
            const currentScale = widthOverride !== null ? Math.round((widthOverride / width) * 100) : null;
            const scaleText = currentScale !== null ? ` @ ${currentScale}%` : '';

            // Add filename menu item with scale
            this.addInfoMenuItem(menu, `${result.imgFile.name}${scaleText}`, "image-file");

            // Add dimensions menu item
            this.addInfoMenuItem(menu, `${width} × ${height} px`, "info");
        } catch (error) {
            errorLog('Could not read dimensions:', error);
            const message = isUserVisibleError(error) ? error.message : strings.notices.couldNotReadDimensions;
            new Notice(message);
        }
    }

    /**
     * Helper to wrap menu item click handlers with common error handling
     * @param action - The action to perform
     * @param errorMessage - The message to show on error
     * @returns A void callback that handles the asynchronous action
     */
    createMenuClickHandler(action: () => Promise<void>, errorMessage: string): () => void {
        return () => {
            void action().catch(error => {
                errorLog(errorMessage, error);
                const displayMessage = isUserVisibleError(error) ? error.message : errorMessage;
                new Notice(displayMessage);
            });
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
     * @param isWarning - Whether the item should use Obsidian's warning styling
     */
    addMenuItem(
        menu: Menu,
        title: string,
        icon: string,
        action: () => Promise<void>,
        errorMessage: string,
        disabled = false,
        isWarning = false
    ): void {
        menu.addItem((item) => {
            item.setTitle(title)
                .setIcon(icon)
                .setDisabled(disabled);
            if (isWarning) {
                item.setWarning(true);
            }
            item.onClick(this.createMenuClickHandler(action, errorMessage));
        });
    }

    /**
     * Adds the copy image menu item
     * @param menu - The menu to add the item to
     * @param img - The HTML image element
     */
    private addCopyImageMenuItem(menu: Menu, img: HTMLImageElement): void {
        this.addMenuItem(
            menu,
            strings.menu.copyImage,
            'copy',
            async () => {
                await this.plugin.imageService.copyImageToClipboard(img);
                new Notice(strings.notices.imageCopied);
            },
            strings.notices.failedToCopyImage
        );
    }

    /**
     * Adds resize percentage options to the context menu.
     * Each option will resize the image to the specified percentage of its original size.
     * @param menu - The context menu to add items to
     * @param img - The HTML image element
     */
    async addResizeMenuItems(
        menu: Menu,
        img: HTMLImageElement,
        resolvedImage?: { activeFile: TFile; imgFile: TFile } | null,
        currentWidth?: number | null
    ): Promise<void> {
        // Get current scale and file info
        const result = resolvedImage !== undefined
            ? resolvedImage
            : null;
        let currentScale: number | null = null;
        const customWidth = currentWidth !== undefined
            ? currentWidth
            : (result ? this.plugin.imageService.getCurrentImageWidth(result.activeFile, result.imgFile) : null);
        let actualWidth: number | null = null;
        if (!result) {
            if (!this.isSvgBySrc(img)) {
                this.addCopyImageMenuItem(menu, img);
            }
            return;
        }

        const { imgFile } = result;
        const isSvg = imgFile.extension.toLowerCase() === 'svg' || this.isSvgBySrc(img);

        // Add copy to clipboard option first (except for SVGs)
        if (!isSvg) {
            this.addCopyImageMenuItem(menu, img);
            menu.addSeparator();
        }

        // Add copy local path option
        this.addMenuItem(
            menu,
            strings.menu.copyLocalPath,
            'link',
            async () => {
                // Get vault path from adapter
                const adapter = this.plugin.app.vault.adapter;
                if (!(adapter instanceof FileSystemAdapter)) {
                    new Notice(strings.notices.cannotCopyPath);
                    return;
                }
                const fullPath = adapter.getFullPath(imgFile.path);
                await navigator.clipboard.writeText(fullPath);
                new Notice(strings.notices.filePathCopied);
            },
            strings.notices.failedToCopyPath
        );

        // Add separator before resize options
        menu.addSeparator();
        
        if (!isSvg) {
            actualWidth = this.getRasterNaturalDimensions(img)?.width ?? null;
        }
        if (actualWidth === null) {
            try {
                const { width } = await this.plugin.imageService.readImageDimensions(imgFile);
                actualWidth = width;
            } catch {
                actualWidth = null;
            }
        }
        currentScale = customWidth !== null && actualWidth !== null ? Math.round((customWidth / actualWidth) * 100) : null;

        // Add resize options from settings
        if (this.plugin.settings.customResizeSizes.length > 0) {
            this.plugin.settings.customResizeSizes.forEach((sizeStr) => {
                const parsed = parseResizeSize(sizeStr);
                if (!parsed) return; // Skip invalid formats

                const value = parsed.amount;
                const unit = parsed.unit;
                const label = strings.menu.resizeTo.replace('{size}', sizeStr);
                const isPercentage = unit === '%';
                const disabled = isPercentage
                    ? (isSvg && actualWidth === null ? true : (currentScale === value))
                    : (customWidth === value);
                
                // Choose icon based on unit type and value
                let icon = 'image';
                if (isPercentage) {
                    if (value === 100) {
                        icon = 'image';  // Original size (100%)
                    } else {
                        icon = 'percent';  // Any other percentage
                    }
                } else {
                    // Use ruler/dimensions icon for pixel sizes
                    icon = 'ruler';  // Fixed pixel size
                }
                
                this.addMenuItem(
                    menu,
                    label,
                    icon,
                    () => this.plugin.imageService.resizeImage(img, value, !isPercentage, result.activeFile),
                    strings.notices.failedToResizeTo.replace('{size}', sizeStr),
                    disabled
                );
            });
        }

        // Add option to remove custom size if one is set
        if (customWidth !== null) {
            this.addMenuItem(
                menu,
                strings.menu.removeCustomSize,
                'reset',
                async () => {
                    await this.plugin.imageService.removeImageWidth(imgFile, result.activeFile);
                    new Notice(strings.notices.customSizeRemoved);
                },
                strings.notices.failedToRemoveSize
            );
        }
    }

    /**
     * Adds file operation menu items like Show in Finder/Explorer and Open in Default App
     */
    addFileOperationMenuItems(menu: Menu, imgFile: TFile | null): void {
        // Skip all desktop-only operations on mobile
        if (Platform.isMobile) return;
        if (!imgFile) return;

        const isMac = Platform.isMacOS;
        const editorPath = getExternalEditorPath(this.plugin.settings);
        const hasExternalEditor = !!editorPath?.trim();
        const hasOpenLeafOption = this.plugin.settings.showOpenInNewTab ||
            this.plugin.settings.showOpenToTheRight ||
            this.plugin.settings.showOpenInNewWindow;

        // Add open in new tab option
        if (this.plugin.settings.showOpenInNewTab) {
            this.addMenuItem(
                menu,
                strings.menu.openInNewTab,
                'lucide-file-plus',
                async () => {
                    await this.plugin.app.workspace.openLinkText(imgFile.path, '', true);
                },
                strings.notices.failedToOpenInNewTab
            );
        }

        // Add open to the right option
        if (this.plugin.settings.showOpenToTheRight) {
            this.addMenuItem(
                menu,
                strings.menu.openToTheRight,
                'lucide-separator-vertical',
                async () => {
                    const leaf = this.plugin.app.workspace.getLeaf('split', 'vertical');
                    await leaf.openFile(imgFile);
                    this.plugin.app.workspace.setActiveLeaf(leaf);
                },
                strings.notices.failedToOpenToTheRight
            );
        }

        // Add open in new window option
        if (this.plugin.settings.showOpenInNewWindow) {
            this.addMenuItem(
                menu,
                strings.menu.openInNewWindow,
                'lucide-app-window',
                async () => {
                    const leaf = this.plugin.app.workspace.getLeaf('window');
                    await leaf.openFile(imgFile);
                    this.plugin.app.workspace.setActiveLeaf(leaf);
                },
                strings.notices.failedToOpenInNewWindow
            );
        }

        if (hasOpenLeafOption && (this.plugin.settings.showOpenInDefaultApp || hasExternalEditor)) {
            menu.addSeparator();
        }

        // Add open in default app option
        if (this.plugin.settings.showOpenInDefaultApp) {
            this.addMenuItem(
                menu,
                strings.menu.openInDefaultApp,
                'image',
                async () => {
                    await this.plugin.fileService.openInDefaultApp(imgFile);
                },
                strings.notices.failedToOpenInDefaultApp
            );
        }

        // Add external editor option if path is set
        if (hasExternalEditor) {
            const editorName = this.plugin.settings.externalEditorName.trim() || "external editor";
            this.addMenuItem(
                menu,
                strings.menu.openInEditor.replace('{editor}', editorName),
                'edit',
                async () => {
                    await this.plugin.fileService.openInExternalEditor(imgFile.path);
                },
                strings.notices.failedToOpenInEditor.replace('{editor}', editorName)
            );
        }

        // Add separator before file operations
        if (this.plugin.settings.showShowInFileExplorer || this.plugin.settings.showRenameOption || this.plugin.settings.showDeleteImageOption) {
            menu.addSeparator();
        }

        // Add show in system explorer option
        if (this.plugin.settings.showShowInFileExplorer) {
            this.addMenuItem(
                menu,
                isMac ? strings.menu.showInFinder : strings.menu.showInExplorer,
                isMac ? 'lucide-app-window-mac' : 'lucide-app-window',
                async () => {
                    await this.plugin.fileService.showInSystemExplorer(imgFile);
                },
                strings.notices.failedToOpenExplorer
            );
        }

        // Add rename option
        if (this.plugin.settings.showRenameOption) {
            this.addMenuItem(
                menu,
                strings.menu.renameImage,
                'pencil',
                async () => {
                    await this.plugin.fileService.renameImage(imgFile);
                },
                strings.notices.failedToRenameImage
            );
        }

        // Add delete option (last)
        if (this.plugin.settings.showDeleteImageOption) {
            this.addMenuItem(
                menu,
                strings.menu.deleteImageAndLink,
                'lucide-trash',
                async () => {
                    await this.plugin.fileService.deleteImageAndLink(imgFile);
                },
                strings.notices.failedToDeleteImage,
                false,
                true
            );
        }
    }
}
