precision mediump float;
uniform sampler2D u_texture;
uniform sampler2D u_binCenters;
uniform float u_bins;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    float bins = u_bins;

    // Compute bin indices
    float rbin = min(floor(color.r * bins), bins - 1.0);
    float gbin = min(floor(color.g * bins), bins - 1.0);
    float bbin = min(floor(color.b * bins), bins - 1.0);


    // Convert 3D bin index to 1D
    float binIndex = rbin + (gbin * bins) + (bbin * bins * bins);

    // Total number of bins
    float totalBins = bins * bins * bins;

    // Lookup bin center from texture (stored as 1D texture)
    float texCoord = (binIndex + 0.5) / totalBins;
    vec3 binCenter = texture2D(u_binCenters, vec2(texCoord, 0.5)).rgb;

    gl_FragColor = vec4(binCenter, color.a);
}
