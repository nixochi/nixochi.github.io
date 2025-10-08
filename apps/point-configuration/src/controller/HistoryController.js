// HistoryController.js
// Execute undo/redo operations and record actions
// Acts as bridge between HistoryState (data) and Configuration (domain)

/**
 * Executes undo/redo operations and records actions.
 * Separates data (HistoryState) from execution (Configuration modifications).
 */
export class HistoryController {
    constructor(historyState, configuration, intersectionsComputer) {
        this.historyState = historyState;
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
    }

    /**
     * Record point addition to history
     */
    recordAddPoint(index, point) {
        const action = {
            type: 'addPoint',
            data: {
                index,
                point: { x: point.x, y: point.y, onLines: [...point.onLines] }
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Record point removal to history
     */
    recordRemovePoint(index, point) {
        const action = {
            type: 'removePoint',
            data: {
                index,
                point: { x: point.x, y: point.y, onLines: [...point.onLines] }
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Record line addition to history
     */
    recordAddLine(index, line, affectedPoints) {
        const action = {
            type: 'addLine',
            data: {
                index,
                line: { x: line.x, y: line.y, angle: line.angle },
                affectedPoints: affectedPoints.map(p => ({
                    index: p.index,
                    oldOnLines: [...p.oldOnLines],
                    newOnLines: p.newOnLines ? [...p.newOnLines] : undefined
                }))
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Record line removal to history
     */
    recordRemoveLine(index, line, affectedPoints) {
        const action = {
            type: 'removeLine',
            data: {
                index,
                line: { x: line.x, y: line.y, angle: line.angle },
                affectedPoints: affectedPoints.map(p => ({
                    index: p.index,
                    oldOnLines: [...p.oldOnLines],
                    newOnLines: [...p.newOnLines]
                }))
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Record point movement to history
     */
    recordMovePoint(index, oldState, newState) {
        const action = {
            type: 'movePoint',
            data: {
                index,
                oldState: { x: oldState.x, y: oldState.y, onLines: oldState.onLines ? [...oldState.onLines] : [] },
                newState: { x: newState.x, y: newState.y, onLines: [...newState.onLines] }
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Record point merging to history (moved to multipoint)
     */
    recordMergePoint(index, oldState, newState) {
        const action = {
            type: 'mergePoint',
            data: {
                index,
                oldState: { x: oldState.x, y: oldState.y, onLines: [...oldState.onLines] },
                newState: { x: newState.x, y: newState.y, onLines: [...newState.onLines] }
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Record point unmerging to history (moved away from multipoint)
     */
    recordUnmergePoint(index, oldState, newState) {
        const action = {
            type: 'unmergePoint',
            data: {
                index,
                oldState: { x: oldState.x, y: oldState.y, onLines: [...oldState.onLines] },
                newState: { x: newState.x, y: newState.y, onLines: [...newState.onLines] }
            },
            timestamp: Date.now()
        };

        this.historyState.push(action);
    }

    /**
     * Execute undo operation
     */
    undo() {
        if (!this.canUndo()) {
            return false;
        }

        const action = this.historyState.getUndoAction();
        if (!action) {
            return false;
        }

        this.applyAction(action, 'reverse');
        this.historyState.moveBackward();

        return true;
    }

    /**
     * Execute redo operation
     */
    redo() {
        if (!this.canRedo()) {
            return false;
        }

        const action = this.historyState.getRedoAction();
        if (!action) {
            return false;
        }

        this.applyAction(action, 'forward');
        this.historyState.moveForward();

        return true;
    }

    /**
     * Apply action in forward or reverse direction
     */
    applyAction(action, direction) {
        const isReverse = direction === 'reverse';

        switch (action.type) {
            case 'addPoint':
                if (isReverse) {
                    // Undo: remove the point
                    this.configuration.removePoint(action.data.index);
                } else {
                    // Redo: add the point back
                    const p = action.data.point;
                    this.configuration.addPoint(p.x, p.y, p.onLines);
                }
                break;

            case 'removePoint':
                if (isReverse) {
                    // Undo: add the point back (insert at original position)
                    const p = action.data.point;
                    // Note: This requires Configuration to support inserting at specific index
                    // For now, just add at end
                    this.configuration.addPoint(p.x, p.y, p.onLines);
                } else {
                    // Redo: remove the point
                    this.configuration.removePoint(action.data.index);
                }
                break;

            case 'addLine':
                if (isReverse) {
                    // Undo: restore affected points to old state, then remove line
                    action.data.affectedPoints.forEach(p => {
                        this.configuration.updatePointLines(p.index, p.oldOnLines);
                    });
                    this.configuration.removeLine(action.data.index);
                } else {
                    // Redo: add line, then update affected points
                    const l = action.data.line;
                    this.configuration.addLine(l.x, l.y, l.angle);
                    action.data.affectedPoints.forEach(p => {
                        if (p.newOnLines) {
                            this.configuration.updatePointLines(p.index, p.newOnLines);
                        }
                    });
                }
                break;

            case 'removeLine':
                if (isReverse) {
                    // Undo: add line back, restore affected points
                    const l = action.data.line;
                    this.configuration.addLine(l.x, l.y, l.angle);
                    action.data.affectedPoints.forEach(p => {
                        this.configuration.updatePointLines(p.index, p.oldOnLines);
                    });
                } else {
                    // Redo: update affected points, remove line
                    action.data.affectedPoints.forEach(p => {
                        this.configuration.updatePointLines(p.index, p.newOnLines);
                    });
                    this.configuration.removeLine(action.data.index);
                }
                break;

            case 'movePoint':
            case 'mergePoint':
            case 'unmergePoint':
                if (isReverse) {
                    // Undo: restore to old state
                    const old = action.data.oldState;
                    this.configuration.updatePoint(action.data.index, {
                        x: old.x,
                        y: old.y,
                        onLines: old.onLines
                    });
                } else {
                    // Redo: apply new state
                    const newState = action.data.newState;
                    this.configuration.updatePoint(action.data.index, {
                        x: newState.x,
                        y: newState.y,
                        onLines: newState.onLines
                    });
                }
                break;

            default:
                console.error('Unknown action type:', action.type);
                return false;
        }

        return true;
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyState.canUndo();
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyState.canRedo();
    }
}
