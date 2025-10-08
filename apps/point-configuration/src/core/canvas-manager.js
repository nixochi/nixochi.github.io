// canvas-manager.js
// Orchestrates all canvas functionality using specialized managers

import { getPointPosition } from '../geometry/geometry-utils.js';
import { SnapManager } from '../rendering/snap-manager.js';
import { Renderer } from '../rendering/renderer.js';
import { InteractionMode } from '../state/interaction-mode.js';
import { EventHandler } from './event-handler.js';
import pako from 'https://esm.sh/pako@2.1.0';

export class CanvasManager {
    constructor(canvas, models) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Mode
        this.mode = 'point';

        // Settings
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.pointRadius = this.isTouchDevice ? 14 : 9;
        this.snapThreshold = this.isTouchDevice ? 25 : 15;
        this.clickThreshold = this.isTouchDevice ? 8 : 5;
        this.rayOpacity = 1.0; // Default opacity for rays

        // Initialize models
        this.geometryModel = models.geometryModel;
        this.viewportModel = models.viewportModel;
        this.matroidModel = models.matroidModel;
        this.historyModel = models.historyModel;

        this.viewportModel.setCanvas(canvas);

        // Subscribe to model changes
        this.geometryModel.subscribe(() => this.draw());
        this.viewportModel.subscribe(() => this.draw());

        // Create adapters for legacy code
        this.transformManager = this.viewportModel;
        this.pointLineManager = this._createPointLineManagerAdapter();

        // Remaining managers (will be migrated in Phase 3)
        this.stateManager = new InteractionMode();
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
     * Show UI highlights for specific points (called from UI)
     */
    showUIHighlight(pointIndices) {
        this.stateManager.showUIHighlight(pointIndices);
        this.draw();
    }

    /**
     * Clear UI highlights (called from UI)
     */
    clearUIHighlight() {
        this.stateManager.clearUIHighlight();
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
            this.transformManager.centerOrigin();
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
                this.transformManager.centerOrigin();
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

    // ============================================================================
    // Adapter methods for Phase 1 compatibility
    // ============================================================================

    /**
     * Create adapter object that wraps GeometryModel with Configuration interface
     */
    _createPointLineManagerAdapter() {
        const self = this;
        const adapter = {
            // Direct property access
            get points() { return self.geometryModel.points; },
            get lines() { return self.geometryModel.lines; },
            get intersections() { return self.geometryModel.intersections; },
            set points(value) { self.geometryModel.points = value; },
            set lines(value) { self.geometryModel.lines = value; },
            set intersections(value) { self.geometryModel.intersections = value; },

            // Settings (kept for compatibility)
            pointRadius: this.pointRadius,
            hitRadius: this.isTouchDevice ? 24 : 18,
            scale: 1,

            // History adapter
            history: this.historyModel,

            // Callback adapter
            onStateChange: null,

            // Methods that need scale parameter
            updateScale(scale) {
                this.scale = scale;
            },

            getPointsAtPosition(worldX, worldY, threshold = null) {
                const screenThreshold = threshold || this.hitRadius;
                const worldThreshold = screenThreshold / this.scale;
                return self.geometryModel.getPointsAtPosition(worldX, worldY, worldThreshold);
            },

            // Core CRUD methods
            addPoint(x, y, onLines = [], isIntersection = false, intersectionIndex = null) {
                const index = self.geometryModel.addPoint(x, y, onLines, isIntersection, intersectionIndex);
                const newPoint = self.geometryModel.points[index];

                // Record history
                self.historyModel.recordAction(
                    self.historyModel.createAddPointAction(index, newPoint)
                );

                console.log('Added point:', index, 'at', x, y, 'onLines:', onLines, 'intersectionIndex:', intersectionIndex);
                if (this.onStateChange) {
                    this.onStateChange();
                }

                return index;
            },

            addPointWithSnap(snapPreview) {
                if (snapPreview.type === 'intersection') {
                    const intersection = self.geometryModel.intersections[snapPreview.intersectionIndex];
                    this.addPoint(
                        intersection.x,
                        intersection.y,
                        [...intersection.lineIndices],
                        true,
                        snapPreview.intersectionIndex
                    );
                } else if (snapPreview.type === 'line') {
                    this.addPoint(
                        snapPreview.x,
                        snapPreview.y,
                        [snapPreview.lineIndex],
                        false,
                        null
                    );
                } else if (snapPreview.type === 'point') {
                    // Snapping to existing point - create new point at same location (multipoint)
                    const targetPoint = self.geometryModel.points[snapPreview.pointIndex];
                    this.addPoint(
                        snapPreview.x,
                        snapPreview.y,
                        [...targetPoint.onLines],
                        targetPoint.isIntersection,
                        targetPoint.intersectionIndex
                    );
                }
            },

            addLine(startX, startY, endX, endY, startPointIndices = null, endPointIndices = null) {
                // If we're creating a line through existing points, use their actual positions
                let actualStartX = startX;
                let actualStartY = startY;

                if (startPointIndices && startPointIndices.length > 0) {
                    const startPoint = self.geometryModel.points[startPointIndices[0]];
                    const startPos = getPointPosition(startPoint, self.geometryModel.intersections);
                    actualStartX = startPos.x;
                    actualStartY = startPos.y;
                }

                // Calculate angle from actual positions
                const dx = endX - actualStartX;
                const dy = endY - actualStartY;
                const angle = Math.atan2(dy, dx);

                self.geometryModel.lines.push({ x: actualStartX, y: actualStartY, angle });
                const newLineIndex = self.geometryModel.lines.length - 1;

                // Collect all point indices to add to the line
                const allPointIndices = new Set();
                if (startPointIndices) {
                    startPointIndices.forEach(idx => allPointIndices.add(idx));
                }
                if (endPointIndices) {
                    endPointIndices.forEach(idx => allPointIndices.add(idx));
                }

                // Track changes for history (before modification)
                const affectedPoints = [];
                allPointIndices.forEach(pointIndex => {
                    const point = self.geometryModel.points[pointIndex];
                    affectedPoints.push({
                        index: pointIndex,
                        oldOnLines: [...point.onLines],
                        oldIsIntersection: point.isIntersection,
                        oldIntersectionIndex: point.intersectionIndex
                    });
                });

                // Add all points to the line
                allPointIndices.forEach(pointIndex => {
                    const point = self.geometryModel.points[pointIndex];
                    if (!point.onLines.includes(newLineIndex)) {
                        point.onLines.push(newLineIndex);
                        point.isIntersection = point.onLines.length > 1;
                    }
                });

                // Recompute intersections
                self.geometryModel.recomputeIntersections();

                // Record history
                self.historyModel.recordAction(
                    self.historyModel.createAddLineAction(
                        newLineIndex,
                        self.geometryModel.lines[newLineIndex],
                        affectedPoints
                    )
                );

                console.log('Added line:', newLineIndex, 'angle:', angle, 'startPoints:', startPointIndices, 'endPoints:', endPointIndices);
                if (this.onStateChange) {
                    this.onStateChange();
                }

                return newLineIndex;
            },

            removePoint(index) {
                const result = self.geometryModel.removePoint(index);
                if (result && this.onStateChange) {
                    this.onStateChange();
                }
                return result;
            },

            removeLine(index) {
                const result = self.geometryModel.removeLine(index);
                if (result && this.onStateChange) {
                    this.onStateChange();
                }
                return result;
            },

            // Additional methods from Configuration
            removeNonEssentialLines() {
                // Count points on each line
                const pointsPerLine = new Array(self.geometryModel.lines.length).fill(0);

                for (const point of self.geometryModel.points) {
                    for (const lineIndex of point.onLines) {
                        pointsPerLine[lineIndex]++;
                    }
                }

                // Find lines with fewer than 3 points
                const linesToRemove = new Set();
                for (let i = 0; i < self.geometryModel.lines.length; i++) {
                    if (pointsPerLine[i] < 3) {
                        linesToRemove.add(i);
                    }
                }

                if (linesToRemove.size === 0) {
                    return;
                }

                // Create index mapping (old index -> new index)
                const indexMap = new Map();
                let newIndex = 0;
                for (let i = 0; i < self.geometryModel.lines.length; i++) {
                    if (!linesToRemove.has(i)) {
                        indexMap.set(i, newIndex);
                        newIndex++;
                    }
                }

                // Remove lines
                self.geometryModel.lines = self.geometryModel.lines.filter((_, i) => !linesToRemove.has(i));

                // Update point line memberships
                for (const point of self.geometryModel.points) {
                    point.onLines = point.onLines
                        .filter(lineIndex => !linesToRemove.has(lineIndex))
                        .map(lineIndex => indexMap.get(lineIndex));
                    point.isIntersection = point.onLines.length > 1;
                }

                // Recompute intersections
                self.geometryModel.recomputeIntersections();

                if (this.onStateChange) {
                    this.onStateChange();
                }
            },

            addIntersectionPoints(viewportBounds) {
                if (self.geometryModel.intersections.length === 0) {
                    return;
                }

                let addedCount = 0;

                // Check each intersection
                for (let i = 0; i < self.geometryModel.intersections.length; i++) {
                    const intersection = self.geometryModel.intersections[i];

                    // Check if intersection is in viewport
                    if (intersection.x < viewportBounds.left || intersection.x > viewportBounds.right ||
                        intersection.y < viewportBounds.top || intersection.y > viewportBounds.bottom) {
                        continue;
                    }

                    // Check if there's already a point at this intersection
                    const existingPoints = this.getPointsAtPosition(intersection.x, intersection.y, 1);

                    if (existingPoints.length === 0) {
                        // No point exists, add one with all the lines from this intersection
                        this.addPoint(
                            intersection.x,
                            intersection.y,
                            [...intersection.lineIndices],
                            true,
                            i
                        );
                        addedCount++;
                    }
                }

                if (addedCount > 0 && this.onStateChange) {
                    this.onStateChange();
                }
            },

            getMatroidStats() {
                return self.matroidModel.getStats();
            },

            serializeState() {
                const precision = 1;
                const state = this._createCompactState(precision);

                // Convert to JSON and compress
                const jsonStr = JSON.stringify(state);

                // Compress with pako
                const compressed = pako.deflate(jsonStr, { level: 9 });

                // Convert to base64url (URL-safe base64)
                const base64 = btoa(String.fromCharCode.apply(null, compressed))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                console.log(`Serialized state: ${jsonStr.length} chars → ${base64.length} chars (${Math.round(base64.length / jsonStr.length * 100)}% of original)`);

                return base64;
            },

            _createCompactState(precision) {
                const factor = Math.pow(10, precision);

                return {
                    p: self.geometryModel.points.map(p => [
                        Math.round(p.x * factor) / factor,
                        Math.round(p.y * factor) / factor,
                        p.onLines
                    ]),
                    l: self.geometryModel.lines.map(l => [
                        Math.round(l.x * factor) / factor,
                        Math.round(l.y * factor) / factor,
                        Math.round(l.angle * 10000) / 10000 // 4 decimals for angles
                    ])
                };
            },

            deserializeState(encoded) {
                if (!encoded) return false;

                try {
                    // Convert base64url to base64
                    let base64 = encoded
                        .replace(/-/g, '+')
                        .replace(/_/g, '/');

                    // Add padding if needed
                    while (base64.length % 4) {
                        base64 += '=';
                    }

                    // Try to decompress (assume it's compressed)
                    let jsonStr;
                    try {
                        const binaryString = atob(base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        const decompressed = pako.inflate(bytes, { to: 'string' });
                        jsonStr = decompressed;
                    } catch (e) {
                        // Not compressed, try direct decode
                        jsonStr = atob(base64);
                    }

                    const state = JSON.parse(jsonStr);

                    // Restore from compact format
                    self.geometryModel.points = state.p.map(([x, y, onLines]) => ({
                        x,
                        y,
                        onLines,
                        isIntersection: onLines.length > 1,
                        intersectionIndex: null
                    }));

                    self.geometryModel.lines = state.l.map(([x, y, angle]) => ({
                        x,
                        y,
                        angle
                    }));

                    // Recompute intersections
                    self.geometryModel.recomputeIntersections();

                    // Clear history when loading from URL
                    self.historyModel.clear();

                    console.log(`✅ Loaded configuration: ${self.geometryModel.points.length} points, ${self.geometryModel.lines.length} lines`);

                    return true;
                } catch (e) {
                    console.error('Failed to deserialize state:', e);
                    return false;
                }
            },

            async loadConfiguration(configName) {
                try {
                    const response = await fetch('src/examples/examples.json');
                    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

                    const examples = await response.json();
                    const config = examples[configName];
                    if (!config) throw new Error(`Configuration '${configName}' not found`);

                    // Parse points from compact format [x, y, [lines]]
                    self.geometryModel.points = config.points.map(([x, y, onLines]) => ({
                        x,
                        y,
                        onLines,
                        isIntersection: onLines.length > 1,
                        intersectionIndex: null
                    }));

                    // Compute lines from points
                    const linePoints = new Map();
                    self.geometryModel.points.forEach((point, idx) => {
                        point.onLines.forEach(lineIdx => {
                            if (!linePoints.has(lineIdx)) linePoints.set(lineIdx, []);
                            linePoints.get(lineIdx).push(idx);
                        });
                    });

                    self.geometryModel.lines = [];
                    linePoints.forEach((pointIndices, lineIdx) => {
                        if (pointIndices.length < 2) throw new Error(`Line ${lineIdx} has < 2 points`);
                        const p1 = self.geometryModel.points[pointIndices[0]];
                        const p2 = self.geometryModel.points[pointIndices[1]];
                        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                        self.geometryModel.lines[lineIdx] = { x: p1.x, y: p1.y, angle };
                    });

                    // Compute intersections
                    self.geometryModel.recomputeIntersections();

                    // Clear history when loading a configuration
                    self.historyModel.clear();

                    console.log(`✅ Loaded ${config.name}: ${self.geometryModel.points.length} points, ${self.geometryModel.lines.length} lines`);

                    if (this.onStateChange) {
                        this.onStateChange();
                    }

                    return true;
                } catch (e) {
                    console.error('Failed to load configuration:', e);
                    return false;
                }
            }
        };

        return adapter;
    }
}
