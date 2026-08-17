// Minimal Obsidian stubs so modules that import the API can be loaded under Vitest.
// Only the members the tested code paths touch at import time are provided; anything
// that performs real Obsidian work throws so a test can never silently depend on it.

/**
 * Obsidian's interface language. Tests run against English, which is also what the real
 * call returns when the user has not chosen another language.
 */
export function getLanguage(): string {
    return 'en';
}

export function addIcon(_iconId: string, _svgContent: string): void {}

export function setIcon(_parent: unknown, _iconId: string): void {}

export class Notice {
    static readonly instances: Notice[] = [];

    constructor(
        public message: string,
        public duration?: number
    ) {
        Notice.instances.push(this);
    }

    setMessage(message: string): this {
        this.message = message;
        return this;
    }

    hide(): void {}
}

export class TAbstractFile {
    path = '';
    name = '';
}

export class TFolder extends TAbstractFile {}

export class TFile extends TAbstractFile {
    basename = '';
    extension = '';
    parent: TFolder | null = null;
}

/** Creates a TFile whose derived fields (name, basename, extension) match `path`. */
export function makeTFile(path: string): TFile {
    const file = new TFile();
    file.path = path;
    file.name = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path;
    const dotIndex = file.name.lastIndexOf('.');
    file.basename = dotIndex > 0 ? file.name.substring(0, dotIndex) : file.name;
    file.extension = dotIndex > 0 ? file.name.substring(dotIndex + 1) : '';
    return file;
}

export class Component {
    load(): void {}
    unload(): void {}
}

export class View extends Component {}

export class FileView extends View {
    file: TFile | null = null;
}

export class MarkdownView extends FileView {}

export class Editor {}

export class App {}

export class Plugin extends Component {
    app: App;
    manifest: { version: string };

    constructor(app: App, manifest: { version: string }) {
        super();
        this.app = app;
        this.manifest = manifest;
    }

    registerEvent(): void {}

    async loadData(): Promise<unknown> {
        return null;
    }

    async saveData(): Promise<void> {}
}

export class Modal {
    constructor(public app: App) {}

    open(): void {
        throw new Error('Modal.open is not available in tests');
    }

    close(): void {}
}

export class PluginSettingTab {
    app: App;

    constructor(app: App, _plugin: unknown) {
        this.app = app;
    }
}

export class Setting {
    constructor(public containerEl: unknown) {}

    setName(): this {
        return this;
    }

    setDesc(): this {
        return this;
    }

    addToggle(): this {
        return this;
    }

    addText(): this {
        return this;
    }

    addDropdown(): this {
        return this;
    }

    addSlider(): this {
        return this;
    }

    addButton(): this {
        return this;
    }

    addExtraButton(): this {
        return this;
    }
}

export class Menu {
    addItem(): this {
        return this;
    }

    addSeparator(): this {
        return this;
    }

    showAtMouseEvent(): void {}

    showAtPosition(): void {}
}

export class FileSystemAdapter {
    getFullPath(path: string): string {
        return `/vault/${path}`;
    }
}

export const Platform = {
    isMobile: false,
    isMacOS: true
};

export function requestUrl(): never {
    throw new Error('requestUrl is not available in tests');
}
