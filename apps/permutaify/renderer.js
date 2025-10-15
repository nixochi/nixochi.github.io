/**
 * Renderer Module - WebGL2 Rendering
 */

// === Geometry (permutahedron) ===
const permutahedronVertices = new Float32Array([
  1, 0.5, 0, 1, -0.5, 0, -1, 0.5, 0, -1, -0.5, 0,
  1, 0, 0.5, 1, 0, -0.5, -1, 0, 0.5, -1, 0, -0.5,
  0.5, 1, 0, 0.5, -1, 0, -0.5, 1, 0, -0.5, -1, 0,
  0.5, 0, 1, 0.5, 0, -1, -0.5, 0, 1, -0.5, 0, -1,
  0, 1, 0.5, 0, 1, -0.5, 0, -1, 0.5, 0, -1, -0.5,
  0, 0.5, 1, 0, 0.5, -1, 0, -0.5, 1, 0, -0.5, -1
]);

const permutahedronFaces = [
  [15, 21, 13, 23], [12, 20, 14, 22], [5, 1, 9, 19, 23, 13], [17, 8, 0, 5, 13, 21],
  [11, 3, 7, 15, 23, 19], [11, 19, 9, 18], [6, 3, 11, 18, 22, 14], [6, 2, 7, 3],
  [4, 12, 22, 18, 9, 1], [4, 1, 5, 0], [10, 17, 21, 15, 7, 2], [16, 8, 17, 10],
  [16, 10, 2, 6, 14, 20], [16, 20, 12, 4, 0, 8]
];

function triangulate(faces) {
  const idx = [];
  faces.forEach(f => {
    for (let i = 1; i < f.length - 1; i++)
      idx.push(f[0], f[i], f[i + 1]);
  });
  return new Uint16Array(idx);
}

const permutahedronIndices = triangulate(permutahedronFaces);

function generateEdges(faces) {
  const edges = new Set(), v = permutahedronVertices;
  faces.forEach(face => {
    for (let i = 0; i < face.length; i++) {
      const a = face[i], b = face[(i + 1) % face.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edges.add(key);
    }
  });
  const eVerts = [];
  edges.forEach(k => {
    const [a, b] = k.split('-').map(Number);
    eVerts.push(
      v[a * 3], v[a * 3 + 1], v[a * 3 + 2],
      v[b * 3], v[b * 3 + 1], v[b * 3 + 2]
    );
  });
  return new Float32Array(eVerts);
}

const permutahedronEdges = generateEdges(permutahedronFaces);
const combinedVerts = new Float32Array([...permutahedronVertices, ...permutahedronEdges]);
const combinedTypes = new Float32Array(
  Array(permutahedronVertices.length / 3).fill(0).concat(
    Array(permutahedronEdges.length / 3).fill(1)
  )
);

// === Shader compilation ===
function compile(gl, src, type) {
  const s = gl.createShader(type);
  if (!s) {
    console.error('Failed to create shader. Type:', type);
    console.error('GL context lost?', gl.isContextLost());
    return null;
  }
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

// === Matrix functions ===
function perspective(fov, asp, n, f) {
  const t = Math.tan(fov / 2), r = t * asp;
  const a = 1 / t, b = 1 / (n - f);
  return new Float32Array([a / asp, 0, 0, 0, 0, a, 0, 0, 0, 0, (n + f) * b, -1, 0, 0, 2 * n * f * b, 0]);
}

function lookAt(e, c, u) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = v => {
    const L = Math.hypot(v[0], v[1], v[2]);
    return L > 0 ? [v[0] / L, v[1] / L, v[2] / L] : [0, 0, 0];
  };

  const z = normalize(sub(e, c)), x = normalize(cross(u, z)), y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, e), -dot(y, e), -dot(z, e), 1
  ]);
}

// === Delay calculation for animation ===
function calcDelays(pos) {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    minY = Math.min(minY, pos[i]);
    maxY = Math.max(maxY, pos[i]);
  }

  const d = [];
  const yRange = maxY - minY || 1;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const normalizedY = (y - minY) / yRange;
    let delay = normalizedY * 2.5 + Math.sin(x * 12.3 + z * 45.6) * 0.3 + Math.cos(x * 23.4 + y * 34.5) * 0.2;
    d.push(delay);
  }
  return new Float32Array(d);
}

// === Pre-compute RGB colors from hue (CPU-side optimization) ===
function calcColors(pos) {
  const colors = [];
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    // Same hue calculation as in shader
    const hue = Math.max(0, Math.min(1, (y + 15) / 30)) * 0.833;

    // Simple HSV to RGB conversion (H, 1, 1)
    const h6 = hue * 6;
    const sector = Math.floor(h6);
    const frac = h6 - sector;

    let r, g, b;
    switch (sector % 6) {
      case 0: r = 1; g = frac; b = 0; break;
      case 1: r = 1 - frac; g = 1; b = 0; break;
      case 2: r = 0; g = 1; b = frac; break;
      case 3: r = 0; g = 1 - frac; b = 1; break;
      case 4: r = frac; g = 0; b = 1; break;
      case 5: r = 1; g = 0; b = 1 - frac; break;
      default: r = 0; g = 0; b = 0; break;
    }

    colors.push(r, g, b);
  }
  return new Float32Array(colors);
}

/**
 * Renderer class - manages WebGL2 rendering
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Add context loss handlers
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.error('WebGL context lost!', event);
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
    }, false);

    // Get WebGL2 context
    this.gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance'
    });

    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }

    this.loseContextExt = this.gl.getExtension('WEBGL_lose_context');

    console.log("WebGL2 context obtained");

    this.setupShaders();
    this.setupBuffers();
    this.setupCamera();

    this.instPos = new Int16Array();
    this.instDel = new Float32Array();
    this.time = 0;
    this.vao = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.render();
  }

  setupShaders() {
    const gl = this.gl;

    const vsh = compile(gl, `#version 300 es
      in vec3 aPosition;
      in ivec3 aInstancePosition;
      in float aDelay;
      in float aType;
      in vec3 aBaseColor;

      layout(std140) uniform SceneData {
        mat4 uProjection;
        mat4 uView;
        float uTime;
        float _padding1;
        float _padding2;
        float _padding3;
      };

      out vec3 vColor;
      out float vType;

      void main(){
        float d=uTime-aDelay;
        float f=clamp(d/0.8,0.,1.);
        float eased=1.-pow(1.-f,3.);

        vec3 pos = vec3(aInstancePosition);
        pos.y += 120.*(1.-eased);

        vec3 world=aPosition+pos;

        // Simple ambient + directional lighting
        vec3 normal=normalize(aPosition); // Use base geometry normal
        vec3 lightDir=vec3(0.5,0.8,0.3); // Soft top-front lighting
        float diffuse=max(dot(normal,lightDir),0.0)*0.5;
        float ambient=0.6;

        vColor=aBaseColor*(ambient+diffuse);
        vType=aType;
        gl_Position=uProjection*uView*vec4(world,1.);
      }`, gl.VERTEX_SHADER);

    const fsh = compile(gl, `#version 300 es
      precision mediump float;
      in vec3 vColor;
      in float vType;
      out vec4 fragColor;
      void main(){
        fragColor=(vType>0.5)?vec4(0,0,0,1):vec4(vColor,1);
      }
    `, gl.FRAGMENT_SHADER);

    if (!vsh || !fsh) {
      throw new Error('Shader compilation failed');
    }

    this.prog = gl.createProgram();
    gl.attachShader(this.prog, vsh);
    gl.attachShader(this.prog, fsh);
    gl.linkProgram(this.prog);

    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.prog));
    }

    gl.useProgram(this.prog);

    const sceneDataBlockIndex = gl.getUniformBlockIndex(this.prog, 'SceneData');
    gl.uniformBlockBinding(this.prog, sceneDataBlockIndex, 0);

    this.uboBuffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.uboBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, 144, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.uboBuffer);

    this.aPos = gl.getAttribLocation(this.prog, 'aPosition');
    this.aInstPos = gl.getAttribLocation(this.prog, 'aInstancePosition');
    this.aDelay = gl.getAttribLocation(this.prog, 'aDelay');
    this.aType = gl.getAttribLocation(this.prog, 'aType');
    this.aBaseColor = gl.getAttribLocation(this.prog, 'aBaseColor');
  }

  setupBuffers() {
    const gl = this.gl;
    this.bufVerts = gl.createBuffer();
    this.bufType = gl.createBuffer();
    this.bufIdx = gl.createBuffer();
    this.bufInst = gl.createBuffer();
    this.bufDelay = gl.createBuffer();
    this.bufColor = gl.createBuffer();
  }

  setupCamera() {
    this.camDist = 54;
    this.minDist = 10;
    this.maxDist = 200;

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.camDist += e.deltaY * 0.05;
      this.camDist = Math.max(this.minDist, Math.min(this.maxDist, this.camDist));
    }, { passive: false });

    let touchDist = null;
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && touchDist !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const delta = (touchDist - newDist) * 0.5;
        this.camDist += delta;
        this.camDist = Math.max(this.minDist, Math.min(this.maxDist, this.camDist));
        touchDist = newDist;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      if (e.touches.length < 2) touchDist = null;
    }, { passive: true });
  }

  resize() {
    this.canvas.width = innerWidth;
    this.canvas.height = innerHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.proj = perspective(Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 1000);
  }

  updateInstances(vox) {
    const gl = this.gl;

    this.instPos = vox;
    this.instDel = calcDelays(vox);
    this.instColors = calcColors(vox);

    const posBytes = this.instPos.byteLength;
    const delayBytes = this.instDel.byteLength;
    const colorBytes = this.instColors.byteLength;
    const totalBytes = posBytes + delayBytes + colorBytes;
    const totalKB = (totalBytes / 1024).toFixed(1);

    if (!this.vao) {
      this.vao = gl.createVertexArray();
    }

    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVerts);
    gl.bufferData(gl.ARRAY_BUFFER, combinedVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aPos, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufType);
    gl.bufferData(gl.ARRAY_BUFFER, combinedTypes, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aType);
    gl.vertexAttribPointer(this.aType, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aType, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInst);
    gl.bufferData(gl.ARRAY_BUFFER, this.instPos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aInstPos);
    gl.vertexAttribIPointer(this.aInstPos, 3, gl.SHORT, 0, 0);
    gl.vertexAttribDivisor(this.aInstPos, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDelay);
    gl.bufferData(gl.ARRAY_BUFFER, this.instDel, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aDelay);
    gl.vertexAttribPointer(this.aDelay, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aDelay, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufColor);
    gl.bufferData(gl.ARRAY_BUFFER, this.instColors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aBaseColor);
    gl.vertexAttribPointer(this.aBaseColor, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aBaseColor, 1);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, permutahedronIndices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return { totalKB, count: vox.length / 3 };
  }

  restartAnimation() {
    this.time = 0;
  }

  render = () => {
    const gl = this.gl;

    // Re-bind our shader program (in case voxelizer or other code unbinds it)
    gl.useProgram(this.prog);

    this.time += 0.016;
    gl.clearColor(0.086, 0.086, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const camX = Math.cos(this.time * 0.3) * this.camDist;
    const camZ = Math.sin(this.time * 0.3) * this.camDist;
    const view = lookAt([camX, 10, camZ], [0, 0, 0], [0, 1, 0]);

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.uboBuffer);
    const uboData = new Float32Array(36);
    uboData.set(this.proj, 0);
    uboData.set(view, 16);
    uboData[32] = this.time;
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uboData);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    const count = this.instPos.length / 3;

    if (this.vao && count > 0) {
      gl.bindVertexArray(this.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, permutahedronIndices.length, gl.UNSIGNED_SHORT, 0, count);
      const edgeOff = permutahedronVertices.length / 3;
      gl.drawArraysInstanced(gl.LINES, edgeOff, permutahedronEdges.length / 3, count);
      gl.bindVertexArray(null);
    }

    requestAnimationFrame(this.render);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;

    console.log('Disposing Renderer');

    // Unbind everything
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);

    // Delete resources
    if (this.bufVerts) gl.deleteBuffer(this.bufVerts);
    if (this.bufType) gl.deleteBuffer(this.bufType);
    if (this.bufIdx) gl.deleteBuffer(this.bufIdx);
    if (this.bufInst) gl.deleteBuffer(this.bufInst);
    if (this.bufDelay) gl.deleteBuffer(this.bufDelay);
    if (this.bufColor) gl.deleteBuffer(this.bufColor);
    if (this.uboBuffer) gl.deleteBuffer(this.uboBuffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.prog) gl.deleteProgram(this.prog);

    // Force context loss if extension available
    if (this.loseContextExt) {
      this.loseContextExt.loseContext();
    }

    // Null out references
    this.gl = null;
    this.loseContextExt = null;
    this.bufVerts = null;
    this.bufType = null;
    this.bufIdx = null;
    this.bufInst = null;
    this.bufDelay = null;
    this.bufColor = null;
    this.uboBuffer = null;
    this.vao = null;
    this.prog = null;
  }
}