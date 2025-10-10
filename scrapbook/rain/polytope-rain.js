/**
 * Polytope Rain Visualization Web Component (Raw WebGL2)
 * Permutahedra falling like rain drops
 */

// ============================================
// CONFIGURATION PARAMETERS
// ============================================
const SPAWN_RATE = 100;              // Milliseconds between spawns
const MIN_FALL_SPEED = 0.2;          // Minimum fall speed (units per frame)
const FALL_SPEED_VARIATION = 0.4;    // Additional random speed (0 to this value)
const MIN_ROTATION_SPEED = 0;     // Minimum rotation speed per axis
const ROTATION_SPEED_VARIATION = 0.1; // Additional random rotation speed
const MIN_POLYTOPE_SIZE = 0.4;       // Minimum size of each polytope
const POLYTOPE_SIZE_VARIATION = 0.5; // Additional random size (0 to this value)
const MAX_POLYTOPES = 200;           // Maximum polytopes at once
// ============================================

class PolytopeRain extends HTMLElement {
    constructor() {
        super();

        // WebGL objects
        this.gl = null;
        this.prog = null;
        this.polytopeGeometry = null;

        // Object pool for particles
        this.particlePool = [];
        this.initializeParticlePool();

        // Animation
        this.animationId = null;
        this._ro = null;
        this.time = 0;
        this.lastSpawnTime = 0;

        // Screen dimensions for spawning
        this.viewWidth = 100;
        this.viewHeight = 100;

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
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        container.appendChild(canvas);
        this.innerHTML = '';
        this.appendChild(container);

        // Initialize in next frame
        requestAnimationFrame(() => {
            try {
                this.initialize();
            } catch (err) {
                console.error('❌ Polytope rain initialization error:', err);
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
uniform mat4 uMVP;
uniform vec3 uColor;
out vec3 vColor;
void main() {
    vColor = uColor;
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

    hslToRgb(h, s, l) {
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

        return [r + m, g + m, b + m];
    }

    initializeParticlePool() {
        // Pre-allocate all particle objects
        for (let i = 0; i < MAX_POLYTOPES; i++) {
            this.particlePool.push({
                active: false,
                x: 0,
                y: 0,
                z: 0,
                rotX: 0,
                rotY: 0,
                rotZ: 0,
                rotSpeedX: 0,
                rotSpeedY: 0,
                rotSpeedZ: 0,
                fallSpeed: 0,
                size: 0,
                opacity: 0,
                color: [1, 1, 1]
            });
        }
    }

    buildPolytopeGeometry() {
        const gl = this.gl;
        const vertices = this.permutahedron.vertices;
        const edges = this.permutahedron.edges;

        // Create a single geometry that we'll reuse for all particles
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

        gl.bindVertexArray(null);

        this.polytopeGeometry = {
            vao,
            vertexCount: positions.length / 3
        };
    }

    activateParticle() {
        // Find an inactive particle in the pool
        const particle = this.particlePool.find(p => !p.active);
        if (!particle) return null; // Pool is full

        // Generate random color
        const hue = Math.random() * 360;
        const sat = 70 + Math.random() * 30; // 70-100% saturation
        const light = 50 + Math.random() * 20; // 50-70% lightness
        const color = this.hslToRgb(hue, sat, light);

        // Random rotation speeds with sign for direction
        const randomRotSpeed = () => {
            const sign = Math.random() < 0.5 ? -1 : 1;
            return sign * (MIN_ROTATION_SPEED + Math.random() * ROTATION_SPEED_VARIATION);
        };

        // Reset particle properties
        particle.active = true;
        particle.x = (Math.random() - 0.5) * this.viewWidth;
        particle.y = this.viewHeight / 2 + 10; // Spawn above visible area
        particle.z = 0; // No depth variation
        particle.rotX = Math.random() * Math.PI * 2;
        particle.rotY = Math.random() * Math.PI * 2;
        particle.rotZ = Math.random() * Math.PI * 2;
        particle.rotSpeedX = randomRotSpeed();
        particle.rotSpeedY = randomRotSpeed();
        particle.rotSpeedZ = randomRotSpeed();
        particle.fallSpeed = MIN_FALL_SPEED + Math.random() * FALL_SPEED_VARIATION;
        particle.size = MIN_POLYTOPE_SIZE + Math.random() * POLYTOPE_SIZE_VARIATION;
        particle.opacity = 0.7 + Math.random() * 0.3;
        particle.color[0] = color[0];
        particle.color[1] = color[1];
        particle.color[2] = color[2];

        return particle;
    }

    updateParticles() {
        const deltaTime = 16;
        this.time += deltaTime;

        // Spawn new particles from the pool
        if (this.time - this.lastSpawnTime > SPAWN_RATE) {
            this.activateParticle();
            this.lastSpawnTime = this.time;
        }

        // Update active particles
        const groundLevel = -this.viewHeight / 2 - 10;

        this.particlePool.forEach(p => {
            if (!p.active) return;

            // Update position and rotation
            p.y -= p.fallSpeed;
            p.rotX += p.rotSpeedX;
            p.rotY += p.rotSpeedY;
            p.rotZ += p.rotSpeedZ;

            // Deactivate particles that fall below screen
            if (p.y < groundLevel) {
                p.active = false;
            }
        });
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

            // Update view dimensions for orthographic projection
            const aspect = width / height;
            this.viewHeight = 50; // Fixed height in world units
            this.viewWidth = this.viewHeight * aspect;
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
            this.updateParticles();
            this.render();
        };
        animate();
    }

    render() {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.prog);

        gl.lineWidth(2.0);

        // Orthographic projection
        const halfWidth = this.viewWidth / 2;
        const halfHeight = this.viewHeight / 2;
        const P = this.mat4Ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -100, 100);

        // Render only active particles that are on screen
        gl.bindVertexArray(this.polytopeGeometry.vao);

        this.particlePool.forEach(p => {
            // Skip inactive particles
            if (!p.active) return;

            // Skip particles that are completely off-screen (with some margin)
            const margin = p.size * 3; // Account for polytope size
            if (p.y < -halfHeight - margin || p.y > halfHeight + margin ||
                p.x < -halfWidth - margin || p.x > halfWidth + margin) {
                return;
            }

            const rotX = this.mat4RotateX(p.rotX);
            const rotY = this.mat4RotateY(p.rotY);
            const rotZ = this.mat4RotateZ(p.rotZ);
            const scale = this.mat4Scale(p.size, p.size, p.size);
            const translation = this.mat4Translate(p.x, p.y, p.z);

            const M = this.mat4Multiply(
                translation,
                this.mat4Multiply(
                    this.mat4Multiply(rotZ, this.mat4Multiply(rotY, rotX)),
                    scale
                )
            );

            const MVP = this.mat4Multiply(P, M);

            gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uMVP'), false, MVP);
            gl.uniform3f(gl.getUniformLocation(this.prog, 'uColor'), p.color[0], p.color[1], p.color[2]);
            gl.uniform1f(gl.getUniformLocation(this.prog, 'uOpacity'), p.opacity);

            gl.drawArrays(gl.LINES, 0, this.polytopeGeometry.vertexCount);
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

    mat4Ortho(left, right, bottom, top, near, far) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);
        const o = new Float32Array(16);
        o[0] = -2 * lr;
        o[5] = -2 * bt;
        o[10] = 2 * nf;
        o[12] = (left + right) * lr;
        o[13] = (top + bottom) * bt;
        o[14] = (far + near) * nf;
        o[15] = 1;
        return o;
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

    mat4RotateZ(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
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

    mat4Translate(tx, ty, tz) {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, tz, 1
        ]);
    }

    cleanup() {
        if (this.gl && this.polytopeGeometry) {
            if (this.polytopeGeometry.vao) {
                this.gl.deleteVertexArray(this.polytopeGeometry.vao);
            }
        }
        if (this.gl && this.prog) {
            this.gl.deleteProgram(this.prog);
        }
    }
}

customElements.define('polytope-rain', PolytopeRain);
