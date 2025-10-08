// history.js
// Manages undo/redo history using incremental action storage

import { computeIntersections, findIntersectionByLines } from '../geometry/geometry-utils.js';

export class History {
    constructor(pointLineManager) {
        this.pointLineManager = pointLineManager;
        this.actions = [];
        this.currentIndex = -1; // -1 means no actions, 0 means after first action
        this.maxHistorySize = 100;
    }

    /**
     * Record a new action
     */
    recordAction(action) {
        // Truncate forward history if we're not at the end
        this.actions = this.actions.slice(0, this.currentIndex + 1);

        // Add new action
        this.actions.push(action);
        this.currentIndex++;

        // Limit history size (remove oldest)
        if (this.actions.length > this.maxHistorySize) {
            this.actions.shift();
            this.currentIndex--;
        }

        console.log(`Recorded action: ${action.type}`, action);
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.currentIndex >= 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.currentIndex < this.actions.length - 1;
    }

    /**
     * Undo the last action
     */
    undo() {
        if (!this.canUndo()) {
            console.warn('Nothing to undo');
            return false;
        }

        const action = this.actions[this.currentIndex];
        console.log(`Undoing action: ${action.type}`, action);

        switch (action.type) {
            case 'addPoint':
                this._undoAddPoint(action);
                break;
            case 'addLine':
                this._undoAddLine(action);
                break;
            case 'movePoint':
                this._undoMovePoint(action);
                break;
            case 'mergePoint':
                this._undoMergePoint(action);
                break;
            case 'unmergePoint':
                this._undoUnmergePoint(action);
                break;
            default:
                console.error('Unknown action type:', action.type);
                return false;
        }

        this.currentIndex--;

        // Recompute intersections after undo
        this.pointLineManager.intersections = computeIntersections(
            this.pointLineManager.lines,
            this.pointLineManager.points
        );

        if (this.pointLineManager.onStateChange) {
            this.pointLineManager.onStateChange();
        }

        return true;
    }

    /**
     * Redo the next action
     */
    redo() {
        if (!this.canRedo()) {
            console.warn('Nothing to redo');
            return false;
        }

        this.currentIndex++;
        const action = this.actions[this.currentIndex];
        console.log(`Redoing action: ${action.type}`, action);

        switch (action.type) {
            case 'addPoint':
                this._redoAddPoint(action);
                break;
            case 'addLine':
                this._redoAddLine(action);
                break;
            case 'movePoint':
                this._redoMovePoint(action);
                break;
            case 'mergePoint':
                this._redoMergePoint(action);
                break;
            case 'unmergePoint':
                this._redoUnmergePoint(action);
                break;
            default:
                console.error('Unknown action type:', action.type);
                return false;
        }

        // Recompute intersections after redo
        this.pointLineManager.intersections = computeIntersections(
            this.pointLineManager.lines,
            this.pointLineManager.points
        );

        if (this.pointLineManager.onStateChange) {
            this.pointLineManager.onStateChange();
        }

        return true;
    }

    /**
     * Clear all history
     */
    clear() {
        this.actions = [];
        this.currentIndex = -1;
        console.log('History cleared');
    }

    // ============================================================================
    // Undo implementations
    // ============================================================================

    _undoAddPoint(action) {
        // Remove the point that was added
        if (this.pointLineManager.points.length - 1 !== action.index) {
            console.error('Cannot undo addPoint: point index mismatch');
            return;
        }

        this.pointLineManager.removePoint(action.index);
    }

    _undoAddLine(action) {
        // Remove the line that was added
        if (this.pointLineManager.lines.length - 1 !== action.index) {
            console.error('Cannot undo addLine: line index mismatch');
            return;
        }

        // Restore affected points to their old state BEFORE removing the line
        for (const change of action.affectedPoints) {
            const point = this.pointLineManager.points[change.index];
            point.onLines = [...change.oldOnLines];
            point.isIntersection = change.oldIsIntersection;
            point.intersectionIndex = change.oldIntersectionIndex;
        }

        // Now remove the line
        this.pointLineManager.removeLine(action.index);
    }

    _undoMovePoint(action) {
        const point = this.pointLineManager.points[action.index];
        point.x = action.oldX;
        point.y = action.oldY;
        point.onLines = [...action.oldOnLines];
        point.isIntersection = action.oldIsIntersection;
        point.intersectionIndex = action.oldIntersectionIndex;
    }

    _undoMergePoint(action) {
        const point = this.pointLineManager.points[action.index];
        point.x = action.oldX;
        point.y = action.oldY;
        point.onLines = [...action.oldOnLines];
        point.isIntersection = action.oldIsIntersection;
        point.intersectionIndex = action.oldIntersectionIndex;
    }

    _undoUnmergePoint(action) {
        const point = this.pointLineManager.points[action.index];
        point.x = action.oldX;
        point.y = action.oldY;
        point.onLines = [...action.oldOnLines];
        point.isIntersection = action.oldIsIntersection;
        point.intersectionIndex = action.oldIntersectionIndex;
    }

    // ============================================================================
    // Redo implementations
    // ============================================================================

    _redoAddPoint(action) {
        // Re-add the point
        this.pointLineManager.points.push({ ...action.point });
    }

    _redoAddLine(action) {
        // Re-add the line
        this.pointLineManager.lines.push({ ...action.line });

        // Update affected points to their new state
        for (const change of action.affectedPoints) {
            const point = this.pointLineManager.points[change.index];
            if (!point.onLines.includes(action.index)) {
                point.onLines.push(action.index);
            }
            point.isIntersection = point.onLines.length > 1;
        }
    }

    _redoMovePoint(action) {
        const point = this.pointLineManager.points[action.index];
        point.x = action.newX;
        point.y = action.newY;
        point.onLines = [...action.newOnLines];
        point.isIntersection = action.newIsIntersection;
        point.intersectionIndex = action.newIntersectionIndex;
    }

    _redoMergePoint(action) {
        const point = this.pointLineManager.points[action.index];
        point.x = action.newX;
        point.y = action.newY;
        point.onLines = [...action.newOnLines];
        point.isIntersection = action.newIsIntersection;
        point.intersectionIndex = action.newIntersectionIndex;
    }

    _redoUnmergePoint(action) {
        const point = this.pointLineManager.points[action.index];
        point.x = action.newX;
        point.y = action.newY;
        point.onLines = [...action.newOnLines];
        point.isIntersection = action.newIsIntersection;
        point.intersectionIndex = action.newIntersectionIndex;
    }

    // ============================================================================
    // Action factory methods (for convenience)
    // ============================================================================

    createAddPointAction(index, point) {
        return {
            type: 'addPoint',
            index,
            point: {
                x: point.x,
                y: point.y,
                onLines: [...point.onLines],
                isIntersection: point.isIntersection,
                intersectionIndex: point.intersectionIndex
            }
        };
    }

    createAddLineAction(index, line, affectedPoints) {
        return {
            type: 'addLine',
            index,
            line: {
                x: line.x,
                y: line.y,
                angle: line.angle
            },
            affectedPoints: affectedPoints.map(change => ({
                index: change.index,
                oldOnLines: [...change.oldOnLines],
                oldIsIntersection: change.oldIsIntersection,
                oldIntersectionIndex: change.oldIntersectionIndex
            }))
        };
    }

    createMovePointAction(index, oldState, newState) {
        return {
            type: 'movePoint',
            index,
            oldX: oldState.x,
            oldY: oldState.y,
            oldOnLines: [...oldState.onLines],
            oldIsIntersection: oldState.isIntersection,
            oldIntersectionIndex: oldState.intersectionIndex,
            newX: newState.x,
            newY: newState.y,
            newOnLines: [...newState.onLines],
            newIsIntersection: newState.isIntersection,
            newIntersectionIndex: newState.intersectionIndex
        };
    }

    createMergePointAction(index, oldState, newState) {
        return {
            type: 'mergePoint',
            index,
            oldX: oldState.x,
            oldY: oldState.y,
            oldOnLines: [...oldState.onLines],
            oldIsIntersection: oldState.isIntersection,
            oldIntersectionIndex: oldState.intersectionIndex,
            newX: newState.x,
            newY: newState.y,
            newOnLines: [...newState.onLines],
            newIsIntersection: newState.isIntersection,
            newIntersectionIndex: newState.intersectionIndex
        };
    }

    createUnmergePointAction(index, oldState, newState) {
        return {
            type: 'unmergePoint',
            index,
            oldX: oldState.x,
            oldY: oldState.y,
            oldOnLines: [...oldState.onLines],
            oldIsIntersection: oldState.isIntersection,
            oldIntersectionIndex: oldState.intersectionIndex,
            newX: newState.x,
            newY: newState.y,
            newOnLines: [...newState.onLines],
            newIsIntersection: newState.isIntersection,
            newIntersectionIndex: newState.intersectionIndex
        };
    }
}
