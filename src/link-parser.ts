import { TFile, MarkdownView } from 'obsidian';
import type PixelPerfectImage from './main';
import { WIKILINK_IMAGE_REGEX, MARKDOWN_IMAGE_REGEX } from './constants';
import { ImageLink } from './types';
import { errorLog } from './utils';

/**
 * Updates image links in the text using a common transformation logic.
 * Handles both wiki-style (![[image.png|100]]) and markdown-style (![alt|100](image.png)) links.
 * 
 * Examples of transformations:
 * - Input text: "Here's an image: ![[photo.jpg|50]]"
 *   Transform: (params) => ["100"]
 *   Output: "Here's an image: ![[photo.jpg|100]]"
 * 
 * - Input text: "Another image: ![caption|50](photo.jpg)"
 *   Transform: (params) => ["100"]
 *   Output: "Another image: ![caption|100](photo.jpg)"
 * 
 * @param text - The markdown text to update
 * @param activeFile - The currently active file (for resolving relative paths)
 * @param imageFile - The specific image file to update links for
 * @param transform - Function that takes current parameters and returns new ones
 * @returns The text with updated image links
 */
export function updateLinks(this: PixelPerfectImage, text: string, activeFile: TFile, imageFile: TFile, transform: (params: string[]) => string[]): string {
	// Handle wiki-style links (![[image.png|100]])
	text = text.replace(WIKILINK_IMAGE_REGEX, (match, linkInner) => {
		// Parse the link components (path, hash, params)
		const link = parseLinkComponents.call(this, linkInner);
		
		// Skip if this link doesn't point to our target image
		if (!resolveLink.call(this, link.path, activeFile, imageFile)) {
			return match;  // Return original match unchanged
		}

		// Transform the parameters (e.g., change width)
		link.params = transform(link.params);
		// Rebuild the link with new parameters
		const newLink = buildLinkPath.call(this, link);
		return `![[${newLink}]]`;  // Reconstruct full wikilink
	});

	// Handle markdown-style links (![alt|100](image.png))
	return text.replace(MARKDOWN_IMAGE_REGEX, (match, description, linkPath) => {
		// Parse the link components from both parts
		const link = parseLinkComponents.call(this, description, linkPath);
		
		// Skip if this link doesn't point to our target image
		if (!resolveLink.call(this, link.path, activeFile, imageFile)) {
			return match;  // Return original match unchanged
		}

		// Get the base description without parameters
		const desc = description.split("|")[0].trim() || imageFile.basename;
		// Transform the parameters
		link.params = transform(link.params);
		// Combine description with new parameters
		const newDescription = link.params.length > 0 ? [desc, ...link.params].join("|") : desc;
		// For markdown links, we put parameters in the description and keep the URL clean
		// Pass true to encode spaces in the path
		return `![${newDescription}](${buildLinkPath.call(this, {...link, params: []}, true)})`;
	});
}

/**
 * Parses an Obsidian image link into its components.
 * Handles both wiki-style (![[image.png|100]]) and markdown-style (![alt|100](image.png)) links.
 * 
 * For wiki-style links (![[image.png|100#heading]]):
 * - mainPart = "image.png|100#heading"
 * - linkPath = undefined
 * 
 * For markdown-style links (![alt|100](image.png#heading)):
 * - mainPart = "alt|100" (the part between [] brackets)
 * - linkPath = "image.png#heading" (the part between () parentheses)
 * 
 * @param mainPart - For wiki links: full link content. For markdown links: the alt/description text
 * @param linkPath - Only used for markdown links: the URL/path part in parentheses
 * @returns Parsed components of the link:
 *   - path: The file path without parameters or hash
 *   - hash: The heading reference (e.g., "#heading") if any
 *   - params: Array of parameters (e.g., ["100"] for width)
 *   - isWikiStyle: Whether this is a wiki-style (![[...]]) or markdown-style link
 */
export function parseLinkComponents(this: PixelPerfectImage, mainPart: string, linkPath?: string): ImageLink {
	// For markdown links, pathToParse is the URL in parentheses
	// For wiki links, pathToParse is the entire link content
	let pathToParse = linkPath ?? mainPart;
	
	// Decode URL-encoded paths (e.g., %20 -> space) for markdown links
	// This is necessary because markdown links often have URL-encoded paths
	if (linkPath) {
		try {
			pathToParse = decodeURIComponent(pathToParse);
		} catch {
			// If decoding fails, use the original path
		}
	}

	// Split off any heading reference (#) from the path
	// e.g., "image.png#heading" → ["image.png", "heading"]
	const [pathWithoutHash, hashPart] = pathToParse.split("#", 2);
	const hash = hashPart ? `#${hashPart}` : "";

	// For markdown links: split the alt text to get parameters
	// For wiki links: split the path to get parameters
	// e.g., "alt|100" → ["alt", "100"]
	// e.g., "image.png|100" → ["image.png", "100"]
	const [path, ...params] = (linkPath ? mainPart : pathWithoutHash).split("|");
	
	// Decode the final path for markdown links
	const finalPath = linkPath ? pathWithoutHash : path;
	
	return {
		path: finalPath,         // Decoded path for proper file resolution
		hash,                    // Any heading reference (#) found
		params,                  // Array of parameters (e.g., width)
		isWikiStyle: !linkPath   // If linkPath is undefined, it's a wiki-style link
	};
}

/**
 * Builds a link path by combining the components of an ImageLink.
 * Used to reconstruct both wiki-style and markdown-style image links.
 * 
 * Examples:
 * - Input: { path: "image.png", params: ["100"], hash: "#heading" }
 *   Output: "image.png|100#heading"
 * 
 * - Input: { path: "image.png", params: [], hash: "" }
 *   Output: "image.png"
 * 
 * - Input: { path: "subfolder/image.png", params: ["200", "left"], hash: "#section" }
 *   Output: "subfolder/image.png|200|left#section"
 * 
 * @param link - The ImageLink object containing path, parameters, and hash
 * @returns The reconstructed link path with parameters and hash (if any)
 */
export function buildLinkPath(this: PixelPerfectImage, link: ImageLink, encode = false): string {
	// Join parameters with | if there are any
	// e.g., params ["100", "left"] becomes "|100|left"
	const paramsStr = link.params.length > 0 ? `|${link.params.join("|")}` : "";

	// For markdown links, we may need to encode the path
	let finalPath = link.path;
	if (encode) {
		// Properly encode the path for markdown links
		// We need to encode the path but preserve the directory separators
		// This handles spaces, parentheses, brackets, and other special characters
		// e.g., "Images & Files/my image (1).png" → "Images%20%26%20Files/my%20image%20(1).png"
		finalPath = link.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
	}

	// Combine path + parameters + hash
	// e.g., "image.png" + "|100|left" + "#heading"
	return `${finalPath}${paramsStr}${link.hash}`;
}

/**
 * Updates image links in the document using a transformation function.
 * @param imageFile - The image file being referenced
 * @param transform - Function that transforms the parameters of the image link
 * @returns Promise<boolean> - True if any changes were made, false otherwise
 */
export async function updateImageLinks(this: PixelPerfectImage, imageFile: TFile, transform: (params: string[]) => string[]): Promise<boolean> {
	const activeFile = this.app.workspace.getActiveFile();
	if (!activeFile) {
		throw new Error('No active file, cannot update link.');
	}

	if (activeFile.path === imageFile.path) {
		return false;
	}

	const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
	if (!markdownView) {
		throw new Error('No active MarkdownView to update.');
	}

	const docText = await this.app.vault.read(activeFile);
	
	// Extract frontmatter and content
	let contentWithoutFrontmatter = docText;
	let frontmatterEndIndex = -1;
	
	if (docText.startsWith('---\n')) {
		frontmatterEndIndex = docText.indexOf('\n---\n', 4);
		if (frontmatterEndIndex !== -1) {
			frontmatterEndIndex += 5; // Include the closing delimiter
			contentWithoutFrontmatter = docText.substring(frontmatterEndIndex);
		}
	}
	
	// Handle both link types in one pass
	const replacedText = updateLinks.call(this, contentWithoutFrontmatter, activeFile, imageFile, transform);

	// Only update if content part changed
	if (replacedText !== contentWithoutFrontmatter) {
		try {
			// Update the file content using vault.process
			await this.app.vault.process(activeFile, (data) => {
				return frontmatterEndIndex !== -1
					? data.substring(0, frontmatterEndIndex) + replacedText
					: replacedText;
			});
			return true;
		} catch (error) {
			errorLog('Failed to update file content:', error);
			throw new Error('Failed to update image link');
		}
	}

	return false;
}

/**
 * Helper to resolve a file path to a TFile in the vault
 * @param linkPath - The path to resolve
 * @param activeFile - The currently active file for path resolution
 * @param imageFile - Optional file to compare against for matching
 * @returns The resolved TFile, or null if not found or doesn't match imageFile
 */
export function resolveLink(this: PixelPerfectImage, linkPath: string, activeFile: TFile, imageFile?: TFile): TFile | null {
	const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);
	if (!resolvedFile) return null;
	if (imageFile && resolvedFile.path !== imageFile.path) return null;
	return resolvedFile;
}

/**
 * Removes all image links pointing to the specified file from the document.
 * Handles both wiki-style (![[image.png]]) and markdown-style (![](image.png)) links.
 * @param imageFile - The image file whose links should be removed
 * @returns Promise<boolean> - True if any links were removed, false otherwise
 */
export async function removeImageLinks(this: PixelPerfectImage, imageFile: TFile): Promise<boolean> {
	const activeFile = this.app.workspace.getActiveFile();
	if (!activeFile) {
		throw new Error('No active file, cannot remove links.');
	}

	if (activeFile.path === imageFile.path) {
		return false;
	}

	const docText = await this.app.vault.read(activeFile);
	
	// Extract frontmatter and content
	let contentWithoutFrontmatter = docText;
	let frontmatterEndIndex = -1;
	
	if (docText.startsWith('---\n')) {
		frontmatterEndIndex = docText.indexOf('\n---\n', 4);
		if (frontmatterEndIndex !== -1) {
			frontmatterEndIndex += 5; // Include the closing delimiter
			contentWithoutFrontmatter = docText.substring(frontmatterEndIndex);
		}
	}
	
	let replacedText = contentWithoutFrontmatter;
	
	// Remove wiki-style links (![[image.png|100]])
	replacedText = replacedText.replace(WIKILINK_IMAGE_REGEX, (match, linkInner) => {
		// Parse the link components
		const link = parseLinkComponents.call(this, linkInner);
		
		// If this link points to our target image, remove it
		if (resolveLink.call(this, link.path, activeFile, imageFile)) {
			return '';  // Remove the entire link
		}
		
		return match;  // Keep non-matching links
	});

	// Remove markdown-style links (![alt|100](image.png))
	replacedText = replacedText.replace(MARKDOWN_IMAGE_REGEX, (match, description, linkPath) => {
		// Parse the link components
		const link = parseLinkComponents.call(this, description, linkPath);
		
		// If this link points to our target image, remove it
		if (resolveLink.call(this, link.path, activeFile, imageFile)) {
			return '';  // Remove the entire link
		}
		
		return match;  // Keep non-matching links
	});

	// Only update if content changed
	if (replacedText !== contentWithoutFrontmatter) {
		try {
			// Update the file content
			await this.app.vault.process(activeFile, (data) => {
				return frontmatterEndIndex !== -1
					? data.substring(0, frontmatterEndIndex) + replacedText
					: replacedText;
			});
			return true;
		} catch (error) {
			errorLog('Failed to remove image links:', error);
			throw new Error('Failed to remove image links');
		}
	}

	return false;
}