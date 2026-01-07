/**
 * Spanish language strings for Pixel Perfect Image
 */
export const STRINGS_ES = {
    // Context menu items
    menu: {
        remoteImage: 'Imagen remota',
        copyImageUrl: 'Copiar URL de imagen',
        copyImage: 'Copiar imagen',
        copyLocalPath: 'Copiar ruta local',
        resizeTo: 'Redimensionar a {size}',
        removeCustomSize: 'Eliminar tamaño personalizado',
        showInFinder: 'Show in Finder',
        showInExplorer: 'Mostrar en Explorador',
        renameImage: 'Renombrar imagen',
        deleteImageAndLink: 'Eliminar imagen y enlace',
        openInNewTab: 'Abrir en nueva pestaña',
        openToTheRight: 'Abrir a la derecha',
        openInNewWindow: 'Abrir en nueva ventana',
        openInDefaultApp: 'Abrir con aplicación predeterminada',
        openInEditor: 'Abrir en {editor}'
    },

    // Notice messages
    notices: {
        // Success messages
        imageUrlCopied: 'URL de imagen copiada al portapapeles',
        imageCopied: 'Imagen copiada al portapapeles',
        filePathCopied: 'Ruta del archivo copiada al portapapeles',
        customSizeRemoved: 'Tamaño personalizado eliminado de la imagen',
        imageRenamed: 'Imagen renombrada exitosamente',
        imageAndLinksDeleted: 'Imagen y enlaces eliminados exitosamente',
        imageDeleted: 'Imagen eliminada exitosamente',
        
        // Error messages
        couldNotReadDimensions: 'No se pudieron leer las dimensiones de la imagen',
        couldNotDetermineSvgDimensions: 'No se pudieron determinar las dimensiones del SVG (faltan width/height/viewBox)',
        couldNotDetermineImageDimensions: 'No se pudieron determinar las dimensiones de la imagen',
        cannotCopyPath: 'No se puede copiar la ruta - no usa adaptador del sistema de archivos',
        couldNotLocateImage: 'No se pudo localizar el archivo de imagen',
        setEditorPath: 'Por favor, configura la ruta de {editor} en la configuración de Pixel Perfect Image.',
        cannotOpenFile: 'No se puede abrir el archivo: Esta bóveda usa un sistema de almacenamiento no estándar',
        couldNotOpenInEditor: 'No se pudo abrir el archivo en {editor}.',
        failedToRename: 'Error al renombrar la imagen',
        failedToDelete: 'Error al eliminar la imagen y enlaces',
        clickInEditorFirst: 'Por favor, haz clic en el editor primero, luego intenta copiar nuevamente',
        failedToResize: 'Error al redimensionar la imagen',
        failedToPerformAction: 'Error al {action}',
        imageTooLargeToCopy: 'La imagen es demasiado grande para copiarla al portapapeles',
        fetchingLocalNetworkImage: 'Obteniendo imagen desde una dirección de red local',
        failedToFetchExternalImage: 'Error al obtener la imagen externa (HTTP {status})',
        externalImageNotImage: 'La URL no devolvió una imagen',
        externalImageFetchTimedOut: 'Tiempo de espera agotado al obtener la imagen externa',

        // Generic failure messages
        failedToCopyUrl: 'Error al copiar URL de imagen',
        failedToCopyImage: 'Error al copiar imagen al portapapeles',
        failedToCopyPath: 'Error al copiar la ruta del archivo',
        failedToResizeTo: 'Error al redimensionar imagen a {size}',
        failedToRemoveSize: 'Error al eliminar tamaño personalizado de la imagen',
        failedToOpenExplorer: 'Error al abrir el explorador del sistema',
        failedToRenameImage: 'Error al renombrar la imagen',
        failedToDeleteImage: 'Error al eliminar la imagen',
        failedToOpenInNewTab: 'Error al abrir imagen en nueva pestaña',
        failedToOpenToTheRight: 'Error al abrir imagen a la derecha',
        failedToOpenInNewWindow: 'Error al abrir imagen en nueva ventana',
        failedToOpenInDefaultApp: 'Error al abrir con aplicación predeterminada',
        failedToOpenInEditor: 'Error al abrir imagen en {editor}'
    },

    // Settings
    settings: {
        headings: {
            menuOptions: 'Alternar opciones individuales del menú',
            mousewheelZoom: 'Zoom con rueda del ratón',
            externalEditor: 'Editor externo',
            advanced: 'Avanzado'
        },
        
        items: {
            whatsNew: {
                name: 'Novedades de Pixel Perfect Image {version}',
                desc: 'Consulta los últimos cambios y mejoras.',
                buttonText: 'Ver actualizaciones recientes'
            },
            fileInfo: {
                name: 'Información del archivo',
                desc: 'Mostrar nombre del archivo y dimensiones en la parte superior del menú'
            },
            showInExplorer: {
                name: 'Show in Finder/Explorador',
                desc: 'Mostrar opción para revelar imagen en el explorador de archivos del sistema'
            },
            renameImage: {
                name: 'Renombrar imagen',
                desc: 'Mostrar opción para renombrar archivo de imagen'
            },
            deleteImage: {
                name: 'Eliminar imagen y enlace',
                desc: 'Mostrar opción para eliminar tanto el archivo de imagen como el enlace'
            },
            openInNewTab: {
                name: 'Abrir en nueva pestaña',
                desc: 'Mostrar opción para abrir imagen en nueva pestaña'
            },
            openToTheRight: {
                name: 'Abrir a la derecha',
                desc: 'Mostrar opción para abrir imagen en una división a la derecha'
            },
            openInNewWindow: {
                name: 'Abrir en nueva ventana',
                desc: 'Mostrar opción para abrir imagen en una nueva ventana de la aplicación'
            },
            openInDefaultApp: {
                name: 'Abrir con aplicación predeterminada',
                desc: 'Mostrar opción para abrir imagen con aplicación predeterminada'
            },
            resizeOptions: {
                name: 'Opciones de redimensionado',
                desc: 'Configurar opciones de redimensionado (separadas por comas). Usa % para porcentajes (ej., 25%, 50%) o px para píxeles (ej., 600px, 800px)',
                placeholder: 'ej., 25%, 50%, 100%, 600px'
            },
            cmdClickBehavior: {
                name: 'Comportamiento de {cmd} + clic',
                desc: 'Elige qué sucede cuando haces {cmd} + clic en una imagen',
                options: {
                    doNothing: 'No hacer nada',
                    openInNewTab: 'Abrir en nueva pestaña',
                    openInDefaultApp: 'Abrir con aplicación predeterminada',
                    openInEditor: 'Abrir en {editor}'
                }
            },
            enableWheelZoom: {
                name: 'Habilitar zoom con rueda del ratón',
                desc: 'Mantén presionada la tecla modificadora y desplázate para redimensionar imágenes'
            },
            modifierKey: {
                name: 'Tecla modificadora',
                desc: 'Tecla a mantener mientras te desplazas para hacer zoom en imágenes',
                options: {
                    alt: 'Alt',
                    option: 'Option',
                    ctrl: 'Ctrl',
                    shift: 'Shift'
                }
            },
            zoomStepSize: {
                name: 'Tamaño del paso de zoom',
                desc: 'Porcentaje a hacer zoom por paso de desplazamiento',
                resetToDefault: 'Restablecer a predeterminado'
            },
            invertScroll: {
                name: 'Invertir dirección de desplazamiento',
                desc: 'Invertir la dirección del zoom al desplazarse'
            },
            externalEditorName: {
                name: 'Nombre del editor externo',
                desc: 'Nombre de tu editor externo (ej., Photoshop)',
                placeholder: 'Photoshop'
            },
            externalEditorPathMac: {
                name: 'Ruta del editor externo (macOS)',
                desc: 'Ruta completa a tu aplicación de editor externo en macOS',
                placeholder: '/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app'
            },
            externalEditorPathWin: {
                name: 'Ruta del editor externo (Windows)',
                desc: 'Ruta completa a tu aplicación de editor externo en Windows',
                placeholder: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
            },
            externalEditorPathLinux: {
                name: 'Ruta del editor externo (Linux)',
                desc: 'Ruta completa a tu aplicación de editor externo en Linux',
                placeholder: '/usr/bin/gimp'
            },
            confirmDelete: {
                name: 'Confirmar antes de eliminar',
                desc: 'Mostrar diálogo de confirmación antes de eliminar archivos'
            },
            debugMode: {
                name: 'Modo de depuración',
                desc: 'Habilitar registro de depuración en la consola'
            }
        }
    },

    // Modal dialogs
    modals: {
        rename: {
            title: 'Renombrar imagen',
            renameButton: 'Renombrar',
            cancelButton: 'Cancelar'
        },
        delete: {
            title: 'Eliminar imagen',
            confirmMessage: '¿Estás seguro de que quieres eliminar "{filename}"?',
            warningMessage: 'Esto eliminará tanto el archivo de imagen como todos los enlaces a él en el documento actual.',
            deleteButton: 'Eliminar',
            cancelButton: 'Cancelar'
        }
    },

    whatsNew: {
        title: 'Novedades de Pixel Perfect Image',
        categories: {
            new: 'Nuevo',
            improved: 'Mejorado',
            changed: 'Cambiado',
            fixed: 'Corregido'
        },
        supportMessage: 'Si Pixel Perfect Image te resulta útil, considera apoyar su desarrollo.',
        supportButton: 'Invítame un café',
        thanksButton: '¡Gracias!'
    },

    // Actions (for error messages)
    actions: {
        performAction: 'realizar acción',
        openInNewTab: 'abrir imagen en nueva pestaña',
        openToTheRight: 'abrir imagen a la derecha',
        openInNewWindow: 'abrir imagen en nueva ventana',
        openInDefaultApp: 'abrir imagen con aplicación predeterminada',
        openInEditor: 'abrir imagen en {editor}'
    }
};
