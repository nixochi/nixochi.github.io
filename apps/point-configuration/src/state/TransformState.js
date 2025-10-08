// state/TransformState.js
// Primary State: Pan and zoom state for the canvas view

export class TransformState {
    constructor() {
        // Pan state
        this.offsetX = 0; // screen pixels
        this.offsetY = 0; // screen pixels

        // Zoom state
        this.scale = 1.0; // zoom level, 1.0 = 100%
        this.minScale = 0.1; // minimum zoom
        this.maxScale = 5.0; // maximum zoom

        // Canvas dimensions (for coordinate conversion)
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // Observer pattern
        this.observers = new Set();
    }

    // ============================================================================
    // Pan operations
    // ============================================================================

    /**
     * Set pan offset
     */
    setPan(offsetX, offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.notify();
    }

    /**
     * Pan by delta amount
     */
    pan(deltaX, deltaY) {
        this.offsetX += deltaX;
        this.offsetY += deltaY;
        this.notify();
    }

    /**
     * Get pan X offset
     */
    getOffsetX() {
        return this.offsetX;
    }

    /**
     * Get pan Y offset
     */
    getOffsetY() {
        return this.offsetY;
    }

    // ============================================================================
    // Zoom operations
    // ============================================================================

    /**
     * Set zoom level (clamped to min/max)
     */
    setZoom(scale) {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
        this.notify();
    }

    /**
     * Zoom centered on a screen point, adjusting pan to keep point fixed
     */
    zoomAt(screenX, screenY, scaleFactor) {
        const oldScale = this.scale;

        // Calculate new scale with limits
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scaleFactor));

        // Calculate world position under cursor (stays fixed during zoom)
        const worldX = (screenX - this.offsetX) / oldScale;
        const worldY = (screenY - this.offsetY) / oldScale;

        // Update scale
        this.scale = newScale;

        // Adjust offset so world position stays under same screen position
        this.offsetX = screenX - worldX * newScale;
        this.offsetY = screenY - worldY * newScale;

        this.notify();
    }

    /**
     * Get zoom scale
     */
    getScale() {
        return this.scale;
    }

    // ============================================================================
    // Canvas dimensions
    // ============================================================================

    /**
     * Update canvas dimensions (for coordinate conversion)
     */
    setCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    // ============================================================================
    // Coordinate conversion
    // ============================================================================

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
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scale,
            y: (screenY - this.offsetY) / this.scale
        };
    }

    /**
     * Get visible world rectangle
     */
    getViewportBounds() {
        return {
            left: -this.offsetX / this.scale,
            right: (this.canvasWidth - this.offsetX) / this.scale,
            top: -this.offsetY / this.scale,
            bottom: (this.canvasHeight - this.offsetY) / this.scale
        };
    }

    // ============================================================================
    // Reset operations
    // ============================================================================

    /**
     * Reset to default view (origin centered, scale 1.0)
     */
    reset() {
        this.offsetX = this.canvasWidth / 2;
        this.offsetY = this.canvasHeight / 2;
        this.scale = 1.0;
        this.notify();
    }

    /**
     * Set pan so world origin (0, 0) is at canvas center
     */
    centerOrigin() {
        this.offsetX = this.canvasWidth / 2;
        this.offsetY = this.canvasHeight / 2;
        this.notify();
    }

    // ============================================================================
    // Observer pattern
    // ============================================================================

    /**
     * Register observer callback
     */
    subscribe(callback) {
        this.observers.add(callback);
    }

    /**
     * Remove observer callback
     */
    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    /**
     * Notify all observers
     */
    notify() {
        this.observers.forEach(callback => callback());
    }
}
