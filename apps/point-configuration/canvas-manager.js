// canvas-manager.js

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // State
        this.points = []; // Array of {x, y} - multiple points can have same x,y
        this.lines = [];
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
        
        // Settings
        this.gridSize = 30;
        this.pointRadius = 6;
        this.snapThreshold = 15;
        this.clickThreshold = 5; // pixels of movement to distinguish click from drag
        
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
        
        // Check if clicking on a point
        const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
        
        if (pointsAtPosition.length > 0) {
            // Clicking on point(s) - will determine drag behavior on mousemove
            if (pointsAtPosition.length === 1) {
                // Single point - prepare to drag it
                this.draggingPointIndex = pointsAtPosition[0];
            } else {
                // Multi-point - prepare to release highest index
                this.draggingPointIndex = Math.max(...pointsAtPosition);
            }
            this.canvas.style.cursor = 'grabbing';
        } else {
            // Clicking on empty space - prepare to pan grid
            this.isDraggingGrid = true;
            this.dragStartOffsetX = this.offsetX - screenX;
            this.dragStartOffsetY = this.offsetY - screenY;
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    handleMouseMove(e) {
        if (!this.isInteracting) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = screenX - this.offsetX;
        const worldY = screenY - this.offsetY;
        
        // Check if moved beyond threshold
        const dx = screenX - this.mouseDownX;
        const dy = screenY - this.mouseDownY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.clickThreshold) {
            this.hasMoved = true;
        }
        
        if (this.hasMoved) {
            if (this.draggingPointIndex !== null) {
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
        
        if (!this.hasMoved) {
            // This was a click, not a drag
            const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
            
            if (pointsAtPosition.length === 0) {
                // Clicked empty space - create new point
                this.addPoint(worldX, worldY);
            }
            // If clicked on point without dragging, do nothing
        } else {
            // This was a drag
            if (this.draggingPointIndex !== null) {
                // Check if we should snap to another point
                const targetPoints = this.getPointsAtPosition(worldX, worldY, this.snapThreshold);
                const otherPoints = targetPoints.filter(idx => idx !== this.draggingPointIndex);
                
                if (otherPoints.length > 0) {
                    // Snap to the first other point found
                    const snapTarget = this.points[otherPoints[0]];
                    this.points[this.draggingPointIndex].x = snapTarget.x;
                    this.points[this.draggingPointIndex].y = snapTarget.y;
                }
                
                this.draw();
            }
        }
        
        // Reset state
        this.isInteracting = false;
        this.isDraggingGrid = false;
        this.draggingPointIndex = null;
        this.hasMoved = false;
        this.canvas.style.cursor = 'crosshair';
    }
    
    handleMouseLeave(e) {
        // Treat as mouseup
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
        
        // Draw points
        this.drawPoints();
        
        // Draw lines (placeholder for later)
        this.drawLines();
        
        // Restore context state
        this.ctx.restore();
    }
    
    drawGridDots() {
        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border').trim();
        
        this.ctx.fillStyle = borderColor;
        
        // Calculate visible grid range considering pan offset
        const startX = Math.floor(-this.offsetX / this.gridSize) * this.gridSize;
        const endX = Math.ceil((this.canvas.width - this.offsetX) / this.gridSize) * this.gridSize;
        const startY = Math.floor(-this.offsetY / this.gridSize) * this.gridSize;
        const endY = Math.ceil((this.canvas.height - this.offsetY) / this.gridSize) * this.gridSize;
        
        // Draw grid dots
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
            
            // Draw point circle (slightly larger if merged)
            const radius = isMerged ? this.pointRadius + 2 : this.pointRadius;
            this.ctx.fillStyle = isMerged ? '#45b7d1' : '#4ecdc4';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw outer ring for merged points
            if (isMerged) {
                this.ctx.strokeStyle = '#45b7d1';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            // Draw label(s)
            const label = indices.join(',');
            this.ctx.fillStyle = fgColor;
            this.ctx.font = isMerged ? 'bold 14px ui-sans-serif, system-ui, sans-serif' : '14px ui-sans-serif, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(label, x, y - (radius + 6));
        });
    }
    
    drawLines() {
        // Lines drawing will be implemented later
    }
}