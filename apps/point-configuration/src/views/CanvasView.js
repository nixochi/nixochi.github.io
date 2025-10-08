// canvas-view.js
// View for canvas rendering

import { getPointPosition } from '../geometry/geometry-utils.js';
import { Renderer } from '../rendering/renderer.js';

export class CanvasView {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.renderer = new Renderer(canvas, this.ctx);
    }

    /**
     * Render the entire canvas
     */
    render(renderState) {
        const {
            points,
            lines,
            intersections,
            viewportBounds,
            scale,
            offsetX,
            offsetY,
            visuals,
            rayOpacity,
            colorPalette
        } = renderState;

        // Update renderer settings
        this.renderer.setPalette(colorPalette);

        // Clear canvas
        this.renderer.clear();

        // Save context
        this.ctx.save();

        // Apply transform
        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        // Draw grid
        this.renderer.drawGridDots(viewportBounds, scale);

        // Draw lines
        this.renderer.drawLines(
            lines,
            viewportBounds,
            visuals.snapPreview,
            intersections,
            visuals.highlightedLines,
            points,
            rayOpacity
        );

        // Draw preview line
        if (visuals.previewLine) {
            this.renderer.drawPreviewLine(
                visuals.previewLine.startX,
                visuals.previewLine.startY,
                visuals.previewLine.endX,
                visuals.previewLine.endY,
                viewportBounds
            );
        }

        // Draw line intersection previews
        if (visuals.allLineIntersections && visuals.allLineIntersections.length > 0) {
            visuals.allLineIntersections.forEach((intersection) => {
                const isSnapped = visuals.lineEndSnap &&
                    Math.hypot(intersection.x - visuals.lineEndSnap.x, intersection.y - visuals.lineEndSnap.y) < 0.1;

                if (isSnapped) {
                    this.renderer.drawSnapPreview(intersection);
                } else {
                    this.renderer.drawIntersectionPreview(intersection);
                }
            });
        }

        // Draw snap preview (point mode only)
        if (visuals.snapPreview && renderState.mode === 'point') {
            this.renderer.drawSnapPreview(visuals.snapPreview);
        }

        // Draw ghost point
        if (visuals.ghostPoint) {
            this.renderer.drawGhostPoint(visuals.ghostPoint);
        }

        // Draw points
        this.renderer.drawPoints(
            points,
            visuals.highlightedPoints,
            visuals.ghostPoint?.pointIndex,
            (point) => getPointPosition(point, intersections)
        );

        // Restore context
        this.ctx.restore();
    }

    /**
     * Update cursor style
     */
    setCursor(cursor) {
        this.canvas.style.cursor = cursor;
    }
}