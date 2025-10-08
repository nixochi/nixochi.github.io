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
     * Find snap target for line endpoint
     * Snaps to the nearest point that is close to the line (perpendicular distance)
     * @returns {Object|null} Snap result with snapTarget or null
     */
    findLineEndpointSnap(startX, startY, endX, endY, points, intersections, viewportBounds, scale, screenPerpendicularThreshold = 20, excludePointIndices = []) {
        const candidates = [];

        // Convert screen-space threshold to world-space
        const worldPerpendicularThreshold = screenPerpendicularThreshold / scale;

        // Calculate line direction
        const dx = endX - startX;
        const dy = endY - startY;
        const lineLength = Math.hypot(dx, dy);

        if (lineLength < 0.1) return null; // Line too short

        // Normalized direction
        const dirX = dx / lineLength;
        const dirY = dy / lineLength;

        // Helper: calculate perpendicular distance from point to infinite line
        const getPerpendicularDistance = (px, py) => {
            // Vector from start to point
            const vx = px - startX;
            const vy = py - startY;

            // Project onto line direction (dot product)
            const projection = vx * dirX + vy * dirY;

            // Perpendicular component
            const perpX = vx - projection * dirX;
            const perpY = vy - projection * dirY;

            return Math.hypot(perpX, perpY);
        };

        // Check all existing points (including those not on any line)
        const processedPositions = new Set();
        const excludeSet = new Set(excludePointIndices);

        for (let i = 0; i < points.length; i++) {
            if (excludeSet.has(i)) continue;

            const point = points[i];
            const pos = getPointPosition(point, intersections);

            // Check if in viewport
            if (pos.x < viewportBounds.left || pos.x > viewportBounds.right ||
                pos.y < viewportBounds.top || pos.y > viewportBounds.bottom) {
                continue;
            }

            // Skip if we've already processed this position
            const posKey = `${Math.round(pos.x * 100)},${Math.round(pos.y * 100)}`;
            if (processedPositions.has(posKey)) continue;
            processedPositions.add(posKey);

            const perpDistance = getPerpendicularDistance(pos.x, pos.y);

            if (perpDistance <= worldPerpendicularThreshold) {
                const distToCursor = Math.hypot(pos.x - endX, pos.y - endY);
                const pointIndices = this.getPointsAtPosition(pos.x, pos.y, points, intersections, scale);

                candidates.push({
                    type: 'multipoint',
                    x: pos.x,
                    y: pos.y,
                    pointIndices: pointIndices,
                    distance: distToCursor,
                    perpDistance: perpDistance
                });
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

            // Skip if this intersection is at the same position as any excluded point
            const isAtExcludedPoint = excludePointIndices.some(idx => {
                const point = points[idx];
                const pos = getPointPosition(point, intersections);
                return Math.hypot(pos.x - intersection.x, pos.y - intersection.y) < 0.1;
            });
            if (isAtExcludedPoint) continue;

            const perpDistance = getPerpendicularDistance(intersection.x, intersection.y);

            if (perpDistance <= worldPerpendicularThreshold) {
                const distToCursor = Math.hypot(intersection.x - endX, intersection.y - endY);

                const alreadyAdded = candidates.some(c =>
                    c.type === 'multipoint' &&
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

        candidates.sort((a, b) => a.distance - b.distance);

        return {
            snapTarget: candidates[0]
        };
    }

    /**
     * Helper: Get all points at a given position
     * @param {number} worldX - X coordinate in world space
     * @param {number} worldY - Y coordinate in world space
     * @param {Array} points - Array of point objects
     * @param {Array} intersections - Array of intersection objects
     * @param {number} scale - Current zoom scale
     * @param {number} threshold - Optional threshold (default uses larger hit radius)
     * @returns {Array} Array of point indices at this position
     */
    getPointsAtPosition(worldX, worldY, points, intersections, scale, threshold = null) {
        // Convert screen-space threshold to world-space (uses larger hit radius)
        const hitRadius = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 24 : 18;
        const screenThreshold = threshold || hitRadius;
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