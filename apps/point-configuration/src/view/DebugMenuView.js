// DebugMenuView.js
// Renders debug panel HTML and handles debug form interactions
// All modification logic delegated to callbacks

import { getPointPosition } from '../geometry/geometry-utils.js';

/**
 * Debug menu view - renders debug panel and forms.
 * Never modifies state directly - delegates all actions to callbacks.
 */
export class DebugMenuView {
    constructor(
        element,
        configuration,
        intersectionsComputer,
        onAddPointCallback,
        onAddLineCallback,
        onExportCallback,
        onClearCallback
    ) {
        this.element = element;
        this.configuration = configuration;
        this.intersectionsComputer = intersectionsComputer;
        this.onAddPointCallback = onAddPointCallback;
        this.onAddLineCallback = onAddLineCallback;
        this.onExportCallback = onExportCallback;
        this.onClearCallback = onClearCallback;

        this.isVisible = false;
        this.button = null;

        this.init();
    }

    /**
     * Initialize - setup event listeners
     */
    init() {
        this.button = document.getElementById('debugBtn');

        if (!this.button || !this.element) {
            console.error('Debug menu elements not found');
            return;
        }

        // Setup button toggle
        this.button.addEventListener('click', () => this.toggle());

        // Setup form buttons
        const addPointBtn = document.getElementById('debugAddPointBtn');
        if (addPointBtn) {
            addPointBtn.addEventListener('click', () => this.handleAddPoint());
        }

        const addLineBtn = document.getElementById('debugAddLineBtn');
        if (addLineBtn) {
            addLineBtn.addEventListener('click', () => this.handleAddLine());
        }

        const exportBtn = document.getElementById('debugExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.onExportCallback());
        }

        const clearAllBtn = document.getElementById('debugClearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Clear all points and lines?')) {
                    this.onClearCallback();
                }
            });
        }
    }

    /**
     * Toggle visibility
     */
    toggle() {
        this.isVisible = !this.isVisible;

        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Show panel with animation
     */
    show() {
        this.element.style.display = 'block';
        this.element.offsetHeight; // Force reflow
        this.element.classList.add('expanded');
        this.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        this.button.title = 'close debug menu';

        // Update lists
        this.render();
    }

    /**
     * Hide panel with animation
     */
    hide() {
        this.element.classList.remove('expanded');
        setTimeout(() => {
            if (!this.isVisible) {
                this.element.style.display = 'none';
            }
        }, 300);
        this.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>';
        this.button.title = 'open debug menu';
    }

    /**
     * Main render function - update panel content
     */
    render() {
        if (!this.isVisible) return;

        this.updatePointsList();
        this.updateLinesList();
    }

    /**
     * Update points list HTML
     */
    updatePointsList() {
        const listEl = document.getElementById('debugPointsList');
        if (!listEl) return;

        const points = this.configuration.getAllPoints();
        const intersections = this.intersectionsComputer.compute();

        if (points.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no points yet</div>';
            return;
        }

        const html = points.map((point, idx) => {
            const pos = getPointPosition(point, intersections);
            const linesStr = point.onLines.length > 0 ? `[${point.onLines.join(', ')}]` : '[]';
            return `<div style="padding: 4px 8px; border-bottom: 1px solid var(--border);">
                <strong>Point ${idx}:</strong> (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) on lines ${linesStr}
            </div>`;
        }).join('');

        listEl.innerHTML = html;
    }

    /**
     * Update lines list HTML
     */
    updateLinesList() {
        const listEl = document.getElementById('debugLinesList');
        if (!listEl) return;

        const lines = this.configuration.getAllLines();
        const points = this.configuration.getAllPoints();

        if (lines.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no lines yet</div>';
            return;
        }

        const html = lines.map((line, lineIdx) => {
            // Find all points on this line
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

    /**
     * Handle add point form submission
     */
    handleAddPoint() {
        const xInput = document.getElementById('debugPointX');
        const yInput = document.getElementById('debugPointY');
        const linesInput = document.getElementById('debugPointLines');

        const formData = this.getAddPointFormData(xInput, yInput, linesInput);

        if (!formData) {
            return; // Validation failed
        }

        // Call callback
        this.onAddPointCallback(formData.x, formData.y, formData.onLines);

        // Clear form
        this.clearPointForm(xInput, yInput, linesInput);
    }

    /**
     * Handle add line form submission
     */
    handleAddLine() {
        const pointsInput = document.getElementById('debugLinePoints');

        const formData = this.getAddLineFormData(pointsInput);

        if (!formData) {
            return; // Validation failed
        }

        // Call callback
        this.onAddLineCallback(formData.pointIndices);

        // Clear form
        this.clearLineForm(pointsInput);
    }

    /**
     * Extract and validate add point form data
     */
    getAddPointFormData(xInput, yInput, linesInput) {
        const x = parseFloat(xInput.value);
        const y = parseFloat(yInput.value);
        const linesStr = linesInput.value.trim();

        if (isNaN(x) || isNaN(y)) {
            alert('Please enter valid x and y coordinates');
            return null;
        }

        // Parse lines
        let onLines = [];
        if (linesStr) {
            const lines = this.configuration.getAllLines();
            onLines = linesStr.split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n >= 0 && n < lines.length);
        }

        return { x, y, onLines };
    }

    /**
     * Extract and validate add line form data
     */
    getAddLineFormData(pointsInput) {
        const pointsStr = pointsInput.value.trim();

        if (!pointsStr) {
            alert('Please enter at least 2 point indices');
            return null;
        }

        // Parse point indices
        const points = this.configuration.getAllPoints();
        const pointIndices = pointsStr.split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n >= 0 && n < points.length);

        if (pointIndices.length < 2) {
            alert('Need at least 2 valid point indices to create a line');
            return null;
        }

        return { pointIndices };
    }

    /**
     * Clear point form inputs
     */
    clearPointForm(xInput, yInput, linesInput) {
        xInput.value = '';
        yInput.value = '';
        linesInput.value = '';
    }

    /**
     * Clear line form inputs
     */
    clearLineForm(pointsInput) {
        pointsInput.value = '';
    }
}
