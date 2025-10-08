// state/Configuration.js
// Primary State: Points and lines data - the core domain model

import pako from 'https://esm.sh/pako@2.1.0';

export class Configuration {
    constructor() {
        // Data structures
        this.points = []; // Array of {x: number, y: number, onLines: number[]}
        this.lines = []; // Array of {x: number, y: number, angle: number}

        // Observer pattern
        this.observers = new Set();
    }

    // ============================================================================
    // Point operations
    // ============================================================================

    /**
     * Add a new point
     */
    addPoint(x, y, onLines = []) {
        const point = {
            x,
            y,
            onLines: [...onLines]
        };

        this.points.push(point);
        const index = this.points.length - 1;

        this.notify({ type: 'pointAdded', index, point });

        return index;
    }

    /**
     * Remove a point by index
     */
    removePoint(index) {
        if (index < 0 || index >= this.points.length) {
            console.error('Invalid point index:', index);
            return false;
        }

        const point = this.points[index];
        this.points.splice(index, 1);

        this.notify({ type: 'pointRemoved', index, point });

        return true;
    }

    /**
     * Update point properties
     */
    updatePoint(index, updates) {
        if (index < 0 || index >= this.points.length) {
            console.error('Invalid point index:', index);
            return false;
        }

        const point = this.points[index];
        Object.assign(point, updates);

        this.notify({ type: 'pointUpdated', index, point });

        return true;
    }

    /**
     * Update only point position
     */
    updatePointPosition(index, x, y) {
        return this.updatePoint(index, { x, y });
    }

    /**
     * Update only point line membership
     */
    updatePointLines(index, onLines) {
        return this.updatePoint(index, { onLines: [...onLines] });
    }

    /**
     * Get point by index
     */
    getPoint(index) {
        return this.points[index];
    }

    /**
     * Get all points (returns shallow copy to prevent external mutation)
     */
    getAllPoints() {
        return [...this.points];
    }

    /**
     * Get number of points
     */
    getPointsCount() {
        return this.points.length;
    }

    /**
     * Find points near a world position
     */
    getPointsAtPosition(worldX, worldY, threshold = 18) {
        const indices = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= threshold) {
                indices.push(i);
            }
        }

        return indices;
    }

    // ============================================================================
    // Line operations
    // ============================================================================

    /**
     * Add a new line
     */
    addLine(x, y, angle) {
        const line = { x, y, angle };

        this.lines.push(line);
        const index = this.lines.length - 1;

        this.notify({ type: 'lineAdded', index, line });

        return index;
    }

    /**
     * Remove a line by index
     */
    removeLine(index) {
        if (index < 0 || index >= this.lines.length) {
            console.error('Invalid line index:', index);
            return false;
        }

        const line = this.lines[index];
        this.lines.splice(index, 1);

        // Update all points' onLines arrays
        for (const point of this.points) {
            // Remove references to the deleted line
            point.onLines = point.onLines.filter(lineIdx => lineIdx !== index);

            // Adjust indices for lines that came after the deleted one
            point.onLines = point.onLines.map(lineIdx => lineIdx > index ? lineIdx - 1 : lineIdx);
        }

        this.notify({ type: 'lineRemoved', index, line });

        return true;
    }

    /**
     * Update line properties
     */
    updateLine(index, updates) {
        if (index < 0 || index >= this.lines.length) {
            console.error('Invalid line index:', index);
            return false;
        }

        const line = this.lines[index];
        Object.assign(line, updates);

        this.notify({ type: 'lineUpdated', index, line });

        return true;
    }

    /**
     * Get line by index
     */
    getLine(index) {
        return this.lines[index];
    }

    /**
     * Get all lines (returns shallow copy to prevent external mutation)
     */
    getAllLines() {
        return [...this.lines];
    }

    /**
     * Get number of lines
     */
    getLinesCount() {
        return this.lines.length;
    }

    // ============================================================================
    // Bulk operations
    // ============================================================================

    /**
     * Clear all points and lines
     */
    clear() {
        this.points = [];
        this.lines = [];

        this.notify({ type: 'cleared' });
    }

    // ============================================================================
    // Serialization
    // ============================================================================

    /**
     * Serialize to compact JSON format with compression
     * Format: {v: 1, p: [[x,y,[lines]], ...], l: [[x,y,angle], ...]}
     */
    serialize() {
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

            console.log(`Serialized: ${jsonStr.length} chars → ${base64.length} chars (${Math.round(base64.length / jsonStr.length * 100)}%)`);

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
     */
    _createCompactState(precision) {
        const factor = Math.pow(10, precision);

        return {
            v: 1, // version number
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
     */
    _verifyTopology(compactState, precision) {
        const tolerance = 1 / Math.pow(10, precision) + 0.01;

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
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Deserialize from compressed string
     */
    deserialize(encoded) {
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

            // Try to decompress
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
                onLines
            }));

            this.lines = state.l.map(([x, y, angle]) => ({
                x,
                y,
                angle
            }));

            console.log(`✅ Loaded: ${this.points.length} points, ${this.lines.length} lines`);

            this.notify({ type: 'deserialized' });

            return true;
        } catch (e) {
            console.error('Failed to deserialize:', e);
            return false;
        }
    }

    // ============================================================================
    // Observer pattern
    // ============================================================================

    /**
     * Register observer callback
     */
    subscribe(callback) {
        this.observers.add(callback);
    }

    /**
     * Remove observer callback
     */
    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    /**
     * Notify all observers with event object
     */
    notify(event) {
        this.observers.forEach(callback => callback(event));
    }
}
