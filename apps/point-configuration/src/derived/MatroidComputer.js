// MatroidComputer.js
// Pure function to compute matroid properties (rank, bases, circuits, flats)

import { PointLineMatroid } from '../math/matroid.js';

/**
 * Computes matroid properties from the current configuration.
 * This wraps the existing PointLineMatroid class.
 */
export class MatroidComputer {
    constructor(configuration, intersectionsComputer) {
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
    }

    /**
     * Calculate all matroid properties.
     * @returns {Object|null} {
     *   rank: number,
     *   numPoints: number,
     *   numLines: number,
     *   bases: number[][],
     *   circuits: number[][],
     *   flats: number[][]
     * } or null if no points
     */
    compute() {
        const points = this.configuration.getAllPoints();
        const lines = this.configuration.getAllLines();

        // Quick return for empty configuration
        if (points.length === 0) {
            return null;
        }

        // Use existing matroid computation
        const matroid = new PointLineMatroid(points, lines);

        return {
            rank: matroid.rank,
            numPoints: points.length,
            numLines: lines.length,
            bases: matroid.getAllBases(),
            circuits: matroid.getAllCircuits(),
            flats: matroid.getAllFlats()
        };
    }
}
