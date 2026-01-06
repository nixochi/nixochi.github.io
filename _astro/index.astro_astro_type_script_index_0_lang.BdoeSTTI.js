class m extends HTMLElement{constructor(){super(),this.gl=null,this.prog=null,this.polytopeGeometry=null,this.instanceBuffer=null,this.instanceData=null,this.particlePool=[],this.activeParticleCount=0,this.freeParticleIndices=[],this.activeParticleIndices=[],this.initializeParticlePool(),this.animationId=null,this._ro=null,this.spawnAccumulator=0,this.currentSpawnRate=.2,this.frameCount=0,this.lastSecondTimestamp=0,this.currentFPS=0,this.fpsUpdateInterval=500,this.lastFpsUpdate=0,this.viewWidth=100,this.viewHeight=100,this.permutahedron={vertices:[[-2.121320343559642,-.408248290463863,.577350269189626],[-2.121320343559642,.408248290463863,-.577350269189626],[-1.414213562373095,-1.632993161855452,.577350269189626],[-1.414213562373095,0,-1.732050807568877],[-1.414213562373095,0,1.732050807568877],[-1.414213562373095,1.632993161855452,-.577350269189626],[-.707106781186548,-2.041241452319315,-.577350269189626],[-.707106781186548,-1.224744871391589,-1.732050807568877],[-.707106781186548,-1.224744871391589,1.732050807568877],[-.707106781186548,1.224744871391589,-1.732050807568877],[-.707106781186548,1.224744871391589,1.732050807568877],[-.707106781186548,2.041241452319315,.577350269189626],[.707106781186548,-2.041241452319315,-.577350269189626],[.707106781186548,-1.224744871391589,-1.732050807568877],[.707106781186548,-1.224744871391589,1.732050807568877],[.707106781186548,1.224744871391589,-1.732050807568877],[.707106781186548,1.224744871391589,1.732050807568877],[.707106781186548,2.041241452319315,.577350269189626],[1.414213562373095,-1.632993161855452,.577350269189626],[1.414213562373095,0,-1.732050807568877],[1.414213562373095,0,1.732050807568877],[1.414213562373095,1.632993161855452,-.577350269189626],[2.121320343559642,-.408248290463863,.577350269189626],[2.121320343559642,.408248290463863,-.577350269189626]],edges:[[7,13],[12,13],[6,12],[6,7],[0,2],[0,1],[1,3],[3,7],[2,6],[14,18],[8,14],[2,8],[12,18],[13,19],[3,9],[9,15],[15,19],[14,20],[18,22],[20,22],[22,23],[19,23],[5,9],[1,5],[0,4],[4,8],[17,21],[16,17],[16,20],[21,23],[15,21],[5,11],[11,17],[10,11],[4,10],[10,16]]}}connectedCallback(){const t=document.createElement("div");t.style.cssText=`
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            background: transparent;
        `;const e=document.createElement("canvas");e.id="canvas",e.style.cssText=`
            width: 100%;
            height: 100%;
            display: block;
            opacity: 0;
            transition: opacity 0.5s ease;
            background: transparent;
            transform: translateZ(0);
            will-change: transform;
        `;const s=document.createElement("div");s.id="fps-counter",s.style.cssText=`
            position: absolute;
            bottom: 0;
            right: 0;
            color: #00ff00;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            background: rgba(0, 0, 0, 0.5);
            padding: 3px 5px;
            pointer-events: none;
            z-index: 1000;
        `,s.textContent="FPS: --";const o=document.createElement("div");o.id="polytopes-counter",o.style.cssText=`
            position: absolute;
            bottom: 0;
            left: 0;
            color: #00ff00;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            background: rgba(0, 0, 0, 0.5);
            padding: 3px 5px;
            pointer-events: none;
            z-index: 1000;
        `,o.textContent="Polytopes: 0",t.appendChild(e),t.appendChild(s),t.appendChild(o),this.innerHTML="",this.appendChild(t),requestAnimationFrame(()=>{try{this.initialize()}catch(a){console.error("❌ Polytope rain initialization error:",a)}})}setSpawnRate(t){this.currentSpawnRate=t}disconnectedCallback(){this.animationId&&cancelAnimationFrame(this.animationId),this._ro&&this._ro.disconnect(),this.cleanup()}initialize(){this.setupWebGL(),this.setupShaders(),this.buildPolytopeGeometry(),this.setupInstanceBuffer(),this.setupResizeObserver(),this.removeLoadingSkeleton(),this.startAnimationLoop()}setupWebGL(){const t=this.querySelector("#canvas");if(this.gl=t.getContext("webgl2",{antialias:!0,alpha:!0,premultipliedAlpha:!0,preserveDrawingBuffer:!1,powerPreference:"high-performance",desynchronized:!0}),!this.gl)throw new Error("WebGL2 not supported");this.gl.enable(this.gl.DEPTH_TEST),this.gl.clearColor(.086,.086,.09,1)}setupShaders(){const t=this.gl,e=`#version 300 es
layout(location=0) in vec3 aPos;

// Instance attributes - precomputed sin/cos for rotations
layout(location=1) in vec3 aInstancePos;
layout(location=2) in vec2 aSinCosX;  // (sin, cos) for X rotation
layout(location=3) in vec2 aSinCosY;  // (sin, cos) for Y rotation
layout(location=4) in vec2 aSinCosZ;  // (sin, cos) for Z rotation
layout(location=5) in float aInstanceScale;
layout(location=6) in vec3 aInstanceColor;

uniform mat4 uProjection;

out vec3 vColor;

// Build rotation matrices from precomputed sin/cos values
mat4 rotateX(vec2 sincos) {
    float s = sincos.x;
    float c = sincos.y;
    return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, c,   s,   0.0,
        0.0, -s,  c,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

mat4 rotateY(vec2 sincos) {
    float s = sincos.x;
    float c = sincos.y;
    return mat4(
        c,   0.0, -s,  0.0,
        0.0, 1.0, 0.0, 0.0,
        s,   0.0, c,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

mat4 rotateZ(vec2 sincos) {
    float s = sincos.x;
    float c = sincos.y;
    return mat4(
        c,   s,   0.0, 0.0,
        -s,  c,   0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

mat4 translate(vec3 pos) {
    return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        pos.x, pos.y, pos.z, 1.0
    );
}

mat4 scale(float s) {
    return mat4(
        s,   0.0, 0.0, 0.0,
        0.0, s,   0.0, 0.0,
        0.0, 0.0, s,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

void main() {
    mat4 model = translate(aInstancePos)
               * rotateZ(aSinCosZ)
               * rotateY(aSinCosY)
               * rotateX(aSinCosX)
               * scale(aInstanceScale);

    vColor = aInstanceColor;
    gl_Position = uProjection * model * vec4(aPos, 1.0);
}`,s=`#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main() {
    fragColor = vec4(vColor, 1.0);
}`,o=(a,i)=>{const n=t.createShader(a);if(t.shaderSource(n,i),t.compileShader(n),!t.getShaderParameter(n,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(n)||"Shader compile error");return n};if(this.prog=t.createProgram(),t.attachShader(this.prog,o(t.VERTEX_SHADER,e)),t.attachShader(this.prog,o(t.FRAGMENT_SHADER,s)),t.linkProgram(this.prog),!t.getProgramParameter(this.prog,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(this.prog)||"Program link error")}hslToRgb(t,e,s){e/=100,s/=100;const o=(1-Math.abs(2*s-1))*e,a=o*(1-Math.abs(t/60%2-1)),i=s-o/2;let n=0,r=0,c=0;return t>=0&&t<60?(n=o,r=a,c=0):t>=60&&t<120?(n=a,r=o,c=0):t>=120&&t<180?(n=0,r=o,c=a):t>=180&&t<240?(n=0,r=a,c=o):t>=240&&t<300?(n=a,r=0,c=o):t>=300&&t<360&&(n=o,r=0,c=a),[n+i,r+i,c+i]}initializeParticlePool(){for(let t=0;t<3e4;t++)this.particlePool.push({active:!1,x:0,y:0,z:0,rotX:0,rotY:0,rotZ:0,rotSpeedX:0,rotSpeedY:0,rotSpeedZ:0,fallSpeed:0,size:0,color:[1,1,1]}),this.freeParticleIndices.push(t)}buildPolytopeGeometry(){const t=this.gl,e=this.permutahedron.vertices,s=this.permutahedron.edges,o=[];s.forEach(([n,r])=>{const c=e[n],l=e[r];o.push(c[0],c[1],c[2]),o.push(l[0],l[1],l[2])});const a=t.createVertexArray();t.bindVertexArray(a);const i=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,i),t.bufferData(t.ARRAY_BUFFER,new Float32Array(o),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,0,0),t.vertexAttribDivisor(0,0),t.bindVertexArray(null),this.polytopeGeometry={vao:a,vertexCount:o.length/3}}setupInstanceBuffer(){const t=this.gl;this.instanceData=new Float32Array(3e4*13),this.instanceBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer),t.bufferData(t.ARRAY_BUFFER,this.instanceData.byteLength,t.DYNAMIC_DRAW),t.bindVertexArray(this.polytopeGeometry.vao),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer);const e=52;t.enableVertexAttribArray(1),t.vertexAttribPointer(1,3,t.FLOAT,!1,e,0),t.vertexAttribDivisor(1,1),t.enableVertexAttribArray(2),t.vertexAttribPointer(2,2,t.FLOAT,!1,e,12),t.vertexAttribDivisor(2,1),t.enableVertexAttribArray(3),t.vertexAttribPointer(3,2,t.FLOAT,!1,e,20),t.vertexAttribDivisor(3,1),t.enableVertexAttribArray(4),t.vertexAttribPointer(4,2,t.FLOAT,!1,e,28),t.vertexAttribDivisor(4,1),t.enableVertexAttribArray(5),t.vertexAttribPointer(5,1,t.FLOAT,!1,e,36),t.vertexAttribDivisor(5,1),t.enableVertexAttribArray(6),t.vertexAttribPointer(6,3,t.FLOAT,!1,e,40),t.vertexAttribDivisor(6,1),t.bindBuffer(t.ARRAY_BUFFER,null),t.bindVertexArray(null)}activateParticle(){if(this.freeParticleIndices.length===0)return null;const t=this.freeParticleIndices.pop(),e=this.particlePool[t],s=Math.random()*360,o=70+Math.random()*30,a=50+Math.random()*20,i=this.hslToRgb(s,o,a),n=()=>(Math.random()<.5?-1:1)*(0+Math.random()*.1);return e.active=!0,e.x=(Math.random()-.5)*this.viewWidth,e.y=this.viewHeight/2+10,e.z=0,e.rotX=Math.random()*Math.PI*2,e.rotY=Math.random()*Math.PI*2,e.rotZ=Math.random()*Math.PI*2,e.rotSpeedX=n(),e.rotSpeedY=n(),e.rotSpeedZ=n(),e.fallSpeed=.1+Math.random()*.2,e.size=.2+Math.random()*.4,e.color[0]=i[0],e.color[1]=i[1],e.color[2]=i[2],this.activeParticleIndices.push(t),e}updateParticles(t){for(this.spawnAccumulator+=this.currentSpawnRate*t*60;this.spawnAccumulator>=1;)this.activateParticle(),this.spawnAccumulator-=1;const e=-this.viewHeight/2-10;let s=0;for(let o=this.activeParticleIndices.length-1;o>=0;o--){const a=this.activeParticleIndices[o],i=this.particlePool[a];if(i.y-=i.fallSpeed*t*60,i.rotX+=i.rotSpeedX*t*60,i.rotY+=i.rotSpeedY*t*60,i.rotZ+=i.rotSpeedZ*t*60,i.y<e){i.active=!1,this.freeParticleIndices.push(a),this.activeParticleIndices.splice(o,1);continue}const n=Math.sin(i.rotX),r=Math.cos(i.rotX),c=Math.sin(i.rotY),l=Math.cos(i.rotY),u=Math.sin(i.rotZ),f=Math.cos(i.rotZ),h=s*13;this.instanceData[h+0]=i.x,this.instanceData[h+1]=i.y,this.instanceData[h+2]=i.z,this.instanceData[h+3]=n,this.instanceData[h+4]=r,this.instanceData[h+5]=c,this.instanceData[h+6]=l,this.instanceData[h+7]=u,this.instanceData[h+8]=f,this.instanceData[h+9]=i.size,this.instanceData[h+10]=i.color[0],this.instanceData[h+11]=i.color[1],this.instanceData[h+12]=i.color[2],s++}this.activeParticleCount=s}setupResizeObserver(){const t=()=>{const e=this.querySelector("#canvas"),{width:s,height:o}=this.getBoundingClientRect();if(!s||!o)return;const a=Math.min(window.devicePixelRatio||1,2),i=Math.floor(s*a),n=Math.floor(o*a);(e.width!==i||e.height!==n)&&(e.width=i,e.height=n),this.gl.viewport(0,0,e.width,e.height);const r=s/o;this.viewHeight=50,this.viewWidth=this.viewHeight*r};t(),this._ro=new ResizeObserver(t),this._ro.observe(this)}removeLoadingSkeleton(){const t=document.getElementById("skeleton"),e=this.querySelector("#canvas");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300)),e&&(e.style.opacity="1")}startAnimationLoop(){let t=performance.now();const e=s=>{this.animationId=requestAnimationFrame(e);const o=(s-t)/1e3;t=s;const a=Math.min(o,.1);if(s-this.lastSecondTimestamp>=1e3&&(this.currentFPS=this.frameCount,this.frameCount=0,this.lastSecondTimestamp=s),this.frameCount++,s-this.lastFpsUpdate>this.fpsUpdateInterval){const i=this.querySelector("#fps-counter"),n=this.querySelector("#polytopes-counter");i&&(i.textContent=`FPS: ${this.currentFPS}`),n&&(n.textContent=`Polytopes: ${this.activeParticleCount}`),this.lastFpsUpdate=s}this.updateParticles(a),this.render()};e(performance.now())}render(){const t=this.gl;if(t.clear(t.COLOR_BUFFER_BIT|t.DEPTH_BUFFER_BIT),this.activeParticleCount===0)return;t.useProgram(this.prog),t.lineWidth(2);const e=this.viewWidth/2,s=this.viewHeight/2,o=this.mat4Ortho(-e,e,-s,s,-100,100);t.uniformMatrix4fv(t.getUniformLocation(this.prog,"uProjection"),!1,o),t.bindVertexArray(this.polytopeGeometry.vao),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer);const a=this.instanceData.subarray(0,this.activeParticleCount*13);t.bufferSubData(t.ARRAY_BUFFER,0,a),t.drawArraysInstanced(t.LINES,0,this.polytopeGeometry.vertexCount,this.activeParticleCount),t.bindVertexArray(null)}mat4Ortho(t,e,s,o,a,i){const n=1/(t-e),r=1/(s-o),c=1/(a-i),l=new Float32Array(16);return l[0]=-2*n,l[5]=-2*r,l[10]=2*c,l[12]=(t+e)*n,l[13]=(o+s)*r,l[14]=(i+a)*c,l[15]=1,l}cleanup(){this.gl&&this.polytopeGeometry&&this.polytopeGeometry.vao&&this.gl.deleteVertexArray(this.polytopeGeometry.vao),this.gl&&this.instanceBuffer&&this.gl.deleteBuffer(this.instanceBuffer),this.gl&&this.prog&&this.gl.deleteProgram(this.prog)}}customElements.define("polytope-rain",m);const v=document.getElementById("intensitySwitch"),p=document.querySelector("polytope-rain"),A=[.2,2,15,55];v?.addEventListener("change",d=>{const t=d.detail.value;p&&"setSpawnRate"in p&&p.setSpawnRate(A[t])});
