// renderer.js
// Rendering logic for canvas elements

import { getLineEndpoints } from './geometry-utils.js';

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
     * Draws grid dots
     * @param {number} offsetX - Pan offset X
     * @param {number} offsetY - Pan offset Y
     */
    drawGridDots(offsetX, offsetY) {
        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border').trim();

        this.ctx.fillStyle = borderColor;

        const startX = Math.floor(-offsetX / this.gridSize) * this.gridSize;
        const endX = Math.ceil((this.canvas.width - offsetX) / this.gridSize) * this.gridSize;
        const startY = Math.floor(-offsetY / this.gridSize) * this.gridSize;
        const endY = Math.ceil((this.canvas.height - offsetY) / this.gridSize) * this.gridSize;

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
     */
    drawPoints(points, highlightedPoints = new Set()) {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        // Group points by position
        const positionMap = new Map();

        points.forEach((point, index) => {
            const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
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

            const label = indices.join(',');
            this.ctx.fillStyle = fgColor;
            this.ctx.font = isMerged ? 'bold 14px ui-sans-serif, system-ui, sans-serif' : '14px ui-sans-serif, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(label, x, y - (radius + (isHighlighted ? 8 : 6)));
        });
    }

    /**
     * Draws all lines
     * @param {Array} lines - Array of line objects
     * @param {number} offsetX - Pan offset X
     * @param {number} offsetY - Pan offset Y
     * @param {Object|null} snapPreview - Current snap preview
     * @param {Array} intersections - Array of intersection objects
     */
    drawLines(lines, offsetX, offsetY, snapPreview = null, intersections = []) {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        lines.forEach((line, index) => {
            // Check if this line should be highlighted
            let shouldHighlight = false;

            if (snapPreview) {
                if (snapPreview.type === 'line' && snapPreview.lineIndex === index) {
                    // Snapping to this specific line
                    shouldHighlight = true;
                } else if (snapPreview.type === 'intersection') {
                    // Snapping to an intersection - highlight all contributing lines
                    const intersection = intersections[snapPreview.intersectionIndex];
                    if (intersection.lineIndices.includes(index)) {
                        shouldHighlight = true;
                    }
                }
            }

            this.ctx.strokeStyle = shouldHighlight ? '#f9a826' : '#957fef';
            this.ctx.lineWidth = shouldHighlight ? 2.1 : 1.4;

            // Calculate line endpoints that extend to canvas boundaries
            const bounds = this.getCanvasBounds(offsetX, offsetY);
            const endpoints = getLineEndpoints(line.x, line.y, line.angle, bounds);

            if (!endpoints) return;

            this.ctx.beginPath();
            this.ctx.moveTo(endpoints.x1, endpoints.y1);
            this.ctx.lineTo(endpoints.x2, endpoints.y2);
            this.ctx.stroke();
        });
    }

    /**
     * Draws a preview line while drawing
     * @param {number} startX - Line start X
     * @param {number} startY - Line start Y
     * @param {number} currentX - Current mouse X
     * @param {number} currentY - Current mouse Y
     * @param {number} offsetX - Pan offset X
     * @param {number} offsetY - Pan offset Y
     */
    drawPreviewLine(startX, startY, currentX, currentY, offsetX, offsetY) {
        // Calculate angle from start to current position
        const dx = currentX - startX;
        const dy = currentY - startY;
        const angle = Math.atan2(dy, dx);

        const bounds = this.getCanvasBounds(offsetX, offsetY);
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
     * Gets canvas bounds in world coordinates
     * @param {number} offsetX - Pan offset X
     * @param {number} offsetY - Pan offset Y
     * @returns {Object} Bounds object {left, right, top, bottom}
     */
    getCanvasBounds(offsetX, offsetY) {
        const left = -offsetX;
        const right = this.canvas.width - offsetX;
        const top = -offsetY;
        const bottom = this.canvas.height - offsetY;

        // Add margin for safety
        const margin = 1000;
        return {
            left: left - margin,
            right: right + margin,
            top: top - margin,
            bottom: bottom + margin
        };
    }
}
