/**
 * JFA (Jump Flooding Algorithm) for computing Voronoi diagrams
 */

import { VERT, FRAG_CLEAR, FRAG_JFA, FRAG_RENDER } from './shaders.js';
import { createProgram, createTexture, createFBO, bindTexAsInput, highestPow2AtLeast } from '../../lib/webgl.js';
import { createPaletteTexture, PALETTE_SIZE, PALETTES } from '../../lib/palette.js';

export class JFAAlgorithm {
    constructor(gl, canvas) {
        this.gl = gl;
        this.canvas = canvas;

        // Programs
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
        this.jfaExtraPasses = 1; // Number of extra refinement passes (0-4)
        this.currentPaletteId = 'golden';

        this.setup();
    }

    setup() {
        const gl = this.gl;

        // Create shader programs
        this.progJFA = createProgram(gl, VERT, FRAG_JFA);
        this.progRender = createProgram(gl, VERT, FRAG_RENDER);
        this.progClear = createProgram(gl, VERT, FRAG_CLEAR);

        const W = this.canvas.width;
        const H = this.canvas.height;

        // Create textures and FBOs
        this.texA = createTexture(gl, W, H);
        this.texB = createTexture(gl, W, H);
        this.fboA = createFBO(gl, this.texA);
        this.fboB = createFBO(gl, this.texB);

        // Create palette texture
        this.paletteTex = createPaletteTexture(gl, this.currentPaletteId);

        // Store uniform locations
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
                uShowSites: gl.getUniformLocation(this.progRender, 'uShowSites'),
                uP: gl.getUniformLocation(this.progRender, 'uP'),
                uUseInf: gl.getUniformLocation(this.progRender, 'uUseInf'),
                uResolutionScale: gl.getUniformLocation(this.progRender, 'uResolutionScale'),
                uEdgeColor: gl.getUniformLocation(this.progRender, 'uEdgeColor'),
            }
        };

        this.quadVAO = gl.createVertexArray();

        console.log('✅ JFA algorithm setup complete');
    }

    /**
     * Write seed pixels to texture
     */
    writeSeedPixels(sites) {
        const gl = this.gl;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Create a full buffer initialized to "no seed"
        const buffer = new Float32Array(W * H * 4);
        for (let i = 0; i < buffer.length; i += 4) {
            buffer[i] = -1;     // x
            buffer[i + 1] = -1; // y
            buffer[i + 2] = -1; // seed index
            buffer[i + 3] = 0;  // unused
        }

        // Write all seeds to the buffer
        for (let si = 0; si < sites.length; si++) {
            const sx = Math.max(0, Math.min(W - 1, Math.round(sites[si].x)));
            const syTop = Math.max(0, Math.min(H - 1, Math.round(sites[si].y)));
            const sy = (H - 1 - syTop);

            const idx = (sy * W + sx) * 4;
            buffer[idx] = sx;
            buffer[idx + 1] = sy;
            buffer[idx + 2] = si;
            buffer[idx + 3] = 1.0;
        }

        // Single texture upload - MUCH FASTER!
        gl.bindTexture(gl.TEXTURE_2D, this.texA);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, buffer);
    }

    /**
     * Run JFA computation
     */
    compute(sites, p, useInf) {
        if (sites.length === 0) {
            return;
        }

        const gl = this.gl;
        const W = this.canvas.width;
        const H = this.canvas.height;

        gl.viewport(0, 0, W, H);

        // Initialize texture A with seeds
        this.writeSeedPixels(sites);

        const maxDim = Math.max(W, H);
        let step = highestPow2AtLeast(maxDim);

        gl.bindVertexArray(this.quadVAO);
        gl.useProgram(this.progJFA);
        gl.uniform2f(this.jfa.loc.uTexel, 1 / W, 1 / H);
        gl.uniform2f(this.jfa.loc.uResolution, W, H);
        gl.uniform1i(this.jfa.loc.uSeedTex, 0);
        gl.uniform1f(this.jfa.loc.uP, p);
        gl.uniform1i(this.jfa.loc.uUseInf, useInf ? 1 : 0);

        // Standard JFA passes (power-of-2 stepping)
        while (step >= 1) {
            gl.uniform1f(this.jfa.loc.uStep, step);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            bindTexAsInput(gl, this.texA, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            // swap
            let t = this.texA; this.texA = this.texB; this.texB = t;
            let f = this.fboA; this.fboA = this.fboB; this.fboB = f;
            step >>= 1;
        }

        // Extra refinement passes (JFA+N)
        for (let i = this.jfaExtraPasses; i >= 1; i--) {
            gl.uniform1f(this.jfa.loc.uStep, i);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            bindTexAsInput(gl, this.texA, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            // swap
            let t = this.texA; this.texA = this.texB; this.texB = t;
            let f = this.fboA; this.fboA = this.fboB; this.fboB = f;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * Render the final output
     */
    render(showEdges, showSites, p, useInf, resolutionScale) {
        const gl = this.gl;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Get edge color from current palette
        const palette = PALETTES.find(p => p.id === this.currentPaletteId) || PALETTES[0];
        const edgeColor = palette.edgeColor || [0.0, 0.0, 0.0];

        gl.viewport(0, 0, W, H);
        gl.bindVertexArray(this.quadVAO);
        gl.useProgram(this.progRender);
        gl.uniform2f(this.rnd.loc.uResolution, W, H);
        gl.uniform1i(this.rnd.loc.uSeedTex, 0);
        gl.uniform1i(this.rnd.loc.uPalette, 1);
        gl.uniform1i(this.rnd.loc.uPaletteSize, PALETTE_SIZE);
        gl.uniform1i(this.rnd.loc.uEdges, showEdges ? 1 : 0);
        gl.uniform1i(this.rnd.loc.uShowSites, showSites ? 1 : 0);
        gl.uniform1f(this.rnd.loc.uP, p);
        gl.uniform1i(this.rnd.loc.uUseInf, useInf ? 1 : 0);
        gl.uniform1f(this.rnd.loc.uResolutionScale, resolutionScale);
        gl.uniform3f(this.rnd.loc.uEdgeColor, edgeColor[0], edgeColor[1], edgeColor[2]);
        bindTexAsInput(gl, this.texA, 0);
        bindTexAsInput(gl, this.paletteTex, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /**
     * Resize textures and FBOs
     */
    resize(width, height) {
        const gl = this.gl;

        // Delete old resources
        if (this.texA) gl.deleteTexture(this.texA);
        if (this.texB) gl.deleteTexture(this.texB);
        if (this.fboA) gl.deleteFramebuffer(this.fboA);
        if (this.fboB) gl.deleteFramebuffer(this.fboB);

        // Create new resources
        this.texA = createTexture(gl, width, height);
        this.texB = createTexture(gl, width, height);
        this.fboA = createFBO(gl, this.texA);
        this.fboB = createFBO(gl, this.texB);
    }

    /**
     * Set extra JFA passes
     */
    setExtraPasses(passes) {
        this.jfaExtraPasses = passes;
    }

    /**
     * Set color palette
     */
    setPalette(paletteId) {
        const gl = this.gl;
        this.currentPaletteId = paletteId;

        // Delete old palette texture
        if (this.paletteTex) {
            gl.deleteTexture(this.paletteTex);
        }

        // Create new palette texture
        this.paletteTex = createPaletteTexture(gl, paletteId);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
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
