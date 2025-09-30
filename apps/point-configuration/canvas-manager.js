// canvas-manager.js

import { computeAllIntersections } from './geometry-utils.js';
import { SnapManager } from './snap-manager.js';
import { Renderer } from './renderer.js';
import { PointLineMatroid } from './matroid.js';

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // State
        this.points = []; // Array of {x, y, onLines: [], isIntersection: boolean}
        this.lines = []; // Array of {x, y, angle} - infinite lines through point with angle
        this.intersections = []; // Array of {x, y, lineIndices: [i, j]}
        this.mode = 'point';

        // Pan state
        this.offsetX = 0;
        this.offsetY = 0;

        // Interaction state
        this.mouseDownX = 0;
        this.mouseDownY = 0;
        this.mouseDownTime = 0;
        this.hasMoved = false;
        this.isInteracting = false;

        // Dragging state
        this.draggingPointIndex = null;
        this.isDraggingGrid = false;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0;

        // Line drawing state
        this.isDrawingLine = false;
        this.lineStartX = 0;
        this.lineStartY = 0;
        this.lineCurrentX = 0;
        this.lineCurrentY = 0;

        // Settings
        this.pointRadius = 9;
        this.snapThreshold = 15;
        this.clickThreshold = 5;

        // Initialize modules
        this.snapManager = new SnapManager(15, 20); // intersectionSnapThreshold, lineSnapThreshold
        this.renderer = new Renderer(canvas, this.ctx);

        // Callback for state changes
        this.onStateChange = null;

        // Highlighting state
        this.highlightedPoints = new Set();

        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
        this.draw();
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.draw();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;
        
        this.mouseDownX = screenX;
        this.mouseDownY = screenY;
        this.mouseDownTime = Date.now();
        this.hasMoved = false;
        this.isInteracting = true;
        
        if (this.mode === 'line') {
            // Start drawing line
            this.isDrawingLine = true;
            this.lineStartX = worldX;
            this.lineStartY = worldY;
            this.lineCurrentX = worldX;
            this.lineCurrentY = worldY;
            this.canvas.style.cursor = 'crosshair';
        } else {
            // Point mode logic
            const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
            
            if (pointsAtPosition.length > 0) {
                if (pointsAtPosition.length === 1) {
                    this.draggingPointIndex = pointsAtPosition[0];
                } else {
                    this.draggingPointIndex = Math.max(...pointsAtPosition);
                }
                this.canvas.style.cursor = 'grabbing';
            } else {
                this.isDraggingGrid = true;
                this.dragStartOffsetX = this.offsetX - screenX;
                this.dragStartOffsetY = this.offsetY - screenY;
                this.canvas.style.cursor = 'grabbing';
            }
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;
        
        // Always update snap preview in point mode when not dragging
        if (this.mode === 'point' && !this.isInteracting) {
            const oldSnap = this.snapManager.getSnapPreview();
            const newSnap = this.snapManager.updateSnapPreview(worldX, worldY, this.intersections, this.lines);

            // Only redraw if snap changed
            if (JSON.stringify(oldSnap) !== JSON.stringify(newSnap)) {
                this.draw();
            }
        }

        // Update snap preview while dragging a point
        if (this.isInteracting && this.draggingPointIndex !== null) {
            const oldSnap = this.snapManager.getSnapPreview();
            const newSnap = this.snapManager.updateDragSnapPreview(
                worldX, worldY, this.intersections, this.lines
            );

            // Only redraw if snap changed
            if (JSON.stringify(oldSnap) !== JSON.stringify(newSnap)) {
                this.draw();
            }
        }
        
        if (!this.isInteracting) return;
        
        const dx = screenX - this.mouseDownX;
        const dy = screenY - this.mouseDownY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.clickThreshold) {
            this.hasMoved = true;
        }
        
        if (this.hasMoved) {
            if (this.mode === 'line' && this.isDrawingLine) {
                // Update line end position
                this.lineCurrentX = worldX;
                this.lineCurrentY = worldY;
                this.draw();
            } else if (this.draggingPointIndex !== null) {
                // Dragging a point - always use snap preview if available, otherwise free movement
                const point = this.points[this.draggingPointIndex];
                const snapPreview = this.snapManager.getSnapPreview();

                if (snapPreview) {
                    point.x = snapPreview.x;
                    point.y = snapPreview.y;
                } else {
                    point.x = worldX;
                    point.y = worldY;
                }

                this.draw();
            } else if (this.isDraggingGrid) {
                // Panning the grid
                this.offsetX = screenX + this.dragStartOffsetX;
                this.offsetY = screenY + this.dragStartOffsetY;
                this.snapManager.clearSnapPreview(); // Clear snap preview during pan
                this.draw();
            }
        }
    }
    
    handleMouseUp(e) {
        if (!this.isInteracting) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;
        
        if (this.mode === 'line' && this.isDrawingLine) {
            if (this.hasMoved) {
                // Add the line
                this.addLine(this.lineStartX, this.lineStartY, worldX, worldY);
            }
            this.isDrawingLine = false;
            this.draw(); // Clear the preview line immediately
        } else if (!this.hasMoved && this.mode === 'point') {
            // Click in point mode - use snap preview if available
            const snapPreview = this.snapManager.getSnapPreview();
            if (snapPreview) {
                this.addPointWithSnap(snapPreview);
            } else {
                // No snap, add point at mouse position
                const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
                if (pointsAtPosition.length === 0) {
                    this.addPoint(worldX, worldY, [], false);
                }
            }
        } else if (this.hasMoved && this.draggingPointIndex !== null) {
            // Finished dragging point
            const point = this.points[this.draggingPointIndex];
            const snapPreview = this.snapManager.getSnapPreview();

            // Apply snap if available
            if (snapPreview) {
                if (snapPreview.type === 'intersection') {
                    const intersection = this.intersections[snapPreview.intersectionIndex];
                    point.x = intersection.x;
                    point.y = intersection.y;
                    point.onLines = [...new Set([...point.onLines, ...intersection.lineIndices])];
                    point.isIntersection = true;
                } else if (snapPreview.type === 'line') {
                    point.x = snapPreview.x;
                    point.y = snapPreview.y;
                    if (!point.onLines.includes(snapPreview.lineIndex)) {
                        point.onLines.push(snapPreview.lineIndex);
                    }
                    point.isIntersection = point.onLines.length > 1;
                }
            } else {
                // Check for snap to other points
                const targetPoints = this.getPointsAtPosition(point.x, point.y, this.snapThreshold);
                const otherPoints = targetPoints.filter(idx => idx !== this.draggingPointIndex);
                
                if (otherPoints.length > 0) {
                    const snapTarget = this.points[otherPoints[0]];
                    point.x = snapTarget.x;
                    point.y = snapTarget.y;
                    // Merge line memberships
                    point.onLines = [...new Set([...point.onLines, ...snapTarget.onLines])];
                    point.isIntersection = point.onLines.length > 1;
                }
            }
            
            this.draw();
        }
        
        // Reset state
        this.isInteracting = false;
        this.isDraggingGrid = false;
        this.draggingPointIndex = null;
        this.hasMoved = false;
        this.snapManager.clearSnapPreview(); // Clear snap preview after interaction
        this.canvas.style.cursor = 'crosshair';

        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    handleMouseLeave(e) {
        if (this.isInteracting) {
            this.handleMouseUp(e);
        }
    }
    
    getPointsAtPosition(worldX, worldY, threshold = null) {
        const checkThreshold = threshold || this.pointRadius + 5;
        const indices = [];
        
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= checkThreshold) {
                indices.push(i);
            }
        }
        
        return indices;
    }
    
    addPoint(x, y, onLines = [], isIntersection = false) {
        this.points.push({ x, y, onLines, isIntersection });
        this.draw();
        console.log('Added point:', this.points.length - 1, 'at', x, y, 'onLines:', onLines);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    addPointWithSnap(snapPreview) {
        if (snapPreview.type === 'intersection') {
            const intersection = this.intersections[snapPreview.intersectionIndex];
            this.addPoint(
                intersection.x,
                intersection.y,
                [...intersection.lineIndices],
                true
            );
        } else if (snapPreview.type === 'line') {
            this.addPoint(
                snapPreview.x,
                snapPreview.y,
                [snapPreview.lineIndex],
                false
            );
        }
    }
    
    addLine(startX, startY, endX, endY) {
        // Store line as angle and point (infinite line representation)
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);

        this.lines.push({ x: startX, y: startY, angle });

        // Recompute all intersections
        this.computeIntersections();

        this.draw();
        console.log('Added line:', this.lines.length - 1, 'angle:', angle);
        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        this.snapManager.clearSnapPreview();
        this.canvas.style.cursor = 'crosshair';
    }
    
    draw() {
        // Clear canvas
        this.renderer.clear();

        // Save context state
        this.ctx.save();

        // Apply pan transformation
        this.ctx.translate(this.offsetX, this.offsetY);

        // Draw grid dots
        this.renderer.drawGridDots(this.offsetX, this.offsetY);

        // Draw lines (permanent ones) - with highlighting if applicable
        const snapPreview = this.snapManager.getSnapPreview();
        this.renderer.drawLines(this.lines, this.offsetX, this.offsetY, snapPreview, this.intersections);

        // Draw preview line if currently drawing
        if (this.isDrawingLine && this.hasMoved) {
            this.renderer.drawPreviewLine(
                this.lineStartX, this.lineStartY,
                this.lineCurrentX, this.lineCurrentY,
                this.offsetX, this.offsetY
            );
        }

        // Draw snap preview (works for both placement and dragging)
        if (snapPreview && this.mode === 'point') {
            this.renderer.drawSnapPreview(snapPreview);
        }

        // Draw points (pass highlightedPoints)
        this.renderer.drawPoints(this.points, this.highlightedPoints);

        // Restore context state
        this.ctx.restore();
    }
    
    computeIntersections() {
        this.intersections = computeAllIntersections(this.lines);
        console.log('Computed', this.intersections.length, 'intersections');
    }

    getMatroidStats() {
        if (this.points.length === 0) {
            return null;
        }

        const matroid = new PointLineMatroid(this.points, this.lines);

        return {
            rank: matroid.rank,
            numPoints: this.points.length,
            numLines: this.lines.length,
            bases: matroid.getAllBases(),
            circuits: matroid.getAllCircuits(),
            flats: matroid.getAllFlats()
        };
    }

    setHighlightedPoints(pointIndices) {
        this.highlightedPoints = new Set(pointIndices);
        this.draw();
    }

    clearHighlightedPoints() {
        this.highlightedPoints.clear();
        this.draw();
    }
}