// state/InteractionState.js
// Primary State: Current interaction state (what is the user doing right now?)

export class InteractionState {
    constructor() {
        // Mode: 'point' or 'line'
        this.mode = 'point';

        // State machine
        this.state = {
            type: 'idle', // 'idle' | 'placingPoint' | 'draggingPoint' | 'draggingNewPoint' | 'drawingLine' | 'panning' | 'twoFingerGesture'
            data: null
        };

        // Mouse tracking
        this.mousePosition = null; // {worldX, worldY, screenX, screenY}
        this.mouseDownPosition = null; // {worldX, worldY, screenX, screenY, time}

        // Observer pattern
        this.observers = new Set();
    }

    // ============================================================================
    // Mode management
    // ============================================================================

    /**
     * Change mode ('point' | 'line')
     */
    setMode(mode) {
        if (mode !== 'point' && mode !== 'line') {
            console.error('Invalid mode:', mode);
            return;
        }

        this.mode = mode;
        this.reset(); // Reset to idle when changing mode
        this.notify();
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }

    // ============================================================================
    // State machine
    // ============================================================================

    /**
     * Transition to a new state
     */
    transitionTo(stateType, data = null) {
        this.state = { type: stateType, data };
        this.notify();
    }

    /**
     * Get current state object
     */
    getState() {
        return this.state;
    }

    /**
     * Get current state type string
     */
    getStateType() {
        return this.state.type;
    }

    /**
     * Get current state data
     */
    getStateData() {
        return this.state.data;
    }

    /**
     * Check if in specific state
     */
    isInState(type) {
        return this.state.type === type;
    }

    /**
     * Check if state is idle
     */
    isIdle() {
        return this.state.type === 'idle';
    }

    /**
     * Reset to idle state
     */
    reset() {
        this.state = { type: 'idle', data: null };
        this.mousePosition = null;
        this.mouseDownPosition = null;
        this.notify();
    }

    // ============================================================================
    // Mouse position tracking
    // ============================================================================

    /**
     * Set current mouse position
     */
    setMousePosition(worldX, worldY, screenX, screenY) {
        this.mousePosition = { worldX, worldY, screenX, screenY };
        this.notify();
    }

    /**
     * Clear mouse position
     */
    clearMousePosition() {
        this.mousePosition = null;
        this.notify();
    }

    /**
     * Get mouse position
     */
    getMousePosition() {
        return this.mousePosition;
    }

    /**
     * Record where mouse went down
     */
    setMouseDownPosition(worldX, worldY, screenX, screenY, time = Date.now()) {
        this.mouseDownPosition = { worldX, worldY, screenX, screenY, time };
    }

    /**
     * Clear mouse down position
     */
    clearMouseDownPosition() {
        this.mouseDownPosition = null;
    }

    /**
     * Get mouse down position
     */
    getMouseDownPosition() {
        return this.mouseDownPosition;
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
