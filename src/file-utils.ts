import { TFile, Notice, FileSystemAdapter, Platform, normalizePath } from 'obsidian';
import type PixelPerfectImage from './main';
import { join } from 'path';
import { exec } from "child_process";
import { FileNameInputModal, DeleteConfirmationModal } from './modals';
import { errorLog } from './utils';
import { getExternalEditorPath } from './settings';

/**
 * Resolves an HTML image element to its corresponding vault file.
 * @param img - The HTML image element
 * @param activeFile - The currently active file for path resolution
 * @returns The corresponding TFile or null if not found
 */
export function getFileForImage(this: PixelPerfectImage, img: HTMLImageElement, activeFile: TFile): TFile | null {
	const src = img.getAttribute('src') ?? "";
	let wikiLink = img.getAttribute('alt'); // e.g., "MyImage.png|200"

	// For Markdown-style images, try to parse the src attribute:
	const srcFileName = parseFileNameFromSrc.call(this, src);
	if (srcFileName) {
		const fileFromSrc = this.resolveLink(srcFileName, activeFile);
		if (fileFromSrc) {
			return fileFromSrc;
		}
	}

	// For wiki-style images (Obsidian puts "MyImage.png|width" in alt)
	if (wikiLink) {
		wikiLink = wikiLink.split("|")[0].trim();
		const fileFromLink = this.resolveLink(wikiLink, activeFile);
		if (fileFromLink) {
			return fileFromLink;
		}
	}
	return null;
}

/**
 * Extracts a filename from an image's src attribute.
 * Used as fallback when alt text is not available.
 * @param src - The src attribute value
 * @returns The extracted filename or null if not found
 */
export function parseFileNameFromSrc(this: PixelPerfectImage, src: string): string | null {
	try {
		// Handle both URL-encoded and regular paths
		const decodedSrc = decodeURIComponent(src);
		
		// Split off any query params (?xyz=...)
		const [pathWithoutQuery] = decodedSrc.split("?");
		const slashIdx = pathWithoutQuery.lastIndexOf("/");
		if (slashIdx < 0 || slashIdx >= pathWithoutQuery.length - 1) {
			return null;
		}

		// Extract just the trailing filename portion
		return pathWithoutQuery.substring(slashIdx + 1);
	} catch (error) {
		// Handle malformed URLs gracefully
		return null;
	}
}

/**
 * Helper to safely get the image file with common error handling
 * @param img - The HTML image element
 * @returns Object containing the active file and image file, or null if either cannot be found
 */
export async function getImageFileWithErrorHandling(this: PixelPerfectImage, img: HTMLImageElement): Promise<{ activeFile: TFile; imgFile: TFile } | null> {
	const activeFile = this.app.workspace.getActiveFile();
	if (!activeFile) {
		return null;
	}

	const imgFile = this.getFileForImage(img, activeFile);
	if (!imgFile) {
		// Only show notification if we have a valid image element but can't find its file
		// This prevents errors when plugin is triggered on non-image elements
		if (img.naturalWidth > 0 || img.src) {
			new Notice('Could not locate image file');
		}
		return null;
	}

	return { activeFile, imgFile };
}

/**
 * Shows the file in system explorer (Finder on macOS)
 */
export async function showInSystemExplorer(this: PixelPerfectImage, file: TFile): Promise<void> {
	this.app.showInFolder(file.path);
}

/**
 * Opens the file in the default system app
 */
export async function openInDefaultApp(this: PixelPerfectImage, file: TFile): Promise<void> {
	this.app.openWithDefaultApp(file.path);
}

// --- Add a helper function to launch external editor
export function openInExternalEditor(this: PixelPerfectImage, filePath: string) {
	const editorPath = getExternalEditorPath(this.settings);
	const editorName = this.settings.externalEditorName.trim() || "External Editor";
	if (!editorPath) {
		new Notice(`Please set your ${editorName} path in Pixel Perfect Image settings.`);
		return;
	}

	// 1. Get absolute path to the vault root
	const adapter = this.app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) {
		new Notice('Cannot open file: Vault is not a FileSystemAdapter');
		return;
	}
	const vaultPath = adapter.getBasePath();
	// 2. Combine vault root with the relative Obsidian path
	const absoluteFilePath = join(vaultPath, normalizePath(filePath));

	// 3. Choose command depending on macOS vs Windows
	let cmd: string;
	if (Platform.isMacOS) {
		// On macOS, use `open -a "/Applications/Editor.app" "/path/to/file.png"`
		cmd = `open -a "${editorPath}" "${absoluteFilePath}"`;
	} else {
		// On Windows, quote-wrap the exe and file path
		cmd = `"${editorPath}" "${absoluteFilePath}"`;
	}

	exec(cmd, (error) => {
		if (error) {
			errorLog(`Error launching ${editorName}:`, error);
			new Notice(`Could not open file in ${editorName}.`);
		} else {
		}
	});
}

export async function renameImage(this: PixelPerfectImage, file: TFile): Promise<void> {
	const newName = await promptForNewName.call(this, file);
	if (!newName) return;  // User cancelled

	try {
		// Get the directory path and construct new path
		const dirPath = file.parent?.path || "/";
		const newPath = `${dirPath}/${newName}`;

		// Rename the file
		await this.app.fileManager.renameFile(file, newPath);
		new Notice('Image renamed successfully');
	} catch (error) {
		errorLog('Failed to rename file:', error);
		new Notice('Failed to rename image');
	}
}

export async function promptForNewName(this: PixelPerfectImage, file: TFile): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new FileNameInputModal(this.app, file.name, (result) => {
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
export async function deleteImageAndLink(this: PixelPerfectImage, file: TFile): Promise<void> {
	// Helper function to perform the actual deletion
	const performDeletion = async () => {
		try {
			// First, remove all links to the image from the active document
			const linksRemoved = await this.removeImageLinks(file);
			
			// Then delete the image file itself
			await this.app.fileManager.trashFile(file);
			
			// Show success message
			if (linksRemoved) {
				new Notice('Image and links deleted successfully');
			} else {
				new Notice('Image deleted successfully');
			}
		} catch (error) {
			errorLog('Failed to delete image:', error);
			new Notice('Failed to delete image and links');
		}
	};

	// Show confirmation dialog if enabled
	if (this.settings.confirmBeforeDelete) {
		const modal = new DeleteConfirmationModal(this.app, file, performDeletion);
		modal.open();
	} else {
		// Delete immediately without confirmation
		await performDeletion();
	}
}