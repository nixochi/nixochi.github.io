// app-new.js
// NEW ARCHITECTURE - Wires everything together with proper observer pattern
// This replaces the old app.js that used core/ managers

// ============================================================================
// STATE IMPORTS (Phase 1)
// ============================================================================
import { Configuration } from './state/Configuration.js';
import { InteractionState } from './state/InteractionState.js';
import { TransformState } from './state/TransformState.js';
import { UIState } from './state/UIState.js';
import { HistoryState } from './state/HistoryState.js';

// ============================================================================
// DERIVED IMPORTS (Phase 2)
// ============================================================================
import { IntersectionsComputer } from './derived/IntersectionsComputer.js';
import { SnapPreviewComputer } from './derived/SnapPreviewComputer.js';
import { HighlightsComputer } from './derived/HighlightsComputer.js';
import { VisualOverlaysComputer } from './derived/VisualOverlaysComputer.js';
import { MatroidComputer } from './derived/MatroidComputer.js';

// ============================================================================
// VIEW IMPORTS (Phase 3)
// ============================================================================
import { CanvasView } from './view/CanvasView.js';
import { StatsView } from './view/StatsView.js';
import { DebugMenuView } from './view/DebugMenuView.js';

// ============================================================================
// CONTROLLER IMPORTS (Phase 4)
// ============================================================================
import { InteractionController } from './controller/InteractionController.js';
import { HistoryController } from './controller/HistoryController.js';
import { OperationsController } from './controller/OperationsController.js';
import { UIController } from './controller/UIController.js';

// ============================================================================
// EXISTING UTILITIES (kept as-is)
// ============================================================================
import { Renderer } from './rendering/renderer.js';

/**
 * Main Application Class
 * Creates all instances, wires observers, coordinates rendering
 */
class PointConfigurationApp {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // ========================================================================
        // STEP 1: Create all state instances
        // ========================================================================
        console.log('Creating state instances...');
        this.configuration = new Configuration();
        this.historyState = new HistoryState();
        this.interactionState = new InteractionState();
        this.transformState = new TransformState();
        this.uiState = new UIState();

        // ========================================================================
        // STEP 2: Create derived instances (pass state references)
        // ========================================================================
        console.log('Creating derived computers...');
        this.intersectionsComputer = new IntersectionsComputer(
            this.configuration
        );

        this.snapPreviewComputer = new SnapPreviewComputer(
            this.configuration,
            this.interactionState,
            this.intersectionsComputer,
            this.transformState
        );

        this.highlightsComputer = new HighlightsComputer(
            this.configuration,
            this.interactionState,
            this.uiState,
            this.snapPreviewComputer,
            this.intersectionsComputer
        );

        this.visualOverlaysComputer = new VisualOverlaysComputer(
            this.interactionState,
            this.configuration,
            this.snapPreviewComputer,
            this.intersectionsComputer,
            this.transformState
        );

        this.matroidComputer = new MatroidComputer(
            this.configuration,
            this.intersectionsComputer
        );

        // ========================================================================
        // STEP 3: Create renderer
        // ========================================================================
        console.log('Creating renderer...');
        this.renderer = new Renderer(canvas, this.ctx);

        // ========================================================================
        // STEP 4: Create view instances
        // ========================================================================
        console.log('Creating views...');
        this.canvasView = new CanvasView(
            canvas,
            this.renderer,
            this.configuration,
            this.interactionState,
            this.transformState,
            this.uiState,
            this.intersectionsComputer,
            this.highlightsComputer,
            this.visualOverlaysComputer,
            this.snapPreviewComputer
        );

        this.statsView = new StatsView(
            document.getElementById('panelContent'),
            this.matroidComputer,
            this.uiState,
            this.configuration,
            (pointIndices) => this.uiController.onStatsItemHover(pointIndices),
            () => this.uiController.onStatsItemUnhover()
        );

        // ========================================================================
        // STEP 5: Create controller instances
        // ========================================================================
        console.log('Creating controllers...');
        this.historyController = new HistoryController(
            this.historyState,
            this.configuration,
            this.intersectionsComputer
        );

        this.operationsController = new OperationsController(
            this.configuration,
            this.intersectionsComputer,
            this.transformState,
            this.historyController
        );

        this.interactionController = new InteractionController(
            canvas,
            this.configuration,
            this.interactionState,
            this.transformState,
            this.historyController,
            this.snapPreviewComputer,
            this.intersectionsComputer
        );

        this.uiController = new UIController(
            this.uiState,
            this.interactionState,
            this.historyController,
            this.operationsController,
            this.renderer
        );

        // Create debug menu view (needs to come after uiController and operationsController)
        this.debugMenuView = new DebugMenuView(
            document.getElementById('debugPanel'),
            this.configuration,
            this.intersectionsComputer,
            (x, y, onLines) => this.operationsController.addPointManual(x, y, onLines),
            (pointIndices) => this.operationsController.addLineManual(pointIndices),
            () => this.operationsController.exportConfiguration(),
            () => this.operationsController.clearAll()
        );

        // ========================================================================
        // STEP 6: Setup observers
        // ========================================================================
        console.log('Setting up observers...');
        this.setupObservers();

        // ========================================================================
        // STEP 7: Initialize canvas and load from URL
        // ========================================================================
        console.log('Initializing...');
        this.transformState.setCanvasSize(canvas.width, canvas.height);
        this.transformState.centerOrigin();
        this.loadFromURL();
        this.render();

        console.log('✅ Application initialized successfully!');
    }

    /**
     * Setup observers - wire all state change observers
     * This is THE central place where rendering is triggered
     */
    setupObservers() {
        // Configuration changes → re-render + update URL
        this.configuration.subscribe((event) => {
            this.onConfigurationChanged(event);
        });

        // Interaction state changes → re-render canvas
        this.interactionState.subscribe(() => {
            this.onInteractionStateChanged();
        });

        // Transform changes → re-render canvas
        this.transformState.subscribe(() => {
            this.onTransformStateChanged();
        });

        // UI state changes → re-render (affects both canvas and stats)
        this.uiState.subscribe(() => {
            this.onUIStateChanged();
        });

        // History state changes → update UI buttons
        this.historyState.subscribe(() => {
            this.onHistoryStateChanged();
        });
    }

    /**
     * Observer Handlers
     */

    onConfigurationChanged(event) {
        // Update URL with new configuration (debounced)
        this.updateURL();

        // Re-render everything
        this.render();

        // Update debug menu if visible
        if (this.debugMenuView.isVisible) {
            this.debugMenuView.render();
        }
    }

    onInteractionStateChanged() {
        // Re-render canvas (interaction affects overlays and highlights)
        this.canvasView.render();
    }

    onTransformStateChanged() {
        // Re-render canvas (transform affects what's visible)
        this.canvasView.render();
    }

    onUIStateChanged() {
        // Re-render both canvas and stats (UI affects both)
        this.canvasView.render();
        this.statsView.render();
    }

    onHistoryStateChanged() {
        // Update undo/redo button states
        this.uiController.updateHistoryButtons();
    }

    /**
     * Main render method
     */
    render() {
        // Render canvas
        this.canvasView.render();

        // Render stats panel
        this.statsView.render();
    }

    /**
     * Load configuration from URL hash
     */
    loadFromURL() {
        const hash = window.location.hash.slice(1); // Remove #
        if (hash) {
            try {
                const data = this.decodeFromURL(hash);
                if (data) {
                    this.configuration.deserialize(data);
                    // Clear history after loading
                    this.historyState.clear();
                    console.log('✅ Loaded configuration from URL');
                }
            } catch (e) {
                console.error('Failed to load from URL:', e);
            }
        }
    }

    /**
     * Update URL with current configuration (debounced)
     */
    updateURL() {
        // Debounce to avoid updating too frequently
        clearTimeout(this._urlUpdateTimeout);
        this._urlUpdateTimeout = setTimeout(() => {
            const data = this.configuration.serialize();
            const encoded = this.encodeForURL(data);
            window.history.replaceState(null, '', `#${encoded}`);
        }, 500);
    }

    /**
     * Encode data for URL (base64url)
     */
    encodeForURL(data) {
        try {
            const jsonStr = JSON.stringify(data);

            // Try to compress with pako if available
            if (window.pako) {
                const compressed = pako.deflate(jsonStr, { level: 9 });
                const base64 = btoa(String.fromCharCode.apply(null, compressed))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
                return base64;
            } else {
                // Fallback to uncompressed base64
                return btoa(jsonStr)
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
            }
        } catch (e) {
            console.error('Failed to encode for URL:', e);
            return '';
        }
    }

    /**
     * Decode data from URL (base64url)
     */
    decodeFromURL(encoded) {
        try {
            // Convert base64url to base64
            let base64 = encoded
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }

            // Try to decompress
            let jsonStr;
            if (window.pako) {
                try {
                    const binaryString = atob(base64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    jsonStr = pako.inflate(bytes, { to: 'string' });
                } catch (e) {
                    // Not compressed, try direct decode
                    jsonStr = atob(base64);
                }
            } else {
                jsonStr = atob(base64);
            }

            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to decode from URL:', e);
            return null;
        }
    }
}

// ============================================================================
// Initialize app
// ============================================================================
const canvas = document.getElementById('canvas');
const app = new PointConfigurationApp(canvas);

// Expose app globally for debugging
window.app = app;
