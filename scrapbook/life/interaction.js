import { CONFIG } from './config.js';

export class InteractionHandler {
    constructor(canvas, gl, pickingProgram, pickingFBO, permutahedronVAO, permutahedronIndicesLength) {
        this.canvas = canvas;
        this.gl = gl;
        this.pickingProgram = pickingProgram;
        this.pickingFBO = pickingFBO;
        this.permutahedronVAO = permutahedronVAO;
        this.permutahedronIndicesLength = permutahedronIndicesLength;

        this.mouseScreenX = -1;
        this.mouseScreenY = -1;
        this.mouseActive = false;
        this.mouseDown = false;

        this.mouseUVX = -1;
        this.mouseUVY = -1;
        this.hasHover = 0.0;

        this.lastTapTime = 0;

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        (window.innerWidth <= 768);

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouseScreenX = e.clientX;
            this.mouseScreenY = e.clientY;
            this.mouseActive = true;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseActive = false;
            this.hasHover = 0.0;
        });

        this.canvas.addEventListener('mousedown', () => {
            this.mouseDown = true;
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();

            const touch = e.touches[0];
            this.mouseScreenX = touch.clientX;
            this.mouseScreenY = touch.clientY;
            this.mouseActive = true;

            const currentTime = Date.now();
            const tapInterval = currentTime - this.lastTapTime;

            if (tapInterval < CONFIG.doubleTapDelay && tapInterval > 0) {
                this.mouseDown = true;
            }

            this.lastTapTime = currentTime;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();

            const touch = e.touches[0];
            this.mouseScreenX = touch.clientX;
            this.mouseScreenY = touch.clientY;
            this.mouseActive = true;
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();

            if (e.touches.length === 0) {
                this.mouseActive = false;
                this.mouseDown = false;
                this.hasHover = 0.0;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.mouseActive = false;
            this.mouseDown = false;
            this.hasHover = 0.0;
        }, { passive: false });
    }

    updatePickingTexture(pickingTexture, pickingDepth) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, pickingTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindRenderbuffer(gl.RENDERBUFFER, pickingDepth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.canvas.width, this.canvas.height);
    }

    readUVAtMouse(projection, view, model) {
        if (!this.mouseActive) {
            this.hasHover = 0.0;
            return;
        }

        const gl = this.gl;
        const rect = this.canvas.getBoundingClientRect();
        const mouseRelX = this.mouseScreenX - rect.left;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        gl.useProgram(this.pickingProgram);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.pickingProgram, 'uProjection'), false, projection);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.pickingProgram, 'uView'), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.pickingProgram, 'uModel'), false, model);

        gl.bindVertexArray(this.permutahedronVAO);
        gl.drawElements(gl.TRIANGLES, this.permutahedronIndicesLength, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);

        const mouseY = rect.height - (this.mouseScreenY - rect.top);
        const pixel = new Uint8Array(4);
        gl.readPixels(mouseRelX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (pixel[2] > 128) {
            this.mouseUVX = pixel[0] / 255.0;
            this.mouseUVY = pixel[1] / 255.0;
            this.hasHover = 1.0;
        } else {
            this.hasHover = 0.0;
        }
    }
}
