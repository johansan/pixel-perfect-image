import { MarkdownView, TFile } from 'obsidian';
import type PixelPerfectImage from './main';
import { errorLog } from './utils';
import { WIKILINK_IMAGE_REGEX, MARKDOWN_IMAGE_REGEX } from './constants';

/**
 * Resizes an image in the editor by updating its wikilink width parameter.
 * @param img - The HTML image element
 * @param size - Either a percentage (e.g. 50) or absolute width in pixels (e.g. 600)
 * @param isAbsolute - If true, size is treated as pixels, otherwise as percentage
 */
export async function resizeImage(this: PixelPerfectImage, img: HTMLImageElement, size: number, isAbsolute = false) {
	const result = await this.getImageFileWithErrorHandling(img);
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
export async function updateImageLinkWidth(this: PixelPerfectImage, imageFile: TFile, newWidth: number) {
	const didChange = await this.updateImageLinks(imageFile, (params: string[]) => {
		// Check if the last parameter is a number (likely a width)
		const lastParam = params.length > 0 ? params[params.length - 1] : null;
		const lastParamIsNumber = lastParam !== null && !isNaN(parseInt(lastParam));
		
		if (lastParamIsNumber) {
			// Replace just the last parameter (width) and keep all other attributes
			return [...params.slice(0, params.length - 1), String(newWidth)];
		} else {
			// No existing width, so append the new width while preserving all attributes
			return [...params, String(newWidth)];
		}
	});
}

/**
 * Removes the width parameter from image links.
 * @param imageFile - The image file being referenced
 */
export async function removeImageWidth(this: PixelPerfectImage, imageFile: TFile) {
	const didChange = await this.updateImageLinks(imageFile, (params: string[]) => {
		// Check if the last parameter is a number (likely a width)
		const lastParam = params.length > 0 ? params[params.length - 1] : null;
		const lastParamIsNumber = lastParam !== null && !isNaN(parseInt(lastParam));
		
		if (lastParamIsNumber) {
			// Remove just the last parameter (width) and keep all other attributes
			return params.slice(0, params.length - 1);
		} else {
			// No width parameter found, return unchanged
			return params;
		}
	});
}

/**
 * Reads an image file from the vault and determines its dimensions.
 * Uses a cache to avoid repeated file reads.
 * @param file - The image file to read
 * @returns Object containing width and height in pixels
 */
export async function readImageDimensions(this: PixelPerfectImage, file: TFile): Promise<{ width: number; height: number }> {
	if (this.dimensionCache.has(file.path)) {
		return this.dimensionCache.get(file.path)!;
	}

	try {
		const data = await this.app.vault.readBinary(file);
		const blob = createBlob(data, "image/*");
		const url = URL.createObjectURL(blob);

		try {
			const img = await loadImage(url);
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
 * @param img - The HTML image element
 * @param activeFile - The active file
 * @param imageFile - The image file
 * @param actualWidth - The actual width of the image in pixels
 * @returns The current scale as a percentage, or null if no custom width is set
 */
export function calculateImageScale(this: PixelPerfectImage, img: HTMLImageElement, activeFile: TFile, imageFile: TFile, actualWidth: number): number | null {
	const customWidth = this.getCurrentImageWidth(img, activeFile, imageFile);
	if (customWidth === null) return null;
	return Math.round((customWidth / actualWidth) * 100);
}

/**
 * Gets the current custom width of an image if set in the link
 * @param img - The HTML image element
 * @param activeFile - The currently active file
 * @param imageFile - The image file
 * @returns The custom width if set, otherwise null
 */
export function getCurrentImageWidth(this: PixelPerfectImage, img: HTMLImageElement, activeFile: TFile, imageFile: TFile): number | null {
	const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
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
		const [_, _opening, linkInner] = match;
		
		// Handle subpath components (e.g., #heading)
		let [linkWithoutHash] = linkInner.split("#", 1);

		// Split link path and parameters
		let [linkPath, ...pipeParams] = linkWithoutHash.split("|");

		const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);
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
			const [_, description, linkPath] = match;
			
			// Split description and parameters
			let [desc, ...pipeParams] = description.split("|");
			
			// Decode URL-encoded paths before resolving
			let decodedPath = linkPath;
			try {
				decodedPath = decodeURIComponent(linkPath);
			} catch (e) {
				// If decoding fails, use the original path
			}
			
			const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, activeFile.path);
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
export function loadImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement> {
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
export function createBlob(data: ArrayBuffer, type: string): Blob {
	return new Blob([new Uint8Array(data)], { type });
}

/**
 * Copies an image to the system clipboard
 * @param targetImg - The HTML image element to copy
 */
export async function copyImageToClipboard(this: PixelPerfectImage, targetImg: HTMLImageElement): Promise<void> {
	try {
		const img = await loadImage(targetImg.src, 'anonymous');
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Failed to get canvas context');
		}

		ctx.drawImage(img, 0, 0);
		const blob = await new Promise<Blob | null>((resolveBlob) => {
			canvas.toBlob(resolveBlob);
		});

		if (!blob) {
			throw new Error('Failed to create blob');
		}

		const item = new ClipboardItem({ [blob.type]: blob });
		await navigator.clipboard.write([item]);
	} catch (error) {
		errorLog('Copy to clipboard failed:', error);
		// Check if it's a focus error and throw a more helpful message
		if (error instanceof Error && error.message.includes('Document is not focused')) {
			throw new Error('Please click in the editor first, then try copying again');
		}
		throw error;
	}
}