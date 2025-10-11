/**
 * GPU-accelerated polytope rain
 * WebGL 2.0 transform feedback version - all physics computed on GPU
 *
 * Features:
 * - 100,000 particle capacity with GPU-side physics
 * - Interleaved buffer layout for efficient transform feedback
 * - Viewport-based culling (particles reset when leaving screen)
 * - Circular buffer for automatic particle recycling
 * - Instanced rendering for optimal performance
 */

// ============================================
// CONFIGURATION
// ============================================
const TARGET_FPS = 30;
const MAX_PARTICLES = 100000;

// spawn rates (particles per frame)
const DRIZZLE_RATE = 5;
const RAIN_RATE = 50;
const STORM_RATE = 200;
const DELUGE_RATE = 800;
const APOCALYPSE_RATE = 3000;

// physics constants (passed to shaders)
const MIN_FALL_SPEED = 5.2;
const FALL_SPEED_VARIATION = 3.4;
const MIN_ROTATION_SPEED = 0.3;
const ROTATION_SPEED_VARIATION = 2.1;
const MIN_SIZE = 0.4;
const SIZE_VARIATION = 0.5;
// ============================================

class PolytopeRainGPU extends HTMLElement {
    constructor() {
        super();
        
        this.gl = null;
        this.updateProgram = null;
        this.renderProgram = null;
        
        // double buffering for transform feedback
        this.bufferA = null;
        this.bufferB = null;
        this.currentReadBuffer = null;
        this.currentWriteBuffer = null;

        // transform feedback object
        this.tf = null;
        
        this.updateVAO = null;
        this.renderVAO = null;
        
        this.polytopeGeometry = null;
        
        this.animationId = null;
        this._ro = null;
        
        // spawn control
        this.nextSpawnIndex = 0;  // Next slot to spawn into
        this.maxEverSpawned = 0;  // Highest index ever spawned (high water mark)
        this.currentSpawnRate = DRIZZLE_RATE;
        
        // timing
        this.frameInterval = 1000 / TARGET_FPS;
        this.lastFrameTime = 0;
        this.lastSecondTimestamp = 0;
        this.frameCount = 0;
        this.currentFPS = 0;
        this.lastFpsUpdate = 0;
        this.fpsUpdateInterval = 500;
        
        // view dimensions
        this.viewWidth = 100;
        this.viewHeight = 100;
        
        // permutahedron
        this.polytope = {
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
        
        const particleCounter = document.createElement('div');
        particleCounter.id = 'particle-counter';
        particleCounter.style.cssText = `
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
        particleCounter.textContent = 'Active: 0';
        
        const intensityToggle = this.createIntensityToggle();
        
        container.appendChild(canvas);
        container.appendChild(fpsCounter);
        container.appendChild(particleCounter);
        container.appendChild(intensityToggle);
        this.innerHTML = '';
        this.appendChild(container);
        
        requestAnimationFrame(() => {
            try {
                this.initialize();
            } catch (err) {
                console.error('❌ GPU polytope rain error:', err);
            }
        });
    }
    
    createIntensityToggle() {
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
        
        const buttons = [
            { id: 'drizzle-btn', text: 'drizzle', rate: DRIZZLE_RATE, active: true },
            { id: 'rain-btn', text: 'rain', rate: RAIN_RATE },
            { id: 'storm-btn', text: 'storm', rate: STORM_RATE },
            { id: 'deluge-btn', text: 'deluge', rate: DELUGE_RATE },
            { id: 'apocalypse-btn', text: 'apocalypse', rate: APOCALYPSE_RATE }
        ];
        
        switchContainer.appendChild(indicator);
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.id = btn.id;
            button.textContent = btn.text;
            if (btn.active) button.classList.add('active');
            button.style.cssText = `
                padding: 6px 12px;
                font-size: 13px;
                font-weight: 500;
                color: ${btn.active ? 'var(--fg-primary)' : 'var(--fg-secondary)'};
                cursor: pointer;
                transition: color 0.2s ease;
                position: relative;
                z-index: 1;
                border: none;
                background: transparent;
                font-family: ui-sans-serif, system-ui, sans-serif;
            `;
            button.dataset.rate = btn.rate;
            switchContainer.appendChild(button);
        });
        
        intensityToggle.appendChild(switchContainer);
        return intensityToggle;
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
        this.setupParticleBuffers();
        this.setupIntensityToggle();
        this.setupResizeObserver();
        this.removeLoadingSkeleton();
        this.startAnimationLoop();
    }
    
    setupWebGL() {
        const canvas = this.querySelector('#canvas');
        this.gl = canvas.getContext('webgl2', {
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    }
    
    setupShaders() {
        const gl = this.gl;
        
        // UPDATE SHADER (transform feedback)
        const updateVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 inPos;
layout(location=1) in vec3 inVel;
layout(location=2) in vec3 inRot;
layout(location=3) in vec3 inRotSpeed;
layout(location=4) in vec3 inColor;
layout(location=5) in float inSize;

out vec3 outPos;
out vec3 outVel;
out vec3 outRot;
out vec3 outRotSpeed;
out vec3 outColor;
out float outSize;

uniform float uDeltaTime;
uniform float uSpawnY;
uniform float uViewWidth;
uniform float uViewHeight;
uniform float uTime;
uniform int uSpawnCount;
uniform int uSpawnStart;

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void main() {
    int particleId = gl_VertexID;

    // Check if this particle is in spawn range (handles wrapping)
    // Calculate distance from spawnStart (wrapping around MAX_PARTICLES)
    int distanceFromStart = particleId - uSpawnStart;
    if (distanceFromStart < 0) {
        distanceFromStart += ${MAX_PARTICLES};
    }
    bool inSpawnRange = distanceFromStart < uSpawnCount;

    // Only spawn if in spawn range AND the slot is dead (size <= 0)
    bool shouldSpawn = inSpawnRange && inSize <= 0.0;

    // Only spawn if explicitly in spawn range and slot is free
    if (shouldSpawn) {
        // spawn new particle
        float seed = float(particleId) + uTime;
        
        outPos = vec3(
            (hash(seed) - 0.5) * uViewWidth,
            uSpawnY,
            0.0
        );
        
        float fallSpeed = ${MIN_FALL_SPEED} + hash(seed * 1.1) * ${FALL_SPEED_VARIATION};
        outVel = vec3(0.0, -fallSpeed, 0.0);
        
        outRot = vec3(
            hash(seed * 2.0) * 6.28318,
            hash(seed * 3.0) * 6.28318,
            hash(seed * 4.0) * 6.28318
        );
        
        float rotSpeed = ${MIN_ROTATION_SPEED} + hash(seed * 5.0) * ${ROTATION_SPEED_VARIATION};
        outRotSpeed = vec3(
            (hash(seed * 6.0) - 0.5) * 2.0 * rotSpeed,
            (hash(seed * 7.0) - 0.5) * 2.0 * rotSpeed,
            (hash(seed * 8.0) - 0.5) * 2.0 * rotSpeed
        );
        
        float hue = hash(seed * 9.0) * 360.0;
        float sat = 70.0 + hash(seed * 10.0) * 30.0;
        float light = 50.0 + hash(seed * 11.0) * 20.0;
        outColor = vec3(hue, sat, light);

        outSize = ${MIN_SIZE} + hash(seed * 12.0) * ${SIZE_VARIATION};
    } else {
        // If particle is dead (size <= 0), just pass through unchanged
        if (inSize <= 0.0) {
            outPos = inPos;
            outVel = inVel;
            outRot = inRot;
            outRotSpeed = inRotSpeed;
            outColor = inColor;
            outSize = 0.0;
        } else {
            // update physics for live particles
            vec3 newPos = inPos + inVel * uDeltaTime;

            // Check if particle is outside viewport - reset it if so
            float halfWidth = uViewWidth / 2.0;
            float halfHeight = uViewHeight / 2.0;

            if (newPos.x < -halfWidth - 10.0 || newPos.x > halfWidth + 10.0 ||
                newPos.y < -halfHeight - 10.0 || newPos.y > halfHeight + 10.0) {
                // Outside viewport - mark as dead by setting size to 0
                outPos = newPos;
                outVel = inVel;
                outRot = inRot;
                outRotSpeed = inRotSpeed;
                outColor = inColor;
                outSize = 0.0;
            } else {
                // Inside viewport - continue physics
                outPos = newPos;
                outVel = inVel;
                outRot = inRot + inRotSpeed * uDeltaTime;
                outRotSpeed = inRotSpeed;
                outColor = inColor;
                outSize = inSize;
            }
        }
    }
}`;

        const updateFS = `#version 300 es
precision highp float;
void main() {}`;
        
        // RENDER SHADER
        const renderVS = `#version 300 es
precision highp float;

// geometry (per-vertex)
layout(location=0) in vec3 aPos;

// instance data (per-instance)
layout(location=1) in vec3 aInstancePos;
layout(location=2) in vec3 aInstanceRot;
layout(location=3) in vec3 aInstanceColor;
layout(location=4) in float aInstanceSize;

uniform mat4 uProjection;
uniform float uViewWidth;
uniform float uViewHeight;

out vec3 vColor;
out float vOpacity;

mat4 rotateX(float a) {
    float c = cos(a), s = sin(a);
    return mat4(1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1);
}

mat4 rotateY(float a) {
    float c = cos(a), s = sin(a);
    return mat4(c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1);
}

mat4 rotateZ(float a) {
    float c = cos(a), s = sin(a);
    return mat4(c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1);
}

mat4 translate(vec3 p) {
    return mat4(1,0,0,0, 0,1,0,0, 0,0,1,0, p.x,p.y,p.z,1);
}

mat4 scale(float s) {
    return mat4(s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1);
}

vec3 hslToRgb(vec3 hsl) {
    float h = hsl.x / 360.0;
    float s = hsl.y / 100.0;
    float l = hsl.z / 100.0;
    
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    
    vec3 rgb;
    if (h < 1.0/6.0) rgb = vec3(c, x, 0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0);
    else if (h < 3.0/6.0) rgb = vec3(0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0, c);
    else rgb = vec3(c, 0, x);
    
    return rgb + m;
}

void main() {
    // Check if particle is outside viewport bounds - cull if so
    float halfWidth = uViewWidth / 2.0;
    float halfHeight = uViewHeight / 2.0;

    if (aInstancePos.x < -halfWidth - 10.0 || aInstancePos.x > halfWidth + 10.0 ||
        aInstancePos.y < -halfHeight - 10.0 || aInstancePos.y > halfHeight + 10.0) {
        // Outside viewport - cull this particle
        gl_Position = vec4(0, 0, 0, -1);
        vColor = vec3(0);
        vOpacity = 0.0;
        return;
    }

    // Check if particle has never been spawned (size == 0)
    if (aInstanceSize <= 0.0) {
        gl_Position = vec4(0, 0, 0, -1);
        vColor = vec3(0);
        vOpacity = 0.0;
        return;
    }

    mat4 model = translate(aInstancePos)
               * rotateZ(aInstanceRot.z)
               * rotateY(aInstanceRot.y)
               * rotateX(aInstanceRot.x)
               * scale(aInstanceSize);

    vColor = hslToRgb(aInstanceColor);
    vOpacity = 0.8;
    gl_Position = uProjection * model * vec4(aPos, 1.0);
}`;

        const renderFS = `#version 300 es
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
        
        // compile update program
        this.updateProgram = gl.createProgram();
        gl.attachShader(this.updateProgram, compileShader(gl.VERTEX_SHADER, updateVS));
        gl.attachShader(this.updateProgram, compileShader(gl.FRAGMENT_SHADER, updateFS));

        // Use INTERLEAVED_ATTRIBS for transform feedback
        gl.transformFeedbackVaryings(
            this.updateProgram,
            ['outPos', 'outVel', 'outRot', 'outRotSpeed', 'outColor', 'outSize'],
            gl.INTERLEAVED_ATTRIBS
        );

        gl.linkProgram(this.updateProgram);
        if (!gl.getProgramParameter(this.updateProgram, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(this.updateProgram) || 'Update program link error');
        }
        
        // compile render program
        this.renderProgram = gl.createProgram();
        gl.attachShader(this.renderProgram, compileShader(gl.VERTEX_SHADER, renderVS));
        gl.attachShader(this.renderProgram, compileShader(gl.FRAGMENT_SHADER, renderFS));
        gl.linkProgram(this.renderProgram);
        if (!gl.getProgramParameter(this.renderProgram, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(this.renderProgram) || 'Render program link error');
        }
    }
    
    buildPolytopeGeometry() {
        const gl = this.gl;
        const vertices = this.polytope.vertices;
        const edges = this.polytope.edges;

        const positions = [];
        edges.forEach(([a, b]) => {
            positions.push(...vertices[a], ...vertices[b]);
        });

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.polytopeGeometry = {
            buffer: posBuf,
            vertexCount: positions.length / 3
        };
    }
    
    setupParticleBuffers() {
        const gl = this.gl;

        // Interleaved buffer layout: pos(3) + vel(3) + rot(3) + rotSpeed(3) + color(3) + size(1) = 16 floats per particle
        const FLOATS_PER_PARTICLE = 16;
        const interleavedData = new Float32Array(MAX_PARTICLES * FLOATS_PER_PARTICLE);
        // All zeros is fine - particles will be spawned as needed

        // Create interleaved buffers for transform feedback
        this.bufferA = gl.createBuffer();
        this.bufferB = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferA);
        gl.bufferData(gl.ARRAY_BUFFER, interleavedData, gl.DYNAMIC_COPY);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferB);
        gl.bufferData(gl.ARRAY_BUFFER, interleavedData, gl.DYNAMIC_COPY);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.currentReadBuffer = this.bufferA;
        this.currentWriteBuffer = this.bufferB;
        this.stride = FLOATS_PER_PARTICLE * 4; // stride in bytes

        // Create a Transform Feedback object (CRUCIAL)
        this.tf = gl.createTransformFeedback();

        // setup update VAO (we bind attributes each frame, but VAO is still required)
        this.updateVAO = gl.createVertexArray();

        // setup render VAO with geometry bound to attrib 0
        this.renderVAO = gl.createVertexArray();
        gl.bindVertexArray(this.renderVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.polytopeGeometry.buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(0, 0); // per-vertex
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    
    setupIntensityToggle() {
        const buttons = this.querySelectorAll('#intensity-switch button');
        const indicator = this.querySelector('#intensity-indicator');
        
        const updateIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            indicator.style.width = `${btnRect.width}px`;
            indicator.style.transform = `translateX(${offset}px)`;
        };
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => {
                    b.classList.remove('active');
                    b.style.color = 'var(--fg-secondary)';
                });
                btn.classList.add('active');
                btn.style.color = 'var(--fg-primary)';
                updateIndicator(btn);
                this.currentSpawnRate = parseFloat(btn.dataset.rate);
            });
        });
        
        requestAnimationFrame(() => {
            const activeBtn = this.querySelector('#intensity-switch button.active');
            if (activeBtn) updateIndicator(activeBtn);
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
            
            const aspect = width / height;
            this.viewHeight = 50;
            this.viewWidth = this.viewHeight * aspect;
        };
        
        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }
    
    removeLoadingSkeleton() {
        const canvas = this.querySelector('#canvas');
        if (canvas) {
            canvas.style.opacity = '1';
        }
    }
    
    startAnimationLoop() {
        // Initialize timing
        this.lastFrameTime = performance.now();
        this.lastSecondTimestamp = this.lastFrameTime;
        this.lastFpsUpdate = this.lastFrameTime;

        const animate = (currentTime) => {
            this.animationId = requestAnimationFrame(animate);
            
            const elapsed = currentTime - this.lastFrameTime;
            if (elapsed < this.frameInterval) {
                return;
            }
            
            const deltaTime = elapsed / 1000;
            this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
            
            if (currentTime - this.lastSecondTimestamp >= 1000) {
                this.currentFPS = this.frameCount;
                this.frameCount = 0;
                this.lastSecondTimestamp = currentTime;
            }
            this.frameCount++;
            
            if (currentTime - this.lastFpsUpdate > this.fpsUpdateInterval) {
                const fpsCounter = this.querySelector('#fps-counter');
                const particleCounter = this.querySelector('#particle-counter');
                if (fpsCounter) {
                    fpsCounter.textContent = `FPS: ${this.currentFPS}`;
                }
                if (particleCounter && this.activeParticleCount !== undefined) {
                    particleCounter.textContent = `Active: ${this.activeParticleCount}`;
                }
                this.lastFpsUpdate = currentTime;
            }
            
            this.updateParticles(deltaTime, currentTime / 1000);
            this.render();
        };
        
        animate(performance.now());
    }
    
    updateParticles(deltaTime, time) {
        const gl = this.gl;

        const spawnCount = Math.floor(this.currentSpawnRate);
        const spawnStart = this.nextSpawnIndex;

        // Update spawn index (always spawn, wrapping around)
        this.nextSpawnIndex = (this.nextSpawnIndex + spawnCount) % MAX_PARTICLES;

        // Track high water mark - once we wrap, we process all particles
        if (this.nextSpawnIndex < spawnStart) {
            this.maxEverSpawned = MAX_PARTICLES;
        } else {
            this.maxEverSpawned = Math.max(this.maxEverSpawned, this.nextSpawnIndex);
        }

        // bind update VAO and source attributes from interleaved buffer
        gl.bindVertexArray(this.updateVAO);

        // Bind interleaved input buffer with stride and offsets
        gl.bindBuffer(gl.ARRAY_BUFFER, this.currentReadBuffer);

        // pos at offset 0
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, this.stride, 0);

        // vel at offset 12 (3 floats * 4 bytes)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, this.stride, 12);

        // rot at offset 24 (6 floats * 4 bytes)
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, this.stride, 24);

        // rotSpeed at offset 36 (9 floats * 4 bytes)
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, this.stride, 36);

        // color at offset 48 (12 floats * 4 bytes)
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 3, gl.FLOAT, false, this.stride, 48);

        // size at offset 60 (15 floats * 4 bytes)
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, this.stride, 60);

        // IMPORTANT: Unbind array buffer before binding transform feedback buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // bind TF object and set targets
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);

        // Bind single interleaved buffer for INTERLEAVED_ATTRIBS mode
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.currentWriteBuffer);

        // run update shader
        gl.useProgram(this.updateProgram);
        gl.uniform1f(gl.getUniformLocation(this.updateProgram, 'uDeltaTime'), deltaTime);
        gl.uniform1f(gl.getUniformLocation(this.updateProgram, 'uSpawnY'), this.viewHeight / 2 + 2);
        gl.uniform1f(gl.getUniformLocation(this.updateProgram, 'uViewWidth'), this.viewWidth);
        gl.uniform1f(gl.getUniformLocation(this.updateProgram, 'uViewHeight'), this.viewHeight);
        gl.uniform1f(gl.getUniformLocation(this.updateProgram, 'uTime'), time);
        gl.uniform1i(gl.getUniformLocation(this.updateProgram, 'uSpawnCount'), spawnCount);
        gl.uniform1i(gl.getUniformLocation(this.updateProgram, 'uSpawnStart'), spawnStart);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.beginTransformFeedback(gl.POINTS);

        // Only process particles up to maxEverSpawned (not all MAX_PARTICLES!)
        gl.drawArrays(gl.POINTS, 0, this.maxEverSpawned);

        gl.endTransformFeedback();

        gl.disable(gl.RASTERIZER_DISCARD);

        // Complete cleanup of transform feedback state
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // unbind transform feedback buffer (only one in interleaved mode)
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

        // unbind VAO and array buffer
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // swap buffers
        [this.currentReadBuffer, this.currentWriteBuffer] =
            [this.currentWriteBuffer, this.currentReadBuffer];
    }

    render() {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const instanceCount = this.maxEverSpawned;
        if (instanceCount === 0) return;

        // Sample particles periodically to count active ones for display
        if (!this._particleCountFrame) this._particleCountFrame = 0;
        this._particleCountFrame++;

        if (this._particleCountFrame % 30 === 0) {
            const sampleSize = Math.min(1000, this.maxEverSpawned);
            const sampleData = new Float32Array(sampleSize * 16);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.currentReadBuffer);
            gl.getBufferSubData(gl.ARRAY_BUFFER, 0, sampleData);

            let aliveCount = 0;
            for (let i = 0; i < sampleSize; i++) {
                const size = sampleData[i * 16 + 15];
                if (size > 0) aliveCount++;
            }

            this.activeParticleCount = Math.round((aliveCount / sampleSize) * this.maxEverSpawned);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }

        const halfWidth = this.viewWidth / 2;
        const halfHeight = this.viewHeight / 2;

        // bind render VAO (already has geometry bound)
        gl.bindVertexArray(this.renderVAO);

        // Set up instance attributes from interleaved buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.currentReadBuffer);

        // aInstancePos (location 1) - pos at offset 0
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, this.stride, 0);
        gl.vertexAttribDivisor(1, 1);

        // aInstanceRot (location 2) - rot at offset 24
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, this.stride, 24);
        gl.vertexAttribDivisor(2, 1);

        // aInstanceColor (location 3) - color at offset 48
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, this.stride, 48);
        gl.vertexAttribDivisor(3, 1);

        // aInstanceSize (location 4) - size at offset 60
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 1, gl.FLOAT, false, this.stride, 60);
        gl.vertexAttribDivisor(4, 1);

        // Use render shader
        gl.useProgram(this.renderProgram);

        const P = this.mat4Ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -100, 100);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.renderProgram, 'uProjection'), false, P);
        gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'uViewWidth'), this.viewWidth);
        gl.uniform1f(gl.getUniformLocation(this.renderProgram, 'uViewHeight'), this.viewHeight);

        // Draw
        gl.drawArraysInstanced(gl.LINES, 0, this.polytopeGeometry.vertexCount, instanceCount);

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
        const gl = this.gl;
        if (!gl) return;

        if (this.updateVAO) gl.deleteVertexArray(this.updateVAO);
        if (this.renderVAO) gl.deleteVertexArray(this.renderVAO);
        if (this.tf) gl.deleteTransformFeedback(this.tf);
        if (this.polytopeGeometry?.buffer) gl.deleteBuffer(this.polytopeGeometry.buffer);

        // Delete interleaved buffers
        if (this.bufferA) gl.deleteBuffer(this.bufferA);
        if (this.bufferB) gl.deleteBuffer(this.bufferB);

        if (this.updateProgram) gl.deleteProgram(this.updateProgram);
        if (this.renderProgram) gl.deleteProgram(this.renderProgram);
    }
}

customElements.define('polytope-rain-gpu', PolytopeRainGPU);
