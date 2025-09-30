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
     * @returns {Object|null} Snap preview object or null
     */
    updateSnapPreview(worldX, worldY, intersections, lines) {
        // Priority 1: Check for nearby intersections
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

        // Priority 2: Check for nearby lines
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
     * @param {number} worldX - Mouse x in world coordinates
     * @param {number} worldY - Mouse y in world coordinates
     * @param {Array} intersections - Array of intersection objects
     * @param {Array} lines - Array of line objects
     * @param {Array} pointOnLines - Lines the dragged point is already on
     * @returns {Object|null} Snap preview object or null
     */
    updateDragSnapPreview(worldX, worldY, intersections, lines, pointOnLines = []) {
        // Priority 1: Check for nearby intersections
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

        // Priority 2: Check for nearby lines (excluding lines point is already on)
        let closestLine = null;
        let minLineDist = this.lineSnapThreshold;

        lines.forEach((line, index) => {
            // Skip if point is already on this line
            if (pointOnLines.includes(index)) {
                return;
            }

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
