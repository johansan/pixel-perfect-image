import { TFile, Notice, FileSystemAdapter, Platform, normalizePath } from 'obsidian';
import type PixelPerfectImage from '../main';
import { FileNameInputModal, DeleteConfirmationModal } from '../ui/modals';
import { errorLog, safeDecodeURIComponent } from '../utils/utils';
import { getExternalEditorPath } from '../ui/settings';
import { strings } from '../i18n';

/**
 * Service for handling file operations like resolving image files, file system operations, and file manipulation
 */
export class FileService {
    private plugin: PixelPerfectImage;
    
    constructor(plugin: PixelPerfectImage) {
        this.plugin = plugin;
    }

    /**
     * Resolves an HTML image element to its corresponding vault file.
     * @param img - The HTML image element
     * @param activeFile - The currently active file for path resolution
     * @returns The corresponding TFile or null if not found
     */
    getFileForImage(img: HTMLImageElement, activeFile: TFile): TFile | null {
        const src = img.getAttribute('src') ?? "";
        const wikiLink = img.getAttribute('alt'); // e.g., "MyImage.png|200"
        const embedLinkPath = this.getEmbedLinkPath(img);
        const normalizedAltLink = this.normalizeLinkCandidate(wikiLink, false);
        const srcLinkPath = this.parseFileNameFromSrc(src);
        const basenameCandidate = this.getBaseName(srcLinkPath) ?? this.getBaseName(normalizedAltLink);

        if (embedLinkPath) {
            const fileFromEmbed = this.plugin.linkService.resolveLink(embedLinkPath, activeFile);
            if (fileFromEmbed) {
                return fileFromEmbed;
            }
        }

        const directAltLink = this.getPathQualifiedLink(normalizedAltLink);
        if (directAltLink) {
            const fileFromAlt = this.plugin.linkService.resolveLink(directAltLink, activeFile);
            if (fileFromAlt) {
                return fileFromAlt;
            }
        }

        const directSrcLink = this.getPathQualifiedLink(srcLinkPath);
        if (directSrcLink) {
            const fileFromSrc = this.plugin.linkService.resolveLink(directSrcLink, activeFile);
            if (fileFromSrc) {
                return fileFromSrc;
            }
        }

        if (basenameCandidate) {
            const fileFromNoteCache = this.getFileFromNoteEmbedCache(activeFile, basenameCandidate);
            if (fileFromNoteCache.ambiguous) {
                return null;
            }
            if (fileFromNoteCache.file) {
                return fileFromNoteCache.file;
            }
            if (fileFromNoteCache.cacheAvailable) {
                const uniqueVaultFile = this.getUniqueVaultFileByBaseName(basenameCandidate);
                if (uniqueVaultFile.ambiguous) {
                    return null;
                }
                if (uniqueVaultFile.file) {
                    return uniqueVaultFile.file;
                }
                return null;
            }
        }

        const fileFromAlt = this.getFileFromBaseNameLink(normalizedAltLink, activeFile, basenameCandidate);
        if (fileFromAlt) {
            return fileFromAlt;
        }

        if (srcLinkPath) {
            const fileFromSrc = this.getFileFromBaseNameLink(srcLinkPath, activeFile, basenameCandidate);
            if (fileFromSrc) {
                return fileFromSrc;
            }
        }

        return null;
    }

    private getEmbedLinkPath(img: HTMLImageElement): string | null {
        const container = img.closest('.internal-embed, .image-embed, .image-container');
        const candidates = [
            container?.getAttribute('src') ?? null,
            container?.getAttribute('data-src') ?? null,
            container?.getAttribute('data-href') ?? null,
            container?.getAttribute('data-path') ?? null,
            container?.getAttribute('href') ?? null,
            img.getAttribute('src'),
            img.getAttribute('data-src'),
            img.getAttribute('data-href'),
            img.getAttribute('data-path')
        ];

        for (const candidate of candidates) {
            const normalized = this.normalizeLinkCandidate(candidate, true);
            if (normalized) return normalized;
        }

        return null;
    }

    private getFileFromNoteEmbedCache(
        activeFile: TFile,
        srcBaseName: string
    ): { file: TFile | null; ambiguous: boolean; cacheAvailable: boolean } {
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
        if (!cache) {
            return { file: null, ambiguous: false, cacheAvailable: false };
        }

        const embeds = cache.embeds ?? [];
        let match: TFile | null = null;

        for (const embed of embeds) {
            const normalizedLink = this.normalizeLinkCandidate(embed.link, false);
            if (!normalizedLink) continue;
            if (this.getBaseName(normalizedLink) !== srcBaseName) continue;

            const resolvedFile = this.plugin.linkService.resolveLink(normalizedLink, activeFile);
            if (!resolvedFile) continue;

            if (match && match.path !== resolvedFile.path) {
                return { file: null, ambiguous: true, cacheAvailable: true };
            }
            match = resolvedFile;
        }

        return { file: match, ambiguous: false, cacheAvailable: true };
    }

    private getUniqueVaultFileByBaseName(baseName: string): { file: TFile | null; ambiguous: boolean } {
        let match: TFile | null = null;

        for (const file of this.plugin.app.vault.getFiles()) {
            if (file.name !== baseName) continue;

            if (match) {
                return { file: null, ambiguous: true };
            }

            match = file;
        }

        return { file: match, ambiguous: false };
    }

    private getFileFromBaseNameLink(value: string | null, activeFile: TFile, expectedBaseName: string | null): TFile | null {
        if (!value || value.includes('/')) return null;
        if (!expectedBaseName) {
            if (!this.looksLikeVaultFileName(value)) return null;
        } else if (value !== expectedBaseName) {
            return null;
        }

        const resolvedFile = this.plugin.linkService.resolveLink(value, activeFile);
        if (!resolvedFile) return null;

        return !expectedBaseName || resolvedFile.name === expectedBaseName ? resolvedFile : null;
    }

    private normalizeLinkCandidate(value: string | null, allowUrlFallback: boolean): string | null {
        if (!value) return null;

        const trimmed = value.trim();
        if (!trimmed) return null;

        const baseValue = trimmed.split("|")[0].trim();
        if (!baseValue) return null;

        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(baseValue)) {
            if (!allowUrlFallback) return null;
            const parsedFromUrl = this.parseFileNameFromSrc(baseValue);
            return parsedFromUrl?.includes('/') ? parsedFromUrl : null;
        }

        const withoutQueryOrHash = this.stripQueryAndHash(baseValue);
        if (!withoutQueryOrHash) return null;

        const decoded = safeDecodeURIComponent(withoutQueryOrHash);
        if (!decoded) return null;

        if (this.isAbsoluteLocalPath(decoded)) {
            return null;
        }

        return decoded;
    }

    private getPathQualifiedLink(value: string | null): string | null {
        if (!value || !value.includes('/')) return null;
        return value;
    }

    private getBaseName(value: string | null): string | null {
        if (!value) return null;
        const slashIdx = value.lastIndexOf('/');
        return slashIdx >= 0 ? value.substring(slashIdx + 1) : value;
    }

    private looksLikeVaultFileName(value: string): boolean {
        const trimmed = value.trim();
        if (!trimmed) return false;
        return /\.[a-zA-Z0-9]{2,8}$/.test(trimmed);
    }

    private stripQueryAndHash(value: string): string {
        return value.split(/[?#]/, 1)[0] ?? '';
    }

    private isAbsoluteLocalPath(value: string): boolean {
        return value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);
    }

    /**
     * Extracts a vault-relative path (or filename) from an image's src attribute.
     * Used as fallback when alt text is not available.
     * @param src - The src attribute value
     * @returns The extracted vault-relative path/filename or null if not found
     */
    parseFileNameFromSrc(src: string): string | null {
        const trimmed = src.trim();
        if (!trimmed) return null;

        // Strip query/hash first so we don't treat them as part of the file path.
        const withoutQueryOrHash = this.stripQueryAndHash(trimmed);
        if (!withoutQueryOrHash) return null;

        // Obsidian often encodes the vault-relative path (including folder separators) into the last URL segment.
        // Example: ".../Images%2Fmy%20image.png" -> "Images/my image.png"
        try {
            const url = new URL(withoutQueryOrHash);
            const lastSegment = url.pathname.split('/').filter(Boolean).pop();
            if (!lastSegment) return null;
            return safeDecodeURIComponent(lastSegment);
        } catch {
            // If it's not a URL, it might already be a vault-relative path like "Images/my image.png".
            const decoded = safeDecodeURIComponent(withoutQueryOrHash);

            if (!this.isAbsoluteLocalPath(decoded) && decoded.includes('/')) {
                return decoded;
            }

            const slashIdx = decoded.lastIndexOf('/');
            const fileName = slashIdx >= 0 ? decoded.substring(slashIdx + 1) : decoded;
            return fileName || null;
        }
    }

    /**
     * Helper to safely get the image file with common error handling
     * @param img - The HTML image element
     * @param showNotice - Whether to show a notice if the image file cannot be found
     * @returns Object containing the active file and image file, or null if either cannot be found
     */
    async getImageFileWithErrorHandling(
        img: HTMLImageElement,
        showNotice = true,
        activeFileOverride?: TFile
    ): Promise<{ activeFile: TFile; imgFile: TFile } | null> {
        const activeFile = activeFileOverride ?? this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            return null;
        }

        const imgFile = this.getFileForImage(img, activeFile);
        if (!imgFile) {
            // Only show notification if we have a valid image element but can't find its file
            // This prevents errors when plugin is triggered on non-image elements
            if (showNotice && (img.naturalWidth > 0 || img.src)) {
                new Notice(strings.notices.couldNotLocateImage);
            }
            return null;
        }

        return { activeFile, imgFile };
    }

    /**
     * Shows the file in system explorer (Finder on macOS)
     */
    async showInSystemExplorer(file: TFile): Promise<void> {
        this.plugin.app.showInFolder(file.path);
    }

    /**
     * Opens the file in the default system app
     */
    async openInDefaultApp(file: TFile): Promise<void> {
        this.plugin.app.openWithDefaultApp(file.path);
    }

    /**
     * Opens a file in an external editor
     * @param filePath - The file path to open
     */
    async openInExternalEditor(filePath: string): Promise<void> {
        if (!Platform.isDesktop) return;

        const editorPath = getExternalEditorPath(this.plugin.settings);
        const editorName = this.plugin.settings.externalEditorName.trim() || "External Editor";
        if (!editorPath) {
            new Notice(strings.notices.setEditorPath.replace('{editor}', editorName));
            return;
        }

        const adapter = this.plugin.app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            new Notice(strings.notices.cannotOpenFile);
            return;
        }

        const absoluteFilePath = adapter.getFullPath(normalizePath(filePath));

        try {
            const { spawn } = await import('node:child_process');
            let child;
            if (Platform.isMacOS) {
                // macOS: use the system opener with the specified app
                child = spawn('open', ['-a', editorPath, absoluteFilePath], {
                    detached: true,
                    stdio: 'ignore'
                });
            } else if (Platform.isWin) {
                // Windows: launch editor executable directly
                child = spawn(editorPath, [absoluteFilePath], {
                    detached: true,
                    stdio: 'ignore',
                    shell: false
                });
            } else {
                // Other desktop platforms (best-effort): try launching editorPath
                child = spawn(editorPath, [absoluteFilePath], {
                    detached: true,
                    stdio: 'ignore',
                    shell: false
                });
            }

            child.on('error', (error: Error) => {
                errorLog(`Error launching ${editorName}:`, error);
                new Notice(strings.notices.couldNotOpenInEditor.replace('{editor}', editorName));
            });
            // Detach so the editor can live on its own
            child.unref();
        } catch (error) {
            errorLog(`Error launching ${editorName}:`, error);
            new Notice(strings.notices.couldNotOpenInEditor.replace('{editor}', editorName));
        }
    }

    /**
     * Renames an image file
     * @param file - The file to rename
     */
    async renameImage(file: TFile): Promise<void> {
        const newName = await this.promptForNewName(file);
        if (!newName) return;  // User cancelled

        try {
            // Get the directory path and construct new path
            const dirPath = file.parent?.path || "/";
            const newPath = `${dirPath}/${newName}`;

            // Rename the file
            await this.plugin.app.fileManager.renameFile(file, newPath);
            new Notice(strings.notices.imageRenamed);
        } catch (error) {
            errorLog('Failed to rename file:', error);
            new Notice(strings.notices.failedToRename);
        }
    }

    /**
     * Prompts the user for a new filename
     * @param file - The file being renamed
     * @returns The new filename or null if cancelled
     */
    async promptForNewName(file: TFile): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new FileNameInputModal(this.plugin.app, file.name, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }

    /**
     * Deletes both the image file and all links to it in the current document.
     * Shows a confirmation dialog if enabled in settings.
     * @param file - The image file to delete
     */
    async deleteImageAndLink(file: TFile): Promise<void> {
        // Helper function to perform the actual deletion
        const performDeletion = async () => {
            try {
                // First, remove all links to the image from the active document
                const linksRemoved = await this.plugin.linkService.removeImageLinks(file);
                
                // Then delete the image file itself
                await this.plugin.app.fileManager.trashFile(file);
                
                // Show success message
                if (linksRemoved) {
                    new Notice(strings.notices.imageAndLinksDeleted);
                } else {
                    new Notice(strings.notices.imageDeleted);
                }
            } catch (error) {
                errorLog('Failed to delete image:', error);
                new Notice(strings.notices.failedToDelete);
            }
        };

        // Show confirmation dialog if enabled
        if (this.plugin.settings.confirmBeforeDelete) {
            const modal = new DeleteConfirmationModal(this.plugin.app, file, () => {
                void performDeletion();
            });
            modal.open();
        } else {
            // Delete immediately without confirmation
            await performDeletion();
        }
    }
}
