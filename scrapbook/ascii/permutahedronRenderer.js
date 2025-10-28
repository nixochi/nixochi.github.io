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
            // Canonical render size (fixed, viewport-independent)
            canonicalSquareSize: 40,        // Always render permutahedron at this size

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

            // Visual options
            colorfulEdges: false,           // Use different colors for each edge
            colorBrightness: 0.65,          // HSL lightness for edge colors (0.5-0.9)

            // Performance
            fps: 30                         // Frames per second
        };
        // ===================================

        // Calculate render dimensions for a visual square (viewport-independent)
        // Terminal characters are not square, so we need to account for aspect ratio
        const CHAR_ASPECT = this.config.charPixelWidth / this.config.charPixelHeight; // ~0.53

        // For a visual square: renderWidth * charPixelWidth = renderHeight * charPixelHeight
        // So: renderWidth = renderHeight / CHAR_ASPECT

        // Use canonicalSquareSize as the height (since chars are taller than wide)
        this.renderHeight = this.config.canonicalSquareSize;
        this.renderWidth = Math.floor(this.config.canonicalSquareSize / CHAR_ASPECT);
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
        this.colorBuffer = null;
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
        // Only update terminal dimensions for padding calculation
        this.cols = cols;
        this.rows = rows;

        // Render dimensions remain constant (viewport-independent)
        // But recalculate if char aspect ratio changed
        const CHAR_ASPECT = this.config.charPixelWidth / this.config.charPixelHeight;
        this.renderHeight = this.config.canonicalSquareSize;
        this.renderWidth = Math.floor(this.config.canonicalSquareSize / CHAR_ASPECT);
        this.squareSize = Math.min(this.renderWidth, this.renderHeight);

        this.resizeCanvas();
    }


    // Shader sources
    vertexShader3D() {
        return `
            attribute vec3 aPos;
            attribute vec3 aColor;
            uniform mat4 uMVP;
            varying vec3 vColor;
            void main() {
                gl_Position = uMVP * vec4(aPos, 1.0);
                vColor = aColor;
            }
        `;
    }

    fragmentShader3D() {
        return `
            precision mediump float;
            varying vec3 vColor;
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
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
        const colors = [];

        // Generate a unique color for each edge using HSL
        const numEdges = this.polytopeData.edges.length;

        this.polytopeData.edges.forEach(([a, b], edgeIndex) => {
            positions.push(...this.polytopeData.vertices[a], ...this.polytopeData.vertices[b]);

            // Generate color based on edge index
            // Use high saturation and configurable lightness for bright, vivid colors
            const hue = (edgeIndex / numEdges) * 360;
            const rgb = this.hslToRgb(hue, 1.0, this.config.colorBrightness);

            // Both vertices of the edge get the same color
            colors.push(...rgb, ...rgb);
        });

        this.edgeBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
    }

    // HSL to RGB conversion for vibrant colors
    hslToRgb(h, s, l) {
        h = h / 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;
        if (h < 1/6) {
            [r, g, b] = [c, x, 0];
        } else if (h < 2/6) {
            [r, g, b] = [x, c, 0];
        } else if (h < 3/6) {
            [r, g, b] = [0, c, x];
        } else if (h < 4/6) {
            [r, g, b] = [0, x, c];
        } else if (h < 5/6) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }

        return [r + m, g + m, b + m];
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

        // Calculate aspect ratio from pixel dimensions
        // renderWidth and renderHeight are chosen to create a visual square
        // accounting for non-square terminal characters
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

        // Bind position attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeBuffer);
        const posLoc = this.gl.getAttribLocation(this.program3D, 'aPos');
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 3, this.gl.FLOAT, false, 0, 0);

        // Bind color attribute
        const colorLoc = this.gl.getAttribLocation(this.program3D, 'aColor');
        if (this.config.colorfulEdges) {
            // Use colorful edges
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
            this.gl.enableVertexAttribArray(colorLoc);
            this.gl.vertexAttribPointer(colorLoc, 3, this.gl.FLOAT, false, 0, 0);
        } else {
            // Use white color for all edges
            this.gl.disableVertexAttribArray(colorLoc);
            this.gl.vertexAttrib3f(colorLoc, 1.0, 1.0, 1.0);
        }

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
            frame += emptyLine + '\r\n';
        }

        // Square content (centered horizontally)
        for (let charY = charH - 1; charY >= 0; charY--) {  // Flip Y coordinate
            frame += leftPadding;
            for (let charX = 0; charX < charW; charX++) {
                // Sample the pixel area for this character cell
                let totalIntensity = 0; // Maximum of RGB = edge presence, not perceptual brightness
                let totalR = 0;
                let totalG = 0;
                let totalB = 0;
                let sampleCount = 0;
                let colorSampleCount = 0; // Count only non-black pixels for color averaging

                for (let py = 0; py < cellH; py++) {
                    for (let px = 0; px < cellW; px++) {
                        const pixelX = charX * cellW + px;
                        const pixelY = charY * cellH + py;
                        const i = (pixelY * pixelW + pixelX) * 4;
                        const r = pixels[i];
                        const g = pixels[i + 1];
                        const b = pixels[i + 2];

                        // Use max(r,g,b) as intensity - treats all colors as equally "bright"
                        // This way red (255,0,0) has same intensity as white (255,255,255)
                        const pixelIntensity = Math.max(r, g, b);
                        totalIntensity += pixelIntensity;

                        // Only average color from non-black pixels to preserve vibrancy
                        if (pixelIntensity > 0) {
                            totalR += r;
                            totalG += g;
                            totalB += b;
                            colorSampleCount++;
                        }

                        sampleCount++;
                    }
                }

                const avgIntensity = totalIntensity / sampleCount;
                // Use color average from only the colored pixels, not black background
                const avgR = colorSampleCount > 0 ? Math.round(totalR / colorSampleCount) : 0;
                const avgG = colorSampleCount > 0 ? Math.round(totalG / colorSampleCount) : 0;
                const avgB = colorSampleCount > 0 ? Math.round(totalB / colorSampleCount) : 0;

                // Add ANSI color code if colorful edges enabled and pixel has color
                if (this.config.colorfulEdges && (avgR > 0 || avgG > 0 || avgB > 0)) {
                    frame += `\x1b[38;2;${avgR};${avgG};${avgB}m`;
                }

                frame += this.brightnessToChar(avgIntensity);

                // Reset color if colorful edges enabled
                if (this.config.colorfulEdges && (avgR > 0 || avgG > 0 || avgB > 0)) {
                    frame += '\x1b[0m';
                }
            }
            frame += rightPadding + '\r\n';
        }

        // Bottom padding (empty lines)
        for (let i = 0; i < this.rows - charH - verticalPad; i++) {
            frame += emptyLine + '\r\n';
        }

        return frame;
    }

}
