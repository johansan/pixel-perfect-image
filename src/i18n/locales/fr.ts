/**
 * French language strings for Pixel Perfect Image
 */
export const STRINGS_FR = {
    // Context menu items
    menu: {
        remoteImage: 'Image distante',
        copyImageUrl: "Copier l'URL de l'image",
        copyImage: "Copier l'image",
        copyLocalPath: 'Copier le chemin local',
        resizeTo: 'Redimensionner à {size}',
        removeCustomSize: 'Supprimer la taille personnalisée',
        showInFinder: 'Show in Finder',
        showInExplorer: "Afficher dans l'Explorateur",
        renameImage: "Renommer l'image",
        deleteImageAndLink: "Supprimer l'image et le lien",
        openInNewTab: 'Ouvrir dans un nouvel onglet',
        openToTheRight: 'Ouvrir à droite',
        openInNewWindow: 'Ouvrir dans une nouvelle fenêtre',
        openInDefaultApp: "Ouvrir avec l'application par défaut"
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: "URL de l'image copiée dans le presse-papiers",
        imageCopied: 'Image copiée dans le presse-papiers',
        filePathCopied: 'Chemin du fichier copié dans le presse-papiers',
        customSizeRemoved: "Taille personnalisée supprimée de l'image",
        imageRenamed: 'Image renommée avec succès',
        imageAndLinksDeleted: 'Image et liens supprimés avec succès',
        imageDeleted: 'Image supprimée avec succès',

        // Error messages
        couldNotReadDimensions: "Impossible de lire les dimensions de l'image",
        couldNotDetermineSvgDimensions: 'Impossible de déterminer les dimensions du SVG (width/height/viewBox manquants)',
        couldNotDetermineImageDimensions: "Impossible de déterminer les dimensions de l'image",
        cannotCopyPath: "Impossible de copier le chemin - n'utilise pas l'adaptateur du système de fichiers",
        couldNotLocateImage: 'Impossible de localiser le fichier image',
        failedToRename: "Échec du renommage de l'image",
        failedToDelete: "Échec de la suppression de l'image et des liens",
        clickInEditorFirst: "Veuillez d'abord cliquer dans l'éditeur, puis réessayer de copier",
        failedToResize: "Échec du redimensionnement de l'image",
        failedToPerformAction: 'Échec de {action}',
        imageTooLargeToCopy: "L'image est trop grande pour être copiée dans le presse-papiers",
        fetchingLocalNetworkImage: "Récupération de l'image depuis une adresse de réseau local",
        failedToFetchExternalImage: "Échec de la récupération de l'image externe (HTTP {status})",
        externalImageNotImage: "L'URL n'a pas renvoyé une image",
        externalImageFetchTimedOut: "Délai dépassé lors de la récupération de l'image externe",

        // Generic failure messages
        failedToCopyUrl: "Échec de la copie de l'URL de l'image",
        failedToCopyImage: "Échec de la copie de l'image dans le presse-papiers",
        failedToCopyPath: 'Échec de la copie du chemin du fichier',
        failedToResizeTo: "Échec du redimensionnement de l'image à {size}",
        failedToRemoveSize: "Échec de la suppression de la taille personnalisée de l'image",
        failedToOpenExplorer: "Échec de l'ouverture de l'explorateur système",
        failedToRenameImage: "Échec du renommage de l'image",
        failedToDeleteImage: "Échec de la suppression de l'image",
        failedToOpenInNewTab: "Échec de l'ouverture de l'image dans un nouvel onglet",
        failedToOpenToTheRight: "Échec de l'ouverture de l'image à droite",
        failedToOpenInNewWindow: "Échec de l'ouverture de l'image dans une nouvelle fenêtre",
        failedToOpenInDefaultApp: "Échec de l'ouverture avec l'application par défaut"
    },

    // Settings
    settings: {
        headings: {
            mousewheelZoom: 'Zoom avec la molette',
            advanced: 'Avancé'
        },

        items: {
            whatsNew: {
                name: 'Quoi de neuf dans Pixel Perfect Image {version}',
                desc: 'Consultez les derniers changements et améliorations.',
                buttonText: 'Voir les mises à jour récentes'
            },
            contextMenu: {
                name: 'Menu contextuel',
                desc: 'Choisissez les éléments à afficher et réorganisez les opérations sur les fichiers.',
                shownCount: '{shown} sur {total} affichés',
                fileOperations: 'Opérations sur les fichiers',
                restoreDefaultOrder: 'Rétablir l’ordre par défaut'
            },
            fileInfo: {
                name: 'Informations du fichier',
                desc: 'Afficher le nom du fichier et les dimensions en haut du menu'
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
                    openInDefaultApp: "Ouvrir avec l'application par défaut"
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
            confirmDelete: {
                name: 'Confirmer avant suppression',
                desc: 'Afficher la boîte de dialogue de confirmation avant de supprimer les fichiers'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: "Renommer l'image",
            renameButton: 'Renommer',
            cancelButton: 'Annuler'
        },
        delete: {
            title: "Supprimer l'image",
            confirmMessage: 'Êtes-vous sûr de vouloir supprimer "{filename}" ?',
            warningMessage: 'Cela supprimera à la fois le fichier image et tous les liens vers celui-ci dans le document actuel.',
            deleteButton: 'Supprimer',
            cancelButton: 'Annuler'
        }
    },

    whatsNew: {
        title: 'Quoi de neuf dans Pixel Perfect Image',
        categories: {
            new: 'Nouveau',
            improved: 'Amélioré',
            changed: 'Modifié',
            fixed: 'Corrigé'
        },
        supportMessage: 'Si Pixel Perfect Image vous est utile, envisagez de soutenir son développement.',
        supportButton: "M'offrir un café",
        thanksButton: 'Merci !'
    },

    // Actions (for error messages)
    actions: {
        performAction: "effectuer l'action",
        openInNewTab: "ouvrir l'image dans un nouvel onglet",
        openToTheRight: "ouvrir l'image à droite",
        openInNewWindow: "ouvrir l'image dans une nouvelle fenêtre",
        openInDefaultApp: "ouvrir l'image avec l'application par défaut"
    }
};
