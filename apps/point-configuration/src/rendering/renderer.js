// renderer.js
// Rendering logic for canvas elements

import { getLineEndpoints } from '../geometry/geometry-utils.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.gridSize = 30;
        this.pointRadius = 9;
    }

    /**
     * Clears the canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draws grid dots in world space
     * @param {Object} viewportBounds - Viewport bounds in world coordinates {left, right, top, bottom}
     * @param {number} scale - Current zoom scale
     */
    drawGridDots(viewportBounds, scale) {
        // Skip grid rendering when zoomed out too far (performance optimization)
        if (scale < 0.3) {
            return;
        }

        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border').trim();

        this.ctx.fillStyle = borderColor;

        const startX = Math.floor(viewportBounds.left / this.gridSize) * this.gridSize;
        const endX = Math.ceil(viewportBounds.right / this.gridSize) * this.gridSize;
        const startY = Math.floor(viewportBounds.top / this.gridSize) * this.gridSize;
        const endY = Math.ceil(viewportBounds.bottom / this.gridSize) * this.gridSize;

        // Cap the number of dots to prevent performance issues
        const maxDotsPerAxis = 200;
        const dotsX = (endX - startX) / this.gridSize;
        const dotsY = (endY - startY) / this.gridSize;

        if (dotsX > maxDotsPerAxis || dotsY > maxDotsPerAxis) {
            // Too many dots, skip rendering
            return;
        }

        for (let x = startX; x <= endX; x += this.gridSize) {
            for (let y = startY; y <= endY; y += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    /**
     * Draws all points
     * @param {Array} points - Array of point objects
     * @param {Set} highlightedPoints - Set of point indices to highlight
     * @param {number|undefined} skipPointIndex - Point index to skip (for ghost rendering)
     * @param {Function} getPosition - Function to get actual position of a point
     */
    drawPoints(points, highlightedPoints = new Set(), skipPointIndex = undefined, getPosition = null) {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        // Group points by position
        const positionMap = new Map();

        points.forEach((point, index) => {
            // Skip the dragged point (will be drawn as ghost)
            if (index === skipPointIndex) return;

            const pos = getPosition ? getPosition(point) : { x: point.x, y: point.y };
            const key = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
            if (!positionMap.has(key)) {
                positionMap.set(key, []);
            }
            positionMap.get(key).push(index);
        });

        // Draw each unique position
        positionMap.forEach((indices, key) => {
            const [x, y] = key.split(',').map(Number);
            const isMerged = indices.length > 1;
            const isHighlighted = indices.some(idx => highlightedPoints.has(idx));

            const radius = isMerged ? this.pointRadius + 2 : this.pointRadius;

            // Change color if highlighted
            this.ctx.fillStyle = isHighlighted ? '#f9a826' : (isMerged ? '#45b7d1' : '#4ecdc4');

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Add highlight ring
            if (isHighlighted) {
                this.ctx.strokeStyle = '#f9a826';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (isMerged) {
                this.ctx.strokeStyle = '#45b7d1';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Draw label with individual highlighting for merged points
            this.ctx.font = isMerged ? 'bold 14px ui-sans-serif, system-ui, sans-serif' : '14px ui-sans-serif, system-ui, sans-serif';
            this.ctx.textBaseline = 'bottom';

            if (isMerged) {
                // For merged points, draw each index separately with appropriate color
                const labelParts = [];
                indices.forEach((idx, i) => {
                    labelParts.push({
                        text: idx.toString(),
                        highlighted: highlightedPoints.has(idx)
                    });
                    if (i < indices.length - 1) {
                        labelParts.push({ text: ',', highlighted: false });
                    }
                });

                // Measure total width
                const totalText = indices.join(',');
                const totalWidth = this.ctx.measureText(totalText).width;

                // Draw each part with appropriate color
                let currentX = x - totalWidth / 2;
                labelParts.forEach(part => {
                    this.ctx.fillStyle = part.highlighted ? '#f9a826' : fgColor;
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(part.text, currentX, y - (radius + (isHighlighted ? 8 : 6)));
                    currentX += this.ctx.measureText(part.text).width;
                });
            } else {
                // Single point - simple label
                const label = indices[0].toString();
                this.ctx.fillStyle = isHighlighted ? '#f9a826' : fgColor;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(label, x, y - (radius + (isHighlighted ? 8 : 6)));
            }
        });
    }

    /**
     * Draws all lines in world space
     * @param {Array} lines - Array of line objects
     * @param {Object} viewportBounds - Viewport bounds in world coordinates
     * @param {Object|null} snapPreview - Current snap preview
     * @param {Array} intersections - Array of intersection objects
     * @param {Set} highlightedLines - Set of line indices to highlight
     */
    drawLines(lines, viewportBounds, snapPreview = null, intersections = [], highlightedLines = new Set()) {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        lines.forEach((line, index) => {
            // Check if this line should be highlighted (from derived visual state)
            const shouldHighlight = highlightedLines.has(index);

            this.ctx.strokeStyle = shouldHighlight ? '#f9a826' : '#957fef';
            this.ctx.lineWidth = shouldHighlight ? 2.1 : 1.4;

            // Calculate line endpoints that extend to viewport boundaries (in world space)
            const bounds = this.getWorldBounds(viewportBounds);
            const endpoints = getLineEndpoints(line.x, line.y, line.angle, bounds);

            if (!endpoints) return;

            this.ctx.beginPath();
            this.ctx.moveTo(endpoints.x1, endpoints.y1);
            this.ctx.lineTo(endpoints.x2, endpoints.y2);
            this.ctx.stroke();
        });
    }

    /**
     * Draws a preview line while drawing in world space
     * @param {number} startX - Line start X (world)
     * @param {number} startY - Line start Y (world)
     * @param {number} currentX - Current mouse X (world)
     * @param {number} currentY - Current mouse Y (world)
     * @param {Object} viewportBounds - Viewport bounds in world coordinates
     */
    drawPreviewLine(startX, startY, currentX, currentY, viewportBounds) {
        // Calculate angle from start to current position
        const dx = currentX - startX;
        const dy = currentY - startY;
        const angle = Math.atan2(dy, dx);

        const bounds = this.getWorldBounds(viewportBounds);
        const endpoints = getLineEndpoints(startX, startY, angle, bounds);

        if (!endpoints) return;

        this.ctx.strokeStyle = '#c9b3ff';
        this.ctx.lineWidth = 1.4;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(endpoints.x1, endpoints.y1);
        this.ctx.lineTo(endpoints.x2, endpoints.y2);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }

    /**
     * Draws a ghost point (dragged point preview)
     * @param {Object} ghostPoint - Ghost point object {x, y, pointIndex}
     */
    drawGhostPoint(ghostPoint) {
        const { x, y, pointIndex } = ghostPoint;
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        // Draw ghost with semi-transparent fill
        this.ctx.fillStyle = 'rgba(78, 205, 196, 0.6)';
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw label (only for existing points, not new ones)
        if (pointIndex >= 0) {
            this.ctx.fillStyle = fgColor;
            this.ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(pointIndex.toString(), x, y - (this.pointRadius + 6));
        }
    }

    /**
     * Draws snap preview indicator
     * @param {Object} snapPreview - Snap preview object
     */
    drawSnapPreview(snapPreview) {
        if (!snapPreview) return;

        const { x, y, type } = snapPreview;

        // Draw a preview circle/marker
        this.ctx.strokeStyle = '#45b7d1';
        this.ctx.fillStyle = 'rgba(69, 183, 209, 0.2)';
        this.ctx.lineWidth = 2;

        const radius = type === 'intersection' ? this.pointRadius + 4 : this.pointRadius + 2;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Add a small cross for intersection snaps
        if (type === 'intersection') {
            const crossSize = 6;
            this.ctx.strokeStyle = '#45b7d1';
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            this.ctx.moveTo(x - crossSize, y);
            this.ctx.lineTo(x + crossSize, y);
            this.ctx.moveTo(x, y - crossSize);
            this.ctx.lineTo(x, y + crossSize);
            this.ctx.stroke();
        }
    }

    /**
     * Draws a subtle intersection preview indicator (for non-snapped intersections)
     * @param {Object} intersection - Intersection object
     */
    drawIntersectionPreview(intersection) {
        if (!intersection) return;

        const { x, y, type } = intersection;

        // Draw a subtle preview circle/marker
        this.ctx.strokeStyle = 'rgba(69, 183, 209, 0.5)';
        this.ctx.fillStyle = 'rgba(69, 183, 209, 0.1)';
        this.ctx.lineWidth = 1.5;

        const radius = type === 'intersection' ? this.pointRadius + 2 : this.pointRadius;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Add a small cross for intersection types
        if (type === 'intersection') {
            const crossSize = 4;
            this.ctx.strokeStyle = 'rgba(69, 183, 209, 0.5)';
            this.ctx.lineWidth = 1.5;

            this.ctx.beginPath();
            this.ctx.moveTo(x - crossSize, y);
            this.ctx.lineTo(x + crossSize, y);
            this.ctx.moveTo(x, y - crossSize);
            this.ctx.lineTo(x, y + crossSize);
            this.ctx.stroke();
        }
    }

    /**
     * Gets world bounds with margin for line drawing
     * @param {Object} viewportBounds - Viewport bounds in world coordinates
     * @returns {Object} Bounds object {left, right, top, bottom} with margin
     */
    getWorldBounds(viewportBounds) {
        // Add margin for safety (lines should extend beyond viewport)
        const margin = 1000;
        return {
            left: viewportBounds.left - margin,
            right: viewportBounds.right + margin,
            top: viewportBounds.top - margin,
            bottom: viewportBounds.bottom + margin
        };
    }
}
