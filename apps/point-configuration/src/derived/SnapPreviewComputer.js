// SnapPreviewComputer.js
// Pure function to compute snap target for current mouse position

import { projectPointOntoLine, getPointPosition } from '../geometry/geometry-utils.js';

/**
 * Computes snap target for the current mouse position.
 * This is a pure function - always recomputes from scratch.
 */
export class SnapPreviewComputer {
    constructor(configuration, interactionState, intersectionsComputer, transformState) {
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.intersectionsComputer = intersectionsComputer;
        this.transformState = transformState;

        // Screen-space snap thresholds (in pixels)
        this.snapThresholds = {
            point: 15,
            intersection: 15,
            line: 20
        };
    }

    /**
     * Calculate snap target for current mouse position.
     * @returns {Object|null} Snap object or null
     *   Point snap: {type: 'point', x, y, pointIndex}
     *   Intersection snap: {type: 'intersection', x, y, intersectionIndex, lineIndices}
     *   Line snap: {type: 'line', x, y, lineIndex}
     */
    compute() {
        // Check if mouse position exists
        const mousePos = this.interactionState.getMousePosition();
        if (!mousePos) {
            return null;
        }

        const worldX = mousePos.worldX;
        const worldY = mousePos.worldY;
        const scale = this.transformState.getScale();

        // Convert screen-space thresholds to world-space
        const worldPointThreshold = this.snapThresholds.point / scale;
        const worldIntersectionThreshold = this.snapThresholds.intersection / scale;
        const worldLineThreshold = this.snapThresholds.line / scale;

        const points = this.configuration.getAllPoints();
        const lines = this.configuration.getAllLines();
        const intersections = this.intersectionsComputer.compute();

        // Priority 1: Check for nearby existing points
        let closestPoint = null;
        let minPointDist = worldPointThreshold;

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const pos = getPointPosition(point, intersections);
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minPointDist) {
                minPointDist = dist;
                closestPoint = {
                    type: 'point',
                    x: pos.x,
                    y: pos.y,
                    pointIndex: i
                };
            }
        }

        if (closestPoint) {
            return closestPoint;
        }

        // Priority 2: Check for nearby intersections
        let closestIntersection = null;
        let minIntersectionDist = worldIntersectionThreshold;

        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];
            const dx = intersection.x - worldX;
            const dy = intersection.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minIntersectionDist) {
                minIntersectionDist = dist;
                closestIntersection = {
                    type: 'intersection',
                    x: intersection.x,
                    y: intersection.y,
                    intersectionIndex: i,
                    lineIndices: intersection.lineIndices
                };
            }
        }

        if (closestIntersection) {
            return closestIntersection;
        }

        // Priority 3: Check for nearby lines
        let closestLine = null;
        let minLineDist = worldLineThreshold;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const projected = projectPointOntoLine(worldX, worldY, line);
            const dx = projected.x - worldX;
            const dy = projected.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minLineDist) {
                minLineDist = dist;
                closestLine = {
                    type: 'line',
                    x: projected.x,
                    y: projected.y,
                    lineIndex: i
                };
            }
        }

        if (closestLine) {
            return closestLine;
        }

        // No snap
        return null;
    }
}
