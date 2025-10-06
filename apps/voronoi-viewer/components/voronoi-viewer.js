/**
 * Voronoi Diagram Viewer Web Component
 * Refactored to use modular architecture
 */

import { initWebGL } from '../lib/webgl.js';
import { JFAAlgorithm } from '../algorithms/jfa/index.js';
import { setupInteractions, findSeedAt } from '../lib/interactions.js';

class VoronoiViewer extends HTMLElement {
    static get observedAttributes() {
        return ['metric-p'];
    }

    constructor() {
        super();
        console.log('🎯 VoronoiViewer constructor called');

        // State
        this.sites = [];
        this.lastRecomputeTime = 0;
        this.pendingRecompute = false;

        // Animation state
        this.isAnimating = false;
        this.animationFrameId = null;
        this.lastAnimationTime = 0;
        this.animationSpeed = 1.0;

        // WebGL objects
        this.gl = null;
        this.canvas = null;

        // Algorithm
        this.algorithm = null;

        // Parameters
        this.p = 2.0;
        this.useInf = false;
        this.showEdges = true;
        this.showSites = true;
        this.resolutionScale = 0.5;
        this.currentPaletteId = 'vibrant';

        // Interaction state
        this.interactionState = null;

        // Resource tracking
        this._ro = null;
    }

    connectedCallback() {
        console.log('🔗 VoronoiViewer connected to DOM');

        this.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
                overflow: hidden;
                background: transparent;
            ">
                <canvas id="glcanvas" style="
                    width: 100%;
                    height: 100%;
                    display: block;
                    background: transparent;
                    cursor: crosshair;
                "></canvas>
            </div>

            <div id="errorMessage" style="
                position: absolute;
                inset: 0;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #dc3545;
                text-align: center;
                background: rgba(248, 249, 250, 0.95);
                backdrop-filter: blur(4px);
                border-radius: 8px;
                padding: 20px;
            ">
                <div style="font-size: 32px;">⚠️</div>
                <div style="font-size: 14px; font-weight: 500;">Failed to load Voronoi viewer</div>
                <div id="errorDetails" style="font-size: 12px; opacity: 0.8;"></div>
            </div>
        `;

        this.canvas = this.querySelector('#glcanvas');

        this.initialize().catch(err => {
            console.error('❌ VoronoiViewer initialization error:', err);
            this.showError(err.message || 'Unknown error occurred');
        });

        // Setup page visibility handler to pause/resume animation
        this.setupVisibilityHandler();

        console.log('✅ VoronoiViewer HTML rendered successfully');
    }

    disconnectedCallback() {
        console.log('🔌 VoronoiViewer disconnected from DOM');

        // Stop animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isAnimating = false;

        this.cleanup();

        if (this._ro) {
            this._ro.disconnect();
        }

        // Remove visibility handler
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
        }
    }

    attributeChangedCallback(name, _oldValue, newValue) {
        console.log(`🔄 VoronoiViewer attribute changed: ${name} = ${newValue}`);

        if (name === 'metric-p') {
            if (newValue === 'infinity') {
                this.p = 2.0;
                this.useInf = true;
            } else {
                this.p = parseFloat(newValue) || 2.0;
                this.useInf = false;
            }
            if (this.gl) this.recompute();
        }
    }

    async initialize() {
        console.log('🚀 Initializing VoronoiViewer...');

        // Setup canvas size
        const { width, height } = this.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(width * dpr * this.resolutionScale);
        this.canvas.height = Math.floor(height * dpr * this.resolutionScale);

        // Initialize WebGL
        this.gl = initWebGL(this.canvas);

        // Initialize algorithm
        this.algorithm = new JFAAlgorithm(this.gl, this.canvas);

        // Setup interactions
        this.setupInteractions();

        // Setup resize handling
        this.setupResizeObserver();

        // Add 3 initial points
        this.addRandomPoints(3);

        // Initial render
        this.recompute();

        console.log('✅ VoronoiViewer initialization complete');
    }

    setupInteractions() {
        this.interactionState = setupInteractions(this.canvas, {
            onDragStart: (x, y) => {
                return findSeedAt(this.sites, x, y);
            },
            onDragMove: (index, x, y) => {
                this.sites[index].x = x;
                this.sites[index].y = y;
                this.throttledRecompute();
            },
            onDragEnd: () => {
                // Nothing to do
            },
            onAddSite: (x, y) => {
                const existing = findSeedAt(this.sites, x, y);
                if (existing < 0) {
                    const newSite = { x, y };
                    // Initialize velocity if animation is active
                    if (this.isAnimating) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 20 + Math.random() * 30; // Screen pixels per second
                        // Scale velocity by resolution so it moves at constant screen speed
                        newSite.vx = Math.cos(angle) * speed * this.resolutionScale;
                        newSite.vy = Math.sin(angle) * speed * this.resolutionScale;
                    }
                    this.sites.push(newSite);
                    this.recompute();
                }
            }
        });
    }

    setupResizeObserver() {
        const handleResize = () => {
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height || !this.gl) return;

            const dpr = window.devicePixelRatio || 1;
            const W = Math.floor(width * dpr * this.resolutionScale);
            const H = Math.floor(height * dpr * this.resolutionScale);

            if (this.canvas.width === W && this.canvas.height === H) return;

            this.canvas.width = W;
            this.canvas.height = H;

            // Resize algorithm resources
            this.algorithm.resize(W, H);

            this.recompute();

            console.log(`📐 VoronoiViewer resized to: ${W}x${H}`);
        };

        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }

    throttledRecompute() {
        const now = performance.now();
        const timeSinceLastRecompute = now - this.lastRecomputeTime;
        const isDragging = this.interactionState?.getIsDragging();
        // 30fps during drag for smoother interaction
        const minInterval = isDragging ? 1000 / 30 : 1000 / 60;

        if (timeSinceLastRecompute >= minInterval) {
            this.lastRecomputeTime = now;
            this.recompute();
            this.pendingRecompute = false;
        } else if (!this.pendingRecompute) {
            this.pendingRecompute = true;
            setTimeout(() => {
                this.pendingRecompute = false;
                this.lastRecomputeTime = performance.now();
                this.recompute();
            }, minInterval - timeSinceLastRecompute);
        }
    }

    recompute() {
        if (!this.gl || !this.algorithm) return;

        if (this.sites.length === 0) {
            // Clear the screen when there are no sites
            this.clearScreen();
        } else {
            // Run algorithm computation
            this.algorithm.compute(this.sites, this.p, this.useInf);

            // Render final output
            this.algorithm.render(this.showEdges, this.showSites, this.p, this.useInf, this.resolutionScale);
        }
    }

    clearScreen() {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0.05, 0.06, 0.07, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Public methods for controls
    clearAll() {
        this.sites = [];
        this.recompute();
        console.log('Cleared all sites');
    }

    addRandomPoints(count = 5) {
        const W = this.canvas.width;
        const H = this.canvas.height;
        const margin = 50;

        for (let i = 0; i < count; i++) {
            const x = margin + Math.random() * (W - 2 * margin);
            const y = margin + Math.random() * (H - 2 * margin);
            const newSite = { x, y };

            // Initialize velocity if animation is active
            if (this.isAnimating) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 20 + Math.random() * 30; // Screen pixels per second
                // Scale velocity by resolution so it moves at constant screen speed
                newSite.vx = Math.cos(angle) * speed * this.resolutionScale;
                newSite.vy = Math.sin(angle) * speed * this.resolutionScale;
            }

            this.sites.push(newSite);
        }
        this.recompute();
    }

    generateGrid() {
        this.sites = [];
        const W = this.canvas.width;
        const H = this.canvas.height;
        const margin = 80;
        const cols = 4;
        const rows = 3;

        const cellWidth = (W - 2 * margin) / cols;
        const cellHeight = (H - 2 * margin) / rows;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = margin + (col + 0.5) * cellWidth;
                const y = margin + (row + 0.5) * cellHeight;
                const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
                const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;
                const newSite = { x: x + jitterX, y: y + jitterY };

                // Initialize velocity if animation is active
                if (this.isAnimating) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 20 + Math.random() * 30; // Screen pixels per second
                    // Scale velocity by resolution so it moves at constant screen speed
                    newSite.vx = Math.cos(angle) * speed * this.resolutionScale;
                    newSite.vy = Math.sin(angle) * speed * this.resolutionScale;
                }

                this.sites.push(newSite);
            }
        }
        this.recompute();
    }

    setShowEdges(show) {
        this.showEdges = show;
        this.algorithm.render(this.showEdges, this.showSites, this.p, this.useInf, this.resolutionScale);
    }

    setShowSites(show) {
        this.showSites = show;
        this.algorithm.render(this.showEdges, this.showSites, this.p, this.useInf, this.resolutionScale);
    }

    setResolutionScale(scale) {
        // Validate scale (0.25x, 0.5x, 0.75x, or 1x)
        if (scale !== 0.25 && scale !== 0.5 && scale !== 0.75 && scale !== 1.0) {
            console.warn('Invalid resolution scale. Must be 0.25, 0.5, 0.75, or 1.0');
            return;
        }

        // Save old canvas dimensions and resolution scale
        const oldW = this.canvas.width;
        const oldH = this.canvas.height;
        const oldScale = this.resolutionScale;

        this.resolutionScale = scale;

        // Recreate canvas and textures with new resolution
        const { width, height } = this.getBoundingClientRect();
        if (!width || !height || !this.gl) return;

        const dpr = window.devicePixelRatio || 1;
        const W = Math.floor(width * dpr * this.resolutionScale);
        const H = Math.floor(height * dpr * this.resolutionScale);

        this.canvas.width = W;
        this.canvas.height = H;

        // Scale all site positions to maintain relative position
        const scaleX = W / oldW;
        const scaleY = H / oldH;
        const velocityScale = this.resolutionScale / oldScale;

        this.sites.forEach(site => {
            site.x *= scaleX;
            site.y *= scaleY;
            // Scale velocities to maintain constant screen speed
            if (site.vx !== undefined) {
                site.vx *= velocityScale;
                site.vy *= velocityScale;
            }
        });

        // Resize algorithm resources
        this.algorithm.resize(W, H);

        this.recompute();

        console.log(`📐 Resolution scale changed to ${scale}x (${W}x${H})`);
    }

    setJFAExtraPasses(passes) {
        // Validate passes (0-4)
        if (passes < 0 || passes > 4) {
            console.warn('Invalid extra passes. Must be 0-4');
            return;
        }

        this.algorithm.setExtraPasses(passes);
        this.recompute();
        console.log(`🔧 JFA extra passes set to ${passes}`);
    }

    setPalette(paletteId) {
        this.currentPaletteId = paletteId;
        this.algorithm.setPalette(paletteId);
        this.algorithm.render(this.showEdges, this.showSites, this.p, this.useInf, this.resolutionScale);
        console.log(`🎨 Palette changed to ${paletteId}`);
    }

    setAnimation(enabled) {
        this.isAnimating = enabled;

        if (this.isAnimating) {
            // Initialize velocities for each point
            this.sites.forEach(site => {
                const angle = Math.random() * Math.PI * 2;
                const speed = 20 + Math.random() * 30; // Screen pixels per second
                // Scale velocity by resolution so it moves at constant screen speed
                site.vx = Math.cos(angle) * speed * this.resolutionScale;
                site.vy = Math.sin(angle) * speed * this.resolutionScale;
            });

            this.lastAnimationTime = performance.now();
            this.animationLoop();
        } else {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
    }

    animationLoop() {
        if (!this.isAnimating) return;

        const now = performance.now();
        const deltaTime = (now - this.lastAnimationTime) / 1000;
        this.lastAnimationTime = now;

        // Cap delta time to prevent huge jumps when tab becomes visible again
        const cappedDeltaTime = Math.min(deltaTime, 0.1); // Max 100ms jump

        // 60fps = ~16.67ms per frame
        if (cappedDeltaTime >= 1 / 60) {
            const W = this.canvas.width;
            const H = this.canvas.height;
            const margin = 10;

            this.sites.forEach(site => {
                // Update position with speed multiplier
                site.x += site.vx * cappedDeltaTime * this.animationSpeed;
                site.y += site.vy * cappedDeltaTime * this.animationSpeed;

                // Bounce off edges
                if (site.x <= margin) {
                    site.x = margin;
                    site.vx = Math.abs(site.vx);
                } else if (site.x >= W - margin) {
                    site.x = W - margin;
                    site.vx = -Math.abs(site.vx);
                }

                if (site.y <= margin) {
                    site.y = margin;
                    site.vy = Math.abs(site.vy);
                } else if (site.y >= H - margin) {
                    site.y = H - margin;
                    site.vy = -Math.abs(site.vy);
                }
            });

            this.recompute();
        }

        this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
    }

    setupVisibilityHandler() {
        this._visibilityHandler = () => {
            if (document.hidden) {
                // Tab is hidden - pause animation
                if (this.isAnimating && this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
            } else {
                // Tab is visible - resume animation
                if (this.isAnimating && !this.animationFrameId) {
                    // Reset time to prevent large delta
                    this.lastAnimationTime = performance.now();
                    this.animationLoop();
                }
            }
        };

        document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    showError(message) {
        const error = this.querySelector('#errorMessage');
        const details = this.querySelector('#errorDetails');

        if (error) error.style.display = 'flex';
        if (details) details.textContent = message;
    }

    cleanup() {
        if (this.algorithm) {
            this.algorithm.cleanup();
        }
    }
}

console.log('📝 Registering voronoi-viewer...');
customElements.define('voronoi-viewer', VoronoiViewer);
console.log('✅ voronoi-viewer registered successfully!');
