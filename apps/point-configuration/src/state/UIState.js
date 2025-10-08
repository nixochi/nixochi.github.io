// state/UIState.js
// Primary State: UI settings and panel state (non-domain state)

export class UIState {
    constructor() {
        // Rendering settings
        this.rayOpacity = 1.0; // 0.0 to 1.0, opacity of ray portions of lines
        this.colorPalette = 'monochromatic'; // 'monochromatic' | 'rainbow' | 'pastel'

        // Stats panel settings
        this.currentStatsView = 'general'; // 'general' | 'bases' | 'circuits' | 'flats'
        this.statsPagination = {
            bases: { offset: 0, batchSize: 50 },
            circuits: { offset: 0, batchSize: 50 },
            flats: { offset: 0, batchSize: 50 }
        };

        // Panel visibility
        this.optionsPanelVisible = false;
        this.debugPanelVisible = false;

        // Hover state from UI (stats panel)
        this.hoveredPointsFromUI = new Set(); // Set of point indices

        // Observer pattern
        this.observers = new Set();
    }

    // ============================================================================
    // Rendering settings
    // ============================================================================

    /**
     * Set ray opacity (0-1)
     */
    setRayOpacity(opacity) {
        this.rayOpacity = Math.max(0, Math.min(1, opacity));
        this.notify();
    }

    /**
     * Get ray opacity value
     */
    getRayOpacity() {
        return this.rayOpacity;
    }

    /**
     * Set color palette name
     */
    setColorPalette(palette) {
        if (!['monochromatic', 'rainbow', 'pastel'].includes(palette)) {
            console.error('Invalid palette:', palette);
            return;
        }

        this.colorPalette = palette;
        this.notify();
    }

    /**
     * Get color palette name
     */
    getColorPalette() {
        return this.colorPalette;
    }

    // ============================================================================
    // Stats panel settings
    // ============================================================================

    /**
     * Change stats view
     */
    setCurrentStatsView(view) {
        if (!['general', 'bases', 'circuits', 'flats'].includes(view)) {
            console.error('Invalid stats view:', view);
            return;
        }

        this.currentStatsView = view;
        this.notify();
    }

    /**
     * Get current stats view
     */
    getCurrentStatsView() {
        return this.currentStatsView;
    }

    /**
     * Increment pagination offset for a view
     */
    loadMoreStats(view) {
        if (!this.statsPagination[view]) {
            console.error('Invalid view for pagination:', view);
            return;
        }

        this.statsPagination[view].offset += this.statsPagination[view].batchSize;
        this.notify();
    }

    /**
     * Reset pagination for a view (or all if view is null)
     */
    resetPagination(view = null) {
        if (view && this.statsPagination[view]) {
            this.statsPagination[view].offset = 0;
        } else if (!view) {
            // Reset all
            this.statsPagination.bases.offset = 0;
            this.statsPagination.circuits.offset = 0;
            this.statsPagination.flats.offset = 0;
        }

        this.notify();
    }

    /**
     * Get pagination for a view
     */
    getStatsPagination(view) {
        return this.statsPagination[view];
    }

    // ============================================================================
    // Panel visibility
    // ============================================================================

    /**
     * Show/hide options panel
     */
    setOptionsPanelVisible(visible) {
        this.optionsPanelVisible = visible;
        this.notify();
    }

    /**
     * Check if options panel is visible
     */
    isOptionsPanelVisible() {
        return this.optionsPanelVisible;
    }

    /**
     * Show/hide debug panel
     */
    setDebugPanelVisible(visible) {
        this.debugPanelVisible = visible;
        this.notify();
    }

    /**
     * Check if debug panel is visible
     */
    isDebugPanelVisible() {
        return this.debugPanelVisible;
    }

    // ============================================================================
    // UI hover state
    // ============================================================================

    /**
     * Set points hovered from stats panel (pass array or Set)
     */
    setHoveredPointsFromUI(pointIndices) {
        if (Array.isArray(pointIndices)) {
            this.hoveredPointsFromUI = new Set(pointIndices);
        } else if (pointIndices instanceof Set) {
            this.hoveredPointsFromUI = new Set(pointIndices);
        } else {
            this.hoveredPointsFromUI = new Set();
        }

        this.notify();
    }

    /**
     * Clear UI hover
     */
    clearHoveredPointsFromUI() {
        this.hoveredPointsFromUI = new Set();
        this.notify();
    }

    /**
     * Get hovered points Set
     */
    getHoveredPointsFromUI() {
        return this.hoveredPointsFromUI;
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
