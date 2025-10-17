import { computeVoronoi, updateVoronoiUI, rebuildVisualizationFromCache } from './renderer.js';
import {
    getPalette,
    addColor,
    removeColor,
    clearPalette,
    updateColorInPalette,
    updateWeightInPalette,
    updatePaletteUI,
    selectPaletteColor,
    decodeStateFromURL,
    loadDefaultPalette
} from './ui.js';

// ==========================================
// DEBUG CONSOLE
// ==========================================

const debugPanel = document.getElementById('debugPanel');
const debugLogs = document.getElementById('debugLogs');
const debugCopy = document.getElementById('debugCopy');
const debugClear = document.getElementById('debugClear');

// Intercept console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function addDebugLog(message, type = 'log') {
    // Call original console method
    const timestamp = new Date().toLocaleTimeString();
    const logDiv = document.createElement('div');
    logDiv.className = `debug-log ${type}`;
    logDiv.textContent = `[${timestamp}] ${message}`;
    debugLogs.appendChild(logDiv);
    debugLogs.scrollTop = debugLogs.scrollHeight;
}

console.log = function(...args) {
    originalLog.apply(console, args);
    addDebugLog(args.join(' '), 'log');
};

console.error = function(...args) {
    originalError.apply(console, args);
    addDebugLog(args.join(' '), 'error');
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    addDebugLog(args.join(' '), 'warn');
};

// Toggle debug panel with 'd' key
document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
        debugPanel.classList.toggle('active');
    }
});

// Copy all logs to clipboard
debugCopy.addEventListener('click', async () => {
    const allLogs = Array.from(debugLogs.children)
        .map(log => log.textContent)
        .join('\n');

    try {
        await navigator.clipboard.writeText(allLogs);
        const originalText = debugCopy.textContent;
        debugCopy.textContent = 'Copied!';
        setTimeout(() => {
            debugCopy.textContent = originalText;
        }, 1000);
    } catch (err) {
        console.error('Failed to copy logs:', err);
        alert('Failed to copy logs to clipboard');
    }
});

// Clear logs
debugClear.addEventListener('click', () => {
    debugLogs.innerHTML = '';
});

console.log('Debug console initialized');

// ==========================================
// STATE
// ==========================================

let voronoiCells = null;
let isComputing = false;
let autoComputeEnabled = false;

// ==========================================
// DOM ELEMENTS
// ==========================================

const colorPicker = document.getElementById('colorPicker');
const colorHex = document.getElementById('colorHex');
const addColorBtn = document.getElementById('addColorBtn');
const clearBtn = document.getElementById('clearBtn');
const paletteColors = document.getElementById('paletteColors');
const resolutionSlider = document.getElementById('resolutionSlider');
const resolutionValue = document.getElementById('resolutionValue');
const voronoiGrid = document.getElementById('voronoiGrid');

// ==========================================
// COMPUTATION WRAPPER
// ==========================================

async function computeAndUpdate() {
    const palette = getPalette();
    if (palette.length === 0) return;
    if (isComputing) return;

    isComputing = true;
    voronoiCells = await computeVoronoi(palette, resolutionSlider, clearBtn);
    isComputing = false;

    if (voronoiCells) {
        updateVoronoiUI(voronoiCells, voronoiGrid);
    }
}

function handlePaletteUpdate() {
    updatePaletteUI(paletteColors);
    voronoiCells = null;

    if (autoComputeEnabled) {
        const palette = getPalette();
        if (palette.length > 0) {
            computeAndUpdate();
        } else {
            updateVoronoiUI(null, voronoiGrid);
        }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

colorPicker.addEventListener('input', () => {
    colorHex.value = colorPicker.value.toUpperCase();
});

colorHex.addEventListener('input', () => {
    const hex = colorHex.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        colorPicker.value = hex;
    }
});

addColorBtn.addEventListener('click', () => {
    const hex = colorHex.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        addColor(hex, handlePaletteUpdate);
    }
});

colorHex.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addColorBtn.click();
    }
});

clearBtn.addEventListener('click', () => {
    clearPalette(handlePaletteUpdate);
});

resolutionSlider.addEventListener('input', () => {
    const res = parseInt(resolutionSlider.value);
    resolutionValue.textContent = res;

    // Only rebuild visualization (no GPU recomputation)
    if (voronoiCells && voronoiCells.length > 0) {
        console.log(`Resolution changed to ${res}, rebuilding visualization...`);
        const palette = getPalette();
        const rebuiltCells = rebuildVisualizationFromCache(palette, resolutionSlider);
        if (rebuiltCells) {
            voronoiCells = rebuiltCells;
            updateVoronoiUI(voronoiCells, voronoiGrid);
        }
    }
});

// Make functions available globally for inline onclick handlers
window.removeColorFromUI = (hex) => {
    removeColor(hex, handlePaletteUpdate);
};

window.updateColorFromUI = (oldHex, newHex) => {
    updateColorInPalette(oldHex, newHex, handlePaletteUpdate);
};

window.updateWeightFromUI = (hex, weight) => {
    updateWeightInPalette(hex, weight, handlePaletteUpdate);
};

// ==========================================
// PALETTE UI EVENT DELEGATION
// ==========================================

// Use event delegation for dynamically created elements
paletteColors.addEventListener('click', (e) => {
    // Find the palette item that was clicked
    const paletteItem = e.target.closest('.palette-color-item:not(.add-color-card)');
    if (!paletteItem) return;

    // Don't select if clicking on input or button
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
        return;
    }

    // Get the index of the clicked item
    const items = Array.from(paletteColors.querySelectorAll('.palette-color-item:not(.add-color-card)'));
    const idx = items.indexOf(paletteItem);
    if (idx !== -1) {
        selectPaletteColor(idx);
    }
});

// Handle color picker changes
paletteColors.addEventListener('input', (e) => {
    if (e.target.type === 'color' && e.target.dataset.colorHex) {
        const oldHex = e.target.dataset.colorHex;
        const newHex = e.target.value.toUpperCase();
        updateColorInPalette(oldHex, newHex, handlePaletteUpdate);
    }
});

// Handle weight input changes
paletteColors.addEventListener('change', (e) => {
    if (e.target.classList.contains('weight-input')) {
        const hex = e.target.dataset.colorHex;
        const weight = parseFloat(e.target.value) || 1.0;
        updateWeightInPalette(hex, weight, handlePaletteUpdate);
    }
});

paletteColors.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('weight-input')) {
        const hex = e.target.dataset.colorHex;
        const weight = parseFloat(e.target.value) || 1.0;
        updateWeightInPalette(hex, weight, handlePaletteUpdate);
    }
});

// ==========================================
// INITIALIZATION
// ==========================================

// Try to restore state from URL
const urlState = decodeStateFromURL();

if (urlState) {
    // Restore from URL
    console.log('Restoring state from URL:', urlState);

    // Set resolution
    resolutionSlider.value = urlState.resolution;
    resolutionValue.textContent = urlState.resolution;

    // Add colors from URL
    urlState.colors.forEach(hex => {
        addColor(hex.toUpperCase(), null); // Don't trigger updates yet
    });

    updatePaletteUI(paletteColors);
} else {
    // Load default colors
    loadDefaultPalette();
    updatePaletteUI(paletteColors);
}

// Enable auto-compute and compute once
autoComputeEnabled = true;
computeAndUpdate();
