// snap-manager.js
// Logic for snapping points to intersections and lines

import { projectPointOntoLine } from './geometry-utils.js';

export class SnapManager {
    constructor(intersectionSnapThreshold = 15, lineSnapThreshold = 20) {
        this.intersectionSnapThreshold = intersectionSnapThreshold;
        this.lineSnapThreshold = lineSnapThreshold;
        this.snapPreview = null;
    }

    /**
     * Updates snap preview for placing a new point
     * @param {number} worldX - Mouse x in world coordinates
     * @param {number} worldY - Mouse y in world coordinates
     * @param {Array} intersections - Array of intersection objects
     * @param {Array} lines - Array of line objects
     * @param {Array} points - Array of existing points
     * @returns {Object|null} Snap preview object or null
     */
    updateSnapPreview(worldX, worldY, intersections, lines, points) {
        // Priority 1: Check for nearby existing points (for merging)
        let closestPoint = null;
        let minPointDist = this.intersectionSnapThreshold; // Use same threshold

        points.forEach((point, index) => {
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minPointDist) {
                minPointDist = dist;
                closestPoint = {
                    x: point.x,
                    y: point.y,
                    type: 'point',
                    pointIndex: index
                };
            }
        });

        if (closestPoint) {
            this.snapPreview = closestPoint;
            return closestPoint;
        }

        // Priority 2: Check for nearby intersections
        let closestIntersection = null;
        let minIntersectionDist = this.intersectionSnapThreshold;

        intersections.forEach((intersection, index) => {
            const dx = intersection.x - worldX;
            const dy = intersection.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minIntersectionDist) {
                minIntersectionDist = dist;
                closestIntersection = {
                    x: intersection.x,
                    y: intersection.y,
                    type: 'intersection',
                    intersectionIndex: index
                };
            }
        });

        if (closestIntersection) {
            this.snapPreview = closestIntersection;
            return closestIntersection;
        }

        // Priority 3: Check for nearby lines
        let closestLine = null;
        let minLineDist = this.lineSnapThreshold;

        lines.forEach((line, index) => {
            const projected = projectPointOntoLine(worldX, worldY, line);
            const dx = projected.x - worldX;
            const dy = projected.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minLineDist) {
                minLineDist = dist;
                closestLine = {
                    x: projected.x,
                    y: projected.y,
                    type: 'line',
                    lineIndex: index
                };
            }
        });

        if (closestLine) {
            this.snapPreview = closestLine;
            return closestLine;
        }

        // No snap
        this.snapPreview = null;
        return null;
    }

    /**
     * Updates snap preview while dragging a point
     * FIXED: Treats dragged points as fresh - no line exclusions
     * @param {number} worldX - Mouse x in world coordinates
     * @param {number} worldY - Mouse y in world coordinates
     * @param {Array} intersections - Array of intersection objects
     * @param {Array} lines - Array of line objects
     * @param {Array} points - Array of existing points
     * @returns {Object|null} Snap preview object or null
     */
    updateDragSnapPreview(worldX, worldY, intersections, lines, points) {
        // Same logic as updateSnapPreview - treat dragged point as fresh
        return this.updateSnapPreview(worldX, worldY, intersections, lines, points);
    }

    /**
     * Clears the snap preview
     */
    clearSnapPreview() {
        this.snapPreview = null;
    }

    /**
     * Gets the current snap preview
     */
    getSnapPreview() {
        return this.snapPreview;
    }
}