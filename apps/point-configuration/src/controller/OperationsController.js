// OperationsController.js
// Complex operations on configuration (clean, add intersections, clear, load examples)
// All modifications recorded via HistoryController

import { getPointPosition } from '../geometry/geometry-utils.js';

/**
 * Handles complex operations on the configuration.
 * These are higher-level operations that may modify configuration extensively.
 */
export class OperationsController {
    constructor(configuration, intersectionsComputer, transformState, historyController) {
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
        this.transformState = transformState;
        this.historyController = historyController;
    }

    /**
     * Remove lines with fewer than 3 points
     */
    removeNonEssentialLines() {
        const lines = this.configuration.getAllLines();
        const points = this.configuration.getAllPoints();

        // Count points on each line
        const pointsPerLine = new Array(lines.length).fill(0);
        points.forEach(point => {
            point.onLines.forEach(lineIndex => {
                pointsPerLine[lineIndex]++;
            });
        });

        // Find lines with fewer than 3 points
        const linesToRemove = [];
        for (let i = 0; i < lines.length; i++) {
            if (pointsPerLine[i] < 3) {
                linesToRemove.push(i);
            }
        }

        if (linesToRemove.length === 0) {
            console.log('No non-essential lines to remove');
            return;
        }

        // Create index mapping (old index → new index)
        const indexMap = new Map();
        let newIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (!linesToRemove.includes(i)) {
                indexMap.set(i, newIndex);
                newIndex++;
            }
        }

        // Record affected points before modification
        const affectedPoints = [];
        points.forEach((point, index) => {
            const oldOnLines = [...point.onLines];
            const newOnLines = oldOnLines
                .filter(lineIndex => !linesToRemove.includes(lineIndex))
                .map(lineIndex => indexMap.get(lineIndex));

            if (oldOnLines.length !== newOnLines.length || !oldOnLines.every((v, i) => v === newOnLines[i])) {
                affectedPoints.push({ index, oldOnLines, newOnLines });
            }
        });

        // Remove lines (in reverse order to preserve indices)
        for (let i = linesToRemove.length - 1; i >= 0; i--) {
            const lineIndex = linesToRemove[i];
            this.configuration.removeLine(lineIndex);
        }

        // Update point line memberships
        affectedPoints.forEach(p => {
            this.configuration.updatePointLines(p.index, p.newOnLines);
        });

        console.log(`Removed ${linesToRemove.length} non-essential lines`);

        // Note: History recording for this complex operation would require
        // a compound action type or multiple individual actions
    }

    /**
     * Add points at all intersections in viewport
     */
    addIntersectionPoints() {
        const viewportBounds = this.transformState.getViewportBounds();
        const intersections = this.intersectionsComputer.compute();

        if (intersections.length === 0) {
            console.log('No intersections to add points to');
            return;
        }

        let addedCount = 0;

        // Check each intersection
        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];

            // Check if intersection is in viewport
            if (intersection.x < viewportBounds.left || intersection.x > viewportBounds.right ||
                intersection.y < viewportBounds.top || intersection.y > viewportBounds.bottom) {
                continue;
            }

            // Check if there's already a point at this intersection
            const existingPoints = this.getPointsAtPosition(intersection.x, intersection.y, 1);

            if (existingPoints.length === 0) {
                // No point exists, add one with all the lines from this intersection
                this.configuration.addPoint(
                    intersection.x,
                    intersection.y,
                    [...intersection.lineIndices]
                );

                const newIndex = this.configuration.getPointsCount() - 1;
                this.historyController.recordAddPoint(newIndex, {
                    x: intersection.x,
                    y: intersection.y,
                    onLines: intersection.lineIndices
                });

                addedCount++;
            }
        }

        console.log(`Added ${addedCount} intersection points`);
    }

    /**
     * Clear all points and lines
     */
    clearAll() {
        // Note: This doesn't record history - it's a destructive operation
        this.configuration.clear();
        console.log('Cleared all points and lines');
    }

    /**
     * Load configuration from examples.json
     */
    async loadExample(exampleName) {
        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

            const examples = await response.json();
            const config = examples[exampleName];
            if (!config) throw new Error(`Configuration '${exampleName}' not found`);

            // Clear current configuration
            this.configuration.clear();

            // Parse points from compact format [x, y, [lines]]
            const pointsData = config.points.map(([x, y, onLines]) => ({
                x, y, onLines
            }));

            // Add points
            pointsData.forEach(p => {
                this.configuration.addPoint(p.x, p.y, p.onLines);
            });

            // Compute lines from points
            const linePoints = new Map();
            pointsData.forEach((point, idx) => {
                point.onLines.forEach(lineIdx => {
                    if (!linePoints.has(lineIdx)) linePoints.set(lineIdx, []);
                    linePoints.get(lineIdx).push(idx);
                });
            });

            // Add lines
            linePoints.forEach((pointIndices, lineIdx) => {
                if (pointIndices.length < 2) {
                    console.error(`Line ${lineIdx} has < 2 points`);
                    return;
                }

                const points = this.configuration.getAllPoints();
                const p1 = points[pointIndices[0]];
                const p2 = points[pointIndices[1]];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                this.configuration.addLine(p1.x, p1.y, angle);
            });

            console.log(`✅ Loaded ${config.name}: ${pointsData.length} points, ${linePoints.size} lines`);

            return true;
        } catch (e) {
            console.error('Failed to load configuration:', e);
            return false;
        }
    }

    /**
     * Export canvas as PNG image
     */
    exportImage(canvas) {
        canvas.toBlob((blob) => {
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            link.download = `point-configuration-${timestamp}.png`;

            link.href = url;
            link.click();

            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    /**
     * Export configuration as JSON string (to clipboard)
     */
    exportConfiguration() {
        const data = this.configuration.serialize();
        const json = JSON.stringify(data, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(json).then(() => {
            console.log('Configuration copied to clipboard');
            alert('Configuration copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            console.log('Configuration (copy manually):', json);
            alert('Failed to copy. Check console for configuration.');
        });
    }

    /**
     * Import configuration from JSON string
     */
    importConfiguration(json) {
        try {
            const data = JSON.parse(json);

            if (this.configuration.deserialize(data)) {
                console.log('✅ Configuration imported successfully');
                return true;
            } else {
                console.error('Failed to import configuration');
                return false;
            }
        } catch (e) {
            console.error('Failed to parse configuration JSON:', e);
            return false;
        }
    }

    /**
     * Add point manually (from debug menu)
     */
    addPointManual(x, y, onLines) {
        this.configuration.addPoint(x, y, onLines);
        const newIndex = this.configuration.getPointsCount() - 1;
        this.historyController.recordAddPoint(newIndex, { x, y, onLines });
        console.log(`Added point at (${x}, ${y}) on lines [${onLines.join(', ')}]`);
    }

    /**
     * Add line manually (from debug menu)
     */
    addLineManual(pointIndices) {
        const points = this.configuration.getAllPoints();
        const intersections = this.intersectionsComputer.compute();

        if (pointIndices.length < 2) {
            console.error('Need at least 2 points to create a line');
            return;
        }

        // Get positions of the points
        const p1 = points[pointIndices[0]];
        const p2 = points[pointIndices[1]];

        const pos1 = getPointPosition(p1, intersections);
        const pos2 = getPointPosition(p2, intersections);

        // Calculate angle
        const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);

        // Add the line
        this.configuration.addLine(pos1.x, pos1.y, angle);
        const newLineIndex = this.configuration.getLinesCount() - 1;

        // Track changes for history
        const affectedPoints = [];
        pointIndices.forEach(pointIndex => {
            const point = points[pointIndex];
            affectedPoints.push({
                index: pointIndex,
                oldOnLines: [...point.onLines]
            });
        });

        // Add all points to the line
        pointIndices.forEach(pointIndex => {
            const point = points[pointIndex];
            if (!point.onLines.includes(newLineIndex)) {
                const newOnLines = [...point.onLines, newLineIndex];
                this.configuration.updatePointLines(pointIndex, newOnLines);
            }
        });

        // Record history
        this.historyController.recordAddLine(
            newLineIndex,
            { x: pos1.x, y: pos1.y, angle },
            affectedPoints
        );

        console.log(`Added line through points [${pointIndices.join(', ')}]`);
    }

    /**
     * Helper: Get points at a given position
     */
    getPointsAtPosition(worldX, worldY, threshold = null) {
        const scale = this.transformState.getScale();
        const hitRadius = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 24 : 18;
        const screenThreshold = threshold || hitRadius;
        const worldThreshold = screenThreshold / scale;

        const points = this.configuration.getAllPoints();
        const intersections = this.intersectionsComputer.compute();
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
