# BCC Lattice - GPU Shader Version

This is a high-performance shader-based implementation of the BCC lattice visualization.

## Key Differences from CPU Version

### CPU Version (scrapbook/craft)
- Colors calculated in JavaScript for each point
- Updates ~650k color values per frame
- Heavy CPU usage
- Buffer transfers to GPU every frame

### GPU Shader Version (this folder)
- **Instanced rendering** - single draw call for all 650k points
- Colors calculated in parallel on GPU
- Only updates 1 uniform value (`time`) per frame
- Minimal CPU usage
- No buffer transfers

## Performance Benefits

For a size 70 world (~650k points):
- **CPU version**: Updates 650,000 × 3 = ~2 million float values per frame
- **Shader version**: Updates 1 float value per frame
- **Instanced rendering**: Single draw call instead of 650k draw calls

**Result**: ~2,000,000x less data transfer + massive reduction in draw call overhead!

## How It Works

The fragment shader calculates color for each point based on:
- Point position (passed from vertex shader)
- Time uniform (updated each frame)
- Distance from origin

```glsl
float dist = length(vPosition);
float value = sin(uTime + dist * 0.1);
value = (value + 1.0) / 2.0; // Map to [0,1]
vec3 color = vec3(1.0 - value, 0.0, value); // Red to Blue
```

## Usage

Simply open `index.html` in a browser. The lattice will animate automatically with GPU-accelerated color calculation.

## Customizing the Color Function

Edit the fragment shader in `world.js` to change how colors are calculated. The shader has access to:
- `vPosition` - The (x, y, z) position of each point
- `uTime` - Current time value

Examples:
```glsl
// Simple time-based pulse
float value = (sin(uTime) + 1.0) / 2.0;

// Y-axis gradient
float value = (vPosition.y + 70.0) / 140.0;

// Spherical waves
float dist = length(vPosition);
float value = (sin(dist - uTime * 2.0) + 1.0) / 2.0;
```
