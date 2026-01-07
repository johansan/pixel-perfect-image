import { App, Editor, MarkdownView, TFile } from 'obsidian';

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

export function getImageSourceCandidates(img: HTMLImageElement): string[] {
	return [
		img.getAttribute('data-src') ?? '',
		img.getAttribute('src') ?? '',
		img.currentSrc ?? '',
		img.src ?? ''
	].map((value) => value.trim()).filter(Boolean);
}

export function getBestHttpImageSource(img: HTMLImageElement): string {
	const candidates = getImageSourceCandidates(img);
	return candidates.find((candidate) => isHttpUrlString(candidate)) ?? candidates[0] ?? '';
}

/**
 * Checks if an image is a remote URL (http/https)
 * @param img - The HTML image element to check
 * @returns True if the image source is a remote URL
 */
export function isRemoteImage(img: HTMLImageElement): boolean {
	return getImageSourceCandidates(img).some((source) => isHttpUrlString(source));
}

export function isHttpUrlString(value: string): boolean {
	return /^\s*https?:\/\//i.test(value);
}

export function isLocalNetworkUrl(value: string): boolean {
	try {
		const url = new URL(value);
		if (!isHttpUrlString(url.href)) return false;

		const host = url.hostname.toLowerCase();
		if (host === 'localhost' || host.endsWith('.localhost')) return true;
		if (host.endsWith('.local')) return true;

		// IPv4
		if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
			const octets = host.split('.').map((part) => Number(part));
			if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

			const [a, b] = octets;
			if (a === 10) return true; // 10.0.0.0/8
			if (a === 127) return true; // 127.0.0.0/8 (loopback)
			if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
			if (a === 192 && b === 168) return true; // 192.168.0.0/16
			if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
			return false;
		}

		// IPv6 (common local ranges)
		if (host === '::1') return true; // loopback
		if (host.startsWith('fe80:')) return true; // link-local
		if (host.startsWith('fc') || host.startsWith('fd')) return true; // unique-local fc00::/7
		return false;
	} catch {
		return false;
	}
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

export function findMarkdownViewForElement(app: App, element: HTMLElement): MarkdownView | null {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) continue;
		if (view.containerEl.contains(element)) return view;
	}
	return null;
}

export function findMarkdownEditorForFile(app: App, file: TFile): Editor | null {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) continue;
		if (!view.file) continue;
		if (view.file.path !== file.path) continue;
		return view.editor;
	}
	return null;
}
