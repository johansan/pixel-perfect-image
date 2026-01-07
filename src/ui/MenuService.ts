import { FileSystemAdapter, Menu, Notice, Platform, normalizePath, MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { findImageElement, errorLog, findLastObsidianImageSizeParam, getBestHttpImageSource, getImageSourceCandidates, isRemoteImage, isUserVisibleError } from '../utils/utils';
import { getExternalEditorPath, parseResizeSize } from './settings';
import { join } from 'path';
import { strings } from '../i18n';
import { findMarkdownViewForElement } from '../utils/utils';

/**
 * Service for managing context menus and menu interactions
 */
export class MenuService {
    private plugin: PixelPerfectImage;
    
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
        // Add support for both desktop right-click and mobile long-press
        this.plugin.registerDomEvent(document, 'contextmenu', this.handleContextMenu.bind(this), true);
        
        // Add mobile long-press support
        let longPressTimer: ReturnType<typeof setTimeout> | null = null;
        
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
            if (longPressTimer) clearTimeout(longPressTimer);
            longPressTimer = null;
        }, true);
        
        this.plugin.registerDomEvent(document, 'touchmove', () => {
            if (longPressTimer) clearTimeout(longPressTimer);
            longPressTimer = null;
        }, true);
    }

    async handleContextMenu(ev: MouseEvent | TouchEvent) {
        // For touch events, ignore multi-touch to prevent triggering during pinch zoom
        if ('touches' in ev && ev.touches.length > 1) return;
        
        const img = findImageElement(ev.target);
        if (!img) return;

        // Resolve the markdown view that owns this image element (supports multiple panes).
        const markdownView =
            findMarkdownViewForElement(this.plugin.app, img)
            ?? this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView) return;

        // Prevent default context menu
        ev.preventDefault();

        const menu = new Menu();
        
        // Check if this is a remote image
        const isRemote = isRemoteImage(img);
        
        if (isRemote) {
            const activeFile = markdownView.file;
            if (!activeFile) return;
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
            await this.addRemoteResizeMenuItems(menu, img, activeFile, imageUrl);
        } else {
            const activeFile = markdownView.file;
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
                : await this.plugin.fileService.getImageFileWithErrorHandling(img);
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
     * @returns An async function that can be used as a click handler
     */
    createMenuClickHandler(action: () => Promise<void>, errorMessage: string): () => Promise<void> {
        return async () => {
            try {
                await action();
            } catch (error) {
                errorLog(errorMessage, error);
                const displayMessage = isUserVisibleError(error) ? error.message : errorMessage;
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
            : await this.plugin.fileService.getImageFileWithErrorHandling(img);
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
                const vaultPath = adapter.getBasePath();
                const fullPath = join(vaultPath, normalizePath(imgFile.path));
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
                strings.notices.failedToDeleteImage
            );
        }
    }
}
