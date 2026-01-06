import { TFile } from 'obsidian';
import type PixelPerfectImage from '../main';
import { WIKILINK_IMAGE_REGEX } from '../utils/constants';
import { ImageLink } from '../utils/types';
import { errorLog, findLastObsidianImageSizeParam, safeDecodeURIComponent } from '../utils/utils';

/**
 * Service for handling image link parsing and manipulation
 */
export class LinkService {
    private plugin: PixelPerfectImage;
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    private scanMarkdownImageLinks(
        text: string,
        onMatch: (match: {
            start: number;
            end: number;
            fullMatch: string;
            description: string;
            linkPath: string;
            titleSuffix: string;
            rawDestination: string;
        }) => void
    ) {
        let index = 0;
        const length = text.length;

        while (index < length) {
            const start = text.indexOf('![', index);
            if (start === -1) break;

            // Parse alt text: ![ ... ](...)
            let cursor = start + 2;
            let altEnd = -1;
            while (cursor < length) {
                const char = text[cursor];
                if (char === '\\') {
                    cursor += 2;
                    continue;
                }
                if (char === ']') {
                    altEnd = cursor;
                    break;
                }
                cursor += 1;
            }

            if (altEnd === -1 || text[altEnd + 1] !== '(') {
                // Not a well-formed image link; continue scanning.
                index = start + 1;
                continue;
            }

            const description = text.substring(start + 2, altEnd);

            // Parse link destination with balanced parentheses.
            const destStartParen = altEnd + 1;
            let depth = 0;
            let destEndParen = -1;
            cursor = destStartParen;

            while (cursor < length) {
                const char = text[cursor];
                if (char === '\\') {
                    cursor += 2;
                    continue;
                }
                if (char === '(') depth += 1;
                if (char === ')') {
                    depth -= 1;
                    if (depth === 0) {
                        destEndParen = cursor;
                        break;
                    }
                }
                cursor += 1;
            }

            if (destEndParen === -1) break;

            const rawDestination = text.substring(destStartParen + 1, destEndParen);
            const { url, titleSuffix } = this.splitMarkdownLinkDestination(rawDestination);
            const fullMatch = text.substring(start, destEndParen + 1);

            onMatch({
                start,
                end: destEndParen + 1,
                fullMatch,
                description,
                linkPath: url,
                titleSuffix,
                rawDestination
            });

            index = destEndParen + 1;
        }
    }

    private splitMarkdownLinkDestination(destination: string): { url: string; titleSuffix: string } {
        const raw = destination;
        let cursor = 0;

        while (cursor < raw.length && /\s/.test(raw[cursor])) cursor += 1;

        if (cursor >= raw.length) return { url: '', titleSuffix: '' };

        // Angle-bracketed destination: <url> "title"
        if (raw[cursor] === '<') {
            let end = cursor + 1;
            while (end < raw.length) {
                const char = raw[end];
                if (char === '\\') {
                    end += 2;
                    continue;
                }
                if (char === '>') break;
                end += 1;
            }

            if (end < raw.length && raw[end] === '>') {
                const url = raw.substring(cursor + 1, end).trim();
                const titleSuffix = raw.substring(end + 1);
                return { url, titleSuffix };
            }
        }

        // Plain destination: url "title"
        const urlStart = cursor;
        while (cursor < raw.length) {
            const char = raw[cursor];
            if (char === '\\') {
                cursor += 2;
                continue;
            }
            if (/\s/.test(char)) break;
            cursor += 1;
        }

        const url = raw.substring(urlStart, cursor).trim();
        const titleSuffix = raw.substring(cursor);
        return { url, titleSuffix };
    }

    private encodeMarkdownPathSegment(value: string): string {
        return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    }

    private replaceMarkdownImageLinks(
        text: string,
        replacer: (fullMatch: string, description: string, linkPath: string, titleSuffix: string, rawDestination: string) => string
    ): string {
        let result = '';
        let lastIndex = 0;

        this.scanMarkdownImageLinks(text, ({ start, end, fullMatch, description, linkPath, titleSuffix, rawDestination }) => {
            result += text.substring(lastIndex, start);
            result += replacer(fullMatch, description, linkPath, titleSuffix, rawDestination);
            lastIndex = end;
        });

        result += text.substring(lastIndex);
        return result;
    }

    private splitFrontmatter(data: string): { frontmatter: string; content: string } {
        // Simple YAML frontmatter handling:
        // - Only treat it as frontmatter if the file starts with `---` and we can find a closing `---`.
        // - If the closing delimiter is missing, treat as no frontmatter.
        const match = data.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
        if (!match) return { frontmatter: "", content: data };
        const frontmatter = match[0];
        return { frontmatter, content: data.substring(frontmatter.length) };
    }

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
    updateLinks(text: string, activeFile: TFile, imageFile: TFile, transform: (params: string[]) => string[]): string {
        // Handle wiki-style links (![[image.png|100]])
        text = text.replace(WIKILINK_IMAGE_REGEX, (match, linkInner) => {
            // Parse the link components (path, hash, params)
            const link = this.parseLinkComponents(linkInner);
            
            // Skip if this link doesn't point to our target image
            if (!this.resolveLink(link.path, activeFile, imageFile)) {
                return match;  // Return original match unchanged
            }

            // Transform the parameters (e.g., change width)
            link.params = transform(link.params);
            // Rebuild the link with new parameters
            const newLink = this.buildLinkPath(link);
            return `![[${newLink}]]`;  // Reconstruct full wikilink
        });

        // Handle markdown-style links (![alt|100](image.png))
        return this.replaceMarkdownImageLinks(text, (match, description, linkPath, titleSuffix) => {
            // Parse the link components from both parts
            const link = this.parseLinkComponents(description, linkPath);
            
            // Skip if this link doesn't point to our target image
            if (!this.resolveLink(link.path, activeFile, imageFile)) {
                return match;  // Return original match unchanged
            }

            // Get the base description without parameters
            const baseDesc = description.split("|")[0].trim();
            const desc = baseDesc || imageFile.basename;
            // Transform the parameters
            link.params = transform(link.params);
            // Combine description with new parameters
            const newDescription = link.params.length > 0 ? [desc, ...link.params].join("|") : desc;
            // For markdown links, we put parameters in the description and keep the URL clean
            // Pass true to encode spaces in the path
            const newDestination = `${this.buildLinkPath({ ...link, params: [] }, true)}${titleSuffix}`;
            return `![${newDescription}](${newDestination})`;
        });
    }

    private normalizeUrlForComparison(value: string): string {
        const trimmed = value.trim();
        if (!trimmed) return '';

        try {
            return new URL(trimmed).href;
        } catch {
            return trimmed;
        }
    }

    private isSameExternalUrl(a: string, b: string): boolean {
        return this.normalizeUrlForComparison(a) === this.normalizeUrlForComparison(b);
    }

    /**
     * Updates markdown-style image links (i.e. `![alt|100](https://...)`) by matching their destination URL.
     * This is used for external images that do not exist as `TFile`s in the vault.
     */
    private updateExternalLinks(text: string, imageUrl: string, transform: (params: string[]) => string[]): string {
        return this.replaceMarkdownImageLinks(text, (match, description, linkPath, _titleSuffix, rawDestination) => {
            if (!this.isSameExternalUrl(linkPath, imageUrl)) return match;

            const [baseDescRaw, ...params] = description.split("|");
            const baseDesc = baseDescRaw.trim();
            const newParams = transform(params);
            const newDescription = newParams.length > 0 ? [baseDesc, ...newParams].join("|") : baseDesc;
            return `![${newDescription}](${rawDestination})`;
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
    parseLinkComponents(mainPart: string, linkPath?: string): ImageLink {
        if (linkPath) {
            // Markdown-style: parameters come from the description (alt text), and hash comes from the URL.
            // Important: split hash before decoding so "%23" stays a literal "#" in filenames.
            const [rawPathWithoutHash, rawHash] = linkPath.split('#', 2);
            const hash = rawHash ? `#${rawHash}` : "";
            const path = safeDecodeURIComponent(rawPathWithoutHash);
            const [, ...params] = mainPart.split("|");

            return { path, hash, params, isWikiStyle: false };
        }

        // Wiki-style: parameters come from the piped segments; hash can appear either in the first segment
        // ("file#heading|100") or (less commonly) at the end of the last parameter ("file|100#heading").
        const [pathAndMaybeHash, ...rawParams] = mainPart.split("|");
        let path = pathAndMaybeHash;
        let hash = "";
        const hashIndex = pathAndMaybeHash.indexOf('#');
        if (hashIndex >= 0) {
            path = pathAndMaybeHash.substring(0, hashIndex);
            hash = pathAndMaybeHash.substring(hashIndex);
        } else if (rawParams.length > 0) {
            const lastParam = rawParams[rawParams.length - 1];
            const lastHashIndex = lastParam.indexOf('#');
            if (lastHashIndex >= 0) {
                const paramPrefix = lastParam.substring(0, lastHashIndex);
                const hashSuffix = lastParam.substring(lastHashIndex);
                // Only treat it as a heading reference if the part before the hash looks like a size parameter.
                if (/^[1-9]\d*(?:x[1-9]\d*)?(?:px)?$/i.test(paramPrefix)) {
                    rawParams[rawParams.length - 1] = paramPrefix;
                    hash = hashSuffix;
                }
            }
        }

        return { path, hash, params: rawParams, isWikiStyle: true };
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
    buildLinkPath(link: ImageLink, encode = false): string {
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
            finalPath = link.path.split('/').map((segment) => this.encodeMarkdownPathSegment(segment)).join('/');
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
    async updateImageLinks(activeFile: TFile, imageFile: TFile, transform: (params: string[]) => string[]): Promise<boolean> {

        if (activeFile.path === imageFile.path) {
            return false;
        }

        let didChange = false;

        try {
            await this.plugin.app.vault.process(activeFile, (data) => {
                // Extract frontmatter and content from the latest file contents to avoid overwriting concurrent edits.
                const { frontmatter, content } = this.splitFrontmatter(data);

                const replacedText = this.updateLinks(content, activeFile, imageFile, transform);
                if (replacedText === content) return data;

                didChange = true;
                return frontmatter ? `${frontmatter}${replacedText}` : replacedText;
            });
        } catch (error) {
            errorLog('Failed to update file content:', error);
            throw new Error('Failed to update image link');
        }

        return didChange;
    }

    /**
     * Updates external (http/https) image links in the active file by matching the URL destination.
     * Only affects markdown-style image links.
     */
    async updateExternalImageLinks(activeFile: TFile, imageUrl: string, transform: (params: string[]) => string[]): Promise<boolean> {
        let didChange = false;

        try {
            await this.plugin.app.vault.process(activeFile, (data) => {
                const { frontmatter, content } = this.splitFrontmatter(data);

                const replacedText = this.updateExternalLinks(content, imageUrl, transform);
                if (replacedText === content) return data;

                didChange = true;
                return frontmatter ? `${frontmatter}${replacedText}` : replacedText;
            });
        } catch (error) {
            errorLog('Failed to update external image link:', error);
            throw new Error('Failed to update external image link');
        }

        return didChange;
    }

    /**
     * Helper to resolve a file path to a TFile in the vault
     * @param linkPath - The path to resolve
     * @param activeFile - The currently active file for path resolution
     * @param imageFile - Optional file to compare against for matching
     * @returns The resolved TFile, or null if not found or doesn't match imageFile
     */
    resolveLink(linkPath: string, activeFile: TFile, imageFile?: TFile): TFile | null {
        const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);
        if (!resolvedFile) return null;
        if (imageFile && resolvedFile.path !== imageFile.path) return null;
        return resolvedFile;
    }

    /**
     * Finds the current width override for an image file from the given markdown text.
     * Uses the same robust markdown scanning logic as link updates.
     */
    findCurrentImageWidthInText(activeFile: TFile, imageFile: TFile, text: string): number | null {
        for (const match of text.matchAll(WIKILINK_IMAGE_REGEX)) {
            const [, linkInner] = match;
            const link = this.parseLinkComponents(linkInner);
            if (!this.resolveLink(link.path, activeFile, imageFile)) continue;
            const sizeParam = findLastObsidianImageSizeParam(link.params);
            if (sizeParam) return sizeParam.width;
        }

        let foundWidth: number | null = null;
        this.scanMarkdownImageLinks(text, ({ description, linkPath }) => {
            if (foundWidth !== null) return;
            const link = this.parseLinkComponents(description, linkPath);
            if (!this.resolveLink(link.path, activeFile, imageFile)) return;
            const sizeParam = findLastObsidianImageSizeParam(link.params);
            if (sizeParam) foundWidth = sizeParam.width;
        });

        return foundWidth;
    }

    /**
     * Finds the current width override for an external (http/https) image URL from the given markdown text.
     * Uses the same robust markdown scanning logic as link updates.
     */
    findCurrentExternalImageWidthInText(imageUrl: string, text: string): number | null {
        let foundWidth: number | null = null;

        this.scanMarkdownImageLinks(text, ({ description, linkPath }) => {
            if (foundWidth !== null) return;
            if (!this.isSameExternalUrl(linkPath, imageUrl)) return;
            const [, ...params] = description.split("|");
            const sizeParam = findLastObsidianImageSizeParam(params);
            if (sizeParam) foundWidth = sizeParam.width;
        });

        return foundWidth;
    }

    /**
     * Removes all image links pointing to the specified file from the document.
     * Handles both wiki-style (![[image.png]]) and markdown-style (![](image.png)) links.
     * @param imageFile - The image file whose links should be removed
     * @returns Promise<boolean> - True if any links were removed, false otherwise
     */
    async removeImageLinks(imageFile: TFile): Promise<boolean> {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            throw new Error('No active file, cannot remove links.');
        }

        if (activeFile.path === imageFile.path) {
            return false;
        }

        let didChange = false;

        try {
            // Do all parsing and replacement inside vault.process() to avoid overwriting concurrent edits.
            await this.plugin.app.vault.process(activeFile, (data) => {
                // Extract frontmatter and content from the latest file contents.
                const { frontmatter, content } = this.splitFrontmatter(data);

                let replacedText = content;

                // Remove wiki-style links (![[image.png|100]])
                replacedText = replacedText.replace(WIKILINK_IMAGE_REGEX, (match, linkInner) => {
                    const link = this.parseLinkComponents(linkInner);
                    return this.resolveLink(link.path, activeFile, imageFile) ? '' : match;
                });

                // Remove markdown-style links (![alt|100](image.png))
                replacedText = this.replaceMarkdownImageLinks(replacedText, (match, description, linkPath) => {
                    const link = this.parseLinkComponents(description, linkPath);
                    return this.resolveLink(link.path, activeFile, imageFile) ? '' : match;
                });

                if (replacedText === content) return data;

                didChange = true;
                return frontmatter ? `${frontmatter}${replacedText}` : replacedText;
            });
        } catch (error) {
            errorLog('Failed to remove image links:', error);
            throw new Error('Failed to remove image links');
        }

        return didChange;
    }
}
