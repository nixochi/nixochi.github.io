// InteractionController.js
// Handle all mouse/touch input and translate to state modifications
// ONLY modifies InteractionState, TransformState, and Configuration (indirectly)
// Never reads from derived computers - only from state
// Never calls render - state changes trigger render via observers

import { getPointPosition } from '../geometry/geometry-utils.js';

/**
 * Handles all mouse/touch input and translates to state modifications.
 * This is the ONLY controller that modifies InteractionState and TransformState.
 */
export class InteractionController {
    constructor(
        canvas,
        configuration,
        interactionState,
        transformState,
        historyController,
        snapPreviewComputer,
        intersectionsComputer
    ) {
        this.canvas = canvas;
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.transformState = transformState;
        this.historyController = historyController;
        this.snapPreviewComputer = snapPreviewComputer;
        this.intersectionsComputer = intersectionsComputer;

        // Settings
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.clickThreshold = this.isTouchDevice ? 8 : 5;
        this.pointRadius = this.isTouchDevice ? 14 : 9;
        this.hitRadius = this.isTouchDevice ? 24 : 18;

        this.setupEventListeners();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });
    }

    /**
     * Get event coordinates (both world and screen)
     */
    getEventCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.transformState.screenToWorld(screenX, screenY);

        return {
            worldX: world.x,
            worldY: world.y,
            screenX,
            screenY
        };
    }

    /**
     * Mouse down handler
     */
    handleMouseDown(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        // Store mouse down position
        this.interactionState.setMouseDownPosition(worldX, worldY, screenX, screenY, Date.now());
        this.interactionState.setMousePosition(worldX, worldY, screenX, screenY);

        const mode = this.interactionState.getMode();

        if (mode === 'line') {
            this.handleLineModeMouseDown(worldX, worldY, screenX, screenY);
        } else {
            this.handlePointModeMouseDown(worldX, worldY, screenX, screenY);
        }
    }

    /**
     * Handle mouse down in point mode
     */
    handlePointModeMouseDown(worldX, worldY, screenX, screenY) {
        const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);

        if (pointsAtPosition.length > 0) {
            // Start dragging an existing point
            const pointIndex = pointsAtPosition.length === 1
                ? pointsAtPosition[0]
                : Math.max(...pointsAtPosition);

            const point = this.configuration.getPoint(pointIndex);
            this.interactionState.transitionTo('dragging-point', {
                pointIndex,
                originalX: point.x,
                originalY: point.y
            });
            this.canvas.style.cursor = 'grabbing';
        } else {
            // Start dragging a new point
            this.interactionState.transitionTo('dragging-new-point', {
                startWorldX: worldX,
                startWorldY: worldY
            });
            this.canvas.style.cursor = 'crosshair';
        }
    }

    /**
     * Handle mouse down in line mode
     */
    handleLineModeMouseDown(worldX, worldY, screenX, screenY) {
        let startX = worldX;
        let startY = worldY;
        let startPointIndices = null;

        // Check if starting from an existing point
        const pointsAtPosition = this.getPointsAtPosition(worldX, worldY);
        if (pointsAtPosition.length > 0) {
            const point = this.configuration.getPoint(pointsAtPosition[0]);
            const intersections = this.intersectionsComputer.compute();
            const pos = getPointPosition(point, intersections);
            startX = pos.x;
            startY = pos.y;
            startPointIndices = pointsAtPosition;
        }

        // Transition to drawing-line state
        this.interactionState.transitionTo('drawing-line', {
            startX,
            startY,
            startPointIndices
        });
        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * Mouse move handler
     */
    handleMouseMove(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        // Update current mouse position
        this.interactionState.setMousePosition(worldX, worldY, screenX, screenY);

        const state = this.interactionState.getState();

        switch (state.type) {
            case 'idle':
                // Just update mouse position for snap preview
                break;

            case 'placing-point':
                // Check if user is dragging (transition to panning if so)
                const mouseDownPos = this.interactionState.getMouseDownPosition();
                if (mouseDownPos) {
                    const dragDist = Math.hypot(
                        screenX - mouseDownPos.screenX,
                        screenY - mouseDownPos.screenY
                    );

                    if (dragDist > this.clickThreshold) {
                        // Transition to panning
                        this.interactionState.transitionTo('panning', {
                            startOffsetX: this.transformState.getOffsetX(),
                            startOffsetY: this.transformState.getOffsetY()
                        });
                    }
                }
                break;

            case 'panning':
                // Update pan offset
                if (mouseDownPos) {
                    const deltaX = screenX - mouseDownPos.screenX;
                    const deltaY = screenY - mouseDownPos.screenY;
                    this.transformState.setPan(
                        state.data.startOffsetX + deltaX,
                        state.data.startOffsetY + deltaY
                    );
                }
                break;

            case 'dragging-point':
            case 'dragging-new-point':
            case 'drawing-line':
                // Do nothing - visual overlays will update automatically
                break;

            case 'two-finger-gesture':
                // Handle two-finger pan/zoom
                // (Implementation would go here for touch devices)
                break;
        }
    }

    /**
     * Mouse up handler
     */
    handleMouseUp(e) {
        const { worldX, worldY, screenX, screenY } = this.getEventCoordinates(e);

        const state = this.interactionState.getState();
        const mouseDownPos = this.interactionState.getMouseDownPosition();

        // Calculate if this was a click
        const isClick = mouseDownPos && Math.hypot(
            screenX - mouseDownPos.screenX,
            screenY - mouseDownPos.screenY
        ) < this.clickThreshold;

        switch (state.type) {
            case 'drawing-line':
                this.handleDrawingLineEnd(state.data, isClick);
                break;

            case 'dragging-point':
                this.handleDraggingPointEnd(state.data, isClick);
                break;

            case 'dragging-new-point':
                this.handleDraggingNewPointEnd(state.data, isClick);
                break;

            case 'placing-point':
            case 'panning':
            case 'two-finger-gesture':
                // Do nothing
                break;
        }

        // Reset to idle
        this.interactionState.transitionTo('idle');
        this.interactionState.clearMousePosition();
        this.interactionState.clearMouseDownPosition();
        this.canvas.style.cursor = 'default';
    }

    /**
     * Handle end of drawing line
     */
    handleDrawingLineEnd(stateData, isClick) {
        if (isClick) return; // Don't create line on click

        const mousePos = this.interactionState.getMousePosition();
        if (!mousePos) return;

        // Check drag distance
        const mouseDownPos = this.interactionState.getMouseDownPosition();
        const dragDistance = mouseDownPos ? Math.hypot(
            mousePos.screenX - mouseDownPos.screenX,
            mousePos.screenY - mouseDownPos.screenY
        ) : 0;

        const linePreviewThreshold = Math.max(15, this.clickThreshold * 2);
        if (dragDistance <= linePreviewThreshold) return;

        // Get endpoint (with snap)
        const snap = this.snapPreviewComputer.compute();
        let endX = mousePos.worldX;
        let endY = mousePos.worldY;
        let endPointIndices = null;

        if (snap) {
            endX = snap.x;
            endY = snap.y;
            if (snap.type === 'point') {
                endPointIndices = [snap.pointIndex];
            }
        }

        // Add the line
        this.addLine(stateData.startX, stateData.startY, endX, endY, stateData.startPointIndices, endPointIndices);
    }

    /**
     * Handle end of dragging existing point
     */
    handleDraggingPointEnd(stateData, isClick) {
        if (isClick) {
            // Click without drag - don't move the point
            return;
        }

        const snap = this.snapPreviewComputer.compute();
        let newX, newY, newOnLines;

        if (snap) {
            newX = snap.x;
            newY = snap.y;
            if (snap.type === 'line') {
                newOnLines = [snap.lineIndex];
            } else if (snap.type === 'intersection') {
                const intersections = this.intersectionsComputer.compute();
                newOnLines = intersections[snap.intersectionIndex].lineIndices;
            } else if (snap.type === 'point') {
                const targetPoint = this.configuration.getPoint(snap.pointIndex);
                newOnLines = targetPoint.onLines;
            }
        } else {
            const mousePos = this.interactionState.getMousePosition();
            newX = mousePos.worldX;
            newY = mousePos.worldY;
            newOnLines = [];
        }

        // Update point
        this.configuration.updatePoint(stateData.pointIndex, {
            x: newX,
            y: newY,
            onLines: newOnLines
        });

        // Record history
        this.historyController.recordMovePoint(
            stateData.pointIndex,
            { x: stateData.originalX, y: stateData.originalY },
            { x: newX, y: newY, onLines: newOnLines }
        );
    }

    /**
     * Handle end of dragging new point
     */
    handleDraggingNewPointEnd(stateData, isClick) {
        const snap = this.snapPreviewComputer.compute();
        let x, y, onLines = [];

        if (snap) {
            x = snap.x;
            y = snap.y;
            if (snap.type === 'line') {
                onLines = [snap.lineIndex];
            } else if (snap.type === 'intersection') {
                const intersections = this.intersectionsComputer.compute();
                onLines = intersections[snap.intersectionIndex].lineIndices;
            } else if (snap.type === 'point') {
                const targetPoint = this.configuration.getPoint(snap.pointIndex);
                onLines = [...targetPoint.onLines];
            }
        } else {
            const mousePos = this.interactionState.getMousePosition();
            x = mousePos.worldX;
            y = mousePos.worldY;
        }

        // Add point
        this.configuration.addPoint(x, y, onLines);

        // Record history
        const newIndex = this.configuration.getPointsCount() - 1;
        this.historyController.recordAddPoint(newIndex, { x, y, onLines });
    }

    /**
     * Add a line through two points
     */
    addLine(startX, startY, endX, endY, startPointIndices, endPointIndices) {
        // Calculate angle
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);

        this.configuration.addLine(startX, startY, angle);
        const newLineIndex = this.configuration.getLinesCount() - 1;

        // Collect all point indices to add to the line
        const allPointIndices = new Set();
        if (startPointIndices) startPointIndices.forEach(idx => allPointIndices.add(idx));
        if (endPointIndices) endPointIndices.forEach(idx => allPointIndices.add(idx));

        // Track changes for history
        const affectedPoints = [];
        allPointIndices.forEach(pointIndex => {
            const point = this.configuration.getPoint(pointIndex);
            affectedPoints.push({
                index: pointIndex,
                oldOnLines: [...point.onLines]
            });
        });

        // Add all points to the line
        allPointIndices.forEach(pointIndex => {
            const point = this.configuration.getPoint(pointIndex);
            if (!point.onLines.includes(newLineIndex)) {
                const newOnLines = [...point.onLines, newLineIndex];
                this.configuration.updatePointLines(pointIndex, newOnLines);
            }
        });

        // Record history
        this.historyController.recordAddLine(
            newLineIndex,
            { x: startX, y: startY, angle },
            affectedPoints
        );
    }

    /**
     * Handle mouse leave
     */
    handleMouseLeave(e) {
        this.interactionState.clearMousePosition();
    }

    /**
     * Handle wheel (zoom)
     */
    handleWheel(e) {
        e.preventDefault();

        const { screenX, screenY } = this.getEventCoordinates(e);

        // Calculate scale factor
        const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;

        // Zoom at cursor position
        this.transformState.zoomAt(screenX, screenY, scaleFactor);
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - treat as mouse down
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseDown(mouseEvent);
            e.preventDefault();
        } else if (e.touches.length === 2) {
            // Two finger gesture
            e.preventDefault();
            // Implementation would go here
        }
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
            e.preventDefault();
        } else if (e.touches.length === 2) {
            // Two finger gesture
            e.preventDefault();
            // Implementation would go here
        }
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const mouseEvent = new MouseEvent('mouseup', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseUp(mouseEvent);
            e.preventDefault();
        }
    }

    /**
     * Handle touch cancel
     */
    handleTouchCancel(e) {
        this.handleMouseLeave(e);
    }

    /**
     * Get points at a position (helper)
     */
    getPointsAtPosition(worldX, worldY) {
        const worldThreshold = this.hitRadius / this.transformState.getScale();
        const points = this.configuration.getAllPoints();
        const intersections = this.intersectionsComputer.compute();
        const indices = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const pos = getPointPosition(point, intersections);
            const dx = pos.x - worldX;
            const dy = pos.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= worldThreshold) {
                indices.push(i);
            }
        }

        return indices;
    }
}
