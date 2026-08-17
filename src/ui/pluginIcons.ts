import { addIcon } from 'obsidian';

/*
 * These ids carry this plugin's prefix so registering copies of another plugin's
 * artwork can never replace the icon registered by the plugin that owns it.
 */
export const NOTEBOOK_NAVIGATOR_ICON = 'pixel-perfect-image-notebook-navigator';
export const BETTER_PASTE_ICON = 'pixel-perfect-image-better-paste';

addIcon(
    NOTEBOOK_NAVIGATOR_ICON,
    `<g stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="19.88" y="12.42" width="66.42" height="75.21" rx="6.25" stroke-width="8"/>
        <g stroke-width="4">
            <line x1="13.29" y1="24.38" x2="28.5" y2="24.38"/>
            <line x1="13.29" y1="37.21" x2="28.5" y2="37.21"/>
            <line x1="13.29" y1="50" x2="28.5" y2="50"/>
            <line x1="13.29" y1="62.79" x2="28.5" y2="62.79"/>
            <line x1="13.29" y1="75.63" x2="28.5" y2="75.63"/>
        </g>
        <g stroke-width="3.5">
            <circle cx="28.5" cy="24.38" r="1.38"/>
            <circle cx="28.5" cy="37.21" r="1.38"/>
            <circle cx="28.5" cy="50" r="1.38"/>
            <circle cx="28.5" cy="62.79" r="1.38"/>
            <circle cx="28.5" cy="75.63" r="1.38"/>
        </g>
        <polygon points="52.77 53.33 36.22 49.08 70.07 34.18 57.25 69.38 52.77 53.33" fill="currentColor" stroke="none"/>
    </g>`
);

addIcon(
    BETTER_PASTE_ICON,
    `<path d="M 12.82,21.75 A 39.51,10.69 0 0 1 88.77,21.75 Q 91,23.86 89.03,26.21 L 62.48,57.81 Q 59.78,61.02 59.16,67.38 L 58.18,77.41 Q 57.98,79.4 56.2,80.31 L 46.81,85.13 Q 45.03,86.04 44.75,84.06 L 42.43,67.38 Q 41.49,60.64 39.11,57.81 L 12.56,26.21 Q 10.59,23.86 12.82,21.75 Z M 16.87,24.7 A 33.93,5.16 0 1 0 84.72,24.7 A 33.93,5.16 0 1 0 16.87,24.7 Z" fill="currentColor" fill-rule="evenodd" stroke="none"/>`
);
