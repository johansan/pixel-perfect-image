declare module 'obsidian' {
	interface App {
		showInFolder(path: string): void;
		openWithDefaultApp(path: string): void;
	}
}

export interface ImageLink {
	path: string;
	hash: string;
	params: string[];
	isWikiStyle: boolean;
}