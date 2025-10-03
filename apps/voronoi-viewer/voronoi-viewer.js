/**
 * Voronoi Diagram Viewer Web Component - WebGL Direct Rendering
 * No Konva, pure GPU rendering using JFA
 */
class VoronoiViewer extends HTMLElement {
    static get observedAttributes() {
        return ['metric-p'];
    }

    constructor() {
        super();
        console.log('🎯 VoronoiViewer constructor called');
        
        // State
        this.sites = [];
        this.dragIndex = -1;
        this.isDragging = false;
        
        // WebGL objects
        this.gl = null;
        this.canvas = null;
        this.progJFA = null;
        this.progRender = null;
        this.progClear = null;
        
        // Textures and FBOs
        this.texA = null;
        this.texB = null;
        this.fboA = null;
        this.fboB = null;
        this.paletteTex = null;
        
        // Uniform locations
        this.jfa = null;
        this.rnd = null;
        
        // VAO
        this.quadVAO = null;
        
        // Parameters
        this.p = 2.0;
        this.useInf = false;
        this.showEdges = true;
        
        // Resource tracking
        this._ro = null;
    }
    
    connectedCallback() {
        console.log('🔗 VoronoiViewer connected to DOM');
        
        this.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
                overflow: hidden;
                background: transparent;
            ">
                <canvas id="glcanvas" style="
                    width: 100%;
                    height: 100%;
                    display: block;
                    background: transparent;
                    cursor: crosshair;
                "></canvas>
            </div>
            
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
                <div style="font-size: 14px; font-weight: 500;">Failed to load Voronoi viewer</div>
                <div id="errorDetails" style="font-size: 12px; opacity: 0.8;"></div>
            </div>
        `;
        
        this.canvas = this.querySelector('#glcanvas');
        
        this.initialize().catch(err => {
            console.error('❌ VoronoiViewer initialization error:', err);
            this.showError(err.message || 'Unknown error occurred');
        });
        
        console.log('✅ VoronoiViewer HTML rendered successfully');
    }
    
    disconnectedCallback() {
        console.log('🔌 VoronoiViewer disconnected from DOM');
        
        this.cleanup();
        
        if (this._ro) {
            this._ro.disconnect();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`🔄 VoronoiViewer attribute changed: ${name} = ${newValue}`);
        
        if (name === 'metric-p') {
            if (newValue === 'infinity') {
                this.p = 2.0;
                this.useInf = true;
            } else {
                this.p = parseFloat(newValue) || 2.0;
                this.useInf = false;
            }
            if (this.gl) this.recompute();
        }
    }
    
    async initialize() {
        console.log('🚀 Initializing VoronoiViewer...');
        
        // Initialize WebGL
        this.initWebGL();
        
        // Setup shaders and resources
        this.setupShaders();
        
        // Setup interactions
        this.setupInteractions();
        
        // Setup resize handling
        this.setupResizeObserver();

        // Add 3 initial points
        this.addRandomPoints(3);

        // Initial render
        this.recompute();

        console.log('✅ VoronoiViewer initialization complete');
    }
    
    initWebGL() {
        const { width, height } = this.getBoundingClientRect();
        // Use 2x resolution for anti-aliasing
        this.canvas.width = Math.floor(width * 2);
        this.canvas.height = Math.floor(height * 2);
        
        try {
            this.gl = this.canvas.getContext('webgl2', {
                antialias: true,
                depth: false,
                stencil: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false
            });
        } catch (e) {}
        
        if (!this.gl) {
            throw new Error('WebGL2 not available in this browser.');
        }

        const extCBF = this.gl.getExtension('EXT_color_buffer_float');
        if (!extCBF) {
            throw new Error('Missing EXT_color_buffer_float. Your GPU/driver must support RGBA32F rendering.');
        }
        
        console.log('✅ WebGL2 initialized');
    }
    
    compile(type, src) {
        const gl = this.gl;
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            this.showError('Shader compile error: ' + log);
            throw new Error(log);
        }
        return sh;
    }

    program(vsSrc, fsSrc) {
        const gl = this.gl;
        const p = gl.createProgram();
        gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vsSrc));
        gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fsSrc));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(p);
            this.showError('Program link error: ' + log);
            throw new Error(log);
        }
        return p;
    }

    createTex(w, h) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
        return tex;
    }

    createFBO(tex) {
        const gl = this.gl;
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        if (!ok) this.showError('Framebuffer incomplete.');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fb;
    }

    highestPow2AtLeast(v) {
        let p = 1;
        while (p < v) p <<= 1;
        return p;
    }
    
    setupShaders() {
        const gl = this.gl;
        
        // Shaders - EXACT from original
        const VERT = `#version 300 es
precision highp float;
out vec2 v_uv;
void main(){
  uint id = uint(gl_VertexID);
  vec2 p = vec2(float((id<<1u)&2u), float(id&2u));
  v_uv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

        const FRAG_CLEAR = `#version 300 es
precision mediump float;
out vec4 outColor;
void main(){ outColor = vec4(-1.0, -1.0, -1.0, 0.0); }`;

        const FRAG_JFA = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uSeedTex;
uniform vec2 uTexel;
uniform float uStep;
uniform vec2 uResolution;
uniform float uP;
uniform bool  uUseInf;

float lp_cost(vec2 delta){
  vec2 ad = abs(delta);
  return (uUseInf) ? max(ad.x, ad.y)
                   : (pow(ad.x, uP) + pow(ad.y, uP));
}

vec4 pickBetter(vec4 a, vec4 b, vec2 fragPix){
  float da = (a.z < 0.0) ? 1e30 : lp_cost(fragPix - a.xy);
  float db = (b.z < 0.0) ? 1e30 : lp_cost(fragPix - b.xy);
  return (db < da) ? b : a;
}

void main(){
  vec2 fragPix = v_uv * uResolution;
  vec2 o = uTexel * uStep;
  vec4 best = texture(uSeedTex, v_uv);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2( o.x, 0.0)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(-o.x, 0.0)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(0.0,  o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(0.0, -o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2( o.x,  o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2( o.x, -o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(-o.x,  o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(-o.x, -o.y)), fragPix);
  outColor = best;
}`;

        const FRAG_RENDER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uSeedTex;
uniform sampler2D uPalette;
uniform vec2 uResolution;
uniform int  uPaletteSize;
uniform bool uEdges;
uniform float uP;
uniform bool  uUseInf;

void main(){
  vec4 texel = texture(uSeedTex, v_uv);
  float sid = texel.z;
  if (sid < 0.0){ outColor = vec4(0.05,0.06,0.07,1.0); return; }
  vec2 seed = texel.xy;
  vec2 fragPix = v_uv * uResolution;
  
  float idx = mod(max(sid, 0.0), float(uPaletteSize));
  float u = (idx + 0.5) / float(uPaletteSize);
  vec3 base = texture(uPalette, vec2(u, 0.5)).rgb;

  if (uEdges){
    vec2 texelS = 1.0 / uResolution;
    float idc = sid;
    float diff = 0.0;
    diff += float(texture(uSeedTex, v_uv + vec2( texelS.x, 0.0)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(-texelS.x, 0.0)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(0.0,  texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(0.0, -texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2( texelS.x,  texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2( texelS.x, -texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(-texelS.x,  texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(-texelS.x, -texelS.y)).z != idc);
    float edge = smoothstep(0.0, 0.5, diff / 8.0);
    base = mix(base, vec3(0.0), edge);
  }

  float dotRadius = 5.0;
  float dist = distance(fragPix, seed);
  if (dist < dotRadius) {
    // Black fill with white outline and anti-aliasing
    float outerEdge = smoothstep(dotRadius + 0.5, dotRadius - 0.5, dist);
    float innerEdge = smoothstep(dotRadius - 0.5, dotRadius - 1.5, dist);
    vec3 dotColor = mix(vec3(1.0), vec3(0.0), innerEdge);
    base = mix(base, dotColor, outerEdge);
  }
  outColor = vec4(base, 1.0);
}`;

        this.progJFA = this.program(VERT, FRAG_JFA);
        this.progRender = this.program(VERT, FRAG_RENDER);
        this.progClear = this.program(VERT, FRAG_CLEAR);

        const W = this.canvas.width;
        const H = this.canvas.height;
        this.texA = this.createTex(W, H);
        this.texB = this.createTex(W, H);
        this.fboA = this.createFBO(this.texA);
        this.fboB = this.createFBO(this.texB);

        // Palette - EXACT from original
        const PALETTE_SIZE = 4096;
        this.paletteTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const pal = new Uint8Array(PALETTE_SIZE * 4);
        for (let i = 0; i < PALETTE_SIZE; i++) {
            const h = (i * 0.61803398875) % 1;
            const s = 0.6, v = 0.95;
            const a = h * 6;
            const c = v * s;
            const x = c * (1 - Math.abs((a % 2) - 1));
            let r = 0, g = 0, b = 0;
            if (a < 1) { r = c; g = x; b = 0; }
            else if (a < 2) { r = x; g = c; b = 0; }
            else if (a < 3) { r = 0; g = c; b = x; }
            else if (a < 4) { r = 0; g = x; b = c; }
            else if (a < 5) { r = x; g = 0; b = c; }
            else { r = c; g = 0; b = x; }
            const m = v - c;
            r = (r + m); g = (g + m); b = (b + m);
            pal[i * 4 + 0] = Math.round(Math.min(1, Math.max(0, r)) * 255);
            pal[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
            pal[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
            pal[i * 4 + 3] = 255;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PALETTE_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pal);

        // Uniform locations
        this.jfa = {
            p: this.progJFA,
            loc: {
                uSeedTex: gl.getUniformLocation(this.progJFA, 'uSeedTex'),
                uTexel: gl.getUniformLocation(this.progJFA, 'uTexel'),
                uStep: gl.getUniformLocation(this.progJFA, 'uStep'),
                uResolution: gl.getUniformLocation(this.progJFA, 'uResolution'),
                uP: gl.getUniformLocation(this.progJFA, 'uP'),
                uUseInf: gl.getUniformLocation(this.progJFA, 'uUseInf'),
            }
        };
        this.rnd = {
            p: this.progRender,
            loc: {
                uSeedTex: gl.getUniformLocation(this.progRender, 'uSeedTex'),
                uPalette: gl.getUniformLocation(this.progRender, 'uPalette'),
                uResolution: gl.getUniformLocation(this.progRender, 'uResolution'),
                uPaletteSize: gl.getUniformLocation(this.progRender, 'uPaletteSize'),
                uEdges: gl.getUniformLocation(this.progRender, 'uEdges'),
                uP: gl.getUniformLocation(this.progRender, 'uP'),
                uUseInf: gl.getUniformLocation(this.progRender, 'uUseInf'),
            }
        };

        this.quadVAO = gl.createVertexArray();
        
        console.log('✅ Shaders and resources setup complete');
    }
    
    setupInteractions() {
        this.canvas.addEventListener('mousedown', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            const W = this.canvas.width;
            const H = this.canvas.height;
            if (x < 0 || x >= W || y < 0 || y >= H) return;
            this.dragIndex = this.findSeedAt(x, y);
            if (this.dragIndex >= 0) {
                this.isDragging = false;
                this.canvas.classList.add('dragging');
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.dragIndex >= 0) {
                this.isDragging = true;
                const { x, y } = this.getCanvasCoords(e);
                const W = this.canvas.width;
                const H = this.canvas.height;
                this.sites[this.dragIndex].x = Math.max(0, Math.min(W - 1, x));
                this.sites[this.dragIndex].y = Math.max(0, Math.min(H - 1, y));
                this.recompute();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            if (this.dragIndex >= 0) {
                this.dragIndex = -1;
                this.canvas.classList.remove('dragging');
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.dragIndex >= 0) {
                this.dragIndex = -1;
                this.canvas.classList.remove('dragging');
                this.isDragging = false;
            }
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                return;
            }
            const { x, y } = this.getCanvasCoords(e);
            const W = this.canvas.width;
            const H = this.canvas.height;
            if (x >= 0 && x < W && y >= 0 && y < H) {
                const existing = this.findSeedAt(x, y);
                if (existing < 0) {
                    this.sites.push({ x, y });
                    this.recompute();
                }
            }
        });
        
        console.log('✅ Interactions setup complete');
    }
    
    setupResizeObserver() {
        const handleResize = () => {
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height || !this.gl) return;
            
            // Use 2x resolution for anti-aliasing
            const W = Math.floor(width * 2);
            const H = Math.floor(height * 2);

            if (this.canvas.width === W && this.canvas.height === H) return;

            this.canvas.width = W;
            this.canvas.height = H;

            // Recreate textures/FBOs for new size
            const gl = this.gl;
            if (this.texA) gl.deleteTexture(this.texA);
            if (this.texB) gl.deleteTexture(this.texB);
            if (this.fboA) gl.deleteFramebuffer(this.fboA);
            if (this.fboB) gl.deleteFramebuffer(this.fboB);
            
            this.texA = this.createTex(W, H);
            this.texB = this.createTex(W, H);
            this.fboA = this.createFBO(this.texA);
            this.fboB = this.createFBO(this.texB);

            this.recompute();
            
            console.log(`📐 VoronoiViewer resized to: ${W}x${H}`);
        };
        
        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }
    
    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);
        return { x, y };
    }

    findSeedAt(x, y) {
        const threshold = 15;
        for (let i = 0; i < this.sites.length; i++) {
            const dx = this.sites[i].x - x;
            const dy = this.sites[i].y - y;
            if (dx * dx + dy * dy < threshold * threshold) {
                return i;
            }
        }
        return -1;
    }
    
    clearTexture(fbo, w, h) {
        const gl = this.gl;
        gl.bindVertexArray(this.quadVAO);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, w, h);
        gl.useProgram(this.progClear);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    writeSeedPixels(tex) {
        const gl = this.gl;
        const W = this.canvas.width;
        const H = this.canvas.height;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const seedPixel = new Float32Array(4);
        for (let si = 0; si < this.sites.length; si++) {
            const sx = Math.max(0, Math.min(W - 1, Math.round(this.sites[si].x)));
            const syTop = Math.max(0, Math.min(H - 1, Math.round(this.sites[si].y)));
            const sy = (H - 1 - syTop);
            seedPixel[0] = sx;
            seedPixel[1] = sy;
            seedPixel[2] = si;
            seedPixel[3] = 1.0;
            gl.texSubImage2D(gl.TEXTURE_2D, 0, sx, sy, 1, 1, gl.RGBA, gl.FLOAT, seedPixel);
        }
    }

    bindTexAsInput(tex, unit) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
    }

    runJFA() {
        if (this.sites.length === 0) {
            this.renderFinal();
            return;
        }

        const gl = this.gl;
        const W = this.canvas.width;
        const H = this.canvas.height;

        gl.viewport(0, 0, W, H);

        // init A with seeds
        this.clearTexture(this.fboA, W, H);
        this.writeSeedPixels(this.texA);

        const maxDim = Math.max(W, H);
        let step = this.highestPow2AtLeast(maxDim);

        gl.bindVertexArray(this.quadVAO);
        gl.useProgram(this.progJFA);
        gl.uniform2f(this.jfa.loc.uTexel, 1 / W, 1 / H);
        gl.uniform2f(this.jfa.loc.uResolution, W, H);
        gl.uniform1i(this.jfa.loc.uSeedTex, 0);
        gl.uniform1f(this.jfa.loc.uP, this.p);
        gl.uniform1i(this.jfa.loc.uUseInf, this.useInf ? 1 : 0);

        while (step >= 1) {
            gl.uniform1f(this.jfa.loc.uStep, step);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            this.bindTexAsInput(this.texA, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            // swap
            let t = this.texA; this.texA = this.texB; this.texB = t;
            let f = this.fboA; this.fboA = this.fboB; this.fboB = f;
            step >>= 1;
        }
        
        // JFA+1
        gl.uniform1f(this.jfa.loc.uStep, 1.0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        this.bindTexAsInput(this.texA, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        let t2 = this.texA; this.texA = this.texB; this.texB = t2;
        let f2 = this.fboA; this.fboA = this.fboB; this.fboB = f2;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.renderFinal();
    }

    renderFinal() {
        const gl = this.gl;
        const W = this.canvas.width;
        const H = this.canvas.height;
        
        gl.viewport(0, 0, W, H);
        gl.bindVertexArray(this.quadVAO);
        gl.useProgram(this.progRender);
        gl.uniform2f(this.rnd.loc.uResolution, W, H);
        gl.uniform1i(this.rnd.loc.uSeedTex, 0);
        gl.uniform1i(this.rnd.loc.uPalette, 1);
        gl.uniform1i(this.rnd.loc.uPaletteSize, 4096);
        gl.uniform1i(this.rnd.loc.uEdges, this.showEdges ? 1 : 0);
        gl.uniform1f(this.rnd.loc.uP, this.p);
        gl.uniform1i(this.rnd.loc.uUseInf, this.useInf ? 1 : 0);
        this.bindTexAsInput(this.texA, 0);
        this.bindTexAsInput(this.paletteTex, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    recompute() {
        if (!this.gl) return;
        this.runJFA();
    }
    
    // Public methods for controls
    clearAll() {
        this.sites = [];
        this.recompute();
        console.log('Cleared all sites');
    }
    
    addRandomPoints(count = 5) {
        const W = this.canvas.width;
        const H = this.canvas.height;
        const margin = 50;

        for (let i = 0; i < count; i++) {
            const x = margin + Math.random() * (W - 2 * margin);
            const y = margin + Math.random() * (H - 2 * margin);
            this.sites.push({ x, y });
        }
        this.recompute();
    }
    
    generateGrid() {
        this.sites = [];
        const W = this.canvas.width;
        const H = this.canvas.height;
        const margin = 80;
        const cols = 4;
        const rows = 3;
        
        const cellWidth = (W - 2 * margin) / cols;
        const cellHeight = (H - 2 * margin) / rows;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = margin + (col + 0.5) * cellWidth;
                const y = margin + (row + 0.5) * cellHeight;
                const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
                const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;
                this.sites.push({ x: x + jitterX, y: y + jitterY });
            }
        }
        this.recompute();
    }
    
    setShowEdges(show) {
        this.showEdges = show;
        this.renderFinal();
    }
    
    showError(message) {
        const error = this.querySelector('#errorMessage');
        const details = this.querySelector('#errorDetails');
        
        if (error) error.style.display = 'flex';
        if (details) details.textContent = message;
    }
    
    cleanup() {
        if (!this.gl) return;
        
        const gl = this.gl;
        if (this.texA) gl.deleteTexture(this.texA);
        if (this.texB) gl.deleteTexture(this.texB);
        if (this.fboA) gl.deleteFramebuffer(this.fboA);
        if (this.fboB) gl.deleteFramebuffer(this.fboB);
        if (this.paletteTex) gl.deleteTexture(this.paletteTex);
        if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
        if (this.progJFA) gl.deleteProgram(this.progJFA);
        if (this.progRender) gl.deleteProgram(this.progRender);
        if (this.progClear) gl.deleteProgram(this.progClear);
    }
}

console.log('📝 Registering voronoi-viewer...');
customElements.define('voronoi-viewer', VoronoiViewer);
console.log('✅ voronoi-viewer registered successfully!');