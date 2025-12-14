/**
 * Helper to find an image element from an event target
 * @param target - The event target or HTML element
 * @returns The found image element or null
 */
export function findImageElement(target: EventTarget | null): HTMLImageElement | null {
	if (!target || !(target instanceof HTMLElement)) return null;
	
	// If target is already an image, return it
	if (target instanceof HTMLImageElement) return target;
	
	// Check if the target or its ancestors are related to images
	const isImageContext = target.matches('.image-container, .image-embed, img, a.internal-embed[src*=".png"], a.internal-embed[src*=".jpg"], a.internal-embed[src*=".jpeg"], a.internal-embed[src*=".gif"], a.internal-embed[src*=".webp"], a.internal-embed[src*=".svg"]'); 
	
	// Only search for img elements if we're in an image context
	if (isImageContext) {
		return target.querySelector('img');
	}
	
	return null;
}

/**
 * Checks if an image is a remote URL (http/https)
 * @param img - The HTML image element to check
 * @returns True if the image source is a remote URL
 */
export function isRemoteImage(img: HTMLImageElement): boolean {
	const src = img.src || '';
	return src.startsWith('http://') || src.startsWith('https://');
}

/**
 * Logs error messages with timestamp.
 * @param args - Arguments to log
 */
export function errorLog(...args: unknown[]) {
	const timestamp = new Date().toTimeString().split(' ')[0];
	console.error(`${timestamp}`, ...args);
}

export function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function createUserVisibleError(message: string): Error {
	const error = new Error(message);
	error.name = 'UserVisibleError';
	return error;
}

export function isUserVisibleError(error: unknown): error is Error {
	return error instanceof Error && error.name === 'UserVisibleError';
}

export function parseObsidianImageSizeParam(value: string): { width: number; height?: number } | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	// Common Obsidian embed size formats:
	// - "300"
	// - "300x200"
	// - "300px" (seen in some user configs/plugins)
	const sizeMatch = trimmed.match(/^([1-9]\d*)(?:x([1-9]\d*))?(?:px)?$/i);
	if (!sizeMatch) return null;

	const width = Number.parseInt(sizeMatch[1], 10);
	if (!Number.isFinite(width) || width <= 0) return null;

	const heightRaw = sizeMatch[2];
	if (!heightRaw) return { width };

	const height = Number.parseInt(heightRaw, 10);
	if (!Number.isFinite(height) || height <= 0) return { width };

	return { width, height };
}

export function findLastObsidianImageSizeParam(
	values: string[]
): { index: number; width: number; height?: number } | null {
	for (let index = values.length - 1; index >= 0; index -= 1) {
		const parsed = parseObsidianImageSizeParam(values[index]);
		if (parsed) return { index, ...parsed };
	}
	return null;
}
