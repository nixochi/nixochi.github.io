// IntersectionsComputer.js
// Pure function to compute all line intersections from configuration

import { computeIntersections } from '../geometry/geometry-utils.js';

/**
 * Computes line intersections from the current configuration.
 * This is a pure function - no caching, no state, just computation.
 */
export class IntersectionsComputer {
    constructor(configuration) {
        this.configuration = configuration;
    }

    /**
     * Calculate all line intersections from current configuration.
     * @returns {Array} Array of intersection objects with shape:
     *   {x: number, y: number, lineIndices: number[]}
     */
    compute() {
        const lines = this.configuration.getAllLines();
        const points = this.configuration.getAllPoints();

        // Use existing geometry utility to compute intersections
        return computeIntersections(lines, points);
    }
}
