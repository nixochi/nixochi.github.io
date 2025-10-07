// debug-menu.js
// Debug UI for manually adding points and lines

export class DebugMenu {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.pointLineManager = canvasManager.pointLineManager;

        // UI elements
        this.panel = null;
        this.button = null;
        this.isVisible = false;

        this.init();
    }

    init() {
        this.button = document.getElementById('debugBtn');
        this.panel = document.getElementById('debugPanel');

        if (!this.button || !this.panel) {
            console.error('Debug menu elements not found');
            return;
        }

        // Setup button toggle
        this.button.addEventListener('click', () => this.toggle());

        // Setup add point button
        const addPointBtn = document.getElementById('debugAddPointBtn');
        addPointBtn.addEventListener('click', () => this.addPoint());

        // Setup add line button
        const addLineBtn = document.getElementById('debugAddLineBtn');
        addLineBtn.addEventListener('click', () => this.addLine());

        // Setup export button
        const exportBtn = document.getElementById('debugExportBtn');
        exportBtn.addEventListener('click', () => this.exportConfig());

        // Setup clear all button
        const clearAllBtn = document.getElementById('debugClearAllBtn');
        clearAllBtn.addEventListener('click', () => this.clearAll());

        // Listen for state changes to update lists
        const originalCallback = this.pointLineManager.onStateChange;
        this.pointLineManager.onStateChange = () => {
            if (originalCallback) originalCallback();
            this.updateLists();
        };

        // Initial update
        this.updateLists();
    }

    toggle() {
        this.isVisible = !this.isVisible;

        if (this.isVisible) {
            this.panel.style.display = 'block';
            this.panel.offsetHeight; // Force reflow
            this.panel.classList.add('expanded');
            this.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            this.button.title = 'close debug menu';
        } else {
            this.panel.classList.remove('expanded');
            setTimeout(() => {
                if (!this.isVisible) {
                    this.panel.style.display = 'none';
                }
            }, 300);
            this.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>';
            this.button.title = 'open debug menu';
        }
    }

    addPoint() {
        const xInput = document.getElementById('debugPointX');
        const yInput = document.getElementById('debugPointY');
        const linesInput = document.getElementById('debugPointLines');

        const x = parseFloat(xInput.value);
        const y = parseFloat(yInput.value);
        const linesStr = linesInput.value.trim();

        if (isNaN(x) || isNaN(y)) {
            alert('Please enter valid x and y coordinates');
            return;
        }

        // Parse lines
        let onLines = [];
        if (linesStr) {
            onLines = linesStr.split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n >= 0 && n < this.pointLineManager.lines.length);
        }

        // Add the point
        this.pointLineManager.addPoint(x, y, onLines, onLines.length >= 2, null);

        // Clear inputs
        xInput.value = '';
        yInput.value = '';
        linesInput.value = '';

        console.log(`Added point at (${x}, ${y}) on lines [${onLines.join(', ')}]`);
    }

    addLine() {
        const pointsInput = document.getElementById('debugLinePoints');
        const pointsStr = pointsInput.value.trim();

        if (!pointsStr) {
            alert('Please enter at least 2 point indices');
            return;
        }

        // Parse point indices
        const pointIndices = pointsStr.split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n >= 0 && n < this.pointLineManager.points.length);

        if (pointIndices.length < 2) {
            alert('Need at least 2 valid point indices to create a line');
            return;
        }

        // Get positions of the points
        const p1 = this.pointLineManager.points[pointIndices[0]];
        const p2 = this.pointLineManager.points[pointIndices[1]];

        const pos1 = this.getPointPosition(p1);
        const pos2 = this.getPointPosition(p2);

        // Add the line
        this.pointLineManager.addLine(
            pos1.x, pos1.y,
            pos2.x, pos2.y,
            [pointIndices[0]], // startPointIndices
            pointIndices.slice(1) // endPointIndices (all other points)
        );

        // Clear input
        pointsInput.value = '';

        console.log(`Added line through points [${pointIndices.join(', ')}]`);
    }

    getPointPosition(point) {
        if (point.isIntersection && point.intersectionIndex !== null) {
            const intersection = this.pointLineManager.intersections[point.intersectionIndex];
            return { x: intersection.x, y: intersection.y };
        }
        return { x: point.x, y: point.y };
    }

    updateLists() {
        this.updatePointsList();
        this.updateLinesList();
    }

    updatePointsList() {
        const listEl = document.getElementById('debugPointsList');

        if (this.pointLineManager.points.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no points yet</div>';
            return;
        }

        const html = this.pointLineManager.points.map((point, idx) => {
            const pos = this.getPointPosition(point);
            const linesStr = point.onLines.length > 0 ? `[${point.onLines.join(', ')}]` : '[]';
            return `<div style="padding: 4px 8px; border-bottom: 1px solid var(--border);">
                <strong>Point ${idx}:</strong> (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) on lines ${linesStr}
            </div>`;
        }).join('');

        listEl.innerHTML = html;
    }

    updateLinesList() {
        const listEl = document.getElementById('debugLinesList');

        if (this.pointLineManager.lines.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no lines yet</div>';
            return;
        }

        const html = this.pointLineManager.lines.map((line, lineIdx) => {
            // Find all points on this line
            const pointsOnLine = [];
            this.pointLineManager.points.forEach((point, pointIdx) => {
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

    exportConfig() {
        // Ask for configuration name
        const configName = prompt('Enter a name for this configuration:');
        if (!configName || !configName.trim()) {
            alert('Export cancelled - name is required');
            return;
        }

        const key = configName.trim().toLowerCase().replace(/\s+/g, '-');
        const displayName = configName.trim();

        const config = {
            name: displayName,
            points: this.pointLineManager.points.map(p => {
                const pos = this.getPointPosition(p);
                return [
                    Math.round(pos.x * 10) / 10,
                    Math.round(pos.y * 10) / 10,
                    p.onLines
                ];
            })
        };

        // Format as a proper entry for examples.json
        const entry = {
            [key]: config
        };

        const json = JSON.stringify(entry, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(json).then(() => {
            alert('Configuration copied to clipboard!');
            console.log('Exported configuration:', json);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            // Fallback: show in console
            console.log('Configuration (copy manually):', json);
            alert('Failed to copy. Check console for configuration.');
        });
    }

    clearAll() {
        if (!confirm('Clear all points and lines?')) {
            return;
        }

        this.pointLineManager.points = [];
        this.pointLineManager.lines = [];
        this.pointLineManager.intersections = [];

        if (this.pointLineManager.onStateChange) {
            this.pointLineManager.onStateChange();
        }

        this.canvasManager.draw();

        console.log('Cleared all points and lines');
    }
}
