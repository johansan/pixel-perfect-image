
/** Regular expression to match Obsidian image wikilinks: ![[image.png]] */
export const WIKILINK_IMAGE_REGEX = /(!\[\[)([^\]]+)(\]\])/g;

/** Regular expressions to match both image link styles */
export const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;