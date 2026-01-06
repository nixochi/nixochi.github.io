const d=document.getElementById("video"),i=document.getElementById("glCanvas"),U=document.getElementById("error"),D="@%#*+=-:. ",S=.5,m=`
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;

            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `,P=`
            precision mediump float;

            uniform sampler2D u_videoTexture;
            uniform vec2 u_charResolution;

            varying vec2 v_texCoord;

            float getBrightness(vec3 color) {
                return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
            }

            void main() {
                vec2 texelSize = 1.0 / u_charResolution;

                // Sobel kernels for edge detection
                float gx = 0.0;
                float gy = 0.0;

                // Sample 3x3 neighborhood
                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 offset = vec2(float(x), float(y)) * texelSize;
                        vec3 color = texture2D(u_videoTexture, v_texCoord + offset).rgb;
                        float brightness = getBrightness(color);

                        // Sobel X (vertical edges)
                        float sobelX = 0.0;
                        if (x == -1) sobelX = -1.0;
                        else if (x == 1) sobelX = 1.0;
                        if (y == -1) sobelX *= 1.0;
                        else if (y == 0) sobelX *= 2.0;
                        else if (y == 1) sobelX *= 1.0;
                        gx += brightness * sobelX;

                        // Sobel Y (horizontal edges)
                        float sobelY = 0.0;
                        if (y == -1) sobelY = -1.0;
                        else if (y == 1) sobelY = 1.0;
                        if (x == -1) sobelY *= 1.0;
                        else if (x == 0) sobelY *= 2.0;
                        else if (x == 1) sobelY *= 1.0;
                        gy += brightness * sobelY;
                    }
                }

                // Calculate edge magnitude and direction
                float magnitude = sqrt(gx * gx + gy * gy);
                float angle = atan(gy, gx); // -PI to PI

                // Normalize angle to 0-1 range
                float normalizedAngle = (angle + 3.14159265) / (2.0 * 3.14159265);

                // Store magnitude in R, angle in G, original brightness in B
                vec3 edgeData = vec3(magnitude, normalizedAngle, getBrightness(texture2D(u_videoTexture, v_texCoord).rgb));

                gl_FragColor = vec4(edgeData, 1.0);
            }
        `,X=`
            precision mediump float;

            uniform sampler2D u_edgeTexture;
            uniform sampler2D u_charTexture;
            uniform vec2 u_charResolution;
            uniform float u_numChars;
            uniform float u_edgeThreshold;

            varying vec2 v_texCoord;

            void main() {
                // Calculate which character cell we're in
                vec2 charCoord = floor(v_texCoord * u_charResolution);
                vec2 charUV = fract(v_texCoord * u_charResolution);

                // Sample edge data at character cell center
                // Flip Y because framebuffer texture has inverted Y
                vec2 samplePos = (charCoord + 0.5) / u_charResolution;
                samplePos.y = 1.0 - samplePos.y;
                vec4 edgeData = texture2D(u_edgeTexture, samplePos);

                float edgeMagnitude = edgeData.r;
                float edgeAngle = edgeData.g;

                // Only render if there's an edge
                if (edgeMagnitude > u_edgeThreshold) {
                    // Convert normalized angle (0-1) to degrees (0-360)
                    float degrees = edgeAngle * 360.0;

                    // Map angle to edge character index
                    // 0: - (horizontal)
                    // 1: / (diagonal)
                    // 2: | (vertical)
                    // 3: \\ (diagonal)
                    // 4: (space - unused)

                    float charIndex = 0.0;

                    if (degrees < 22.5 || degrees >= 337.5) {
                        charIndex = 0.0; // - (horizontal, pointing right)
                    } else if (degrees < 67.5) {
                        charIndex = 1.0; // / (diagonal)
                    } else if (degrees < 112.5) {
                        charIndex = 2.0; // | (vertical)
                    } else if (degrees < 157.5) {
                        charIndex = 3.0; // \\ (diagonal)
                    } else if (degrees < 202.5) {
                        charIndex = 0.0; // - (horizontal)
                    } else if (degrees < 247.5) {
                        charIndex = 1.0; // / (diagonal)
                    } else if (degrees < 292.5) {
                        charIndex = 2.0; // | (vertical)
                    } else {
                        charIndex = 3.0; // \\ (diagonal)
                    }

                    charIndex = clamp(charIndex, 0.0, 3.0);

                    // Look up character from texture atlas
                    vec2 atlasUV = vec2(
                        (charIndex + charUV.x) / u_numChars,
                        charUV.y
                    );

                    vec4 charColor = texture2D(u_charTexture, atlasUV);

                    // Apply green terminal color
                    gl_FragColor = vec4(0.0, charColor.r, 0.0, 1.0);
                } else {
                    // No edge - render black (empty)
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                }
            }
        `;let e,s,l,x,_,C,T,u,g,E,h;function L(){return e=i.getContext("webgl")||i.getContext("experimental-webgl"),e?!0:(U.textContent="WebGL not supported",!1)}function A(r,a){const o=e.createShader(a);return e.shaderSource(o,r),e.compileShader(o),e.getShaderParameter(o,e.COMPILE_STATUS)?o:(console.error("Shader compile error:",e.getShaderInfoLog(o)),e.deleteShader(o),null)}function v(r,a){const o=A(r,e.VERTEX_SHADER),n=A(a,e.FRAGMENT_SHADER),t=e.createProgram();return e.attachShader(t,o),e.attachShader(t,n),e.linkProgram(t),e.getProgramParameter(t,e.LINK_STATUS)?t:(console.error("Program link error:",e.getProgramInfoLog(t)),null)}function p(){const n="-/|\\ "+D,t=document.createElement("canvas");t.width=4*n.length,t.height=8;const c=t.getContext("2d");c.fillStyle="#000",c.fillRect(0,0,t.width,t.height),c.fillStyle="#fff",c.font='8px "Courier New", monospace',c.textBaseline="top",c.textAlign="left";for(let f=0;f<n.length;f++)c.fillText(n[f],f*4,0);const R=e.createTexture();return e.bindTexture(e.TEXTURE_2D,R),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),R}function y(){const r=e.createTexture();return e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),r}function B(){const r=e.createTexture();e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,u,g,0,e.RGBA,e.UNSIGNED_BYTE,null);const a=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,r,0),e.bindFramebuffer(e.FRAMEBUFFER,null),{texture:r,framebuffer:a}}function w(){e.bindTexture(e.TEXTURE_2D,x),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,d)}function b(r){const a=new Float32Array([-1,-1,1,-1,-1,1,1,1]),o=new Float32Array([0,1,1,1,0,0,1,0]);E||(E=e.createBuffer()),e.bindBuffer(e.ARRAY_BUFFER,E),e.bufferData(e.ARRAY_BUFFER,a,e.STATIC_DRAW);const n=e.getAttribLocation(r,"a_position");e.enableVertexAttribArray(n),e.vertexAttribPointer(n,2,e.FLOAT,!1,0,0),h||(h=e.createBuffer()),e.bindBuffer(e.ARRAY_BUFFER,h),e.bufferData(e.ARRAY_BUFFER,o,e.STATIC_DRAW);const t=e.getAttribLocation(r,"a_texCoord");e.enableVertexAttribArray(t),e.vertexAttribPointer(t,2,e.FLOAT,!1,0,0)}function F(){i.width=window.innerWidth,i.height=window.innerHeight,e.viewport(0,0,i.width,i.height);const r=4,a=8;u=Math.floor(i.width/r),g=Math.floor(i.height/a),T&&(e.deleteFramebuffer(T),e.deleteTexture(_));const o=B();_=o.texture,T=o.framebuffer}function I(){d.readyState>=d.HAVE_CURRENT_DATA&&(w(),e.bindFramebuffer(e.FRAMEBUFFER,T),e.viewport(0,0,u,g),e.useProgram(s),b(s),e.uniform2f(e.getUniformLocation(s,"u_charResolution"),u,g),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,x),e.uniform1i(e.getUniformLocation(s,"u_videoTexture"),0),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,i.width,i.height),e.useProgram(l),b(l),e.uniform2f(e.getUniformLocation(l,"u_charResolution"),u,g),e.uniform1f(e.getUniformLocation(l,"u_numChars"),D.length+5),e.uniform1f(e.getUniformLocation(l,"u_edgeThreshold"),S),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,_),e.uniform1i(e.getUniformLocation(l,"u_edgeTexture"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,C),e.uniform1i(e.getUniformLocation(l,"u_charTexture"),1),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4)),requestAnimationFrame(I)}async function G(){try{const r=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:"user"}});d.srcObject=r,d.onloadedmetadata=async()=>{try{await d.play()}catch(a){console.error("Video play error:",a)}L()&&(s=v(m,P),l=v(m,X),x=y(),C=p(),F(),e.clearColor(0,0,0,1),I())}}catch(r){console.error("Camera error:",r),U.textContent=`Failed to access camera.
`+r.message}}window.addEventListener("resize",F);G();
