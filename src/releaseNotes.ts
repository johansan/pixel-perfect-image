/**
 * Release Notes System
 *
 * This module powers the "What's new" dialog shown after plugin updates.
 *
 * Notes:
 * - Add new releases at the top (newest first)
 * - Versions should match `manifest.json` (e.g., "1.0.22")
 * - You can disable auto-display for a specific version via `showOnUpdate: false`
 *
 * Supported inline formatting in `info` and list items:
 * - Bold: **text**
 * - Critical emphasis: ==text==
 * - Markdown links: [label](https://example.com)
 * - Bare URLs: https://example.com
 * - Line breaks: single `\n` becomes a line break
 */

export interface ReleaseNote {
	version: string;
	date: string; // YYYY-MM-DD
	showOnUpdate?: boolean;
	info?: string;
	new?: string[];
	improved?: string[];
	changed?: string[];
	fixed?: string[];
}

/**
 * All release notes, ordered from newest to oldest.
 */
const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: '1.0.24',
		date: '2026-01-07',
		showOnUpdate: true,
		new: ['External images can now be copied to the clipboard.',
			'External images can now be resized like local images.'
		],
		improved: ['==Finally fixed image resizing on mobile trackpads==! 🎉 Give it a go and let me know if it works for you!'
		],
		changed: [],
		fixed: []
	},
	{
		version: '1.0.23',
		date: '2025-12-16',
		showOnUpdate: true,
		new: ['==SVG Support==. You can now resize SVG images like any other image. Copying SVG images is not supported since Obsidian clipboard only supports bitmap images.'],
		improved: ['Settings now support the new ==SettingGroup API== in Obsidian 1.11 and later. Settings groups are now clearly outlined.'],
		changed: [],
		fixed: []
	}
];

export function getReleaseNotesBetweenVersions(fromVersion: string, toVersion: string): ReleaseNote[] {
	const fromIndex = RELEASE_NOTES.findIndex(note => note.version === fromVersion);
	const toIndex = RELEASE_NOTES.findIndex(note => note.version === toVersion);

	// If either version is not found, fall back to showing latest releases
	if (fromIndex === -1 || toIndex === -1) {
		return getLatestReleaseNotes();
	}

	const startIndex = Math.min(fromIndex, toIndex);
	const endIndex = Math.max(fromIndex, toIndex);
	return RELEASE_NOTES.slice(startIndex, endIndex + 1);
}

export function getLatestReleaseNotes(count: number = 5): ReleaseNote[] {
	return RELEASE_NOTES.slice(0, count);
}

export function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split('.').map(Number);
	const parts2 = v2.split('.').map(Number);

	for (let index = 0; index < Math.max(parts1.length, parts2.length); index += 1) {
		const part1 = parts1[index] || 0;
		const part2 = parts2[index] || 0;

		if (part1 > part2) return 1;
		if (part1 < part2) return -1;
	}

	return 0;
}

export function isReleaseAutoDisplayEnabled(version: string): boolean {
	const note = RELEASE_NOTES.find(entry => entry.version === version);
	if (!note) return true;
	return note.showOnUpdate !== false;
}
