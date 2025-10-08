// matroid-model.js
// Model for matroid computations

import { PointLineMatroid } from '../state/matroid.js';

export class MatroidModel {
    constructor(geometryModel) {
        this.geometryModel = geometryModel;
    }

    /**
     * Get matroid statistics (recomputed each time)
     */
    getStats() {
        if (this.geometryModel.points.length === 0) {
            return null;
        }

        const matroid = new PointLineMatroid(
            this.geometryModel.points,
            this.geometryModel.lines
        );

        return {
            rank: matroid.rank,
            numPoints: this.geometryModel.points.length,
            numLines: this.geometryModel.lines.length,
            bases: matroid.getAllBases(),
            circuits: matroid.getAllCircuits(),
            flats: matroid.getAllFlats()
        };
    }
}
