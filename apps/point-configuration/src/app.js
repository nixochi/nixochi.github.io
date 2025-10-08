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
import { SerializationController } from './controllers/SerializationController.js';

import { CanvasView } from './views/CanvasView.js';
import { StatsView } from './views/StatsView.js';

import { SnapManager } from './rendering/snap-manager.js';
import { DebugMenu } from './ui/debug-menu.js';
import { OptionsPanel } from './ui/OptionsPanel.js';
import { ExamplesModal } from './ui/ExamplesModal.js';

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
        this.serializationController = new SerializationController(this.geometryModel, this.historyModel);

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

        // Initialize UI panels
        this.optionsPanel = new OptionsPanel(this);
        this.examplesModal = new ExamplesModal(this);
        this.debugMenu = new DebugMenu(this);

        // History buttons
        this.setupHistoryButtons();

        // Stats dropdown
        this.setupStatsDropdown();

        // Panel resize
        this.setupPanelResize();
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
            const loaded = this.serializationController.deserialize(hash);
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
            const encoded = this.serializationController.serialize();
            const newURL = `${window.location.pathname}#${encoded}`;
            window.history.replaceState(null, '', newURL);
        }, 500);
    }

    async loadConfiguration(configName) {
        const success = await this.serializationController.loadConfiguration(configName);
        if (success) {
            this.viewportController.centerOrigin();
            this.updateURL();
            this.renderStats();
        }
        return success;
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
}

// ============================================================================
// Initialize Application
// ============================================================================

const app = new Application();