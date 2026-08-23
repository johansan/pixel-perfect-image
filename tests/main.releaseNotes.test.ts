import { App } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PixelPerfectImage from '../src/main';
import { DEFAULT_SETTINGS } from '../src/ui/settings';

const mocks = vi.hoisted(() => ({
    isReleaseAutoDisplayEnabled: vi.fn<(version: string) => boolean>(),
    modalOpen: vi.fn()
}));

vi.mock('../src/releaseNotes', async importOriginal => ({
    ...(await importOriginal<typeof import('../src/releaseNotes')>()),
    isReleaseAutoDisplayEnabled: mocks.isReleaseAutoDisplayEnabled
}));

vi.mock('../src/ui/WhatsNewModal', () => ({
    WhatsNewModal: class {
        open(): void {
            mocks.modalOpen();
        }
    }
}));

interface VersionCheckHarness {
    checkForVersionUpdate(): Promise<void>;
}

interface StartupDialogCase {
    userSetting: boolean;
    showOnUpdate: boolean;
    expectedShows: boolean;
}

function createPlugin(showReleaseNotes: boolean): PixelPerfectImage {
    const plugin = new PixelPerfectImage(new App(), { version: '1.0.30' });
    plugin.settings = {
        ...DEFAULT_SETTINGS,
        showReleaseNotes,
        lastShownVersion: '1.0.29'
    };
    return plugin;
}

describe("PixelPerfectImage What's new startup dialog", () => {
    beforeEach(() => {
        mocks.isReleaseAutoDisplayEnabled.mockReset();
        mocks.modalOpen.mockReset();
    });

    it.each<StartupDialogCase>([
        { userSetting: true, showOnUpdate: true, expectedShows: true },
        { userSetting: true, showOnUpdate: false, expectedShows: false },
        { userSetting: false, showOnUpdate: true, expectedShows: false },
        { userSetting: false, showOnUpdate: false, expectedShows: false }
    ])('shows=$expectedShows when user setting=$userSetting and showOnUpdate=$showOnUpdate', async (testCase: StartupDialogCase) => {
        mocks.isReleaseAutoDisplayEnabled.mockReturnValue(testCase.showOnUpdate);
        const plugin = createPlugin(testCase.userSetting);
        const saveSettings = vi.spyOn(plugin, 'saveSettings').mockResolvedValue();

        await (plugin as unknown as VersionCheckHarness).checkForVersionUpdate();

        expect(mocks.modalOpen).toHaveBeenCalledTimes(testCase.expectedShows ? 1 : 0);
        if (testCase.expectedShows) {
            expect(plugin.settings.lastShownVersion).toBe('1.0.29');
            expect(saveSettings).not.toHaveBeenCalled();
        } else {
            expect(plugin.settings.lastShownVersion).toBe('1.0.30');
            expect(saveSettings).toHaveBeenCalledTimes(1);
        }
    });
});
