class j{constructor(e={}){this.device=null,this.pipeline=null,this.bindGroupLayout=null,this.pointBuffer=null,this.pointCount=0,this.trigBuffers=null,this.cachedN=null,this.useTrigCache=e.useTrigCache!==!1,this.cpuPoints=null,this._paramsBuffer=null,this._bindGroup=null,this._pointCapacity=0,this._workgroupSize=e.workgroupSize??128}async init(){if(!navigator.gpu)throw new Error("WebGPU not supported");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("No WebGPU adapter found");return this.device=await e.requestDevice(),this.device.lost.then(t=>{console.error("WebGPU device lost:",t.message)}),this._createPipeline(),this._ensureParamsBuffer(),console.log("✅ GPCompute initialized (FAST path for n < 2^24)"),this}_createPipeline(){const t=`
      struct Params {
        n: u32,
        omega: u32,
        d: u32,
        bound: u32,
        stride: u32, // threads per "row" = workgroupsX * workgroup_size
      };

      @group(0) @binding(0) var<uniform> params: Params;
      @group(0) @binding(1) var<storage, read_write> points: array<vec2f>;

      const TWO_PI: f32 = 6.2831853071795864769;

      // Fast modular multiply for modulus m < 2^24:
      // (a*b) mod m, with a,b < m.
      // Uses 3-byte decomposition to keep intermediates within u32.
      fn mul_mod24(a: u32, b: u32, m: u32) -> u32 {
        var res: u32 = 0u;
        var temp: u32 = b % m;
        var aa: u32 = a;

        // exactly 3 bytes because a < 2^24
        for (var i: u32 = 0u; i < 3u; i = i + 1u) {
          let byte: u32 = aa & 255u; // 0..255
          // byte*temp < 255*(m-1) < 2^32 (safe)
          res = (res + byte * temp) % m;
          // temp*256 < 2^32 (safe)
          temp = (temp * 256u) % m;
          aa = aa >> 8u;
        }
        return res;
      }

      @compute @workgroup_size(${this._workgroupSize})
      fn main(@builtin(global_invocation_id) gid: vec3u) {
        // 2D dispatch linearization:
        // - gid.x ranges over [0, workgroupsX*wgSize)
        // - gid.y ranges over [0, workgroupsY)
        let k: u32 = gid.x + gid.y * params.stride;
        if (k >= params.bound) { return; }

        // exp_0 = k mod n
        var exp: u32 = k;
        if (exp >= params.n) { exp = exp % params.n; }

        var sum: vec2f = vec2f(0.0, 0.0);
        let n_f: f32 = f32(params.n);

        // exp_{j+1} = exp_j * omega mod n
        for (var j: u32 = 0u; j < params.d; j = j + 1u) {
          let angle: f32 = TWO_PI * (f32(exp) / n_f);
          sum = sum + vec2f(cos(angle), sin(angle));
          exp = mul_mod24(exp, params.omega, params.n);
        }

        points[k] = sum;
      }
    `,n=this.device.createShaderModule({label:"GP Compute Shader (FAST)",code:t});this.bindGroupLayout=this.device.createBindGroupLayout({label:"GP Compute Bind Group Layout (FAST)",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),this.pipeline=this.device.createComputePipeline({label:"GP Compute Pipeline (FAST)",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),compute:{module:n,entryPoint:"main"}})}async run(e,t){console.log(`🔢 Computing GP (FAST): n=${e}, ω=${t}`);const n={};let o=performance.now();if(!Number.isInteger(e)||!Number.isInteger(t))throw new Error("n and omega must be integers");if(e<=0)throw new Error("n must be positive");if(e>=1<<24)throw new Error("FAST path requires n < 2^24");if(this._gcd(t,e)!==1)throw new Error(`ω=${t} must be coprime to n=${e}`);const h=this._multiplicativeOrder(t,e),d=this._gcd(e,h),p=Math.min(e,Math.floor(e/d*h));n.setup=performance.now()-o,o=performance.now(),console.log(`   d=${h}, bound=${p}`),this._ensureParamsBuffer(),this._ensurePointBuffer(p),this._ensureBindGroup(),n.buffers=performance.now()-o,o=performance.now();const f=this._workgroupSize,a=65535,u=Math.ceil(p/f);let s=u,l=1;if(u>a){s=Math.ceil(Math.sqrt(u)),s=Math.min(a,Math.max(1,s));const b=s*f;if(l=Math.ceil(p/b),l>a){s=a;const U=s*f;if(l=Math.ceil(p/U),l>a)throw new Error(`Dispatch too large even in 2D: needWgx=${u}, chosenX=${s}, computedY=${l} (limit 65535)`)}const B=s*f;this.device.queue.writeBuffer(this._paramsBuffer,0,new Uint32Array([e>>>0,t>>>0,h>>>0,p>>>0,B>>>0]))}else{const b=s*f;this.device.queue.writeBuffer(this._paramsBuffer,0,new Uint32Array([e>>>0,t>>>0,h>>>0,p>>>0,b>>>0]))}n.writeParams=performance.now()-o,o=performance.now();const g=this.device.createCommandEncoder(),m=g.beginComputePass();m.setPipeline(this.pipeline),m.setBindGroup(0,this._bindGroup),m.dispatchWorkgroups(s,l,1),m.end(),n.encode=performance.now()-o,o=performance.now(),this.device.queue.submit([g.finish()]),n.submit=performance.now()-o,o=performance.now(),await this.device.queue.onSubmittedWorkDone(),n.gpuWait=performance.now()-o;const y=Object.values(n).reduce((b,B)=>b+B,0);return console.log("⏱️  Timings (ms):",Object.fromEntries(Object.entries(n).map(([b,B])=>[b,+B.toFixed(2)]))),console.log(`✅ Computed ${p} points in ${y.toFixed(2)}ms (dispatch ${s}x${l}, wgSize=${f})`),this.pointCount=p,{bound:p,d:h,elapsed:y,timings:n}}runCPU(e,t){console.log(`🖥️  Computing GP (CPU): n=${e}, ω=${t}`);const n=performance.now();if(!Number.isInteger(e)||!Number.isInteger(t))throw new Error("n and omega must be integers");if(e<=0)throw new Error("n must be positive");if(this._gcd(t,e)!==1)throw new Error(`ω=${t} must be coprime to n=${e}`);const o=this._multiplicativeOrder(t,e),h=this._gcd(e,o),d=Math.min(e,Math.floor(e/h*o));console.log(`   d=${o}, bound=${d}`),this.cpuPoints=new Float32Array(d*2);const p=2*Math.PI;for(let a=0;a<d;a++){let u=0,s=0,l=a%e;for(let g=0;g<o;g++){const m=p*(l/e);u+=Math.cos(m),s+=Math.sin(m),l=l*t%e}this.cpuPoints[a*2]=u,this.cpuPoints[a*2+1]=s}const f=performance.now()-n;return console.log(`✅ CPU computed ${d} points in ${f.toFixed(2)}ms`),{bound:d,d:o,elapsed:f}}async debugReadPoints(e=10){if(!this.pointBuffer)return console.warn("No points computed yet"),null;const t=Math.min(e,this.pointCount),n=t*2*Float32Array.BYTES_PER_ELEMENT,o=this.device.createBuffer({size:n,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),h=this.device.createCommandEncoder();h.copyBufferToBuffer(this.pointBuffer,0,o,0,n),this.device.queue.submit([h.finish()]),await o.mapAsync(GPUMapMode.READ);const d=new Float32Array(o.getMappedRange().slice(0));o.unmap(),o.destroy(),console.log(`📊 First ${t} points:`);for(let p=0;p<t;p++){const f=d[p*2],a=d[p*2+1];console.log(`   k=${p}: (${f.toFixed(4)}, ${a.toFixed(4)})`)}return d}_ensureTrigTables(e){}_ensureParamsBuffer(){this._paramsBuffer||(this._paramsBuffer=this.device.createBuffer({label:"GP Params Buffer",size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}))}_ensurePointBuffer(e){if(this.pointBuffer&&this._pointCapacity>=e){this.pointCount=e;return}const t=Math.max(e,Math.floor(this._pointCapacity*1.5),1024),n=t*8;this.pointBuffer&&this.pointBuffer.destroy(),this.pointBuffer=this.device.createBuffer({label:"Point Buffer",size:n,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_SRC}),this._pointCapacity=t,this.pointCount=e,this._bindGroup=null}_ensureBindGroup(){this._bindGroup||(this._bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this._paramsBuffer}},{binding:1,resource:{buffer:this.pointBuffer}}]}))}_gcd(e,t){for(;t!==0;)[e,t]=[t,e%t];return e}_multiplicativeOrder(e,t){let n=1,o=e%t;for(;o!==1&&n<=t;)o=o*e%t,n++;return n}destroy(){this.pointBuffer&&(this.pointBuffer.destroy(),this.pointBuffer=null),this.trigBuffers&&(this.trigBuffers.cos?.destroy?.(),this.trigBuffers.sin?.destroy?.(),this.trigBuffers=null),this._paramsBuffer&&(this._paramsBuffer.destroy(),this._paramsBuffer=null),this.device&&(this.device.destroy(),this.device=null)}}class H{constructor(e,t){this.canvas=e,this.device=t,this.context=null,this.format=null,this.splatPipeline=null,this.splatBindGroupLayout=null,this.blitPipeline=null,this.blitBindGroupLayout=null,this.blitUniformBuffer=null,this.sampler=null,this.splatTexture=null,this.splatTextureView=null,this.textureWidth=0,this.textureHeight=0,this.uniformBuffer=null,this.splatBindGroup=null,this.blitBindGroup=null,this.pointBuffer=null,this.pointCount=0,this.scale=1,this.offsetX=0,this.offsetY=0,this.splatDirty=!0,this.pointSize=2,this.autoScale=.001,this.batchSize=1e4,this.colorScheme="time-based"}async init(){return this.context=this.canvas.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}),this._createSplatPipeline(),this._createBlitPipeline(),this._createUniformBuffer(),this._createSampler(),console.log("✅ GPRenderer initialized (compute splat)"),this}_createSplatPipeline(){const t=this.device.createShaderModule({label:"GP Splat Shader",code:`
      struct Uniforms {
        autoScale: f32,
        aspect: f32,
        colorMode: f32,
        totalPointCount: f32,
        pointSize: f32,
        batchOffset: f32,
        width: f32,
        height: f32,
        batchCount: f32,
        _pad1: f32,
        _pad2: f32,
        _pad3: f32,
      }

      @group(0) @binding(0) var<uniform> u: Uniforms;
      @group(0) @binding(1) var<storage, read> points: array<vec2f>;
      @group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) gid: vec3u) {
        let localIdx = gid.x;
        if (localIdx >= u32(u.batchCount)) { return; }

        // Global point index
        let idx = u32(u.batchOffset) + localIdx;
        if (idx >= u32(u.totalPointCount)) { return; }

        let p = points[idx];

        // Transform to screen coordinates at BASE scale (no zoom/pan)
        let worldX = p.x * u.autoScale;
        let worldY = p.y * u.autoScale;
        let ndcX = worldX / u.aspect;
        let ndcY = -worldY;

        // NDC [-1,1] to pixel coordinates
        let px = (ndcX * 0.5 + 0.5) * u.width;
        let py = (ndcY * 0.5 + 0.5) * u.height;

        // Calculate color based on global index for consistency
        var color: vec4f;
        if (u.colorMode < 0.5) {
          let t = f32(idx) / max(u.totalPointCount, 1.0);
          color = vec4f(
            0.5 + 0.5 * cos(6.28318 * (t + 0.0)),
            0.5 + 0.5 * cos(6.28318 * (t + 0.33)),
            0.5 + 0.5 * cos(6.28318 * (t + 0.67)),
            1.0
          );
        } else {
          color = vec4f(1.0, 1.0, 1.0, 1.0);
        }

        // Splat a square stamp
        let half = i32(u.pointSize) / 2;
        let centerX = i32(px);
        let centerY = i32(py);

        for (var dy = -half; dy <= half; dy++) {
          for (var dx = -half; dx <= half; dx++) {
            let x = centerX + dx;
            let y = centerY + dy;
            if (x >= 0 && x < i32(u.width) && y >= 0 && y < i32(u.height)) {
              textureStore(outputTex, vec2i(x, y), color);
            }
          }
        }
      }
    `});this.splatBindGroupLayout=this.device.createBindGroupLayout({label:"GP Splat Bind Group Layout",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}]}),this.splatPipeline=this.device.createComputePipeline({label:"GP Splat Pipeline",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.splatBindGroupLayout]}),compute:{module:t,entryPoint:"main"}})}_createBlitPipeline(){const t=this.device.createShaderModule({label:"GP Blit Shader",code:`
      struct BlitUniforms {
        zoom: f32,
        offsetX: f32,
        offsetY: f32,
        aspect: f32,
      }

      @group(0) @binding(0) var tex: texture_2d<f32>;
      @group(0) @binding(1) var samp: sampler;
      @group(0) @binding(2) var<uniform> u: BlitUniforms;

      @vertex
      fn vs(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
        // Fullscreen triangle
        var pos = array<vec2f, 3>(
          vec2f(-1.0, -1.0),
          vec2f( 3.0, -1.0),
          vec2f(-1.0,  3.0)
        );
        return vec4f(pos[idx], 0.0, 1.0);
      }

      @fragment
      fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
        let dims = vec2f(textureDimensions(tex));

        // Start with pixel-perfect UV (pos is at pixel center)
        var uv = pos.xy / dims;

        // Apply zoom around center
        let center = vec2f(0.5, 0.5);
        uv = (uv - center) / u.zoom + center;

        // Apply pan (in NDC-like space, so divide by 2)
        uv.x -= u.offsetX * 0.5 / u.aspect;
        uv.y += u.offsetY * 0.5;

        // Sample texture (must be in uniform control flow)
        let texColor = textureSample(tex, samp, clamp(uv, vec2f(0.0), vec2f(1.0)));

        // Check bounds and blend with background
        let inBounds = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
        let bgColor = vec4f(0.02, 0.02, 0.03, 1.0);

        return select(bgColor, texColor, inBounds);
      }
    `});this.blitBindGroupLayout=this.device.createBindGroupLayout({label:"GP Blit Bind Group Layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),this.blitPipeline=this.device.createRenderPipeline({label:"GP Blit Pipeline",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.blitBindGroupLayout]}),vertex:{module:t,entryPoint:"vs"},fragment:{module:t,entryPoint:"fs",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}}),this.blitUniformBuffer=this.device.createBuffer({label:"GP Blit Uniforms",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}_createUniformBuffer(){this.uniformBuffer=this.device.createBuffer({label:"GP Render Uniforms",size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}_createSampler(){this.sampler=this.device.createSampler({magFilter:"nearest",minFilter:"nearest"})}_ensureSplatTexture(e,t){this.splatTexture&&this.textureWidth===e&&this.textureHeight===t||(this.splatTexture&&this.splatTexture.destroy(),this.textureWidth=e,this.textureHeight=t,this.splatTexture=this.device.createTexture({label:"GP Splat Texture",size:[e,t],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT}),this.splatTextureView=this.splatTexture.createView(),this.blitBindGroup=this.device.createBindGroup({layout:this.blitBindGroupLayout,entries:[{binding:0,resource:this.splatTextureView},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.blitUniformBuffer}}]}),this.splatDirty=!0)}setPointBuffer(e,t){this.pointBuffer=e,this.pointCount=t,this.splatBindGroup=null,this.splatDirty=!0}setAutoScale(e){this.autoScale=.8/Math.max(e,.001),this.splatDirty=!0}setColorScheme(e){this.colorScheme=e,this.splatDirty=!0}setPointSize(e){this.pointSize=e,this.splatDirty=!0}setTransform(e,t,n){this.scale=e,this.offsetX=t,this.offsetY=n}clear(){const e=this.context.getCurrentTexture().createView(),t=this.device.createCommandEncoder();t.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.02,g:.02,b:.03,a:1},loadOp:"clear",storeOp:"store"}]}).end(),this.device.queue.submit([t.finish()])}async _splat(){if(!this.pointBuffer||this.pointCount===0)return;const e=performance.now(),t=this.canvas.width,n=this.canvas.height,o=t/n;this._ensureSplatTexture(t,n),this.splatBindGroup||(this.splatBindGroup=this.device.createBindGroup({layout:this.splatBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:{buffer:this.pointBuffer}},{binding:2,resource:this.splatTextureView}]}));const h=this.colorScheme==="monochrome"?1:0,d=this.device.createCommandEncoder();d.beginRenderPass({colorAttachments:[{view:this.splatTextureView,clearValue:{r:.02,g:.02,b:.03,a:1},loadOp:"clear",storeOp:"store"}]}).end(),this.device.queue.submit([d.finish()]);const f=this.batchSize>0?this.batchSize:this.pointCount,a=Math.ceil(this.pointCount/f);for(let u=0;u<a;u++){const s=u*f,l=Math.min(f,this.pointCount-s);this.device.queue.writeBuffer(this.uniformBuffer,0,new Float32Array([this.autoScale,o,h,this.pointCount,this.pointSize,s,t,n,l,0,0,0]));const g=this.device.createCommandEncoder(),m=g.beginComputePass();m.setPipeline(this.splatPipeline),m.setBindGroup(0,this.splatBindGroup);const y=Math.ceil(l/256);m.dispatchWorkgroups(y),m.end(),this.device.queue.submit([g.finish()]),a>1&&await this.device.queue.onSubmittedWorkDone()}this.splatDirty=!1,console.log(`🎨 Splat ${this.pointCount} points in ${a} batches: ${(performance.now()-e).toFixed(2)}ms`)}_blit(){const e=this.canvas.width,t=this.canvas.height,n=e/t;this.device.queue.writeBuffer(this.blitUniformBuffer,0,new Float32Array([this.scale,this.offsetX,this.offsetY,n]));const o=this.device.createCommandEncoder(),h=this.context.getCurrentTexture().createView(),d=o.beginRenderPass({colorAttachments:[{view:h,clearValue:{r:.02,g:.02,b:.03,a:1},loadOp:"clear",storeOp:"store"}]});d.setPipeline(this.blitPipeline),d.setBindGroup(0,this.blitBindGroup),d.draw(3),d.end(),this.device.queue.submit([o.finish()])}async render(){if(!this.pointBuffer||this.pointCount===0){this.clear();return}this._ensureSplatTexture(this.canvas.width,this.canvas.height),this.splatDirty&&await this._splat(),this._blit()}resize(){const e=window.devicePixelRatio||1,t=this.canvas.getBoundingClientRect(),n=Math.floor(t.width*e),o=Math.floor(t.height*e);(this.canvas.width!==n||this.canvas.height!==o)&&(this.canvas.width=n,this.canvas.height=o,this.splatBindGroup=null,this.splatDirty=!0)}destroy(){this.uniformBuffer&&(this.uniformBuffer.destroy(),this.uniformBuffer=null),this.blitUniformBuffer&&(this.blitUniformBuffer.destroy(),this.blitUniformBuffer=null),this.splatTexture&&(this.splatTexture.destroy(),this.splatTexture=null),this.pointBuffer=null,this.context=null}}async function Z(){console.log("🚀 Initializing GP2...");try{let r=function(i){return i?i.tagName==="INPUT"?parseInt(i.value)||0:parseInt(i.getAttribute("data-value"))||0:0},e=function(i,c){if(!i)return;if(i.tagName==="INPUT"){i.value=c;return}i.setAttribute("data-value",c);const v=i.querySelector(".text-number-value");v&&(v.textContent=c)},t=function(){e(I,l),e(L,g),e(k,l),e(z,g)},n=function(){M||(M=!0,requestAnimationFrame(async()=>{s.setTransform(m,y,b),await s.render(),M=!1}))},o=function(i,c,v){let G=c+v;for(;G>0&&G<i;){if(a._gcd(G,i)===1)return G;G+=v}return c},h=function(){s.resize(),n()},d=function(){const i=r(I)||r(k)||l,c=r(L)||r(z)||g;C(i,c)},p=function(){const i=o(l,g,-1);C(l,i)},f=function(){const i=o(l,g,1);C(l,i)};const a=new j;await a.init();const u=document.getElementById("mainCanvas"),s=new H(u,a.device);await s.init();let l=20352,g=319,m=1,y=0,b=0,B=!0,U="time-based",M=!1;const I=document.getElementById("nInputDesktop"),L=document.getElementById("omegaInputDesktop"),D=document.getElementById("computePlotBtnDesktop"),A=document.getElementById("prevCoprimeBtnDesktop"),O=document.getElementById("nextCoprimeBtnDesktop"),R=document.getElementById("pointSizeSliderDesktop"),$=document.getElementById("autoZoomToggleDesktop"),F=document.getElementById("colorSchemeSelectDesktop"),Y=document.getElementById("clearBtnDesktop"),N=document.getElementById("exportBtnDesktop"),k=document.getElementById("nInputMobile"),z=document.getElementById("omegaInputMobile"),X=document.getElementById("computePlotBtnMobile"),W=document.getElementById("prevCoprimeBtnMobile"),V=document.getElementById("nextCoprimeBtnMobile");async function C(i,c){try{if(l=i,g=c,t(),await a.run(i,c),s.setPointBuffer(a.pointBuffer,a.pointCount),B){const v=a._multiplicativeOrder(c,i);s.setAutoScale(v*1.2)}m=1,y=0,b=0,s.setTransform(m,y,b),await s.render(),console.log(`🎨 Rendered ${a.pointCount} points`)}catch(v){console.error("Compute error:",v.message)}}window.addEventListener("resize",h),h(),await C(l,g),t(),D?.addEventListener("click",d),X?.addEventListener("click",d),A?.addEventListener("click",p),O?.addEventListener("click",f),W?.addEventListener("click",p),V?.addEventListener("click",f),R?.addEventListener("change",i=>{const c=i.detail?.value??1;console.log(`📏 Point size: ${c}px`),s.setPointSize(c),n()}),$?.addEventListener("change",i=>{B=i.detail?.checked??!0});const q=["time-based","lutz","monochrome"];F?.addEventListener("change",i=>{const c=i.detail?.value??0;U=q[c]||"time-based",s.setColorScheme(U),n()}),Y?.addEventListener("click",async()=>{s.setPointBuffer(null,0),await s.render()}),N?.addEventListener("click",()=>{const i=document.createElement("a");i.download=`gp-${l}-${g}.png`,i.href=u.toDataURL("image/png"),i.click()});let w=!1,x=0,P=0;u.addEventListener("mousedown",i=>{w=!0,x=i.clientX,P=i.clientY}),u.addEventListener("mousemove",i=>{if(!w)return;const c=(i.clientX-x)/u.width*2,v=(i.clientY-P)/u.height*2;y+=c,b-=v,x=i.clientX,P=i.clientY,n()}),u.addEventListener("mouseup",()=>{w=!1}),u.addEventListener("mouseleave",()=>{w=!1}),u.addEventListener("wheel",i=>{i.preventDefault();const v=Math.exp(-i.deltaY*.002);m*=v,n()},{passive:!1});let E=0;u.addEventListener("touchstart",i=>{i.touches.length===1?(w=!0,x=i.touches[0].clientX,P=i.touches[0].clientY):i.touches.length===2&&(E=Math.hypot(i.touches[1].clientX-i.touches[0].clientX,i.touches[1].clientY-i.touches[0].clientY))},{passive:!0}),u.addEventListener("touchmove",i=>{if(i.touches.length===1&&w){const c=(i.touches[0].clientX-x)/u.width*2,v=(i.touches[0].clientY-P)/u.height*2;y+=c,b-=v,x=i.touches[0].clientX,P=i.touches[0].clientY,n()}else if(i.touches.length===2){const c=Math.hypot(i.touches[1].clientX-i.touches[0].clientX,i.touches[1].clientY-i.touches[0].clientY);E>0&&(m*=c/E,n()),E=c}},{passive:!0}),u.addEventListener("touchend",()=>{w=!1,E=0}),window.gpCompute=a,window.gpRenderer=s,window.gpRun=C,console.log("✅ GP2 ready. Try: await gpRun(1000003, 2)")}catch(r){console.error("❌ Init failed:",r)}}Z();const S=document.getElementById("optionsBtnMobile"),T=document.getElementById("optionsPanelMobile");let _=!1;S?.addEventListener("click",r=>{r.stopPropagation(),_=!_,_?(T?.classList.add("expanded"),S.textContent="close"):(T?.classList.remove("expanded"),S.textContent="options")});document.addEventListener("click",r=>{window.innerWidth<=768&&_&&!T?.contains(r.target)&&!S?.contains(r.target)&&(_=!1,T?.classList.remove("expanded"),S&&(S.textContent="options"))});T?.addEventListener("click",r=>{r.stopPropagation()});document.querySelectorAll(".toggle").forEach(r=>{r.addEventListener("click",()=>{r.classList.toggle("active")})});document.getElementById("pointSizeSlider")?.addEventListener("input",r=>{const e=parseFloat(r.target.value),t=document.getElementById("pointSizeValue");t&&(t.textContent=e.toFixed(1))});document.getElementById("speedSlider")?.addEventListener("input",r=>{const e=parseInt(r.target.value),t=document.getElementById("speedValue");t&&(t.textContent=`${e} pts/frame`)});document.getElementById("lutzCSlider")?.addEventListener("input",r=>{const e=parseInt(r.target.value),t=document.getElementById("lutzCValue");t&&(t.textContent=e.toString())});document.getElementById("colorSchemeSelect")?.addEventListener("change",r=>{const e=r.target.value,t=document.getElementById("colorPickers"),n=document.getElementById("lutzSliderWrapper");t&&n&&(e==="time-based"?(t.style.display="flex",n.style.display="none"):e==="lutz"?(t.style.display="none",n.style.display="block"):(t.style.display="none",n.style.display="none"))});document.getElementById("plotModeSelect")?.addEventListener("change",r=>{const e=r.target.value,t=document.getElementById("speedSliderWrapper");t&&(t.style.display=e==="animated"?"block":"none")});
