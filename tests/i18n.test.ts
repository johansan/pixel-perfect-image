import { describe, expect, it } from 'vitest';
import { STRINGS_EN } from '../src/i18n/locales/en';
import { STRINGS_DE } from '../src/i18n/locales/de';
import { STRINGS_ES } from '../src/i18n/locales/es';
import { STRINGS_FR } from '../src/i18n/locales/fr';
import { STRINGS_JA } from '../src/i18n/locales/ja';
import { STRINGS_ZH } from '../src/i18n/locales/zh';

const LOCALES: Record<string, unknown> = {
    de: STRINGS_DE,
    es: STRINGS_ES,
    fr: STRINGS_FR,
    ja: STRINGS_JA,
    zh: STRINGS_ZH
};

/** Flattens a strings object into dotted key paths, e.g. "settings.items.confirmDelete.name". */
function keyPaths(value: unknown, prefix = ''): string[] {
    if (typeof value === 'string') return [prefix];
    if (value === null || typeof value !== 'object') {
        throw new Error(`Unexpected value at ${prefix || '(root)'}`);
    }

    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

/** Returns every string leaf of a strings object. */
function stringLeaves(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    return Object.values(value as Record<string, unknown>).flatMap(stringLeaves);
}

describe('locale structure', () => {
    const englishKeys = keyPaths(STRINGS_EN).sort();

    for (const [locale, strings] of Object.entries(LOCALES)) {
        it(`"${locale}" has exactly the same keys as "en"`, () => {
            expect(keyPaths(strings).sort()).toEqual(englishKeys);
        });

        it(`"${locale}" has no empty strings`, () => {
            for (const leaf of stringLeaves(strings)) {
                expect(leaf.trim()).not.toBe('');
            }
        });
    }
});
