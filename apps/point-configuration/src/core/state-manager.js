// state-manager.js
// Manages interaction state machine and visual state derivation

export class StateManager {
    constructor() {
        // State machine - replaces all boolean flags
        this.interactionState = {
            type: 'idle', // 'idle' | 'dragging-point' | 'drawing-line' | 'panning' | 'placing-point' | 'dragging-new-point' | 'two-finger-gesture'
            data: null
        };

        // Mouse tracking for visual derivation
        this.currentMousePos = null; // {worldX, worldY, screenX, screenY}
        this.mouseDownPos = null; // {worldX, worldY, screenX, screenY, time}
        this.capturedSnapPreview = null; // Snap preview captured on mousedown for point placement

        // External state inputs (from UI)
        this.hoveredPointIndices = null; // Set from UI hover events
        this.canvasHoveredPointIndices = null; // Points hovered on canvas (for line mode)
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
    computeVisualState(mode, points, lines, intersections, snapManager, scale) {
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
                if (mode === 'point' && this.currentMousePos) {
                    visuals.snapPreview = snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        intersections,
                        lines,
                        points,
                        scale
                    );

                    // Highlight lines involved in snap
                    if (visuals.snapPreview) {
                        if (visuals.snapPreview.type === 'line') {
                            visuals.highlightedLines.add(visuals.snapPreview.lineIndex);
                        } else if (visuals.snapPreview.type === 'intersection') {
                            const intersection = intersections[visuals.snapPreview.intersectionIndex];
                            intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                        }
                    }
                }

                // In line mode, highlight hovered points (entire multipoint)
                if (mode === 'line' && this.canvasHoveredPointIndices) {
                    this.canvasHoveredPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
                }

                // UI hover highlights (only in idle state)
                if (this.hoveredPointIndices) {
                    this.hoveredPointIndices.forEach(idx => visuals.highlightedPoints.add(idx));
                }
                break;

            case 'dragging-point':
                // Ensure point is at original position for snap calculation
                const draggedPoint = points[state.data.pointIndex];
                const tempX = draggedPoint.x;
                const tempY = draggedPoint.y;
                draggedPoint.x = state.data.originalX;
                draggedPoint.y = state.data.originalY;

                // Compute snap at current mouse position (with point at original position)
                if (this.currentMousePos) {
                    visuals.snapPreview = snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        intersections,
                        lines,
                        points,
                        scale
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
                            const intersection = intersections[visuals.snapPreview.intersectionIndex];
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
                    const clickThreshold = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 8 : 5;
                    const linePreviewThreshold = Math.max(15, clickThreshold * 2);
                    const hasMoved = dragDistance > linePreviewThreshold;

                    if (hasMoved) {
                        // Check for endpoint snap and all intersections
                        const snapResult = snapManager.findLineEndpointSnap(
                            state.data.startX,
                            state.data.startY,
                            this.currentMousePos.worldX,
                            this.currentMousePos.worldY,
                            points,
                            intersections,
                            this.getViewportBoundsForSnap(),
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

                            // Highlight ALL intersections
                            snapResult.allIntersections.forEach(intersection => {
                                if (intersection.type === 'multipoint') {
                                    intersection.pointIndices.forEach(idx => {
                                        visuals.highlightedPoints.add(idx);
                                        // Also highlight all lines that these points are on
                                        const point = points[idx];
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
                    visuals.snapPreview = snapManager.updateSnapPreview(
                        this.currentMousePos.worldX,
                        this.currentMousePos.worldY,
                        intersections,
                        lines,
                        points,
                        scale
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
                            const intersection = intersections[visuals.snapPreview.intersectionIndex];
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
                        const intersection = intersections[this.capturedSnapPreview.intersectionIndex];
                        intersection.lineIndices.forEach(idx => visuals.highlightedLines.add(idx));
                    }
                }
                break;

            case 'panning':
            case 'two-finger-gesture':
                // No visual overlays while panning
                break;
        }

        return visuals;
    }

    /**
     * Placeholder for viewport bounds - will be provided by TransformManager
     */
    getViewportBoundsForSnap() {
        // This will be injected by the canvas manager
        return this._viewportBoundsGetter ? this._viewportBoundsGetter() : { left: 0, right: 0, top: 0, bottom: 0 };
    }

    /**
     * Set viewport bounds getter
     */
    setViewportBoundsGetter(getter) {
        this._viewportBoundsGetter = getter;
    }

    /**
     * Set which points should be highlighted (called from UI)
     */
    setHoveredPoints(pointIndices) {
        this.hoveredPointIndices = pointIndices ? new Set(pointIndices) : null;
    }

    /**
     * Clear hovered points
     */
    clearHoveredPoints() {
        this.hoveredPointIndices = null;
    }
}
