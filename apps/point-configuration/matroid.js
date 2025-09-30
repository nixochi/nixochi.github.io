// matroid.js
// Matroid computations for point-line configurations

export class PointLineMatroid {
    constructor(points, lines) {
        this.points = points;
        this.lines = lines;
        this.groundSet = points.map((_, i) => i);
        
        // Compute which points are on which lines (reverse mapping)
        this.linesWithPoints = this._computeLinesWithPoints();
        
        // Compute rank
        this.rank = this._computeRank();
    }
    
    /**
     * Compute which points lie on each line
     * @returns {Array} Array where each element is an array of point indices on that line
     */
    _computeLinesWithPoints() {
        const linesWithPoints = this.lines.map(() => []);
        
        this.points.forEach((point, pointIndex) => {
            point.onLines.forEach(lineIndex => {
                linesWithPoints[lineIndex].push(pointIndex);
            });
        });
        
        return linesWithPoints;
    }
    
    /**
     * Check if a set of points are all collinear (lie on a single line)
     * @param {Array} pointIndices - Array of point indices
     * @returns {boolean} True if all points lie on a common line
     */
    areCollinear(pointIndices) {
        if (pointIndices.length <= 1) return true;
        if (pointIndices.length === 2) return true; // Two points always collinear
        
        // Check each line to see if it contains all the points
        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const pointsOnLine = this.linesWithPoints[lineIndex];
            const allOnThisLine = pointIndices.every(pi => pointsOnLine.includes(pi));
            if (allOnThisLine) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if a set of points is independent (not all collinear)
     * @param {Array} pointIndices - Array of point indices
     * @returns {boolean} True if points are independent
     */
    isIndependent(pointIndices) {
        if (pointIndices.length === 0) return true;
        return !this.areCollinear(pointIndices);
    }
    
    /**
     * Compute the rank of a subset of points
     * @param {Array} pointIndices - Array of point indices
     * @returns {number} The rank (max size of independent subset)
     */
    rankOfSubset(pointIndices) {
        if (pointIndices.length === 0) return 0;
        if (pointIndices.length === 1) return 1;
        if (pointIndices.length === 2) return 2;
        
        // If all points are collinear, rank is 2 (or less if fewer points)
        if (this.areCollinear(pointIndices)) {
            return Math.min(2, pointIndices.length);
        }
        
        // Otherwise, rank is 3 (we're in 2D, so max rank is 3)
        return 3;
    }
    
    /**
     * Compute the rank of the entire matroid
     * @returns {number} The rank
     */
    _computeRank() {
        if (this.groundSet.length === 0) return 0;
        if (this.groundSet.length === 1) return 1;
        if (this.groundSet.length === 2) return 2;
        
        // Check if all points are collinear
        if (this.areCollinear(this.groundSet)) {
            return 2;
        }
        
        // In 2D, max rank is 3
        return 3;
    }
    
    /**
     * Get all points that lie on a given line
     * @param {number} lineIndex - Index of the line
     * @returns {Array} Array of point indices on that line
     */
    _pointsOnLine(lineIndex) {
        return this.linesWithPoints[lineIndex] || [];
    }
    
    /**
     * Generate all subsets of the ground set of a given size
     * @param {number} size - Size of subsets to generate
     * @returns {Array} Array of subsets (each subset is an array of point indices)
     */
    _subsetsOfSize(size) {
        const subsets = [];
        const n = this.groundSet.length;
        
        function* combinations(array, k) {
            if (k === 0) {
                yield [];
                return;
            }
            
            for (let i = 0; i <= array.length - k; i++) {
                for (const combo of combinations(array.slice(i + 1), k - 1)) {
                    yield [array[i], ...combo];
                }
            }
        }
        
        for (const subset of combinations(this.groundSet, size)) {
            subsets.push(subset);
        }
        
        return subsets;
    }
    
    /**
     * Compute the closure of a set of points
     * @param {Array} pointIndices - Array of point indices
     * @returns {Array} Closure (all points in the span)
     */
    closure(pointIndices) {
        if (pointIndices.length === 0) return [];
        
        const rank = this.rankOfSubset(pointIndices);
        
        // If rank is 3, closure is just the set itself (we're in general position)
        if (rank === 3) {
            return [...pointIndices];
        }
        
        // If rank is 2 or less, find all points on the line(s) containing these points
        const closureSet = new Set(pointIndices);
        
        if (rank === 2) {
            // Find all lines containing at least 2 of our points
            for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
                const pointsOnLine = this._pointsOnLine(lineIndex);
                const intersection = pointIndices.filter(pi => pointsOnLine.includes(pi));
                
                // If at least 2 of our points are on this line, add all points on this line to closure
                if (intersection.length >= 2) {
                    pointsOnLine.forEach(pi => closureSet.add(pi));
                }
            }
        }
        
        return Array.from(closureSet);
    }
    
    /**
     * Get all bases (maximal independent sets)
     * @returns {Array} Array of bases (each base is an array of point indices)
     */
    getAllBases() {
        const bases = [];
        const subsets = this._subsetsOfSize(this.rank);
        
        for (const subset of subsets) {
            if (this.isIndependent(subset)) {
                bases.push(subset);
            }
        }
        
        return bases;
    }
    
    /**
     * Get all circuits (minimal dependent sets)
     * @returns {Array} Array of circuits (each circuit is an array of point indices)
     */
    getAllCircuits() {
        const circuits = [];
        
        // Circuits in a rank-3 matroid are either:
        // 1. Sets of 3+ collinear points
        // 2. For each line with k points, we get C(k,3) circuits of size 3
        
        // Check all lines
        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const pointsOnLine = this._pointsOnLine(lineIndex);
            
            if (pointsOnLine.length >= 3) {
                // All triples on this line are circuits
                const triples = this._subsetsOfSizeFromArray(pointsOnLine, 3);
                circuits.push(...triples);
            }
        }
        
        return circuits;
    }
    
    /**
     * Helper to generate subsets of a specific size from a given array
     * @param {Array} array - Source array
     * @param {number} size - Size of subsets
     * @returns {Array} Array of subsets
     */
    _subsetsOfSizeFromArray(array, size) {
        const subsets = [];
        
        function* combinations(arr, k) {
            if (k === 0) {
                yield [];
                return;
            }
            
            for (let i = 0; i <= arr.length - k; i++) {
                for (const combo of combinations(arr.slice(i + 1), k - 1)) {
                    yield [arr[i], ...combo];
                }
            }
        }
        
        for (const subset of combinations(array, size)) {
            subsets.push(subset);
        }
        
        return subsets;
    }
    
    /**
     * Get all flats (closed sets)
     * @returns {Array} Array of flats (each flat is an array of point indices)
     */
    getAllFlats() {
        const flats = [];
        const seen = new Set();
        
        // Empty set is always a flat
        flats.push([]);
        seen.add('');
        
        // Check all subsets
        for (let size = 1; size <= this.groundSet.length; size++) {
            const subsets = this._subsetsOfSize(size);
            
            for (const subset of subsets) {
                const closureSet = this.closure(subset);
                closureSet.sort((a, b) => a - b);
                const key = closureSet.join(',');
                
                if (!seen.has(key)) {
                    seen.add(key);
                    flats.push(closureSet);
                }
            }
        }
        
        // Sort flats by size then lexicographically
        flats.sort((a, b) => {
            if (a.length !== b.length) return a.length - b.length;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return a[i] - b[i];
            }
            return 0;
        });
        
        return flats;
    }
}