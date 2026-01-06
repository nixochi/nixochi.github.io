function Z(t,o,r){const n=t.createShader(o);if(t.shaderSource(n,r),t.compileShader(n),!t.getShaderParameter(n,t.COMPILE_STATUS)){const c=t.getShaderInfoLog(n);throw t.deleteShader(n),new Error("Shader compile error: "+c)}return n}function Tt(t,o,r){const n=Z(t,t.VERTEX_SHADER,o),c=Z(t,t.FRAGMENT_SHADER,r),a=t.createProgram();if(t.attachShader(a,n),t.attachShader(a,c),t.linkProgram(a),!t.getProgramParameter(a,t.LINK_STATUS))throw new Error("Program link error: "+t.getProgramInfoLog(a));return a}const yt=`
    attribute vec2 a_pos;
    varying vec2 v_uv;
    varying vec2 v_pos;
    void main() {
      v_pos = a_pos; // NDC
      v_uv = a_pos * 0.5 + 0.5; // map [-1,1] -> [0,1]
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`,Lt=`#ifdef GL_ES
    precision mediump float;
    #endif

    varying vec2 v_uv;
    varying vec2 v_pos;
    uniform vec2 u_resolution;
    uniform float u_bins;
    uniform int u_colorSpace; // 0=RGB, 1=HSV, 2=LAB
    uniform bool u_showOriginal;
    uniform bool u_clipCircle;
    uniform bool u_labLCollapsed; // If true and colorSpace==LAB, L is in 1 bin
    uniform sampler2D u_texture;    // source color wheel texture
    uniform sampler2D u_binCenters; // 1D bin-centers texture

    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec3 rgb2lab(vec3 rgb) {
      // sRGB to XYZ
      vec3 c = rgb;
      c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
      mat3 m = mat3(
        0.4124564, 0.3575761, 0.1804375,
        0.2126729, 0.7151522, 0.0721750,
        0.0193339, 0.1191920, 0.9503041
      );
      vec3 xyz = m * c;
      // XYZ to LAB (D65 illuminant)
      vec3 ref = vec3(0.95047, 1.00000, 1.08883);
      xyz = xyz / ref;
      vec3 f = mix(7.787 * xyz + 16.0/116.0, pow(xyz, vec3(1.0/3.0)), step(0.008856, xyz));
      float L = 116.0 * f.y - 16.0;
      float a = 500.0 * (f.x - f.y);
      float b = 200.0 * (f.y - f.z);
      // Map to [0,1] using sRGB-specific ranges: L[0,100], a[-90,100], b[-110,95]
      return vec3(L / 100.0, (a + 90.0) / 190.0, (b + 110.0) / 205.0);
    }

    vec3 lab2rgb_raw(float L, float a, float b) {
      // LAB to RGB without clamping
      float fy = (L + 16.0) / 116.0;
      float fx = a / 500.0 + fy;
      float fz = fy - b / 200.0;
      vec3 xyz = vec3(fx, fy, fz);
      vec3 xyz3 = xyz * xyz * xyz;
      xyz = mix((xyz - 16.0/116.0) / 7.787, xyz3, step(0.008856, xyz3));
      vec3 ref = vec3(0.95047, 1.00000, 1.08883);
      xyz = xyz * ref;
      mat3 m = mat3(
        3.2404542, -1.5371385, -0.4985314,
        -0.9692660, 1.8760108, 0.0415560,
        0.0556434, -0.2040259, 1.0572252
      );
      vec3 c = m * xyz;
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
      return c;
    }

    bool isInGamut(vec3 rgb) {
      return rgb.r >= 0.0 && rgb.r <= 1.0 &&
             rgb.g >= 0.0 && rgb.g <= 1.0 &&
             rgb.b >= 0.0 && rgb.b <= 1.0;
    }

    vec3 lab2rgb(vec3 lab) {
      // LAB to XYZ - using sRGB-specific ranges: L[0,100], a[-90,100], b[-110,95]
      float L = lab.x * 100.0;
      float a = lab.y * 190.0 - 90.0;
      float b = lab.z * 205.0 - 110.0;

      // Try the color as-is first
      vec3 rgb = lab2rgb_raw(L, a, b);
      if (isInGamut(rgb)) {
        return rgb;
      }

      // Out of gamut: reduce chroma by binary search
      // Move (a,b) toward (0,0) while keeping L constant
      float chromaScale = 0.5;
      float step = 0.25;

      for (int i = 0; i < 16; i++) {
        rgb = lab2rgb_raw(L, a * chromaScale, b * chromaScale);
        if (isInGamut(rgb)) {
          chromaScale += step;
        } else {
          chromaScale -= step;
        }
        step *= 0.5;
      }

      // Final attempt with found scale
      rgb = lab2rgb_raw(L, a * chromaScale, b * chromaScale);
      return clamp(rgb, 0.0, 1.0);
    }

    void main() {
      float s = min(u_resolution.x, u_resolution.y);
      vec2 uvPos = v_pos * vec2(u_resolution.x / s, u_resolution.y / s);
      float rad = length(uvPos);

      vec4 colorSample = texture2D(u_texture, v_uv);
      vec3 color = colorSample.rgb;

      // Discard pixels outside the circle (where alpha = 0)
      if (colorSample.a < 0.5) discard;

      // Convert to the target color space for binning
      vec3 colorInSpace = color;
      if (u_colorSpace == 1) colorInSpace = rgb2hsv(color);
      else if (u_colorSpace == 2) colorInSpace = rgb2lab(color);

      if (u_showOriginal) {
        // Show bin boundaries as thin antialiased black lines overlaid on the color
        float bins = u_bins;
        vec3 scaled = colorInSpace * bins;
        vec3 frac = fract(scaled);

        // Distance to nearest boundary in each channel
        vec3 distToBoundary = min(frac, 1.0 - frac);
        float minDist = min(min(distToBoundary.r, distToBoundary.g), distToBoundary.b);

        // Thin line with antialiasing
        float pixelSize = 1.0 / max(u_resolution.x, u_resolution.y);
        float lineWidth = pixelSize * bins * 0.5;
        float aaWidth = pixelSize * bins * 1.0;

        // Smooth transition from color to black at boundary
        float alpha = 1.0 - smoothstep(lineWidth - aaWidth, lineWidth + aaWidth, minDist);
        vec3 finalColor = mix(color, vec3(0.0), alpha);

        gl_FragColor = vec4(finalColor, 1.0);
        return;
      }

      float bins = u_bins;
      float ch0bin, ch1bin, ch2bin, binIndex, totalBins;

      if (u_colorSpace == 2 && u_labLCollapsed) {
        // LAB with collapsed L: L is always bin 0, only A and B are subdivided
        ch0bin = 0.0; // L bin (always 0)
        ch1bin = min(floor(colorInSpace.g * bins), bins - 1.0); // A bin
        ch2bin = min(floor(colorInSpace.b * bins), bins - 1.0); // B bin

        binIndex = ch1bin + (ch2bin * bins); // a + b*bins
        totalBins = bins * bins;
      } else {
        // Full 3D binning
        ch0bin = min(floor(colorInSpace.r * bins), bins - 1.0);
        ch1bin = min(floor(colorInSpace.g * bins), bins - 1.0);
        ch2bin = min(floor(colorInSpace.b * bins), bins - 1.0);

        binIndex = ch0bin + (ch1bin * bins) + (ch2bin * bins * bins);
        totalBins = bins * bins * bins;
      }

      float texCoord = (binIndex + 0.5) / totalBins;
      vec3 binCenter = texture2D(u_binCenters, vec2(texCoord, 0.5)).rgb;

      gl_FragColor = vec4(binCenter, 1.0);
    }`,f=document.getElementById("glcanvas"),X=document.getElementById("bins"),Bt=document.getElementById("binsLabel"),St=document.getElementById("totalBins"),ot=document.getElementById("showOriginal"),$=document.getElementById("hsvValue"),wt=document.getElementById("valueLabel"),M=document.getElementById("colorSpace"),G=document.getElementById("labLBinning"),J=document.getElementById("labLBinningControl"),Rt=document.getElementById("downloadPng"),e=f.getContext("webgl",{preserveDrawingBuffer:!0,antialias:!1});e||alert("WebGL not supported in this browser.");const E=Tt(e,yt,Lt);e.useProgram(E);const Ct=e.getParameter(e.MAX_TEXTURE_SIZE)||8192,at=Math.max(2,Math.floor(Math.cbrt(Ct))),It=document.getElementById("bins"),j=document.getElementById("binsMaxLabel");j&&(j.textContent=String(at));It.max=String(at);const q=e.createTexture();e.bindTexture(e.TEXTURE_2D,q);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const V=e.createTexture();e.bindTexture(e.TEXTURE_2D,V);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const p=document.createElement("canvas"),F=p.getContext("2d",{willReadFrequently:!0});function Mt(t,o,r){const n=o==="lab"&&r==="collapsed",c=n?t*t:t*t*t,a=new Uint8Array(c*3);let l=0;if(n)for(let u=0;u<t;u++)for(let h=0;h<t;h++){const d=(h+.5)/t,g=(u+.5)/t,s=N(.5,d,g);a[l++]=Math.round(s[0]*255),a[l++]=Math.round(s[1]*255),a[l++]=Math.round(s[2]*255)}else for(let b=0;b<t;b++)for(let u=0;u<t;u++)for(let h=0;h<t;h++){const d=(h+.5)/t,g=(u+.5)/t,s=(b+.5)/t;let i;o==="rgb"?i=[d,g,s]:o==="hsv"?i=it(d,g,s):o==="lab"&&(i=N(d,g,s)),a[l++]=Math.round(i[0]*255),a[l++]=Math.round(i[1]*255),a[l++]=Math.round(i[2]*255)}e.bindTexture(e.TEXTURE_2D,V),e.texImage2D(e.TEXTURE_2D,0,e.RGB,c,1,0,e.RGB,e.UNSIGNED_BYTE,a)}const At=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,At);const Ut=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);e.bufferData(e.ARRAY_BUFFER,Ut,e.STATIC_DRAW);const rt=e.getAttribLocation(E,"a_pos");e.enableVertexAttribArray(rt);e.vertexAttribPointer(rt,2,e.FLOAT,!1,0,0);const Dt=e.getUniformLocation(E,"u_resolution"),zt=e.getUniformLocation(E,"u_bins"),Pt=e.getUniformLocation(E,"u_colorSpace"),Xt=e.getUniformLocation(E,"u_showOriginal"),$t=e.getUniformLocation(E,"u_clipCircle"),Gt=e.getUniformLocation(E,"u_labLCollapsed"),Ft=e.getUniformLocation(E,"u_texture"),Ot=e.getUniformLocation(E,"u_binCenters");function Wt(t,o,r){const n=Math.max(t,o,r),c=Math.min(t,o,r),a=n-c;let l=0;const b=n===0?0:a/n,u=n;return a!==0&&(n===t?l=((o-r)/a+(o<r?6:0))/6:n===o?l=((r-t)/a+2)/6:l=((t-o)/a+4)/6),[l,b,u]}function it(t,o,r){const n=a=>(a+t*6)%6,c=a=>r-r*o*Math.max(Math.min(n(a),4-n(a),1),0);return[c(5),c(3),c(1)]}function kt(t,o,r){const n=m=>m<=.04045?m/12.92:Math.pow((m+.055)/1.055,2.4);let c=n(t),a=n(o),l=n(r),b=c*.4124564+a*.3575761+l*.1804375,u=c*.2126729+a*.7151522+l*.072175,h=c*.0193339+a*.119192+l*.9503041;const d=[.95047,1,1.08883];b/=d[0],u/=d[1],h/=d[2];const g=m=>m>.008856?Math.pow(m,1/3):7.787*m+16/116,s=g(b),i=g(u),v=g(h),y=116*i-16,x=500*(s-i),_=200*(i-v);return[y/100,(x+90)/190,(_+110)/205]}function k(t,o,r){const n=(t+16)/116,c=o/500+n,a=n-r/200,l=v=>v>.206897?v*v*v:(v-16/116)/7.787;let b=l(c)*.95047,u=l(n)*1,h=l(a)*1.08883,d=b*3.2404542+u*-1.5371385+h*-.4985314,g=b*-.969266+u*1.8760108+h*.041556,s=b*.0556434+u*-.2040259+h*1.0572252;const i=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;return[i(d),i(g),i(s)]}function Q(t){return t[0]>=0&&t[0]<=1&&t[1]>=0&&t[1]<=1&&t[2]>=0&&t[2]<=1}function N(t,o,r){t=t*100,o=o*190-90,r=r*205-110;let n=k(t,o,r);if(Q(n))return n;let c=.5,a=.25;for(let l=0;l<16;l++)n=k(t,o*c,r*c),Q(n)?c+=a:c-=a,a*=.5;return n=k(t,o*c,r*c),[Math.max(0,Math.min(1,n[0])),Math.max(0,Math.min(1,n[1])),Math.max(0,Math.min(1,n[2]))]}function Nt(t){const o=M.value,r=G.value,n=o==="lab"&&r==="collapsed";Bt.textContent=t.toString(),St.textContent=n?(t*t).toString():(t*t*t).toString()}function ct(){M.value==="lab"?J.classList.remove("hidden"):J.classList.add("hidden")}function qt(t,o,r){const n=a=>(a+t*6)%6,c=a=>r-r*o*Math.max(Math.min(n(a),4-n(a),1),0);return[c(5),c(3),c(1)]}function Y(t,o,r){const n=t.width,c=t.height,a=o.createImageData(n,c),l=Math.min(n,c),b=n/2,u=c/2;let h=0;for(let d=0;d<c;d++)for(let g=0;g<n;g++){const s=(g+.5-b)/(l/2),i=(d+.5-u)/(l/2),v=Math.hypot(s,i);let y,x;if(v<=1){const _=(Math.atan2(i,s)/(2*Math.PI)+1)%1,m=Math.min(Math.max(v,0),1),T=r,[R,L,B]=qt(_,m,T);y=[Math.round(R*255),Math.round(L*255),Math.round(B*255)],x=255}else y=[0,0,0],x=0;a.data[h++]=y[0],a.data[h++]=y[1],a.data[h++]=y[2],a.data[h++]=x}o.putImageData(a,0,0)}function K(){e.bindTexture(e.TEXTURE_2D,q),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,p)}function st(){const t=window.devicePixelRatio||1,o=f.getBoundingClientRect(),r=Math.max(200,Math.floor(o.width*t)),n=Math.max(200,Math.floor(o.height*t));if(f.width!==r||f.height!==n){f.width=r,f.height=n,p.width=r,p.height=n;const c=parseInt($.value,10)/100;Y(p,F,c),K(),e.viewport(0,0,r,n),w()}}function Vt(){const t=parseInt($.value,10)/100;wt.textContent=t.toFixed(2),Y(p,F,t),K(),w()}function w(){const t=parseInt(X.value,10),o=M.value,r=G.value,n=o==="rgb"?0:o==="hsv"?1:2;Nt(t),Mt(t,o,r),e.useProgram(E),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,q),e.uniform1i(Ft,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,V),e.uniform1i(Ot,1),e.uniform2f(Dt,f.width,f.height),e.uniform1f(zt,t),e.uniform1i(Pt,n),e.uniform1i(Xt,ot.checked?1:0),e.uniform1i($t,0),e.uniform1i(Gt,o==="lab"&&r==="collapsed"?1:0),e.clearColor(.04,.06,.1,1),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLES,0,6)}X.addEventListener("input",w);ot.addEventListener("change",w);$.addEventListener("input",Vt);M.addEventListener("change",()=>{ct(),w()});G.addEventListener("change",w);window.addEventListener("resize",st);st();if(p.width===0||p.height===0){p.width=f.width,p.height=f.height;const t=parseInt($.value,10)/100;Y(p,F,t),K()}ct();w();const tt=document.getElementById("hoverRGBA"),et=document.getElementById("hoverBins"),nt=document.getElementById("hoverSwatch");function lt(t){const o=f.getBoundingClientRect(),r=f.width/o.width,n=f.height/o.height,c=Math.floor((t.clientX-o.left)*r),a=Math.floor((t.clientY-o.top)*n),l=f.height-1-a,b=F.getImageData(c,l,1,1).data,u=b[0],h=b[1],d=b[2];if(b[3]<128){document.getElementById("hoverTooltip").classList.add("hidden"),tt.textContent="r,g,b",et.textContent="bin (r,g,b)",nt.style.backgroundColor="transparent";return}const s=parseInt(X.value,10),i=M.value,v=G.value,y=i==="lab"&&v==="collapsed";let x;i==="rgb"?x=[u/255,h/255,d/255]:i==="hsv"?x=Wt(u/255,h/255,d/255):i==="lab"&&(x=kt(u/255,h/255,d/255));let _,m,T,R,L,B,I;y?(_=0,m=Math.min(Math.floor(x[1]*s),s-1),T=Math.min(Math.floor(x[2]*s),s-1),R=m+T*s,L=.5,B=(m+.5)/s,I=(T+.5)/s):(_=Math.min(Math.floor(x[0]*s),s-1),m=Math.min(Math.floor(x[1]*s),s-1),T=Math.min(Math.floor(x[2]*s),s-1),R=_+m*s+T*s*s,L=(_+.5)/s,B=(m+.5)/s,I=(T+.5)/s);let C;if(i==="rgb")C=[L*255,B*255,I*255];else if(i==="hsv"){const S=it(L,B,I);C=[S[0]*255,S[1]*255,S[2]*255]}else if(i==="lab"){const S=N(L,B,I);C=[S[0]*255,S[1]*255,S[2]*255]}const A=Math.round(C[0]),U=Math.round(C[1]),D=Math.round(C[2]),ht=i==="rgb"?"RGB":i==="hsv"?"HSV":"LAB",ut=i==="rgb"?"r":i==="hsv"?"h":"l",dt=i==="rgb"?"g":i==="hsv"?"s":"a",bt=i==="rgb"?"b":i==="hsv"?"v":"b",mt=i==="rgb"?"R":i==="hsv"?"H":"L",ft=i==="rgb"?"G":i==="hsv"?"S":"A",gt=i==="rgb"?"B":i==="hsv"?"V":"B";tt.textContent=`RGB center: ${(A/255).toFixed(3)}, ${(U/255).toFixed(3)}, ${(D/255).toFixed(3)}`,et.textContent=`bin indices (${ht}) → ${ut}:${_}, ${dt}:${m}, ${bt}:${T} (index ${R})`,nt.style.backgroundColor=`rgb(${A}, ${U}, ${D})`;const z=document.getElementById("hoverTooltip"),vt=document.getElementById("ttBinLabel"),xt=document.getElementById("ttOrigSwatch"),pt=document.getElementById("ttBinSwatch"),Et=document.getElementById("ttOrigText"),_t=document.getElementById("ttBinText");vt.textContent=`bin
${mt}:${_}
${ft}:${m}
${gt}:${T}`,xt.style.backgroundColor=`rgb(${u}, ${h}, ${d})`,pt.style.backgroundColor=`rgb(${A}, ${U}, ${D})`,Et.textContent=`rgb(${u}, ${h}, ${d})`,_t.textContent=`#${R} • rgb(${A}, ${U}, ${D})`,z.classList.remove("hidden");const H=10,P=z.getBoundingClientRect();let O=t.clientX+12,W=t.clientY+12;O+P.width+H>window.innerWidth&&(O=t.clientX-P.width-12),W+P.height+H>window.innerHeight&&(W=t.clientY-P.height-12),z.style.left=`${O}px`,z.style.top=`${W}px`}f.addEventListener("mousemove",lt);f.addEventListener("mouseleave",()=>{document.getElementById("hoverTooltip").classList.add("hidden")});f.addEventListener("touchmove",t=>{t.touches&&t.touches[0]&&lt(t.touches[0])},{passive:!0});Rt.addEventListener("click",t=>{t.preventDefault();const o=f.toDataURL("image/png"),r=document.createElement("a");r.href=o,r.download=`rgb-binned-color-wheel-${X.value}.png`,r.click()});
