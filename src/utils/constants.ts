
/** Regular expression to match Obsidian image wikilinks: ![[image.png]] */
export const WIKILINK_IMAGE_REGEX = /!\[\[([^\]]+)\]\]/g;

/**
 * Fallback width (in px) used when resizing external (http/https) images where the intrinsic width
 * isn't available yet (e.g. not loaded).
 */
export const DEFAULT_EXTERNAL_IMAGE_FALLBACK_WIDTH_PX = 500;
