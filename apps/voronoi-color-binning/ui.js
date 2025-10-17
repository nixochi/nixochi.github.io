import { rgb2lab, hexToRgb } from './color-utils.js';

// ==========================================
// STATE
// ==========================================

const paletteState = { colors: [] };
let selectedPaletteIndex = 0;

// Export getter for palette
export function getPalette() {
    return paletteState.colors;
}

// ==========================================
// URL STATE MANAGEMENT
// ==========================================

export function encodeStateToURL() {
    const params = new URLSearchParams();

    // Encode colors (hex values without #)
    if (paletteState.colors.length > 0) {
        const colors = paletteState.colors.map(c => c.hex.replace('#', '')).join(',');
        params.set('colors', colors);
    }

    // Update URL without reloading the page
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
}

export function decodeStateFromURL() {
    const params = new URLSearchParams(window.location.search);

    // Decode colors
    const colorsParam = params.get('colors');
    if (colorsParam) {
        const hexColors = colorsParam.split(',').map(c => '#' + c.toUpperCase());
        return {
            colors: hexColors,
            resolution: parseInt(params.get('resolution')) || 64
        };
    }

    return null;
}

// ==========================================
// PALETTE MANAGEMENT
// ==========================================

export function addColor(hex, onUpdate) {
    hex = hex.toUpperCase();

    // If color already exists, don't add duplicate
    if (paletteState.colors.some(c => c.hex === hex)) {
        return;
    }

    const [r, g, b] = hexToRgb(hex);
    const [L, a, bv] = rgb2lab(r, g, b);

    paletteState.colors.push({ hex, rgb: [r, g, b], lab: [L, a, bv], weight: 1.0 });

    // Update URL with new state
    encodeStateToURL();

    // Callback for updates
    if (onUpdate) onUpdate();
}

export function removeColor(hex, onUpdate) {
    paletteState.colors = paletteState.colors.filter(c => c.hex !== hex);

    // Update URL with new state
    encodeStateToURL();

    // Callback for updates
    if (onUpdate) onUpdate();
}

export function clearPalette(onUpdate) {
    paletteState.colors = [];

    // Update URL with new state
    encodeStateToURL();

    // Callback for updates
    if (onUpdate) onUpdate();
}

export function updateColorInPalette(oldHex, newHex, onUpdate) {
    const colorIndex = paletteState.colors.findIndex(c => c.hex === oldHex);
    if (colorIndex !== -1) {
        // Update the color, preserve weight
        const [r, g, b] = hexToRgb(newHex);
        const [L, a, bv] = rgb2lab(r, g, b);
        const weight = paletteState.colors[colorIndex].weight || 1.0;
        paletteState.colors[colorIndex] = { hex: newHex, rgb: [r, g, b], lab: [L, a, bv], weight };

        // Update URL with new state
        encodeStateToURL();

        // Callback for updates
        if (onUpdate) onUpdate();

        console.log(`Updated color from ${oldHex} to ${newHex}`);
    }
}

export function updateWeightInPalette(hex, weight, onUpdate) {
    const colorIndex = paletteState.colors.findIndex(c => c.hex === hex);
    if (colorIndex !== -1) {
        paletteState.colors[colorIndex].weight = weight;

        // Update URL with new state
        encodeStateToURL();

        // Callback for updates
        if (onUpdate) onUpdate();

        console.log(`Updated weight for ${hex} to ${weight}`);
    }
}

// ==========================================
// PALETTE UI
// ==========================================

export function updatePaletteUI(paletteColors) {
    // Remove all palette items except the add-color-card
    const addCard = paletteColors.querySelector('.add-color-card');
    paletteColors.innerHTML = '';
    if (addCard) {
        paletteColors.appendChild(addCard);
    }

    // Add palette items
    paletteState.colors.forEach((color, idx) => {
        const item = document.createElement('div');
        item.className = 'palette-color-item';
        if (idx === selectedPaletteIndex) {
            item.classList.add('selected');
        }
        item.innerHTML = `
            <div class="color-preview" style="background: ${color.hex};">
                <input type="color" value="${color.hex}" data-color-hex="${color.hex}" />
            </div>
            <div class="color-info">
                <div class="color-hex">${color.hex}</div>
            </div>
            <input type="number" class="weight-input" value="${color.weight}" min="0.1" max="10" step="0.1" data-color-hex="${color.hex}" style="width: 100%; padding: 4px; font-size: 11px; text-align: center; -webkit-user-select: text; -moz-user-select: text; user-select: text;" placeholder="Weight">
            <button class="btn-delete" onclick="window.removeColorFromUI('${color.hex}')">×</button>
        `;
        paletteColors.appendChild(item);
    });
}

export function selectPaletteColor(index) {
    selectedPaletteIndex = index;

    // Update UI to highlight selected palette item
    document.querySelectorAll('.palette-color-item:not(.add-color-card)').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    console.log(`Selected palette color ${index}: ${paletteState.colors[index]?.hex}`);
}

// ==========================================
// DEFAULT PALETTE
// ==========================================

export function getDefaultColors() {
    return [
        // Earths & Browns
        '#8B4513', '#A0522D', '#D2691E', '#CD853F',
        // Greens (plants, moss, forest)
        '#228B22', '#3CB371', '#556B2F', '#6B8E23',
        // Blues (sky, water)
        '#4682B4', '#5F9EA0', '#87CEEB', '#708090',
        // Grays & Stones
        '#696969', '#808080', '#A9A9A9', '#D3D3D3',
        // Warm naturals (clay, sand, ochre)
        '#DAA520', '#BDB76B', '#BC8F8F', '#F4A460'
    ];
}

export function loadDefaultPalette() {
    const defaultColors = getDefaultColors();

    defaultColors.forEach(hex => {
        const normalized = hex.toUpperCase();
        if (!paletteState.colors.some(c => c.hex === normalized)) {
            const [r, g, b] = hexToRgb(normalized);
            const [L, a, bv] = rgb2lab(r, g, b);
            paletteState.colors.push({ hex: normalized, rgb: [r, g, b], lab: [L, a, bv], weight: 1.0 });
        }
    });

    encodeStateToURL();
}
