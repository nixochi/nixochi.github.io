// canvas-manager.js
// Orchestrates all canvas functionality using specialized managers

import { getPointPosition } from '../geometry/geometry-utils.js';
import { SnapManager } from '../rendering/snap-manager.js';
import { Renderer } from '../rendering/renderer.js';
import { StateManager } from './state-manager.js';
import { TransformManager } from './transform-manager.js';
import { PointLineManager } from './point-line-manager.js';
import { EventHandler } from './event-handler.js';

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Mode
        this.mode = 'point';

        // Settings
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.pointRadius = this.isTouchDevice ? 14 : 9;
        this.snapThreshold = this.isTouchDevice ? 25 : 15;
        this.clickThreshold = this.isTouchDevice ? 8 : 5;

        // Initialize managers
        this.stateManager = new StateManager();
        this.transformManager = new TransformManager(canvas);
        this.pointLineManager = new PointLineManager(this.transformManager.scale);
        this.snapManager = new SnapManager(15, 20); // intersectionSnapThreshold, lineSnapThreshold
        this.renderer = new Renderer(canvas, this.ctx);

        // Wire up viewport bounds getter for state manager
        this.stateManager.setViewportBoundsGetter(() => this.transformManager.getViewportBounds());

        // Initialize event handler
        this.eventHandler = new EventHandler(
            canvas,
            this.stateManager,
            this.transformManager,
            this.pointLineManager,
            this.snapManager,
            { clickThreshold: this.clickThreshold }
        );
        this.eventHandler.onDraw = () => this.draw();

        // Callback for state changes
        this.onStateChange = null;

        // Load state from URL on startup
        this.loadStateFromURL();

        // Wire up point/line manager callback
        this.pointLineManager.onStateChange = () => {
            this.updateURL();
            if (this.onStateChange) {
                this.onStateChange();
            }
        };

        // Initialize
        this.setupCanvas();
        this.eventHandler.setupEventListeners();
        this.draw();
    }

    setupCanvas() {
        const resizeCanvas = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.transformManager.centerOrigin();
            this.draw();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Use ResizeObserver to detect when canvas container size changes
        // (e.g., when panel is resized)
        const resizeObserver = new ResizeObserver(() => {
            resizeCanvas();
        });
        resizeObserver.observe(this.canvas.parentElement);
    }

    setMode(mode) {
        this.mode = mode;
        this.eventHandler.setMode(mode);
        this.stateManager.canvasHoveredPointIndices = null;
        this.stateManager.currentMousePos = null;
        this.stateManager.mouseDownPos = null;
        this.stateManager.capturedSnapPreview = null;
        this.stateManager.transitionState('idle');
        this.canvas.style.cursor = 'crosshair';
        this.draw();
    }

    /**
     * Set which points should be highlighted (called from UI)
     */
    setHoveredPoints(pointIndices) {
        this.stateManager.setHoveredPoints(pointIndices);
        this.draw();
    }

    /**
     * Clear hovered points
     */
    clearHoveredPoints() {
        this.stateManager.clearHoveredPoints();
        this.draw();
    }

    draw() {
        // Update scale in point/line manager
        this.pointLineManager.updateScale(this.transformManager.scale);

        // Derive visual state from current conditions
        const visuals = this.stateManager.computeVisualState(
            this.mode,
            this.pointLineManager.points,
            this.pointLineManager.lines,
            this.pointLineManager.intersections,
            this.snapManager,
            this.transformManager.scale
        );

        // Clear canvas (before transform)
        this.renderer.clear();

        // Save context state
        this.ctx.save();

        // Apply pan and scale transformation
        this.transformManager.applyTransform(this.ctx);

        // Get viewport bounds for renderer (in world space)
        const viewportBounds = this.transformManager.getViewportBounds();

        // Draw grid dots in world space
        this.renderer.drawGridDots(viewportBounds, this.transformManager.scale);

        // Draw lines with computed highlights in world space
        this.renderer.drawLines(
            this.pointLineManager.lines,
            viewportBounds,
            visuals.snapPreview,
            this.pointLineManager.intersections,
            visuals.highlightedLines
        );

        // Draw preview line if in drawing-line state
        if (visuals.previewLine) {
            this.renderer.drawPreviewLine(
                visuals.previewLine.startX,
                visuals.previewLine.startY,
                visuals.previewLine.endX,
                visuals.previewLine.endY,
                viewportBounds
            );
        }

        // Draw all line intersection previews (non-snapped)
        if (visuals.allLineIntersections && visuals.allLineIntersections.length > 0) {
            visuals.allLineIntersections.forEach((intersection) => {
                // Draw all intersections, but highlight the snapped one differently
                const isSnapped = visuals.lineEndSnap &&
                    Math.hypot(intersection.x - visuals.lineEndSnap.x, intersection.y - visuals.lineEndSnap.y) < 0.1;

                if (isSnapped) {
                    // Draw snapped one with full style
                    this.renderer.drawSnapPreview(intersection);
                } else {
                    // Draw others with subtle style
                    this.renderer.drawIntersectionPreview(intersection);
                }
            });
        }

        // Draw snap preview
        if (visuals.snapPreview && this.mode === 'point') {
            this.renderer.drawSnapPreview(visuals.snapPreview);
        }

        // Draw ghost point if dragging
        if (visuals.ghostPoint) {
            this.renderer.drawGhostPoint(visuals.ghostPoint);
        }

        // Draw points with computed highlights
        this.renderer.drawPoints(
            this.pointLineManager.points,
            visuals.highlightedPoints,
            visuals.ghostPoint?.pointIndex,
            (point) => getPointPosition(point, this.pointLineManager.intersections)
        );

        // Restore context state
        this.ctx.restore();
    }

    getMatroidStats() {
        return this.pointLineManager.getMatroidStats();
    }

    removeNonEssentialLines() {
        this.pointLineManager.removeNonEssentialLines();
        this.draw();
    }

    addIntersectionPoints() {
        const viewportBounds = this.transformManager.getViewportBounds();
        this.pointLineManager.addIntersectionPoints(viewportBounds);
        this.draw();
    }

    async loadConfiguration(configName) {
        const success = await this.pointLineManager.loadConfiguration(configName);
        if (success) {
            this.updateURL();
            this.draw();
        }
        return success;
    }

    /**
     * Load configuration from URL hash
     */
    loadStateFromURL() {
        const hash = window.location.hash.slice(1); // Remove #
        if (hash) {
            const loaded = this.pointLineManager.deserializeState(hash);
            if (loaded) {
                console.log('✅ Loaded configuration from URL');
                this.draw();
            }
        }
    }

    /**
     * Update URL with current state (debounced)
     */
    updateURL() {
        // Debounce to avoid updating URL too frequently
        clearTimeout(this._urlUpdateTimeout);
        this._urlUpdateTimeout = setTimeout(() => {
            const encoded = this.pointLineManager.serializeState();
            const newURL = `${window.location.pathname}#${encoded}`;
            window.history.replaceState(null, '', newURL);
        }, 500);
    }

    /**
     * Get shareable URL for current configuration
     */
    getShareableURL() {
        const encoded = this.pointLineManager.serializeState();
        return `${window.location.origin}${window.location.pathname}#${encoded}`;
    }
}
