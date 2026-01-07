function y(i,t){for(i=Math.abs(i),t=Math.abs(t);t!==0;)[i,t]=[t,i%t];return i}class U{constructor(t){this.gl=t,this.program=null,this.transformFeedback=null,this.indexBuffer=null,this.outBuffer=null,this.maxD=8192,this.normalize=!1}init(){const t=this.gl,e=`#version 300 es
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
`,n=`#version 300 es
precision mediump float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`,r=(h,a)=>{const d=t.createShader(h);if(t.shaderSource(d,a),t.compileShader(d),!t.getShaderParameter(d,t.COMPILE_STATUS)){const c=t.getShaderInfoLog(d)||"(no log)";throw t.deleteShader(d),new Error(`Shader compile error: ${c}`)}return d},s=r(t.VERTEX_SHADER,e),u=r(t.FRAGMENT_SHADER,n);if(this.program=t.createProgram(),t.attachShader(this.program,s),t.attachShader(this.program,u),t.transformFeedbackVaryings(this.program,["position"],t.SEPARATE_ATTRIBS),t.linkProgram(this.program),t.deleteShader(s),t.deleteShader(u),!t.getProgramParameter(this.program,t.LINK_STATUS)){const h=t.getProgramInfoLog(this.program)||"(no log)";throw t.deleteProgram(this.program),this.program=null,new Error(`Program link error: ${h}`)}return this.transformFeedback=t.createTransformFeedback(),this}run(t,o){if(y(t,o)!==1)throw new Error("n and w are not coprime");const e=this.gl,n=this.computeOrder(t,o);if(n>this.maxD)throw new Error(`d=${n} exceeds MAX_D=${this.maxD}. Increase maxD (and re-init) or use chunked accumulation.`);this.indexBuffer&&e.deleteBuffer(this.indexBuffer);const r=new Uint32Array(t);for(let m=0;m<t;m++)r[m]=m;this.indexBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW),this.outBuffer&&e.deleteBuffer(this.outBuffer),this.outBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.outBuffer),e.bufferData(e.ARRAY_BUFFER,t*2*4,e.STATIC_DRAW),e.useProgram(this.program);const s=e.getUniformLocation(this.program,"n"),u=e.getUniformLocation(this.program,"w"),h=e.getUniformLocation(this.program,"d"),a=e.getUniformLocation(this.program,"normalize");e.uniform1ui(s,t>>>0),e.uniform1ui(u,o>>>0),e.uniform1i(h,n|0),e.uniform1i(a,this.normalize?1:0);const d=e.getAttribLocation(this.program,"index");if(d<0)throw new Error("Attribute 'index' not found (optimized out?)");e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.enableVertexAttribArray(d),e.vertexAttribIPointer(d,1,e.UNSIGNED_INT,0,0),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,this.transformFeedback),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,0,this.outBuffer),e.enable(e.RASTERIZER_DISCARD),e.beginTransformFeedback(e.POINTS),e.drawArrays(e.POINTS,0,t),e.endTransformFeedback(),e.disable(e.RASTERIZER_DISCARD),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,null);const l=(this.normalize?1:n)*1.05;return{buffer:this.outBuffer,numPoints:t,bounds:{minX:-l,maxX:l,minY:-l,maxY:l},d:n}}computeOrder(t,o){let e=1;for(let n=1;n<t;n++)if(e=e*o%t,e===1)return n;return t}dispose(){const t=this.gl;this.indexBuffer&&t.deleteBuffer(this.indexBuffer),this.outBuffer&&t.deleteBuffer(this.outBuffer),this.program&&t.deleteProgram(this.program),this.transformFeedback&&t.deleteTransformFeedback(this.transformFeedback),this.indexBuffer=null,this.outBuffer=null,this.program=null,this.transformFeedback=null}}class M{constructor(t){this.canvas=t,this.target=[0,0],this.distance=1,this.rotation=0,this.isDragging=!1,this.mouseX=0,this.mouseY=0,this.prevMouseX=0,this.prevMouseY=0,this.scrollDelta=0,this.scrollMouseX=0,this.scrollMouseY=0,this.onChange=null,this.bindEvents(),this.startLoop()}lookAt(t,o,e=0){this.target=[...t],this.distance=o,this.rotation=e}pan(t,o){const e=this.canvas.width/this.canvas.height;this.target[0]-=t*e*this.distance,this.target[1]-=o*this.distance}zoom(t,o,e){const n=this.canvas.width/this.canvas.height,r=this.target[0]+o*n*this.distance,s=this.target[1]+e*this.distance,u=this.distance*t;this.distance=Math.max(.001,u),this.target[0]=r-o*n*this.distance,this.target[1]=s-e*this.distance}screenToNDC(t,o){const e=this.canvas.getBoundingClientRect();if(e.width===0||e.height===0)return[0,0];const n=(t-e.left)/e.width*2-1,r=-((o-e.top)/e.height*2-1);return[n,r]}tick(){let t=!1;const o=this.canvas.getBoundingClientRect();if(o.width===0||o.height===0)return!1;if(this.isDragging){const e=this.mouseX-this.prevMouseX,n=this.mouseY-this.prevMouseY;if(e!==0||n!==0){const r=e/o.width*2,s=-(n/o.height)*2;this.pan(r,s),t=!0}}if(this.scrollDelta!==0){const[e,n]=this.screenToNDC(this.scrollMouseX,this.scrollMouseY),r=Math.exp(this.scrollDelta/o.height);this.zoom(r,e,n),this.scrollDelta=0,t=!0}return this.prevMouseX=this.mouseX,this.prevMouseY=this.mouseY,t}startLoop(){const t=()=>{this.tick()&&this.onChange&&this.onChange(),this.frameId=requestAnimationFrame(t)};this.frameId=requestAnimationFrame(t)}bindEvents(){this.canvas.addEventListener("mousedown",t=>{t.button===0&&(this.isDragging=!0,this.mouseX=t.clientX,this.mouseY=t.clientY,this.prevMouseX=t.clientX,this.prevMouseY=t.clientY)}),window.addEventListener("mouseup",()=>{this.isDragging=!1}),window.addEventListener("mousemove",t=>{this.mouseX=t.clientX,this.mouseY=t.clientY}),this.canvas.addEventListener("wheel",t=>{t.preventDefault(),this.scrollDelta+=t.deltaY,this.scrollMouseX=t.clientX,this.scrollMouseY=t.clientY},{passive:!1})}getMVP(){const t=this.canvas.width/this.canvas.height,o=1/this.distance,e=-this.target[0],n=-this.target[1],r=Math.cos(this.rotation),s=Math.sin(this.rotation),u=o/t,h=o,a=new Float32Array(16);return a[0]=u*r,a[1]=h*s,a[2]=0,a[3]=0,a[4]=u*-s,a[5]=h*r,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=1,a[11]=0,a[12]=u*(r*e-s*n),a[13]=h*(s*e+r*n),a[14]=0,a[15]=1,a}dispose(){this.frameId&&cancelAnimationFrame(this.frameId)}}const X=`#version 300 es
in vec2 position;
uniform mat4 mvp;
uniform float pointSize;

void main() {
  gl_Position = mvp * vec4(position, 0.0, 1.0);
  gl_PointSize = pointSize;
}
`,Y=`#version 300 es
precision mediump float;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float dist = length(c);
  if (dist > 1.0) discard;

  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
  fragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`,N=`#version 300 es
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
`,$=`#version 300 es
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
`,O=`#version 300 es
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
`,W=`#version 300 es
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
`;class j{constructor(t,o){this.canvas=t,this.gl=o,this.buffer=null,this.numPoints=0,this.bounds=null,this.camera=null,this.pointSize=1.5,this.programs={},this.activeProgram="mono",this.colorFirst=[0,0,1],this.colorLast=[0,1,0],this.lutzN=0,this.lutzW=0,this.lutzD=0,this.lutzC=12,this.lutzNumClasses=0,this.lutzBucketToClass=new Int32Array(256)}compileProgram(t,o){const e=this.gl,n=e.createShader(e.VERTEX_SHADER);if(e.shaderSource(n,t),e.compileShader(n),!e.getShaderParameter(n,e.COMPILE_STATUS))throw new Error("Vertex shader error: "+e.getShaderInfoLog(n));const r=e.createShader(e.FRAGMENT_SHADER);if(e.shaderSource(r,o),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw new Error("Fragment shader error: "+e.getShaderInfoLog(r));const s=e.createProgram();if(e.attachShader(s,n),e.attachShader(s,r),e.linkProgram(s),e.deleteShader(n),e.deleteShader(r),!e.getProgramParameter(s,e.LINK_STATUS))throw new Error("Program link error: "+e.getProgramInfoLog(s));return s}init(){const t=this.gl,o=this.compileProgram(X,Y);this.programs.mono={program:o,position:t.getAttribLocation(o,"position"),mvp:t.getUniformLocation(o,"mvp"),pointSize:t.getUniformLocation(o,"pointSize")};const e=this.compileProgram(N,$);this.programs.time={program:e,position:t.getAttribLocation(e,"position"),mvp:t.getUniformLocation(e,"mvp"),pointSize:t.getUniformLocation(e,"pointSize"),numPoints:t.getUniformLocation(e,"numPoints"),colorFirst:t.getUniformLocation(e,"colorFirst"),colorLast:t.getUniformLocation(e,"colorLast")};const n=this.compileProgram(O,W);return this.programs.lutz={program:n,position:t.getAttribLocation(n,"position"),mvp:t.getUniformLocation(n,"mvp"),pointSize:t.getUniformLocation(n,"pointSize"),c:t.getUniformLocation(n,"c"),numClasses:t.getUniformLocation(n,"numClasses"),bucketToClass:t.getUniformLocation(n,"bucketToClass")},t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),this.camera=new M(this.canvas),this.camera.onChange=()=>this.draw(),this.resize(),window.addEventListener("resize",()=>this.resize()),this}resize(){this.canvas.width=window.innerWidth,this.canvas.height=window.innerHeight,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.draw()}setPointBuffer(t,o){this.buffer=t,this.numPoints=o}setBounds(t){this.bounds=t}setPointSize(t){this.pointSize=t}setColorScheme(t){this.programs[t]&&(this.activeProgram=t)}setTimeColors(t,o){this.colorFirst=t,this.colorLast=o}hexToRgb(t){const o=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return o?[parseInt(o[1],16)/255,parseInt(o[2],16)/255,parseInt(o[3],16)/255]:[1,1,1]}setTimeColorsHex(t,o){this.colorFirst=this.hexToRgb(t),this.colorLast=this.hexToRgb(o)}setLutzParams(t,o,e){this.lutzN=t,this.lutzW=o,this.lutzD=e}setLutzLUT(t){this.lutzC=t.c,this.lutzNumClasses=t.numClasses;for(let o=0;o<t.c&&o<256;o++)this.lutzBucketToClass[o]=t.bucketToClass[o]}zoomToFit(){if(!this.camera||!this.bounds)return;const{minX:t,maxX:o,minY:e,maxY:n}=this.bounds,r=(t+o)/2,s=(e+n)/2,u=o-t||1,h=n-e||1,a=Math.max(u,h)*.6;this.camera.lookAt([r,s],a),this.draw()}draw(){if(!this.gl||this.numPoints===0)return;const t=this.gl,o=this.programs[this.activeProgram];t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(o.program),t.uniformMatrix4fv(o.mvp,!1,this.camera.getMVP()),t.uniform1f(o.pointSize,this.pointSize),this.activeProgram==="time"&&(t.uniform1i(o.numPoints,this.numPoints),t.uniform3fv(o.colorFirst,this.colorFirst),t.uniform3fv(o.colorLast,this.colorLast)),this.activeProgram==="lutz"&&(t.uniform1i(o.c,this.lutzC),t.uniform1i(o.numClasses,this.lutzNumClasses),t.uniform1iv(o.bucketToClass,this.lutzBucketToClass)),t.bindBuffer(t.ARRAY_BUFFER,this.buffer),t.enableVertexAttribArray(o.position),t.vertexAttribPointer(o.position,2,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,this.numPoints)}dispose(){this.camera&&this.camera.dispose(),this.buffer&&this.gl.deleteBuffer(this.buffer);for(const t in this.programs)this.gl.deleteProgram(this.programs[t].program)}}class V{constructor(){this.bucketToClass=null,this.numClasses=0,this.c=12,this._cachedN=null,this._cachedW=null,this._cachedC=null}compute(t,o,e){if(t===this._cachedN&&o===this._cachedW&&e===this._cachedC)return;this.c=e;const n=new Int32Array(e);for(let c=0;c<e;c++)n[c]=c;const r=c=>(n[c]!==c&&(n[c]=r(n[c])),n[c]),s=(c,l)=>{const m=r(c),C=r(l);m!==C&&(n[m]=C)},u=new Array(e).fill(!1),h=new Uint8Array(t);for(let c=0;c<t;c++){if(h[c])continue;let l=c,m=l;const C=new Set;do h[l]=1,l<m&&(m=l),C.add(l%e),l=l*o%t;while(l!==c&&!h[l]);const D=m%e,L=Array.from(C);for(let P=1;P<L.length;P++)s(L[0],L[P]);u[D]=!0}const a=new Map;let d=0;this.bucketToClass=new Int32Array(e);for(let c=0;c<e;c++){const l=r(c);a.has(l)||a.set(l,d++),this.bucketToClass[c]=a.get(l)}this.numClasses=d,this._cachedN=t,this._cachedW=o,this._cachedC=e,console.log(`LutzColorer: c=${e}, numClasses=${this.numClasses}`)}getLUT(){return{bucketToClass:this.bucketToClass,numClasses:this.numClasses,c:this.c}}}const T=document.getElementById("canvas"),b=T.getContext("webgl2",{alpha:!0,antialias:!1,preserveDrawingBuffer:!0,premultipliedAlpha:!1});if(!b)throw new Error("WebGL2 not supported");const z=new U(b);z.init();const g=new j(T,b);g.init();const A=new V;function x(i,t){for(;t!==0;)[i,t]=[t,i%t];return i}function R(i,t){let o=t+1;for(;x(i,o)!==1;)o++;return o}function I(i,t){let o=t-1;for(;o>1&&x(i,o)!==1;)o--;return o>0?o:1}function k(i,t){let o=1;for(let e=1;e<i;e++)if(o=o*t%i,o===1)return e;return i}let p=255255,v=254,F=12;function _(i,t){p=i,v=t,window.dispatchEvent(new CustomEvent("gp-values-changed",{detail:{n:i,w:t}})),console.log(`n: ${i.toLocaleString()} | w: ${t} | computing d...`);const o=k(i,t);console.log(`d: ${o.toLocaleString()}`);const e=performance.now(),n=z.run(i,t),r=performance.now();g.setPointBuffer(n.buffer,n.numPoints),g.setBounds(n.bounds),g.setLutzParams(i,t,o),g.activeProgram==="lutz"&&E(),g.zoomToFit();const s=performance.now();b.finish();const u=performance.now();console.log(`compute: ${(r-e).toFixed(2)}ms | draw: ${(s-r).toFixed(2)}ms | gpu sync: ${(u-s).toFixed(2)}ms | total: ${(u-e).toFixed(2)}ms`)}function E(){if(p===0||v===0)return;const i=performance.now();A.compute(p,v,F),g.setLutzLUT(A.getLUT());const t=performance.now();console.log(`Lutz LUT: ${(t-i).toFixed(2)}ms`)}function H(i){F=i,g.activeProgram==="lutz"&&(E(),g.draw())}_(255255,254);window.dispatchEvent(new Event("app-ready"));window.renderPoints=_;window.computer=z;window.renderer=g;window.lutzColorer=A;window.gcd=x;window.nextCoprime=R;window.prevCoprime=I;window.order=k;window.updateLutzColoring=E;window.setLutzC=H;window.addEventListener("keydown",i=>{if(!(i.target.tagName==="INPUT"||i.target.tagName==="TEXTAREA")){if(i.key==="n"&&p>0&&v>0){const t=R(p,v);window.renderPoints(p,t)}else if(i.key==="p"&&p>0&&v>1){const t=I(p,v);window.renderPoints(p,t)}}});function w(i){return i&&parseInt(i.getAttribute("data-value")||"0")||0}const S=document.getElementById("nInput"),f=document.getElementById("wInput"),q=document.getElementById("renderBtn"),G=document.getElementById("prevCoprimeBtn"),K=document.getElementById("nextCoprimeBtn"),Z=document.getElementById("pointSizeSlider"),J=document.getElementById("lutzCSlider"),Q=document.getElementById("colorSchemeSelect"),tt=document.getElementById("exportBtn");q?.addEventListener("click",()=>{const i=w(S),t=w(f);i>0&&t>0&&window.renderPoints&&window.renderPoints(i,t)});G?.addEventListener("click",()=>{const i=w(S),t=w(f);if(window.prevCoprime&&window.renderPoints){const o=window.prevCoprime(i,t);if(window.renderPoints(i,o),f){f.setAttribute("data-value",o.toString());const e=f.querySelector(".text-number-value");e&&(e.textContent=o.toString())}}});K?.addEventListener("click",()=>{const i=w(S),t=w(f);if(window.nextCoprime&&window.renderPoints){const o=window.nextCoprime(i,t);if(window.renderPoints(i,o),f){f.setAttribute("data-value",o.toString());const e=f.querySelector(".text-number-value");e&&(e.textContent=o.toString())}}});Z?.addEventListener("change",i=>{const o=(i.detail?.value??15)/10;window.renderer&&(window.renderer.setPointSize(o),window.renderer.draw())});J?.addEventListener("change",i=>{const o=i.detail?.value??12;window.setLutzC&&window.setLutzC(o)});const et=["mono","time","lutz"];Q?.addEventListener("change",i=>{const t=i.detail,o=et[t?.value??0];window.renderer&&(window.renderer.setColorScheme(o),o==="lutz"&&window.updateLutzColoring&&window.updateLutzColoring(),window.renderer.draw())});tt?.addEventListener("click",()=>{const i=document.getElementById("canvas"),t=w(S),o=w(f),e=document.createElement("a"),n=new Date().toISOString().replace(/[:.]/g,"-").slice(0,-5);e.download=`gp-${t}-${o}-${n}.png`,e.href=i.toDataURL("image/png"),e.click()});function B(i,t){if(!i)return;i.setAttribute("data-value",t.toString());const o=i.querySelector(".text-number-value");o&&(o.textContent=t.toString())}window.addEventListener("gp-values-changed",(i=>{const{n:t,w:o}=i.detail;B(S,t),B(f,o)}));
