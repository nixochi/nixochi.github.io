/**
 * JFA (Jump Flooding Algorithm) Voronoi implementation
 * GPU-accelerated using WebGL2
 * Direct port of standalone JFA implementation
 */
class VoronoiDiagramJFA {
    constructor(sites, bounds, p = 2, resolution = null) {
        this.sites = sites;
        this.bounds = bounds;
        this.p = p;
        this.useInf = (p === Infinity);
        
        // Use provided resolution or default to 512
        this.resolution = resolution || 512;
        
        this.cells = [];
        this.gl = null;
        this.canvas = null;
        
        this.compute();
    }

    compute() {
        if (this.sites.length === 0) {
            this.cells = [];
            return;
        }

        try {
            this.initWebGL();
            this.runJFA();
            this.extractCells();
        } catch (e) {
            console.error('JFA computation failed:', e);
            this.cells = [];
        } finally {
            this.cleanup();
        }
    }

    initWebGL() {
        // Create offscreen canvas
        this.canvas = document.createElement('canvas');
        const W = this.resolution;
        const H = this.resolution;
        this.canvas.width = W;
        this.canvas.height = H;
        
        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });

        if (!this.gl) {
            throw new Error('WebGL2 not available');
        }

        const extCBF = this.gl.getExtension('EXT_color_buffer_float');
        if (!extCBF) {
            throw new Error('EXT_color_buffer_float not supported');
        }
    }

    compile(type, src) {
        const gl = this.gl;
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            throw new Error('Shader compile error: ' + log);
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
            throw new Error('Program link error: ' + log);
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
        if (!ok) throw new Error('Framebuffer incomplete.');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fb;
    }

    highestPow2AtLeast(v) {
        let p = 1;
        while (p < v) p <<= 1;
        return p;
    }

    runJFA() {
        const gl = this.gl;
        const W = this.canvas.width | 0;
        const H = this.canvas.height | 0;

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

        const progJFA = this.program(VERT, FRAG_JFA);
        const progClear = this.program(VERT, FRAG_CLEAR);

        let texA = this.createTex(W, H);
        let texB = this.createTex(W, H);
        let fboA = this.createFBO(texA);
        let fboB = this.createFBO(texB);

        const quadVAO = gl.createVertexArray();

        // Clear texture helper
        const clearTexture = (fbo, w, h) => {
            gl.bindVertexArray(quadVAO);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.viewport(0, 0, w, h);
            gl.useProgram(progClear);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        };

        // Write seed pixels helper
        const seedPixel = new Float32Array(4);
        const writeSeedPixels = (tex) => {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            
            // Map sites from world coords to texture coords
            const worldW = this.bounds.right - this.bounds.left;
            const worldH = this.bounds.bottom - this.bounds.top;
            
            for (let si = 0; si < this.sites.length; si++) {
                const site = this.sites[si];
                
                // Normalize to [0,1]
                const nx = (site.x - this.bounds.left) / worldW;
                const ny = (site.y - this.bounds.top) / worldH;
                
                // Convert to pixel coords
                const sx = Math.max(0, Math.min(W - 1, Math.round(nx * W)));
                const syTop = Math.max(0, Math.min(H - 1, Math.round(ny * H)));
                const sy = (H - 1 - syTop); // Flip Y for GL coordinates
                
                seedPixel[0] = sx;
                seedPixel[1] = sy;
                seedPixel[2] = si;
                seedPixel[3] = 1.0;
                gl.texSubImage2D(gl.TEXTURE_2D, 0, sx, sy, 1, 1, gl.RGBA, gl.FLOAT, seedPixel);
            }
        };

        const bindTexAsInput = (tex, unit) => {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, tex);
        };

        // Initialize
        gl.viewport(0, 0, W, H);
        clearTexture(fboA, W, H);
        writeSeedPixels(texA);

        const maxDim = Math.max(W, H);
        let step = this.highestPow2AtLeast(maxDim);

        gl.bindVertexArray(quadVAO);
        gl.useProgram(progJFA);
        gl.uniform2f(gl.getUniformLocation(progJFA, 'uTexel'), 1 / W, 1 / H);
        gl.uniform2f(gl.getUniformLocation(progJFA, 'uResolution'), W, H);
        gl.uniform1i(gl.getUniformLocation(progJFA, 'uSeedTex'), 0);
        gl.uniform1f(gl.getUniformLocation(progJFA, 'uP'), this.p);
        gl.uniform1i(gl.getUniformLocation(progJFA, 'uUseInf'), this.useInf ? 1 : 0);

        const locStep = gl.getUniformLocation(progJFA, 'uStep');

        // JFA flooding
        while (step >= 1) {
            gl.uniform1f(locStep, step);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            bindTexAsInput(texA, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            // swap
            let t = texA; texA = texB; texB = t;
            let f = fboA; fboA = fboB; fboB = f;
            step >>= 1;
        }

        // JFA+1 extra pass
        gl.uniform1f(locStep, 1.0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        bindTexAsInput(texA, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        let t2 = texA; texA = texB; texB = t2;
        let f2 = fboA; fboA = fboB; fboB = f2;

        // Read back
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
        this.resultData = new Float32Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, this.resultData);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Store dimensions for extraction
        this.W = W;
        this.H = H;
    }

    extractCells() {
        const W = this.W;
        const H = this.H;
        const worldW = this.bounds.right - this.bounds.left;
        const worldH = this.bounds.bottom - this.bounds.top;

        // Build ownership map
        const ownership = new Array(H);
        for (let y = 0; y < H; y++) {
            ownership[y] = new Array(W);
            for (let x = 0; x < W; x++) {
                const idx = (y * W + x) * 4;
                const siteId = this.resultData[idx + 2];
                ownership[y][x] = siteId >= 0 ? Math.floor(siteId) : -1;
            }
        }

        // Extract cell boundaries - collect perimeter pixels
        const siteRegions = new Map();
        for (const site of this.sites) {
            siteRegions.set(site.id, []);
        }

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const id = ownership[y][x];
                if (id < 0) continue;

                // Check if this is a boundary pixel
                let isBoundary = false;
                if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
                    isBoundary = true;
                } else {
                    const neighbors = [
                        ownership[y][x - 1], ownership[y][x + 1],
                        ownership[y - 1][x], ownership[y + 1][x]
                    ];
                    for (const nid of neighbors) {
                        if (nid !== id) {
                            isBoundary = true;
                            break;
                        }
                    }
                }

                if (isBoundary) {
                    // Convert back to world coords
                    const wx = this.bounds.left + (x / W) * worldW;
                    const wy = this.bounds.top + ((H - 1 - y) / H) * worldH; // Flip Y back
                    
                    if (!siteRegions.has(id)) {
                        siteRegions.set(id, []);
                    }
                    siteRegions.get(id).push({ x: wx, y: wy });
                }
            }
        }

        // Create cells from regions
        this.cells = [];
        for (const site of this.sites) {
            let region = siteRegions.get(site.id) || [];
            
            // If no boundary pixels found, use bounding box
            if (region.length === 0) {
                region = [
                    { x: this.bounds.left, y: this.bounds.top },
                    { x: this.bounds.right, y: this.bounds.top },
                    { x: this.bounds.right, y: this.bounds.bottom },
                    { x: this.bounds.left, y: this.bounds.bottom }
                ];
            } else {
                // Compute convex hull of boundary points
                region = this.convexHull(region);
            }

            this.cells.push({
                site: site,
                region: region
            });
        }
    }

    convexHull(points) {
        if (points.length < 3) return points;

        // Graham scan
        const sorted = points.slice().sort((a, b) => 
            a.x !== b.x ? a.x - b.x : a.y - b.y
        );

        const cross = (o, a, b) => 
            (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower = [];
        for (const p of sorted) {
            while (lower.length >= 2 && 
                   cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && 
                   cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }

    cleanup() {
        // WebGL cleanup happens when canvas is garbage collected
        this.gl = null;
        this.canvas = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VoronoiDiagramJFA };
}