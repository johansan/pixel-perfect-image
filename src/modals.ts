import { Modal, App, TFile } from 'obsidian';

export class FileNameInputModal extends Modal {
	private result: string | null = null;
	private readonly onSubmit: (result: string | null) => void;
	private readonly originalName: string;

	constructor(app: App, originalName: string, onSubmit: (result: string | null) => void) {
		super(app);
		this.originalName = originalName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pixel-perfect-rename-modal');

		contentEl.createEl("h2", { 
			text: "Rename image",
			cls: 'modal-title'
		});

		const form = contentEl.createEl("form");
		form.addClass('pixel-perfect-rename-form');

		const input = form.createEl("input", {
			type: "text",
			value: this.originalName,
			cls: 'pixel-perfect-rename-input'
		});
		
		// Select filename without extension
		const lastDotIndex = this.originalName.lastIndexOf('.');
		if (lastDotIndex > 0) {
			const nameWithoutExt = this.originalName.substring(0, lastDotIndex);
			input.setSelectionRange(0, nameWithoutExt.length);
		}

		const buttonContainer = form.createDiv();
		buttonContainer.addClass('pixel-perfect-button-container');

		const submitButton = buttonContainer.createEl("button", { 
			text: "Rename",
			type: "submit",
			cls: 'mod-cta' // Add Obsidian's accent class
		});
		
		const cancelButton = buttonContainer.createEl("button", { 
			text: "Cancel",
			type: "button"
		});
		
		cancelButton.addEventListener("click", () => {
			this.onSubmit(null);
			this.close();
		});

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const newName = input.value.trim();
			if (newName && newName !== this.originalName) {
				this.onSubmit(newName);
			} else {
				this.onSubmit(null);
			}
			this.close();
		});

		input.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		if (this.result === undefined) {
			this.onSubmit(null);
		}
	}
}

export class DeleteConfirmationModal extends Modal {
	private readonly file: TFile;
	private readonly onConfirm: () => void;

	constructor(app: App, file: TFile, onConfirm: () => void) {
		super(app);
		this.file = file;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pixel-perfect-delete-modal');

		contentEl.createEl("h2", { 
			text: "Delete image",
			cls: 'modal-title'
		});

		const messageDiv = contentEl.createDiv();
		messageDiv.addClass('pixel-perfect-delete-message');
		
		messageDiv.createEl("p", { 
			text: `Are you sure you want to delete "${this.file.name}"?`
		});
		
		messageDiv.createEl("p", { 
			text: "This will delete both the image file and all links to it in the current document.",
			cls: 'mod-warning'
		});

		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass('pixel-perfect-button-container');

		const deleteButton = buttonContainer.createEl("button", { 
			text: "Delete",
			cls: 'mod-warning' // Red styling for delete action
		});
		
		const cancelButton = buttonContainer.createEl("button", { 
			text: "Cancel"
		});
		
		deleteButton.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
		
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		// Focus on cancel button by default for safety
		cancelButton.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}