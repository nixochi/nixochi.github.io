// stats-view.js
// View for stats panel rendering

export class StatsView {
    constructor(panelContentElement) {
        this.panelContent = panelContentElement;
        this.currentView = 'general';
        this.paginationState = {
            bases: { offset: 0, batchSize: 50 },
            circuits: { offset: 0, batchSize: 50 },
            flats: { offset: 0, batchSize: 50 }
        };
        this.onHoverCallback = null;
        this.onUnhoverCallback = null;
    }

    /**
     * Set hover callbacks
     */
    setHoverCallbacks(onHover, onUnhover) {
        this.onHoverCallback = onHover;
        this.onUnhoverCallback = onUnhover;
    }

    /**
     * Set current view
     */
    setView(view) {
        this.currentView = view;
        this.resetPagination(view);
    }

    /**
     * Get current view
     */
    getView() {
        return this.currentView;
    }

    /**
     * Reset pagination
     */
    resetPagination(view = null) {
        if (view && this.paginationState[view]) {
            this.paginationState[view].offset = 0;
        } else if (!view) {
            this.paginationState.bases.offset = 0;
            this.paginationState.circuits.offset = 0;
            this.paginationState.flats.offset = 0;
        }
    }

    /**
     * Load more items (called on scroll)
     */
    loadMore(stats) {
        const view = this.currentView;
        if (view === 'bases' || view === 'circuits' || view === 'flats') {
            const totalItems = stats[view].length;
            const currentLimit = this.paginationState[view].offset + this.paginationState[view].batchSize;

            if (currentLimit < totalItems) {
                this.paginationState[view].offset += this.paginationState[view].batchSize;
                return true; // More items loaded
            }
        }
        return false; // No more items
    }

    /**
     * Render stats panel
     */
    render(stats, points, lines) {
        if (!stats) {
            this.panelContent.innerHTML = '<div class="empty-state">add points and lines to see matroid properties</div>';
            return;
        }

        if (this.currentView === 'general') {
            this._renderGeneral(stats, points, lines);
        } else if (this.currentView === 'bases') {
            this._renderList('bases', stats.bases, stats.bases.length);
        } else if (this.currentView === 'circuits') {
            this._renderList('circuits', stats.circuits, stats.circuits.length);
        } else if (this.currentView === 'flats') {
            this._renderList('flats', stats.flats, stats.flats.length);
        }
    }

    /**
     * Render general stats
     */
    _renderGeneral(stats, points, lines) {
        // Calculate Levi code
        let leviCode = 'irregular';
        if (stats.numPoints > 0 && stats.numLines > 0) {
            const linesPerPoint = points.map(p => p.onLines.length);
            const pointsPerLine = lines.map((line, lineIndex) =>
                points.filter(p => p.onLines.includes(lineIndex)).length
            );

            const allSameGamma = linesPerPoint.length > 0 && linesPerPoint.every(v => v === linesPerPoint[0]);
            const allSamePi = pointsPerLine.length > 0 && pointsPerLine.every(v => v === pointsPerLine[0]);

            if (allSameGamma && allSamePi && linesPerPoint[0] > 0) {
                const gamma = linesPerPoint[0];
                const pi = pointsPerLine[0];
                const p = stats.numPoints;
                const l = stats.numLines;

                if (p === l && gamma === pi) {
                    leviCode = `(${p}<sub>${gamma}</sub>)`;
                } else {
                    leviCode = `(${p}<sub>${gamma}</sub> ${l}<sub>${pi}</sub>)`;
                }
            }
        }

        this.panelContent.innerHTML = `
            <div style="font-size: 13px; line-height: 1.6;">
                <div><strong>Levi code:</strong> ${leviCode}</div>
                <div><strong>rank:</strong> ${stats.rank}</div>
                <div><strong>points:</strong> ${stats.numPoints}</div>
                <div><strong>lines:</strong> ${stats.numLines}</div>
                <div><strong>bases:</strong> ${stats.bases.length}</div>
                <div><strong>circuits:</strong> ${stats.circuits.length}</div>
                <div><strong>flats:</strong> ${stats.flats.length}</div>
            </div>
        `;
    }

    /**
     * Render paginated list
     */
    _renderList(viewType, items, totalCount) {
        if (items.length === 0) {
            this.panelContent.innerHTML = `<div class="empty-state">no ${viewType} yet</div>`;
            return;
        }

        const limit = this.paginationState[viewType].offset + this.paginationState[viewType].batchSize;
        const visibleItems = items.slice(0, limit);
        
        const itemsHtml = visibleItems.map((item) =>
            `<div class="matroid-item" data-points="${item.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${item.join(', ')}}</div>`
        ).join('');
        
        const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleItems.length} of ${totalCount}</div>`;
        
        this.panelContent.innerHTML = itemsHtml + countHtml;
        
        this._attachHoverListeners();
    }

    /**
     * Attach hover event listeners to matroid items
     */
    _attachHoverListeners() {
        const items = this.panelContent.querySelectorAll('.matroid-item');

        items.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const pointsStr = item.getAttribute('data-points');
                if (pointsStr && this.onHoverCallback) {
                    const points = pointsStr.split(',').map(Number).filter(n => !isNaN(n));
                    this.onHoverCallback(points);
                }
                item.style.background = 'color-mix(in srgb, var(--bg-secondary) 90%, var(--fg-primary) 10%)';
            });

            item.addEventListener('mouseleave', () => {
                if (this.onUnhoverCallback) {
                    this.onUnhoverCallback();
                }
                item.style.background = 'transparent';
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    /**
     * Clear backgrounds on all items
     */
    clearItemBackgrounds() {
        const items = this.panelContent.querySelectorAll('.matroid-item');
        items.forEach(item => {
            item.style.background = 'transparent';
        });
    }
}