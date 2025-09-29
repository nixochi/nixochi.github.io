/**
 * Voronoi Diagram Utilities
 * Simplified implementation for web component
 */

// Point structure
export function createVoronoiPoint(x, y, id) {
    return { x, y, id };
}

// Simple Voronoi cell structure
export function createVoronoiCell(site, vertices = []) {
    return { site, vertices };
}

// Voronoi diagram structure
export function createVoronoiDiagram(sites, bounds) {
    const cells = computeVoronoiCells(sites, bounds);
    return { sites, cells, bounds };
}

/**
 * Compute Voronoi cells using a simple algorithm
 * This is a basic implementation - for production, you'd want a proper library
 */
function computeVoronoiCells(sites, bounds) {
    if (!sites || sites.length === 0) return [];
    
    const cells = [];
    const { left, right, top, bottom } = bounds;
    
    // For each site, compute its Voronoi cell
    for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        const cell = computeCellForSite(site, sites, bounds);
        cells.push(cell);
    }
    
    return cells;
}

/**
 * Compute the Voronoi cell for a specific site
 */
function computeCellForSite(site, allSites, bounds) {
    const { left, right, top, bottom } = bounds;
    
    // Start with the bounding box
    let vertices = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom }
    ];
    
    // Clip against each other site
    for (const otherSite of allSites) {
        if (otherSite.id === site.id) continue;
        
        // Create the perpendicular bisector
        const midX = (site.x + otherSite.x) / 2;
        const midY = (site.y + otherSite.y) / 2;
        
        // Direction vector from site to otherSite
        const dx = otherSite.x - site.x;
        const dy = otherSite.y - site.y;
        
        // Perpendicular vector (normal to the bisector)
        const nx = -dy;
        const ny = dx;
        
        // Clip the polygon against this half-plane
        vertices = clipPolygonByLine(vertices, midX, midY, nx, ny);
        
        if (vertices.length < 3) break; // No valid cell left
    }
    
    return createVoronoiCell(site, vertices);
}

/**
 * Clip a polygon by a line using Sutherland-Hodgman algorithm
 */
function clipPolygonByLine(vertices, px, py, nx, ny) {
    if (vertices.length === 0) return [];
    
    const clipped = [];
    
    for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        
        const currentInside = isPointInsideHalfPlane(current, px, py, nx, ny);
        const nextInside = isPointInsideHalfPlane(next, px, py, nx, ny);
        
        if (currentInside && nextInside) {
            // Both inside, add next point
            clipped.push(next);
        } else if (currentInside && !nextInside) {
            // Leaving, add intersection
            const intersection = lineIntersection(current, next, px, py, nx, ny);
            if (intersection) clipped.push(intersection);
        } else if (!currentInside && nextInside) {
            // Entering, add intersection and next point
            const intersection = lineIntersection(current, next, px, py, nx, ny);
            if (intersection) clipped.push(intersection);
            clipped.push(next);
        }
        // Both outside, add nothing
    }
    
    return clipped;
}

/**
 * Check if a point is inside a half-plane
 */
function isPointInsideHalfPlane(point, px, py, nx, ny) {
    // Dot product with normal vector
    const dot = (point.x - px) * nx + (point.y - py) * ny;
    return dot <= 0; // Inside if on the negative side of the normal
}

/**
 * Find intersection of line segment with half-plane boundary
 */
function lineIntersection(p1, p2, px, py, nx, ny) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    const denominator = nx * dx + ny * dy;
    if (Math.abs(denominator) < 1e-10) return null; // Parallel lines
    
    const t = (nx * (px - p1.x) + ny * (py - p1.y)) / denominator;
    
    if (t < 0 || t > 1) return null; // Intersection outside segment
    
    return {
        x: p1.x + t * dx,
        y: p1.y + t * dy
    };
}

/**
 * Generate Delaunay triangulation edges from Voronoi cells
 * This is a simplified approach - we find which cells share edges
 */
export function getDelaunayEdges(cells) {
    const edges = [];
    const edgeSet = new Set();
    
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            if (cellsShareEdge(cells[i], cells[j])) {
                const site1Id = cells[i].site.id;
                const site2Id = cells[j].site.id;
                const edgeKey = site1Id < site2Id ? `${site1Id}-${site2Id}` : `${site2Id}-${site1Id}`;
                
                if (!edgeSet.has(edgeKey)) {
                    edgeSet.add(edgeKey);
                    edges.push({
                        site1: cells[i].site,
                        site2: cells[j].site
                    });
                }
            }
        }
    }
    
    return edges;
}

/**
 * Check if two Voronoi cells share an edge
 */
function cellsShareEdge(cell1, cell2) {
    if (!cell1.vertices || !cell2.vertices) return false;
    if (cell1.vertices.length < 3 || cell2.vertices.length < 3) return false;
    
    let sharedVertices = 0;
    const tolerance = 1e-6;
    
    for (const v1 of cell1.vertices) {
        for (const v2 of cell2.vertices) {
            if (Math.abs(v1.x - v2.x) < tolerance && Math.abs(v1.y - v2.y) < tolerance) {
                sharedVertices++;
                if (sharedVertices >= 2) return true;
            }
        }
    }
    
    return false;
}

/**
 * Color palette for Voronoi cells
 */
export function getVoronoiColorPalette() {
    return [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
    ];
}

/**
 * Generate sample points for initialization
 */
export function generateSamplePoints(width, height) {
    return [
        createVoronoiPoint(width * 0.3, height * 0.3, 0),
        createVoronoiPoint(width * 0.7, height * 0.3, 1),
        createVoronoiPoint(width * 0.5, height * 0.7, 2),
        createVoronoiPoint(width * 0.2, height * 0.8, 3)
    ];
}

/**
 * Generate random points within bounds
 */
export function generateRandomPoints(width, height, count = 5, margin = 50) {
    const points = [];
    for (let i = 0; i < count; i++) {
        const x = margin + Math.random() * (width - 2 * margin);
        const y = margin + Math.random() * (height - 2 * margin);
        points.push(createVoronoiPoint(x, y, i));
    }
    return points;
}

/**
 * Generate grid pattern of points
 */
export function generateGridPoints(width, height, margin = 80) {
    const points = [];
    const cols = 4;
    const rows = 3;
    
    const cellWidth = (width - 2 * margin) / cols;
    const cellHeight = (height - 2 * margin) / rows;
    
    let id = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = margin + (col + 0.5) * cellWidth;
            const y = margin + (row + 0.5) * cellHeight;
            
            // Add some randomness
            const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
            const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;
            
            points.push(createVoronoiPoint(x + jitterX, y + jitterY, id++));
        }
    }
    
    return points;
}