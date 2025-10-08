// history-model.js
// Model for undo/redo history

export class HistoryModel {
    constructor(geometryModel) {
        this.geometryModel = geometryModel;
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
                return false;
        }

        this.currentIndex--;

        // Recompute intersections after undo
        this.geometryModel.recomputeIntersections();

        // Notify listeners
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
                this._redoMovePoint(action);
                break;
            case 'mergePoint':
                this._redoMergePoint(action);
                break;
            case 'unmergePoint':
                this._redoUnmergePoint(action);
                break;
            default:
                return false;
        }

        // Recompute intersections after redo
        this.geometryModel.recomputeIntersections();

        // Notify listeners
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
        // Restore affected points to their old state BEFORE removing the line
        for (const change of action.affectedPoints) {
            const point = this.geometryModel.points[change.index];
            point.onLines = [...change.oldOnLines];
            point.isIntersection = change.oldIsIntersection;
            point.intersectionIndex = change.oldIntersectionIndex;
        }

        // Now remove the line
        this.geometryModel.removeLine(action.index);
    }

    _undoMovePoint(action) {
        this.geometryModel.updatePoint(action.index, {
            x: action.oldX,
            y: action.oldY,
            onLines: action.oldOnLines,
            isIntersection: action.oldIsIntersection,
            intersectionIndex: action.oldIntersectionIndex
        });
    }

    _undoMergePoint(action) {
        const point = this.geometryModel.points[action.index];
        point.x = action.oldX;
        point.y = action.oldY;
        point.onLines = [...action.oldOnLines];
        point.isIntersection = action.oldIsIntersection;
        point.intersectionIndex = action.oldIntersectionIndex;
    }

    _undoUnmergePoint(action) {
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
        // Re-add the point
        this.geometryModel.points.push({ ...action.point });
        this.geometryModel.notify();
    }

    _redoAddLine(action) {
        // Re-add the line
        this.geometryModel.lines.push({ ...action.line });

        // Update affected points to their new state
        for (const change of action.affectedPoints) {
            const point = this.geometryModel.points[change.index];
            if (!point.onLines.includes(action.index)) {
                point.onLines.push(action.index);
            }
            point.isIntersection = point.onLines.length > 1;
        }

        this.geometryModel.recomputeIntersections();
        this.geometryModel.notify();
    }

    _redoMovePoint(action) {
        this.geometryModel.updatePoint(action.index, {
            x: action.newX,
            y: action.newY,
            onLines: action.newOnLines,
            isIntersection: action.newIsIntersection,
            intersectionIndex: action.newIntersectionIndex
        });
    }

    _redoMergePoint(action) {
        const point = this.geometryModel.points[action.index];
        point.x = action.newX;
        point.y = action.newY;
        point.onLines = [...action.newOnLines];
        point.isIntersection = action.newIsIntersection;
        point.intersectionIndex = action.newIntersectionIndex;
    }

    _redoUnmergePoint(action) {
        const point = this.geometryModel.points[action.index];
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
