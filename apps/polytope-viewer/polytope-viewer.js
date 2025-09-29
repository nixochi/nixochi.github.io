/**
 * 3D Polytope Viewer Component for WebTeX
 * @webtex-width 8in
 * @webtex-height 6in
 */
class PolytopeViewer extends HTMLElement {
    static get observedAttributes() { 
        return ['vertices', 'wireframe', 'opacity']; 
    }

    constructor() {
        super();
        console.log('🎯 PolytopeViewer constructor called');
        
        // State
        this.vertices = null;
        this.isWireframe = false;
        this.faceOpacity = 1.0;
        
        // THREE.js objects
        this.THREE = null;
        this.OrbitControls = null;
        this._qh = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.polytopeGroup = null;
        
        // Animation and resize handling
        this.animationId = null;
        this._ro = null;
        
        // Resource tracking
        this._objects = new Set();
        this._materials = new Set();
    }
    
    connectedCallback() {
        console.log('🔗 PolytopeViewer connected to DOM');
        
        this.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                position: relative;
                overflow: hidden;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            ">
                <canvas id="polytopeCanvas" style="
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
                    <div style="font-size: 14px; font-weight: 500;">Failed to load 3D viewer</div>
                    <div id="errorDetails" style="font-size: 12px; opacity: 0.8;"></div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
        this.parseAttributes();
        this.initialize().catch(err => {
            console.error('❌ PolytopeViewer initialization error:', err);
            this.showError(err.message || 'Unknown error occurred');
        });
        
        console.log('✅ PolytopeViewer HTML rendered successfully');
    }
    
    disconnectedCallback() {
        console.log('🔌 PolytopeViewer disconnected from DOM');
        
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
        console.log(`🔄 PolytopeViewer attribute changed: ${name} = ${newValue}`);
        
        if (name === 'wireframe') {
            this.isWireframe = newValue === 'true';
            if (this.THREE) this.updateWireframeMode();
        } else if (name === 'vertices') {
            this.parseVertices(newValue);
            if (this.THREE) this.rebuildMesh();
        } else if (name === 'opacity') {
            this.faceOpacity = this.parseOpacity(newValue);
            if (this.THREE) this.updateOpacity();
        }
    }
    
    setupEventListeners() {
        // Container query support - the component automatically scales with its container
        console.log('🎛️ PolytopeViewer event listeners setup complete');
    }
    
    // Attribute parsing
    parseAttributes() {
        this.parseVertices(this.getAttribute('vertices'));
        this.isWireframe = this.getAttribute('wireframe') === 'true';
        this.faceOpacity = this.parseOpacity(this.getAttribute('opacity'));
        
        console.log('📝 PolytopeViewer attributes parsed:', {
            vertices: this.vertices?.length || 0,
            wireframe: this.isWireframe,
            opacity: this.faceOpacity
        });
    }
    
    parseVertices(attr) {
        if (!attr) {
            this.vertices = this.getDefaultCubeVertices();
            return;
        }
        
        try {
            this.vertices = JSON.parse(attr);
            console.log(`📊 Parsed ${this.vertices.length} vertices from attribute`);
        } catch (error) {
            console.warn('⚠️ Invalid vertices JSON, using default cube:', error);
            this.vertices = this.getDefaultCubeVertices();
        }
    }
    
    parseOpacity(val) {
        if (val === null || val === undefined || val === '') return 0.9;
        const num = Number(val);
        if (!isFinite(num)) return 0.9;
        return Math.min(1, Math.max(0, num));
    }
    
    // Initialization
    async initialize() {
        console.log('🚀 Initializing PolytopeViewer...');
        
        // Load THREE.js and dependencies
        await this.loadDependencies();
        
        // Setup 3D scene
        this.setupScene();
        
        // Build initial mesh
        this.rebuildMesh();
        
        // Setup resize handling
        this.setupResizeObserver();
        
        // Start animation loop
        this.startAnimationLoop();
        
        console.log('✅ PolytopeViewer initialization complete');
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
        
        // Load QuickHull
        this._qh = await this.loadQuickHull();
        
        console.log('✅ Dependencies loaded successfully');
    }
    
    async loadQuickHull() {
        try {
            const mod = await this.importFirst([
                'https://esm.sh/quickhull3d@3.1.1',
                'https://cdn.jsdelivr.net/npm/quickhull3d@3.1.1/+esm'
            ]);
            
            const fn = mod.default || mod.quickhull3d || mod.qh || mod;
            if (typeof fn === 'function') {
                console.log('✅ QuickHull loaded successfully');
                return fn;
            }
        } catch (error) {
            console.warn('⚠️ QuickHull not available, using fallback:', error);
        }
        
        // Fallback implementation
        return (points) => {
            if (!points || points.length < 4) return [];
            return [[0,1,2],[0,2,3],[0,3,1],[1,3,2]];
        };
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
        const canvas = this.querySelector('#polytopeCanvas');
        
        // Scene
        this.scene = new THREE.Scene();
        // Keep background transparent for container integration
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
        this.camera.position.set(5, 5, 5);
        
        // Renderer with transparency
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true, 
            alpha: true 
        });
        this.renderer.setClearColor(0x000000, 0); // Fully transparent
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        
        // Lighting for nice appearance
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
        keyLight.position.set(6, 10, 8);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
        fillLight.position.set(-8, -4, 6);
        
        this.scene.add(ambientLight, keyLight, fillLight);
        
        // Controls
        this.controls = new this.OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.target.set(0, 0, 0);
        
        console.log('🎬 3D scene setup complete');
    }
    
    setupResizeObserver() {
        const handleResize = () => {
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height) return;
            
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            
            console.log(`📐 PolytopeViewer resized to: ${width}x${height}`);
        };
        
        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }
    
    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
        console.log('🎬 Animation loop started');
    }

    // Get face color palette - same as tezcatli
    getFaceColorPalette() {
        return [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98FB98', '#F4A460', '#87CEEB', '#FFB6C1',
            '#FF8C69', '#20B2AA', '#87CEFA', '#DDA0DD', '#F0E68C'
        ];
    }

    // Get edge color palette - vibrant colors that work on both light/dark backgrounds
    getEdgeColorPalette() {
        return [
            '#ff6b35', '#4ecdc4', '#45b7d1', '#96ceb4', 
            '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd', 
            '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'
        ];
    }
    
    // Mesh building - updated to use tezcatli approach
    rebuildMesh() {
        if (!this.THREE) return;
        
        console.log('🔄 Rebuilding polytope mesh...');
        
        // Remove old mesh
        if (this.polytopeGroup) {
            this.scene.remove(this.polytopeGroup);
            this.disposeGroup(this.polytopeGroup);
            this.polytopeGroup = null;
        }
        
        // Create new mesh
        this.polytopeGroup = this.isWireframe
            ? this.createWireframeMesh(this.vertices)
            : this.createSolidMesh(this.vertices);
        
        this.scene.add(this.polytopeGroup);
        this.frameToFit();
        
        console.log('✅ Mesh rebuild complete');
    }
    
    createSolidMesh(vertices) {
        const THREE = this.THREE;
        const faces = this.getFacesFromVertices(vertices);
        
        if (!faces.length) {
            console.warn('⚠️ No faces generated from vertices');
            return new THREE.Group();
        }
        
        const group = new THREE.Group();
        this.trackObject(group);
        
        // Color palette for faces - same as tezcatli
        const colors = this.getFaceColorPalette();
        
        faces.forEach((face, faceIndex) => {
            if (!face || face.length < 3) {
                console.warn(`Face ${faceIndex} has less than 3 vertices, skipping`);
                return;
            }
            
            // Validate vertex indices - same as tezcatli
            const invalidIndices = face.filter(idx => 
                idx === undefined || idx < 0 || idx >= vertices.length
            );
            
            if (invalidIndices.length > 0) {
                console.error(`Face ${faceIndex} has invalid vertex indices:`, invalidIndices);
                return;
            }
            
            const geometry = new THREE.BufferGeometry();
            this.trackObject(geometry);
            
            // Build face vertices - same approach as tezcatli
            const facePositions = [];
            face.forEach(vertexIndex => {
                const vertex = vertices[vertexIndex];
                facePositions.push(vertex[0], vertex[1], vertex[2]);
            });
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
            
            // Triangulate face using fan triangulation - same as tezcatli
            const faceIndices = [];
            for (let i = 1; i < face.length - 1; i++) {
                faceIndices.push(0, i, i + 1);
            }
            geometry.setIndex(faceIndices);
            geometry.computeVertexNormals();
            
            // Material with nice shading - similar to tezcatli
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(colors[faceIndex % colors.length]),
                transparent: this.faceOpacity < 1.0,
                opacity: this.faceOpacity,
                side: THREE.DoubleSide,
                metalness: 0.3,
                roughness: 0.7
            });
            material.needsUpdate = true;
            this.trackMaterial(material);
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData.faceIndex = faceIndex; // Store face index for identification
            group.add(mesh);
            this.trackObject(mesh);
        });
        
        // Add edge lines - same approach as tezcatli
        this.addEdgeLines(group, vertices, faces);
        
        return group;
    }
    
    createWireframeMesh(vertices) {
        const THREE = this.THREE;
        const faces = this.getFacesFromVertices(vertices);
        const edges = this.getEdgesFromFaces(faces);
        
        if (!edges.length) {
            console.warn('⚠️ No edges generated from faces');
            return new THREE.Group();
        }

        const group = new THREE.Group();
        this.trackObject(group);
        
        const edgeColors = this.getEdgeColorPalette();
        
        // Create colorful edges for wireframe mode
        edges.forEach(([a, b], index) => {
            if (a < 0 || a >= vertices.length || b < 0 || b >= vertices.length) {
                console.error(`Invalid edge indices: [${a}, ${b}]`);
                return;
            }
            
            const vertexA = vertices[a];
            const vertexB = vertices[b];
            
            const geometry = new THREE.BufferGeometry();
            const positions = [
                vertexA[0], vertexA[1], vertexA[2],
                vertexB[0], vertexB[1], vertexB[2]
            ];
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            this.trackObject(geometry);
            
            const material = new THREE.LineBasicMaterial({
                color: new THREE.Color(edgeColors[index % edgeColors.length]),
                linewidth: 2,
                transparent: true,
                opacity: Math.min(1, this.faceOpacity + 0.1)
            });
            this.trackMaterial(material);
            
            const line = new THREE.Line(geometry, material);
            line.userData.edgeIndex = index; // Store edge index for identification
            group.add(line);
            this.trackObject(line);
        });
        
        return group;
    }
    
    addEdgeLines(group, vertices, faces) {
        const edges = this.getEdgesFromFaces(faces);
        
        edges.forEach(([a, b], edgeIndex) => {
            if (a < 0 || a >= vertices.length || b < 0 || b >= vertices.length) {
                console.error(`Edge ${edgeIndex} has invalid vertex indices:`, [a, b]);
                return;
            }
            
            const vertexA = vertices[a];
            const vertexB = vertices[b];
            
            const geometry = new this.THREE.BufferGeometry();
            geometry.setAttribute('position', new this.THREE.Float32BufferAttribute([
                vertexA[0], vertexA[1], vertexA[2],
                vertexB[0], vertexB[1], vertexB[2]
            ], 3));
            this.trackObject(geometry);
            
            // Black edges for solid mode - same as tezcatli
            const material = new this.THREE.LineBasicMaterial({
                color: new this.THREE.Color('#000000'),
                transparent: true,
                opacity: Math.min(1, this.faceOpacity + 0.1),
                linewidth: 1
            });
            this.trackMaterial(material);
            
            const line = new this.THREE.Line(geometry, material);
            line.userData.edgeIndex = edgeIndex; // Store edge index for identification
            group.add(line);
            this.trackObject(line);
        });
    }
    
    updateWireframeMode() {
        if (!this.polytopeGroup) return;
        
        this.polytopeGroup.traverse(object => {
            if (object.isMesh) {
                object.visible = !this.isWireframe;
            } else if (object.isLine) {
                object.visible = true;
                // Update edge colors based on mode
                if (this.isWireframe) {
                    // Colorful edges for wireframe mode
                    const edgeColors = this.getEdgeColorPalette();
                    const colorIndex = Math.floor(Math.random() * edgeColors.length);
                    object.material.color.set(edgeColors[colorIndex]);
                } else {
                    // Black edges for solid mode
                    object.material.color.setHex(0x000000);
                }
                object.material.needsUpdate = true;
            }
        });
        
        console.log(`🔄 Updated wireframe mode: ${this.isWireframe}`);
    }
    
    updateOpacity() {
        if (!this.polytopeGroup) return;
        
        this.polytopeGroup.traverse(object => {
            if (object.isMesh && object.material) {
                object.material.opacity = this.faceOpacity;
                object.material.transparent = this.faceOpacity < 1.0;
                object.material.needsUpdate = true;
            } else if (object.isLine && object.material) {
                object.material.opacity = Math.min(1, this.faceOpacity + 0.1);
                object.material.needsUpdate = true;
            }
        });
        
        console.log(`🎨 Updated opacity to: ${this.faceOpacity}`);
    }
    
    frameToFit() {
        if (!this.polytopeGroup || !this.THREE) return;
        
        const box = new this.THREE.Box3().setFromObject(this.polytopeGroup);
        const size = new this.THREE.Vector3();
        const center = new this.THREE.Vector3();
        
        box.getSize(size);
        box.getCenter(center);
        
        if (!isFinite(size.x + size.y + size.z)) return;
        
        this.controls.target.copy(center);
        
        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = (maxDimension * 1.25) / (2 * Math.tan(fov / 2));
        
        this.camera.position.copy(center).add(
            new this.THREE.Vector3(distance, distance, distance)
        );
        
        this.camera.near = Math.max(distance / 1000, 0.01);
        this.camera.far = distance * 1000;
        this.camera.updateProjectionMatrix();
        
        console.log('📷 Camera positioned to frame polytope');
    }
    
    // Hull computation helpers - UPDATED to use tezcatli approach
    getFacesFromVertices(vertices, options = {}) {
  if (!vertices || vertices.length < 4) return [];
  const opts = {
    skipTriangulation: true,     // keep n-gon faces
    ...options
  };
  try {
    const faces = this._qh(vertices, opts);
    return Array.isArray(faces) ? faces : [];
  } catch (e) {
    console.error('QuickHull error:', e);
    return [];
  }
}

    
    // Extract edges from face data - same as tezcatli
    getEdgesFromFaces(faces) {
        if (!faces || !faces.length) return [];
        
        const edgeSet = new Set();
        
        faces.forEach(face => {
            if (!face || face.length < 3) return;
            
            const n = face.length;
            for (let i = 0; i < n; i++) {
                const a = face[i];
                const b = face[(i + 1) % n];
                
                // Create a consistent edge key (smaller index first)
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                edgeSet.add(key);
            }
        });
        
        // Convert edge set back to array of pairs
        return Array.from(edgeSet, key => {
            const [a, b] = key.split('-').map(Number);
            return [a, b];
        });
    }
    
    // Default vertices
    getDefaultCubeVertices() {
        return [
            [ 1,  1,  1], [-1,  1,  1], [-1, -1,  1], [ 1, -1,  1],
            [ 1,  1, -1], [-1,  1, -1], [-1, -1, -1], [ 1, -1, -1]
        ];
    }
    
    // UI helpers - only error message remains
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
    
    trackMaterial(material) {
        this._materials.add(material);
    }
    
    disposeGroup(group) {
        group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    disposeAllResources() {
        this._objects.forEach(object => {
            try { 
                if (object.dispose) object.dispose(); 
            } catch (error) {
                console.warn('⚠️ Error disposing object:', error);
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
        this._materials.clear();
        
        console.log('🧹 All resources disposed');
    }
}

console.log('📝 Registering polytope-viewer...');
customElements.define('polytope-viewer', PolytopeViewer);
console.log('✅ polytope-viewer registered successfully!');