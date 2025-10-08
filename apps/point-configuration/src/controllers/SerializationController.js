// serialization-controller.js
// Controller for serialization/deserialization of configurations

import pako from 'https://esm.sh/pako@2.1.0';

export class SerializationController {
    constructor(geometryModel, historyModel) {
        this.geometryModel = geometryModel;
        this.historyModel = historyModel;
    }

    /**
     * Serialize current state to compressed base64 string
     */
    serialize() {
        const precision = 1;
        const factor = Math.pow(10, precision);

        const state = {
            p: this.geometryModel.points.map(p => [
                Math.round(p.x * factor) / factor,
                Math.round(p.y * factor) / factor,
                p.onLines
            ]),
            l: this.geometryModel.lines.map(l => [
                Math.round(l.x * factor) / factor,
                Math.round(l.y * factor) / factor,
                Math.round(l.angle * 10000) / 10000
            ])
        };

        const jsonStr = JSON.stringify(state);
        const compressed = pako.deflate(jsonStr, { level: 9 });
        const base64 = btoa(String.fromCharCode.apply(null, compressed))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        console.log(`Serialized state: ${jsonStr.length} chars → ${base64.length} chars`);
        return base64;
    }

    /**
     * Deserialize from compressed base64 string
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

            // Restore points
            this.geometryModel.points = state.p.map(([x, y, onLines]) => ({
                x,
                y,
                onLines,
                isIntersection: onLines.length > 1,
                intersectionIndex: null
            }));

            // Restore lines
            this.geometryModel.lines = state.l.map(([x, y, angle]) => ({
                x,
                y,
                angle
            }));

            // Recompute intersections
            this.geometryModel.recomputeIntersections();

            // Clear history
            this.historyModel.clear();

            console.log(`✅ Loaded: ${this.geometryModel.points.length} points, ${this.geometryModel.lines.length} lines`);

            // Notify observers
            this.geometryModel.notify();

            return true;
        } catch (e) {
            console.error('Failed to deserialize state:', e);
            return false;
        }
    }

    /**
     * Load configuration from examples.json
     */
    async loadConfiguration(configName) {
        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

            const examples = await response.json();
            const config = examples[configName];
            if (!config) throw new Error(`Configuration '${configName}' not found`);

            // Parse points
            this.geometryModel.points = config.points.map(([x, y, onLines]) => ({
                x,
                y,
                onLines,
                isIntersection: onLines.length > 1,
                intersectionIndex: null
            }));

            // Compute lines from points
            const linePoints = new Map();
            this.geometryModel.points.forEach((point, idx) => {
                point.onLines.forEach(lineIdx => {
                    if (!linePoints.has(lineIdx)) linePoints.set(lineIdx, []);
                    linePoints.get(lineIdx).push(idx);
                });
            });

            this.geometryModel.lines = [];
            linePoints.forEach((pointIndices, lineIdx) => {
                if (pointIndices.length < 2) throw new Error(`Line ${lineIdx} has < 2 points`);
                const p1 = this.geometryModel.points[pointIndices[0]];
                const p2 = this.geometryModel.points[pointIndices[1]];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                this.geometryModel.lines[lineIdx] = { x: p1.x, y: p1.y, angle };
            });

            // Recompute intersections
            this.geometryModel.recomputeIntersections();

            // Clear history
            this.historyModel.clear();

            console.log(`✅ Loaded ${config.name}`);

            // Notify observers
            this.geometryModel.notify();

            return true;
        } catch (e) {
            console.error('Failed to load configuration:', e);
            return false;
        }
    }
}
