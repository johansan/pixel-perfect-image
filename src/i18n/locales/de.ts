/**
 * German language strings for Pixel Perfect Image
 */
export const STRINGS_DE = {
    // Context menu items
    menu: {
        remoteImage: 'Remote-Bild',
        copyImageUrl: 'Bild-URL kopieren',
        copyImage: 'Bild kopieren',
        copyLocalPath: 'Lokalen Pfad kopieren',
        resizeTo: 'Größe ändern auf {size}',
        removeCustomSize: 'Benutzerdefinierte Größe entfernen',
        showInFinder: 'Show in Finder',
        showInExplorer: 'Im Explorer anzeigen',
        renameImage: 'Bild umbenennen',
        deleteImageAndLink: 'Bild und Link löschen',
        openInNewTab: 'In neuem Tab öffnen',
        openToTheRight: 'Nach rechts öffnen',
        openInNewWindow: 'In neuem Fenster öffnen',
        openInDefaultApp: 'In Standard-App öffnen',
        openInEditor: 'In {editor} öffnen'
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: 'Bild-URL in Zwischenablage kopiert',
        imageCopied: 'Bild in Zwischenablage kopiert',
        filePathCopied: 'Dateipfad in Zwischenablage kopiert',
        customSizeRemoved: 'Benutzerdefinierte Größe vom Bild entfernt',
        imageRenamed: 'Bild erfolgreich umbenannt',
        imageAndLinksDeleted: 'Bild und Links erfolgreich gelöscht',
        imageDeleted: 'Bild erfolgreich gelöscht',
        
        // Error messages
        couldNotReadDimensions: 'Bildabmessungen konnten nicht gelesen werden',
        couldNotDetermineSvgDimensions: 'SVG-Abmessungen konnten nicht bestimmt werden (width/height/viewBox fehlen)',
        couldNotDetermineImageDimensions: 'Bildabmessungen konnten nicht bestimmt werden',
        cannotCopyPath: 'Pfad kann nicht kopiert werden - kein Dateisystem-Adapter',
        couldNotLocateImage: 'Bilddatei konnte nicht gefunden werden',
        setEditorPath: 'Bitte legen Sie den {editor}-Pfad in den Pixel Perfect Image Einstellungen fest.',
        cannotOpenFile: 'Datei kann nicht geöffnet werden: Dieser Vault verwendet ein nicht-standardmäßiges Speichersystem',
        couldNotOpenInEditor: 'Datei konnte nicht in {editor} geöffnet werden.',
        failedToRename: 'Umbenennen des Bildes fehlgeschlagen',
        failedToDelete: 'Löschen von Bild und Links fehlgeschlagen',
        clickInEditorFirst: 'Bitte klicken Sie zuerst in den Editor und versuchen Sie dann erneut zu kopieren',
        failedToResize: 'Größenänderung des Bildes fehlgeschlagen',
        failedToPerformAction: '{action} fehlgeschlagen',
        
        // Generic failure messages
        failedToCopyUrl: 'Kopieren der Bild-URL fehlgeschlagen',
        failedToCopyImage: 'Kopieren des Bildes in Zwischenablage fehlgeschlagen',
        failedToCopyPath: 'Kopieren des Dateipfads fehlgeschlagen',
        failedToResizeTo: 'Größenänderung auf {size} fehlgeschlagen',
        failedToRemoveSize: 'Entfernen der benutzerdefinierten Größe fehlgeschlagen',
        failedToOpenExplorer: 'Öffnen des System-Explorers fehlgeschlagen',
        failedToRenameImage: 'Umbenennen des Bildes fehlgeschlagen',
        failedToDeleteImage: 'Löschen des Bildes fehlgeschlagen',
        failedToOpenInNewTab: 'Öffnen des Bildes in neuem Tab fehlgeschlagen',
        failedToOpenToTheRight: 'Öffnen des Bildes nach rechts fehlgeschlagen',
        failedToOpenInNewWindow: 'Öffnen des Bildes in neuem Fenster fehlgeschlagen',
        failedToOpenInDefaultApp: 'Öffnen in Standard-App fehlgeschlagen',
        failedToOpenInEditor: 'Öffnen des Bildes in {editor} fehlgeschlagen'
    },

    // Settings
    settings: {
        headings: {
            menuOptions: 'Einzelne Menüoptionen umschalten',
            mousewheelZoom: 'Mausrad-Zoom',
            externalEditor: 'Externer Editor',
            advanced: 'Erweitert'
        },
        
        items: {
            fileInfo: {
                name: 'Dateiinformationen',
                desc: 'Dateiname und Abmessungen oben im Menü anzeigen'
            },
            showInExplorer: {
                name: 'Show in Finder/Explorer',
                desc: 'Option zum Anzeigen des Bildes im System-Dateiexplorer anzeigen'
            },
            renameImage: {
                name: 'Bild umbenennen',
                desc: 'Option zum Umbenennen der Bilddatei anzeigen'
            },
            deleteImage: {
                name: 'Bild und Link löschen',
                desc: 'Option zum Löschen von Bilddatei und Link anzeigen'
            },
            openInNewTab: {
                name: 'In neuem Tab öffnen',
                desc: 'Option zum Öffnen des Bildes in neuem Tab anzeigen'
            },
            openToTheRight: {
                name: 'Nach rechts öffnen',
                desc: 'Option zum Öffnen des Bildes in einem rechten Split anzeigen'
            },
            openInNewWindow: {
                name: 'In neuem Fenster öffnen',
                desc: 'Option zum Öffnen des Bildes in einem neuen Anwendungsfenster anzeigen'
            },
            openInDefaultApp: {
                name: 'In Standard-App öffnen',
                desc: 'Option zum Öffnen des Bildes in Standard-App anzeigen'
            },
            resizeOptions: {
                name: 'Größenoptionen',
                desc: 'Größenoptionen festlegen (kommagetrennt). Verwenden Sie % für Prozent (z.B. 25%, 50%) oder px für Pixel (z.B. 600px, 800px)',
                placeholder: 'z.B. 25%, 50%, 100%, 600px'
            },
            cmdClickBehavior: {
                name: '{cmd} + Klick Verhalten',
                desc: 'Wählen Sie, was passiert, wenn Sie {cmd} + Klick auf ein Bild ausführen',
                options: {
                    doNothing: 'Nichts tun',
                    openInNewTab: 'In neuem Tab öffnen',
                    openInDefaultApp: 'In Standard-App öffnen',
                    openInEditor: 'In {editor} öffnen'
                }
            },
            enableWheelZoom: {
                name: 'Mausrad-Zoom aktivieren',
                desc: 'Modifikationstaste halten und scrollen zum Ändern der Bildgröße'
            },
            modifierKey: {
                name: 'Modifikationstaste',
                desc: 'Taste, die beim Scrollen zum Zoomen gehalten werden muss',
                options: {
                    alt: 'Alt',
                    option: 'Option',
                    ctrl: 'Strg',
                    shift: 'Umschalt'
                }
            },
            zoomStepSize: {
                name: 'Zoom-Schrittgröße',
                desc: 'Prozentsatz zum Zoomen pro Scroll-Schritt',
                resetToDefault: 'Auf Standard zurücksetzen'
            },
            invertScroll: {
                name: 'Scroll-Richtung umkehren',
                desc: 'Zoom-Richtung beim Scrollen umkehren'
            },
            externalEditorName: {
                name: 'Name des externen Editors',
                desc: 'Name Ihres externen Editors (z.B. Photoshop)',
                placeholder: 'Photoshop'
            },
            externalEditorPathMac: {
                name: 'Pfad zum externen Editor (macOS)',
                desc: 'Vollständiger Pfad zu Ihrer externen Editor-Anwendung auf macOS',
                placeholder: '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app'
            },
            externalEditorPathWin: {
                name: 'Pfad zum externen Editor (Windows)',
                desc: 'Vollständiger Pfad zu Ihrer externen Editor-Anwendung auf Windows',
                placeholder: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
            },
            externalEditorPathLinux: {
                name: 'Pfad zum externen Editor (Linux)',
                desc: 'Vollständiger Pfad zu Ihrer externen Editor-Anwendung unter Linux',
                placeholder: '/usr/bin/gimp'
            },
            confirmDelete: {
                name: 'Vor dem Löschen bestätigen',
                desc: 'Bestätigungsdialog vor dem Löschen von Dateien anzeigen'
            },
            debugMode: {
                name: 'Debug-Modus',
                desc: 'Debug-Protokollierung in Konsole aktivieren'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: 'Bild umbenennen',
            renameButton: 'Umbenennen',
            cancelButton: 'Abbrechen'
        },
        delete: {
            title: 'Bild löschen',
            confirmMessage: 'Möchten Sie "{filename}" wirklich löschen?',
            warningMessage: 'Dies löscht sowohl die Bilddatei als auch alle Links dazu im aktuellen Dokument.',
            deleteButton: 'Löschen',
            cancelButton: 'Abbrechen'
        }
    },

    // Actions (for error messages)
    actions: {
        performAction: 'Aktion ausführen',
        openInNewTab: 'Bild in neuem Tab öffnen',
        openToTheRight: 'Bild nach rechts öffnen',
        openInNewWindow: 'Bild in neuem Fenster öffnen',
        openInDefaultApp: 'Bild in Standard-App öffnen',
        openInEditor: 'Bild in {editor} öffnen'
    }
};
