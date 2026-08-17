import { Plugin } from 'obsidian';
import {
    PixelPerfectImageSettings,
    DEFAULT_SETTINGS,
    PixelPerfectImageSettingTab,
    reconcileFileOperations,
    sanitizeResizeSizes,
    type FileOperationConfig,
    type FileOperationId
} from './ui/settings';

// Import service classes
import { EventService } from './events/EventService';
import { MenuService } from './ui/MenuService';
import { ImageService } from './core/ImageService';
import { LinkService } from './core/LinkService';
import { FileService } from './core/FileService';

// Import types
import './utils/types';

const LEGACY_FILE_OPERATION_SETTINGS = [
    { id: 'openInNewTab', key: 'showOpenInNewTab' },
    { id: 'openToTheRight', key: 'showOpenToTheRight' },
    { id: 'openInNewWindow', key: 'showOpenInNewWindow' },
    { id: 'openInDefaultApp', key: 'showOpenInDefaultApp' },
    { id: 'showInExplorer', key: 'showShowInFileExplorer' },
    { id: 'renameImage', key: 'showRenameOption' },
    { id: 'deleteImage', key: 'showDeleteImageOption' }
] as const satisfies readonly { id: FileOperationId; key: string }[];

const LEGACY_FILE_OPERATION_KEYS = ['toggleIndividualMenuOptions', ...LEGACY_FILE_OPERATION_SETTINGS.map(setting => setting.key)] as const;

export function migrateLegacyFileOperations(stored: Record<string, unknown>): FileOperationConfig[] | null {
    if (Array.isArray(stored.fileOperations) || !LEGACY_FILE_OPERATION_KEYS.some(key => key in stored)) return null;

    const defaultVisibility = new Map(DEFAULT_SETTINGS.fileOperations.map(operation => [operation.id, operation.visible] as const));
    return LEGACY_FILE_OPERATION_SETTINGS.map(({ id, key }) => {
        const storedVisibility = stored[key];
        return {
            id,
            visible: typeof storedVisibility === 'boolean' ? storedVisibility : (defaultVisibility.get(id) ?? true)
        };
    });
}

export default class PixelPerfectImage extends Plugin {
    settings!: PixelPerfectImageSettings;
    private hasStoredData = false;
    private settingsSaveQueue: Promise<void> = Promise.resolve();
    private settingsSaveDebounceTimer: number | null = null;
    private settingsSaveDebouncedPromise: Promise<void> | null = null;
    private settingsSaveDebouncedResolve: (() => void) | null = null;
    private settingsSaveDebouncedReject: ((error: unknown) => void) | null = null;

    // Services
    eventService!: EventService;
    menuService!: MenuService;
    imageService!: ImageService;
    linkService!: LinkService;
    fileService!: FileService;

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
        this.menuService.cleanup();
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
        const rawStoredSettings = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
        const storedSettings = rawStoredSettings ? (rawStoredSettings as Partial<PixelPerfectImageSettings>) : null;
        this.settings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) };

        const loadedSettings = this.settings as unknown as Record<string, unknown>;
        let migratedLegacySettings = false;
        if (loadedSettings.cmdCtrlClickBehavior === 'open-in-external-editor') {
            this.settings.cmdCtrlClickBehavior = 'open-in-default-app';
            migratedLegacySettings = true;
        }

        const migratedFileOperations = rawStoredSettings ? migrateLegacyFileOperations(rawStoredSettings) : null;
        if (migratedFileOperations) this.settings.fileOperations = migratedFileOperations;

        for (const key of [
            ...LEGACY_FILE_OPERATION_KEYS,
            'externalEditorName',
            'externalEditorPathMac',
            'externalEditorPathWin',
            'externalEditorPathLinux',
            'debugMode'
        ]) {
            if (key in loadedSettings) {
                delete loadedSettings[key];
                migratedLegacySettings = true;
            }
        }

        this.settings.fileOperations = reconcileFileOperations(this.settings.fileOperations);

        const rawResizeSizes = (this.settings as unknown as { customResizeSizes?: unknown }).customResizeSizes;
        const resizeSizes = Array.isArray(rawResizeSizes)
            ? rawResizeSizes.filter((value): value is string => typeof value === 'string')
            : typeof rawResizeSizes === 'string'
              ? rawResizeSizes.split(',')
              : [];

        this.settings.customResizeSizes = sanitizeResizeSizes(resizeSizes);

        if (migratedLegacySettings) {
            await this.saveData(this.settings);
        }
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

        const { getReleaseNotesBetweenVersions, getLatestReleaseNotes, compareVersions, isReleaseAutoDisplayEnabled } =
            await import('./releaseNotes');

        if (!isReleaseAutoDisplayEnabled(currentVersion)) {
            return;
        }

        const { WhatsNewModal } = await import('./ui/WhatsNewModal');

        const releaseNotes =
            lastShownVersion && compareVersions(currentVersion, lastShownVersion) > 0
                ? getReleaseNotesBetweenVersions(lastShownVersion, currentVersion)
                : getLatestReleaseNotes();

        new WhatsNewModal(this.app, releaseNotes, () => {
            window.setTimeout(() => {
                this.settings.lastShownVersion = currentVersion;
                void this.saveSettings();
            }, 1000);
        }).open();
    }
}
