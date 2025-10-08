// Import components
import './components/voronoi-viewer.js';
import { PALETTES } from './lib/palette.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // ======================== VORONOI VIEWER ========================
    const viewer = document.getElementById('viewer');

    // Setup palette selector
    const paletteGrid = document.getElementById('paletteGrid');
    let currentPaletteId = 'vibrant';

    PALETTES.forEach(palette => {
        const swatch = document.createElement('div');
        swatch.className = 'palette-swatch' + (palette.id === currentPaletteId ? ' active' : '');
        swatch.title = palette.name;

        // Create color stripes
        palette.colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'palette-swatch-color';
            colorDiv.style.backgroundColor = color;
            swatch.appendChild(colorDiv);
        });

        swatch.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            currentPaletteId = palette.id;

            // Update viewer palette
            viewer.setPalette(palette.id);
        });

        paletteGrid.appendChild(swatch);
    });

    const optionsBtn = document.getElementById('optionsBtn');
    const controlsPanel = document.getElementById('controlsPanel');

    // Show options button and panel on load since we disabled the metric picker
    optionsBtn.style.display = 'block';

    let panelVisible = false;
    optionsBtn.textContent = 'Options';

    optionsBtn.addEventListener('click', () => {
        panelVisible = !panelVisible;
        if (panelVisible) {
            controlsPanel.style.display = 'block';
            controlsPanel.offsetHeight;
            controlsPanel.classList.add('expanded');
            optionsBtn.textContent = 'Close';

            // Update resolution indicator position now that panel is visible
            const activeResolution = document.querySelector('.resolution-switch-option.active');
            if (activeResolution) {
                // Use setTimeout to ensure the panel has fully rendered
                setTimeout(() => {
                    updateResolutionIndicator(activeResolution);
                }, 50);
            }
        } else {
            controlsPanel.classList.remove('expanded');
            setTimeout(() => {
                if (!panelVisible) {
                    controlsPanel.style.display = 'none';
                }
            }, 300);
            optionsBtn.textContent = 'Options';
        }
    });

    const edgesToggle = document.getElementById('edgesToggle');
    const sitesToggle = document.getElementById('sitesToggle');
    const resolutionSwitch = document.getElementById('resolutionSwitch');
    const resolutionSwitchIndicator = document.getElementById('resolutionSwitchIndicator');
    const resolutionOptions = document.querySelectorAll('.resolution-switch-option');
    const animateToggle = document.getElementById('animateToggle');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const infinityToggle = document.getElementById('infinityToggle');
    const metricSlider = document.getElementById('metricSlider');
    const metricValue = document.getElementById('metricValue');
    const clearBtn = document.getElementById('clearBtn');
    const randomBtn = document.getElementById('randomBtn');
    const gridBtn = document.getElementById('gridBtn');
    const algorithmSelect = document.getElementById('algorithmSelect');

    // Setup edges toggle
    edgesToggle.addEventListener('click', () => {
        edgesToggle.classList.toggle('active');
        const isActive = edgesToggle.classList.contains('active');
        viewer.setShowEdges(isActive);
    });

    // Setup sites toggle
    sitesToggle.addEventListener('click', () => {
        sitesToggle.classList.toggle('active');
        const isActive = sitesToggle.classList.contains('active');
        viewer.setShowSites(isActive);
    });

    // Setup resolution switch
    function updateResolutionIndicator(activeOption) {
        const index = Array.from(resolutionOptions).indexOf(activeOption);
        const optionWidth = activeOption.offsetWidth;
        const optionLeft = activeOption.offsetLeft;
        resolutionSwitchIndicator.style.width = `${optionWidth}px`;
        resolutionSwitchIndicator.style.transform = `translateX(${optionLeft - 2}px)`;
    }

    resolutionOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            resolutionOptions.forEach(opt => opt.classList.remove('active'));
            // Add active class to clicked option
            option.classList.add('active');
            // Update indicator position
            updateResolutionIndicator(option);
            // Update viewer resolution
            const resolution = parseFloat(option.dataset.resolution);
            viewer.setResolutionScale(resolution);
        });
    });

    // Initialize indicator position
    const activeResolution = document.querySelector('.resolution-switch-option.active');
    if (activeResolution) {
        updateResolutionIndicator(activeResolution);
    }

    // Setup animation toggle
    animateToggle.addEventListener('click', () => {
        animateToggle.classList.toggle('active');
        const isActive = animateToggle.classList.contains('active');
        viewer.setAnimation(isActive);
    });

    // Setup animation speed slider
    speedSlider.addEventListener('input', () => {
        const speed = parseFloat(speedSlider.value);
        speedValue.textContent = `${speed.toFixed(1)}x`;
        viewer.setAnimationSpeed(speed);
    });

    // Metric slider
    function updateMetricDisplay() {
        const p = parseFloat(metricSlider.value);
        const isInfinity = infinityToggle.classList.contains('active');

        if (isInfinity) {
            metricValue.textContent = 'L∞ (Chebyshev)';
            viewer.setAttribute('metric-p', 'infinity');
        } else {
            if (p === 1) {
                metricValue.textContent = 'L₁ (Manhattan)';
            } else if (p === 2) {
                metricValue.textContent = 'L₂ (Euclidean)';
            } else {
                metricValue.textContent = `L_${p.toFixed(1)}`;
            }
            viewer.setAttribute('metric-p', p.toString());
        }
    }

    metricSlider.addEventListener('input', (e) => {
        infinityToggle.classList.remove('active');
        updateMetricDisplay();
    });

    infinityToggle.addEventListener('click', () => {
        infinityToggle.classList.toggle('active');
        updateMetricDisplay();
    });

    // Algorithm selector
    algorithmSelect.addEventListener('change', () => {
        const extraPasses = parseInt(algorithmSelect.value);
        viewer.setJFAExtraPasses(extraPasses);
    });

    // Action buttons
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', () => {
        // Get canvas directly from viewer (no shadow DOM)
        const canvas = viewer.canvas || viewer.querySelector('canvas');
        if (canvas) {
            try {
                // Use toDataURL for WebGL canvas
                const dataURL = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                link.download = `voronoi-diagram-${timestamp}.png`;
                link.href = dataURL;
                link.click();
            } catch (e) {
                console.error('Export failed:', e);
                alert('Failed to export image. Please try again.');
            }
        }
    });

    clearBtn.addEventListener('click', () => {
        viewer.clearAll();
    });

    randomBtn.addEventListener('click', () => {
        viewer.addRandomPoints(5);
    });

    gridBtn.addEventListener('click', () => {
        viewer.generateGrid();
    });

    // Initial setup
    metricValue.textContent = 'L₂ (Euclidean)';
});
