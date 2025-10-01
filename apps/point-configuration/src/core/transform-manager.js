// transform-manager.js
// Manages pan, zoom, and coordinate transformations

export class TransformManager {
    constructor(canvas) {
        this.canvas = canvas;

        // Pan state
        this.offsetX = 0;
        this.offsetY = 0;

        // Zoom state
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;
    }

    /**
     * Extract coordinates from mouse or touch event
     */
    getEventCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const worldX = (screenX - this.offsetX) / this.scale;
        const worldY = (screenY - this.offsetY) / this.scale;

        return { worldX, worldY, screenX, screenY };
    }

    /**
     * Get distance and center point between two touches
     */
    getTouchGestureInfo(touches) {
        if (touches.length < 2) return null;

        const rect = this.canvas.getBoundingClientRect();
        const touch1 = {
            x: touches[0].clientX - rect.left,
            y: touches[0].clientY - rect.top
        };
        const touch2 = {
            x: touches[1].clientX - rect.left,
            y: touches[1].clientY - rect.top
        };

        const distance = Math.hypot(touch2.x - touch1.x, touch2.y - touch1.y);
        const centerX = (touch1.x + touch2.x) / 2;
        const centerY = (touch1.y + touch2.y) / 2;

        return { distance, centerX, centerY };
    }

    /**
     * Apply zoom at a specific point (screen coordinates)
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
    }

    /**
     * Get viewport bounds in world coordinates
     */
    getViewportBounds() {
        return {
            left: -this.offsetX / this.scale,
            right: (this.canvas.width - this.offsetX) / this.scale,
            top: -this.offsetY / this.scale,
            bottom: (this.canvas.height - this.offsetY) / this.scale
        };
    }

    /**
     * Apply transform to canvas context
     */
    applyTransform(ctx) {
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
    }
}
