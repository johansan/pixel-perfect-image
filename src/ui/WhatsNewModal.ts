import { App, Modal } from 'obsidian';
import { strings } from '../i18n';
import { ReleaseNote } from '../releaseNotes';

type AsyncEventHandler<TEvent extends Event = Event> = (event: TEvent) => void | Promise<void>;

function runAsyncAction(action: () => void | Promise<void>): void {
	void Promise.resolve()
		.then(action)
		.catch(error => console.error(error));
}

function addAsyncEventListener<TEvent extends Event = Event>(
	target: EventTarget,
	type: string,
	handler: AsyncEventHandler<TEvent>,
	options?: boolean | AddEventListenerOptions
): () => void {
	const wrappedHandler = (event: Event) => {
		runAsyncAction(() => handler(event as TEvent));
	};
	target.addEventListener(type, wrappedHandler as EventListener, options);
	return () => target.removeEventListener(type, wrappedHandler as EventListener, options);
}

function formatReleaseDate(timestamp: number): string {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return '';
	}
	return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export class WhatsNewModal extends Modal {
	private releaseNotes: ReleaseNote[];
	private thanksButton: HTMLButtonElement | null = null;
	private onCloseCallback?: () => void;
	private domDisposers: (() => void)[] = [];

	// Renders limited formatting into a container element.
	// Supports:
	// - **bold**
	// - ==text== (highlight as red + bold)
	// - [label](https://link)
	// - Auto-link bare http(s) URLs
	// - Line breaks: single \n becomes <br>
	private renderFormattedText(container: HTMLElement, text: string): void {
		const renderInline = (segment: string, dest: HTMLElement) => {
			const pattern = /==([\s\S]*?)==|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s]+)/g;
			let lastIndex = 0;
			let match: RegExpExecArray | null;

			const appendText = (value: string) => {
				if (value.length > 0) dest.appendText(value);
			};

			while ((match = pattern.exec(segment)) !== null) {
				appendText(segment.slice(lastIndex, match.index));

				if (match[1]) {
					const highlight = dest.createSpan({ cls: 'pixel-perfect-whats-new-highlight' });
					renderInline(match[1], highlight);
				} else if (match[2] && match[3]) {
					const a = dest.createEl('a', { text: match[2] });
					a.setAttr('href', match[3]);
					a.setAttr('rel', 'noopener noreferrer');
					a.setAttr('target', '_blank');
				} else if (match[4]) {
					dest.createEl('strong', { text: match[4] });
				} else if (match[5]) {
					let url = match[5];
					let trailing = '';
					const trailingMatch = url.match(/[.,;:!?)]+$/);
					if (trailingMatch) {
						trailing = trailingMatch[0];
						url = url.slice(0, -trailing.length);
					}
					const a = dest.createEl('a', { text: url });
					a.setAttr('href', url);
					a.setAttr('rel', 'noopener noreferrer');
					a.setAttr('target', '_blank');
					if (trailing) {
						appendText(trailing);
					}
				}

				lastIndex = pattern.lastIndex;
			}

			appendText(segment.slice(lastIndex));
		};

		const lines = text.split('\n');
		for (let i = 0; i < lines.length; i++) {
			renderInline(lines[i], container);
			if (i < lines.length - 1) {
				container.createEl('br');
			}
		}
	}

	constructor(app: App, releaseNotes: ReleaseNote[], onCloseCallback?: () => void) {
		super(app);
		this.releaseNotes = releaseNotes;
		this.onCloseCallback = onCloseCallback;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();
		this.modalEl.addClass('pixel-perfect-whats-new-modal');

		contentEl.createEl('h2', {
			text: strings.whatsNew.title,
			cls: 'pixel-perfect-whats-new-header'
		});

		this.attachCloseButtonHandler();

		const scrollContainer = contentEl.createDiv('pixel-perfect-whats-new-scroll');

		this.releaseNotes.forEach(note => {
			const versionContainer = scrollContainer.createDiv('pixel-perfect-whats-new-version');

			versionContainer.createEl('h3', {
				text: `Version ${note.version}`
			});

			versionContainer.createEl('small', {
				text: formatReleaseDate(new Date(note.date).getTime()) || note.date,
				cls: 'pixel-perfect-whats-new-date'
			});

			if (note.info) {
				const paragraphs = note.info.split(/\n\s*\n/);
				paragraphs.forEach(paragraph => {
					const p = versionContainer.createEl('p', { cls: 'pixel-perfect-whats-new-info' });
					this.renderFormattedText(p, paragraph);
				});
			}

			const categories = [
				{ key: 'new', label: strings.whatsNew.categories.new },
				{ key: 'improved', label: strings.whatsNew.categories.improved },
				{ key: 'changed', label: strings.whatsNew.categories.changed },
				{ key: 'fixed', label: strings.whatsNew.categories.fixed }
			];

			categories.forEach(category => {
				const items = note[category.key as keyof ReleaseNote] as string[] | undefined;
				if (items && items.length > 0) {
					versionContainer.createEl('h4', {
						text: category.label,
						cls: 'pixel-perfect-whats-new-category'
					});

					const categoryList = versionContainer.createEl('ul', {
						cls: 'pixel-perfect-whats-new-features'
					});

					items.forEach(item => {
						const li = categoryList.createEl('li');
						this.renderFormattedText(li, item);
					});
				}
			});
		});

		contentEl.createDiv('pixel-perfect-whats-new-divider');

		const supportContainer = contentEl.createDiv('pixel-perfect-whats-new-support');
		supportContainer.createEl('p', {
			text: strings.whatsNew.supportMessage,
			cls: 'pixel-perfect-whats-new-support-text'
		});

		const buttonContainer = contentEl.createDiv('pixel-perfect-whats-new-buttons');

		const supportButton = buttonContainer.createEl('button', {
			cls: 'pixel-perfect-whats-new-support-button'
		});
		supportButton.setAttr('type', 'button');

		const supportIcon = supportButton.createSpan({ cls: 'pixel-perfect-whats-new-support-icon' });
		supportIcon.setAttr('aria-hidden', 'true');
		supportIcon.setText('☕');

		supportButton.createSpan({
			cls: 'pixel-perfect-whats-new-support-button-label',
			text: strings.whatsNew.supportButton
		});
		this.domDisposers.push(
			addAsyncEventListener(supportButton, 'click', () => {
				window.open('https://www.buymeacoffee.com/johansan');
			})
		);

		const thanksButton = buttonContainer.createEl('button', {
			text: strings.whatsNew.thanksButton,
			cls: 'mod-cta'
		});
		this.domDisposers.push(
			addAsyncEventListener(thanksButton, 'click', () => {
				this.close();
			})
		);

		this.thanksButton = thanksButton;
	}

	open(): void {
		super.open();
		if (this.thanksButton) {
			requestAnimationFrame(() => {
				this.thanksButton?.focus();
			});
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.removeClass('pixel-perfect-whats-new-modal');

		if (this.domDisposers.length) {
			this.domDisposers.forEach(dispose => {
				try {
					dispose();
				} catch (error) {
					console.error("Error disposing what's new modal listener:", error);
				}
			});
			this.domDisposers = [];
		}

		this.onCloseCallback?.();
	}

	private attachCloseButtonHandler(): void {
		const closeButton = this.modalEl.querySelector<HTMLElement>('.modal-close-button');
		if (!closeButton) return;

		const handleClose = (event: Event) => {
			event.preventDefault();
			this.close();
		};

		this.domDisposers.push(addAsyncEventListener(closeButton, 'click', handleClose));
		this.domDisposers.push(addAsyncEventListener(closeButton, 'pointerdown', handleClose));
	}
}
