import{W as y,P as x,S as z,C as S,O as C,I as T,B as W,a as A,b as g,c as q}from"./OrbitControls.BZ49gu_k.js";const i=new y({antialias:!1,powerPreference:"high-performance",stencil:!1,depth:!0});i.setPixelRatio(1);i.setSize(window.innerWidth,window.innerHeight);document.body.appendChild(i.domElement);const r=new x(75,window.innerWidth/window.innerHeight,.1,1e3);r.position.set(100,100,100);const w=new z;w.background=new S(0);const n=new C(r,i.domElement);n.enableDamping=!0;n.dampingFactor=.05;n.enablePan=!1;n.target.set(0,0,0);n.minDistance=.1;n.maxDistance=500;let t=null,v=0;const f=70;function B(){const o=[],e=f;for(let s=0;s<2;s++)for(let l=0;l<2;l++)for(let d=0;d<2;d++)if((s+l+d)%2===0)for(let c=-e+s;c<=e;c+=2)for(let u=-e+l;u<=e;u+=2)for(let m=-e+d;m<=e;m+=2)o.push(c,u,m);const a=new T,h=new Float32Array([0,0,0]);a.setAttribute("position",new W(h,3));const P=new Float32Array(o);a.setAttribute("instancePosition",new A(P,3));const b=new g({uniforms:{uTime:{value:0}},vertexShader:`
            attribute vec3 instancePosition;
            varying vec3 vPosition;

            void main() {
                vPosition = instancePosition;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(instancePosition, 1.0);
                gl_PointSize = 2.0;
            }
        `,fragmentShader:`
            uniform float uTime;
            varying vec3 vPosition;

            void main() {
                // Radial wave equation: sin(t + sqrt(x^2+y^2+z^2)*10)*0.5 + 0.5
                // Where x,y,z are in [-1,1], so we normalize vPosition by 70.0
                float value = sin(uTime + length(vPosition) / 70.0 * 10.0) * 0.5 + 0.5;

                // Interpolate between red (value=0) and blue (value=1)
                gl_FragColor = vec4(1.0 - value, 0.0, value, 1.0);
            }
        `,depthTest:!0,depthWrite:!0,transparent:!1});t=new q(a,b),w.add(t),console.log(`Generated BCC lattice with ${o.length/3} points (size: ${f}) using instanced rendering + GPU shaders`)}function F(o){if(!t){console.warn("No lattice to update");return}const e=v;t.material.dispose();const a=new g({uniforms:{uTime:{value:e}},vertexShader:`
            attribute vec3 instancePosition;
            varying vec3 vPosition;

            void main() {
                vPosition = instancePosition;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(instancePosition, 1.0);
                gl_PointSize = 2.0;
            }
        `,fragmentShader:`
            uniform float uTime;
            varying vec3 vPosition;

            void main() {
                // User-defined equation (already clamped to [0,1])
                float value = ${o};

                // Interpolate between red (value=0) and blue (value=1)
                gl_FragColor = vec4(1.0 - value, 0.0, value, 1.0);
            }
        `,depthTest:!0,depthWrite:!0,transparent:!1});t.material=a,console.log("Shader equation updated")}B();window.worldInstance={updateEquation:F};console.log("Shader-based BCC lattice initialized");console.log("Colors are calculated entirely on the GPU!");function p(){requestAnimationFrame(p),n.enableDamping&&n.update(),t&&t.material.uniforms&&(v+=.05,t.material.uniforms.uTime.value=v),i.render(w,r)}window.addEventListener("resize",()=>{r.aspect=window.innerWidth/window.innerHeight,r.updateProjectionMatrix(),i.setSize(window.innerWidth,window.innerHeight)});p();
