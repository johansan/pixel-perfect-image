import { MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { errorLog } from '../utils/utils';
import { WIKILINK_IMAGE_REGEX, MARKDOWN_IMAGE_REGEX } from '../utils/constants';
import { strings } from '../i18n';

/**
 * Service for handling image operations like resizing, reading dimensions, and copying
 */
export class ImageService {
    private plugin: PixelPerfectImage;
    /** Cache to store image dimensions to avoid repeated file reads */
    private dimensionCache = new Map<string, { width: number; height: number }>();
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    /**
     * Clear the dimension cache
     */
    clearDimensionCache(): void {
        this.dimensionCache.clear();
    }

    /**
     * Resizes an image in the editor by updating its wikilink width parameter.
     * @param img - The HTML image element
     * @param size - Either a percentage (e.g. 50) or absolute width in pixels (e.g. 600)
     * @param isAbsolute - If true, size is treated as pixels, otherwise as percentage
     */
    async resizeImage(img: HTMLImageElement, size: number, isAbsolute = false) {
        const result = await this.plugin.fileService.getImageFileWithErrorHandling(img);
        if (!result) {
            throw new Error("Could not find the image file");
        }

        const { width } = await this.readImageDimensions(result.imgFile);
        const newWidth = isAbsolute ? size : Math.round((width * size) / 100);
        await this.updateImageLinkWidth(result.imgFile, newWidth);
    }

    /**
     * Updates the width parameter in wikilinks that reference a specific image.
     * @param imageFile - The image file being referenced
     * @param newWidth - The new width to set in pixels
     */
    async updateImageLinkWidth(imageFile: TFile, newWidth: number) {
        await this.plugin.linkService.updateImageLinks(imageFile, (params: string[]) => {
            // Check if the last parameter is a number (likely a width)
            const lastParam = params.length > 0 ? params[params.length - 1] : null;
            const lastParamIsNumber = lastParam !== null && !isNaN(parseInt(lastParam));
            
            if (lastParamIsNumber) {
                // Replace just the last parameter (width) and keep all other attributes
                return [...params.slice(0, params.length - 1), String(newWidth)];
            } 
                // No existing width, so append the new width while preserving all attributes
                return [...params, String(newWidth)];
            
        });
    }

    /**
     * Removes the width parameter from image links.
     * @param imageFile - The image file being referenced
     */
    async removeImageWidth(imageFile: TFile) {
        await this.plugin.linkService.updateImageLinks(imageFile, (params: string[]) => {
            // Check if the last parameter is a number (likely a width)
            const lastParam = params.length > 0 ? params[params.length - 1] : null;
            const lastParamIsNumber = lastParam !== null && !isNaN(parseInt(lastParam));
            
            if (lastParamIsNumber) {
                // Remove just the last parameter (width) and keep all other attributes
                return params.slice(0, params.length - 1);
            } 
                // No width parameter found, return unchanged
                return params;
            
        });
    }

    /**
     * Reads an image file from the vault and determines its dimensions.
     * Uses a cache to avoid repeated file reads.
     * @param file - The image file to read
     * @returns Object containing width and height in pixels
     */
    async readImageDimensions(file: TFile): Promise<{ width: number; height: number }> {
        if (this.dimensionCache.has(file.path)) {
            const cached = this.dimensionCache.get(file.path);
            if (cached) return cached;
        }

        try {
            const data = await this.plugin.app.vault.readBinary(file);
            const blob = this.createBlob(data, "image/*");
            const url = URL.createObjectURL(blob);

            try {
                const img = await this.loadImage(url);
                const dimensions = { width: img.width, height: img.height };
                this.dimensionCache.set(file.path, dimensions);
                return dimensions;
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            errorLog('Failed to read image file:', error);
            throw error;
        }
    }

    /**
     * Calculates the current scale of an image as a percentage
     * @param activeFile - The active file
     * @param imageFile - The image file
     * @param actualWidth - The actual width of the image in pixels
     * @returns The current scale as a percentage, or null if no custom width is set
     */
    calculateImageScale(activeFile: TFile, imageFile: TFile, actualWidth: number): number | null {
        const customWidth = this.getCurrentImageWidth(activeFile, imageFile);
        if (customWidth === null) return null;
        return Math.round((customWidth / actualWidth) * 100);
    }

    /**
     * Gets the current custom width of an image if set in the link
     * @param activeFile - The currently active file
     * @param imageFile - The image file
     * @returns The custom width if set, otherwise null
     */
    getCurrentImageWidth(activeFile: TFile, imageFile: TFile): number | null {
        const editor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
        if (!editor) return null;

        const docText = editor.getValue();
        let customWidth: number | null = null;

        // Helper to parse width from parameters
        const parseWidth = (pipeParams: string[]): number | null => {
            if (pipeParams.length === 0) return null;
            
            // Check the last parameter for a number (width)
            const lastParam = pipeParams[pipeParams.length - 1];
            const width = parseInt(lastParam);
            return isNaN(width) ? null : width;
        };

        // Check wiki-style links using matchAll
        for (const match of docText.matchAll(WIKILINK_IMAGE_REGEX)) {
            const [, linkInner] = match;
            
            // Handle subpath components (e.g., #heading)
            const [linkWithoutHash] = linkInner.split("#", 1);

            // Split link path and parameters
            const [linkPath, ...pipeParams] = linkWithoutHash.split("|");

            const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);
            if (resolvedFile?.path === imageFile.path) {
                const width = parseWidth(pipeParams);
                if (width !== null) {
                    customWidth = width;
                    break;  // Found the width, no need to continue
                }
            }
        }

        // If not found in wiki links, check Markdown-style links
        if (customWidth === null) {
            for (const match of docText.matchAll(MARKDOWN_IMAGE_REGEX)) {
                const [, description, linkPath] = match;
                
                // Split description and parameters
                const [, ...pipeParams] = description.split("|");
                
                // Decode URL-encoded paths before resolving
                let decodedPath = linkPath;
                try {
                    decodedPath = decodeURIComponent(linkPath);
                } catch {
                    // If decoding fails, use the original path
                }
                
                const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(decodedPath, activeFile.path);
                if (resolvedFile?.path === imageFile.path) {
                    const width = parseWidth(pipeParams);
                    if (width !== null) {
                        customWidth = width;
                        break;  // Found the width, no need to continue
                    }
                }
            }
        }

        return customWidth;
    }

    /**
     * Helper to load an image and get its dimensions
     * @param src - The image source URL
     * @param crossOrigin - Whether to set crossOrigin attribute
     * @returns Promise resolving to the loaded image
     */
    loadImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            if (crossOrigin) {
                img.crossOrigin = crossOrigin;
            }
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
    }

    /**
     * Helper to create a blob from binary data
     * @param data - The binary data
     * @param type - The MIME type of the data
     * @returns The created blob
     */
    createBlob(data: ArrayBuffer, type: string): Blob {
        return new Blob([new Uint8Array(data)], { type });
    }

    /**
     * Copies an image to the system clipboard
     * @param targetImg - The HTML image element to copy
     */
    async copyImageToClipboard(targetImg: HTMLImageElement): Promise<void> {
        try {
            // Attempt to get the image file from the vault
            const result = await this.plugin.fileService.getImageFileWithErrorHandling(targetImg);
            if (result) {
                const { imgFile } = result;
                // Read the image binary data from the vault
                const data = await this.plugin.app.vault.readBinary(imgFile);
                // Determine the correct MIME type based on file extension
                const mimeType = this.getMimeTypeForExtension(imgFile.extension);
                // Create a blob with the image data and correct MIME type
                const blob = this.createBlob(data, mimeType);
                // Create a clipboard item and write to system clipboard
                const item = new ClipboardItem({ [mimeType]: blob });
                await navigator.clipboard.write([item]);
                return;
            }

            // Fallback: load image from URL and copy via canvas
            const img = await this.loadImage(targetImg.src, 'anonymous');
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            // Draw the image to canvas and convert to blob
            ctx.drawImage(img, 0, 0);
            const blob = await new Promise<Blob | null>((resolveBlob) => {
                canvas.toBlob(resolveBlob);
            });

            if (!blob) {
                throw new Error('Failed to create blob');
            }

            // Write the blob to system clipboard
            const item = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([item]);
        } catch (error) {
            errorLog('Copy to clipboard failed:', error);
            // Check if it's a focus error and throw a more helpful message
            if (error instanceof Error && error.message.includes('Document is not focused')) {
                throw new Error(strings.notices.clickInEditorFirst);
            }
            throw error;
        }
    }

    /**
     * Resolves the MIME type for a given image extension
     */
    private getMimeTypeForExtension(extension: string): string {
        const normalized = extension.toLowerCase();
        if (normalized === 'png') return 'image/png';
        if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
        if (normalized === 'gif') return 'image/gif';
        if (normalized === 'webp') return 'image/webp';
        if (normalized === 'svg') return 'image/svg+xml';
        return 'image/*';
    }
}
