/**
 * JFA (Jump Flooding Algorithm) Shaders
 */

export const VERT = `#version 300 es
precision highp float;
out vec2 v_uv;
void main(){
  uint id = uint(gl_VertexID);
  vec2 p = vec2(float((id<<1u)&2u), float(id&2u));
  v_uv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

export const FRAG_CLEAR = `#version 300 es
precision mediump float;
out vec4 outColor;
void main(){ outColor = vec4(-1.0, -1.0, -1.0, 0.0); }`;

export const FRAG_JFA = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uSeedTex;
uniform vec2 uTexel;
uniform float uStep;
uniform vec2 uResolution;
uniform float uP;
uniform bool  uUseInf;

float lp_cost(vec2 delta){
  vec2 ad = abs(delta);
  if (uUseInf) return max(ad.x, ad.y);

  // OPTIMIZATION: Fast paths for common metrics
  if (uP == 1.0) return ad.x + ad.y;
  if (uP == 2.0) return length(delta);

  // General case with stability
  float maxVal = max(ad.x, ad.y);
  if (maxVal < 0.001) return 0.0;
  vec2 normalized = ad / maxVal;
  return maxVal * pow(pow(normalized.x, uP) + pow(normalized.y, uP), 1.0 / uP);
}

vec4 pickBetter(vec4 a, vec4 b, vec2 fragPix){
  float da = (a.z < 0.0) ? 1e30 : lp_cost(fragPix - a.xy);
  float db = (b.z < 0.0) ? 1e30 : lp_cost(fragPix - b.xy);
  return (db < da) ? b : a;
}

void main(){
  vec2 fragPix = v_uv * uResolution;
  vec2 o = uTexel * uStep;
  vec4 best = texture(uSeedTex, v_uv);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2( o.x, 0.0)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(-o.x, 0.0)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(0.0,  o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(0.0, -o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2( o.x,  o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2( o.x, -o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(-o.x,  o.y)), fragPix);
  best = pickBetter(best, texture(uSeedTex, v_uv + vec2(-o.x, -o.y)), fragPix);
  outColor = best;
}`;

export const FRAG_RENDER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uSeedTex;
uniform sampler2D uPalette;
uniform vec2 uResolution;
uniform int  uPaletteSize;
uniform bool uEdges;
uniform bool uShowSites;
uniform float uP;
uniform bool  uUseInf;
uniform float uResolutionScale;
uniform vec3 uEdgeColor;

void main(){
  vec4 texel = texture(uSeedTex, v_uv);
  float sid = texel.z;
  if (sid < 0.0){ outColor = vec4(0.05,0.06,0.07,1.0); return; }
  vec2 seed = texel.xy;
  vec2 fragPix = v_uv * uResolution;

  float idx = mod(max(sid, 0.0), float(uPaletteSize));
  float u = (idx + 0.5) / float(uPaletteSize);
  vec3 base = texture(uPalette, vec2(u, 0.5)).rgb;

  if (uEdges){
    vec2 texelS = 0.7 * (1.0 / uResolution) * (uResolutionScale / 0.25);
    float idc = sid;
    float diff = 0.0;
    diff += float(texture(uSeedTex, v_uv + vec2( texelS.x, 0.0)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(-texelS.x, 0.0)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(0.0,  texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(0.0, -texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2( texelS.x,  texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2( texelS.x, -texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(-texelS.x,  texelS.y)).z != idc);
    diff += float(texture(uSeedTex, v_uv + vec2(-texelS.x, -texelS.y)).z != idc);
    float edge = smoothstep(0.0, 0.5, diff / 8.0);
    base = mix(base, uEdgeColor, edge);
  }

  if (uShowSites) {
    float dotRadius = 3.5 * (uResolutionScale / 0.25);
    float dist = distance(fragPix, seed);
    if (dist < dotRadius) {
      float outerEdge = smoothstep(dotRadius + 0.5, dotRadius - 0.5, dist);
      float innerEdge = smoothstep(dotRadius - 0.5, dotRadius - 1.5, dist);
      vec3 dotColor = mix(vec3(1.0), uEdgeColor, innerEdge);
      base = mix(base, dotColor, outerEdge);
    }
  }
  outColor = vec4(base, 1.0);
}`;
