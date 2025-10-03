// Voronoi implementation from tezcatli
// Supports both EXACT L_2 and APPROXIMATE L_p metrics

// Import algorithm implementations
// Note: In browser, these are loaded via script tags in the HTML

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

    lpDistance(other, p = 2) {
        const dx = Math.abs(this.x - other.x);
        const dy = Math.abs(this.y - other.y);
        if (p === 1) return dx + dy;
        if (p === Infinity) return Math.max(dx, dy);
        if (p === 2) return this.distanceTo(other);
        return Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p);
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
 * Voronoi Diagram - Unified API
 * Dispatches to appropriate algorithm based on metric parameter
 */
class VoronoiDiagram {
    constructor(sites, bounds, p = 2, resolution = 200) {
        this.sites = sites.map((site, index) =>
            site instanceof VoronoiPoint ? site : new VoronoiPoint(site.x, site.y, index)
        );
        this.bounds = bounds;
        this.p = p;
        this.resolution = resolution;
        this.cells = [];

        this.compute();
    }

    compute() {
        if (this.sites.length === 0) {
            this.cells = [];
            return;
        }

        // Choose algorithm based on metric
        if (this.p === 2 && typeof VoronoiDiagramL2 !== 'undefined') {
            // Use exact L_2 algorithm
            const l2Diagram = new VoronoiDiagramL2(this.sites, this.bounds);
            this.cells = l2Diagram.cells.map(cell => new VoronoiCell(cell.site, new Polygon(cell.region)));
        } else if (typeof VoronoiDiagramLp !== 'undefined') {
            // Use approximate L_p algorithm
            const lpDiagram = new VoronoiDiagramLp(this.sites, this.bounds, this.p, this.resolution);
            this.cells = lpDiagram.cells.map(cell => new VoronoiCell(cell.site, new Polygon(cell.region)));
        } else {
            console.error('No Voronoi algorithm implementation available');
            this.cells = [];
        }
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
        let minDistance = nearest.lpDistance(point, this.p);

        for (let i = 1; i < this.sites.length; i++) {
            const distance = this.sites[i].lpDistance(point, this.p);
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
function createVoronoiDiagram(sites, bounds, p = 2, resolution = 200) {
    return new VoronoiDiagram(sites, bounds, p, resolution);
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