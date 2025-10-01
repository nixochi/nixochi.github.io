// canvas-manager.js

import { computeAllIntersections } from './geometry-utils.js';
import { SnapManager } from './snap-manager.js';
import { Renderer } from './renderer.js';
import { PointLineMatroid } from './matroid.js';

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // State
        this.points = []; // Array of {x, y, onLines: [], isIntersection: boolean}
        this.lines = []; // Array of {x, y, angle} - infinite lines through point with angle
        this.intersections = []; // Array of {x, y, lineIndices: [i, j]}
        this.mode = 'point';

        // Pan state
        this.offsetX = 0;
        this.offsetY = 0;

        // State machine - replaces all boolean flags
        this.interactionState = {
            type: 'idle', // 'idle' | 'dragging-point' | 'drawing-line' | 'panning' | 'placing-point'
            data: null
        };

        // Mouse tracking for visual derivation
        this.currentMousePos = null; // {worldX, worldY, screenX, screenY}
        this.mouseDownPos = null; // {worldX, worldY, screenX, screenY, time}
        this.capturedSnapPreview = null; // Snap preview captured on mousedown for point placement

        // External state inputs (from UI)
        this.hoveredPointIndices = null; // Set from UI hover events

        // Settings
        this.pointRadius = 9;
        this.snapThreshold = 15;
        this.clickThreshold = 5;

        // Initialize modules
        this.snapManager = new SnapManager(15, 20); // intersectionSnapThreshold, lineSnapThreshold
        this.renderer = new Renderer(canvas, this.ctx);

        // Callback for state changes
        this.onStateChange = null;

        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
        this.draw();
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.draw();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
    }

    /**
     * State machine transition helper
     */
    transitionState(newType, newData = null) {
        this.interactionState = { type: newType, data: newData };
    }

    /**
     * Visual derivation layer - computes what should be visible
     * Pure function of current state + inputs
     */
    computeVisualState() {
        const state = this.interactionState;
        const visuals = {
            snapPreview: null,
            highlightedPoints: new Set(),
            highlightedLines: new Set(),
            previewLine: null,
            ghostPoint: null
        };

        // Compute based on current state
        switch (state.type) {
            case 'idle':
                // In idle mode with point mode, show snap preview
                if (this.mode === 'point' && this.currentMousePos) {
                    visuals.snapPreview = this.snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        this.intersections,
                        this.lines,
                        this.points
                    );

                    // Highlight lines involved in snap
                    if (visuals.snapPreview) {
                        if (visuals.snapPreview.type === 'line') {
                            visuals.highlightedLines.add(visuals.snapPreview.lineIndex);
                        } else if (visuals.snapPreview.type === 'intersection') {
                            const intersection = this.intersections[visuals.snapPreview.intersectionIndex];
                            intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                        }
                    }
                }

                // UI hover highlights (only in idle state)
                if (this.hoveredPointIndices) {
                    this.hoveredPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
                }
                break;

            case 'dragging-point':
                // Ensure point is at original position for snap calculation
                const draggedPoint = this.points[state.data.pointIndex];
                const tempX = draggedPoint.x;
                const tempY = draggedPoint.y;
                draggedPoint.x = state.data.originalX;
                draggedPoint.y = state.data.originalY;

                // Compute snap at current mouse position (with point at original position)
                if (this.currentMousePos) {
                    visuals.snapPreview = this.snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        this.intersections,
                        this.lines,
                        this.points
                    );

                    // Determine ghost position from snap
                    if (visuals.snapPreview) {
                        visuals.ghostPoint = {
                            x: visuals.snapPreview.x,
                            y: visuals.snapPreview.y,
                            pointIndex: state.data.pointIndex
                        };

                        // Highlight lines involved in snap
                        if (visuals.snapPreview.type === 'line') {
                            visuals.highlightedLines.add(visuals.snapPreview.lineIndex);
                        } else if (visuals.snapPreview.type === 'intersection') {
                            const intersection = this.intersections[visuals.snapPreview.intersectionIndex];
                            intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                        }
                    } else {
                        // No snap, ghost at mouse position
                        visuals.ghostPoint = {
                            x: this.currentMousePos.worldX,
                            y: this.currentMousePos.worldY,
                            pointIndex: state.data.pointIndex
                        };
                    }
                }

                // Restore temporary position
                draggedPoint.x = tempX;
                draggedPoint.y = tempY;

                // No UI hover highlights while dragging
                break;

            case 'drawing-line':
                // Show preview line
                if (state.data && this.currentMousePos) {
                    const hasMoved = this.mouseDownPos &&
                        Math.hypot(
                            this.currentMousePos.screenX - this.mouseDownPos.screenX,
                            this.currentMousePos.screenY - this.mouseDownPos.screenY
                        ) > this.clickThreshold;

                    if (hasMoved) {
                        visuals.previewLine = {
                            startX: state.data.startX,
                            startY: state.data.startY,
                            endX: this.currentMousePos.worldX,
                            endY: this.currentMousePos.worldY
                        };
                    }
                }
                // No snap preview or highlights while drawing line
                break;

            case 'placing-point':
                // Show the captured snap preview
                if (this.capturedSnapPreview) {
                    visuals.snapPreview = this.capturedSnapPreview;

                    // Highlight lines involved in captured snap
                    if (this.capturedSnapPreview.type === 'line') {
                        visuals.highlightedLines.add(this.capturedSnapPreview.lineIndex);
                    } else if (this.capturedSnapPreview.type === 'intersection') {
                        const intersection = this.intersections[this.capturedSnapPreview.intersectionIndex];
                        intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                    }
                }
                break;

            case 'panning':
                // No visual overlays while panning
                break;
        }

        return visuals;
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;

        // Store mouse down position
        this.mouseDownPos = { worldX, worldY, screenX, screenY, time: Date.now() };

        if (this.mode === 'line') {
            // Transition to drawing-line state
            this.transitionState('drawing-line', {
                startX: worldX,
                startY: worldY
            });
            this.canvas.style.cursor = 'crosshair';
        } else {
            // Point mode logic
            const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);

            if (pointsAtPosition.length > 0) {
                // Start dragging a point
                const pointIndex = pointsAtPosition.length === 1
                    ? pointsAtPosition[0]
                    : Math.max(...pointsAtPosition);

                // Store original position for ghost preview
                const originalPoint = this.points[pointIndex];
                this.transitionState('dragging-point', {
                    pointIndex,
                    originalX: originalPoint.x,
                    originalY: originalPoint.y
                });
                this.canvas.style.cursor = 'grabbing';
            } else {
                // Clicking empty space - capture the current snap preview for point placement
                const visuals = this.computeVisualState();
                this.capturedSnapPreview = visuals.snapPreview;

                // Transition to placing-point state (may become panning if dragged)
                this.transitionState('placing-point', {
                    startOffsetX: this.offsetX,
                    startOffsetY: this.offsetY
                });
                this.canvas.style.cursor = 'crosshair';
            }
        }

        this.draw();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;

        // Update current mouse position for visual derivation
        this.currentMousePos = { worldX, worldY, screenX, screenY };

        const state = this.interactionState;

        switch (state.type) {
            case 'idle':
                // Just redraw to update snap preview
                this.draw();
                break;

            case 'placing-point':
                // Check if user is dragging (transition to panning if so)
                const dragDist = Math.hypot(
                    screenX - this.mouseDownPos.screenX,
                    screenY - this.mouseDownPos.screenY
                );

                if (dragDist > this.clickThreshold) {
                    // Transition to panning - user is dragging, not placing
                    this.capturedSnapPreview = null; // Clear captured snap
                    this.transitionState('panning', {
                        startOffsetX: state.data.startOffsetX,
                        startOffsetY: state.data.startOffsetY
                    });
                    this.canvas.style.cursor = 'grabbing';
                }

                this.draw();
                break;

            case 'dragging-point':
                // Just redraw - computeVisualState will create ghost preview
                this.draw();
                break;

            case 'drawing-line':
                // Just redraw to update preview line
                this.draw();
                break;

            case 'panning':
                // Update pan offset
                const dx = screenX - this.mouseDownPos.screenX;
                const dy = screenY - this.mouseDownPos.screenY;
                this.offsetX = state.data.startOffsetX + dx;
                this.offsetY = state.data.startOffsetY + dy;
                this.draw();
                break;
        }
    }
    
    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;

        const state = this.interactionState;

        // Check if this was a click (minimal movement)
        const isClick = this.mouseDownPos &&
            Math.hypot(
                screenX - this.mouseDownPos.screenX,
                screenY - this.mouseDownPos.screenY
            ) <= this.clickThreshold;

        switch (state.type) {
            case 'drawing-line':
                if (!isClick) {
                    // Add the line
                    this.addLine(state.data.startX, state.data.startY, worldX, worldY);
                }
                break;

            case 'placing-point':
                // Place the point using the captured snap preview
                if (this.capturedSnapPreview) {
                    this.addPointWithSnap(this.capturedSnapPreview);
                } else {
                    // No snap, add point at mouse position
                    const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
                    if (pointsAtPosition.length === 0) {
                        this.addPoint(worldX, worldY, [], false);
                    }
                }
                break;

            case 'dragging-point':
                // Finalize dragged point
                const point = this.points[state.data.pointIndex];

                // If it was just a click (not a drag), restore original position
                if (isClick) {
                    point.x = state.data.originalX;
                    point.y = state.data.originalY;
                } else {
                    // Get final ghost position from visuals
                    const visuals = this.computeVisualState();

                    if (visuals.ghostPoint) {
                        // Apply ghost position to actual point
                        point.x = visuals.ghostPoint.x;
                        point.y = visuals.ghostPoint.y;

                        // Update line memberships if snapped
                        if (visuals.snapPreview) {
                            if (visuals.snapPreview.type === 'intersection') {
                                const intersection = this.intersections[visuals.snapPreview.intersectionIndex];
                                point.onLines = [...new Set([...point.onLines, ...intersection.lineIndices])];
                                point.isIntersection = true;
                            } else if (visuals.snapPreview.type === 'line') {
                                if (!point.onLines.includes(visuals.snapPreview.lineIndex)) {
                                    point.onLines.push(visuals.snapPreview.lineIndex);
                                }
                                point.isIntersection = point.onLines.length > 1;
                            } else if (visuals.snapPreview.type === 'point') {
                                // Snapped to another point - merge line memberships
                                const snapTarget = this.points[visuals.snapPreview.pointIndex];
                                point.onLines = [...new Set([...point.onLines, ...snapTarget.onLines])];
                                point.isIntersection = point.onLines.length > 1;
                            }
                        }
                    } else {
                        // No ghost (shouldn't happen), restore original
                        point.x = state.data.originalX;
                        point.y = state.data.originalY;
                    }

                    if (this.onStateChange) {
                        this.onStateChange();
                    }
                }
                break;

            case 'panning':
                // Panning complete, nothing to finalize
                break;

            case 'idle':
                // Should not happen, but handle gracefully
                break;
        }

        // Clear captured snap and transition back to idle
        this.capturedSnapPreview = null;
        this.transitionState('idle');
        this.canvas.style.cursor = 'crosshair';
        this.draw();
    }
    
    handleMouseLeave(e) {
        // Clear all transient state
        this.currentMousePos = null;
        this.capturedSnapPreview = null;

        // If actively interacting, treat as mouseup
        if (this.interactionState.type !== 'idle') {
            this.handleMouseUp(e);
        } else {
            // Just redraw to clear any snap previews
            this.draw();
        }
    }
    
    getPointsAtPosition(worldX, worldY, threshold = null) {
        const checkThreshold = threshold || this.pointRadius + 5;
        const indices = [];
        
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= checkThreshold) {
                indices.push(i);
            }
        }
        
        return indices;
    }
    
    addPoint(x, y, onLines = [], isIntersection = false) {
        this.points.push({ x, y, onLines, isIntersection });
        this.draw();
        console.log('Added point:', this.points.length - 1, 'at', x, y, 'onLines:', onLines);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    addPointWithSnap(snapPreview) {
        if (snapPreview.type === 'intersection') {
            const intersection = this.intersections[snapPreview.intersectionIndex];
            this.addPoint(
                intersection.x,
                intersection.y,
                [...intersection.lineIndices],
                true
            );
        } else if (snapPreview.type === 'line') {
            this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [snapPreview.lineIndex],
                false
            );
        }
    }
    
    addLine(startX, startY, endX, endY) {
        // Store line as angle and point (infinite line representation)
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);

        this.lines.push({ x: startX, y: startY, angle });

        // Recompute all intersections
        this.computeIntersections();

        this.draw();
        console.log('Added line:', this.lines.length - 1, 'angle:', angle);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        this.transitionState('idle');
        this.canvas.style.cursor = 'crosshair';
        this.draw();
    }

    /**
     * Set which points should be highlighted (called from UI)
     */
    setHoveredPoints(pointIndices) {
        this.hoveredPointIndices = pointIndices ? new Set(pointIndices) : null;
        this.draw();
    }

    /**
     * Clear hovered points
     */
    clearHoveredPoints() {
        this.hoveredPointIndices = null;
        this.draw();
    }
    
    draw() {
        // Derive visual state from current conditions
        const visuals = this.computeVisualState();

        // Clear canvas
        this.renderer.clear();

        // Save context state
        this.ctx.save();

        // Apply pan transformation
        this.ctx.translate(this.offsetX, this.offsetY);

        // Draw grid dots
        this.renderer.drawGridDots(this.offsetX, this.offsetY);

        // Draw lines with computed highlights
        this.renderer.drawLines(
            this.lines,
            this.offsetX,
            this.offsetY,
            visuals.snapPreview,
            this.intersections,
            visuals.highlightedLines
        );

        // Draw preview line if in drawing-line state
        if (visuals.previewLine) {
            this.renderer.drawPreviewLine(
                visuals.previewLine.startX,
                visuals.previewLine.startY,
                visuals.previewLine.endX,
                visuals.previewLine.endY,
                this.offsetX,
                this.offsetY
            );
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
        this.renderer.drawPoints(this.points, visuals.highlightedPoints, visuals.ghostPoint?.pointIndex);

        // Restore context state
        this.ctx.restore();
    }
    
    computeIntersections() {
        this.intersections = computeAllIntersections(this.lines);
        console.log('Computed', this.intersections.length, 'intersections');
    }

    getMatroidStats() {
        if (this.points.length === 0) {
            return null;
        }

        const matroid = new PointLineMatroid(this.points, this.lines);

        return {
            rank: matroid.rank,
            numPoints: this.points.length,
            numLines: this.lines.length,
            bases: matroid.getAllBases(),
            circuits: matroid.getAllCircuits(),
            flats: matroid.getAllFlats()
        };
    }

    removeNonEssentialLines() {
        // Count points on each line
        const pointsPerLine = new Array(this.lines.length).fill(0);

        for (const point of this.points) {
            for (const lineIndex of point.onLines) {
                pointsPerLine[lineIndex]++;
            }
        }

        // Find lines with fewer than 3 points
        const linesToRemove = new Set();
        for (let i = 0; i < this.lines.length; i++) {
            if (pointsPerLine[i] < 3) {
                linesToRemove.add(i);
            }
        }

        if (linesToRemove.size === 0) {
            console.log('No non-essential lines to remove');
            return;
        }

        // Create index mapping (old index -> new index)
        const indexMap = new Map();
        let newIndex = 0;
        for (let i = 0; i < this.lines.length; i++) {
            if (!linesToRemove.has(i)) {
                indexMap.set(i, newIndex);
                newIndex++;
            }
        }

        // Remove lines
        this.lines = this.lines.filter((_, i) => !linesToRemove.has(i));

        // Update point line memberships
        for (const point of this.points) {
            point.onLines = point.onLines
                .filter(lineIndex => !linesToRemove.has(lineIndex))
                .map(lineIndex => indexMap.get(lineIndex));
            point.isIntersection = point.onLines.length > 1;
        }

        // Recompute intersections
        this.computeIntersections();

        console.log('Removed', linesToRemove.size, 'non-essential lines');
        this.draw();

        if (this.onStateChange) {
            this.onStateChange();
        }
    }
}