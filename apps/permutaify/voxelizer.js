/**
 * Voxelizer Module - Transform Feedback GPU Voxelization
 * Uses shared WebGL2 context to avoid context exhaustion
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
    if (!gl) {
      throw new Error('GPUVoxelizer requires a valid WebGL2 context');
    }
    this.gl = gl;
    this.maxTriangles = 2048;
    console.log('GPUVoxelizer initialized with shared context');
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

    // Small constant epsilon for ray-triangle intersection tests
    const eps = 1e-5;

    // Debug output
    console.log(`Mesh bounds: min=[${min.map(v => v.toFixed(2)).join(', ')}], max=[${max.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`Mesh size: [${size.map(v => v.toFixed(2)).join(', ')}], maxDim=${maxDim.toFixed(2)}`);
    console.log(`Epsilon tolerance: ${eps.toExponential(3)}`);

    // Generate BCC lattice candidate positions
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

    // Debug: Show first few candidates
    if (candidates.length > 0) {
      const sampleCount = Math.min(5, candidates.length / 3);
      console.log(`First ${sampleCount} candidate positions:`);
      for (let i = 0; i < sampleCount; i++) {
        console.log(`  [${candidates[i*3]}, ${candidates[i*3+1]}, ${candidates[i*3+2]}]`);
      }
    }

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

    // Debug: Show first triangle
    if (tris.length > 0 && tris[0]) {
      const t = tris[0];
      console.log(`First triangle vertices:`);
      console.log(`  v0=[${t[0][0].toFixed(2)}, ${t[0][1].toFixed(2)}, ${t[0][2].toFixed(2)}]`);
      console.log(`  v1=[${t[1][0].toFixed(2)}, ${t[1][1].toFixed(2)}, ${t[1][2].toFixed(2)}]`);
      console.log(`  v2=[${t[2][0].toFixed(2)}, ${t[2][1].toFixed(2)}, ${t[2][2].toFixed(2)}]`);
    }

    const triTexInfo = this._createTriangleTexture(tris);

    // ====== Shaders ======
    const vs = `#version 300 es
      precision highp float;

      in vec3 aPosition;

      uniform sampler2D uTriTex;
      uniform int   uNumTriangles;
      uniform float uEps;

      flat out float vInside;
      out vec3 vPosition;

      void getTriangle(int i, out vec3 v0, out vec3 v1, out vec3 v2) {
        vec4 t0 = texelFetch(uTriTex, ivec2(0, i), 0);
        vec4 t1 = texelFetch(uTriTex, ivec2(1, i), 0);
        vec4 t2 = texelFetch(uTriTex, ivec2(2, i), 0);
        v0 = t0.xyz; v1 = t1.xyz; v2 = t2.xyz;
      }

      bool rayTriIntersectDet(vec3 orig, vec3 dir, vec3 v0, vec3 v1, vec3 v2) {
        vec3 e1 = v1 - v0;
        vec3 e2 = v2 - v0;
        vec3 p  = cross(dir, e2);
        float a = dot(e1, p);
        if (abs(a) < uEps) return false;

        float invA = 1.0 / a;
        vec3 s = orig - v0;
        float u = dot(s, p) * invA;
        if (u < 0.0) return false;

        vec3 q = cross(s, e1);
        float v = dot(dir, q) * invA;
        if (v < 0.0 || u + v > 1.0) return false;

        float t = dot(e2, q) * invA;
        return t > uEps;
      }

      void main() {
        // Golden ratio based direction: normalize(1, phi, phi^2)
        // phi = 1.618033988749895, phi^2 = 2.618033988749895
        vec3 rayDir = normalize(vec3(1.0, 1.618033988749895, 2.618033988749895));
        vec3 rayOrig = aPosition;

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
        gl_Position = vec4(0.0);
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

    // ====== Setup input buffer ======
    const inputBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(candidates), gl.STATIC_DRAW);

    // ====== Setup output buffers ======
    const insideBuffer = gl.createBuffer();
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, insideBuffer);
    gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, (candidates.length / 3) * 4, gl.STREAM_READ);

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
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, insideBuffer);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, positionBuffer);

    // ====== Run transform feedback pass ======
    gl.useProgram(program);

    gl.uniform1i(gl.getUniformLocation(program, 'uNumTriangles'), model.faces.length);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, triTexInfo.tex);
    gl.uniform1i(gl.getUniformLocation(program, 'uTriTex'), 0);

    gl.uniform1f(gl.getUniformLocation(program, 'uEps'), eps);

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
}

// === GPU Voxelization Entry Point ===
let sharedVoxelizer = null;

export function voxelizeModel(model, gl) {
  if (!gl) {
    throw new Error('voxelizeModel requires a WebGL2 context');
  }

  console.log("Starting GPU voxelization with shared context...");
  const totalStart = performance.now();

  // Create voxelizer with provided context (reuse if same context)
  if (!sharedVoxelizer || sharedVoxelizer.gl !== gl) {
    console.log("Creating new voxelizer with shared context");
    sharedVoxelizer = new GPUVoxelizer(gl);
  }

  const voxels = sharedVoxelizer.voxelize(model);

  const totalTime = (performance.now() - totalStart).toFixed(1);
  console.log(`Total: ${voxels.length / 3} voxels in ${totalTime}ms`);

  return { voxels, time: totalTime };
}

// Cleanup function
export function cleanupVoxelizer() {
  if (sharedVoxelizer) {
    sharedVoxelizer = null;
    console.log('Voxelizer cleaned up');
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