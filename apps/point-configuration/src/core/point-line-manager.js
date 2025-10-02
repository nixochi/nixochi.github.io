// point-line-manager.js
// Manages points, lines, and intersection data

import { getPointPosition, findIntersectionByLines, computeIntersections } from '../geometry/geometry-utils.js';
import { PointLineMatroid } from '../math/matroid.js';

export class PointLineManager {
    constructor(scale) {
        // State
        this.points = []; // Array of {x, y, onLines: [], isIntersection: boolean, intersectionIndex: null}
        this.lines = []; // Array of {x, y, angle} - infinite lines through point with angle
        this.intersections = []; // Array of {x, y, lineIndices: [i, j]}

        // Settings
        this.pointRadius = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 14 : 9;
        this.scale = scale;

        // Callback for state changes
        this.onStateChange = null;
    }

    /**
     * Update scale (for threshold calculations)
     */
    updateScale(scale) {
        this.scale = scale;
    }

    /**
     * Get points at a given world position
     */
    getPointsAtPosition(worldX, worldY, threshold = null) {
        // Convert screen-space threshold to world-space (uses pointRadius + 5 as screen pixels)
        const screenThreshold = threshold || (this.pointRadius + 5);
        const worldThreshold = screenThreshold / this.scale;
        const indices = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const pos = getPointPosition(point, this.intersections);
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= worldThreshold) {
                indices.push(i);
            }
        }

        return indices;
    }

    /**
     * Add a new point
     */
    addPoint(x, y, onLines = [], isIntersection = false, intersectionIndex = null) {
        // If on 2+ lines and no intersection index provided, find it
        if (onLines.length >= 2 && intersectionIndex === null) {
            intersectionIndex = findIntersectionByLines(onLines, this.intersections);
        }

        // If on 2+ lines, must reference an intersection
        if (onLines.length >= 2 && intersectionIndex !== null) {
            const intersection = this.intersections[intersectionIndex];
            this.points.push({
                x: intersection.x,
                y: intersection.y,
                onLines,
                isIntersection: true,
                intersectionIndex
            });
        } else {
            this.points.push({
                x,
                y,
                onLines,
                isIntersection,
                intersectionIndex: null
            });
        }

        console.log('Added point:', this.points.length - 1, 'at', x, y, 'onLines:', onLines, 'intersectionIndex:', intersectionIndex);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }

    /**
     * Add a point with snap preview
     */
    addPointWithSnap(snapPreview) {
        if (snapPreview.type === 'intersection') {
            const intersection = this.intersections[snapPreview.intersectionIndex];
            this.addPoint(
                intersection.x,
                intersection.y,
                [...intersection.lineIndices],
                true,
                snapPreview.intersectionIndex
            );
        } else if (snapPreview.type === 'line') {
            this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [snapPreview.lineIndex],
                false,
                null
            );
        } else if (snapPreview.type === 'point') {
            // Snapping to existing point - create new point at same location (multipoint)
            const targetPoint = this.points[snapPreview.pointIndex];
            this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [...targetPoint.onLines],
                targetPoint.isIntersection,
                targetPoint.intersectionIndex
            );
        }
    }

    /**
     * Add a new line
     */
    addLine(startX, startY, endX, endY, startPointIndices = null, endPointIndices = null) {
        // If we're creating a line through existing points, use their actual positions
        // to ensure the line passes through them exactly (avoid snap artifacts)
        let actualStartX = startX;
        let actualStartY = startY;

        if (startPointIndices && startPointIndices.length > 0) {
            const startPoint = this.points[startPointIndices[0]];
            const startPos = getPointPosition(startPoint, this.intersections);
            actualStartX = startPos.x;
            actualStartY = startPos.y;
        }

        // Calculate angle from actual positions
        const dx = endX - actualStartX;
        const dy = endY - actualStartY;
        const angle = Math.atan2(dy, dx);

        this.lines.push({ x: actualStartX, y: actualStartY, angle });
        const newLineIndex = this.lines.length - 1;

        // Collect all point indices to add to the line
        const allPointIndices = new Set();
        if (startPointIndices) {
            startPointIndices.forEach(idx => allPointIndices.add(idx));
        }
        if (endPointIndices) {
            endPointIndices.forEach(idx => allPointIndices.add(idx));
        }

        // Add all points to the line
        allPointIndices.forEach(pointIndex => {
            const point = this.points[pointIndex];
            if (!point.onLines.includes(newLineIndex)) {
                point.onLines.push(newLineIndex);
                point.isIntersection = point.onLines.length > 1;
            }
        });

        // Recompute all intersections FIRST
        this.intersections = computeIntersections(this.lines, this.points);

        // Update intersection references for points on 2+ lines
        // BUT don't move points that were part of this line creation (they're already positioned correctly)
        allPointIndices.forEach(pointIndex => {
            const point = this.points[pointIndex];
            if (point.onLines.length >= 2) {
                // Find the intersection for this point's lines
                const intersectionIndex = findIntersectionByLines(point.onLines, this.intersections);
                if (intersectionIndex !== null) {
                    point.intersectionIndex = intersectionIndex;
                    // DON'T update position - the line was created through this point's current position
                    // Moving it would cause a visual "snap"
                }
            }
        });

        console.log('Added line:', newLineIndex, 'angle:', angle, 'startPoints:', startPointIndices, 'endPoints:', endPointIndices);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }

    /**
     * Remove lines with fewer than 3 points
     */
    removeNonEssentialLines() {
        // Count points on each line
        const pointsPerLine = new Array(this.lines.length).fill(0);

        for (const point of this.points) {
            for (const lineIndex of point.onLines) {
                pointsPerLine[lineIndex]++;
            }
        }

        // Find lines with fewer than 3 points
        const linesToRemove = new Set();
        for (let i = 0; i < this.lines.length; i++) {
            if (pointsPerLine[i] < 3) {
                linesToRemove.add(i);
            }
        }

        if (linesToRemove.size === 0) {
            console.log('No non-essential lines to remove');
            return;
        }

        // Create index mapping (old index -> new index)
        const indexMap = new Map();
        let newIndex = 0;
        for (let i = 0; i < this.lines.length; i++) {
            if (!linesToRemove.has(i)) {
                indexMap.set(i, newIndex);
                newIndex++;
            }
        }

        // Remove lines
        this.lines = this.lines.filter((_, i) => !linesToRemove.has(i));

        // Update point line memberships
        for (const point of this.points) {
            point.onLines = point.onLines
                .filter(lineIndex => !linesToRemove.has(lineIndex))
                .map(lineIndex => indexMap.get(lineIndex));
            point.isIntersection = point.onLines.length > 1;
        }

        // Recompute intersections
        this.intersections = computeIntersections(this.lines, this.points);

        console.log('Removed', linesToRemove.size, 'non-essential lines');

        if (this.onStateChange) {
            this.onStateChange();
        }
    }

    /**
     * Add points at all intersections in viewport
     */
    addIntersectionPoints(viewportBounds) {
        if (this.intersections.length === 0) {
            console.log('No intersections to add points to');
            return;
        }

        let addedCount = 0;

        // Check each intersection
        for (let i = 0; i < this.intersections.length; i++) {
            const intersection = this.intersections[i];

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

        console.log('Added', addedCount, 'intersection points');

        if (addedCount > 0 && this.onStateChange) {
            this.onStateChange();
        }
    }

    /**
     * Get matroid statistics
     */
    getMatroidStats() {
        if (this.points.length === 0) {
            return null;
        }

        const matroid = new PointLineMatroid(this.points, this.lines);

        return {
            rank: matroid.rank,
            numPoints: this.points.length,
            numLines: this.lines.length,
            bases: matroid.getAllBases(),
            circuits: matroid.getAllCircuits(),
            flats: matroid.getAllFlats()
        };
    }

    /**
     * Serialize current state to URL-safe string
     */
    serializeState() {
        const state = {
            points: this.points.map(p => ({
                x: Math.round(p.x * 100) / 100, // Round for compactness
                y: Math.round(p.y * 100) / 100,
                onLines: p.onLines
            })),
            lines: this.lines.map(l => ({
                x: Math.round(l.x * 100) / 100,
                y: Math.round(l.y * 100) / 100,
                angle: Math.round(l.angle * 1000) / 1000
            }))
        };

        const json = JSON.stringify(state);
        // Use base64url encoding (URL-safe variant)
        return btoa(json)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Deserialize state from URL-safe string
     */
    deserializeState(encoded) {
        try {
            // Decode base64url
            const base64 = encoded
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            const json = atob(base64);
            const state = JSON.parse(json);

            // Restore state
            this.points = state.points.map(p => ({
                ...p,
                isIntersection: p.onLines.length > 1,
                intersectionIndex: null
            }));
            this.lines = state.lines;

            // Recompute intersections
            this.intersections = computeIntersections(this.lines, this.points);

            return true;
        } catch (e) {
            console.error('Failed to deserialize state:', e);
            return false;
        }
    }
}
