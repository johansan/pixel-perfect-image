import { describe, expect, it } from 'vitest';
import {
    findLastObsidianImageSizeParam,
    isHttpUrlString,
    isLocalNetworkUrl,
    parseObsidianImageSizeParam,
    safeDecodeURIComponent
} from '../src/utils/utils';
import { parseResizeSize, sanitizeResizeSizes } from '../src/ui/settings';

describe('parseObsidianImageSizeParam', () => {
    it('parses a plain width', () => {
        expect(parseObsidianImageSizeParam('300')).toEqual({ width: 300 });
    });

    it('parses width and height', () => {
        expect(parseObsidianImageSizeParam('300x200')).toEqual({ width: 300, height: 200 });
    });

    it('parses a px suffix', () => {
        expect(parseObsidianImageSizeParam('300px')).toEqual({ width: 300 });
    });

    it('rejects non-size values', () => {
        expect(parseObsidianImageSizeParam('')).toBeNull();
        expect(parseObsidianImageSizeParam('left')).toBeNull();
        expect(parseObsidianImageSizeParam('0')).toBeNull();
        expect(parseObsidianImageSizeParam('-5')).toBeNull();
        expect(parseObsidianImageSizeParam('12.5')).toBeNull();
        expect(parseObsidianImageSizeParam('300x')).toBeNull();
    });
});

describe('findLastObsidianImageSizeParam', () => {
    it('finds the last size parameter among mixed params', () => {
        expect(findLastObsidianImageSizeParam(['left', '100', '200'])).toEqual({ index: 2, width: 200 });
    });

    it('returns null when no parameter is a size', () => {
        expect(findLastObsidianImageSizeParam(['left', 'right'])).toBeNull();
        expect(findLastObsidianImageSizeParam([])).toBeNull();
    });
});

describe('isHttpUrlString', () => {
    it('accepts http and https URLs', () => {
        expect(isHttpUrlString('https://example.com/a.png')).toBe(true);
        expect(isHttpUrlString('http://example.com/a.png')).toBe(true);
        expect(isHttpUrlString('  https://example.com')).toBe(true);
    });

    it('rejects other schemes and plain paths', () => {
        expect(isHttpUrlString('app://obsidian.md/a.png')).toBe(false);
        expect(isHttpUrlString('images/a.png')).toBe(false);
        expect(isHttpUrlString('')).toBe(false);
    });
});

describe('isLocalNetworkUrl', () => {
    it('detects loopback, private, and link-local hosts', () => {
        expect(isLocalNetworkUrl('http://localhost:3000/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://127.0.0.1/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://10.1.2.3/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://192.168.1.10/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://172.16.0.1/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://169.254.1.1/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://[::1]/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://[fe80::1]/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://[fd12:3456::1]/a.png')).toBe(true);
        expect(isLocalNetworkUrl('http://myhost.local/a.png')).toBe(true);
    });

    it('rejects public hosts and invalid input', () => {
        expect(isLocalNetworkUrl('https://example.com/a.png')).toBe(false);
        expect(isLocalNetworkUrl('http://172.32.0.1/a.png')).toBe(false);
        expect(isLocalNetworkUrl('http://8.8.8.8/a.png')).toBe(false);
        expect(isLocalNetworkUrl('http://fdupdates.com/a.png')).toBe(false);
        expect(isLocalNetworkUrl('not a url')).toBe(false);
    });
});

describe('safeDecodeURIComponent', () => {
    it('decodes valid input', () => {
        expect(safeDecodeURIComponent('my%20image.png')).toBe('my image.png');
    });

    it('returns malformed input unchanged', () => {
        expect(safeDecodeURIComponent('100%')).toBe('100%');
    });
});

describe('parseResizeSize', () => {
    it('parses pixel and percentage sizes', () => {
        expect(parseResizeSize('600px')).toEqual({ amount: 600, unit: 'px' });
        expect(parseResizeSize('50%')).toEqual({ amount: 50, unit: '%' });
        expect(parseResizeSize(' 25% ')).toEqual({ amount: 25, unit: '%' });
    });

    it('rejects bare numbers and invalid formats', () => {
        expect(parseResizeSize('600')).toBeNull();
        expect(parseResizeSize('0px')).toBeNull();
        expect(parseResizeSize('px')).toBeNull();
        expect(parseResizeSize('')).toBeNull();
    });
});

describe('sanitizeResizeSizes', () => {
    it('normalizes, dedupes, and drops invalid entries', () => {
        expect(sanitizeResizeSizes([' 25%', '50%', '25%', 'oops', '600PX', ''])).toEqual(['25%', '50%', '600px']);
    });
});
