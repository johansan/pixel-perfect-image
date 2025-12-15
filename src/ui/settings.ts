import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
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
	}

	async display() {
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
						void (async () => {
							const { WhatsNewModal } = await import('./WhatsNewModal');
							const { getLatestReleaseNotes } = await import('../releaseNotes');
							new WhatsNewModal(this.app, getLatestReleaseNotes()).open();
						})();
					})
				);
		});

		// Main toggle for individual menu options
		const menuOptionsSetting = topGroup.addSetting(setting => {
			setting
				.setName(strings.settings.headings.menuOptions)
				.setDesc("Show settings to toggle individual menu items");
		});

		const menuSubSettingsEl = wireToggleSettingWithSubSettings(
			menuOptionsSetting,
			() => this.plugin.settings.toggleIndividualMenuOptions,
			value => {
				this.plugin.settings.toggleIndividualMenuOptions = value;
				void saveSettings();
			}
		);

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.fileInfo.name)
			.setDesc(strings.settings.items.fileInfo.desc)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.showFileInfo)
					.onChange(async (value: boolean) => {
						this.plugin.settings.showFileInfo = value;
						void saveSettings();
					});
			});

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.showInExplorer.name)
			.setDesc(strings.settings.items.showInExplorer.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showShowInFileExplorer)
				.onChange(async (value) => {
					this.plugin.settings.showShowInFileExplorer = value;
					void saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.renameImage.name)
			.setDesc(strings.settings.items.renameImage.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRenameOption)
				.onChange(async (value) => {
					this.plugin.settings.showRenameOption = value;
					void saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.deleteImage.name)
			.setDesc(strings.settings.items.deleteImage.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDeleteImageOption)
				.onChange(async (value) => {
					this.plugin.settings.showDeleteImageOption = value;
					void saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.openInNewTab.name)
			.setDesc(strings.settings.items.openInNewTab.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInNewTab)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInNewTab = value;
					void saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.openToTheRight.name)
			.setDesc(strings.settings.items.openToTheRight.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenToTheRight)
				.onChange(async (value) => {
					this.plugin.settings.showOpenToTheRight = value;
					void saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.openInNewWindow.name)
			.setDesc(strings.settings.items.openInNewWindow.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInNewWindow)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInNewWindow = value;
					void saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.openInDefaultApp.name)
			.setDesc(strings.settings.items.openInDefaultApp.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInDefaultApp)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInDefaultApp = value;
					void saveSettings();
				}));

		topGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.resizeOptions.name)
				.setDesc(strings.settings.items.resizeOptions.desc)
				.addText(text => {
					text
						.setPlaceholder(strings.settings.items.resizeOptions.placeholder)
						.setValue(this.plugin.settings.customResizeSizes.join(', '))
						.onChange(async value => {
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
							async (value: 'do-nothing' | 'open-in-new-tab' | 'open-in-default-app' | 'open-in-external-editor') => {
								this.plugin.settings.cmdCtrlClickBehavior = value;
								void saveSettings();
							}
						);
				});
		});

		// Mousewheel zoom section
		const mousewheelGroup = createGroup(strings.settings.headings.mousewheelZoom);
		mousewheelGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.enableWheelZoom.name)
				.setDesc(strings.settings.items.enableWheelZoom.desc)
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.enableWheelZoom).onChange(async (value: boolean) => {
						this.plugin.settings.enableWheelZoom = value;
						void saveSettings();
					});
				});
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
						.onChange(async (value: 'Alt' | 'Ctrl' | 'Shift') => {
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
						.onClick(async () => {
							this.plugin.settings.wheelZoomPercentage = DEFAULT_SETTINGS.wheelZoomPercentage;
							await saveSettings();
							this.display();
						});
				})
				.addSlider(slider => {
					const valueDisplay = createSpan();
					valueDisplay.addClass('pixel-perfect-zoom-value');

					const updateDisplay = (value: number) => {
						valueDisplay.setText(`${value}%`);
					};

					slider
						.setDynamicTooltip()
						.setLimits(1, 100, 1) // min: 1%, max: 100%, step: 1%
						.setValue(this.plugin.settings.wheelZoomPercentage)
						.onChange(async value => {
							updateDisplay(value);
							this.plugin.settings.wheelZoomPercentage = value;
							requestSaveSettings();
						});

					updateDisplay(this.plugin.settings.wheelZoomPercentage);
					slider.sliderEl.parentElement?.prepend(valueDisplay);
				});
		});

		mousewheelGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.invertScroll.name)
				.setDesc(strings.settings.items.invertScroll.desc)
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.invertScrollDirection).onChange(async (value: boolean) => {
						this.plugin.settings.invertScrollDirection = value;
						void saveSettings();
					});
				});
		});

		const externalEditorGroup = createGroup(strings.settings.headings.externalEditor);
		externalEditorGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.externalEditorName.name)
				.setDesc(strings.settings.items.externalEditorName.desc)
				.addText(text => {
					text
						.setPlaceholder(strings.settings.items.externalEditorName.placeholder)
						.setValue(this.plugin.settings.externalEditorName)
						.onChange(async value => {
							this.plugin.settings.externalEditorName = value;
							requestSaveSettings();
						});
				});
		});

		if (Platform.isMacOS) {
			externalEditorGroup.addSetting(setting => {
				setting
					.setName(strings.settings.items.externalEditorPathMac.name)
					.setDesc(strings.settings.items.externalEditorPathMac.desc)
					.addText(text => {
						text
							.setPlaceholder(strings.settings.items.externalEditorPathMac.placeholder)
							.setValue(this.plugin.settings.externalEditorPathMac)
							.onChange(async value => {
								const cleanedPath = value.replace(/\\ /g, ' ');
								this.plugin.settings.externalEditorPathMac = cleanedPath;
								requestSaveSettings();
							});
					});
			});
		}

		if (Platform.isWin) {
			externalEditorGroup.addSetting(setting => {
				setting
					.setName(strings.settings.items.externalEditorPathWin.name)
					.setDesc(strings.settings.items.externalEditorPathWin.desc)
					.addText(text => {
						text
							.setPlaceholder(strings.settings.items.externalEditorPathWin.placeholder)
							.setValue(this.plugin.settings.externalEditorPathWin)
							.onChange(async value => {
								const cleanedPath = value.replace(/\\ /g, ' ');
								this.plugin.settings.externalEditorPathWin = cleanedPath;
								requestSaveSettings();
							});
					});
			});
		}

		// Linux or other desktop platforms
		if (!Platform.isMacOS && !Platform.isWin && !Platform.isMobile) {
			externalEditorGroup.addSetting(setting => {
				setting
					.setName(strings.settings.items.externalEditorPathLinux.name)
					.setDesc(strings.settings.items.externalEditorPathLinux.desc)
					.addText(text => {
						text
							.setPlaceholder(strings.settings.items.externalEditorPathLinux.placeholder)
							.setValue(this.plugin.settings.externalEditorPathLinux)
							.onChange(async value => {
								const cleanedPath = value.trim();
								this.plugin.settings.externalEditorPathLinux = cleanedPath;
								requestSaveSettings();
							});
					});
			});
		}

		// Advanced section
		const advancedGroup = createGroup(strings.settings.headings.advanced);
		advancedGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.confirmDelete.name)
				.setDesc(strings.settings.items.confirmDelete.desc)
				.addToggle(toggle =>
					toggle.setValue(this.plugin.settings.confirmBeforeDelete).onChange(async value => {
						this.plugin.settings.confirmBeforeDelete = value;
						void saveSettings();
					})
				);
		});

		advancedGroup.addSetting(setting => {
			setting
				.setName(strings.settings.items.debugMode.name)
				.setDesc(strings.settings.items.debugMode.desc)
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.debugMode).onChange(async (value: boolean) => {
						this.plugin.settings.debugMode = value;
						void saveSettings();
					});
				});
		});
		
		// Visibility handled by `wireToggleSettingWithSubSettings()`.
	}
} 
