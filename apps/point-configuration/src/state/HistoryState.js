// state/HistoryState.js
// Primary State: Undo/redo action stack (just the data structure, no execution logic)

export class HistoryState {
    constructor() {
        // Action stack
        this.actions = []; // Array of action objects
        this.currentIndex = -1; // -1 means empty, 0 means after first action
        this.maxHistorySize = 100;

        // Observer pattern
        this.observers = new Set();
    }

    // ============================================================================
    // Action management
    // ============================================================================

    /**
     * Add action to history
     * Truncates forward history if not at end, enforces max size
     */
    push(action) {
        // Truncate forward history if we're not at the end
        this.actions = this.actions.slice(0, this.currentIndex + 1);

        // Add timestamp if not present
        if (!action.timestamp) {
            action.timestamp = new Date();
        }

        // Add new action
        this.actions.push(action);
        this.currentIndex++;

        // Enforce max size (remove oldest)
        if (this.actions.length > this.maxHistorySize) {
            this.actions.shift();
            this.currentIndex--;
        }

        this.notify();
    }

    /**
     * Get action at current index
     */
    getCurrentAction() {
        if (this.currentIndex < 0 || this.currentIndex >= this.actions.length) {
            return null;
        }

        return this.actions[this.currentIndex];
    }

    /**
     * Get action to undo (action at currentIndex)
     */
    getUndoAction() {
        return this.getCurrentAction();
    }

    /**
     * Get action to redo (action at currentIndex + 1)
     */
    getRedoAction() {
        const redoIndex = this.currentIndex + 1;

        if (redoIndex < 0 || redoIndex >= this.actions.length) {
            return null;
        }

        return this.actions[redoIndex];
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
     * Decrement currentIndex (call after executing undo)
     */
    moveBackward() {
        if (this.currentIndex >= 0) {
            this.currentIndex--;
            this.notify();
        }
    }

    /**
     * Increment currentIndex (call after executing redo)
     */
    moveForward() {
        if (this.currentIndex < this.actions.length - 1) {
            this.currentIndex++;
            this.notify();
        }
    }

    /**
     * Reset history to empty
     */
    clear() {
        this.actions = [];
        this.currentIndex = -1;
        this.notify();
    }

    // ============================================================================
    // Debug/introspection
    // ============================================================================

    /**
     * Get all actions (for debugging)
     */
    getActions() {
        return [...this.actions];
    }

    /**
     * Get current index (for debugging)
     */
    getCurrentIndex() {
        return this.currentIndex;
    }

    // ============================================================================
    // Observer pattern
    // ============================================================================

    /**
     * Register observer callback
     */
    subscribe(callback) {
        this.observers.add(callback);
    }

    /**
     * Remove observer callback
     */
    unsubscribe(callback) {
        this.observers.delete(callback);
    }

    /**
     * Notify all observers
     */
    notify() {
        this.observers.forEach(callback => callback());
    }
}
