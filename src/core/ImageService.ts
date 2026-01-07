import { Notice, TFile, requestUrl } from 'obsidian';
import type PixelPerfectImage from '../main';
import { createUserVisibleError, errorLog, findLastObsidianImageSizeParam, findMarkdownEditorForFile, getBestHttpImageSource, isHttpUrlString, isLocalNetworkUrl, isUserVisibleError } from '../utils/utils';
import { strings } from '../i18n';
import { DEFAULT_EXTERNAL_IMAGE_FALLBACK_WIDTH_PX } from '../utils/constants';

/**
 * Service for handling image operations like resizing, reading dimensions, and copying
 */
export class ImageService {
    private plugin: PixelPerfectImage;
    /** Cache to store image dimensions to avoid repeated file reads */
    private dimensionCache = new Map<string, { width: number; height: number }>();
    private externalImageFetchInFlight = new Map<string, Promise<Blob>>();
    private static readonly DIMENSION_CACHE_MAX_ENTRIES = 300;
    private static readonly CLIPBOARD_COPY_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
    private static readonly CLIPBOARD_COPY_MAX_PIXELS = 40_000_000; // ~160MB RGBA
    private static readonly CLIPBOARD_COPY_MAX_DIMENSION = 12_000;
    private static readonly CLIPBOARD_COPY_REQUEST_TIMEOUT_MS = 15_000;
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(() => reject(createUserVisibleError(timeoutMessage)), timeoutMs);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    private getClipboardImageSrc(targetImg: HTMLImageElement): string {
        const http = getBestHttpImageSource(targetImg);
        if (isHttpUrlString(http)) return http;

        // Prefer the resolved/current source for local/app/blob URLs; attributes like data-src can be relative.
        return targetImg.currentSrc || targetImg.src || http;
    }

    private assertCopySizeOk(width: number, height: number) {
        if (width <= 0 || height <= 0) {
            throw createUserVisibleError(strings.notices.couldNotDetermineImageDimensions);
        }
        if (width > ImageService.CLIPBOARD_COPY_MAX_DIMENSION || height > ImageService.CLIPBOARD_COPY_MAX_DIMENSION) {
            throw createUserVisibleError(strings.notices.imageTooLargeToCopy);
        }
        if (width * height > ImageService.CLIPBOARD_COPY_MAX_PIXELS) {
            throw createUserVisibleError(strings.notices.imageTooLargeToCopy);
        }
    }

    private async canvasToClipboard(source: CanvasImageSource, width: number, height: number): Promise<void> {
        this.assertCopySizeOk(width, height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        ctx.drawImage(source, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((resolveBlob) => {
            canvas.toBlob(resolveBlob, 'image/png');
        });
        if (!blob) {
            throw new Error('Failed to create blob');
        }
        if (blob.size > ImageService.CLIPBOARD_COPY_MAX_BYTES) {
            throw createUserVisibleError(strings.notices.imageTooLargeToCopy);
        }

        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
    }

    private parseContentLength(headers: Record<string, string> | undefined): number | null {
        const contentLengthRaw =
            headers?.['content-length'] ??
            headers?.['Content-Length'] ??
            headers?.['CONTENT-LENGTH'];
        if (!contentLengthRaw) return null;

        const contentLength = Number(contentLengthRaw);
        if (!Number.isFinite(contentLength) || contentLength <= 0) return null;
        return contentLength;
    }

    private parseContentType(headers: Record<string, string> | undefined): string | null {
        const contentTypeRaw =
            headers?.['content-type'] ??
            headers?.['Content-Type'] ??
            headers?.['CONTENT-TYPE'];
        const contentType = contentTypeRaw?.split(';', 1)[0]?.trim();
        return contentType || null;
    }

    private parseContentRangeTotal(headers: Record<string, string> | undefined): number | null {
        const contentRangeRaw =
            headers?.['content-range'] ??
            headers?.['Content-Range'] ??
            headers?.['CONTENT-RANGE'];
        if (!contentRangeRaw) return null;

        // Example: "bytes 0-0/12345" or "bytes 0-0/*"
        const match = contentRangeRaw.match(/\/(\d+|\*)\s*$/);
        if (!match) return null;
        if (match[1] === '*') return null;
        const total = Number(match[1]);
        if (!Number.isFinite(total) || total <= 0) return null;
        return total;
    }

    private sniffImageMimeType(data: ArrayBuffer): string | null {
        const bytes = new Uint8Array(data.slice(0, 256));

        // PNG
        if (
            bytes.length >= 8 &&
            bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47 &&
            bytes[4] === 0x0d &&
            bytes[5] === 0x0a &&
            bytes[6] === 0x1a &&
            bytes[7] === 0x0a
        ) {
            return 'image/png';
        }

        // JPEG
        if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
            return 'image/jpeg';
        }

        // GIF
        if (
            bytes.length >= 6 &&
            bytes[0] === 0x47 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x38 &&
            (bytes[4] === 0x37 || bytes[4] === 0x39) &&
            bytes[5] === 0x61
        ) {
            return 'image/gif';
        }

        // WebP: RIFF....WEBP
        if (
            bytes.length >= 12 &&
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46 &&
            bytes[8] === 0x57 &&
            bytes[9] === 0x45 &&
            bytes[10] === 0x42 &&
            bytes[11] === 0x50
        ) {
            return 'image/webp';
        }

        // BMP
        if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
            return 'image/bmp';
        }

        // ICO
        if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
            return 'image/x-icon';
        }

        // AVIF (ISO BMFF): ....ftypavif / ....ftypavis
        if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
            const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
            if (brand === 'avif' || brand === 'avis') {
                return 'image/avif';
            }
        }

        // SVG (best-effort)
        try {
            const prefix = new TextDecoder('utf-8').decode(bytes);
            const trimmed = prefix.trimStart().toLowerCase();
            if (trimmed.includes('<svg')) return 'image/svg+xml';
        } catch {
            // ignore
        }

        return null;
    }

    private looksLikeHtml(data: ArrayBuffer): boolean {
        const bytes = new Uint8Array(data.slice(0, 512));
        try {
            const prefix = new TextDecoder('utf-8').decode(bytes);
            const trimmed = prefix.trimStart().toLowerCase();
            return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<html');
        } catch {
            return false;
        }
    }

    private getExternalImageBlobPromise(url: string): Promise<Blob> {
        const existing = this.externalImageFetchInFlight.get(url);
        if (existing) return existing;

        const fetchPromise = (async (): Promise<Blob> => {
            if (isLocalNetworkUrl(url)) {
                new Notice(strings.notices.fetchingLocalNetworkImage);
            }

            const baseHeaders = { Accept: 'image/*' };

            // Try a small range request to discover total size via Content-Range before doing a full GET.
            // Note: requestUrl cannot be aborted; this is best-effort to avoid full downloads when possible.
            let alreadyFetched: { arrayBuffer: ArrayBuffer; headers: Record<string, string>; status: number } | null = null;
            try {
                const probe = await requestUrl({ url, method: 'GET', throw: false, headers: { ...baseHeaders, Range: 'bytes=0-0' } });

                // Some servers ignore Range and return 200 with the full payload; in that case, reuse it.
                if (probe.status === 200) {
                    alreadyFetched = { arrayBuffer: probe.arrayBuffer, headers: probe.headers, status: probe.status };
                } else if (probe.status === 206) {
                    const total = this.parseContentRangeTotal(probe.headers);
                    if (total !== null && total > ImageService.CLIPBOARD_COPY_MAX_BYTES) {
                        throw createUserVisibleError(strings.notices.imageTooLargeToCopy);
                    }
                }
            } catch (error) {
                if (isUserVisibleError(error) && error.message === strings.notices.imageTooLargeToCopy) throw error;
            }

            const response = alreadyFetched
                ? alreadyFetched
                : await requestUrl({ url, method: 'GET', throw: false, headers: baseHeaders });

            if (response.status < 200 || response.status >= 300) {
                throw createUserVisibleError(
                    strings.notices.failedToFetchExternalImage.replace('{status}', String(response.status))
                );
            }

            const headerLength = this.parseContentLength(response.headers);
            if (headerLength !== null && headerLength > ImageService.CLIPBOARD_COPY_MAX_BYTES) {
                throw createUserVisibleError(strings.notices.imageTooLargeToCopy);
            }

            const arrayBuffer = response.arrayBuffer;
            if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength <= 0) {
                throw createUserVisibleError(
                    strings.notices.failedToFetchExternalImage.replace('{status}', String(response.status))
                );
            }

            const byteLength = arrayBuffer.byteLength;
            if (byteLength > ImageService.CLIPBOARD_COPY_MAX_BYTES) {
                throw createUserVisibleError(strings.notices.imageTooLargeToCopy);
            }

            const sniffedContentType = this.sniffImageMimeType(arrayBuffer);
            const headerContentType = this.parseContentType(response.headers);
            const normalizedHeaderContentType = headerContentType?.toLowerCase();
            const headerIsImage = normalizedHeaderContentType?.startsWith('image/') ?? false;

            if (
                !sniffedContentType &&
                (normalizedHeaderContentType === 'text/html' ||
                    normalizedHeaderContentType === 'application/xhtml+xml' ||
                    this.looksLikeHtml(arrayBuffer))
            ) {
                throw createUserVisibleError(strings.notices.externalImageNotImage);
            }

            const contentType = headerIsImage
                ? (normalizedHeaderContentType as string)
                : sniffedContentType ?? '';

            return contentType ? new Blob([arrayBuffer], { type: contentType }) : new Blob([arrayBuffer]);
        })();

        this.externalImageFetchInFlight.set(url, fetchPromise);
        fetchPromise.finally(() => this.externalImageFetchInFlight.delete(url));
        return fetchPromise;
    }

    private async fetchExternalImageAsObjectUrl(url: string): Promise<{ objectUrl: string; revoke: () => void }> {
        const blob = await this.withTimeout(
            this.getExternalImageBlobPromise(url),
            ImageService.CLIPBOARD_COPY_REQUEST_TIMEOUT_MS,
            strings.notices.externalImageFetchTimedOut
        );
        const objectUrl = URL.createObjectURL(blob);
        return { objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
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
    async resizeImage(img: HTMLImageElement, size: number, isAbsolute = false, activeFileOverride?: TFile) {
        const result = await this.plugin.fileService.getImageFileWithErrorHandling(img, false, activeFileOverride);
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
     * Updates the width parameter for external (http/https) markdown image links by URL.
     */
    async updateExternalImageLinkWidth(activeFile: TFile, imageUrl: string, newWidth: number) {
        await this.plugin.linkService.updateExternalImageLinks(activeFile, imageUrl, (params: string[]) => {
            const sizeParam = findLastObsidianImageSizeParam(params);
            if (sizeParam) {
                const replacement = String(newWidth);
                return [...params.slice(0, sizeParam.index), replacement, ...params.slice(sizeParam.index + 1)];
            }

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
     * Removes the width parameter for external (http/https) markdown image links by URL.
     */
    async removeExternalImageWidth(activeFile: TFile, imageUrl: string) {
        await this.plugin.linkService.updateExternalImageLinks(activeFile, imageUrl, (params: string[]) => {
            const sizeParam = findLastObsidianImageSizeParam(params);
            if (sizeParam) {
                return [...params.slice(0, sizeParam.index), ...params.slice(sizeParam.index + 1)];
            }

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
        const editor = findMarkdownEditorForFile(this.plugin.app, activeFile);
        if (!editor) return null;

        const docText = editor.getValue();
        return this.plugin.linkService.findCurrentImageWidthInText(activeFile, imageFile, docText);
    }

    /**
     * Gets the current custom width of an external (http/https) image if set in the link.
     */
    getCurrentExternalImageWidth(activeFile: TFile, imageUrl: string): number | null {
        const editor = findMarkdownEditorForFile(this.plugin.app, activeFile);
        if (!editor) return null;

        const docText = editor.getValue();
        return this.plugin.linkService.findCurrentExternalImageWidthInText(imageUrl, docText);
    }

    /**
     * Resizes an external image by updating the width parameter in its markdown link.
     * Percentages are based on the intrinsic image width when available, otherwise a fallback width is used.
     */
    async resizeExternalImage(activeFile: TFile, imageUrl: string, img: HTMLImageElement, size: number, isAbsolute = false) {
        if (isAbsolute) {
            await this.updateExternalImageLinkWidth(activeFile, imageUrl, size);
            return;
        }

        const baseWidth = img.naturalWidth > 0 ? img.naturalWidth : DEFAULT_EXTERNAL_IMAGE_FALLBACK_WIDTH_PX;
        const newWidth = Math.round((baseWidth * size) / 100);
        await this.updateExternalImageLinkWidth(activeFile, imageUrl, newWidth);
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
            const src = this.getClipboardImageSrc(targetImg);
            if (!src) {
                throw new Error('No image source found');
            }

            // Fast path: try copying the already-rendered image (avoids extra downloads).
            try {
                const width = targetImg.naturalWidth || targetImg.width;
                const height = targetImg.naturalHeight || targetImg.height;
                await this.canvasToClipboard(targetImg, width, height);
                return;
            } catch (error) {
                // If the image is cross-origin without CORS, the canvas will be tainted and toBlob will fail.
                if (isUserVisibleError(error)) throw error;
            }

            // Fallback path:
            // - For http(s), fetch via Obsidian (no CORS), then draw from a blob URL.
            // - For app/local URLs, load and draw normally.
            if (isHttpUrlString(src)) {
                const { objectUrl, revoke } = await this.fetchExternalImageAsObjectUrl(src);
                try {
                    const img = await this.loadImage(objectUrl);
                    await this.canvasToClipboard(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
                } finally {
                    revoke();
                }
                return;
            }

            const img = await this.loadImage(src, 'anonymous');
            await this.canvasToClipboard(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
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
