export interface TextRange {
    start: number;
    end: number;
}

interface FenceDelimiter {
    marker: '`' | '~';
    length: number;
    rest: string;
}

/** Returns the delimiter on a possible fenced code line. */
function fenceDelimiterOf(line: string): FenceDelimiter | null {
    const match = /^(?: {0,3}>[ \t]?)* {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!match) return null;

    const marker: '`' | '~' = match[1].startsWith('`') ? '`' : '~';
    const rest = match[2];
    if (marker === '`' && rest.includes('`')) return null;
    return { marker, length: match[1].length, rest };
}

/** Blockquote markers in front of a line, stripped before classifying its shape. */
const BLOCKQUOTE_PREFIX = /^(?: {0,3}>[ \t]?)*/;

/** A list item opened by a Markdown marker or a unicode bullet. */
const LIST_ITEM_LINE = /^ {0,3}(?:[-*+•‣▪▫▸◦·]|\d{1,9}[.)])[ \t]/;

/** A heading or thematic break closes itself, so indented code may follow it directly. */
const SELF_CLOSING_BLOCK = /^ {0,3}(?:#{1,6}(?:[ \t]|$)|(?:-[ \t]*){3,}$|(?:\*[ \t]*){3,}$|(?:_[ \t]*){3,}$)/;

/** Indentation width in columns, counting a tab as four. */
function indentWidthOf(line: string): number {
    let width = 0;
    for (const char of line) {
        if (char === ' ') width += 1;
        else if (char === '\t') width += 4;
        else break;
    }
    return width;
}

/** A closing fence uses the opening marker, is at least as long, and has no info string. */
function closesFence(line: string, opening: FenceDelimiter): boolean {
    const candidate = fenceDelimiterOf(line);
    return (
        candidate !== null &&
        candidate.marker === opening.marker &&
        candidate.length >= opening.length &&
        candidate.rest.trim().length === 0
    );
}

/** True when the character at `index` is escaped by an odd run of backslashes. */
function isEscaped(text: string, index: number): boolean {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) slashes += 1;
    return slashes % 2 === 1;
}

/** Adds same-line backtick code spans to `ranges`. */
function collectInlineCode(line: string, lineStart: number, ranges: TextRange[]): void {
    for (let index = 0; index < line.length; index++) {
        if (line[index] !== '`' || isEscaped(line, index)) continue;

        let length = 1;
        while (line[index + length] === '`') length += 1;

        let search = index + length;
        let closed = false;
        while (search < line.length) {
            const candidate = line.indexOf('`', search);
            if (candidate < 0) break;

            let candidateLength = 1;
            while (line[candidate + candidateLength] === '`') candidateLength += 1;

            if (!isEscaped(line, candidate) && candidateLength === length) {
                const end = candidate + candidateLength;
                ranges.push({ start: lineStart + index, end: lineStart + end });
                index = end - 1;
                closed = true;
                break;
            }

            search = candidate + candidateLength;
        }

        if (!closed) index += length - 1;
    }
}

/**
 * Ranges whose contents Markdown renders as code. Fenced blocks and same-line backtick
 * spans are protected so link rewrites do not touch examples, commands, or source text.
 */
export function markdownCodeRanges(text: string): TextRange[] {
    const ranges: TextRange[] = [];
    let lineStart = 0;
    let fence: { delimiter: FenceDelimiter; start: number; indentWidth: number; itemIndent: number } | null = null;
    // Indented code cannot interrupt a paragraph or list item: without a blank line
    // above, an indented line is a continuation of the block, such as a nested bullet,
    // and the link rewrites must still reach it
    let indentedCodeAllowed = true;
    // An indented fence only opens under a list item: under a plain paragraph the
    // indented line is continuation prose even when it starts with backticks. The
    // item's content indent bounds how far its fence reaches, so -1 means no item.
    let listContentIndent = -1;
    // True when the current item's marker carried five or more trailing spaces, which
    // makes its first block indented code that deeper lines continue
    let itemStartsWithCode = false;
    // True while a paragraph is open, which is what turns a following line of = or -
    // characters into a setext heading underline
    let paragraphOpen = false;

    while (lineStart <= text.length) {
        const newline = text.indexOf('\n', lineStart);
        const lineEnd = newline < 0 ? text.length : newline;
        const line = text.slice(lineStart, lineEnd).replace(/\r$/, '');
        // Classification looks past blockquote markers, so a list with an indented
        // fence keeps its protection inside a quoted reply too
        const content = line.replace(BLOCKQUOTE_PREFIX, '');

        if (fence !== null) {
            // Checked before the closer test: a line indented less than the item's
            // content indent ends the list item, and the renderer closes an unclosed
            // indented fence with it, so from here on the text is prose to rewrite. A
            // line indented less than the fence but at least to the item stays fence
            // content. This holds even when the ending line is itself a bare delimiter,
            // which then opens a new fence at the margin rather than closing this one.
            if (fence.indentWidth >= 0 && content.trim() !== '' && indentWidthOf(content) < fence.itemIndent) {
                ranges.push({ start: fence.start, end: lineStart });
                fence = null;
                continue;
            }
            // A closer may sit at most three columns past its opener, so a deeper
            // indented delimiter inside a nested fence stays content
            const closes =
                fence.indentWidth < 0
                    ? closesFence(line, fence.delimiter)
                    : indentWidthOf(content) <= fence.indentWidth + 3 && closesFence(content.replace(/^[ \t]+/, ''), fence.delimiter);
            if (closes) {
                ranges.push({ start: fence.start, end: newline < 0 ? lineEnd : lineEnd + 1 });
                fence = null;
                // The closing fence ends its block, so indented code may follow it
                // directly, except inside a list item, where an indented line after
                // the fence continues the item as prose unless it sits four columns
                // past the item's content indent
                indentedCodeAllowed = listContentIndent < 0;
                if (listContentIndent >= 0) itemStartsWithCode = true;
            } else {
                indentedCodeAllowed = false;
            }
        } else {
            const opening = fenceDelimiterOf(line);
            if (opening) {
                // A fence indented to the item stays inside it, and after it closes,
                // indented lines continue the item as prose. A fence below the item's
                // content indent ends the list instead, so code may follow it.
                if (listContentIndent >= 0 && indentWidthOf(content) < listContentIndent) listContentIndent = -1;
                fence = { delimiter: opening, start: lineStart, indentWidth: -1, itemIndent: -1 };
                indentedCodeAllowed = false;
                paragraphOpen = false;
            } else if (content.trim() === '') {
                // Checked before the indentation branch: a blank line carrying leftover
                // indentation still separates blocks and enables indented code below it
                indentedCodeAllowed = true;
                paragraphOpen = false;
            } else if (/^(?: {4}|\t)/.test(content)) {
                // The flag carries through the block: lines of a code block stay code,
                // continuation lines of a paragraph stay prose and keep their backtick spans
                if (indentedCodeAllowed) {
                    ranges.push({ start: lineStart, end: lineEnd });
                    paragraphOpen = false;
                } else if (listContentIndent >= 0 && indentWidthOf(content) < listContentIndent) {
                    // Indented too little to continue the list item and too much to be
                    // prose, so the renderer shows it as indented code below the list
                    ranges.push({ start: lineStart, end: lineEnd });
                    paragraphOpen = false;
                } else if (itemStartsWithCode && indentWidthOf(content) >= listContentIndent + 4) {
                    // The item opened with indented code, and this line is indented
                    // deep enough to continue that code block
                    ranges.push({ start: lineStart, end: lineEnd });
                    paragraphOpen = false;
                } else {
                    // A fence indented as a list continuation opens a code block even
                    // though a fence at the left margin allows at most three spaces
                    const nested = listContentIndent >= 0 ? fenceDelimiterOf(content.replace(/^[ \t]+/, '')) : null;
                    if (nested) {
                        fence = {
                            delimiter: nested,
                            start: lineStart,
                            indentWidth: indentWidthOf(content),
                            itemIndent: listContentIndent
                        };
                        paragraphOpen = false;
                    } else {
                        collectInlineCode(line, lineStart, ranges);
                        paragraphOpen = true;
                    }
                }
            } else {
                collectInlineCode(line, lineStart, ranges);
                // A heading or thematic break closes itself, and a setext underline
                // closes the paragraph above it as a heading, so indented code may
                // follow any of them, while a paragraph or list item blocks it. With a
                // paragraph open, a bare dash is the underline even with a trailing
                // space, because an empty list item cannot interrupt a paragraph.
                const setext: boolean = paragraphOpen && /^ {0,3}(?:=+|-+)[ \t]*$/.test(content);
                // A row with two or more pipes is a table line, which ends like a
                // self-closing block, while a single leading pipe is ordinary prose
                const tableRow = content.startsWith('|') && content.indexOf('|', 1) !== -1;
                indentedCodeAllowed = setext || tableRow || SELF_CLOSING_BLOCK.test(content);
                itemStartsWithCode = false;
                const item: RegExpExecArray | null = indentedCodeAllowed ? null : LIST_ITEM_LINE.exec(content);
                // Only a plain paragraph line takes a setext underline: a list item
                // does not open a paragraph for one
                paragraphOpen = !indentedCodeAllowed && !item;
                if (item) {
                    // Up to three more spaces behind the marker's first one widen the
                    // content indent, so "-  item" has an indent of three, not two.
                    // From five spaces on the run is indented code inside the item, the
                    // rest of the line renders as code, and the content indent falls
                    // back to the marker plus one space.
                    let extra = 0;
                    while (content[item[0].length + extra] === ' ') extra += 1;
                    if (extra <= 3) {
                        listContentIndent = item[0].length + extra;
                    } else {
                        listContentIndent = item[0].length;
                        itemStartsWithCode = true;
                        ranges.push({ start: lineStart + line.length - content.length + item[0].length, end: lineEnd });
                    }
                } else {
                    listContentIndent = -1;
                }
            }
        }

        if (newline < 0) break;
        lineStart = newline + 1;
    }

    if (fence !== null) ranges.push({ start: fence.start, end: text.length });
    return ranges;
}

/** True when two half-open text ranges overlap. */
export function overlapsRange(ranges: readonly TextRange[], start: number, end: number): boolean {
    return ranges.some(range => start < range.end && end > range.start);
}
