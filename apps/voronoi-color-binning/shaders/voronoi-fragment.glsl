precision highp float;
varying vec2 vUv;

uniform vec3 paletteColors[32];
uniform float paletteWeights[32];
uniform int paletteCount;
uniform int resolution;
uniform int slicesPerRow;

vec3 rgb2lab(vec3 rgb) {
    vec3 linear;
    for (int i = 0; i < 3; i++) {
        float c = rgb[i];
        linear[i] = c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
    }

    float x = linear.r * 0.4124564 + linear.g * 0.3575761 + linear.b * 0.1804375;
    float y = linear.r * 0.2126729 + linear.g * 0.7151522 + linear.b * 0.0721750;
    float z = linear.r * 0.0193339 + linear.g * 0.1191920 + linear.b * 0.9503041;

    x /= 0.95047; y /= 1.00000; z /= 1.08883;

    float fx = x > 0.008856 ? pow(x, 1.0/3.0) : (7.787 * x + 16.0/116.0);
    float fy = y > 0.008856 ? pow(y, 1.0/3.0) : (7.787 * y + 16.0/116.0);
    float fz = z > 0.008856 ? pow(z, 1.0/3.0) : (7.787 * z + 16.0/116.0);

    return vec3(116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz));
}

void main() {
    float res = float(resolution);
    float slicesPerRowF = float(slicesPerRow);

    float sliceY = floor(vUv.y * slicesPerRowF);
    float sliceX = floor(vUv.x * slicesPerRowF);
    float sliceIdx = sliceY * slicesPerRowF + sliceX;

    vec2 posInSlice = fract(vUv * slicesPerRowF);

    float b = sliceIdx / (res - 1.0);
    vec3 rgb = vec3(posInSlice.x, posInSlice.y, b);
    vec3 lab = rgb2lab(rgb);

    float minWeightedDist = 1e10;
    int nearestIdx = 0;

    for (int i = 0; i < 32; i++) {
        if (i >= paletteCount) break;
        float dist = length(lab - paletteColors[i]);
        float weightedDist = dist / paletteWeights[i];
        if (weightedDist < minWeightedDist) {
            minWeightedDist = weightedDist;
            nearestIdx = i;
        }
    }

    // Output: R = palette index (3D only, no luminance needed)
    gl_FragColor = vec4(
        float(nearestIdx) / 255.0,
        0.0,
        0.0,
        1.0
    );
}
