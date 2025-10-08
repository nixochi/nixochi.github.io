// canvas-manager.js
// Orchestrates all canvas functionality using specialized managers

import { getPointPosition, computeIntersections } from '../geometry/geometry-utils.js';
import { SnapManager } from '../rendering/snap-manager.js';
import { Renderer } from '../rendering/renderer.js';
import { StateManager } from './state-manager.js';
import { TransformManager } from './transform-manager.js';
import { PointLineManager } from './point-line-manager.js';
import { EventHandler } from './event-handler.js';

// Import new state classes
import { Configuration } from '../state/Configuration.js';
import { InteractionState } from '../state/InteractionState.js';
import { TransformState } from '../state/TransformState.js';
import { UIState } from '../state/UIState.js';
import { HistoryState } from '../state/HistoryState.js';

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Settings
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.pointRadius = this.isTouchDevice ? 14 : 9;
        this.snapThreshold = this.isTouchDevice ? 25 : 15;
        this.clickThreshold = this.isTouchDevice ? 8 : 5;

        // ============================================================================
        // NEW: Initialize state classes (Phase 1)
        // ============================================================================
        this.configuration = new Configuration();
        this.interactionState = new InteractionState();
        this.transformState = new TransformState();
        this.uiState = new UIState();
        this.historyState = new HistoryState();

        // ============================================================================
        // OLD: Keep old managers for compatibility (will be removed in later phases)
        // ============================================================================
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

        // ============================================================================
        // NEW: Wire up observers (Phase 1)
        // ============================================================================
        this.setupObservers();

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

    /**
     * Setup observers for all state classes (Phase 1)
     */
    setupObservers() {
        // Configuration changes → re-render and notify app
        this.configuration.subscribe((event) => {
            console.log('Configuration changed:', event.type);
            this.updateURL();
            this.draw();
            if (this.onStateChange) {
                this.onStateChange();
            }
        });

        // Interaction state changes → re-render
        this.interactionState.subscribe(() => {
            console.log('Interaction state changed');
            this.draw();
        });

        // Transform changes → re-render
        this.transformState.subscribe(() => {
            console.log('Transform changed');
            this.draw();
        });

        // UI state changes → re-render
        this.uiState.subscribe(() => {
            console.log('UI state changed');
            this.draw();
        });

        // History state changes → notify app (for updating undo/redo buttons)
        this.historyState.subscribe(() => {
            console.log('History state changed');
            if (this.onStateChange) {
                this.onStateChange();
            }
        });
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
     * Set ray opacity (called from UI)
     */
    setRayOpacity(opacity) {
        this.rayOpacity = opacity;
        this.draw();
    }

    /**
     * Set color palette (called from UI)
     */
    setColorPalette(palette) {
        this.renderer.setPalette(palette);
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
            visuals.highlightedLines,
            this.pointLineManager.points,
            this.rayOpacity
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

        // Draw snap preview for line endpoint
        if (visuals.lineEndSnap) {
            this.renderer.drawSnapPreview(visuals.lineEndSnap);
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

    /**
     * Undo last action
     */
    undo() {
        const success = this.pointLineManager.history.undo();
        if (success) {
            this.draw();
        }
        return success;
    }

    /**
     * Redo last undone action
     */
    redo() {
        const success = this.pointLineManager.history.redo();
        if (success) {
            this.draw();
        }
        return success;
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.pointLineManager.history.canUndo();
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.pointLineManager.history.canRedo();
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
