import { App, Editor, Menu, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { PixelPerfectImageSettings, DEFAULT_SETTINGS, PixelPerfectImageSettingTab } from './settings';

/** Fixed percentages available for image resizing */
const RESIZE_PERCENTAGES = [100, 50, 25] as const;
/** Regular expression to match Obsidian image wikilinks: ![[image.png]] */
const IMAGE_WIKILINK_REGEX = /(!\[\[)([^\]]+)(\]\])/g;
/** Regular expressions to match both image link styles */
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

export default class PixelPerfectImage extends Plugin {
	settings: PixelPerfectImageSettings;
	/** Cache to store image dimensions to avoid repeated file reads */
	private dimensionCache = new Map<string, { width: number; height: number }>();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new PixelPerfectImageSettingTab(this.app, this));
		this.registerImageContextMenu();
		this.debugLog('Plugin loaded');
	}

	/**
	 * Registers a context menu handler for images in the editor.
	 * The menu provides options to view image dimensions and resize the image.
	 */
	private registerImageContextMenu(): void {
		this.registerDomEvent(document, 'contextmenu', async (ev: MouseEvent) => {
			const target = ev.target;
			if (!(target instanceof HTMLImageElement)) {
				return;
			}

			// Prevent default context menus to show our custom one
			ev.preventDefault();

			const menu = new Menu();
				await this.addDimensionsMenuItem(menu, target);
				this.addResizeMenuItems(menu, ev);

				menu.showAtPosition({ x: ev.pageX, y: ev.pageY });
		});
	}

	/**
	 * Adds an informational menu item showing the actual dimensions of the image.
	 * Reads dimensions from the image file in the vault.
	 * @param menu - The context menu to add the item to
	 * @param img - The HTML image element that was right-clicked
	 */
	private async addDimensionsMenuItem(menu: Menu, img: HTMLImageElement): Promise<void> {
		// Only add file info if the setting is enabled
		if (!this.settings.showFileInfo) return;

		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) return;

			const imgFile = this.getFileForImage(img, activeFile);
			if (!imgFile) {
				this.debugLog('Could not find file for alt/src');
				return;
			}

			const { width, height } = await this.readImageDimensions(imgFile);
			
			// Get file size in KB or MB
			const stat = await this.app.vault.adapter.stat(imgFile.path);
			const fileSize = stat?.size ?? 0;
			const formattedSize = fileSize > 1024 * 1024 
				? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
				: `${Math.round(fileSize / 1024)} KB`;

			// Add filename menu item
			menu.addItem((item) => {
				item
					.setTitle(imgFile.name)
					.setIcon("image-file")
					.setDisabled(true);
			});

			// Add dimensions and size menu item
			menu.addItem((item) => {
				item
					.setTitle(`${width} × ${height} px, ${formattedSize}`)
					.setIcon("info")
					.setDisabled(true);
			});
		} catch (error) {
			this.errorLog('Could not read dimensions:', error);
			new Notice("Could not read image dimensions");
		}
	}

	/**
	 * Adds resize percentage options to the context menu.
	 * Each option will resize the image to the specified percentage of its original size.
	 * @param menu - The context menu to add items to
	 * @param ev - The original mouse event
	 */
	private addResizeMenuItems(menu: Menu, ev: MouseEvent): void {
		// Add copy to clipboard option first
		menu.addItem((item) => {
			item.setTitle('Copy image')
				.setIcon('copy')
				.onClick(async () => {
					try {
						await this.copyImageToClipboard(ev.target as HTMLImageElement);
						new Notice('Image copied to clipboard');
					} catch (error) {
						this.errorLog('Failed to copy image:', error);
						new Notice('Failed to copy image to clipboard');
					}
				});
		});

		// Add separator
		menu.addSeparator();

		// Existing resize options
		RESIZE_PERCENTAGES.forEach(percentage => {
			menu.addItem((item) => {
				item.setTitle(`Resize to ${percentage}%`)
					.setIcon("image")
					.onClick(async () => {
						try {
							await this.resizeImage(ev, percentage);
						} catch (error) {
							this.errorLog('Failed to resize:', error);
							new Notice(`Failed to resize image to ${percentage}%`);
						}
					});
			});
		});
	}

	/**
	 * Copies an image to the system clipboard
	 * @param targetImg - The HTML image element to copy
	 */
	private async copyImageToClipboard(targetImg: HTMLImageElement): Promise<void> {
		const img = new Image();
		img.crossOrigin = 'anonymous';

		return new Promise((resolve, reject) => {
			img.onload = async () => {
				try {
					const canvas = document.createElement('canvas');
					canvas.width = img.naturalWidth;
					canvas.height = img.naturalHeight;
					const ctx = canvas.getContext('2d');
					if (!ctx) {
						throw new Error('Failed to get canvas context');
					}

					ctx.drawImage(img, 0, 0);
					const dataURL = canvas.toDataURL();
					const response = await fetch(dataURL);
					const blob = await response.blob();
					const item = new ClipboardItem({ [blob.type]: blob });
					await navigator.clipboard.write([item]);
					resolve();
				} catch (error) {
					reject(error);
				}
			};

			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = targetImg.src;
		});
	}

	/**
	 * Logs debug messages when debug mode is enabled in settings.
	 * Includes timestamp for better debugging.
	 * @param args - Arguments to log
	 */
	private debugLog(...args: any[]) {
		if (this.settings.debugMode) {
			const timestamp = new Date().toTimeString().split(' ')[0];
			console.log(`${timestamp}`, ...args);
		}
	}

	/**
	 * Logs error messages with timestamp.
	 * Always logs regardless of debug mode.
	 * @param args - Arguments to log
	 */
	private errorLog(...args: any[]) {
		const timestamp = new Date().toTimeString().split(' ')[0];
		console.error(`${timestamp}`, ...args);
	}

	/**
	 * Resizes an image in the editor by updating its wikilink width parameter.
	 * @param ev - Mouse event containing the target image
	 * @param percentage - Percentage to resize the image to
	 */
	private async resizeImage(ev: MouseEvent, percentage: number) {
		const img = ev.target as HTMLImageElement;
		const src = img.getAttribute('src') ?? "";

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			throw new Error("No active file in workspace to update a link.");
		}

		// Use getFileForImage instead of trying to resolve from alt text
		const imgFile = this.getFileForImage(img, activeFile);
		if (!imgFile) {
			throw new Error("Could not find the image file");
		}

		const { width } = await this.readImageDimensions(imgFile);
		const newWidth = Math.round((width * percentage) / 100);
		await this.updateImageLinkWidth(imgFile, newWidth);
	}

	/**
	 * Extracts a filename from an image's src attribute.
	 * Used as fallback when alt text is not available.
	 * @param src - The src attribute value
	 * @returns The extracted filename or null if not found
	 */
	private parseFileNameFromSrc(src: string): string | null {
		const [pathWithoutQuery] = src.split("?");
		const slashIdx = pathWithoutQuery.lastIndexOf("/");
		if (slashIdx < 0 || slashIdx === pathWithoutQuery.length - 1) {
			return null;
		}
		const fileName = pathWithoutQuery.substring(slashIdx + 1);
		return fileName || null;
	}

	/**
	 * Reads an image file from the vault and determines its dimensions.
	 * Uses a cache to avoid repeated file reads.
	 * @param file - The image file to read
	 * @returns Object containing width and height in pixels
	 */
	private async readImageDimensions(file: TFile): Promise<{ width: number; height: number }> {
		if (this.dimensionCache.has(file.path)) {
			return this.dimensionCache.get(file.path)!;
		}

		const data = await this.app.vault.readBinary(file);

		return new Promise((resolve, reject) => {
			const blob = new Blob([new Uint8Array(data)], { type: "image/*" });
			const url = URL.createObjectURL(blob);

			const tempImg = new Image();
			tempImg.onload = () => {
				URL.revokeObjectURL(url);
				const dimensions = { width: tempImg.width, height: tempImg.height };
				this.dimensionCache.set(file.path, dimensions);
				resolve(dimensions);
			};
			tempImg.onerror = (err) => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load image'));
			};
			tempImg.src = url;
		});
	}

	/**
	 * Updates the width parameter in wikilinks that reference a specific image.
	 * Handles complex wikilinks including subpaths and multiple parameters.
	 * @param imageFile - The image file being referenced
	 * @param newWidth - The new width to set in pixels
	 */
	private async updateImageLinkWidth(imageFile: TFile, newWidth: number) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			throw new Error('No active file, cannot update link.');
		}

		if (activeFile.path === imageFile.path) {
			return;
		}

		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) {
			throw new Error('No active MarkdownView to update.');
		}

		const editor = markdownView.editor;
		const docText = editor.getValue();

		let didChange = false;
		
		// First handle wiki-style links
		let replacedText = docText.replace(IMAGE_WIKILINK_REGEX, (_, opening, linkInner, closing) => {
			// Handle subpath components (e.g., #heading)
			let [linkWithoutHash, hashPart] = linkInner.split("#", 2);
			if (hashPart) hashPart = "#" + hashPart;

			// Split link path and parameters
			let [linkPath, ...pipeParams] = linkWithoutHash.split("|");

			const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);
			if (!resolvedFile || resolvedFile.path !== imageFile.path) {
				return _;
			}

			pipeParams[0] = String(newWidth);

			const newLink = [linkPath, ...pipeParams].join("|");
			const updatedInner = hashPart ? `${newLink}${hashPart}` : newLink;

			didChange = true;
			return `${opening}${updatedInner}${closing}`;
		});

		// Then handle Markdown-style links
		replacedText = replacedText.replace(MARKDOWN_IMAGE_REGEX, (match, description, linkPath) => {
			// Split description and width parameter
			let [desc, ...pipeParams] = description.split("|");
			
			const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);
			if (!resolvedFile || resolvedFile.path !== imageFile.path) {
				return match;
			}

			// If there's no description, use the filename without extension
			if (!desc) {
				desc = resolvedFile.basename;
			}

			// Update or add width parameter
			pipeParams[0] = String(newWidth);

			const newDescription = [desc, ...pipeParams].join("|");
			didChange = true;
			return `![${newDescription}](${linkPath})`;
		});

		if (didChange && replacedText !== docText) {
			editor.setValue(replacedText);
			this.debugLog(`Updated image size to ${newWidth}px in ${activeFile.path}`);
		}
	}

	/**
	 * Load plugin settings
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save plugin settings
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Resolves an HTML image element to its corresponding vault file.
	 * @param img - The HTML image element
	 * @param activeFile - The currently active file for path resolution
	 * @returns The corresponding TFile or null if not found
	 */
	private getFileForImage(img: HTMLImageElement, activeFile: TFile): TFile | null {
		const src = img.getAttribute('src') ?? "";
		const wikiLink = img.getAttribute('alt'); // 'alt' attribute contains the wiki-style link

		// For Markdown-style links, use the src since it contains the actual path
		const srcFileName = this.parseFileNameFromSrc(src);
		if (srcFileName) {
			const fileFromSrc = this.app.metadataCache.getFirstLinkpathDest(srcFileName, activeFile.path);
			if (fileFromSrc) return fileFromSrc;
		}

		// For wiki-style links, use the link text
		if (wikiLink) {
			const fileFromLink = this.app.metadataCache.getFirstLinkpathDest(wikiLink, activeFile.path);
			if (fileFromLink) return fileFromLink;
		}

		this.debugLog("Could not find file from either src or wiki link");
		return null;
	}
}
