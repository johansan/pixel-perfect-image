import {
	App,
	PluginSettingTab,
	Setting,
	Platform,
	requireApiVersion,
	type SettingDefinitionItem,
	type SliderComponent
} from 'obsidian';
import PixelPerfectImage from '../main';
import { strings } from '../i18n';
import { createSettingGroupFactory } from './settingGroups';
import { wireToggleSettingWithSubSettings } from './subSettings';


export interface PixelPerfectImageSettings {
	// Main settings
	toggleIndividualMenuOptions: boolean;
	// Menu sub-options (shown when toggle is enabled)
	showFileInfo: boolean;
	showShowInFileExplorer: boolean;
	showRenameOption: boolean;
	showDeleteImageOption: boolean;
	showOpenInNewTab: boolean;
	showOpenToTheRight: boolean;
	showOpenInNewWindow: boolean;
	showOpenInDefaultApp: boolean;
	// Other main settings
	customResizeSizes: string[];  // Array of sizes like ['25%', '50%', '100%', '600px']
	cmdCtrlClickBehavior: 'do-nothing' | 'open-in-new-tab' | 'open-in-default-app' | 'open-in-external-editor';

	// Mousewheel zoom settings
	enableWheelZoom: boolean;
	wheelModifierKey: 'Alt' | 'Ctrl' | 'Shift';
	wheelZoomPercentage: number;
	invertScrollDirection: boolean;

	// External editor settings
	externalEditorName: string;
	externalEditorPathMac: string;
	externalEditorPathWin: string;
	externalEditorPathLinux: string;

	// Advanced settings
	confirmBeforeDelete: boolean;
	debugMode: boolean;

	// Internal state
	lastShownVersion: string;
}

export const DEFAULT_SETTINGS: PixelPerfectImageSettings = {
	// Main settings
	toggleIndividualMenuOptions: false,
	// Menu sub-options
	showFileInfo: true,
	showShowInFileExplorer: true,
	showRenameOption: true,
	showDeleteImageOption: true,
	showOpenInNewTab: true,
	showOpenToTheRight: true,
	showOpenInNewWindow: true,
	showOpenInDefaultApp: true,
	// Other main settings
	customResizeSizes: ['25%', '50%', '100%'],  // Default percentage sizes
	cmdCtrlClickBehavior: 'do-nothing',

	// Mousewheel zoom defaults
	enableWheelZoom: true,
	wheelModifierKey: 'Alt',
	wheelZoomPercentage: 20,
	invertScrollDirection: false,

	// External editor defaults
	externalEditorName: "",
	externalEditorPathMac: "",
	externalEditorPathWin: "",
	externalEditorPathLinux: "",

	// Advanced defaults
	confirmBeforeDelete: true,
	debugMode: false,

	// Internal state
	lastShownVersion: '',
};

type BooleanSettingKey = {
	[K in keyof PixelPerfectImageSettings]-?: PixelPerfectImageSettings[K] extends boolean ? K : never
}[keyof PixelPerfectImageSettings];

type ExternalEditorTextKey =
	| 'externalEditorName'
	| 'externalEditorPathMac'
	| 'externalEditorPathWin'
	| 'externalEditorPathLinux';

interface ToggleSettingSpec {
	key: BooleanSettingKey;
	name: string;
	desc: string;
}

interface ExternalEditorTextSettingSpec {
	key: ExternalEditorTextKey;
	name: string;
	desc: string;
	placeholder: string;
	visible: boolean;
	normalize: (value: string) => string;
}

const MENU_OPTIONS_DESCRIPTION = 'Show settings to toggle individual menu items';

const MENU_OPTION_TOGGLE_SETTINGS = [
	{
		key: 'showFileInfo',
		name: strings.settings.items.fileInfo.name,
		desc: strings.settings.items.fileInfo.desc
	},
	{
		key: 'showShowInFileExplorer',
		name: strings.settings.items.showInExplorer.name,
		desc: strings.settings.items.showInExplorer.desc
	},
	{
		key: 'showRenameOption',
		name: strings.settings.items.renameImage.name,
		desc: strings.settings.items.renameImage.desc
	},
	{
		key: 'showDeleteImageOption',
		name: strings.settings.items.deleteImage.name,
		desc: strings.settings.items.deleteImage.desc
	},
	{
		key: 'showOpenInNewTab',
		name: strings.settings.items.openInNewTab.name,
		desc: strings.settings.items.openInNewTab.desc
	},
	{
		key: 'showOpenToTheRight',
		name: strings.settings.items.openToTheRight.name,
		desc: strings.settings.items.openToTheRight.desc
	},
	{
		key: 'showOpenInNewWindow',
		name: strings.settings.items.openInNewWindow.name,
		desc: strings.settings.items.openInNewWindow.desc
	},
	{
		key: 'showOpenInDefaultApp',
		name: strings.settings.items.openInDefaultApp.name,
		desc: strings.settings.items.openInDefaultApp.desc
	}
] as const satisfies readonly ToggleSettingSpec[];

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

const ADVANCED_TOGGLE_SETTINGS = [
	{
		key: 'confirmBeforeDelete',
		name: strings.settings.items.confirmDelete.name,
		desc: strings.settings.items.confirmDelete.desc
	},
	{
		key: 'debugMode',
		name: strings.settings.items.debugMode.name,
		desc: strings.settings.items.debugMode.desc
	}
] as const satisfies readonly ToggleSettingSpec[];

const EXTERNAL_EDITOR_TEXT_SETTINGS = [
	{
		key: 'externalEditorName',
		name: strings.settings.items.externalEditorName.name,
		desc: strings.settings.items.externalEditorName.desc,
		placeholder: strings.settings.items.externalEditorName.placeholder,
		visible: true,
		normalize: (value: string) => value
	},
	{
		key: 'externalEditorPathMac',
		name: strings.settings.items.externalEditorPathMac.name,
		desc: strings.settings.items.externalEditorPathMac.desc,
		placeholder: strings.settings.items.externalEditorPathMac.placeholder,
		visible: Platform.isMacOS,
		normalize: (value: string) => value.replace(/\\ /g, ' ')
	},
	{
		key: 'externalEditorPathWin',
		name: strings.settings.items.externalEditorPathWin.name,
		desc: strings.settings.items.externalEditorPathWin.desc,
		placeholder: strings.settings.items.externalEditorPathWin.placeholder,
		visible: Platform.isWin,
		normalize: (value: string) => value.replace(/\\ /g, ' ')
	},
	{
		key: 'externalEditorPathLinux',
		name: strings.settings.items.externalEditorPathLinux.name,
		desc: strings.settings.items.externalEditorPathLinux.desc,
		placeholder: strings.settings.items.externalEditorPathLinux.placeholder,
		visible: !Platform.isMacOS && !Platform.isWin && !Platform.isMobile,
		normalize: (value: string) => value.trim()
	}
] as const satisfies readonly ExternalEditorTextSettingSpec[];

const BOOLEAN_CONTROL_KEYS = [
	'toggleIndividualMenuOptions',
	...MENU_OPTION_TOGGLE_SETTINGS.map(setting => setting.key),
	ENABLE_WHEEL_ZOOM_SETTING.key,
	INVERT_SCROLL_SETTING.key,
	...ADVANCED_TOGGLE_SETTINGS.map(setting => setting.key)
] as const;

type BooleanControlKey = typeof BOOLEAN_CONTROL_KEYS[number];

const DIRECT_CONTROL_KEYS = [
	...BOOLEAN_CONTROL_KEYS,
	'cmdCtrlClickBehavior',
	'wheelModifierKey',
	'wheelZoomPercentage',
	...EXTERNAL_EDITOR_TEXT_SETTINGS.map(setting => setting.key)
] as const;

type DirectControlKey = typeof DIRECT_CONTROL_KEYS[number];

const booleanControlKeySet = new Set<string>(BOOLEAN_CONTROL_KEYS);
const directControlKeySet = new Set<string>(DIRECT_CONTROL_KEYS);

function isBooleanControlKey(key: string): key is BooleanControlKey {
	return booleanControlKeySet.has(key);
}

function isDirectControlKey(key: string): key is DirectControlKey {
	return directControlKeySet.has(key);
}

function createToggleDefinition(setting: ToggleSettingSpec) {
	return {
		name: setting.name,
		desc: setting.desc,
		control: { type: 'toggle' as const, key: setting.key }
	};
}

function applyNativeSliderDisplayFormat(slider: SliderComponent, formatValue: (value: number) => string): void {
	const setDisplayFormat: unknown = Reflect.get(slider, 'setDisplayFormat');
	if (typeof setDisplayFormat === 'function') {
		Reflect.apply(setDisplayFormat, slider, [formatValue]);
	}
}

function configureToggleSetting(
	setting: Setting,
	settings: PixelPerfectImageSettings,
	spec: ToggleSettingSpec,
	onChange: () => void
): void {
	setting
		.setName(spec.name)
		.setDesc(spec.desc)
		.addToggle(toggle =>
			toggle.setValue(settings[spec.key]).onChange(value => {
				settings[spec.key] = value;
				onChange();
			})
		);
}

function configureExternalEditorTextSetting(
	setting: Setting,
	settings: PixelPerfectImageSettings,
	spec: ExternalEditorTextSettingSpec,
	onChange: () => void
): void {
	setting
		.setName(spec.name)
		.setDesc(spec.desc)
		.addText(text =>
			text
				.setPlaceholder(spec.placeholder)
				.setValue(settings[spec.key])
				.onChange(value => {
					settings[spec.key] = spec.normalize(value);
					onChange();
				})
		);
}

export type ResizeSizeUnit = 'px' | '%';

function isCmdCtrlClickBehavior(value: string): value is PixelPerfectImageSettings['cmdCtrlClickBehavior'] {
	return value === 'do-nothing'
		|| value === 'open-in-new-tab'
		|| value === 'open-in-default-app'
		|| value === 'open-in-external-editor';
}

function isWheelModifierKey(value: string): value is PixelPerfectImageSettings['wheelModifierKey'] {
	return value === 'Alt' || value === 'Ctrl' || value === 'Shift';
}

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

// Add helper function to get the correct path based on platform
export function getExternalEditorPath(settings: PixelPerfectImageSettings): string {
	if (Platform.isMacOS) return settings.externalEditorPathMac;
	if (Platform.isWin) return settings.externalEditorPathWin;
	return settings.externalEditorPathLinux;
}

export class PixelPerfectImageSettingTab extends PluginSettingTab {
	plugin: PixelPerfectImage;

	constructor(app: App, plugin: PixelPerfectImage) {
		super(app, plugin);
		this.plugin = plugin;
		if (typeof requireApiVersion === 'function' && requireApiVersion('1.11.0')) {
			this.icon = 'image';
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		if (!requireApiVersion('1.13.0')) return [];

		const menuOptionsVisible = () => this.plugin.settings.toggleIndividualMenuOptions;
		const cmdKey = Platform.isMacOS ? 'CMD' : 'CTRL';
		const editorName = this.plugin.settings.externalEditorName.trim() || 'external editor';

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
				name: strings.settings.headings.menuOptions,
				desc: MENU_OPTIONS_DESCRIPTION,
				control: { type: 'toggle', key: 'toggleIndividualMenuOptions' }
			},
			{
				type: 'group',
				visible: menuOptionsVisible,
				items: MENU_OPTION_TOGGLE_SETTINGS.map(createToggleDefinition)
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
						'open-in-default-app': strings.settings.items.cmdClickBehavior.options.openInDefaultApp,
						'open-in-external-editor': strings.settings.items.cmdClickBehavior.options.openInEditor.replace(
							'{editor}',
							editorName
						)
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
						render: setting => {
							let updateSliderValue: ((value: number) => void) | undefined;

							setting
								.addExtraButton(button => {
									button
										.setIcon('reset')
										.setTooltip(strings.settings.items.zoomStepSize.resetToDefault)
										.onClick(() => {
											const defaultValue = DEFAULT_SETTINGS.wheelZoomPercentage;
											this.plugin.settings.wheelZoomPercentage = defaultValue;
											updateSliderValue?.(defaultValue);
											void this.plugin.saveSettings().catch(error =>
												console.error('Failed to save settings:', error)
											);
										});
								})
								.addSlider(slider => {
									updateSliderValue = value => {
										slider.setValue(value);
									};

									const configuredSlider = slider
										.setLimits(1, 100, 1)
										.setValue(this.plugin.settings.wheelZoomPercentage);
									applyNativeSliderDisplayFormat(configuredSlider, value => `${value}%`);
									configuredSlider
										.onChange(value => {
											this.plugin.settings.wheelZoomPercentage = value;
											void this.plugin.requestSaveSettings().catch(error =>
												console.error('Failed to save settings:', error)
											);
										});
								});
						}
					},
					createToggleDefinition(INVERT_SCROLL_SETTING)
				]
			},
			{
				type: 'group',
				heading: strings.settings.headings.externalEditor,
				items: EXTERNAL_EDITOR_TEXT_SETTINGS.map(setting => ({
					name: setting.name,
					desc: setting.desc,
					visible: setting.visible,
					control: {
						type: 'text' as const,
						key: setting.key,
						placeholder: setting.placeholder
					}
				}))
			},
			{
				type: 'group',
				heading: strings.settings.headings.advanced,
				items: ADVANCED_TOGGLE_SETTINGS.map(createToggleDefinition)
			}
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'customResizeSizes') {
			return this.plugin.settings.customResizeSizes.join(', ');
		}
		return isDirectControlKey(key) ? this.plugin.settings[key] : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings;
		let shouldDebounceSave = false;

		if (isBooleanControlKey(key)) {
			if (typeof value !== 'boolean') return;
			settings[key] = value;
		} else if (key === 'customResizeSizes') {
			if (typeof value !== 'string') return;
			settings.customResizeSizes = sanitizeResizeSizes(value.split(','));
			shouldDebounceSave = true;
		} else {
			const externalEditorSetting = EXTERNAL_EDITOR_TEXT_SETTINGS.find(setting => setting.key === key);
			if (externalEditorSetting) {
				if (typeof value !== 'string') return;
				settings[externalEditorSetting.key] = externalEditorSetting.normalize(value);
				shouldDebounceSave = true;
			} else if (key === 'cmdCtrlClickBehavior') {
				if (typeof value !== 'string' || !isCmdCtrlClickBehavior(value)) return;
				settings.cmdCtrlClickBehavior = value;
			} else if (key === 'wheelModifierKey') {
				if (typeof value !== 'string' || !isWheelModifierKey(value)) return;
				settings.wheelModifierKey = value;
			} else if (key === 'wheelZoomPercentage') {
				if (typeof value !== 'number' || !Number.isFinite(value)) return;
				settings.wheelZoomPercentage = Math.min(100, Math.max(1, Math.round(value)));
			} else {
				return;
			}
		}

		if (shouldDebounceSave) {
			await this.plugin.requestSaveSettings();
		} else {
			await this.plugin.saveSettings();
		}
		this.refreshNativeSettingsDomState();
	}

	display(): void {
		this.renderSettings();
	}

	private renderSettings(): void {
		const { containerEl } = this;
		containerEl.empty();

		const createGroup = createSettingGroupFactory(containerEl);
		const topGroup = createGroup(undefined);

		const saveSettings = async (): Promise<void> => {
			try {
				await this.plugin.saveSettings();
			} catch (error) {
				console.error('Failed to save settings:', error);
			}
		};

		const requestSaveSettings = (): void => {
			void this.plugin.requestSaveSettings().catch(error => console.error('Failed to save settings:', error));
		};

		const pluginVersion = this.plugin.manifest.version;
		topGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.whatsNew.name.replace('{version}', pluginVersion))
				.setDesc(strings.settings.items.whatsNew.desc)
				.addButton(button =>
					button.setButtonText(strings.settings.items.whatsNew.buttonText).onClick(() => {
						void this.openWhatsNewModal();
					})
				);
		});

		// Main toggle for individual menu options
		const menuOptionsSetting = topGroup.addSetting(setting => {
			setting
				.setName(strings.settings.headings.menuOptions)
				.setDesc(MENU_OPTIONS_DESCRIPTION);
		});

		const menuSubSettingsEl = wireToggleSettingWithSubSettings(
			menuOptionsSetting,
			() => this.plugin.settings.toggleIndividualMenuOptions,
			value => {
				this.plugin.settings.toggleIndividualMenuOptions = value;
				void saveSettings();
			}
		);

		for (const spec of MENU_OPTION_TOGGLE_SETTINGS) {
			configureToggleSetting(
				new Setting(menuSubSettingsEl),
				this.plugin.settings,
				spec,
				() => void saveSettings()
			);
		}

		topGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.resizeOptions.name)
				.setDesc(strings.settings.items.resizeOptions.desc)
				.addText(text => {
					text
						.setPlaceholder(strings.settings.items.resizeOptions.placeholder)
						.setValue(this.plugin.settings.customResizeSizes.join(', '))
						.onChange(value => {
							const sizes = sanitizeResizeSizes(value.split(','));
							this.plugin.settings.customResizeSizes = sizes;
							requestSaveSettings();
						});
				});
		});

		const cmdKey = Platform.isMacOS ? 'CMD' : 'CTRL';
		topGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.cmdClickBehavior.name.replace('{cmd}', cmdKey))
				.setDesc(strings.settings.items.cmdClickBehavior.desc.replace('{cmd}', cmdKey))
				.addDropdown(dropdown => {
					const editorName = this.plugin.settings.externalEditorName.trim() || 'external editor';
					dropdown
						.addOption('do-nothing', strings.settings.items.cmdClickBehavior.options.doNothing)
						.addOption('open-in-new-tab', strings.settings.items.cmdClickBehavior.options.openInNewTab)
						.addOption('open-in-default-app', strings.settings.items.cmdClickBehavior.options.openInDefaultApp)
						.addOption(
							'open-in-external-editor',
							strings.settings.items.cmdClickBehavior.options.openInEditor.replace('{editor}', editorName)
						)
						.setValue(this.plugin.settings.cmdCtrlClickBehavior)
						.onChange(
							value => {
								if (!isCmdCtrlClickBehavior(value)) return;
								this.plugin.settings.cmdCtrlClickBehavior = value;
								void saveSettings();
							}
						);
				});
		});

		// Mousewheel zoom section
		const mousewheelGroup = createGroup(strings.settings.headings.mousewheelZoom);
		mousewheelGroup.addSetting(setting => {
			configureToggleSetting(
				setting,
				this.plugin.settings,
				ENABLE_WHEEL_ZOOM_SETTING,
				() => void saveSettings()
			);
		});

		mousewheelGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.modifierKey.name)
				.setDesc(strings.settings.items.modifierKey.desc)
				.addDropdown(dropdown => {
					const isMac = Platform.isMacOS;
					dropdown
						.addOption(
							'Alt',
							isMac ? strings.settings.items.modifierKey.options.option : strings.settings.items.modifierKey.options.alt
						)
						.addOption('Ctrl', strings.settings.items.modifierKey.options.ctrl)
						.addOption('Shift', strings.settings.items.modifierKey.options.shift)
						.setValue(this.plugin.settings.wheelModifierKey)
						.onChange(value => {
							if (!isWheelModifierKey(value)) return;
							this.plugin.settings.wheelModifierKey = value;
							void saveSettings();
						});
				});
		});

		mousewheelGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.zoomStepSize.name)
				.setDesc(strings.settings.items.zoomStepSize.desc)
				.addExtraButton(button => {
					button
						.setIcon("reset")
						.setTooltip(strings.settings.items.zoomStepSize.resetToDefault)
						.onClick(() => {
							this.plugin.settings.wheelZoomPercentage = DEFAULT_SETTINGS.wheelZoomPercentage;
							void saveSettings();
							this.renderSettings();
						});
				})
				.addSlider(slider => {
					const valueDisplay = createSpan();
					valueDisplay.addClass('pixel-perfect-zoom-value');

					const updateDisplay = (value: number) => {
						valueDisplay.setText(`${value}%`);
					};

					slider
						.setLimits(1, 100, 1) // min: 1%, max: 100%, step: 1%
						.setValue(this.plugin.settings.wheelZoomPercentage)
						.onChange(value => {
							updateDisplay(value);
							this.plugin.settings.wheelZoomPercentage = value;
							requestSaveSettings();
						});

					updateDisplay(this.plugin.settings.wheelZoomPercentage);
					slider.sliderEl.parentElement?.prepend(valueDisplay);
				});
		});

		mousewheelGroup.addSetting(setting => {
			configureToggleSetting(
				setting,
				this.plugin.settings,
				INVERT_SCROLL_SETTING,
				() => void saveSettings()
			);
		});

		const externalEditorGroup = createGroup(strings.settings.headings.externalEditor);
		for (const spec of EXTERNAL_EDITOR_TEXT_SETTINGS) {
			if (!spec.visible) continue;
			externalEditorGroup.addSetting(setting => {
				configureExternalEditorTextSetting(
					setting,
					this.plugin.settings,
					spec,
					requestSaveSettings
				);
			});
		}

		// Advanced section
		const advancedGroup = createGroup(strings.settings.headings.advanced);
		for (const spec of ADVANCED_TOGGLE_SETTINGS) {
			advancedGroup.addSetting(setting => {
				configureToggleSetting(setting, this.plugin.settings, spec, () => void saveSettings());
			});
		}
		
		// Visibility handled by `wireToggleSettingWithSubSettings()`.
	}

	private async openWhatsNewModal(): Promise<void> {
		const { WhatsNewModal } = await import('./WhatsNewModal');
		const { getLatestReleaseNotes } = await import('../releaseNotes');
		new WhatsNewModal(this.app, getLatestReleaseNotes()).open();
	}

	private refreshNativeSettingsDomState(): void {
		const refreshDomState: unknown = Reflect.get(this, 'refreshDomState');
		if (typeof refreshDomState === 'function') {
			refreshDomState.call(this);
		}
	}
}
