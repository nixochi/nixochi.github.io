/**
 * JFA (Jump Flooding Algorithm) Voronoi implementation
 * Algorithm by Guodong Rong and Tiow-Seng Tan
 * GPU-accelerated using WebGL2
 * Supports L_p metrics (p >= 1) including L_infinity
 */
class VoronoiDiagramJFA {
    constructor(sites, bounds, p = 2, resolution = null) {
        this.sites = sites;
        this.bounds = bounds;
        this.p = p;
        this.useInf = (p === Infinity);
        
        // Auto-determine resolution based on bounds if not provided
        const w = bounds.right - bounds.left;
        const h = bounds.bottom - bounds.top;
        this.resolution = resolution || Math.min(2048, Math.max(512, Math.ceil(Math.max(w, h))));
        
        this.cells = [];
        this.gl = null;
        this.resources = [];
        
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
        const canvas = document.createElement('canvas');
        canvas.width = this.resolution;
        canvas.height = this.resolution;
        
        this.gl = canvas.getContext('webgl2', {
            antialias: false,
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

    createShaderProgram(vsSource, fsSource) {
        const gl = this.gl;
        
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            throw new Error('Vertex shader: ' + gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            throw new Error('Fragment shader: ' + gl.getShaderInfoLog(fs));
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program: ' + gl.getProgramInfoLog(program));
        }

        this.resources.push(vs, fs, program);
        return program;
    }

    createTexture(width, height) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
        this.resources.push(tex);
        return tex;
    }

    createFramebuffer(texture) {
        const gl = this.gl;
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Framebuffer incomplete');
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.resources.push(fb);
        return fb;
    }

    runJFA() {
        const gl = this.gl;
        const res = this.resolution;

        // Shaders
        const vertexShader = `#version 300 es
            precision highp float;
            out vec2 v_uv;
            void main() {
                uint id = uint(gl_VertexID);
                vec2 p = vec2(float((id<<1u)&2u), float(id&2u));
                v_uv = p;
                gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
            }`;

        const clearShader = `#version 300 es
            precision mediump float;
            out vec4 outColor;
            void main() { outColor = vec4(-1.0, -1.0, -1.0, -1.0); }`;

        const jfaShader = `#version 300 es
            precision highp float;
            precision highp sampler2D;
            in vec2 v_uv;
            out vec4 outColor;
            uniform sampler2D uSeedTex;
            uniform vec2 uTexel;
            uniform float uStep;
            uniform vec2 uResolution;
            uniform float uP;
            uniform bool uUseInf;

            float lp_cost(vec2 delta) {
                vec2 ad = abs(delta);
                return uUseInf ? max(ad.x, ad.y) : (pow(ad.x, uP) + pow(ad.y, uP));
            }

            vec4 pickBetter(vec4 a, vec4 b, vec2 fragPix) {
                float da = (a.z < 0.0) ? 1e30 : lp_cost(fragPix - a.xy);
                float db = (b.z < 0.0) ? 1e30 : lp_cost(fragPix - b.xy);
                return (db < da) ? b : a;
            }

            void main() {
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

        const progClear = this.createShaderProgram(vertexShader, clearShader);
        const progJFA = this.createShaderProgram(vertexShader, jfaShader);

        // Create textures and framebuffers
        let texA = this.createTexture(res, res);
        let texB = this.createTexture(res, res);
        let fboA = this.createFramebuffer(texA);
        let fboB = this.createFramebuffer(texB);

        // Create VAO
        const vao = gl.createVertexArray();
        this.resources.push(vao);

        // Clear texture A
        gl.bindVertexArray(vao);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
        gl.viewport(0, 0, res, res);
        gl.useProgram(progClear);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Write seed pixels
        this.writeSeedPixels(texA);

        // JFA passes
        gl.useProgram(progJFA);
        const locSeedTex = gl.getUniformLocation(progJFA, 'uSeedTex');
        const locTexel = gl.getUniformLocation(progJFA, 'uTexel');
        const locStep = gl.getUniformLocation(progJFA, 'uStep');
        const locResolution = gl.getUniformLocation(progJFA, 'uResolution');
        const locP = gl.getUniformLocation(progJFA, 'uP');
        const locUseInf = gl.getUniformLocation(progJFA, 'uUseInf');

        gl.uniform2f(locTexel, 1/res, 1/res);
        gl.uniform2f(locResolution, res, res);
        gl.uniform1i(locSeedTex, 0);
        gl.uniform1f(locP, this.p);
        gl.uniform1i(locUseInf, this.useInf ? 1 : 0);

        // Determine starting step size
        let step = 1;
        while (step < res) step <<= 1;

        // JFA flood passes
        while (step >= 1) {
            gl.uniform1f(locStep, step);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texA);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            // Swap
            [texA, texB] = [texB, texA];
            [fboA, fboB] = [fboB, fboA];
            
            step >>= 1;
        }

        // Extra JFA+1 pass at step=1
        gl.uniform1f(locStep, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        [texA, texB] = [texB, texA];
        [fboA, fboB] = [fboB, fboA];

        // Read back result
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
        this.resultData = new Float32Array(res * res * 4);
        gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, this.resultData);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    writeSeedPixels(tex) {
        const gl = this.gl;
        const res = this.resolution;
        const w = this.bounds.right - this.bounds.left;
        const h = this.bounds.bottom - this.bounds.top;

        gl.bindTexture(gl.TEXTURE_2D, tex);

        const seedPixel = new Float32Array(4);
        for (let i = 0; i < this.sites.length; i++) {
            const site = this.sites[i];
            
            // Convert from world coords to texture coords
            const nx = (site.x - this.bounds.left) / w;
            const ny = (site.y - this.bounds.top) / h;
            
            const px = Math.floor(nx * res);
            const py = Math.floor(ny * res);
            
            if (px >= 0 && px < res && py >= 0 && py < res) {
                seedPixel[0] = px;
                seedPixel[1] = py;
                seedPixel[2] = i;
                seedPixel[3] = 1.0;
                gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, 1, 1, gl.RGBA, gl.FLOAT, seedPixel);
            }
        }
    }

    extractCells() {
        const res = this.resolution;
        const w = this.bounds.right - this.bounds.left;
        const h = this.bounds.bottom - this.bounds.top;

        // Build ownership map
        const ownership = new Array(res);
        for (let y = 0; y < res; y++) {
            ownership[y] = new Array(res);
            for (let x = 0; x < res; x++) {
                const idx = (y * res + x) * 4;
                const siteId = this.resultData[idx + 2];
                ownership[y][x] = siteId >= 0 ? Math.floor(siteId) : -1;
            }
        }

        // Extract cell boundaries using marching squares
        const siteRegions = new Map();
        for (const site of this.sites) {
            siteRegions.set(site.id, []);
        }

        // Simple boundary extraction: collect perimeter pixels
        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
                const id = ownership[y][x];
                if (id < 0) continue;

                // Check if this is a boundary pixel
                let isBoundary = false;
                if (x === 0 || x === res-1 || y === 0 || y === res-1) {
                    isBoundary = true;
                } else {
                    const neighbors = [
                        ownership[y][x-1], ownership[y][x+1],
                        ownership[y-1][x], ownership[y+1][x]
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
                    const wx = this.bounds.left + (x / res) * w;
                    const wy = this.bounds.top + (y / res) * h;
                    
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
                // Compute convex hull of boundary points for cleaner regions
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
                   cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && 
                   cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }

    cleanup() {
        if (!this.gl) return;

        for (const resource of this.resources) {
            if (resource.constructor.name.includes('Texture')) {
                this.gl.deleteTexture(resource);
            } else if (resource.constructor.name.includes('Framebuffer')) {
                this.gl.deleteFramebuffer(resource);
            } else if (resource.constructor.name.includes('Shader')) {
                this.gl.deleteShader(resource);
            } else if (resource.constructor.name.includes('Program')) {
                this.gl.deleteProgram(resource);
            } else if (resource.constructor.name.includes('VertexArray')) {
                this.gl.deleteVertexArray(resource);
            }
        }

        this.resources = [];
        this.gl = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VoronoiDiagramJFA };
}