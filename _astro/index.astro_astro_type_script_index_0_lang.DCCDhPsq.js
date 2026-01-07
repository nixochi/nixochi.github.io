function I(n,t){for(n=Math.abs(n),t=Math.abs(t);t!==0;)[n,t]=[t,n%t];return n}class C{constructor(t){this.gl=t,this.program=null,this.transformFeedback=null,this.indexBuffer=null,this.outBuffer=null,this.maxD=8192,this.normalize=!1}init(){const t=this.gl,e=`#version 300 es
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
`,r=(d,s)=>{const u=t.createShader(d);if(t.shaderSource(u,s),t.compileShader(u),!t.getShaderParameter(u,t.COMPILE_STATUS)){const B=t.getShaderInfoLog(u)||"(no log)";throw t.deleteShader(u),new Error(`Shader compile error: ${B}`)}return u},a=r(t.VERTEX_SHADER,e),c=r(t.FRAGMENT_SHADER,o);if(this.program=t.createProgram(),t.attachShader(this.program,a),t.attachShader(this.program,c),t.transformFeedbackVaryings(this.program,["position"],t.SEPARATE_ATTRIBS),t.linkProgram(this.program),t.deleteShader(a),t.deleteShader(c),!t.getProgramParameter(this.program,t.LINK_STATUS)){const d=t.getProgramInfoLog(this.program)||"(no log)";throw t.deleteProgram(this.program),this.program=null,new Error(`Program link error: ${d}`)}return this.transformFeedback=t.createTransformFeedback(),this}run(t,i){if(I(t,i)!==1)throw new Error("n and w are not coprime");const e=this.gl,o=this.computeOrder(t,i);if(o>this.maxD)throw new Error(`d=${o} exceeds MAX_D=${this.maxD}. Increase maxD (and re-init) or use chunked accumulation.`);this.indexBuffer&&e.deleteBuffer(this.indexBuffer);const r=new Uint32Array(t);for(let v=0;v<t;v++)r[v]=v;this.indexBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW),this.outBuffer&&e.deleteBuffer(this.outBuffer),this.outBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.outBuffer),e.bufferData(e.ARRAY_BUFFER,t*2*4,e.STATIC_DRAW),e.useProgram(this.program);const a=e.getUniformLocation(this.program,"n"),c=e.getUniformLocation(this.program,"w"),d=e.getUniformLocation(this.program,"d"),s=e.getUniformLocation(this.program,"normalize");e.uniform1ui(a,t>>>0),e.uniform1ui(c,i>>>0),e.uniform1i(d,o|0),e.uniform1i(s,this.normalize?1:0);const u=e.getAttribLocation(this.program,"index");if(u<0)throw new Error("Attribute 'index' not found (optimized out?)");e.bindBuffer(e.ARRAY_BUFFER,this.indexBuffer),e.enableVertexAttribArray(u),e.vertexAttribIPointer(u,1,e.UNSIGNED_INT,0,0),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,this.transformFeedback),e.bindBufferBase(e.TRANSFORM_FEEDBACK_BUFFER,0,this.outBuffer),e.enable(e.RASTERIZER_DISCARD),e.beginTransformFeedback(e.POINTS),e.drawArrays(e.POINTS,0,t),e.endTransformFeedback(),e.disable(e.RASTERIZER_DISCARD),e.bindTransformFeedback(e.TRANSFORM_FEEDBACK,null);const w=(this.normalize?1:o)*1.05;return{buffer:this.outBuffer,numPoints:t,bounds:{minX:-w,maxX:w,minY:-w,maxY:w},d:o}}computeOrder(t,i){let e=1;for(let o=1;o<t;o++)if(e=e*i%t,e===1)return o;return t}dispose(){const t=this.gl;this.indexBuffer&&t.deleteBuffer(this.indexBuffer),this.outBuffer&&t.deleteBuffer(this.outBuffer),this.program&&t.deleteProgram(this.program),this.transformFeedback&&t.deleteTransformFeedback(this.transformFeedback),this.indexBuffer=null,this.outBuffer=null,this.program=null,this.transformFeedback=null}}class T{constructor(t){this.canvas=t,this.target=[0,0],this.distance=1,this.rotation=0,this.isDragging=!1,this.mouseX=0,this.mouseY=0,this.prevMouseX=0,this.prevMouseY=0,this.scrollDelta=0,this.scrollMouseX=0,this.scrollMouseY=0,this.onChange=null,this.bindEvents(),this.startLoop()}lookAt(t,i,e=0){this.target=[...t],this.distance=i,this.rotation=e}pan(t,i){const e=this.canvas.width/this.canvas.height;this.target[0]-=t*e*this.distance,this.target[1]-=i*this.distance}zoom(t,i,e){const o=this.canvas.width/this.canvas.height,r=this.target[0]+i*o*this.distance,a=this.target[1]+e*this.distance,c=this.distance*t;this.distance=Math.max(.001,c),this.target[0]=r-i*o*this.distance,this.target[1]=a-e*this.distance}screenToNDC(t,i){const e=this.canvas.getBoundingClientRect();if(e.width===0||e.height===0)return[0,0];const o=(t-e.left)/e.width*2-1,r=-((i-e.top)/e.height*2-1);return[o,r]}tick(){let t=!1;const i=this.canvas.getBoundingClientRect();if(i.width===0||i.height===0)return!1;if(this.isDragging){const e=this.mouseX-this.prevMouseX,o=this.mouseY-this.prevMouseY;if(e!==0||o!==0){const r=e/i.width*2,a=-(o/i.height)*2;this.pan(r,a),t=!0}}if(this.scrollDelta!==0){const[e,o]=this.screenToNDC(this.scrollMouseX,this.scrollMouseY),r=Math.exp(this.scrollDelta/i.height);this.zoom(r,e,o),this.scrollDelta=0,t=!0}return this.prevMouseX=this.mouseX,this.prevMouseY=this.mouseY,t}startLoop(){const t=()=>{this.tick()&&this.onChange&&this.onChange(),this.frameId=requestAnimationFrame(t)};this.frameId=requestAnimationFrame(t)}bindEvents(){this.canvas.addEventListener("mousedown",t=>{t.button===0&&(this.isDragging=!0,this.mouseX=t.clientX,this.mouseY=t.clientY,this.prevMouseX=t.clientX,this.prevMouseY=t.clientY)}),window.addEventListener("mouseup",()=>{this.isDragging=!1}),window.addEventListener("mousemove",t=>{this.mouseX=t.clientX,this.mouseY=t.clientY}),this.canvas.addEventListener("wheel",t=>{t.preventDefault(),this.scrollDelta+=t.deltaY,this.scrollMouseX=t.clientX,this.scrollMouseY=t.clientY},{passive:!1})}getMVP(){const t=this.canvas.width/this.canvas.height,i=1/this.distance,e=-this.target[0],o=-this.target[1],r=Math.cos(this.rotation),a=Math.sin(this.rotation),c=i/t,d=i,s=new Float32Array(16);return s[0]=c*r,s[1]=d*a,s[2]=0,s[3]=0,s[4]=c*-a,s[5]=d*r,s[6]=0,s[7]=0,s[8]=0,s[9]=0,s[10]=1,s[11]=0,s[12]=c*(r*e-a*o),s[13]=d*(a*e+r*o),s[14]=0,s[15]=1,s}dispose(){this.frameId&&cancelAnimationFrame(this.frameId)}}const D=`#version 300 es
  in vec2 position;
  uniform mat4 mvp;
  uniform float pointSize;

  void main() {
    gl_Position = mvp * vec4(position, 0.0, 1.0);
    gl_PointSize = pointSize;
  }
`,_=`#version 300 es
  precision mediump float;
  out vec4 fragColor;

  void main() {
    // Circle SDF for anti-aliased points
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float dist = length(c);
    if (dist > 1.0) discard;

    float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
    fragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;class M{constructor(t,i){this.canvas=t,this.gl=i,this.program=null,this.buffer=null,this.numPoints=0,this.bounds=null,this.camera=null,this.pointSize=1.5,this.positionLocation=null,this.mvpLocation=null,this.pointSizeLocation=null}init(){const t=this.gl,i=t.createShader(t.VERTEX_SHADER);if(t.shaderSource(i,D),t.compileShader(i),!t.getShaderParameter(i,t.COMPILE_STATUS))throw new Error("Vertex shader error: "+t.getShaderInfoLog(i));const e=t.createShader(t.FRAGMENT_SHADER);if(t.shaderSource(e,_),t.compileShader(e),!t.getShaderParameter(e,t.COMPILE_STATUS))throw new Error("Fragment shader error: "+t.getShaderInfoLog(e));if(this.program=t.createProgram(),t.attachShader(this.program,i),t.attachShader(this.program,e),t.linkProgram(this.program),!t.getProgramParameter(this.program,t.LINK_STATUS))throw new Error("Program link error: "+t.getProgramInfoLog(this.program));return this.positionLocation=t.getAttribLocation(this.program,"position"),this.mvpLocation=t.getUniformLocation(this.program,"mvp"),this.pointSizeLocation=t.getUniformLocation(this.program,"pointSize"),t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),this.camera=new T(this.canvas),this.camera.onChange=()=>this.draw(),this.resize(),window.addEventListener("resize",()=>this.resize()),this}resize(){this.canvas.width=window.innerWidth,this.canvas.height=window.innerHeight,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.draw()}setPointBuffer(t,i){this.buffer=t,this.numPoints=i}setBounds(t){this.bounds=t}setPointSize(t){this.pointSize=t}zoomToFit(){if(!this.camera||!this.bounds)return;const{minX:t,maxX:i,minY:e,maxY:o}=this.bounds,r=(t+i)/2,a=(e+o)/2,c=i-t||1,d=o-e||1,s=Math.max(c,d)*.6;this.camera.lookAt([r,a],s),this.draw()}draw(){if(!this.gl||this.numPoints===0)return;const t=this.gl;t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(this.program),t.uniformMatrix4fv(this.mvpLocation,!1,this.camera.getMVP()),t.uniform1f(this.pointSizeLocation,this.pointSize),t.bindBuffer(t.ARRAY_BUFFER,this.buffer),t.enableVertexAttribArray(this.positionLocation),t.vertexAttribPointer(this.positionLocation,2,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,this.numPoints)}dispose(){this.camera&&this.camera.dispose(),this.buffer&&this.gl.deleteBuffer(this.buffer),this.program&&this.gl.deleteProgram(this.program)}}const x=document.getElementById("canvas"),S=x.getContext("webgl2",{alpha:!0,antialias:!1,preserveDrawingBuffer:!0,premultipliedAlpha:!1});if(!S)throw new Error("WebGL2 not supported");const A=new C(S);A.init();const g=new M(x,S);g.init();function E(n,t){for(;t!==0;)[n,t]=[t,n%t];return n}function P(n,t){let i=t+1;for(;E(n,i)!==1;)i++;return i}function R(n,t){let i=t-1;for(;i>1&&E(n,i)!==1;)i--;return i>0?i:1}function L(n,t){let i=1;for(let e=1;e<n;e++)if(i=i*t%n,i===1)return e;return n}let m=255255,f=254;function F(n,t){m=n,f=t,window.dispatchEvent(new CustomEvent("gp-values-changed",{detail:{n,w:t}})),console.log(`n: ${n.toLocaleString()} | w: ${t} | computing d...`);const i=L(n,t);console.log(`d: ${i.toLocaleString()}`);const e=performance.now(),o=A.run(n,t),r=performance.now();g.setPointBuffer(o.buffer,o.numPoints),g.setBounds(o.bounds),g.zoomToFit();const a=performance.now();S.finish();const c=performance.now();console.log(`compute: ${(r-e).toFixed(2)}ms | draw: ${(a-r).toFixed(2)}ms | gpu sync: ${(c-a).toFixed(2)}ms | total: ${(c-e).toFixed(2)}ms`)}F(255255,254);window.dispatchEvent(new Event("app-ready"));window.renderPoints=F;window.computer=A;window.renderer=g;window.gcd=E;window.nextCoprime=P;window.prevCoprime=R;window.order=L;window.addEventListener("keydown",n=>{if(!(n.target.tagName==="INPUT"||n.target.tagName==="TEXTAREA")){if(n.key==="n"&&m>0&&f>0){const t=P(m,f);window.renderPoints(m,t)}else if(n.key==="p"&&m>0&&f>1){const t=R(m,f);window.renderPoints(m,t)}}});function l(n){return n&&parseInt(n.getAttribute("data-value")||"0")||0}const p=document.getElementById("nInput"),h=document.getElementById("wInput"),k=document.getElementById("renderBtn"),X=document.getElementById("prevCoprimeBtn"),Y=document.getElementById("nextCoprimeBtn"),y=document.getElementById("pointSizeSlider"),z=document.getElementById("exportBtn");k?.addEventListener("click",()=>{const n=l(p),t=l(h);n>0&&t>0&&window.renderPoints&&window.renderPoints(n,t)});X?.addEventListener("click",()=>{const n=l(p),t=l(h);if(window.prevCoprime&&window.renderPoints){const i=window.prevCoprime(n,t);if(window.renderPoints(n,i),h){h.setAttribute("data-value",i.toString());const e=h.querySelector(".text-number-value");e&&(e.textContent=i.toString())}}});Y?.addEventListener("click",()=>{const n=l(p),t=l(h);if(window.nextCoprime&&window.renderPoints){const i=window.nextCoprime(n,t);if(window.renderPoints(n,i),h){h.setAttribute("data-value",i.toString());const e=h.querySelector(".text-number-value");e&&(e.textContent=i.toString())}}});y?.addEventListener("change",n=>{const i=(n.detail?.value??15)/10;window.renderer&&(window.renderer.setPointSize(i),window.renderer.draw())});z?.addEventListener("click",()=>{const n=document.getElementById("canvas"),t=l(p),i=l(h),e=document.createElement("a"),o=new Date().toISOString().replace(/[:.]/g,"-").slice(0,-5);e.download=`gp-${t}-${i}-${o}.png`,e.href=n.toDataURL("image/png"),e.click()});function b(n,t){if(!n)return;n.setAttribute("data-value",t.toString());const i=n.querySelector(".text-number-value");i&&(i.textContent=t.toString())}window.addEventListener("gp-values-changed",(n=>{const{n:t,w:i}=n.detail;b(p,t),b(h,i)}));
