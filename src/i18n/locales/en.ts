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
        openInDefaultApp: 'Open in default app',
        openInEditor: 'Open in {editor}'
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
        setEditorPath: 'Please set your {editor} path in Pixel Perfect Image settings.',
        cannotOpenFile: 'Cannot open file: This vault uses a non-standard storage system',
        couldNotOpenInEditor: 'Could not open file in {editor}.',
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
        failedToOpenInDefaultApp: 'Failed to open in default app',
        failedToOpenInEditor: 'Failed to open image in {editor}'
    },

    // Settings
    settings: {
        headings: {
            menuOptions: 'Toggle individual menu options',
            mousewheelZoom: 'Mousewheel zoom',
            externalEditor: 'External editor',
            advanced: 'Advanced'
        },
        
        items: {
            whatsNew: {
                name: "What's new in Pixel Perfect Image {version}",
                desc: 'See the latest changes and improvements.',
                buttonText: 'View recent updates'
            },
            fileInfo: {
                name: 'File information',
                desc: 'Show filename and dimensions at top of menu'
            },
            showInExplorer: {
                name: 'Show in Finder/Explorer',
                desc: 'Show option to reveal image in system file explorer'
            },
            renameImage: {
                name: 'Rename image',
                desc: 'Show option to rename image file'
            },
            deleteImage: {
                name: 'Delete image and link',
                desc: 'Show option to delete both image file and link'
            },
            openInNewTab: {
                name: 'Open in new tab',
                desc: 'Show option to open image in new tab'
            },
            openToTheRight: {
                name: 'Open to the right',
                desc: 'Show option to open image in a right split'
            },
            openInNewWindow: {
                name: 'Open in new window',
                desc: 'Show option to open image in a new app window'
            },
            openInDefaultApp: {
                name: 'Open in default app',
                desc: 'Show option to open image in default app'
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
                    openInDefaultApp: 'Open in default app',
                    openInEditor: 'Open in {editor}'
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
            externalEditorName: {
                name: 'External editor name',
                desc: 'Name of your external editor (e.g., Photoshop)',
                placeholder: 'Photoshop'
            },
            externalEditorPathMac: {
                name: 'External editor path (macOS)',
                desc: 'Full path to your external editor application on macOS',
                placeholder: '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app'
            },
            externalEditorPathWin: {
                name: 'External editor path (Windows)',
                desc: 'Full path to your external editor application on Windows',
                placeholder: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
            },
            externalEditorPathLinux: {
                name: 'External editor path (Linux)',
                desc: 'Full path to your external editor application on Linux',
                placeholder: '/usr/bin/gimp'
            },
            confirmDelete: {
                name: 'Confirm before delete',
                desc: 'Show confirmation dialog before deleting files'
            },
            debugMode: {
                name: 'Debug mode',
                desc: 'Enable debug logging to console'
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
        openInDefaultApp: 'open image in default app',
        openInEditor: 'open image in {editor}'
    }
};
