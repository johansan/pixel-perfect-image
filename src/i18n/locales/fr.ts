/**
 * French language strings for Pixel Perfect Image
 */
export const STRINGS_FR = {
    // Context menu items
    menu: {
        remoteImage: 'Image distante',
        copyImageUrl: 'Copier l\'URL de l\'image',
        copyImage: 'Copier l\'image',
        copyLocalPath: 'Copier le chemin local',
        resizeTo: 'Redimensionner à {size}',
        removeCustomSize: 'Supprimer la taille personnalisée',
        showInFinder: 'Show in Finder',
        showInExplorer: 'Afficher dans l\'Explorateur',
        renameImage: 'Renommer l\'image',
        deleteImageAndLink: 'Supprimer l\'image et le lien',
        openInNewTab: 'Ouvrir dans un nouvel onglet',
        openInDefaultApp: 'Ouvrir avec l\'application par défaut',
        openInEditor: 'Ouvrir dans {editor}'
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: 'URL de l\'image copiée dans le presse-papiers',
        imageCopied: 'Image copiée dans le presse-papiers',
        filePathCopied: 'Chemin du fichier copié dans le presse-papiers',
        customSizeRemoved: 'Taille personnalisée supprimée de l\'image',
        imageRenamed: 'Image renommée avec succès',
        imageAndLinksDeleted: 'Image et liens supprimés avec succès',
        imageDeleted: 'Image supprimée avec succès',
        
        // Error messages
        couldNotReadDimensions: 'Impossible de lire les dimensions de l\'image',
        cannotCopyPath: 'Impossible de copier le chemin - n\'utilise pas l\'adaptateur du système de fichiers',
        couldNotLocateImage: 'Impossible de localiser le fichier image',
        setEditorPath: 'Veuillez définir le chemin de {editor} dans les paramètres de Pixel Perfect Image.',
        cannotOpenFile: 'Impossible d\'ouvrir le fichier : Ce coffre utilise un système de stockage non standard',
        couldNotOpenInEditor: 'Impossible d\'ouvrir le fichier dans {editor}.',
        failedToRename: 'Échec du renommage de l\'image',
        failedToDelete: 'Échec de la suppression de l\'image et des liens',
        clickInEditorFirst: 'Veuillez d\'abord cliquer dans l\'éditeur, puis réessayer de copier',
        failedToResize: 'Échec du redimensionnement de l\'image',
        failedToPerformAction: 'Échec de {action}',
        
        // Generic failure messages
        failedToCopyUrl: 'Échec de la copie de l\'URL de l\'image',
        failedToCopyImage: 'Échec de la copie de l\'image dans le presse-papiers',
        failedToCopyPath: 'Échec de la copie du chemin du fichier',
        failedToResizeTo: 'Échec du redimensionnement de l\'image à {size}',
        failedToRemoveSize: 'Échec de la suppression de la taille personnalisée de l\'image',
        failedToOpenExplorer: 'Échec de l\'ouverture de l\'explorateur système',
        failedToRenameImage: 'Échec du renommage de l\'image',
        failedToDeleteImage: 'Échec de la suppression de l\'image',
        failedToOpenInNewTab: 'Échec de l\'ouverture de l\'image dans un nouvel onglet',
        failedToOpenInDefaultApp: 'Échec de l\'ouverture avec l\'application par défaut',
        failedToOpenInEditor: 'Échec de l\'ouverture de l\'image dans {editor}'
    },

    // Settings
    settings: {
        headings: {
            menuOptions: 'Basculer les options individuelles du menu',
            mousewheelZoom: 'Zoom avec la molette',
            externalEditor: 'Éditeur externe',
            advanced: 'Avancé'
        },
        
        items: {
            fileInfo: {
                name: 'Informations du fichier',
                desc: 'Afficher le nom du fichier et les dimensions en haut du menu'
            },
            showInExplorer: {
                name: 'Show in Finder/Explorateur',
                desc: 'Afficher l\'option pour révéler l\'image dans l\'explorateur de fichiers système'
            },
            renameImage: {
                name: 'Renommer l\'image',
                desc: 'Afficher l\'option pour renommer le fichier image'
            },
            deleteImage: {
                name: 'Supprimer l\'image et le lien',
                desc: 'Afficher l\'option pour supprimer à la fois le fichier image et le lien'
            },
            openInNewTab: {
                name: 'Ouvrir dans un nouvel onglet',
                desc: 'Afficher l\'option pour ouvrir l\'image dans un nouvel onglet'
            },
            openInDefaultApp: {
                name: 'Ouvrir avec l\'application par défaut',
                desc: 'Afficher l\'option pour ouvrir l\'image avec l\'application par défaut'
            },
            resizeOptions: {
                name: 'Options de redimensionnement',
                desc: 'Définir les options de redimensionnement (séparées par des virgules). Utiliser % pour les pourcentages (ex., 25%, 50%) ou px pour les pixels (ex., 600px, 800px)',
                placeholder: 'ex., 25%, 50%, 100%, 600px'
            },
            cmdClickBehavior: {
                name: 'Comportement {cmd} + clic',
                desc: 'Choisir ce qui se passe lorsque vous faites {cmd} + clic sur une image',
                options: {
                    doNothing: 'Ne rien faire',
                    openInNewTab: 'Ouvrir dans un nouvel onglet',
                    openInDefaultApp: 'Ouvrir avec l\'application par défaut',
                    openInEditor: 'Ouvrir dans {editor}'
                }
            },
            enableWheelZoom: {
                name: 'Activer le zoom avec la molette',
                desc: 'Maintenez la touche de modification et faites défiler pour redimensionner les images'
            },
            modifierKey: {
                name: 'Touche de modification',
                desc: 'Touche à maintenir enfoncée pendant le défilement pour zoomer sur les images',
                options: {
                    alt: 'Alt',
                    option: 'Option',
                    ctrl: 'Ctrl',
                    shift: 'Shift'
                }
            },
            zoomStepSize: {
                name: 'Taille du pas de zoom',
                desc: 'Pourcentage de zoom par étape de défilement',
                resetToDefault: 'Réinitialiser par défaut'
            },
            invertScroll: {
                name: 'Inverser la direction de défilement',
                desc: 'Inverser la direction du zoom lors du défilement'
            },
            externalEditorName: {
                name: 'Nom de l\'éditeur externe',
                desc: 'Nom de votre éditeur externe (ex., Photoshop)',
                placeholder: 'Photoshop'
            },
            externalEditorPathMac: {
                name: 'Chemin de l\'éditeur externe (macOS)',
                desc: 'Chemin complet vers votre application d\'éditeur externe sur macOS',
                placeholder: '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app'
            },
            externalEditorPathWin: {
                name: 'Chemin de l\'éditeur externe (Windows)',
                desc: 'Chemin complet vers votre application d\'éditeur externe sur Windows',
                placeholder: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
            },
            confirmDelete: {
                name: 'Confirmer avant suppression',
                desc: 'Afficher la boîte de dialogue de confirmation avant de supprimer les fichiers'
            },
            debugMode: {
                name: 'Mode débogage',
                desc: 'Activer l\'enregistrement de débogage dans la console'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: 'Renommer l\'image',
            renameButton: 'Renommer',
            cancelButton: 'Annuler'
        },
        delete: {
            title: 'Supprimer l\'image',
            confirmMessage: 'Êtes-vous sûr de vouloir supprimer "{filename}" ?',
            warningMessage: 'Cela supprimera à la fois le fichier image et tous les liens vers celui-ci dans le document actuel.',
            deleteButton: 'Supprimer',
            cancelButton: 'Annuler'
        }
    },

    // Actions (for error messages)
    actions: {
        performAction: 'effectuer l\'action',
        openInNewTab: 'ouvrir l\'image dans un nouvel onglet',
        openInDefaultApp: 'ouvrir l\'image avec l\'application par défaut',
        openInEditor: 'ouvrir l\'image dans {editor}'
    }
};