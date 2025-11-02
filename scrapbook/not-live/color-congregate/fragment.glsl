precision mediump float;
uniform sampler2D u_texture;
uniform sampler2D u_palette;
varying vec2 v_texCoord;

// Convert sRGB to linear RGB
vec3 srgbToLinear(vec3 srgb) {
    vec3 linear;
    for (int i = 0; i < 3; i++) {
        if (srgb[i] > 0.04045) {
            linear[i] = pow((srgb[i] + 0.055) / 1.055, 2.4);
        } else {
            linear[i] = srgb[i] / 12.92;
        }
    }
    return linear * 100.0;
}

// Convert linear RGB to XYZ
vec3 rgbToXyz(vec3 rgb) {
    float x = rgb.r * 0.4124 + rgb.g * 0.3576 + rgb.b * 0.1805;
    float y = rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
    float z = rgb.r * 0.0193 + rgb.g * 0.1192 + rgb.b * 0.9505;

    // Normalize by D65 illuminant
    return vec3(x / 95.047, y / 100.0, z / 108.883);
}

// XYZ to LAB helper function
float xyzToLabHelper(float t) {
    if (t > 0.008856) {
        return pow(t, 1.0 / 3.0);
    } else {
        return (7.787 * t) + (16.0 / 116.0);
    }
}

// Convert XYZ to LAB
vec3 xyzToLab(vec3 xyz) {
    float fx = xyzToLabHelper(xyz.x);
    float fy = xyzToLabHelper(xyz.y);
    float fz = xyzToLabHelper(xyz.z);

    float l = (116.0 * fy) - 16.0;
    float a = 500.0 * (fx - fy);
    float b = 200.0 * (fy - fz);

    return vec3(l, a, b);
}

// Convert RGB to LAB
vec3 rgbToLab(vec3 rgb) {
    vec3 linear = srgbToLinear(rgb);
    vec3 xyz = rgbToXyz(linear);
    return xyzToLab(xyz);
}

// Delta E (CIE76) - Euclidean distance in LAB space
float deltaE(vec3 lab1, vec3 lab2) {
    vec3 diff = lab1 - lab2;
    return dot(diff, diff); // squared distance is sufficient for comparison
}

void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    vec3 colorLab = rgbToLab(color.rgb);

    // Find the closest color from the 15 predefined colors
    float minDistance = 999999.0;
    vec3 closestColor = color.rgb;

    // Loop through exactly 15 colors
    for (float i = 0.0; i < 15.0; i++) {
        float texCoord = (i + 0.5) / 15.0;
        vec3 paletteColor = texture2D(u_palette, vec2(texCoord, 0.5)).rgb;
        vec3 paletteLab = rgbToLab(paletteColor);

        float distance = deltaE(colorLab, paletteLab);

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = paletteColor;
        }
    }

    gl_FragColor = vec4(closestColor, color.a);
}
