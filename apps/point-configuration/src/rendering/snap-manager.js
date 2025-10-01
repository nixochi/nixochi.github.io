// snap-manager.js
// Logic for snapping points to intersections and lines

import { projectPointOntoLine, getPointPosition } from '../geometry/geometry-utils.js';

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
     * @param {number} scale - Current zoom scale (converts screen threshold to world threshold)
     * @returns {Object|null} Snap preview object or null
     */
    updateSnapPreview(worldX, worldY, intersections, lines, points, scale = 1) {
        // Convert screen-space thresholds to world-space (larger world radius when zoomed out)
        const worldIntersectionThreshold = this.intersectionSnapThreshold / scale;
        const worldLineThreshold = this.lineSnapThreshold / scale;

        // Priority 1: Check for nearby existing points (for merging)
        let closestPoint = null;
        let minPointDist = worldIntersectionThreshold; // Use same threshold

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
        let minIntersectionDist = worldIntersectionThreshold;

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
        let minLineDist = worldLineThreshold;

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
     * @param {number} scale - Current zoom scale
     * @returns {Object|null} Snap preview object or null
     */
    updateDragSnapPreview(worldX, worldY, intersections, lines, points, scale = 1) {
        // Same logic as updateSnapPreview - treat dragged point as fresh
        return this.updateSnapPreview(worldX, worldY, intersections, lines, points, scale);
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

    /**
     * Find snap targets for line preview near cursor
     * Only snaps when cursor is NEAR existing multipoints or multi-intersections
     * @param {number} _startX - Line start X (unused but kept for API consistency)
     * @param {number} _startY - Line start Y (unused but kept for API consistency)
     * @param {number} endX - Line end X (cursor position)
     * @param {number} endY - Line end Y (cursor position)
     * @param {Array} points - Array of point objects
     * @param {Array} intersections - Array of intersection objects
     * @param {Object} viewportBounds - Viewport bounds in world coordinates
     * @param {number} scale - Current zoom scale
     * @param {number} screenSnapThreshold - Screen-space threshold (default 30)
     * @returns {Object|null} Snap result with snapTarget and allIntersections or null
     */
    findLineEndpointSnap(_startX, _startY, endX, endY, points, intersections, viewportBounds, scale, screenSnapThreshold = 30) {
        const candidates = [];

        // Convert screen-space threshold to world-space
        const worldSnapThreshold = screenSnapThreshold / scale;

        // Check all existing points (including those not on any line)
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const pos = getPointPosition(point, intersections);

            // Check if in viewport
            if (pos.x < viewportBounds.left || pos.x > viewportBounds.right ||
                pos.y < viewportBounds.top || pos.y > viewportBounds.bottom) {
                continue;
            }

            // Check if cursor is near this point
            const distToCursor = Math.hypot(pos.x - endX, pos.y - endY);
            if (distToCursor <= worldSnapThreshold) {
                // Find all points at this location (multipoint)
                const pointIndices = this.getPointsAtPosition(pos.x, pos.y, points, intersections, scale);

                // Check if already added
                const alreadyAdded = candidates.some(c =>
                    c.type === 'multipoint' &&
                    Math.hypot(c.x - pos.x, c.y - pos.y) < 0.1
                );

                if (!alreadyAdded) {
                    candidates.push({
                        type: 'multipoint',
                        x: pos.x,
                        y: pos.y,
                        pointIndices: pointIndices,
                        distance: distToCursor
                    });
                }
            }
        }

        // Check all multi-intersections (2+ lines)
        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];

            // Only consider multi-intersections (2+ lines)
            if (intersection.lineIndices.length < 2) continue;

            // Check if in viewport
            if (intersection.x < viewportBounds.left || intersection.x > viewportBounds.right ||
                intersection.y < viewportBounds.top || intersection.y > viewportBounds.bottom) {
                continue;
            }

            // Check if cursor is near this multi-intersection
            const distToCursor = Math.hypot(intersection.x - endX, intersection.y - endY);
            if (distToCursor <= worldSnapThreshold) {
                candidates.push({
                    type: 'intersection',
                    x: intersection.x,
                    y: intersection.y,
                    lineIndices: intersection.lineIndices,
                    distance: distToCursor
                });
            }
        }

        if (candidates.length === 0) return null;

        // Sort by distance to cursor
        candidates.sort((a, b) => a.distance - b.distance);

        return {
            snapTarget: candidates[0],
            allIntersections: candidates // All nearby targets (not all line intersections)
        };
    }

    /**
     * Helper: Get all points at a given position
     * @param {number} worldX - X coordinate in world space
     * @param {number} worldY - Y coordinate in world space
     * @param {Array} points - Array of point objects
     * @param {Array} intersections - Array of intersection objects
     * @param {number} scale - Current zoom scale
     * @param {number} threshold - Optional threshold (default uses pointRadius + 5)
     * @returns {Array} Array of point indices at this position
     */
    getPointsAtPosition(worldX, worldY, points, intersections, scale, threshold = null) {
        // Convert screen-space threshold to world-space (uses pointRadius + 5 as screen pixels)
        const pointRadius = 9; // Default point radius
        const screenThreshold = threshold || (pointRadius + 5);
        const worldThreshold = screenThreshold / scale;
        const indices = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const pos = getPointPosition(point, intersections);
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= worldThreshold) {
                indices.push(i);
            }
        }

        return indices;
    }
}