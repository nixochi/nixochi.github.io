// UIController.js
// Handle UI interactions (buttons, sliders, panels, dropdowns)
// ONLY modifies UIState
// Never directly triggers render - state changes do that via observers

/**
 * Handles all UI interactions (buttons, sliders, panels).
 * This is the ONLY controller that modifies UIState.
 */
export class UIController {
    constructor(
        uiState,
        interactionState,
        historyController,
        operationsController,
        renderer
    ) {
        this.uiState = uiState;
        this.interactionState = interactionState;
        this.historyController = historyController;
        this.operationsController = operationsController;
        this.renderer = renderer;

        this.setupAllUI();
    }

    /**
     * Setup all UI interactions
     */
    setupAllUI() {
        this.setupModeSwitch();
        this.setupColorPalette();
        this.setupRayOpacity();
        this.setupHistoryButtons();
        this.setupStatsPanel();
        this.setupOptionsPanel();
        this.setupOperationButtons();
    }

    /**
     * Setup mode switch (point/line)
     */
    setupModeSwitch() {
        const pointBtn = document.getElementById('pointBtn');
        const lineBtn = document.getElementById('lineBtn');
        const switchIndicator = document.getElementById('switchIndicator');

        if (!pointBtn || !lineBtn || !switchIndicator) return;

        const updateSwitchIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            switchIndicator.style.width = `${btnRect.width}px`;
            switchIndicator.style.transform = `translateX(${offset}px)`;
        };

        // Initialize
        updateSwitchIndicator(pointBtn);

        pointBtn.addEventListener('click', () => {
            this.onModeButtonClick('point');
            pointBtn.classList.add('active');
            lineBtn.classList.remove('active');
            updateSwitchIndicator(pointBtn);
        });

        lineBtn.addEventListener('click', () => {
            this.onModeButtonClick('line');
            lineBtn.classList.add('active');
            pointBtn.classList.remove('active');
            updateSwitchIndicator(lineBtn);
        });
    }

    /**
     * Setup color palette switch
     */
    setupColorPalette() {
        const monoBtn = document.getElementById('monoBtn');
        const rainbowBtn = document.getElementById('rainbowBtn');
        const pastelBtn = document.getElementById('pastelBtn');
        const paletteSwitchIndicator = document.getElementById('paletteSwitchIndicator');

        if (!monoBtn || !rainbowBtn || !pastelBtn || !paletteSwitchIndicator) return;

        const updatePaletteSwitchIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            paletteSwitchIndicator.style.width = `${btnRect.width}px`;
            paletteSwitchIndicator.style.transform = `translateX(${offset}px)`;
        };

        monoBtn.addEventListener('click', () => {
            this.onColorPaletteChange('monochromatic');
            monoBtn.classList.add('active');
            rainbowBtn.classList.remove('active');
            pastelBtn.classList.remove('active');
            updatePaletteSwitchIndicator(monoBtn);
        });

        rainbowBtn.addEventListener('click', () => {
            this.onColorPaletteChange('rainbow');
            rainbowBtn.classList.add('active');
            monoBtn.classList.remove('active');
            pastelBtn.classList.remove('active');
            updatePaletteSwitchIndicator(rainbowBtn);
        });

        pastelBtn.addEventListener('click', () => {
            this.onColorPaletteChange('pastel');
            pastelBtn.classList.add('active');
            monoBtn.classList.remove('active');
            rainbowBtn.classList.remove('active');
            updatePaletteSwitchIndicator(pastelBtn);
        });
    }

    /**
     * Setup ray opacity slider
     */
    setupRayOpacity() {
        const slider = document.getElementById('rayOpacitySlider');
        const valueDisplay = document.getElementById('rayOpacityValue');

        if (!slider || !valueDisplay) return;

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.onRayOpacityChange(value);

            const percentage = Math.round(value * 100);
            valueDisplay.textContent = `${percentage}%`;
        });
    }

    /**
     * Setup undo/redo buttons
     */
    setupHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (!undoBtn || !redoBtn) return;

        undoBtn.addEventListener('click', () => {
            this.onUndoClick();
        });

        redoBtn.addEventListener('click', () => {
            this.onRedoClick();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? e.metaKey : e.ctrlKey;

            if (modifierKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.onUndoClick();
            } else if (modifierKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.onRedoClick();
            }
        });

        // Initial update
        this.updateHistoryButtons();
    }

    /**
     * Setup stats panel (dropdown, view selector)
     */
    setupStatsPanel() {
        const dropdownTrigger = document.getElementById('dropdownTrigger');
        const dropdownContent = document.getElementById('dropdownContent');
        const dropdownLabel = document.getElementById('dropdownLabel');
        const dropdownItems = dropdownContent?.querySelectorAll('.dropdown-item');

        if (!dropdownTrigger || !dropdownContent || !dropdownLabel) return;

        let isDropdownOpen = false;

        dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            isDropdownOpen = !isDropdownOpen;

            if (isDropdownOpen) {
                dropdownTrigger.classList.add('open');
                dropdownContent.classList.add('open');
            } else {
                dropdownTrigger.classList.remove('open');
                dropdownContent.classList.remove('open');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownTrigger.contains(e.target) && !dropdownContent.contains(e.target)) {
                isDropdownOpen = false;
                dropdownTrigger.classList.remove('open');
                dropdownContent.classList.remove('open');
            }
        });

        // Dropdown items
        if (dropdownItems) {
            dropdownItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = item.getAttribute('data-value');

                    this.onStatsViewChange(value);
                    dropdownLabel.textContent = value;

                    isDropdownOpen = false;
                    dropdownTrigger.classList.remove('open');
                    dropdownContent.classList.remove('open');
                });
            });
        }
    }

    /**
     * Setup options panel toggle
     */
    setupOptionsPanel() {
        const optionsBtn = document.getElementById('optionsBtn');
        const optionsPanel = document.getElementById('optionsPanel');

        if (!optionsBtn || !optionsPanel) return;

        let isPanelVisible = false;

        optionsBtn.addEventListener('click', () => {
            isPanelVisible = !isPanelVisible;

            if (isPanelVisible) {
                optionsPanel.style.display = 'block';
                optionsPanel.offsetHeight; // Force reflow
                optionsPanel.classList.add('expanded');
                optionsBtn.textContent = 'close';
            } else {
                optionsPanel.classList.remove('expanded');
                setTimeout(() => {
                    if (!isPanelVisible) {
                        optionsPanel.style.display = 'none';
                    }
                }, 300);
                optionsBtn.textContent = 'options';
            }
        });
    }

    /**
     * Setup operation buttons (clean, add intersections, export, clear)
     */
    setupOperationButtons() {
        const cleanBtn = document.getElementById('cleanBtn');
        const addIntersectionsBtn = document.getElementById('addIntersectionsBtn');
        const exportBtn = document.getElementById('exportBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        const libraryBtn = document.getElementById('libraryBtn');

        if (cleanBtn) {
            cleanBtn.addEventListener('click', () => this.onCleanClick());
        }

        if (addIntersectionsBtn) {
            addIntersectionsBtn.addEventListener('click', () => this.onAddIntersectionsClick());
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.onExportImageClick());
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.onClearAllClick());
        }

        if (libraryBtn) {
            libraryBtn.addEventListener('click', () => this.onLibraryOpen());
        }
    }

    /**
     * Event Handlers
     */

    onModeButtonClick(mode) {
        this.interactionState.setMode(mode);
    }

    onColorPaletteChange(palette) {
        this.uiState.setColorPalette(palette);
        this.renderer.setPalette(palette);
    }

    onRayOpacityChange(opacity) {
        this.uiState.setRayOpacity(opacity);
    }

    onUndoClick() {
        this.historyController.undo();
        this.updateHistoryButtons();
    }

    onRedoClick() {
        this.historyController.redo();
        this.updateHistoryButtons();
    }

    onStatsViewChange(view) {
        this.uiState.setCurrentStatsView(view);
        this.uiState.resetPagination(view);
    }

    onStatsItemHover(pointIndices) {
        this.uiState.setHoveredPointsFromUI(pointIndices);
    }

    onStatsItemUnhover() {
        this.uiState.clearHoveredPointsFromUI();
    }

    onCleanClick() {
        this.operationsController.removeNonEssentialLines();
    }

    onAddIntersectionsClick() {
        this.operationsController.addIntersectionPoints();
    }

    onExportImageClick() {
        const canvas = document.getElementById('canvas');
        if (canvas) {
            this.operationsController.exportImage(canvas);
        }
    }

    onClearAllClick() {
        if (confirm('Clear all points and lines?')) {
            this.operationsController.clearAll();
        }
    }

    onLibraryOpen() {
        this.openExamplesModal();
    }

    /**
     * Update history buttons state
     */
    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (!undoBtn || !redoBtn) return;

        const canUndo = this.historyController.canUndo();
        const canRedo = this.historyController.canRedo();

        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
        undoBtn.style.opacity = canUndo ? '1' : '0.5';
        redoBtn.style.opacity = canRedo ? '1' : '0.5';
        undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
        redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    }

    /**
     * Open examples modal
     */
    openExamplesModal() {
        const modal = document.getElementById('examplesModal');
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
            this.loadExamples();
        }
    }

    /**
     * Close examples modal
     */
    closeExamplesModal() {
        const modal = document.getElementById('examplesModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * Load examples into modal
     */
    async loadExamples() {
        const examplesGrid = document.getElementById('examplesGrid');
        if (!examplesGrid) return;

        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error('Failed to load examples');

            const examples = await response.json();

            examplesGrid.innerHTML = '';
            Object.keys(examples).forEach(key => {
                const example = examples[key];
                const card = document.createElement('div');
                card.className = 'example-card';
                card.dataset.example = key;

                card.innerHTML = `<div class="example-name">${example.name}</div>`;

                card.addEventListener('click', async () => {
                    await this.operationsController.loadExample(key);
                    this.closeExamplesModal();
                });

                examplesGrid.appendChild(card);
            });

            // Setup modal close
            const closeModal = document.getElementById('closeModal');
            const modal = document.getElementById('examplesModal');

            if (closeModal) {
                closeModal.addEventListener('click', () => this.closeExamplesModal());
            }

            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeExamplesModal();
                    }
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal?.classList.contains('active')) {
                    this.closeExamplesModal();
                }
            });
        } catch (e) {
            console.error('Failed to load examples:', e);
            examplesGrid.innerHTML = '<div style="color: var(--fg-secondary); text-align: center;">Failed to load examples</div>';
        }
    }
}
