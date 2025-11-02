const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    console.error('WebGL2 not supported');
}

// Permutahedron vertices (4D permutations projected to 3D)
const PERMUTAHEDRON_VERTICES = [
    [-2.121320343559642,-0.408248290463863,0.577350269189626],
    [-2.121320343559642,0.408248290463863,-0.577350269189626],
    [-1.414213562373095,-1.632993161855452,0.577350269189626],
    [-1.414213562373095,0,-1.732050807568877],
    [-1.414213562373095,0,1.732050807568877],
    [-1.414213562373095,1.632993161855452,-0.577350269189626],
    [-0.707106781186548,-2.041241452319315,-0.577350269189626],
    [-0.707106781186548,-1.224744871391589,-1.732050807568877],
    [-0.707106781186548,-1.224744871391589,1.732050807568877],
    [-0.707106781186548,1.224744871391589,-1.732050807568877],
    [-0.707106781186548,1.224744871391589,1.732050807568877],
    [-0.707106781186548,2.041241452319315,0.577350269189626],
    [0.707106781186548,-2.041241452319315,-0.577350269189626],
    [0.707106781186548,-1.224744871391589,-1.732050807568877],
    [0.707106781186548,-1.224744871391589,1.732050807568877],
    [0.707106781186548,1.224744871391589,-1.732050807568877],
    [0.707106781186548,1.224744871391589,1.732050807568877],
    [0.707106781186548,2.041241452319315,0.577350269189626],
    [1.414213562373095,-1.632993161855452,0.577350269189626],
    [1.414213562373095,0,-1.732050807568877],
    [1.414213562373095,0,1.732050807568877],
    [1.414213562373095,1.632993161855452,-0.577350269189626],
    [2.121320343559642,-0.408248290463863,0.577350269189626],
    [2.121320343559642,0.408248290463863,-0.577350269189626]
];

// Faces reordered so that face indices follow the chromatic path
// Face 0 = C4, Face 1 = C#4, Face 2 = D4, etc.
// Original indices: [7, 11, 13, 12, 4, 2, 0, 1, 6, 3, 5, 9, 10, 8]
const PERMUTAHEDRON_FACES = [
    [4,0,2,8],              // Face 0 (was 7) - C4
    [10,11,5,1,0,4],        // Face 1 (was 11) - C#4
    [10,16,17,11],          // Face 2 (was 13) - D4
    [10,4,8,14,20,16],      // Face 3 (was 12) - D#4
    [20,14,18,22],          // Face 4 (was 4) - E4
    [18,14,8,2,6,12],       // Face 5 (was 2) - F4
    [7,13,12,6],            // Face 6 (was 0) - F#4
    [2,0,1,3,7,6],          // Face 7 (was 1) - G4
    [5,9,3,1],              // Face 8 (was 6) - G#4
    [19,13,7,3,9,15],       // Face 9 (was 3) - A4
    [23,22,18,12,13,19],    // Face 10 (was 5) - A#4
    [21,23,19,15],          // Face 11 (was 9) - B4
    [21,15,9,5,11,17],      // Face 12 (was 10) - C5
    [21,17,16,20,22,23]     // Face 13 (was 8) - C#5
];

const PERMUTAHEDRON_EDGES = [
    [7,13], [12,13], [6,12], [6,7], [0,2], [0,1], [1,3], [3,7],
    [2,6], [14,18], [8,14], [2,8], [12,18], [13,19], [3,9], [9,15],
    [15,19], [14,20], [18,22], [20,22], [22,23], [19,23], [5,9], [1,5],
    [0,4], [4,8], [17,21], [16,17], [16,20], [21,23], [15,21], [5,11],
    [11,17], [10,11], [4,10], [10,16]
];

// Colors for each face (reordered to match new face ordering)
// Original order: [7, 11, 13, 12, 4, 2, 0, 1, 6, 3, 5, 9, 10, 8]
const FACE_COLORS = [
    [0.5, 0.0, 1.0],  // purple (was face 7) - C4
    [0.0, 0.5, 1.0],  // sky blue (was face 11) - C#4
    [0.5, 1.0, 0.5],  // light green (was face 13) - D4
    [1.0, 0.5, 0.5],  // light red (was face 12) - D#4
    [1.0, 0.0, 1.0],  // magenta (was face 4) - E4
    [0.0, 0.0, 1.0],  // blue (was face 2) - F4
    [1.0, 0.0, 0.0],  // red (was face 0) - F#4
    [0.0, 1.0, 0.0],  // green (was face 1) - G4
    [1.0, 0.5, 0.0],  // orange (was face 6) - G#4
    [1.0, 1.0, 0.0],  // yellow (was face 3) - A4
    [0.0, 1.0, 1.0],  // cyan (was face 5) - A#4
    [1.0, 0.0, 0.5],  // rose (was face 9) - B4
    [0.5, 1.0, 0.0],  // lime (was face 10) - C5
    [0.0, 1.0, 0.5],  // spring green (was face 8) - C#5
];

// Face state tracking
const faceStates = new Array(PERMUTAHEDRON_FACES.length).fill(false);
let lastToggleTime = 0;

// abcjs synth setup
let synthControl = null;
let currentAbcString = '';

// Chromatic note frequencies (C4 to C#5)
const CHROMATIC_FREQUENCIES = [
    261.63, // C4
    277.18, // C#4
    293.66, // D4
    311.13, // D#4
    329.63, // E4
    349.23, // F4
    369.99, // F#4
    392.00, // G4
    415.30, // G#4
    440.00, // A4
    466.16, // A#4
    493.88, // B4
    523.25, // C5
    554.37  // C#5
];

// Path through adjacent faces - now simply sequential since faces are reordered
// Face 0(C4) -> 1(C#4) -> 2(D4) -> 3(D#4) -> 4(E4) -> 5(F4) -> 6(F#4)
// -> 7(G4) -> 8(G#4) -> 9(A4) -> 10(A#4) -> 11(B4) -> 12(C5) -> 13(C#5)
const FACE_PATH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// Note frequencies - will be dynamically set when song loads
const NOTE_FREQUENCIES = new Array(14).fill(0);

// Music code moved to music.js
// Expose faceStates and updateFaceColors to music.js
window.faceStates = faceStates;
window.updateFaceColors = updateFaceColors;

// This conversion now happens inside loadSong after parsing

// Vertex shader
const vertexShaderSource = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec3 aColor;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vNormal;
out vec3 vWorldPos;
out vec3 vColor;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = mat3(uModel) * aNormal;
    vColor = aColor;
    gl_Position = uProjection * uView * worldPos;
}
`;

// Fragment shader
const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec3 vColor;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
    float diff = max(dot(normal, lightDir), 0.0);

    // Apply shading to the color
    vec3 color = vColor * (0.3 + 0.7 * diff);

    // Make faces semi-transparent
    float alpha = 0.7;

    // If face is black (off), make it more transparent
    float brightness = (vColor.r + vColor.g + vColor.b) / 3.0;
    if (brightness < 0.01) {
        alpha = 0.2;
    }

    fragColor = vec4(color, alpha);
}
`;

// Edge shader
const edgeVertexShaderSource = `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPos;
}
`;

const edgeFragmentShaderSource = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

// Compile shader
function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

// Create program
function createProgram(vsSource, fsSource) {
    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

const program = createProgram(vertexShaderSource, fragmentShaderSource);
const edgeProgram = createProgram(edgeVertexShaderSource, edgeFragmentShaderSource);

// Build geometry
function buildPermutahedron() {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    const faceInfo = [];

    PERMUTAHEDRON_FACES.forEach((face) => {
        const baseIndex = positions.length / 3;
        const startVertex = positions.length / 3;

        // Calculate face normal
        const v0 = PERMUTAHEDRON_VERTICES[face[0]];
        const v1 = PERMUTAHEDRON_VERTICES[face[1]];
        const v2 = PERMUTAHEDRON_VERTICES[face[2]];

        const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const normal = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];

        // Get face color (initially black - off state)
        const faceColor = [0, 0, 0];

        face.forEach(vertexIndex => {
            const vertex = PERMUTAHEDRON_VERTICES[vertexIndex];
            positions.push(vertex[0], vertex[1], vertex[2]);
            normals.push(...normal);
            colors.push(...faceColor);
        });

        for (let i = 1; i < face.length - 1; i++) {
            indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
        }

        // Store face info for updating colors
        faceInfo.push({
            startVertex: startVertex,
            vertexCount: face.length
        });
    });

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices),
        faceInfo: faceInfo
    };
}

const geometry = buildPermutahedron();

// Create VAO for faces
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const posBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

const colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, geometry.colors, gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

gl.bindVertexArray(null);

// Create edge geometry
function buildEdges() {
    const positions = [];

    PERMUTAHEDRON_EDGES.forEach(([i1, i2]) => {
        const v1 = PERMUTAHEDRON_VERTICES[i1];
        const v2 = PERMUTAHEDRON_VERTICES[i2];
        positions.push(v1[0], v1[1], v1[2]);
        positions.push(v2[0], v2[1], v2[2]);
    });

    return {
        positions: new Float32Array(positions),
        count: PERMUTAHEDRON_EDGES.length * 2
    };
}

const edgeGeometry = buildEdges();

const edgeVAO = gl.createVertexArray();
gl.bindVertexArray(edgeVAO);

const edgePosBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, edgePosBuffer);
gl.bufferData(gl.ARRAY_BUFFER, edgeGeometry.positions, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

gl.bindVertexArray(null);

// Update face colors based on state
function updateFaceColors() {
    const colors = new Float32Array(geometry.colors.length);

    geometry.faceInfo.forEach((info, faceIndex) => {
        const isOn = faceStates[faceIndex];
        const color = isOn ? FACE_COLORS[faceIndex] : [0, 0, 0];

        for (let i = 0; i < info.vertexCount; i++) {
            const offset = (info.startVertex + i) * 3;
            colors[offset] = color[0];
            colors[offset + 1] = color[1];
            colors[offset + 2] = color[2];
        }
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

// No longer need custom playback - abcjs handles everything!

// Camera state (spherical coordinates)
// Zoom out 40% more on mobile (radius 40% larger)
const isMobile = window.innerWidth <= 768;
const spherical = {
    radius: isMobile ? 11.2 : 8,
    theta: Math.PI / 4,
    phi: Math.PI / 3
};

let sphericalDelta = { radius: 1 };

// Mouse/touch interaction
let isDragging = false;
let lastX = 0;
let lastY = 0;
let lastTime = 0;
let velocityTheta = 0;
let velocityPhi = 0;
let touchStartDist = 0;

// Matrix math
function mat4Perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ]);
}

function mat4LookAt(eye, target, up) {
    const zAxis = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
    let len = Math.sqrt(zAxis[0] * zAxis[0] + zAxis[1] * zAxis[1] + zAxis[2] * zAxis[2]);
    zAxis[0] /= len; zAxis[1] /= len; zAxis[2] /= len;

    const xAxis = [
        up[1] * zAxis[2] - up[2] * zAxis[1],
        up[2] * zAxis[0] - up[0] * zAxis[2],
        up[0] * zAxis[1] - up[1] * zAxis[0]
    ];
    len = Math.sqrt(xAxis[0] * xAxis[0] + xAxis[1] * xAxis[1] + xAxis[2] * xAxis[2]);
    xAxis[0] /= len; xAxis[1] /= len; xAxis[2] /= len;

    const yAxis = [
        zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
        zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
        zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0]
    ];

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]),
        -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]),
        -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]),
        1
    ]);
}

// Event handlers
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    lastTime = performance.now();
    velocityTheta = 0;
    velocityPhi = 0;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const currentTime = performance.now();
    const deltaTime = Math.max(1, currentTime - lastTime);

    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;

    const sensitivity = Math.PI / 450 * 0.5;
    const deltaTheta = -deltaX * sensitivity;
    const deltaPhi = -deltaY * sensitivity;

    spherical.theta += deltaTheta;
    spherical.phi += deltaPhi;
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

    velocityTheta = deltaTheta / deltaTime * 16;
    velocityPhi = deltaPhi / deltaTime * 16;

    lastX = e.clientX;
    lastY = e.clientY;
    lastTime = currentTime;
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scale = Math.pow(0.95, Math.abs(e.deltaY * 0.01));
    if (e.deltaY < 0) {
        sphericalDelta.radius /= scale;
    } else {
        sphericalDelta.radius *= scale;
    }
}, { passive: false });

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touches = Array.from(e.touches);

    if (touches.length === 1) {
        isDragging = true;
        lastX = touches[0].clientX;
        lastY = touches[0].clientY;
        lastTime = performance.now();
        velocityTheta = 0;
        velocityPhi = 0;
    } else if (touches.length === 2) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touches = Array.from(e.touches);

    if (touches.length === 1 && isDragging) {
        const currentTime = performance.now();
        const deltaTime = Math.max(1, currentTime - lastTime);

        const deltaX = touches[0].clientX - lastX;
        const deltaY = touches[0].clientY - lastY;

        const sensitivity = Math.PI / 450 * 0.5;
        const deltaTheta = -deltaX * sensitivity;
        const deltaPhi = -deltaY * sensitivity;

        spherical.theta += deltaTheta;
        spherical.phi += deltaPhi;
        spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

        velocityTheta = deltaTheta / deltaTime * 16;
        velocityPhi = deltaPhi / deltaTime * 16;

        lastX = touches[0].clientX;
        lastY = touches[0].clientY;
        lastTime = currentTime;
    } else if (touches.length === 2 && touchStartDist > 0) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (touchStartDist > 0) {
            const scale = touchStartDist / distance;
            sphericalDelta.radius *= scale;
            touchStartDist = distance;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', () => {
    isDragging = false;
    touchStartDist = 0;
});

// Resize canvas
function resizeCanvas() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
}

// Render loop
function render(currentTime) {
    resizeCanvas();

    // Visual rendering only - abcjs handles audio timing

    // Update camera
    if (!isDragging) {
        spherical.theta += velocityTheta;
        spherical.phi += velocityPhi;
        spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

        velocityTheta *= 0.92;
        velocityPhi *= 0.92;

        if (Math.abs(velocityTheta) < 0.0001) velocityTheta = 0;
        if (Math.abs(velocityPhi) < 0.0001) velocityPhi = 0;
    }

    spherical.radius *= sphericalDelta.radius;
    sphericalDelta.radius = 1;
    spherical.radius = Math.max(1, Math.min(50, spherical.radius));

    const projection = mat4Perspective(45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 100);

    const camX = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    const camY = spherical.radius * Math.cos(spherical.phi);
    const camZ = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

    const view = mat4LookAt([camX, camY, camZ], [0, 0, 0], [0, 1, 0]);
    const model = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false); // Allow transparency to work properly
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw faces
    gl.useProgram(program);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uView'), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, model);

    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    // Draw edges
    gl.useProgram(edgeProgram);

    gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, 'uView'), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, 'uModel'), false, model);

    gl.bindVertexArray(edgeVAO);
    gl.depthMask(true); // Re-enable depth writing for edges
    gl.drawArrays(gl.LINES, 0, edgeGeometry.count);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
