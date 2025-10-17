// ==========================================
// COLOR SPACE CONVERSION UTILITIES
// ==========================================

export function rgb2lab(r, g, b) {
    const toLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    let lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);

    let x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
    let y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
    let z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

    const ref = [0.95047, 1.00000, 1.08883];
    x /= ref[0]; y /= ref[1]; z /= ref[2];
    const f = (t) => t > 0.008856 ? Math.pow(t, 1/3) : 7.787 * t + 16/116;
    const fx = f(x), fy = f(y), fz = f(z);
    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bv = 200 * (fy - fz);

    return [L, a, bv];
}

export function hexToRgb(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return [r, g, b];
}

export function rgbToHex(r, g, b) {
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function labDistance(lab1, lab2) {
    const dL = lab1[0] - lab2[0];
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
}
