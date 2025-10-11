/**
 * polytope rain webcomponent
 * 
 */

// ============================================
// CONFIGURATION PARAMETERS
// ============================================
const TARGET_FPS = 60;
const DRIZZLE_RATE = 0.2;
const RAIN_RATE = 2;
const STORM_RATE = 15;
const DELUGE_RATE = 55;
const APOCALYPSE_RATE = 155;
const MIN_FALL_SPEED = 0.2;
const FALL_SPEED_VARIATION = 0.4;
const MIN_ROTATION_SPEED = 0;
const ROTATION_SPEED_VARIATION = 0.1;
const MIN_POLYTOPE_SIZE = 0.4;
const POLYTOPE_SIZE_VARIATION = 0.5;
const MAX_POLYTOPES = 30000;
// ============================================

class PolytopeRain extends HTMLElement {
    constructor() {
        super();

        this.gl = null;
        this.prog = null;
        this.polytopeGeometry = null;
        this.instanceBuffer = null;
        this.instanceBufferB = null;  // Second buffer for double buffering
        this.currentBuffer = 0;  // Track which buffer to use (0 or 1)
        this.instanceData = null;

        this.particlePool = [];
        this.activeParticleCount = 0;
        this.freeParticleIndices = [];
        this.activeParticleIndices = [];
        this.initializeParticlePool();

        this.animationId = null;
        this._ro = null;
        this.spawnAccumulator = 0;
        this.currentSpawnRate = DRIZZLE_RATE;

        this.frameInterval = 1000 / TARGET_FPS;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lastSecondTimestamp = 0;
        this.currentFPS = 0;
        this.fpsUpdateInterval = 500;
        this.lastFpsUpdate = 0;

        this.viewWidth = 100;
        this.viewHeight = 100;

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
        if (!document.getElementById('polytope-rain-styles')) {
            const style = document.createElement('style');
            style.id = 'polytope-rain-styles';
            style.textContent = `
                :root {
                    --bg-primary: #161617;
                    --bg-secondary: #1c1c1e;
                    --fg-primary: #f3f3f3;
                    --fg-secondary: #b9b9b9;
                    --border: #222224;
                    --shadow: rgba(0,0,0,0.5);
                    --backdrop-blur: rgba(28, 28, 30, 0.9);
                    --radius: 12px;
                }

                .intensity-toggle-container {
                    position: absolute;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1000;
                }

                @media (min-width: 768px) {
                    .intensity-toggle-container {
                        top: 20px;
                        right: 20px;
                        bottom: auto;
                        left: auto;
                        transform: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        const container = document.createElement('div');
        container.style.cssText = `
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            background: transparent;
        `;

        const canvas = document.createElement('canvas');
        canvas.id = 'canvas';
        canvas.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        const fpsCounter = document.createElement('div');
        fpsCounter.id = 'fps-counter';
        fpsCounter.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            color: #00ff00;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            background: rgba(0, 0, 0, 0.5);
            padding: 3px 5px;
            pointer-events: none;
            z-index: 1000;
        `;
        fpsCounter.textContent = 'FPS: --';

        const polytopesCounter = document.createElement('div');
        polytopesCounter.id = 'polytopes-counter';
        polytopesCounter.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            color: #00ff00;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            background: rgba(0, 0, 0, 0.5);
            padding: 3px 5px;
            pointer-events: none;
            z-index: 1000;
        `;
        polytopesCounter.textContent = 'Polytopes: 0';

        const intensityToggle = document.createElement('div');
        intensityToggle.className = 'intensity-toggle-container';

        const switchContainer = document.createElement('div');
        switchContainer.id = 'intensity-switch';
        switchContainer.style.cssText = `
            display: inline-flex;
            background: var(--backdrop-blur);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 2px;
            position: relative;
            box-shadow: var(--shadow);
        `;

        const indicator = document.createElement('div');
        indicator.id = 'intensity-indicator';
        indicator.style.cssText = `
            position: absolute;
            background: color-mix(in srgb, var(--bg-secondary) 70%, var(--fg-primary) 30%);
            border-radius: 6px;
            transition: transform 0.2s ease, width 0.2s ease;
            height: calc(100% - 4px);
            top: 2px;
            left: 2px;
            z-index: 0;
        `;

        const drizzleBtn = document.createElement('button');
        drizzleBtn.id = 'drizzle-btn';
        drizzleBtn.textContent = 'drizzle';
        drizzleBtn.classList.add('active');
        drizzleBtn.style.cssText = `
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            color: var(--fg-primary);
            cursor: pointer;
            transition: color 0.2s ease;
            position: relative;
            z-index: 1;
            border: none;
            background: transparent;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const rainBtn = document.createElement('button');
        rainBtn.id = 'rain-btn';
        rainBtn.textContent = 'rain';
        rainBtn.style.cssText = `
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            color: var(--fg-secondary);
            cursor: pointer;
            transition: color 0.2s ease;
            position: relative;
            z-index: 1;
            border: none;
            background: transparent;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const stormBtn = document.createElement('button');
        stormBtn.id = 'storm-btn';
        stormBtn.textContent = 'storm';
        stormBtn.style.cssText = `
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            color: var(--fg-secondary);
            cursor: pointer;
            transition: color 0.2s ease;
            position: relative;
            z-index: 1;
            border: none;
            background: transparent;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const delugeBtn = document.createElement('button');
        delugeBtn.id = 'deluge-btn';
        delugeBtn.textContent = 'deluge';
        delugeBtn.style.cssText = `
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            color: var(--fg-secondary);
            cursor: pointer;
            transition: color 0.2s ease;
            position: relative;
            z-index: 1;
            border: none;
            background: transparent;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const apocalypseBtn = document.createElement('button');
        apocalypseBtn.id = 'apocalypse-btn';
        apocalypseBtn.textContent = 'apocalypse';
        apocalypseBtn.style.cssText = `
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            color: var(--fg-secondary);
            cursor: pointer;
            transition: color 0.2s ease;
            position: relative;
            z-index: 1;
            border: none;
            background: transparent;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        switchContainer.appendChild(indicator);
        switchContainer.appendChild(drizzleBtn);
        switchContainer.appendChild(rainBtn);
        switchContainer.appendChild(stormBtn);
        switchContainer.appendChild(delugeBtn);
        switchContainer.appendChild(apocalypseBtn);
        intensityToggle.appendChild(switchContainer);

        container.appendChild(canvas);
        container.appendChild(fpsCounter);
        container.appendChild(polytopesCounter);
        container.appendChild(intensityToggle);
        this.innerHTML = '';
        this.appendChild(container);

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
        this.setupInstanceBuffer();
        this.setupIntensityToggle();
        this.setupResizeObserver();
        this.removeLoadingSkeleton();
        this.startAnimationLoop();
    }

    setupIntensityToggle() {
        const drizzleBtn = this.querySelector('#drizzle-btn');
        const rainBtn = this.querySelector('#rain-btn');
        const stormBtn = this.querySelector('#storm-btn');
        const delugeBtn = this.querySelector('#deluge-btn');
        const apocalypseBtn = this.querySelector('#apocalypse-btn');
        const indicator = this.querySelector('#intensity-indicator');

        const updateIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            indicator.style.width = `${btnRect.width}px`;
            indicator.style.transform = `translateX(${offset}px)`;
        };

        const setActiveButton = (activeBtn, spawnRate) => {
            drizzleBtn.classList.remove('active');
            rainBtn.classList.remove('active');
            stormBtn.classList.remove('active');
            delugeBtn.classList.remove('active');
            apocalypseBtn.classList.remove('active');
            activeBtn.classList.add('active');

            drizzleBtn.style.color = 'var(--fg-secondary)';
            rainBtn.style.color = 'var(--fg-secondary)';
            stormBtn.style.color = 'var(--fg-secondary)';
            delugeBtn.style.color = 'var(--fg-secondary)';
            apocalypseBtn.style.color = 'var(--fg-secondary)';
            activeBtn.style.color = 'var(--fg-primary)';

            updateIndicator(activeBtn);

            this.currentSpawnRate = spawnRate;
        };

        drizzleBtn.addEventListener('click', () => {
            setActiveButton(drizzleBtn, DRIZZLE_RATE);
        });

        rainBtn.addEventListener('click', () => {
            setActiveButton(rainBtn, RAIN_RATE);
        });

        stormBtn.addEventListener('click', () => {
            setActiveButton(stormBtn, STORM_RATE);
        });

        delugeBtn.addEventListener('click', () => {
            setActiveButton(delugeBtn, DELUGE_RATE);
        });

        apocalypseBtn.addEventListener('click', () => {
            setActiveButton(apocalypseBtn, APOCALYPSE_RATE);
        });

        requestAnimationFrame(() => {
            updateIndicator(drizzleBtn);
        });
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

        // Optimized vertex shader: receives precomputed sin/cos values
        const vs = `#version 300 es
layout(location=0) in vec3 aPos;

// Instance attributes - precomputed sin/cos for rotations
layout(location=1) in vec3 aInstancePos;
layout(location=2) in vec2 aSinCosX;  // (sin, cos) for X rotation
layout(location=3) in vec2 aSinCosY;  // (sin, cos) for Y rotation
layout(location=4) in vec2 aSinCosZ;  // (sin, cos) for Z rotation
layout(location=5) in float aInstanceScale;
layout(location=6) in vec3 aInstanceColor;

uniform mat4 uProjection;

out vec3 vColor;

// Build rotation matrices from precomputed sin/cos values
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

mat4 rotateZ(vec2 sincos) {
    float s = sincos.x;
    float c = sincos.y;
    return mat4(
        c,   s,   0.0, 0.0,
        -s,  c,   0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

mat4 translate(vec3 pos) {
    return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        pos.x, pos.y, pos.z, 1.0
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
    mat4 model = translate(aInstancePos)
               * rotateZ(aSinCosZ)
               * rotateY(aSinCosY)
               * rotateX(aSinCosX)
               * scale(aInstanceScale);

    vColor = aInstanceColor;
    gl_Position = uProjection * model * vec4(aPos, 1.0);
}`;

        // Simplified fragment shader: hardcoded opacity
        const fs = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() {
    fragColor = vec4(vColor, 1.0);
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
                color: [1, 1, 1]
            });
            this.freeParticleIndices.push(i);
        }
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

        this.polytopeGeometry = {
            vao,
            vertexCount: positions.length / 3
        };
    }

    setupInstanceBuffer() {
        const gl = this.gl;

        // Instance data layout (13 floats per instance):
        // pos(3) + sinCosX(2) + sinCosY(2) + sinCosZ(2) + scale(1) + color(3) = 13 floats
        this.instanceData = new Float32Array(MAX_POLYTOPES * 13);
        
        // Create TWO instance buffers for double buffering
        this.instanceBuffer = gl.createBuffer();
        this.instanceBufferB = gl.createBuffer();

        // Set up both buffers identically
        [this.instanceBuffer, this.instanceBufferB].forEach(buffer => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);
        });

        // Set up VAO with instance buffer A (we'll swap during render)
        gl.bindVertexArray(this.polytopeGeometry.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

        const stride = 13 * 4; // 13 floats * 4 bytes = 52 bytes per instance

        // Position (location=1) - 3 floats at byte offset 0
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(1, 1);

        // SinCosX (location=2) - 2 floats at byte offset 12
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 12);
        gl.vertexAttribDivisor(2, 1);

        // SinCosY (location=3) - 2 floats at byte offset 20
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 20);
        gl.vertexAttribDivisor(3, 1);

        // SinCosZ (location=4) - 2 floats at byte offset 28
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 28);
        gl.vertexAttribDivisor(4, 1);

        // Scale (location=5) - 1 float at byte offset 36
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 36);
        gl.vertexAttribDivisor(5, 1);

        // Color (location=6) - 3 floats at byte offset 40
        gl.enableVertexAttribArray(6);
        gl.vertexAttribPointer(6, 3, gl.FLOAT, false, stride, 40);
        gl.vertexAttribDivisor(6, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    activateParticle() {
        if (this.freeParticleIndices.length === 0) return null;

        const particleIndex = this.freeParticleIndices.pop();
        const particle = this.particlePool[particleIndex];

        const hue = Math.random() * 360;
        const sat = 70 + Math.random() * 30;
        const light = 50 + Math.random() * 20;
        const color = this.hslToRgb(hue, sat, light);

        const randomRotSpeed = () => {
            const sign = Math.random() < 0.5 ? -1 : 1;
            return sign * (MIN_ROTATION_SPEED + Math.random() * ROTATION_SPEED_VARIATION);
        };

        particle.active = true;
        particle.x = (Math.random() - 0.5) * this.viewWidth;
        particle.y = this.viewHeight / 2 + 10;
        particle.z = 0;
        particle.rotX = Math.random() * Math.PI * 2;
        particle.rotY = Math.random() * Math.PI * 2;
        particle.rotZ = Math.random() * Math.PI * 2;
        particle.rotSpeedX = randomRotSpeed();
        particle.rotSpeedY = randomRotSpeed();
        particle.rotSpeedZ = randomRotSpeed();
        particle.fallSpeed = MIN_FALL_SPEED + Math.random() * FALL_SPEED_VARIATION;
        particle.size = MIN_POLYTOPE_SIZE + Math.random() * POLYTOPE_SIZE_VARIATION;
        particle.color[0] = color[0];
        particle.color[1] = color[1];
        particle.color[2] = color[2];

        this.activeParticleIndices.push(particleIndex);

        return particle;
    }

    updateParticles() {
        this.spawnAccumulator += this.currentSpawnRate;
        while (this.spawnAccumulator >= 1) {
            this.activateParticle();
            this.spawnAccumulator -= 1;
        }

        const groundLevel = -this.viewHeight / 2 - 10;
        let instanceIndex = 0;

        for (let i = this.activeParticleIndices.length - 1; i >= 0; i--) {
            const particleIndex = this.activeParticleIndices[i];
            const p = this.particlePool[particleIndex];

            // Update physics
            p.y -= p.fallSpeed;
            p.rotX += p.rotSpeedX;
            p.rotY += p.rotSpeedY;
            p.rotZ += p.rotSpeedZ;

            // Check if particle fell off screen
            if (p.y < groundLevel) {
                p.active = false;
                this.freeParticleIndices.push(particleIndex);
                this.activeParticleIndices.splice(i, 1);
                continue;
            }

            // Precompute sin/cos on CPU (once per particle, not per vertex!)
            const sinX = Math.sin(p.rotX);
            const cosX = Math.cos(p.rotX);
            const sinY = Math.sin(p.rotY);
            const cosY = Math.cos(p.rotY);
            const sinZ = Math.sin(p.rotZ);
            const cosZ = Math.cos(p.rotZ);

            // Pack instance data: pos(3) + sinCosX(2) + sinCosY(2) + sinCosZ(2) + scale(1) + color(3)
            const offset = instanceIndex * 13;
            this.instanceData[offset + 0] = p.x;
            this.instanceData[offset + 1] = p.y;
            this.instanceData[offset + 2] = p.z;
            this.instanceData[offset + 3] = sinX;
            this.instanceData[offset + 4] = cosX;
            this.instanceData[offset + 5] = sinY;
            this.instanceData[offset + 6] = cosY;
            this.instanceData[offset + 7] = sinZ;
            this.instanceData[offset + 8] = cosZ;
            this.instanceData[offset + 9] = p.size;
            this.instanceData[offset + 10] = p.color[0];
            this.instanceData[offset + 11] = p.color[1];
            this.instanceData[offset + 12] = p.color[2];

            instanceIndex++;
        }

        this.activeParticleCount = instanceIndex;
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

            const aspect = width / height;
            this.viewHeight = 50;
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
        const animate = (currentTime) => {
            this.animationId = requestAnimationFrame(animate);

            const elapsed = currentTime - this.lastFrameTime;
            if (elapsed < this.frameInterval) {
                return;
            }

            this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

            if (currentTime - this.lastSecondTimestamp >= 1000) {
                this.currentFPS = this.frameCount;
                this.frameCount = 0;
                this.lastSecondTimestamp = currentTime;
            }
            this.frameCount++;

            if (currentTime - this.lastFpsUpdate > this.fpsUpdateInterval) {
                const fpsCounter = this.querySelector('#fps-counter');
                const polytopesCounter = this.querySelector('#polytopes-counter');
                if (fpsCounter) {
                    fpsCounter.textContent = `FPS: ${this.currentFPS}`;
                }
                if (polytopesCounter) {
                    polytopesCounter.textContent = `Polytopes: ${this.activeParticleCount}`;
                }
                this.lastFpsUpdate = currentTime;
            }

            this.updateParticles();
            this.render();
        };
        animate(performance.now());
    }

    render() {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        if (this.activeParticleCount === 0) return;

        gl.useProgram(this.prog);
        gl.lineWidth(2.0);

        const halfWidth = this.viewWidth / 2;
        const halfHeight = this.viewHeight / 2;
        const P = this.mat4Ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -100, 100);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uProjection'), false, P);

        // Double buffering: alternate between two buffers
        // This prevents updating a buffer the GPU is still reading from
        const currentBuffer = this.currentBuffer === 0 ? this.instanceBuffer : this.instanceBufferB;
        this.currentBuffer = 1 - this.currentBuffer;  // Swap for next frame

        gl.bindVertexArray(this.polytopeGeometry.vao);
        
        // Rebind attributes to current buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
        
        const stride = 13 * 4;
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 12);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 20);
        gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 28);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 36);
        gl.vertexAttribPointer(6, 3, gl.FLOAT, false, stride, 40);
        
        // Update buffer data
        const uploadData = this.instanceData.subarray(0, this.activeParticleCount * 13);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, uploadData);
        
        gl.drawArraysInstanced(gl.LINES, 0, this.polytopeGeometry.vertexCount, this.activeParticleCount);
        gl.bindVertexArray(null);
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

    cleanup() {
        if (this.gl && this.polytopeGeometry) {
            if (this.polytopeGeometry.vao) {
                this.gl.deleteVertexArray(this.polytopeGeometry.vao);
            }
        }
        if (this.gl && this.instanceBuffer) {
            this.gl.deleteBuffer(this.instanceBuffer);
        }
        if (this.gl && this.instanceBufferB) {
            this.gl.deleteBuffer(this.instanceBufferB);
        }
        if (this.gl && this.prog) {
            this.gl.deleteProgram(this.prog);
        }
    }
}

customElements.define('polytope-rain', PolytopeRain);