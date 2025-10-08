// debug-menu.js
// Debug UI for manually adding points and lines

import { getPointPosition } from '../geometry/geometry-utils.js';

export class DebugMenu {
    constructor(app) {
        this.app = app;
        this.geometryController = app.geometryController;
        this.geometryModel = app.geometryModel;

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

        // Listen for geometry changes to update lists
        this.geometryModel.subscribe(() => this.updateLists());

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
                .filter(n => !isNaN(n) && n >= 0 && n < this.geometryModel.lines.length);
        }

        // Add the point via controller
        this.geometryController.addPoint(x, y, onLines, onLines.length >= 2, null);

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
            .filter(n => !isNaN(n) && n >= 0 && n < this.geometryModel.points.length);

        if (pointIndices.length < 2) {
            alert('Need at least 2 valid point indices to create a line');
            return;
        }

        // Get positions of the points
        const p1 = this.geometryModel.points[pointIndices[0]];
        const p2 = this.geometryModel.points[pointIndices[1]];

        const pos1 = getPointPosition(p1, this.geometryModel.intersections);
        const pos2 = getPointPosition(p2, this.geometryModel.intersections);

        // Add the line via controller
        this.geometryController.addLine(
            pos1.x, pos1.y,
            pos2.x, pos2.y,
            [pointIndices[0]], // startPointIndices
            pointIndices.slice(1) // endPointIndices (all other points)
        );

        // Clear input
        pointsInput.value = '';

        console.log(`Added line through points [${pointIndices.join(', ')}]`);
    }

    updateLists() {
        this.updatePointsList();
        this.updateLinesList();
    }

    updatePointsList() {
        const listEl = document.getElementById('debugPointsList');

        if (this.geometryModel.points.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no points yet</div>';
            return;
        }

        const html = this.geometryModel.points.map((point, idx) => {
            const pos = getPointPosition(point, this.geometryModel.intersections);
            const linesStr = point.onLines.length > 0 ? `[${point.onLines.join(', ')}]` : '[]';
            return `<div style="padding: 4px 8px; border-bottom: 1px solid var(--border);">
                <strong>Point ${idx}:</strong> (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) on lines ${linesStr}
            </div>`;
        }).join('');

        listEl.innerHTML = html;
    }

    updateLinesList() {
        const listEl = document.getElementById('debugLinesList');

        if (this.geometryModel.lines.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 12px;">no lines yet</div>';
            return;
        }

        const html = this.geometryModel.lines.map((line, lineIdx) => {
            // Find all points on this line
            const pointsOnLine = [];
            this.geometryModel.points.forEach((point, pointIdx) => {
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
            points: this.geometryModel.points.map(p => {
                const pos = getPointPosition(p, this.geometryModel.intersections);
                return [
                    Math.round(pos.x * 10) / 10,
                    Math.round(pos.y * 10) / 10,
                    p.onLines
                ];
            })
        };

        // Format as a proper entry for examples.json with compact point arrays
        const pointsStr = config.points.map(p => `      ${JSON.stringify(p)}`).join(',\n');
        const json = `{
  "${key}": {
    "name": "${displayName}",
    "points": [
${pointsStr}
    ]
  }
}`;

        // Copy to clipboard
        navigator.clipboard.writeText(json).then(() => {
            alert('Configuration copied to clipboard!');
            console.log('Exported configuration:', json);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            console.log('Configuration (copy manually):', json);
            alert('Failed to copy. Check console for configuration.');
        });
    }

    clearAll() {
        if (!confirm('Clear all points and lines?')) {
            return;
        }

        this.geometryController.clearAll();
        console.log('Cleared all points and lines');
    }
}
