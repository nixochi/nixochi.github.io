// canvas-manager.js

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // State
        this.points = []; // Array of {x, y}
        this.lines = []; // Array of {x, y, angle} - infinite lines through point with angle
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
        this.gridSize = 30;
        this.pointRadius = 9;
        this.snapThreshold = 15;
        this.clickThreshold = 5;
        
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
        if (!this.isInteracting) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;
        
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
                // Dragging a point
                this.points[this.draggingPointIndex].x = worldX;
                this.points[this.draggingPointIndex].y = worldY;
                this.draw();
            } else if (this.isDraggingGrid) {
                // Panning the grid
                this.offsetX = screenX + this.dragStartOffsetX;
                this.offsetY = screenY + this.dragStartOffsetY;
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
        } else if (!this.hasMoved && this.mode === 'point') {
            // Click in point mode
            const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
            
            if (pointsAtPosition.length === 0) {
                this.addPoint(worldX, worldY);
            }
        } else if (this.hasMoved && this.draggingPointIndex !== null) {
            // Finished dragging point - check for snap
            const targetPoints = this.getPointsAtPosition(worldX, worldY, this.snapThreshold);
            const otherPoints = targetPoints.filter(idx => idx !== this.draggingPointIndex);
            
            if (otherPoints.length > 0) {
                const snapTarget = this.points[otherPoints[0]];
                this.points[this.draggingPointIndex].x = snapTarget.x;
                this.points[this.draggingPointIndex].y = snapTarget.y;
            }
            
            this.draw();
        }
        
        // Reset state
        this.isInteracting = false;
        this.isDraggingGrid = false;
        this.draggingPointIndex = null;
        this.hasMoved = false;
        this.canvas.style.cursor = 'crosshair';
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
    
    addPoint(x, y) {
        this.points.push({ x, y });
        this.draw();
        console.log('Added point:', this.points.length - 1, 'at', x, y);
    }
    
    addLine(startX, startY, endX, endY) {
        // Store line as angle and point (infinite line representation)
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);
        
        this.lines.push({ x: startX, y: startY, angle });
        this.draw();
        console.log('Added line:', this.lines.length - 1, 'angle:', angle);
    }
    
    setMode(mode) {
        this.mode = mode;
        this.canvas.style.cursor = 'crosshair';
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context state
        this.ctx.save();
        
        // Apply pan transformation
        this.ctx.translate(this.offsetX, this.offsetY);
        
        // Draw grid dots
        this.drawGridDots();
        
        // Draw lines (permanent ones)
        this.drawLines();
        
        // Draw preview line if currently drawing
        if (this.isDrawingLine && this.hasMoved) {
            this.drawPreviewLine();
        }
        
        // Draw points
        this.drawPoints();
        
        // Restore context state
        this.ctx.restore();
    }
    
    drawGridDots() {
        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border').trim();
        
        this.ctx.fillStyle = borderColor;
        
        const startX = Math.floor(-this.offsetX / this.gridSize) * this.gridSize;
        const endX = Math.ceil((this.canvas.width - this.offsetX) / this.gridSize) * this.gridSize;
        const startY = Math.floor(-this.offsetY / this.gridSize) * this.gridSize;
        const endY = Math.ceil((this.canvas.height - this.offsetY) / this.gridSize) * this.gridSize;
        
        for (let x = startX; x <= endX; x += this.gridSize) {
            for (let y = startY; y <= endY; y += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
    
    drawPoints() {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();
        
        // Group points by position
        const positionMap = new Map();
        
        this.points.forEach((point, index) => {
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
            
            const radius = isMerged ? this.pointRadius + 2 : this.pointRadius;
            this.ctx.fillStyle = isMerged ? '#45b7d1' : '#4ecdc4';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            if (isMerged) {
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
            this.ctx.fillText(label, x, y - (radius + 6));
        });
    }
    
    drawLines() {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();
        
        this.ctx.strokeStyle = fgColor;
        this.ctx.lineWidth = 2;
        
        this.lines.forEach((line, index) => {
            // Calculate line endpoints that extend to canvas boundaries
            const { x, y, angle } = line;
            const endpoints = this.getLineEndpoints(x, y, angle);
            
            if (!endpoints) return;
            
            this.ctx.beginPath();
            this.ctx.moveTo(endpoints.x1, endpoints.y1);
            this.ctx.lineTo(endpoints.x2, endpoints.y2);
            this.ctx.stroke();
        });
    }
    
    drawPreviewLine() {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-secondary').trim();
        
        // Calculate angle from start to current position
        const dx = this.lineCurrentX - this.lineStartX;
        const dy = this.lineCurrentY - this.lineStartY;
        const angle = Math.atan2(dy, dx);
        
        const endpoints = this.getLineEndpoints(this.lineStartX, this.lineStartY, angle);
        
        if (!endpoints) return;
        
        this.ctx.strokeStyle = fgColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(endpoints.x1, endpoints.y1);
        this.ctx.lineTo(endpoints.x2, endpoints.y2);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    getLineEndpoints(x, y, angle) {
        // Calculate infinite line endpoints that clip to visible canvas bounds
        // We need to find where the line intersects the canvas boundaries
        
        // Get canvas bounds in world coordinates
        const left = -this.offsetX;
        const right = this.canvas.width - this.offsetX;
        const top = -this.offsetY;
        const bottom = this.canvas.height - this.offsetY;
        
        // Add margin for safety
        const margin = 1000;
        const bounds = {
            left: left - margin,
            right: right + margin,
            top: top - margin,
            bottom: bottom + margin
        };
        
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
}