// renderer.js - COMPLETE FILE WITH CHANGES
/**
 * Renderer Module - Transform Feedback GPU Voxelization (Texture-backed)
 * WebGL2-only. Uses a triangle RGBA32F texture + texelFetch in the vertex shader.
 * Transform Feedback captures (insideFlag, position) for each candidate voxel.
 *
 * Fixes:
 *  1) Deterministic edge rule to avoid double-counts on shared edges/vertices
 *  2) Ray origin nudge along ray to avoid "on-surface" self-intersections
 *  4) Adaptive EPS tied to model scale
 *  5) Context reuse to prevent context exhaustion
 *  6) Proper resource cleanup and disposal
 */

// --- Utility functions ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = v => {
  const L = Math.hypot(v[0], v[1], v[2]);
  return L > 0 ? [v[0] / L, v[1] / L, v[2] / L] : [0, 0, 0];
};

// === GPU Transform Feedback Voxelizer ===
class GPUVoxelizer {
  constructor(gl) {
    this.gl = gl;
    this.maxTriangles = 2048;
    this.loseContextExt = gl.getExtension('WEBGL_lose_context');
    console.log('GPUVoxelizer initialized with reusable context');
  }

  // Build RGBA32F 2D texture with layout: width=3 (v0,v1,v2), height=numTriangles, xyz in RGB
  _createTriangleTexture(tris) {
    const gl = this.gl;
    const numTris = tris.length;
    const width = 3, height = numTris;

    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < numTris; i++) {
      const [v0, v1, v2] = tris[i];
      const base = i * (width * 4);
      // texel (0,i) = v0
      data[base + 0] = v0[0]; data[base + 1] = v0[1]; data[base + 2] = v0[2]; data[base + 3] = 0;
      // texel (1,i) = v1
      data[base + 4] = v1[0]; data[base + 5] = v1[1]; data[base + 6] = v1[2]; data[base + 7] = 0;
      // texel (2,i) = v2
      data[base + 8] = v2[0]; data[base + 9] = v2[1]; data[base +10] = v2[2]; data[base +11] = 0;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return { tex, width, height };
  }

  voxelize(model) {
    const gl = this.gl;
    console.log("Starting GPU transform feedback voxelization (texture-backed + edge fixes)...");
    const start = performance.now();

    // Calculate bounds
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const v of model.vertices) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], v[i]);
        max[i] = Math.max(max[i], v[i]);
      }
    }
    const size = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
    const maxDim = Math.max(size[0], size[1], size[2]) || 1;

    // Adaptive tolerances (tuned conservatively)
    const eps = 1e-6 * maxDim;           // numerical epsilon for intersection math
    const originNudge = 1e-5 * maxDim;   // small ray-origin shift along ray

    // Generate BCC lattice candidate positions (voxel spacing ~2 units in your setup)
    const candidates = [];
    for (let xo = 0; xo < 2; xo++) {
      for (let yo = 0; yo < 2; yo++) {
        for (let zo = 0; zo < 2; zo++) {
          if ((xo + yo + zo) % 2 !== 0) continue;

          for (let x = Math.floor(min[0]) - 2 + xo; x <= Math.ceil(max[0]) + 2; x += 2) {
            for (let y = Math.floor(min[1]) - 2 + yo; y <= Math.ceil(max[1]) + 2; y += 2) {
              for (let z = Math.floor(min[2]) - 2 + zo; z <= Math.ceil(max[2]) + 2; z += 2) {
                candidates.push(x, y, z);
              }
            }
          }
        }
      }
    }

    console.log(`Testing ${candidates.length / 3} candidate voxels, ${model.faces.length} triangles`);

    // Build triangle array for texture upload
    const tris = new Array(model.faces.length);
    for (let i = 0; i < model.faces.length; i++) {
      const f = model.faces[i];
      tris[i] = [
        model.vertices[f[0]],
        model.vertices[f[1]],
        model.vertices[f[2]],
      ];
    }
    const triTexInfo = this._createTriangleTexture(tris);

    // ====== Shaders ======
    const vs = `#version 300 es
      in vec3 aPosition;

      uniform sampler2D uTriTex;   // width=3, height=uNumTriangles
      uniform int   uNumTriangles;
      uniform float uEps;          // adaptive epsilon (scaled by model extents)
      uniform float uOriginNudge;  // small shift along ray to avoid self-hits

      // Use float for TF portability across drivers
      flat out float vInside;
      out vec3 vPosition;

      // Fetch one triangle from row i
      void getTriangle(int i, out vec3 v0, out vec3 v1, out vec3 v2) {
        vec4 t0 = texelFetch(uTriTex, ivec2(0, i), 0);
        vec4 t1 = texelFetch(uTriTex, ivec2(1, i), 0);
        vec4 t2 = texelFetch(uTriTex, ivec2(2, i), 0);
        v0 = t0.xyz; v1 = t1.xyz; v2 = t2.xyz;
      }

      // Möller–Trumbore with deterministic edge rule + adaptive eps
      // Deterministic rule: count hits only if
      //   u >   uEps (OPEN), v >= -uEps (CLOSED), and u+v < 1.0 - uEps (OPEN)
      // plus t > uEps to avoid the origin seeing itself.
      bool rayTriIntersectDet(vec3 orig, vec3 dir, vec3 v0, vec3 v1, vec3 v2) {
        vec3 e1 = v1 - v0;
        vec3 e2 = v2 - v0;
        vec3 p  = cross(dir, e2);
        float a = dot(e1, p);
        if (abs(a) < uEps) return false;           // nearly parallel

        float invA = 1.0 / a;
        vec3 s = orig - v0;
        float u = dot(s, p) * invA;
        if (!(u > uEps)) return false;             // OPEN edge

        vec3 q = cross(s, e1);
        float v = dot(dir, q) * invA;
        if (!(v >= -uEps)) return false;           // CLOSED edge (with tolerance)
        if (!((u + v) < 1.0 - uEps)) return false; // OPEN top edge

        float t = dot(e2, q) * invA;
        return t > uEps;                            // must be in front by > eps
      }

      void main() {
        // Non-axis-aligned to avoid edge-cancellation pathologies
        vec3 rayDir = normalize(vec3(1.0, 0.123456789, 0.987654321));
        // Nudge origin along ray direction to avoid counting the surface we start on
        vec3 rayOrig = aPosition + rayDir * uOriginNudge;

        int count = 0;
        for (int i = 0; i < uNumTriangles; ++i) {
          vec3 v0, v1, v2;
          getTriangle(i, v0, v1, v2);
          if (rayTriIntersectDet(rayOrig, rayDir, v0, v1, v2)) {
            count++;
          }
        }

        vInside = float(count & 1);
        vPosition = aPosition;
        gl_Position = vec4(0.0);  // rasterizer discarded anyway
      }
    `;

    const fs = `#version 300 es
      precision mediump float;
      out vec4 fragColor;
      void main() { fragColor = vec4(1.0); }
    `;

    const program = this.compileProgram(vs, fs, ['vInside', 'vPosition']);
    if (!program) {
      throw new Error("Failed to compile transform feedback shader");
    }

    // ====== Setup input buffer (candidate positions) ======
    const inputBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(candidates), gl.STATIC_DRAW);

    // ====== Setup output buffers (TF captures) ======
    // insideBuffer: 1 float per candidate
    const insideBuffer = gl.createBuffer();
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, insideBuffer);
    gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, (candidates.length / 3) * 4, gl.STREAM_READ);

    // positionBuffer: 3 floats per candidate
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, positionBuffer);
    gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, candidates.length * 4, gl.STREAM_READ);

    // ====== VAO for input attribute ======
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
    const posLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // ====== Transform Feedback bindings ======
    const tf = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, insideBuffer);   // matches varyings[0] = 'vInside'
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, positionBuffer); // matches varyings[1] = 'vPosition'

    // ====== Run transform feedback pass ======
    gl.useProgram(program);

    // Set triangle texture + uniforms
    gl.uniform1i(gl.getUniformLocation(program, 'uNumTriangles'), model.faces.length);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, triTexInfo.tex);
    gl.uniform1i(gl.getUniformLocation(program, 'uTriTex'), 0);

    // Adaptive tolerances
    gl.uniform1f(gl.getUniformLocation(program, 'uEps'), eps);
    gl.uniform1f(gl.getUniformLocation(program, 'uOriginNudge'), originNudge);

    gl.bindVertexArray(vao);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, candidates.length / 3);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(null);

    gl.flush();

    // ====== Read back results ======
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, insideBuffer);
    const insideData = new Float32Array(candidates.length / 3);
    gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, insideData);

    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, positionBuffer);
    const posData = new Float32Array(candidates.length);
    gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, posData);

    // Extract voxels that are inside
    const voxels = [];
    let insideCount = 0;
    for (let i = 0; i < insideData.length; i++) {
      if (insideData[i] > 0.5) {
        insideCount++;
        voxels.push(
          Math.round(posData[i * 3]),
          Math.round(posData[i * 3 + 1]),
          Math.round(posData[i * 3 + 2])
        );
      }
    }

    console.log(`Found ${insideCount} voxels inside mesh`);

    // ====== Cleanup per-voxelization resources ======
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    gl.bindVertexArray(null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);

    gl.deleteBuffer(inputBuffer);
    gl.deleteBuffer(insideBuffer);
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteTransformFeedback(tf);
    gl.deleteProgram(program);
    gl.deleteTexture(triTexInfo.tex);

    const elapsed = (performance.now() - start).toFixed(1);
    console.log(`GPU voxelization: ${voxels.length / 3} voxels in ${elapsed}ms`);

    return new Int16Array(voxels);
  }

  compileProgram(vsSource, fsSource, varyings) {
    const gl = this.gl;
    const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    // Specify transform feedback varyings before linking
    gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  compileShader(source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      console.error(source);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;

    console.log('Disposing GPUVoxelizer context');
    
    // Unbind everything first
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);

    // Force context loss if extension available
    if (this.loseContextExt) {
      this.loseContextExt.loseContext();
    }

    // Null out references
    this.gl = null;
    this.loseContextExt = null;
  }
}

// === GPU Voxelization Entry Point ===
let sharedVoxelizer = null;

export function voxelizeModel(model) {
  console.log("Starting GPU voxelization with transform feedback...");
  const totalStart = performance.now();

  // Reuse existing voxelizer or create new one
  if (!sharedVoxelizer) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;

    const gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      throw new Error("WebGL2 required for GPU voxelization");
    }

    console.log("Created new voxelizer WebGL2 context");
    sharedVoxelizer = new GPUVoxelizer(gl);
  }

  const voxels = sharedVoxelizer.voxelize(model);

  const totalTime = (performance.now() - totalStart).toFixed(1);
  console.log(`Total: ${voxels.length / 3} voxels in ${totalTime}ms`);

  return { voxels, time: totalTime };
}

// Cleanup function to be called on page unload
export function cleanupVoxelizer() {
  if (sharedVoxelizer) {
    sharedVoxelizer.dispose();
    sharedVoxelizer = null;
    console.log('Voxelizer cleaned up');
  }
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

/**
 * Renderer class - manages WebGL2 rendering
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Add context loss handlers BEFORE getting context
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.error('WebGL context lost!', event);
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
    }, false);

    // Try to get context with explicit attributes
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

    const posBytes = this.instPos.byteLength;
    const delayBytes = this.instDel.byteLength;
    const totalBytes = posBytes + delayBytes;
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

    // Stop render loop
    if (this.render) {
      // Render is an arrow function, can't easily stop, but context cleanup will handle it
    }

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
    this.uboBuffer = null;
    this.vao = null;
    this.prog = null;
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