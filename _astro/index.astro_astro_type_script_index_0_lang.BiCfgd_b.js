function U(o,t){for(o=Math.abs(o),t=Math.abs(t);t!==0;)[o,t]=[t,o%t];return o}class X{constructor(t){this.gl=t,this.program=null,this.transformFeedback=null,this.indexBuffer=null,this.outBuffer=null,this.maxD=8192,this.normalize=!1}init(){const t=this.gl,e=`#version 300 es
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
`,s=(c,r)=>{const m=t.createShader(c);if(t.shaderSource(m,r),t.compileShader(m),!t.getShaderParameter(m,t.COMPILE_STATUS)){const l=t.getShaderInfoLog(m)||"(no log)";throw t.deleteShader(m),new Error(`Shader compile error: ${l}`)}return m},a=s(t.VERTEX_SHADER,e),u=s(t.FRAGMENT_SHADER,n);if(this.program=t.createProgram(),t.attachShader(this.program,a),t.attachShader(this.program,u),t.transformFeedbackVaryings(this.program,["position"],t.SEPARATE_ATTRIBS),t.linkProgram(this.program),t.deleteShader(a),t.deleteShader(u),!t.getProgramParameter(this.program,t.LINK_STATUS)){const c=t.getProgramInfoLog(this.program)||"(no log)";throw t.deleteProgram(this.program),this.program=null,new Error(`Program link error: ${c}`)}return this.transformFeedback=t.createTransformFeedback(),this}run(t,i){if(U(t,i)!==1)throw new Error("n and w are not coprime");const e=this.gl,n=this.computeOrder(t,i);if(n>this.maxD)throw new Error(`d=${n} exceeds MAX_D=${this.maxD}. Increase maxD (and re-init) or use chunked accumulation.`);this.indexBuffer&&e.deleteBuffer(this.indexBuffer);const s=new Uint32Array(t);for(let f=0;f<t;f++)s[f]=f;this.indexBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.bufferData(e.ARRAY_BUFFER,s,e.STATIC_DRAW),this.outBuffer&&e.deleteBuffer(this.outBuffer),this.outBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.outBuffer),e.bufferData(e.ARRAY_BUFFER,t*2*4,e.STATIC_DRAW),e.useProgram(this.program);const a=e.getUniformLocation(this.program,"n"),u=e.getUniformLocation(this.program,"w"),c=e.getUniformLocation(this.program,"d"),r=e.getUniformLocation(this.program,"normalize");e.uniform1ui(a,t>>>0),e.uniform1ui(u,i>>>0),e.uniform1i(c,n|0),e.uniform1i(r,this.normalize?1:0);const m=e.getAttribLocation(this.program,"index");if(m<0)throw new Error("Attribute 'index' not found (optimized out?)");e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.enableVertexAttribArray(m),e.vertexAttribIPointer(m,1,e.UNSIGNED_INT,0,0),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,this.transformFeedback),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,0,this.outBuffer),e.enable(e.RASTERIZER_DISCARD),e.beginTransformFeedback(e.POINTS),e.drawArrays(e.POINTS,0,t),e.endTransformFeedback(),e.disable(e.RASTERIZER_DISCARD),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,null);const d=(this.normalize?1:n)*1.05;return{buffer:this.outBuffer,numPoints:t,bounds:{minX:-d,maxX:d,minY:-d,maxY:d},d:n}}computeOrder(t,i){let e=1;for(let n=1;n<t;n++)if(e=e*i%t,e===1)return n;return t}dispose(){const t=this.gl;this.indexBuffer&&t.deleteBuffer(this.indexBuffer),this.outBuffer&&t.deleteBuffer(this.outBuffer),this.program&&t.deleteProgram(this.program),this.transformFeedback&&t.deleteTransformFeedback(this.transformFeedback),this.indexBuffer=null,this.outBuffer=null,this.program=null,this.transformFeedback=null}}class Y{constructor(t){this.canvas=t,this.target=[0,0],this.distance=1,this.rotation=0,this.isDragging=!1,this.mouseX=0,this.mouseY=0,this.prevMouseX=0,this.prevMouseY=0,this.scrollDelta=0,this.scrollMouseX=0,this.scrollMouseY=0,this.onChange=null,this.bindEvents(),this.startLoop()}lookAt(t,i,e=0){this.target=[...t],this.distance=i,this.rotation=e}pan(t,i){const e=this.canvas.width/this.canvas.height;this.target[0]-=t*e*this.distance,this.target[1]-=i*this.distance}zoom(t,i,e){const n=this.canvas.width/this.canvas.height,s=this.target[0]+i*n*this.distance,a=this.target[1]+e*this.distance,u=this.distance*t;this.distance=Math.max(.001,u),this.target[0]=s-i*n*this.distance,this.target[1]=a-e*this.distance}screenToNDC(t,i){const e=this.canvas.getBoundingClientRect();if(e.width===0||e.height===0)return[0,0];const n=(t-e.left)/e.width*2-1,s=-((i-e.top)/e.height*2-1);return[n,s]}tick(){let t=!1;const i=this.canvas.getBoundingClientRect();if(i.width===0||i.height===0)return!1;if(this.isDragging){const e=this.mouseX-this.prevMouseX,n=this.mouseY-this.prevMouseY;if(e!==0||n!==0){const s=e/i.width*2,a=-(n/i.height)*2;this.pan(s,a),t=!0}}if(this.scrollDelta!==0){const[e,n]=this.screenToNDC(this.scrollMouseX,this.scrollMouseY),s=Math.exp(this.scrollDelta/i.height);this.zoom(s,e,n),this.scrollDelta=0,t=!0}return this.prevMouseX=this.mouseX,this.prevMouseY=this.mouseY,t}startLoop(){const t=()=>{this.tick()&&this.onChange&&this.onChange(),this.frameId=requestAnimationFrame(t)};this.frameId=requestAnimationFrame(t)}bindEvents(){this.canvas.addEventListener("mousedown",t=>{t.button===0&&(this.isDragging=!0,this.mouseX=t.clientX,this.mouseY=t.clientY,this.prevMouseX=t.clientX,this.prevMouseY=t.clientY)}),window.addEventListener("mouseup",()=>{this.isDragging=!1}),window.addEventListener("mousemove",t=>{this.mouseX=t.clientX,this.mouseY=t.clientY}),this.canvas.addEventListener("wheel",t=>{t.preventDefault(),this.scrollDelta+=t.deltaY,this.scrollMouseX=t.clientX,this.scrollMouseY=t.clientY},{passive:!1})}getMVP(){const t=this.canvas.width/this.canvas.height,i=1/this.distance,e=-this.target[0],n=-this.target[1],s=Math.cos(this.rotation),a=Math.sin(this.rotation),u=i/t,c=i,r=new Float32Array(16);return r[0]=u*s,r[1]=c*a,r[2]=0,r[3]=0,r[4]=u*-a,r[5]=c*s,r[6]=0,r[7]=0,r[8]=0,r[9]=0,r[10]=1,r[11]=0,r[12]=u*(s*e-a*n),r[13]=c*(a*e+s*n),r[14]=0,r[15]=1,r}dispose(){this.frameId&&cancelAnimationFrame(this.frameId)}}const N=`#version 300 es
in vec2 position;
uniform mat4 mvp;
uniform float pointSize;

void main() {
  gl_Position = mvp * vec4(position, 0.0, 1.0);
  gl_PointSize = pointSize;
}
`,$=`#version 300 es
precision mediump float;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float dist = length(c);
  if (dist > 1.0) discard;

  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
  fragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`,O=`#version 300 es
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
`,W=`#version 300 es
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
`,j=`#version 300 es
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
`,V=`#version 300 es
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
`;class H{constructor(t,i){this.canvas=t,this.gl=i,this.buffer=null,this.numPoints=0,this.bounds=null,this.camera=null,this.pointSize=1.5,this.programs={},this.activeProgram="mono",this.colorFirst=[0,0,1],this.colorLast=[0,1,0],this.lutzN=0,this.lutzW=0,this.lutzD=0,this.lutzC=12,this.lutzNumClasses=0,this.lutzBucketToClass=new Int32Array(256),this.animationId=null,this.visiblePoints=0,this.animating=!1}compileProgram(t,i){const e=this.gl,n=e.createShader(e.VERTEX_SHADER);if(e.shaderSource(n,t),e.compileShader(n),!e.getShaderParameter(n,e.COMPILE_STATUS))throw new Error("Vertex shader error: "+e.getShaderInfoLog(n));const s=e.createShader(e.FRAGMENT_SHADER);if(e.shaderSource(s,i),e.compileShader(s),!e.getShaderParameter(s,e.COMPILE_STATUS))throw new Error("Fragment shader error: "+e.getShaderInfoLog(s));const a=e.createProgram();if(e.attachShader(a,n),e.attachShader(a,s),e.linkProgram(a),e.deleteShader(n),e.deleteShader(s),!e.getProgramParameter(a,e.LINK_STATUS))throw new Error("Program link error: "+e.getProgramInfoLog(a));return a}init(){const t=this.gl,i=this.compileProgram(N,$);this.programs.mono={program:i,position:t.getAttribLocation(i,"position"),mvp:t.getUniformLocation(i,"mvp"),pointSize:t.getUniformLocation(i,"pointSize")};const e=this.compileProgram(O,W);this.programs.time={program:e,position:t.getAttribLocation(e,"position"),mvp:t.getUniformLocation(e,"mvp"),pointSize:t.getUniformLocation(e,"pointSize"),numPoints:t.getUniformLocation(e,"numPoints"),colorFirst:t.getUniformLocation(e,"colorFirst"),colorLast:t.getUniformLocation(e,"colorLast")};const n=this.compileProgram(j,V);return this.programs.lutz={program:n,position:t.getAttribLocation(n,"position"),mvp:t.getUniformLocation(n,"mvp"),pointSize:t.getUniformLocation(n,"pointSize"),c:t.getUniformLocation(n,"c"),numClasses:t.getUniformLocation(n,"numClasses"),bucketToClass:t.getUniformLocation(n,"bucketToClass")},t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),this.camera=new Y(this.canvas),this.camera.onChange=()=>this.draw(),this.resize(),window.addEventListener("resize",()=>this.resize()),this}resize(){this.canvas.width=window.innerWidth,this.canvas.height=window.innerHeight,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.draw()}setPointBuffer(t,i){this.stopAnimation(),this.buffer=t,this.numPoints=i,this.visiblePoints=i}setBounds(t){this.bounds=t}setPointSize(t){this.pointSize=t}setColorScheme(t){this.programs[t]&&(this.activeProgram=t)}setTimeColors(t,i){this.colorFirst=t,this.colorLast=i}hexToRgb(t){const i=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return i?[parseInt(i[1],16)/255,parseInt(i[2],16)/255,parseInt(i[3],16)/255]:[1,1,1]}setTimeColorsHex(t,i){this.colorFirst=this.hexToRgb(t),this.colorLast=this.hexToRgb(i)}setLutzParams(t,i,e){this.lutzN=t,this.lutzW=i,this.lutzD=e}setLutzLUT(t){this.lutzC=t.c,this.lutzNumClasses=t.numClasses;for(let i=0;i<t.c&&i<256;i++)this.lutzBucketToClass[i]=t.bucketToClass[i]}stopAnimation(){this.animationId!==null&&(cancelAnimationFrame(this.animationId),this.animationId=null),this.animating=!1}animateIn(t=2e3,i="easeOut"){if(this.stopAnimation(),this.numPoints===0)return;console.log("animateIn called, numPoints:",this.numPoints,"duration:",t),this.animating=!0,this.visiblePoints=0;const e=performance.now(),n=this.numPoints,s={linear:c=>c,easeOut:c=>1-Math.pow(1-c,3),easeInOut:c=>c<.5?4*c*c*c:1-Math.pow(-2*c+2,3)/2},a=s[i]||s.easeOut,u=()=>{if(!this.animating)return;const c=performance.now()-e,r=Math.min(c/t,1),m=a(r);this.visiblePoints=Math.floor(m*n),this.draw(),r<1?this.animationId=requestAnimationFrame(u):(this.visiblePoints=n,this.animating=!1,this.animationId=null)};this.animationId=requestAnimationFrame(u)}zoomToFit(){if(!this.camera||!this.bounds)return;const{minX:t,maxX:i,minY:e,maxY:n}=this.bounds,s=(t+i)/2,a=(e+n)/2,u=i-t||1,c=n-e||1,r=Math.max(u,c)*.6;this.camera.lookAt([s,a],r),this.draw()}draw(){if(!this.gl||this.numPoints===0)return;const t=this.gl,i=this.programs[this.activeProgram];t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(i.program),t.uniformMatrix4fv(i.mvp,!1,this.camera.getMVP()),t.uniform1f(i.pointSize,this.pointSize),this.activeProgram==="time"&&(t.uniform1i(i.numPoints,this.numPoints),t.uniform3fv(i.colorFirst,this.colorFirst),t.uniform3fv(i.colorLast,this.colorLast)),this.activeProgram==="lutz"&&(t.uniform1i(i.c,this.lutzC),t.uniform1i(i.numClasses,this.lutzNumClasses),t.uniform1iv(i.bucketToClass,this.lutzBucketToClass)),t.bindBuffer(t.ARRAY_BUFFER,this.buffer),t.enableVertexAttribArray(i.position),t.vertexAttribPointer(i.position,2,t.FLOAT,!1,0,0);const e=this.animating?this.visiblePoints:this.numPoints;t.drawArrays(t.POINTS,0,e)}dispose(){this.stopAnimation(),this.camera&&this.camera.dispose(),this.buffer&&this.gl.deleteBuffer(this.buffer);for(const t in this.programs)this.gl.deleteProgram(this.programs[t].program)}}class q{constructor(){this.bucketToClass=null,this.numClasses=0,this.c=12,this._cachedN=null,this._cachedW=null,this._cachedC=null}compute(t,i,e){if(t===this._cachedN&&i===this._cachedW&&e===this._cachedC)return;this.c=e;const n=new Int32Array(e);for(let l=0;l<e;l++)n[l]=l;const s=l=>(n[l]!==l&&(n[l]=s(n[l])),n[l]),a=(l,d)=>{const f=s(l),C=s(d);f!==C&&(n[f]=C)},u=new Array(e).fill(!1),c=new Uint8Array(t);for(let l=0;l<t;l++){if(c[l])continue;let d=l,f=d;const C=new Set;do c[d]=1,d<f&&(f=d),C.add(d%e),d=d*i%t;while(d!==l&&!c[d]);const M=f%e,P=Array.from(C);for(let L=1;L<P.length;L++)a(P[0],P[L]);u[M]=!0}const r=new Map;let m=0;this.bucketToClass=new Int32Array(e);for(let l=0;l<e;l++){const d=s(l);r.has(d)||r.set(d,m++),this.bucketToClass[l]=r.get(d)}this.numClasses=m,this._cachedN=t,this._cachedW=i,this._cachedC=e,console.log(`LutzColorer: c=${e}, numClasses=${this.numClasses}`)}getLUT(){return{bucketToClass:this.bucketToClass,numClasses:this.numClasses,c:this.c}}}const I=document.getElementById("canvas"),A=I.getContext("webgl2",{alpha:!0,antialias:!1,preserveDrawingBuffer:!0,premultipliedAlpha:!1});if(!A)throw new Error("WebGL2 not supported");const z=new X(A);z.init();const h=new H(I,A);h.init();const E=new q;function x(o,t){for(;t!==0;)[o,t]=[t,o%t];return o}function F(o,t){let i=t+1;for(;x(o,i)!==1;)i++;return i}function R(o,t){let i=t-1;for(;i>1&&x(o,i)!==1;)i--;return i>0?i:1}function k(o,t){let i=1;for(let e=1;e<o;e++)if(i=i*t%o,i===1)return e;return o}let p=255255,v=254,_=12,D=!1,S=2e3;function y(o,t){p=o,v=t,window.dispatchEvent(new CustomEvent("gp-values-changed",{detail:{n:o,w:t}})),console.log(`n: ${o.toLocaleString()} | w: ${t} | computing d...`);const i=k(o,t);console.log(`d: ${i.toLocaleString()}`);const e=performance.now(),n=z.run(o,t),s=performance.now();h.setPointBuffer(n.buffer,n.numPoints),h.setBounds(n.bounds),h.setLutzParams(o,t,i),h.activeProgram==="lutz"&&B(),h.zoomToFit(),D&&(console.log("Starting animation, duration:",S),h.animateIn(S));const a=performance.now();A.finish();const u=performance.now();console.log(`compute: ${(s-e).toFixed(2)}ms | draw: ${(a-s).toFixed(2)}ms | gpu sync: ${(u-a).toFixed(2)}ms | total: ${(u-e).toFixed(2)}ms`)}function B(){if(p===0||v===0)return;const o=performance.now();E.compute(p,v,_),h.setLutzLUT(E.getLUT());const t=performance.now();console.log(`Lutz LUT: ${(t-o).toFixed(2)}ms`)}function G(o){_=o,h.activeProgram==="lutz"&&(B(),h.draw())}function K(o){D=o,console.log("Animation enabled:",o)}function Z(o){S=o}function J(){h.animateIn(S)}y(255255,254);window.dispatchEvent(new Event("app-ready"));window.renderPoints=y;window.computer=z;window.renderer=h;window.lutzColorer=E;window.gcd=x;window.nextCoprime=F;window.prevCoprime=R;window.order=k;window.updateLutzColoring=B;window.setLutzC=G;window.setAnimateEnabled=K;window.setAnimationDuration=Z;window.triggerAnimation=J;window.addEventListener("keydown",o=>{if(!(o.target.tagName==="INPUT"||o.target.tagName==="TEXTAREA")){if(o.key==="n"&&p>0&&v>0){const t=F(p,v);window.renderPoints(p,t)}else if(o.key==="p"&&p>0&&v>1){const t=R(p,v);window.renderPoints(p,t)}}});function w(o){return o&&parseInt(o.getAttribute("data-value")||"0")||0}const b=document.getElementById("nInput"),g=document.getElementById("wInput"),Q=document.getElementById("renderBtn"),tt=document.getElementById("prevCoprimeBtn"),et=document.getElementById("nextCoprimeBtn"),it=document.getElementById("pointSizeSlider"),ot=document.getElementById("lutzCSlider"),nt=document.getElementById("colorSchemeSelect"),st=document.getElementById("animateToggle"),rt=document.getElementById("animDurationSlider"),at=document.getElementById("exportBtn");Q?.addEventListener("click",()=>{const o=w(b),t=w(g);o>0&&t>0&&window.renderPoints&&window.renderPoints(o,t)});tt?.addEventListener("click",()=>{const o=w(b),t=w(g);if(window.prevCoprime&&window.renderPoints){const i=window.prevCoprime(o,t);if(window.renderPoints(o,i),g){g.setAttribute("data-value",i.toString());const e=g.querySelector(".text-number-value");e&&(e.textContent=i.toString())}}});et?.addEventListener("click",()=>{const o=w(b),t=w(g);if(window.nextCoprime&&window.renderPoints){const i=window.nextCoprime(o,t);if(window.renderPoints(o,i),g){g.setAttribute("data-value",i.toString());const e=g.querySelector(".text-number-value");e&&(e.textContent=i.toString())}}});it?.addEventListener("change",o=>{const i=(o.detail?.value??15)/10;window.renderer&&(window.renderer.setPointSize(i),window.renderer.draw())});ot?.addEventListener("change",o=>{const i=o.detail?.value??12;window.setLutzC&&window.setLutzC(i)});const ct=["mono","time","lutz"];nt?.addEventListener("change",o=>{const t=o.detail,i=ct[t?.value??0];window.renderer&&(window.renderer.setColorScheme(i),i==="lutz"&&window.updateLutzColoring&&window.updateLutzColoring(),window.renderer.draw())});st?.addEventListener("change",o=>{const i=o.detail?.checked??!1;window.setAnimateEnabled&&window.setAnimateEnabled(i)});rt?.addEventListener("change",o=>{const i=o.detail?.value??2;window.setAnimationDuration&&window.setAnimationDuration(i*1e3)});at?.addEventListener("click",()=>{const o=document.getElementById("canvas"),t=w(b),i=w(g),e=document.createElement("a"),n=new Date().toISOString().replace(/[:.]/g,"-").slice(0,-5);e.download=`gp-${t}-${i}-${n}.png`,e.href=o.toDataURL("image/png"),e.click()});function T(o,t){if(!o)return;o.setAttribute("data-value",t.toString());const i=o.querySelector(".text-number-value");i&&(i.textContent=t.toString())}window.addEventListener("gp-values-changed",(o=>{const{n:t,w:i}=o.detail;T(b,t),T(g,i)}));
