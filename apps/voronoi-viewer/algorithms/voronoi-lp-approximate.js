// APPROXIMATE Voronoi implementation for L_p metric (any p >= 1)
// Uses direct sampling + Martinez polygon union
// Requires martinez to be loaded via script tag in HTML

/**
 * Approximate L_p Voronoi Diagram using direct sampling + Martinez union
 */
class VoronoiDiagramLp {
    constructor(sites, bounds, p = 2, resolution = 200) {
        this.sites = sites;
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

        if (this.sites.length === 1) {
            this.cells = [{ site: this.sites[0], region: this.createBoundingPolygon(this.bounds) }];
            return;
        }

        // Direct sampling approach
        const width = this.resolution;
        const height = this.resolution;
        const dx = (this.bounds.right - this.bounds.left) / width;
        const dy = (this.bounds.bottom - this.bounds.top) / height;

        // Assign each grid cell to nearest site
        const ownership = Array.from({ length: height }, () => Array(width).fill(null));

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const x = this.bounds.left + j * dx + dx / 2;
                const y = this.bounds.top + i * dy + dy / 2;
                const point = { x, y };

                let nearest = null;
                let minDist = Infinity;
                for (const site of this.sites) {
                    const d = this.lpDistance(point, site, this.p);
                    if (d < minDist) {
                        minDist = d;
                        nearest = site;
                    }
                }
                ownership[i][j] = nearest ? nearest.id : null;
            }
        }

        // Collect grid cells for each site
        const siteToPolys = new Map();
        for (const site of this.sites) {
            siteToPolys.set(site.id, []);
        }

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const siteId = ownership[i][j];
                if (!siteId) continue;

                const cellPoly = [
                    { x: this.bounds.left + j * dx, y: this.bounds.top + i * dy },
                    { x: this.bounds.left + (j + 1) * dx, y: this.bounds.top + i * dy },
                    { x: this.bounds.left + (j + 1) * dx, y: this.bounds.top + (i + 1) * dy },
                    { x: this.bounds.left + j * dx, y: this.bounds.top + (i + 1) * dy },
                ];
                siteToPolys.get(siteId).push(cellPoly);
            }
        }

        // Merge polygons for each site using Martinez
        this.cells = [];
        for (const site of this.sites) {
            const polys = siteToPolys.get(site.id);
            if (polys && polys.length > 0) {
                const merged = this.mergePolygons(polys);
                if (merged && merged.length >= 3) {
                    this.cells.push({ site, region: merged });
                }
            }
        }
    }

    mergePolygons(polys) {
        if (typeof martinez === 'undefined') {
            console.error('Martinez not loaded - cannot merge polygons');
            return polys[0] || [];
        }

        if (polys.length === 0) return [];
        if (polys.length === 1) return polys[0];

        // Convert to martinez format: [[[x, y], [x, y], ...]]
        const martinezPolys = polys.map(poly => [poly.map(v => [v.x, v.y])]);

        // Union all polygons together
        let merged = martinezPolys[0];
        for (let i = 1; i < martinezPolys.length; i++) {
            try {
                merged = martinez.union(merged, martinezPolys[i]);
            } catch (e) {
                console.warn('Martinez union failed:', e);
                continue;
            }
        }

        if (!merged || merged.length === 0 || !merged[0] || merged[0].length === 0) {
            return polys[0] || [];
        }

        // Convert back to our format
        const outer = merged[0][0];
        return outer.map(([x, y]) => ({ x, y }));
    }

    createBoundingPolygon(bounds) {
        return [
            { x: bounds.left, y: bounds.top },
            { x: bounds.right, y: bounds.top },
            { x: bounds.right, y: bounds.bottom },
            { x: bounds.left, y: bounds.bottom }
        ];
    }

    lpDistance(p1, p2, p) {
        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);
        if (p === 1) return dx + dy;
        if (p === Infinity) return Math.max(dx, dy);
        return Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VoronoiDiagramLp };
}
