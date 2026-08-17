import { describe, expect, it } from 'vitest';
import { migrateLegacyFileOperations } from '../src/main';
import { reconcileFileOperations } from '../src/ui/settings';

const DEFAULT_FILE_OPERATIONS = [
    { id: 'openInNewTab', visible: true },
    { id: 'openToTheRight', visible: true },
    { id: 'openInNewWindow', visible: true },
    { id: 'openInDefaultApp', visible: true },
    { id: 'showInExplorer', visible: true },
    { id: 'renameImage', visible: true },
    { id: 'deleteImage', visible: true }
];

describe('reconcileFileOperations', () => {
    it('preserves a valid configured order and visibility', () => {
        const value = [
            { id: 'deleteImage', visible: false },
            { id: 'renameImage', visible: true },
            { id: 'showInExplorer', visible: false },
            { id: 'openInDefaultApp', visible: true },
            { id: 'openInNewWindow', visible: false },
            { id: 'openToTheRight', visible: true },
            { id: 'openInNewTab', visible: false }
        ];

        const reconciled = reconcileFileOperations(value);

        expect(reconciled).toEqual(value);
        expect(reconciled).not.toBe(value);
    });

    it('preserves the default-order shape produced by legacy boolean migration', () => {
        const legacyMigrationShape = [
            { id: 'openInNewTab', visible: false },
            { id: 'openToTheRight', visible: true },
            { id: 'openInNewWindow', visible: false },
            { id: 'openInDefaultApp', visible: true },
            { id: 'showInExplorer', visible: false },
            { id: 'renameImage', visible: true },
            { id: 'deleteImage', visible: false }
        ];

        expect(reconcileFileOperations(legacyMigrationShape)).toEqual(legacyMigrationShape);
    });

    it('drops unknown, duplicate, and malformed entries', () => {
        expect(
            reconcileFileOperations([
                { id: 'openInNewTab', visible: false },
                { id: 'futureOperation', visible: true },
                { id: 'openInNewTab', visible: true },
                { id: 'renameImage', visible: 'yes' }
            ])
        ).toEqual([
            { id: 'openInNewTab', visible: false },
            { id: 'openToTheRight', visible: true },
            { id: 'openInNewWindow', visible: true },
            { id: 'openInDefaultApp', visible: true },
            { id: 'showInExplorer', visible: true },
            { id: 'renameImage', visible: true },
            { id: 'deleteImage', visible: true }
        ]);
    });

    it('appends missing operations at the end in default order', () => {
        expect(
            reconcileFileOperations([
                { id: 'renameImage', visible: false },
                { id: 'openInNewTab', visible: true }
            ])
        ).toEqual([
            { id: 'renameImage', visible: false },
            { id: 'openInNewTab', visible: true },
            { id: 'openToTheRight', visible: true },
            { id: 'openInNewWindow', visible: true },
            { id: 'openInDefaultApp', visible: true },
            { id: 'showInExplorer', visible: true },
            { id: 'deleteImage', visible: true }
        ]);
    });

    it('returns defaults for garbage input', () => {
        for (const value of [null, undefined, 'invalid', 42, { id: 'openInNewTab', visible: false }]) {
            expect(reconcileFileOperations(value)).toEqual(DEFAULT_FILE_OPERATIONS);
        }
    });
});

describe('migrateLegacyFileOperations', () => {
    it('builds file operations when only legacy booleans are stored', () => {
        expect(
            migrateLegacyFileOperations({
                toggleIndividualMenuOptions: true,
                showOpenInNewTab: false,
                showOpenToTheRight: true,
                showOpenInNewWindow: false,
                showOpenInDefaultApp: true,
                showShowInFileExplorer: false,
                showRenameOption: true,
                showDeleteImageOption: false
            })
        ).toEqual([
            { id: 'openInNewTab', visible: false },
            { id: 'openToTheRight', visible: true },
            { id: 'openInNewWindow', visible: false },
            { id: 'openInDefaultApp', visible: true },
            { id: 'showInExplorer', visible: false },
            { id: 'renameImage', visible: true },
            { id: 'deleteImage', visible: false }
        ]);
    });

    it('does not replace an existing file-operations array with legacy booleans', () => {
        const fileOperations = [...DEFAULT_FILE_OPERATIONS].reverse().map(operation => ({
            ...operation,
            visible: operation.id !== 'deleteImage'
        }));
        const stored = {
            fileOperations,
            toggleIndividualMenuOptions: true,
            showDeleteImageOption: true
        };

        expect(migrateLegacyFileOperations(stored)).toBeNull();
        expect(reconcileFileOperations(stored.fileOperations)).toEqual(fileOperations);
    });

    it('returns null when no legacy keys are stored', () => {
        expect(migrateLegacyFileOperations({ showFileInfo: true })).toBeNull();
    });
});
