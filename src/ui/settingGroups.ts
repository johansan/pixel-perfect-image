import { Setting, SettingGroup, requireApiVersion } from 'obsidian';

export interface SettingGroupController {
	rootEl: HTMLElement;
	addSetting: (createSetting: (setting: Setting) => void) => Setting;
}

function supportsSettingGroups(): boolean {
	return typeof SettingGroup === 'function' && typeof requireApiVersion === 'function' && requireApiVersion('1.11.0');
}

export function createSettingGroupFactory(containerEl: HTMLElement): (heading?: string) => SettingGroupController {
	const useSettingGroups = supportsSettingGroups();

	return (heading?: string): SettingGroupController => {
		if (!useSettingGroups && heading) {
			new Setting(containerEl).setName(heading).setHeading();
		}

		const wrapperEl = containerEl.createDiv();

		if (useSettingGroups) {
			wrapperEl.addClass('setting-group');
			const group = new SettingGroup(wrapperEl);
			if (heading) {
				group.setHeading(heading);
			}

			return {
				rootEl: wrapperEl,
				addSetting: createSetting => {
					let createdSetting: Setting | null = null;
					group.addSetting(setting => {
						createdSetting = setting;
						createSetting(setting);
					});
					if (!createdSetting) {
						throw new Error('SettingGroup.addSetting did not provide a Setting');
					}
					return createdSetting;
				}
			};
		}

		return {
			rootEl: wrapperEl,
			addSetting: createSetting => {
				const setting = new Setting(wrapperEl);
				createSetting(setting);
				return setting;
			}
		};
	};
}
