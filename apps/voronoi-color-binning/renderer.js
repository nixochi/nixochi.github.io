import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rgb2lab, rgbToHex } from './color-utils.js';

// ==========================================
// RENDERER STATE
// ==========================================

// WebGL context for voronoi computation
let gl = null;
let voronoiProgram = null;
let voronoiTexture = null;
let voronoiFramebuffer = null;
let quadBuffer = null;
let currentResolution = 0;
let cachedVoronoiPixels = null; // Cache the GPU texture data

// Shared renderer and cell scenes
const cellScenes = new Map();
const cellModes = new Map(); // Track 2D/3D mode per cell
let sharedRenderer = null;
let sharedCanvas = null;
let intersectionObserver = null;
const visibleCells = new Set();
let animationFrameId = null;

// Will be set by exported functions
let voronoiCells = null;

// ==========================================
// SHADER LOADING
// ==========================================

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

// ==========================================
// WEBGL INITIALIZATION
// ==========================================

export async function initWebGL() {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
        console.error('WebGL not supported');
        return false;
    }

    // Load shaders
    const vertexShaderSource = await loadShader('./shaders/vertex.glsl');
    const fragmentShaderSource = await loadShader('./shaders/voronoi-fragment.glsl');

    // Compile shaders
    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    function createProgram(vertSrc, fragSrc) {
        const program = gl.createProgram();
        gl.attachShader(program, compileShader(vertSrc, gl.VERTEX_SHADER));
        gl.attachShader(program, compileShader(fragSrc, gl.FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    voronoiProgram = createProgram(vertexShaderSource, fragmentShaderSource);

    // Setup quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    console.log('WebGL initialized');
    return true;
}

// ==========================================
// VORONOI COMPUTATION
// ==========================================

export async function computeVoronoi(palette, resolutionSlider, clearBtn) {
    if (palette.length === 0) return null;

    const originalClearText = clearBtn.textContent;
    clearBtn.textContent = 'Computing...';
    clearBtn.disabled = true;

    if (!gl && !(await initWebGL())) {
        clearBtn.textContent = originalClearText;
        clearBtn.disabled = false;
        return null;
    }

    // ALWAYS compute at full resolution (256)
    const computeResolution = 256;
    const slicesPerRow = Math.ceil(Math.sqrt(computeResolution));
    const textureSize = slicesPerRow * computeResolution;

    console.log(`Computing voronoi at FULL resolution: ${computeResolution}^3 = ${computeResolution ** 3} colors, texture: ${textureSize}x${textureSize}`);

    // Create/resize texture and framebuffer (only once at max resolution)
    if (!voronoiTexture || currentResolution !== computeResolution) {
        if (voronoiTexture) gl.deleteTexture(voronoiTexture);
        if (voronoiFramebuffer) gl.deleteFramebuffer(voronoiFramebuffer);

        voronoiTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, voronoiTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureSize, textureSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        voronoiFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, voronoiFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, voronoiTexture, 0);

        currentResolution = computeResolution;
    }

    // Render voronoi to texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, voronoiFramebuffer);
    gl.viewport(0, 0, textureSize, textureSize);
    gl.useProgram(voronoiProgram);

    const paletteLabFlat = new Float32Array(32 * 3);
    const paletteWeightsFlat = new Float32Array(32);
    palette.forEach((color, i) => {
        paletteLabFlat[i * 3] = color.lab[0];
        paletteLabFlat[i * 3 + 1] = color.lab[1];
        paletteLabFlat[i * 3 + 2] = color.lab[2];
        paletteWeightsFlat[i] = color.weight || 1.0;
    });

    gl.uniform3fv(gl.getUniformLocation(voronoiProgram, 'paletteColors'), paletteLabFlat);
    gl.uniform1fv(gl.getUniformLocation(voronoiProgram, 'paletteWeights'), paletteWeightsFlat);
    gl.uniform1i(gl.getUniformLocation(voronoiProgram, 'paletteCount'), palette.length);
    gl.uniform1i(gl.getUniformLocation(voronoiProgram, 'resolution'), computeResolution);
    gl.uniform1i(gl.getUniformLocation(voronoiProgram, 'slicesPerRow'), slicesPerRow);

    const posLoc = gl.getAttribLocation(voronoiProgram, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read pixels ONCE and cache
    const voronoiPixels = new Uint8Array(textureSize * textureSize * 4);
    gl.readPixels(0, 0, textureSize, textureSize, gl.RGBA, gl.UNSIGNED_BYTE, voronoiPixels);
    cachedVoronoiPixels = voronoiPixels; // Cache for later use

    console.log('GPU computation done, building 3D data only...');

    // Get display resolution from slider
    const displayResolution = parseInt(resolutionSlider.value);
    const step = Math.floor(computeResolution / displayResolution);

    console.log(`Processing ${computeResolution}^3 colors (3D downsampled to ${displayResolution})`);

    // Initialize data structures
    const cells = palette.map(seed => ({
        seed,
        points: []  // For 3D visualization (downsampled)
    }));

    // Single pass through all pixels (3D only)
    for (let ri = 0; ri < computeResolution; ri += step) {
        for (let gi = 0; gi < computeResolution; gi += step) {
            for (let bi = 0; bi < computeResolution; bi += step) {
                const sliceIdx = bi;
                const sliceY = Math.floor(sliceIdx / slicesPerRow);
                const sliceX = sliceIdx % slicesPerRow;

                const texX = sliceX * computeResolution + ri;
                const texY = sliceY * computeResolution + gi;

                const pixelIdx = (texY * textureSize + texX) * 4;
                const paletteIdx = voronoiPixels[pixelIdx];

                if (paletteIdx < palette.length) {
                    const r = ri / (computeResolution - 1);
                    const g = gi / (computeResolution - 1);
                    const b = bi / (computeResolution - 1);
                    const lab = rgb2lab(r, g, b);

                    cells[paletteIdx].points.push({
                        rgb: [r, g, b],
                        lab: lab,
                        hex: rgbToHex(r, g, b)
                    });
                }
            }
        }
    }

    voronoiCells = cells;

    // Log 3D point counts only
    console.log('3D visualization data ready:');
    cells.forEach((cell, idx) => {
        console.log(`Cell ${idx} (${palette[idx].hex}): ${cell.points.length} 3D points`);
    });

    clearBtn.textContent = originalClearText;
    clearBtn.disabled = false;

    return cells;
}

// ==========================================
// 3D VISUALIZATION
// ==========================================

function create3DVisualization(canvas, cell, idx) {
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    console.log(`Creating 3D viz for cell ${idx}: ${width}x${height}, ${cell.points.length} points`);

    if (!cell.points || cell.points.length === 0) {
        console.warn(`Cell ${idx} has no points`);
        return;
    }

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161617);

    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000);

    // Controls (attached to canvas)
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0.5, 0.5, 0.5);  // Center of RGB cube

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Draw RGB cube wireframe as reference
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cubeEdges = new THREE.EdgesGeometry(cubeGeometry);
    const cubeLine = new THREE.LineSegments(
        cubeEdges,
        new THREE.LineBasicMaterial({ color: 0x444444 })
    );
    cubeLine.position.set(0.5, 0.5, 0.5);
    scene.add(cubeLine);

    // Downsample points for performance (use every Nth point)
    const downsampleFactor = 4; // Only render every 4th point
    const positions = [];
    const colors = [];

    cell.points.forEach((point, i) => {
        if (i % downsampleFactor !== 0) return; // Skip this point

        const [r, g, b] = point.rgb;
        // Position in RGB cube: X=R, Y=G, Z=B (absolute position in [0,1]³)
        positions.push(r, g, b);
        colors.push(r, g, b);
    });

    console.log(`Cell ${idx}: Downsampled from ${cell.points.length} to ${positions.length / 3} points`);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pointSize = 0.012; // Fixed size relative to cube
    const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        sizeAttenuation: true
    });

    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);

    // Position camera to see the whole cube
    const cameraDistance = 2;
    camera.position.set(cameraDistance, cameraDistance * 0.8, cameraDistance);

    // Store scene data
    cellScenes.set(idx, {
        scene,
        camera,
        canvas,
        controls
    });

    console.log(`Cell ${idx} 3D scene created in RGB cube`);
}

// ==========================================
// 2D GRID RENDERING (STREAMED)
// ==========================================

async function create2DGrid(idx) {
    const cell = voronoiCells[idx];
    if (!cell || !cell.points) return;

    const gridContainer = document.getElementById(`grid-${idx}`);
    if (!gridContainer) return;

    // Check if we have cached voronoi data
    if (!cachedVoronoiPixels) {
        console.warn(`Cell ${idx}: No cached voronoi data available`);
        return;
    }

    console.log(`Cell ${idx}: Building 2D grid from cached data...`);

    // Get ALL points from full resolution (not downsampled)
    const computeResolution = 256;
    const slicesPerRow = Math.ceil(Math.sqrt(computeResolution));
    const textureSize = slicesPerRow * computeResolution;

    const allColors = [];

    // STREAM: Process one slice at a time to avoid blocking
    for (let bi = 0; bi < computeResolution; bi++) {
        // Yield to browser after each slice
        if (bi % 16 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
            console.log(`Cell ${idx}: Processing slice ${bi}/${computeResolution}`);
        }

        for (let ri = 0; ri < computeResolution; ri++) {
            for (let gi = 0; gi < computeResolution; gi++) {
                const sliceIdx = bi;
                const sliceY = Math.floor(sliceIdx / slicesPerRow);
                const sliceX = sliceIdx % slicesPerRow;

                const texX = sliceX * computeResolution + ri;
                const texY = sliceY * computeResolution + gi;

                const pixelIdx = (texY * textureSize + texX) * 4;
                const paletteIdx = cachedVoronoiPixels[pixelIdx];

                if (paletteIdx === idx) {
                    const r = Math.round(ri * 255 / (computeResolution - 1));
                    const g = Math.round(gi * 255 / (computeResolution - 1));
                    const b = Math.round(bi * 255 / (computeResolution - 1));

                    // Calculate luminance for sorting
                    const [L] = rgb2lab(r / 255, g / 255, b / 255);
                    allColors.push({ r, g, b, L });
                }
            }
        }
    }

    console.log(`Cell ${idx}: Collected ${allColors.length} colors, sorting by luminance...`);

    // Check if cell has no colors
    if (allColors.length === 0) {
        console.warn(`Cell ${idx}: No colors assigned to this palette color`);
        const message = document.createElement('div');
        message.style.cssText = 'padding: 20px; text-align: center; color: var(--fg-secondary); font-size: 14px;';
        message.textContent = 'No colors assigned to this palette color';
        gridContainer.appendChild(message);
        return;
    }

    // Sort by luminance (L value from Lab color space)
    allColors.sort((a, b) => b.L - a.L); // Descending (bright to dark)

    console.log(`Cell ${idx}: Rendering ${allColors.length} colors in 2D grid (canvas)`);

    // Use canvas for efficient rendering
    const swatchSize = 8;
    const containerWidth = gridContainer.parentElement.clientWidth - 16; // Account for padding
    const cols = Math.floor(containerWidth / swatchSize);
    const rows = Math.ceil(allColors.length / cols);

    const canvas = document.createElement('canvas');
    canvas.className = 'cell-2d-canvas';
    canvas.width = cols * swatchSize;
    canvas.height = rows * swatchSize;

    const ctx = canvas.getContext('2d');

    // Draw all color swatches (now sorted by luminance)
    let colorIdx = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (colorIdx >= allColors.length) break;
            const { r, g, b } = allColors[colorIdx];
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(col * swatchSize, row * swatchSize, swatchSize, swatchSize);
            colorIdx++;
        }
        if (colorIdx >= allColors.length) break;
    }

    gridContainer.appendChild(canvas);
    console.log(`Cell ${idx}: 2D grid rendered successfully`);
}

function toggleCellMode(idx, mode) {
    cellModes.set(idx, mode);

    // Update button states
    const cell = document.querySelector(`.voronoi-cell[data-cell-idx="${idx}"]`);
    if (!cell) return;

    const btn3d = cell.querySelector('.mode-3d');
    const btn2d = cell.querySelector('.mode-2d');
    const canvasContainer = document.getElementById(`canvas-container-${idx}`);
    const gridContainer = document.getElementById(`grid-${idx}`);

    if (mode === '3d') {
        btn3d.classList.add('active');
        btn2d.classList.remove('active');
        canvasContainer.style.display = 'block';
        gridContainer.classList.remove('active');
    } else {
        btn3d.classList.remove('active');
        btn2d.classList.add('active');
        canvasContainer.style.display = 'none';
        gridContainer.classList.add('active');

        // Build 2D grid if not already built
        if (!gridContainer.hasChildNodes()) {
            create2DGrid(idx);
        }
    }

    console.log(`Cell ${idx} switched to ${mode} mode`);
}

function startSharedAnimationLoop() {
    function animate() {
        animationFrameId = requestAnimationFrame(animate);

        // Only render visible cells in 3D mode using shared renderer
        visibleCells.forEach(idx => {
            // Skip if in 2D mode
            if (cellModes.get(idx) === '2d') return;

            const cellData = cellScenes.get(idx);
            if (cellData) {
                const { scene, camera, canvas, controls } = cellData;

                // Update controls
                controls.update();

                // Get canvas dimensions
                const width = canvas.width;
                const height = canvas.height;

                // Update camera aspect if needed
                if (camera.aspect !== width / height) {
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                }

                // Render to shared renderer
                sharedRenderer.setSize(width, height, false);
                sharedRenderer.render(scene, camera);

                // Copy from shared canvas to cell canvas
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(sharedCanvas, 0, 0, width, height);
                }
            }
        });
    }
    animate();
}

export function updateVoronoiUI(cells, voronoiGrid) {
    if (!cells || cells.length === 0) {
        voronoiGrid.innerHTML = '';
        return;
    }

    voronoiCells = cells;

    // Clear previous scenes
    cellScenes.clear();
    visibleCells.clear();

    // Disconnect old observer
    if (intersectionObserver) {
        intersectionObserver.disconnect();
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Create shared renderer (ONE WebGL context for all cells)
    if (!sharedRenderer) {
        console.log('Creating shared WebGL renderer');
        sharedCanvas = document.createElement('canvas');
        sharedRenderer = new THREE.WebGLRenderer({
            canvas: sharedCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        sharedRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    // Create HTML structure
    voronoiGrid.innerHTML = cells.map((cell, idx) => {
        return `
            <div class="voronoi-cell" style="border-color: ${cell.seed.hex}; background: ${cell.seed.hex};" data-cell-idx="${idx}">
                <div class="cell-mode-toggle">
                    <button class="mode-btn mode-3d active" data-cell-idx="${idx}">3D</button>
                    <button class="mode-btn mode-2d" data-cell-idx="${idx}">2D</button>
                </div>
                <div class="cell-canvas-container" id="canvas-container-${idx}">
                    <canvas class="cell-canvas" id="canvas-${idx}"></canvas>
                </div>
                <div class="cell-2d-grid" id="grid-${idx}"></div>
            </div>
        `;
    }).join('');

    // Initialize all cells to 3D mode
    cells.forEach((cell, idx) => {
        cellModes.set(idx, '3d');
    });

    // Create 3D scenes for each cell
    cells.forEach((cell, idx) => {
        const canvas = document.getElementById(`canvas-${idx}`);
        if (canvas) {
            create3DVisualization(canvas, cell, idx);
        }
    });

    // Setup mode toggle handlers
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.cellIdx);
            const is3D = btn.classList.contains('mode-3d');
            toggleCellMode(idx, is3D ? '3d' : '2d');
        });
    });

    // Set up intersection observer
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const idx = parseInt(entry.target.dataset.cellIdx);
            if (entry.isIntersecting) {
                visibleCells.add(idx);
            } else {
                visibleCells.delete(idx);
            }
        });
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.01
    });

    // Observe all cells and mark initially visible ones
    document.querySelectorAll('.voronoi-cell').forEach((cell, idx) => {
        cell.dataset.cellIdx = idx;
        intersectionObserver.observe(cell);

        const rect = cell.getBoundingClientRect();
        const isVisible = (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
        if (isVisible) {
            visibleCells.add(idx);
        }
    });

    // Start shared animation loop
    startSharedAnimationLoop();

    console.log('Voronoi UI updated with 3D visualizations');
}

// ==========================================
// REBUILD FROM CACHE
// ==========================================

export function rebuildVisualizationFromCache(palette, resolutionSlider) {
    if (!gl || !voronoiTexture || !palette.length) return null;

    const computeResolution = 256;
    const slicesPerRow = Math.ceil(Math.sqrt(computeResolution));
    const textureSize = slicesPerRow * computeResolution;
    const displayResolution = parseInt(resolutionSlider.value);
    const step = Math.floor(computeResolution / displayResolution);

    console.log(`Rebuilding at display resolution ${displayResolution} (step: ${step})`);

    // Use cached data if available, otherwise re-read
    let voronoiPixels;
    if (cachedVoronoiPixels) {
        voronoiPixels = cachedVoronoiPixels;
        console.log('Using cached voronoi data');
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, voronoiFramebuffer);
        voronoiPixels = new Uint8Array(textureSize * textureSize * 4);
        gl.readPixels(0, 0, textureSize, textureSize, gl.RGBA, gl.UNSIGNED_BYTE, voronoiPixels);
        cachedVoronoiPixels = voronoiPixels;
    }

    const cells = palette.map(seed => ({
        seed,
        points: []
    }));

    // Decode with new step size
    for (let ri = 0; ri < computeResolution; ri += step) {
        for (let gi = 0; gi < computeResolution; gi += step) {
            for (let bi = 0; bi < computeResolution; bi += step) {
                const sliceIdx = bi;
                const sliceY = Math.floor(sliceIdx / slicesPerRow);
                const sliceX = sliceIdx % slicesPerRow;

                const texX = sliceX * computeResolution + ri;
                const texY = sliceY * computeResolution + gi;

                const pixelIdx = (texY * textureSize + texX) * 4;
                const paletteIdx = voronoiPixels[pixelIdx];

                if (paletteIdx < cells.length) {
                    const r = ri / (computeResolution - 1);
                    const g = gi / (computeResolution - 1);
                    const b = bi / (computeResolution - 1);
                    const lab = rgb2lab(r, g, b);

                    cells[paletteIdx].points.push({
                        rgb: [r, g, b],
                        lab: lab,
                        hex: rgbToHex(r, g, b)
                    });
                }
            }
        }
    }

    voronoiCells = cells;
    console.log('Visualization rebuilt:', cells.map(c => `${c.seed.hex}: ${c.points.length} points`));
    return cells;
}
