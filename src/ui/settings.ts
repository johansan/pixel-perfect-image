import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
import PixelPerfectImage from '../main';
import { strings } from '../i18n';


export interface PixelPerfectImageSettings {
	// Main settings
	toggleIndividualMenuOptions: boolean;
	// Menu sub-options (shown when toggle is enabled)
	showFileInfo: boolean;
	showShowInFileExplorer: boolean;
	showRenameOption: boolean;
	showDeleteImageOption: boolean;
	showOpenInNewTab: boolean;
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
};

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

	// Helper to show/hide elements
	private setElementVisibility(el: HTMLElement, visible: boolean) {
		el.style.display = visible ? 'block' : 'none';
	}

	async display() {
		const { containerEl } = this;
		containerEl.empty();

		// Main toggle for individual menu options
		new Setting(containerEl)
			.setName(strings.settings.headings.menuOptions)
			.setDesc("Show settings to toggle individual menu items")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.toggleIndividualMenuOptions)
				.onChange(async (value) => {
					this.plugin.settings.toggleIndividualMenuOptions = value;
					await this.plugin.saveSettings();
					// Update menu sub-settings visibility
					this.setElementVisibility(menuSubSettingsEl, value);
				}));

		// Container for menu sub-settings
		const menuSubSettingsEl = containerEl.createDiv('pixel-perfect-sub-settings');

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.fileInfo.name)
			.setDesc(strings.settings.items.fileInfo.desc)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.showFileInfo)
					.onChange(async (value: boolean) => {
						this.plugin.settings.showFileInfo = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.showInExplorer.name)
			.setDesc(strings.settings.items.showInExplorer.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showShowInFileExplorer)
				.onChange(async (value) => {
					this.plugin.settings.showShowInFileExplorer = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.renameImage.name)
			.setDesc(strings.settings.items.renameImage.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRenameOption)
				.onChange(async (value) => {
					this.plugin.settings.showRenameOption = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.deleteImage.name)
			.setDesc(strings.settings.items.deleteImage.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDeleteImageOption)
				.onChange(async (value) => {
					this.plugin.settings.showDeleteImageOption = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.openInNewTab.name)
			.setDesc(strings.settings.items.openInNewTab.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInNewTab)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInNewTab = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName(strings.settings.items.openInDefaultApp.name)
			.setDesc(strings.settings.items.openInDefaultApp.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInDefaultApp)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInDefaultApp = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.settings.items.resizeOptions.name)
			.setDesc(strings.settings.items.resizeOptions.desc)
			.addText(text => {
				text
					.setPlaceholder(strings.settings.items.resizeOptions.placeholder)
					.setValue(this.plugin.settings.customResizeSizes.join(', '))
					.onChange(async (value) => {
						// Parse comma-separated values, keeping units
						const sizes = value.split(',')
							.map(s => s.trim())
							.filter(s => {
								// Validate format: number followed by % or px
								const match = s.match(/^(\d+)(px|%)$/);
								return match && parseInt(match[1]) > 0;
							});
						
						this.plugin.settings.customResizeSizes = sizes;
						await this.plugin.saveSettings();
					});
			});

		const cmdKey = Platform.isMacOS ? 'CMD' : 'CTRL';
		new Setting(containerEl)
			.setName(strings.settings.items.cmdClickBehavior.name.replace('{cmd}', cmdKey))
			.setDesc(strings.settings.items.cmdClickBehavior.desc.replace('{cmd}', cmdKey))
			.addDropdown(dropdown => {
				const editorName = this.plugin.settings.externalEditorName.trim() || 'external editor';
				dropdown
					.addOption('do-nothing', strings.settings.items.cmdClickBehavior.options.doNothing)
					.addOption('open-in-new-tab', strings.settings.items.cmdClickBehavior.options.openInNewTab)
					.addOption('open-in-default-app', strings.settings.items.cmdClickBehavior.options.openInDefaultApp)
					.addOption('open-in-external-editor', strings.settings.items.cmdClickBehavior.options.openInEditor.replace('{editor}', editorName))
					.setValue(this.plugin.settings.cmdCtrlClickBehavior)
					.onChange(async (value: 'do-nothing' | 'open-in-new-tab' | 'open-in-default-app' | 'open-in-external-editor') => {
						this.plugin.settings.cmdCtrlClickBehavior = value;
						await this.plugin.saveSettings();
					});
			});

	
		// Mousewheel zoom section
		new Setting(containerEl)
			.setName(strings.settings.headings.mousewheelZoom)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.settings.items.enableWheelZoom.name)
			.setDesc(strings.settings.items.enableWheelZoom.desc)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.enableWheelZoom)
					.onChange(async (value: boolean) => {
						this.plugin.settings.enableWheelZoom = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(strings.settings.items.modifierKey.name)
			.setDesc(strings.settings.items.modifierKey.desc)
			.addDropdown(dropdown => {
				const isMac = Platform.isMacOS;
				dropdown
					.addOption('Alt', isMac ? strings.settings.items.modifierKey.options.option : strings.settings.items.modifierKey.options.alt)
					.addOption('Ctrl', strings.settings.items.modifierKey.options.ctrl)
					.addOption('Shift', strings.settings.items.modifierKey.options.shift)
					.setValue(this.plugin.settings.wheelModifierKey)
					.onChange(async (value: 'Alt' | 'Ctrl' | 'Shift') => {
						this.plugin.settings.wheelModifierKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(strings.settings.items.zoomStepSize.name)
			.setDesc(strings.settings.items.zoomStepSize.desc)
			.addExtraButton(button => {
				button
					.setIcon("reset")
					.setTooltip(strings.settings.items.zoomStepSize.resetToDefault)
					.onClick(async () => {
						this.plugin.settings.wheelZoomPercentage = DEFAULT_SETTINGS.wheelZoomPercentage;
						await this.plugin.saveSettings();
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
					.setLimits(1, 100, 1)  // min: 1%, max: 100%, step: 1%
					.setValue(this.plugin.settings.wheelZoomPercentage)
					.onChange(async (value) => {
						updateDisplay(value);
						this.plugin.settings.wheelZoomPercentage = value;
						await this.plugin.saveSettings();
					});
				
				updateDisplay(this.plugin.settings.wheelZoomPercentage);
				slider.sliderEl.parentElement?.prepend(valueDisplay);
			});

		new Setting(containerEl)
			.setName(strings.settings.items.invertScroll.name)
			.setDesc(strings.settings.items.invertScroll.desc)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.invertScrollDirection)
					.onChange(async (value: boolean) => {
						this.plugin.settings.invertScrollDirection = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(strings.settings.headings.externalEditor)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.settings.items.externalEditorName.name)
			.setDesc(strings.settings.items.externalEditorName.desc)
			.addText(text => {
				text
					.setPlaceholder(strings.settings.items.externalEditorName.placeholder)
					.setValue(this.plugin.settings.externalEditorName)
					.onChange(async (value) => {
						this.plugin.settings.externalEditorName = value;
						await this.plugin.saveSettings();
					});
			});

		if (Platform.isMacOS) {
			new Setting(containerEl)
				.setName(strings.settings.items.externalEditorPathMac.name)
				.setDesc(strings.settings.items.externalEditorPathMac.desc)
				.addText(text => {
					text
						.setPlaceholder(strings.settings.items.externalEditorPathMac.placeholder)
						.setValue(this.plugin.settings.externalEditorPathMac)
						.onChange(async (value) => {
							const cleanedPath = value.replace(/\\ /g, ' ');
							this.plugin.settings.externalEditorPathMac = cleanedPath;
							await this.plugin.saveSettings();
						});
				});
		}

		if (Platform.isWin) {
			new Setting(containerEl)
				.setName(strings.settings.items.externalEditorPathWin.name)
				.setDesc(strings.settings.items.externalEditorPathWin.desc)
				.addText(text => {
					text
						.setPlaceholder(strings.settings.items.externalEditorPathWin.placeholder)
						.setValue(this.plugin.settings.externalEditorPathWin)
						.onChange(async (value) => {
							const cleanedPath = value.replace(/\\ /g, ' ');
							this.plugin.settings.externalEditorPathWin = cleanedPath;
							await this.plugin.saveSettings();
						});
				});
		}

		// Linux or other desktop platforms
		if (!Platform.isMacOS && !Platform.isWin && !Platform.isMobile) {
			new Setting(containerEl)
				.setName(strings.settings.items.externalEditorPathLinux.name)
				.setDesc(strings.settings.items.externalEditorPathLinux.desc)
				.addText(text => {
					text
						.setPlaceholder(strings.settings.items.externalEditorPathLinux.placeholder)
						.setValue(this.plugin.settings.externalEditorPathLinux)
						.onChange(async (value) => {
							const cleanedPath = value.trim();
							this.plugin.settings.externalEditorPathLinux = cleanedPath;
							await this.plugin.saveSettings();
						});
				});
		}

		// Advanced section
		new Setting(containerEl)
			.setName(strings.settings.headings.advanced)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.settings.items.confirmDelete.name)
			.setDesc(strings.settings.items.confirmDelete.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmBeforeDelete)
				.onChange(async (value) => {
					this.plugin.settings.confirmBeforeDelete = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.settings.items.debugMode.name)
			.setDesc(strings.settings.items.debugMode.desc)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value: boolean) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					});
			});
		
		// Set initial visibility of sub-settings
		this.setElementVisibility(menuSubSettingsEl, this.plugin.settings.toggleIndividualMenuOptions);
	}
} 