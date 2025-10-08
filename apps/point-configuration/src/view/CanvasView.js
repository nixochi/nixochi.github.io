// CanvasView.js
// Orchestrates canvas rendering - the main render coordinator
// Never modifies state - only reads and renders

import { getPointPosition } from '../geometry/geometry-utils.js';

/**
 * Main canvas view - coordinates all rendering.
 * This is THE place where all derived computers are called.
 */
export class CanvasView {
    constructor(
        canvas,
        renderer,
        configuration,
        interactionState,
        transformState,
        uiState,
        intersectionsComputer,
        highlightsComputer,
        visualOverlaysComputer,
        snapPreviewComputer
    ) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.transformState = transformState;
        this.uiState = uiState;
        this.intersectionsComputer = intersectionsComputer;
        this.highlightsComputer = highlightsComputer;
        this.visualOverlaysComputer = visualOverlaysComputer;
        this.snapPreviewComputer = snapPreviewComputer;

        this.ctx = canvas.getContext('2d');
        this.setupResizeObserver();
    }

    /**
     * Main render function - called by app.js when state changes
     */
    render() {
        // 1. Clear canvas
        this.renderer.clear();

        // 2. Save context and apply transform
        this.ctx.save();
        const offsetX = this.transformState.getOffsetX();
        const offsetY = this.transformState.getOffsetY();
        const scale = this.transformState.getScale();

        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        // 3. Get viewport bounds
        const viewportBounds = this.transformState.getViewportBounds();

        // 4. Compute all derived state (THIS IS THE ONLY PLACE WE CALL DERIVED COMPUTERS)
        const intersections = this.intersectionsComputer.compute();
        const highlights = this.highlightsComputer.compute();
        const overlays = this.visualOverlaysComputer.compute();
        const snapPreview = this.snapPreviewComputer.compute();

        // 5. Draw grid
        this.renderer.drawGridDots(viewportBounds, scale);

        // 6. Draw lines
        const lines = this.configuration.getAllLines();
        const points = this.configuration.getAllPoints();
        const rayOpacity = this.uiState.getRayOpacity();

        this.renderer.drawLines(
            lines,
            viewportBounds,
            snapPreview,
            intersections,
            highlights.lines,
            points,
            rayOpacity
        );

        // 7. Draw preview line (if any)
        if (overlays.previewLine) {
            this.renderer.drawPreviewLine(
                overlays.previewLine.startX,
                overlays.previewLine.startY,
                overlays.previewLine.endX,
                overlays.previewLine.endY,
                viewportBounds
            );
        }

        // 8. Draw line intersection previews
        if (overlays.lineIntersectionPreviews) {
            overlays.lineIntersectionPreviews.forEach(preview => {
                this.renderer.drawIntersectionPreview(preview);
            });
        }

        // 9. Draw snap preview (for point mode)
        const mode = this.interactionState.getMode();
        if (mode === 'point' && snapPreview) {
            this.renderer.drawSnapPreview(snapPreview);
        }

        // 10. Draw ghost point (if any)
        if (overlays.ghostPoint) {
            this.renderer.drawGhostPoint(overlays.ghostPoint);
        }

        // 11. Draw points
        const getPosition = (point) => getPointPosition(point, intersections);
        this.renderer.drawPoints(
            points,
            highlights.points,
            overlays.ghostPoint?.pointIndex, // Skip this point (drawn as ghost)
            getPosition
        );

        // 12. Restore context
        this.ctx.restore();
    }

    /**
     * Setup resize observer for canvas size changes
     */
    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                this.onResize(width, height);
            }
        });

        resizeObserver.observe(this.canvas);
    }

    /**
     * Handle canvas resize
     */
    onResize(width, height) {
        // Set canvas resolution
        this.canvas.width = width;
        this.canvas.height = height;

        // Update transform state with new canvas size
        this.transformState.setCanvasSize(width, height);

        // Re-render
        this.render();
    }
}
