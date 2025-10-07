/**
 * WebGL utility functions
 */

/**
 * Initialize WebGL2 context with required extensions
 */
export function initWebGL(canvas) {
    let gl;
    try {
        gl = canvas.getContext('webgl2', {
            antialias: true,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });
    } catch (e) {}

    if (!gl) {
        throw new Error('WebGL2 not available in this browser.');
    }

    // Check for half-float support (most modern GPUs have this)
    const extCBF = gl.getExtension('EXT_color_buffer_float');
    if (!extCBF) {
        throw new Error('Missing EXT_color_buffer_float extension.');
    }

    console.log('✅ WebGL2 initialized with half-float support');
    return gl;
}

/**
 * Compile a shader
 */
export function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        throw new Error('Shader compile error: ' + log);
    }
    return sh;
}

/**
 * Link a shader program
 */
export function createProgram(gl, vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(p);
        throw new Error('Program link error: ' + log);
    }
    return p;
}

/**
 * Create a texture with RGBA16F format
 */
export function createTexture(gl, w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // OPTIMIZATION: Use RGBA16F instead of RGBA32F for 2x bandwidth reduction
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    return tex;
}

/**
 * Create a framebuffer object
 */
export function createFBO(gl, tex) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!ok) {
        throw new Error('Framebuffer incomplete.');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
}

/**
 * Bind texture as input to a texture unit
 */
export function bindTexAsInput(gl, tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
}

/**
 * Get highest power of 2 at least as large as v
 */
export function highestPow2AtLeast(v) {
    let p = 1;
    while (p < v) p <<= 1;
    return p;
}
