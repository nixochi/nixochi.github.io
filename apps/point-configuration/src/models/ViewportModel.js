// viewport-model.js
// Model for viewport state (pan, zoom, coordinate transforms)

export class ViewportModel {
    constructor() {
        this.listeners = new Set();

        // Canvas dimensions (set by controller)
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // Pan state
        this.offsetX = 0;
        this.offsetY = 0;

        // Zoom state
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;
    }

    /**
     * Subscribe to viewport changes
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
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scale,
            y: (screenY - this.offsetY) / this.scale
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.scale + this.offsetX,
            y: worldY * this.scale + this.offsetY
        };
    }

    /**
     * Get viewport bounds in world coordinates
     */
    getViewportBounds() {
        return {
            left: -this.offsetX / this.scale,
            right: (this.canvasWidth - this.offsetX) / this.scale,
            top: -this.offsetY / this.scale,
            bottom: (this.canvasHeight - this.offsetY) / this.scale
        };
    }
}