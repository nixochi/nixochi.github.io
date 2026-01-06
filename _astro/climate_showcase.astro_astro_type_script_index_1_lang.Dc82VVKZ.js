(function(){class p extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.sliderPosition=50,this.isDragging=!1,this._onMouseMove=this.onMouseMove.bind(this),this._onMouseUp=this.onMouseUp.bind(this),this._onTouchMove=this.onTouchMove.bind(this),this._onTouchEnd=this.onMouseUp.bind(this),this._onKeyDown=this.onKeyDown.bind(this)}connectedCallback(){const t=this.getAttribute("leftimage"),e=this.getAttribute("rightimage"),i=this.getAttribute("lefttitle")||"",a=this.getAttribute("righttitle")||"",s=parseFloat(this.getAttribute("position"))||50;if(this.sliderPosition=Math.max(0,Math.min(100,s)),!t||!e){this.showError("Both leftimage and rightimage are required");return}this.render(t,e,i,a),this.setupEvents(),this.loadImages(t,e)}disconnectedCallback(){document.removeEventListener("mousemove",this._onMouseMove),document.removeEventListener("mouseup",this._onMouseUp),document.removeEventListener("touchmove",this._onTouchMove),document.removeEventListener("touchend",this._onTouchEnd)}render(t,e,i,a){this.shadowRoot.innerHTML=`
            <style>
                :host {
                    --divider-color: rgba(255, 255, 255, 0.9);
                    --divider-width: 2px;
                    --divider-shadow: 0 0 8px rgba(0, 0, 0, 0.4);
                    --handle-size: 44px;
                    --handle-color: white;
                    --handle-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                    --label-bg: rgba(0, 0, 0, 0.6);
                    --label-color: white;

                    display: block;
                    width: var(--intrinsic-width);
                    height: var(--intrinsic-height);
                }

                .container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background: #0a0a0a;
                    cursor: default;
                    user-select: none;
                    -webkit-user-select: none;
                }

                .container:focus {
                    outline: 2px solid #3b82f6;
                    outline-offset: 2px;
                }

                .image {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    pointer-events: none;
                }

                .image-left { z-index: 1; }

                .image-right {
                    z-index: 2;
                    clip-path: inset(0 0 0 var(--pos, 50%));
                }

                /* Divider line with shadow for depth */
                .divider {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: var(--pos, 50%);
                    width: var(--divider-width);
                    background: var(--divider-color);
                    transform: translateX(-50%);
                    z-index: 10;
                    box-shadow: var(--divider-shadow);
                }

                /* Minimal handle - pill shape with arrows */
                .handle {
                    position: absolute;
                    top: 50%;
                    left: var(--pos, 50%);
                    transform: translate(-50%, -50%);
                    z-index: 11;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 8px;
                    background: var(--handle-color);
                    border-radius: 100px;
                    box-shadow: var(--handle-shadow);
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }

                .container:hover .handle,
                .container:active .handle {
                    transform: translate(-50%, -50%) scale(1.05);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                }

                /* Arrow icons using CSS triangles */
                .arrow {
                    width: 0;
                    height: 0;
                    border-top: 5px solid transparent;
                    border-bottom: 5px solid transparent;
                }

                .arrow-left {
                    border-right: 6px solid #666;
                }

                .arrow-right {
                    border-left: 6px solid #666;
                }

                /* Labels - subtle, top corners */
                .label {
                    position: absolute;
                    top: 16px;
                    padding: 6px 14px;
                    background: var(--label-bg);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    color: var(--label-color);
                    font: 600 13px/1 system-ui, -apple-system, sans-serif;
                    letter-spacing: 0.02em;
                    border-radius: 4px;
                    z-index: 5;
                    pointer-events: none;
                    text-transform: uppercase;
                }

                .label-left { left: 16px; }
                .label-right { right: 16px; }

                /* Loading state */
                .loading {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0a0a0a;
                    color: #666;
                    font: 13px system-ui, sans-serif;
                    z-index: 20;
                }

                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #222;
                    border-top-color: #666;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    margin-right: 10px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Error state */
                .error {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0a0a0a;
                    color: #dc2626;
                    font: 13px system-ui, sans-serif;
                    z-index: 20;
                }

                .hidden { display: none; }
            </style>

            <div class="container" tabindex="0">
                <img class="image image-left hidden" alt="${i||"Before"}">
                <img class="image image-right hidden" alt="${a||"After"}">

                <div class="divider"></div>
                <div class="handle">
                    <span class="arrow arrow-left"></span>
                    <span class="arrow arrow-right"></span>
                </div>

                ${i?`<div class="label label-left">${i}</div>`:""}
                ${a?`<div class="label label-right">${a}</div>`:""}

                <div class="loading"><div class="spinner"></div>Loading...</div>
                <div class="error hidden"></div>
            </div>
        `,this.container=this.shadowRoot.querySelector(".container"),this.leftImg=this.shadowRoot.querySelector(".image-left"),this.rightImg=this.shadowRoot.querySelector(".image-right"),this.loading=this.shadowRoot.querySelector(".loading"),this.error=this.shadowRoot.querySelector(".error"),this.updatePosition()}setupEvents(){this.container.addEventListener("mousedown",t=>this.startDrag(t.clientX)),this.container.addEventListener("touchstart",t=>{t.preventDefault(),this.startDrag(t.touches[0].clientX)},{passive:!1}),this.container.addEventListener("keydown",this._onKeyDown),document.addEventListener("mousemove",this._onMouseMove),document.addEventListener("mouseup",this._onMouseUp),document.addEventListener("touchmove",this._onTouchMove,{passive:!1}),document.addEventListener("touchend",this._onTouchEnd)}startDrag(t){this.isDragging=!0,this.updateFromX(t)}onMouseMove(t){this.isDragging&&this.updateFromX(t.clientX)}onTouchMove(t){this.isDragging&&(t.preventDefault(),this.updateFromX(t.touches[0].clientX))}onMouseUp(){this.isDragging=!1}onKeyDown(t){const e=t.shiftKey?10:2;t.key==="ArrowLeft"?(t.preventDefault(),this.sliderPosition=Math.max(0,this.sliderPosition-e),this.updatePosition()):t.key==="ArrowRight"&&(t.preventDefault(),this.sliderPosition=Math.min(100,this.sliderPosition+e),this.updatePosition())}updateFromX(t){const e=this.container.getBoundingClientRect(),i=(t-e.left)/e.width*100;this.sliderPosition=Math.max(0,Math.min(100,i)),this.updatePosition()}updatePosition(){this.container.style.setProperty("--pos",`${this.sliderPosition}%`)}async loadImages(t,e){const i=a=>new Promise((s,n)=>{const r=new Image;r.onload=()=>s(a),r.onerror=()=>n(new Error(`Failed to load: ${a}`)),r.src=a});try{await Promise.all([i(t),i(e)]),this.leftImg.src=t,this.rightImg.src=e,this.leftImg.classList.remove("hidden"),this.rightImg.classList.remove("hidden"),this.loading.classList.add("hidden")}catch(a){this.showError(a.message)}}showError(t){this.loading?.classList.add("hidden"),this.error&&(this.error.textContent=t,this.error.classList.remove("hidden"))}}customElements.define("image-slider-2",p)})();(function(){class p extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.CARBON_BUDGETS={"1.5C":{total:380,label:"1.5°C",description:"Paris Agreement ambitious target",color:"#ef4444",lightColor:"#fef2f2"},"2.0C":{total:1130,label:"2.0°C",description:"Paris Agreement upper limit",color:"#f97316",lightColor:"#fff7ed"},"2.5C":{total:1880,label:"2.5°C",description:"Dangerous warming level",color:"#eab308",lightColor:"#fefce8"}},this.CURRENT_EMISSIONS={annual:40,growthRate:.005,startYear:2024},this.REFERENCE_SCENARIOS={currentPolicies:{name:"Current Policies",peakYear:2030,peakEmissions:42,reductionRate:.02,color:"#64748b"},parisNDCs:{name:"Paris Pledges",peakYear:2025,peakEmissions:41,reductionRate:.035,color:"#3b82f6"},netZero2050:{name:"Net Zero 2050",peakYear:2024,peakEmissions:40,reductionRate:.07,color:"#10b981"}},this.state={targetTemperature:"1.5C",reductionStartYear:2025,annualReductionRate:.05,showComparisons:!0,showUncertainty:!1},this.chartWidth=0,this.chartHeight=0,this.margin={top:15,right:50,bottom:40,left:50},this.svg=null,this.xScale=null,this.yScale=null,this.line=null,this.area=null,this.userPathway=null,this.isInitialized=!1,this.d3LoadAttempts=0}connectedCallback(){console.log("🧩 Carbon Budget Calculator: Starting initialization..."),this.render(),this.setupEventListeners(),this.loadD3AndInitialize()}async loadD3AndInitialize(){try{console.log("📦 Loading D3.js..."),await this.loadD3(),console.log("✅ D3.js loaded successfully"),setTimeout(()=>{console.log("📊 Initializing chart..."),this.initializeChart(),console.log("🎨 Updating initial visualization..."),this.updateVisualization()},150)}catch(t){console.error("❌ Failed to load D3 or initialize chart:",t),this.showError("Failed to load visualization library. Please refresh the page.")}}async loadD3(){if(window.d3){console.log("✅ D3.js already available");return}if(this.d3LoadAttempts++,this.d3LoadAttempts>3)throw new Error("Too many D3 load attempts");return new Promise((t,e)=>{const i=document.createElement("script");i.src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js",i.onload=()=>{console.log("📦 D3.js script loaded"),window.d3?t():e(new Error("D3 object not available after script load"))},i.onerror=()=>e(new Error("Failed to load D3.js script")),i.onabort=()=>e(new Error("D3.js script load aborted")),document.head.appendChild(i),setTimeout(()=>{window.d3||e(new Error("D3.js load timeout"))},1e4)})}showError(t){const e=this.shadowRoot.querySelector(".chart-container");e&&(e.innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; height: 100%;
                           color: #ef4444; font-size: 11px; text-align: center; padding: 12px;">
                    <div>
                        <div style="font-size: 16px; margin-bottom: 4px;">⚠️</div>
                        <div>${t}</div>
                    </div>
                </div>
            `)}render(){this.shadowRoot.innerHTML=`
            <style>
                :host {
                    display: block;
                    width: var(--intrinsic-width);
                    height: var(--intrinsic-height);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
                    --primary: #0f172a;
                    --secondary: #64748b;
                    --accent: #3b82f6;
                    --success: #10b981;
                    --warning: #f59e0b;
                    --danger: #ef4444;
                    --surface: #ffffff;
                    --surface-2: #f8fafc;
                    --surface-3: #f1f5f9;
                    --border: #e2e8f0;
                }

                .calculator-container {
                    width: 100%;
                    height: 100%;
                    display: grid;
                    grid-template-rows: 48px 1fr 80px;
                    gap: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 6px;
                    overflow: hidden;
                    box-sizing: border-box;
                }

                .header {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(4px);
                    padding: 8px 12px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                    box-sizing: border-box;
                }

                .title {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--primary);
                    margin: 0 0 2px 0;
                    letter-spacing: -0.02em;
                    line-height: 1;
                }

                .subtitle {
                    font-size: 10px;
                    color: var(--secondary);
                    margin: 0;
                    font-weight: 500;
                    line-height: 1;
                }
                
                .main-content {
                    display: grid;
                    grid-template-columns: 120px 1fr;
                    background: var(--surface);
                    height: 100%;
                    min-height: 0;
                    box-sizing: border-box;
                }

                .controls-panel {
                    background: var(--surface-2);
                    padding: 12px 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    border-right: 1px solid var(--border);
                    box-sizing: border-box;
                    overflow-y: auto;
                }

                .chart-panel {
                    background: var(--surface);
                    padding: 8px;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 0;
                }

                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    flex-shrink: 0;
                }

                .control-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: var(--primary);
                    margin: 0;
                    letter-spacing: -0.01em;
                    line-height: 1.2;
                }

                .temperature-targets {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 3px;
                }

                .temp-button {
                    padding: 8px 0;
                    border: 1px solid var(--border);
                    background: var(--surface);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-size: 9px;
                    font-weight: 600;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                }

                .temp-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .temp-button:hover::before {
                    opacity: 1;
                }

                .temp-button:hover {
                    border-color: var(--accent);
                    transform: translateY(-1px);
                }

                .temp-button.active {
                    background: linear-gradient(135deg, var(--accent) 0%, #6366f1 100%);
                    color: white;
                    border-color: var(--accent);
                }

                .temp-button.active::before {
                    display: none;
                }

                .slider-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .slider {
                    flex: 1;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 3px;
                    background: linear-gradient(90deg, var(--border) 0%, var(--accent) 50%, var(--accent) 100%);
                    border-radius: 2px;
                    outline: none;
                    position: relative;
                }

                .slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    background: linear-gradient(135deg, var(--accent) 0%, #6366f1 100%);
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.8);
                    transition: all 0.2s ease;
                }

                .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                }

                .slider::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    background: linear-gradient(135deg, var(--accent) 0%, #6366f1 100%);
                    border-radius: 50%;
                    cursor: pointer;
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.3);
                }

                .slider-value {
                    min-width: 32px;
                    font-size: 9px;
                    font-weight: 600;
                    color: var(--primary);
                    text-align: right;
                    background: var(--surface);
                    padding: 3px 5px;
                    border-radius: 3px;
                    border: 1px solid var(--border);
                    box-sizing: border-box;
                }

                .toggle-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .toggle-container {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 0;
                }

                .toggle {
                    width: 10px;
                    height: 10px;
                    cursor: pointer;
                    accent-color: var(--accent);
                    flex-shrink: 0;
                }

                .toggle-label {
                    font-size: 9px;
                    color: var(--secondary);
                    cursor: pointer;
                    font-weight: 500;
                    line-height: 1.2;
                }

                .chart-container {
                    flex: 1;
                    position: relative;
                    background: var(--surface);
                    border-radius: 5px;
                    border: 1px solid var(--border);
                    box-sizing: border-box;
                    min-height: 0;
                    overflow: hidden;
                }
                
                .chart-svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                }
                
                .metrics-bar {
                    background: var(--surface-2);
                    padding: 10px 12px;
                    display: grid;
                    grid-template-columns: repeat(4, 1fr) 2fr;
                    gap: 8px;
                    border-top: 1px solid var(--border);
                    align-items: center;
                    box-sizing: border-box;
                }

                .metric-item {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    min-height: 0;
                }

                .metric-value {
                    font-size: 14px;
                    font-weight: 700;
                    margin: 0 0 2px 0;
                    letter-spacing: -0.02em;
                    line-height: 1;
                }

                .metric-value.danger {
                    color: var(--danger);
                }

                .metric-value.warning {
                    color: var(--warning);
                }

                .metric-value.success {
                    color: var(--success);
                }

                .metric-label {
                    font-size: 8px;
                    color: var(--secondary);
                    margin: 0;
                    font-weight: 500;
                    line-height: 1.2;
                    text-align: center;
                }

                .budget-meter {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 4px;
                }

                .budget-track {
                    width: 100%;
                    height: 6px;
                    background: var(--border);
                    border-radius: 3px;
                    overflow: hidden;
                    position: relative;
                    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
                }

                .budget-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--success) 0%, var(--warning) 60%, var(--danger) 100%);
                    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 3px;
                    position: relative;
                    overflow: hidden;
                }

                .budget-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
                    animation: shimmer 2s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .budget-text {
                    font-size: 9px;
                    font-weight: 600;
                    color: var(--primary);
                    line-height: 1.2;
                    text-align: center;
                }

                .loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--secondary);
                    font-size: 11px;
                    font-weight: 500;
                    flex-direction: column;
                    gap: 8px;
                }

                .loading-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--border);
                    border-top: 2px solid var(--accent);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .chart-legend {
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(4px);
                    padding: 6px;
                    border-radius: 4px;
                    border: 1px solid var(--border);
                    font-size: 8px;
                    font-weight: 500;
                    box-sizing: border-box;
                    max-width: 100px;
                    z-index: 10;
                }

                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    margin-bottom: 3px;
                }

                .legend-item:last-child {
                    margin-bottom: 0;
                }

                .legend-color {
                    width: 8px;
                    height: 2px;
                    border-radius: 1px;
                    flex-shrink: 0;
                }

                /* Chart styling */
                .axis {
                    font-size: 8px;
                    color: var(--secondary);
                }

                .axis-label {
                    font-size: 9px;
                    font-weight: 600;
                    color: var(--primary);
                }

                .grid-line {
                    stroke: var(--border);
                    stroke-dasharray: 1px, 2px;
                    opacity: 0.6;
                }

                .pathway-line {
                    fill: none;
                    stroke-width: 2px;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
                }

                .pathway-area {
                    opacity: 0.15;
                }

                .reference-line {
                    fill: none;
                    stroke-width: 1px;
                    opacity: 0.7;
                    stroke-dasharray: 2px, 1px;
                }
            </style>
            
            <div class="calculator-container">
                <div class="header">
                    <h2 class="title">Carbon Budget Calculator</h2>
                    <p class="subtitle">Explore emission pathways to climate targets</p>
                </div>
                
                <div class="main-content">
                    <div class="controls-panel">
                        <div class="control-group">
                            <h3 class="control-label">Temperature Target</h3>
                            <div class="temperature-targets">
                                <button class="temp-button active" data-temp="1.5C">1.5°C</button>
                                <button class="temp-button" data-temp="2.0C">2.0°C</button>
                                <button class="temp-button" data-temp="2.5C">2.5°C</button>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <h3 class="control-label">Action Start Year</h3>
                            <div class="slider-container">
                                <input type="range" class="slider" id="startYearSlider" 
                                       min="2024" max="2035" value="2025" step="1">
                                <span class="slider-value" id="startYearValue">2025</span>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <h3 class="control-label">Annual Reduction Rate</h3>
                            <div class="slider-container">
                                <input type="range" class="slider" id="reductionRateSlider" 
                                       min="0" max="0.15" value="0.05" step="0.005">
                                <span class="slider-value" id="reductionRateValue">5.0%</span>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <h3 class="control-label">Display Options</h3>
                            <div class="toggle-group">
                                <div class="toggle-container">
                                    <input type="checkbox" class="toggle" id="showComparisons" checked>
                                    <label class="toggle-label" for="showComparisons">Reference scenarios</label>
                                </div>
                                <div class="toggle-container">
                                    <input type="checkbox" class="toggle" id="showUncertainty">
                                    <label class="toggle-label" for="showUncertainty">Uncertainty ranges</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="chart-panel">
                        <div class="chart-container">
                            <div class="loading" id="chartLoading">
                                <div class="loading-spinner"></div>
                                <div>Loading D3 visualization...</div>
                            </div>
                            <svg class="chart-svg" id="chartSvg" style="display: none;"></svg>
                            <div class="chart-legend" id="chartLegend" style="display: none;">
                                <div class="legend-item">
                                    <div class="legend-color" id="userPathwayColor" style="background: #ef4444;"></div>
                                    <span>Your pathway</span>
                                </div>
                                <div class="legend-item" id="currentPoliciesLegend" style="display: none;">
                                    <div class="legend-color" style="background: #64748b;"></div>
                                    <span>Current policies</span>
                                </div>
                                <div class="legend-item" id="parisNDCsLegend" style="display: none;">
                                    <div class="legend-color" style="background: #3b82f6;"></div>
                                    <span>Paris pledges</span>
                                </div>
                                <div class="legend-item" id="netZero2050Legend" style="display: none;">
                                    <div class="legend-color" style="background: #10b981;"></div>
                                    <span>Net zero 2050</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="metrics-bar">
                    <div class="metric-item">
                        <div class="metric-value danger" id="exhaustionYear">2031</div>
                        <div class="metric-label">Budget exhausted</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value danger" id="probability">25%</div>
                        <div class="metric-label">Success probability</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value warning" id="requiredRate">5.0%</div>
                        <div class="metric-label">Annual reduction</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value warning" id="perCapita">3.2</div>
                        <div class="metric-label">Per capita 2030<br><small>(tCO₂/person)</small></div>
                    </div>
                    
                    <div class="budget-meter">
                        <div class="budget-track">
                            <div class="budget-fill" id="budgetFill" style="width: 45%;"></div>
                        </div>
                        <div class="budget-text" id="budgetText">45% of 1.5°C budget used by 2050</div>
                    </div>
                </div>
            </div>
        `}setupEventListeners(){this.shadowRoot.querySelectorAll(".temp-button").forEach(s=>{s.addEventListener("click",n=>{this.shadowRoot.querySelectorAll(".temp-button").forEach(o=>o.classList.remove("active")),n.target.classList.add("active");const r=this.state.targetTemperature;this.state.targetTemperature=n.target.dataset.temp,console.log("🎯 Temperature target changed from",r,"to:",this.state.targetTemperature),this.updateVisualization()})});const t=this.shadowRoot.getElementById("startYearSlider"),e=this.shadowRoot.getElementById("startYearValue");t.addEventListener("input",s=>{this.state.reductionStartYear=parseInt(s.target.value),e.textContent=s.target.value,console.log("📅 Start year changed to:",this.state.reductionStartYear),this.updateVisualization()});const i=this.shadowRoot.getElementById("reductionRateSlider"),a=this.shadowRoot.getElementById("reductionRateValue");i.addEventListener("input",s=>{this.state.annualReductionRate=parseFloat(s.target.value),a.textContent=(parseFloat(s.target.value)*100).toFixed(1)+"%",console.log("📉 Reduction rate changed to:",this.state.annualReductionRate),this.updateVisualization()}),this.shadowRoot.getElementById("showComparisons").addEventListener("change",s=>{this.state.showComparisons=s.target.checked,console.log("🔄 Show comparisons toggled:",this.state.showComparisons),this.updateVisualization()}),this.shadowRoot.getElementById("showUncertainty").addEventListener("change",s=>{this.state.showUncertainty=s.target.checked,console.log("📊 Show uncertainty toggled:",this.state.showUncertainty),this.updateVisualization()}),console.log("✅ Event listeners set up")}initializeChart(){if(!window.d3){console.error("❌ D3 not available for chart initialization"),this.showError("D3.js library not loaded");return}console.log("📊 Starting chart initialization...");const e=this.shadowRoot.querySelector(".chart-container").getBoundingClientRect();if(console.log("📐 Container dimensions:",e.width,"x",e.height),e.width===0||e.height===0){console.warn("⚠️ Container has zero dimensions, retrying..."),setTimeout(()=>this.initializeChart(),200);return}this.chartWidth=e.width-this.margin.left-this.margin.right,this.chartHeight=e.height-this.margin.top-this.margin.bottom,console.log("📊 Chart dimensions:",this.chartWidth,"x",this.chartHeight),this.shadowRoot.getElementById("chartLoading").style.display="none",this.shadowRoot.getElementById("chartSvg").style.display="block",this.shadowRoot.getElementById("chartLegend").style.display="block",this.svg=d3.select(this.shadowRoot.getElementById("chartSvg")).attr("viewBox",`0 0 ${e.width} ${e.height}`).attr("preserveAspectRatio","xMidYMid meet"),this.svg.selectAll("*").remove();const i=this.svg.append("g").attr("transform",`translate(${this.margin.left},${this.margin.top})`);this.xScale=d3.scaleLinear().domain([2024,2060]).range([0,this.chartWidth]),this.yScale=d3.scaleLinear().domain([0,50]).range([this.chartHeight,0]),console.log("📏 Scales created"),this.line=d3.line().x(a=>this.xScale(a.year)).y(a=>this.yScale(a.emissions)).curve(d3.curveMonotoneX),this.area=d3.area().x(a=>this.xScale(a.year)).y0(this.chartHeight).y1(a=>this.yScale(a.emissions)).curve(d3.curveMonotoneX),console.log("📈 Line and area generators created"),i.append("g").attr("class","grid").attr("transform",`translate(0,${this.chartHeight})`).call(d3.axisBottom(this.xScale).tickSize(-this.chartHeight).tickFormat("").ticks(8)),i.append("g").attr("class","grid").call(d3.axisLeft(this.yScale).tickSize(-this.chartWidth).tickFormat("").ticks(6)),i.selectAll(".grid line").attr("class","grid-line"),i.selectAll(".grid .domain").remove(),console.log("📝 Grid lines added"),i.append("g").attr("class","x-axis").attr("transform",`translate(0,${this.chartHeight})`).call(d3.axisBottom(this.xScale).tickFormat(d3.format("d")).ticks(8)),i.append("g").attr("class","y-axis").call(d3.axisLeft(this.yScale).ticks(6)),i.append("text").attr("class","axis-label").attr("transform","rotate(-90)").attr("y",-35).attr("x",-this.chartHeight/2).style("text-anchor","middle").text("Annual Emissions (GtCO₂/year)"),i.append("text").attr("class","axis-label").attr("x",this.chartWidth/2).attr("y",this.chartHeight+30).style("text-anchor","middle").text("Year"),console.log("📋 Axes and labels added"),this.chartGroup=i,this.isInitialized=!0,console.log("✅ Chart initialization complete"),setTimeout(()=>{console.log("🚀 Forcing initial chart update..."),this.updateVisualization()},50)}generateUserPathway(){const t=[],a=this.CURRENT_EMISSIONS.annual,s=this.state.reductionStartYear,n=this.state.annualReductionRate;for(let r=2024;r<=2060;r++){let o;if(r<s){const c=r-2024;o=a*Math.pow(1+this.CURRENT_EMISSIONS.growthRate,c)}else{const c=r-s;o=a*Math.pow(1+this.CURRENT_EMISSIONS.growthRate,s-2024)*Math.pow(1-n,c),o=Math.max(0,o)}t.push({year:r,emissions:o})}return console.log("📊 Generated user pathway with",t.length,"points"),t}generateReferencePathway(t){const e=[],s=this.CURRENT_EMISSIONS.annual;for(let n=2024;n<=2060;n++){let r;if(n<t.peakYear){const o=n-2024,c=(t.peakEmissions-s)/(t.peakYear-2024)/s;r=s*(1+c*o)}else{const o=n-t.peakYear;r=t.peakEmissions*Math.pow(1-t.reductionRate,o),r=Math.max(0,r)}e.push({year:n,emissions:r})}return e}calculateCumulativeEmissions(t,e,i){return t.filter(a=>a.year>=e&&a.year<=i).reduce((a,s)=>a+s.emissions,0)}findBudgetExhaustionYear(t,e){let i=0;for(const a of t)if(i+=a.emissions,i>=e)return a.year;return null}calculateSuccessProbability(t,e){const i=t-e;return i<=0?Math.min(.9,.5+Math.abs(i)/e*.4):Math.max(.01,.5*Math.exp(-i/(e*.5)))}updateVisualization(){if(!this.isInitialized||!window.d3){console.log("⏳ Skipping visualization update - not ready yet");return}console.log("🎨 Updating visualization with target:",this.state.targetTemperature),this.userPathway=this.generateUserPathway();const t=this.CARBON_BUDGETS[this.state.targetTemperature];console.log("📊 User pathway generated:",this.userPathway.length,"points"),console.log("🎯 Using budget for",t.label,":",t.total,"GtCO2","color:",t.color);const e=this.calculateCumulativeEmissions(this.userPathway,2024,2050),i=Math.min(100,e/t.total*100);this.shadowRoot.getElementById("budgetFill").style.width=i+"%",this.shadowRoot.getElementById("budgetText").textContent=`${i.toFixed(0)}% of ${t.label} budget used by 2050`,console.log("📊 Budget meter updated:",i.toFixed(1),"%");const a=this.shadowRoot.getElementById("userPathwayColor");a&&(a.style.background=t.color),this.chartGroup.selectAll(".pathway-line, .pathway-area, .reference-line").remove(),this.chartGroup.append("path").datum(this.userPathway).attr("class","pathway-area").attr("d",this.area).style("fill",t.color),this.chartGroup.append("path").datum(this.userPathway).attr("class","pathway-line").attr("d",this.line).style("stroke",t.color),console.log("📈 User pathway drawn with color:",t.color),["currentPolicies","parisNDCs","netZero2050"].forEach(n=>{const r=this.shadowRoot.getElementById(n+"Legend");r&&(r.style.display=this.state.showComparisons?"flex":"none")}),this.state.showComparisons&&(console.log("📊 Drawing reference scenarios..."),Object.values(this.REFERENCE_SCENARIOS).forEach(n=>{const r=this.generateReferencePathway(n);this.chartGroup.append("path").datum(r).attr("class","reference-line").attr("d",this.line).style("stroke",n.color)})),this.updateMetrics(),console.log("✅ Visualization update complete")}updateMetrics(){const t=this.CARBON_BUDGETS[this.state.targetTemperature],e=this.userPathway,i=this.calculateCumulativeEmissions(e,2024,2050),a=this.findBudgetExhaustionYear(e,t.total),s=this.calculateSuccessProbability(i,t.total),n=this.shadowRoot.getElementById("exhaustionYear");a?(n.textContent=a.toString(),n.className="metric-value "+(a<2030?"danger":a<2040?"warning":"success")):(n.textContent="Never",n.className="metric-value success");const r=this.shadowRoot.getElementById("probability");r.textContent=(s*100).toFixed(0)+"%",r.className="metric-value "+(s<.3?"danger":s<.6?"warning":"success");const o=this.shadowRoot.getElementById("requiredRate");o.textContent=(this.state.annualReductionRate*100).toFixed(1)+"%",o.className="metric-value "+(this.state.annualReductionRate>.1?"danger":this.state.annualReductionRate>.06?"warning":"success");const l=(e.find(d=>d.year===2030)?.emissions||0)*1e3/8e3,h=this.shadowRoot.getElementById("perCapita");h.textContent=l.toFixed(1),h.className="metric-value "+(l>4?"danger":l>2.5?"warning":"success"),console.log("📊 Metrics updated for target:",t.label)}getState(){return{...this.state,currentBudget:this.CARBON_BUDGETS[this.state.targetTemperature],userPathway:this.userPathway,isInitialized:this.isInitialized,d3Available:!!window.d3}}}customElements.define("carbon-budget-calculator-3",p)})();(function(){class p extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.temperatureData=[],this.co2Data=[],this.isLoaded=!1,this.d3Loaded=!1,this.intrinsicWidth=624,this.intrinsicHeight=403,this.margin={top:20,right:6,bottom:80,left:6},this.svg=null,this.chartGroup=null,this.xScale=null,this.yScaleTemp=null,this.yScaleCO2=null,this.tempLine=null,this.co2Line=null,this.tempArea=null,this.brush=null,this.brushGroup=null,this.labelGroup=null,this.eventsGroup=null,this.periodsGroup=null,this.leftLabel=null,this.rightLabel=null,this.leftLabelBg=null,this.rightLabelBg=null,this.tooltip=null,this.eventTooltip=null,this.periodTooltip=null,this.tooltipStates={main:{element:null,isPortaled:!1},event:{element:null,isPortaled:!1},period:{element:null,isPortaled:!1}},this.crosshair=null,this.showUncertainty=!1,this.showCO2=!1,this.showEvents=!0,this.showPeriods=!0,this.timeRange={start:154,end:2023},this.climatePeriods=[{id:"late_antique_cooling",name:"Late Antique Little Ice Age",startYear:536,endYear:660,color:"#bfdbfe",description:"Major cooling period (536-660 CE) following multiple volcanic eruptions. Contributed to plague outbreaks, societal collapse, and migration period.",opacity:.3},{id:"medieval_warm",name:"Medieval Warm Period",startYear:950,endYear:1250,color:"#fde68a",description:"Regional warming period (950-1250 CE) in North Atlantic. Natural warming from solar variability and ocean circulation changes.",opacity:.25},{id:"little_ice_age",name:"Little Ice Age",startYear:1300,endYear:1850,color:"#bfdbfe",description:"Coldest period in the millennium (1300-1850 CE). Caused by reduced solar activity and increased volcanic activity.",opacity:.2},{id:"acceleration_period",name:"Acceleration Period",startYear:1945,endYear:2023,color:"#fecaca",description:"Post-WWII rapid industrialization and anthropogenic warming (1945-present). Period of steepest temperature rise and CO₂ increase in human history.",opacity:.25}],this.climateEvents=[{id:"volcanic_536",name:"Volcanic Winter of 536",year:536,color:"#7c2d12",description:"Catastrophic volcanic eruption causing the worst year in human history. Global cooling of 1.5-2.5°C, crop failures, and famines across Europe, Asia, and Americas.",link:"https://en.wikipedia.org/wiki/Extreme_weather_events_of_535%E2%80%93536"},{id:"volcanic_693",name:"Unknown Volcanic Event",year:693,color:"#7c2d12",description:"Major volcanic eruption causing global cooling 693-695 CE. Severe winters and crop failures across Europe and Asia documented in historical records.",link:"https://en.wikipedia.org/wiki/Extreme_weather_events_of_535%E2%80%93536"},{id:"eldgja_eruption",name:"Eldgjá Eruption",year:940,color:"#7c2d12",description:"Massive Icelandic volcanic eruption, one of largest in recorded history, causing hemispheric cooling and harsh winters across Europe.",link:"https://en.wikipedia.org/wiki/Eldgj%C3%A1"},{id:"mystery_1259",name:"Mystery Eruption",year:1259,color:"#7c2d12",description:"Unidentified tropical volcanic eruption creating one of largest sulfate spikes in ice cores. Caused severe global cooling and crop failures.",link:"https://en.wikipedia.org/wiki/1257_Samalas_eruption"},{id:"kuwae_eruption",name:"Kuwae Eruption",year:1452,color:"#7c2d12",description:"Massive Vanuatu volcanic eruption causing severe global cooling, contributing to Little Ice Age intensification.",link:"https://en.wikipedia.org/wiki/Kuwae"},{id:"sporer_minimum",name:"Spörer Minimum",year:1500,color:"#1e40af",description:"Extended solar minimum (1450-1550 CE) during Little Ice Age causing particularly harsh European winters and global cooling.",link:"https://en.wikipedia.org/wiki/Sp%C3%B6rer_Minimum"},{id:"huaynaputina_eruption",name:"Huaynaputina Eruption",year:1600,color:"#7c2d12",description:'Peruvian volcanic eruption causing "Year Without a Summer" in Northern Hemisphere and global famine in 1601.',link:"https://en.wikipedia.org/wiki/Huaynaputina"},{id:"famine_1695",name:"Great Famine of 1695-96",year:1695,color:"#dc2626",description:"Severe cooling event causing widespread crop failures and millions of deaths across Europe. Part of climax of Little Ice Age.",link:"https://en.wikipedia.org/wiki/Great_Famine_of_1695%E2%80%931697"},{id:"tambora",name:"Mount Tambora",year:1815,color:"#7c2d12",description:'Massive volcanic eruption in Indonesia. Caused "Year Without a Summer" in 1816 with global temperature drop of ~0.5°C.',link:"https://en.wikipedia.org/wiki/1815_eruption_of_Mount_Tambora"},{id:"krakatoa",name:"Krakatoa Eruption",year:1883,color:"#7c2d12",description:"Major volcanic eruption in Indonesia. Caused global cooling for 2-3 years and spectacular sunsets worldwide.",link:"https://en.wikipedia.org/wiki/1883_eruption_of_Krakatoa"},{id:"industrial_revolution",name:"Industrial Revolution",year:1850,color:"#dc2626",description:"Beginning of sustained fossil fuel emissions (1760-1840). Marks start of anthropogenic warming and exponential CO₂ rise.",link:"https://en.wikipedia.org/wiki/Industrial_Revolution"}]}connectedCallback(){this.initialize()}async initialize(){const t=this.getAttribute("data"),e=this.getAttribute("title")||"Global Temperature Anomalies & CO₂ (154-2017 CE)",i=this.getAttribute("xlabel")||"Year CE",a=this.getAttribute("ylabel")||"Temperature Anomaly (°C)";this.renderInterface(e);try{await this.loadD3(),this.loadTemperatureData(t),this.renderChart(e,i,a)}catch(s){this.shadowRoot.innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #dc3545;">
                    Error loading data: ${s.message}
                </div>
            `}}renderInterface(t){this.shadowRoot.innerHTML=`
            <style>
                :host {
                    display: block;
                    width: var(--intrinsic-width);
                    height: var(--intrinsic-height);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }

                .chart-container {
                    width: 100%;
                    height: 100%;
                    background: transparent;
                    padding: 4px;
                    box-sizing: border-box;
                    position: relative;
                }

                .chart-title {
                    font-size: 14px;
                    font-weight: 600;
                    text-align: center;
                    margin-bottom: 4px;
                    color: #374151;
                }

                .chart-subtitle {
                    font-size: 11px;
                    text-align: center;
                    margin-bottom: 6px;
                    color: #6b7280;
                    font-weight: 400;
                }

                .chart-svg {
                    width: 100%;
                    height: calc(100% - 60px); /* Leave room for title, subtitle, controls */
                    display: block;
                    cursor: crosshair;
                }

                .timeline-filter-container {
                    width: 91%;
                    height: 32px;
                    margin-top: -32px;
                    margin-left: auto;
                    margin-right: auto;
                    padding: 0 8px;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .timeline-filter {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    background: #f8f9fa;
                    border: 1px solid #e5e7eb;
                    border-radius: 2px;
                    overflow: visible;
                    cursor: crosshair;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                .timeline-overview-svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                    overflow: visible;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                .controls {
                    height: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 12px;
                    margin-top: 2px;
                    flex-wrap: wrap;
                }

                .control-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #6b7280;
                }

                .control-checkbox {
                    width: 10px;
                    height: 10px;
                    cursor: pointer;
                }
                
                /* D3 Brush Styling */
                .brush .overlay {
                    fill: none;
                    pointer-events: all;
                    cursor: crosshair;
                }

                .brush .selection {
                    fill: #3b82f6;
                    fill-opacity: 0.1;
                    stroke: #3b82f6;
                    stroke-width: 1px;
                    stroke-opacity: 0.8;
                    shape-rendering: crispEdges;
                }

                .brush .handle {
                    fill: #3b82f6;
                    cursor: ew-resize;
                    stroke: #1d4ed8;
                    stroke-width: 1px;
                }

                .brush .handle:hover {
                    fill: #1d4ed8;
                }

                /* Climate period styling */
                .climate-period {
                    pointer-events: all;
                    cursor: help;
                }

                /* Event styling */
                .event-tab {
                    cursor: pointer;
                }

                .event-tab circle {
                    transition: stroke-width 0.2s ease;
                }

                .event-tab:hover circle {
                    stroke-width: 2px;
                }

                .event-line {
                    stroke-dasharray: 2px,2px;
                    opacity: 0.6;
                    pointer-events: none;
                }

                /* Brush Labels */
                .brush-label {
                    font-family: inherit;
                    font-size: 11px;
                    fill: #374151;
                    font-weight: 500;
                    pointer-events: none;
                    user-select: none;
                }

                .label-bg {
                    pointer-events: none;
                }

                /* Chart styling */
                .axis {
                    font-size: 14px;
                }

                .axis-label {
                    font-size: 12px;
                    font-weight: 500;
                }

                .axis-label.temp {
                    fill: #3b82f6;
                }

                .axis-label.x-label {
                    font-size: 10px;
                }

                .axis-label.co2 {
                    fill: #f97316;
                }

                .grid-line {
                    stroke: #e5e7eb;
                    stroke-dasharray: 1px,1px;
                    stroke-width: 1px;
                    opacity: 0.3;
                }

                .domain {
                    stroke: #9ca3af;
                    stroke-width: 1px;
                }

                .tick line {
                    stroke: #9ca3af;
                    stroke-width: 1px;
                }

                .tick text {
                    fill: #6b7280;
                    font-size: 10px;
                }

                .temp-axis .tick text {
                    fill: #3b82f6;
                }

                .co2-axis .tick text {
                    fill: #f97316;
                }

                .temperature-line {
                    fill: none;
                    stroke: #3b82f6;
                    stroke-width: 1px;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }

                .co2-line {
                    fill: none;
                    stroke: #f97316;
                    stroke-width: 1px;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                    stroke-dasharray: 3px,2px;
                }

                .uncertainty-area {
                    fill: #3b82f6;
                    opacity: 0.15;
                }

                .crosshair {
                    stroke: #6b7280;
                    stroke-width: 1px;
                    stroke-dasharray: 2px,2px;
                    opacity: 0.7;
                    pointer-events: none;
                }
                
                /* Tooltips */
                .tooltip {
                    position: absolute;
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 6px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    line-height: 1.0;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    z-index: 1000;
                    max-width: 200px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(4px);
                    left: 0;
                    top: 0;
                    transform: translate(var(--tooltip-x, 8px), var(--tooltip-y, 8px));
                }

                .tooltip.visible {
                    opacity: 1;
                }

                .event-tooltip {
                    position: absolute;
                    background: rgba(0, 0, 0, 0.95);
                    color: white;
                    padding: 8px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    line-height: 1.4;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    z-index: 1001;
                    max-width: 240px;
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(6px);
                    left: 0;
                    top: 0;
                    transform: translate(var(--event-tooltip-x, 8px), var(--event-tooltip-y, 8px));
                }

                .event-tooltip.visible {
                    opacity: 1;
                }

                .period-tooltip {
                    position: absolute;
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 8px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    line-height: 1.4;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    z-index: 999;
                    max-width: 220px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    left: 0;
                    top: 0;
                    transform: translate(var(--period-tooltip-x, 8px), var(--period-tooltip-y, 8px));
                }

                .period-tooltip.visible {
                    opacity: 1;
                }

                .event-tooltip-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                    font-size: 12px;
                }

                .event-tooltip-year {
                    color: #93c5fd;
                    font-weight: 500;
                    margin-bottom: 4px;
                }

                .period-tooltip-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                    font-size: 12px;
                }

                .period-tooltip-years {
                    color: #fbbf24;
                    font-weight: 500;
                    margin-bottom: 4px;
                }

                .event-tooltip-description, .period-tooltip-description {
                    line-height: 1.5;
                }

                .tooltip-date {
                    font-weight: 600;
                    color: #60a5fa;
                    margin-bottom: 2px;
                }

                .tooltip-temp {
                    margin-bottom: 1px;
                    color: #93c5fd;
                }

                .tooltip-co2 {
                    margin-bottom: 1px;
                    color: #fdba74;
                }

                .tooltip-period {
                    margin-bottom: 1px;
                    color: #fbbf24;
                    font-weight: 500;
                }

                .tooltip-uncertainty {
                    font-size: 10px;
                    opacity: 0.8;
                }
            </style>
            
            <div class="chart-container">
                <div class="chart-title">${t}</div>
                <div class="chart-subtitle">PAGES2k Global Temperature & CO₂ Reconstruction (154-2017 CE, rel. to 1961-1990)</div>
                <svg class="chart-svg"></svg>
                <div class="timeline-filter-container">
                    <div class="timeline-filter" id="timelineFilter">
                        <svg class="timeline-overview-svg" id="timelineOverview"></svg>
                    </div>
                </div>
                <div class="controls">
                    <label class="control-group">
                        <input type="checkbox" class="control-checkbox" id="uncertaintyToggle">
                        Show 95% confidence bands
                    </label>
                    <label class="control-group">
                        <input type="checkbox" class="control-checkbox" id="eventsToggle" checked>
                        Show climate events
                    </label>
                    <label class="control-group">
                        <input type="checkbox" class="control-checkbox" id="periodsToggle" checked>
                        Show climate periods
                    </label>
                </div>
                <div class="tooltip" id="tooltip"></div>
                <div class="event-tooltip" id="eventTooltip"></div>
                <div class="period-tooltip" id="periodTooltip"></div>
            </div>
        `}async loadD3(){if(window.d3){this.d3Loaded=!0;return}return new Promise((t,e)=>{const i=document.createElement("script");i.src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js",i.onload=()=>{this.d3Loaded=!0,t()},i.onerror=()=>e(new Error("Failed to load D3.js library")),document.head.appendChild(i)})}loadTemperatureData(t){const e=window.WEBTEX_DATA?.[t];if(!e)throw new Error(`Data "${t}" not found in WEBTEX_DATA`);const i=[];for(const a of e.rows){const s=a[0],n=a[1]==="NA"?null:a[1],r=a[2],o=a[3],c=a[4];if(typeof s!="number"||typeof r!="number"||s<this.timeRange.start||s>this.timeRange.end)continue;let l="proxy";s>=1950?l="instrumental":s>=1850&&(l="mixed"),i.push({year:new Date(s,0,1),yearCE:s,temperature:r,uncertainty_lower:o,uncertainty_upper:c,instrumental_target:n,data_type:l,resolution:"annual"})}if(i.length===0)throw new Error("No valid temperature data points found");this.temperatureData=i.sort((a,s)=>a.year-s.year)}renderChart(t,e,i){setTimeout(()=>{this.createChart(e,i)},100)}getDimensions(){const t=this.intrinsicWidth-this.margin.left-this.margin.right,e=this.intrinsicHeight-this.margin.top-this.margin.bottom;return{width:t,height:e,margin:this.margin,containerWidth:this.intrinsicWidth,containerHeight:this.intrinsicHeight}}createChart(t,e){if(!window.d3)return;const i=this.getDimensions();this.brushState={fullTimeRange:d3.extent([...this.temperatureData.map(o=>o.year),...this.co2Data.map(o=>o.year)]),currentTimeRange:null,isDragging:!1,dragHandle:null},this.brushState.currentTimeRange=[...this.brushState.fullTimeRange];const a=this.shadowRoot.querySelector(".chart-svg");this.svg=d3.select(a).attr("viewBox",`0 0 ${i.containerWidth} ${i.containerHeight}`).attr("preserveAspectRatio","xMidYMid meet"),this.svg.selectAll("*").remove(),this.chartGroup=this.svg.append("g").attr("transform",`translate(${i.margin.left},${i.margin.top})`),this.width=i.width,this.height=i.height,this.margin=i.margin,this.containerWidth=i.containerWidth,this.containerHeight=i.containerHeight,this.tooltip=this.shadowRoot.querySelector("#tooltip"),this.eventTooltip=this.shadowRoot.querySelector("#eventTooltip"),this.periodTooltip=this.shadowRoot.querySelector("#periodTooltip"),this.tooltipStates.main.element=this.tooltip,this.tooltipStates.event.element=this.eventTooltip,this.tooltipStates.period.element=this.periodTooltip;const s=this.shadowRoot.querySelector("#uncertaintyToggle"),n=this.shadowRoot.querySelector("#eventsToggle"),r=this.shadowRoot.querySelector("#periodsToggle");this.updateScales(),this.tempLine=d3.line().x(o=>this.xScale(o.year)).y(o=>this.yScaleTemp(o.temperature)).curve(d3.curveLinear),this.co2Data.length>0&&(this.co2Line=d3.line().x(o=>this.xScale(o.year)).y(o=>this.yScaleCO2(o.co2)).curve(d3.curveLinear)),this.tempArea=d3.area().x(o=>this.xScale(o.year)).y0(o=>this.yScaleTemp(o.uncertainty_lower)).y1(o=>this.yScaleTemp(o.uncertainty_upper)).curve(d3.curveLinear),this.createClimatePeriods(),this.createGridLines(),this.createAxes(t,e),this.createUncertaintyBands(),this.createTemperatureLines(),this.createCO2Line(),this.createEventAnnotations(),this.createInteractions(),this.createTimelineFilter(),s.addEventListener("change",o=>{this.showUncertainty=o.target.checked,this.toggleUncertaintyBands()}),n.addEventListener("change",o=>{this.showEvents=o.target.checked,this.toggleEventAnnotations()}),r.addEventListener("change",o=>{this.showPeriods=o.target.checked,this.toggleClimatePeriods()})}updateScales(){this.xScale=d3.scaleTime().domain(this.brushState.currentTimeRange).range([0,this.width]),this.yScaleTemp=d3.scaleLinear().domain(d3.extent(this.temperatureData,t=>t.temperature)).nice().range([this.height,0]),this.yScaleCO2=this.co2Data.length>0?d3.scaleLinear().domain(d3.extent(this.co2Data,t=>t.co2)).nice().range([this.height,0]):null}createClimatePeriods(){this.periodsGroup=this.chartGroup.append("g").attr("class","climate-periods"),this.climatePeriods.forEach(t=>{this.createClimatePeriod(t)})}createClimatePeriod(t){const e=this.xScale(new Date(t.startYear,0,1)),i=this.xScale(new Date(t.endYear,0,1));i>=0&&e<=this.width&&this.periodsGroup.append("rect").attr("class",`climate-period period-${t.id}`).attr("x",Math.max(0,e)).attr("y",0).attr("width",Math.min(this.width,i)-Math.max(0,e)).attr("height",this.height).attr("fill",t.color).attr("opacity",t.opacity).style("pointer-events","all").style("cursor","help").on("mouseenter",s=>this.showPeriodTooltip(t,s)).on("mouseleave",()=>this.hidePeriodTooltip()).on("mousemove",s=>this.updatePeriodTooltipPosition(s))}portalTooltip(t,e,i,a){const s=this.tooltipStates[t];if(!s.element)return;const n=s.element;n.innerHTML=e,s.isPortaled||(this.cloneTooltipStyles(n,t),document.body.appendChild(n),s.isPortaled=!0),this.positionTooltipDirectly(n,i,a),n.style.visibility="visible",n.style.opacity="1"}positionTooltipDirectly(t,e,i){const a=t.getBoundingClientRect(),s=window.innerWidth,n=window.innerHeight;let r=e+15,o=i-15;r+a.width>s-20&&(r=e-a.width-15),o+a.height>n-20&&(o=i+20),r=Math.max(10,Math.min(r,s-a.width-10)),o=Math.max(10,Math.min(o,n-a.height-10)),t.style.left=`${r}px`,t.style.top=`${o}px`}cloneTooltipStyles(t,e){t.style.position="fixed",t.style.zIndex=e==="event"?"1001":e==="period"?"999":"1000",t.style.background="rgba(0, 0, 0, 0.9)",t.style.color="white",t.style.padding="8px 12px",t.style.borderRadius="6px",t.style.fontSize="14px",t.style.lineHeight="1.4",t.style.pointerEvents="none",t.style.maxWidth="300px",t.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.3)",t.style.backdropFilter="blur(8px)",t.style.fontFamily='-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}showPeriodTooltip(t,e){const i=`
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 1.05em;">${t.name}</div>
            <div style="color: #fbbf24; font-weight: 500; margin-bottom: 8px;">${t.startYear}-${t.endYear} CE</div>
            <div style="line-height: 1.5;">${t.description}</div>
        `;this.portalTooltip("period",i,e.clientX,e.clientY)}updatePeriodTooltipPosition(t){const e=this.tooltipStates.period;e.isPortaled&&this.positionTooltipDirectly(e.element,t.clientX,t.clientY)}hidePeriodTooltip(){const t=this.tooltipStates.period;t.element&&(t.element.style.visibility="hidden",t.element.style.opacity="0")}toggleClimatePeriods(){this.periodsGroup&&this.periodsGroup.style("opacity",this.showPeriods?1:0)}createEventAnnotations(){this.eventsGroup=this.chartGroup.append("g").attr("class","climate-events"),this.climateEvents.forEach(t=>{this.createEventAnnotation(t)})}createEventAnnotation(t){const e=this.xScale(new Date(t.year,0,1));if(e>=0&&e<=this.width){const i=this.eventsGroup.append("g").attr("class",`event-marker event-${t.id}`);i.append("line").attr("class","event-line").attr("x1",e).attr("x2",e).attr("y1",0).attr("y2",this.height).attr("stroke",t.color);const a=i.append("g").attr("class","event-tab").attr("transform",`translate(${e}, ${this.height+.06*this.containerHeight})`),s=.012*Math.min(this.containerWidth,this.containerHeight);a.append("circle").attr("r",s).attr("fill",t.color).attr("stroke","#fff"),a.on("mouseenter",n=>this.showEventTooltip(t,n)).on("mouseleave",()=>this.hideEventTooltip()).on("click",()=>{window.open(t.link,"_blank")})}}showEventTooltip(t,e){const i=`
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 1.1em;">${t.name}</div>
            <div style="color: #93c5fd; font-weight: 500; margin-bottom: 8px;">${t.year} CE</div>
            <div style="line-height: 1.5;">${t.description}</div>
        `;this.portalTooltip("event",i,e.clientX,e.clientY)}hideEventTooltip(){const t=this.tooltipStates.event;t.element&&(t.element.style.visibility="hidden",t.element.style.opacity="0")}toggleEventAnnotations(){this.eventsGroup&&this.eventsGroup.style("opacity",this.showEvents?1:0)}createTimelineFilter(){this.shadowRoot.querySelector("#timelineFilter");const t=d3.select(this.shadowRoot.querySelector("#timelineOverview")),e=this.getDimensions(),i=e.containerWidth*.96,a=e.containerHeight*.06;t.selectAll("*").remove(),t.attr("viewBox",`0 0 ${i} ${a}`).attr("preserveAspectRatio","xMidYMid meet");const s=.015*i;this.overviewXScale=d3.scaleTime().domain(this.brushState.fullTimeRange).range([s,i-s]),this.overviewYScale=d3.scaleLinear().domain(d3.extent(this.temperatureData,o=>o.temperature)).range([a*.9,a*.1]);const n=d3.line().x(o=>this.overviewXScale(o.year)).y(o=>this.overviewYScale(o.temperature)).curve(d3.curveLinear);if(t.append("path").datum(this.temperatureData).attr("d",n).attr("fill","none").attr("stroke","#6b7280").attr("opacity",.7),this.co2Data.length>0){const o=d3.scaleLinear().domain(d3.extent(this.co2Data,l=>l.co2)).range([a*.9,a*.1]),c=d3.line().x(l=>this.overviewXScale(l.year)).y(l=>o(l.co2)).curve(d3.curveLinear);t.append("path").datum(this.co2Data).attr("d",c).attr("fill","none").attr("stroke","#f97316").attr("opacity",.5)}this.brush=d3.brushX().extent([[s,0],[i-s,a]]).on("start brush end",o=>this.onBrushEvent(o)),this.brushGroup=t.append("g").attr("class","brush").call(this.brush),this.brushGroup.selectAll(".handle").attr("width",3).attr("rx",1);const r=[this.overviewXScale(this.brushState.currentTimeRange[0]),this.overviewXScale(this.brushState.currentTimeRange[1])];this.brushGroup.call(this.brush.move,r),this.addBrushLabels(t,a)}addBrushLabels(t,e){this.labelGroup=t.append("g").attr("class","brush-labels");const i=.006*this.containerWidth;this.leftLabelBg=this.labelGroup.append("rect").attr("class","label-bg left-bg").attr("fill","rgba(255, 255, 255, 0.9)").attr("stroke","#e5e7eb").attr("rx",.005*this.containerWidth).style("opacity",0),this.rightLabelBg=this.labelGroup.append("rect").attr("class","label-bg right-bg").attr("fill","rgba(255, 255, 255, 0.9)").attr("stroke","#e5e7eb").attr("rx",.005*this.containerWidth).style("opacity",0),this.leftLabel=this.labelGroup.append("text").attr("class","brush-label left-label").attr("y",-i).attr("text-anchor","middle").style("fill","#6b7280").style("font-weight","500").style("opacity",0).text("154 CE"),this.rightLabel=this.labelGroup.append("text").attr("class","brush-label right-label").attr("y",-i).attr("text-anchor","middle").style("fill","#6b7280").style("font-weight","500").style("opacity",0).text("2017 CE")}onBrushEvent(t){const{type:e,selection:i}=t;if(!i)return;const a=[this.overviewXScale.invert(i[0]),this.overviewXScale.invert(i[1])];this.brushState.currentTimeRange=a,this.updateBrushLabels(i),e==="start"||e==="brush"?(this.showBrushLabels(),this.updateMainChart()):e==="end"&&this.hideBrushLabels()}updateBrushLabels(t){if(!this.leftLabel||!this.rightLabel||!this.leftLabelBg||!this.rightLabelBg)return;const e=t[0],i=t[1],a=this.overviewXScale.invert(e).getFullYear(),s=this.overviewXScale.invert(i).getFullYear();this.leftLabel.attr("x",e).text(`${a} CE`),this.rightLabel.attr("x",i).text(`${s} CE`);try{const n=this.leftLabel.node().getBBox(),r=this.rightLabel.node().getBBox(),o=.006*this.containerWidth;this.leftLabelBg.attr("x",n.x-o).attr("y",n.y-o/2).attr("width",n.width+2*o).attr("height",n.height+o),this.rightLabelBg.attr("x",r.x-o).attr("y",r.y-o/2).attr("width",r.width+2*o).attr("height",r.height+o)}catch{}}showBrushLabels(){this.labelGroup&&this.labelGroup.selectAll(".brush-label, .label-bg").style("opacity",1)}hideBrushLabels(){this.labelGroup&&this.labelGroup.selectAll(".brush-label, .label-bg").style("opacity",0)}updateMainChart(){this.updateScales();const t=Math.max(4,Math.floor(this.width/(this.containerWidth*.12))),e=Math.max(3,Math.floor(this.height/(this.containerHeight*.08))),i=d3.axisBottom(this.xScale).tickFormat(d3.timeFormat("%Y")).ticks(t);this.chartGroup.select(".x-axis").call(i);const a=d3.axisLeft(this.yScaleTemp).tickFormat(r=>r.toFixed(1)).ticks(e);if(this.chartGroup.select(".temp-axis").call(a),this.yScaleCO2){const r=d3.axisRight(this.yScaleCO2).tickFormat(o=>o.toFixed(0)).ticks(e);this.chartGroup.select(".co2-axis").call(r)}this.tempLine.x(r=>this.xScale(r.year)).y(r=>this.yScaleTemp(r.temperature)),this.co2Data.length>0&&this.co2Line.x(r=>this.xScale(r.year)).y(r=>this.yScaleCO2(r.co2)),this.tempArea.x(r=>this.xScale(r.year)).y0(r=>this.yScaleTemp(r.uncertainty_lower)).y1(r=>this.yScaleTemp(r.uncertainty_upper));const s=this.temperatureData.filter(r=>r.year>=this.brushState.currentTimeRange[0]&&r.year<=this.brushState.currentTimeRange[1]),n=this.co2Data.filter(r=>r.year>=this.brushState.currentTimeRange[0]&&r.year<=this.brushState.currentTimeRange[1]);this.chartGroup.select(".temperature-line").datum(s).attr("d",this.tempLine),this.co2Data.length>0&&this.chartGroup.select(".co2-line").datum(n).attr("d",this.co2Line),this.chartGroup.select(".uncertainty-area").datum(s).attr("d",this.tempArea),this.chartGroup.select(".x-grid").call(d3.axisBottom(this.xScale).tickSize(-this.height).tickFormat("").ticks(t)),this.chartGroup.select(".y-grid").call(d3.axisLeft(this.yScaleTemp).tickSize(-this.width).tickFormat("").ticks(e)),this.periodsGroup&&(this.periodsGroup.selectAll("*").remove(),this.climatePeriods.forEach(r=>{this.createClimatePeriod(r)}),this.periodsGroup.style("opacity",this.showPeriods?1:0)),this.eventsGroup&&(this.eventsGroup.selectAll("*").remove(),this.climateEvents.forEach(r=>{this.createEventAnnotation(r)}),this.eventsGroup.style("opacity",this.showEvents?1:0))}createGridLines(){const t=Math.max(4,Math.floor(this.width/(this.containerWidth*.12))),e=Math.max(3,Math.floor(this.height/(this.containerHeight*.08))),i=d3.axisBottom(this.xScale).tickSize(-this.height).tickFormat("").ticks(t);this.chartGroup.append("g").attr("class","grid x-grid").attr("transform",`translate(0,${this.height})`).call(i);const a=d3.axisLeft(this.yScaleTemp).tickSize(-this.width).tickFormat("").ticks(e);this.chartGroup.append("g").attr("class","grid y-grid").call(a)}createAxes(t,e){const i=Math.max(4,Math.floor(this.width/(this.containerWidth*.12))),a=Math.max(3,Math.floor(this.height/(this.containerHeight*.08))),s=d3.axisBottom(this.xScale).tickFormat(d3.timeFormat("%Y")).ticks(i);this.chartGroup.append("g").attr("class","axis x-axis").attr("transform",`translate(0,${this.height})`).call(s);const n=d3.axisLeft(this.yScaleTemp).tickFormat(l=>l.toFixed(1)).ticks(a);if(this.chartGroup.append("g").attr("class","axis y-axis temp-axis").call(n),this.yScaleCO2){const l=d3.axisRight(this.yScaleCO2).tickFormat(h=>h.toFixed(0)).ticks(a);this.chartGroup.append("g").attr("class","axis y-axis co2-axis").attr("transform",`translate(${this.width},0)`).call(l).style("opacity",0)}const r=this.height+.085*this.containerHeight,o=-(.08*this.containerWidth),c=this.width+.08*this.containerWidth;this.chartGroup.append("text").attr("class","axis-label x-label").attr("transform",`translate(${this.width/2}, ${r})`).style("text-anchor","middle").style("fill","#4b5563").text(t),this.chartGroup.append("text").attr("class","axis-label y-label temp").attr("transform","rotate(-90)").attr("y",o).attr("x",0-this.height/2).style("text-anchor","middle").text(e),this.yScaleCO2&&this.chartGroup.append("text").attr("class","axis-label y-label co2").attr("transform","rotate(-90)").attr("y",c).attr("x",0-this.height/2).style("text-anchor","middle").style("opacity",0).text("CO₂ Concentration (ppm)")}createUncertaintyBands(){this.chartGroup.append("path").datum(this.temperatureData).attr("class","uncertainty-area").attr("d",this.tempArea).style("opacity",0)}createTemperatureLines(){this.chartGroup.append("path").datum(this.temperatureData).attr("class","temperature-line").attr("d",this.tempLine)}createCO2Line(){this.co2Data.length>0&&this.chartGroup.append("path").datum(this.co2Data).attr("class","co2-line").attr("d",this.co2Line).style("opacity",0)}createInteractions(){this.crosshair=this.chartGroup.append("g").attr("class","crosshair").style("opacity",0),this.crosshair.append("line").attr("class","crosshair-x").attr("y1",0).attr("y2",this.height),this.chartGroup.append("rect").attr("class","overlay").attr("width",this.width).attr("height",this.height).style("fill","none").style("pointer-events","all").on("mouseover",()=>this.showCrosshair()).on("mouseout",()=>this.hideCrosshair()).on("mousemove",e=>this.onMouseMove(e))}toggleUncertaintyBands(){this.chartGroup.select(".uncertainty-area").transition().duration(300).style("opacity",this.showUncertainty?.15:0)}toggleCO2Line(){if(this.co2Data.length===0)return;const t=this.chartGroup.select(".co2-line"),e=this.chartGroup.select(".co2-axis"),i=this.chartGroup.select(".y-label.co2"),a=this.showCO2?1:0;t.transition().duration(300).style("opacity",a),e.transition().duration(300).style("opacity",a),i.transition().duration(300).style("opacity",a)}showCrosshair(){this.crosshair.style("opacity",1)}hideCrosshair(){this.crosshair.style("opacity",0);const t=this.tooltipStates.main;t.element&&(t.element.style.visibility="hidden",t.element.style.opacity="0")}onMouseMove(t){const[e]=d3.pointer(t),i=this.xScale.invert(e),a=this.temperatureData.filter(d=>d.year>=this.brushState.currentTimeRange[0]&&d.year<=this.brushState.currentTimeRange[1]),s=d3.bisector(d=>d.year).left,n=s(a,i,1),r=a[n-1],o=a[n];let c=null;(r||o)&&(c=!o||r&&i-r.year<o.year-i?r:o);let l=null;if(this.showCO2&&this.co2Data.length>0){const d=this.co2Data.filter(m=>m.year>=this.brushState.currentTimeRange[0]&&m.year<=this.brushState.currentTimeRange[1]),x=d3.bisector(m=>m.year).left,v=x(d,i,1),u=d[v-1],g=d[v];(u||g)&&(l=!g||u&&i-u.year<g.year-i?u:g)}if(!c)return;const h=this.xScale(c.year);this.crosshair.select(".crosshair-x").attr("x1",h).attr("x2",h),this.showTooltip(c,l,t)}findClimatePeriod(t){return this.climatePeriods.find(e=>t>=e.startYear&&t<=e.endYear)}showTooltip(t,e,i){let a=`
            <div style="font-weight: 600; color: #60a5fa; margin-bottom: 4px;">${t.yearCE} CE</div>
            <div style="margin-bottom: 3px; color: #93c5fd;">Temperature: ${t.temperature.toFixed(3)}°C</div>
        `;const s=this.findClimatePeriod(t.yearCE);s&&this.showPeriods&&(a+=`<div style="margin-bottom: 3px; color: #fbbf24; font-weight: 500;">Period: ${s.name}</div>`),this.showUncertainty&&(a+=`<div style="font-size: 0.9em; opacity: 0.8;">95% confidence: [${t.uncertainty_lower.toFixed(3)}, ${t.uncertainty_upper.toFixed(3)}]°C</div>`),this.showCO2&&e&&(a+=`<div style="margin-bottom: 3px; color: #fdba74;">CO₂: ${e.co2.toFixed(2)} ppm</div>`),this.portalTooltip("main",a,i.clientX,i.clientY)}disconnectedCallback(){}}customElements.define("time-series-explorer-1",p)})();
