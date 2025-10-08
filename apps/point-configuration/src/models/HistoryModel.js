// history-model.js
// Model for undo/redo history

export class HistoryModel {
    constructor(geometryModel) {
        this.geometryModel = geometryModel;
        this.actions = [];
        this.currentIndex = -1;
        this.maxHistorySize = 100;
    }

    /**
     * Record a new action
     */
    recordAction(action) {
        this.actions = this.actions.slice(0, this.currentIndex + 1);
        this.actions.push(action);
        this.currentIndex++;

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
            case 'mergePoint':
            case 'unmergePoint':
                this._undoPointUpdate(action);
                break;
            default:
                return false;
        }

        this.currentIndex--;
        this.geometryModel.recomputeIntersections();
        this.geometryModel.notify();

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
            case 'mergePoint':
            case 'unmergePoint':
                this._redoPointUpdate(action);
                break;
            default:
                return false;
        }

        this.geometryModel.recomputeIntersections();
        this.geometryModel.notify();

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
        this.geometryModel.removePoint(action.index);
    }

    _undoAddLine(action) {
        for (const change of action.affectedPoints) {
            const point = this.geometryModel.points[change.index];
            point.onLines = [...change.oldOnLines];
            point.isIntersection = change.oldIsIntersection;
            point.intersectionIndex = change.oldIntersectionIndex;
        }
        this.geometryModel.removeLine(action.index);
    }

    _undoPointUpdate(action) {
        const point = this.geometryModel.points[action.index];
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
        this.geometryModel.points.push({ ...action.point });
    }

    _redoAddLine(action) {
        this.geometryModel.lines.push({ ...action.line });

        for (const change of action.affectedPoints) {
            const point = this.geometryModel.points[change.index];
            if (!point.onLines.includes(action.index)) {
                point.onLines.push(action.index);
            }
            point.isIntersection = point.onLines.length > 1;
        }
    }

    _redoPointUpdate(action) {
        const point = this.geometryModel.points[action.index];
        point.x = action.newX;
        point.y = action.newY;
        point.onLines = [...action.newOnLines];
        point.isIntersection = action.newIsIntersection;
        point.intersectionIndex = action.newIntersectionIndex;
    }

    // ============================================================================
    // Action factory methods
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