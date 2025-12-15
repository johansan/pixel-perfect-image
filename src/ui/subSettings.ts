import type { Setting } from 'obsidian';

const SETTING_HIDDEN_CLASS = 'pixel-perfect-setting-hidden';

export function setElementVisible(element: HTMLElement, visible: boolean): void {
	element.classList.toggle(SETTING_HIDDEN_CLASS, !visible);
}

export function createSubSettingsContainer(parentSetting: Setting, cls = 'pixel-perfect-sub-settings'): HTMLDivElement {
	const container = parentSetting.settingEl.ownerDocument.createElement('div');
	container.className = cls;
	parentSetting.settingEl.after(container);
	return container;
}

export function wireToggleSettingWithSubSettings(
	parentSetting: Setting,
	getValue: () => boolean,
	onValueChange: (value: boolean) => Promise<void> | void,
	cls = 'pixel-perfect-sub-settings'
): HTMLDivElement {
	const container = createSubSettingsContainer(parentSetting, cls);
	setElementVisible(container, getValue());

	parentSetting.addToggle(toggle => {
		toggle.setValue(getValue()).onChange(value => {
			setElementVisible(container, value);
			try {
				const result = onValueChange(value);
				if (result instanceof Promise) {
					result.catch(error => console.error('Failed to persist setting:', error));
				}
			} catch (error) {
				console.error('Failed to persist setting:', error);
			}
		});
	});

	return container;
}
