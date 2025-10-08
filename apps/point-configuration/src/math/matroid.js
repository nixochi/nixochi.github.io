// matroid.js
// Matroid computations for point-line configurations

export class PointLineMatroid {
    constructor(points, lines) {
        this.points = points;
        this.lines = lines;
        this.groundSet = points.map((_, i) => i);
        
        // Compute which points are on which lines (reverse mapping)
        this.linesWithPoints = this._computeLinesWithPoints();
        
        // Group points by position (for multipoint detection)
        this.pointsByPosition = this._groupPointsByPosition();
        
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
     * Group points by their position (for multipoint detection)
     * @returns {Map} Map from position key to array of point indices
     */
    _groupPointsByPosition() {
        const groups = new Map();
        
        this.points.forEach((point, index) => {
            const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(index);
        });
        
        return groups;
    }
    
    /**
     * Check if two points are at the same position
     * @param {number} i - First point index
     * @param {number} j - Second point index
     * @returns {boolean} True if points are at same position
     */
    _areAtSamePosition(i, j) {
        const p1 = this.points[i];
        const p2 = this.points[j];
        return Math.abs(p1.x - p2.x) < 0.01 && Math.abs(p1.y - p2.y) < 0.01;
    }

    /**
     * Check if a set of points are all on the same position
     * @param {Array} pointIndices - Array of point indicies
     * @returns {boolean} True if all the points are at the same place.
     */
    areAllAtSamePosition(pointIndices){
        if (pointIndices.length <= 1){
            return true;
        }
        for(let i = 0; i < pointIndices.length - 1; i++){
            if (!this._areAtSamePosition(pointIndices[i],pointIndices[i+1])){
                return false;
            }
        }
        return true;
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
        if (pointIndices.length === 1) return true; // Single point is always independent

        // Check for multipoints (any two points at same position = dependent)
        for (let i = 0; i < pointIndices.length; i++) {
            for (let j = i + 1; j < pointIndices.length; j++) {
                if (this._areAtSamePosition(pointIndices[i], pointIndices[j])) {
                    return false; // Multipoint = dependent
                }
            }
        }

        // Two points (not at same position) are always independent
        if (pointIndices.length === 2) return true;

        // Three or more points: check collinearity
        return !this.areCollinear(pointIndices);
    }

    /**
     * Compute the rank of a subset of points
     * @param {Array} pointIndices - Array of point indices
     * @returns {number} The rank (max size of independent subset)
     */
    rankOfSubset(pointIndices) {
        if (pointIndices.length === 0) return 0;

        // Count distinct positions in the subset
        const positions = new Set();
        pointIndices.forEach(i => {
            const point = this.points[i];
            const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
            positions.add(key);
        });

        const numPositions = positions.size;

        if (numPositions === 0) return 0;
        if (numPositions === 1) return 1;
        if (numPositions === 2) return 2;

        // If all points are collinear, rank is 2
        if (this.areCollinear(pointIndices)) {
            return 2;
        }

        // Otherwise, rank is 3 (we're in 2D, so max rank is 3)
        return 3;
    }
    
    /**
     * Compute the rank of the entire matroid
     * @returns {number} The rank
     */
    _computeRank() {
        return this.rankOfSubset(this.groundSet);
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
     * Find all points collinear with a given pair of points
     * @param {number} i - First point index
     * @param {number} j - Second point index
     * @returns {Array} All points collinear with i and j (including i and j)
     */
    _findCollinearPoints(i, j) {
        // Start with the pair
        const collinearSet = new Set([i, j]);
        
        // Check each explicit line
        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const pointsOnLine = this._pointsOnLine(lineIndex);
            
            // If both i and j are on this line, add all points on this line
            if (pointsOnLine.includes(i) && pointsOnLine.includes(j)) {
                pointsOnLine.forEach(p => collinearSet.add(p));
            }
        }
        
        return Array.from(collinearSet).sort((a, b) => a - b);
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
        
        // 1. Size-2 circuits: multipoints (points at same location)
        this.pointsByPosition.forEach((pointIndices, positionKey) => {
            if (pointIndices.length >= 2) {
                // All pairs at this position are circuits
                const pairs = this._subsetsOfSizeFromArray(pointIndices, 2);
                circuits.push(...pairs);
            }
        });
        
        // 2. Size-3 circuits: collinear triples (excluding multipoints)
        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const pointsOnLine = this._pointsOnLine(lineIndex);
            
            if (pointsOnLine.length >= 3) {
                // Generate all triples
                const triples = this._subsetsOfSizeFromArray(pointsOnLine, 3);
                
                // Only include triples where no two points are at the same position
                for (const triple of triples) {
                    let hasMultipoint = false;
                    
                    // Check if any two points in the triple are at the same position
                    for (let i = 0; i < 3; i++) {
                        for (let j = i + 1; j < 3; j++) {
                            if (this._areAtSamePosition(triple[i], triple[j])) {
                                hasMultipoint = true;
                                break;
                            }
                        }
                        if (hasMultipoint) break;
                    }
                    
                    // Only add if no multipoint
                    if (!hasMultipoint) {
                        circuits.push(triple);
                    }
                }
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

        // Rank 0: empty set (always a flat)
        flats.push([]);
        seen.add('');

        // Base case handling for special configurations
        if (this.points.length === 0) {
            return flats;
        }

        // Get all multipoints (groups of points at the same position)
        const multipoints = Array.from(this.pointsByPosition.values())
            .map(group => group.sort((a, b) => a - b));

        // Rank 1: each multipoint is a flat
        for (const multipoint of multipoints) {
            const key = multipoint.join(',');
            if (!seen.has(key)) {
                seen.add(key);
                flats.push([...multipoint]);
            }
        }

        // If only one multipoint exists, we're done (all points at same position)
        if (multipoints.length === 1) {
            return flats;
        }

        // Check if all points are collinear
        const allCollinear = this.areCollinear(this.groundSet);

        if (allCollinear && this.rank === 2) {
            // All points on one line: the entire set is a rank-2 flat
            flats.push([...this.groundSet].sort((a, b) => a - b));
            return flats;
        }

        // Rank 2: for each pair of multipoints, find all multipoints on their line
        for (let i = 0; i < multipoints.length; i++) {
            for (let j = i + 1; j < multipoints.length; j++) {
                const mp1 = multipoints[i];
                const mp2 = multipoints[j];

                // Take one representative point from each multipoint
                const rep1 = mp1[0];
                const rep2 = mp2[0];

                // Find all points collinear with these two representatives
                const collinearPoints = this._findCollinearPoints(rep1, rep2);

                // Group these collinear points by their multipoints
                const collinearMultipoints = new Set();
                for (const pointIndex of collinearPoints) {
                    // Find which multipoint this point belongs to
                    for (const mp of multipoints) {
                        if (mp.includes(pointIndex)) {
                            // Add all points in this multipoint
                            mp.forEach(p => collinearMultipoints.add(p));
                            break;
                        }
                    }
                }

                // Convert to sorted array
                const flat = Array.from(collinearMultipoints).sort((a, b) => a - b);

                // Add as a flat (with deduplication)
                const key = flat.join(',');
                if (!seen.has(key)) {
                    seen.add(key);
                    flats.push(flat);
                }
            }
        }

        // Rank 3: the entire ground set (all points) - only if rank is actually 3
        if (this.rank === 3 && this.groundSet.length > 0) {
            const sorted = [...this.groundSet].sort((a, b) => a - b);
            const key = sorted.join(',');
            if (!seen.has(key)) {
                flats.push(sorted);
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