/**
 * Chinese language strings for Pixel Perfect Image
 */
export const STRINGS_ZH = {
    // Context menu items
    menu: {
        remoteImage: '远程图像',
        copyImageUrl: '复制图像URL',
        copyImage: '复制图像',
        copyLocalPath: '复制本地路径',
        resizeTo: '调整大小到{size}',
        removeCustomSize: '移除自定义尺寸',
        showInFinder: 'Show in Finder',
        showInExplorer: '在资源管理器中显示',
        renameImage: '重命名图像',
        deleteImageAndLink: '删除图像和链接',
        openInNewTab: '在新标签页中打开',
        openInDefaultApp: '用默认应用打开',
        openInEditor: '在{editor}中打开'
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: '图像URL已复制到剪贴板',
        imageCopied: '图像已复制到剪贴板',
        filePathCopied: '文件路径已复制到剪贴板',
        customSizeRemoved: '已从图像中移除自定义尺寸',
        imageRenamed: '图像重命名成功',
        imageAndLinksDeleted: '图像和链接删除成功',
        imageDeleted: '图像删除成功',
        
        // Error messages
        couldNotReadDimensions: '无法读取图像尺寸',
        cannotCopyPath: '无法复制路径 - 未使用文件系统适配器',
        couldNotLocateImage: '无法找到图像文件',
        setEditorPath: '请在Pixel Perfect Image设置中设置您的{editor}路径。',
        cannotOpenFile: '无法打开文件：此保管库使用非标准存储系统',
        couldNotOpenInEditor: '无法在{editor}中打开文件。',
        failedToRename: '重命名图像失败',
        failedToDelete: '删除图像和链接失败',
        clickInEditorFirst: '请先点击编辑器，然后再次尝试复制',
        failedToResize: '调整图像大小失败',
        failedToPerformAction: '{action}失败',
        
        // Generic failure messages
        failedToCopyUrl: '复制图像URL失败',
        failedToCopyImage: '复制图像到剪贴板失败',
        failedToCopyPath: '复制文件路径失败',
        failedToResizeTo: '将图像调整到{size}失败',
        failedToRemoveSize: '从图像中移除自定义尺寸失败',
        failedToOpenExplorer: '打开系统资源管理器失败',
        failedToRenameImage: '重命名图像失败',
        failedToDeleteImage: '删除图像失败',
        failedToOpenInNewTab: '在新标签页中打开图像失败',
        failedToOpenInDefaultApp: '用默认应用打开失败',
        failedToOpenInEditor: '在{editor}中打开图像失败'
    },

    // Settings
    settings: {
        headings: {
            menuOptions: '切换单个菜单选项',
            mousewheelZoom: '鼠标滚轮缩放',
            externalEditor: '外部编辑器',
            advanced: '高级'
        },
        
        items: {
            fileInfo: {
                name: '文件信息',
                desc: '在菜单顶部显示文件名和尺寸'
            },
            showInExplorer: {
                name: 'Show in Finder/资源管理器',
                desc: '显示在系统文件资源管理器中显示图像的选项'
            },
            renameImage: {
                name: '重命名图像',
                desc: '显示重命名图像文件的选项'
            },
            deleteImage: {
                name: '删除图像和链接',
                desc: '显示删除图像文件和链接的选项'
            },
            openInNewTab: {
                name: '在新标签页中打开',
                desc: '显示在新标签页中打开图像的选项'
            },
            openInDefaultApp: {
                name: '用默认应用打开',
                desc: '显示用默认应用打开图像的选项'
            },
            resizeOptions: {
                name: '调整大小选项',
                desc: '设置调整大小选项（用逗号分隔）。使用%表示百分比（例如：25%、50%）或px表示像素（例如：600px、800px）',
                placeholder: '例如：25%、50%、100%、600px'
            },
            cmdClickBehavior: {
                name: '{cmd} + 点击行为',
                desc: '选择{cmd} + 点击图像时的行为',
                options: {
                    doNothing: '什么都不做',
                    openInNewTab: '在新标签页中打开',
                    openInDefaultApp: '用默认应用打开',
                    openInEditor: '在{editor}中打开'
                }
            },
            enableWheelZoom: {
                name: '启用鼠标滚轮缩放',
                desc: '按住修饰键并滚动以调整图像大小'
            },
            modifierKey: {
                name: '修饰键',
                desc: '滚动缩放图像时需要按住的键',
                options: {
                    alt: 'Alt',
                    option: 'Option',
                    ctrl: 'Ctrl',
                    shift: 'Shift'
                }
            },
            zoomStepSize: {
                name: '缩放步长',
                desc: '每次滚动步长的缩放百分比',
                resetToDefault: '重置为默认值'
            },
            invertScroll: {
                name: '反转滚动方向',
                desc: '反转滚动时的缩放方向'
            },
            externalEditorName: {
                name: '外部编辑器名称',
                desc: '您的外部编辑器名称（例如：Photoshop）',
                placeholder: 'Photoshop'
            },
            externalEditorPathMac: {
                name: '外部编辑器路径（macOS）',
                desc: 'macOS上外部编辑器应用程序的完整路径',
                placeholder: '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app'
            },
            externalEditorPathWin: {
                name: '外部编辑器路径（Windows）',
                desc: 'Windows上外部编辑器应用程序的完整路径',
                placeholder: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
            },
            confirmDelete: {
                name: '删除前确认',
                desc: '删除文件前显示确认对话框'
            },
            debugMode: {
                name: '调试模式',
                desc: '在控制台中启用调试日志'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: '重命名图像',
            renameButton: '重命名',
            cancelButton: '取消'
        },
        delete: {
            title: '删除图像',
            confirmMessage: '您确定要删除"{filename}"吗？',
            warningMessage: '这将删除图像文件以及当前文档中所有指向它的链接。',
            deleteButton: '删除',
            cancelButton: '取消'
        }
    },

    // Actions (for error messages)
    actions: {
        performAction: '执行操作',
        openInNewTab: '在新标签页中打开图像',
        openInDefaultApp: '用默认应用打开图像',
        openInEditor: '在{editor}中打开图像'
    }
};