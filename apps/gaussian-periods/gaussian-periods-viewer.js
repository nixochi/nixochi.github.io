/**
 * Gaussian Periods Viewer Web Component
 * Canvas-based rendering with WebGPU acceleration
 */
import { GaussianPeriodsGPUCompute } from './gaussian-compute-gpu.js';

class GaussianPeriodsViewer extends HTMLElement {
    static get observedAttributes() {
        return ['n', 'omega', 'point-size', 'show-grid', 'color-scheme', 'plot-mode', 'lutz-c', 'time-first-color', 'time-last-color'];
    }

    constructor() {
        super();
        console.log('🎯 GaussianPeriodsViewer constructor called');

        // Core state
        this.computedPoints = [];
        this.animationIndex = 0;
        this.isPaused = false;

        // Canvas rendering
        this.canvas = null;
        this.ctx = null;

        // View state
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.computedScaleFactor = 0.1;

        // Lutz coloring cache
        this.lutzColoring = null;

        // Animation
        this.animationId = null;
        this._ro = null;

        // WebGPU compute
        this.gpuCompute = null;
        this.gpuAvailable = false;
        this.useGPU = false;
    }

    connectedCallback() {
        console.log('🔗 GaussianPeriodsViewer connected to DOM');

        this.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                position: relative;
                overflow: hidden;
                background: #0a0a0a;
            ">
                <canvas id="gaussianCanvas" style="
                    width: 100%;
                    height: 100%;
                    display: block;
                    image-rendering: crisp-edges;
                "></canvas>

                <div id="errorMessage" style="
                    position: absolute;
                    inset: 0;
                    display: none;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    color: #dc3545;
                    text-align: center;
                    background: rgba(248, 249, 250, 0.95);
                    backdrop-filter: blur(4px);
                    border-radius: 8px;
                    padding: 20px;
                ">
                    <div style="font-size: 32px;">⚠️</div>
                    <div style="font-size: 14px; font-weight: 500;">Failed to load Gaussian Periods viewer</div>
                    <div id="errorDetails" style="font-size: 12px; opacity: 0.8;"></div>
                </div>

                <div id="debugInfo" style="
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    background: rgba(0, 0, 0, 0.85);
                    color: #00ff00;
                    padding: 8px 12px;
                    border-radius: 4px;
                    pointer-events: none;
                    z-index: 10000;
                    white-space: pre-wrap;
                    max-width: 400px;
                ">Initializing...</div>
            </div>
        `;

        this.parseAttributes();
        this.initialize().catch(err => {
            console.error('❌ GaussianPeriodsViewer initialization error:', err);
            this.showError(err.message || 'Unknown error occurred');
        });

        console.log('✅ GaussianPeriodsViewer HTML rendered successfully');
    }

    disconnectedCallback() {
        console.log('🔌 GaussianPeriodsViewer disconnected from DOM');

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this._ro) {
            this._ro.disconnect();
        }

        if (this.gpuCompute) {
            this.gpuCompute.destroy();
            this.gpuCompute = null;
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`🔄 GaussianPeriodsViewer attribute changed: ${name} = ${newValue}`);

        if (!this.canvas) return;

        if (name === 'n' || name === 'omega') {
            this.computePeriods();
        } else if (name === 'point-size') {
            this.redrawAll();
        } else if (name === 'show-grid') {
            this.redrawAll();
        } else if (name === 'color-scheme') {
            this.lutzColoring = null; // Clear cache
            this.redrawAll();
        } else if (name === 'lutz-c') {
            if (this.getParameter('colorScheme') === 'lutz') {
                this.lutzColoring = null;
                this.redrawAll();
            }
        } else if (name === 'time-first-color' || name === 'time-last-color') {
            if (this.getParameter('colorScheme') === 'time-based') {
                this.redrawAll();
            }
        } else if (name === 'plot-mode') {
            this.updatePlotMode(newValue);
        }
    }

    parseAttributes() {
        console.log('📝 Parsing attributes');
    }

    getParameter(name, defaultValue = null) {
        switch (name) {
            case 'n': return parseInt(this.getAttribute('n')) || 91205;
            case 'omega': return parseInt(this.getAttribute('omega')) || 2337;
            case 'pointSize': return parseFloat(this.getAttribute('point-size')) || 2.0;
            case 'showGrid': return this.getAttribute('show-grid') === 'true';
            case 'colorScheme': return this.getAttribute('color-scheme') || 'time-based';
            case 'plotMode': return this.getAttribute('plot-mode') || 'animated';
            case 'animationSpeed': return parseInt(this.getAttribute('animation-speed')) || 1000;
            case 'timeFirstColor': return this.getAttribute('time-first-color') || '#0000ff';
            case 'timeLastColor': return this.getAttribute('time-last-color') || '#00ff00';
            case 'autoZoom': return this.getAttribute('auto-zoom') !== 'false';
            case 'lutzC': return parseInt(this.getAttribute('lutz-c')) || 12;
            default: return defaultValue;
        }
    }

    async initialize() {
        console.log('🚀 Initializing GaussianPeriodsViewer...');

        // Initialize WebGPU compute
        this.gpuCompute = new GaussianPeriodsGPUCompute();
        this.gpuAvailable = await this.gpuCompute.initialize();
        this.useGPU = this.gpuAvailable;

        if (this.gpuAvailable) {
            console.log('✅ WebGPU available - GPU acceleration ready');
        } else {
            console.log('⚠️ WebGPU not available - using CPU computation');
            this.dispatchEvent(new CustomEvent('gpu-unavailable'));
        }

        this.setupCanvas();
        this.setupResizeObserver();
        this.startAnimationLoop();

        await this.computePeriods();

        console.log('✅ GaussianPeriodsViewer initialization complete');
    }

    setupCanvas() {
        this.canvas = this.querySelector('#gaussianCanvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.resizeCanvas();

        console.log('✅ Canvas setup complete');
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);

        console.log(`📐 Canvas resized to ${rect.width}x${rect.height} (${this.canvas.width}x${this.canvas.height} actual)`);

        // Redraw if we have points
        if (this.computedPoints.length > 0) {
            this.redrawAll();
        }
    }

    setupResizeObserver() {
        this._ro = new ResizeObserver(() => {
            this.resizeCanvas();
        });
        this._ro.observe(this.canvas);
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.renderFrame();
        };
        animate();
        console.log('🎬 Animation loop started');
    }

    renderFrame() {
        const plotMode = this.getParameter('plotMode');

        if (plotMode === 'animated' && !this.isPaused && this.animationIndex < this.computedPoints.length) {
            const speed = this.getParameter('animationSpeed');
            const pointsToDraw = Math.min(speed, this.computedPoints.length - this.animationIndex);

            this.drawPointsBatch(this.animationIndex, this.animationIndex + pointsToDraw);
            this.animationIndex += pointsToDraw;
        }
    }

    async computePeriods() {
        const n = this.getParameter('n');
        const omega = this.getParameter('omega');

        console.log(`Computing Gaussian Periods for n=${n}, omega=${omega}...`);

        if (this.gcd(omega, n) !== 1) {
            console.error(`Invalid parameters: omega=${omega} must be coprime to n=${n}`);
            return;
        }

        this.clearVisualization();

        const d = this.multiplicativeOrder(omega, n);
        console.log(`Multiplicative order d = ${d}`);

        const omegaPowers = new Uint32Array(d);
        omegaPowers[0] = 1;
        for (let j = 1; j < d; j++) {
            omegaPowers[j] = (omegaPowers[j - 1] * omega) % n;
        }

        const cosValues = new Float32Array(n);
        const sinValues = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const angle = 2 * Math.PI * i / n;
            cosValues[i] = Math.cos(angle);
            sinValues[i] = Math.sin(angle);
        }

        const gcdND = this.gcd(n, d);
        const bound = Math.min(n, Math.floor(n / gcdND * d));

        // Track computation timing and method
        const startTime = performance.now();
        let computeMethod = '';

        // Use GPU computation if available, otherwise fall back to CPU
        let errorMessage = null;
        if (this.useGPU && this.gpuAvailable) {
            try {
                this.computedPoints = await this.gpuCompute.computePeriods(
                    n, omega, omegaPowers, cosValues, sinValues, bound, d
                );
                computeMethod = 'GPU';
                console.log(`✅ GPU computed ${this.computedPoints.length} points`);
            } catch (error) {
                console.error('❌ GPU computation failed:', error);
                console.error('Error details:', error.message, error.stack);
                errorMessage = error.message || 'Unknown GPU error';
                this.computedPoints = this.computePeriodsOnCPU(n, omegaPowers, cosValues, sinValues, bound, d);
                computeMethod = 'CPU (GPU error)';
            }
        } else {
            this.computedPoints = this.computePeriodsOnCPU(n, omegaPowers, cosValues, sinValues, bound, d);
            if (!this.gpuAvailable) {
                computeMethod = 'CPU (no GPU)';
            } else {
                computeMethod = 'CPU (GPU off)';
            }
        }

        const computeTime = performance.now() - startTime;

        // Update debug display
        this.updateDebugInfo(computeMethod, computeTime, bound, errorMessage);

        if (this.getParameter('autoZoom')) {
            this.computedScaleFactor = this.calculateAutoZoom(this.computedPoints);
            console.log(`Auto-zoom scale factor: ${this.computedScaleFactor}`);
        } else {
            this.computedScaleFactor = 0.1;
        }

        const plotMode = this.getParameter('plotMode');
        if (plotMode === 'animated') {
            this.animationIndex = 0;
        } else {
            this.animationIndex = this.computedPoints.length;
            this.redrawAll();
        }
    }

    /**
     * CPU-based Gaussian periods computation (fallback)
     */
    computePeriodsOnCPU(n, omegaPowers, cosValues, sinValues, bound, d) {
        console.log(`🖥️ Computing ${bound} points on CPU...`);
        const startTime = performance.now();

        const points = [];
        for (let k = 0; k < bound; k++) {
            let sumReal = 0;
            let sumImag = 0;

            for (let j = 0; j < d; j++) {
                const omegaPower = omegaPowers[j];
                const exponent = (k * omegaPower) % n;

                sumReal += cosValues[exponent];
                sumImag += sinValues[exponent];
            }

            points.push({
                x: sumReal,
                y: sumImag,
                k: k,
                real: sumReal,
                imag: sumImag,
                magnitude: Math.sqrt(sumReal * sumReal + sumImag * sumImag),
                argument: Math.atan2(sumImag, sumReal)
            });
        }

        const elapsed = performance.now() - startTime;
        console.log(`✅ CPU computation completed in ${elapsed.toFixed(2)}ms`);

        return points;
    }

    calculateAutoZoom(points) {
        if (points.length === 0) return 0.1;

        let maxDist = 0;
        for (const point of points) {
            const dist = Math.sqrt(point.real * point.real + point.imag * point.imag);
            if (dist > maxDist) maxDist = dist;
        }

        const rect = this.canvas.getBoundingClientRect();
        const canvasSize = Math.min(rect.width, rect.height);
        const targetSize = canvasSize * 0.8;

        return maxDist > 0 ? targetSize / (2 * maxDist) : 0.1;
    }

    /**
     * Clear canvas and redraw all visible points
     */
    redrawAll() {
        this.clearCanvas();

        if (this.getParameter('showGrid')) {
            this.drawGrid();
        }

        this.drawPointsBatch(0, this.animationIndex);
    }

    /**
     * Clear the canvas
     */
    clearCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
    }

    /**
     * Draw grid
     */
    drawGrid() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        // Draw axes
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(rect.width, centerY);
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, rect.height);
        this.ctx.stroke();

        // Draw grid lines
        const gridSpacing = 50;
        for (let x = centerX % gridSpacing; x < rect.width; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, rect.height);
            this.ctx.stroke();
        }
        for (let y = centerY % gridSpacing; y < rect.height; y += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(rect.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Draw a batch of points additively
     */
    drawPointsBatch(startIndex, endIndex) {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const pointSize = this.getParameter('pointSize');
        const scale = this.computedScaleFactor;

        for (let i = startIndex; i < endIndex; i++) {
            const point = this.computedPoints[i];

            // Transform to canvas coordinates
            const canvasX = centerX + point.real * scale;
            const canvasY = centerY - point.imag * scale; // Flip Y axis

            // Get color
            const color = this.getPointColor(point, i);

            // Draw point
            this.ctx.fillStyle = color;
            this.ctx.fillRect(canvasX - pointSize/2, canvasY - pointSize/2, pointSize, pointSize);
        }
    }

    /**
     * Get color for a point based on current color scheme
     */
    getPointColor(point, index) {
        const colorScheme = this.getParameter('colorScheme');

        if (colorScheme === 'monochrome') {
            return '#ffffff';
        } else if (colorScheme === 'time-based') {
            return this.getTimeBasedColor(index);
        } else if (colorScheme === 'lutz') {
            return this.getLutzColor(point);
        }

        return '#ffffff';
    }

    /**
     * Get time-based color (gradient from first to last color)
     */
    getTimeBasedColor(index) {
        const t = index / Math.max(1, this.computedPoints.length - 1);
        const firstColor = this.hexToRgb(this.getParameter('timeFirstColor'));
        const lastColor = this.hexToRgb(this.getParameter('timeLastColor'));

        const r = Math.round(firstColor.r + (lastColor.r - firstColor.r) * t);
        const g = Math.round(firstColor.g + (lastColor.g - firstColor.g) * t);
        const b = Math.round(firstColor.b + (lastColor.b - firstColor.b) * t);

        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Get Lutz color
     */
    getLutzColor(point) {
        // Compute Lutz coloring if not cached
        if (!this.lutzColoring) {
            this.computeLutzColoring();
        }

        const colorIndex = this.lutzColoring.get(point.k) || 0;
        const hue = (colorIndex * 137.508) % 360; // Golden angle for distribution
        return `hsl(${hue}, 70%, 50%)`;
    }

    /**
     * Compute Lutz coloring for all points
     */
    computeLutzColoring() {
        console.log('🎨 Computing Lutz coloring...');
        const c = this.getParameter('lutzC');
        this.lutzColoring = new Map();

        for (const point of this.computedPoints) {
            const real = point.real;
            const imag = point.imag;
            const mag = point.magnitude;

            if (mag < 0.01) {
                this.lutzColoring.set(point.k, 0);
                continue;
            }

            const arg = Math.atan2(imag, real);
            const colorIndex = Math.floor((arg / (2 * Math.PI) + 0.5) * c) % c;
            this.lutzColoring.set(point.k, colorIndex);
        }
    }

    /**
     * Convert hex color to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    updatePlotMode(mode) {
        if (mode === 'all-at-once') {
            this.animationIndex = this.computedPoints.length;
            this.redrawAll();
        } else {
            this.animationIndex = 0;
            this.clearCanvas();
            if (this.getParameter('showGrid')) {
                this.drawGrid();
            }
        }
    }

    updateDebugInfo(method, timeMs, numPoints, errorMessage = null) {
        const debugDiv = this.querySelector('#debugInfo');
        if (debugDiv) {
            let text = `${method} | ${timeMs.toFixed(1)}ms | ${numPoints} pts`;
            if (errorMessage) {
                text += `\n⚠️ ${errorMessage}`;
            }
            debugDiv.textContent = text;
            debugDiv.style.display = 'block';

            // Change color if there's an error
            if (errorMessage) {
                debugDiv.style.color = '#ff6b6b';
            } else {
                debugDiv.style.color = '#00ff00';
            }
        }
    }

    clearVisualization() {
        this.computedPoints = [];
        this.animationIndex = 0;
        this.isPaused = false;
        this.lutzColoring = null;
        this.clearCanvas();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(`Animation ${this.isPaused ? 'paused' : 'resumed'}`);
    }

    showError(message) {
        const errorDiv = this.querySelector('#errorMessage');
        const errorDetails = this.querySelector('#errorDetails');

        if (errorDiv && errorDetails) {
            errorDetails.textContent = message;
            errorDiv.style.display = 'flex';
        }
    }

    // Math helpers
    gcd(a, b) {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    multiplicativeOrder(omega, n) {
        if (this.gcd(omega, n) !== 1) {
            return 1;
        }

        let order = 1;
        let current = omega % n;

        while (current !== 1) {
            current = (current * omega) % n;
            order++;
            if (order > n) {
                console.error('Multiplicative order exceeded n');
                return 1;
            }
        }

        return order;
    }
}

customElements.define('gaussian-periods-viewer', GaussianPeriodsViewer);
