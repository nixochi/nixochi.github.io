/**
 * Palette generation utilities
 */

export const PALETTE_SIZE = 4096;

// HSV to RGB conversion
function hsvToRgb(h, s, v) {
    // Wrap hue to [0, 1]
    h = ((h % 1) + 1) % 1;
    const a = h * 6;
    const c = v * s;
    const x = c * (1 - Math.abs((a % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (a < 1) { r = c; g = x; b = 0; }
    else if (a < 2) { r = x; g = c; b = 0; }
    else if (a < 3) { r = 0; g = c; b = x; }
    else if (a < 4) { r = 0; g = x; b = c; }
    else if (a < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const m = v - c;
    r = (r + m); g = (g + m); b = (b + m);
    return {
        r: Math.round(Math.min(1, Math.max(0, r)) * 255),
        g: Math.round(Math.min(1, Math.max(0, g)) * 255),
        b: Math.round(Math.min(1, Math.max(0, b)) * 255)
    };
}

// Helper to convert hex to RGB
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// Helper to interpolate between colors in an array
function interpolateColors(colorArray, t) {
    const scaledT = t * (colorArray.length - 1);
    const index = Math.floor(scaledT);
    const nextIndex = Math.min(index + 1, colorArray.length - 1);
    const localT = scaledT - index;

    const c1 = hexToRgb(colorArray[index]);
    const c2 = hexToRgb(colorArray[nextIndex]);

    return {
        r: Math.round(c1.r + (c2.r - c1.r) * localT),
        g: Math.round(c1.g + (c2.g - c1.g) * localT),
        b: Math.round(c1.b + (c2.b - c1.b) * localT)
    };
}

export const PALETTES = [
    {
        id: 'vibrant',
        name: 'Vibrant',
        colors: ['#dc143c', '#1e90ff', '#ffd700', '#32cd32', '#ff8c00'],
        baseColors: ['#dc143c', '#1e90ff', '#ffd700', '#32cd32', '#ff8c00', '#9370db', '#dc143c'],
        edgeColor: [0.1, 0.1, 0.1],
        generator: (i, palette) => {
            const t = (i * 0.61803398875) % 1;
            return interpolateColors(palette.baseColors, t);
        }
    },
    {
        id: 'xochi',
        name: 'Xochi',
        colors: ['#1a1d23', '#2d1b3d', '#1e3a3a', '#3d2d4a', '#4b5563'],
        baseColors: ['#0f1115', '#1a1d23', '#2d1b3d', '#1e2833', '#1e3a3a', '#2d3340', '#3d2d4a', '#374151', '#4b5563', '#3d2d4a', '#1e3a3a', '#2d1b3d', '#1a1d23'],
        edgeColor: [0.3, 0.25, 0.35],
        generator: (i, palette) => {
            const t = (i * 0.61803398875) % 1;
            return interpolateColors(palette.baseColors, t);
        }
    },
    {
        id: 'metallic',
        name: 'Metallic',
        colors: ['#3a3a3a', '#4a4a2a', '#2f2f2f', '#3d3d2d', '#454545'],
        baseColors: ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a2a', '#3d3d2d', '#2f2f2f', '#454545', '#3a3a3a', '#2a2a2a', '#1a1a1a'],
        edgeColor: [0.6, 0.6, 0.6],
        generator: (i, palette) => {
            const t = (i * 0.61803398875) % 1;
            return interpolateColors(palette.baseColors, t);
        }
    },
    {
        id: 'greyscale',
        name: 'Greyscale',
        colors: ['#0a0a0a', '#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a'],
        baseColors: ['#050505', '#0a0a0a', '#141414', '#1f1f1f', '#292929', '#333333', '#3d3d3d', '#474747', '#525252', '#5c5c5c'],
        edgeColor: [0.75, 0.75, 0.75],
        generator: (i, palette) => {
            const t = (i * 0.61803398875) % 1;
            return interpolateColors(palette.baseColors, t);
        }
    },
    {
        id: 'ocean',
        name: 'Ocean',
        colors: ['#06d6a0', '#118ab2', '#073b4c', '#05668d', '#028090'],
        baseColors: ['#06d6a0', '#118ab2', '#073b4c', '#05668d', '#028090', '#00a896', '#06d6a0'],
        edgeColor: [0.02, 0.15, 0.2],
        generator: (i, palette) => {
            const t = (i * 0.61803398875) % 1;
            return interpolateColors(palette.baseColors, t);
        }
    },
    {
        id: 'forest',
        name: 'Forest',
        colors: ['#2d6a4f', '#52b788', '#95d5b2', '#d8f3dc', '#b7e4c7'],
        baseColors: ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc', '#95d5b2', '#52b788', '#2d6a4f'],
        edgeColor: [0.08, 0.2, 0.15],
        generator: (i, palette) => {
            const t = (i * 0.61803398875) % 1;
            return interpolateColors(palette.baseColors, t);
        }
    }
];

/**
 * Create a color palette texture
 */
export function createPaletteTexture(gl, paletteId = 'golden') {
    const palette = PALETTES.find(p => p.id === paletteId) || PALETTES[0];

    const paletteTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, paletteTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const pal = new Uint8Array(PALETTE_SIZE * 4);
    for (let i = 0; i < PALETTE_SIZE; i++) {
        const rgb = palette.generator(i, palette);
        pal[i * 4 + 0] = rgb.r;
        pal[i * 4 + 1] = rgb.g;
        pal[i * 4 + 2] = rgb.b;
        pal[i * 4 + 3] = 255;
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PALETTE_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pal);

    return paletteTex;
}
