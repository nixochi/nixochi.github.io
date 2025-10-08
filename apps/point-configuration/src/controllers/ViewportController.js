// viewport-controller.js
// Controller for viewport operations (pan, zoom, coordinate transforms)

export class ViewportController {
    constructor(viewportModel) {
        this.viewportModel = viewportModel;
    }

    /**
     * Initialize viewport with canvas dimensions
     */
    initialize(canvasWidth, canvasHeight) {
        this.viewportModel.canvasWidth = canvasWidth;
        this.viewportModel.canvasHeight = canvasHeight;
        this.centerOrigin();
    }

    /**
     * Update canvas dimensions (called on resize)
     */
    updateDimensions(canvasWidth, canvasHeight) {
        this.viewportModel.canvasWidth = canvasWidth;
        this.viewportModel.canvasHeight = canvasHeight;
        this.viewportModel.notify();
    }

    /**
     * Center the origin (0,0) on the canvas
     */
    centerOrigin() {
        this.viewportModel.offsetX = this.viewportModel.canvasWidth / 2;
        this.viewportModel.offsetY = this.viewportModel.canvasHeight / 2;
        this.viewportModel.notify();
    }

    /**
     * Zoom at a specific point (screen coordinates)
     */
    zoomAt(screenX, screenY, scaleFactor) {
        const oldScale = this.viewportModel.scale;

        // Calculate new scale with limits
        const newScale = Math.max(
            this.viewportModel.minScale,
            Math.min(this.viewportModel.maxScale, this.viewportModel.scale * scaleFactor)
        );

        // Calculate world position under cursor (stays fixed during zoom)
        const worldX = (screenX - this.viewportModel.offsetX) / oldScale;
        const worldY = (screenY - this.viewportModel.offsetY) / oldScale;

        // Update scale
        this.viewportModel.scale = newScale;

        // Adjust offset so world position stays under same screen position
        this.viewportModel.offsetX = screenX - worldX * newScale;
        this.viewportModel.offsetY = screenY - worldY * newScale;

        this.viewportModel.notify();
    }

    /**
     * Pan viewport by delta
     */
    pan(dx, dy) {
        this.viewportModel.offsetX += dx;
        this.viewportModel.offsetY += dy;
        this.viewportModel.notify();
    }

    /**
     * Set pan offset directly
     */
    setPanOffset(offsetX, offsetY) {
        this.viewportModel.offsetX = offsetX;
        this.viewportModel.offsetY = offsetY;
        this.viewportModel.notify();
    }

    /**
     * Get viewport bounds in world coordinates
     */
    getViewportBounds() {
        return this.viewportModel.getViewportBounds();
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return this.viewportModel.screenToWorld(screenX, screenY);
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        return this.viewportModel.worldToScreen(worldX, worldY);
    }

    /**
     * Get current scale
     */
    getScale() {
        return this.viewportModel.scale;
    }
}