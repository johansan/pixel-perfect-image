import { Platform, PluginSettingTab } from 'obsidian';
import type { App, ExtraButtonComponent, Setting, SettingDefinitionItem, SliderComponent } from 'obsidian';
import type PixelPerfectImage from '../main';
import { strings } from '../i18n';

const FILE_OPERATION_IDS = [
    'openInNewTab',
    'openToTheRight',
    'openInNewWindow',
    'openInDefaultApp',
    'showInExplorer',
    'renameImage',
    'deleteImage'
] as const;

export type FileOperationId = (typeof FILE_OPERATION_IDS)[number];

export interface FileOperationConfig {
    id: FileOperationId;
    visible: boolean;
}

export interface PixelPerfectImageSettings {
    // Context menu settings
    showFileInfo: boolean;
    fileOperations: FileOperationConfig[];

    // Other main settings
    customResizeSizes: string[]; // Array of sizes like ['25%', '50%', '100%', '600px']
    cmdCtrlClickBehavior: 'do-nothing' | 'open-in-new-tab' | 'open-in-default-app';

    // Mousewheel zoom settings
    enableWheelZoom: boolean;
    wheelModifierKey: 'Alt' | 'Ctrl' | 'Shift';
    wheelZoomPercentage: number;
    invertScrollDirection: boolean;

    // Advanced settings
    confirmBeforeDelete: boolean;

    // Internal state
    lastShownVersion: string;
}

function createDefaultFileOperations(): FileOperationConfig[] {
    return FILE_OPERATION_IDS.map(id => ({ id, visible: true }));
}

export const DEFAULT_SETTINGS: PixelPerfectImageSettings = {
    // Context menu defaults
    showFileInfo: true,
    fileOperations: createDefaultFileOperations(),

    // Other main settings
    customResizeSizes: ['25%', '50%', '100%'], // Default percentage sizes
    cmdCtrlClickBehavior: 'do-nothing',

    // Mousewheel zoom defaults
    enableWheelZoom: true,
    wheelModifierKey: 'Alt',
    wheelZoomPercentage: 20,
    invertScrollDirection: false,

    // Advanced defaults
    confirmBeforeDelete: true,

    // Internal state
    lastShownVersion: ''
};

const fileOperationIdSet = new Set<string>(FILE_OPERATION_IDS);

function isFileOperationId(value: unknown): value is FileOperationId {
    return typeof value === 'string' && fileOperationIdSet.has(value);
}

/**
 * Normalizes persisted file-operation settings without mutating the input.
 * Invalid and duplicate entries are discarded, then missing operations are appended
 * in default order so newly introduced operations remain discoverable.
 */
export function reconcileFileOperations(value: unknown): FileOperationConfig[] {
    if (!Array.isArray(value)) return createDefaultFileOperations();

    const reconciled: FileOperationConfig[] = [];
    const seen = new Set<FileOperationId>();

    for (const entry of value) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;

        const { id, visible } = entry as Record<string, unknown>;
        if (!isFileOperationId(id) || typeof visible !== 'boolean' || seen.has(id)) continue;

        seen.add(id);
        reconciled.push({ id, visible });
    }

    for (const id of FILE_OPERATION_IDS) {
        if (!seen.has(id)) reconciled.push({ id, visible: true });
    }

    return reconciled;
}

type BooleanSettingKey = {
    [K in keyof PixelPerfectImageSettings]-?: PixelPerfectImageSettings[K] extends boolean ? K : never;
}[keyof PixelPerfectImageSettings];

interface ToggleSettingSpec {
    key: BooleanSettingKey;
    name: string;
    desc: string;
}

const FILE_INFO_SETTING = {
    key: 'showFileInfo',
    name: strings.settings.items.fileInfo.name,
    desc: strings.settings.items.fileInfo.desc
} as const satisfies ToggleSettingSpec;

const ENABLE_WHEEL_ZOOM_SETTING = {
    key: 'enableWheelZoom',
    name: strings.settings.items.enableWheelZoom.name,
    desc: strings.settings.items.enableWheelZoom.desc
} as const satisfies ToggleSettingSpec;

const INVERT_SCROLL_SETTING = {
    key: 'invertScrollDirection',
    name: strings.settings.items.invertScroll.name,
    desc: strings.settings.items.invertScroll.desc
} as const satisfies ToggleSettingSpec;

const CONFIRM_DELETE_SETTING = {
    key: 'confirmBeforeDelete',
    name: strings.settings.items.confirmDelete.name,
    desc: strings.settings.items.confirmDelete.desc
} as const satisfies ToggleSettingSpec;

const FILE_OPERATION_CONTROL_PREFIX = 'fileOp.';
const CONTEXT_MENU_ITEM_COUNT = FILE_OPERATION_IDS.length + 1;

function createToggleDefinition(setting: ToggleSettingSpec) {
    return {
        name: setting.name,
        desc: setting.desc,
        control: { type: 'toggle' as const, key: setting.key }
    };
}

function getFileOperationControlId(key: string): FileOperationId | null {
    if (!key.startsWith(FILE_OPERATION_CONTROL_PREFIX)) return null;

    const id = key.slice(FILE_OPERATION_CONTROL_PREFIX.length);
    return isFileOperationId(id) ? id : null;
}

function getFileOperationName(id: FileOperationId): string {
    switch (id) {
        case 'openInNewTab':
            return strings.menu.openInNewTab;
        case 'openToTheRight':
            return strings.menu.openToTheRight;
        case 'openInNewWindow':
            return strings.menu.openInNewWindow;
        case 'openInDefaultApp':
            return strings.menu.openInDefaultApp;
        case 'showInExplorer':
            return Platform.isMacOS ? strings.menu.showInFinder : strings.menu.showInExplorer;
        case 'renameImage':
            return strings.menu.renameImage;
        case 'deleteImage':
            return strings.menu.deleteImageAndLink;
    }
}

function hasDefaultFileOperationOrder(operations: readonly FileOperationConfig[]): boolean {
    return (
        operations.length === FILE_OPERATION_IDS.length &&
        operations.every((operation, index) => operation.id === FILE_OPERATION_IDS[index])
    );
}

function formatContextMenuDisplayValue(shown: number): string {
    return strings.settings.items.contextMenu.shownCount
        .replace('{shown}', shown.toString())
        .replace('{total}', CONTEXT_MENU_ITEM_COUNT.toString());
}

export type ResizeSizeUnit = 'px' | '%';

export function parseResizeSize(value: string): { amount: number; unit: ResizeSizeUnit } | null {
    const match = value.trim().match(/^([1-9]\d*)(px|%)$/i);
    if (!match) return null;
    return { amount: Number.parseInt(match[1], 10), unit: match[2].toLowerCase() as ResizeSizeUnit };
}

export function sanitizeResizeSizes(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        const normalized = value.trim().toLowerCase();
        if (!normalized) continue;
        if (!parseResizeSize(normalized)) continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }

    return result;
}

export class PixelPerfectImageSettingTab extends PluginSettingTab {
    // PluginSettingTab already stores this reference. `declare` narrows its type without
    // emitting a class field that would shadow the base implementation's property.
    declare plugin: PixelPerfectImage;
    private fileOperationResetButton: ExtraButtonComponent | null = null;

    constructor(app: App, plugin: PixelPerfectImage) {
        super(app, plugin);
        this.icon = 'image';
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        const cmdKey = Platform.isMacOS ? 'CMD' : 'CTRL';

        return [
            {
                name: strings.settings.items.whatsNew.name.replace('{version}', this.plugin.manifest.version),
                desc: strings.settings.items.whatsNew.desc,
                render: setting => {
                    setting.addButton(button =>
                        button.setButtonText(strings.settings.items.whatsNew.buttonText).onClick(() => {
                            void this.openWhatsNewModal();
                        })
                    );
                }
            },
            {
                type: 'page',
                name: strings.settings.items.contextMenu.name,
                desc: strings.settings.items.contextMenu.desc,
                displayValue: () => {
                    const shown =
                        Number(this.plugin.settings.showFileInfo) +
                        this.plugin.settings.fileOperations.filter(operation => operation.visible).length;
                    return formatContextMenuDisplayValue(shown);
                },
                items: [
                    createToggleDefinition(FILE_INFO_SETTING),
                    {
                        type: 'list',
                        heading: strings.settings.items.contextMenu.fileOperations,
                        extraButtons: [button => this.configureFileOperationResetButton(button)],
                        items: this.plugin.settings.fileOperations.map(operation => ({
                            name: getFileOperationName(operation.id),
                            control: {
                                type: 'toggle',
                                key: `${FILE_OPERATION_CONTROL_PREFIX}${operation.id}`
                            }
                        })),
                        onReorder: (oldIndex, newIndex) => this.reorderFileOperations(oldIndex, newIndex)
                    }
                ]
            },
            {
                name: strings.settings.items.resizeOptions.name,
                desc: strings.settings.items.resizeOptions.desc,
                control: {
                    type: 'text',
                    key: 'customResizeSizes',
                    placeholder: strings.settings.items.resizeOptions.placeholder
                }
            },
            {
                name: strings.settings.items.cmdClickBehavior.name.replace('{cmd}', cmdKey),
                desc: strings.settings.items.cmdClickBehavior.desc.replace('{cmd}', cmdKey),
                control: {
                    type: 'dropdown',
                    key: 'cmdCtrlClickBehavior',
                    options: {
                        'do-nothing': strings.settings.items.cmdClickBehavior.options.doNothing,
                        'open-in-new-tab': strings.settings.items.cmdClickBehavior.options.openInNewTab,
                        'open-in-default-app': strings.settings.items.cmdClickBehavior.options.openInDefaultApp
                    }
                }
            },
            {
                type: 'group',
                heading: strings.settings.headings.mousewheelZoom,
                items: [
                    createToggleDefinition(ENABLE_WHEEL_ZOOM_SETTING),
                    {
                        name: strings.settings.items.modifierKey.name,
                        desc: strings.settings.items.modifierKey.desc,
                        control: {
                            type: 'dropdown',
                            key: 'wheelModifierKey',
                            options: {
                                Alt: Platform.isMacOS
                                    ? strings.settings.items.modifierKey.options.option
                                    : strings.settings.items.modifierKey.options.alt,
                                Ctrl: strings.settings.items.modifierKey.options.ctrl,
                                Shift: strings.settings.items.modifierKey.options.shift
                            }
                        }
                    },
                    {
                        name: strings.settings.items.zoomStepSize.name,
                        desc: strings.settings.items.zoomStepSize.desc,
                        render: setting => this.renderWheelZoomSlider(setting)
                    },
                    createToggleDefinition(INVERT_SCROLL_SETTING)
                ]
            },
            {
                type: 'group',
                heading: strings.settings.headings.advanced,
                items: [createToggleDefinition(CONFIRM_DELETE_SETTING)]
            }
        ];
    }

    getControlValue(key: string): unknown {
        if (key === 'customResizeSizes') return this.plugin.settings.customResizeSizes.join(', ');

        const operationId = getFileOperationControlId(key);
        if (operationId) return this.plugin.settings.fileOperations.find(operation => operation.id === operationId)?.visible;

        return super.getControlValue(key);
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        const operationId = getFileOperationControlId(key);
        if (operationId) {
            if (typeof value !== 'boolean') return;

            const operation = this.plugin.settings.fileOperations.find(candidate => candidate.id === operationId);
            if (!operation) return;

            operation.visible = value;
            this.refreshFileOperationResetButtonState();
            this.updateThenSave();
            return;
        }

        if (key === 'showFileInfo') {
            if (typeof value !== 'boolean') return;

            this.plugin.settings.showFileInfo = value;
            this.updateThenSave();
            return;
        }

        if (key === 'customResizeSizes') {
            if (typeof value !== 'string') return;

            this.plugin.settings.customResizeSizes = sanitizeResizeSizes(value.split(','));
            await this.plugin.requestSaveSettings();
            this.refreshDomState();
            return;
        }

        await super.setControlValue(key, value);
        this.refreshDomState();
    }

    private configureFileOperationResetButton(button: ExtraButtonComponent): void {
        this.fileOperationResetButton = button;

        button
            .setIcon('lucide-rotate-ccw')
            .setTooltip(strings.settings.items.contextMenu.restoreDefaultOrder)
            .onClick(() => {
                if (hasDefaultFileOperationOrder(this.plugin.settings.fileOperations)) return;

                const visibilityById = new Map(
                    this.plugin.settings.fileOperations.map(operation => [operation.id, operation.visible] as const)
                );
                this.plugin.settings.fileOperations = FILE_OPERATION_IDS.map(id => ({
                    id,
                    visible: visibilityById.get(id) ?? true
                }));

                this.refreshFileOperationResetButtonState();
                this.updateThenSave();
            });

        this.refreshFileOperationResetButtonState();
    }

    private refreshFileOperationResetButtonState(): void {
        const isResetDisabled = hasDefaultFileOperationOrder(this.plugin.settings.fileOperations);
        this.fileOperationResetButton?.extraSettingsEl.setAttribute('aria-disabled', isResetDisabled.toString());
    }

    private reorderFileOperations(oldIndex: number, newIndex: number): void {
        if (oldIndex === newIndex) return;

        const reordered = [...this.plugin.settings.fileOperations];
        const [operation] = reordered.splice(oldIndex, 1);
        if (!operation) return;

        reordered.splice(newIndex, 0, operation);
        this.plugin.settings.fileOperations = reordered;
        this.refreshFileOperationResetButtonState();
        this.updateThenSave();
    }

    private renderWheelZoomSlider(setting: Setting): void {
        const initialValue = this.plugin.settings.wheelZoomPercentage;
        const defaultValue = DEFAULT_SETTINGS.wheelZoomPercentage;
        let sliderComponent: SliderComponent | null = null;
        let resetButtonComponent: ExtraButtonComponent | null = null;
        let isResetDisabled = initialValue === defaultValue;

        const updateResetButton = (value: number): void => {
            isResetDisabled = value === defaultValue;
            resetButtonComponent?.extraSettingsEl.setAttribute('aria-disabled', isResetDisabled.toString());
        };
        const applyValue = (value: number): void => {
            this.plugin.settings.wheelZoomPercentage = value;
            updateResetButton(value);
            void this.plugin.requestSaveSettings().catch(error => console.error('Failed to save settings:', error));
        };

        // Add the reset before the slider to match Obsidian's reset, value, and slider order.
        setting.addExtraButton(button => {
            resetButtonComponent = button
                .setIcon('lucide-rotate-ccw')
                .setTooltip(strings.settings.items.zoomStepSize.resetToDefault)
                .onClick(() => {
                    if (!sliderComponent || isResetDisabled) return;

                    sliderComponent.setValue(defaultValue);
                    applyValue(defaultValue);
                });
        });

        setting.addSlider(slider => {
            sliderComponent = slider
                .setLimits(1, 100, 1)
                .setValue(initialValue)
                .setInstant(false)
                .setDisplayFormat(value => `${value}%`)
                .onChange(applyValue);
        });

        updateResetButton(initialValue);
    }

    private updateThenSave(): void {
        this.update();
        void this.plugin.saveSettings().catch(error => console.error('Failed to save settings:', error));
    }

    private async openWhatsNewModal(): Promise<void> {
        const { WhatsNewModal } = await import('./WhatsNewModal');
        const { getLatestReleaseNotes } = await import('../releaseNotes');
        new WhatsNewModal(this.app, getLatestReleaseNotes()).open();
    }
}
