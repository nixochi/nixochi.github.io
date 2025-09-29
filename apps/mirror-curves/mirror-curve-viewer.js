/**
 * Mirror Curve Viewer Web Component - EXACT PORT from tezcatli
 * Complete standalone implementation with all math and algorithms
 */

// ============================================================================
// GRID CLASS - EXACT from tezcatli
// ============================================================================
class Grid {
    static NW = 0;
    static NE = 1;
    static SW = 2;
    static SE = 3;

    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.gridLines = new Map();
        this.usedDirections = new Map();
        
        this.initializeGridLines();
        this.computeConnections();
        this.placeBoundaryMirrors();
        this.initializeUsedDirections();
    }

    initializeGridLines() {
        // Create horizontal grid lines
        for (let row = 0; row <= this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const id = this.generateGridLineId('h', row, col);
                this.gridLines.set(id, {
                    id: id,
                    type: 'horizontal',
                    row: row,
                    col: col,
                    isMirror: false,
                    connections: { 
                        [Grid.NW]: null, 
                        [Grid.NE]: null, 
                        [Grid.SW]: null, 
                        [Grid.SE]: null 
                    }
                });
            }
        }
        
        // Create vertical grid lines
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col <= this.cols; col++) {
                const id = this.generateGridLineId('v', row, col);
                this.gridLines.set(id, {
                    id: id,
                    type: 'vertical',
                    row: row,
                    col: col,
                    isMirror: false,
                    connections: { 
                        [Grid.NW]: null, 
                        [Grid.NE]: null, 
                        [Grid.SW]: null, 
                        [Grid.SE]: null 
                    }
                });
            }
        }
    }

    placeBoundaryMirrors() {
        // Top boundary
        for (let col = 0; col < this.cols; col++) {
            const id = this.generateGridLineId('h', 0, col);
            this.setMirror(id, true);
        }
        
        // Bottom boundary
        for (let col = 0; col < this.cols; col++) {
            const id = this.generateGridLineId('h', this.rows, col);
            this.setMirror(id, true);
        }
        
        // Left boundary
        for (let row = 0; row < this.rows; row++) {
            const id = this.generateGridLineId('v', row, 0);
            this.setMirror(id, true);
        }
        
        // Right boundary
        for (let row = 0; row < this.rows; row++) {
            const id = this.generateGridLineId('v', row, this.cols);
            this.setMirror(id, true);
        }
    }

    computeConnections() {
        for (const gridLine of this.gridLines.values()) {
            const { type, row, col } = gridLine;
            
            if (type === 'horizontal') {
                if (col >= 0 && row > 0) {
                    gridLine.connections[Grid.NW] = this.generateGridLineId('v', row - 1, col);
                }
                if (row > 0) {
                    gridLine.connections[Grid.NE] = this.generateGridLineId('v', row - 1, col + 1);
                }
                if (col >= 0 && row < this.rows) {
                    gridLine.connections[Grid.SW] = this.generateGridLineId('v', row, col);
                }
                if (row < this.rows) {
                    gridLine.connections[Grid.SE] = this.generateGridLineId('v', row, col + 1);
                }
            } else {
                if (row >= 0 && col > 0) {
                    gridLine.connections[Grid.NW] = this.generateGridLineId('h', row, col - 1);
                }
                if (row >= 0 && col < this.cols) {
                    gridLine.connections[Grid.NE] = this.generateGridLineId('h', row, col);
                }
                if (row < this.rows && col > 0) {
                    gridLine.connections[Grid.SW] = this.generateGridLineId('h', row + 1, col - 1);
                }
                if (row < this.rows && col < this.cols) {
                    gridLine.connections[Grid.SE] = this.generateGridLineId('h', row + 1, col);
                }
            }
        }
    }

    initializeUsedDirections() {
        for (const [id, gridLine] of this.gridLines.entries()) {
            this.usedDirections.set(id, new Set());
        }
        
        for (const [id, gridLine] of this.gridLines.entries()) {
            if (!this.isBoundaryGridLine(gridLine)) {
                continue;
            }
            
            if (gridLine.type === 'horizontal') {
                if (gridLine.row === 0) {
                    this.usedDirections.get(id).add(Grid.NW);
                    this.usedDirections.get(id).add(Grid.NE);
                } else if (gridLine.row === this.rows) {
                    this.usedDirections.get(id).add(Grid.SW);
                    this.usedDirections.get(id).add(Grid.SE);
                }
            } else {
                if (gridLine.col === 0) {
                    this.usedDirections.get(id).add(Grid.SW);
                    this.usedDirections.get(id).add(Grid.NW);
                } else if (gridLine.col === this.cols) {
                    this.usedDirections.get(id).add(Grid.NE);
                    this.usedDirections.get(id).add(Grid.SE);
                }
            }
        }
    }

    isBoundaryGridLine(gridLine) {
        if (!gridLine) return false;
        const { type, row, col } = gridLine;
        if (type === 'horizontal') {
            return row === 0 || row === this.rows;
        } else {
            return col === 0 || col === this.cols;
        }
    }

    getGridLine(id) {
        return this.gridLines.get(id) || null;
    }

    getAdjacentGridLine(lineId, direction) {
        const gridLine = this.getGridLine(lineId);
        if (!gridLine) return null;
        
        if (![Grid.NW, Grid.NE, Grid.SW, Grid.SE].includes(direction)) {
            return null;
        }
        
        const nextLineId = gridLine.connections[direction];
        
        if (nextLineId === null) {
            throw new Error("Curve left the grid");
        }
        
        return nextLineId;
    }

    setMirror(lineId, isMirror) {
        const gridLine = this.getGridLine(lineId);
        if (gridLine) {
            gridLine.isMirror = isMirror;
        }
    }

    getReflectedDirection(gridLineId, incomingDirection) {
        const gridLine = this.getGridLine(gridLineId);
        if (!gridLine) return incomingDirection;
        
        if (!gridLine.isMirror) {
            return incomingDirection;
        }
        
        if (gridLine.type === 'horizontal') {
            switch (incomingDirection) {
                case Grid.NW: return Grid.SW;
                case Grid.NE: return Grid.SE;
                case Grid.SW: return Grid.NW;
                case Grid.SE: return Grid.NE;
                default: return incomingDirection;
            }
        } else {
            switch (incomingDirection) {
                case Grid.NW: return Grid.NE;
                case Grid.NE: return Grid.NW;
                case Grid.SW: return Grid.SE;
                case Grid.SE: return Grid.SW;
                default: return incomingDirection;
            }
        }
    }

    markDirectionUsed(gridLineId, direction) {
        if (this.usedDirections.has(gridLineId)) {
            this.usedDirections.get(gridLineId).add(direction);
        }
    }

    isDirectionUsed(gridLineId, direction) {
        if (!this.usedDirections.has(gridLineId)) {
            return false;
        }
        return this.usedDirections.get(gridLineId).has(direction);
    }

    getUnusedDirections(gridLineId) {
        const allDirections = [Grid.NW, Grid.NE, Grid.SW, Grid.SE];
        const gridLine = this.getGridLine(gridLineId);
        
        if (!gridLine || !this.usedDirections.has(gridLineId)) {
            return [];
        }
        
        const usedDirs = this.usedDirections.get(gridLineId);
        const validDirs = allDirections.filter(dir => {
            if (usedDirs.has(dir)) {
                return false;
            }
            return true;
        });
        
        return validDirs;
    }

    resetUsedDirections() {
        this.initializeUsedDirections();
    }

    randomizeMirrors(p) {
        if (p < 0 || p > 1) {
            throw new Error("Probability must be between 0 and 1");
        }

        for (const [id, gridLine] of this.gridLines.entries()) {
            const { type, row, col } = this.parseGridLineId(id);
            const isBoundary =
                (type === 'h' && (row === 0 || row === this.rows)) ||
                (type === 'v' && (col === 0 || col === this.cols));
            if (isBoundary) continue;

            this.setMirror(id, Math.random() < p);
        }
    }

    generateGridLineId(type, row, col) {
        return `${type}_${row}_${col}`;
    }

    parseGridLineId(id) {
        const parts = id.split('_');
        return {
            type: parts[0],
            row: parseInt(parts[1], 10),
            col: parseInt(parts[2], 10)
        };
    }
}

// ============================================================================
// MIRROR CURVE CLASS - EXACT from tezcatli
// ============================================================================
class MirrorCurve {
    constructor(startGridLine, initialDirection) {
        this.gridLines = [startGridLine];
        this.directions = [initialDirection];
        this.isClosed = false;
        this.leftGrid = false;
        this.exitPoint = null;
        this.exitDirection = null;
        this.isCompleted = false;
    }
    
    addSegment(nextGridLine, nextDirection) {
        this.gridLines.push(nextGridLine);
        this.directions.push(nextDirection);
    }
    
    buildCurve(grid) {
        let currentGridLine = this.gridLines[0];
        let currentDirection = this.directions[0];
        grid.markDirectionUsed(currentGridLine.id, currentDirection);
        
        while (true) {
            try {
                const nextLineId = grid.getAdjacentGridLine(currentGridLine.id, currentDirection);
                const nextGridLine = grid.getGridLine(nextLineId);
                
                if (!nextGridLine) {
                    console.warn(`Invalid grid line returned: ${nextLineId}`);
                    return false;
                }
                
                let nextDirection = currentDirection;
                if (nextGridLine.isMirror) {
                    nextDirection = grid.getReflectedDirection(nextLineId, currentDirection);
                }
                
                this.addSegment(nextGridLine, nextDirection);
                
                grid.markDirectionUsed(nextLineId, nextDirection);
                
                const oppositeDirection = 
                    currentDirection === Grid.NW ? Grid.SE :
                    currentDirection === Grid.SE ? Grid.NW :
                    currentDirection === Grid.NE ? Grid.SW :
                    Grid.NE;
                grid.markDirectionUsed(nextLineId, oppositeDirection);
                
                if (this.gridLines.length > 2) {
                    if (nextGridLine.id === this.gridLines[0].id && 
                        nextDirection === this.directions[0]) {
                        this.isClosed = true;
                        return true;
                    }
                }
                
                currentGridLine = nextGridLine;
                currentDirection = nextDirection;
            }
            catch (error) {
                if (error.message === "Curve left the grid") {
                    this.leftGrid = true;
                    this.exitPoint = currentGridLine;
                    this.exitDirection = currentDirection;
                    return true;
                }
                throw error;
            }
        }
    }
}

// ============================================================================
// CURVE START FINDER - EXACT from tezcatli
// ============================================================================
function findNextCurve(grid) {
    for (const [id, gridLine] of grid.gridLines.entries()) {
        const unusedDirections = grid.getUnusedDirections(id);
        
        if (unusedDirections.length > 0) {
            const direction = unusedDirections[0];
            const curve = new MirrorCurve(gridLine, direction);
            
            try {
                const success = curve.buildCurve(grid);
                if (success) {
                    return curve;
                }
            } catch (error) {
                console.error(`Error building curve from ${id} in direction ${direction}:`, error);
            }
        }
    }
    
    return null;
}

// ============================================================================
// HELPER POINT CALCULATOR - EXACT from tezcatli
// ============================================================================
function findHelperPoint(line, direction, cellSize) {
    let x, y;
    if (line.type === 'horizontal') {
        x = (line.col + 0.5) * cellSize;
        y = line.row * cellSize;
    } else {
        x = line.col * cellSize;
        y = (line.row + 0.5) * cellSize;
    }
    
    if (line.isMirror) {
        const d = cellSize / 6;
        
        if (line.type === 'vertical') {
            if (direction === 1 || direction === 3) {
                x += d;
            } else if (direction === 0 || direction === 2) {
                x -= d;
            }
        } else {
            if (direction === 0 || direction === 1) {
                y -= d;
            } else if (direction === 2 || direction === 3) {
                y += d;
            }
        }
    }
    
    return { x, y };
}

function calculateAllHelperPoints(curves, cellSize) {
    const allHelperPoints = [];
    
    curves.forEach(curve => {
        if (curve.isCompleted && curve.gridLines && Array.isArray(curve.gridLines)) {
            const helperPointsForCurve = curve.gridLines.map((line, index) => {
                const direction = curve.directions[index];
                const point = findHelperPoint(line, direction, cellSize);
                return { ...point, curveIndex: allHelperPoints.length };
            });
            
            allHelperPoints.push(helperPointsForCurve);
        }
    });
    
    return allHelperPoints;
}

// ============================================================================
// SPLINE - EXACT from tezcatli
// ============================================================================
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function segmentSubdivision(P0, P1, M0, M1, subdivisions) {
    const pts = [];
    for (let j = 0; j < subdivisions; j++) {
        const t = j / subdivisions;
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const x = h00 * P0.x + h10 * M0.x + h01 * P1.x + h11 * M1.x;
        const y = h00 * P0.y + h10 * M0.y + h01 * P1.y + h11 * M1.y;

        pts.push({ x, y });
    }
    return pts;
}

function getSplinePoints(rawPoints, tension = 0.5, subdivisions = 10) {
    const N = rawPoints.length;
    if (N < 2) {
        return rawPoints.slice();
    }
    
    const alreadyClosed = (N > 1 && 
        Math.abs(rawPoints[0].x - rawPoints[N-1].x) < 0.001 && 
        Math.abs(rawPoints[0].y - rawPoints[N-1].y) < 0.001);
    
    const effectivePoints = alreadyClosed ? rawPoints.slice(0, N-1) : rawPoints;
    const numPoints = effectivePoints.length;
    
    const tangents = [];
    for (let i = 0; i < numPoints; i++) {
        const prev = effectivePoints[(i - 1 + numPoints) % numPoints];
        const next = effectivePoints[(i + 1) % numPoints];
        tangents.push({
            x: ((next.x - prev.x) * (1 - tension)) / 2,
            y: ((next.y - prev.y) * (1 - tension)) / 2
        });
    }

    const curve = [];
    
    for (let i = 0; i < numPoints; i++) {
        const P0 = effectivePoints[i];
        const P1 = effectivePoints[(i + 1) % numPoints];
        const M0 = tangents[i];
        const M1 = tangents[(i + 1) % numPoints];

        const segment = segmentSubdivision(P0, P1, M0, M1, subdivisions);
        
        if (i < numPoints - 1 || alreadyClosed) {
            curve.push(...segment);
        } else {
            curve.push(...segment);
        }
    }
    
    if (alreadyClosed) {
        curve.push({ 
            x: effectivePoints[0].x, 
            y: effectivePoints[0].y 
        });
    }
    
    return curve;
}

// ============================================================================
// CALCULATE SUBDIVISIONS - EXACT from tezcatli
// ============================================================================
function calculateSubdivisions(rows, cols, isAnimation = false) {
    const cellCount = rows * cols;
    const baseSubdivisions = 8;
    
    if (cellCount <= 25) {
        return baseSubdivisions + 4;
    }
    
    if (cellCount <= 100) {
        return baseSubdivisions + 2;
    }
    
    if (cellCount <= 400) {
        return Math.max(3, baseSubdivisions - 2);
    }
    
    return Math.max(2, baseSubdivisions - 4);
}

// ============================================================================
// LAYOUT MANAGER - EXACT from tezcatli
// ============================================================================
function calculateGridLayout(stageWidth, stageHeight, rows, cols) {
    const padding = Math.min(stageWidth, stageHeight) * 0.05;
    const drawableWidth = stageWidth - (padding * 2);
    const drawableHeight = stageHeight - (padding * 2);
    
    const cellSize = Math.min(
        drawableWidth / cols,
        drawableHeight / rows
    );
    
    const offsetX = padding + (drawableWidth - (cellSize * cols)) / 2;
    const offsetY = padding + (drawableHeight - (cellSize * rows)) / 2;
    
    return {
        cellSize,
        offsetX,
        offsetY,
        padding,
        drawableWidth,
        drawableHeight,
        gridRows: rows,
        gridCols: cols
    };
}

// ============================================================================
// MIRROR CURVE VIEWER WEB COMPONENT - EXACT PORT
// ============================================================================
class MirrorCurveViewer extends HTMLElement {
    static get observedAttributes() { 
        return [
            'rows', 'cols', 'mirror-probability',
            'show-mirrors', 'show-center-dots', 'show-grid-lines', 'show-grid-points', 'show-helper-points',
            'smooth', 'curve-style', 'tension',
            'animate-curves', 'animation-speed',
            'curve-colors'
        ]; 
    }

    constructor() {
        super();
        console.log('🎯 MirrorCurveViewer constructor called');
        
        // Core state - EXACT from tezcatli
        this.grid = null;
        this.curves = [];
        this.animationPath = null;
        this.gridLayout = {};
        this.helperPoints = [];
        
        // Animation state - EXACT from tezcatli
        this.isAnimating = false;
        this.distanceTraveled = 0;
        this.animationCurve = null;
        this.animationQueue = [];
        
        // Konva objects
        this.Konva = null;
        this.stage = null;
        this.layer = null;
        
        // Groups - EXACT from tezcatli
        this.gridLayer = null;
        this.staticCurveLayer = null;
        this.animationLayer = null;
        
        // Animation loop
        this.animationId = null;
        this.lastFrameTime = 0;
        
        // Cache for animation - EXACT from tezcatli
        this.animationCache = new Map();
        
        // Resize observer
        this._ro = null;
        this.lastWidth = 0;
        this.lastHeight = 0;
    }
    
    connectedCallback() {
        console.log('🔗 MirrorCurveViewer connected to DOM');
        
        this.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
                overflow: hidden;
                background: transparent;
            " id="konvaContainer"></div>
            
            <div id="errorMessage" style="
                position: absolute;
                inset: 0;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #dc3545;
                text-align: center;
                background: rgba(248, 249, 250, 0.95);
                backdrop-filter: blur(4px);
                border-radius: 8px;
                padding: 20px;
            ">
                <div style="font-size: 32px;">⚠️</div>
                <div style="font-size: 14px; font-weight: 500;">Failed to load mirror curve viewer</div>
                <div id="errorDetails" style="font-size: 12px; opacity: 0.8;"></div>
            </div>
        `;
        
        this.initialize().catch(err => {
            console.error('❌ MirrorCurveViewer initialization error:', err);
            this.showError(err.message || 'Unknown error occurred');
        });
        
        console.log('✅ MirrorCurveViewer HTML rendered successfully');
    }
    
    disconnectedCallback() {
        console.log('🔌 MirrorCurveViewer disconnected from DOM');
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.stage) {
            this.stage.destroy();
        }
        
        if (this._ro) {
            this._ro.disconnect();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`🔄 MirrorCurveViewer attribute changed: ${name} = ${newValue}`);
        
        if (!this.Konva) return;
        
        // Grid structure changes
        if (name === 'rows' || name === 'cols') {
            this.initializeGrid();
            this.updateLayout();
            return;
        }
        
        // Mirror probability
        if (name === 'mirror-probability') {
            if (this.grid) {
                const prob = parseFloat(newValue) || 0.3;
                this.grid.randomizeMirrors(prob);
                this.clearCurves();
                this.updateGrid();
            }
            return;
        }
        
        // Display toggles
        if (['show-mirrors', 'show-center-dots', 'show-grid-lines', 'show-grid-points'].includes(name)) {
            this.updateGrid();
            return;
        }
        
        // Curve style changes
        if (['smooth', 'curve-style', 'tension', 'curve-colors', 'show-helper-points'].includes(name)) {
            this.updateStaticCurves();
            this.updateAnimation();
            return;
        }
        
        // Animation speed (handled in animate loop)
        if (name === 'animation-speed') {
            // Just log, speed is read each frame
            return;
        }
        
        // Animate curves toggle
        if (name === 'animate-curves') {
            // Already handled by parameter reading
            return;
        }
    }
    
    async initialize() {
        console.log('🚀 Initializing MirrorCurveViewer...');
        
        // Load Konva
        await this.loadKonva();
        
        // Setup canvas
        this.setupCanvas();
        
        // Initialize grid - EXACT from tezcatli
        this.initializeGrid();
        
        // Setup layout
        this.updateLayout();
        
        // Setup resize handling
        this.setupResizeObserver();
        
        // Initial render
        this.updateGrid();
        this.updateStaticCurves();
        this.updateAnimation();
        
        // Start animation loop
        this.startAnimationLoop();
        
        console.log('✅ MirrorCurveViewer initialization complete');
    }
    
    async loadKonva() {
        console.log('📦 Loading Konva...');
        
        try {
            const konvaMod = await this.importFirst([
                'https://esm.sh/konva@9.2.0',
                'https://cdn.jsdelivr.net/npm/konva@9.2.0/+esm'
            ]);
            this.Konva = konvaMod.default || konvaMod;
            console.log('✅ Konva loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load Konva:', error);
            throw new Error('Failed to load Konva library');
        }
    }
    
    async importFirst(urls) {
        let lastError;
        for (const url of urls) {
            try {
                console.log(`📥 Attempting to load: ${url}`);
                return await import(/* @vite-ignore */ url);
            } catch (error) {
                lastError = error;
                console.warn(`❌ Failed to load ${url}:`, error);
            }
        }
        throw lastError || new Error('All module imports failed');
    }
    
    setupCanvas() {
        const container = this.querySelector('#konvaContainer');
        const { width, height } = this.getBoundingClientRect();
        
        console.log(`Setting up canvas with dimensions: ${width}x${height}`);
        
        // Create Konva stage
        this.stage = new this.Konva.Stage({
            container: container,
            width: width,
            height: height
        });
        
        // Create layer
        this.layer = new this.Konva.Layer();
        this.stage.add(this.layer);
        
        // Create groups - EXACT order from tezcatli
        this.gridLayer = new this.Konva.Group();
        this.staticCurveLayer = new this.Konva.Group();
        this.animationLayer = new this.Konva.Group();
        
        this.layer.add(this.gridLayer);
        this.layer.add(this.staticCurveLayer);
        this.layer.add(this.animationLayer);
        
        // Click handler for toggling mirrors - EXACT from tezcatli
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage) {
                const pos = this.stage.getPointerPosition();
                if (pos) {
                    this.handleGridClick(pos.x, pos.y);
                }
            }
        });
        
        console.log('🎬 Canvas setup complete');
    }
    
    setupResizeObserver() {
        const handleResize = () => {
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height || !this.stage) return;
            
            this.stage.width(width);
            this.stage.height(height);
            this.updateLayout();
            
            console.log(`📐 MirrorCurveViewer resized to: ${width}x${height}`);
        };
        
        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }
    
    // EXACT initializeGrid from tezcatli
    initializeGrid() {
        const rows = this.getParameter('rows');
        const cols = this.getParameter('cols');
        
        console.log(`Initializing grid with ${rows} rows and ${cols} columns`);
        
        try {
            this.grid = new Grid(rows, cols);
            
            const probability = this.getParameter('mirrorProbability');
            this.grid.randomizeMirrors(probability);
            
            this.curves = [];
            this.animationPath = null;
            this.helperPoints = [];
            this.animationQueue = [];
            this.isAnimating = false;
            this.animationCurve = null;
            this.distanceTraveled = 0;
            
            this.clearCache();
        } catch (error) {
            console.error("Error initializing grid:", error);
        }
    }
    
    // EXACT updateLayout from tezcatli
    updateLayout() {
        if (!this.stage || !this.gridLayer) {
            return;
        }
        
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        
        this.gridLayout = calculateGridLayout(
            stageWidth,
            stageHeight,
            this.grid ? this.grid.rows : this.getParameter('rows'),
            this.grid ? this.grid.cols : this.getParameter('cols')
        );
        
        const { offsetX, offsetY } = this.gridLayout;
        
        this.gridLayer.position({ x: offsetX, y: offsetY });
        this.staticCurveLayer.position({ x: offsetX, y: offsetY });
        this.animationLayer.position({ x: offsetX, y: offsetY });
        
        this.clearCurves();
        
        this.lastWidth = stageWidth;
        this.lastHeight = stageHeight;
        
        this.updateGrid();
        this.updateStaticCurves();
        this.updateAnimation();
    }
    
    startAnimationLoop() {
        const animate = (timestamp) => {
            this.animationId = requestAnimationFrame(animate);
            
            if (!this.lastFrameTime) {
                this.lastFrameTime = timestamp;
            }
            
            const deltaTime = (timestamp - this.lastFrameTime) / 1000;
            this.lastFrameTime = timestamp;
            
            this.animate(deltaTime);
        };
        
        this.animationId = requestAnimationFrame(animate);
        console.log('🎬 Animation loop started');
    }
    
    // EXACT animate from tezcatli
    animate(deltaTime) {
        if (!this.stage || !this.staticCurveLayer || !this.animationLayer || !this.gridLayer) {
            return;
        }
        
        const currentWidth = this.stage.width();
        const currentHeight = this.stage.height();
        
        if (currentWidth !== this.lastWidth || currentHeight !== this.lastHeight) {
            this.updateLayout();
        }
        
        if (this.isAnimating && this.animationCurve) {
            const animationSpeed = this.getParameter('animationSpeed');
            const distance = deltaTime * animationSpeed * 100;
            this.distanceTraveled += distance;

            this.animationPath = this.createAnimationPathByDistance(
                this.animationCurve, 
                this.gridLayout.cellSize, 
                this.distanceTraveled,
                {
                    tension: this.getParameter('tension'),
                    curveStyle: this.getParameter('curveStyle'),
                    gridRows: this.getParameter('rows'),
                    gridCols: this.getParameter('cols')
                }
            );

            this.updateAnimation();

            if (this.animationPath && this.animationPath.completed) {
                this.animationCurve.isCompleted = true;
                this.curves.push(this.animationCurve);
                
                this.updateHelperPoints();
                this.updateStaticCurves();
                
                this.startNextAnimation();
            }
        }
    }
    
    // EXACT startNextAnimation from tezcatli
    startNextAnimation() {
        if (this.animationQueue.length === 0) {
            this.isAnimating = false;
            this.animationPath = null;
            this.updateAnimation();
            return;
        }
        
        this.animationCurve = this.animationQueue.shift();
        this.distanceTraveled = 0;
        this.isAnimating = true;
        
        if (this.animationCurve && this.animationCurve.gridLines[0]) {
            const curveId = this.animationCurve.gridLines[0].id;
            if (curveId) {
                this.clearCurveFromCache(curveId);
            }
        }
    }
    
    // EXACT createAnimationPathByDistance from tezcatli
    createAnimationPathByDistance(curve, cellSize, distance, options = {}) {
        if (!curve || !curve.gridLines || curve.gridLines.length === 0) {
            return null;
        }
        
        const { 
            tension = 0.5,
            curveStyle = 'curved',
            smooth = true,
            gridRows = 5,
            gridCols = 5
        } = options;
        
        const curveKey = `${curve.gridLines[0].id}-${tension}-${curveStyle}`;
        
        let allSplinePoints = null;
        let totalLength = 0;
        let segmentLengths = [];
        
        if (this.animationCache.has(curveKey)) {
            const cachedData = this.animationCache.get(curveKey);
            allSplinePoints = cachedData.points;
            totalLength = cachedData.totalLength;
            segmentLengths = cachedData.segmentLengths;
        } else {
            const animSubdivisions = calculateSubdivisions(gridRows, gridCols, true);
            
            const allHelperPoints = curve.gridLines.map((line, index) => {
                const direction = curve.directions[index];
                return findHelperPoint(line, direction, cellSize);
            });
            
            allSplinePoints = getSplinePoints(allHelperPoints, tension, animSubdivisions);
            
            totalLength = 0;
            segmentLengths = [];
            
            for (let i = 1; i < allSplinePoints.length; i++) {
                const dx = allSplinePoints[i].x - allSplinePoints[i-1].x;
                const dy = allSplinePoints[i].y - allSplinePoints[i-1].y;
                const segmentLength = Math.sqrt(dx*dx + dy*dy);
                
                segmentLengths.push(segmentLength);
                totalLength += segmentLength;
            }
            
            this.animationCache.set(curveKey, {
                points: allSplinePoints,
                totalLength,
                segmentLengths
            });
        }
        
        if (allSplinePoints.length < 2) {
            return { completed: true };
        }
        
        if (totalLength < 0.001) {
            return { completed: true };
        }
        
        const cappedDistance = Math.min(distance, totalLength);
        
        let currentLength = 0;
        let segmentIndex = 0;
        
        while (segmentIndex < segmentLengths.length && currentLength + segmentLengths[segmentIndex] < cappedDistance) {
            currentLength += segmentLengths[segmentIndex];
            segmentIndex++;
        }
        
        const visiblePoints = allSplinePoints.slice(0, segmentIndex + 1);
        
        if (segmentIndex < segmentLengths.length) {
            const remainingDistance = cappedDistance - currentLength;
            const segmentFraction = remainingDistance / segmentLengths[segmentIndex];
            
            const lastPoint = allSplinePoints[segmentIndex];
            const nextPoint = allSplinePoints[segmentIndex + 1];
            
            const interpPoint = {
                x: lastPoint.x + (nextPoint.x - lastPoint.x) * segmentFraction,
                y: lastPoint.y + (nextPoint.y - lastPoint.y) * segmentFraction
            };
            
            visiblePoints.push(interpPoint);
        }
        
        if (cappedDistance >= totalLength) {
            return { completed: true };
        }
        
        return {
            type: 'animationPath',
            points: visiblePoints,
            isClosed: false,
            completed: false,
            totalLength: totalLength
        };
    }
    
    clearCache() {
        this.animationCache.clear();
    }
    
    clearCurveFromCache(curveId) {
        for (const key of this.animationCache.keys()) {
            if (key.startsWith(curveId)) {
                this.animationCache.delete(key);
            }
        }
    }
    
    updateHelperPoints() {
        this.helperPoints = calculateAllHelperPoints(this.curves, this.gridLayout.cellSize);
    }
    
    // EXACT updateGrid from tezcatli
    updateGrid() {
        if (!this.grid || !this.gridLayer) return;
        
        this.gridLayer.destroyChildren();
        
        const cellSize = this.gridLayout.cellSize;
        const gridLineColor = '#cccccc';
        const mirrorColor = '#333333';
        
        const showGridLines = this.getParameter('showGridLines');
        const showGridPoints = this.getParameter('showGridPoints');
        const showMirrors = this.getParameter('showMirrors');
        const showCenterDots = this.getParameter('showCenterDots');
        
        // Draw grid lines
        if (showGridLines) {
            for (const line of this.grid.gridLines.values()) {
                const x1 = line.col * cellSize;
                const y1 = line.row * cellSize;
                const x2 = (line.type === 'horizontal' ? (line.col + 1) * cellSize : x1);
                const y2 = (line.type === 'vertical' ? (line.row + 1) * cellSize : y1);
                
                const lineObj = new this.Konva.Line({
                    points: [x1, y1, x2, y2],
                    stroke: gridLineColor,
                    strokeWidth: 1
                });
                
                this.gridLayer.add(lineObj);
            }
        }
        
        // Draw grid points
        if (showGridPoints) {
            for (let r = 0; r <= this.grid.rows; r++) {
                for (let c = 0; c <= this.grid.cols; c++) {
                    const circle = new this.Konva.Circle({
                        x: c * cellSize,
                        y: r * cellSize,
                        radius: 2,
                        fill: gridLineColor
                    });
                    
                    this.gridLayer.add(circle);
                }
            }
        }
        
        // Draw mirror lines
        if (showMirrors) {
            for (const line of this.grid.gridLines.values()) {
                if (!line.isMirror) continue;
                
                const x1 = line.col * cellSize;
                const y1 = line.row * cellSize;
                const x2 = (line.type === 'horizontal' ? (line.col + 1) * cellSize : x1);
                const y2 = (line.type === 'vertical' ? (line.row + 1) * cellSize : y1);
                
                const mirrorLine = new this.Konva.Line({
                    points: [x1, y1, x2, y2],
                    stroke: mirrorColor,
                    strokeWidth: 2
                });
                
                this.gridLayer.add(mirrorLine);
            }
        }
        
        // Draw center dots
        if (showCenterDots) {
            for (let r = 0; r < this.grid.rows; r++) {
                for (let c = 0; c < this.grid.cols; c++) {
                    const centerDot = new this.Konva.Circle({
                        x: (c + 0.5) * cellSize,
                        y: (r + 0.5) * cellSize,
                        radius: 3,
                        fill: mirrorColor
                    });
                    
                    this.gridLayer.add(centerDot);
                }
            }
        }
        
        this.stage.batchDraw();
    }
    
    // EXACT updateStaticCurves from tezcatli
    updateStaticCurves() {
        if (!this.staticCurveLayer) return;
        
        this.staticCurveLayer.destroyChildren();
        
        const colors = this.getColorScheme();
        const helperPointColor = '#ff0000';
        
        this.renderCurves(this.curves, this.staticCurveLayer, {
            cellSize: this.gridLayout.cellSize,
            colorScheme: colors,
            curveStyle: this.getParameter('curveStyle'),
            tension: this.getParameter('tension'),
            smooth: this.getParameter('smooth'),
            showHelperPoints: this.getParameter('showHelperPoints'),
            helperPointColor: helperPointColor,
            helperPoints: this.helperPoints,
            gridRows: this.getParameter('rows'),
            gridCols: this.getParameter('cols')
        });
        
        this.stage.batchDraw();
    }
    
    // EXACT updateAnimation from tezcatli
    updateAnimation() {
        if (!this.animationLayer) return;
        
        this.animationLayer.destroyChildren();
        
        if (this.animationPath) {
            const colors = this.getColorScheme();
            let animationColor = colors[this.curves.length % colors.length];
            
            this.renderCurves([], this.animationLayer, {
                cellSize: this.gridLayout.cellSize,
                colorScheme: [animationColor],
                curveStyle: this.getParameter('curveStyle'),
                tension: this.getParameter('tension'),
                smooth: this.getParameter('smooth'),
                animationPath: this.animationPath,
                gridRows: this.getParameter('rows'),
                gridCols: this.getParameter('cols')
            });
        }
        
        this.stage.batchDraw();
    }
    
    // EXACT renderCurves from tezcatli
    renderCurves(curves, group, options) {
        const {
            cellSize = 1,
            colorScheme = ['#3498db'], 
            curveStyle = 'curved',
            tension = 0,
            smooth = true,
            showHelperPoints = false,
            helperPointColor = '#ff0000',
            animationPath = null,
            helperPoints = [],
            gridRows = 5,
            gridCols = 5
        } = options;
        
        curves.forEach((curve, idx) => {
            const konvaCurve = this.createKonvaCurve(curve, idx, cellSize, colorScheme, {
                curveStyle, 
                tension, 
                smooth,
                gridRows,
                gridCols
            });
            
            if (konvaCurve) {
                group.add(konvaCurve);
            }
        });
        
        if (animationPath) {
            const animCurve = this.createKonvaCurve(
                animationPath, 
                curves.length, 
                cellSize, 
                colorScheme,
                { 
                    curveStyle, 
                    tension, 
                    smooth,
                    gridRows,
                    gridCols
                }
            );
            
            if (animCurve) {
                group.add(animCurve);
            }
        }
        
        if (showHelperPoints) {
            helperPoints.forEach(curvePoints => {
                curvePoints.forEach(point => {
                    const helperPoint = new this.Konva.Circle({
                        x: point.x,
                        y: point.y,
                        radius: 4,
                        fill: helperPointColor
                    });
                    
                    group.add(helperPoint);
                });
            });
        }
    }
    
    // EXACT createKonvaCurve from tezcatli
    createKonvaCurve(curve, idx, cellSize, colorScheme, options) {
        if (!curve) return null;
        
        const { 
            curveStyle = 'curved', 
            tension = 0, 
            smooth = true,
            gridRows = 5,
            gridCols = 5
        } = options;
        
        let points = [];
        let isClosed = false;
        
        if (curve.type === 'animationPath') {
            points = curve.points || [];
            isClosed = curve.isClosed || false;
        }
        else if (curve.gridLines && Array.isArray(curve.gridLines)) {
            isClosed = curve.isClosed || false;
            
            if (curveStyle === 'curved') {
                const helperPointsForCurve = curve.gridLines.map((line, index) => {
                    const direction = curve.directions[index];
                    return findHelperPoint(line, direction, cellSize);
                });
                
                const subdivisions = calculateSubdivisions(gridRows, gridCols, false);
                points = getSplinePoints(helperPointsForCurve, tension, subdivisions);
            } else {
                points = curve.gridLines.map(line => {
                    if (line.type === 'horizontal') {
                        return {
                            x: (line.col + 0.5) * cellSize,
                            y: line.row * cellSize
                        };
                    } else {
                        return {
                            x: line.col * cellSize,
                            y: (line.row + 0.5) * cellSize
                        };
                    }
                });
            }
        }
        
        if (points.length === 0) return null;
        
        const flatPoints = [];
        points.forEach(point => {
            flatPoints.push(point.x, point.y);
        });
        
        const color = colorScheme[idx % colorScheme.length];
        
        const konvaLine = new this.Konva.Line({
            points: flatPoints,
            stroke: color,
            strokeWidth: 3,
            lineCap: 'round',
            lineJoin: 'round',
            closed: isClosed
        });
        
        return konvaLine;
    }
    
    handleGridClick(x, y) {
        if (!this.grid || !this.gridLayout) return;
        
        const clickedLine = this.handleGridInteraction(this.grid, {x, y}, this.gridLayout);
        
        if (clickedLine) {
            this.grid.setMirror(clickedLine.id, !clickedLine.isMirror);
            this.clearCurves();
            this.updateGrid();
        }
    }
    
    // EXACT handleGridInteraction from tezcatli
    handleGridInteraction(grid, event, gridLayout) {
        if (!grid || !event || !gridLayout) {
            return null;
        }
        
        const { cellSize, offsetX, offsetY } = gridLayout;
        const gridX = (event.x - offsetX) / cellSize;
        const gridY = (event.y - offsetY) / cellSize;
        
        if (gridX >= 0 && gridX <= grid.cols && 
            gridY >= 0 && gridY <= grid.rows) {
            
            let closestLine = null;
            let minDistance = Infinity;
            
            for (const line of grid.gridLines.values()) {
                if (grid.isBoundaryGridLine(line)) {
                    continue;
                }
                
                let distance;
                if (line.type === 'horizontal') {
                    const lineX1 = line.col * cellSize;
                    const lineX2 = (line.col + 1) * cellSize;
                    
                    if (gridX >= lineX1 / cellSize && gridX <= lineX2 / cellSize) {
                        distance = Math.abs(gridY - line.row);
                    } else {
                        continue;
                    }
                } else {
                    const lineY1 = line.row * cellSize;
                    const lineY2 = (line.row + 1) * cellSize;
                    
                    if (gridY >= lineY1 / cellSize && gridY <= lineY2 / cellSize) {
                        distance = Math.abs(gridX - line.col);
                    } else {
                        continue;
                    }
                }
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestLine = line;
                }
            }
            
            if (closestLine && minDistance < 0.2) {
                return closestLine;
            }
        }
        
        return null;
    }
    
    getColorScheme() {
        const colorScheme = this.getParameter('curveColors');
        
        switch (colorScheme) {
            case 'blues':
                return ['#0066cc', '#0080ff', '#3399ff', '#66b3ff', '#99ccff'];
            case 'warm':
                return ['#ff6b6b', '#ff8e53', '#ff6b35', '#f7931e', '#ffcc02'];
            case 'cool':
                return ['#4ecdc4', '#44a08d', '#096a6b', '#1a535c', '#4f4f4f'];
            case 'rainbow':
            default:
                return ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
        }
    }
    
    // Parameter getters - with defaults
    getParameter(name) {
        switch (name) {
            case 'rows':
                return parseInt(this.getAttribute('rows')) || 5;
            case 'cols':
                return parseInt(this.getAttribute('cols')) || 5;
            case 'mirrorProbability':
                return parseFloat(this.getAttribute('mirror-probability')) || 0.3;
            case 'showMirrors':
                return this.getAttribute('show-mirrors') !== 'false';
            case 'showCenterDots':
                return this.getAttribute('show-center-dots') !== 'false';
            case 'showGridLines':
                return this.getAttribute('show-grid-lines') === 'true';
            case 'showGridPoints':
                return this.getAttribute('show-grid-points') === 'true';
            case 'showHelperPoints':
                return this.getAttribute('show-helper-points') === 'true';
            case 'smooth':
                return this.getAttribute('smooth') !== 'false';
            case 'curveStyle':
                return this.getAttribute('curve-style') || 'curved';
            case 'tension':
                return parseFloat(this.getAttribute('tension')) || 0;
            case 'animateCurves':
                return this.getAttribute('animate-curves') !== 'false';
            case 'animationSpeed':
                return parseFloat(this.getAttribute('animation-speed')) || 15;
            case 'curveColors':
                return this.getAttribute('curve-colors') || 'rainbow';
            default:
                return null;
        }
    }
    
    // Public API methods - EXACT from tezcatli
    randomizeMirrors() {
        if (!this.grid) return;
        
        const probability = this.getParameter('mirrorProbability');
        this.grid.randomizeMirrors(probability);
        this.clearCurves();
        this.updateGrid();
    }
    
    discoverAllCurves() {
        if (!this.grid) return;
        
        const newCurves = [];
        let nextCurve;
        
        while ((nextCurve = findNextCurve(this.grid)) !== null) {
            newCurves.push(nextCurve);
        }
        
        if (newCurves.length === 0) return;
        
        if (this.getParameter('animateCurves')) {
            this.animationQueue = [...this.animationQueue, ...newCurves];
            
            if (!this.isAnimating) {
                this.startNextAnimation();
            }
        } else {
            newCurves.forEach(curve => {
                curve.isCompleted = true;
            });
            this.curves = [...this.curves, ...newCurves];
            this.updateHelperPoints();
            this.updateStaticCurves();
        }
    }
    
    clearCurves() {
        this.curves = [];
        this.animationPath = null;
        this.helperPoints = [];
        this.isAnimating = false;
        this.animationCurve = null;
        this.animationQueue = [];
        this.distanceTraveled = 0;
        
        this.clearCache();
        
        if (this.grid) {
            this.grid.resetUsedDirections();
        }
        
        this.updateStaticCurves();
        this.updateAnimation();
    }
    
    animateNextCurve() {
        if (!this.grid) return;
        
        const nextCurve = findNextCurve(this.grid);
        
        if (nextCurve) {
            this.animationQueue.push(nextCurve);
            
            if (!this.isAnimating) {
                this.startNextAnimation();
            }
        }
    }
    
    resetGrid() {
        this.initializeGrid();
        this.updateLayout();
    }
    
    showError(message) {
        const error = this.querySelector('#errorMessage');
        const details = this.querySelector('#errorDetails');
        
        if (error) error.style.display = 'flex';
        if (details) details.textContent = message;
    }
}

console.log('📝 Registering mirror-curve-viewer...');
customElements.define('mirror-curve-viewer', MirrorCurveViewer);
console.log('✅ mirror-curve-viewer registered successfully!');