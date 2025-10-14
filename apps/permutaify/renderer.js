/**
 * Renderer Module
 * Handles WebGL2 rendering, voxelization computation, and drawing
 */

// --- Utility functions ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = v => {
  const L = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / L, v[1] / L, v[2] / L];
};

// === Ray-triangle intersection ===
function rayTriangleIntersect(orig, dir, v0, v1, v2) {
  const EPS = 1e-6;
  const e1 = sub(v1, v0), e2 = sub(v2, v0);
  const h = cross(dir, e2);
  const a = dot(e1, h);
  if (a > -EPS && a < EPS) return null;
  const f = 1 / a;
  const s = sub(orig, v0);
  const u = f * dot(s, h);
  if (u < 0 || u > 1) return null;
  const q = cross(s, e1);
  const v = f * dot(dir, q);
  if (v < 0 || u + v > 1) return null;
  const t = f * dot(e2, q);
  return t > EPS ? t : null;
}

// === Spatial Grid for acceleration ===
function buildSpatialGrid(model, cellSize) {
  const grid = new Map();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const v of model.vertices) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i]);
      max[i] = Math.max(max[i], v[i]);
    }
  }

  const hash = (x, y, z) => `${x}|${y}|${z}`;
  const toCell = (x, y, z) => [
    Math.floor(x / cellSize),
    Math.floor(y / cellSize),
    Math.floor(z / cellSize)
  ];

  for (let faceIdx = 0; faceIdx < model.faces.length; faceIdx++) {
    const face = model.faces[faceIdx];
    const v0 = model.vertices[face[0]];
    const v1 = model.vertices[face[1]];
    const v2 = model.vertices[face[2]];

    const tMin = [
      Math.min(v0[0], v1[0], v2[0]),
      Math.min(v0[1], v1[1], v2[1]),
      Math.min(v0[2], v1[2], v2[2])
    ];
    const tMax = [
      Math.max(v0[0], v1[0], v2[0]),
      Math.max(v0[1], v1[1], v2[1]),
      Math.max(v0[2], v1[2], v2[2])
    ];

    const cMin = toCell(tMin[0], tMin[1], tMin[2]);
    const cMax = toCell(tMax[0], tMax[1], tMax[2]);

    for (let cx = cMin[0]; cx <= cMax[0]; cx++) {
      for (let cy = cMin[1]; cy <= cMax[1]; cy++) {
        for (let cz = cMin[2]; cz <= cMax[2]; cz++) {
          const key = hash(cx, cy, cz);
          if (!grid.has(key)) {
            grid.set(key, []);
          }
          grid.get(key).push(faceIdx);
        }
      }
    }
  }

  return { grid, cellSize, hash, toCell };
}

// === Point-in-mesh test (with spatial acceleration) ===
function pointInMeshAccelerated(p, model, spatialGrid) {
  const dir = normalize([1, 0.123456789, 0.987654321]);
  const cell = spatialGrid.toCell(p[0], p[1], p[2]);

  const checkedFaces = new Set();
  let count = 0;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = spatialGrid.hash(cell[0] + dx, cell[1] + dy, cell[2] + dz);
        const faceIndices = spatialGrid.grid.get(key);

        if (faceIndices) {
          for (const faceIdx of faceIndices) {
            if (checkedFaces.has(faceIdx)) continue;
            checkedFaces.add(faceIdx);

            const face = model.faces[faceIdx];
            const t = rayTriangleIntersect(
              p, dir,
              model.vertices[face[0]],
              model.vertices[face[1]],
              model.vertices[face[2]]
            );
            if (t !== null) count++;
          }
        }
      }
    }
  }

  for (let faceIdx = 0; faceIdx < model.faces.length; faceIdx++) {
    if (checkedFaces.has(faceIdx)) continue;

    const face = model.faces[faceIdx];
    const t = rayTriangleIntersect(
      p, dir,
      model.vertices[face[0]],
      model.vertices[face[1]],
      model.vertices[face[2]]
    );
    if (t !== null) count++;
  }

  return (count % 2) === 1;
}

// === Voxelization (BCC lattice with spatial acceleration) ===
const CELL_R = Math.sqrt(1.25);

export function voxelizeModel(model) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const v of model.vertices) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i]);
      max[i] = Math.max(max[i], v[i]);
    }
  }

  console.log("Building spatial grid...");
  const gridStart = performance.now();
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const cellSize = extent / 8;
  const spatialGrid = buildSpatialGrid(model, cellSize);
  console.log(`Grid built: ${spatialGrid.grid.size} cells, ${(performance.now() - gridStart).toFixed(1)} ms`);

  const vox = [];
  const set = new Set();

  console.log("Voxelizing within", min, max);
  const start = performance.now();

  for (let xo = 0; xo < 2; xo++) {
    for (let yo = 0; yo < 2; yo++) {
      for (let zo = 0; zo < 2; zo++) {
        if ((xo + yo + zo) % 2 !== 0) continue;

        for (let x = min[0] - 1 + xo; x <= max[0] + 1; x += 2) {
          for (let y = min[1] - 1 + yo; y <= max[1] + 1; y += 2) {
            for (let z = min[2] - 1 + zo; z <= max[2] + 1; z += 2) {
              const key = `${x},${y},${z}`;
              if (!set.has(key) && pointInMeshAccelerated([x, y, z], model, spatialGrid)) {
                set.add(key);
                vox.push(x, y, z);
              }
            }
          }
        }
      }
    }
  }

  const elapsed = (performance.now() - start).toFixed(1);
  console.log(`Voxelization complete: ${vox.length / 3} voxels, ${elapsed} ms`);

  // Return as Int16Array (positions are integers, saves memory)
  return { voxels: new Int16Array(vox), time: elapsed };
}

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
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error(gl.getShaderInfoLog(s));
  return s;
}

// === Matrix functions ===
function perspective(fov, asp, n, f) {
  const t = Math.tan(fov / 2), r = t * asp;
  const a = 1 / t, b = 1 / (n - f);
  return new Float32Array([a / asp, 0, 0, 0, 0, a, 0, 0, 0, 0, (n + f) * b, -1, 0, 0, 2 * n * f * b, 0]);
}

function lookAt(e, c, u) {
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

/**
 * Renderer class - manages WebGL2 rendering
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2');

    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }

    console.log("WebGL2 initialized with UBO support");

    this.setupShaders();
    this.setupBuffers();
    this.setupCamera();

    this.instPos = new Int16Array();
    this.instDel = new Float32Array();
    this.time = 0;
    this.vao = null;

    // Bind resize event
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Start render loop
    this.render();
  }

  setupShaders() {
    const gl = this.gl;

    const vsh = compile(gl, `#version 300 es
      in vec3 aPosition;
      in ivec3 aInstancePosition;  // Integer position (saves memory!)
      in float aDelay;
      in float aType;

      // Uniform Buffer Object for scene data
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

      vec3 hsv2rgb(vec3 c){
        vec4 K=vec4(1.,2./3.,1./3.,3.);
        vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);
        return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);
      }

      void main(){
        float d=uTime-aDelay;
        float f=clamp(d/0.8,0.,1.);
        float eased=1.-pow(1.-f,3.);

        // Convert integer position to float
        vec3 pos = vec3(aInstancePosition);
        pos.y += 150.*(1.-eased);

        vec3 world=aPosition+pos;
        vec3 normal=normalize(world);
        vec3 light=normalize(vec3(1.,1.,1.));
        float diff=max(dot(normal,light),0.4);
        float hue=clamp((float(aInstancePosition.y)+15.)/30.,0.,1.)*0.833;
        vColor=hsv2rgb(vec3(hue,1.,1.))*diff;
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

    this.prog = gl.createProgram();
    gl.attachShader(this.prog, vsh);
    gl.attachShader(this.prog, fsh);
    gl.linkProgram(this.prog);

    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.prog));
    }

    gl.useProgram(this.prog);

    // Setup UBO
    const sceneDataBlockIndex = gl.getUniformBlockIndex(this.prog, 'SceneData');
    gl.uniformBlockBinding(this.prog, sceneDataBlockIndex, 0);

    this.uboBuffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.uboBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, 144, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.uboBuffer);

    console.log("UBO configured for scene data");

    // Get attribute locations
    this.aPos = gl.getAttribLocation(this.prog, 'aPosition');
    this.aInstPos = gl.getAttribLocation(this.prog, 'aInstancePosition');
    this.aDelay = gl.getAttribLocation(this.prog, 'aDelay');
    this.aType = gl.getAttribLocation(this.prog, 'aType');
  }

  setupBuffers() {
    const gl = this.gl;
    this.bufVerts = gl.createBuffer();
    this.bufType = gl.createBuffer();
    this.bufIdx = gl.createBuffer();
    this.bufInst = gl.createBuffer();
    this.bufDelay = gl.createBuffer();
  }

  setupCamera() {
    this.camDist = 54;
    this.minDist = 10;
    this.maxDist = 200;

    // Setup camera controls
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

    // Calculate memory usage
    const posBytes = this.instPos.byteLength;
    const delayBytes = this.instDel.byteLength;
    const totalBytes = posBytes + delayBytes;
    const totalKB = (totalBytes / 1024).toFixed(1);
    console.log(`Memory usage: Position=${posBytes}B (Int16), Delay=${delayBytes}B (Float32), Total=${totalBytes}B`);

    // Create or reuse VAO
    if (!this.vao) {
      this.vao = gl.createVertexArray();
    }

    gl.bindVertexArray(this.vao);

    // Setup geometry vertices (shared across all instances)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVerts);
    gl.bufferData(gl.ARRAY_BUFFER, combinedVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aPos, 0);

    // Setup type buffer (0=face, 1=edge)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufType);
    gl.bufferData(gl.ARRAY_BUFFER, combinedTypes, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aType);
    gl.vertexAttribPointer(this.aType, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aType, 0);

    // Setup instance position buffer (INTEGER type for memory efficiency)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInst);
    gl.bufferData(gl.ARRAY_BUFFER, this.instPos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aInstPos);
    gl.vertexAttribIPointer(this.aInstPos, 3, gl.SHORT, 0, 0);
    gl.vertexAttribDivisor(this.aInstPos, 1);

    // Setup delay buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDelay);
    gl.bufferData(gl.ARRAY_BUFFER, this.instDel, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aDelay);
    gl.vertexAttribPointer(this.aDelay, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.aDelay, 1);

    // Setup index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, permutahedronIndices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    console.log("VAO configured with", vox.length / 3, "instances using Int16Array for positions");

    return { totalKB, count: vox.length / 3 };
  }

  restartAnimation() {
    this.time = 0;
  }

  render = () => {
    const gl = this.gl;

    this.time += 0.016;
    gl.clearColor(0.086, 0.086, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const camX = Math.cos(this.time * 0.3) * this.camDist;
    const camZ = Math.sin(this.time * 0.3) * this.camDist;
    const view = lookAt([camX, 10, camZ], [0, 0, 0], [0, 1, 0]);

    // Update UBO
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.uboBuffer);
    const uboData = new Float32Array(36);
    uboData.set(this.proj, 0);
    uboData.set(view, 16);
    uboData[32] = this.time;
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uboData);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    const count = this.instPos.length / 3;

    // Bind VAO and draw
    if (this.vao && count > 0) {
      gl.bindVertexArray(this.vao);

      // Draw faces
      gl.drawElementsInstanced(gl.TRIANGLES, permutahedronIndices.length, gl.UNSIGNED_SHORT, 0, count);

      // Draw edges
      const edgeOff = permutahedronVertices.length / 3;
      gl.drawArraysInstanced(gl.LINES, edgeOff, permutahedronEdges.length / 3, count);

      gl.bindVertexArray(null);
    }

    requestAnimationFrame(this.render);
  }
}

// === Model utilities ===
export function centerModel(model) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  model.vertices.forEach(v => {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i]);
      max[i] = Math.max(max[i], v[i]);
    }
  });

  const center = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2
  ];

  console.log(`Model bounds: min=${min}, max=${max}, center=${center}`);

  const centeredModel = { vertices: [], faces: model.faces };
  model.vertices.forEach(v => {
    centeredModel.vertices.push([
      v[0] - center[0],
      v[1] - center[1],
      v[2] - center[2]
    ]);
  });

  return centeredModel;
}

export function applyScale(model, scale) {
  const scaledModel = { vertices: [], faces: model.faces };
  model.vertices.forEach(v => {
    scaledModel.vertices.push([v[0] * scale, v[1] * scale, v[2] * scale]);
  });
  return scaledModel;
}
