function U(n,t){for(n=Math.abs(n),t=Math.abs(t);t!==0;)[n,t]=[t,n%t];return n}class N{constructor(t){this.gl=t,this.program=null,this.transformFeedback=null,this.indexBuffer=null,this.outBuffer=null,this.maxD=8192,this.normalize=!1}init(){const t=this.gl,e=`#version 300 es
precision highp float;
precision highp int;

in uint index;

uniform uint n;
uniform uint w;
uniform int d;
uniform int normalize; // 0 or 1

out vec2 position;

const float TWO_PI = 6.283185307179586;
const int MAX_D = ${this.maxD};

// Modular multiplication: (a * b) mod n without overflow for n up to ~2^24.
// 7-bit chunk decomposition (safe for n <= 10,000,000).
uint modmul(uint a, uint b, uint nn) {
  uint a0 = a & 127u;
  uint a1 = (a >> 7) & 127u;
  uint a2 = (a >> 14) & 127u;
  uint a3 = a >> 21;

  uint t0 = (a0 * b) % nn;

  uint t1 = ((a1 * b) % nn * 128u) % nn;

  uint t2 = ((a2 * b) % nn * 128u) % nn;
       t2 = (t2 * 128u) % nn;

  uint t3 = ((a3 * b) % nn * 128u) % nn;
       t3 = (t3 * 128u) % nn;
       t3 = (t3 * 128u) % nn;

  return ((t0 + t1) % nn + (t2 + t3) % nn) % nn;
}

void main() {
  uint k = index;

  // wj = w^j mod n, starting with w^0 = 1
  uint wj = 1u;

  float sumX = 0.0;
  float sumY = 0.0;

  // Bounded loop for WebGL2 driver compatibility
  for (int j = 0; j < MAX_D; j++) {
    if (j >= d) break;

    // idx = (w^j * k) mod n
    uint idx = modmul(wj, k, n);

    // angle in [0, 2pi)
    float angle = TWO_PI * (float(idx) / float(n));
    sumX += cos(angle);
    sumY += sin(angle);

    // advance wj <- (wj * w) mod n
    wj = modmul(wj, w, n);
  }

  if (normalize != 0 && d > 0) {
    float invd = 1.0 / float(d);
    sumX *= invd;
    sumY *= invd;
  }

  position = vec2(sumX, sumY);

  // Rasterization is discarded; gl_Position is irrelevant but required.
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
`,o=`#version 300 es
precision mediump float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`,s=(c,r)=>{const d=t.createShader(c);if(t.shaderSource(d,r),t.compileShader(d),!t.getShaderParameter(d,t.COMPILE_STATUS)){const l=t.getShaderInfoLog(d)||"(no log)";throw t.deleteShader(d),new Error(`Shader compile error: ${l}`)}return d},a=s(t.VERTEX_SHADER,e),h=s(t.FRAGMENT_SHADER,o);if(this.program=t.createProgram(),t.attachShader(this.program,a),t.attachShader(this.program,h),t.transformFeedbackVaryings(this.program,["position"],t.SEPARATE_ATTRIBS),t.linkProgram(this.program),t.deleteShader(a),t.deleteShader(h),!t.getProgramParameter(this.program,t.LINK_STATUS)){const c=t.getProgramInfoLog(this.program)||"(no log)";throw t.deleteProgram(this.program),this.program=null,new Error(`Program link error: ${c}`)}return this.transformFeedback=t.createTransformFeedback(),this}run(t,i){if(U(t,i)!==1)throw new Error("n and w are not coprime");const e=this.gl,o=this.computeOrder(t,i);if(o>this.maxD)throw new Error(`d=${o} exceeds MAX_D=${this.maxD}. Increase maxD (and re-init) or use chunked accumulation.`);this.indexBuffer&&e.deleteBuffer(this.indexBuffer);const s=new Uint32Array(t);for(let g=0;g<t;g++)s[g]=g;this.indexBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.bufferData(e.ARRAY_BUFFER,s,e.STATIC_DRAW),this.outBuffer&&e.deleteBuffer(this.outBuffer),this.outBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.outBuffer),e.bufferData(e.ARRAY_BUFFER,t*2*4,e.STATIC_DRAW),e.useProgram(this.program);const a=e.getUniformLocation(this.program,"n"),h=e.getUniformLocation(this.program,"w"),c=e.getUniformLocation(this.program,"d"),r=e.getUniformLocation(this.program,"normalize");e.uniform1ui(a,t>>>0),e.uniform1ui(h,i>>>0),e.uniform1i(c,o|0),e.uniform1i(r,this.normalize?1:0);const d=e.getAttribLocation(this.program,"index");if(d<0)throw new Error("Attribute 'index' not found (optimized out?)");e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.enableVertexAttribArray(d),e.vertexAttribIPointer(d,1,e.UNSIGNED_INT,0,0),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,this.transformFeedback),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,0,this.outBuffer),e.enable(e.RASTERIZER_DISCARD),e.beginTransformFeedback(e.POINTS),e.drawArrays(e.POINTS,0,t),e.endTransformFeedback(),e.disable(e.RASTERIZER_DISCARD),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,null);const u=(this.normalize?1:o)*1.05;return{buffer:this.outBuffer,numPoints:t,bounds:{minX:-u,maxX:u,minY:-u,maxY:u},d:o}}computeOrder(t,i){let e=1;for(let o=1;o<t;o++)if(e=e*i%t,e===1)return o;return t}dispose(){const t=this.gl;this.indexBuffer&&t.deleteBuffer(this.indexBuffer),this.outBuffer&&t.deleteBuffer(this.outBuffer),this.program&&t.deleteProgram(this.program),this.transformFeedback&&t.deleteTransformFeedback(this.transformFeedback),this.indexBuffer=null,this.outBuffer=null,this.program=null,this.transformFeedback=null}}class ${constructor(t){this.canvas=t,this.target=[0,0],this.distance=1,this.rotation=0,this.isDragging=!1,this.mouseX=0,this.mouseY=0,this.prevMouseX=0,this.prevMouseY=0,this.scrollDelta=0,this.scrollMouseX=0,this.scrollMouseY=0,this.onChange=null,this.touchStartDistance=0,this.touchCenter=[0,0],this.lastTouchCenter=[0,0],this.isTouching=!1,this.isPinching=!1,this.bindEvents(),this.startLoop()}lookAt(t,i,e=0){this.target=[...t],this.distance=i,this.rotation=e}pan(t,i){const e=this.canvas.width/this.canvas.height;this.target[0]-=t*e*this.distance,this.target[1]-=i*this.distance}zoom(t,i,e){const o=this.canvas.width/this.canvas.height,s=this.target[0]+i*o*this.distance,a=this.target[1]+e*this.distance,h=this.distance*t;this.distance=Math.max(.001,h),this.target[0]=s-i*o*this.distance,this.target[1]=a-e*this.distance}screenToNDC(t,i){const e=this.canvas.getBoundingClientRect();if(e.width===0||e.height===0)return[0,0];const o=(t-e.left)/e.width*2-1,s=-((i-e.top)/e.height*2-1);return[o,s]}tick(){let t=!1;const i=this.canvas.getBoundingClientRect();if(i.width===0||i.height===0)return!1;if(this.isDragging){const e=this.mouseX-this.prevMouseX,o=this.mouseY-this.prevMouseY;if(e!==0||o!==0){const s=e/i.width*2,a=-(o/i.height)*2;this.pan(s,a),t=!0}}if(this.scrollDelta!==0){const[e,o]=this.screenToNDC(this.scrollMouseX,this.scrollMouseY),s=Math.exp(this.scrollDelta/i.height);this.zoom(s,e,o),this.scrollDelta=0,t=!0}return this.prevMouseX=this.mouseX,this.prevMouseY=this.mouseY,t}startLoop(){const t=()=>{this.tick()&&this.onChange&&this.onChange(),this.frameId=requestAnimationFrame(t)};this.frameId=requestAnimationFrame(t)}bindEvents(){this.canvas.addEventListener("mousedown",t=>{t.button===0&&(this.isDragging=!0,this.mouseX=t.clientX,this.mouseY=t.clientY,this.prevMouseX=t.clientX,this.prevMouseY=t.clientY)}),window.addEventListener("mouseup",()=>{this.isDragging=!1}),window.addEventListener("mousemove",t=>{this.mouseX=t.clientX,this.mouseY=t.clientY}),this.canvas.addEventListener("wheel",t=>{t.preventDefault(),this.scrollDelta+=t.deltaY,this.scrollMouseX=t.clientX,this.scrollMouseY=t.clientY},{passive:!1}),this.canvas.addEventListener("touchstart",t=>{if(t.touches.length===1){this.isTouching=!0,this.isPinching=!1;const i=t.touches[0];this.mouseX=i.clientX,this.mouseY=i.clientY,this.prevMouseX=i.clientX,this.prevMouseY=i.clientY,this.isDragging=!0}else if(t.touches.length===2){t.preventDefault(),this.isPinching=!0,this.isDragging=!1;const i=t.touches[0],e=t.touches[1];this.touchStartDistance=Math.hypot(e.clientX-i.clientX,e.clientY-i.clientY),this.touchCenter=[(i.clientX+e.clientX)/2,(i.clientY+e.clientY)/2],this.lastTouchCenter=[...this.touchCenter]}},{passive:!1}),this.canvas.addEventListener("touchmove",t=>{if(t.touches.length===1&&this.isTouching&&!this.isPinching){const i=t.touches[0];this.mouseX=i.clientX,this.mouseY=i.clientY}else if(t.touches.length===2&&this.isPinching){t.preventDefault();const i=t.touches[0],e=t.touches[1],o=Math.hypot(e.clientX-i.clientX,e.clientY-i.clientY),s=[(i.clientX+e.clientX)/2,(i.clientY+e.clientY)/2];if(this.touchStartDistance>0){const r=this.touchStartDistance/o,[d,l]=this.screenToNDC(s[0],s[1]);this.zoom(r,d,l),this.touchStartDistance=o}const a=this.canvas.getBoundingClientRect(),h=s[0]-this.lastTouchCenter[0],c=s[1]-this.lastTouchCenter[1];if(h!==0||c!==0){const r=h/a.width*2,d=-(c/a.height)*2;this.pan(r,d)}this.lastTouchCenter=s,this.onChange&&this.onChange()}},{passive:!1}),this.canvas.addEventListener("touchend",t=>{if(t.touches.length===0)this.isTouching=!1,this.isPinching=!1,this.isDragging=!1;else if(t.touches.length===1){this.isPinching=!1,this.isTouching=!0;const i=t.touches[0];this.mouseX=i.clientX,this.mouseY=i.clientY,this.prevMouseX=i.clientX,this.prevMouseY=i.clientY,this.isDragging=!0}})}getMVP(){const t=this.canvas.width/this.canvas.height,i=1/this.distance,e=-this.target[0],o=-this.target[1],s=Math.cos(this.rotation),a=Math.sin(this.rotation),h=i/t,c=i,r=new Float32Array(16);return r[0]=h*s,r[1]=c*a,r[2]=0,r[3]=0,r[4]=h*-a,r[5]=c*s,r[6]=0,r[7]=0,r[8]=0,r[9]=0,r[10]=1,r[11]=0,r[12]=h*(s*e-a*o),r[13]=c*(a*e+s*o),r[14]=0,r[15]=1,r}dispose(){this.frameId&&cancelAnimationFrame(this.frameId)}}const O=`#version 300 es
in vec2 position;
uniform mat4 mvp;
uniform float pointSize;

void main() {
  gl_Position = mvp * vec4(position, 0.0, 1.0);
  gl_PointSize = pointSize;
}
`,W=`#version 300 es
precision mediump float;
uniform vec3 pointColor;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float dist = length(c);
  if (dist > 1.0) discard;

  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
  fragColor = vec4(pointColor, alpha);
}
`,j=`#version 300 es
in vec2 position;
uniform mat4 mvp;
uniform float pointSize;
uniform int numPoints;
uniform vec3 colorFirst;
uniform vec3 colorLast;

out vec3 vColor;

void main() {
  gl_Position = mvp * vec4(position, 0.0, 1.0);
  gl_PointSize = pointSize;

  // Interpolate color based on vertex index
  float t = float(gl_VertexID) / float(max(1, numPoints - 1));
  vColor = mix(colorFirst, colorLast, t);
}
`,V=`#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float dist = length(c);
  if (dist > 1.0) discard;

  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
  fragColor = vec4(vColor, alpha);
}
`,H=`#version 300 es
precision highp float;
precision highp int;

in vec2 position;
uniform mat4 mvp;
uniform float pointSize;

// Lutz parameters
uniform int c;
uniform int bucketToClass[256];  // LUT from CPU (orbit-merged classes)

flat out int vColorClass;

void main() {
  gl_Position = mvp * vec4(position, 0.0, 1.0);
  gl_PointSize = pointSize;

  // Color by k mod c, look up merged class from LUT
  int bucket = gl_VertexID % c;
  vColorClass = bucketToClass[bucket];
}
`,q=`#version 300 es
precision mediump float;
precision highp int;

flat in int vColorClass;
uniform int numClasses;

out vec4 fragColor;

// HSV to RGB conversion
vec3 hsv2rgb(float h, float s, float v) {
  float c = v * s;
  float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
  float m = v - c;

  vec3 rgb;
  if (h < 60.0) rgb = vec3(c, x, 0.0);
  else if (h < 120.0) rgb = vec3(x, c, 0.0);
  else if (h < 180.0) rgb = vec3(0.0, c, x);
  else if (h < 240.0) rgb = vec3(0.0, x, c);
  else if (h < 300.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);

  return rgb + m;
}

void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float dist = length(coord);
  if (dist > 1.0) discard;

  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);

  // Compute hue from color class
  float hue = float(vColorClass) / float(max(1, numClasses)) * 360.0;
  vec3 color = hsv2rgb(hue, 0.8, 0.9);

  fragColor = vec4(color, alpha);
}
`;class G{constructor(t,i){this.canvas=t,this.gl=i,this.buffer=null,this.numPoints=0,this.bounds=null,this.camera=null,this.pointSize=1.5,this.programs={},this.activeProgram="mono",this.monoColor=[.502,.941,.753],this.colorFirst=[0,0,1],this.colorLast=[0,1,0],this.lutzN=0,this.lutzW=0,this.lutzD=0,this.lutzC=12,this.lutzNumClasses=0,this.lutzBucketToClass=new Int32Array(256),this.animationId=null,this.visiblePoints=0,this.animating=!1}compileProgram(t,i){const e=this.gl,o=e.createShader(e.VERTEX_SHADER);if(e.shaderSource(o,t),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS))throw new Error("Vertex shader error: "+e.getShaderInfoLog(o));const s=e.createShader(e.FRAGMENT_SHADER);if(e.shaderSource(s,i),e.compileShader(s),!e.getShaderParameter(s,e.COMPILE_STATUS))throw new Error("Fragment shader error: "+e.getShaderInfoLog(s));const a=e.createProgram();if(e.attachShader(a,o),e.attachShader(a,s),e.linkProgram(a),e.deleteShader(o),e.deleteShader(s),!e.getProgramParameter(a,e.LINK_STATUS))throw new Error("Program link error: "+e.getProgramInfoLog(a));return a}init(){const t=this.gl,i=this.compileProgram(O,W);this.programs.mono={program:i,position:t.getAttribLocation(i,"position"),mvp:t.getUniformLocation(i,"mvp"),pointSize:t.getUniformLocation(i,"pointSize"),pointColor:t.getUniformLocation(i,"pointColor")};const e=this.compileProgram(j,V);this.programs.time={program:e,position:t.getAttribLocation(e,"position"),mvp:t.getUniformLocation(e,"mvp"),pointSize:t.getUniformLocation(e,"pointSize"),numPoints:t.getUniformLocation(e,"numPoints"),colorFirst:t.getUniformLocation(e,"colorFirst"),colorLast:t.getUniformLocation(e,"colorLast")};const o=this.compileProgram(H,q);return this.programs.lutz={program:o,position:t.getAttribLocation(o,"position"),mvp:t.getUniformLocation(o,"mvp"),pointSize:t.getUniformLocation(o,"pointSize"),c:t.getUniformLocation(o,"c"),numClasses:t.getUniformLocation(o,"numClasses"),bucketToClass:t.getUniformLocation(o,"bucketToClass")},t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),this.camera=new $(this.canvas),this.camera.onChange=()=>this.draw(),this.resize(),window.addEventListener("resize",()=>this.resize()),this}resize(){this.canvas.width=window.innerWidth,this.canvas.height=window.innerHeight,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.draw()}setPointBuffer(t,i){this.stopAnimation(),this.buffer=t,this.numPoints=i,this.visiblePoints=i}setBounds(t){this.bounds=t}setPointSize(t){this.pointSize=t}setColorScheme(t){this.programs[t]&&(this.activeProgram=t)}setMonoColor(t){this.monoColor=t}setMonoColorHex(t){this.monoColor=this.hexToRgb(t)}setTimeColors(t,i){this.colorFirst=t,this.colorLast=i}hexToRgb(t){const i=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return i?[parseInt(i[1],16)/255,parseInt(i[2],16)/255,parseInt(i[3],16)/255]:[1,1,1]}setTimeColorsHex(t,i){this.colorFirst=this.hexToRgb(t),this.colorLast=this.hexToRgb(i)}setLutzParams(t,i,e){this.lutzN=t,this.lutzW=i,this.lutzD=e}setLutzLUT(t){this.lutzC=t.c,this.lutzNumClasses=t.numClasses;for(let i=0;i<t.c&&i<256;i++)this.lutzBucketToClass[i]=t.bucketToClass[i]}stopAnimation(){this.animationId!==null&&(cancelAnimationFrame(this.animationId),this.animationId=null),this.animating=!1}animateIn(t=2e3,i="easeOut"){if(this.stopAnimation(),this.numPoints===0)return;console.log("animateIn called, numPoints:",this.numPoints,"duration:",t),this.animating=!0,this.visiblePoints=0;const e=performance.now(),o=this.numPoints,s={linear:c=>c,easeOut:c=>1-Math.pow(1-c,3),easeInOut:c=>c<.5?4*c*c*c:1-Math.pow(-2*c+2,3)/2},a=s[i]||s.easeOut,h=()=>{if(!this.animating)return;const c=performance.now()-e,r=Math.min(c/t,1),d=a(r);this.visiblePoints=Math.floor(d*o),this.draw(),r<1?this.animationId=requestAnimationFrame(h):(this.visiblePoints=o,this.animating=!1,this.animationId=null)};this.animationId=requestAnimationFrame(h)}zoomToFit(){if(!this.camera||!this.bounds)return;const{minX:t,maxX:i,minY:e,maxY:o}=this.bounds,s=(t+i)/2,a=(e+o)/2,h=i-t||1,c=o-e||1,r=Math.max(h,c)*.6;this.camera.lookAt([s,a],r),this.draw()}draw(){if(!this.gl||this.numPoints===0)return;const t=this.gl,i=this.programs[this.activeProgram];t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(i.program),t.uniformMatrix4fv(i.mvp,!1,this.camera.getMVP()),t.uniform1f(i.pointSize,this.pointSize),this.activeProgram==="mono"&&t.uniform3fv(i.pointColor,this.monoColor),this.activeProgram==="time"&&(t.uniform1i(i.numPoints,this.numPoints),t.uniform3fv(i.colorFirst,this.colorFirst),t.uniform3fv(i.colorLast,this.colorLast)),this.activeProgram==="lutz"&&(t.uniform1i(i.c,this.lutzC),t.uniform1i(i.numClasses,this.lutzNumClasses),t.uniform1iv(i.bucketToClass,this.lutzBucketToClass)),t.bindBuffer(t.ARRAY_BUFFER,this.buffer),t.enableVertexAttribArray(i.position),t.vertexAttribPointer(i.position,2,t.FLOAT,!1,0,0);const e=this.animating?this.visiblePoints:this.numPoints;t.drawArrays(t.POINTS,0,e)}dispose(){this.stopAnimation(),this.camera&&this.camera.dispose(),this.buffer&&this.gl.deleteBuffer(this.buffer);for(const t in this.programs)this.gl.deleteProgram(this.programs[t].program)}}class K{constructor(){this.bucketToClass=null,this.numClasses=0,this.c=12,this._cachedN=null,this._cachedW=null,this._cachedC=null}compute(t,i,e){if(t===this._cachedN&&i===this._cachedW&&e===this._cachedC)return;this.c=e;const o=new Int32Array(e);for(let l=0;l<e;l++)o[l]=l;const s=l=>(o[l]!==l&&(o[l]=s(o[l])),o[l]),a=(l,u)=>{const g=s(l),P=s(u);g!==P&&(o[g]=P)},h=new Array(e).fill(!1),c=new Uint8Array(t);for(let l=0;l<t;l++){if(c[l])continue;let u=l,g=u;const P=new Set;do c[u]=1,u<g&&(g=u),P.add(u%e),u=u*i%t;while(u!==l&&!c[u]);const M=g%e,B=Array.from(P);for(let x=1;x<B.length;x++)a(B[0],B[x]);h[M]=!0}const r=new Map;let d=0;this.bucketToClass=new Int32Array(e);for(let l=0;l<e;l++){const u=s(l);r.has(u)||r.set(u,d++),this.bucketToClass[l]=r.get(u)}this.numClasses=d,this._cachedN=t,this._cachedW=i,this._cachedC=e,console.log(`LutzColorer: c=${e}, numClasses=${this.numClasses}`)}getLUT(){return{bucketToClass:this.bucketToClass,numClasses:this.numClasses,c:this.c}}}const D=document.getElementById("canvas"),A=D.getContext("webgl2",{alpha:!0,antialias:!1,preserveDrawingBuffer:!0,premultipliedAlpha:!1});if(!A)throw new Error("WebGL2 not supported");const z=new N(A);z.init();const f=new G(D,A);f.init();const T=new K;function I(n,t){for(;t!==0;)[n,t]=[t,n%t];return n}function y(n,t){let i=t+1;for(;I(n,i)!==1;)i++;return i}function F(n,t){let i=t-1;for(;i>1&&I(n,i)!==1;)i--;return i>0?i:1}function R(n,t){let i=1;for(let e=1;e<n;e++)if(i=i*t%n,i===1)return e;return n}let w=255255,v=254,_=12,X=!1,L=2e3;function Y(n,t){w=n,v=t,window.dispatchEvent(new CustomEvent("gp-values-changed",{detail:{n,w:t}})),console.log(`n: ${n.toLocaleString()} | w: ${t} | computing d...`);const i=R(n,t);console.log(`d: ${i.toLocaleString()}`);const e=performance.now(),o=z.run(n,t),s=performance.now();f.setPointBuffer(o.buffer,o.numPoints),f.setBounds(o.bounds),f.setLutzParams(n,t,i),f.activeProgram==="lutz"&&k(),f.zoomToFit(),X&&(console.log("Starting animation, duration:",L),f.animateIn(L));const a=performance.now();A.finish();const h=performance.now();console.log(`compute: ${(s-e).toFixed(2)}ms | draw: ${(a-s).toFixed(2)}ms | gpu sync: ${(h-a).toFixed(2)}ms | total: ${(h-e).toFixed(2)}ms`)}function k(){if(w===0||v===0)return;const n=performance.now();T.compute(w,v,_),f.setLutzLUT(T.getLUT());const t=performance.now();console.log(`Lutz LUT: ${(t-n).toFixed(2)}ms`)}function Z(n){_=n,f.activeProgram==="lutz"&&(k(),f.draw())}function J(n){X=n,console.log("Animation enabled:",n)}function Q(n){L=n}function tt(){f.animateIn(L)}Y(255255,254);window.dispatchEvent(new Event("app-ready"));window.renderPoints=Y;window.computer=z;window.renderer=f;window.lutzColorer=T;window.gcd=I;window.nextCoprime=y;window.prevCoprime=F;window.order=R;window.updateLutzColoring=k;window.setLutzC=Z;window.setAnimateEnabled=J;window.setAnimationDuration=Q;window.triggerAnimation=tt;window.addEventListener("keydown",n=>{if(!(n.target.tagName==="INPUT"||n.target.tagName==="TEXTAREA")){if(n.key==="n"&&w>0&&v>0){const t=y(w,v);window.renderPoints(w,t)}else if(n.key==="p"&&w>0&&v>1){const t=F(w,v);window.renderPoints(w,t)}}});function m(n){return n&&parseInt(n.getAttribute("data-value")||"0")||0}const b=document.getElementById("nInput"),p=document.getElementById("wInput"),et=document.getElementById("renderBtn"),it=document.getElementById("prevCoprimeBtn"),nt=document.getElementById("nextCoprimeBtn"),E=document.getElementById("keyNInput"),S=document.getElementById("keyWInput"),ot=document.getElementById("keyComputeBtn"),st=document.getElementById("keyPrevBtn"),rt=document.getElementById("keyNextBtn"),at=document.getElementById("pointSizeSlider"),ct=document.getElementById("lutzCSlider"),lt=document.getElementById("colorSchemeSelect"),ht=document.getElementById("monoColorSwap"),ut=document.getElementById("animateToggle"),dt=document.getElementById("animDurationSlider"),mt=document.getElementById("exportBtn");et?.addEventListener("click",()=>{const n=m(b),t=m(p);n>0&&t>0&&window.renderPoints&&window.renderPoints(n,t)});it?.addEventListener("click",()=>{const n=m(b),t=m(p);if(window.prevCoprime&&window.renderPoints){const i=window.prevCoprime(n,t);if(window.renderPoints(n,i),p){p.setAttribute("data-value",i.toString());const e=p.querySelector(".text-number-value");e&&(e.textContent=i.toString())}}});nt?.addEventListener("click",()=>{const n=m(b),t=m(p);if(window.nextCoprime&&window.renderPoints){const i=window.nextCoprime(n,t);if(window.renderPoints(n,i),p){p.setAttribute("data-value",i.toString());const e=p.querySelector(".text-number-value");e&&(e.textContent=i.toString())}}});ot?.addEventListener("click",()=>{const n=m(E),t=m(S);n>0&&t>0&&window.renderPoints&&window.renderPoints(n,t)});st?.addEventListener("click",()=>{const n=m(E),t=m(S);if(window.prevCoprime&&window.renderPoints){const i=window.prevCoprime(n,t);window.renderPoints(n,i),C(S,i)}});rt?.addEventListener("click",()=>{const n=m(E),t=m(S);if(window.nextCoprime&&window.renderPoints){const i=window.nextCoprime(n,t);window.renderPoints(n,i),C(S,i)}});at?.addEventListener("change",n=>{const i=(n.detail?.value??15)/10;window.renderer&&(window.renderer.setPointSize(i),window.renderer.draw())});ct?.addEventListener("change",n=>{const i=n.detail?.value??12;window.setLutzC&&window.setLutzC(i)});const ft=["mono","time","lutz"];lt?.addEventListener("change",n=>{const t=n.detail,i=ft[t?.value??0];window.renderer&&(window.renderer.setColorScheme(i),i==="lutz"&&window.updateLutzColoring&&window.updateLutzColoring(),window.renderer.draw())});const gt={mint:"#80f0c0",sky:"#90d0ff",lavender:"#c5a0f5",coral:"#f0a090",peach:"#e8c4a0",yellow:"#f0e080",white:"#ffffff"};ht?.addEventListener("change",n=>{const i=n.detail?.option??"mint",e=gt[i]||"#80f0c0";window.renderer&&(window.renderer.setMonoColorHex(e),window.renderer.draw())});ut?.addEventListener("change",n=>{const i=n.detail?.checked??!1;window.setAnimateEnabled&&window.setAnimateEnabled(i)});dt?.addEventListener("change",n=>{const i=n.detail?.value??2;window.setAnimationDuration&&window.setAnimationDuration(i*1e3)});mt?.addEventListener("click",()=>{const n=document.getElementById("canvas"),t=m(b),i=m(p),e=document.createElement("a"),o=new Date().toISOString().replace(/[:.]/g,"-").slice(0,-5);e.download=`gp-${t}-${i}-${o}.png`,e.href=n.toDataURL("image/png"),e.click()});function C(n,t){if(!n)return;n.setAttribute("data-value",t.toString());const i=n.querySelector(".text-number-value");i&&(i.textContent=t.toString())}window.addEventListener("gp-values-changed",(n=>{const{n:t,w:i}=n.detail;C(b,t),C(p,i),C(E,t),C(S,i)}));
