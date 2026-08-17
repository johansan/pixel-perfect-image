/**
 * English language strings for Pixel Perfect Image
 */
export const STRINGS_EN = {
    // Context menu items
    menu: {
        remoteImage: 'Remote image',
        copyImageUrl: 'Copy image URL',
        copyImage: 'Copy image',
        copyLocalPath: 'Copy local path',
        resizeTo: 'Resize to {size}',
        removeCustomSize: 'Remove custom size',
        showInFinder: 'Show in Finder',
        showInExplorer: 'Show in Explorer',
        renameImage: 'Rename image',
        deleteImageAndLink: 'Delete image and link',
        openInNewTab: 'Open in new tab',
        openToTheRight: 'Open to the right',
        openInNewWindow: 'Open in new window',
        openInDefaultApp: 'Open in default app'
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: 'Image URL copied to clipboard',
        imageCopied: 'Image copied to clipboard',
        filePathCopied: 'File path copied to clipboard',
        customSizeRemoved: 'Removed custom size from image',
        imageRenamed: 'Image renamed successfully',
        imageAndLinksDeleted: 'Image and links deleted successfully',
        imageDeleted: 'Image deleted successfully',

        // Error messages
        couldNotReadDimensions: 'Could not read image dimensions',
        couldNotDetermineSvgDimensions: 'Could not determine SVG dimensions (missing width/height/viewBox)',
        couldNotDetermineImageDimensions: 'Could not determine image dimensions',
        cannotCopyPath: 'Cannot copy path - not using file system adapter',
        couldNotLocateImage: 'Could not locate image file',
        failedToRename: 'Failed to rename image',
        failedToDelete: 'Failed to delete image and links',
        clickInEditorFirst: 'Please click in the editor first, then try copying again',
        failedToResize: 'Failed to resize image',
        failedToPerformAction: 'Failed to {action}',
        imageTooLargeToCopy: 'Image is too large to copy to clipboard',
        fetchingLocalNetworkImage: 'Fetching image from a local network address',
        failedToFetchExternalImage: 'Failed to fetch external image (HTTP {status})',
        externalImageNotImage: 'The URL did not return an image',
        externalImageFetchTimedOut: 'Timed out fetching external image',

        // Generic failure messages
        failedToCopyUrl: 'Failed to copy image URL',
        failedToCopyImage: 'Failed to copy image to clipboard',
        failedToCopyPath: 'Failed to copy file path',
        failedToResizeTo: 'Failed to resize image to {size}',
        failedToRemoveSize: 'Failed to remove custom size from image',
        failedToOpenExplorer: 'Failed to open system explorer',
        failedToRenameImage: 'Failed to rename image',
        failedToDeleteImage: 'Failed to delete image',
        failedToOpenInNewTab: 'Failed to open image in new tab',
        failedToOpenToTheRight: 'Failed to open image to the right',
        failedToOpenInNewWindow: 'Failed to open image in new window',
        failedToOpenInDefaultApp: 'Failed to open in default app'
    },

    // Settings
    settings: {
        headings: {
            mousewheelZoom: 'Mousewheel zoom',
            advanced: 'Advanced'
        },

        items: {
            whatsNew: {
                name: "What's new in Pixel Perfect Image {version}",
                desc: 'See the latest changes and improvements.',
                buttonText: 'View recent updates'
            },
            contextMenu: {
                name: 'Context menu',
                desc: 'Choose which items are shown and reorder file operations.',
                shownCount: '{shown} of {total} shown',
                fileOperations: 'File operations',
                restoreDefaultOrder: 'Restore default order'
            },
            fileInfo: {
                name: 'File information',
                desc: 'Show filename and dimensions at top of menu'
            },
            resizeOptions: {
                name: 'Resize options',
                desc: 'Set resize options (comma-separated). Use % for percentages (e.g., 25%, 50%) or px for pixels (e.g., 600px, 800px)',
                placeholder: 'e.g., 25%, 50%, 100%, 600px'
            },
            cmdClickBehavior: {
                name: '{cmd} + click behavior',
                desc: 'Choose what happens when you {cmd} + click an image',
                options: {
                    doNothing: 'Do nothing',
                    openInNewTab: 'Open in new tab',
                    openInDefaultApp: 'Open in default app'
                }
            },
            enableWheelZoom: {
                name: 'Enable mousewheel zoom',
                desc: 'Hold modifier key and scroll to resize images'
            },
            modifierKey: {
                name: 'Modifier key',
                desc: 'Key to hold while scrolling to zoom images',
                options: {
                    alt: 'Alt',
                    option: 'Option',
                    ctrl: 'Ctrl',
                    shift: 'Shift'
                }
            },
            zoomStepSize: {
                name: 'Zoom step size',
                desc: 'Percentage to zoom per scroll step',
                resetToDefault: 'Reset to default'
            },
            invertScroll: {
                name: 'Invert scroll direction',
                desc: 'Invert the zoom direction when scrolling'
            },
            confirmDelete: {
                name: 'Confirm before delete',
                desc: 'Show confirmation dialog before deleting files'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: 'Rename image',
            renameButton: 'Rename',
            cancelButton: 'Cancel'
        },
        delete: {
            title: 'Delete image',
            confirmMessage: 'Are you sure you want to delete "{filename}"?',
            warningMessage: 'This will delete both the image file and all links to it in the current document.',
            deleteButton: 'Delete',
            cancelButton: 'Cancel'
        }
    },

    whatsNew: {
        title: "What's new in Pixel Perfect Image",
        categories: {
            new: 'New',
            improved: 'Improved',
            changed: 'Changed',
            fixed: 'Fixed'
        },
        supportMessage: 'If Pixel Perfect Image is useful, please consider supporting its continued development.',
        supportButton: 'Buy me a coffee',
        thanksButton: 'Thanks!'
    },

    // Actions (for error messages)
    actions: {
        performAction: 'perform action',
        openInNewTab: 'open image in new tab',
        openToTheRight: 'open image to the right',
        openInNewWindow: 'open image in new window',
        openInDefaultApp: 'open image in default app'
    }
};
