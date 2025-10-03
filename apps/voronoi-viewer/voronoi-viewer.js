/**
 * Voronoi Diagram Viewer Web Component - Using tezcatli math
 */
class VoronoiViewer extends HTMLElement {
    static get observedAttributes() {
        return ['show-cells', 'show-edges', 'show-sites', 'show-delaunay', 'cell-opacity', 'edge-thickness', 'site-radius', 'allow-dragging', 'remove-on-right-click', 'color-palette', 'metric-p', 'metric-resolution'];
    }

    constructor() {
        super();
        console.log('🎯 VoronoiViewer constructor called');
        
        // Core components - EXACT from tezcatli
        this.diagram = null;
        this.sites = [];
        
        // Konva groups and shapes - EXACT from tezcatli
        this.mainGroup = null;
        this.sitesGroup = null;
        this.edgesGroup = null;
        this.cellsGroup = null;
        this.delaunayGroup = null;
        
        // Drag handling - EXACT from tezcatli
        this.updateTimeout = null;
        this.isDragInProgress = false;
        this.dragUpdateDelay = 10; // ms delay for updates during drag
        this.rafPending = false; // requestAnimationFrame tracking
        
        // Color palettes
        this.colorPalettes = {
            default: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'],
            warm: ['#ff6b35', '#f7931e', '#ffb700', '#c5d86d', '#ff9068', '#ff7675', '#fd79a8', '#fdcb6e', '#6c5ce7', '#a29bfe'],
            cool: ['#667eea', '#764ba2', '#6b73ff', '#9bafd9', '#3742fa', '#2f3542', '#70a1ff', '#5352ed', '#2ed573', '#1e90ff'],
            nature: ['#56ab2f', '#a8e6cf', '#7fcdcd', '#c8e6c9', '#81c784', '#aed581', '#c5e1a5', '#dcedc8', '#f1f8e9', '#e8f5e8'],
            sunset: ['#fa709a', '#fee140', '#ffa726', '#ff7043', '#ff8a65', '#ffab91', '#ffccbc', '#ffe0b2', '#fff3e0', '#fafafa'],
            ocean: ['#2196F3', '#21CBF3', '#00BCD4', '#009688', '#4FC3F7', '#29B6F6', '#03A9F4', '#0288D1', '#0277BD', '#01579B'],
            purple: ['#8b5cf6', '#a855f7', '#9333ea', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#c084fc', '#d8b4fe', '#e9d5ff'],
            mono: ['#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#374151', '#4b5563', '#111827', '#1f2937', '#e5e7eb', '#f9fafb']
        };

        // Konva objects
        this.Konva = null;
        this.stage = null;
        this.layer = null;
        
        // Resource tracking
        this._ro = null;
    }
    
    get colors() {
        const palette = this.getParameter('colorPalette', 'default');
        return this.colorPalettes[palette] || this.colorPalettes.default;
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
            " id="konvaContainer"></div>
            
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
        
        this.initialize().catch(err => {
            console.error('❌ VoronoiViewer initialization error:', err);
            this.showError(err.message || 'Unknown error occurred');
        });
        
        console.log('✅ VoronoiViewer HTML rendered successfully');
    }
    
    disconnectedCallback() {
        console.log('🔌 VoronoiViewer disconnected from DOM');
        
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        if (this.stage) {
            this.stage.destroy();
        }
        
        if (this._ro) {
            this._ro.disconnect();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`🔄 VoronoiViewer attribute changed: ${name} = ${newValue}`);
        
        if (this.Konva) {
            this.updateVisualization();
        }
    }
    
    async initialize() {
        console.log('🚀 Initializing VoronoiViewer...');
        
        // Load Konva
        await this.loadKonva();
        
        // Setup canvas
        this.setupCanvas();
        
        // Initialize with sample points - EXACT from tezcatli
        this.initializeSamplePoints();
        
        // Setup interactions
        this.setupInteractions();
        
        // Setup resize handling
        this.setupResizeObserver();
        
        // Initial render
        this.updateVisualization();
        
        console.log('✅ VoronoiViewer initialization complete');
    }
    
    async loadKonva() {
        console.log('📦 Loading Konva...');
        
        try {
            const konvaMod = await this.importFirst([
                'https://esm.sh/konva@9.2.0',
                'https://cdn.jsdelivr.net/npm/konva@9.2.0/+esm'
            ]);
            this.Konva = konvaMod.default || konvaMod;
            console.log('✅ Konva loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load Konva:', error);
            throw new Error('Failed to load Konva library');
        }
    }
    
    async importFirst(urls) {
        let lastError;
        for (const url of urls) {
            try {
                console.log(`📥 Attempting to load: ${url}`);
                return await import(/* @vite-ignore */ url);
            } catch (error) {
                lastError = error;
                console.warn(`❌ Failed to load ${url}:`, error);
            }
        }
        throw lastError || new Error('All module imports failed');
    }
    
    setupCanvas() {
        const container = this.querySelector('#konvaContainer');
        const { width, height } = this.getBoundingClientRect();
        
        console.log(`Setting up canvas with dimensions: ${width}x${height}`);
        
        // Create Konva stage
        this.stage = new this.Konva.Stage({
            container: container,
            width: width,
            height: height
        });
        
        // Create layer
        this.layer = new this.Konva.Layer();
        this.stage.add(this.layer);
        
        // Create groups - EXACT order from tezcatli
        this.mainGroup = new this.Konva.Group();
        this.cellsGroup = new this.Konva.Group();
        this.edgesGroup = new this.Konva.Group();
        this.delaunayGroup = new this.Konva.Group();
        this.sitesGroup = new this.Konva.Group();
        
        // Add groups in correct order - EXACT from tezcatli (cells behind, sites on top)
        this.mainGroup.add(this.cellsGroup);
        this.mainGroup.add(this.delaunayGroup);
        this.mainGroup.add(this.edgesGroup);
        this.mainGroup.add(this.sitesGroup);
        
        this.layer.add(this.mainGroup);
        
        console.log('🎬 Canvas setup complete');
    }
    
    setupInteractions() {
        if (!this.stage) return;
        
        // Handle clicks to add new points - EXACT from tezcatli
        this.stage.on('click tap', (e) => {
            if (e.target === this.stage) {
                const pos = this.stage.getPointerPosition();
                if (pos) {
                    this.addSite(pos.x, pos.y);
                }
            }
        });
        
        // Handle right clicks to remove points - EXACT from tezcatli
        this.stage.on('contextmenu', (e) => {
            e.evt.preventDefault();
            
            if (this.getParameter('removeOnRightClick')) {
                const pos = this.stage.getPointerPosition();
                if (pos) {
                    const nearestSite = this.findNearestSite(pos.x, pos.y, this.getParameter('siteRadius') * 2);
                    if (nearestSite) {
                        this.removeSite(nearestSite);
                    }
                }
            }
        });
        
        console.log('🎛️ Interactions setup complete');
    }
    
    setupResizeObserver() {
        const handleResize = () => {
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height || !this.stage) return;
            
            this.stage.width(width);
            this.stage.height(height);
            this.updateVisualization(); // Need to recompute Voronoi on resize
            
            console.log(`📐 VoronoiViewer resized to: ${width}x${height}`);
        };
        
        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }
    
    // EXACT initializeSamplePoints from tezcatli
    initializeSamplePoints() {
        const { width, height } = this.getBoundingClientRect();

        // Add a few sample points - EXACT positions from tezcatli
        this.sites = [
            { ...createVoronoiPoint(width * 0.3, height * 0.3, 0), colorIndex: 0 },
            { ...createVoronoiPoint(width * 0.7, height * 0.3, 1), colorIndex: 1 },
            { ...createVoronoiPoint(width * 0.5, height * 0.7, 2), colorIndex: 2 }
        ];

        console.log(`Initialized ${this.sites.length} sample points for dimensions ${width}x${height}`);
    }
    
    // Parameter handling - matching tezcatli pattern
    getParameter(name, defaultValue = null) {
        switch (name) {
            case 'showCells': return this.getAttribute('show-cells') !== 'false';
            case 'showEdges': return this.getAttribute('show-edges') !== 'false';
            case 'showSites': return this.getAttribute('show-sites') !== 'false';
            case 'showDelaunay': return this.getAttribute('show-delaunay') === 'true';
            case 'cellOpacity': return parseFloat(this.getAttribute('cell-opacity')) || 0.9;
            case 'edgeThickness': return parseFloat(this.getAttribute('edge-thickness')) || 2;
            case 'siteRadius': return parseFloat(this.getAttribute('site-radius')) || 5;
            case 'allowDragging': return this.getAttribute('allow-dragging') !== 'false';
            case 'removeOnRightClick': return this.getAttribute('remove-on-right-click') !== 'false';
            case 'colorPalette': return this.getAttribute('color-palette') || 'default';
            case 'metricP': {
                const p = this.getAttribute('metric-p');
                if (p === 'infinity') return Infinity;
                return parseFloat(p) || 2;
            }
            case 'metricResolution': return parseInt(this.getAttribute('metric-resolution')) || 200;
            case 'edgeColor': return '#333333';
            case 'siteColor': return '#000000';
            case 'delaunayColor': return '#4444FF';
            default: return defaultValue;
        }
    }
    
    // Site management - EXACT from tezcatli
    addSite(x, y) {
        const newSite = { ...createVoronoiPoint(x, y, this.sites.length), colorIndex: null };

        // Select color index based on neighbors
        newSite.colorIndex = this.selectColorIndexForNewSite(newSite);

        this.sites.push(newSite);
        this.updateVisualization();
        console.log(`Added site at (${x.toFixed(1)}, ${y.toFixed(1)}) with color index ${newSite.colorIndex}`);
    }

    selectColorIndexForNewSite(newSite) {
        if (this.sites.length === 0) {
            return 0;
        }

        // Create temporary diagram with all sites including the new one
        const { width, height } = this.getBoundingClientRect();
        const bounds = {
            left: 0,
            right: width,
            top: 0,
            bottom: height
        };

        const tempSites = [...this.sites, newSite];
        const p = this.getParameter('metricP');
        const resolution = this.getParameter('metricResolution');
        const tempDiagram = createVoronoiDiagram(tempSites, bounds, p, resolution);

        // Get Delaunay edges (which tell us which sites are neighbors)
        const delaunayEdges = this.getDelaunayEdgesFromDiagram(tempDiagram);

        // Find all neighbors of the new site via Delaunay edges
        const neighborColorIndices = new Set();
        for (const edge of delaunayEdges) {
            let neighborSiteId = null;

            // Check if this edge connects to our new site
            if (edge.site1.id === newSite.id) {
                neighborSiteId = edge.site2.id;
            } else if (edge.site2.id === newSite.id) {
                neighborSiteId = edge.site1.id;
            }

            // If this edge connects to the new site, record the neighbor's color
            if (neighborSiteId !== null) {
                const neighborSite = this.sites.find(s => s.id === neighborSiteId);
                if (neighborSite && neighborSite.colorIndex !== undefined && neighborSite.colorIndex !== null) {
                    neighborColorIndices.add(neighborSite.colorIndex);
                }
            }
        }

        console.log(`New site ${newSite.id}: Found ${neighborColorIndices.size} neighbors with colors:`, Array.from(neighborColorIndices));

        // Find available color indices
        const availableIndices = [];
        for (let i = 0; i < this.colors.length; i++) {
            if (!neighborColorIndices.has(i)) {
                availableIndices.push(i);
            }
        }

        // If there are available indices, pick one randomly
        if (availableIndices.length > 0) {
            const selected = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            console.log(`Selected color ${selected} from ${availableIndices.length} available colors`);
            return selected;
        }

        // If all indices are taken by neighbors, pick a random one
        const selected = Math.floor(Math.random() * this.colors.length);
        console.log(`All colors taken by neighbors, randomly selected ${selected}`);
        return selected;
    }

    getDelaunayEdgesFromDiagram(diagram) {
        if (!diagram) return [];

        const delaunayEdges = [];
        const edgeSet = new Set();

        // For each pair of Voronoi cells, check if they share an edge
        for (let i = 0; i < diagram.cells.length; i++) {
            for (let j = i + 1; j < diagram.cells.length; j++) {
                const cell1 = diagram.cells[i];
                const cell2 = diagram.cells[j];

                if (this.cellsShareEdge(cell1, cell2)) {
                    // Create consistent edge key (smaller id first)
                    const site1Id = cell1.site.id.toString();
                    const site2Id = cell2.site.id.toString();
                    const edgeKey = site1Id < site2Id ? `${site1Id}-${site2Id}` : `${site2Id}-${site1Id}`;

                    if (!edgeSet.has(edgeKey)) {
                        edgeSet.add(edgeKey);
                        delaunayEdges.push({
                            site1: cell1.site,
                            site2: cell2.site
                        });
                    }
                }
            }
        }

        return delaunayEdges;
    }
    
    removeSite(site) {
        const index = this.sites.findIndex(s => s.id === site.id);
        if (index !== -1) {
            this.sites.splice(index, 1);
            this.updateVisualization();
            console.log(`Removed site ${site.id}`);
        }
    }
    
    findNearestSite(x, y, maxDistance = Infinity) {
        let nearest = null;
        let minDistance = maxDistance;
        
        for (const site of this.sites) {
            const distance = Math.sqrt((x - site.x) ** 2 + (y - site.y) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = site;
            }
        }
        
        return nearest;
    }
    
    // Public methods for controls - EXACT from tezcatli
    clearAll() {
        this.sites = [];
        this.updateVisualization();
        console.log('Cleared all sites');
    }
    
    addRandomPoints(count = 5) {
        const { width, height } = this.getBoundingClientRect();
        const margin = 50;

        for (let i = 0; i < count; i++) {
            const x = margin + Math.random() * (width - 2 * margin);
            const y = margin + Math.random() * (height - 2 * margin);
            this.addSite(x, y);
        }
    }
    
    generateGrid() {
        this.clearAll();
        const { width, height } = this.getBoundingClientRect();
        const margin = 80;
        const cols = 4;
        const rows = 3;
        
        const cellWidth = (width - 2 * margin) / cols;
        const cellHeight = (height - 2 * margin) / rows;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = margin + (col + 0.5) * cellWidth;
                const y = margin + (row + 0.5) * cellHeight;
                // Add some randomness
                const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
                const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;
                this.addSite(x + jitterX, y + jitterY);
            }
        }
    }
    
    // EXACT updateVisualization from tezcatli using proper Voronoi math
    updateVisualization() {
        if (!this.mainGroup || !this.cellsGroup || !this.edgesGroup || !this.delaunayGroup || !this.sitesGroup) return;

        // Clear all groups
        this.cellsGroup.destroyChildren();
        this.edgesGroup.destroyChildren();
        this.delaunayGroup.destroyChildren();
        this.sitesGroup.destroyChildren();

        if (this.sites.length === 0) {
            this.layer.draw();
            return;
        }

        // Create Voronoi diagram using tezcatli's exact math
        const { width, height } = this.getBoundingClientRect();
        const bounds = {
            left: 0,
            right: width,
            top: 0,
            bottom: height
        };

        const p = this.getParameter('metricP');
        const resolution = this.getParameter('metricResolution');
        this.diagram = createVoronoiDiagram(this.sites, bounds, p, resolution);
        
        // Draw different elements based on parameters
        if (this.getParameter('showCells')) {
            this.drawCells();
        }
        
        if (this.getParameter('showEdges')) {
            this.drawEdges();
        }
        
        if (this.getParameter('showDelaunay')) {
            this.drawDelaunayTriangulation();
        }
        
        if (this.getParameter('showSites')) {
            this.drawSites();
        }
        
        this.layer.draw();
    }
    
    // Drawing functions - EXACT from tezcatli
    drawCells() {
        if (!this.diagram || !this.cellsGroup) return;

        const opacity = this.getParameter('cellOpacity');

        this.diagram.cells.forEach((cell, index) => {
            if (cell.vertices.length < 3) return;

            // Use colorIndex from site if available, otherwise fallback to array index
            const colorIndex = cell.site.colorIndex !== undefined && cell.site.colorIndex !== null
                ? cell.site.colorIndex
                : index;
            const color = this.colors[colorIndex % this.colors.length];

            // Create polygon for cell
            const points = [];
            cell.vertices.forEach(vertex => {
                points.push(vertex.x, vertex.y);
            });

            const polygon = new this.Konva.Line({
                points: points,
                closed: true,
                fill: color,
                opacity: opacity,
                stroke: '',
                listening: false
            });

            this.cellsGroup.add(polygon);
        });
    }
    
    drawEdges() {
        if (!this.diagram || !this.edgesGroup) return;
        
        const thickness = this.getParameter('edgeThickness');
        const color = this.getParameter('edgeColor');
        
        this.diagram.cells.forEach(cell => {
            if (cell.vertices.length < 3) return;
            
            // Draw cell boundary
            const points = [];
            cell.vertices.forEach(vertex => {
                points.push(vertex.x, vertex.y);
            });
            
            const boundary = new this.Konva.Line({
                points: points,
                closed: true,
                stroke: color,
                strokeWidth: thickness,
                fill: '',
                listening: false
            });
            
            this.edgesGroup.add(boundary);
        });
    }
    
    drawDelaunayTriangulation() {
        if (!this.diagram || !this.delaunayGroup) return;
        
        const color = this.getParameter('delaunayColor');
        const thickness = Math.max(1, this.getParameter('edgeThickness') * 0.7);
        
        // Get Delaunay edges by finding which Voronoi cells share edges
        const delaunayEdges = this.getDelaunayEdges();
        
        // Draw each Delaunay edge
        delaunayEdges.forEach(edge => {
            const line = new this.Konva.Line({
                points: [
                    edge.site1.x, edge.site1.y,
                    edge.site2.x, edge.site2.y
                ],
                stroke: color,
                strokeWidth: thickness,
                opacity: 0.7,
                dash: [5, 5],
                listening: false
            });
            
            this.delaunayGroup.add(line);
        });
    }
    
    getDelaunayEdges() {
        if (!this.diagram) return [];
        
        const delaunayEdges = [];
        const edgeSet = new Set();
        
        // For each pair of Voronoi cells, check if they share an edge
        for (let i = 0; i < this.diagram.cells.length; i++) {
            for (let j = i + 1; j < this.diagram.cells.length; j++) {
                const cell1 = this.diagram.cells[i];
                const cell2 = this.diagram.cells[j];
                
                if (this.cellsShareEdge(cell1, cell2)) {
                    // Create consistent edge key (smaller id first)
                    const site1Id = cell1.site.id.toString();
                    const site2Id = cell2.site.id.toString();
                    const edgeKey = site1Id < site2Id ? `${site1Id}-${site2Id}` : `${site2Id}-${site1Id}`;
                    
                    if (!edgeSet.has(edgeKey)) {
                        edgeSet.add(edgeKey);
                        delaunayEdges.push({
                            site1: cell1.site,
                            site2: cell2.site
                        });
                    }
                }
            }
        }
        
        return delaunayEdges;
    }
    
    cellsShareEdge(cell1, cell2) {
        const vertices1 = cell1.vertices;
        const vertices2 = cell2.vertices;
        
        if (vertices1.length < 3 || vertices2.length < 3) return false;
        
        // Count how many vertices are shared between the two cells
        let sharedVertices = 0;
        const tolerance = 1e-6;
        
        for (const v1 of vertices1) {
            for (const v2 of vertices2) {
                if (Math.abs(v1.x - v2.x) < tolerance && Math.abs(v1.y - v2.y) < tolerance) {
                    sharedVertices++;
                    if (sharedVertices >= 2) {
                        // Two shared vertices means they share an edge
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    drawSites() {
        if (!this.sitesGroup) return;
        
        const radius = this.getParameter('siteRadius');
        const color = this.getParameter('siteColor');
        
        this.sites.forEach((site, _index) => {
            const circle = new this.Konva.Circle({
                x: site.x,
                y: site.y,
                radius: radius,
                fill: color,
                stroke: '#ffffff',
                strokeWidth: 0.5,
                listening: true,
                hitStrokeWidth: 20
            });
            
            // Set up dragging if enabled
            if (this.getParameter('allowDragging')) {
                this.setupSiteDragging(circle, site);
            }
            
            this.sitesGroup.add(circle);
        });
    }
    
    // EXACT setupSiteDragging from tezcatli
    setupSiteDragging(siteShape, site) {
        siteShape.draggable(true);
        
        siteShape.on('dragstart', () => {
            this.isDragInProgress = true;
            if (this.stage) {
                this.stage.container().style.cursor = 'grabbing';
            }
            console.log('Drag started for site', site.id);
        });
        
        siteShape.on('dragmove', () => {
            if (!this.isDragInProgress) return;

            // Update site position immediately
            site.x = siteShape.x();
            site.y = siteShape.y();

            // Use requestAnimationFrame to batch updates at screen refresh rate
            if (!this.rafPending) {
                this.rafPending = true;
                requestAnimationFrame(() => {
                    this.rafPending = false;
                    if (this.isDragInProgress) {
                        this.updateVisualizationDuringDrag();
                    }
                });
            }
        });
        
        siteShape.on('dragend', () => {
            this.isDragInProgress = false;
            
            // Final update when drag ends
            site.x = siteShape.x();
            site.y = siteShape.y();
            
            // Clear any pending updates and do a final update
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
                this.updateTimeout = null;
            }
            
            this.updateVisualization();
            
            if (this.stage) {
                this.stage.container().style.cursor = 'default';
            }
            
            console.log('Drag ended for site', site.id, 'at', site.x.toFixed(1), site.y.toFixed(1));
        });
        
        // Add hover effects
        siteShape.on('mouseenter', () => {
            if (!this.isDragInProgress) {
                const radius = this.getParameter('siteRadius');
                siteShape.radius(radius * 1.2);
                if (this.stage) {
                    this.stage.container().style.cursor = 'grab';
                }
                this.layer.draw();
            }
        });
        
        siteShape.on('mouseleave', () => {
            if (!this.isDragInProgress) {
                const radius = this.getParameter('siteRadius');
                siteShape.radius(radius);
                if (this.stage) {
                    this.stage.container().style.cursor = 'default';
                }
                this.layer.draw();
            }
        });
    }
    
    scheduleVisualizationUpdate() {
        // Clear any existing timeout
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        // Schedule a new update
        this.updateTimeout = setTimeout(() => {
            if (this.isDragInProgress) {
                this.updateVisualizationDuringDrag();
            }
            this.updateTimeout = null;
        }, this.dragUpdateDelay);
    }
    
    updateVisualizationDuringDrag() {
        if (!this.mainGroup || !this.cellsGroup || !this.edgesGroup || !this.delaunayGroup) return;

        // Only update cells and edges during drag, leave sites alone to preserve dragging
        this.cellsGroup.destroyChildren();
        this.edgesGroup.destroyChildren();
        this.delaunayGroup.destroyChildren();

        if (this.sites.length === 0) {
            this.layer.draw();
            return;
        }

        // Create Voronoi diagram using tezcatli's exact math
        const { width, height } = this.getBoundingClientRect();
        const bounds = {
            left: 0,
            right: width,
            top: 0,
            bottom: height
        };

        const p = this.getParameter('metricP');
        const resolution = this.getParameter('metricResolution');
        this.diagram = createVoronoiDiagram(this.sites, bounds, p, resolution);
        
        // Draw different elements based on parameters
        if (this.getParameter('showCells')) {
            this.drawCells();
        }
        
        if (this.getParameter('showEdges')) {
            this.drawEdges();
        }
        
        if (this.getParameter('showDelaunay')) {
            this.drawDelaunayTriangulation();
        }
        
        // Don't redraw sites during drag - they're being handled by Konva's drag system
        
        this.layer.draw();
    }
    
    showError(message) {
        const error = this.querySelector('#errorMessage');
        const details = this.querySelector('#errorDetails');
        
        if (error) error.style.display = 'flex';
        if (details) details.textContent = message;
    }
}

console.log('📝 Registering voronoi-viewer...');
customElements.define('voronoi-viewer', VoronoiViewer);
console.log('✅ voronoi-viewer registered successfully!');