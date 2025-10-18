#!/usr/bin/env python3
"""
Build a 3D texture (lookup table) that maps each RGB value to the RGB of its dominant color name.
For each input RGB, we find the color name with highest probability and output that color's representative RGB.
"""

import numpy as np
import sys
import os

def rgb_to_xyz(r, g, b):
    """Convert RGB (0-255) to XYZ color space"""
    r, g, b = r/255.0, g/255.0, b/255.0
    r = ((r + 0.055) / 1.055) ** 2.4 if r > 0.04045 else r / 12.92
    g = ((g + 0.055) / 1.055) ** 2.4 if g > 0.04045 else g / 12.92
    b = ((b + 0.055) / 1.055) ** 2.4 if b > 0.04045 else b / 12.92
    x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100
    y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100
    z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100
    return x, y, z

def xyz_to_lab(x, y, z):
    """Convert XYZ to LAB color space"""
    xn, yn, zn = 95.047, 100.000, 108.883
    x, y, z = x/xn, y/yn, z/zn
    f = lambda t: t ** (1/3) if t > 0.008856 else (7.787 * t + 16/116)
    fx, fy, fz = f(x), f(y), f(z)
    L = 116 * fy - 16
    A = 500 * (fx - fy)
    B = 200 * (fy - fz)
    return L, A, B

def rgb_to_lab(r, g, b):
    """Convert RGB (0-255) to LAB color space"""
    x, y, z = rgb_to_xyz(r, g, b)
    return xyz_to_lab(x, y, z)

# Define the 39 color names and their representative RGB values
# These are standard/representative colors for each name
COLOR_RGB_VALUES = {
    'black': (0, 0, 0),
    'brown': (139, 69, 19),
    'blue': (0, 0, 255),
    'grey': (128, 128, 128),
    'green': (0, 255, 0),
    'orange': (255, 165, 0),
    'pink': (255, 192, 203),
    'purple': (128, 0, 128),
    'red': (255, 0, 0),
    'white': (255, 255, 255),
    'yellow': (255, 255, 0),
    'turquoise': (64, 224, 208),
    'olive green': (85, 107, 47),
    'mint green': (152, 255, 152),
    'maroon': (128, 0, 0),
    'lavender': (230, 230, 250),
    'magenta': (255, 0, 255),
    'salmon': (250, 128, 114),
    'cyan': (0, 255, 255),
    'rose': (255, 0, 127),
    'dark green': (0, 100, 0),
    'pale yellow': (255, 255, 153),
    'beige': (245, 245, 220),
    'lilac': (200, 162, 200),
    'olive': (128, 128, 0),
    'fuchsia': (255, 0, 255),
    'mustard': (255, 219, 88),
    'mauve': (224, 176, 255),
    'dark purple': (48, 25, 52),
    'ochre': (204, 119, 34),
    'light blue': (173, 216, 230),
    'lime green': (50, 205, 50),
    'light green': (144, 238, 144),
    'peach': (255, 229, 180),
    'teal': (0, 128, 128),
    'violet': (143, 0, 255),
    'dark purple': (48, 25, 52),  # duplicate in original
    'burgundy': (128, 0, 32),
    'tan': (210, 180, 140)
}

print("Loading color data...")
# Load w2c39.txt
color_data = {}
with open('../color-matrices/generation/w2c39.txt', 'r') as f:
    for line in f:
        values = line.strip().split()
        index = int(values[0])
        probs = np.array([float(v) for v in values[1:]])
        color_data[index] = probs

print(f"Loaded {len(color_data)} LAB bin entries")

# Load color names
color_names = []
with open('../color-matrices/39/cn39.txt', 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            line = line.strip("',")
            if '.' in line:
                name = line.split('.', 1)[1]
                color_names.append(name)
            else:
                color_names.append(line)

print(f"Loaded {len(color_names)} color names")
print(f"Color names: {color_names[:10]}...")

# Create RGB lookup array for color names
color_rgb_array = np.zeros((len(color_names), 3), dtype=np.uint8)
for i, name in enumerate(color_names):
    if name in COLOR_RGB_VALUES:
        color_rgb_array[i] = COLOR_RGB_VALUES[name]
    else:
        print(f"Warning: No RGB value defined for '{name}', using black")
        color_rgb_array[i] = (0, 0, 0)

print(f"\nBuilding 256x256x256 texture...")
print("This will process 16,777,216 RGB values...")

# Create the texture: 256x256x256x3 (RGB for each possible RGB input)
texture = np.zeros((256, 256, 256, 3), dtype=np.uint8)

# Process in batches to show progress
batch_size = 16  # Process 16 R values at a time
for r_batch in range(0, 256, batch_size):
    r_end = min(r_batch + batch_size, 256)

    for r in range(r_batch, r_end):
        for g in range(256):
            for b in range(256):
                # Convert to LAB
                L, A, B = rgb_to_lab(r, g, b)

                # Compute LAB bin indices
                L_bin = int(L // 5)
                A_bin = int(A // 5) + 21
                B_bin = int(B // 5) + 21

                # Clamp to valid ranges
                L_bin = max(0, min(19, L_bin))
                A_bin = max(0, min(41, A_bin))
                B_bin = max(0, min(41, B_bin))

                # Compute index
                index = L_bin + 20 * A_bin + 20 * 42 * B_bin

                # Get probabilities
                if index in color_data:
                    probs = color_data[index]

                    # Find color with highest probability
                    max_idx = np.argmax(probs)

                    # Set texture to the representative RGB of that color
                    texture[r, g, b] = color_rgb_array[max_idx]
                else:
                    # Fallback to input color if no data
                    texture[r, g, b] = [r, g, b]

    progress = ((r_end) / 256) * 100
    print(f"Progress: {progress:.1f}% (R={r_batch}-{r_end-1})")

print("\nSaving texture...")

# Save as numpy binary (efficient for later use)
np.save('39extended/color_texture_256.npy', texture)
print(f"Saved as '39extended/color_texture_256.npy' ({texture.nbytes / (1024**2):.1f} MB)")

# Also save a smaller preview (every 4th value = 64x64x64)
texture_small = texture[::4, ::4, ::4]
np.save('39extended/color_texture_64.npy', texture_small)
print(f"Saved downsampled as '39extended/color_texture_64.npy' ({texture_small.nbytes / (1024**2):.1f} MB)")

# Generate texture atlas - all 256 R-slices in a 16x16 grid
try:
    from PIL import Image

    print("\nGenerating texture atlas (16x16 grid of 256 slices)...")

    # Atlas will be 16x16 grid of 256x256 slices = 4096x4096 pixels
    atlas_size = 16  # 16x16 grid = 256 slices
    slice_size = 256
    atlas_width = atlas_size * slice_size
    atlas_height = atlas_size * slice_size

    atlas = np.zeros((atlas_height, atlas_width, 3), dtype=np.uint8)

    for r in range(256):
        # Calculate position in 16x16 grid
        grid_x = r % atlas_size
        grid_y = r // atlas_size

        # Calculate pixel position
        x_offset = grid_x * slice_size
        y_offset = grid_y * slice_size

        # Copy the R-slice (G-B plane at this R value)
        atlas[y_offset:y_offset+slice_size, x_offset:x_offset+slice_size] = texture[r, :, :]

    # Save the atlas
    Image.fromarray(atlas, 'RGB').save('generation/color_lut_atlas.png')
    print(f"Saved 'generation/color_lut_atlas.png' ({atlas_width}x{atlas_height} - {atlas.nbytes / (1024**2):.1f} MB)")
    print(f"Layout: 16x16 grid, each cell is 256x256 (one R-slice)")
    print(f"To sample: R-slice index = r_value, position in grid = (r%16, r//16)")

    # Save some test slices as images for visualization
    slice_r128 = texture[128, :, :]
    Image.fromarray(slice_r128, 'RGB').save('generation/slice_r128.png')
    print("\nSaved test slices:")
    print("  'generation/slice_r128.png' (G-B plane at R=128)")

except ImportError:
    print("PIL not available, skipping image export")

print("\n=== Texture Statistics ===")
unique_colors = np.unique(texture.reshape(-1, 3), axis=0)
print(f"Unique output colors in texture: {len(unique_colors)}")
print(f"Total input voxels: {256**3:,}")

# Show distribution of most common output colors
from collections import Counter
output_colors = [tuple(texture[r, g, b]) for r in range(0, 256, 4) for g in range(0, 256, 4) for b in range(0, 256, 4)]
color_counts = Counter(output_colors)
print("\nTop 10 most frequent output colors:")
for (r, g, b), count in color_counts.most_common(10):
    # Find which color name this corresponds to
    for i, name in enumerate(color_names):
        if tuple(color_rgb_array[i]) == (r, g, b):
            print(f"  RGB({r:3d},{g:3d},{b:3d}) = {name:15s} : {count:6d} voxels")
            break

print("\n✅ Texture building complete!")
