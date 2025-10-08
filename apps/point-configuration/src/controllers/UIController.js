// ui-controller.js
// Controller for UI state and settings

export class UIController {
    constructor() {
        // UI Settings
        this.colorPalette = 'monochromatic';
        this.rayOpacity = 1.0;
        
        // Observers
        this.listeners = new Set();
    }

    /**
     * Subscribe to UI changes
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify listeners of changes
     */
    notify() {
        this.listeners.forEach(listener => listener());
    }

    /**
     * Set color palette
     */
    setColorPalette(palette) {
        if (['monochromatic', 'rainbow', 'pastel'].includes(palette)) {
            this.colorPalette = palette;
            this.notify();
        }
    }

    /**
     * Get current color palette
     */
    getColorPalette() {
        return this.colorPalette;
    }

    /**
     * Set ray opacity
     */
    setRayOpacity(opacity) {
        this.rayOpacity = Math.max(0, Math.min(1, opacity));
        this.notify();
    }

    /**
     * Get current ray opacity
     */
    getRayOpacity() {
        return this.rayOpacity;
    }
}