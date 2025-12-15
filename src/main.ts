import { Plugin } from 'obsidian';
import { PixelPerfectImageSettings, DEFAULT_SETTINGS, PixelPerfectImageSettingTab, sanitizeResizeSizes } from './ui/settings';

// Import service classes
import { EventService } from './events/EventService';
import { MenuService } from './ui/MenuService';
import { ImageService } from './core/ImageService';
import { LinkService } from './core/LinkService';
import { FileService } from './core/FileService';

// Import types
import './utils/types';

export default class PixelPerfectImage extends Plugin {
	settings: PixelPerfectImageSettings;
	private hasStoredData = false;
	private settingsSaveQueue: Promise<void> = Promise.resolve();
	private settingsSaveDebounceTimer: number | null = null;
	private settingsSaveDebouncedPromise: Promise<void> | null = null;
	private settingsSaveDebouncedResolve: (() => void) | null = null;
	private settingsSaveDebouncedReject: ((error: unknown) => void) | null = null;
	
	// Services
	eventService: EventService;
	menuService: MenuService;
	imageService: ImageService;
	linkService: LinkService;
	fileService: FileService;

	async onload() {
		await this.loadSettings();
		
		// Initialize services
		this.eventService = new EventService(this);
		this.menuService = new MenuService(this);
		this.imageService = new ImageService(this);
		this.linkService = new LinkService(this);
		this.fileService = new FileService(this);
		
		// Setup plugin
		this.addSettingTab(new PixelPerfectImageSettingTab(this.app, this));
		
		// Register features
		this.menuService.registerImageContextMenu();
		this.eventService.registerEvents();

		await this.checkForVersionUpdate();
	}

	onunload() {
		// Cleanup services
		this.eventService.cleanup();
		this.imageService.clearDimensionCache();
		if (this.settingsSaveDebounceTimer !== null) {
			window.clearTimeout(this.settingsSaveDebounceTimer);
			this.settingsSaveDebounceTimer = null;
		}
		if (this.settingsSaveDebouncedPromise) {
			this.settingsSaveDebouncedReject?.(new Error('Plugin unloaded before settings could be saved'));
			this.settingsSaveDebouncedPromise = null;
			this.settingsSaveDebouncedResolve = null;
			this.settingsSaveDebouncedReject = null;
		}
	}

	async loadSettings() {
		const data: unknown = await this.loadData();
		this.hasStoredData = data !== null && data !== undefined;
		const storedSettings =
			data && typeof data === 'object' && !Array.isArray(data)
				? (data as Partial<PixelPerfectImageSettings>)
				: null;
		this.settings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) };

		const rawResizeSizes = (this.settings as unknown as { customResizeSizes?: unknown }).customResizeSizes;
		const resizeSizes =
			Array.isArray(rawResizeSizes) ? rawResizeSizes.filter((value): value is string => typeof value === 'string') :
			typeof rawResizeSizes === 'string' ? rawResizeSizes.split(',') :
			[];

		this.settings.customResizeSizes = sanitizeResizeSizes(resizeSizes);
	}

	async saveSettings() {
		await this.enqueueSettingsSave();
	}

	/**
	 * Debounced version of `saveSettings()` for high-frequency updates (typing/slider drag).
	 * Resolves after the coalesced save has been persisted.
	 */
	requestSaveSettings(debounceMs = 250): Promise<void> {
		if (!this.settingsSaveDebouncedPromise) {
			this.settingsSaveDebouncedPromise = new Promise<void>((resolve, reject) => {
				this.settingsSaveDebouncedResolve = resolve;
				this.settingsSaveDebouncedReject = reject;
			});
		}

		if (this.settingsSaveDebounceTimer !== null) {
			window.clearTimeout(this.settingsSaveDebounceTimer);
		}

		this.settingsSaveDebounceTimer = window.setTimeout(() => {
			this.settingsSaveDebounceTimer = null;

			void this.enqueueSettingsSave()
				.then(() => this.settingsSaveDebouncedResolve?.())
				.catch(error => this.settingsSaveDebouncedReject?.(error))
				.finally(() => {
					this.settingsSaveDebouncedPromise = null;
					this.settingsSaveDebouncedResolve = null;
					this.settingsSaveDebouncedReject = null;
				});
		}, debounceMs);

		return this.settingsSaveDebouncedPromise;
	}

	private enqueueSettingsSave(): Promise<void> {
		this.settingsSaveQueue = this.settingsSaveQueue
			.catch(error => {
				console.error('Failed to save settings (previous save):', error);
			})
			.then(() => this.saveData(this.settings));
		return this.settingsSaveQueue;
	}

	private async checkForVersionUpdate(): Promise<void> {
		const currentVersion = this.manifest.version;
		const lastShownVersion = this.settings.lastShownVersion;

		// First install: set baseline and don't show anything
		if (!lastShownVersion) {
			if (!this.hasStoredData) {
				this.settings.lastShownVersion = currentVersion;
				await this.saveSettings();
				return;
			}
		}

		// Only show when version changes
		if (lastShownVersion === currentVersion) {
			return;
		}

		const { getReleaseNotesBetweenVersions, getLatestReleaseNotes, compareVersions, isReleaseAutoDisplayEnabled } = await import(
			'./releaseNotes'
		);

		if (!isReleaseAutoDisplayEnabled(currentVersion)) {
			return;
		}

		const { WhatsNewModal } = await import('./ui/WhatsNewModal');

		const releaseNotes =
			lastShownVersion && compareVersions(currentVersion, lastShownVersion) > 0
				? getReleaseNotesBetweenVersions(lastShownVersion, currentVersion)
				: getLatestReleaseNotes();

		new WhatsNewModal(this.app, releaseNotes, () => {
			setTimeout(() => {
				this.settings.lastShownVersion = currentVersion;
				void this.saveSettings();
			}, 1000);
		}).open();
	}
}
