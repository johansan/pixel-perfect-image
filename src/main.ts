import { Plugin } from 'obsidian';
import { PixelPerfectImageSettings, DEFAULT_SETTINGS, PixelPerfectImageSettingTab } from './ui/settings';

// Import service classes
import { EventService } from './events/EventService';
import { MenuService } from './ui/MenuService';
import { ImageService } from './core/ImageService';
import { LinkService } from './core/LinkService';
import { FileService } from './core/FileService';

// Import types
import './utils/types';

export default class PixelPerfectImage extends Plugin {
	settings: PixelPerfectImageSettings;
	
	// Services
	eventService: EventService;
	menuService: MenuService;
	imageService: ImageService;
	linkService: LinkService;
	fileService: FileService;

	async onload() {
		await this.loadSettings();
		
		// Initialize services
		this.eventService = new EventService(this);
		this.menuService = new MenuService(this);
		this.imageService = new ImageService(this);
		this.linkService = new LinkService(this);
		this.fileService = new FileService(this);
		
		// Setup plugin
		this.addSettingTab(new PixelPerfectImageSettingTab(this.app, this));
		
		// Register features
		this.menuService.registerImageContextMenu();
		this.eventService.registerEvents();
	}

	onunload() {
		// Cleanup services
		this.eventService.cleanup();
		this.imageService.clearDimensionCache();
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData()};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}