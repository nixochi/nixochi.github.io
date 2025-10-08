// StatsView.js
// Renders stats panel HTML - just rendering, all hover logic delegated to callbacks

/**
 * Stats panel view - renders matroid statistics.
 * Never modifies state - delegates all interactions to callbacks.
 */
export class StatsView {
    constructor(element, matroidComputer, uiState, configuration, onItemHoverCallback, onItemUnhoverCallback) {
        this.element = element;
        this.matroidComputer = matroidComputer;
        this.uiState = uiState;
        this.configuration = configuration;
        this.onItemHoverCallback = onItemHoverCallback;
        this.onItemUnhoverCallback = onItemUnhoverCallback;
    }

    /**
     * Main render function - called by app.js when relevant state changes
     */
    render() {
        const currentView = this.uiState.getCurrentStatsView();

        // Compute matroid
        const matroid = this.matroidComputer.compute();

        // Check if empty
        if (!matroid) {
            this.element.innerHTML = '<div class="empty-state">add points and lines to see matroid properties</div>';
            return;
        }

        // Render based on view
        switch (currentView) {
            case 'general':
                this.renderGeneral(matroid);
                break;
            case 'bases':
                this.renderBases(matroid.bases);
                break;
            case 'circuits':
                this.renderCircuits(matroid.circuits);
                break;
            case 'flats':
                this.renderFlats(matroid.flats);
                break;
        }

        // Attach hover listeners after rendering
        this.attachHoverListeners();

        // Setup scroll listener for pagination
        this.setupScrollListener();
    }

    /**
     * Render general stats view
     */
    renderGeneral(matroid) {
        // Calculate Levi code
        const leviCode = this.calculateLeviCode(matroid);

        this.element.innerHTML = `
            <div style="font-size: 13px; line-height: 1.6;">
                <div><strong>Levi code:</strong> ${leviCode}</div>
                <div><strong>rank:</strong> ${matroid.rank}</div>
                <div><strong>points:</strong> ${matroid.numPoints}</div>
                <div><strong>lines:</strong> ${matroid.numLines}</div>
                <div><strong>bases:</strong> ${matroid.bases.length}</div>
                <div><strong>circuits:</strong> ${matroid.circuits.length}</div>
                <div><strong>flats:</strong> ${matroid.flats.length}</div>
            </div>
        `;
    }

    /**
     * Render bases list with pagination
     */
    renderBases(bases) {
        if (bases.length === 0) {
            this.element.innerHTML = '<div class="empty-state">no bases yet</div>';
            return;
        }

        const pagination = this.uiState.getStatsPagination('bases');
        const limit = pagination.offset + pagination.batchSize;
        const visibleBases = bases.slice(0, limit);

        const basesHtml = visibleBases.map((base) =>
            `<div class="matroid-item" data-points="${base.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${base.join(', ')}}</div>`
        ).join('');

        const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleBases.length} of ${bases.length}</div>`;

        this.element.innerHTML = basesHtml + countHtml;
    }

    /**
     * Render circuits list with pagination
     */
    renderCircuits(circuits) {
        if (circuits.length === 0) {
            this.element.innerHTML = '<div class="empty-state">no circuits yet</div>';
            return;
        }

        const pagination = this.uiState.getStatsPagination('circuits');
        const limit = pagination.offset + pagination.batchSize;
        const visibleCircuits = circuits.slice(0, limit);

        const circuitsHtml = visibleCircuits.map((circuit) =>
            `<div class="matroid-item" data-points="${circuit.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${circuit.join(', ')}}</div>`
        ).join('');

        const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleCircuits.length} of ${circuits.length}</div>`;

        this.element.innerHTML = circuitsHtml + countHtml;
    }

    /**
     * Render flats list with pagination
     */
    renderFlats(flats) {
        if (flats.length === 0) {
            this.element.innerHTML = '<div class="empty-state">no flats yet</div>';
            return;
        }

        const pagination = this.uiState.getStatsPagination('flats');
        const limit = pagination.offset + pagination.batchSize;
        const visibleFlats = flats.slice(0, limit);

        const flatsHtml = visibleFlats.map((flat) =>
            `<div class="matroid-item" data-points="${flat.join(',')}" style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease;">{${flat.join(', ')}}</div>`
        ).join('');

        const countHtml = `<div style="padding: 8px; color: var(--fg-secondary); font-size: 12px;">showing ${visibleFlats.length} of ${flats.length}</div>`;

        this.element.innerHTML = flatsHtml + countHtml;
    }

    /**
     * Attach hover listeners to matroid items
     */
    attachHoverListeners() {
        const items = this.element.querySelectorAll('.matroid-item');

        items.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const pointsStr = item.getAttribute('data-points');
                if (pointsStr) {
                    const points = pointsStr.split(',').map(Number).filter(n => !isNaN(n));
                    this.onItemHoverCallback(points);
                }
                item.style.background = 'color-mix(in srgb, var(--bg-secondary) 90%, var(--fg-primary) 10%)';
            });

            item.addEventListener('mouseleave', () => {
                this.onItemUnhoverCallback();
                item.style.background = 'transparent';
            });

            // Prevent clearing highlight on click
            item.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    /**
     * Setup scroll listener for pagination
     */
    setupScrollListener() {
        // Remove existing listener to avoid duplicates
        this.element.removeEventListener('scroll', this._handleScroll);

        // Bind and store the handler
        this._handleScroll = () => {
            const scrollPercentage = (this.element.scrollTop + this.element.clientHeight) / this.element.scrollHeight;

            // Load more when scrolled 80% down
            if (scrollPercentage > 0.8) {
                const currentView = this.uiState.getCurrentStatsView();
                if (currentView === 'bases' || currentView === 'circuits' || currentView === 'flats') {
                    this.uiState.loadMoreStats(currentView);
                }
            }
        };

        this.element.addEventListener('scroll', this._handleScroll);
    }

    /**
     * Calculate Levi code for configuration
     */
    calculateLeviCode(matroid) {
        if (matroid.numPoints === 0 || matroid.numLines === 0) {
            return 'irregular';
        }

        const points = this.configuration.getAllPoints();
        const lines = this.configuration.getAllLines();

        // Calculate γ (lines per point) and π (points per line)
        const linesPerPoint = points.map(p => p.onLines.length);
        const pointsPerLine = lines.map((line, lineIndex) =>
            points.filter(p => p.onLines.includes(lineIndex)).length
        );

        // Check if configuration is regular (all same values)
        const allSameGamma = linesPerPoint.length > 0 && linesPerPoint.every(v => v === linesPerPoint[0]);
        const allSamePi = pointsPerLine.length > 0 && pointsPerLine.every(v => v === pointsPerLine[0]);

        if (allSameGamma && allSamePi && linesPerPoint[0] > 0) {
            const gamma = linesPerPoint[0];
            const pi = pointsPerLine[0];
            const p = matroid.numPoints;
            const l = matroid.numLines;

            // Use subscript formatting
            if (p === l && gamma === pi) {
                // Balanced configuration: (p_γ)
                return `(${p}<sub>${gamma}</sub>)`;
            } else {
                // Non-balanced: (p_γ ℓ_π)
                return `(${p}<sub>${gamma}</sub> ${l}<sub>${pi}</sub>)`;
            }
        }

        return 'irregular';
    }
}
