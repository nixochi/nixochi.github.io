// point-line-manager.js
// Manages points, lines, and intersection data

import { getPointPosition, findIntersectionByLines, computeIntersections } from '../geometry/geometry-utils.js';
import { PointLineMatroid } from '../math/matroid.js';
import { HistoryManager } from './history-manager.js';
import pako from 'https://esm.sh/pako@2.1.0';

export class PointLineManager {
    constructor(scale) {
        // State
        this.points = []; // Array of {x, y, onLines: [], isIntersection: boolean, intersectionIndex: null}
        this.lines = []; // Array of {x, y, angle} - infinite lines through point with angle
        this.intersections = []; // Array of {x, y, lineIndices: [i, j]}

        // Settings
        this.pointRadius = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 14 : 9;
        this.hitRadius = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 24 : 18; // Larger touch target
        this.scale = scale;

        // History manager
        this.history = new HistoryManager(this);

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
        // Convert screen-space threshold to world-space (uses hitRadius as screen pixels)
        const screenThreshold = threshold || this.hitRadius;
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

        const newIndex = this.points.length - 1;
        const newPoint = this.points[newIndex];

        // Record history
        this.history.recordAction(
            this.history.createAddPointAction(newIndex, newPoint)
        );

        console.log('Added point:', newIndex, 'at', x, y, 'onLines:', onLines, 'intersectionIndex:', intersectionIndex);
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

        // Track changes for history (before modification)
        const affectedPoints = [];
        allPointIndices.forEach(pointIndex => {
            const point = this.points[pointIndex];
            affectedPoints.push({
                index: pointIndex,
                oldOnLines: [...point.onLines],
                oldIsIntersection: point.isIntersection,
                oldIntersectionIndex: point.intersectionIndex
            });
        });

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

        // Record history
        this.history.recordAction(
            this.history.createAddLineAction(
                newLineIndex,
                this.lines[newLineIndex],
                affectedPoints
            )
        );

        console.log('Added line:', newLineIndex, 'angle:', angle, 'startPoints:', startPointIndices, 'endPoints:', endPointIndices);
        if (this.onStateChange) {
            this.onStateChange();
        }
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

        // No need to update point indices in onLines since we're not tracking point-to-point references
        // Just recompute intersections
        this.intersections = computeIntersections(this.lines, this.points);

        console.log('Removed point:', index);
        if (this.onStateChange) {
            this.onStateChange();
        }

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

        // Recompute intersections
        this.intersections = computeIntersections(this.lines, this.points);

        // Update intersection indices for all points
        for (const point of this.points) {
            if (point.isIntersection && point.onLines.length >= 2) {
                point.intersectionIndex = findIntersectionByLines(point.onLines, this.intersections);
            }
        }

        console.log('Removed line:', index);
        if (this.onStateChange) {
            this.onStateChange();
        }

        return true;
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
     * Serialize current state to compressed URL-safe string
     * Uses compact array format and gzip compression
     */
    serializeState() {
        // Try with 1 decimal precision first
        let precision = 1;
        let state = this._createCompactState(precision);

        // Verify topology is preserved
        if (!this._verifyTopology(state, precision)) {
            console.warn('Topology changed with precision 1, trying precision 2');
            precision = 2;
            state = this._createCompactState(precision);

            if (!this._verifyTopology(state, precision)) {
                console.error('Topology still changed with precision 2, using precision 3');
                precision = 3;
                state = this._createCompactState(precision);
            }
        }

        // Convert to JSON and compress
        const jsonStr = JSON.stringify(state);

        try {
            // Compress with pako
            const compressed = pako.deflate(jsonStr, { level: 9 });

            // Convert to base64url (URL-safe base64)
            const base64 = btoa(String.fromCharCode.apply(null, compressed))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            console.log(`Serialized state: ${jsonStr.length} chars → ${base64.length} chars (${Math.round(base64.length / jsonStr.length * 100)}% of original)`);

            return base64;
        } catch (e) {
            console.error('Compression failed, using uncompressed:', e);
            // Fallback to uncompressed base64
            return btoa(jsonStr)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        }
    }

    /**
     * Create compact state representation with given precision
     * Format: {p: [[x,y,[lines]], ...], l: [[x,y,angle], ...], v: 1}
     */
    _createCompactState(precision) {
        const factor = Math.pow(10, precision);

        return {
            v: 1, // version number for future compatibility
            p: this.points.map(p => [
                Math.round(p.x * factor) / factor,
                Math.round(p.y * factor) / factor,
                p.onLines
            ]),
            l: this.lines.map(l => [
                Math.round(l.x * factor) / factor,
                Math.round(l.y * factor) / factor,
                Math.round(l.angle * 10000) / 10000 // 4 decimals for angles
            ])
        };
    }

    /**
     * Verify that topology is preserved with given precision
     * Returns true if all points remain on their assigned lines
     */
    _verifyTopology(compactState, precision) {
        const tolerance = 1 / Math.pow(10, precision) + 0.01; // Add small epsilon

        // Check each point is still on all its lines
        for (let i = 0; i < compactState.p.length; i++) {
            const [px, py, onLines] = compactState.p[i];

            for (const lineIdx of onLines) {
                const [lx, ly, angle] = compactState.l[lineIdx];

                // Calculate distance from point to line
                const dx = Math.cos(angle);
                const dy = Math.sin(angle);

                // Vector from line point to target point
                const vx = px - lx;
                const vy = py - ly;

                // Project onto line direction
                const t = vx * dx + vy * dy;

                // Perpendicular distance
                const perpX = vx - t * dx;
                const perpY = vy - t * dy;
                const distance = Math.sqrt(perpX * perpX + perpY * perpY);

                if (distance > tolerance) {
                    console.warn(`Point ${i} is ${distance.toFixed(4)} units from line ${lineIdx} (tolerance: ${tolerance.toFixed(4)})`);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Deserialize state from compressed URL-safe string
     */
    deserializeState(encoded) {
        if (!encoded) return false;

        try {
            // Convert base64url to base64
            let base64 = encoded
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }

            // Try to decompress (assume it's compressed)
            let jsonStr;
            try {
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const decompressed = pako.inflate(bytes, { to: 'string' });
                jsonStr = decompressed;
            } catch (e) {
                // Not compressed, try direct decode
                jsonStr = atob(base64);
            }

            const state = JSON.parse(jsonStr);

            // Version check
            if (state.v !== 1) {
                console.error('Unsupported state version:', state.v);
                return false;
            }

            // Restore from compact format
            this.points = state.p.map(([x, y, onLines]) => ({
                x,
                y,
                onLines,
                isIntersection: onLines.length > 1,
                intersectionIndex: null
            }));

            this.lines = state.l.map(([x, y, angle]) => ({
                x,
                y,
                angle
            }));

            // Recompute intersections
            this.intersections = computeIntersections(this.lines, this.points);

            // Clear history when loading from URL
            this.history.clear();

            console.log(`✅ Loaded configuration: ${this.points.length} points, ${this.lines.length} lines`);

            return true;
        } catch (e) {
            console.error('Failed to deserialize state:', e);
            return false;
        }
    }

    /**
     * Load configuration from JSON
     */
    async loadConfiguration(configName) {
        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

            const examples = await response.json();
            const config = examples[configName];
            if (!config) throw new Error(`Configuration '${configName}' not found`);

            // Parse points from compact format [x, y, [lines]]
            this.points = config.points.map(([x, y, onLines]) => ({
                x,
                y,
                onLines,
                isIntersection: onLines.length > 1,
                intersectionIndex: null
            }));

            // Compute lines from points
            const linePoints = new Map();
            this.points.forEach((point, idx) => {
                point.onLines.forEach(lineIdx => {
                    if (!linePoints.has(lineIdx)) linePoints.set(lineIdx, []);
                    linePoints.get(lineIdx).push(idx);
                });
            });

            this.lines = [];
            linePoints.forEach((pointIndices, lineIdx) => {
                if (pointIndices.length < 2) throw new Error(`Line ${lineIdx} has < 2 points`);
                const p1 = this.points[pointIndices[0]];
                const p2 = this.points[pointIndices[1]];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                this.lines[lineIdx] = { x: p1.x, y: p1.y, angle };
            });

            // Compute intersections
            this.intersections = computeIntersections(this.lines, this.points);

            // Clear history when loading a configuration
            this.history.clear();

            console.log(`✅ Loaded ${config.name}: ${this.points.length} points, ${this.lines.length} lines`);

            if (this.onStateChange) {
                this.onStateChange();
            }

            return true;
        } catch (e) {
            console.error('Failed to load configuration:', e);
            return false;
        }
    }
}
