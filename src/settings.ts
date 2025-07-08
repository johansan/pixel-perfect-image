import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
import PixelPerfectImage from './main';


export interface PixelPerfectImageSettings {
	// Main settings
	toggleIndividualMenuOptions: boolean;
	// Menu sub-options (shown when toggle is enabled)
	showFileInfo: boolean;
	showPercentageResize: boolean;
	showShowInFileExplorer: boolean;
	showRenameOption: boolean;
	showDeleteImageOption: boolean;
	showOpenInNewTab: boolean;
	showOpenInDefaultApp: boolean;
	// Other main settings
	customResizeWidths: number[];  // in pixels (empty array means disabled)
	cmdCtrlClickBehavior: 'open-in-new-tab' | 'open-in-default-app' | 'open-in-external-editor';

	// Mousewheel zoom settings
	enableWheelZoom: boolean;
	wheelModifierKey: 'Alt' | 'Ctrl' | 'Shift';
	wheelZoomPercentage: number;
	invertScrollDirection: boolean;

	// External editor settings
	externalEditorName: string;
	externalEditorPathMac: string;
	externalEditorPathWin: string;

	// Advanced settings
	confirmBeforeDelete: boolean;
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: PixelPerfectImageSettings = {
	// Main settings
	toggleIndividualMenuOptions: false,
	// Menu sub-options
	showFileInfo: true,
	showPercentageResize: true,
	showShowInFileExplorer: true,
	showRenameOption: true,
	showDeleteImageOption: true,
	showOpenInNewTab: true,
	showOpenInDefaultApp: true,
	// Other main settings
	customResizeWidths: [],  // disabled by default
	cmdCtrlClickBehavior: 'open-in-new-tab',

	// Mousewheel zoom defaults
	enableWheelZoom: true,
	wheelModifierKey: 'Alt',
	wheelZoomPercentage: 20,
	invertScrollDirection: false,

	// External editor defaults
	externalEditorName: "",
	externalEditorPathMac: "",
	externalEditorPathWin: "",

	// Advanced defaults
	confirmBeforeDelete: true,
	debugMode: false,
};

// Add helper function to get the correct path based on platform
export function getExternalEditorPath(settings: PixelPerfectImageSettings): string {
	return Platform.isMacOS ? settings.externalEditorPathMac : settings.externalEditorPathWin;
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
		let menuSubSettingsEl: HTMLElement;
		new Setting(containerEl)
			.setName("Toggle individual menu options")
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
		menuSubSettingsEl = containerEl.createDiv('pixel-perfect-sub-settings');

		new Setting(menuSubSettingsEl)
			.setName("File information")
			.setDesc("Show filename and dimensions at top of menu")
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.showFileInfo)
					.onChange(async (value: boolean) => {
						this.plugin.settings.showFileInfo = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(menuSubSettingsEl)
			.setName("Percentage resize options")
			.setDesc("Show 'Resize to 25%', '50%', '100%' options. Custom sizes will always be shown if defined.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPercentageResize)
				.onChange(async (value) => {
					this.plugin.settings.showPercentageResize = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName("Show in Finder/Explorer")
			.setDesc("Show option to reveal image in system file explorer")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showShowInFileExplorer)
				.onChange(async (value) => {
					this.plugin.settings.showShowInFileExplorer = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName("Rename image")
			.setDesc("Show option to rename image file")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRenameOption)
				.onChange(async (value) => {
					this.plugin.settings.showRenameOption = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName("Delete image and link")
			.setDesc("Show option to delete both image file and link")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDeleteImageOption)
				.onChange(async (value) => {
					this.plugin.settings.showDeleteImageOption = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName("Open in new tab")
			.setDesc("Show option to open image in new tab")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInNewTab)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInNewTab = value;
					await this.plugin.saveSettings();
				}));

		new Setting(menuSubSettingsEl)
			.setName("Open in default app")
			.setDesc("Show option to open image in default app")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOpenInDefaultApp)
				.onChange(async (value) => {
					this.plugin.settings.showOpenInDefaultApp = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Custom resize width")
			.setDesc("Set custom resize widths in pixels (comma-separated, e.g. 600,800,1200)")
			.addText(text => {
				text
					.setPlaceholder("e.g., 600,800,1200")
					.setValue(this.plugin.settings.customResizeWidths.length > 0 ? this.plugin.settings.customResizeWidths.join(',') : "")
					.onChange(async (value) => {
						// Parse comma-separated values
						const widths = value.split(',')
							.map(part => parseInt(part.trim()))
							.filter(width => !isNaN(width) && width > 0);
						
						this.plugin.settings.customResizeWidths = widths;
						await this.plugin.saveSettings();
					});
			})
			.addText(text => {
				text.inputEl.addClass('pixel-perfect-px-suffix');
				text.setValue("px");
				text.setDisabled(true);
			});

		const cmdKey = Platform.isMacOS ? 'CMD' : 'CTRL';
		new Setting(containerEl)
			.setName(`${cmdKey} + click behavior`)
			.setDesc(`Choose what happens when you ${cmdKey} + click an image`)
			.addDropdown(dropdown => {
				const editorName = this.plugin.settings.externalEditorName.trim() || 'external editor';
				dropdown
					.addOption('open-in-new-tab', 'Open in new tab')
					.addOption('open-in-default-app', 'Open in default app')
					.addOption('open-in-external-editor', `Open in ${editorName}`)
					.setValue(this.plugin.settings.cmdCtrlClickBehavior)
					.onChange(async (value: 'open-in-new-tab' | 'open-in-default-app' | 'open-in-external-editor') => {
						this.plugin.settings.cmdCtrlClickBehavior = value;
						await this.plugin.saveSettings();
					});
			});

	
		// Mousewheel zoom section
		new Setting(containerEl)
			.setName("Mousewheel zoom")
			.setHeading();

		new Setting(containerEl)
			.setName("Enable mousewheel zoom")
			.setDesc("Hold modifier key and scroll to resize images")
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.enableWheelZoom)
					.onChange(async (value: boolean) => {
						this.plugin.settings.enableWheelZoom = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Modifier key")
			.setDesc("Key to hold while scrolling to zoom images")
			.addDropdown(dropdown => {
				const isMac = Platform.isMacOS;
				dropdown
					.addOption('Alt', isMac ? 'Option' : 'Alt')
					.addOption('Ctrl', 'Ctrl')
					.addOption('Shift', 'Shift')
					.setValue(this.plugin.settings.wheelModifierKey)
					.onChange(async (value: 'Alt' | 'Ctrl' | 'Shift') => {
						this.plugin.settings.wheelModifierKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Zoom step size")
			.setDesc("Percentage to zoom per scroll step")
			.addExtraButton(button => {
				button
					.setIcon("reset")
					.setTooltip("Reset to default")
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
			.setName("Invert scroll direction")
			.setDesc("Invert the zoom direction when scrolling")
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.invertScrollDirection)
					.onChange(async (value: boolean) => {
						this.plugin.settings.invertScrollDirection = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("External editor")
			.setHeading();

		new Setting(containerEl)
			.setName("External editor name")
			.setDesc("Name of your external editor (e.g., Photoshop)")
			.addText(text => {
				text
					.setPlaceholder("Photoshop")
					.setValue(this.plugin.settings.externalEditorName)
					.onChange(async (value) => {
						this.plugin.settings.externalEditorName = value;
						await this.plugin.saveSettings();
					});
			});

		if (Platform.isMacOS) {
			new Setting(containerEl)
				.setName("External editor path (macOS)")
				.setDesc("Full path to your external editor application on macOS")
				.addText(text => {
					text
						.setPlaceholder("/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app")
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
				.setName("External editor path (Windows)")
				.setDesc("Full path to your external editor application on Windows")
				.addText(text => {
					text
						.setPlaceholder("C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe")
						.setValue(this.plugin.settings.externalEditorPathWin)
						.onChange(async (value) => {
							const cleanedPath = value.replace(/\\ /g, ' ');
							this.plugin.settings.externalEditorPathWin = cleanedPath;
							await this.plugin.saveSettings();
						});
				});
		}

		// Advanced section
		new Setting(containerEl)
			.setName("Advanced")
			.setHeading();

		new Setting(containerEl)
			.setName("Confirm before delete")
			.setDesc("Show confirmation dialog before deleting files")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmBeforeDelete)
				.onChange(async (value) => {
					this.plugin.settings.confirmBeforeDelete = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Enable debug logging to console")
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