const a={textureWidth:512,textureHeight:256,brushRadius:3,explosionRadius:15,cameraDistance:8,mobileZoomFactor:1.3,doubleTapDelay:300},d={vertices:[[-2.121320343559642,-.408248290463863,.577350269189626],[-2.121320343559642,.408248290463863,-.577350269189626],[-1.414213562373095,-1.632993161855452,.577350269189626],[-1.414213562373095,0,-1.732050807568877],[-1.414213562373095,0,1.732050807568877],[-1.414213562373095,1.632993161855452,-.577350269189626],[-.707106781186548,-2.041241452319315,-.577350269189626],[-.707106781186548,-1.224744871391589,-1.732050807568877],[-.707106781186548,-1.224744871391589,1.732050807568877],[-.707106781186548,1.224744871391589,-1.732050807568877],[-.707106781186548,1.224744871391589,1.732050807568877],[-.707106781186548,2.041241452319315,.577350269189626],[.707106781186548,-2.041241452319315,-.577350269189626],[.707106781186548,-1.224744871391589,-1.732050807568877],[.707106781186548,-1.224744871391589,1.732050807568877],[.707106781186548,1.224744871391589,-1.732050807568877],[.707106781186548,1.224744871391589,1.732050807568877],[.707106781186548,2.041241452319315,.577350269189626],[1.414213562373095,-1.632993161855452,.577350269189626],[1.414213562373095,0,-1.732050807568877],[1.414213562373095,0,1.732050807568877],[1.414213562373095,1.632993161855452,-.577350269189626],[2.121320343559642,-.408248290463863,.577350269189626],[2.121320343559642,.408248290463863,-.577350269189626]],faces:[[7,13,12,6],[2,0,1,3,7,6],[18,14,8,2,6,12],[19,13,7,3,9,15],[20,14,18,22],[23,22,18,12,13,19],[5,9,3,1],[4,0,2,8],[21,17,16,20,22,23],[21,23,19,15],[21,15,9,5,11,17],[10,11,5,1,0,4],[10,4,8,14,20,16],[10,16,17,11]],edges:[[7,13],[12,13],[6,12],[6,7],[0,2],[0,1],[1,3],[3,7],[2,6],[14,18],[8,14],[2,8],[12,18],[13,19],[3,9],[9,15],[15,19],[14,20],[18,22],[20,22],[22,23],[19,23],[5,9],[1,5],[0,4],[4,8],[17,21],[16,17],[16,20],[21,23],[15,21],[5,11],[11,17],[10,11],[4,10],[10,16]]};function y(){const t=[],n=[];return d.faces.forEach(s=>{const o=t.length/3;s.forEach(r=>{const i=d.vertices[r];t.push(i[0],i[1],i[2])});for(let r=1;r<s.length-1;r++)n.push(o,o+r,o+r+1)}),{positions:new Float32Array(t),indices:new Uint16Array(n)}}function N(){const t=[];return d.edges.forEach(([n,s])=>{const o=d.vertices[n],r=d.vertices[s];t.push(o[0],o[1],o[2]),t.push(r[0],r[1],r[2])}),{positions:new Float32Array(t),count:d.edges.length*2}}const I=`#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUV;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aPosition * 0.5 + 0.5;
}
`,H=`#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uPrevState;
uniform vec2 uResolution;
uniform vec2 uMouseUV;
uniform float uMouseRadius;
uniform float uExplosionRadius;
uniform float uHasHover;
uniform float uMouseDown;

out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float torusDistance(vec2 p1, vec2 p2, vec2 resolution) {
    vec2 delta = p1 - p2;

    float dx = delta.x * resolution.x;
    if (abs(dx) > resolution.x * 0.5) {
        dx = resolution.x - abs(dx);
    } else {
        dx = abs(dx);
    }

    float dy = abs(delta.y * resolution.y);

    return sqrt(dx * dx + dy * dy);
}

void main() {
    vec2 pixelSize = 1.0 / uResolution;

    float count = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;

            vec2 offset = vec2(float(x), float(y)) * pixelSize;
            vec2 samplePos = vUV + offset;

            samplePos.x = fract(samplePos.x);

            if (samplePos.y < 0.0) {
                samplePos.y = -samplePos.y;
                samplePos.x = fract(samplePos.x + 0.5);
            } else if (samplePos.y > 1.0) {
                samplePos.y = 2.0 - samplePos.y;
                samplePos.x = fract(samplePos.x + 0.5);
            }

            float cell = texture(uPrevState, samplePos).r;
            count += cell;
        }
    }

    float current = texture(uPrevState, vUV).r;

    float next = 0.0;
    if (current > 0.5) {
        if (count >= 2.0 && count <= 3.0) {
            next = 1.0;
        }
    } else {
        if (count >= 2.9 && count <= 3.1) {
            next = 1.0;
        }
    }

    if (uHasHover > 0.5) {
        float dist = torusDistance(vUV, uMouseUV, uResolution);

        if (uMouseDown > 0.5) {
            if (dist < uExplosionRadius) {
                if (random(vUV + uMouseUV) > 0.5) {
                    next = 1.0;
                }
            }
        } else {
            if (dist < uMouseRadius) {
                next = 1.0;
            }
        }
    }

    fragColor = vec4(next, next, next, 1.0);
}
`,O=`#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vObjectPos;

void main() {
    vObjectPos = aPosition;
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPos;
}
`,X=`#version 300 es
precision highp float;

in vec3 vObjectPos;
out vec4 fragColor;

void main() {
    vec3 dir = normalize(vObjectPos);
    float u = atan(dir.z, dir.x) / (2.0 * 3.14159265359) + 0.5;
    float v = acos(dir.y) / 3.14159265359;

    fragColor = vec4(u, v, 1.0, 1.0);
}
`,C=`#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vObjectPos;
out vec3 vWorldPos;
out vec3 vNormal;

void main() {
    vObjectPos = aPosition;
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = mat3(uModel) * aPosition;
    gl_Position = uProjection * uView * worldPos;
}
`,Y=`#version 300 es
precision highp float;

in vec3 vObjectPos;
in vec3 vWorldPos;
in vec3 vNormal;

uniform sampler2D uTexture;

out vec4 fragColor;

void main() {
    vec3 dir = normalize(vObjectPos);

    float u = atan(dir.z, dir.x) / (2.0 * 3.14159265359) + 0.5;
    float v = acos(dir.y) / 3.14159265359;

    float val = texture(uTexture, vec2(u, v)).r;

    vec3 color = vec3(0.05, 0.05, 0.08);
    if (val > 0.5) {
        color = vec3(0.0, 1.0, 0.5);
    }

    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
    float diff = max(dot(normal, lightDir), 0.0);
    color *= (0.5 + 0.5 * diff);

    fragColor = vec4(color, 1.0);
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
`,k=`#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;function j(t,n,s,o){const r=1/Math.tan(t/2),i=1/(s-o);return new Float32Array([r/n,0,0,0,0,r,0,0,0,0,(o+s)*i,-1,0,0,2*o*s*i,0])}function W(t,n,s){const o=[t[0]-n[0],t[1]-n[1],t[2]-n[2]];let r=Math.sqrt(o[0]*o[0]+o[1]*o[1]+o[2]*o[2]);o[0]/=r,o[1]/=r,o[2]/=r;const i=[s[1]*o[2]-s[2]*o[1],s[2]*o[0]-s[0]*o[2],s[0]*o[1]-s[1]*o[0]];r=Math.sqrt(i[0]*i[0]+i[1]*i[1]+i[2]*i[2]),i[0]/=r,i[1]/=r,i[2]/=r;const u=[o[1]*i[2]-o[2]*i[1],o[2]*i[0]-o[0]*i[2],o[0]*i[1]-o[1]*i[0]];return new Float32Array([i[0],u[0],o[0],0,i[1],u[1],o[1],0,i[2],u[2],o[2],0,-(i[0]*t[0]+i[1]*t[1]+i[2]*t[2]),-(u[0]*t[0]+u[1]*t[1]+u[2]*t[2]),-(o[0]*t[0]+o[1]*t[1]+o[2]*t[2]),1])}function z(t){const n=Math.cos(t),s=Math.sin(t);return new Float32Array([n,0,-s,0,0,1,0,0,s,0,n,0,0,0,0,1])}function p(t,n,s){const o=t.createShader(s);return t.shaderSource(o,n),t.compileShader(o),t.getShaderParameter(o,t.COMPILE_STATUS)?o:(console.error("Shader compile error:",t.getShaderInfoLog(o)),t.deleteShader(o),null)}function T(t,n,s){const o=p(t,n,t.VERTEX_SHADER),r=p(t,s,t.FRAGMENT_SHADER),i=t.createProgram();return t.attachShader(i,o),t.attachShader(i,r),t.linkProgram(i),t.getProgramParameter(i,t.LINK_STATUS)?i:(console.error("Program link error:",t.getProgramInfoLog(i)),null)}function U(t,n,s){const o=t.createTexture();t.bindTexture(t.TEXTURE_2D,o);const r=new Uint8Array(n*s*4);for(let i=0;i<r.length;i+=4)r[i]=0,r[i+1]=0,r[i+2]=0,r[i+3]=255;return t.texImage2D(t.TEXTURE_2D,0,t.RGBA,n,s,0,t.RGBA,t.UNSIGNED_BYTE,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST),o}function b(t,n){const s=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,s),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,n,0);const o=t.checkFramebufferStatus(t.FRAMEBUFFER);return o!==t.FRAMEBUFFER_COMPLETE&&console.error("Framebuffer not complete:",o),t.bindFramebuffer(t.FRAMEBUFFER,null),s}function D(t,n,s=null){const o=t.createVertexArray();t.bindVertexArray(o);const r=t.createBuffer();if(t.bindBuffer(t.ARRAY_BUFFER,r),t.bufferData(t.ARRAY_BUFFER,n,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,0,0),s){const i=t.createBuffer();t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,i),t.bufferData(t.ELEMENT_ARRAY_BUFFER,s,t.STATIC_DRAW)}return t.bindVertexArray(null),o}class q{constructor(n,s,o,r,i,u){this.canvas=n,this.gl=s,this.pickingProgram=o,this.pickingFBO=r,this.permutahedronVAO=i,this.permutahedronIndicesLength=u,this.mouseScreenX=-1,this.mouseScreenY=-1,this.mouseActive=!1,this.mouseDown=!1,this.mouseUVX=-1,this.mouseUVY=-1,this.hasHover=0,this.lastTapTime=0,this.isMobile=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)||window.innerWidth<=768,this.setupEventListeners()}setupEventListeners(){this.canvas.addEventListener("mousemove",n=>{this.mouseScreenX=n.clientX,this.mouseScreenY=n.clientY,this.mouseActive=!0}),this.canvas.addEventListener("mouseleave",()=>{this.mouseActive=!1,this.hasHover=0}),this.canvas.addEventListener("mousedown",()=>{this.mouseDown=!0}),this.canvas.addEventListener("mouseup",()=>{this.mouseDown=!1}),this.canvas.addEventListener("touchstart",n=>{n.preventDefault();const s=n.touches[0];this.mouseScreenX=s.clientX,this.mouseScreenY=s.clientY,this.mouseActive=!0;const o=Date.now(),r=o-this.lastTapTime;r<a.doubleTapDelay&&r>0&&(this.mouseDown=!0),this.lastTapTime=o},{passive:!1}),this.canvas.addEventListener("touchmove",n=>{n.preventDefault();const s=n.touches[0];this.mouseScreenX=s.clientX,this.mouseScreenY=s.clientY,this.mouseActive=!0},{passive:!1}),this.canvas.addEventListener("touchend",n=>{n.preventDefault(),n.touches.length===0&&(this.mouseActive=!1,this.mouseDown=!1,this.hasHover=0)},{passive:!1}),this.canvas.addEventListener("touchcancel",n=>{n.preventDefault(),this.mouseActive=!1,this.mouseDown=!1,this.hasHover=0},{passive:!1})}updatePickingTexture(n,s){const o=this.gl;o.bindTexture(o.TEXTURE_2D,n),o.texImage2D(o.TEXTURE_2D,0,o.RGBA,this.canvas.width,this.canvas.height,0,o.RGBA,o.UNSIGNED_BYTE,null),o.bindRenderbuffer(o.RENDERBUFFER,s),o.renderbufferStorage(o.RENDERBUFFER,o.DEPTH_COMPONENT16,this.canvas.width,this.canvas.height)}readUVAtMouse(n,s,o){if(!this.mouseActive){this.hasHover=0;return}const r=this.gl,i=this.canvas.getBoundingClientRect(),u=this.mouseScreenX-i.left;r.bindFramebuffer(r.FRAMEBUFFER,this.pickingFBO),r.viewport(0,0,this.canvas.width,this.canvas.height),r.clearColor(0,0,0,1),r.clear(r.COLOR_BUFFER_BIT|r.DEPTH_BUFFER_BIT),r.enable(r.DEPTH_TEST),r.useProgram(this.pickingProgram),r.uniformMatrix4fv(r.getUniformLocation(this.pickingProgram,"uProjection"),!1,n),r.uniformMatrix4fv(r.getUniformLocation(this.pickingProgram,"uView"),!1,s),r.uniformMatrix4fv(r.getUniformLocation(this.pickingProgram,"uModel"),!1,o),r.bindVertexArray(this.permutahedronVAO),r.drawElements(r.TRIANGLES,this.permutahedronIndicesLength,r.UNSIGNED_SHORT,0),r.bindVertexArray(null);const V=i.height-(this.mouseScreenY-i.top),h=new Uint8Array(4);r.readPixels(u,V,1,1,r.RGBA,r.UNSIGNED_BYTE,h),r.bindFramebuffer(r.FRAMEBUFFER,null),h[2]>128?(this.mouseUVX=h[0]/255,this.mouseUVY=h[1]/255,this.hasHover=1):this.hasHover=0}}const c=document.getElementById("canvas"),e=c.getContext("webgl2");e||console.error("WebGL2 not supported");const f=T(e,I,H),l=T(e,C,Y),Z=T(e,O,X),v=T(e,G,k),R=y(),_=D(e,R.positions,R.indices),M=N(),K=D(e,M.positions);let S=U(e,a.textureWidth,a.textureHeight),g=U(e,a.textureWidth,a.textureHeight),J=b(e,S),Q=b(e,g),x={texture:S,fbo:J},E={texture:g,fbo:Q};const A=e.createTexture();e.bindTexture(e.TEXTURE_2D,A);e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,null);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST);const P=e.createRenderbuffer();e.bindRenderbuffer(e.RENDERBUFFER,P);e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT16,1,1);const B=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,B);e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,A,0);e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,P);e.bindFramebuffer(e.FRAMEBUFFER,null);const m=new q(c,e,Z,B,_,R.indices.length),$=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),w=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,w);e.bufferData(e.ARRAY_BUFFER,$,e.STATIC_DRAW);let F=0;function ee(){const t=c.clientWidth,n=c.clientHeight;(c.width!==t||c.height!==n)&&(c.width=t,c.height=n)}function L(t){ee(),F=t*2e-4;const n=m.isMobile?a.cameraDistance*a.mobileZoomFactor:a.cameraDistance,s=j(45*Math.PI/180,c.width/c.height,.1,100),o=W([0,0,n],[0,0,0],[0,1,0]),r=z(F);m.updatePickingTexture(A,P),m.readUVAtMouse(s,o,r),e.bindFramebuffer(e.FRAMEBUFFER,E.fbo),e.viewport(0,0,a.textureWidth,a.textureHeight),e.useProgram(f),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,x.texture),e.uniform1i(e.getUniformLocation(f,"uPrevState"),0),e.uniform2f(e.getUniformLocation(f,"uResolution"),a.textureWidth,a.textureHeight),e.uniform2f(e.getUniformLocation(f,"uMouseUV"),m.mouseUVX,m.mouseUVY),e.uniform1f(e.getUniformLocation(f,"uMouseRadius"),a.brushRadius),e.uniform1f(e.getUniformLocation(f,"uExplosionRadius"),a.explosionRadius),e.uniform1f(e.getUniformLocation(f,"uHasHover"),m.hasHover),e.uniform1f(e.getUniformLocation(f,"uMouseDown"),m.mouseDown?1:0);const i=e.getAttribLocation(f,"aPosition");e.enableVertexAttribArray(i),e.bindBuffer(e.ARRAY_BUFFER,w),e.vertexAttribPointer(i,2,e.FLOAT,!1,0,0),e.drawArrays(e.TRIANGLES,0,6),e.bindFramebuffer(e.FRAMEBUFFER,null),e.clearColor(.1,.1,.1,1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.viewport(0,0,c.width,c.height),e.enable(e.DEPTH_TEST),e.useProgram(l),e.uniformMatrix4fv(e.getUniformLocation(l,"uProjection"),!1,s),e.uniformMatrix4fv(e.getUniformLocation(l,"uView"),!1,o),e.uniformMatrix4fv(e.getUniformLocation(l,"uModel"),!1,r),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,E.texture),e.uniform1i(e.getUniformLocation(l,"uTexture"),0),e.bindVertexArray(_),e.drawElements(e.TRIANGLES,R.indices.length,e.UNSIGNED_SHORT,0),e.bindVertexArray(null),e.useProgram(v),e.uniformMatrix4fv(e.getUniformLocation(v,"uProjection"),!1,s),e.uniformMatrix4fv(e.getUniformLocation(v,"uView"),!1,o),e.uniformMatrix4fv(e.getUniformLocation(v,"uModel"),!1,r),e.bindVertexArray(K),e.drawArrays(e.LINES,0,M.count),e.bindVertexArray(null);const u=x;x=E,E=u,requestAnimationFrame(L)}requestAnimationFrame(L);
