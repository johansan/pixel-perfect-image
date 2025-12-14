import { MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { createUserVisibleError, errorLog, findLastObsidianImageSizeParam, isUserVisibleError } from '../utils/utils';
import { strings } from '../i18n';

/**
 * Service for handling image operations like resizing, reading dimensions, and copying
 */
export class ImageService {
    private plugin: PixelPerfectImage;
    /** Cache to store image dimensions to avoid repeated file reads */
    private dimensionCache = new Map<string, { width: number; height: number }>();
    private static readonly DIMENSION_CACHE_MAX_ENTRIES = 300;
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    private setDimensionCache(path: string, dimensions: { width: number; height: number }) {
        this.dimensionCache.set(path, dimensions);
        if (this.dimensionCache.size <= ImageService.DIMENSION_CACHE_MAX_ENTRIES) return;
        const oldestKey = this.dimensionCache.keys().next().value as string | undefined;
        if (oldestKey) this.dimensionCache.delete(oldestKey);
    }

    private decodeText(data: ArrayBuffer): string {
        const bytes = new Uint8Array(data);

        if (bytes.length >= 2) {
            // UTF-16 BOMs
            if (bytes[0] === 0xff && bytes[1] === 0xfe) {
                return new TextDecoder('utf-16le').decode(bytes);
            }
            if (bytes[0] === 0xfe && bytes[1] === 0xff) {
                // Swap to LE for broad compatibility.
                const swapped = new Uint8Array(bytes.length);
                swapped.set(bytes);
                for (let i = 0; i + 1 < swapped.length; i += 2) {
                    const a = swapped[i];
                    swapped[i] = swapped[i + 1];
                    swapped[i + 1] = a;
                }
                return new TextDecoder('utf-16le').decode(swapped);
            }
        }

        // UTF-8 BOM
        if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            return new TextDecoder('utf-8').decode(bytes);
        }

        const utf8 = new TextDecoder('utf-8').decode(bytes);
        // Heuristic: lots of NULs usually means UTF-16LE content without BOM.
        if (utf8.slice(0, 200).includes('\u0000')) {
            try {
                return new TextDecoder('utf-16le').decode(bytes);
            } catch {
                // fall through
            }
        }

        return utf8;
    }

    private getMimeTypeForExtension(extension: string): string {
        switch (extension.toLowerCase()) {
            case 'png':
                return 'image/png';
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'gif':
                return 'image/gif';
            case 'webp':
                return 'image/webp';
            case 'avif':
                return 'image/avif';
            case 'bmp':
                return 'image/bmp';
            case 'tif':
            case 'tiff':
                return 'image/tiff';
            case 'svg':
                return 'image/svg+xml';
            default:
                return 'image/*';
        }
    }

    private parseSvgLengthToPx(value: string | null): number | null {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed) return null;

        const match = trimmed.match(/^([+-]?(?:\d+|\d*\.\d+))\s*([a-z%]*)$/i);
        if (!match) return null;

        const numberValue = Number(match[1]);
        if (!Number.isFinite(numberValue)) return null;

        const unit = (match[2] || '').toLowerCase();
        if (unit === '' || unit === 'px') return numberValue;

        // SVG/CSS absolute units (assuming 96 CSS px per inch)
        switch (unit) {
            case 'in':
                return numberValue * 96;
            case 'cm':
                return (numberValue * 96) / 2.54;
            case 'mm':
                return (numberValue * 96) / 25.4;
            case 'pt':
                return (numberValue * 96) / 72;
            case 'pc':
                return numberValue * 16; // 12pt = 16px
            case 'q':
                return (numberValue * 96) / 101.6; // quarter-millimeters
            default:
                return null;
        }
    }

    private readSvgDimensionsFromBinary(data: ArrayBuffer): { width: number; height: number } | null {
        try {
            const svgText = this.decodeText(data);

            // DOMParser path
            const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
            const svg = doc.querySelector('svg');
            const widthAttr = svg?.getAttribute('width') ?? null;
            const heightAttr = svg?.getAttribute('height') ?? null;
            const viewBoxAttr = svg?.getAttribute('viewBox') ?? svg?.getAttribute('viewbox') ?? null;

            // Regex fallback (covers malformed XML or parser quirks)
            const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] ?? '';
            const widthAttrRegex = svgTag.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
            const heightAttrRegex = svgTag.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
            const viewBoxAttrRegex = svgTag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
                ?? svgTag.match(/\bviewbox\s*=\s*["']([^"']+)["']/i)?.[1]
                ?? null;

            const widthPx = this.parseSvgLengthToPx(widthAttr) ?? this.parseSvgLengthToPx(widthAttrRegex);
            const heightPx = this.parseSvgLengthToPx(heightAttr) ?? this.parseSvgLengthToPx(heightAttrRegex);
            const viewBox = viewBoxAttr ?? viewBoxAttrRegex;

            const normalizedWidthPx = widthPx !== null && widthPx > 0 ? widthPx : null;
            const normalizedHeightPx = heightPx !== null && heightPx > 0 ? heightPx : null;

            // Design decision:
            // - Prefer explicit `width`/`height` when present (after unit normalization).
            // - Treat `viewBox` as an aspect-ratio hint only, not an intrinsic pixel size.
            //   (Browsers typically default SVG viewport to 300×150 when width/height are omitted.)
            if (normalizedWidthPx !== null && normalizedHeightPx !== null) {
                return { width: Math.round(normalizedWidthPx), height: Math.round(normalizedHeightPx) };
            }

            if (viewBox) {
                const parts = viewBox.trim().split(/[\s,]+/).map((part) => Number(part));
                if (parts.length >= 4 && parts.every((n) => Number.isFinite(n))) {
                    const vbWidth = parts[2];
                    const vbHeight = parts[3];
                    if (vbWidth > 0 && vbHeight > 0) {
                        // If neither width nor height are specified, follow common browser defaults
                        // instead of using the viewBox as an intrinsic pixel size.
                        if (normalizedWidthPx === null && normalizedHeightPx === null) {
                            return { width: 300, height: 150 };
                        }
                        if (normalizedWidthPx !== null && normalizedHeightPx === null) {
                            return {
                                width: Math.round(normalizedWidthPx),
                                height: Math.round((normalizedWidthPx * vbHeight) / vbWidth)
                            };
                        }
                        if (normalizedWidthPx === null && normalizedHeightPx !== null) {
                            return {
                                width: Math.round((normalizedHeightPx * vbWidth) / vbHeight),
                                height: Math.round(normalizedHeightPx)
                            };
                        }
                    }
                }
            }

            // SVG intrinsic size defaults (most browsers): 300×150 when width/height are omitted.
            // If only one dimension is provided and we can't infer the other, default the missing one.
            if (normalizedWidthPx === null && normalizedHeightPx === null) {
                return { width: 300, height: 150 };
            }

            if (normalizedWidthPx !== null && normalizedHeightPx === null) {
                return { width: Math.round(normalizedWidthPx), height: 150 };
            }
            if (normalizedWidthPx === null && normalizedHeightPx !== null) {
                return { width: 300, height: Math.round(normalizedHeightPx) };
            }

            return { width: 300, height: 150 };
        } catch {
            return null;
        }
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
        const result = await this.plugin.fileService.getImageFileWithErrorHandling(img, false);
        if (!result) {
            throw createUserVisibleError(strings.notices.couldNotLocateImage);
        }

        if (isAbsolute) {
            await this.updateImageLinkWidth(result.imgFile, size, result.activeFile);
            return;
        }

        const { width } = await this.readImageDimensions(result.imgFile);
        const newWidth = Math.round((width * size) / 100);
        await this.updateImageLinkWidth(result.imgFile, newWidth, result.activeFile);
    }

    /**
     * Updates the width parameter in wikilinks that reference a specific image.
     * @param imageFile - The image file being referenced
     * @param newWidth - The new width to set in pixels
     */
    async updateImageLinkWidth(imageFile: TFile, newWidth: number, activeFileOverride?: TFile) {
        const activeFile = activeFileOverride ?? this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            throw new Error('No active file, cannot update link.');
        }
        await this.plugin.linkService.updateImageLinks(activeFile, imageFile, (params: string[]) => {
            const sizeParam = findLastObsidianImageSizeParam(params);
            if (sizeParam) {
                // Replace just the size parameter and keep all other attributes
                // If the existing size is in WxH form, drop the height to avoid distortion
                // since this plugin operates on width-only resizing.
                const replacement = String(newWidth);
                return [...params.slice(0, sizeParam.index), replacement, ...params.slice(sizeParam.index + 1)];
            }

            // No existing width, so append the new width while preserving all attributes
            return [...params, String(newWidth)];
            
        });
    }

    /**
     * Removes the width parameter from image links.
     * @param imageFile - The image file being referenced
     */
    async removeImageWidth(imageFile: TFile, activeFileOverride?: TFile) {
        const activeFile = activeFileOverride ?? this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            throw new Error('No active file, cannot update link.');
        }
        await this.plugin.linkService.updateImageLinks(activeFile, imageFile, (params: string[]) => {
            const sizeParam = findLastObsidianImageSizeParam(params);
            if (sizeParam) {
                // Remove just the size parameter and keep all other attributes
                return [...params.slice(0, sizeParam.index), ...params.slice(sizeParam.index + 1)];
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
        const cached = this.dimensionCache.get(file.path);
        if (cached) return cached;

        const data = await this.plugin.app.vault.readBinary(file);
        const isSvg = file.extension.toLowerCase() === 'svg';
        const parsedSvgDimensions = isSvg ? this.readSvgDimensionsFromBinary(data) : null;

        // Fast-path: SVGs can fail to decode via Image(); parse width/height/viewBox first.
        if (isSvg && parsedSvgDimensions) {
            this.setDimensionCache(file.path, parsedSvgDimensions);
            return parsedSvgDimensions;
        }

        const blob = this.createBlob(data, this.getMimeTypeForExtension(file.extension));
        const url = URL.createObjectURL(blob);

        try {
            const img = await this.loadImage(url);
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            const dimensions = { width, height };

            const hasValidDimensions =
                Number.isFinite(dimensions.width) &&
                Number.isFinite(dimensions.height) &&
                dimensions.width > 0 &&
                dimensions.height > 0;

            if (!hasValidDimensions) {
                if (isSvg) {
                    throw createUserVisibleError(strings.notices.couldNotDetermineSvgDimensions);
                }
                throw createUserVisibleError(strings.notices.couldNotDetermineImageDimensions);
            }

            this.setDimensionCache(file.path, dimensions);
            return dimensions;
        } catch (error) {
            if (isSvg && !isUserVisibleError(error)) {
                throw createUserVisibleError(strings.notices.couldNotDetermineSvgDimensions);
            }
            throw error;
        } finally {
            URL.revokeObjectURL(url);
        }
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
        return this.plugin.linkService.findCurrentImageWidthInText(activeFile, imageFile, docText);
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
                throw createUserVisibleError(strings.notices.clickInEditorFirst);
            }
            throw error;
        }
    }

}
