function U(e){let t;try{t=e.getContext("webgl2",{antialias:!0,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!0})}catch{}if(!t)throw new Error("WebGL2 not available in this browser.");if(!t.getExtension("EXT_color_buffer_float"))throw new Error("Missing EXT_color_buffer_float extension.");return console.log("✅ WebGL2 initialized with half-float support"),t}function _(e,t,i){const s=e.createShader(t);if(e.shaderSource(s,i),e.compileShader(s),!e.getShaderParameter(s,e.COMPILE_STATUS)){const n=e.getShaderInfoLog(s);throw new Error("Shader compile error: "+n)}return s}function P(e,t,i){const s=e.createProgram();if(e.attachShader(s,_(e,e.VERTEX_SHADER,t)),e.attachShader(s,_(e,e.FRAGMENT_SHADER,i)),e.linkProgram(s),!e.getProgramParameter(s,e.LINK_STATUS)){const n=e.getProgramInfoLog(s);throw new Error("Program link error: "+n)}return s}function T(e,t,i){const s=e.createTexture();return e.bindTexture(e.TEXTURE_2D,s),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,t,i,0,e.RGBA,e.FLOAT,null),s}function R(e,t){const i=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,i),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),!(e.checkFramebufferStatus(e.FRAMEBUFFER)===e.FRAMEBUFFER_COMPLETE))throw new Error("Framebuffer incomplete.");return e.bindFramebuffer(e.FRAMEBUFFER,null),i}function A(e,t,i){e.activeTexture(e.TEXTURE0+i),e.bindTexture(e.TEXTURE_2D,t)}function D(e){let t=1;for(;t<e;)t<<=1;return t}const F=`#version 300 es
precision highp float;
out vec2 v_uv;
void main(){
  uint id = uint(gl_VertexID);
  vec2 p = vec2(float((id<<1u)&2u), float(id&2u));
  v_uv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`,k=`#version 300 es
precision mediump float;
out vec4 outColor;
void main(){ outColor = vec4(-1.0, -1.0, -1.0, 0.0); }`,V=`#version 300 es
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
}`,z=`#version 300 es
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
}`,w=4096;function M(e){const t=parseInt(e.slice(1,3),16),i=parseInt(e.slice(3,5),16),s=parseInt(e.slice(5,7),16);return{r:t,g:i,b:s}}function p(e,t){const i=t*(e.length-1),s=Math.floor(i),n=Math.min(s+1,e.length-1),r=i-s,o=M(e[s]),a=M(e[n]);return{r:Math.round(o.r+(a.r-o.r)*r),g:Math.round(o.g+(a.g-o.g)*r),b:Math.round(o.b+(a.b-o.b)*r)}}const y=[{id:"vibrant",name:"Vibrant",colors:["#dc143c","#1e90ff","#ffd700","#32cd32","#ff8c00"],baseColors:["#dc143c","#1e90ff","#ffd700","#32cd32","#ff8c00","#9370db","#dc143c"],edgeColor:[.1,.1,.1],generator:(e,t)=>{const i=e*.61803398875%1;return p(t.baseColors,i)}},{id:"xochi",name:"Xochi",colors:["#1a1d23","#2d1b3d","#1e3a3a","#3d2d4a","#4b5563"],baseColors:["#0f1115","#1a1d23","#2d1b3d","#1e2833","#1e3a3a","#2d3340","#3d2d4a","#374151","#4b5563","#3d2d4a","#1e3a3a","#2d1b3d","#1a1d23"],edgeColor:[.3,.25,.35],generator:(e,t)=>{const i=e*.61803398875%1;return p(t.baseColors,i)}},{id:"metallic",name:"Metallic",colors:["#3a3a3a","#4a4a2a","#2f2f2f","#3d3d2d","#454545"],baseColors:["#1a1a1a","#2a2a2a","#3a3a3a","#4a4a2a","#3d3d2d","#2f2f2f","#454545","#3a3a3a","#2a2a2a","#1a1a1a"],edgeColor:[.6,.6,.6],generator:(e,t)=>{const i=e*.61803398875%1;return p(t.baseColors,i)}},{id:"greyscale",name:"Greyscale",colors:["#0a0a0a","#1a1a1a","#2a2a2a","#3a3a3a","#4a4a4a"],baseColors:["#050505","#0a0a0a","#141414","#1f1f1f","#292929","#333333","#3d3d3d","#474747","#525252","#5c5c5c"],edgeColor:[.75,.75,.75],generator:(e,t)=>{const i=e*.61803398875%1;return p(t.baseColors,i)}},{id:"ocean",name:"Ocean",colors:["#06d6a0","#118ab2","#073b4c","#05668d","#028090"],baseColors:["#06d6a0","#118ab2","#073b4c","#05668d","#028090","#00a896","#06d6a0"],edgeColor:[.02,.15,.2],generator:(e,t)=>{const i=e*.61803398875%1;return p(t.baseColors,i)}},{id:"forest",name:"Forest",colors:["#2d6a4f","#52b788","#95d5b2","#d8f3dc","#b7e4c7"],baseColors:["#1b4332","#2d6a4f","#40916c","#52b788","#74c69d","#95d5b2","#b7e4c7","#d8f3dc","#95d5b2","#52b788","#2d6a4f"],edgeColor:[.08,.2,.15],generator:(e,t)=>{const i=e*.61803398875%1;return p(t.baseColors,i)}}];function I(e,t="golden"){const i=y.find(r=>r.id===t)||y[0],s=e.createTexture();e.bindTexture(e.TEXTURE_2D,s),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const n=new Uint8Array(w*4);for(let r=0;r<w;r++){const o=i.generator(r,i);n[r*4+0]=o.r,n[r*4+1]=o.g,n[r*4+2]=o.b,n[r*4+3]=255}return e.texImage2D(e.TEXTURE_2D,0,e.RGBA,w,1,0,e.RGBA,e.UNSIGNED_BYTE,n),s}class X{constructor(t,i){this.gl=t,this.canvas=i,this.progJFA=null,this.progRender=null,this.progClear=null,this.texA=null,this.texB=null,this.fboA=null,this.fboB=null,this.paletteTex=null,this.jfa=null,this.rnd=null,this.quadVAO=null,this.jfaExtraPasses=1,this.currentPaletteId="golden",this.setup()}setup(){const t=this.gl;this.progJFA=P(t,F,V),this.progRender=P(t,F,z),this.progClear=P(t,F,k);const i=this.canvas.width,s=this.canvas.height;this.texA=T(t,i,s),this.texB=T(t,i,s),this.fboA=R(t,this.texA),this.fboB=R(t,this.texB),this.paletteTex=I(t,this.currentPaletteId),this.jfa={p:this.progJFA,loc:{uSeedTex:t.getUniformLocation(this.progJFA,"uSeedTex"),uTexel:t.getUniformLocation(this.progJFA,"uTexel"),uStep:t.getUniformLocation(this.progJFA,"uStep"),uResolution:t.getUniformLocation(this.progJFA,"uResolution"),uP:t.getUniformLocation(this.progJFA,"uP"),uUseInf:t.getUniformLocation(this.progJFA,"uUseInf")}},this.rnd={p:this.progRender,loc:{uSeedTex:t.getUniformLocation(this.progRender,"uSeedTex"),uPalette:t.getUniformLocation(this.progRender,"uPalette"),uResolution:t.getUniformLocation(this.progRender,"uResolution"),uPaletteSize:t.getUniformLocation(this.progRender,"uPaletteSize"),uEdges:t.getUniformLocation(this.progRender,"uEdges"),uShowSites:t.getUniformLocation(this.progRender,"uShowSites"),uP:t.getUniformLocation(this.progRender,"uP"),uUseInf:t.getUniformLocation(this.progRender,"uUseInf"),uResolutionScale:t.getUniformLocation(this.progRender,"uResolutionScale"),uEdgeColor:t.getUniformLocation(this.progRender,"uEdgeColor")}},this.quadVAO=t.createVertexArray(),console.log("✅ JFA algorithm setup complete")}writeSeedPixels(t){const i=this.gl,s=this.canvas.width,n=this.canvas.height,r=new Float32Array(s*n*4);for(let o=0;o<r.length;o+=4)r[o]=-1,r[o+1]=-1,r[o+2]=-1,r[o+3]=0;for(let o=0;o<t.length;o++){const a=Math.max(0,Math.min(s-1,Math.round(t[o].x))),c=Math.max(0,Math.min(n-1,Math.round(t[o].y))),l=n-1-c,h=(l*s+a)*4;r[h]=a,r[h+1]=l,r[h+2]=o,r[h+3]=1}i.bindTexture(i.TEXTURE_2D,this.texA),i.texImage2D(i.TEXTURE_2D,0,i.RGBA32F,s,n,0,i.RGBA,i.FLOAT,r)}compute(t,i,s){if(t.length===0)return;const n=this.gl,r=this.canvas.width,o=this.canvas.height;n.viewport(0,0,r,o),this.writeSeedPixels(t);const a=Math.max(r,o);let c=D(a);for(n.bindVertexArray(this.quadVAO),n.useProgram(this.progJFA),n.uniform2f(this.jfa.loc.uTexel,1/r,1/o),n.uniform2f(this.jfa.loc.uResolution,r,o),n.uniform1i(this.jfa.loc.uSeedTex,0),n.uniform1f(this.jfa.loc.uP,i),n.uniform1i(this.jfa.loc.uUseInf,s?1:0);c>=1;){n.uniform1f(this.jfa.loc.uStep,c),n.bindFramebuffer(n.FRAMEBUFFER,this.fboB),n.drawBuffers([n.COLOR_ATTACHMENT0]),A(n,this.texA,0),n.drawArrays(n.TRIANGLES,0,3);let l=this.texA;this.texA=this.texB,this.texB=l;let h=this.fboA;this.fboA=this.fboB,this.fboB=h,c>>=1}for(let l=this.jfaExtraPasses;l>=1;l--){n.uniform1f(this.jfa.loc.uStep,l),n.bindFramebuffer(n.FRAMEBUFFER,this.fboB),n.drawBuffers([n.COLOR_ATTACHMENT0]),A(n,this.texA,0),n.drawArrays(n.TRIANGLES,0,3);let h=this.texA;this.texA=this.texB,this.texB=h;let u=this.fboA;this.fboA=this.fboB,this.fboB=u}n.bindFramebuffer(n.FRAMEBUFFER,null)}render(t,i,s,n,r){const o=this.gl,a=this.canvas.width,c=this.canvas.height,h=(y.find(u=>u.id===this.currentPaletteId)||y[0]).edgeColor||[0,0,0];o.viewport(0,0,a,c),o.bindVertexArray(this.quadVAO),o.useProgram(this.progRender),o.uniform2f(this.rnd.loc.uResolution,a,c),o.uniform1i(this.rnd.loc.uSeedTex,0),o.uniform1i(this.rnd.loc.uPalette,1),o.uniform1i(this.rnd.loc.uPaletteSize,w),o.uniform1i(this.rnd.loc.uEdges,t?1:0),o.uniform1i(this.rnd.loc.uShowSites,i?1:0),o.uniform1f(this.rnd.loc.uP,s),o.uniform1i(this.rnd.loc.uUseInf,n?1:0),o.uniform1f(this.rnd.loc.uResolutionScale,r),o.uniform3f(this.rnd.loc.uEdgeColor,h[0],h[1],h[2]),A(o,this.texA,0),A(o,this.paletteTex,1),o.bindFramebuffer(o.FRAMEBUFFER,null),o.drawArrays(o.TRIANGLES,0,3)}resize(t,i){const s=this.gl;this.texA&&s.deleteTexture(this.texA),this.texB&&s.deleteTexture(this.texB),this.fboA&&s.deleteFramebuffer(this.fboA),this.fboB&&s.deleteFramebuffer(this.fboB),this.texA=T(s,t,i),this.texB=T(s,t,i),this.fboA=R(s,this.texA),this.fboB=R(s,this.texB)}setExtraPasses(t){this.jfaExtraPasses=t}setPalette(t){const i=this.gl;this.currentPaletteId=t,this.paletteTex&&i.deleteTexture(this.paletteTex),this.paletteTex=I(i,t)}cleanup(){const t=this.gl;this.texA&&t.deleteTexture(this.texA),this.texB&&t.deleteTexture(this.texB),this.fboA&&t.deleteFramebuffer(this.fboA),this.fboB&&t.deleteFramebuffer(this.fboB),this.paletteTex&&t.deleteTexture(this.paletteTex),this.quadVAO&&t.deleteVertexArray(this.quadVAO),this.progJFA&&t.deleteProgram(this.progJFA),this.progRender&&t.deleteProgram(this.progRender),this.progClear&&t.deleteProgram(this.progClear)}}function v(e,t){const i=e.getBoundingClientRect(),s=e.width/i.width,n=e.height/i.height,r=Math.round((t.clientX-i.left)*s),o=Math.round((t.clientY-i.top)*n);return{x:r,y:o}}function L(e,t,i,s=25){for(let n=0;n<e.length;n++){const r=e[n].x-t,o=e[n].y-i;if(r*r+o*o<s*s)return n}return-1}function O(e,t){const{onDragStart:i,onDragMove:s,onAddSite:n}=t;let r=-1,o=!1;return e.addEventListener("mousedown",a=>{const{x:c,y:l}=v(e,a),h=e.width,u=e.height;c<0||c>=h||l<0||l>=u||(r=i(c,l),r>=0&&(o=!1,e.style.cursor="grabbing"))}),e.addEventListener("mousemove",a=>{if(r>=0){o=!0;const{x:c,y:l}=v(e,a),h=e.width,u=e.height,m=Math.max(0,Math.min(h-1,c)),f=Math.max(0,Math.min(u-1,l));s(r,m,f)}}),e.addEventListener("mouseup",()=>{r>=0&&(r=-1,e.style.cursor="crosshair")}),e.addEventListener("mouseleave",()=>{r>=0&&(r=-1,e.style.cursor="crosshair",o=!1)}),e.addEventListener("click",a=>{if(o){o=!1;return}const{x:c,y:l}=v(e,a),h=e.width,u=e.height;c>=0&&c<h&&l>=0&&l<u&&n(c,l)}),e.addEventListener("touchstart",a=>{a.preventDefault();const c=a.touches[0],{x:l,y:h}=v(e,c),u=e.width,m=e.height;l<0||l>=u||h<0||h>=m||(r=i(l,h),r>=0&&(o=!1))},{passive:!1}),e.addEventListener("touchmove",a=>{if(r>=0){a.preventDefault(),o=!0;const c=a.touches[0],{x:l,y:h}=v(e,c),u=e.width,m=e.height,f=Math.max(0,Math.min(u-1,l)),x=Math.max(0,Math.min(m-1,h));s(r,f,x)}},{passive:!1}),e.addEventListener("touchend",a=>{if(r>=0)a.preventDefault(),r=-1,o=!1;else if(a.changedTouches.length>0){const c=a.changedTouches[0],{x:l,y:h}=v(e,c),u=e.width,m=e.height;l>=0&&l<u&&h>=0&&h<m&&n(l,h)}},{passive:!1}),e.addEventListener("touchcancel",()=>{r>=0&&(r=-1,o=!1)}),console.log("✅ Interactions setup complete"),{getDragIndex:()=>r,getIsDragging:()=>o}}class H extends HTMLElement{static get observedAttributes(){return["metric-p"]}constructor(){super(),console.log("🎯 VoronoiViewer constructor called"),this.sites=[],this.lastRecomputeTime=0,this.pendingRecompute=!1,this.isAnimating=!1,this.animationFrameId=null,this.lastAnimationTime=0,this.animationSpeed=1,this.gl=null,this.canvas=null,this.algorithm=null,this.p=2,this.useInf=!1,this.showEdges=!0,this.showSites=!0,this.resolutionScale=.5,this.currentPaletteId="vibrant",this.interactionState=null,this._ro=null}connectedCallback(){console.log("🔗 VoronoiViewer connected to DOM");const t=this.querySelector(".skeleton-loader");this.innerHTML=`
            <div style="
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
                overflow: hidden;
                background: transparent;
            ">
                <canvas id="glcanvas" style="
                    width: 100%;
                    height: 100%;
                    display: block;
                    background: transparent;
                    cursor: crosshair;
                "></canvas>
            </div>

            <div id="errorMessage" style="
                position: absolute;
                inset: 0;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #dc3545;
                text-align: center;
                background: rgba(248, 249, 250, 0.95);
                backdrop-filter: blur(4px);
                border-radius: 8px;
                padding: 20px;
            ">
                <div style="font-size: 32px;">⚠️</div>
                <div style="font-size: 14px; font-weight: 500;">Failed to load Voronoi viewer</div>
                <div id="errorDetails" style="font-size: 12px; opacity: 0.8;"></div>
            </div>
        `,t&&this.appendChild(t),this.canvas=this.querySelector("#glcanvas"),this.initialize().catch(i=>{console.error("❌ VoronoiViewer initialization error:",i),this.showError(i.message||"Unknown error occurred")}),this.setupVisibilityHandler(),console.log("✅ VoronoiViewer HTML rendered successfully")}disconnectedCallback(){console.log("🔌 VoronoiViewer disconnected from DOM"),this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null),this.isAnimating=!1,this.cleanup(),this._ro&&this._ro.disconnect(),this._visibilityHandler&&document.removeEventListener("visibilitychange",this._visibilityHandler)}attributeChangedCallback(t,i,s){console.log(`🔄 VoronoiViewer attribute changed: ${t} = ${s}`),t==="metric-p"&&(s==="infinity"?(this.p=2,this.useInf=!0):(this.p=parseFloat(s)||2,this.useInf=!1),this.gl&&this.recompute())}async initialize(){console.log("🚀 Initializing VoronoiViewer...");const{width:t,height:i}=this.getBoundingClientRect(),s=window.devicePixelRatio||1;this.canvas.width=Math.floor(t*s*this.resolutionScale),this.canvas.height=Math.floor(i*s*this.resolutionScale),this.gl=U(this.canvas),this.algorithm=new X(this.gl,this.canvas),this.setupInteractions(),this.setupResizeObserver(),this.addRandomPoints(3),this.recompute(),console.log("✅ VoronoiViewer initialization complete"),this.removeLoadingSkeleton()}removeLoadingSkeleton(){const t=this.querySelector(".skeleton-loader");t&&(console.log("🎨 Removing loading skeleton - voronoi is ready"),t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}setupInteractions(){this.interactionState=O(this.canvas,{onDragStart:(t,i)=>L(this.sites,t,i),onDragMove:(t,i,s)=>{this.sites[t].x=i,this.sites[t].y=s,this.throttledRecompute()},onAddSite:(t,i)=>{if(L(this.sites,t,i)<0){const n={x:t,y:i};if(this.isAnimating){const r=Math.random()*Math.PI*2,o=20+Math.random()*30;n.vx=Math.cos(r)*o*this.resolutionScale,n.vy=Math.sin(r)*o*this.resolutionScale}this.sites.push(n),this.recompute()}}})}setupResizeObserver(){const t=()=>{const{width:i,height:s}=this.getBoundingClientRect();if(!i||!s||!this.gl)return;const n=window.devicePixelRatio||1,r=Math.floor(i*n*this.resolutionScale),o=Math.floor(s*n*this.resolutionScale);this.canvas.width===r&&this.canvas.height===o||(this.canvas.width=r,this.canvas.height=o,this.algorithm.resize(r,o),this.recompute(),console.log(`📐 VoronoiViewer resized to: ${r}x${o}`))};t(),this._ro=new ResizeObserver(t),this._ro.observe(this)}throttledRecompute(){const t=performance.now(),i=t-this.lastRecomputeTime,n=this.interactionState?.getIsDragging()?1e3/30:1e3/60;i>=n?(this.lastRecomputeTime=t,this.recompute(),this.pendingRecompute=!1):this.pendingRecompute||(this.pendingRecompute=!0,setTimeout(()=>{this.pendingRecompute=!1,this.lastRecomputeTime=performance.now(),this.recompute()},n-i))}recompute(){!this.gl||!this.algorithm||(this.sites.length===0?this.clearScreen():(this.algorithm.compute(this.sites,this.p,this.useInf),this.algorithm.render(this.showEdges,this.showSites,this.p,this.useInf,this.resolutionScale)))}clearScreen(){const t=this.gl;t.viewport(0,0,this.canvas.width,this.canvas.height),t.bindFramebuffer(t.FRAMEBUFFER,null),t.clearColor(.05,.06,.07,1),t.clear(t.COLOR_BUFFER_BIT)}clearAll(){this.sites=[],this.recompute(),console.log("Cleared all sites")}addRandomPoints(t=5){const i=this.canvas.width,s=this.canvas.height,n=50;for(let r=0;r<t;r++){const o=n+Math.random()*(i-2*n),a=n+Math.random()*(s-2*n),c={x:o,y:a};if(this.isAnimating){const l=Math.random()*Math.PI*2,h=20+Math.random()*30;c.vx=Math.cos(l)*h*this.resolutionScale,c.vy=Math.sin(l)*h*this.resolutionScale}this.sites.push(c)}this.recompute()}generateGrid(){this.sites=[];const t=this.canvas.width,i=this.canvas.height,s=80,n=4,r=3,o=(t-2*s)/n,a=(i-2*s)/r;for(let c=0;c<r;c++)for(let l=0;l<n;l++){const h=s+(l+.5)*o,u=s+(c+.5)*a,m=(Math.random()-.5)*o*.3,f=(Math.random()-.5)*a*.3,x={x:h+m,y:u+f};if(this.isAnimating){const b=Math.random()*Math.PI*2,S=20+Math.random()*30;x.vx=Math.cos(b)*S*this.resolutionScale,x.vy=Math.sin(b)*S*this.resolutionScale}this.sites.push(x)}this.recompute()}setShowEdges(t){this.showEdges=t,this.algorithm.render(this.showEdges,this.showSites,this.p,this.useInf,this.resolutionScale)}setShowSites(t){this.showSites=t,this.algorithm.render(this.showEdges,this.showSites,this.p,this.useInf,this.resolutionScale)}setResolutionScale(t){if(t!==.25&&t!==.5&&t!==.75&&t!==1){console.warn("Invalid resolution scale. Must be 0.25, 0.5, 0.75, or 1.0");return}const i=this.canvas.width,s=this.canvas.height,n=this.resolutionScale;this.resolutionScale=t;const{width:r,height:o}=this.getBoundingClientRect();if(!r||!o||!this.gl)return;const a=window.devicePixelRatio||1,c=Math.floor(r*a*this.resolutionScale),l=Math.floor(o*a*this.resolutionScale);this.canvas.width=c,this.canvas.height=l;const h=c/i,u=l/s,m=this.resolutionScale/n;this.sites.forEach(f=>{f.x*=h,f.y*=u,f.vx!==void 0&&(f.vx*=m,f.vy*=m)}),this.algorithm.resize(c,l),this.recompute(),console.log(`📐 Resolution scale changed to ${t}x (${c}x${l})`)}setJFAExtraPasses(t){if(t<0||t>4){console.warn("Invalid extra passes. Must be 0-4");return}this.algorithm.setExtraPasses(t),this.recompute(),console.log(`🔧 JFA extra passes set to ${t}`)}setPalette(t){this.currentPaletteId=t,this.algorithm.setPalette(t),this.algorithm.render(this.showEdges,this.showSites,this.p,this.useInf,this.resolutionScale),console.log(`🎨 Palette changed to ${t}`)}setAnimation(t){this.isAnimating=t,this.isAnimating?(this.sites.forEach(i=>{const s=Math.random()*Math.PI*2,n=20+Math.random()*30;i.vx=Math.cos(s)*n*this.resolutionScale,i.vy=Math.sin(s)*n*this.resolutionScale}),this.lastAnimationTime=performance.now(),this.animationLoop()):this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null)}setAnimationSpeed(t){this.animationSpeed=t}animationLoop(){if(!this.isAnimating)return;const t=performance.now(),i=(t-this.lastAnimationTime)/1e3;this.lastAnimationTime=t;const s=Math.min(i,.1);if(s>=1/60){const n=this.canvas.width,r=this.canvas.height,o=10;this.sites.forEach(a=>{a.x+=a.vx*s*this.animationSpeed,a.y+=a.vy*s*this.animationSpeed,a.x<=o?(a.x=o,a.vx=Math.abs(a.vx)):a.x>=n-o&&(a.x=n-o,a.vx=-Math.abs(a.vx)),a.y<=o?(a.y=o,a.vy=Math.abs(a.vy)):a.y>=r-o&&(a.y=r-o,a.vy=-Math.abs(a.vy))}),this.recompute()}this.animationFrameId=requestAnimationFrame(()=>this.animationLoop())}setupVisibilityHandler(){this._visibilityHandler=()=>{document.hidden?this.isAnimating&&this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null):this.isAnimating&&!this.animationFrameId&&(this.lastAnimationTime=performance.now(),this.animationLoop())},document.addEventListener("visibilitychange",this._visibilityHandler)}showError(t){const i=this.querySelector("#errorMessage"),s=this.querySelector("#errorDetails");i&&(i.style.display="flex"),s&&(s.textContent=t)}cleanup(){this.algorithm&&this.algorithm.cleanup()}}console.log("📝 Registering voronoi-viewer...");customElements.define("voronoi-viewer",H);console.log("✅ voronoi-viewer registered successfully!");document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("viewer"),i=new URLSearchParams(window.location.search).has("fun"),s=[.25,.5,.75,1],n=["vibrant","xochi","metallic","greyscale","ocean","forest"],r=document.getElementById("edgesToggle"),o=document.getElementById("sitesToggle"),a=document.getElementById("resolutionSelect"),c=document.getElementById("animateToggle"),l=document.getElementById("speedSlider"),h=document.getElementById("metricSlider"),u=document.getElementById("infinityToggle"),m=document.getElementById("algorithmSelect"),f=document.getElementById("paletteSelect"),x=document.getElementById("exportBtn"),b=document.getElementById("clearBtn"),S=document.getElementById("randomBtn"),B=document.getElementById("gridBtn");f?.addEventListener("change",d=>{const g=n[d.detail.value];e.setPalette(g)}),r?.addEventListener("change",d=>{e.setShowEdges(d.detail.checked)}),o?.addEventListener("change",d=>{e.setShowSites(d.detail.checked)}),a?.addEventListener("change",d=>{const g=s[d.detail.value];e.setResolutionScale(g)}),c?.addEventListener("change",d=>{e.setAnimation(d.detail.checked)}),l?.addEventListener("change",d=>{e.setAnimationSpeed(d.detail.value)}),h?.addEventListener("change",d=>{if(u?.classList.contains("active")){u.classList.remove("active");const g=u.querySelector(".text-toggle-indicator");g&&(g.textContent="[ ]"),u.setAttribute("aria-checked","false")}e.setAttribute("metric-p",d.detail.value.toString())}),u?.addEventListener("change",d=>{if(d.detail.checked)e.setAttribute("metric-p","infinity");else{const g=parseFloat(h?.dataset.value||"2");e.setAttribute("metric-p",g.toString())}}),m?.addEventListener("change",d=>{e.setJFAExtraPasses(d.detail.value)}),x?.addEventListener("click",()=>{const d=e.canvas||e.querySelector("canvas");if(d)try{const g=d.toDataURL("image/png"),E=document.createElement("a"),C=new Date().toISOString().replace(/[:.]/g,"-").slice(0,-5);E.download=`voronoi-diagram-${C}.png`,E.href=g,E.click()}catch(g){console.error("Export failed:",g),alert("Failed to export image. Please try again.")}}),b?.addEventListener("click",()=>{e.clearAll()}),S?.addEventListener("click",()=>{e.addRandomPoints(5)}),B?.addEventListener("click",()=>{e.generateGrid()}),i&&setTimeout(()=>{if(e.clearAll(),e.addRandomPoints(50),e.setAnimation(!0),e.setAnimationSpeed(1.5),c){c.classList.add("active");const d=c.querySelector(".text-toggle-indicator");d&&(d.textContent="[X]"),c.setAttribute("aria-checked","true")}if(e.setPalette("greyscale"),f&&(f.setAttribute("data-value","3"),f.querySelectorAll(".text-option").forEach((g,E)=>{g.classList.toggle("active",E===3)})),e.setShowSites(!1),o){o.classList.remove("active");const d=o.querySelector(".text-toggle-indicator");d&&(d.textContent="[ ]"),o.setAttribute("aria-checked","false")}console.log("🎉 Fun mode activated! 50 points, 1.5x speed, greyscale palette, sites hidden")},100),setTimeout(()=>{const d=e.querySelector(".skeleton-loader");d&&(d.classList.add("fade-out"),setTimeout(()=>d.remove(),300))},500)});
