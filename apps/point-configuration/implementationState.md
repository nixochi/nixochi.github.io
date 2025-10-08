// ============================================================================
// STATE LAYER - Primary state (source of truth)
// ============================================================================

// state/Configuration.js
class Configuration {
    constructor() {
        this.points = []; // Array of {x, y, onLines: []}
        this.lines = []; // Array of {x, y, angle}
        this.observers = new Set();
    }

    // Point operations
    addPoint(x, y, onLines = []) {
        const point = { x, y, onLines: [...onLines] };
        this.points.push(point);
        const index = this.points.length - 1;
        this.notify({ type: 'pointAdded', index, point });
        return index;
    }

    removePoint(index) {
        if (index < 0 || index >= this.points.length) return false;
        const point = this.points[index];
        this.points.splice(index, 1);
        this.notify({ type: 'pointRemoved', index, point });
        return true;
    }

    updatePoint(index, updates) {
        if (index < 0 || index >= this.points.length) return false;
        Object.assign(this.points[index], updates);
        this.notify({ type: 'pointUpdated', index, point: this.points[index] });
        return true;
    }

    updatePointPosition(index, x, y) {
        return this.updatePoint(index, { x, y });
    }

    updatePointLines(index, onLines) {
        return this.updatePoint(index, { onLines: [...onLines] });
    }

    getPoint(index) {
        return this.points[index];
    }

    getAllPoints() {
        return [...this.points];
    }

    getPointsCount() {
        return this.points.length;
    }

    getPointsAtPosition(worldX, worldY, threshold = 18) {
        const indices = [];
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= threshold) {
                indices.push(i);
            }
        }
        return indices;
    }

    // Line operations
    addLine(x, y, angle) {
        const line = { x, y, angle };
        this.lines.push(line);
        const index = this.lines.length - 1;
        this.notify({ type: 'lineAdded', index, line });
        return index;
    }

    removeLine(index) {
        if (index < 0 || index >= this.lines.length) return false;
        const line = this.lines[index];
        this.lines.splice(index, 1);

        // Update all points' onLines arrays
        for (const point of this.points) {
            point.onLines = point.onLines
                .filter(lineIdx => lineIdx !== index)
                .map(lineIdx => lineIdx > index ? lineIdx - 1 : lineIdx);
        }

        this.notify({ type: 'lineRemoved', index, line });
        return true;
    }

    getLine(index) {
        return this.lines[index];
    }

    getAllLines() {
        return [...this.lines];
    }

    getLinesCount() {
        return this.lines.length;
    }

    // Clear all
    clear() {
        this.points = [];
        this.lines = [];
        this.notify({ type: 'cleared' });
    }

    // Serialization
    serialize() {
        const factor = 10; // 1 decimal precision
        return {
            v: 1,
            p: this.points.map(p => [
                Math.round(p.x * factor) / factor,
                Math.round(p.y * factor) / factor,
                p.onLines
            ]),
            l: this.lines.map(l => [
                Math.round(l.x * factor) / factor,
                Math.round(l.y * factor) / factor,
                Math.round(l.angle * 10000) / 10000
            ])
        };
    }

    deserialize(data) {
        if (!data || data.v !== 1) return false;
        this.points = data.p.map(([x, y, onLines]) => ({ x, y, onLines }));
        this.lines = data.l.map(([x, y, angle]) => ({ x, y, angle }));
        this.notify({ type: 'deserialized' });
        return true;
    }

    // Observer pattern
    subscribe(callback) {
        this.observers.add(callback);
    }

    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    notify(event) {
        this.observers.forEach(callback => callback(event));
    }
}

// state/HistoryState.js
class HistoryState {
    constructor() {
        this.actions = [];
        this.currentIndex = -1;
        this.maxHistorySize = 100;
        this.observers = new Set();
    }

    push(action) {
        // Truncate forward history
        this.actions = this.actions.slice(0, this.currentIndex + 1);
        
        // Add new action with timestamp
        this.actions.push({ ...action, timestamp: Date.now() });
        this.currentIndex++;

        // Enforce max size
        if (this.actions.length > this.maxHistorySize) {
            this.actions.shift();
            this.currentIndex--;
        }

        this.notify();
    }

    getCurrentAction() {
        return this.currentIndex >= 0 ? this.actions[this.currentIndex] : null;
    }

    getUndoAction() {
        return this.getCurrentAction();
    }

    getRedoAction() {
        return this.currentIndex < this.actions.length - 1 
            ? this.actions[this.currentIndex + 1] 
            : null;
    }

    canUndo() {
        return this.currentIndex >= 0;
    }

    canRedo() {
        return this.currentIndex < this.actions.length - 1;
    }

    moveBackward() {
        if (this.canUndo()) {
            this.currentIndex--;
            this.notify();
        }
    }

    moveForward() {
        if (this.canRedo()) {
            this.currentIndex++;
            this.notify();
        }
    }

    clear() {
        this.actions = [];
        this.currentIndex = -1;
        this.notify();
    }

    getActions() {
        return [...this.actions];
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    subscribe(callback) {
        this.observers.add(callback);
    }

    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    notify() {
        this.observers.forEach(callback => callback());
    }
}

// state/InteractionState.js
class InteractionState {
    constructor() {
        this.mode = 'point'; // 'point' | 'line'
        this.state = { type: 'idle', data: null };
        this.mousePosition = null;
        this.mouseDownPosition = null;
        this.observers = new Set();
    }

    setMode(mode) {
        this.mode = mode;
        this.state = { type: 'idle', data: null };
        this.notify();
    }

    transitionTo(stateType, data = null) {
        this.state = { type: stateType, data };
        this.notify();
    }

    setMousePosition(worldX, worldY, screenX, screenY) {
        this.mousePosition = { worldX, worldY, screenX, screenY };
        this.notify();
    }

    clearMousePosition() {
        this.mousePosition = null;
        this.notify();
    }

    setMouseDownPosition(worldX, worldY, screenX, screenY, time) {
        this.mouseDownPosition = { worldX, worldY, screenX, screenY, time };
    }

    clearMouseDownPosition() {
        this.mouseDownPosition = null;
    }

    getMode() {
        return this.mode;
    }

    getState() {
        return this.state;
    }

    getStateType() {
        return this.state.type;
    }

    getStateData() {
        return this.state.data;
    }

    getMousePosition() {
        return this.mousePosition;
    }

    getMouseDownPosition() {
        return this.mouseDownPosition;
    }

    isInState(type) {
        return this.state.type === type;
    }

    isIdle() {
        return this.state.type === 'idle';
    }

    reset() {
        this.state = { type: 'idle', data: null };
        this.mousePosition = null;
        this.mouseDownPosition = null;
        this.notify();
    }

    subscribe(callback) {
        this.observers.add(callback);
    }

    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    notify() {
        this.observers.forEach(callback => callback());
    }
}

// state/TransformState.js
class TransformState {
    constructor() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.observers = new Set();
    }

    setPan(offsetX, offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.notify();
    }

    setZoom(scale) {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
        this.notify();
    }

    setCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    zoomAt(screenX, screenY, scaleFactor) {
        const oldScale = this.scale;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * scaleFactor));
        
        const worldX = (screenX - this.offsetX) / oldScale;
        const worldY = (screenY - this.offsetY) / oldScale;
        
        this.scale = newScale;
        this.offsetX = screenX - worldX * newScale;
        this.offsetY = screenY - worldY * newScale;
        
        this.notify();
    }

    pan(deltaX, deltaY) {
        this.offsetX += deltaX;
        this.offsetY += deltaY;
        this.notify();
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.scale + this.offsetX,
            y: worldY * this.scale + this.offsetY
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scale,
            y: (screenY - this.offsetY) / this.scale
        };
    }

    getViewportBounds() {
        return {
            left: -this.offsetX / this.scale,
            right: (this.canvasWidth - this.offsetX) / this.scale,
            top: -this.offsetY / this.scale,
            bottom: (this.canvasHeight - this.offsetY) / this.scale
        };
    }

    getOffsetX() {
        return this.offsetX;
    }

    getOffsetY() {
        return this.offsetY;
    }

    getScale() {
        return this.scale;
    }

    reset() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        this.notify();
    }

    centerOrigin() {
        this.offsetX = this.canvasWidth / 2;
        this.offsetY = this.canvasHeight / 2;
        this.notify();
    }

    subscribe(callback) {
        this.observers.add(callback);
    }

    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    notify() {
        this.observers.forEach(callback => callback());
    }
}

// state/UIState.js
class UIState {
    constructor() {
        this.rayOpacity = 1.0;
        this.colorPalette = 'monochromatic';
        this.currentStatsView = 'general';
        this.statsPagination = {
            bases: { offset: 0, batchSize: 20 },
            circuits: { offset: 0, batchSize: 20 },
            flats: { offset: 0, batchSize: 20 }
        };
        this.optionsPanelVisible = false;
        this.debugPanelVisible = false;
        this.hoveredPointsFromUI = new Set();
        this.observers = new Set();
    }

    setRayOpacity(opacity) {
        this.rayOpacity = Math.max(0, Math.min(1, opacity));
        this.notify();
    }

    setColorPalette(palette) {
        this.colorPalette = palette;
        this.notify();
    }

    setCurrentStatsView(view) {
        this.currentStatsView = view;
        this.notify();
    }

    loadMoreStats(view) {
        if (this.statsPagination[view]) {
            this.statsPagination[view].offset += this.statsPagination[view].batchSize;
            this.notify();
        }
    }

    resetPagination(view = null) {
        if (view) {
            this.statsPagination[view].offset = 0;
        } else {
            Object.keys(this.statsPagination).forEach(key => {
                this.statsPagination[key].offset = 0;
            });
        }
        this.notify();
    }

    setOptionsPanelVisible(visible) {
        this.optionsPanelVisible = visible;
        this.notify();
    }

    setDebugPanelVisible(visible) {
        this.debugPanelVisible = visible;
        this.notify();
    }

    setHoveredPointsFromUI(pointIndices) {
        this.hoveredPointsFromUI = new Set(pointIndices);
        this.notify();
    }

    clearHoveredPointsFromUI() {
        this.hoveredPointsFromUI.clear();
        this.notify();
    }

    getRayOpacity() {
        return this.rayOpacity;
    }

    getColorPalette() {
        return this.colorPalette;
    }

    getCurrentStatsView() {
        return this.currentStatsView;
    }

    getStatsPagination(view) {
        return this.statsPagination[view];
    }

    isOptionsPanelVisible() {
        return this.optionsPanelVisible;
    }

    isDebugPanelVisible() {
        return this.debugPanelVisible;
    }

    getHoveredPointsFromUI() {
        return this.hoveredPointsFromUI;
    }

    subscribe(callback) {
        this.observers.add(callback);
    }

    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    notify() {
        this.observers.forEach(callback => callback());
    }
}

// ============================================================================
// DERIVED LAYER - Computed state (pure functions)
// ============================================================================

// Geometry utilities (from geometry-utils.js)
class GeometryUtils {
    static computeLineIntersection(line1, line2) {
        const { x: x1, y: y1, angle: a1 } = line1;
        const { x: x2, y: y2, angle: a2 } = line2;

        const dx1 = Math.cos(a1);
        const dy1 = Math.sin(a1);
        const dx2 = Math.cos(a2);
        const dy2 = Math.sin(a2);

        const cross = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(cross) < 0.0001) return null;

        const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / cross;
        return { x: x1 + t1 * dx1, y: y1 + t1 * dy1 };
    }

    static projectPointOntoLine(px, py, line) {
        const { x, y, angle } = line;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const vx = px - x;
        const vy = py - y;
        const t = vx * dx + vy * dy;
        return { x: x + t * dx, y: y + t * dy };
    }

    static getLineEndpoints(x, y, angle, bounds) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const intersections = [];

        if (Math.abs(dx) > 0.0001) {
            const t = (bounds.left - x) / dx;
            const py = y + t * dy;
            if (py >= bounds.top && py <= bounds.bottom) {
                intersections.push({ x: bounds.left, y: py, t });
            }
        }

        if (Math.abs(dx) > 0.0001) {
            const t = (bounds.right - x) / dx;
            const py = y + t * dy;
            if (py >= bounds.top && py <= bounds.bottom) {
                intersections.push({ x: bounds.right, y: py, t });
            }
        }

        if (Math.abs(dy) > 0.0001) {
            const t = (bounds.top - y) / dy;
            const px = x + t * dx;
            if (px >= bounds.left && px <= bounds.right) {
                intersections.push({ x: px, y: bounds.top, t });
            }
        }

        if (Math.abs(dy) > 0.0001) {
            const t = (bounds.bottom - y) / dy;
            const px = x + t * dx;
            if (px >= bounds.left && px <= bounds.right) {
                intersections.push({ x: px, y: bounds.bottom, t });
            }
        }

        if (intersections.length < 2) return null;

        intersections.sort((a, b) => a.t - b.t);
        return {
            x1: intersections[0].x,
            y1: intersections[0].y,
            x2: intersections[intersections.length - 1].x,
            y2: intersections[intersections.length - 1].y
        };
    }
}

// derived/IntersectionsComputer.js
class IntersectionsComputer {
    constructor(configuration) {
        this.configuration = configuration;
    }

    compute() {
        const lines = this.configuration.getAllLines();
        const pairwiseIntersections = [];

        // Compute all pairwise intersections
        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const intersection = GeometryUtils.computeLineIntersection(lines[i], lines[j]);
                if (intersection) {
                    pairwiseIntersections.push({
                        x: intersection.x,
                        y: intersection.y,
                        lineIndices: [i, j]
                    });
                }
            }
        }

        // Cluster by location (within 0.1 units)
        const clusterThreshold = 0.1;
        const clusters = [];

        for (const intersection of pairwiseIntersections) {
            let cluster = clusters.find(c =>
                Math.hypot(c.x - intersection.x, c.y - intersection.y) < clusterThreshold
            );

            if (cluster) {
                intersection.lineIndices.forEach(lineIdx => {
                    if (!cluster.lineIndices.includes(lineIdx)) {
                        cluster.lineIndices.push(lineIdx);
                    }
                });
            } else {
                clusters.push({
                    x: intersection.x,
                    y: intersection.y,
                    lineIndices: [...intersection.lineIndices]
                });
            }
        }

        return clusters;
    }
}

// derived/SnapPreviewComputer.js
class SnapPreviewComputer {
    constructor(configuration, interactionState, intersectionsComputer, transformState) {
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.intersectionsComputer = intersectionsComputer;
        this.transformState = transformState;
        this.snapThresholds = { intersection: 15, line: 20, point: 15 };
    }

    compute() {
        const mousePos = this.interactionState.getMousePosition();
        if (!mousePos) return null;

        const worldX = mousePos.worldX;
        const worldY = mousePos.worldY;
        const scale = this.transformState.getScale();

        // Convert screen-space thresholds to world-space
        const worldPointThreshold = this.snapThresholds.point / scale;
        const worldIntersectionThreshold = this.snapThresholds.intersection / scale;
        const worldLineThreshold = this.snapThresholds.line / scale;

        // Priority 1: Existing points
        const points = this.configuration.getAllPoints();
        let minPointDist = worldPointThreshold;
        let closestPoint = null;

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const dist = Math.hypot(point.x - worldX, point.y - worldY);
            if (dist < minPointDist) {
                minPointDist = dist;
                closestPoint = { type: 'point', x: point.x, y: point.y, pointIndex: i };
            }
        }

        if (closestPoint) return closestPoint;

        // Priority 2: Intersections
        const intersections = this.intersectionsComputer.compute();
        let minIntersectionDist = worldIntersectionThreshold;
        let closestIntersection = null;

        for (let i = 0; i < intersections.length; i++) {
            const inter = intersections[i];
            const dist = Math.hypot(inter.x - worldX, inter.y - worldY);
            if (dist < minIntersectionDist) {
                minIntersectionDist = dist;
                closestIntersection = {
                    type: 'intersection',
                    x: inter.x,
                    y: inter.y,
                    intersectionIndex: i,
                    lineIndices: inter.lineIndices
                };
            }
        }

        if (closestIntersection) return closestIntersection;

        // Priority 3: Lines
        const lines = this.configuration.getAllLines();
        let minLineDist = worldLineThreshold;
        let closestLine = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const projected = GeometryUtils.projectPointOntoLine(worldX, worldY, line);
            const dist = Math.hypot(projected.x - worldX, projected.y - worldY);
            if (dist < minLineDist) {
                minLineDist = dist;
                closestLine = {
                    type: 'line',
                    x: projected.x,
                    y: projected.y,
                    lineIndex: i
                };
            }
        }

        return closestLine;
    }
}

// derived/HighlightsComputer.js
class HighlightsComputer {
    constructor(configuration, interactionState, uiState, snapPreviewComputer, intersectionsComputer) {
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.uiState = uiState;
        this.snapPreviewComputer = snapPreviewComputer;
        this.intersectionsComputer = intersectionsComputer;
    }

    compute() {
        const highlightedPoints = new Set();
        const highlightedLines = new Set();

        // Add UI hover highlights first
        const hoveredFromUI = this.uiState.getHoveredPointsFromUI();
        hoveredFromUI.forEach(idx => highlightedPoints.add(idx));

        // Add highlights based on interaction state
        const state = this.interactionState.getState();
        const stateType = state.type;

        if (stateType === 'idle' || stateType === 'draggingPoint' || 
            stateType === 'draggingNewPoint' || stateType === 'placingPoint') {
            const snapPreview = this.snapPreviewComputer.compute();
            this.addHighlightsFromSnap(snapPreview, highlightedPoints, highlightedLines);
        }

        if (stateType === 'drawingLine') {
            // Highlight start points
            if (state.data?.startPointIndices) {
                const points = this.configuration.getAllPoints();
                state.data.startPointIndices.forEach(idx => {
                    highlightedPoints.add(idx);
                    const point = points[idx];
                    if (point) {
                        point.onLines.forEach(lineIdx => highlightedLines.add(lineIdx));
                    }
                });
            }

            // Highlight endpoint snap
            const snapPreview = this.snapPreviewComputer.compute();
            this.addHighlightsFromSnap(snapPreview, highlightedPoints, highlightedLines);
        }

        return { points: highlightedPoints, lines: highlightedLines };
    }

    addHighlightsFromSnap(snapPreview, highlightedPoints, highlightedLines) {
        if (!snapPreview) return;

        const intersections = this.intersectionsComputer.compute();
        const points = this.configuration.getAllPoints();

        if (snapPreview.type === 'line') {
            highlightedLines.add(snapPreview.lineIndex);
        } else if (snapPreview.type === 'intersection') {
            snapPreview.lineIndices.forEach(idx => highlightedLines.add(idx));
        } else if (snapPreview.type === 'point') {
            highlightedPoints.add(snapPreview.pointIndex);
            const point = points[snapPreview.pointIndex];
            if (point) {
                point.onLines.forEach(idx => highlightedLines.add(idx));
            }
        }
    }
}

// derived/VisualOverlaysComputer.js
class VisualOverlaysComputer {
    constructor(interactionState, configuration, snapPreviewComputer, intersectionsComputer, transformState) {
        this.interactionState = interactionState;
        this.configuration = configuration;
        this.snapPreviewComputer = snapPreviewComputer;
        this.intersectionsComputer = intersectionsComputer;
        this.transformState = transformState;
    }

    compute() {
        const result = {
            ghostPoint: null,
            previewLine: null,
            lineIntersectionPreviews: []
        };

        const state = this.interactionState.getState();
        const stateType = state.type;

        if (stateType === 'draggingPoint') {
            const snapPreview = this.snapPreviewComputer.compute();
            const mousePos = this.interactionState.getMousePosition();
            
            if (snapPreview) {
                result.ghostPoint = {
                    x: snapPreview.x,
                    y: snapPreview.y,
                    pointIndex: state.data.pointIndex
                };
            } else if (mousePos) {
                result.ghostPoint = {
                    x: mousePos.worldX,
                    y: mousePos.worldY,
                    pointIndex: state.data.pointIndex
                };
            }
        } else if (stateType === 'draggingNewPoint') {
            const snapPreview = this.snapPreviewComputer.compute();
            const mousePos = this.interactionState.getMousePosition();
            
            if (snapPreview) {
                result.ghostPoint = {
                    x: snapPreview.x,
                    y: snapPreview.y,
                    pointIndex: -1
                };
            } else if (mousePos) {
                result.ghostPoint = {
                    x: mousePos.worldX,
                    y: mousePos.worldY,
                    pointIndex: -1
                };
            }
        } else if (stateType === 'drawingLine') {
            const mousePos = this.interactionState.getMousePosition();
            const mouseDown = this.interactionState.getMouseDownPosition();
            
            if (mousePos && mouseDown && state.data) {
                const dragDistance = Math.hypot(
                    mousePos.screenX - mouseDown.screenX,
                    mousePos.screenY - mouseDown.screenY
                );
                
                const linePreviewThreshold = 15;
                if (dragDistance > linePreviewThreshold) {
                    result.previewLine = {
                        startX: state.data.startX,
                        startY: state.data.startY,
                        endX: mousePos.worldX,
                        endY: mousePos.worldY
                    };
                }
            }
        }

        return result;
    }
}

// derived/MatroidComputer.js (simplified - just wraps the existing matroid logic)
class MatroidComputer {
    constructor(configuration, intersectionsComputer) {
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
    }

    compute() {
        const points = this.configuration.getAllPoints();
        const lines = this.configuration.getAllLines();

        if (points.length === 0) {
            return {
                rank: 0,
                numPoints: 0,
                numLines: 0,
                bases: [],
                circuits: [],
                flats: [[]]
            };
        }

        // For now, return basic stats - full matroid computation can be added later
        return {
            rank: this.computeRank(points, lines),
            numPoints: points.length,
            numLines: lines.length,
            bases: [],
            circuits: [],
            flats: []
        };
    }

    computeRank(points, lines) {
        if (points.length === 0) return 0;
        if (points.length === 1) return 1;
        if (points.length === 2) return 2;
        return 3; // Max rank in 2D
    }
}

// Export all classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Configuration,
        HistoryState,
        InteractionState,
        TransformState,
        UIState,
        GeometryUtils,
        IntersectionsComputer,
        SnapPreviewComputer,
        HighlightsComputer,
        VisualOverlaysComputer,
        MatroidComputer
    };
}


// ============================================================================
// VIEW LAYER - Presentation (renders based on state and derived)
// ============================================================================

// view/Renderer.js - Low-level drawing primitives
class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.gridSize = 30;
        this.pointRadius = 9;
        this.colorPalettes = {
            monochromatic: ['#957fef'],
            rainbow: [
                '#ff0000', '#00ffff', '#ff8800', '#0066ff', '#ffff00',
                '#bb00ff', '#88ff00', '#ff0088', '#00ff44', '#ff6699',
                '#00ccaa', '#ffaa00', '#4400ff', '#99ff66', '#cc0044',
                '#33ccff'
            ],
            pastel: [
                '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff',
                '#e0bbff', '#ffc9de', '#ffd6e8', '#c9f0ff', '#d5f4e6',
                '#fff5ba', '#e8d5c4', '#d5e8d4', '#f4e4d5', '#ffe5e5'
            ]
        };
        this.currentPalette = 'monochromatic';
    }

    setPalette(name) {
        if (this.colorPalettes[name]) {
            this.currentPalette = name;
        }
    }

    getLineColor(index) {
        const colors = this.colorPalettes[this.currentPalette];
        return colors[index % colors.length];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGridDots(bounds, scale) {
        if (scale < 0.3) return;

        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border').trim();
        this.ctx.fillStyle = borderColor;

        const startX = Math.floor(bounds.left / this.gridSize) * this.gridSize;
        const endX = Math.ceil(bounds.right / this.gridSize) * this.gridSize;
        const startY = Math.floor(bounds.top / this.gridSize) * this.gridSize;
        const endY = Math.ceil(bounds.bottom / this.gridSize) * this.gridSize;

        const maxDotsPerAxis = 200;
        const dotsX = (endX - startX) / this.gridSize;
        const dotsY = (endY - startY) / this.gridSize;

        if (dotsX > maxDotsPerAxis || dotsY > maxDotsPerAxis) return;

        for (let x = startX; x <= endX; x += this.gridSize) {
            for (let y = startY; y <= endY; y += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawPoints(points, highlightedPointIndices, skipPointIndex = undefined, intersections = []) {
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        // Group points by position
        const positionMap = new Map();
        points.forEach((point, index) => {
            if (index === skipPointIndex) return;
            const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
            if (!positionMap.has(key)) {
                positionMap.set(key, []);
            }
            positionMap.get(key).push(index);
        });

        positionMap.forEach((indices, key) => {
            const [x, y] = key.split(',').map(Number);
            const isMerged = indices.length > 1;
            const isHighlighted = indices.some(idx => highlightedPointIndices.has(idx));

            const radius = isMerged ? this.pointRadius + 2 : this.pointRadius;
            this.ctx.fillStyle = isHighlighted ? '#f9a826' : (isMerged ? '#45b7d1' : '#4ecdc4');

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();

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

            // Draw labels
            this.ctx.font = isMerged ? 'bold 14px ui-sans-serif, system-ui, sans-serif' : '14px ui-sans-serif, system-ui, sans-serif';
            this.ctx.textBaseline = 'bottom';

            if (isMerged) {
                const labelParts = [];
                indices.forEach((idx, i) => {
                    labelParts.push({
                        text: idx.toString(),
                        highlighted: highlightedPointIndices.has(idx)
                    });
                    if (i < indices.length - 1) {
                        labelParts.push({ text: ',', highlighted: false });
                    }
                });

                const totalText = indices.join(',');
                const totalWidth = this.ctx.measureText(totalText).width;
                let currentX = x - totalWidth / 2;
                
                labelParts.forEach(part => {
                    this.ctx.fillStyle = part.highlighted ? '#f9a826' : fgColor;
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(part.text, currentX, y - (radius + (isHighlighted ? 8 : 6)));
                    currentX += this.ctx.measureText(part.text).width;
                });
            } else {
                const label = indices[0].toString();
                this.ctx.fillStyle = isHighlighted ? '#f9a826' : fgColor;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(label, x, y - (radius + (isHighlighted ? 8 : 6)));
            }
        });
    }

    drawLines(lines, bounds, highlightedLineIndices, intersections, points, rayOpacity) {
        const margin = 1000;
        const worldBounds = {
            left: bounds.left - margin,
            right: bounds.right + margin,
            top: bounds.top - margin,
            bottom: bounds.bottom + margin
        };

        lines.forEach((line, index) => {
            const shouldHighlight = highlightedLineIndices.has(index);
            const strokeColor = shouldHighlight ? '#f9a826' : this.getLineColor(index);
            const lineWidth = shouldHighlight ? 2.1 : 1.4;

            const endpoints = GeometryUtils.getLineEndpoints(line.x, line.y, line.angle, worldBounds);
            if (!endpoints) return;

            // Find all points on this line
            const pointsOnLine = [];
            points.forEach((point, pointIndex) => {
                if (point.onLines && point.onLines.includes(index)) {
                    const dx = Math.cos(line.angle);
                    const dy = Math.sin(line.angle);
                    const vx = point.x - line.x;
                    const vy = point.y - line.y;
                    const t = vx * dx + vy * dy;
                    pointsOnLine.push({ x: point.x, y: point.y, t, pointIndex });
                }
            });

            pointsOnLine.sort((a, b) => a.t - b.t);

            if (pointsOnLine.length === 0) {
                this.ctx.globalAlpha = rayOpacity;
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = lineWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(endpoints.x1, endpoints.y1);
                this.ctx.lineTo(endpoints.x2, endpoints.y2);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            } else {
                // First ray
                this.ctx.globalAlpha = rayOpacity;
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = lineWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(endpoints.x1, endpoints.y1);
                this.ctx.lineTo(pointsOnLine[0].x, pointsOnLine[0].y);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;

                // Segments between points
                for (let i = 0; i < pointsOnLine.length - 1; i++) {
                    this.ctx.strokeStyle = strokeColor;
                    this.ctx.lineWidth = lineWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(pointsOnLine[i].x, pointsOnLine[i].y);
                    this.ctx.lineTo(pointsOnLine[i + 1].x, pointsOnLine[i + 1].y);
                    this.ctx.stroke();
                }

                // Last ray
                this.ctx.globalAlpha = rayOpacity;
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = lineWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(pointsOnLine[pointsOnLine.length - 1].x, pointsOnLine[pointsOnLine.length - 1].y);
                this.ctx.lineTo(endpoints.x2, endpoints.y2);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }
        });
    }

    drawPreviewLine(startX, startY, endX, endY, bounds) {
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);

        const margin = 1000;
        const worldBounds = {
            left: bounds.left - margin,
            right: bounds.right + margin,
            top: bounds.top - margin,
            bottom: bounds.bottom + margin
        };

        const endpoints = GeometryUtils.getLineEndpoints(startX, startY, angle, worldBounds);
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

    drawGhostPoint(ghost) {
        const { x, y, pointIndex } = ghost;
        const fgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-primary').trim();

        this.ctx.fillStyle = 'rgba(78, 205, 196, 0.6)';
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        if (pointIndex >= 0) {
            this.ctx.fillStyle = fgColor;
            this.ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(pointIndex.toString(), x, y - (this.pointRadius + 6));
        }
    }

    drawSnapPreview(snapPreview) {
        if (!snapPreview) return;

        const { x, y, type } = snapPreview;
        this.ctx.strokeStyle = '#45b7d1';
        this.ctx.fillStyle = 'rgba(69, 183, 209, 0.2)';
        this.ctx.lineWidth = 2;

        const radius = type === 'intersection' ? this.pointRadius + 4 : this.pointRadius + 2;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

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

    drawIntersectionPreview(intersection) {
        if (!intersection) return;

        const { x, y, type } = intersection;
        this.ctx.strokeStyle = 'rgba(69, 183, 209, 0.5)';
        this.ctx.fillStyle = 'rgba(69, 183, 209, 0.1)';
        this.ctx.lineWidth = 1.5;

        const radius = type === 'intersection' ? this.pointRadius + 2 : this.pointRadius;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

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
}

// view/CanvasView.js - Main canvas renderer
class CanvasView {
    constructor(canvas, configuration, interactionState, transformState, uiState,
                intersectionsComputer, highlightsComputer, visualOverlaysComputer, snapPreviewComputer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.transformState = transformState;
        this.uiState = uiState;
        this.intersectionsComputer = intersectionsComputer;
        this.highlightsComputer = highlightsComputer;
        this.visualOverlaysComputer = visualOverlaysComputer;
        this.snapPreviewComputer = snapPreviewComputer;
        this.renderer = new Renderer(canvas, this.ctx);

        this.setupResizeObserver();
    }

    setupResizeObserver() {
        const resizeCanvas = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.transformState.setCanvasSize(this.canvas.width, this.canvas.height);
            this.transformState.centerOrigin();
            this.render();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const resizeObserver = new ResizeObserver(() => {
            resizeCanvas();
        });
        resizeObserver.observe(this.canvas.parentElement);
    }

    render() {
        // Clear canvas
        this.renderer.clear();

        // Save context and apply transform
        this.ctx.save();
        this.ctx.translate(this.transformState.getOffsetX(), this.transformState.getOffsetY());
        this.ctx.scale(this.transformState.getScale(), this.transformState.getScale());

        // Get viewport bounds
        const viewportBounds = this.transformState.getViewportBounds();

        // Compute derived state
        const intersections = this.intersectionsComputer.compute();
        const highlights = this.highlightsComputer.compute();
        const overlays = this.visualOverlaysComputer.compute();
        const snapPreview = this.snapPreviewComputer.compute();

        // Set color palette
        this.renderer.setPalette(this.uiState.getColorPalette());

        // Draw grid
        this.renderer.drawGridDots(viewportBounds, this.transformState.getScale());

        // Draw lines
        const lines = this.configuration.getAllLines();
        const points = this.configuration.getAllPoints();
        const rayOpacity = this.uiState.getRayOpacity();

        this.renderer.drawLines(lines, viewportBounds, highlights.lines, intersections, points, rayOpacity);

        // Draw preview line
        if (overlays.previewLine) {
            this.renderer.drawPreviewLine(
                overlays.previewLine.startX,
                overlays.previewLine.startY,
                overlays.previewLine.endX,
                overlays.previewLine.endY,
                viewportBounds
            );
        }

        // Draw line intersection previews
        if (overlays.lineIntersectionPreviews) {
            overlays.lineIntersectionPreviews.forEach(preview => {
                this.renderer.drawIntersectionPreview(preview);
            });
        }

        // Draw snap preview (for point mode)
        const mode = this.interactionState.getMode();
        if (mode === 'point' && snapPreview) {
            this.renderer.drawSnapPreview(snapPreview);
        }

        // Draw ghost point
        if (overlays.ghostPoint) {
            this.renderer.drawGhostPoint(overlays.ghostPoint);
        }

        // Draw points
        this.renderer.drawPoints(points, highlights.points, overlays.ghostPoint?.pointIndex, intersections);

        // Restore context
        this.ctx.restore();
    }
}

// view/StatsView.js - Stats panel renderer
class StatsView {
    constructor(element, matroidComputer, uiState, onItemHoverCallback, onItemUnhoverCallback) {
        this.element = element;
        this.matroidComputer = matroidComputer;
        this.uiState = uiState;
        this.onItemHoverCallback = onItemHoverCallback;
        this.onItemUnhoverCallback = onItemUnhoverCallback;
    }

    render() {
        const currentView = this.uiState.getCurrentStatsView();
        const matroid = this.matroidComputer.compute();

        if (matroid.numPoints === 0) {
            this.element.innerHTML = '<div class="empty-state">add points and lines to see matroid properties</div>';
            return;
        }

        if (currentView === 'general') {
            this.renderGeneral(matroid);
        } else if (currentView === 'bases') {
            this.renderBases(matroid.bases);
        } else if (currentView === 'circuits') {
            this.renderCircuits(matroid.circuits);
        } else if (currentView === 'flats') {
            this.renderFlats(matroid.flats);
        }

        this.attachHoverListeners();
    }

    renderGeneral(matroid) {
        const html = `
            <div style="font-size: 14px; line-height: 1.8;">
                <div style="margin-bottom: 12px;">
                    <strong>Rank:</strong> ${matroid.rank}
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Points:</strong> ${matroid.numPoints}
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Lines:</strong> ${matroid.numLines}
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Bases:</strong> ${matroid.bases.length}
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Circuits:</strong> ${matroid.circuits.length}
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Flats:</strong> ${matroid.flats.length}
                </div>
            </div>
        `;
        this.element.innerHTML = html;
    }

    renderBases(bases) {
        const pagination = this.uiState.getStatsPagination('bases');
        const visible = bases.slice(0, pagination.offset + pagination.batchSize);

        const html = `
            <div style="font-size: 14px;">
                ${visible.map((base, i) => `
                    <div class="matroid-item" data-points="${base.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer;">
                        <strong>${i + 1}.</strong> {${base.join(', ')}}
                    </div>
                `).join('')}
                <div style="margin-top: 12px; text-align: center; color: var(--fg-secondary); font-size: 13px;">
                    Showing ${visible.length} of ${bases.length} bases
                </div>
            </div>
        `;
        this.element.innerHTML = html;
    }

    renderCircuits(circuits) {
        const pagination = this.uiState.getStatsPagination('circuits');
        const visible = circuits.slice(0, pagination.offset + pagination.batchSize);

        const html = `
            <div style="font-size: 14px;">
                ${visible.map((circuit, i) => `
                    <div class="matroid-item" data-points="${circuit.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer;">
                        <strong>${i + 1}.</strong> {${circuit.join(', ')}}
                    </div>
                `).join('')}
                <div style="margin-top: 12px; text-align: center; color: var(--fg-secondary); font-size: 13px;">
                    Showing ${visible.length} of ${circuits.length} circuits
                </div>
            </div>
        `;
        this.element.innerHTML = html;
    }

    renderFlats(flats) {
        const pagination = this.uiState.getStatsPagination('flats');
        const visible = flats.slice(0, pagination.offset + pagination.batchSize);

        const html = `
            <div style="font-size: 14px;">
                ${visible.map((flat, i) => `
                    <div class="matroid-item" data-points="${flat.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer;">
                        <strong>${i + 1}.</strong> {${flat.join(', ')}}
                    </div>
                `).join('')}
                <div style="margin-top: 12px; text-align: center; color: var(--fg-secondary); font-size: 13px;">
                    Showing ${visible.length} of ${flats.length} flats
                </div>
            </div>
        `;
        this.element.innerHTML = html;
    }

    attachHoverListeners() {
        const items = this.element.querySelectorAll('.matroid-item');
        items.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const pointsStr = item.getAttribute('data-points');
                if (pointsStr) {
                    const pointIndices = pointsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    this.onItemHoverCallback(pointIndices);
                }
            });

            item.addEventListener('mouseleave', () => {
                this.onItemUnhoverCallback();
            });
        });
    }
}

// view/DebugMenuView.js - Debug panel renderer
class DebugMenuView {
    constructor(element, configuration, intersectionsComputer, onAddPointCallback, 
                onAddLineCallback, onExportCallback, onClearCallback) {
        this.element = element;
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
        this.onAddPointCallback = onAddPointCallback;
        this.onAddLineCallback = onAddLineCallback;
        this.onExportCallback = onExportCallback;
        this.onClearCallback = onClearCallback;
        this.isVisible = false;
    }

    show() {
        this.isVisible = true;
        this.element.style.display = 'block';
        this.element.offsetHeight; // Force reflow
        this.element.classList.add('expanded');
    }

    hide() {
        this.isVisible = false;
        this.element.classList.remove('expanded');
        setTimeout(() => {
            if (!this.isVisible) {
                this.element.style.display = 'none';
            }
        }, 300);
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    render() {
        this.updatePointsList();
        this.updateLinesList();
    }

    updatePointsList() {
        const listEl = document.getElementById('debugPointsList');
        if (!listEl) return;

        const points = this.configuration.getAllPoints();
        if (points.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no points yet</div>';
            return;
        }

        const html = points.map((point, idx) => {
            const linesStr = point.onLines.length > 0 ? `[${point.onLines.join(', ')}]` : '[]';
            return `<div style="padding: 4px 8px; border-bottom: 1px solid var(--border);">
                <strong>Point ${idx}:</strong> (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) on lines ${linesStr}
            </div>`;
        }).join('');

        listEl.innerHTML = html;
    }

    updateLinesList() {
        const listEl = document.getElementById('debugLinesList');
        if (!listEl) return;

        const lines = this.configuration.getAllLines();
        if (lines.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no lines yet</div>';
            return;
        }

        const points = this.configuration.getAllPoints();
        const html = lines.map((line, lineIdx) => {
            const pointsOnLine = [];
            points.forEach((point, pointIdx) => {
                if (point.onLines.includes(lineIdx)) {
                    pointsOnLine.push(pointIdx);
                }
            });

            const pointsStr = pointsOnLine.length > 0 ? `[${pointsOnLine.join(', ')}]` : '[]';
            return `<div style="padding: 4px 8px; border-bottom: 1px solid var(--border);">
                <strong>Line ${lineIdx}:</strong> through points ${pointsStr}
            </div>`;
        }).join('');

        listEl.innerHTML = html;
    }
}

// ============================================================================
// CONTROLLER LAYER - Input handlers (modify state)
// ============================================================================

// controller/InteractionController.js - Handle mouse/touch input
class InteractionController {
    constructor(canvas, configuration, interactionState, transformState, 
                historyController, snapPreviewComputer, intersectionsComputer) {
        this.canvas = canvas;
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.transformState = transformState;
        this.historyController = historyController;
        this.snapPreviewComputer = snapPreviewComputer;
        this.intersectionsComputer = intersectionsComputer;
        this.clickThreshold = 'ontouchstart' in window ? 8 : 5;
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });
    }

    getEventCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const world = this.transformState.screenToWorld(screenX, screenY);

        return { worldX: world.x, worldY: world.y, screenX, screenY };
    }

    handleMouseDown(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        this.interactionState.setMouseDownPosition(worldX, worldY, screenX, screenY, Date.now());
        this.interactionState.setMousePosition(worldX, worldY, screenX, screenY);

        const mode = this.interactionState.getMode();

        if (mode === 'line') {
            this.handleLineModeMouseDown(worldX, worldY, screenX, screenY);
        } else {
            this.handlePointModeMouseDown(worldX, worldY, screenX, screenY);
        }
    }

    handlePointModeMouseDown(worldX, worldY, screenX, screenY) {
        const pointsAtPosition = this.configuration.getPointsAtPosition(
            worldX, 
            worldY, 
            18 / this.transformState.getScale()
        );

        if (pointsAtPosition.length > 0) {
            const pointIndex = pointsAtPosition.length === 1 ? pointsAtPosition[0] : Math.max(...pointsAtPosition);
            const originalPoint = this.configuration.getPoint(pointIndex);
            this.interactionState.transitionTo('draggingPoint', {
                pointIndex,
                originalX: originalPoint.x,
                originalY: originalPoint.y
            });
        } else {
            this.interactionState.transitionTo('draggingNewPoint', {
                startWorldX: worldX,
                startWorldY: worldY
            });
        }
    }

    handleLineModeMouseDown(worldX, worldY, screenX, screenY) {
        const pointsAtPosition = this.configuration.getPointsAtPosition(
            worldX,
            worldY,
            18 / this.transformState.getScale()
        );

        let startX = worldX;
        let startY = worldY;
        let startPointIndices = null;

        if (pointsAtPosition.length > 0) {
            const point = this.configuration.getPoint(pointsAtPosition[0]);
            startX = point.x;
            startY = point.y;
            startPointIndices = [...pointsAtPosition];
        }

        this.interactionState.transitionTo('drawingLine', {
            startX,
            startY,
            startPointIndices
        });
    }

    handleMouseMove(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);
        this.interactionState.setMousePosition(worldX, worldY, screenX, screenY);

        const state = this.interactionState.getState();

        if (state.type === 'panning') {
            const mouseDown = this.interactionState.getMouseDownPosition();
            const dx = screenX - mouseDown.screenX;
            const dy = screenY - mouseDown.screenY;
            this.transformState.setPan(
                state.data.startOffsetX + dx,
                state.data.startOffsetY + dy
            );
        } else if (state.type === 'placingPoint') {
            const mouseDown = this.interactionState.getMouseDownPosition();
            const dragDist = Math.hypot(screenX - mouseDown.screenX, screenY - mouseDown.screenY);
            
            if (dragDist > this.clickThreshold) {
                this.interactionState.transitionTo('panning', {
                    startOffsetX: state.data.startOffsetX,
                    startOffsetY: state.data.startOffsetY
                });
            }
        }
    }

    handleMouseUp(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);
        this.interactionState.setMousePosition(worldX, worldY, screenX, screenY);

        const state = this.interactionState.getState();
        const mouseDown = this.interactionState.getMouseDownPosition();
        const isClick = mouseDown && Math.hypot(
            screenX - mouseDown.screenX,
            screenY - mouseDown.screenY
        ) <= this.clickThreshold;

        if (state.type === 'drawingLine') {
            const dragDistance = mouseDown ? Math.hypot(
                screenX - mouseDown.screenX,
                screenY - mouseDown.screenY
            ) : 0;
            const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);

            if (dragDistance > linePreviewThreshold) {
                const snapPreview = this.snapPreviewComputer.compute();
                let endX = worldX;
                let endY = worldY;
                let endPointIndices = null;

                if (snapPreview && snapPreview.type === 'point') {
                    endX = snapPreview.x;
                    endY = snapPreview.y;
                    endPointIndices = [snapPreview.pointIndex];
                }

                const dx = endX - state.data.startX;
                const dy = endY - state.data.startY;
                const angle = Math.atan2(dy, dx);

                const lineIndex = this.configuration.addLine(state.data.startX, state.data.startY, angle);
                
                // Update point line memberships
                const allPointIndices = new Set();
                if (state.data.startPointIndices) {
                    state.data.startPointIndices.forEach(idx => allPointIndices.add(idx));
                }
                if (endPointIndices) {
                    endPointIndices.forEach(idx => allPointIndices.add(idx));
                }

                allPointIndices.forEach(pointIndex => {
                    const point = this.configuration.getPoint(pointIndex);
                    if (!point.onLines.includes(lineIndex)) {
                        point.onLines.push(lineIndex);
                    }
                });

                this.historyController.recordAddLine(lineIndex, { x: state.data.startX, y: state.data.startY, angle }, []);
            }
        } else if (state.type === 'draggingPoint') {
            if (!isClick) {
                const snapPreview = this.snapPreviewComputer.compute();
                const point = this.configuration.getPoint(state.data.pointIndex);
                const oldState = { x: state.data.originalX, y: state.data.originalY, onLines: [...point.onLines] };

                if (snapPreview) {
                    point.x = snapPreview.x;
                    point.y = snapPreview.y;
                    if (snapPreview.type === 'line') {
                        point.onLines = [snapPreview.lineIndex];
                    } else if (snapPreview.type === 'point') {
                        const targetPoint = this.configuration.getPoint(snapPreview.pointIndex);
                        point.onLines = [...targetPoint.onLines];
                    }
                } else {
                    point.x = worldX;
                    point.y = worldY;
                    point.onLines = [];
                }

                const newState = { x: point.x, y: point.y, onLines: [...point.onLines] };
                this.historyController.recordMovePoint(state.data.pointIndex, oldState, newState);
                this.configuration.notify({ type: 'pointUpdated', index: state.data.pointIndex, point });
            }
        } else if (state.type === 'draggingNewPoint') {
            const snapPreview = this.snapPreviewComputer.compute();
            
            if (isClick) {
                if (snapPreview) {
                    if (snapPreview.type === 'line') {
                        this.configuration.addPoint(snapPreview.x, snapPreview.y, [snapPreview.lineIndex]);
                    } else if (snapPreview.type === 'point') {
                        // Merge with existing point - don't add
                    } else {
                        this.configuration.addPoint(state.data.startWorldX, state.data.startWorldY, []);
                    }
                } else {
                    this.configuration.addPoint(state.data.startWorldX, state.data.startWorldY, []);
                }
            } else {
                if (snapPreview) {
                    if (snapPreview.type === 'line') {
                        this.configuration.addPoint(snapPreview.x, snapPreview.y, [snapPreview.lineIndex]);
                    } else if (snapPreview.type === 'point') {
                        // Don't add - would merge
                    } else {
                        this.configuration.addPoint(worldX, worldY, []);
                    }
                } else {
                    this.configuration.addPoint(worldX, worldY, []);
                }
            }
        }

        this.interactionState.clearMousePosition();
        this.interactionState.transitionTo('idle');
    }

    handleMouseLeave(e) {
        this.interactionState.clearMousePosition();
        if (this.interactionState.getStateType() !== 'idle') {
            this.handleMouseUp(e);
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomX = this.canvas.width / 2;
        const zoomY = this.canvas.height / 2;
        const zoomSpeed = 0.005;
        const zoomAmount = -e.deltaY * zoomSpeed;
        const scaleFactor = 1 + zoomAmount;
        this.transformState.zoomAt(zoomX, zoomY, scaleFactor);
    }

    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.handleMouseDown(e);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.handleMouseMove(e);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.handleMouseUp(e);
        this.interactionState.clearMousePosition();
    }

    handleTouchCancel(e) {
        e.preventDefault();
        this.handleMouseLeave(e);
    }
}

// controller/HistoryController.js - Execute undo/redo
class HistoryController {
    constructor(historyState, configuration, intersectionsComputer) {
        this.historyState = historyState;
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
    }

    recordAddPoint(index, point) {
        this.historyState.push({
            type: 'addPoint',
            data: { index, point: { x: point.x, y: point.y, onLines: [...point.onLines] } }
        });
    }

    recordRemovePoint(index, point) {
        this.historyState.push({
            type: 'removePoint',
            data: { index, point: { x: point.x, y: point.y, onLines: [...point.onLines] } }
        });
    }

    recordAddLine(index, line, affectedPoints) {
        this.historyState.push({
            type: 'addLine',
            data: { index, line: { ...line }, affectedPoints }
        });
    }

    recordRemoveLine(index, line, affectedPoints) {
        this.historyState.push({
            type: 'removeLine',
            data: { index, line: { ...line }, affectedPoints }
        });
    }

    recordMovePoint(index, oldState, newState) {
        this.historyState.push({
            type: 'movePoint',
            data: { index, oldState, newState }
        });
    }

    undo() {
        if (!this.historyState.canUndo()) return false;

        const action = this.historyState.getUndoAction();
        
        if (action.type === 'addPoint') {
            this.configuration.removePoint(action.data.index);
        } else if (action.type === 'addLine') {
            this.configuration.removeLine(action.data.index);
        } else if (action.type === 'movePoint') {
            const point = this.configuration.getPoint(action.data.index);
            Object.assign(point, action.data.oldState);
            this.configuration.notify({ type: 'pointUpdated', index: action.data.index, point });
        }

        this.historyState.moveBackward();
        return true;
    }

    redo() {
        if (!this.historyState.canRedo()) return false;

        const action = this.historyState.getRedoAction();
        
        if (action.type === 'addPoint') {
            this.configuration.addPoint(action.data.point.x, action.data.point.y, action.data.point.onLines);
        } else if (action.type === 'addLine') {
            this.configuration.addLine(action.data.line.x, action.data.line.y, action.data.line.angle);
        } else if (action.type === 'movePoint') {
            const point = this.configuration.getPoint(action.data.index);
            Object.assign(point, action.data.newState);
            this.configuration.notify({ type: 'pointUpdated', index: action.data.index, point });
        }

        this.historyState.moveForward();
        return true;
    }

    canUndo() {
        return this.historyState.canUndo();
    }

    canRedo() {
        return this.historyState.canRedo();
    }
}

// controller/OperationsController.js - Complex operations
class OperationsController {
    constructor(configuration, intersectionsComputer, transformState, historyController) {
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
        this.transformState = transformState;
        this.historyController = historyController;
    }

    removeNonEssentialLines() {
        const points = this.configuration.getAllPoints();
        const lines = this.configuration.getAllLines();
        const pointsPerLine = new Array(lines.length).fill(0);

        points.forEach(point => {
            point.onLines.forEach(lineIndex => {
                pointsPerLine[lineIndex]++;
            });
        });

        const linesToRemove = new Set();
        for (let i = 0; i < lines.length; i++) {
            if (pointsPerLine[i] < 3) {
                linesToRemove.add(i);
            }
        }

        if (linesToRemove.size === 0) {
            console.log('No non-essential lines to remove');
            return;
        }

        const indexMap = new Map();
        let newIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (!linesToRemove.has(i)) {
                indexMap.set(i, newIndex);
                newIndex++;
            }
        }

        // Remove lines in reverse order
        Array.from(linesToRemove).sort((a, b) => b - a).forEach(i => {
            this.configuration.removeLine(i);
        });

        console.log('Removed', linesToRemove.size, 'non-essential lines');
    }

    addIntersectionPoints() {
        const viewportBounds = this.transformState.getViewportBounds();
        const intersections = this.intersectionsComputer.compute();
        let addedCount = 0;

        for (let i = 0; i < intersections.length; i++) {
            const intersection = intersections[i];

            if (intersection.x < viewportBounds.left || intersection.x > viewportBounds.right ||
                intersection.y < viewportBounds.top || intersection.y > viewportBounds.bottom) {
                continue;
            }

            const existingPoints = this.configuration.getPointsAtPosition(intersection.x, intersection.y, 1);

            if (existingPoints.length === 0) {
                this.configuration.addPoint(intersection.x, intersection.y, [...intersection.lineIndices]);
                addedCount++;
            }
        }

        console.log('Added', addedCount, 'intersection points');
    }

    clearAll() {
        if (confirm('Clear all points and lines?')) {
            this.configuration.clear();
        }
    }

    async loadExample(exampleName) {
        try {
            const response = await fetch('src/examples/examples.json');
            const examples = await response.json();
            const config = examples[exampleName];
            
            if (!config) throw new Error(`Configuration '${exampleName}' not found`);

            this.configuration.clear();

            config.points.forEach(([x, y, onLines]) => {
                this.configuration.addPoint(x, y, onLines);
            });

            // Compute lines from points
            const linePoints = new Map();
            const points = this.configuration.getAllPoints();
            points.forEach((point, idx) => {
                point.onLines.forEach(lineIdx => {
                    if (!linePoints.has(lineIdx)) linePoints.set(lineIdx, []);
                    linePoints.get(lineIdx).push(idx);
                });
            });

            linePoints.forEach((pointIndices, lineIdx) => {
                if (pointIndices.length < 2) return;
                const p1 = points[pointIndices[0]];
                const p2 = points[pointIndices[1]];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                this.configuration.addLine(p1.x, p1.y, angle);
            });

            console.log(`✅ Loaded ${config.name}`);
            return true;
        } catch (e) {
            console.error('Failed to load configuration:', e);
            return false;
        }
    }

    exportImage(canvas) {
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `configuration-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    exportConfiguration() {
        const data = this.configuration.serialize();
        const json = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            alert('Configuration copied to clipboard!');
        }).catch(() => {
            console.log('Configuration:', json);
            alert('Check console for configuration.');
        });
    }
}

// controller/UIController.js - Handle UI interactions
class UIController {
    constructor(uiState, interactionState, historyController, operationsController, debugMenuView) {
        this.uiState = uiState;
        this.interactionState = interactionState;
        this.historyController = historyController;
        this.operationsController = operationsController;
        this.debugMenuView = debugMenuView;
    }

    setupAllControls() {
        this.setupModeSwitch();
        this.setupColorPalette();
        this.setupRayOpacity();
        this.setupHistoryButtons();
        this.setupStatsPanel();
        this.setupDebugMenu();
        this.setupLibrary();
        this.setupOptionsPanel();
    }

    setupModeSwitch() {
        const pointBtn = document.getElementById('pointBtn');
        const lineBtn = document.getElementById('lineBtn');
        const indicator = document.getElementById('switchIndicator');

        const updateIndicator = (mode) => {
            if (mode === 'point') {
                indicator.style.width = pointBtn.offsetWidth + 'px';
                indicator.style.transform = 'translateX(0)';
                pointBtn.classList.add('active');
                lineBtn.classList.remove('active');
            } else {
                indicator.style.width = lineBtn.offsetWidth + 'px';
                indicator.style.transform = `translateX(${pointBtn.offsetWidth}px)`;
                lineBtn.classList.add('active');
                pointBtn.classList.remove('active');
            }
        };

        pointBtn.addEventListener('click', () => {
            this.interactionState.setMode('point');
            updateIndicator('point');
        });

        lineBtn.addEventListener('click', () => {
            this.interactionState.setMode('line');
            updateIndicator('line');
        });

        updateIndicator('point');
    }

    setupColorPalette() {
        const monoBtn = document.getElementById('monoBtn');
        const rainbowBtn = document.getElementById('rainbowBtn');
        const pastelBtn = document.getElementById('pastelBtn');
        const indicator = document.getElementById('paletteSwitchIndicator');

        const updateIndicator = (palette) => {
            const buttons = [monoBtn, rainbowBtn, pastelBtn];
            const palettes = ['monochromatic', 'rainbow', 'pastel'];
            const index = palettes.indexOf(palette);
            
            buttons.forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });

            const width = buttons[index].offsetWidth;
            const offset = buttons.slice(0, index).reduce((sum, btn) => sum + btn.offsetWidth, 0);
            indicator.style.width = width + 'px';
            indicator.style.transform = `translateX(${offset}px)`;
        };

        monoBtn.addEventListener('click', () => {
            this.uiState.setColorPalette('monochromatic');
            updateIndicator('monochromatic');
        });

        rainbowBtn.addEventListener('click', () => {
            this.uiState.setColorPalette('rainbow');
            updateIndicator('rainbow');
        });

        pastelBtn.addEventListener('click', () => {
            this.uiState.setColorPalette('pastel');
            updateIndicator('pastel');
        });

        updateIndicator('monochromatic');
    }

    setupRayOpacity() {
        const slider = document.getElementById('rayOpacitySlider');
        const valueDisplay = document.getElementById('rayOpacityValue');

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.uiState.setRayOpacity(value);
            valueDisplay.textContent = Math.round(value * 100) + '%';
        });
    }

    setupHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        undoBtn.addEventListener('click', () => {
            this.historyController.undo();
            this.updateHistoryButtons();
        });

        redoBtn.addEventListener('click', () => {
            this.historyController.redo();
            this.updateHistoryButtons();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.historyController.undo();
                this.updateHistoryButtons();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.historyController.redo();
                this.updateHistoryButtons();
            }
        });

        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        undoBtn.disabled = !this.historyController.canUndo();
        redoBtn.disabled = !this.historyController.canRedo();

        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }

    setupStatsPanel() {
        const trigger = document.getElementById('dropdownTrigger');
        const content = document.getElementById('dropdownContent');
        const items = content.querySelectorAll('.dropdown-item');

        trigger.addEventListener('click', () => {
            const isOpen = content.classList.contains('open');
            content.classList.toggle('open');
            trigger.classList.toggle('open');
        });

        items.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-value');
                this.uiState.setCurrentStatsView(view);
                document.getElementById('dropdownLabel').textContent = view;
                content.classList.remove('open');
                trigger.classList.remove('open');
            });
        });
    }

    setupDebugMenu() {
        const debugBtn = document.getElementById('debugBtn');
        debugBtn.addEventListener('click', () => {
            this.debugMenuView.toggle();
        });
    }

    setupLibrary() {
        const libraryBtn = document.getElementById('libraryBtn');
        const modal = document.getElementById('examplesModal');
        const closeBtn = document.getElementById('closeModal');

        libraryBtn.addEventListener('click', () => {
            modal.classList.add('active');
            this.loadExamples();
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    async loadExamples() {
        try {
            const response = await fetch('src/examples/examples.json');
            const examples = await response.json();
            const grid = document.getElementById('examplesGrid');

            grid.innerHTML = Object.entries(examples).map(([key, config]) => `
                <div class="example-card" data-example="${key}">
                    <div class="example-name">${config.name}</div>
                </div>
            `).join('');

            grid.querySelectorAll('.example-card').forEach(card => {
                card.addEventListener('click', () => {
                    const exampleName = card.getAttribute('data-example');
                    this.operationsController.loadExample(exampleName);
                    document.getElementById('examplesModal').classList.remove('active');
                });
            });
        } catch (e) {
            console.error('Failed to load examples:', e);
        }
    }

    setupOptionsPanel() {
        const optionsBtn = document.getElementById('optionsBtn');
        const optionsPanel = document.getElementById('optionsPanel');

        optionsBtn.addEventListener('click', () => {
            const isVisible = optionsPanel.style.display === 'block';
            if (isVisible) {
                optionsPanel.classList.remove('expanded');
                setTimeout(() => {
                    optionsPanel.style.display = 'none';
                }, 300);
            } else {
                optionsPanel.style.display = 'block';
                optionsPanel.offsetHeight;
                optionsPanel.classList.add('expanded');
            }
        });

        // Setup action buttons
        document.getElementById('cleanBtn').addEventListener('click', () => {
            this.operationsController.removeNonEssentialLines();
        });

        document.getElementById('addIntersectionsBtn').addEventListener('click', () => {
            this.operationsController.addIntersectionPoints();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.operationsController.clearAll();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            const canvas = document.getElementById('canvas');
            this.operationsController.exportImage(canvas);
        });
    }

    onStatsItemHover(pointIndices) {
        this.uiState.setHoveredPointsFromUI(pointIndices);
    }

    onStatsItemUnhover() {
        this.uiState.clearHoveredPointsFromUI();
    }
}

// Export all classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Renderer,
        CanvasView,
        StatsView,
        DebugMenuView,
        InteractionController,
        HistoryController,
        OperationsController,
        UIController
    };
}


// ============================================================================
// APPLICATION WIRING - Creates all instances and coordinates rendering
// ============================================================================

class PointConfigurationApp {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found`);
        }

        // Create all state instances
        this.configuration = new Configuration();
        this.historyState = new HistoryState();
        this.interactionState = new InteractionState();
        this.transformState = new TransformState();
        this.uiState = new UIState();

        // Create derived instances (pass state references)
        this.intersectionsComputer = new IntersectionsComputer(
            this.configuration
        );

        this.snapPreviewComputer = new SnapPreviewComputer(
            this.configuration,
            this.interactionState,
            this.intersectionsComputer,
            this.transformState
        );

        this.highlightsComputer = new HighlightsComputer(
            this.configuration,
            this.interactionState,
            this.uiState,
            this.snapPreviewComputer,
            this.intersectionsComputer
        );

        this.visualOverlaysComputer = new VisualOverlaysComputer(
            this.interactionState,
            this.configuration,
            this.snapPreviewComputer,
            this.intersectionsComputer,
            this.transformState
        );

        this.matroidComputer = new MatroidComputer(
            this.configuration,
            this.intersectionsComputer
        );

        // Create controller instances (they need to exist before views for callbacks)
        this.historyController = new HistoryController(
            this.historyState,
            this.configuration,
            this.intersectionsComputer
        );

        this.operationsController = new OperationsController(
            this.configuration,
            this.intersectionsComputer,
            this.transformState,
            this.historyController
        );

        // Create view instances
        this.canvasView = new CanvasView(
            this.canvas,
            this.configuration,
            this.interactionState,
            this.transformState,
            this.uiState,
            this.intersectionsComputer,
            this.highlightsComputer,
            this.visualOverlaysComputer,
            this.snapPreviewComputer
        );

        this.statsView = new StatsView(
            document.getElementById('panelContent'),
            this.matroidComputer,
            this.uiState,
            (pointIndices) => this.uiController.onStatsItemHover(pointIndices),
            () => this.uiController.onStatsItemUnhover()
        );

        this.debugMenuView = new DebugMenuView(
            document.getElementById('debugPanel'),
            this.configuration,
            this.intersectionsComputer,
            (x, y, onLines) => this.addPointManual(x, y, onLines),
            (pointIndices) => this.addLineManual(pointIndices),
            () => this.operationsController.exportConfiguration(),
            () => this.operationsController.clearAll()
        );

        // Create interaction controller
        this.interactionController = new InteractionController(
            this.canvas,
            this.configuration,
            this.interactionState,
            this.transformState,
            this.historyController,
            this.snapPreviewComputer,
            this.intersectionsComputer
        );

        // Create UI controller
        this.uiController = new UIController(
            this.uiState,
            this.interactionState,
            this.historyController,
            this.operationsController,
            this.debugMenuView
        );

        // Setup observers (wire state changes to rendering)
        this.setupObservers();

        // Setup event listeners
        this.interactionController.setupEventListeners();
        this.uiController.setupAllControls();

        // Setup debug menu form handlers
        this.setupDebugMenuHandlers();

        // Initialize
        this.transformState.centerOrigin();
        this.loadFromURL();
        this.render();
    }

    // ========================================================================
    // Observer Setup - Wire state changes to rendering
    // ========================================================================

    setupObservers() {
        // Configuration changes → re-render and update URL
        this.configuration.subscribe((event) => {
            this.onConfigurationChanged(event);
        });

        // Interaction state changes → re-render canvas
        this.interactionState.subscribe(() => {
            this.onInteractionStateChanged();
        });

        // Transform changes → re-render canvas
        this.transformState.subscribe(() => {
            this.onTransformStateChanged();
        });

        // UI state changes → re-render both canvas and stats
        this.uiState.subscribe(() => {
            this.onUIStateChanged();
        });

        // History state changes → update UI buttons
        this.historyState.subscribe(() => {
            this.onHistoryStateChanged();
        });
    }

    // ========================================================================
    // Observer Handlers
    // ========================================================================

    onConfigurationChanged(event) {
        console.log('Configuration changed:', event.type);
        
        // Update URL with new configuration (debounced)
        this.updateURL();
        
        // Re-render everything
        this.render();
        
        // Update debug menu if visible
        if (this.debugMenuView.isVisible) {
            this.debugMenuView.render();
        }
    }

    onInteractionStateChanged() {
        // Re-render canvas (interaction affects overlays and highlights)
        this.canvasView.render();
    }

    onTransformStateChanged() {
        // Re-render canvas (transform affects what's visible)
        this.canvasView.render();
    }

    onUIStateChanged() {
        // Re-render both canvas and stats (UI affects both)
        this.canvasView.render();
        this.statsView.render();
    }

    onHistoryStateChanged() {
        // Update undo/redo button states
        this.uiController.updateHistoryButtons();
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    render() {
        // Render canvas
        this.canvasView.render();
        
        // Render stats panel
        this.statsView.render();
    }

    // ========================================================================
    // URL Management (for shareable configurations)
    // ========================================================================

    loadFromURL() {
        const hash = window.location.hash.slice(1); // Remove #
        if (hash) {
            try {
                const decoded = this.decodeFromURL(hash);
                if (decoded) {
                    this.configuration.deserialize(decoded);
                    // Clear history after loading
                    this.historyState.clear();
                    console.log('✅ Loaded configuration from URL');
                }
            } catch (e) {
                console.error('Failed to load from URL:', e);
            }
        }
    }

    updateURL() {
        // Debounce to avoid updating too frequently
        clearTimeout(this._urlUpdateTimeout);
        this._urlUpdateTimeout = setTimeout(() => {
            try {
                const serialized = this.configuration.serialize();
                const encoded = this.encodeForURL(serialized);
                const newURL = `${window.location.pathname}#${encoded}`;
                window.history.replaceState(null, '', newURL);
            } catch (e) {
                console.error('Failed to update URL:', e);
            }
        }, 500);
    }

    encodeForURL(data) {
        // Simple base64 encoding for now (could use compression like pako later)
        const jsonStr = JSON.stringify(data);
        return btoa(jsonStr)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    decodeFromURL(encoded) {
        try {
            // Convert base64url to base64
            let base64 = encoded
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }

            const jsonStr = atob(base64);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to decode URL:', e);
            return null;
        }
    }

    getShareableURL() {
        const serialized = this.configuration.serialize();
        const encoded = this.encodeForURL(serialized);
        return `${window.location.origin}${window.location.pathname}#${encoded}`;
    }

    // ========================================================================
    // Debug Menu Helpers (for manual point/line addition)
    // ========================================================================

    setupDebugMenuHandlers() {
        const addPointBtn = document.getElementById('debugAddPointBtn');
        const addLineBtn = document.getElementById('debugAddLineBtn');
        const exportBtn = document.getElementById('debugExportBtn');
        const clearBtn = document.getElementById('debugClearAllBtn');

        if (addPointBtn) {
            addPointBtn.addEventListener('click', () => {
                const x = parseFloat(document.getElementById('debugPointX').value);
                const y = parseFloat(document.getElementById('debugPointY').value);
                const linesStr = document.getElementById('debugPointLines').value.trim();

                if (isNaN(x) || isNaN(y)) {
                    alert('Please enter valid x and y coordinates');
                    return;
                }

                let onLines = [];
                if (linesStr) {
                    onLines = linesStr.split(',')
                        .map(s => parseInt(s.trim()))
                        .filter(n => !isNaN(n) && n >= 0 && n < this.configuration.getLinesCount());
                }

                this.addPointManual(x, y, onLines);

                // Clear inputs
                document.getElementById('debugPointX').value = '';
                document.getElementById('debugPointY').value = '';
                document.getElementById('debugPointLines').value = '';
            });
        }

        if (addLineBtn) {
            addLineBtn.addEventListener('click', () => {
                const pointsStr = document.getElementById('debugLinePoints').value.trim();

                if (!pointsStr) {
                    alert('Please enter at least 2 point indices');
                    return;
                }

                const pointIndices = pointsStr.split(',')
                    .map(s => parseInt(s.trim()))
                    .filter(n => !isNaN(n) && n >= 0 && n < this.configuration.getPointsCount());

                if (pointIndices.length < 2) {
                    alert('Need at least 2 valid point indices to create a line');
                    return;
                }

                this.addLineManual(pointIndices);

                // Clear input
                document.getElementById('debugLinePoints').value = '';
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.operationsController.exportConfiguration();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.operationsController.clearAll();
            });
        }
    }

    addPointManual(x, y, onLines) {
        const index = this.configuration.addPoint(x, y, onLines);
        this.historyController.recordAddPoint(index, { x, y, onLines });
        console.log(`Added point ${index} at (${x}, ${y}) on lines [${onLines.join(', ')}]`);
    }

    addLineManual(pointIndices) {
        const points = this.configuration.getAllPoints();
        const p1 = points[pointIndices[0]];
        const p2 = points[pointIndices[1]];

        if (!p1 || !p2) {
            alert('Invalid point indices');
            return;
        }

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const lineIndex = this.configuration.addLine(p1.x, p1.y, angle);

        // Add all points to the line
        pointIndices.forEach(pointIndex => {
            const point = points[pointIndex];
            if (point && !point.onLines.includes(lineIndex)) {
                point.onLines.push(lineIndex);
            }
        });

        this.historyController.recordAddLine(lineIndex, { x: p1.x, y: p1.y, angle }, []);
        console.log(`Added line ${lineIndex} through points [${pointIndices.join(', ')}]`);
    }
}

// ============================================================================
// Initialize the application when DOM is ready
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new PointConfigurationApp('canvas');
        console.log('✅ Point Configuration Calculator initialized');
        console.log('📊 Architecture: State → Derived → View → Controller');
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PointConfigurationApp;
}