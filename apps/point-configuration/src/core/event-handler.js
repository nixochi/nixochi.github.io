// event-handler.js
// Handles all mouse, touch, and wheel events

import { getPointPosition, findIntersectionByLines } from '../geometry/geometry-utils.js';

export class EventHandler {
    constructor(canvas, stateManager, transformManager, pointLineManager, snapManager, options) {
        this.canvas = canvas;
        this.stateManager = stateManager;
        this.transformManager = transformManager;
        this.pointLineManager = pointLineManager;
        this.snapManager = snapManager;

        this.mode = 'point';
        this.clickThreshold = options.clickThreshold;

        // Callbacks
        this.onDraw = null;
    }

    /**
     * Setup all event listeners
     */
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
     * Set mode (point or line)
     */
    setMode(mode) {
        this.mode = mode;
    }

    /**
     * Mouse down handler
     */
    handleMouseDown(e) {
        const { worldX, worldY, screenX, screenY } = this.transformManager.getEventCoordinates(e);

        // Store mouse down position and current position (prevents phantom line previews)
        this.stateManager.mouseDownPos = { worldX, worldY, screenX, screenY, time: Date.now() };
        this.stateManager.currentMousePos = { worldX, worldY, screenX, screenY };

        // Clear UI hover highlights when interacting with canvas
        this.stateManager.hoveredPointIndices = null;

        if (this.mode === 'line') {
            // Check if starting from or near a point
            let startX = worldX;
            let startY = worldY;
            let startPointIndices = null;

            // First check if we already have hovered point indices (from mouse move)
            if (this.stateManager.canvasHoveredPointIndices) {
                // Use the first point's position (all points in multipoint are at same location)
                const hoveredPoint = this.pointLineManager.points[this.stateManager.canvasHoveredPointIndices[0]];
                startX = hoveredPoint.x;
                startY = hoveredPoint.y;
                startPointIndices = [...this.stateManager.canvasHoveredPointIndices];
            } else {
                // Check if clicking near a point (snap to it)
                const pointsAtPosition = this.pointLineManager.getPointsAtPosition(worldX, worldY);
                if (pointsAtPosition.length > 0) {
                    // Use the first point's position (all points in multipoint are at same location)
                    const nearbyPoint = this.pointLineManager.points[pointsAtPosition[0]];
                    startX = nearbyPoint.x;
                    startY = nearbyPoint.y;
                    startPointIndices = [...pointsAtPosition];
                }
            }

            // Transition to drawing-line state
            this.stateManager.transitionState('drawing-line', {
                startX,
                startY,
                startPointIndices
            });
            this.canvas.style.cursor = 'crosshair';
        } else {
            // Point mode logic
            const pointsAtPosition = this.pointLineManager.getPointsAtPosition(worldX, worldY);

            if (pointsAtPosition.length > 0) {
                // Start dragging an existing point
                const pointIndex = pointsAtPosition.length === 1
                    ? pointsAtPosition[0]
                    : Math.max(...pointsAtPosition);

                // Store original position for ghost preview
                const originalPoint = this.pointLineManager.points[pointIndex];
                this.stateManager.transitionState('dragging-point', {
                    pointIndex,
                    originalX: originalPoint.x,
                    originalY: originalPoint.y
                });
                this.canvas.style.cursor = 'grabbing';
            } else {
                // Clicking empty space - start dragging a new point (with snapping)
                this.stateManager.transitionState('dragging-new-point', {
                    startWorldX: worldX,
                    startWorldY: worldY
                });
                this.canvas.style.cursor = 'crosshair';
            }
        }

        if (this.onDraw) this.onDraw();
    }

    /**
     * Mouse move handler
     */
    handleMouseMove(e) {
        const { worldX, worldY, screenX, screenY } = this.transformManager.getEventCoordinates(e);

        // Update current mouse position for visual derivation
        this.stateManager.currentMousePos = { worldX, worldY, screenX, screenY };

        const state = this.stateManager.interactionState;

        switch (state.type) {
            case 'idle':
                // In line mode, update canvas hover for point detection (capture entire multipoint)
                if (this.mode === 'line') {
                    const hoveredPoints = this.pointLineManager.getPointsAtPosition(worldX, worldY);
                    this.stateManager.canvasHoveredPointIndices = hoveredPoints.length > 0 ? hoveredPoints : null;
                }

                // Just redraw to update snap preview
                if (this.onDraw) this.onDraw();
                break;

            case 'placing-point':
                // Check if user is dragging (transition to panning if so)
                const dragDist = Math.hypot(
                    screenX - this.stateManager.mouseDownPos.screenX,
                    screenY - this.stateManager.mouseDownPos.screenY
                );

                if (dragDist > this.clickThreshold) {
                    // Transition to panning - user is dragging, not placing
                    this.stateManager.capturedSnapPreview = null; // Clear captured snap
                    this.stateManager.transitionState('panning', {
                        startOffsetX: state.data.startOffsetX,
                        startOffsetY: state.data.startOffsetY
                    });
                    this.canvas.style.cursor = 'grabbing';
                }

                if (this.onDraw) this.onDraw();
                break;

            case 'dragging-point':
            case 'dragging-new-point':
            case 'drawing-line':
                // Just redraw - computeVisualState will create appropriate previews
                if (this.onDraw) this.onDraw();
                break;

            case 'panning':
                // Update pan offset
                const dx = screenX - this.stateManager.mouseDownPos.screenX;
                const dy = screenY - this.stateManager.mouseDownPos.screenY;
                this.transformManager.offsetX = state.data.startOffsetX + dx;
                this.transformManager.offsetY = state.data.startOffsetY + dy;
                if (this.onDraw) this.onDraw();
                break;
        }
    }

    /**
     * Mouse up handler
     */
    handleMouseUp(e) {
        const { worldX, worldY, screenX, screenY } = this.transformManager.getEventCoordinates(e);

        const state = this.stateManager.interactionState;

        // Check if this was a click (minimal movement)
        const isClick = this.stateManager.mouseDownPos &&
            Math.hypot(
                screenX - this.stateManager.mouseDownPos.screenX,
                screenY - this.stateManager.mouseDownPos.screenY
            ) <= this.clickThreshold;

        switch (state.type) {
            case 'drawing-line':
                // Use same threshold as line preview - need sufficient drag to create line
                const dragDistance = this.stateManager.mouseDownPos ? Math.hypot(
                    screenX - this.stateManager.mouseDownPos.screenX,
                    screenY - this.stateManager.mouseDownPos.screenY
                ) : 0;
                const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);

                if (dragDistance > linePreviewThreshold) {
                    // Get visual state to check for endpoint snap
                    const visuals = this.stateManager.computeVisualState(
                        this.mode,
                        this.pointLineManager.points,
                        this.pointLineManager.lines,
                        this.pointLineManager.intersections,
                        this.snapManager,
                        this.transformManager.scale
                    );

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
                    this.pointLineManager.addLine(
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
                if (this.stateManager.capturedSnapPreview) {
                    this.pointLineManager.addPointWithSnap(this.stateManager.capturedSnapPreview);
                } else {
                    // No snap, add point at mouse position
                    const pointsAtPosition = this.pointLineManager.getPointsAtPosition(worldX, worldY);
                    if (pointsAtPosition.length === 0) {
                        this.pointLineManager.addPoint(worldX, worldY, [], false);
                    }
                }
                break;

            case 'dragging-point':
                // Finalize dragged point
                const point = this.pointLineManager.points[state.data.pointIndex];

                // If it was just a click (not a drag), restore original position
                if (isClick) {
                    point.x = state.data.originalX;
                    point.y = state.data.originalY;
                } else {
                    // Capture old state for history
                    const oldState = {
                        x: state.data.originalX,
                        y: state.data.originalY,
                        onLines: [...point.onLines],
                        isIntersection: point.isIntersection,
                        intersectionIndex: point.intersectionIndex
                    };

                    // Check if there were other points at the old position
                    const oldPositionPoints = this.pointLineManager.getPointsAtPosition(
                        state.data.originalX,
                        state.data.originalY,
                        1
                    ).filter(idx => idx !== state.data.pointIndex);
                    const wasAtMultipoint = oldPositionPoints.length > 0;

                    // Get final ghost position from visuals
                    const visuals = this.stateManager.computeVisualState(
                        this.mode,
                        this.pointLineManager.points,
                        this.pointLineManager.lines,
                        this.pointLineManager.intersections,
                        this.snapManager,
                        this.transformManager.scale
                    );

                    if (visuals.ghostPoint) {
                        // Apply ghost position to actual point
                        point.x = visuals.ghostPoint.x;
                        point.y = visuals.ghostPoint.y;

                        // Update line memberships if snapped
                        if (visuals.snapPreview) {
                            if (visuals.snapPreview.type === 'intersection') {
                                const intersection = this.pointLineManager.intersections[visuals.snapPreview.intersectionIndex];
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
                                    point.intersectionIndex = findIntersectionByLines(point.onLines, this.pointLineManager.intersections);
                                } else {
                                    point.intersectionIndex = null;
                                }
                            } else if (visuals.snapPreview.type === 'point') {
                                // Snapped to another point - merge line memberships
                                const snapTarget = this.pointLineManager.points[visuals.snapPreview.pointIndex];
                                point.onLines = [...new Set([...point.onLines, ...snapTarget.onLines])];
                                point.isIntersection = point.onLines.length > 1;

                                // Update intersectionIndex if now on 2+ lines
                                if (point.onLines.length >= 2) {
                                    point.intersectionIndex = findIntersectionByLines(point.onLines, this.pointLineManager.intersections);
                                    // Snap to intersection position
                                    if (point.intersectionIndex !== null) {
                                        const intersection = this.pointLineManager.intersections[point.intersectionIndex];
                                        point.x = intersection.x;
                                        point.y = intersection.y;
                                    }
                                } else {
                                    point.intersectionIndex = null;
                                }
                            }
                        }

                        // Capture new state
                        const newState = {
                            x: point.x,
                            y: point.y,
                            onLines: [...point.onLines],
                            isIntersection: point.isIntersection,
                            intersectionIndex: point.intersectionIndex
                        };

                        // Check if there are other points at the new position
                        const newPositionPoints = this.pointLineManager.getPointsAtPosition(
                            point.x,
                            point.y,
                            1
                        ).filter(idx => idx !== state.data.pointIndex);
                        const isAtMultipoint = newPositionPoints.length > 0;

                        // Determine action type: move, merge, or unmerge
                        let actionType;
                        if (!wasAtMultipoint && isAtMultipoint) {
                            actionType = 'merge';
                        } else if (wasAtMultipoint && !isAtMultipoint) {
                            actionType = 'unmerge';
                        } else {
                            actionType = 'move';
                        }

                        // Record history
                        let action;
                        if (actionType === 'merge') {
                            action = this.pointLineManager.history.createMergePointAction(
                                state.data.pointIndex,
                                oldState,
                                newState
                            );
                        } else if (actionType === 'unmerge') {
                            action = this.pointLineManager.history.createUnmergePointAction(
                                state.data.pointIndex,
                                oldState,
                                newState
                            );
                        } else {
                            action = this.pointLineManager.history.createMovePointAction(
                                state.data.pointIndex,
                                oldState,
                                newState
                            );
                        }
                        this.pointLineManager.history.recordAction(action);
                    } else {
                        // No ghost (shouldn't happen), restore original
                        point.x = state.data.originalX;
                        point.y = state.data.originalY;
                    }

                    if (this.pointLineManager.onStateChange) {
                        this.pointLineManager.onStateChange();
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
                        this.pointLineManager.intersections,
                        this.pointLineManager.lines,
                        this.pointLineManager.points,
                        this.transformManager.scale
                    );

                    if (snapPreview) {
                        this.pointLineManager.addPointWithSnap(snapPreview);
                    } else {
                        const pointsAtPosition = this.pointLineManager.getPointsAtPosition(state.data.startWorldX, state.data.startWorldY);
                        if (pointsAtPosition.length === 0) {
                            this.pointLineManager.addPoint(state.data.startWorldX, state.data.startWorldY, [], false);
                        }
                    }
                } else {
                    // Dragged - create point at final ghost position
                    const visuals = this.stateManager.computeVisualState(
                        this.mode,
                        this.pointLineManager.points,
                        this.pointLineManager.lines,
                        this.pointLineManager.intersections,
                        this.snapManager,
                        this.transformManager.scale
                    );

                    if (visuals.ghostPoint) {
                        // Create point at ghost position
                        if (visuals.snapPreview) {
                            // Snapped to something, use addPointWithSnap
                            this.pointLineManager.addPointWithSnap(visuals.snapPreview);
                        } else {
                            // Not snapped, create point at ghost position
                            const pointsAtPosition = this.pointLineManager.getPointsAtPosition(visuals.ghostPoint.x, visuals.ghostPoint.y);
                            if (pointsAtPosition.length === 0) {
                                this.pointLineManager.addPoint(visuals.ghostPoint.x, visuals.ghostPoint.y, [], false);
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
        this.stateManager.capturedSnapPreview = null;
        this.stateManager.canvasHoveredPointIndices = null;
        this.stateManager.transitionState('idle');
        this.canvas.style.cursor = 'crosshair';
        if (this.onDraw) this.onDraw();
    }

    /**
     * Mouse leave handler
     */
    handleMouseLeave(e) {
        // Clear all transient state
        this.stateManager.currentMousePos = null;
        this.stateManager.capturedSnapPreview = null;
        this.stateManager.canvasHoveredPointIndices = null;

        // If actively interacting, treat as mouseup
        if (this.stateManager.interactionState.type !== 'idle') {
            this.handleMouseUp(e);
        } else {
            // Just redraw to clear any snap previews
            if (this.onDraw) this.onDraw();
        }
    }

    /**
     * Wheel handler (mouse wheel and touchpad - both zoom from center)
     */
    handleWheel(e) {
        e.preventDefault();

        // Always zoom from center of canvas for wheel/touchpad
        const zoomX = this.canvas.width / 2;
        const zoomY = this.canvas.height / 2;

        // Use delta magnitude to determine zoom amount (works for both mouse and touchpad)
        const zoomSpeed = 0.005;
        const zoomAmount = -e.deltaY * zoomSpeed;
        const scaleFactor = 1 + zoomAmount;

        this.transformManager.zoomAt(zoomX, zoomY, scaleFactor);
        if (this.onDraw) this.onDraw();
    }

    /**
     * Touch start handler
     */
    handleTouchStart(e) {
        e.preventDefault();

        // Two-finger gesture (pan/zoom)
        if (e.touches.length === 2) {
            const gestureInfo = this.transformManager.getTouchGestureInfo(e.touches);
            this.stateManager.transitionState('two-finger-gesture', {
                startOffsetX: this.transformManager.offsetX,
                startOffsetY: this.transformManager.offsetY,
                startScale: this.transformManager.scale,
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

    /**
     * Touch move handler
     */
    handleTouchMove(e) {
        e.preventDefault();

        // Two-finger gesture (pan/zoom)
        if (e.touches.length === 2 && this.stateManager.interactionState.type === 'two-finger-gesture') {
            const gestureInfo = this.transformManager.getTouchGestureInfo(e.touches);
            const state = this.stateManager.interactionState.data;

            // Calculate zoom scale factor from distance ratio (with damping)
            const distanceRatio = gestureInfo.distance / state.initialDistance;
            const zoomSensitivity = 0.6; // Damping factor (0-1, lower = less sensitive)
            const scaleFactor = 1 + (distanceRatio - 1) * zoomSensitivity;
            const targetScale = state.startScale * scaleFactor;
            const newScale = Math.max(this.transformManager.minScale, Math.min(this.transformManager.maxScale, targetScale));

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
            this.transformManager.scale = newScale;
            this.transformManager.offsetX = newOffsetX + panDx;
            this.transformManager.offsetY = newOffsetY + panDy;

            if (this.onDraw) this.onDraw();
            return;
        }

        // Single touch - treat as mouse move
        if (e.touches.length === 1) {
            this.handleMouseMove(e);
        }
    }

    /**
     * Touch end handler
     */
    handleTouchEnd(e) {
        e.preventDefault();

        // End of two-finger gesture
        if (this.stateManager.interactionState.type === 'two-finger-gesture') {
            this.stateManager.currentMousePos = null; // Clear stale position
            this.stateManager.transitionState('idle');
            this.canvas.style.cursor = 'crosshair';
            if (this.onDraw) this.onDraw();
            return;
        }

        // Single touch - clear position then treat as mouse up
        this.stateManager.currentMousePos = null; // Clear before mouseUp
        this.handleMouseUp(e);
    }

    /**
     * Touch cancel handler
     */
    handleTouchCancel(e) {
        e.preventDefault();

        // Treat as mouse leave
        this.handleMouseLeave(e);
    }
}
