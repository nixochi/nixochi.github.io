const l=document.getElementById("glCanvas");let e;const R={vertices:[[1,.5,0],[1,-.5,0],[-1,.5,0],[-1,-.5,0],[1,0,.5],[1,0,-.5],[-1,0,.5],[-1,0,-.5],[.5,1,0],[.5,-1,0],[-.5,1,0],[-.5,-1,0],[.5,0,1],[.5,0,-1],[-.5,0,1],[-.5,0,-1],[0,1,.5],[0,1,-.5],[0,-1,.5],[0,-1,-.5],[0,.5,1],[0,.5,-1],[0,-.5,1],[0,-.5,-1]],edges:[[15,21],[13,21],[13,23],[15,23],[12,20],[14,20],[14,22],[12,22],[1,5],[1,9],[9,19],[19,23],[5,13],[8,17],[0,8],[0,5],[17,21],[3,11],[3,7],[7,15],[11,19],[9,18],[11,18],[3,6],[18,22],[6,14],[2,6],[2,7],[4,12],[1,4],[0,4],[10,17],[2,10],[8,16],[10,16],[16,20]]},r={radius:5,theta:Math.PI/4,phi:Math.PI/3,isDragging:!1,lastX:0,lastY:0,velocityTheta:0,velocityPhi:0},N=10,D=.92,U=.002,S=.1,y=50,b=1e3/N;let C=0;const g="@%#*+=-:. ",O=`
            attribute vec3 aPos;
            uniform mat4 uMVP;
            void main() {
                gl_Position = uMVP * vec4(aPos, 1.0);
            }
        `,G=`
            precision mediump float;
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
            }
        `,H=`
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `,V=`
            precision mediump float;
            uniform sampler2D u_sceneTexture;
            uniform sampler2D u_charTexture;
            uniform vec2 u_charResolution;
            uniform float u_numChars;
            varying vec2 v_texCoord;

            float getBrightness(vec3 color) {
                return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
            }

            void main() {
                // Calculate which character cell we're in
                vec2 charCoord = floor(v_texCoord * u_charResolution);
                vec2 charUV = fract(v_texCoord * u_charResolution);

                // Sample scene at character cell center
                vec2 videoSamplePos = (charCoord + 0.5) / u_charResolution;
                vec4 sceneColor = texture2D(u_sceneTexture, videoSamplePos);

                // Calculate brightness and INVERT it
                float brightness = 1.0 - getBrightness(sceneColor.rgb);

                // Map brightness to character index
                float charIndex = floor(brightness * u_numChars);
                charIndex = clamp(charIndex, 0.0, u_numChars - 1.0);

                // Look up character from texture atlas
                vec2 atlasUV = vec2(
                    (charIndex + charUV.x) / u_numChars,
                    charUV.y
                );

                vec4 charColor = texture2D(u_charTexture, atlasUV);

                // Apply green terminal color
                gl_FragColor = vec4(0.0, charColor.r, 0.0, 1.0);
            }
        `;let _,E,p,v,B,A,x,F,P,M;function W(){return e=l.getContext("webgl")||l.getContext("experimental-webgl"),e?!0:(alert("WebGL not supported"),!1)}function L(t,n){const a=e.createShader(n);return e.shaderSource(a,t),e.compileShader(a),e.getShaderParameter(a,e.COMPILE_STATUS)?a:(console.error("Shader compile error:",e.getShaderInfoLog(a)),e.deleteShader(a),null)}function X(t,n){const a=L(t,e.VERTEX_SHADER),o=L(n,e.FRAGMENT_SHADER),i=e.createProgram();return e.attachShader(i,a),e.attachShader(i,o),e.linkProgram(i),e.getProgramParameter(i,e.LINK_STATUS)?i:(console.error("Program link error:",e.getProgramInfoLog(i)),null)}function q(){const a=document.createElement("canvas");a.width=8*g.length,a.height=16;const o=a.getContext("2d");o.fillStyle="#000",o.fillRect(0,0,a.width,a.height),o.fillStyle="#fff",o.font='16px "Courier New", monospace',o.textBaseline="top",o.textAlign="left";for(let u=0;u<g.length;u++)o.fillText(g[u],u*8,0);const i=e.createTexture();return e.bindTexture(e.TEXTURE_2D,i),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),i}function k(t,n){const a=e.createTexture();e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,n,0,e.RGBA,e.UNSIGNED_BYTE,null);const o=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,o),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0);const i=e.createRenderbuffer();return e.bindRenderbuffer(e.RENDERBUFFER,i),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT16,t,n),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,i),e.bindFramebuffer(e.FRAMEBUFFER,null),{texture:a,framebuffer:o}}function z(){const t=[];R.edges.forEach(([n,a])=>{t.push(...R.vertices[n],...R.vertices[a])}),M=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,M),e.bufferData(e.ARRAY_BUFFER,new Float32Array(t),e.STATIC_DRAW)}function Z(t){const n=new Float32Array([-1,-1,1,-1,-1,1,1,1]),a=new Float32Array([0,1,1,1,0,0,1,0]);F||(F=e.createBuffer()),e.bindBuffer(e.ARRAY_BUFFER,F),e.bufferData(e.ARRAY_BUFFER,n,e.STATIC_DRAW);const o=e.getAttribLocation(t,"a_position");e.enableVertexAttribArray(o),e.vertexAttribPointer(o,2,e.FLOAT,!1,0,0),P||(P=e.createBuffer()),e.bindBuffer(e.ARRAY_BUFFER,P),e.bufferData(e.ARRAY_BUFFER,a,e.STATIC_DRAW);const i=e.getAttribLocation(t,"a_texCoord");e.enableVertexAttribArray(i),e.vertexAttribPointer(i,2,e.FLOAT,!1,0,0)}function Q(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}function I(t,n){const a=new Float32Array(16);for(let o=0;o<4;o++)for(let i=0;i<4;i++)a[o*4+i]=t[0+i]*n[o*4+0]+t[4+i]*n[o*4+1]+t[8+i]*n[o*4+2]+t[12+i]*n[o*4+3];return a}function K(t,n,a,o){const i=1/Math.tan(t/2),u=1/(a-o),h=new Float32Array(16);return h[0]=i/n,h[5]=i,h[10]=(o+a)*u,h[11]=-1,h[14]=2*o*a*u,h}function $(t,n,a){const o=(c,s)=>[c[0]-s[0],c[1]-s[1],c[2]-s[2]],i=(c,s)=>[c[1]*s[2]-c[2]*s[1],c[2]*s[0]-c[0]*s[2],c[0]*s[1]-c[1]*s[0]],u=(c,s)=>c[0]*s[0]+c[1]*s[1]+c[2]*s[2],h=c=>{const s=Math.sqrt(c[0]*c[0]+c[1]*c[1]+c[2]*c[2]);return s>0?[c[0]/s,c[1]/s,c[2]/s]:[0,0,0]},f=h(o(t,n)),d=h(i(a,f)),T=i(f,d);return new Float32Array([d[0],T[0],f[0],0,d[1],T[1],f[1],0,d[2],T[2],f[2],0,-u(d,t),-u(T,t),-u(f,t),1])}function w(){l.width=window.innerWidth,l.height=window.innerHeight,e.viewport(0,0,l.width,l.height);const t=8,n=16;A=Math.floor(l.width/t),x=Math.floor(l.height/n),v&&(e.deleteFramebuffer(v),e.deleteTexture(p));const a=k(A,x);p=a.texture,v=a.framebuffer}function j(){r.isDragging||(r.theta+=r.velocityTheta,r.phi+=r.velocityPhi,r.phi=Math.max(.01,Math.min(Math.PI-.01,r.phi)),r.velocityTheta*=D,r.velocityPhi*=D,Math.abs(r.velocityTheta)<U&&(r.velocityTheta=0),Math.abs(r.velocityPhi)<U&&(r.velocityPhi=0))}function Y(t){requestAnimationFrame(Y);const n=t-C;if(n<b)return;C=t-n%b,j();const a=l.width/l.height,o=K(60*Math.PI/180,a,.01,100),i=r.radius*Math.sin(r.phi)*Math.sin(r.theta),u=r.radius*Math.cos(r.phi),h=r.radius*Math.sin(r.phi)*Math.cos(r.theta),d=$([i,u,h],[0,0,0],[0,1,0]),T=Q(),c=I(I(o,d),T);e.bindFramebuffer(e.FRAMEBUFFER,v),e.viewport(0,0,A,x),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.enable(e.DEPTH_TEST),e.useProgram(_),e.uniformMatrix4fv(e.getUniformLocation(_,"uMVP"),!1,c),e.bindBuffer(e.ARRAY_BUFFER,M);const s=e.getAttribLocation(_,"aPos");e.enableVertexAttribArray(s),e.vertexAttribPointer(s,3,e.FLOAT,!1,0,0),e.drawArrays(e.LINES,0,R.edges.length*2),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,l.width,l.height),e.disable(e.DEPTH_TEST),e.useProgram(E),Z(E),e.uniform2f(e.getUniformLocation(E,"u_charResolution"),A,x),e.uniform1f(e.getUniformLocation(E,"u_numChars"),g.length),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,p),e.uniform1i(e.getUniformLocation(E,"u_sceneTexture"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,B),e.uniform1i(e.getUniformLocation(E,"u_charTexture"),1),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4)}l.addEventListener("mousedown",t=>{t.preventDefault(),r.isDragging=!0,r.lastX=t.clientX,r.lastY=t.clientY,r.velocityTheta=0,r.velocityPhi=0});l.addEventListener("mousemove",t=>{if(!r.isDragging)return;t.preventDefault();const n=t.clientX-r.lastX,a=t.clientY-r.lastY,o=Math.PI/450;r.theta-=n*o,r.phi-=a*o,r.phi=Math.max(.01,Math.min(Math.PI-.01,r.phi)),r.velocityTheta=-n*o*.1,r.velocityPhi=-a*o*.1,r.lastX=t.clientX,r.lastY=t.clientY});l.addEventListener("mouseup",()=>{r.isDragging=!1});l.addEventListener("mouseleave",()=>{r.isDragging=!1});l.addEventListener("wheel",t=>{t.preventDefault();const n=Math.pow(.95,Math.abs(t.deltaY*.01));t.deltaY<0?r.radius/=n:r.radius*=n,r.radius=Math.max(S,Math.min(y,r.radius))},{passive:!1});let m=0;l.addEventListener("touchstart",t=>{if(t.preventDefault(),t.touches.length===1)r.isDragging=!0,r.lastX=t.touches[0].clientX,r.lastY=t.touches[0].clientY,r.velocityTheta=0,r.velocityPhi=0;else if(t.touches.length===2){const n=t.touches[0].clientX-t.touches[1].clientX,a=t.touches[0].clientY-t.touches[1].clientY;m=Math.sqrt(n*n+a*a)}},{passive:!1});l.addEventListener("touchmove",t=>{if(t.preventDefault(),t.touches.length===1&&r.isDragging){const n=t.touches[0].clientX-r.lastX,a=t.touches[0].clientY-r.lastY,o=Math.PI/450;r.theta-=n*o,r.phi-=a*o,r.phi=Math.max(.01,Math.min(Math.PI-.01,r.phi)),r.velocityTheta=-n*o*.1,r.velocityPhi=-a*o*.1,r.lastX=t.touches[0].clientX,r.lastY=t.touches[0].clientY}else if(t.touches.length===2){const n=t.touches[0].clientX-t.touches[1].clientX,a=t.touches[0].clientY-t.touches[1].clientY,o=Math.sqrt(n*n+a*a);if(m>0){const i=o/m;r.radius/=i,r.radius=Math.max(S,Math.min(y,r.radius))}m=o}},{passive:!1});l.addEventListener("touchend",t=>{t.preventDefault(),t.touches.length===0&&(r.isDragging=!1,m=0)},{passive:!1});l.addEventListener("touchcancel",t=>{t.preventDefault(),r.isDragging=!1,m=0},{passive:!1});window.addEventListener("resize",w);W()&&(_=X(O,G),E=X(H,V),B=q(),z(),w(),e.clearColor(0,0,0,1),requestAnimationFrame(Y));
