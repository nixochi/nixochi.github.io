// geometry-model.js
// Model for geometric data (points, lines, intersections)

import { computeIntersections, findIntersectionByLines, getPointPosition } from '../geometry/geometry-utils.js';

export class GeometryModel {
    constructor() {
        // State
        this.points = []; // Array of {x, y, onLines: [], isIntersection: boolean, intersectionIndex: null}
        this.lines = []; // Array of {x, y, angle} - infinite lines through point with angle
        this.intersections = []; // Array of {x, y, lineIndices: [i, j]}

        // Observer pattern
        this.listeners = new Set();
    }

    /**
     * Subscribe to geometry changes
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify listeners of changes
     */
    notify() {
        this.listeners.forEach(listener => listener());
    }

    /**
     * Get points at a given world position
     */
    getPointsAtPosition(worldX, worldY, threshold) {
        const indices = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const pos = getPointPosition(point, this.intersections);
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= threshold) {
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

        this.notify();
        return this.points.length - 1; // Return index of new point
    }

    /**
     * Update an existing point
     */
    updatePoint(index, updates) {
        if (index < 0 || index >= this.points.length) return false;

        Object.assign(this.points[index], updates);

        // Recompute intersections if line membership changed
        if (updates.onLines !== undefined) {
            this.recomputeIntersections();
        }

        this.notify();
        return true;
    }

    /**
     * Add a new line
     */
    addLine(x, y, angle) {
        this.lines.push({ x, y, angle });
        this.recomputeIntersections();
        this.notify();
        return this.lines.length - 1; // Return index of new line
    }

    /**
     * Remove a point by index
     */
    removePoint(index) {
        if (index < 0 || index >= this.points.length) {
            console.error('Invalid point index:', index);
            return false;
        }

        this.points.splice(index, 1);
        this.recomputeIntersections();

        console.log('Removed point:', index);
        this.notify();
        return true;
    }

    /**
     * Remove a line by index
     */
    removeLine(index) {
        if (index < 0 || index >= this.lines.length) {
            console.error('Invalid line index:', index);
            return false;
        }

        // Remove the line
        this.lines.splice(index, 1);

        // Update all points' onLines arrays
        for (const point of this.points) {
            // Remove references to the deleted line
            point.onLines = point.onLines.filter(lineIdx => lineIdx !== index);

            // Adjust indices for lines that came after the deleted one
            point.onLines = point.onLines.map(lineIdx => lineIdx > index ? lineIdx - 1 : lineIdx);

            // Update intersection status
            point.isIntersection = point.onLines.length > 1;

            // Clear intersection index (will be recomputed)
            if (!point.isIntersection) {
                point.intersectionIndex = null;
            }
        }

        this.recomputeIntersections();

        console.log('Removed line:', index);
        this.notify();
        return true;
    }

    /**
     * Recompute all intersections and update point references
     */
    recomputeIntersections() {
        this.intersections = computeIntersections(this.lines, this.points);

        // Update intersection indices for all points on 2+ lines
        for (const point of this.points) {
            if (point.onLines.length >= 2) {
                point.intersectionIndex = findIntersectionByLines(point.onLines, this.intersections);

                // Update position to match intersection
                if (point.intersectionIndex !== null) {
                    const intersection = this.intersections[point.intersectionIndex];
                    point.x = intersection.x;
                    point.y = intersection.y;
                }
            } else {
                point.intersectionIndex = null;
            }
        }
    }
}
