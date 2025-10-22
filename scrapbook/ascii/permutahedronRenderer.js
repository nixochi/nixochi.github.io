export class PermutahedronRenderer {
    constructor(canvasId, cols, rows) {
        this.canvas = document.getElementById(canvasId);
        this.gl = null;
        this.isRunning = false;
        this.animationId = null;
        this.cols = cols;
        this.rows = rows;

        // ========== CONFIGURATION ==========
        this.config = {
            // Character cell dimensions (in pixels)
            // These define the aspect ratio of terminal characters
            charPixelWidth: 9,              // Character width in pixels
            charPixelHeight: 17,            // Character height in pixels

            // Camera settings
            cameraRadius: 4.0,              // Distance from object (lower = closer)
            cameraInitialTheta: Math.PI / 4,  // Initial horizontal angle
            cameraInitialPhi: Math.PI / 3,    // Initial vertical angle
            cameraFOV: 35,                  // Field of view in degrees

            // Rotation settings
            rotationStep: 0.15,              // Radians per arrow key press

            // ASCII rendering
            asciiChars: '@%#*+=-:. ',       // Characters from dark to light
            brightnessSensitivity: 0.05,     // Brightness curve: >1 more contrast, <1 less contrast

            // Performance
            fps: 30                         // Frames per second
        };
        // ===================================

        // Calculate square render dimensions (dynamic)
        // Terminal characters have aspect ratio = charPixelWidth / charPixelHeight
        const CHAR_ASPECT = this.config.charPixelWidth / this.config.charPixelHeight; // ~0.53

        // Find the largest visual square that fits in terminal
        // For a visual square: renderWidth * charPixelWidth = renderHeight * charPixelHeight
        // So: renderWidth = renderHeight / CHAR_ASPECT

        // If we use all rows as height:
        const squareColsFromRows = rows / CHAR_ASPECT;
        // If we use all cols as width:
        const squareRowsFromCols = cols * CHAR_ASPECT;

        if (squareColsFromRows <= cols) {
            // Limited by rows - use full height
            this.renderHeight = rows;
            this.renderWidth = Math.floor(squareColsFromRows);
        } else {
            // Limited by cols - use full width
            this.renderWidth = cols;
            this.renderHeight = Math.floor(squareRowsFromCols);
        }

        this.squareSize = Math.min(this.renderWidth, this.renderHeight);

        // Permutahedron data
        this.polytopeData = {
            vertices: [
                [1,0.5,0], [1,-0.5,0], [-1,0.5,0], [-1,-0.5,0],
                [1,0,0.5], [1,0,-0.5], [-1,0,0.5], [-1,0,-0.5],
                [0.5,1,0], [0.5,-1,0], [-0.5,1,0], [-0.5,-1,0],
                [0.5,0,1], [0.5,0,-1], [-0.5,0,1], [-0.5,0,-1],
                [0,1,0.5], [0,1,-0.5], [0,-1,0.5], [0,-1,-0.5],
                [0,0.5,1], [0,0.5,-1], [0,-0.5,1], [0,-0.5,-1]
            ],
            edges: [
                [15,21], [13,21], [13,23], [15,23], [12,20], [14,20], [14,22], [12,22],
                [1,5], [1,9], [9,19], [19,23], [5,13], [8,17], [0,8], [0,5], [17,21],
                [3,11], [3,7], [7,15], [11,19], [9,18], [11,18], [3,6], [18,22], [6,14],
                [2,6], [2,7], [4,12], [1,4], [0,4], [10,17], [2,10], [8,16], [10,16], [16,20]
            ]
        };

        // Camera state (initialized from config)
        this.camera = {
            radius: this.config.cameraRadius,
            theta: this.config.cameraInitialTheta,
            phi: this.config.cameraInitialPhi
        };

        // Derived values
        this.frameInterval = 1000 / this.config.fps;
        this.lastFrameTime = 0;

        // WebGL resources
        this.program3D = null;
        this.sceneTexture = null;
        this.sceneFramebuffer = null;
        this.charResolutionX = 0;
        this.charResolutionY = 0;
        this.edgeBuffer = null;
    }

    init() {
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.error('WebGL not supported');
            return false;
        }

        this.program3D = this.createProgram(this.vertexShader3D(), this.fragmentShader3D());
        this.buildGeometry();
        this.resizeCanvas();

        this.gl.clearColor(0, 0, 0, 1);
        return true;
    }

    updateDimensions(cols, rows) {
        this.cols = cols;
        this.rows = rows;

        // Recalculate square dimensions with proper aspect ratio
        const CHAR_ASPECT = this.config.charPixelWidth / this.config.charPixelHeight;
        const squareColsFromRows = rows / CHAR_ASPECT;
        const squareRowsFromCols = cols * CHAR_ASPECT;

        if (squareColsFromRows <= cols) {
            // Limited by rows - use full height
            this.renderHeight = rows;
            this.renderWidth = Math.floor(squareColsFromRows);
        } else {
            // Limited by cols - use full width
            this.renderWidth = cols;
            this.renderHeight = Math.floor(squareRowsFromCols);
        }

        this.squareSize = Math.min(this.renderWidth, this.renderHeight);
        this.resizeCanvas();
    }


    // Shader sources
    vertexShader3D() {
        return `
            attribute vec3 aPos;
            uniform mat4 uMVP;
            void main() {
                gl_Position = uMVP * vec4(aPos, 1.0);
            }
        `;
    }

    fragmentShader3D() {
        return `
            precision mediump float;
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
            }
        `;
    }


    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }


    createFramebuffer(width, height) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);

        const fb = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);

        const depthBuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, depthBuffer);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

        return { texture, framebuffer: fb };
    }

    buildGeometry() {
        const positions = [];
        this.polytopeData.edges.forEach(([a, b]) => {
            positions.push(...this.polytopeData.vertices[a], ...this.polytopeData.vertices[b]);
        });

        this.edgeBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
    }


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

    resizeCanvas() {
        // Calculate canvas pixel dimensions based on character dimensions
        // This ensures the rendered image has the correct aspect ratio
        const charW = this.renderWidth;
        const charH = this.renderHeight;
        const pixelW = charW * this.config.charPixelWidth;
        const pixelH = charH * this.config.charPixelHeight;

        this.canvas.width = pixelW;
        this.canvas.height = pixelH;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        this.charResolutionX = charW;
        this.charResolutionY = charH;

        // Recreate framebuffer at pixel resolution
        if (this.sceneFramebuffer) {
            this.gl.deleteFramebuffer(this.sceneFramebuffer);
            this.gl.deleteTexture(this.sceneTexture);
        }
        const sceneFB = this.createFramebuffer(pixelW, pixelH);
        this.sceneTexture = sceneFB.texture;
        this.sceneFramebuffer = sceneFB.framebuffer;
    }

    rotateLeft() {
        this.camera.theta -= this.config.rotationStep;
    }

    rotateRight() {
        this.camera.theta += this.config.rotationStep;
    }

    rotateUp() {
        this.camera.phi -= this.config.rotationStep;
        this.camera.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.camera.phi));
    }

    rotateDown() {
        this.camera.phi += this.config.rotationStep;
        this.camera.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.camera.phi));
    }

    getBrightness(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    brightnessToChar(brightness) {
        // Normalize brightness to 0-1 range (inverted: darker = higher)
        const normalized = 1 - brightness / 255;

        // Apply sensitivity curve (gamma correction)
        // sensitivity > 1.0 = more contrast (push to extremes)
        // sensitivity < 1.0 = less contrast (compress to middle)
        // sensitivity = 1.0 = linear (no change)
        // Use inverse power to get correct behavior
        const adjusted = Math.pow(normalized, 1.0 / this.config.brightnessSensitivity);

        // Map to character index
        const index = Math.floor(adjusted * this.config.asciiChars.length);
        return this.config.asciiChars[Math.min(index, this.config.asciiChars.length - 1)];
    }

    generateFrame() {
        const charW = this.renderWidth;
        const charH = this.renderHeight;
        const cellW = this.config.charPixelWidth;
        const cellH = this.config.charPixelHeight;
        const pixelW = charW * cellW;
        const pixelH = charH * cellH;

        // Calculate aspect ratio from pixel dimensions (accounts for non-square chars)
        const aspect = pixelW / pixelH;
        const P = this.mat4Perspective(this.config.cameraFOV * Math.PI / 180, aspect, 0.01, 100.0);

        const camX = this.camera.radius * Math.sin(this.camera.phi) * Math.sin(this.camera.theta);
        const camY = this.camera.radius * Math.cos(this.camera.phi);
        const camZ = this.camera.radius * Math.sin(this.camera.phi) * Math.cos(this.camera.theta);
        const camPos = [camX, camY, camZ];

        const V = this.mat4LookAt(camPos, [0, 0, 0], [0, 1, 0]);
        const M = this.mat4Identity();
        const MVP = this.mat4Multiply(this.mat4Multiply(P, V), M);

        // Render 3D permutahedron to framebuffer at pixel resolution
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.sceneFramebuffer);
        this.gl.viewport(0, 0, pixelW, pixelH);
        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.enable(this.gl.DEPTH_TEST);

        this.gl.useProgram(this.program3D);
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program3D, 'uMVP'), false, MVP);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeBuffer);
        const posLoc = this.gl.getAttribLocation(this.program3D, 'aPos');
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.drawArrays(this.gl.LINES, 0, this.polytopeData.edges.length * 2);

        // Read pixels from framebuffer
        const pixels = new Uint8Array(pixelW * pixelH * 4);
        this.gl.readPixels(0, 0, pixelW, pixelH, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

        // Calculate padding to center the square in the terminal
        const horizontalPad = Math.floor((this.cols - charW) / 2);
        const verticalPad = Math.floor((this.rows - charH) / 2);
        const leftPadding = ' '.repeat(horizontalPad);
        const rightPadding = ' '.repeat(this.cols - charW - horizontalPad);
        const emptyLine = ' '.repeat(this.cols);

        // Build the frame with vertical padding
        let frame = '';

        // Top padding (empty lines)
        for (let i = 0; i < verticalPad; i++) {
            frame += emptyLine;
        }

        // Square content (centered horizontally)
        for (let charY = charH - 1; charY >= 0; charY--) {  // Flip Y coordinate
            frame += leftPadding;
            for (let charX = 0; charX < charW; charX++) {
                // Sample the pixel area for this character cell
                let totalBrightness = 0;
                let sampleCount = 0;

                for (let py = 0; py < cellH; py++) {
                    for (let px = 0; px < cellW; px++) {
                        const pixelX = charX * cellW + px;
                        const pixelY = charY * cellH + py;
                        const i = (pixelY * pixelW + pixelX) * 4;
                        totalBrightness += this.getBrightness(pixels[i], pixels[i + 1], pixels[i + 2]);
                        sampleCount++;
                    }
                }

                const avgBrightness = totalBrightness / sampleCount;
                frame += this.brightnessToChar(avgBrightness);
            }
            frame += rightPadding;
        }

        // Bottom padding (empty lines)
        for (let i = 0; i < this.rows - charH - verticalPad; i++) {
            frame += emptyLine;
        }

        return frame;
    }

}
