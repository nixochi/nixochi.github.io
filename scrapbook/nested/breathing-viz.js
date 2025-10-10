/**
 * Breathing Visualization Web Component (Raw WebGL2)
 * Nested permutahedra with synchronized breathing animation
 */

// ============================================
// CONFIGURATION PARAMETERS
// ============================================
const NUM_NESTED_POLYTOPES = 200;  // Number of nested polytopes to render

// Time multiplier (1.0 = normal speed, 2.0 = twice as fast, 0.5 = half speed)
const TIME_MULTIPLIER = 0.3;

// Animation Phase Durations (in milliseconds)
const SYNCED_SLOW_DURATION = 1000 / TIME_MULTIPLIER;        // Phase 1: Synced, slow rotation
const DESYNC_SPEEDUP_DURATION = 4000 / TIME_MULTIPLIER;     // Phase 2: Desyncing and speeding up
const DESYNC_SLOWDOWN_DURATION = 4000 / TIME_MULTIPLIER;    // Phase 3: Desynced, slowing down
const DESYNCED_SLOW_DURATION = 2000 / TIME_MULTIPLIER;      // Phase 4: Desynced, slow rotation
const SYNC_SPEEDUP_DURATION = 4000 / TIME_MULTIPLIER;       // Phase 5: Syncing halfway and speeding up
const SYNC_SLOWDOWN_DURATION = 4000 / TIME_MULTIPLIER;      // Phase 6: Syncing rest of way and slowing down

// Speed settings
const SLOW_ROTATION_SPEED = 0.01;        // Slow rotation speed
const FAST_ROTATION_SPEED = 0.04;         // Fast rotation speed

// Size settings (based on speed)
const MAX_SPEED_SIZE = 1;              // Size multiplier at slow speed
const MIN_SPEED_SIZE = 0.6;              // Size multiplier at fast speed

// Camera settings
const INITIAL_RADIUS = 110;              // Initial camera distance from origin

// Desync settings
const MAX_DESYNC_PERCENTAGE = 1;       // Maximum desync as percentage of full rotation (1.0 = full rotation)
// ============================================

class BreathingViz extends HTMLElement {
    constructor() {
        super();

        // WebGL objects
        this.gl = null;
        this.prog = null;
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
        this.setupEventListeners();
        this.setupResizeObserver();
        this.removeLoadingSkeleton();
        this.startAnimationLoop();
    }

    setupWebGL() {
        const canvas = this.querySelector('#canvas');
        this.gl = canvas.getContext('webgl2', { antialias: true, alpha: false });

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
layout(location=1) in vec3 aColor;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec3 vColor;
void main() {
    vColor = aColor;
    gl_Position = uMVP * vec4(aPos, 1.0);
}`;

        const fs = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
uniform float uOpacity;
void main() {
    fragColor = vec4(vColor, uOpacity);
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

        // Generate color configs based on NUM_NESTED_POLYTOPES
        const polytopeConfigs = Array.from({ length: NUM_NESTED_POLYTOPES }, (_, i) => {
            // Generate colors along a spectrum
            const hue = (i * 360 / NUM_NESTED_POLYTOPES) % 360;
            const sat = i === 0 ? 0 : 100;
            const light = i === 0 ? 100 : 50;
            const color = this.hslToHex(hue, sat, light);
            const opacity = 0.95 - (i * 0.1);
            return { color, opacity };
        });

        this.polytopes = polytopeConfigs.map((config, i) => {
            const rgb = this.hexToRgb(config.color);
            const positions = [];
            const colors = [];

            edges.forEach(([a, b]) => {
                const vA = vertices[a];
                const vB = vertices[b];

                positions.push(vA[0], vA[1], vA[2]);
                positions.push(vB[0], vB[1], vB[2]);

                colors.push(...rgb);
                colors.push(...rgb);
            });

            const vao = gl.createVertexArray();
            gl.bindVertexArray(vao);

            const posBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

            const colBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

            gl.bindVertexArray(null);

            return {
                vao,
                vertexCount: positions.length / 3,
                opacity: config.opacity,
                rotationX: 0,
                rotationY: 0,
                driftX: 0,  // Accumulated drift from base rotation
                driftY: 0,  // Accumulated drift from base rotation
                scale: 1.0,
                index: i
            };
        });
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

        // Flip direction at cycle boundary (when we wrap from phase 6 back to phase 1)
        if (cycleTime < lastCycleTime) {
            this.rotationDirection *= -1;
        }

        const { desyncAmount, rotationSpeed, phaseName, phaseProgress, isSyncing } = this.calculatePhaseValues(cycleTime);

        // Update debug UI
        this.updateDebugUI(phaseName, phaseProgress, desyncAmount, rotationSpeed);

        // Update shared base angles (all polytopes sync to these)
        this.baseAngleX += rotationSpeed;
        this.baseAngleY += rotationSpeed;

        this.polytopes.forEach((p, i) => {
            // Update each polytope's drift (accumulated difference from base)
            // This is the EXTRA rotation beyond the base, scaled by speed multiplier
            // Scale drift accumulation by desyncAmount so drift grows when desynced
            // and stops growing when synced, making sync transitions smoother
            const driftSpeedX = rotationSpeed * (this.speedMultipliers[i].x - 1) * desyncAmount;
            const driftSpeedY = rotationSpeed * (this.speedMultipliers[i].y - 1) * desyncAmount;

            p.driftX += driftSpeedX;
            p.driftY += driftSpeedY;

            // Apply decay to drift ONLY during active syncing phases (5 and 6)
            // Decay strength is proportional to how much we've synced (1 - desyncAmount)
            // This ensures smooth, continuous transitions with no discontinuities
            if (isSyncing) {
                const syncProgress = 1 - desyncAmount; // 0 at phase 5 start, 1 at phase 6 end
                const maxDecay = 0.015; // Maximum decay per frame (when fully synced)
                const decayFactor = 1 - (syncProgress * maxDecay);
                p.driftX *= decayFactor;
                p.driftY *= decayFactor;
            }

            // Final rotation = base + drift (no scaling to avoid visual reversal)
            // Drift naturally decays to zero when syncing, maintaining forward rotation
            p.rotationX = this.baseAngleX + p.driftX;
            p.rotationY = this.baseAngleY + p.driftY;

            // Size based on current speed percentage
            // Calculate speed percentage: 0 = slow speed, 1 = fast speed
            const speedMagnitude = Math.abs(rotationSpeed);
            const speedPercentage = (speedMagnitude - SLOW_ROTATION_SPEED) / (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED);
            const clampedSpeedPercentage = Math.max(0, Math.min(1, speedPercentage));

            // Linear interpolation: at slow speed (0%) use MAX_SPEED_SIZE, at fast speed (100%) use MIN_SPEED_SIZE
            const sizeMultiplier = MAX_SPEED_SIZE + (clampedSpeedPercentage * (MIN_SPEED_SIZE - MAX_SPEED_SIZE));

            const baseScale = (i + 1) * this.polytopeSpacing;
            p.scale = baseScale * sizeMultiplier;
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

        let desyncAmount, rotationSpeed, phaseName, phaseProgress, isSyncing;

        // Calculate base speed (magnitude) for each phase
        let speedProgress = 0;
        let baseSpeed; // Speed magnitude before applying direction

        if (cycleTime < t1) {
            // Phase 1: constant slow
            phaseName = "1: Synced Slow";
            phaseProgress = cycleTime / SYNCED_SLOW_DURATION;
            baseSpeed = SLOW_ROTATION_SPEED;
            rotationSpeed = baseSpeed * this.rotationDirection;
            isSyncing = false;
        } else if (cycleTime < t2) {
            // Phase 2: smoothly speed up
            phaseName = "2: Desync & Speed Up";
            phaseProgress = (cycleTime - t1) / DESYNC_SPEEDUP_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = SLOW_ROTATION_SPEED + (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * this.rotationDirection;
            isSyncing = false;
        } else if (cycleTime < t3) {
            // Phase 3: smoothly slow down
            phaseName = "3: Desync & Slow Down";
            phaseProgress = (cycleTime - t2) / DESYNC_SLOWDOWN_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = FAST_ROTATION_SPEED - (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * this.rotationDirection;
            isSyncing = false;
        } else if (cycleTime < t4) {
            // Phase 4: smoothly reverse from rotationDirection to -rotationDirection
            phaseName = "4: Desynced Slow (Reversing)";
            phaseProgress = (cycleTime - t3) / DESYNCED_SLOW_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            // Smoothly transition the direction multiplier from +1 to -1 (relative to rotationDirection)
            const directionMultiplier = 1 - (speedProgress * 2); // Goes from 1 to -1
            rotationSpeed = SLOW_ROTATION_SPEED * this.rotationDirection * directionMultiplier;
            isSyncing = false;
        } else if (cycleTime < t5) {
            // Phase 5: smoothly speed up (in reversed direction)
            phaseName = "5: Sync Halfway & Speed Up";
            phaseProgress = (cycleTime - t4) / SYNC_SPEEDUP_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = SLOW_ROTATION_SPEED + (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * (-this.rotationDirection); // Reversed from phases 1-3
            isSyncing = true;
        } else {
            // Phase 6: smoothly slow down (in reversed direction)
            phaseName = "6: Sync Complete & Slow Down";
            phaseProgress = (cycleTime - t5) / SYNC_SLOWDOWN_DURATION;
            speedProgress = this.smootherstep(phaseProgress);
            baseSpeed = FAST_ROTATION_SPEED - (speedProgress * (FAST_ROTATION_SPEED - SLOW_ROTATION_SPEED));
            rotationSpeed = baseSpeed * (-this.rotationDirection); // Reversed from phases 1-3
            isSyncing = true;
        }

        // Calculate desync using a globally smooth curve
        // Desync transitions: 0 -> 1 -> 1 -> 1 -> 0.5 -> 0
        if (cycleTime < t1) {
            // Phase 1: synced
            desyncAmount = 0;
        } else if (cycleTime < t2) {
            // Phase 2: smoothly desync from 0 to 1
            desyncAmount = this.smootherstep((cycleTime - t1) / DESYNC_SPEEDUP_DURATION);
        } else if (cycleTime < t4) {
            // Phases 3-4: stay desynced at 1
            desyncAmount = 1;
        } else if (cycleTime < t5) {
            // Phase 5: smoothly sync halfway from 1 to 0.5
            const progress = this.smootherstep((cycleTime - t4) / SYNC_SPEEDUP_DURATION);
            desyncAmount = 1 - (progress * 0.5);
        } else {
            // Phase 6: smoothly sync rest of way from 0.5 to 0
            const progress = this.smootherstep((cycleTime - t5) / SYNC_SLOWDOWN_DURATION);
            desyncAmount = 0.5 - (progress * 0.5);
        }

        return { desyncAmount, rotationSpeed, phaseName, phaseProgress, isSyncing };
    }

    render() {
        const gl = this.gl;
        const canvas = this.querySelector('#canvas');

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.prog);

        // Set line width (Note: many browsers/drivers only support 1.0)
        gl.lineWidth(2.0);

        const aspect = Math.max(1e-6, canvas.width / canvas.height);
        const P = this.mat4Perspective(75 * Math.PI / 180, aspect, 0.1, 1000.0);

        const camX = this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
        const camY = this.spherical.radius * Math.cos(this.spherical.phi);
        const camZ = this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
        const camPos = [camX, camY, camZ];

        const V = this.mat4LookAt(camPos, [0, 0, 0], [0, 1, 0]);

        this.polytopes.forEach(p => {
            const rotX = this.mat4RotateX(p.rotationX);
            const rotY = this.mat4RotateY(p.rotationY);
            const scale = this.mat4Scale(p.scale, p.scale, p.scale);

            const M = this.mat4Multiply(this.mat4Multiply(rotY, rotX), scale);
            const MVP = this.mat4Multiply(this.mat4Multiply(P, V), M);

            gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uMVP'), false, MVP);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uModel'), false, M);
            gl.uniform1f(gl.getUniformLocation(this.prog, 'uOpacity'), p.opacity);

            gl.bindVertexArray(p.vao);
            gl.drawArrays(gl.LINES, 0, p.vertexCount);
        });

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

    mat4RotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    }

    mat4RotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }

    mat4Scale(sx, sy, sz) {
        return new Float32Array([
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, sz, 0,
            0, 0, 0, 1
        ]);
    }

    cleanup() {
        if (this.gl && this.polytopes) {
            this.polytopes.forEach(p => {
                if (p.vao) this.gl.deleteVertexArray(p.vao);
            });
        }
        if (this.gl && this.prog) {
            this.gl.deleteProgram(this.prog);
        }
    }
}

customElements.define('breathing-viz', BreathingViz);
