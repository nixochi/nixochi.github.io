// interaction-controller.js
// Controller for user interactions (mouse, touch, gestures)

import { getPointPosition, findIntersectionByLines } from '../geometry/geometry-utils.js';

export class InteractionController {
    constructor(geometryController, viewportController, snapManager) {
        this.geometryController = geometryController;
        this.viewportController = viewportController;
        this.snapManager = snapManager;

        // Interaction state
        this.mode = 'point'; // 'point' | 'line'
        this.interactionState = {
            type: 'idle', // 'idle' | 'dragging-point' | 'drawing-line' | 'panning' | 'placing-point' | 'dragging-new-point' | 'two-finger-gesture' | 'showing-ui-highlight'
            data: null
        };

        // Transient state
        this.currentMousePos = null; // {worldX, worldY, screenX, screenY}
        this.mouseDownPos = null; // {worldX, worldY, screenX, screenY, time}
        this.capturedSnapPreview = null;
        this.canvasHoveredPointIndices = null;

        // Settings
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.clickThreshold = this.isTouchDevice ? 8 : 5;
    }

    // ============================================================================
    // Mode Management
    // ============================================================================

    setMode(mode) {
        this.mode = mode;
        this.canvasHoveredPointIndices = null;
        this.currentMousePos = null;
        this.mouseDownPos = null;
        this.capturedSnapPreview = null;
        this.transitionState('idle');
    }

    getMode() {
        return this.mode;
    }

    // ============================================================================
    // State Machine
    // ============================================================================

    transitionState(newType, newData = null) {
        this.interactionState = { type: newType, data: newData };
    }

    getState() {
        return this.interactionState;
    }

    // ============================================================================
    // Mouse/Touch Event Handlers
    // ============================================================================

    /**
     * Handle mouse/touch down
     */
    handlePointerDown(worldX, worldY, screenX, screenY) {
        // Store positions
        this.mouseDownPos = { worldX, worldY, screenX, screenY, time: Date.now() };
        this.currentMousePos = { worldX, worldY, screenX, screenY };

        // Clear UI hover highlights
        this.clearUIHighlight();

        if (this.mode === 'line') {
            return this._handleLineStart(worldX, worldY);
        } else {
            return this._handlePointStart(worldX, worldY);
        }
    }

    /**
     * Handle mouse/touch move
     */
    handlePointerMove(worldX, worldY, screenX, screenY) {
        // Update current position
        this.currentMousePos = { worldX, worldY, screenX, screenY };

        const state = this.interactionState;

        switch (state.type) {
            case 'idle':
                // In line mode, update canvas hover
                if (this.mode === 'line') {
                    const scale = this.viewportController.getScale();
                    const hoveredPoints = this.geometryController.getPointsAtPosition(worldX, worldY, scale);
                    this.canvasHoveredPointIndices = hoveredPoints.length > 0 ? hoveredPoints : null;
                }
                return { needsRedraw: true };

            case 'placing-point':
                // Check if user is dragging (transition to panning)
                const dragDist = Math.hypot(
                    screenX - this.mouseDownPos.screenX,
                    screenY - this.mouseDownPos.screenY
                );

                if (dragDist > this.clickThreshold) {
                    this.capturedSnapPreview = null;
                    this.transitionState('panning', {
                        startOffsetX: state.data.startOffsetX,
                        startOffsetY: state.data.startOffsetY
                    });
                    return { needsRedraw: true, cursor: 'grabbing' };
                }
                return { needsRedraw: true };

            case 'dragging-point':
            case 'dragging-new-point':
            case 'drawing-line':
                return { needsRedraw: true };

            case 'panning':
                // Update pan offset
                const dx = screenX - this.mouseDownPos.screenX;
                const dy = screenY - this.mouseDownPos.screenY;
                this.viewportController.setPanOffset(
                    state.data.startOffsetX + dx,
                    state.data.startOffsetY + dy
                );
                return { needsRedraw: true };

            default:
                return { needsRedraw: false };
        }
    }

    /**
     * Handle mouse/touch up
     */
    handlePointerUp(worldX, worldY, screenX, screenY) {
        // Update current position
        this.currentMousePos = { worldX, worldY, screenX, screenY };

        const state = this.interactionState;

        // Check if this was a click
        const isClick = this.mouseDownPos &&
            Math.hypot(
                screenX - this.mouseDownPos.screenX,
                screenY - this.mouseDownPos.screenY
            ) <= this.clickThreshold;

        let result = { needsRedraw: true, cursor: 'crosshair' };

        switch (state.type) {
            case 'drawing-line':
                result = this._finalizeLine(worldX, worldY, screenX, screenY);
                break;

            case 'placing-point':
                result = this._finalizePointPlacement(worldX, worldY);
                break;

            case 'dragging-point':
                result = this._finalizeDragPoint(isClick);
                break;

            case 'dragging-new-point':
                result = this._finalizeDragNewPoint(isClick, worldX, worldY);
                break;

            case 'panning':
            case 'two-finger-gesture':
                // Just end the interaction
                break;
        }

        // Clear transient state
        this.capturedSnapPreview = null;
        this.canvasHoveredPointIndices = null;
        this.currentMousePos = null;
        this.transitionState('idle');

        return result;
    }

    /**
     * Handle pointer leave (mouse leaves canvas)
     */
    handlePointerLeave() {
        this.currentMousePos = null;
        this.capturedSnapPreview = null;
        this.canvasHoveredPointIndices = null;

        if (this.interactionState.type !== 'idle') {
            this.transitionState('idle');
            return { needsRedraw: true, cursor: 'crosshair' };
        }

        return { needsRedraw: true };
    }

    /**
     * Handle mouse wheel (zoom)
     */
    handleWheel(deltaY, screenX, screenY) {
        const zoomSpeed = 0.005;
        const zoomAmount = -deltaY * zoomSpeed;
        const scaleFactor = 1 + zoomAmount;

        this.viewportController.zoomAt(screenX, screenY, scaleFactor);
        return { needsRedraw: true };
    }

    /**
     * Handle two-finger gesture start
     */
    handleTwoFingerStart(distance, centerX, centerY) {
        const viewport = this.viewportController.viewportModel;
        this.transitionState('two-finger-gesture', {
            startOffsetX: viewport.offsetX,
            startOffsetY: viewport.offsetY,
            startScale: viewport.scale,
            initialDistance: distance,
            initialCenterX: centerX,
            initialCenterY: centerY
        });
        return { needsRedraw: false };
    }

    /**
     * Handle two-finger gesture move
     */
    handleTwoFingerMove(distance, centerX, centerY) {
        if (this.interactionState.type !== 'two-finger-gesture') {
            return { needsRedraw: false };
        }

        const state = this.interactionState.data;
        const viewport = this.viewportController.viewportModel;

        // Calculate zoom scale factor with damping
        const distanceRatio = distance / state.initialDistance;
        const zoomSensitivity = 0.6;
        const scaleFactor = 1 + (distanceRatio - 1) * zoomSensitivity;
        const targetScale = state.startScale * scaleFactor;
        const newScale = Math.max(viewport.minScale, Math.min(viewport.maxScale, targetScale));

        // Calculate world position at initial center
        const worldX = (state.initialCenterX - state.startOffsetX) / state.startScale;
        const worldY = (state.initialCenterY - state.startOffsetY) / state.startScale;

        // Calculate new offset for zoom
        const newOffsetX = state.initialCenterX - worldX * newScale;
        const newOffsetY = state.initialCenterY - worldY * newScale;

        // Add pan from center movement
        const panDx = centerX - state.initialCenterX;
        const panDy = centerY - state.initialCenterY;

        // Apply combined transform
        viewport.scale = newScale;
        viewport.offsetX = newOffsetX + panDx;
        viewport.offsetY = newOffsetY + panDy;
        viewport.notify();

        return { needsRedraw: true };
    }

    /**
     * Handle two-finger gesture end
     */
    handleTwoFingerEnd() {
        this.currentMousePos = null;
        this.transitionState('idle');
        return { needsRedraw: true, cursor: 'crosshair' };
    }

    // ============================================================================
    // UI Highlighting
    // ============================================================================

    showUIHighlight(pointIndices) {
        if (pointIndices && pointIndices.length > 0) {
            this.transitionState('showing-ui-highlight', { pointIndices: [...pointIndices] });
            return { needsRedraw: true };
        } else {
            this.transitionState('idle');
            return { needsRedraw: true };
        }
    }

    clearUIHighlight() {
        if (this.interactionState.type === 'showing-ui-highlight') {
            this.transitionState('idle');
            return { needsRedraw: true };
        }
        return { needsRedraw: false };
    }

    // ============================================================================
    // Visual State Derivation
    // ============================================================================

    /**
     * Compute visual state for rendering
     */
    computeVisualState(points, lines, intersections) {
        const state = this.interactionState;
        const scale = this.viewportController.getScale();

        const visuals = {
            snapPreview: null,
            highlightedPoints: new Set(),
            highlightedLines: new Set(),
            previewLine: null,
            ghostPoint: null,
            lineEndSnap: null,
            allLineIntersections: []
        };

        switch (state.type) {
            case 'idle':
                if (this.mode === 'point' && this.currentMousePos) {
                    visuals.snapPreview = this.snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        intersections,
                        lines,
                        points,
                        scale
                    );
                    this._highlightSnapLines(visuals.snapPreview, visuals, intersections, points);
                }

                if (this.mode === 'line' && this.canvasHoveredPointIndices) {
                    this.canvasHoveredPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
                }
                break;

            case 'showing-ui-highlight':
                if (state.data && state.data.pointIndices) {
                    state.data.pointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
                }
                break;

            case 'dragging-point':
                this._computeDragPointVisuals(state, points, lines, intersections, scale, visuals);
                break;

            case 'drawing-line':
                this._computeDrawLineVisuals(state, points, intersections, scale, visuals);
                break;

            case 'dragging-new-point':
                this._computeDragNewPointVisuals(points, lines, intersections, scale, visuals);
                break;

            case 'placing-point':
                if (this.capturedSnapPreview) {
                    visuals.snapPreview = this.capturedSnapPreview;
                    this._highlightSnapLines(this.capturedSnapPreview, visuals, intersections, points);
                }
                break;
        }

        return visuals;
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    _handleLineStart(worldX, worldY) {
        const scale = this.viewportController.getScale();
        let startX = worldX;
        let startY = worldY;
        let startPointIndices = null;

        // Check if starting from a point
        if (this.canvasHoveredPointIndices) {
            const hoveredPoint = this.geometryController.geometryModel.points[this.canvasHoveredPointIndices[0]];
            startX = hoveredPoint.x;
            startY = hoveredPoint.y;
            startPointIndices = [...this.canvasHoveredPointIndices];
        } else {
            const pointsAtPosition = this.geometryController.getPointsAtPosition(worldX, worldY, scale);
            if (pointsAtPosition.length > 0) {
                const nearbyPoint = this.geometryController.geometryModel.points[pointsAtPosition[0]];
                startX = nearbyPoint.x;
                startY = nearbyPoint.y;
                startPointIndices = [...pointsAtPosition];
            }
        }

        this.transitionState('drawing-line', { startX, startY, startPointIndices });
        return { needsRedraw: true, cursor: 'crosshair' };
    }

    _handlePointStart(worldX, worldY) {
        const scale = this.viewportController.getScale();
        const pointsAtPosition = this.geometryController.getPointsAtPosition(worldX, worldY, scale);

        if (pointsAtPosition.length > 0) {
            // Start dragging existing point
            const pointIndex = pointsAtPosition.length === 1
                ? pointsAtPosition[0]
                : Math.max(...pointsAtPosition);

            const originalPoint = this.geometryController.geometryModel.points[pointIndex];
            this.transitionState('dragging-point', {
                pointIndex,
                originalX: originalPoint.x,
                originalY: originalPoint.y
            });
            return { needsRedraw: true, cursor: 'grabbing' };
        } else {
            // Start dragging new point
            this.transitionState('dragging-new-point', {
                startWorldX: worldX,
                startWorldY: worldY
            });
            return { needsRedraw: true, cursor: 'crosshair' };
        }
    }

    _finalizeLine(worldX, worldY, screenX, screenY) {
        const state = this.interactionState.data;
        const dragDistance = this.mouseDownPos ? Math.hypot(
            screenX - this.mouseDownPos.screenX,
            screenY - this.mouseDownPos.screenY
        ) : 0;
        const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);

        if (dragDistance > linePreviewThreshold) {
            // Get visual state for snap
            const points = this.geometryController.geometryModel.points;
            const lines = this.geometryController.geometryModel.lines;
            const intersections = this.geometryController.geometryModel.intersections;
            const scale = this.viewportController.getScale();
            const visuals = this.computeVisualState(points, lines, intersections);

            let endX = worldX;
            let endY = worldY;
            let endPointIndices = null;

            if (visuals.lineEndSnap) {
                endX = visuals.lineEndSnap.x;
                endY = visuals.lineEndSnap.y;
                if (visuals.lineEndSnap.type === 'multipoint') {
                    endPointIndices = visuals.lineEndSnap.pointIndices;
                }
            }

            this.geometryController.addLine(
                state.startX,
                state.startY,
                endX,
                endY,
                state.startPointIndices,
                endPointIndices
            );
        }

        return { needsRedraw: true, cursor: 'crosshair' };
    }

    _finalizePointPlacement(worldX, worldY) {
        if (this.capturedSnapPreview) {
            this.geometryController.addPointWithSnap(this.capturedSnapPreview);
        } else {
            const scale = this.viewportController.getScale();
            const pointsAtPosition = this.geometryController.getPointsAtPosition(worldX, worldY, scale);
            if (pointsAtPosition.length === 0) {
                this.geometryController.addPoint(worldX, worldY, [], false);
            }
        }
        return { needsRedraw: true, cursor: 'crosshair' };
    }

    _finalizeDragPoint(isClick) {
        const state = this.interactionState.data;
        const point = this.geometryController.geometryModel.points[state.pointIndex];

        if (isClick) {
            // Restore original position
            point.x = state.originalX;
            point.y = state.originalY;
        } else {
            // Capture old state
            const oldState = {
                x: state.originalX,
                y: state.originalY,
                onLines: [...point.onLines],
                isIntersection: point.isIntersection,
                intersectionIndex: point.intersectionIndex
            };

            // Check if at multipoint
            const scale = this.viewportController.getScale();
            const oldPositionPoints = this.geometryController.getPointsAtPosition(
                state.originalX,
                state.originalY,
                scale,
                1
            ).filter(idx => idx !== state.pointIndex);
            const wasAtMultipoint = oldPositionPoints.length > 0;

            // Get final position from visuals
            const points = this.geometryController.geometryModel.points;
            const lines = this.geometryController.geometryModel.lines;
            const intersections = this.geometryController.geometryModel.intersections;
            const visuals = this.computeVisualState(points, lines, intersections);

            if (visuals.ghostPoint) {
                // Apply ghost position
                const newState = this._applySnapToPoint(point, visuals.snapPreview, intersections);

                // Check if at multipoint now
                const newPositionPoints = this.geometryController.getPointsAtPosition(
                    point.x,
                    point.y,
                    scale,
                    1
                ).filter(idx => idx !== state.pointIndex);
                const isAtMultipoint = newPositionPoints.length > 0;

                // Determine action type
                let actionType;
                if (!wasAtMultipoint && isAtMultipoint) {
                    actionType = 'merge';
                } else if (wasAtMultipoint && !isAtMultipoint) {
                    actionType = 'unmerge';
                } else {
                    actionType = 'move';
                }

                this.geometryController.updatePoint(state.pointIndex, oldState, newState, actionType);
            }
        }

        return { needsRedraw: true, cursor: 'crosshair' };
    }

    _finalizeDragNewPoint(isClick, worldX, worldY) {
        const state = this.interactionState.data;
        const scale = this.viewportController.getScale();

        if (isClick) {
            // Quick tap - create at initial position
            const snapPreview = this.snapManager.updateSnapPreview(
                state.startWorldX,
                state.startWorldY,
                this.geometryController.geometryModel.intersections,
                this.geometryController.geometryModel.lines,
                this.geometryController.geometryModel.points,
                scale
            );

            if (snapPreview) {
                this.geometryController.addPointWithSnap(snapPreview);
            } else {
                const pointsAtPosition = this.geometryController.getPointsAtPosition(
                    state.startWorldX,
                    state.startWorldY,
                    scale
                );
                if (pointsAtPosition.length === 0) {
                    this.geometryController.addPoint(state.startWorldX, state.startWorldY, [], false);
                }
            }
        } else {
            // Dragged - create at final position
            const points = this.geometryController.geometryModel.points;
            const lines = this.geometryController.geometryModel.lines;
            const intersections = this.geometryController.geometryModel.intersections;
            const visuals = this.computeVisualState(points, lines, intersections);

            if (visuals.ghostPoint) {
                if (visuals.snapPreview) {
                    this.geometryController.addPointWithSnap(visuals.snapPreview);
                } else {
                    const pointsAtPosition = this.geometryController.getPointsAtPosition(
                        visuals.ghostPoint.x,
                        visuals.ghostPoint.y,
                        scale
                    );
                    if (pointsAtPosition.length === 0) {
                        this.geometryController.addPoint(visuals.ghostPoint.x, visuals.ghostPoint.y, [], false);
                    }
                }
            }
        }

        return { needsRedraw: true, cursor: 'crosshair' };
    }

    _applySnapToPoint(point, snapPreview, intersections) {
        if (snapPreview) {
            point.x = snapPreview.x;
            point.y = snapPreview.y;

            if (snapPreview.type === 'intersection') {
                const intersection = intersections[snapPreview.intersectionIndex];
                point.onLines = [...intersection.lineIndices];
                point.isIntersection = true;
                point.intersectionIndex = snapPreview.intersectionIndex;
            } else if (snapPreview.type === 'line') {
                point.onLines = [snapPreview.lineIndex];
                point.isIntersection = false;
                point.intersectionIndex = null;
            } else if (snapPreview.type === 'point') {
                const snapTarget = this.geometryController.geometryModel.points[snapPreview.pointIndex];
                point.onLines = [...snapTarget.onLines];
                point.isIntersection = snapTarget.onLines.length > 1;

                if (point.onLines.length >= 2) {
                    point.intersectionIndex = findIntersectionByLines(point.onLines, intersections);
                    if (point.intersectionIndex !== null) {
                        const intersection = intersections[point.intersectionIndex];
                        point.x = intersection.x;
                        point.y = intersection.y;
                    }
                } else {
                    point.intersectionIndex = null;
                }
            }
        } else {
            // No snap - clear line memberships
            point.onLines = [];
            point.isIntersection = false;
            point.intersectionIndex = null;
        }

        return {
            x: point.x,
            y: point.y,
            onLines: [...point.onLines],
            isIntersection: point.isIntersection,
            intersectionIndex: point.intersectionIndex
        };
    }

    _computeDragPointVisuals(state, points, lines, intersections, scale, visuals) {
        const draggedPoint = points[state.data.pointIndex];
        const tempX = draggedPoint.x;
        const tempY = draggedPoint.y;
        draggedPoint.x = state.data.originalX;
        draggedPoint.y = state.data.originalY;

        if (this.currentMousePos) {
            visuals.snapPreview = this.snapManager.updateSnapPreview(
                this.currentMousePos.worldX,
                this.currentMousePos.worldY,
                intersections,
                lines,
                points,
                scale
            );

            if (visuals.snapPreview) {
                visuals.ghostPoint = {
                    x: visuals.snapPreview.x,
                    y: visuals.snapPreview.y,
                    pointIndex: state.data.pointIndex
                };
                this._highlightSnapLines(visuals.snapPreview, visuals, intersections, points);
            } else {
                visuals.ghostPoint = {
                    x: this.currentMousePos.worldX,
                    y: this.currentMousePos.worldY,
                    pointIndex: state.data.pointIndex
                };
            }
        }

        draggedPoint.x = tempX;
        draggedPoint.y = tempY;
    }

    _computeDrawLineVisuals(state, points, intersections, scale, visuals) {
        if (!state.data || !this.currentMousePos) return;

        const dragDistance = this.mouseDownPos ? Math.hypot(
            this.currentMousePos.screenX - this.mouseDownPos.screenX,
            this.currentMousePos.screenY - this.mouseDownPos.screenY
        ) : 0;
        const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);
        const hasMoved = dragDistance > linePreviewThreshold;

        if (hasMoved) {
            const snapResult = this.snapManager.findLineEndpointSnap(
                state.data.startX,
                state.data.startY,
                this.currentMousePos.worldX,
                this.currentMousePos.worldY,
                points,
                intersections,
                this.viewportController.getViewportBounds(),
                scale
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

                const snapTarget = snapResult.snapTarget;
                if (snapTarget.type === 'multipoint') {
                    snapTarget.pointIndices.forEach(idx => {
                        visuals.highlightedPoints.add(idx);
                        const point = points[idx];
                        point.onLines.forEach(lineIdx => visuals.highlightedLines.add(lineIdx));
                    });
                } else if (snapTarget.type === 'intersection') {
                    snapTarget.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                }
            } else {
                visuals.previewLine = {
                    startX: state.data.startX,
                    startY: state.data.startY,
                    endX: this.currentMousePos.worldX,
                    endY: this.currentMousePos.worldY
                };
            }
        }

        if (state.data.startPointIndices) {
            state.data.startPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
        }
    }

    _computeDragNewPointVisuals(points, lines, intersections, scale, visuals) {
        if (!this.currentMousePos) return;

        visuals.snapPreview = this.snapManager.updateSnapPreview(
            this.currentMousePos.worldX,
            this.currentMousePos.worldY,
            intersections,
            lines,
            points,
            scale
        );

        if (visuals.snapPreview) {
            visuals.ghostPoint = {
                x: visuals.snapPreview.x,
                y: visuals.snapPreview.y,
                pointIndex: -1
            };
            this._highlightSnapLines(visuals.snapPreview, visuals, intersections, points);
        } else {
            visuals.ghostPoint = {
                x: this.currentMousePos.worldX,
                y: this.currentMousePos.worldY,
                pointIndex: -1
            };
        }
    }

    _highlightSnapLines(snapPreview, visuals, intersections, points) {
        if (!snapPreview) return;

        if (snapPreview.type === 'line') {
            visuals.highlightedLines.add(snapPreview.lineIndex);
        } else if (snapPreview.type === 'intersection') {
            const intersection = intersections[snapPreview.intersectionIndex];
            intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
        } else if (snapPreview.type === 'point') {
            const targetPoint = points[snapPreview.pointIndex];
            targetPoint.onLines.forEach(idx => visuals.highlightedLines.add(idx));
        }
    }
}