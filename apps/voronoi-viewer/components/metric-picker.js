/**
 * Metric Picker Modal Component
 */

export const METRICS = [
    { id: "euclidean", name: "Euclidean (L2)", glyph: "circle", notes: "Rotationally symmetric; straight-line distance. Unit ball is a circle." },
    { id: "manhattan", name: "Manhattan (L1)", glyph: "diamond", notes: "Sum of absolute differences. Unit ball is a 45° diamond." },
    { id: "chebyshev", name: "Chebyshev (L∞)", glyph: "square", notes: "Max metric; distance equals the largest coordinate difference. Unit ball is a square." },
    { id: "minkowski15", name: "Minkowski (p=1.5)", glyph: "roundedDiamond", notes: "Interpolates between L1 and L2. Unit ball squarish with rounded corners." },
    { id: "weighted", name: "Weighted L2", glyph: "ellipse", notes: "Axis-aligned anisotropy; scales per-axis. Unit ball is an ellipse." },
    { id: "anisotropic", name: "Anisotropic", glyph: "rotatedEllipse", notes: "Full anisotropy with rotation. Unit ball is a rotated ellipse." },
    { id: "mahalanobis", name: "Mahalanobis", glyph: "tiltedEllipse", notes: "Covariance-aware distance; whitening transform. Unit ball is a tilted ellipse." },
    { id: "hex", name: "Hex Norm", glyph: "hexagon", notes: "Approximates circular distance with 6 directions; hexagonal unit ball." },
    { id: "taxicab-skew", name: "Skewed L1", glyph: "skewDiamond", notes: "L1 under shear/affine skew. Unit ball is a skewed diamond." },
    { id: "custom", name: "Custom Kernel", glyph: "star", notes: "Plug your own kernel here. Shape below is just a placeholder." },
];

function glyphSVG(kind) {
    const common = 'fill="none" stroke="currentColor" stroke-width="2"';
    switch(kind) {
        case 'circle': return `<svg viewBox="0 0 64 64" class="metric-glyph"><circle cx="32" cy="32" r="18" ${common}/></svg>`;
        case 'diamond': return `<svg viewBox="0 0 64 64" class="metric-glyph"><polygon points="32,12 52,32 32,52 12,32" ${common}/></svg>`;
        case 'square': return `<svg viewBox="0 0 64 64" class="metric-glyph"><rect x="14" y="14" width="36" height="36" ${common}/></svg>`;
        case 'roundedDiamond': return `<svg viewBox="0 0 64 64" class="metric-glyph"><path d="M32 10 C40 14, 50 24, 54 32 C50 40, 40 50, 32 54 C24 50, 14 40, 10 32 C14 24, 24 14, 32 10 Z" ${common}/></svg>`;
        case 'ellipse': return `<svg viewBox="0 0 64 64" class="metric-glyph"><ellipse cx="32" cy="32" rx="22" ry="14" ${common}/></svg>`;
        case 'rotatedEllipse': return `<svg viewBox="0 0 64 64" class="metric-glyph"><g transform="rotate(-30 32 32)"><ellipse cx="32" cy="32" rx="22" ry="12" ${common}/></g></svg>`;
        case 'tiltedEllipse': return `<svg viewBox="0 0 64 64" class="metric-glyph"><g transform="rotate(20 32 32)"><ellipse cx="32" cy="32" rx="20" ry="14" ${common}/></g></svg>`;
        case 'hexagon': return `<svg viewBox="0 0 64 64" class="metric-glyph"><polygon points="32,10 48,20 48,44 32,54 16,44 16,20" ${common}/></svg>`;
        case 'skewDiamond': return `<svg viewBox="0 0 64 64" class="metric-glyph"><g transform="skewX(20)"><polygon points="32,12 52,32 32,52 12,32" ${common}/></g></svg>`;
        case 'star': return `<svg viewBox="0 0 64 64" class="metric-glyph"><path d="M32 10 L37 26 L54 26 L40 36 L46 52 L32 42 L18 52 L24 36 L10 26 L27 26 Z" ${common}/></svg>`;
        default: return '';
    }
}

export class MetricPicker {
    constructor() {
        this.selectedMetric = METRICS[0];
        this.metricMode = 'exact';
        this.onSelect = null;
        this.isFirstTime = true;
    }

    init() {
        this.renderMetricChips();
        this.updateMetricDetail();
        this.setupEventListeners();

        // Show the modal now that everything is ready
        if (this.isFirstTime) {
            const modal = document.getElementById('metricPickerRoot');
            const loadingScreen = document.getElementById('loadingScreen');

            modal.style.display = 'grid';
            // Force a reflow to ensure display is set before removing hidden class
            modal.offsetHeight;
            modal.classList.remove('hidden');

            // Hide loading screen
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 300);
            }
        }
    }

    renderMetricChips() {
        const grid = document.getElementById('metricChipGrid');
        grid.innerHTML = '';
        METRICS.forEach(m => {
            const chip = document.createElement('button');
            chip.className = 'metric-chip' + (m.id === this.selectedMetric.id ? ' active' : '');
            chip.innerHTML = `${glyphSVG(m.glyph)}<span>${m.name}</span>`;
            chip.addEventListener('click', () => {
                this.selectedMetric = m;
                this.updateMetricDetail();
                this.renderMetricChips();
            });
            grid.appendChild(chip);
        });
    }

    updateMetricDetail() {
        document.getElementById('metricDetailGlyph').innerHTML = glyphSVG(this.selectedMetric.glyph);
        document.getElementById('metricDetailTitle').textContent = this.selectedMetric.name;
        document.getElementById('metricDetailNotes').textContent = this.selectedMetric.notes;
    }

    closeMetricPicker() {
        const modal = document.getElementById('metricPickerRoot');
        modal.classList.add('hidden');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);

        // On first close, show the app
        if (this.isFirstTime) {
            this.showApp();
            this.isFirstTime = false;
        }
    }

    openMetricPicker() {
        const modal = document.getElementById('metricPickerRoot');
        modal.style.display = 'grid';
        modal.classList.remove('hidden');

        // Update UI based on whether this is first time or not
        const label = modal.querySelector('.label');
        const description = modal.querySelector('.top p');
        const cancelBtn = document.getElementById('metricCancelBtn');
        const selectBtn = document.getElementById('metricSelectBtn');

        if (this.isFirstTime) {
            label.textContent = 'Welcome to Voronoi Viewer';
            description.textContent = 'Choose a distance metric to begin exploring Voronoi diagrams';
            cancelBtn.textContent = 'Use Default';
            selectBtn.textContent = 'Start';
        } else {
            label.textContent = 'Choose a metric';
            description.textContent = 'Select a different distance metric for the Voronoi diagram';
            cancelBtn.textContent = 'Cancel';
            selectBtn.textContent = 'Select';
        }
    }

    showApp() {
        // Show the viewer with fade-in
        const viewer = document.getElementById('viewer');
        const optionsBtn = document.getElementById('optionsBtn');
        const metricBtn = document.getElementById('metricBtn');

        viewer.style.transition = 'opacity 0.6s ease';
        viewer.style.opacity = '1';
        viewer.style.pointerEvents = 'auto';

        optionsBtn.style.display = 'block';
        metricBtn.style.display = 'block';
    }

    setupEventListeners() {
        // Metric toggle buttons
        document.getElementById('metricExact').addEventListener('click', () => {
            this.metricMode = 'exact';
            document.getElementById('metricExact').classList.add('active');
            document.getElementById('metricApprox').classList.remove('active');
        });

        document.getElementById('metricApprox').addEventListener('click', () => {
            this.metricMode = 'approx';
            document.getElementById('metricApprox').classList.add('active');
            document.getElementById('metricExact').classList.remove('active');
        });

        // Cancel button
        document.getElementById('metricCancelBtn').addEventListener('click', () => {
            this.closeMetricPicker();
        });

        // Select button
        document.getElementById('metricSelectBtn').addEventListener('click', () => {
            console.log('Selected metric:', this.selectedMetric.id, 'Mode:', this.metricMode);
            if (this.onSelect) {
                this.onSelect(this.selectedMetric, this.metricMode);
            }
            this.closeMetricPicker();
        });

        // Open metric picker when metric button is clicked
        document.getElementById('metricBtn').addEventListener('click', () => {
            this.openMetricPicker();
        });

        // Close on backdrop click (only if not first time)
        document.getElementById('metricBackdrop').addEventListener('click', () => {
            if (!this.isFirstTime) {
                this.closeMetricPicker();
            }
        });
    }
}
