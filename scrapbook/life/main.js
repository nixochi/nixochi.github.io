import { CONFIG } from './config.js';
import { createPermutahedron, createEdges } from './geometry.js';
import {
    simVertexShader,
    simFragmentShader,
    pickingVertexShader,
    pickingFragmentShader,
    displayVertexShader,
    displayFragmentShader,
    edgeVertexShader,
    edgeFragmentShader
} from './shaders.js';
import { mat4Perspective, mat4LookAt, mat4RotateY } from './matrix.js';
import { createProgram, createTexture, createFramebuffer, setupVertexArray } from './webgl-utils.js';
import { InteractionHandler } from './interaction.js';

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    console.error('WebGL2 not supported');
}

const simProgram = createProgram(gl, simVertexShader, simFragmentShader);
const displayProgram = createProgram(gl, displayVertexShader, displayFragmentShader);
const pickingProgram = createProgram(gl, pickingVertexShader, pickingFragmentShader);
const edgeProgram = createProgram(gl, edgeVertexShader, edgeFragmentShader);

const permutahedronGeometry = createPermutahedron();
const permutahedronVAO = setupVertexArray(gl, permutahedronGeometry.positions, permutahedronGeometry.indices);

const edgeGeometry = createEdges();
const edgeVAO = setupVertexArray(gl, edgeGeometry.positions);

let textureA = createTexture(gl, CONFIG.textureWidth, CONFIG.textureHeight);
let textureB = createTexture(gl, CONFIG.textureWidth, CONFIG.textureHeight);

let fboA = createFramebuffer(gl, textureA);
let fboB = createFramebuffer(gl, textureB);

let current = { texture: textureA, fbo: fboA };
let next = { texture: textureB, fbo: fboB };

const pickingTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, pickingTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

const pickingDepth = gl.createRenderbuffer();
gl.bindRenderbuffer(gl.RENDERBUFFER, pickingDepth);
gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 1, 1);

const pickingFBO = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFBO);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickingTexture, 0);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickingDepth);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const interactionHandler = new InteractionHandler(
    canvas,
    gl,
    pickingProgram,
    pickingFBO,
    permutahedronVAO,
    permutahedronGeometry.indices.length
);

const quadVertices = new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0
]);

const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

let rotationY = 0;

function resizeCanvas() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
}

function render(time) {
    resizeCanvas();

    rotationY = time * 0.0002;

    const adjustedCameraDistance = interactionHandler.isMobile
        ? CONFIG.cameraDistance * CONFIG.mobileZoomFactor
        : CONFIG.cameraDistance;
    const projection = mat4Perspective(45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 100);
    const view = mat4LookAt([0, 0, adjustedCameraDistance], [0, 0, 0], [0, 1, 0]);
    const model = mat4RotateY(rotationY);

    interactionHandler.updatePickingTexture(pickingTexture, pickingDepth);
    interactionHandler.readUVAtMouse(projection, view, model);

    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    gl.viewport(0, 0, CONFIG.textureWidth, CONFIG.textureHeight);

    gl.useProgram(simProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.uniform1i(gl.getUniformLocation(simProgram, 'uPrevState'), 0);

    gl.uniform2f(gl.getUniformLocation(simProgram, 'uResolution'), CONFIG.textureWidth, CONFIG.textureHeight);
    gl.uniform2f(gl.getUniformLocation(simProgram, 'uMouseUV'), interactionHandler.mouseUVX, interactionHandler.mouseUVY);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uMouseRadius'), CONFIG.brushRadius);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uExplosionRadius'), CONFIG.explosionRadius);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uHasHover'), interactionHandler.hasHover);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uMouseDown'), interactionHandler.mouseDown ? 1.0 : 0.0);

    const simPosLoc = gl.getAttribLocation(simProgram, 'aPosition');
    gl.enableVertexAttribArray(simPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(simPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(displayProgram);

    gl.uniformMatrix4fv(gl.getUniformLocation(displayProgram, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(displayProgram, 'uView'), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(displayProgram, 'uModel'), false, model);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, next.texture);
    gl.uniform1i(gl.getUniformLocation(displayProgram, 'uTexture'), 0);

    gl.bindVertexArray(permutahedronVAO);
    gl.drawElements(gl.TRIANGLES, permutahedronGeometry.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.useProgram(edgeProgram);

    gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, 'uView'), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, 'uModel'), false, model);

    gl.bindVertexArray(edgeVAO);
    gl.drawArrays(gl.LINES, 0, edgeGeometry.count);
    gl.bindVertexArray(null);

    const temp = current;
    current = next;
    next = temp;

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
