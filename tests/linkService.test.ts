import { describe, expect, it } from 'vitest';
import { TFile, makeTFile } from 'obsidian';
import { LinkService } from '../src/core/LinkService';
import { findLastObsidianImageSizeParam } from '../src/utils/utils';

type PluginArg = ConstructorParameters<typeof LinkService>[0];

interface FakeContext {
    service: LinkService;
    /** Note contents by path, updated in place by vault.process. */
    contents: Map<string, string>;
}

/**
 * Builds a LinkService wired to a fake plugin. Link resolution mirrors Obsidian's
 * behavior closely enough for tests: exact path first, then unique filename match.
 */
function makeContext(vaultFiles: TFile[], activeFile?: TFile): FakeContext {
    const contents = new Map<string, string>();

    const getFirstLinkpathDest = (linkpath: string, _sourcePath: string): TFile | null => {
        const byPath = vaultFiles.find(file => file.path === linkpath);
        if (byPath) return byPath;
        return vaultFiles.find(file => file.name === linkpath) ?? null;
    };

    const plugin = {
        app: {
            metadataCache: { getFirstLinkpathDest },
            workspace: { getActiveFile: () => activeFile ?? null },
            vault: {
                process: async (file: TFile, transform: (data: string) => string): Promise<string> => {
                    const before = contents.get(file.path) ?? '';
                    const after = transform(before);
                    contents.set(file.path, after);
                    return after;
                }
            }
        }
    };

    return { service: new LinkService(plugin as unknown as PluginArg), contents };
}

/** The same width transform ImageService applies: replace the last size param or append. */
function setWidth(newWidth: number): (params: string[]) => string[] {
    return params => {
        const sizeParam = findLastObsidianImageSizeParam(params);
        if (sizeParam) {
            return [...params.slice(0, sizeParam.index), String(newWidth), ...params.slice(sizeParam.index + 1)];
        }
        return [...params, String(newWidth)];
    };
}

const note = makeTFile('notes/note.md');
const photo = makeTFile('images/photo.png');
const other = makeTFile('images/other.png');

describe('updateLinks', () => {
    it('adds a width to a wiki link without one', () => {
        const { service } = makeContext([photo]);
        const result = service.updateLinks('Before ![[photo.png]] after', note, photo, setWidth(400));
        expect(result).toBe('Before ![[photo.png|400]] after');
    });

    it('replaces an existing width and keeps other parameters', () => {
        const { service } = makeContext([photo]);
        const result = service.updateLinks('![[photo.png|left|100]]', note, photo, setWidth(400));
        expect(result).toBe('![[photo.png|left|400]]');
    });

    it('replaces a WxH size with a width-only value', () => {
        const { service } = makeContext([photo]);
        const result = service.updateLinks('![[photo.png|300x200]]', note, photo, setWidth(400));
        expect(result).toBe('![[photo.png|400]]');
    });

    it('keeps a heading reference on a wiki link', () => {
        const { service } = makeContext([photo]);
        const result = service.updateLinks('![[photo.png#page|100]]', note, photo, setWidth(400));
        expect(result).toBe('![[photo.png|400#page]]');
    });

    it('updates a markdown-style link and keeps the alt text', () => {
        const { service } = makeContext([photo]);
        const result = service.updateLinks('Text ![caption|100](photo.png) end', note, photo, setWidth(400));
        expect(result).toBe('Text ![caption|400](photo.png) end');
    });

    it('re-encodes spaces in a markdown link destination', () => {
        const spaced = makeTFile('images/my image.png');
        const { service } = makeContext([spaced]);
        const result = service.updateLinks('![alt](my%20image.png)', note, spaced, setWidth(200));
        expect(result).toBe('![alt|200](my%20image.png)');
    });

    it('leaves links to other images untouched', () => {
        const { service } = makeContext([photo, other]);
        const text = '![[photo.png|100]] and ![[other.png|100]]';
        const result = service.updateLinks(text, note, photo, setWidth(400));
        expect(result).toBe('![[photo.png|400]] and ![[other.png|100]]');
    });

    it('does not rewrite links inside code fences', () => {
        const { service } = makeContext([photo]);
        const text = 'Real: ![[photo.png|100]]\n\n```\nExample: ![[photo.png|100]]\n```\n';
        const result = service.updateLinks(text, note, photo, setWidth(400));
        expect(result).toBe('Real: ![[photo.png|400]]\n\n```\nExample: ![[photo.png|100]]\n```\n');
    });

    it('does not rewrite links inside inline code', () => {
        const { service } = makeContext([photo]);
        const text = 'Use `![[photo.png|100]]` like ![[photo.png|100]]';
        const result = service.updateLinks(text, note, photo, setWidth(400));
        expect(result).toBe('Use `![[photo.png|100]]` like ![[photo.png|400]]');
    });

    it('does not rewrite markdown links inside code fences', () => {
        const { service } = makeContext([photo]);
        const text = '![alt|100](photo.png)\n\n```md\n![alt|100](photo.png)\n```\n';
        const result = service.updateLinks(text, note, photo, setWidth(400));
        expect(result).toBe('![alt|400](photo.png)\n\n```md\n![alt|100](photo.png)\n```\n');
    });
});

describe('updateImageLinks', () => {
    it('updates the note body and reports the change', async () => {
        const { service, contents } = makeContext([photo]);
        contents.set(note.path, '---\ncover: "![[photo.png]]"\n---\nBody ![[photo.png|100]]\n');

        const didChange = await service.updateImageLinks(note, photo, setWidth(400));

        expect(didChange).toBe(true);
        expect(contents.get(note.path)).toBe('---\ncover: "![[photo.png]]"\n---\nBody ![[photo.png|400]]\n');
    });

    it('reports no change when nothing matches', async () => {
        const { service, contents } = makeContext([photo, other]);
        contents.set(note.path, 'Only ![[other.png|100]] here\n');

        const didChange = await service.updateImageLinks(note, photo, setWidth(400));

        expect(didChange).toBe(false);
        expect(contents.get(note.path)).toBe('Only ![[other.png|100]] here\n');
    });

    it('refuses to edit the image file itself', async () => {
        const { service } = makeContext([photo]);
        expect(await service.updateImageLinks(photo, photo, setWidth(400))).toBe(false);
    });
});

describe('removeImageLinks', () => {
    it('removes wiki and markdown links but keeps code examples', async () => {
        const { service, contents } = makeContext([photo], note);
        contents.set(note.path, 'A ![[photo.png|100]] B ![alt](photo.png) C\n\n```\n![[photo.png]]\n```\n');

        const didChange = await service.removeImageLinks(photo);

        expect(didChange).toBe(true);
        expect(contents.get(note.path)).toBe('A  B  C\n\n```\n![[photo.png]]\n```\n');
    });
});

describe('findCurrentImageWidthInText', () => {
    it('finds the width of a wiki link', () => {
        const { service } = makeContext([photo]);
        expect(service.findCurrentImageWidthInText(note, photo, 'x ![[photo.png|240]] y')).toBe(240);
    });

    it('finds the width of a markdown link', () => {
        const { service } = makeContext([photo]);
        expect(service.findCurrentImageWidthInText(note, photo, 'x ![alt|240](photo.png) y')).toBe(240);
    });

    it('ignores widths inside code fences', () => {
        const { service } = makeContext([photo]);
        expect(service.findCurrentImageWidthInText(note, photo, '```\n![[photo.png|240]]\n```\n')).toBeNull();
    });

    it('returns null when the link has no width', () => {
        const { service } = makeContext([photo]);
        expect(service.findCurrentImageWidthInText(note, photo, '![[photo.png]]')).toBeNull();
    });
});

describe('external image links', () => {
    const url = 'https://example.com/pic.png';

    it('updates only the markdown link with the matching URL', async () => {
        const { service, contents } = makeContext([]);
        contents.set(note.path, `![a|100](${url}) ![b|100](https://example.com/else.png)\n`);

        const didChange = await service.updateExternalImageLinks(note, url, setWidth(400));

        expect(didChange).toBe(true);
        expect(contents.get(note.path)).toBe(`![a|400](${url}) ![b|100](https://example.com/else.png)\n`);
    });

    it('does not rewrite external links inside code fences', async () => {
        const { service, contents } = makeContext([]);
        contents.set(note.path, `![a|100](${url})\n\n\`\`\`\n![a|100](${url})\n\`\`\`\n`);

        await service.updateExternalImageLinks(note, url, setWidth(400));

        expect(contents.get(note.path)).toBe(`![a|400](${url})\n\n\`\`\`\n![a|100](${url})\n\`\`\`\n`);
    });

    it('finds the current width by URL', () => {
        const { service } = makeContext([]);
        expect(service.findCurrentExternalImageWidthInText(url, `![a|321](${url})`)).toBe(321);
        expect(service.findCurrentExternalImageWidthInText(url, '![a|321](https://example.com/else.png)')).toBeNull();
    });
});
