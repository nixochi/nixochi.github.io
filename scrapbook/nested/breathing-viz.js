/**
 * Breathing Visualization Web Component (Raw WebGL2)
 * Nested permutahedra with synchronized breathing animation
 */

// ============================================
// CONFIGURATION PARAMETERS
// ============================================
const NUM_NESTED_POLYTOPES = 1000;  // Number of nested polytopes to render

// Time multiplier (1.0 = normal speed, 2.0 = twice as fast, 0.5 = half speed)
const TIME_MULTIPLIER = 0.3;

// Animation Phase Durations (in milliseconds)
const SYNCED_SLOW_DURATION = 100 / TIME_MULTIPLIER;        // Phase 1: Synced, slow rotation
const DESYNC_SPEEDUP_DURATION = 4000 / TIME_MULTIPLIER;     // Phase 2: Desyncing and speeding up
const DESYNC_SLOWDOWN_DURATION = 4000 / TIME_MULTIPLIER;    // Phase 3: Desynced, slowing down
const DESYNCED_SLOW_DURATION = 2000 / TIME_MULTIPLIER;      // Phase 4: Desynced, slow rotation
const SYNC_SPEEDUP_DURATION = 5000 / TIME_MULTIPLIER;       // Phase 5: Syncing halfway and speeding up
const SYNC_SLOWDOWN_DURATION = 2000 / TIME_MULTIPLIER;      // Phase 6: Syncing rest of way and slowing down

// Speed settings
const SLOW_ROTATION_SPEED = 0.01;
const FAST_ROTATION_SPEED = 0.04;

// Size settings for each phase
const PHASE_1_SIZE = 1.0;
const PHASE_2_START_SIZE = 1.0;
const PHASE_2_END_SIZE = 1.5;
const PHASE_3_START_SIZE = 1.5;
const PHASE_3_END_SIZE = 8.0;
const PHASE_4_START_SIZE = 8.0;
const PHASE_4_END_SIZE = 10.0;
const PHASE_5_START_SIZE = 10.0;
const PHASE_5_END_SIZE = 0.3;
const PHASE_6_START_SIZE = 0.3;
const PHASE_6_END_SIZE = 1.0;

// Offset settings for each phase
const PHASE_1_OFFSET = 1.0;
const PHASE_2_START_OFFSET = 1.0;
const PHASE_2_END_OFFSET = 1.5;
const PHASE_3_START_OFFSET = 1.5;
const PHASE_3_END_OFFSET = 10.0;
const PHASE_4_START_OFFSET = 10.0;
const PHASE_4_END_OFFSET = 25.0;
const PHASE_5_START_OFFSET = 25.0;
const PHASE_5_END_OFFSET = 20.0;
const PHASE_6_START_OFFSET = 20.0;
const PHASE_6_END_OFFSET = 1.0;

// Camera settings
const INITIAL_RADIUS = 110;
const BASE_CAMERA_RADIUS = 110;              // Initial camera distance from origin

// Desync settings
const MAX_DESYNC_PERCENTAGE = 1;       // Maximum desync as percentage of full rotation (1.0 = full rotation)
// ============================================

class BreathingViz extends HTMLElement {
    constructor() {
        super();

        // WebGL objects
        this.gl = null;
        this.prog = null;
        this.sharedGeometry = null;
        this.instanceBuffer = null;
        this.instanceData = null;
        this.polytopes = [];

        // Camera state (spherical coordinates)
        // Start zoomed out enough to see the largest polytope
        this.spherical = {
            radius: INITIAL_RADIUS,
            theta: Math.PI / 4,
            phi: Math.PI / 3
        };

        this.sphericalDelta = {
            radius: 1
        };

        // Mouse/touch interaction
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTime = 0;
        this.velocityTheta = 0;
        this.velocityPhi = 0;
        this.touchStartDist = 0;

        // Animation
        this.animationId = null;
        this._ro = null;
        this.time = 0;
        this.currentSizeMultiplier = 1.0;

        // Animation parameters
        this.cycleDuration = SYNCED_SLOW_DURATION + DESYNC_SPEEDUP_DURATION +
                            DESYNC_SLOWDOWN_DURATION + DESYNCED_SLOW_DURATION +
                            SYNC_SPEEDUP_DURATION + SYNC_SLOWDOWN_DURATION;
        this.baseRotationSpeed = SLOW_ROTATION_SPEED;
        // Scale polytope spacing so largest fits in view (target max scale around 20)
        this.polytopeSpacing = 20 / NUM_NESTED_POLYTOPES;

        // Shared base angles (all polytopes sync to these)
        this.baseAngleX = 0;
        this.baseAngleY = 0;

        // Rotation direction: 1 for forward, -1 for reverse
        // Flips during phase 4 of each cycle
        this.rotationDirection = 1;

        // Generate speed multipliers for each polytope
        // When fully desynced, each polytope rotates at a different speed
        const maxSpeedMultiplier = 1 + MAX_DESYNC_PERCENTAGE;
        this.speedMultipliers = Array.from({ length: NUM_NESTED_POLYTOPES }, (_, i) => {
            const t = i / Math.max(1, NUM_NESTED_POLYTOPES - 1); // 0 to 1
            return {
                x: 1 + (t * (maxSpeedMultiplier - 1)),
                y: 1 + (t * (maxSpeedMultiplier - 1) * 1.2)
            };
        });


        // Permutahedron data
        this.permutahedron = {
            vertices: [
                [-2.121320343559642, -0.408248290463863,  0.577350269189626],
                [-2.121320343559642,  0.408248290463863, -0.577350269189626],
                [-1.414213562373095, -1.632993161855452,  0.577350269189626],
                [-1.414213562373095,  0.000000000000000, -1.732050807568877],
                [-1.414213562373095,  0.000000000000000,  1.732050807568877],
                [-1.414213562373095,  1.632993161855452, -0.577350269189626],
                [-0.707106781186548, -2.041241452319315, -0.577350269189626],
                [-0.707106781186548, -1.224744871391589, -1.732050807568877],
                [-0.707106781186548, -1.224744871391589,  1.732050807568877],
                [-0.707106781186548,  1.224744871391589, -1.732050807568877],
                [-0.707106781186548,  1.224744871391589,  1.732050807568877],
                [-0.707106781186548,  2.041241452319315,  0.577350269189626],
                [ 0.707106781186548, -2.041241452319315, -0.577350269189626],
                [ 0.707106781186548, -1.224744871391589, -1.732050807568877],
                [ 0.707106781186548, -1.224744871391589,  1.732050807568877],
                [ 0.707106781186548,  1.224744871391589, -1.732050807568877],
                [ 0.707106781186548,  1.224744871391589,  1.732050807568877],
                [ 0.707106781186548,  2.041241452319315,  0.577350269189626],
                [ 1.414213562373095, -1.632993161855452,  0.577350269189626],
                [ 1.414213562373095,  0.000000000000000, -1.732050807568877],
                [ 1.414213562373095,  0.000000000000000,  1.732050807568877],
                [ 1.414213562373095,  1.632993161855452, -0.577350269189626],
                [ 2.121320343559642, -0.408248290463863,  0.577350269189626],
                [ 2.121320343559642,  0.408248290463863, -0.577350269189626]
            ],
            faces: [
                [7,13,12,6],
                [2,0,1,3,7,6],
                [18,14,8,2,6,12],
                [19,13,7,3,9,15],
                [20,14,18,22],
                [23,22,18,12,13,19],
                [5,9,3,1],
                [4,0,2,8],
                [21,17,16,20,22,23],
                [21,23,19,15],
                [21,15,9,5,11,17],
                [10,11,5,1,0,4],
                [10,4,8,14,20,16],
                [10,16,17,11]
            ],
            edges: [
                [7,13], [12,13], [6,12], [6,7], [0,2], [0,1], [1,3], [3,7], [2,6],
                [14,18], [8,14], [2,8], [12,18], [13,19], [3,9], [9,15], [15,19],
                [14,20], [18,22], [20,22], [22,23], [19,23], [5,9], [1,5], [0,4],
                [4,8], [17,21], [16,17], [16,20], [21,23], [15,21], [5,11], [11,17],
                [10,11], [4,10], [10,16]
            ]
        };
    }

    connectedCallback() {
        // Create container
        const container = document.createElement('div');
        container.style.cssText = `
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            background: transparent;
        `;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas';
        canvas.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
            cursor: grab;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        // Create debug UI
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-ui';
        debugDiv.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            min-width: 300px;
            z-index: 1000;
            display: none;
        `;

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.id = 'progress-bar';
        progressBar.style.cssText = `
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        `;

        const progressFill = document.createElement('div');
        progressFill.id = 'progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            background: #4CAF50;
            width: 0%;
            transition: width 0.1s linear;
        `;

        progressBar.appendChild(progressFill);

        // Phase text
        const phaseText = document.createElement('div');
        phaseText.id = 'phase-text';
        phaseText.textContent = 'Phase: Loading...';

        debugDiv.appendChild(progressBar);
        debugDiv.appendChild(phaseText);

        container.appendChild(canvas);
        container.appendChild(debugDiv);
        this.innerHTML = '';
        this.appendChild(container);

        // Initialize in next frame
        requestAnimationFrame(() => {
            try {
                this.initialize();
            } catch (err) {
                console.error('❌ Breathing initialization error:', err);
            }
        });
    }

    disconnectedCallback() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this._ro) {
            this._ro.disconnect();
        }

        this.cleanup();
    }

    initialize() {
        this.setupWebGL();
        this.setupShaders();
        this.buildPolytopeGeometry();
        this.setupInstanceBuffer();
        this.setupEventListeners();
        this.setupResizeObserver();
        this.removeLoadingSkeleton();
        this.startAnimationLoop();
    }

    setupWebGL() {
        const canvas = this.querySelector('#canvas');
        this.gl = canvas.getContext('webgl2', {
            antialias: true,
            alpha: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            desynchronized: true
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    }

    setupShaders() {
        const gl = this.gl;

        const vs = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aSinCosX;
layout(location=2) in vec2 aSinCosY;
layout(location=3) in float aScale;
layout(location=4) in vec3 aColor;
layout(location=5) in float aOpacity;

uniform mat4 uProjection;
uniform mat4 uView;

out vec3 vColor;
out float vOpacity;

mat4 rotateX(vec2 sincos) {
    float s = sincos.x;
    float c = sincos.y;
    return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, c,   s,   0.0,
        0.0, -s,  c,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

mat4 rotateY(vec2 sincos) {
    float s = sincos.x;
    float c = sincos.y;
    return mat4(
        c,   0.0, -s,  0.0,
        0.0, 1.0, 0.0, 0.0,
        s,   0.0, c,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

mat4 scale(float s) {
    return mat4(
        s,   0.0, 0.0, 0.0,
        0.0, s,   0.0, 0.0,
        0.0, 0.0, s,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

void main() {
    mat4 model = rotateY(aSinCosY) * rotateX(aSinCosX) * scale(aScale);
    vColor = aColor;
    vOpacity = aOpacity;
    gl_Position = uProjection * uView * model * vec4(aPos, 1.0);
}`;

        const fs = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vOpacity;
out vec4 fragColor;
void main() {
    fragColor = vec4(vColor, vOpacity);
}`;

        const compileShader = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
            }
            return sh;
        };

        this.prog = gl.createProgram();
        gl.attachShader(this.prog, compileShader(gl.VERTEX_SHADER, vs));
        gl.attachShader(this.prog, compileShader(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(this.prog);

        if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(this.prog) || 'Program link error');
        }
    }

    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }

    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;

        if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
        else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
        else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
        else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
        else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
        else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

        const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
        const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
        const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

        return `#${rHex}${gHex}${bHex}`;
    }

    buildPolytopeGeometry() {
        const gl = this.gl;
        const vertices = this.permutahedron.vertices;
        const edges = this.permutahedron.edges;

        const positions = [];
        edges.forEach(([a, b]) => {
            const vA = vertices[a];
            const vB = vertices[b];
            positions.push(vA[0], vA[1], vA[2]);
            positions.push(vB[0], vB[1], vB[2]);
        });

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(0, 0);

        gl.bindVertexArray(null);

        this.sharedGeometry = {
            vao,
            vertexCount: positions.length / 3
        };

        this.polytopes = Array.from({ length: NUM_NESTED_POLYTOPES }, (_, i) => {
            const hue = (i * 360 / NUM_NESTED_POLYTOPES) % 360;
            const sat = i === 0 ? 0 : 100;
            const light = i === 0 ? 100 : 50;
            const color = this.hslToHex(hue, sat, light);
            const rgb = this.hexToRgb(color);
            const opacity = 0.95 - (i * 0.1);

            return {
                rotationX: 0,
                rotationY: 0,
                driftX: 0,
                driftY: 0,
                scale: 1.0,
                index: i,
                color: rgb,
                opacity: opacity
            };
        });
    }

    setupInstanceBuffer() {
        const gl = this.gl;

        this.instanceData = new Float32Array(NUM_NESTED_POLYTOPES * 9);

        this.instanceBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

        gl.bindVertexArray(this.sharedGeometry.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

        const stride = 9 * 4;

        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(1, 1);

        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8);
        gl.vertexAttribDivisor(2, 1);

        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16);
        gl.vertexAttribDivisor(3, 1);

        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 20);
        gl.vertexAttribDivisor(4, 1);

        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 32);
        gl.vertexAttribDivisor(5, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    setupEventListeners() {
        const canvas = this.querySelector('#canvas');

        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', () => this.handleMouseUp());
        canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', () => this.handleTouchEnd());
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastTime = performance.now();
        this.velocityTheta = 0;
        this.velocityPhi = 0;
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;

        const currentTime = performance.now();
        const deltaTime = Math.max(1, currentTime - this.lastTime);

        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;

        const sensitivity = Math.PI / 450 * 0.5;
        const deltaTheta = -deltaX * sensitivity;
        const deltaPhi = -deltaY * sensitivity;

        this.spherical.theta += deltaTheta;
        this.spherical.phi += deltaPhi;
        this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

        this.velocityTheta = deltaTheta / deltaTime * 16;
        this.velocityPhi = deltaPhi / deltaTime * 16;

        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastTime = currentTime;
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const scale = Math.pow(0.95, Math.abs(e.deltaY * 0.01));
        if (e.deltaY < 0) {
            this.sphericalDelta.radius /= scale;
        } else {
            this.sphericalDelta.radius *= scale;
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touches = Array.from(e.touches);

        if (touches.length === 1) {
            this.isDragging = true;
            this.lastX = touches[0].clientX;
            this.lastY = touches[0].clientY;
            this.lastTime = performance.now();
            this.velocityTheta = 0;
            this.velocityPhi = 0;
        } else if (touches.length === 2) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            this.touchStartDist = Math.sqrt(dx * dx + dy * dy);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touches = Array.from(e.touches);

        if (touches.length === 1 && this.isDragging) {
            const currentTime = performance.now();
            const deltaTime = Math.max(1, currentTime - this.lastTime);

            const deltaX = touches[0].clientX - this.lastX;
            const deltaY = touches[0].clientY - this.lastY;

            const sensitivity = Math.PI / 450 * 0.5;
            const deltaTheta = -deltaX * sensitivity;
            const deltaPhi = -deltaY * sensitivity;

            this.spherical.theta += deltaTheta;
            this.spherical.phi += deltaPhi;
            this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

            this.velocityTheta = deltaTheta / deltaTime * 16;
            this.velocityPhi = deltaPhi / deltaTime * 16;

            this.lastX = touches[0].clientX;
            this.lastY = touches[0].clientY;
            this.lastTime = currentTime;
        } else if (touches.length === 2 && this.touchStartDist > 0) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (this.touchStartDist > 0) {
                const scale = this.touchStartDist / distance;
                this.sphericalDelta.radius *= scale;
                this.touchStartDist = distance;
            }
        }
    }

    handleTouchEnd() {
        this.isDragging = false;
        this.touchStartDist = 0;
    }

    setupResizeObserver() {
        const handleResize = () => {
            const canvas = this.querySelector('#canvas');
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.floor(width * dpr);
            const h = Math.floor(height * dpr);

            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }

            this.gl.viewport(0, 0, canvas.width, canvas.height);
        };

        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }

    removeLoadingSkeleton() {
        const skeleton = document.getElementById('skeleton');
        const canvas = this.querySelector('#canvas');

        if (skeleton) {
            skeleton.classList.add('fade-out');
            setTimeout(() => skeleton.remove(), 300);
        }

        if (canvas) {
            canvas.style.opacity = '1';
        }
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.updateCamera();
            this.updatePolytopes();
            this.render();
        };
        animate();
    }

    updateCamera() {
        if (!this.isDragging) {
            this.spherical.theta += this.velocityTheta;
            this.spherical.phi += this.velocityPhi;
            this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

            this.velocityTheta *= 0.92;
            this.velocityPhi *= 0.92;

            if (Math.abs(this.velocityTheta) < 0.0001) this.velocityTheta = 0;
            if (Math.abs(this.velocityPhi) < 0.0001) this.velocityPhi = 0;
        }

        this.spherical.radius *= this.sphericalDelta.radius;
        this.sphericalDelta.radius = 1;
        //this.spherical.radius = Math.max(1, this.spherical.radius); // Can zoom out as much as wanted
    }

    updatePolytopes() {
        const deltaTime = 16;
        this.time += deltaTime;

        const cycleTime = this.time % this.cycleDuration;
        const lastCycleTime = (this.time - deltaTime) % this.cycleDuration;

        if (cycleTime < lastCycleTime) {
            this.rotationDirection *= -1;
        }

        const { desyncAmount, rotationSpeed, phaseName, phaseProgress, isSyncing, sizeMultiplier, offsetMultiplier } = this.calculatePhaseValues(cycleTime);

        this.currentSizeMultiplier = sizeMultiplier;

        this.updateDebugUI(phaseName, phaseProgress, desyncAmount, rotationSpeed);

        this.baseAngleX += rotationSpeed;
        this.baseAngleY += rotationSpeed;

        this.polytopes.forEach((p, i) => {
            const driftSpeedX = rotationSpeed * (this.speedMultipliers[i].x - 1) * desyncAmount;
            const driftSpeedY = rotationSpeed * (this.speedMultipliers[i].y - 1) * desyncAmount;

            p.driftX += driftSpeedX;
            p.driftY += driftSpeedY;

            if (isSyncing) {
                const syncProgress = 1 - desyncAmount;
                const maxDecay = 0.015;
                const decayFactor = 1 - (syncProgress * maxDecay);
                p.driftX *= decayFactor;
                p.driftY *= decayFactor;
            }

            p.rotationX = this.baseAngleX + p.driftX;
            p.rotationY = this.baseAngleY + p.driftY;

            const baseScale = (i + 1) * this.polytopeSpacing * offsetMultiplier;
            p.scale = baseScale;

            const sinX = Math.sin(p.rotationX);
            const cosX = Math.cos(p.rotationX);
            const sinY = Math.sin(p.rotationY);
            const cosY = Math.cos(p.rotationY);

            const offset = i * 9;
            this.instanceData[offset + 0] = sinX;
            this.instanceData[offset + 1] = cosX;
            this.instanceData[offset + 2] = sinY;
            this.instanceData[offset + 3] = cosY;
            this.instanceData[offset + 4] = p.scale;
            this.instanceData[offset + 5] = p.color[0];
            this.instanceData[offset + 6] = p.color[1];
            this.instanceData[offset + 7] = p.color[2];
            this.instanceData[offset + 8] = p.opacity;
        });
    }

    // Smootherstep interpolation function (smoother than smoothstep)
    // Has zero 1st and 2nd order derivatives at t=0 and t=1
    smootherstep(t) {
        t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    updateDebugUI(phaseName, phaseProgress, desyncAmount, rotationSpeed) {
        const phaseText = this.querySelector('#phase-text');
        const progressFill = this.querySelector('#progress-fill');

        if (phaseText && this.polytopes.length > 0) {
            // Sample drift from last polytope (most drift)
            const lastPoly = this.polytopes[this.polytopes.length - 1];
            phaseText.innerHTML = `
                Phase: ${phaseName}<br>
                Desync: ${desyncAmount.toFixed(2)} | Speed: ${rotationSpeed.toFixed(3)}<br>
                Drift: ${lastPoly.driftX.toFixed(3)} | Dir: ${this.rotationDirection > 0 ? '+' : '-'}
            `;
        }

        if (progressFill) {
            const progressPercent = (phaseProgress * 100).toFixed(1);
            progressFill.style.width = `${progressPercent}%`;
        }
    }

    calculatePhaseValues(cycleTime) {
        const t1 = SYNCED_SLOW_DURATION;
        const t2 = t1 + DESYNC_SPEEDUP_DURATION;
        const t3 = t2 + DESYNC_SLOWDOWN_DURATION;
        const t4 = t3 + DESYNCED_SLOW_DURATION;
        const t5 = t4 + SYNC_SPEEDUP_DURATION;

        let desyncAmount, rotationSpeed, phaseName, phaseProgress, isSyncing, sizeMultiplier, offsetMultiplier;
        let speedProgress = 0;
        let baseSpeed;

        if (cycleTime < t1) {
            phaseName = "1: Synced Slow";
            phaseProgress = cycleTime / SYNCED_SLOW_DURATION;
            baseSpeed = SLOW_ROTATION_SPEED;
            rotationSpeed = baseSpeed * this.rotationDirection;
            isSyncing = false;
            sizeMultiplier = PHASE_1_SIZE;
            offsetMultiplier = PHASE_1_OFFSET;
        } else if (cycleTime < t2) {
            phaseName = "2: Desync & Speed Up";
            phaseProgress = (cycleTime - t1) / DESYNC_SPEEDUP_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = SLOW_ROTATION_SPEED + (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * this.rotationDirection;
            isSyncing = false;
            sizeMultiplier = PHASE_2_START_SIZE + (speedProgress * (PHASE_2_END_SIZE - PHASE_2_START_SIZE));
            offsetMultiplier = PHASE_2_START_OFFSET + (speedProgress * (PHASE_2_END_OFFSET - PHASE_2_START_OFFSET));
        } else if (cycleTime < t3) {
            phaseName = "3: Desync & Slow Down";
            phaseProgress = (cycleTime - t2) / DESYNC_SLOWDOWN_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = FAST_ROTATION_SPEED - (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * this.rotationDirection;
            isSyncing = false;
            sizeMultiplier = PHASE_3_START_SIZE + (speedProgress * (PHASE_3_END_SIZE - PHASE_3_START_SIZE));
            offsetMultiplier = PHASE_3_START_OFFSET + (speedProgress * (PHASE_3_END_OFFSET - PHASE_3_START_OFFSET));
        } else if (cycleTime < t4) {
            phaseName = "4: Desynced Slow (Reversing)";
            phaseProgress = (cycleTime - t3) / DESYNCED_SLOW_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            const directionMultiplier = 1 - (speedProgress * 2);
            rotationSpeed = SLOW_ROTATION_SPEED * this.rotationDirection * directionMultiplier;
            isSyncing = false;
            sizeMultiplier = PHASE_4_START_SIZE + (speedProgress * (PHASE_4_END_SIZE - PHASE_4_START_SIZE));
            offsetMultiplier = PHASE_4_START_OFFSET + (speedProgress * (PHASE_4_END_OFFSET - PHASE_4_START_OFFSET));
        } else if (cycleTime < t5) {
            phaseName = "5: Sync Halfway & Speed Up";
            phaseProgress = (cycleTime - t4) / SYNC_SPEEDUP_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = SLOW_ROTATION_SPEED + (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * (-this.rotationDirection);
            isSyncing = true;
            sizeMultiplier = PHASE_5_START_SIZE + (speedProgress * (PHASE_5_END_SIZE - PHASE_5_START_SIZE));
            offsetMultiplier = PHASE_5_START_OFFSET + (speedProgress * (PHASE_5_END_OFFSET - PHASE_5_START_OFFSET));
        } else {
            phaseName = "6: Sync Complete & Slow Down";
            phaseProgress = (cycleTime - t5) / SYNC_SLOWDOWN_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = FAST_ROTATION_SPEED - (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * (-this.rotationDirection);
            isSyncing = true;
            sizeMultiplier = PHASE_6_START_SIZE + (speedProgress * (PHASE_6_END_SIZE - PHASE_6_START_SIZE));
            offsetMultiplier = PHASE_6_START_OFFSET + (speedProgress * (PHASE_6_END_OFFSET - PHASE_6_START_OFFSET));
        }

        if (cycleTime < t1) {
            desyncAmount = 0;
        } else if (cycleTime < t2) {
            desyncAmount = this.smootherstep((cycleTime - t1) / DESYNC_SPEEDUP_DURATION);
        } else if (cycleTime < t4) {
            desyncAmount = 1;
        } else if (cycleTime < t5) {
            const progress = this.smootherstep((cycleTime - t4) / SYNC_SPEEDUP_DURATION);
            desyncAmount = 1 - (progress * 0.5);
        } else {
            const progress = this.smootherstep((cycleTime - t5) / SYNC_SLOWDOWN_DURATION);
            desyncAmount = 0.5 - (progress * 0.5);
        }

        return { desyncAmount, rotationSpeed, phaseName, phaseProgress, isSyncing, sizeMultiplier, offsetMultiplier };
    }

    render() {
        const gl = this.gl;
        const canvas = this.querySelector('#canvas');

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.prog);

        gl.lineWidth(2.0);

        const aspect = Math.max(1e-6, canvas.width / canvas.height);
        const P = this.mat4Perspective(75 * Math.PI / 180, aspect, 0.1, 1000.0);

        const animatedRadius = (BASE_CAMERA_RADIUS / this.currentSizeMultiplier) * this.spherical.radius / INITIAL_RADIUS;
        const camX = animatedRadius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
        const camY = animatedRadius * Math.cos(this.spherical.phi);
        const camZ = animatedRadius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
        const camPos = [camX, camY, camZ];

        const V = this.mat4LookAt(camPos, [0, 0, 0], [0, 1, 0]);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uProjection'), false, P);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uView'), false, V);

        gl.bindVertexArray(this.sharedGeometry.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData);

        gl.drawArraysInstanced(gl.LINES, 0, this.sharedGeometry.vertexCount, NUM_NESTED_POLYTOPES);

        gl.bindVertexArray(null);
    }

    // Matrix math helpers
    mat4Identity() {
        return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    }

    mat4Multiply(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                o[c * 4 + r] =
                    a[0 * 4 + r] * b[c * 4 + 0] +
                    a[1 * 4 + r] * b[c * 4 + 1] +
                    a[2 * 4 + r] * b[c * 4 + 2] +
                    a[3 * 4 + r] * b[c * 4 + 3];
            }
        }
        return o;
    }

    mat4Perspective(fovy, aspect, near, far) {
        const f = 1 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        const o = new Float32Array(16);
        o[0] = f / aspect;
        o[5] = f;
        o[10] = (far + near) * nf;
        o[11] = -1;
        o[14] = (2 * far * near) * nf;
        return o;
    }

    mat4LookAt(eye, target, up) {
        const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const cross = (a, b) => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const normalize = (v) => {
            const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
        };

        const z = normalize(subtract(eye, target));
        const x = normalize(cross(up, z));
        const y = cross(z, x);

        return new Float32Array([
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
        ]);
    }

    cleanup() {
        if (this.gl && this.sharedGeometry) {
            if (this.sharedGeometry.vao) {
                this.gl.deleteVertexArray(this.sharedGeometry.vao);
            }
        }
        if (this.gl && this.instanceBuffer) {
            this.gl.deleteBuffer(this.instanceBuffer);
        }
        if (this.gl && this.prog) {
            this.gl.deleteProgram(this.prog);
        }
    }
}

customElements.define('breathing-viz', BreathingViz);
