const d=document.getElementById("canvas"),e=d.getContext("webgl2"),M=[[-2.121320343559642,-.408248290463863,.577350269189626],[-2.121320343559642,.408248290463863,-.577350269189626],[-1.414213562373095,-1.632993161855452,.577350269189626],[-1.414213562373095,0,-1.732050807568877],[-1.414213562373095,0,1.732050807568877],[-1.414213562373095,1.632993161855452,-.577350269189626],[-.707106781186548,-2.041241452319315,-.577350269189626],[-.707106781186548,-1.224744871391589,-1.732050807568877],[-.707106781186548,-1.224744871391589,1.732050807568877],[-.707106781186548,1.224744871391589,-1.732050807568877],[-.707106781186548,1.224744871391589,1.732050807568877],[-.707106781186548,2.041241452319315,.577350269189626],[.707106781186548,-2.041241452319315,-.577350269189626],[.707106781186548,-1.224744871391589,-1.732050807568877],[.707106781186548,-1.224744871391589,1.732050807568877],[.707106781186548,1.224744871391589,-1.732050807568877],[.707106781186548,1.224744871391589,1.732050807568877],[.707106781186548,2.041241452319315,.577350269189626],[1.414213562373095,-1.632993161855452,.577350269189626],[1.414213562373095,0,-1.732050807568877],[1.414213562373095,0,1.732050807568877],[1.414213562373095,1.632993161855452,-.577350269189626],[2.121320343559642,-.408248290463863,.577350269189626],[2.121320343559642,.408248290463863,-.577350269189626]],N=[[4,0,2,8],[10,11,5,1,0,4],[10,16,17,11],[10,4,8,14,20,16],[20,14,18,22],[18,14,8,2,6,12],[7,13,12,6],[2,0,1,3,7,6],[5,9,3,1],[19,13,7,3,9,15],[23,22,18,12,13,19],[21,23,19,15],[21,15,9,5,11,17],[21,17,16,20,22,23]],Y=[[7,13],[12,13],[6,12],[6,7],[0,2],[0,1],[1,3],[3,7],[2,6],[14,18],[8,14],[2,8],[12,18],[13,19],[3,9],[9,15],[15,19],[14,20],[18,22],[20,22],[22,23],[19,23],[5,9],[1,5],[0,4],[4,8],[17,21],[16,17],[16,20],[21,23],[15,21],[5,11],[11,17],[10,11],[4,10],[10,16]],q=[[.5,0,1],[0,.5,1],[.5,1,.5],[1,.5,.5],[1,0,1],[0,0,1],[1,0,0],[0,1,0],[1,.5,0],[1,1,0],[0,1,1],[1,0,.5],[.5,1,0],[0,1,.5]],V=new Array(N.length).fill(!1);window.faceStates=V;window.updateFaceColors=nt;const z=`#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec3 aColor;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vNormal;
out vec3 vWorldPos;
out vec3 vColor;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = mat3(uModel) * aNormal;
    vColor = aColor;
    gl_Position = uProjection * uView * worldPos;
}
`,J=`#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec3 vColor;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
    float diff = max(dot(normal, lightDir), 0.0);

    vec3 color = vColor * (0.3 + 0.7 * diff);

    // Make faces semi-transparent
    float alpha = 0.7;

    // If face is black (off), make it more transparent
    float brightness = (vColor.r + vColor.g + vColor.b) / 3.0;
    if (brightness < 0.01) {
        alpha = 0.2;
    }

    fragColor = vec4(color, alpha);
}
`,G=`#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPos;
}
`,$=`#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;function U(t,n){const a=e.createShader(n);return e.shaderSource(a,t),e.compileShader(a),e.getShaderParameter(a,e.COMPILE_STATUS)?a:(e.deleteShader(a),null)}function O(t,n){const a=U(t,e.VERTEX_SHADER),o=U(n,e.FRAGMENT_SHADER),i=e.createProgram();return e.attachShader(i,a),e.attachShader(i,o),e.linkProgram(i),e.getProgramParameter(i,e.LINK_STATUS)?i:null}const _=O(z,J),D=O(G,$);function K(){const t=[],n=[],a=[],o=[],i=[];return N.forEach(r=>{const u=t.length/3,A=t.length/3,g=M[r[0]],S=M[r[1]],l=M[r[2]],s=[S[0]-g[0],S[1]-g[1],S[2]-g[2]],f=[l[0]-g[0],l[1]-g[1],l[2]-g[2]],h=s[1]*f[2]-s[2]*f[1],b=s[2]*f[0]-s[0]*f[2],E=s[0]*f[1]-s[1]*f[0],P=Math.sqrt(h*h+b*b+E*E),L=P>0?[h/P,b/P,E/P]:[0,0,1],I=[0,0,0];r.forEach(m=>{const p=M[m];t.push(p[0],p[1],p[2]),n.push(...L),a.push(...I)});for(let m=1;m<r.length-1;m++)o.push(u,u+m,u+m+1);i.push({startVertex:A,vertexCount:r.length})}),{positions:new Float32Array(t),normals:new Float32Array(n),colors:new Float32Array(a),indices:new Uint16Array(o),faceInfo:i}}const C=K(),k=e.createVertexArray();e.bindVertexArray(k);const Q=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,Q);e.bufferData(e.ARRAY_BUFFER,C.positions,e.STATIC_DRAW);e.enableVertexAttribArray(0);e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0);const Z=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,Z);e.bufferData(e.ARRAY_BUFFER,C.normals,e.STATIC_DRAW);e.enableVertexAttribArray(1);e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0);const X=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,X);e.bufferData(e.ARRAY_BUFFER,C.colors,e.DYNAMIC_DRAW);e.enableVertexAttribArray(2);e.vertexAttribPointer(2,3,e.FLOAT,!1,0,0);const tt=e.createBuffer();e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,tt);e.bufferData(e.ELEMENT_ARRAY_BUFFER,C.indices,e.STATIC_DRAW);e.bindVertexArray(null);function et(){const t=[];return Y.forEach(([n,a])=>{const o=M[n],i=M[a];t.push(o[0],o[1],o[2]),t.push(i[0],i[1],i[2])}),{positions:new Float32Array(t),count:Y.length*2}}const j=et(),H=e.createVertexArray();e.bindVertexArray(H);const ot=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,ot);e.bufferData(e.ARRAY_BUFFER,j.positions,e.STATIC_DRAW);e.enableVertexAttribArray(0);e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0);e.bindVertexArray(null);function nt(){const t=new Float32Array(C.colors.length);C.faceInfo.forEach((n,a)=>{const i=V[a]?q[a]:[0,0,0];for(let r=0;r<n.vertexCount;r++){const u=(n.startVertex+r)*3;t[u]=i[0],t[u+1]=i[1],t[u+2]=i[2]}}),e.bindBuffer(e.ARRAY_BUFFER,X),e.bufferSubData(e.ARRAY_BUFFER,0,t),e.bindBuffer(e.ARRAY_BUFFER,null)}const rt=window.innerWidth<=768,c={radius:rt?11.2:8,theta:Math.PI/4,phi:Math.PI/3};let x={radius:1},w=!1,F=0,R=0,B=0,y=0,v=0,T=0;function at(t,n,a,o){const i=1/Math.tan(t/2),r=1/(a-o);return new Float32Array([i/n,0,0,0,0,i,0,0,0,0,(o+a)*r,-1,0,0,2*o*a*r,0])}function it(t,n,a){const o=[t[0]-n[0],t[1]-n[1],t[2]-n[2]];let i=Math.sqrt(o[0]*o[0]+o[1]*o[1]+o[2]*o[2]);o[0]/=i,o[1]/=i,o[2]/=i;const r=[a[1]*o[2]-a[2]*o[1],a[2]*o[0]-a[0]*o[2],a[0]*o[1]-a[1]*o[0]];i=Math.sqrt(r[0]*r[0]+r[1]*r[1]+r[2]*r[2]),r[0]/=i,r[1]/=i,r[2]/=i;const u=[o[1]*r[2]-o[2]*r[1],o[2]*r[0]-o[0]*r[2],o[0]*r[1]-o[1]*r[0]];return new Float32Array([r[0],u[0],o[0],0,r[1],u[1],o[1],0,r[2],u[2],o[2],0,-(r[0]*t[0]+r[1]*t[1]+r[2]*t[2]),-(u[0]*t[0]+u[1]*t[1]+u[2]*t[2]),-(o[0]*t[0]+o[1]*t[1]+o[2]*t[2]),1])}d.addEventListener("mousedown",t=>{w=!0,F=t.clientX,R=t.clientY,B=performance.now(),y=0,v=0});d.addEventListener("mousemove",t=>{if(!w)return;const n=performance.now(),a=Math.max(1,n-B),o=t.clientX-F,i=t.clientY-R,r=Math.PI/450*.5,u=-o*r,A=-i*r;c.theta+=u,c.phi+=A,c.phi=Math.max(.01,Math.min(Math.PI-.01,c.phi)),y=u/a*16,v=A/a*16,F=t.clientX,R=t.clientY,B=n});d.addEventListener("mouseup",()=>{w=!1});d.addEventListener("mouseleave",()=>{w=!1});d.addEventListener("wheel",t=>{t.preventDefault();const n=Math.pow(.95,Math.abs(t.deltaY*.01));t.deltaY<0?x.radius/=n:x.radius*=n},{passive:!1});d.addEventListener("touchstart",t=>{t.preventDefault();const n=Array.from(t.touches);if(n.length===1)w=!0,F=n[0].clientX,R=n[0].clientY,B=performance.now(),y=0,v=0;else if(n.length===2){const a=n[0].clientX-n[1].clientX,o=n[0].clientY-n[1].clientY;T=Math.sqrt(a*a+o*o)}},{passive:!1});d.addEventListener("touchmove",t=>{t.preventDefault();const n=Array.from(t.touches);if(n.length===1&&w){const a=performance.now(),o=Math.max(1,a-B),i=n[0].clientX-F,r=n[0].clientY-R,u=Math.PI/450*.5,A=-i*u,g=-r*u;c.theta+=A,c.phi+=g,c.phi=Math.max(.01,Math.min(Math.PI-.01,c.phi)),y=A/o*16,v=g/o*16,F=n[0].clientX,R=n[0].clientY,B=a}else if(n.length===2&&T>0){const a=n[0].clientX-n[1].clientX,o=n[0].clientY-n[1].clientY,i=Math.sqrt(a*a+o*o);if(T>0){const r=T/i;x.radius*=r,T=i}}},{passive:!1});d.addEventListener("touchend",()=>{w=!1,T=0});function st(){const t=d.clientWidth,n=d.clientHeight;(d.width!==t||d.height!==n)&&(d.width=t,d.height=n)}function W(){st(),w||(c.theta+=y,c.phi+=v,c.phi=Math.max(.01,Math.min(Math.PI-.01,c.phi)),y*=.92,v*=.92,Math.abs(y)<1e-4&&(y=0),Math.abs(v)<1e-4&&(v=0)),c.radius*=x.radius,x.radius=1,c.radius=Math.max(1,Math.min(50,c.radius));const t=at(45*Math.PI/180,d.width/d.height,.1,100),n=c.radius*Math.sin(c.phi)*Math.sin(c.theta),a=c.radius*Math.cos(c.phi),o=c.radius*Math.sin(c.phi)*Math.cos(c.theta),i=it([n,a,o],[0,0,0],[0,1,0]),r=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);e.clearColor(.1,.1,.1,1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.viewport(0,0,d.width,d.height),e.enable(e.DEPTH_TEST),e.depthMask(!1),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.useProgram(_),e.uniformMatrix4fv(e.getUniformLocation(_,"uProjection"),!1,t),e.uniformMatrix4fv(e.getUniformLocation(_,"uView"),!1,i),e.uniformMatrix4fv(e.getUniformLocation(_,"uModel"),!1,r),e.bindVertexArray(k),e.drawElements(e.TRIANGLES,C.indices.length,e.UNSIGNED_SHORT,0),e.bindVertexArray(null),e.useProgram(D),e.uniformMatrix4fv(e.getUniformLocation(D,"uProjection"),!1,t),e.uniformMatrix4fv(e.getUniformLocation(D,"uView"),!1,i),e.uniformMatrix4fv(e.getUniformLocation(D,"uModel"),!1,r),e.bindVertexArray(H),e.depthMask(!0),e.drawArrays(e.LINES,0,j.count),e.bindVertexArray(null),requestAnimationFrame(W)}requestAnimationFrame(W);(function(){window.musicState=window.musicState||{visualObj:null,synthController:null,midiBuffer:null,midiToFace:{},isPlaying:!1,currentAbcText:"",isLoading:!1,abortController:null,currentNotes:new Set,noteTimeouts:new Map,playbackStartTime:null};const t=window.musicState;function n(){t.noteTimeouts.forEach(l=>clearTimeout(l)),t.noteTimeouts.clear(),t.currentNotes.clear(),a()}function a(){window.faceStates&&(window.faceStates.fill(!1),t.currentNotes.forEach(l=>{const s=t.midiToFace[l];s!==void 0&&(window.faceStates[s]=!0)}),window.updateFaceColors())}var o=function(){var l=this;l.onStart=function(){console.log("Playback started"),t.isPlaying=!0,n(),t.playbackStartTime=Date.now();const s=document.getElementById("play-button");s&&(s.textContent="Pause")},l.onFinished=function(){console.log("Playback finished"),t.isPlaying=!1,n();const s=document.getElementById("play-button");s&&(s.textContent="Play")},l.onBeat=function(s,f,h){},l.onEvent=function(s){t.playbackStartTime&&(s.midiPitches&&s.midiPitches.length>0&&s.midiPitches.forEach(function(f){const h=f.pitch;t.currentNotes.add(h),t.noteTimeouts.has(h)&&clearTimeout(t.noteTimeouts.get(h));const b=f.duration*s.millisecondsPerMeasure,E=setTimeout(function(){t.currentNotes.delete(h),t.noteTimeouts.delete(h),a()},b);t.noteTimeouts.set(h,E)}),a())}};async function i(l){t.isLoading&&t.abortController?.abort(),t.isLoading=!0,t.abortController=new AbortController;const s=document.getElementById("play-button");try{A(),n(),t.playbackStartTime=null,s&&(s.disabled=!0,s.textContent="Loading");const f=await fetch(`songs/${l}?t=${Date.now()}`,{signal:t.abortController.signal,cache:"no-store"});if(!f.ok)throw new Error(`Failed to load song: ${f.statusText}`);const h=await f.text();if(t.currentAbcText=h,window.faceStates&&(window.faceStates.fill(!1),window.updateFaceColors()),t.visualObj=ABCJS.renderAbc("audio",h)[0],!ABCJS.synth.supportsAudio())throw new Error("Audio not supported in this browser");console.log("Creating MIDI buffer..."),t.midiBuffer=new ABCJS.synth.CreateSynth,await t.midiBuffer.init({visualObj:t.visualObj,options:{program:0,chordsOff:!1,sequenceCallback:function(E){const P=new Set;E.forEach(m=>{m.forEach(p=>{p.pitch!==void 0&&P.add(p.pitch)})});const L=Array.from(P).sort((m,p)=>m-p),I=14;t.midiToFace={},L.forEach((m,p)=>{t.midiToFace[m]=p%I}),console.log(`Mapped ${L.length} unique pitches to ${I} faces`)}}}),await t.midiBuffer.prime(),console.log("MIDI buffer ready"),t.synthController||(console.log("Creating SynthController..."),t.synthController=new ABCJS.synth.SynthController,t.synthController.load("#audio-controls",new o,{displayLoop:!1,displayRestart:!1,displayPlay:!1,displayProgress:!1,displayWarp:!1})),console.log("Setting tune in controller...");const b=t.visualObj.getBpm();console.log("Tempo from Q: field:",b),await t.synthController.setTune(t.visualObj,!0),s&&(s.disabled=!1,s.textContent="Play")}catch(f){if(f.name==="AbortError")return;s&&(s.disabled=!0,s.textContent="Load Failed"),console.error("Failed to load song:",f)}finally{t.isLoading=!1}}async function r(){if(!(!t.synthController||t.isPlaying))try{t.synthController.play()}catch(l){console.error("Error playing music:",l)}}function u(){if(t.synthController)try{t.synthController.pause(),t.isPlaying=!1,t.currentNotes.clear(),window.faceStates&&(window.faceStates.fill(!1),window.updateFaceColors());const l=document.getElementById("play-button");l&&(l.textContent="Play")}catch(l){console.error("Error pausing:",l)}}function A(){if(t.synthController)try{t.synthController.pause(),t.synthController.seek(0)}catch{}t.isPlaying=!1,n();const l=document.getElementById("play-button");l&&(l.textContent="Play")}function g(){t.isLoading||(t.isPlaying?u():r())}function S(l,s=0){typeof ABCJS<"u"?l():s>50?alert("Failed to load music library. Please refresh the page."):setTimeout(()=>S(l,s+1),100)}document.addEventListener("DOMContentLoaded",()=>{const l=document.getElementById("start-overlay");l&&l.addEventListener("click",()=>{l.classList.add("hidden"),S(()=>{const s=document.getElementById("song-select"),f=document.getElementById("play-button");s&&s.addEventListener("change",h=>{i(h.target.value)}),f&&f.addEventListener("click",g),window.addEventListener("blur",()=>{n()}),i("cello-suite.abc")})})})})();
