// EXACT Voronoi implementation from tezcatli - Half-Space Intersection

/**
 * Point class for Voronoi calculations
 */
class VoronoiPoint {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id || `${x}_${y}`;
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    equals(other) {
        return Math.abs(this.x - other.x) < 1e-10 && Math.abs(this.y - other.y) < 1e-10;
    }
}

/**
 * Polygon class for representing regions
 */
class Polygon {
    constructor(vertices = []) {
        this.vertices = [...vertices];
    }

    isEmpty() {
        return this.vertices.length < 3;
    }

    area() {
        if (this.vertices.length < 3) return 0;
        
        let area = 0;
        const n = this.vertices.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this.vertices[i].x * this.vertices[j].y;
            area -= this.vertices[j].x * this.vertices[i].y;
        }
        
        return Math.abs(area) / 2;
    }

    containsPoint(point) {
        if (this.vertices.length < 3) return false;
        
        let inside = false;
        const n = this.vertices.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            if (((this.vertices[i].y > point.y) !== (this.vertices[j].y > point.y)) &&
                (point.x < (this.vertices[j].x - this.vertices[i].x) * (point.y - this.vertices[i].y) / 
                 (this.vertices[j].y - this.vertices[i].y) + this.vertices[i].x)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
}

/**
 * Voronoi cell representing a region
 */
class VoronoiCell {
    constructor(site, region = new Polygon()) {
        this.site = site;
        this.region = region;
    }

    get vertices() {
        return this.region.vertices;
    }

    containsPoint(point) {
        return this.region.containsPoint(point);
    }

    area() {
        return this.region.area();
    }
}

/**
 * Half-Space Intersection Voronoi Implementation - EXACT from tezcatli
 */
class VoronoiDiagram {
    constructor(sites, bounds) {
        this.sites = sites.map((site, index) => 
            site instanceof VoronoiPoint ? site : new VoronoiPoint(site.x, site.y, index)
        );
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
            this.cells = [new VoronoiCell(this.sites[0], boundingPolygon)];
            return;
        }
        
        // Compute Voronoi cell for each site using half-space intersection
        for (const site of this.sites) {
            const cell = this.computeCellForSite(site);
            if (!cell.region.isEmpty()) {
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
            if (currentRegion.isEmpty()) {
                break;
            }
        }
        
        return new VoronoiCell(site, currentRegion);
    }

    createBoundingPolygon() {
        return new Polygon([
            { x: this.bounds.left, y: this.bounds.top },
            { x: this.bounds.right, y: this.bounds.top },
            { x: this.bounds.right, y: this.bounds.bottom },
            { x: this.bounds.left, y: this.bounds.bottom }
        ]);
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
        if (polygon.isEmpty()) return polygon;
        
        // Sutherland-Hodgman polygon clipping algorithm
        const vertices = polygon.vertices;
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
        
        return new Polygon(newVertices);
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

    // Public API methods
    getCellContainingPoint(point) {
        for (const cell of this.cells) {
            if (cell.containsPoint(point)) {
                return cell;
            }
        }
        return null;
    }

    getNearestSite(point) {
        if (this.sites.length === 0) return null;
        
        let nearest = this.sites[0];
        let minDistance = nearest.distanceTo(point);
        
        for (let i = 1; i < this.sites.length; i++) {
            const distance = this.sites[i].distanceTo(point);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = this.sites[i];
            }
        }
        
        return nearest;
    }

    addSite(x, y) {
        const newSite = new VoronoiPoint(x, y, this.sites.length);
        this.sites.push(newSite);
        this.compute();
        return newSite;
    }

    removeSite(site) {
        const index = this.sites.findIndex(s => s.id === site.id);
        if (index !== -1) {
            this.sites.splice(index, 1);
            this.compute();
            return true;
        }
        return false;
    }

    // Get edges for visualization (boundaries between cells)
    getEdges() {
        const edges = [];
        
        for (const cell of this.cells) {
            const vertices = cell.vertices;
            for (let i = 0; i < vertices.length; i++) {
                const start = vertices[i];
                const end = vertices[(i + 1) % vertices.length];
                edges.push({ start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } });
            }
        }
        
        return edges;
    }
}

// Public API functions
function createVoronoiDiagram(sites, bounds) {
    return new VoronoiDiagram(sites, bounds);
}

function createVoronoiPoint(x, y, id) {
    return new VoronoiPoint(x, y, id);
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VoronoiPoint,
        Polygon,
        VoronoiCell,
        VoronoiDiagram,
        createVoronoiDiagram,
        createVoronoiPoint
    };
}