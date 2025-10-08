// geometry-controller.js
// Controller for geometry operations (points, lines, intersections)

import { findIntersectionByLines, getPointPosition } from '../geometry/geometry-utils.js';

export class GeometryController {
    constructor(geometryModel, historyModel) {
        this.geometryModel = geometryModel;
        this.historyModel = historyModel;
    }

    // ============================================================================
    // Point Operations
    // ============================================================================

    /**
     * Add a new point
     */
    addPoint(x, y, onLines = [], isIntersection = false, intersectionIndex = null) {
        // Add to model
        const index = this.geometryModel.addPoint(x, y, onLines, isIntersection, intersectionIndex);
        const newPoint = this.geometryModel.points[index];

        // Record history
        const action = this.historyModel.createAddPointAction(index, newPoint);
        this.historyModel.recordAction(action);

        // Notify observers
        this.geometryModel.notify();

        console.log('Added point:', index, 'at', x, y, 'onLines:', onLines);
        return index;
    }

    /**
     * Add a point with snap preview
     */
    addPointWithSnap(snapPreview) {
        if (snapPreview.type === 'intersection') {
            const intersection = this.geometryModel.intersections[snapPreview.intersectionIndex];
            return this.addPoint(
                intersection.x,
                intersection.y,
                [...intersection.lineIndices],
                true,
                snapPreview.intersectionIndex
            );
        } else if (snapPreview.type === 'line') {
            return this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [snapPreview.lineIndex],
                false,
                null
            );
        } else if (snapPreview.type === 'point') {
            // Snapping to existing point - create new point at same location (multipoint)
            const targetPoint = this.geometryModel.points[snapPreview.pointIndex];
            return this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [...targetPoint.onLines],
                targetPoint.isIntersection,
                targetPoint.intersectionIndex
            );
        }
    }

    /**
     * Update a point (used for dragging)
     */
    updatePoint(index, oldState, newState, actionType = 'move') {
        const point = this.geometryModel.points[index];
        
        // Apply new state
        point.x = newState.x;
        point.y = newState.y;
        point.onLines = [...newState.onLines];
        point.isIntersection = newState.isIntersection;
        point.intersectionIndex = newState.intersectionIndex;

        // Record history based on action type
        let action;
        if (actionType === 'merge') {
            action = this.historyModel.createMergePointAction(index, oldState, newState);
        } else if (actionType === 'unmerge') {
            action = this.historyModel.createUnmergePointAction(index, oldState, newState);
        } else {
            action = this.historyModel.createMovePointAction(index, oldState, newState);
        }
        this.historyModel.recordAction(action);

        // Notify observers
        this.geometryModel.notify();
    }

    /**
     * Remove a point
     */
    removePoint(index) {
        return this.geometryModel.removePoint(index);
    }

    // ============================================================================
    // Line Operations
    // ============================================================================

    /**
     * Add a new line
     */
    addLine(startX, startY, endX, endY, startPointIndices = null, endPointIndices = null) {
        // If creating line through existing points, use their actual positions
        let actualStartX = startX;
        let actualStartY = startY;

        if (startPointIndices && startPointIndices.length > 0) {
            const startPoint = this.geometryModel.points[startPointIndices[0]];
            const startPos = getPointPosition(startPoint, this.geometryModel.intersections);
            actualStartX = startPos.x;
            actualStartY = startPos.y;
        }

        // Calculate angle from actual positions
        const dx = endX - actualStartX;
        const dy = endY - actualStartY;
        const angle = Math.atan2(dy, dx);

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
            const point = this.geometryModel.points[pointIndex];
            affectedPoints.push({
                index: pointIndex,
                oldOnLines: [...point.onLines],
                oldIsIntersection: point.isIntersection,
                oldIntersectionIndex: point.intersectionIndex
            });
        });

        // Add line to model
        this.geometryModel.lines.push({ x: actualStartX, y: actualStartY, angle });
        const newLineIndex = this.geometryModel.lines.length - 1;

        // Add all points to the line
        allPointIndices.forEach(pointIndex => {
            const point = this.geometryModel.points[pointIndex];
            if (!point.onLines.includes(newLineIndex)) {
                point.onLines.push(newLineIndex);
                point.isIntersection = point.onLines.length > 1;
            }
        });

        // Recompute intersections
        this.geometryModel.recomputeIntersections();

        // Record history
        const action = this.historyModel.createAddLineAction(
            newLineIndex,
            this.geometryModel.lines[newLineIndex],
            affectedPoints
        );
        this.historyModel.recordAction(action);

        // Notify observers
        this.geometryModel.notify();

        console.log('Added line:', newLineIndex, 'angle:', angle, 'startPoints:', startPointIndices, 'endPoints:', endPointIndices);
        return newLineIndex;
    }

    /**
     * Remove a line
     */
    removeLine(index) {
        return this.geometryModel.removeLine(index);
    }

    /**
     * Remove lines with fewer than 3 points
     */
    removeNonEssentialLines() {
        // Count points on each line
        const pointsPerLine = new Array(this.geometryModel.lines.length).fill(0);

        for (const point of this.geometryModel.points) {
            for (const lineIndex of point.onLines) {
                pointsPerLine[lineIndex]++;
            }
        }

        // Find lines with fewer than 3 points
        const linesToRemove = new Set();
        for (let i = 0; i < this.geometryModel.lines.length; i++) {
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
        for (let i = 0; i < this.geometryModel.lines.length; i++) {
            if (!linesToRemove.has(i)) {
                indexMap.set(i, newIndex);
                newIndex++;
            }
        }

        // Remove lines
        this.geometryModel.lines = this.geometryModel.lines.filter((_, i) => !linesToRemove.has(i));

        // Update point line memberships
        for (const point of this.geometryModel.points) {
            point.onLines = point.onLines
                .filter(lineIndex => !linesToRemove.has(lineIndex))
                .map(lineIndex => indexMap.get(lineIndex));
            point.isIntersection = point.onLines.length > 1;
        }

        // Recompute intersections
        this.geometryModel.recomputeIntersections();

        // Notify observers
        this.geometryModel.notify();
    }

    // ============================================================================
    // Intersection Operations
    // ============================================================================

    /**
     * Add points at all intersections in viewport
     */
    addIntersectionPoints(viewportBounds) {
        if (this.geometryModel.intersections.length === 0) {
            return;
        }

        let addedCount = 0;

        // Check each intersection
        for (let i = 0; i < this.geometryModel.intersections.length; i++) {
            const intersection = this.geometryModel.intersections[i];

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

        if (addedCount > 0) {
            this.geometryModel.notify();
        }
    }

    // ============================================================================
    // Queries
    // ============================================================================

    /**
     * Get all points at a given position (with scale-adjusted threshold)
     */
    getPointsAtPosition(worldX, worldY, scale, threshold = null) {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hitRadius = isTouchDevice ? 24 : 18;
        const screenThreshold = threshold || hitRadius;
        const worldThreshold = screenThreshold / scale;
        
        return this.geometryModel.getPointsAtPosition(worldX, worldY, worldThreshold);
    }

    /**
     * Clear all geometry
     */
    clearAll() {
        this.geometryModel.points = [];
        this.geometryModel.lines = [];
        this.geometryModel.intersections = [];
        this.historyModel.clear();
        this.geometryModel.notify();
    }
}