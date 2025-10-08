// VisualOverlaysComputer.js
// Pure function to compute visual overlays (ghost points, preview lines, etc.)

import { getPointPosition } from '../geometry/geometry-utils.js';

/**
 * Computes visual overlays based on current interaction state.
 * This is a pure function - always recomputes from scratch.
 */
export class VisualOverlaysComputer {
    constructor(interactionState, configuration, snapPreviewComputer, intersectionsComputer, transformState) {
        this.interactionState = interactionState;
        this.configuration = configuration;
        this.snapPreviewComputer = snapPreviewComputer;
        this.intersectionsComputer = intersectionsComputer;
        this.transformState = transformState;
    }

    /**
     * Calculate all visual overlays.
     * @returns {Object} {
     *   ghostPoint: {x, y, pointIndex} | null,
     *   previewLine: {startX, startY, endX, endY} | null,
     *   lineIntersectionPreviews: [{x, y, type, ...}]
     * }
     */
    compute() {
        const result = {
            ghostPoint: null,
            previewLine: null,
            lineIntersectionPreviews: []
        };

        const state = this.interactionState.getState();
        const mousePos = this.interactionState.getMousePosition();

        if (!mousePos) {
            return result;
        }

        switch (state.type) {
            case 'dragging-point':
                result.ghostPoint = this._computeGhostForDragging(state, mousePos);
                break;

            case 'dragging-new-point':
                result.ghostPoint = this._computeGhostForDraggingNew(state, mousePos);
                break;

            case 'drawing-line':
                const linePreview = this._computePreviewLine(state, mousePos);
                if (linePreview) {
                    result.previewLine = linePreview.line;
                    result.lineIntersectionPreviews = linePreview.intersectionPreviews || [];
                }
                break;

            case 'placing-point':
                // Show snap preview at captured position
                const snap = this.snapPreviewComputer.compute();
                if (snap) {
                    // No ghost needed - snap preview is shown by renderer
                }
                break;

            case 'idle':
            case 'panning':
            case 'two-finger-gesture':
                // No overlays
                break;
        }

        return result;
    }

    /**
     * Compute ghost point when dragging existing point
     */
    _computeGhostForDragging(state, mousePos) {
        const snap = this.snapPreviewComputer.compute();

        if (snap) {
            return {
                x: snap.x,
                y: snap.y,
                pointIndex: state.data.pointIndex
            };
        } else {
            return {
                x: mousePos.worldX,
                y: mousePos.worldY,
                pointIndex: state.data.pointIndex
            };
        }
    }

    /**
     * Compute ghost point when dragging new point
     */
    _computeGhostForDraggingNew(state, mousePos) {
        const snap = this.snapPreviewComputer.compute();

        if (snap) {
            return {
                x: snap.x,
                y: snap.y,
                pointIndex: -1 // Marker for new point
            };
        } else {
            return {
                x: mousePos.worldX,
                y: mousePos.worldY,
                pointIndex: -1
            };
        }
    }

    /**
     * Compute preview line when drawing line
     */
    _computePreviewLine(state, mousePos) {
        if (!state.data) {
            return null;
        }

        // Check if sufficient drag distance
        if (!this._shouldShowLinePreview()) {
            return null;
        }

        const startX = state.data.startX;
        const startY = state.data.startY;
        const endX = mousePos.worldX;
        const endY = mousePos.worldY;

        // Find endpoint snap
        const snapResult = this._findLineEndpointSnap(startX, startY, endX, endY, state.data.startPointIndices || []);

        if (snapResult) {
            return {
                line: {
                    startX: startX,
                    startY: startY,
                    endX: snapResult.x,
                    endY: snapResult.y
                },
                intersectionPreviews: [] // Could add more sophisticated previews here
            };
        } else {
            return {
                line: {
                    startX: startX,
                    startY: startY,
                    endX: endX,
                    endY: endY
                },
                intersectionPreviews: []
            };
        }
    }

    /**
     * Check if drag distance is sufficient to show line preview
     */
    _shouldShowLinePreview() {
        const mouseDownPos = this.interactionState.getMouseDownPosition();
        const mousePos = this.interactionState.getMousePosition();

        if (!mouseDownPos || !mousePos) {
            return false;
        }

        const dragDistance = Math.hypot(
            mousePos.screenX - mouseDownPos.screenX,
            mousePos.screenY - mouseDownPos.screenY
        );

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const clickThreshold = isTouchDevice ? 8 : 5;
        const linePreviewThreshold = Math.max(15, clickThreshold * 2);

        return dragDistance > linePreviewThreshold;
    }

    /**
     * Find snap target for line endpoint
     */
    _findLineEndpointSnap(startX, startY, endX, endY, excludePointIndices) {
        const points = this.configuration.getAllPoints();
        const intersections = this.intersectionsComputer.compute();
        const scale = this.transformState.getScale();
        const viewportBounds = this.transformState.getViewportBounds();

        const candidates = [];
        const worldPerpendicularThreshold = 20 / scale;

        // Calculate line direction
        const dx = endX - startX;
        const dy = endY - startY;
        const lineLength = Math.hypot(dx, dy);

        if (lineLength < 0.1) return null;

        const dirX = dx / lineLength;
        const dirY = dy / lineLength;

        // Helper: calculate perpendicular distance from point to infinite line
        const getPerpendicularDistance = (px, py) => {
            const vx = px - startX;
            const vy = py - startY;
            const projection = vx * dirX + vy * dirY;
            const perpX = vx - projection * dirX;
            const perpY = vy - projection * dirY;
            return Math.hypot(perpX, perpY);
        };

        // Check all existing points
        const excludeSet = new Set(excludePointIndices);
        const processedPositions = new Set();

        for (let i = 0; i < points.length; i++) {
            if (excludeSet.has(i)) continue;

            const point = points[i];
            const pos = getPointPosition(point, intersections);

            // Check if in viewport
            if (pos.x < viewportBounds.left || pos.x > viewportBounds.right ||
                pos.y < viewportBounds.top || pos.y > viewportBounds.bottom) {
                continue;
            }

            // Skip if already processed this position
            const posKey = `${Math.round(pos.x * 100)},${Math.round(pos.y * 100)}`;
            if (processedPositions.has(posKey)) continue;
            processedPositions.add(posKey);

            const perpDistance = getPerpendicularDistance(pos.x, pos.y);

            if (perpDistance <= worldPerpendicularThreshold) {
                const distToCursor = Math.hypot(pos.x - endX, pos.y - endY);
                candidates.push({
                    type: 'multipoint',
                    x: pos.x,
                    y: pos.y,
                    distance: distToCursor,
                    perpDistance: perpDistance
                });
            }
        }

        // Check all multi-intersections
        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];

            if (intersection.lineIndices.length < 2) continue;

            // Check if in viewport
            if (intersection.x < viewportBounds.left || intersection.x > viewportBounds.right ||
                intersection.y < viewportBounds.top || intersection.y > viewportBounds.bottom) {
                continue;
            }

            const perpDistance = getPerpendicularDistance(intersection.x, intersection.y);

            if (perpDistance <= worldPerpendicularThreshold) {
                const distToCursor = Math.hypot(intersection.x - endX, intersection.y - endY);

                const alreadyAdded = candidates.some(c =>
                    Math.hypot(c.x - intersection.x, c.y - intersection.y) < 0.1
                );

                if (!alreadyAdded) {
                    candidates.push({
                        type: 'intersection',
                        x: intersection.x,
                        y: intersection.y,
                        lineIndices: intersection.lineIndices,
                        distance: distToCursor,
                        perpDistance: perpDistance
                    });
                }
            }
        }

        if (candidates.length === 0) return null;

        // Sort by distance to cursor
        candidates.sort((a, b) => a.distance - b.distance);

        return candidates[0];
    }
}
