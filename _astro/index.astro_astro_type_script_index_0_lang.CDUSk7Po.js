const v=333.33333333333337,A=4e3/.3,T=4e3/.3,D=2e3/.3,_=5e3/.3,y=2e3/.3,g=.01,E=.04,B=1,M=1,H=1.5,b=1.5,V=8,x=8,z=10,I=10,k=.3,R=.3,G=1,W=1,F=1,q=1.5,L=1.5,Z=10,Y=10,$=25,O=25,j=20,w=20,K=1,N=110,J=110,Q=1;class tt extends HTMLElement{constructor(){super(),this.gl=null,this.prog=null,this.sharedGeometry=null,this.instanceBuffer=null,this.instanceData=null,this.polytopes=[],this.spherical={radius:N,theta:Math.PI/4,phi:Math.PI/3},this.sphericalDelta={radius:1},this.isDragging=!1,this.lastX=0,this.lastY=0,this.lastTime=0,this.velocityTheta=0,this.velocityPhi=0,this.touchStartDist=0,this.animationId=null,this._ro=null,this.time=0,this.currentSizeMultiplier=1,this.cycleDuration=v+A+T+D+_+y,this.baseRotationSpeed=g,this.polytopeSpacing=20/1e3,this.baseAngleX=0,this.baseAngleY=0,this.rotationDirection=1;const t=1+Q;this.speedMultipliers=Array.from({length:1e3},(e,a)=>{const s=a/Math.max(1,999);return{x:1+s*(t-1),y:1+s*(t-1)*1.2}}),this.permutahedron={vertices:[[-2.121320343559642,-.408248290463863,.577350269189626],[-2.121320343559642,.408248290463863,-.577350269189626],[-1.414213562373095,-1.632993161855452,.577350269189626],[-1.414213562373095,0,-1.732050807568877],[-1.414213562373095,0,1.732050807568877],[-1.414213562373095,1.632993161855452,-.577350269189626],[-.707106781186548,-2.041241452319315,-.577350269189626],[-.707106781186548,-1.224744871391589,-1.732050807568877],[-.707106781186548,-1.224744871391589,1.732050807568877],[-.707106781186548,1.224744871391589,-1.732050807568877],[-.707106781186548,1.224744871391589,1.732050807568877],[-.707106781186548,2.041241452319315,.577350269189626],[.707106781186548,-2.041241452319315,-.577350269189626],[.707106781186548,-1.224744871391589,-1.732050807568877],[.707106781186548,-1.224744871391589,1.732050807568877],[.707106781186548,1.224744871391589,-1.732050807568877],[.707106781186548,1.224744871391589,1.732050807568877],[.707106781186548,2.041241452319315,.577350269189626],[1.414213562373095,-1.632993161855452,.577350269189626],[1.414213562373095,0,-1.732050807568877],[1.414213562373095,0,1.732050807568877],[1.414213562373095,1.632993161855452,-.577350269189626],[2.121320343559642,-.408248290463863,.577350269189626],[2.121320343559642,.408248290463863,-.577350269189626]],faces:[[7,13,12,6],[2,0,1,3,7,6],[18,14,8,2,6,12],[19,13,7,3,9,15],[20,14,18,22],[23,22,18,12,13,19],[5,9,3,1],[4,0,2,8],[21,17,16,20,22,23],[21,23,19,15],[21,15,9,5,11,17],[10,11,5,1,0,4],[10,4,8,14,20,16],[10,16,17,11]],edges:[[7,13],[12,13],[6,12],[6,7],[0,2],[0,1],[1,3],[3,7],[2,6],[14,18],[8,14],[2,8],[12,18],[13,19],[3,9],[9,15],[15,19],[14,20],[18,22],[20,22],[22,23],[19,23],[5,9],[1,5],[0,4],[4,8],[17,21],[16,17],[16,20],[21,23],[15,21],[5,11],[11,17],[10,11],[4,10],[10,16]]}}connectedCallback(){const t=document.createElement("div");t.style.cssText=`
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            background: transparent;
        `;const e=document.createElement("canvas");e.id="canvas",e.style.cssText=`
            width: 100%;
            height: 100%;
            display: block;
            cursor: grab;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;const a=document.createElement("div");a.id="debug-ui",a.style.cssText=`
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            min-width: 300px;
            z-index: 1000;
            display: none;
        `;const s=document.createElement("div");s.id="progress-bar",s.style.cssText=`
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        `;const i=document.createElement("div");i.id="progress-fill",i.style.cssText=`
            height: 100%;
            background: #4CAF50;
            width: 0%;
            transition: width 0.1s linear;
        `,s.appendChild(i);const r=document.createElement("div");r.id="phase-text",r.textContent="Phase: Loading...",a.appendChild(s),a.appendChild(r),t.appendChild(e),t.appendChild(a),this.innerHTML="",this.appendChild(t),requestAnimationFrame(()=>{try{this.initialize()}catch(n){console.error("❌ Breathing initialization error:",n)}})}disconnectedCallback(){this.animationId&&cancelAnimationFrame(this.animationId),this._ro&&this._ro.disconnect(),this.cleanup()}initialize(){this.setupWebGL(),this.setupShaders(),this.buildPolytopeGeometry(),this.setupInstanceBuffer(),this.setupEventListeners(),this.setupResizeObserver(),this.removeLoadingSkeleton(),this.startAnimationLoop()}setupWebGL(){const t=this.querySelector("#canvas");if(this.gl=t.getContext("webgl2",{antialias:!0,alpha:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:"high-performance",desynchronized:!0}),!this.gl)throw new Error("WebGL2 not supported");this.gl.enable(this.gl.DEPTH_TEST),this.gl.clearColor(0,0,0,1)}setupShaders(){const t=this.gl,e=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aSinCosX;
layout(location=2) in vec2 aSinCosY;
layout(location=3) in float aScale;
layout(location=4) in vec3 aColor;
layout(location=5) in float aOpacity;

uniform mat4 uProjection;
uniform mat4 uView;

out vec3 vColor;
out float vOpacity;

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

mat4 scale(float s) {
    return mat4(
        s,   0.0, 0.0, 0.0,
        0.0, s,   0.0, 0.0,
        0.0, 0.0, s,   0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

void main() {
    mat4 model = rotateY(aSinCosY) * rotateX(aSinCosX) * scale(aScale);
    vColor = aColor;
    vOpacity = aOpacity;
    gl_Position = uProjection * uView * model * vec4(aPos, 1.0);
}`,a=`#version 300 es
precision mediump float;
in vec3 vColor;
in float vOpacity;
out vec4 fragColor;
void main() {
    fragColor = vec4(vColor, vOpacity);
}`,s=(i,r)=>{const n=t.createShader(i);if(t.shaderSource(n,r),t.compileShader(n),!t.getShaderParameter(n,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(n)||"Shader compile error");return n};if(this.prog=t.createProgram(),t.attachShader(this.prog,s(t.VERTEX_SHADER,e)),t.attachShader(this.prog,s(t.FRAGMENT_SHADER,a)),t.linkProgram(this.prog),!t.getProgramParameter(this.prog,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(this.prog)||"Program link error")}hexToRgb(t){const e=parseInt(t.slice(1,3),16)/255,a=parseInt(t.slice(3,5),16)/255,s=parseInt(t.slice(5,7),16)/255;return[e,a,s]}hslToHex(t,e,a){e/=100,a/=100;const s=(1-Math.abs(2*a-1))*e,i=s*(1-Math.abs(t/60%2-1)),r=a-s/2;let n=0,h=0,l=0;t>=0&&t<60?(n=s,h=i,l=0):t>=60&&t<120?(n=i,h=s,l=0):t>=120&&t<180?(n=0,h=s,l=i):t>=180&&t<240?(n=0,h=i,l=s):t>=240&&t<300?(n=i,h=0,l=s):t>=300&&t<360&&(n=s,h=0,l=i);const d=Math.round((n+r)*255).toString(16).padStart(2,"0"),o=Math.round((h+r)*255).toString(16).padStart(2,"0"),c=Math.round((l+r)*255).toString(16).padStart(2,"0");return`#${d}${o}${c}`}buildPolytopeGeometry(){const t=this.gl,e=this.permutahedron.vertices,a=this.permutahedron.edges,s=[];a.forEach(([n,h])=>{const l=e[n],d=e[h];s.push(l[0],l[1],l[2]),s.push(d[0],d[1],d[2])});const i=t.createVertexArray();t.bindVertexArray(i);const r=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,r),t.bufferData(t.ARRAY_BUFFER,new Float32Array(s),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,0,0),t.vertexAttribDivisor(0,0),t.bindVertexArray(null),this.sharedGeometry={vao:i,vertexCount:s.length/3},this.polytopes=Array.from({length:1e3},(n,h)=>{const l=h*360/1e3%360,d=h===0?0:100,o=h===0?100:50,c=this.hslToHex(l,d,o),f=this.hexToRgb(c),p=.95-h*.1;return{rotationX:0,rotationY:0,driftX:0,driftY:0,scale:1,index:h,color:f,opacity:p}})}setupInstanceBuffer(){const t=this.gl;this.instanceData=new Float32Array(1e3*9),this.instanceBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer),t.bufferData(t.ARRAY_BUFFER,this.instanceData.byteLength,t.DYNAMIC_DRAW),t.bindVertexArray(this.sharedGeometry.vao),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer);const e=36;t.enableVertexAttribArray(1),t.vertexAttribPointer(1,2,t.FLOAT,!1,e,0),t.vertexAttribDivisor(1,1),t.enableVertexAttribArray(2),t.vertexAttribPointer(2,2,t.FLOAT,!1,e,8),t.vertexAttribDivisor(2,1),t.enableVertexAttribArray(3),t.vertexAttribPointer(3,1,t.FLOAT,!1,e,16),t.vertexAttribDivisor(3,1),t.enableVertexAttribArray(4),t.vertexAttribPointer(4,3,t.FLOAT,!1,e,20),t.vertexAttribDivisor(4,1),t.enableVertexAttribArray(5),t.vertexAttribPointer(5,1,t.FLOAT,!1,e,32),t.vertexAttribDivisor(5,1),t.bindBuffer(t.ARRAY_BUFFER,null),t.bindVertexArray(null)}setupEventListeners(){const t=this.querySelector("#canvas");t.addEventListener("mousedown",e=>this.handleMouseDown(e)),t.addEventListener("mousemove",e=>this.handleMouseMove(e)),t.addEventListener("mouseup",()=>this.handleMouseUp()),t.addEventListener("mouseleave",()=>this.handleMouseUp()),t.addEventListener("wheel",e=>this.handleWheel(e),{passive:!1}),t.addEventListener("touchstart",e=>this.handleTouchStart(e),{passive:!1}),t.addEventListener("touchmove",e=>this.handleTouchMove(e),{passive:!1}),t.addEventListener("touchend",()=>this.handleTouchEnd())}handleMouseDown(t){this.isDragging=!0,this.lastX=t.clientX,this.lastY=t.clientY,this.lastTime=performance.now(),this.velocityTheta=0,this.velocityPhi=0}handleMouseMove(t){if(!this.isDragging)return;const e=performance.now(),a=Math.max(1,e-this.lastTime),s=t.clientX-this.lastX,i=t.clientY-this.lastY,r=Math.PI/450*.5,n=-s*r,h=-i*r;this.spherical.theta+=n,this.spherical.phi+=h,this.spherical.phi=Math.max(.01,Math.min(Math.PI-.01,this.spherical.phi)),this.velocityTheta=n/a*16,this.velocityPhi=h/a*16,this.lastX=t.clientX,this.lastY=t.clientY,this.lastTime=e}handleMouseUp(){this.isDragging=!1}handleWheel(t){t.preventDefault();const e=Math.pow(.95,Math.abs(t.deltaY*.01));t.deltaY<0?this.sphericalDelta.radius/=e:this.sphericalDelta.radius*=e}handleTouchStart(t){t.preventDefault();const e=Array.from(t.touches);if(e.length===1)this.isDragging=!0,this.lastX=e[0].clientX,this.lastY=e[0].clientY,this.lastTime=performance.now(),this.velocityTheta=0,this.velocityPhi=0;else if(e.length===2){const a=e[0].clientX-e[1].clientX,s=e[0].clientY-e[1].clientY;this.touchStartDist=Math.sqrt(a*a+s*s)}}handleTouchMove(t){t.preventDefault();const e=Array.from(t.touches);if(e.length===1&&this.isDragging){const a=performance.now(),s=Math.max(1,a-this.lastTime),i=e[0].clientX-this.lastX,r=e[0].clientY-this.lastY,n=Math.PI/450*.5,h=-i*n,l=-r*n;this.spherical.theta+=h,this.spherical.phi+=l,this.spherical.phi=Math.max(.01,Math.min(Math.PI-.01,this.spherical.phi)),this.velocityTheta=h/s*16,this.velocityPhi=l/s*16,this.lastX=e[0].clientX,this.lastY=e[0].clientY,this.lastTime=a}else if(e.length===2&&this.touchStartDist>0){const a=e[0].clientX-e[1].clientX,s=e[0].clientY-e[1].clientY,i=Math.sqrt(a*a+s*s);if(this.touchStartDist>0){const r=this.touchStartDist/i;this.sphericalDelta.radius*=r,this.touchStartDist=i}}}handleTouchEnd(){this.isDragging=!1,this.touchStartDist=0}setupResizeObserver(){const t=()=>{const e=this.querySelector("#canvas"),{width:a,height:s}=this.getBoundingClientRect();if(!a||!s)return;const i=Math.min(window.devicePixelRatio||1,2),r=Math.floor(a*i),n=Math.floor(s*i);(e.width!==r||e.height!==n)&&(e.width=r,e.height=n),this.gl.viewport(0,0,e.width,e.height)};t(),this._ro=new ResizeObserver(t),this._ro.observe(this)}removeLoadingSkeleton(){const t=document.getElementById("skeleton"),e=this.querySelector("#canvas");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300)),e&&(e.style.opacity="1")}startAnimationLoop(){const t=()=>{this.animationId=requestAnimationFrame(t),this.updateCamera(),this.updatePolytopes(),this.render()};t()}updateCamera(){this.isDragging||(this.spherical.theta+=this.velocityTheta,this.spherical.phi+=this.velocityPhi,this.spherical.phi=Math.max(.01,Math.min(Math.PI-.01,this.spherical.phi)),this.velocityTheta*=.92,this.velocityPhi*=.92,Math.abs(this.velocityTheta)<1e-4&&(this.velocityTheta=0),Math.abs(this.velocityPhi)<1e-4&&(this.velocityPhi=0)),this.spherical.radius*=this.sphericalDelta.radius,this.sphericalDelta.radius=1}updatePolytopes(){this.time+=16;const e=this.time%this.cycleDuration,a=(this.time-16)%this.cycleDuration;e<a&&(this.rotationDirection*=-1);const{desyncAmount:s,rotationSpeed:i,phaseName:r,phaseProgress:n,isSyncing:h,sizeMultiplier:l,offsetMultiplier:d}=this.calculatePhaseValues(e);this.currentSizeMultiplier=l,this.updateDebugUI(r,n,s,i),this.baseAngleX+=i,this.baseAngleY+=i,this.polytopes.forEach((o,c)=>{const f=i*(this.speedMultipliers[c].x-1)*s,p=i*(this.speedMultipliers[c].y-1)*s;if(o.driftX+=f,o.driftY+=p,h){const P=1-(1-s)*.015;o.driftX*=P,o.driftY*=P}o.rotationX=this.baseAngleX+o.driftX,o.rotationY=this.baseAngleY+o.driftY;const u=(c+1)*this.polytopeSpacing*d;o.scale=u;const m=Math.sin(o.rotationX),U=Math.cos(o.rotationX),C=Math.sin(o.rotationY),X=Math.cos(o.rotationY),S=c*9;this.instanceData[S+0]=m,this.instanceData[S+1]=U,this.instanceData[S+2]=C,this.instanceData[S+3]=X,this.instanceData[S+4]=o.scale,this.instanceData[S+5]=o.color[0],this.instanceData[S+6]=o.color[1],this.instanceData[S+7]=o.color[2],this.instanceData[S+8]=o.opacity})}smootherstep(t){return t=Math.max(0,Math.min(1,t)),t*t*t*(t*(t*6-15)+10)}updateDebugUI(t,e,a,s){const i=this.querySelector("#phase-text"),r=this.querySelector("#progress-fill");if(i&&this.polytopes.length>0){const n=this.polytopes[this.polytopes.length-1];i.innerHTML=`
                Phase: ${t}<br>
                Desync: ${a.toFixed(2)} | Speed: ${s.toFixed(3)}<br>
                Drift: ${n.driftX.toFixed(3)} | Dir: ${this.rotationDirection>0?"+":"-"}
            `}if(r){const n=(e*100).toFixed(1);r.style.width=`${n}%`}}calculatePhaseValues(t){const e=v,a=e+A,s=a+T,i=s+D,r=i+_;let n,h,l,d,o,c,f,p=0,u;if(t<e)l="1: Synced Slow",d=t/v,u=g,h=u*this.rotationDirection,o=!1,c=B,f=W;else if(t<a)l="2: Desync & Speed Up",d=(t-e)/A,p=this.smootherstep(d),u=g+p*(E-g),h=u*this.rotationDirection,o=!1,c=M+p*(H-M),f=F+p*(q-F);else if(t<s)l="3: Desync & Slow Down",d=(t-a)/T,p=this.smootherstep(d),u=E-p*(E-g),h=u*this.rotationDirection,o=!1,c=b+p*(V-b),f=L+p*(Z-L);else if(t<i){l="4: Desynced Slow (Reversing)",d=(t-s)/D,p=this.smootherstep(d);const m=1-p*2;h=g*this.rotationDirection*m,o=!1,c=x+p*(z-x),f=Y+p*($-Y)}else t<r?(l="5: Sync Halfway & Speed Up",d=(t-i)/_,p=this.smootherstep(d),u=g+p*(E-g),h=u*-this.rotationDirection,o=!0,c=I+p*(k-I),f=O+p*(j-O)):(l="6: Sync Complete & Slow Down",d=(t-r)/y,p=this.smootherstep(d),u=E-p*(E-g),h=u*-this.rotationDirection,o=!0,c=R+p*(G-R),f=w+p*(K-w));return t<e?n=0:t<a?n=this.smootherstep((t-e)/A):t<i?n=1:t<r?n=1-this.smootherstep((t-i)/_)*.5:n=.5-this.smootherstep((t-r)/y)*.5,{desyncAmount:n,rotationSpeed:h,phaseName:l,phaseProgress:d,isSyncing:o,sizeMultiplier:c,offsetMultiplier:f}}render(){const t=this.gl,e=this.querySelector("#canvas");t.clear(t.COLOR_BUFFER_BIT|t.DEPTH_BUFFER_BIT),t.useProgram(this.prog),t.lineWidth(2);const a=Math.max(1e-6,e.width/e.height),s=this.mat4Perspective(75*Math.PI/180,a,.1,1e3),i=J/this.currentSizeMultiplier*this.spherical.radius/N,r=i*Math.sin(this.spherical.phi)*Math.sin(this.spherical.theta),n=i*Math.cos(this.spherical.phi),h=i*Math.sin(this.spherical.phi)*Math.cos(this.spherical.theta),l=[r,n,h],d=this.mat4LookAt(l,[0,0,0],[0,1,0]);t.uniformMatrix4fv(t.getUniformLocation(this.prog,"uProjection"),!1,s),t.uniformMatrix4fv(t.getUniformLocation(this.prog,"uView"),!1,d),t.bindVertexArray(this.sharedGeometry.vao),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer),t.bufferSubData(t.ARRAY_BUFFER,0,this.instanceData),t.drawArraysInstanced(t.LINES,0,this.sharedGeometry.vertexCount,1e3),t.bindVertexArray(null)}mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}mat4Multiply(t,e){const a=new Float32Array(16);for(let s=0;s<4;s++)for(let i=0;i<4;i++)a[s*4+i]=t[0+i]*e[s*4+0]+t[4+i]*e[s*4+1]+t[8+i]*e[s*4+2]+t[12+i]*e[s*4+3];return a}mat4Perspective(t,e,a,s){const i=1/Math.tan(t/2),r=1/(a-s),n=new Float32Array(16);return n[0]=i/e,n[5]=i,n[10]=(s+a)*r,n[11]=-1,n[14]=2*s*a*r,n}mat4LookAt(t,e,a){const s=(o,c)=>[o[0]-c[0],o[1]-c[1],o[2]-c[2]],i=(o,c)=>[o[1]*c[2]-o[2]*c[1],o[2]*c[0]-o[0]*c[2],o[0]*c[1]-o[1]*c[0]],r=(o,c)=>o[0]*c[0]+o[1]*c[1]+o[2]*c[2],n=o=>{const c=Math.sqrt(o[0]*o[0]+o[1]*o[1]+o[2]*o[2]);return c>0?[o[0]/c,o[1]/c,o[2]/c]:[0,0,0]},h=n(s(t,e)),l=n(i(a,h)),d=i(h,l);return new Float32Array([l[0],d[0],h[0],0,l[1],d[1],h[1],0,l[2],d[2],h[2],0,-r(l,t),-r(d,t),-r(h,t),1])}cleanup(){this.gl&&this.sharedGeometry&&this.sharedGeometry.vao&&this.gl.deleteVertexArray(this.sharedGeometry.vao),this.gl&&this.instanceBuffer&&this.gl.deleteBuffer(this.instanceBuffer),this.gl&&this.prog&&this.gl.deleteProgram(this.prog)}}customElements.define("breathing-viz",tt);
