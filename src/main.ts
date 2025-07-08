import { debounce, Menu, MarkdownView, Notice, Plugin, TFile, normalizePath, Platform, FileSystemAdapter, Modal, App } from 'obsidian';
import { PixelPerfectImageSettings, DEFAULT_SETTINGS, PixelPerfectImageSettingTab, getExternalEditorPath } from './settings';
import { join } from 'path';
import { exec } from "child_process";

// Import all types
import './types';

// Import event handlers
import { setModifierKeyState, registerWheelEvents, isModifierKeyMatch, isModifierKeyStillHeld, handleImageWheel, handleImageClick } from './events';

// Import menu functions
import { registerImageContextMenu, handleContextMenu, addDimensionsMenuItem, addResizeMenuItems, addFileOperationMenuItems, addMenuItem, addInfoMenuItem, createMenuClickHandler } from './menu';

// Import image operations
import { resizeImage, updateImageLinkWidth, removeImageWidth, readImageDimensions, calculateImageScale, getCurrentImageWidth, copyImageToClipboard } from './image-operations';

// Import link parser functions
import { updateLinks, parseLinkComponents, buildLinkPath, updateImageLinks, resolveLink, removeImageLinks } from './link-parser';

// Import file utilities
import { getFileForImage, parseFileNameFromSrc, getImageFileWithErrorHandling, showInSystemExplorer, openInDefaultApp, openInExternalEditor, renameImage, promptForNewName, deleteImageAndLink } from './file-utils';

// Import utilities
import { findImageElement, errorLog } from './utils';

// Import modals
import { FileNameInputModal } from './modals';

export default class PixelPerfectImage extends Plugin {
	settings: PixelPerfectImageSettings;
	/** Cache to store image dimensions to avoid repeated file reads */
	dimensionCache = new Map<string, { width: number; height: number }>();
	isModifierKeyHeld = false;
	wheelEventCleanup: (() => void) | null = null;

	// Bind all imported functions to this instance
	setModifierKeyState = setModifierKeyState.bind(this);
	registerWheelEvents = registerWheelEvents.bind(this);
	isModifierKeyMatch = isModifierKeyMatch.bind(this);
	isModifierKeyStillHeld = isModifierKeyStillHeld.bind(this);
	handleImageWheel = handleImageWheel.bind(this);
	handleImageClick = handleImageClick.bind(this);
	
	registerImageContextMenu = registerImageContextMenu.bind(this);
	handleContextMenu = handleContextMenu.bind(this);
	addDimensionsMenuItem = addDimensionsMenuItem.bind(this);
	addResizeMenuItems = addResizeMenuItems.bind(this);
	addFileOperationMenuItems = addFileOperationMenuItems.bind(this);
	addMenuItem = addMenuItem.bind(this);
	createMenuClickHandler = createMenuClickHandler.bind(this);
	
	resizeImage = resizeImage.bind(this);
	updateImageLinkWidth = updateImageLinkWidth.bind(this);
	removeImageWidth = removeImageWidth.bind(this);
	readImageDimensions = readImageDimensions.bind(this);
	calculateImageScale = calculateImageScale.bind(this);
	getCurrentImageWidth = getCurrentImageWidth.bind(this);
	copyImageToClipboard = copyImageToClipboard.bind(this);
	
	updateLinks = updateLinks.bind(this);
	parseLinkComponents = parseLinkComponents.bind(this);
	buildLinkPath = buildLinkPath.bind(this);
	updateImageLinks = updateImageLinks.bind(this);
	resolveLink = resolveLink.bind(this);
	removeImageLinks = removeImageLinks.bind(this);
	
	getFileForImage = getFileForImage.bind(this);
	parseFileNameFromSrc = parseFileNameFromSrc.bind(this);
	getImageFileWithErrorHandling = getImageFileWithErrorHandling.bind(this);
	showInSystemExplorer = showInSystemExplorer.bind(this);
	openInDefaultApp = openInDefaultApp.bind(this);
	openInExternalEditor = openInExternalEditor.bind(this);
	renameImage = renameImage.bind(this);
	promptForNewName = promptForNewName.bind(this);
	deleteImageAndLink = deleteImageAndLink.bind(this);
	
	findImageElement = findImageElement.bind(this);
	errorLog = errorLog.bind(this);

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new PixelPerfectImageSettingTab(this.app, this));
		this.registerImageContextMenu();
		
		// Add click handler for CMD/CTRL + click
		this.registerDomEvent(document, 'click', this.handleImageClick);
		
		// Register mousewheel zoom events
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.registerWheelEvents(window))
		);
		this.registerWheelEvents(window);
	}

	onunload() {
		// Reset state
		this.isModifierKeyHeld = false;
		this.dimensionCache.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}