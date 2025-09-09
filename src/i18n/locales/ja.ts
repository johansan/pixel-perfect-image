/**
 * Japanese language strings for Pixel Perfect Image
 */
export const STRINGS_JA = {
    // Context menu items
    menu: {
        remoteImage: 'リモート画像',
        copyImageUrl: '画像URLをコピー',
        copyImage: '画像をコピー',
        copyLocalPath: 'ローカルパスをコピー',
        resizeTo: '{size}にリサイズ',
        removeCustomSize: 'カスタムサイズを削除',
        showInFinder: 'Show in Finder',
        showInExplorer: 'エクスプローラーで表示',
        renameImage: '画像名を変更',
        deleteImageAndLink: '画像とリンクを削除',
        openInNewTab: '新しいタブで開く',
        openInDefaultApp: 'デフォルトアプリで開く',
        openInEditor: '{editor}で開く'
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: '画像URLをクリップボードにコピーしました',
        imageCopied: '画像をクリップボードにコピーしました',
        filePathCopied: 'ファイルパスをクリップボードにコピーしました',
        customSizeRemoved: '画像からカスタムサイズを削除しました',
        imageRenamed: '画像名を正常に変更しました',
        imageAndLinksDeleted: '画像とリンクを正常に削除しました',
        imageDeleted: '画像を正常に削除しました',
        
        // Error messages
        couldNotReadDimensions: '画像の寸法を読み取れませんでした',
        cannotCopyPath: 'パスをコピーできません - ファイルシステムアダプターを使用していません',
        couldNotLocateImage: '画像ファイルが見つかりませんでした',
        setEditorPath: 'Pixel Perfect Image設定で{editor}のパスを設定してください。',
        cannotOpenFile: 'ファイルを開けません：このVaultは標準以外のストレージシステムを使用しています',
        couldNotOpenInEditor: '{editor}でファイルを開けませんでした。',
        failedToRename: '画像名の変更に失敗しました',
        failedToDelete: '画像とリンクの削除に失敗しました',
        clickInEditorFirst: '最初にエディターをクリックしてから、もう一度コピーしてください',
        failedToResize: '画像のリサイズに失敗しました',
        failedToPerformAction: '{action}に失敗しました',
        
        // Generic failure messages
        failedToCopyUrl: '画像URLのコピーに失敗しました',
        failedToCopyImage: '画像のクリップボードへのコピーに失敗しました',
        failedToCopyPath: 'ファイルパスのコピーに失敗しました',
        failedToResizeTo: '画像の{size}へのリサイズに失敗しました',
        failedToRemoveSize: '画像からカスタムサイズの削除に失敗しました',
        failedToOpenExplorer: 'システムエクスプローラーの起動に失敗しました',
        failedToRenameImage: '画像名の変更に失敗しました',
        failedToDeleteImage: '画像の削除に失敗しました',
        failedToOpenInNewTab: '新しいタブで画像を開くのに失敗しました',
        failedToOpenInDefaultApp: 'デフォルトアプリで開くのに失敗しました',
        failedToOpenInEditor: '{editor}で画像を開くのに失敗しました'
    },

    // Settings
    settings: {
        headings: {
            menuOptions: '個別メニューオプションの切り替え',
            mousewheelZoom: 'マウスホイールズーム',
            externalEditor: '外部エディター',
            advanced: '高度な設定'
        },
        
        items: {
            fileInfo: {
                name: 'ファイル情報',
                desc: 'メニューの上部にファイル名とサイズを表示します'
            },
            showInExplorer: {
                name: 'Show in Finder/エクスプローラー',
                desc: 'システムファイルエクスプローラーで画像を表示するオプションを表示します'
            },
            renameImage: {
                name: '画像名を変更',
                desc: '画像ファイル名を変更するオプションを表示します'
            },
            deleteImage: {
                name: '画像とリンクを削除',
                desc: '画像ファイルとリンクの両方を削除するオプションを表示します'
            },
            openInNewTab: {
                name: '新しいタブで開く',
                desc: '画像を新しいタブで開くオプションを表示します'
            },
            openInDefaultApp: {
                name: 'デフォルトアプリで開く',
                desc: '画像をデフォルトアプリで開くオプションを表示します'
            },
            resizeOptions: {
                name: 'リサイズオプション',
                desc: 'リサイズオプションを設定します（カンマ区切り）。パーセンテージには%を使用し（例：25%、50%）、ピクセルにはpxを使用します（例：600px、800px）',
                placeholder: '例：25%、50%、100%、600px'
            },
            cmdClickBehavior: {
                name: '{cmd} + クリックの動作',
                desc: '画像を{cmd} + クリックしたときの動作を選択します',
                options: {
                    doNothing: '何もしない',
                    openInNewTab: '新しいタブで開く',
                    openInDefaultApp: 'デフォルトアプリで開く',
                    openInEditor: '{editor}で開く'
                }
            },
            enableWheelZoom: {
                name: 'マウスホイールズームを有効にする',
                desc: '修飾キーを押しながらスクロールして画像をリサイズします'
            },
            modifierKey: {
                name: '修飾キー',
                desc: '画像をズームするためにスクロール時に押す必要があるキー',
                options: {
                    alt: 'Alt',
                    option: 'Option',
                    ctrl: 'Ctrl',
                    shift: 'Shift'
                }
            },
            zoomStepSize: {
                name: 'ズームステップサイズ',
                desc: 'スクロールステップごとのズーム率',
                resetToDefault: 'デフォルトにリセット'
            },
            invertScroll: {
                name: 'スクロール方向を反転',
                desc: 'スクロール時のズーム方向を反転します'
            },
            externalEditorName: {
                name: '外部エディター名',
                desc: '外部エディターの名前（例：Photoshop）',
                placeholder: 'Photoshop'
            },
            externalEditorPathMac: {
                name: '外部エディターパス（macOS）',
                desc: 'macOS上の外部エディターアプリケーションへのフルパス',
                placeholder: '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app'
            },
            externalEditorPathWin: {
                name: '外部エディターパス（Windows）',
                desc: 'Windows上の外部エディターアプリケーションへのフルパス',
                placeholder: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
            },
            externalEditorPathLinux: {
                name: '外部エディターのパス（Linux）',
                desc: 'Linux の外部エディターアプリのフルパス',
                placeholder: '/usr/bin/gimp'
            },
            confirmDelete: {
                name: '削除前に確認',
                desc: 'ファイル削除前に確認ダイアログを表示します'
            },
            debugMode: {
                name: 'デバッグモード',
                desc: 'コンソールにデバッグログを出力します'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: '画像名を変更',
            renameButton: '変更',
            cancelButton: 'キャンセル'
        },
        delete: {
            title: '画像を削除',
            confirmMessage: '"{filename}"を削除してもよろしいですか？',
            warningMessage: 'これにより、画像ファイルと現在のドキュメント内のすべてのリンクが削除されます。',
            deleteButton: '削除',
            cancelButton: 'キャンセル'
        }
    },

    // Actions (for error messages)
    actions: {
        performAction: 'アクションを実行',
        openInNewTab: '新しいタブで画像を開く',
        openInDefaultApp: 'デフォルトアプリで画像を開く',
        openInEditor: '{editor}で画像を開く'
    }
};