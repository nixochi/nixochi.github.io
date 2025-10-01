// canvas-manager.js

import { getPointPosition, findIntersectionByLines, computeIntersections } from './geometry-utils.js';
import { SnapManager } from './snap-manager.js';
import { Renderer } from './renderer.js';
import { PointLineMatroid } from './matroid.js';

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // State
        this.points = []; // Array of {x, y, onLines: [], isIntersection: boolean, intersectionIndex: null}
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
        this.canvasHoveredPointIndices = null; // Points hovered on canvas (for line mode)

        // Settings
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.pointRadius = this.isTouchDevice ? 14 : 9;
        this.snapThreshold = this.isTouchDevice ? 25 : 15;
        this.clickThreshold = this.isTouchDevice ? 8 : 5;

        // Zoom state
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;

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
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });
    }

    /**
     * State machine transition helper
     */
    transitionState(newType, newData = null) {
        this.interactionState = { type: newType, data: newData };
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

        this.draw();
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
            ghostPoint: null,
            lineEndSnap: null,
            allLineIntersections: [] // All preview line intersections to show
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
                        this.points,
                        this.scale
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

                // In line mode, highlight hovered points (entire multipoint)
                if (this.mode === 'line' && this.canvasHoveredPointIndices) {
                    this.canvasHoveredPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
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
                        this.points,
                        this.scale
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
                // Show preview line with endpoint snapping
                if (state.data && this.currentMousePos) {
                    // Use larger threshold for line preview to ensure stable angle
                    const dragDistance = this.mouseDownPos ? Math.hypot(
                        this.currentMousePos.screenX - this.mouseDownPos.screenX,
                        this.currentMousePos.screenY - this.mouseDownPos.screenY
                    ) : 0;
                    const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);
                    const hasMoved = dragDistance > linePreviewThreshold;

                    if (hasMoved) {
                        // Check for endpoint snap and all intersections
                        const snapResult = this.snapManager.findLineEndpointSnap(
                            state.data.startX,
                            state.data.startY,
                            this.currentMousePos.worldX,
                            this.currentMousePos.worldY,
                            this.points,
                            this.intersections,
                            this.getViewportBounds(),
                            this.scale
                        );

                        if (snapResult) {
                            visuals.lineEndSnap = snapResult.snapTarget;
                            visuals.allLineIntersections = snapResult.allIntersections;

                            visuals.previewLine = {
                                startX: state.data.startX,
                                startY: state.data.startY,
                                endX: snapResult.snapTarget.x,
                                endY: snapResult.snapTarget.y
                            };

                            // Highlight ALL intersections
                            snapResult.allIntersections.forEach(intersection => {
                                if (intersection.type === 'multipoint') {
                                    intersection.pointIndices.forEach(idx => {
                                        visuals.highlightedPoints.add(idx);
                                        // Also highlight all lines that these points are on
                                        const point = this.points[idx];
                                        point.onLines.forEach(lineIdx => visuals.highlightedLines.add(lineIdx));
                                    });
                                } else if (intersection.type === 'intersection') {
                                    intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                                }
                            });
                        } else {
                            visuals.previewLine = {
                                startX: state.data.startX,
                                startY: state.data.startY,
                                endX: this.currentMousePos.worldX,
                                endY: this.currentMousePos.worldY
                            };
                        }
                    }
                }

                // Highlight the starting points that the line is being created from
                if (state.data.startPointIndices) {
                    state.data.startPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
                }
                break;

            case 'dragging-new-point':
                // Show ghost point for new point being placed (with snapping)
                if (this.currentMousePos) {
                    // Compute snap at current mouse position
                    visuals.snapPreview = this.snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        this.intersections,
                        this.lines,
                        this.points,
                        this.scale
                    );

                    // Determine ghost position from snap
                    if (visuals.snapPreview) {
                        visuals.ghostPoint = {
                            x: visuals.snapPreview.x,
                            y: visuals.snapPreview.y,
                            pointIndex: -1 // Marker for new point (not existing)
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
                            pointIndex: -1
                        };
                    }
                }
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
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        // Store mouse down position and current position (prevents phantom line previews)
        this.mouseDownPos = { worldX, worldY, screenX, screenY, time: Date.now() };
        this.currentMousePos = { worldX, worldY, screenX, screenY };

        // Clear UI hover highlights when interacting with canvas
        this.hoveredPointIndices = null;

        if (this.mode === 'line') {
            // Check if starting from a hovered multipoint
            let startX = worldX;
            let startY = worldY;
            let startPointIndices = null;

            if (this.canvasHoveredPointIndices) {
                // Use the first point's position (all points in multipoint are at same location)
                const hoveredPoint = this.points[this.canvasHoveredPointIndices[0]];
                startX = hoveredPoint.x;
                startY = hoveredPoint.y;
                startPointIndices = [...this.canvasHoveredPointIndices];
            }

            // Transition to drawing-line state
            this.transitionState('drawing-line', {
                startX,
                startY,
                startPointIndices
            });
            this.canvas.style.cursor = 'crosshair';
        } else {
            // Point mode logic
            const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);

            if (pointsAtPosition.length > 0) {
                // Start dragging an existing point
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
                // Clicking empty space - start dragging a new point (with snapping)
                this.transitionState('dragging-new-point', {
                    startWorldX: worldX,
                    startWorldY: worldY
                });
                this.canvas.style.cursor = 'crosshair';
            }
        }

        this.draw();
    }
    
    handleMouseMove(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        // Update current mouse position for visual derivation
        this.currentMousePos = { worldX, worldY, screenX, screenY };

        const state = this.interactionState;

        switch (state.type) {
            case 'idle':
                // In line mode, update canvas hover for point detection (capture entire multipoint)
                if (this.mode === 'line') {
                    const hoveredPoints = this.getPointsAtPosition(worldX, worldY);
                    this.canvasHoveredPointIndices = hoveredPoints.length > 0 ? hoveredPoints : null;
                }

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

            case 'dragging-new-point':
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
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        const state = this.interactionState;

        // Check if this was a click (minimal movement)
        const isClick = this.mouseDownPos &&
            Math.hypot(
                screenX - this.mouseDownPos.screenX,
                screenY - this.mouseDownPos.screenY
            ) <= this.clickThreshold;

        switch (state.type) {
            case 'drawing-line':
                // Use same threshold as line preview - need sufficient drag to create line
                const dragDistance = this.mouseDownPos ? Math.hypot(
                    screenX - this.mouseDownPos.screenX,
                    screenY - this.mouseDownPos.screenY
                ) : 0;
                const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);

                if (dragDistance > linePreviewThreshold) {
                    // Get visual state to check for endpoint snap
                    const visuals = this.computeVisualState();

                    let endX = worldX;
                    let endY = worldY;
                    let endPointIndices = null;

                    // If snapped to endpoint, use snap position and points
                    if (visuals.lineEndSnap) {
                        endX = visuals.lineEndSnap.x;
                        endY = visuals.lineEndSnap.y;

                        // Only add points if snapping to multipoint (not intersection)
                        if (visuals.lineEndSnap.type === 'multipoint') {
                            endPointIndices = visuals.lineEndSnap.pointIndices;
                        }
                    }

                    // Add the line with start and end point indices
                    this.addLine(
                        state.data.startX,
                        state.data.startY,
                        endX,
                        endY,
                        state.data.startPointIndices,
                        endPointIndices
                    );
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
                                point.intersectionIndex = visuals.snapPreview.intersectionIndex;
                            } else if (visuals.snapPreview.type === 'line') {
                                if (!point.onLines.includes(visuals.snapPreview.lineIndex)) {
                                    point.onLines.push(visuals.snapPreview.lineIndex);
                                }
                                point.isIntersection = point.onLines.length > 1;

                                // Update intersectionIndex if now on 2+ lines
                                if (point.onLines.length >= 2) {
                                    point.intersectionIndex = findIntersectionByLines(point.onLines, this.intersections);
                                } else {
                                    point.intersectionIndex = null;
                                }
                            } else if (visuals.snapPreview.type === 'point') {
                                // Snapped to another point - merge line memberships
                                const snapTarget = this.points[visuals.snapPreview.pointIndex];
                                point.onLines = [...new Set([...point.onLines, ...snapTarget.onLines])];
                                point.isIntersection = point.onLines.length > 1;

                                // Update intersectionIndex if now on 2+ lines
                                if (point.onLines.length >= 2) {
                                    point.intersectionIndex = findIntersectionByLines(point.onLines, this.intersections);
                                    // Snap to intersection position
                                    if (point.intersectionIndex !== null) {
                                        const intersection = this.intersections[point.intersectionIndex];
                                        point.x = intersection.x;
                                        point.y = intersection.y;
                                    }
                                } else {
                                    point.intersectionIndex = null;
                                }
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

            case 'dragging-new-point':
                // Check if this was a click (no drag) or actual drag
                if (isClick) {
                    // Quick tap - create point at initial position with snap
                    const snapPreview = this.snapManager.updateSnapPreview(
                        state.data.startWorldX,
                        state.data.startWorldY,
                        this.intersections,
                        this.lines,
                        this.points,
                        this.scale
                    );

                    if (snapPreview) {
                        this.addPointWithSnap(snapPreview);
                    } else {
                        const pointsAtPosition = this.getPointsAtPosition(state.data.startWorldX, state.data.startWorldY);
                        if (pointsAtPosition.length === 0) {
                            this.addPoint(state.data.startWorldX, state.data.startWorldY, [], false);
                        }
                    }
                } else {
                    // Dragged - create point at final ghost position
                    const visuals = this.computeVisualState();

                    if (visuals.ghostPoint) {
                        // Create point at ghost position
                        if (visuals.snapPreview) {
                            // Snapped to something, use addPointWithSnap
                            this.addPointWithSnap(visuals.snapPreview);
                        } else {
                            // Not snapped, create point at ghost position
                            const pointsAtPosition = this.getPointsAtPosition(visuals.ghostPoint.x, visuals.ghostPoint.y);
                            if (pointsAtPosition.length === 0) {
                                this.addPoint(visuals.ghostPoint.x, visuals.ghostPoint.y, [], false);
                            }
                        }
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

        // Clear captured snap and canvas hover and transition back to idle
        this.capturedSnapPreview = null;
        this.canvasHoveredPointIndices = null;
        this.transitionState('idle');
        this.canvas.style.cursor = 'crosshair';
        this.draw();
    }
    
    handleMouseLeave(e) {
        // Clear all transient state
        this.currentMousePos = null;
        this.capturedSnapPreview = null;
        this.canvasHoveredPointIndices = null;

        // If actively interacting, treat as mouseup
        if (this.interactionState.type !== 'idle') {
            this.handleMouseUp(e);
        } else {
            // Just redraw to clear any snap previews
            this.draw();
        }
    }

    handleWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Zoom in or out based on wheel delta
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomAt(screenX, screenY, delta);
    }

    handleTouchStart(e) {
        e.preventDefault();

        // Two-finger gesture (pan/zoom)
        if (e.touches.length === 2) {
            const gestureInfo = this.getTouchGestureInfo(e.touches);
            this.transitionState('two-finger-gesture', {
                startOffsetX: this.offsetX,
                startOffsetY: this.offsetY,
                startScale: this.scale,
                initialDistance: gestureInfo.distance,
                initialCenterX: gestureInfo.centerX,
                initialCenterY: gestureInfo.centerY
            });
            return;
        }

        // Single touch - treat as mouse down
        if (e.touches.length === 1) {
            this.handleMouseDown(e);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        // Two-finger gesture (pan/zoom)
        if (e.touches.length === 2 && this.interactionState.type === 'two-finger-gesture') {
            const gestureInfo = this.getTouchGestureInfo(e.touches);
            const state = this.interactionState.data;

            // Calculate zoom scale factor from distance ratio (with damping)
            const distanceRatio = gestureInfo.distance / state.initialDistance;
            const zoomSensitivity = 0.6; // Damping factor (0-1, lower = less sensitive)
            const scaleFactor = 1 + (distanceRatio - 1) * zoomSensitivity;
            const targetScale = state.startScale * scaleFactor;
            const newScale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));

            // Calculate world position at initial center (this should stay fixed during zoom)
            const worldX = (state.initialCenterX - state.startOffsetX) / state.startScale;
            const worldY = (state.initialCenterY - state.startOffsetY) / state.startScale;

            // Calculate new offset for zoom (keeps world point under initial center)
            const newOffsetX = state.initialCenterX - worldX * newScale;
            const newOffsetY = state.initialCenterY - worldY * newScale;

            // Add pan from center movement
            const panDx = gestureInfo.centerX - state.initialCenterX;
            const panDy = gestureInfo.centerY - state.initialCenterY;

            // Apply combined transform
            this.scale = newScale;
            this.offsetX = newOffsetX + panDx;
            this.offsetY = newOffsetY + panDy;

            this.draw();
            return;
        }

        // Single touch - treat as mouse move
        if (e.touches.length === 1) {
            this.handleMouseMove(e);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        // End of two-finger gesture
        if (this.interactionState.type === 'two-finger-gesture') {
            this.transitionState('idle');
            this.canvas.style.cursor = 'crosshair';
            this.draw();
            return;
        }

        // Single touch - treat as mouse up
        this.handleMouseUp(e);
    }

    handleTouchCancel(e) {
        e.preventDefault();

        // Treat as mouse leave
        this.handleMouseLeave(e);
    }
    
    getPointsAtPosition(worldX, worldY, threshold = null) {
        // Convert screen-space threshold to world-space (uses pointRadius + 5 as screen pixels)
        const screenThreshold = threshold || (this.pointRadius + 5);
        const worldThreshold = screenThreshold / this.scale;
        const indices = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const pos = getPointPosition(point, this.intersections);
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= worldThreshold) {
                indices.push(i);
            }
        }

        return indices;
    }
    
    addPoint(x, y, onLines = [], isIntersection = false, intersectionIndex = null) {
        // If on 2+ lines and no intersection index provided, find it
        if (onLines.length >= 2 && intersectionIndex === null) {
            intersectionIndex = findIntersectionByLines(onLines, this.intersections);
        }

        // If on 2+ lines, must reference an intersection
        if (onLines.length >= 2 && intersectionIndex !== null) {
            const intersection = this.intersections[intersectionIndex];
            this.points.push({
                x: intersection.x,
                y: intersection.y,
                onLines,
                isIntersection: true,
                intersectionIndex
            });
        } else {
            this.points.push({
                x,
                y,
                onLines,
                isIntersection,
                intersectionIndex: null
            });
        }

        this.draw();
        console.log('Added point:', this.points.length - 1, 'at', x, y, 'onLines:', onLines, 'intersectionIndex:', intersectionIndex);
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
            const targetPoint = this.points[snapPreview.pointIndex];
            this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [...targetPoint.onLines],
                targetPoint.isIntersection,
                targetPoint.intersectionIndex
            );
        }
    }
    
    addLine(startX, startY, endX, endY, startPointIndices = null, endPointIndices = null) {
        // If we're creating a line through existing points, use their actual positions
        // to ensure the line passes through them exactly (avoid snap artifacts)
        let actualStartX = startX;
        let actualStartY = startY;

        if (startPointIndices && startPointIndices.length > 0) {
            const startPoint = this.points[startPointIndices[0]];
            const startPos = getPointPosition(startPoint, this.intersections);
            actualStartX = startPos.x;
            actualStartY = startPos.y;
        }

        // Calculate angle from actual positions
        const dx = endX - actualStartX;
        const dy = endY - actualStartY;
        const angle = Math.atan2(dy, dx);

        this.lines.push({ x: actualStartX, y: actualStartY, angle });
        const newLineIndex = this.lines.length - 1;

        // Collect all point indices to add to the line
        const allPointIndices = new Set();
        if (startPointIndices) {
            startPointIndices.forEach(idx => allPointIndices.add(idx));
        }
        if (endPointIndices) {
            endPointIndices.forEach(idx => allPointIndices.add(idx));
        }

        // Add all points to the line
        allPointIndices.forEach(pointIndex => {
            const point = this.points[pointIndex];
            if (!point.onLines.includes(newLineIndex)) {
                point.onLines.push(newLineIndex);
                point.isIntersection = point.onLines.length > 1;
            }
        });

        // Recompute all intersections FIRST
        this.intersections = computeIntersections(this.lines, this.points);

        // Update intersection references for points on 2+ lines
        // BUT don't move points that were part of this line creation (they're already positioned correctly)
        allPointIndices.forEach(pointIndex => {
            const point = this.points[pointIndex];
            if (point.onLines.length >= 2) {
                // Find the intersection for this point's lines
                const intersectionIndex = findIntersectionByLines(point.onLines, this.intersections);
                if (intersectionIndex !== null) {
                    point.intersectionIndex = intersectionIndex;
                    // DON'T update position - the line was created through this point's current position
                    // Moving it would cause a visual "snap"
                }
            }
        });

        this.draw();
        console.log('Added line:', newLineIndex, 'angle:', angle, 'startPoints:', startPointIndices, 'endPoints:', endPointIndices);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        this.canvasHoveredPointIndices = null;
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

        // Clear canvas (before transform)
        this.renderer.clear();

        // Save context state
        this.ctx.save();

        // Apply pan and scale transformation
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Get viewport bounds for renderer (in world space)
        const viewportBounds = this.getViewportBounds();

        // Draw grid dots in world space
        this.renderer.drawGridDots(viewportBounds);

        // Draw lines with computed highlights in world space
        this.renderer.drawLines(
            this.lines,
            viewportBounds,
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
            this.points,
            visuals.highlightedPoints,
            visuals.ghostPoint?.pointIndex,
            (point) => getPointPosition(point, this.intersections)
        );

        // Restore context state
        this.ctx.restore();
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
        this.intersections = computeIntersections(this.lines, this.points);

        console.log('Removed', linesToRemove.size, 'non-essential lines');
        this.draw();

        if (this.onStateChange) {
            this.onStateChange();
        }
    }

    addIntersectionPoints() {
        if (this.intersections.length === 0) {
            console.log('No intersections to add points to');
            return;
        }

        const viewportBounds = this.getViewportBounds();
        let addedCount = 0;

        // Check each intersection
        for (let i = 0; i < this.intersections.length; i++) {
            const intersection = this.intersections[i];

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

        console.log('Added', addedCount, 'intersection points');

        if (addedCount > 0 && this.onStateChange) {
            this.onStateChange();
        }
    }
}