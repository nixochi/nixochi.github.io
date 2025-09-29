/**
 * Gaussian Periods Viewer Web Component
 * Matches tezcatli Plugin3D architecture patterns
 */
class GaussianPeriodsViewer extends HTMLElement {
    static get observedAttributes() { 
        return ['n', 'omega', 'point-size', 'show-grid', 'color-scheme', 'plot-mode']; 
    }

    constructor() {
        super();
        console.log('🎯 GaussianPeriodsViewer constructor called');
        
        // Core state - matching GaussianPeriodsPlugin
        this.computedPoints = [];
        this.animationIndex = 0;
        this.isPaused = false;
        
        // Three.js objects
        this.THREE = null;
        this.OrbitControls = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Point cloud objects - EXACT from tezcatli
        this.pointCloud = null;
        this.pointGeometry = null;
        this.pointMaterial = null;
        this.gridHelper = null;
        
        // Pre-allocated arrays for performance
        this.positionArray = null;
        this.colorArray = null;
        
        // Auto-zoom state
        this.computedScaleFactor = 0.1;
        
        // Animation and resize
        this.animationId = null;
        this._ro = null;
        
        // Resource tracking
        this._objects = new Set();
        this._materials = new Set();
        this._geometries = new Set();
    }
    
    connectedCallback() {
        console.log('🔗 GaussianPeriodsViewer connected to DOM');
        
        this.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                position: relative;
                overflow: hidden;
                background: transparent;
            ">
                <canvas id="gaussianCanvas" style="
                    width: 100%;
                    height: 100%;
                    display: block;
                    background: transparent;
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
        
        if (this.controls) {
            this.controls.dispose();
        }
        
        this.disposeAllResources();
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this._ro) {
            this._ro.disconnect();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`🔄 GaussianPeriodsViewer attribute changed: ${name} = ${newValue}`);
        
        if (!this.THREE) return;
        
        if (name === 'n' || name === 'omega') {
            this.computePeriods();
        } else if (name === 'point-size') {
            this.updatePointSize(parseFloat(newValue));
        } else if (name === 'show-grid') {
            this.updateGridVisibility(newValue === 'true');
        } else if (name === 'color-scheme') {
            this.updateColors();
        } else if (name === 'plot-mode') {
            this.updatePlotMode(newValue);
        }
    }
    
    // Parameter handling
    parseAttributes() {
        console.log('📝 Parsing attributes');
    }
    
    getParameter(name, defaultValue = null) {
        switch (name) {
            case 'n': return parseInt(this.getAttribute('n')) || 91205;
            case 'omega': return parseInt(this.getAttribute('omega')) || 2337;
            case 'pointSize': return parseFloat(this.getAttribute('point-size')) || 0.2;
            case 'showGrid': return this.getAttribute('show-grid') === 'true';
            case 'colorScheme': return this.getAttribute('color-scheme') || 'time-based';
            case 'plotMode': return this.getAttribute('plot-mode') || 'animated';
            case 'animationSpeed': return parseInt(this.getAttribute('animation-speed')) || 1000;
            case 'timeFirstColor': return this.getAttribute('time-first-color') || '#0000ff';
            case 'timeLastColor': return this.getAttribute('time-last-color') || '#00ff00';
            case 'autoZoom': return this.getAttribute('auto-zoom') !== 'false';
            default: return defaultValue;
        }
    }
    
    // Initialization - EXACT pattern from tezcatli
    async initialize() {
        console.log('🚀 Initializing GaussianPeriodsViewer...');
        
        await this.loadDependencies();
        this.setupScene();
        this.setupResizeObserver();
        this.startAnimationLoop();
        
        // Initial computation
        await this.computePeriods();
        
        console.log('✅ GaussianPeriodsViewer initialization complete');
    }
    
    async loadDependencies() {
        console.log('📦 Loading THREE.js dependencies...');
        
        // Load THREE.js
        const threeMod = await this.importFirst([
            'https://esm.sh/three@0.160.0',
            'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'
        ]);
        this.THREE = threeMod;
        
        // Load OrbitControls
        const orbitMod = await this.importFirst([
            'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js',
            'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js'
        ]);
        this.OrbitControls = orbitMod.OrbitControls;
        
        console.log('✅ Dependencies loaded successfully');
    }
    
    async importFirst(urls) {
        let lastError;
        for (const url of urls) {
            try {
                console.log(`📥 Attempting to load: ${url}`);
                return await import(/* @vite-ignore */ url);
            } catch (error) {
                lastError = error;
                console.warn(`❌ Failed to load ${url}:`, error);
            }
        }
        throw lastError || new Error('All module imports failed');
    }
    
    setupScene() {
        const THREE = this.THREE;
        const canvas = this.querySelector('#gaussianCanvas');
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera - 2D-like viewing as in tezcatli
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.camera.position.set(0, 0, 10);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true, 
            alpha: true 
        });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 0, 10);
        this.scene.add(ambientLight, directionalLight);
        
        // Controls - 2D-like as in tezcatli
        this.controls = new this.OrbitControls(this.camera, canvas);
        this.controls.enableRotate = false;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        
        console.log('🎬 3D scene setup complete');
    }
    
    setupResizeObserver() {
        const handleResize = () => {
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height) return;
            
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            
            console.log(`📐 GaussianPeriodsViewer resized to: ${width}x${height}`);
        };
        
        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }
    
    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            // Animation logic - EXACT from tezcatli
            const plotMode = this.getParameter('plotMode');
            if (plotMode === 'animated' && !this.isPaused && this.pointCloud) {
                const maxPoints = this.computedPoints.length;
                if (this.animationIndex < maxPoints) {
                    const speed = this.getParameter('animationSpeed');
                    const pointsToAdd = Math.min(speed, maxPoints - this.animationIndex);
                    this.animationIndex += pointsToAdd;
                    
                    if (pointsToAdd > 0) {
                        this.updateVisiblePoints();
                    }
                }
            }
            
            // Update grid visibility
            const showGrid = this.getParameter('showGrid');
            if (showGrid && !this.gridHelper) {
                this.createGrid();
            } else if (!showGrid && this.gridHelper) {
                this.scene.remove(this.gridHelper);
                this.gridHelper.geometry.dispose();
                this.gridHelper.material.dispose();
                this.gridHelper = null;
            }
            
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
        console.log('🎬 Animation loop started');
    }
    
    // Gaussian Periods computation - simplified from tezcatli
    async computePeriods() {
        const n = Math.min(this.getParameter('n'), 200000);
        const omega = this.getParameter('omega');
        
        console.log(`Computing Gaussian Periods for n=${n}, omega=${omega}...`);
        
        // Validate coprimality
        if (this.gcd(omega, n) !== 1) {
            console.error(`Invalid parameters: omega=${omega} must be coprime to n=${n}`);
            return;
        }
        
        // Clear existing visualization
        this.clearVisualization();
        
        // Compute multiplicative order
        const d = this.multiplicativeOrder(omega, n);
        console.log(`Multiplicative order d = ${d}`);
        
        // Pre-compute omega powers
        const omegaPowers = new Uint32Array(d);
        omegaPowers[0] = 1;
        for (let j = 1; j < d; j++) {
            omegaPowers[j] = (omegaPowers[j - 1] * omega) % n;
        }
        
        // Pre-compute trigonometric values
        const cosValues = new Float32Array(n);
        const sinValues = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const angle = 2 * Math.PI * i / n;
            cosValues[i] = Math.cos(angle);
            sinValues[i] = Math.sin(angle);
        }
        
        // Compute Gaussian periods
        const gcdND = this.gcd(n, d);
        const bound = Math.min(n, Math.floor(n / gcdND * d));
        
        this.computedPoints = [];
        
        for (let k = 0; k < bound; k++) {
            let sumReal = 0;
            let sumImag = 0;
            
            for (let j = 0; j < d; j++) {
                const omegaPower = omegaPowers[j];
                const exponent = (k * omegaPower) % n;
                
                sumReal += cosValues[exponent];
                sumImag += sinValues[exponent];
            }
            
            this.computedPoints.push({
                x: sumReal,
                y: sumImag,
                k: k,
                real: sumReal,
                imag: sumImag,
                magnitude: Math.sqrt(sumReal * sumReal + sumImag * sumImag),
                argument: Math.atan2(sumImag, sumReal)
            });
        }
        
        console.log(`Computed ${this.computedPoints.length} points`);
        
        // Auto-zoom calculation
        if (this.getParameter('autoZoom')) {
            this.computedScaleFactor = this.calculateAutoZoom(this.computedPoints);
            console.log(`Auto-zoom scale factor: ${this.computedScaleFactor}`);
        } else {
            this.computedScaleFactor = 0.1;
        }
        
        // Create point cloud
        this.allocateArrays(this.computedPoints.length);
        this.fillArraysWithPoints();
        this.createPointCloud();
        
        // Set up animation
        const plotMode = this.getParameter('plotMode');
        if (plotMode === 'animated') {
            this.animationIndex = 0;
        } else {
            this.animationIndex = this.computedPoints.length;
        }
        this.updateVisiblePoints();
    }
    
    // Math utilities
    gcd(a, b) {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }
    
    multiplicativeOrder(omega, n) {
        if (this.gcd(omega, n) !== 1) return 1;
        
        let order = 1;
        let current = omega % n;
        
        while (current !== 1) {
            current = (current * omega) % n;
            order++;
            if (order > n) return 1;
        }
        
        return order;
    }
    
    calculateAutoZoom(points) {
        if (!points || points.length === 0) return 0.1;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        const dataWidth = maxX - minX;
        const dataHeight = maxY - minY;
        const maxDataSize = Math.max(dataWidth, dataHeight);
        
        const viewportSize = 10;
        const usableViewportSize = viewportSize * 0.9;
        const scaleFactor = maxDataSize > 0 ? usableViewportSize / maxDataSize : 0.1;
        
        return Math.max(0.01, Math.min(0.5, scaleFactor));
    }
    
    // Point cloud creation - EXACT from tezcatli
    allocateArrays(pointCount) {
        this.positionArray = new Float32Array(pointCount * 3);
        this.colorArray = new Float32Array(pointCount * 3);
    }
    
    fillArraysWithPoints() {
        if (!this.positionArray || !this.colorArray) return;

        const scaleFactor = this.computedScaleFactor;
        
        for (let i = 0; i < this.computedPoints.length; i++) {
            const point = this.computedPoints[i];
            const i3 = i * 3;
            
            this.positionArray[i3] = point.x * scaleFactor;
            this.positionArray[i3 + 1] = point.y * scaleFactor;
            this.positionArray[i3 + 2] = 0;
            
            const color = this.getPointColorAsRGB(point, i);
            this.colorArray[i3] = color.r;
            this.colorArray[i3 + 1] = color.g;
            this.colorArray[i3 + 2] = color.b;
        }
    }
    
    createPointCloud() {
        if (this.pointCloud) {
            this.scene.remove(this.pointCloud);
            if (this.pointGeometry) this.pointGeometry.dispose();
            if (this.pointMaterial) this.pointMaterial.dispose();
        }
        
        const THREE = this.THREE;
        
        this.pointGeometry = new THREE.BufferGeometry();
        this.pointGeometry.setAttribute('position', new THREE.BufferAttribute(this.positionArray, 3));
        this.pointGeometry.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3));
        this.pointGeometry.setDrawRange(0, this.animationIndex);
        
        this.pointMaterial = new THREE.PointsMaterial({
            size: this.getParameter('pointSize'),
            transparent: false,
            opacity: 1.0,
            vertexColors: true,
            sizeAttenuation: false
        });
        
        this.pointCloud = new THREE.Points(this.pointGeometry, this.pointMaterial);
        this.scene.add(this.pointCloud);
        
        this.trackObject(this.pointCloud);
        this.trackGeometry(this.pointGeometry);
        this.trackMaterial(this.pointMaterial);
        
        console.log('Point cloud created successfully');
    }
    
    updateVisiblePoints() {
        if (this.pointGeometry) {
            this.pointGeometry.setDrawRange(0, this.animationIndex);
        }
    }
    
    getPointColorAsRGB(point, index) {
        const scheme = this.getParameter('colorScheme');
        
        let hexColor;
        switch (scheme) {
            case 'time-based':
                hexColor = this.getTimeBasedColor(index);
                break;
            case 'monochrome':
                hexColor = '#ffffff';
                break;
            default:
                hexColor = '#ffffff';
        }
        
        const color = new this.THREE.Color(hexColor);
        return { r: color.r, g: color.g, b: color.b };
    }
    
    getTimeBasedColor(index) {
        if (this.computedPoints.length <= 1) {
            return this.getParameter('timeFirstColor');
        }
        
        const firstColor = new this.THREE.Color(this.getParameter('timeFirstColor'));
        const lastColor = new this.THREE.Color(this.getParameter('timeLastColor'));
        
        const t = index / (this.computedPoints.length - 1);
        
        const r = firstColor.r + (lastColor.r - firstColor.r) * t;
        const g = firstColor.g + (lastColor.g - firstColor.g) * t;
        const b = firstColor.b + (lastColor.b - firstColor.b) * t;
        
        const red = Math.round(r * 255);
        const green = Math.round(g * 255);
        const blue = Math.round(b * 255);
        
        return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
    }
    
    createGrid() {
        const gridSize = 10;
        this.gridHelper = new this.THREE.GridHelper(gridSize, gridSize, 0x444444, 0x222222);
        this.gridHelper.rotateX(Math.PI / 2);
        this.scene.add(this.gridHelper);
    }
    
    // Update methods
    updatePointSize(size) {
        if (this.pointMaterial) {
            this.pointMaterial.size = size;
            this.pointMaterial.needsUpdate = true;
        }
    }
    
    updateGridVisibility(visible) {
        // Handled in animation loop
    }
    
    updateColors() {
        if (this.computedPoints.length > 0) {
            this.fillArraysWithPoints();
            if (this.pointGeometry) {
                this.pointGeometry.attributes.color.needsUpdate = true;
            }
        }
    }
    
    updatePlotMode(mode) {
        if (mode === 'all-at-once') {
            this.animationIndex = this.computedPoints.length;
        } else {
            this.animationIndex = 0;
        }
        this.updateVisiblePoints();
    }
    
    // Public methods
    clearVisualization() {
        this.computedPoints = [];
        this.animationIndex = 0;
        this.isPaused = false;
        
        if (this.pointCloud) {
            this.scene.remove(this.pointCloud);
            if (this.pointGeometry) this.pointGeometry.dispose();
            if (this.pointMaterial) this.pointMaterial.dispose();
            this.pointCloud = null;
            this.pointGeometry = null;
            this.pointMaterial = null;
        }
        
        this.positionArray = null;
        this.colorArray = null;
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(`Animation ${this.isPaused ? 'paused' : 'resumed'}`);
    }
    
    // UI helpers
    showError(message) {
        const error = this.querySelector('#errorMessage');
        const details = this.querySelector('#errorDetails');
        
        if (error) error.style.display = 'flex';
        if (details) details.textContent = message;
    }
    
    // Resource management
    trackObject(object) {
        this._objects.add(object);
    }
    
    trackGeometry(geometry) {
        this._geometries.add(geometry);
    }
    
    trackMaterial(material) {
        this._materials.add(material);
    }
    
    disposeAllResources() {
        this._objects.forEach(object => {
            try { 
                if (object.dispose) object.dispose(); 
            } catch (error) {
                console.warn('⚠️ Error disposing object:', error);
            }
        });
        
        this._geometries.forEach(geometry => {
            try { 
                if (geometry.dispose) geometry.dispose(); 
            } catch (error) {
                console.warn('⚠️ Error disposing geometry:', error);
            }
        });
        
        this._materials.forEach(material => {
            try { 
                if (material.dispose) material.dispose(); 
            } catch (error) {
                console.warn('⚠️ Error disposing material:', error);
            }
        });
        
        this._objects.clear();
        this._geometries.clear();
        this._materials.clear();
        
        console.log('🧹 All resources disposed');
    }
}

console.log('📝 Registering gaussian-periods-viewer...');
customElements.define('gaussian-periods-viewer', GaussianPeriodsViewer);
console.log('✅ gaussian-periods-viewer registered successfully!');