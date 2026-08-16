import { describe, expect, it } from 'vitest';
import { markdownCodeRanges, overlapsRange } from '../src/utils/markdownRanges';

/** Returns the substrings of `text` that the scanner classified as code. */
function codeSlices(text: string): string[] {
    return markdownCodeRanges(text).map(range => text.slice(range.start, range.end));
}

describe('markdownCodeRanges', () => {
    it('returns no ranges for plain prose', () => {
        expect(markdownCodeRanges('Just a paragraph with an ![[image.png]] embed.')).toEqual([]);
    });

    it('protects a backtick fence', () => {
        const text = 'before\n```\n![[image.png|100]]\n```\nafter';
        const slices = codeSlices(text);
        expect(slices).toHaveLength(1);
        expect(slices[0]).toContain('![[image.png|100]]');
    });

    it('protects a tilde fence with an info string', () => {
        const text = '~~~markdown\n![alt|200](photo.png)\n~~~\n';
        const slices = codeSlices(text);
        expect(slices).toHaveLength(1);
        expect(slices[0]).toContain('![alt|200](photo.png)');
    });

    it('keeps an unclosed fence protected to the end of the text', () => {
        const text = 'prose\n```\n![[image.png]]';
        const ranges = markdownCodeRanges(text);
        expect(ranges).toHaveLength(1);
        expect(ranges[0].end).toBe(text.length);
    });

    it('requires the closing fence to be at least as long as the opener', () => {
        const text = '````\n```\n![[image.png]]\n````\nafter';
        const slices = codeSlices(text);
        expect(slices).toHaveLength(1);
        expect(slices[0]).toContain('![[image.png]]');
        expect(slices[0]).not.toContain('after');
    });

    it('protects inline code spans but not the rest of the line', () => {
        const text = 'Use `![[image.png|100]]` to embed ![[real.png|50]] here.';
        const ranges = markdownCodeRanges(text);
        expect(ranges).toHaveLength(1);
        expect(text.slice(ranges[0].start, ranges[0].end)).toBe('`![[image.png|100]]`');
    });

    it('protects double-backtick spans containing single backticks', () => {
        const text = 'A span `` `![[a.png]]` `` here';
        const slices = codeSlices(text);
        expect(slices).toHaveLength(1);
        expect(slices[0]).toContain('![[a.png]]');
    });

    it('ignores an escaped backtick', () => {
        expect(markdownCodeRanges('Not code: \\`![[a.png]]\\`')).toEqual([]);
    });

    it('protects indented code after a blank line', () => {
        const text = 'paragraph\n\n    ![[image.png|100]]\n\nmore prose';
        const slices = codeSlices(text);
        expect(slices).toHaveLength(1);
        expect(slices[0]).toContain('![[image.png|100]]');
    });

    it('treats an indented continuation line as prose, not code', () => {
        const text = 'paragraph line one\n    continuation with ![[image.png]]';
        expect(markdownCodeRanges(text)).toEqual([]);
    });

    it('protects a fence nested inside a blockquote', () => {
        const text = '> quote\n> ```\n> ![[image.png]]\n> ```\n';
        const slices = codeSlices(text);
        expect(slices).toHaveLength(1);
        expect(slices[0]).toContain('![[image.png]]');
    });
});

describe('overlapsRange', () => {
    it('detects overlap with half-open ranges', () => {
        const ranges = [{ start: 5, end: 10 }];
        expect(overlapsRange(ranges, 0, 5)).toBe(false);
        expect(overlapsRange(ranges, 0, 6)).toBe(true);
        expect(overlapsRange(ranges, 9, 20)).toBe(true);
        expect(overlapsRange(ranges, 10, 20)).toBe(false);
    });
});
