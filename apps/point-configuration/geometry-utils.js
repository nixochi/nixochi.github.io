// geometry-utils.js
// Utility functions for geometric calculations

/**
 * Computes the intersection point of two infinite lines
 * @param {Object} line1 - First line {x, y, angle}
 * @param {Object} line2 - Second line {x, y, angle}
 * @returns {Object|null} Intersection point {x, y} or null if parallel
 */
export function computeLineIntersection(line1, line2) {
    const { x: x1, y: y1, angle: a1 } = line1;
    const { x: x2, y: y2, angle: a2 } = line2;

    // Direction vectors
    const dx1 = Math.cos(a1);
    const dy1 = Math.sin(a1);
    const dx2 = Math.cos(a2);
    const dy2 = Math.sin(a2);

    // Check if lines are parallel (cross product near zero)
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) < 0.0001) {
        return null; // Parallel lines
    }

    // Solve for intersection using parametric form
    const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / cross;

    const intersectionX = x1 + t1 * dx1;
    const intersectionY = y1 + t1 * dy1;

    return { x: intersectionX, y: intersectionY };
}

/**
 * Projects a point onto an infinite line
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {Object} line - Line {x, y, angle}
 * @returns {Object} Projected point {x, y}
 */
export function projectPointOntoLine(px, py, line) {
    const { x, y, angle } = line;

    // Direction vector of the line
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Vector from line point to target point
    const vx = px - x;
    const vy = py - y;

    // Project onto line direction
    const t = vx * dx + vy * dy;

    // Projected point
    return {
        x: x + t * dx,
        y: y + t * dy
    };
}

/**
 * Calculates endpoints where a line intersects a bounding box
 * @param {number} x - Point on line
 * @param {number} y - Point on line
 * @param {number} angle - Line angle in radians
 * @param {Object} bounds - Bounding box {left, right, top, bottom}
 * @returns {Object|null} Endpoints {x1, y1, x2, y2} or null if no intersection
 */
export function getLineEndpoints(x, y, angle, bounds) {
    // Direction vector
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Find all intersections with the bounding box
    const intersections = [];

    // Left edge (x = bounds.left)
    if (Math.abs(dx) > 0.0001) {
        const t = (bounds.left - x) / dx;
        const py = y + t * dy;
        if (py >= bounds.top && py <= bounds.bottom) {
            intersections.push({ x: bounds.left, y: py, t });
        }
    }

    // Right edge (x = bounds.right)
    if (Math.abs(dx) > 0.0001) {
        const t = (bounds.right - x) / dx;
        const py = y + t * dy;
        if (py >= bounds.top && py <= bounds.bottom) {
            intersections.push({ x: bounds.right, y: py, t });
        }
    }

    // Top edge (y = bounds.top)
    if (Math.abs(dy) > 0.0001) {
        const t = (bounds.top - y) / dy;
        const px = x + t * dx;
        if (px >= bounds.left && px <= bounds.right) {
            intersections.push({ x: px, y: bounds.top, t });
        }
    }

    // Bottom edge (y = bounds.bottom)
    if (Math.abs(dy) > 0.0001) {
        const t = (bounds.bottom - y) / dy;
        const px = x + t * dx;
        if (px >= bounds.left && px <= bounds.right) {
            intersections.push({ x: px, y: bounds.bottom, t });
        }
    }

    // We need exactly 2 intersections (entry and exit points)
    if (intersections.length < 2) return null;

    // Sort by parameter t to get the two most extreme points
    intersections.sort((a, b) => a.t - b.t);

    return {
        x1: intersections[0].x,
        y1: intersections[0].y,
        x2: intersections[intersections.length - 1].x,
        y2: intersections[intersections.length - 1].y
    };
}

/**
 * Computes all pairwise intersections of lines
 * @param {Array} lines - Array of line objects {x, y, angle}
 * @returns {Array} Array of intersection objects {x, y, lineIndices: [i, j]}
 */
export function computeAllIntersections(lines) {
    const intersections = [];

    for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
            const intersection = computeLineIntersection(lines[i], lines[j]);
            if (intersection) {
                intersections.push({
                    x: intersection.x,
                    y: intersection.y,
                    lineIndices: [i, j]
                });
            }
        }
    }

    return intersections;
}
