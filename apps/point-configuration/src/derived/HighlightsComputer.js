// HighlightsComputer.js
// **CRITICAL** - Consolidates all scattered highlighting logic into ONE place
// Pure function to compute which points and lines should be highlighted

/**
 * Computes which points and lines should be highlighted based on current interaction.
 * This is THE central place for all highlighting logic.
 */
export class HighlightsComputer {
    constructor(configuration, interactionState, uiState, snapPreviewComputer, intersectionsComputer) {
        this.configuration = configuration;
        this.interactionState = interactionState;
        this.uiState = uiState;
        this.snapPreviewComputer = snapPreviewComputer;
        this.intersectionsComputer = intersectionsComputer;
    }

    /**
     * Calculate highlights.
     * @returns {Object} {points: Set<number>, lines: Set<number>}
     */
    compute() {
        const highlightedPoints = new Set();
        const highlightedLines = new Set();

        const points = this.configuration.getAllPoints();
        const intersections = this.intersectionsComputer.compute();
        const state = this.interactionState.getState();
        const mode = this.interactionState.getMode();

        // 1. Add highlights from UI hover (stats panel)
        const hoveredFromUI = this.uiState.getHoveredPointsFromUI();
        if (hoveredFromUI.size > 0) {
            hoveredFromUI.forEach(idx => highlightedPoints.add(idx));
        }

        // 2. Add highlights based on interaction state
        switch (state.type) {
            case 'idle':
                // In idle, show highlights based on snap preview
                if (mode === 'point') {
                    const snap = this.snapPreviewComputer.compute();
                    this._addHighlightsFromSnap(snap, points, intersections, highlightedPoints, highlightedLines);
                }
                break;

            case 'dragging-point':
            case 'dragging-new-point':
                // While dragging, show highlights based on snap target
                const snap = this.snapPreviewComputer.compute();
                this._addHighlightsFromSnap(snap, points, intersections, highlightedPoints, highlightedLines);
                break;

            case 'drawing-line':
                // Highlight start points and lines they're on
                if (state.data.startPointIndices) {
                    state.data.startPointIndices.forEach(idx => {
                        highlightedPoints.add(idx);
                        const point = points[idx];
                        if (point) {
                            point.onLines.forEach(lineIdx => highlightedLines.add(lineIdx));
                        }
                    });
                }

                // Also highlight endpoint snap target (computed by VisualOverlaysComputer)
                // We'll recompute here for consistency
                const lineSnap = this._getLineEndpointSnap(state.data, points, intersections);
                if (lineSnap) {
                    if (lineSnap.type === 'multipoint') {
                        lineSnap.pointIndices.forEach(idx => {
                            highlightedPoints.add(idx);
                            const point = points[idx];
                            if (point) {
                                point.onLines.forEach(lineIdx => highlightedLines.add(lineIdx));
                            }
                        });
                    } else if (lineSnap.type === 'intersection') {
                        lineSnap.lineIndices.forEach(idx => highlightedLines.add(idx));
                    }
                }
                break;

            case 'placing-point':
                // Show highlights for the snap that was captured on mousedown
                // This is stored in interactionState
                const capturedSnap = this.snapPreviewComputer.compute();
                this._addHighlightsFromSnap(capturedSnap, points, intersections, highlightedPoints, highlightedLines);
                break;

            case 'panning':
            case 'two-finger-gesture':
                // No interaction highlights while panning
                break;
        }

        return {
            points: highlightedPoints,
            lines: highlightedLines
        };
    }

    /**
     * Add highlights based on snap preview
     */
    _addHighlightsFromSnap(snap, points, intersections, highlightedPoints, highlightedLines) {
        if (!snap) return;

        if (snap.type === 'line') {
            highlightedLines.add(snap.lineIndex);
        } else if (snap.type === 'intersection') {
            const intersection = intersections[snap.intersectionIndex];
            if (intersection) {
                intersection.lineIndices.forEach(idx => highlightedLines.add(idx));
            }
        } else if (snap.type === 'point') {
            highlightedPoints.add(snap.pointIndex);
            const point = points[snap.pointIndex];
            if (point) {
                point.onLines.forEach(idx => highlightedLines.add(idx));
            }
        }
    }

    /**
     * Get line endpoint snap (simplified version for highlighting)
     * Full version is in VisualOverlaysComputer
     */
    _getLineEndpointSnap(stateData, points, intersections) {
        if (!stateData || !this.interactionState.getMousePosition()) {
            return null;
        }

        const mousePos = this.interactionState.getMousePosition();
        const scale = this.configuration ? 1 : 1; // Placeholder

        // Check if we've moved enough to show line preview
        const mouseDownPos = this.interactionState.getMouseDownPosition();
        if (!mouseDownPos) return null;

        const dragDistance = Math.hypot(
            mousePos.screenX - mouseDownPos.screenX,
            mousePos.screenY - mouseDownPos.screenY
        );

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const clickThreshold = isTouchDevice ? 8 : 5;
        const linePreviewThreshold = Math.max(15, clickThreshold * 2);

        if (dragDistance <= linePreviewThreshold) {
            return null;
        }

        // For highlighting purposes, we just need to know if there's a snap
        // The actual snap computation is done in VisualOverlaysComputer
        // This is a simplified check
        return null;
    }
}
