// src/ui/ExamplesModal.js
export class ExamplesModal {
    constructor(app) {
        this.app = app;
        this.serializationController = app.serializationController;
        this.viewportController = app.viewportController;

        this.modal = null;
        this.grid = null;
        this.closeBtn = null;
        this.libraryBtn = null;

        this.init();
    }

    init() {
        this.modal = document.getElementById('examplesModal');
        this.grid = document.getElementById('examplesGrid');
        this.closeBtn = document.getElementById('closeModal');
        this.libraryBtn = document.getElementById('libraryBtn');

        if (!this.modal || !this.grid || !this.closeBtn || !this.libraryBtn) {
            console.error('Examples modal elements not found');
            return;
        }

        // Setup event listeners
        this.libraryBtn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    }

    async open() {
        this.modal.classList.add('active');
        document.body.classList.add('modal-open');

        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error('Failed to load examples');

            const examples = await response.json();
            this.grid.innerHTML = '';

            Object.keys(examples).forEach(key => {
                const example = examples[key];
                const card = document.createElement('div');
                card.className = 'example-card';
                card.dataset.example = key;
                card.innerHTML = `<div class="example-name">${example.name}</div>`;

                card.addEventListener('click', async () => {
                    await this.loadExample(key);
                });

                this.grid.appendChild(card);
            });
        } catch (e) {
            console.error('Failed to load examples:', e);
            this.grid.innerHTML = '<div style="color: var(--fg-secondary); text-align: center;">Failed to load examples</div>';
        }
    }

    close() {
        this.modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    async loadExample(configName) {
        const success = await this.serializationController.loadConfiguration(configName);
        if (success) {
            this.viewportController.centerOrigin();
            this.app.updateURL();
            this.app.renderStats();
            this.close();
        }
    }
}
