// app.js
// Main application orchestrator (Phase 2 - MVC)

import { GeometryModel } from './models/GeometryModel.js';
import { ViewportModel } from './models/ViewportModel.js';
import { MatroidModel } from './models/MatroidModel.js';
import { HistoryModel } from './models/HistoryModel.js';

import { GeometryController } from './controllers/GeometryController.js';
import { ViewportController } from './controllers/ViewportController.js';
import { InteractionController } from './controllers/InteractionController.js';
import { UIController } from './controllers/UIController.js';

import { CanvasView } from './views/CanvasView.js';
import { StatsView } from './views/StatsView.js';

import { SnapManager } from './rendering/snap-manager.js';
import { DebugMenu } from './ui/debug-menu.js';

import pako from 'https://esm.sh/pako@2.1.0';

// ============================================================================
// Phase 2: MVC Architecture
// ============================================================================

class Application {
    constructor() {
        // Initialize Models
        this.geometryModel = new GeometryModel();
        this.viewportModel = new ViewportModel();
        this.matroidModel = new MatroidModel(this.geometryModel);
        this.historyModel = new HistoryModel(this.geometryModel);
        this.uiController = new UIController();

        // Initialize Controllers
        this.geometryController = new GeometryController(this.geometryModel, this.historyModel);
        this.viewportController = new ViewportController(this.viewportModel);
        
        this.snapManager = new SnapManager(15, 20);
        this.interactionController = new InteractionController(
            this.geometryController,
            this.viewportController,
            this.snapManager
        );

        // Initialize Views
        this.canvas = document.getElementById('canvas');
        this.canvasView = new CanvasView(this.canvas);
        this.statsView = new StatsView(document.getElementById('panelContent'));

        // Wire up event listeners
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUI();

        // Subscribe to model changes
        this.geometryModel.subscribe(() => this.render());
        this.viewportModel.subscribe(() => this.render());
        this.uiController.subscribe(() => this.render());

        // Stats view hover callbacks
        this.statsView.setHoverCallbacks(
            (points) => {
                const result = this.interactionController.showUIHighlight(points);
                if (result.needsRedraw) this.render();
            },
            () => {
                const result = this.interactionController.clearUIHighlight();
                if (result.needsRedraw) this.render();
            }
        );

        // Legacy adapter for debug menu
        this.canvasManager = this._createLegacyAdapter();
        this.debugMenu = new DebugMenu(this.canvasManager);

        // Load initial state
        this.loadStateFromURL();
        
        // Initial render
        this.render();
    }

    // ========================================================================
    // Setup
    // ========================================================================

    setupCanvas() {
        const resizeCanvas = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.viewportController.initialize(this.canvas.width, this.canvas.height);
            this.render();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const resizeObserver = new ResizeObserver(() => resizeCanvas());
        resizeObserver.observe(this.canvas.parentElement);
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Clear highlights on click outside
        document.addEventListener('click', () => {
            const result = this.interactionController.clearUIHighlight();
            this.statsView.clearItemBackgrounds();
            if (result.needsRedraw) this.render();
        });

        // Clear item backgrounds on canvas interaction
        this.canvas.addEventListener('touchstart', () => {
            this.statsView.clearItemBackgrounds();
        });

        this.canvas.addEventListener('mousedown', () => {
            this.statsView.clearItemBackgrounds();
        });

        // Stats panel scroll listener
        const panelContent = document.getElementById('panelContent');
        panelContent.addEventListener('scroll', () => {
            const scrollPercentage = (panelContent.scrollTop + panelContent.clientHeight) / panelContent.scrollHeight;
            if (scrollPercentage > 0.8) {
                const stats = this.matroidModel.getStats();
                const loaded = this.statsView.loadMore(stats);
                if (loaded) {
                    this.renderStats();
                }
            }
        });
    }

    setupUI() {
        // Mode switch
        const pointBtn = document.getElementById('pointBtn');
        const lineBtn = document.getElementById('lineBtn');
        const switchIndicator = document.getElementById('switchIndicator');

        const updateSwitchIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            switchIndicator.style.width = `${btnRect.width}px`;
            switchIndicator.style.transform = `translateX(${offset}px)`;
        };

        updateSwitchIndicator(pointBtn);

        pointBtn.addEventListener('click', () => {
            this.interactionController.setMode('point');
            pointBtn.classList.add('active');
            lineBtn.classList.remove('active');
            updateSwitchIndicator(pointBtn);
            this.canvasView.setCursor('crosshair');
            this.render();
        });

        lineBtn.addEventListener('click', () => {
            this.interactionController.setMode('line');
            lineBtn.classList.add('active');
            pointBtn.classList.remove('active');
            updateSwitchIndicator(lineBtn);
            this.canvasView.setCursor('crosshair');
            this.render();
        });

        // Options panel
        this.setupOptionsPanel();

        // History buttons
        this.setupHistoryButtons();

        // Stats dropdown
        this.setupStatsDropdown();

        // Library button
        document.getElementById('libraryBtn').addEventListener('click', () => {
            this.openExamplesModal();
        });

        // Examples modal
        this.setupExamplesModal();

        // Panel resize
        this.setupPanelResize();
    }

    setupOptionsPanel() {
        const optionsBtn = document.getElementById('optionsBtn');
        const optionsPanel = document.getElementById('optionsPanel');
        let isPanelVisible = false;

        optionsBtn.addEventListener('click', () => {
            isPanelVisible = !isPanelVisible;
            if (isPanelVisible) {
                optionsPanel.style.display = 'block';
                optionsPanel.offsetHeight;
                optionsPanel.classList.add('expanded');
                optionsBtn.textContent = 'close';
            } else {
                optionsPanel.classList.remove('expanded');
                setTimeout(() => {
                    if (!isPanelVisible) {
                        optionsPanel.style.display = 'none';
                    }
                }, 300);
                optionsBtn.textContent = 'options';
            }
        });

        // Color palette
        const monoBtn = document.getElementById('monoBtn');
        const rainbowBtn = document.getElementById('rainbowBtn');
        const pastelBtn = document.getElementById('pastelBtn');
        const paletteSwitchIndicator = document.getElementById('paletteSwitchIndicator');

        const updatePaletteSwitchIndicator = (activeBtn) => {
            const btnRect = activeBtn.getBoundingClientRect();
            const switchRect = activeBtn.parentElement.getBoundingClientRect();
            const offset = btnRect.left - switchRect.left - 2;
            paletteSwitchIndicator.style.width = `${btnRect.width}px`;
            paletteSwitchIndicator.style.transform = `translateX(${offset}px)`;
        };

        monoBtn.addEventListener('click', () => {
            this.uiController.setColorPalette('monochromatic');
            monoBtn.classList.add('active');
            rainbowBtn.classList.remove('active');
            pastelBtn.classList.remove('active');
            updatePaletteSwitchIndicator(monoBtn);
        });

        rainbowBtn.addEventListener('click', () => {
            this.uiController.setColorPalette('rainbow');
            rainbowBtn.classList.add('active');
            monoBtn.classList.remove('active');
            pastelBtn.classList.remove('active');
            updatePaletteSwitchIndicator(rainbowBtn);
        });

        pastelBtn.addEventListener('click', () => {
            this.uiController.setColorPalette('pastel');
            pastelBtn.classList.add('active');
            monoBtn.classList.remove('active');
            rainbowBtn.classList.remove('active');
            updatePaletteSwitchIndicator(pastelBtn);
        });

        // Ray opacity slider
        const rayOpacitySlider = document.getElementById('rayOpacitySlider');
        const rayOpacityValue = document.getElementById('rayOpacityValue');

        rayOpacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const percentage = Math.round(value * 100);
            rayOpacityValue.textContent = `${percentage}%`;
            this.uiController.setRayOpacity(value);
        });

        // Action buttons
        document.getElementById('cleanBtn').addEventListener('click', () => {
            this.geometryController.removeNonEssentialLines();
        });

        document.getElementById('addIntersectionsBtn').addEventListener('click', () => {
            const viewportBounds = this.viewportController.getViewportBounds();
            this.geometryController.addIntersectionPoints(viewportBounds);
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportImage();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (confirm('Clear all points and lines?')) {
                this.geometryController.clearAll();
                this.updateURL();
                this.renderStats();
            }
        });
    }

    setupHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        const updateButtons = () => {
            undoBtn.disabled = !this.historyModel.canUndo();
            redoBtn.disabled = !this.historyModel.canRedo();
            undoBtn.style.opacity = this.historyModel.canUndo() ? '1' : '0.5';
            redoBtn.style.opacity = this.historyModel.canRedo() ? '1' : '0.5';
            undoBtn.style.cursor = this.historyModel.canUndo() ? 'pointer' : 'not-allowed';
            redoBtn.style.cursor = this.historyModel.canRedo() ? 'pointer' : 'not-allowed';
        };

        undoBtn.addEventListener('click', () => {
            this.historyModel.undo();
            updateButtons();
        });

        redoBtn.addEventListener('click', () => {
            this.historyModel.redo();
            updateButtons();
        });

        // Subscribe to geometry changes to update buttons
        this.geometryModel.subscribe(() => updateButtons());

        updateButtons();
    }

    setupStatsDropdown() {
        const dropdownTrigger = document.getElementById('dropdownTrigger');
        const dropdownContent = document.getElementById('dropdownContent');
        const dropdownLabel = document.getElementById('dropdownLabel');
        const dropdownItems = dropdownContent.querySelectorAll('.dropdown-item');
        let isDropdownOpen = false;

        dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            isDropdownOpen = !isDropdownOpen;

            if (isDropdownOpen) {
                dropdownTrigger.classList.add('open');
                dropdownContent.classList.add('open');
            } else {
                dropdownTrigger.classList.remove('open');
                dropdownContent.classList.remove('open');
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdownTrigger.contains(e.target) && !dropdownContent.contains(e.target)) {
                isDropdownOpen = false;
                dropdownTrigger.classList.remove('open');
                dropdownContent.classList.remove('open');
            }
        });

        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.getAttribute('data-value');

                dropdownLabel.textContent = value;
                this.statsView.setView(value);
                this.renderStats();

                isDropdownOpen = false;
                dropdownTrigger.classList.remove('open');
                dropdownContent.classList.remove('open');
            });
        });
    }

    setupExamplesModal() {
        const examplesModal = document.getElementById('examplesModal');
        const closeModal = document.getElementById('closeModal');

        closeModal.addEventListener('click', () => this.closeExamplesModal());

        examplesModal.addEventListener('click', (e) => {
            if (e.target === examplesModal) {
                this.closeExamplesModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && examplesModal.classList.contains('active')) {
                this.closeExamplesModal();
            }
        });
    }

    setupPanelResize() {
        const statsPanel = document.getElementById('statsPanel');
        const resizeHandle = document.getElementById('resizeHandle');

        let isResizing = false;
        let startPos = 0;
        let startSize = 0;

        const isMobile = () => window.innerWidth <= 768;

        const handleResizeStart = (e) => {
            isResizing = true;
            document.body.classList.add('resizing');

            const touch = e.type.includes('touch') ? e.touches[0] : e;

            if (isMobile()) {
                startPos = touch.clientY;
                startSize = statsPanel.offsetHeight;
            } else {
                startPos = touch.clientX;
                startSize = statsPanel.offsetWidth;
            }

            e.preventDefault();
        };

        const handleResizeMove = (e) => {
            if (!isResizing) return;
            e.preventDefault();

            const touch = e.type.includes('touch') ? e.touches[0] : e;

            if (isMobile()) {
                const currentY = touch.clientY;
                const deltaY = startPos - currentY;
                const newHeight = startSize + deltaY;
                const minHeight = 150;
                const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                const maxHeight = viewportHeight * 0.8;
                const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
                statsPanel.style.height = `${clampedHeight}px`;
            } else {
                const currentX = touch.clientX;
                const deltaX = startPos - currentX;
                const newWidth = startSize + deltaX;
                const minWidth = 250;
                const maxWidth = window.innerWidth * 0.6;
                const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                statsPanel.style.width = `${clampedWidth}px`;
            }
        };

        const handleResizeEnd = () => {
            if (!isResizing) return;
            isResizing = false;
            document.body.classList.remove('resizing');
        };

        resizeHandle.addEventListener('touchstart', handleResizeStart, { passive: false });
        document.addEventListener('touchmove', handleResizeMove, { passive: false });
        document.addEventListener('touchend', handleResizeEnd);
        document.addEventListener('touchcancel', handleResizeEnd);

        resizeHandle.addEventListener('mousedown', handleResizeStart);
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }

    // ========================================================================
    // Event Handlers
    // ========================================================================

    handleMouseDown(e) {
        const coords = this._getEventCoordinates(e);
        const result = this.interactionController.handlePointerDown(
            coords.worldX,
            coords.worldY,
            coords.screenX,
            coords.screenY
        );
        this._handleInteractionResult(result);
    }

    handleMouseMove(e) {
        const coords = this._getEventCoordinates(e);
        const result = this.interactionController.handlePointerMove(
            coords.worldX,
            coords.worldY,
            coords.screenX,
            coords.screenY
        );
        this._handleInteractionResult(result);
    }

    handleMouseUp(e) {
        const coords = this._getEventCoordinates(e);
        const result = this.interactionController.handlePointerUp(
            coords.worldX,
            coords.worldY,
            coords.screenX,
            coords.screenY
        );
        this._handleInteractionResult(result);
        this.updateURL();
        this.renderStats();
    }

    handleMouseLeave(e) {
        const result = this.interactionController.handlePointerLeave();
        this._handleInteractionResult(result);
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = this.canvas.width / 2;
        const screenY = this.canvas.height / 2;
        const result = this.interactionController.handleWheel(e.deltaY, screenX, screenY);
        this._handleInteractionResult(result);
    }

    handleTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 2) {
            const gestureInfo = this._getTouchGestureInfo(e.touches);
            const result = this.interactionController.handleTwoFingerStart(
                gestureInfo.distance,
                gestureInfo.centerX,
                gestureInfo.centerY
            );
            this._handleInteractionResult(result);
        } else if (e.touches.length === 1) {
            this.handleMouseDown(e);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 2) {
            const gestureInfo = this._getTouchGestureInfo(e.touches);
            const result = this.interactionController.handleTwoFingerMove(
                gestureInfo.distance,
                gestureInfo.centerX,
                gestureInfo.centerY
            );
            this._handleInteractionResult(result);
        } else if (e.touches.length === 1) {
            this.handleMouseMove(e);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        if (this.interactionController.getState().type === 'two-finger-gesture') {
            const result = this.interactionController.handleTwoFingerEnd();
            this._handleInteractionResult(result);
        } else {
            this.handleMouseUp(e);
        }
    }

    handleTouchCancel(e) {
        e.preventDefault();
        this.handleMouseLeave(e);
    }

    handleKeyDown(e) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKey = isMac ? e.metaKey : e.ctrlKey;

        if (modifierKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.historyModel.undo();
        } else if (modifierKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.historyModel.redo();
        }
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    render() {
        // Compute visual state
        const visuals = this.interactionController.computeVisualState(
            this.geometryModel.points,
            this.geometryModel.lines,
            this.geometryModel.intersections
        );

        // Build render state
        const renderState = {
            points: this.geometryModel.points,
            lines: this.geometryModel.lines,
            intersections: this.geometryModel.intersections,
            viewportBounds: this.viewportController.getViewportBounds(),
            scale: this.viewportModel.scale,
            offsetX: this.viewportModel.offsetX,
            offsetY: this.viewportModel.offsetY,
            visuals,
            rayOpacity: this.uiController.getRayOpacity(),
            colorPalette: this.uiController.getColorPalette(),
            mode: this.interactionController.getMode()
        };

        // Render
        this.canvasView.render(renderState);
    }

    renderStats() {
        const stats = this.matroidModel.getStats();
        this.statsView.render(
            stats,
            this.geometryModel.points,
            this.geometryModel.lines
        );
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    _getEventCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const worldX = (screenX - this.viewportModel.offsetX) / this.viewportModel.scale;
        const worldY = (screenY - this.viewportModel.offsetY) / this.viewportModel.scale;

        return { worldX, worldY, screenX, screenY };
    }

    _getTouchGestureInfo(touches) {
        const rect = this.canvas.getBoundingClientRect();
        const touch1 = {
            x: touches[0].clientX - rect.left,
            y: touches[0].clientY - rect.top
        };
        const touch2 = {
            x: touches[1].clientX - rect.left,
            y: touches[1].clientY - rect.top
        };

        const distance = Math.hypot(touch2.x - touch1.x, touch2.y - touch1.y);
        const centerX = (touch1.x + touch2.x) / 2;
        const centerY = (touch1.y + touch2.y) / 2;

        return { distance, centerX, centerY };
    }

    _handleInteractionResult(result) {
        if (result.needsRedraw) {
            this.render();
        }
        if (result.cursor) {
            this.canvasView.setCursor(result.cursor);
        }
    }

    // ========================================================================
    // Configuration Management
    // ========================================================================

    loadStateFromURL() {
        const hash = window.location.hash.slice(1);
        if (hash) {
            const loaded = this.deserializeState(hash);
            if (loaded) {
                this.viewportController.centerOrigin();
                console.log('✅ Loaded configuration from URL');
                this.render();
                this.renderStats();
            }
        }
    }

    updateURL() {
        clearTimeout(this._urlUpdateTimeout);
        this._urlUpdateTimeout = setTimeout(() => {
            const encoded = this.serializeState();
            const newURL = `${window.location.pathname}#${encoded}`;
            window.history.replaceState(null, '', newURL);
        }, 500);
    }

    serializeState() {
        const precision = 1;
        const factor = Math.pow(10, precision);

        const state = {
            p: this.geometryModel.points.map(p => [
                Math.round(p.x * factor) / factor,
                Math.round(p.y * factor) / factor,
                p.onLines
            ]),
            l: this.geometryModel.lines.map(l => [
                Math.round(l.x * factor) / factor,
                Math.round(l.y * factor) / factor,
                Math.round(l.angle * 10000) / 10000
            ])
        };

        const jsonStr = JSON.stringify(state);
        const compressed = pako.deflate(jsonStr, { level: 9 });
        const base64 = btoa(String.fromCharCode.apply(null, compressed))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        console.log(`Serialized state: ${jsonStr.length} chars → ${base64.length} chars`);
        return base64;
    }

    deserializeState(encoded) {
        if (!encoded) return false;

        try {
            let base64 = encoded
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            while (base64.length % 4) {
                base64 += '=';
            }

            let jsonStr;
            try {
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decompressed = pako.inflate(bytes, { to: 'string' });
                jsonStr = decompressed;
            } catch (e) {
                jsonStr = atob(base64);
            }

            const state = JSON.parse(jsonStr);

            this.geometryModel.points = state.p.map(([x, y, onLines]) => ({
                x,
                y,
                onLines,
                isIntersection: onLines.length > 1,
                intersectionIndex: null
            }));

            this.geometryModel.lines = state.l.map(([x, y, angle]) => ({
                x,
                y,
                angle
            }));

            this.geometryModel.recomputeIntersections();
            this.historyModel.clear();

            console.log(`✅ Loaded: ${this.geometryModel.points.length} points, ${this.geometryModel.lines.length} lines`);
            return true;
        } catch (e) {
            console.error('Failed to deserialize state:', e);
            return false;
        }
    }

    async loadConfiguration(configName) {
        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

            const examples = await response.json();
            const config = examples[configName];
            if (!config) throw new Error(`Configuration '${configName}' not found`);

            this.geometryModel.points = config.points.map(([x, y, onLines]) => ({
                x,
                y,
                onLines,
                isIntersection: onLines.length > 1,
                intersectionIndex: null
            }));

            const linePoints = new Map();
            this.geometryModel.points.forEach((point, idx) => {
                point.onLines.forEach(lineIdx => {
                    if (!linePoints.has(lineIdx)) linePoints.set(lineIdx, []);
                    linePoints.get(lineIdx).push(idx);
                });
            });

            this.geometryModel.lines = [];
            linePoints.forEach((pointIndices, lineIdx) => {
                if (pointIndices.length < 2) throw new Error(`Line ${lineIdx} has < 2 points`);
                const p1 = this.geometryModel.points[pointIndices[0]];
                const p2 = this.geometryModel.points[pointIndices[1]];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                this.geometryModel.lines[lineIdx] = { x: p1.x, y: p1.y, angle };
            });

            this.geometryModel.recomputeIntersections();
            this.historyModel.clear();
            this.geometryModel.notify();

            console.log(`✅ Loaded ${config.name}`);
            this.renderStats();
            return true;
        } catch (e) {
            console.error('Failed to load configuration:', e);
            return false;
        }
    }

    exportImage() {
        this.canvas.toBlob((blob) => {
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            link.download = `point-configuration-${timestamp}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    async openExamplesModal() {
        const examplesModal = document.getElementById('examplesModal');
        const examplesGrid = document.getElementById('examplesGrid');

        examplesModal.classList.add('active');
        document.body.classList.add('modal-open');

        try {
            const response = await fetch('src/examples/examples.json');
            if (!response.ok) throw new Error('Failed to load examples');

            const examples = await response.json();
            examplesGrid.innerHTML = '';

            Object.keys(examples).forEach(key => {
                const example = examples[key];
                const card = document.createElement('div');
                card.className = 'example-card';
                card.dataset.example = key;
                card.innerHTML = `<div class="example-name">${example.name}</div>`;

                card.addEventListener('click', async () => {
                    await this.loadConfiguration(key);
                    this.viewportController.centerOrigin();
                    this.updateURL();
                    this.closeExamplesModal();
                });

                examplesGrid.appendChild(card);
            });
        } catch (e) {
            console.error('Failed to load examples:', e);
            examplesGrid.innerHTML = '<div style="color: var(--fg-secondary); text-align: center;">Failed to load examples</div>';
        }
    }

    closeExamplesModal() {
        const examplesModal = document.getElementById('examplesModal');
        examplesModal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    // ========================================================================
    // Legacy Adapter (for DebugMenu compatibility)
    // ========================================================================

    _createLegacyAdapter() {
        return {
            pointLineManager: {
                points: this.geometryModel.points,
                lines: this.geometryModel.lines,
                intersections: this.geometryModel.intersections,
                history: this.historyModel,
                onStateChange: () => {
                    this.geometryModel.notify();
                    this.renderStats();
                    this.updateURL();
                },
                addPoint: (x, y, onLines, isIntersection, intersectionIndex) => {
                    return this.geometryController.addPoint(x, y, onLines, isIntersection, intersectionIndex);
                },
                addLine: (startX, startY, endX, endY, startPointIndices, endPointIndices) => {
                    return this.geometryController.addLine(startX, startY, endX, endY, startPointIndices, endPointIndices);
                }
            },
            draw: () => this.render(),
            getMatroidStats: () => this.matroidModel.getStats(),
            canUndo: () => this.historyModel.canUndo(),
            canRedo: () => this.historyModel.canRedo()
        };
    }
}

// ============================================================================
// Initialize Application
// ============================================================================

const app = new Application();