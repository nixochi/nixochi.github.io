// EXACT Voronoi implementation for L_2 (Euclidean) metric
// Uses Half-Space Intersection

/**
 * Exact L_2 Voronoi Diagram using Half-Space Intersection
 */
class VoronoiDiagramL2 {
    constructor(sites, bounds) {
        this.sites = sites;
        this.bounds = bounds;
        this.cells = [];

        this.compute();
    }

    compute() {
        this.cells = [];

        if (this.sites.length === 0) return;

        // Handle single site case
        if (this.sites.length === 1) {
            const boundingPolygon = this.createBoundingPolygon();
            this.cells = [{ site: this.sites[0], region: boundingPolygon }];
            return;
        }

        // Compute Voronoi cell for each site using half-space intersection
        for (const site of this.sites) {
            const cell = this.computeCellForSite(site);
            if (!this.isEmpty(cell.region)) {
                this.cells.push(cell);
            }
        }
    }

    computeCellForSite(site) {
        // Start with the entire bounding region
        let currentRegion = this.createBoundingPolygon();

        // For each other site, intersect with the half-space closer to our site
        for (const otherSite of this.sites) {
            if (otherSite.id === site.id) continue;

            // Create perpendicular bisector
            const bisector = this.createPerpendicularBisector(site, otherSite);

            // Create half-space containing points closer to our site
            const halfSpace = this.createHalfSpaceCloserTo(bisector, site);

            // Clip current region with this half-space
            currentRegion = this.clipPolygonWithHalfSpace(currentRegion, halfSpace);

            // Early exit if region becomes empty
            if (this.isEmpty(currentRegion)) {
                break;
            }
        }

        return { site, region: currentRegion };
    }

    createBoundingPolygon() {
        return [
            { x: this.bounds.left, y: this.bounds.top },
            { x: this.bounds.right, y: this.bounds.top },
            { x: this.bounds.right, y: this.bounds.bottom },
            { x: this.bounds.left, y: this.bounds.bottom }
        ];
    }

    createPerpendicularBisector(p1, p2) {
        // Midpoint between the two sites
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Direction vector from p1 to p2
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Perpendicular bisector equation: dx(x - midX) + dy(y - midY) = 0
        // Expanded: dx*x + dy*y - (dx*midX + dy*midY) = 0
        // Standard form: ax + by + c = 0
        const a = dx;
        const b = dy;
        const c = -(dx * midX + dy * midY);

        return { a, b, c };
    }

    createHalfSpaceCloserTo(line, site) {
        // Test which side of the line the site is on
        const siteValue = line.a * site.x + line.b * site.y + line.c;

        if (siteValue < 0) {
            // Site is on negative side, keep negative half-space: ax + by + c ≤ 0
            return { a: line.a, b: line.b, c: line.c };
        } else {
            // Site is on positive side, keep positive half-space: -ax - by - c ≤ 0
            return { a: -line.a, b: -line.b, c: -line.c };
        }
    }

    clipPolygonWithHalfSpace(polygon, halfSpace) {
        if (this.isEmpty(polygon)) return polygon;

        // Sutherland-Hodgman polygon clipping algorithm
        const vertices = polygon;
        const newVertices = [];
        const n = vertices.length;

        for (let i = 0; i < n; i++) {
            const currentVertex = vertices[i];
            const nextVertex = vertices[(i + 1) % n];

            const currentInside = this.isPointInHalfSpace(currentVertex, halfSpace);
            const nextInside = this.isPointInHalfSpace(nextVertex, halfSpace);

            if (currentInside && nextInside) {
                // Both inside - add next vertex
                newVertices.push({ x: nextVertex.x, y: nextVertex.y });

            } else if (currentInside && !nextInside) {
                // Leaving half-space - add intersection point
                const intersection = this.computeLineIntersection(currentVertex, nextVertex, halfSpace);
                if (intersection) {
                    newVertices.push(intersection);
                }

            } else if (!currentInside && nextInside) {
                // Entering half-space - add intersection and next vertex
                const intersection = this.computeLineIntersection(currentVertex, nextVertex, halfSpace);
                if (intersection) {
                    newVertices.push(intersection);
                }
                newVertices.push({ x: nextVertex.x, y: nextVertex.y });
            }
            // Both outside - add nothing
        }

        return newVertices;
    }

    isPointInHalfSpace(point, halfSpace) {
        const value = halfSpace.a * point.x + halfSpace.b * point.y + halfSpace.c;
        return value <= 1e-10; // Use small epsilon for numerical stability
    }

    computeLineIntersection(p1, p2, halfSpace) {
        // Line segment: P = p1 + t(p2 - p1), t ∈ [0,1]
        // Half-space boundary: ax + by + c = 0

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        const denominator = halfSpace.a * dx + halfSpace.b * dy;
        if (Math.abs(denominator) < 1e-10) {
            return null; // Parallel lines
        }

        const t = -(halfSpace.a * p1.x + halfSpace.b * p1.y + halfSpace.c) / denominator;

        // We don't need to check t bounds here because Sutherland-Hodgman handles it
        const x = p1.x + t * dx;
        const y = p1.y + t * dy;

        return { x, y };
    }

    isEmpty(polygon) {
        return !polygon || polygon.length < 3;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VoronoiDiagramL2 };
}
