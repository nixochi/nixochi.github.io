// src/ui/OptionsPanel.js
export class OptionsPanel {
    constructor(app) {
        this.app = app;
        this.uiController = app.uiController;
        this.geometryController = app.geometryController;
        this.viewportController = app.viewportController;

        this.panel = null;
        this.button = null;
        this.isVisible = false;

        this.init();
    }

    init() {
        this.button = document.getElementById('optionsBtn');
        this.panel = document.getElementById('optionsPanel');

        if (!this.button || !this.panel) {
            console.error('Options panel elements not found');
            return;
        }

        // Setup toggle
        this.button.addEventListener('click', () => this.toggle());

        // Setup components
        this.setupPaletteSwitch();
        this.setupRayOpacitySlider();
        this.setupActionButtons();
    }

    toggle() {
        this.isVisible = !this.isVisible;

        if (this.isVisible) {
            this.panel.style.display = 'block';
            this.panel.offsetHeight; // Force reflow
            this.panel.classList.add('expanded');
            this.button.textContent = 'close';
        } else {
            this.panel.classList.remove('expanded');
            setTimeout(() => {
                if (!this.isVisible) {
                    this.panel.style.display = 'none';
                }
            }, 300);
            this.button.textContent = 'options';
        }
    }

    setupPaletteSwitch() {
        const monoBtn = document.getElementById('monoBtn');
        const rainbowBtn = document.getElementById('rainbowBtn');
        const pastelBtn = document.getElementById('pastelBtn');
        const paletteSwitchIndicator = document.getElementById('paletteSwitchIndicator');

        const updatePaletteSwitchIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            paletteSwitchIndicator.style.width = `${btnRect.width}px`;
            paletteSwitchIndicator.style.transform = `translateX(${offset}px)`;
        };

        monoBtn.addEventListener('click', () => {
            this.uiController.setColorPalette('monochromatic');
            monoBtn.classList.add('active');
            rainbowBtn.classList.remove('active');
            pastelBtn.classList.remove('active');
            updatePaletteSwitchIndicator(monoBtn);
        });

        rainbowBtn.addEventListener('click', () => {
            this.uiController.setColorPalette('rainbow');
            rainbowBtn.classList.add('active');
            monoBtn.classList.remove('active');
            pastelBtn.classList.remove('active');
            updatePaletteSwitchIndicator(rainbowBtn);
        });

        pastelBtn.addEventListener('click', () => {
            this.uiController.setColorPalette('pastel');
            pastelBtn.classList.add('active');
            monoBtn.classList.remove('active');
            rainbowBtn.classList.remove('active');
            updatePaletteSwitchIndicator(pastelBtn);
        });
    }

    setupRayOpacitySlider() {
        const rayOpacitySlider = document.getElementById('rayOpacitySlider');
        const rayOpacityValue = document.getElementById('rayOpacityValue');

        rayOpacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const percentage = Math.round(value * 100);
            rayOpacityValue.textContent = `${percentage}%`;
            this.uiController.setRayOpacity(value);
        });
    }

    setupActionButtons() {
        document.getElementById('cleanBtn').addEventListener('click', () => {
            this.geometryController.removeNonEssentialLines();
        });

        document.getElementById('addIntersectionsBtn').addEventListener('click', () => {
            const viewportBounds = this.viewportController.getViewportBounds();
            this.geometryController.addIntersectionPoints(viewportBounds);
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.app.exportImage();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (confirm('Clear all points and lines?')) {
                this.geometryController.clearAll();
                this.app.updateURL();
                this.app.renderStats();
            }
        });
    }
}
