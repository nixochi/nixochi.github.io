const fs = require('fs');
const path = require('path');

// RGB to XYZ color space conversion
function rgbToXyz(r, g, b) {
    // Normalize to 0-1
    r = r / 255.0;
    g = g / 255.0;
    b = b / 255.0;

    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ using sRGB matrix
    const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
    const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
    const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;

    return [x, y, z];
}

function xyzToLab(x, y, z) {
    // Reference white D65
    const xn = 95.047, yn = 100.000, zn = 108.883;
    x = x / xn;
    y = y / yn;
    z = z / zn;

    // Apply LAB function
    const f = (t) => t > 0.008856 ? Math.pow(t, 1/3) : (7.787 * t + 16/116);

    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    const L = 116 * fy - 16;
    const A = 500 * (fx - fy);
    const B = 200 * (fy - fz);

    return [L, A, B];
}

function rgbToLab(r, g, b) {
    const [x, y, z] = rgbToXyz(r, g, b);
    return xyzToLab(x, y, z);
}

// Load color data
console.log('Loading w2c39.txt...');
const colorData = new Map();
const w2c39Path = path.join(__dirname, '..', 'w2c39.txt');
const w2c39Content = fs.readFileSync(w2c39Path, 'utf-8');

const lines = w2c39Content.trim().split('\n');
for (const line of lines) {
    const values = line.trim().split(/\s+/);
    const index = parseInt(values[0]);
    const probs = values.slice(1).map(v => parseFloat(v));
    colorData.set(index, probs);
}
console.log(`Loaded ${colorData.size} entries\n`);

// Load color names
const colorNames = [];
const cn39Path = path.join(__dirname, '..', 'cn39.txt');
const cn39Content = fs.readFileSync(cn39Path, 'utf-8');

for (const line of cn39Content.trim().split('\n')) {
    const trimmed = line.trim();
    if (trimmed) {
        // Remove all quotes and trailing comma
        const cleaned = trimmed.replace(/'/g, '').replace(/,$/, '');
        if (cleaned.includes('.')) {
            const name = cleaned.split('.', 2)[1];
            colorNames.push(name);
        } else {
            colorNames.push(cleaned);
        }
    }
}

console.log(`Loaded ${colorNames.length} color names\n`);

// Load test colors
const testColorsPath = path.join(__dirname, 'test_colors.txt');
const testColors = fs.readFileSync(testColorsPath, 'utf-8')
    .trim()
    .split('\n')
    .map(line => {
        const [r, g, b] = line.split(',').map(v => parseInt(v.trim()));
        return { r, g, b };
    });

console.log(`Loaded ${testColors.length} test colors\n`);

// Process each color
const results = [];

for (const { r, g, b } of testColors) {
    // Convert RGB to LAB
    const [L, A, B] = rgbToLab(r, g, b);

    // Compute LAB bin indices
    let LBin = Math.floor(L / 5);
    let ABin = Math.floor(A / 5) + 21;
    let BBin = Math.floor(B / 5) + 21;

    // Clamp to valid ranges
    LBin = Math.max(0, Math.min(19, LBin));
    ABin = Math.max(0, Math.min(41, ABin));
    BBin = Math.max(0, Math.min(41, BBin));

    // Compute index using MATLAB formula
    const index = LBin + 20 * ABin + 20 * 42 * BBin;

    // Get probabilities
    const probs = colorData.get(index);

    if (probs) {
        // Get top 3 colors
        const sorted = probs
            .map((prob, idx) => ({ prob, idx, name: colorNames[idx] }))
            .sort((a, b) => b.prob - a.prob);

        const top3 = sorted.slice(0, 3);

        results.push({
            rgb: `${r},${g},${b}`,
            lab: `${L.toFixed(2)},${A.toFixed(2)},${B.toFixed(2)}`,
            bins: `${LBin},${ABin},${BBin}`,
            index: index,
            top1: top3[0].name,
            top1_prob: (top3[0].prob * 100).toFixed(2),
            top2: top3[1].name,
            top2_prob: (top3[1].prob * 100).toFixed(2),
            top3: top3[2].name,
            top3_prob: (top3[2].prob * 100).toFixed(2)
        });
    } else {
        console.error(`No data for RGB(${r},${g},${b}) index=${index}`);
    }
}

// Write results
const outputPath = path.join(__dirname, 'results_node.txt');
const output = results.map(r =>
    `RGB(${r.rgb}) LAB(${r.lab}) bins(${r.bins}) index=${r.index} | ${r.top1}:${r.top1_prob}% ${r.top2}:${r.top2_prob}% ${r.top3}:${r.top3_prob}%`
).join('\n');

fs.writeFileSync(outputPath, output);
console.log(`Results written to ${outputPath}`);
console.log(`Processed ${results.length} colors successfully`);
