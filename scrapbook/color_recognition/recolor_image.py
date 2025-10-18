#!/usr/bin/env python3
"""
Recolor an image using the pre-generated 39-color lookup texture.
Each pixel is mapped to its most probable color name's representative RGB value.

Usage:
    python recolor_image.py input_image.png
    python recolor_image.py input_image.jpg
"""

import sys
import os
import numpy as np
from PIL import Image

def recolor_image(input_path, lut_path='texture/color_texture_256.npy'):
    """
    Recolor an image using the 3D color lookup table.

    Args:
        input_path: Path to input image (PNG or JPEG)
        lut_path: Path to the 3D LUT numpy file

    Returns:
        Path to the output image
    """
    # Load the 3D lookup texture
    print(f"Loading color LUT from '{lut_path}'...")
    if not os.path.exists(lut_path):
        print(f"Error: LUT file not found at '{lut_path}'")
        print("Please run build_texture.py first to generate the lookup table.")
        sys.exit(1)

    lut = np.load(lut_path)
    print(f"LUT loaded: {lut.shape} ({lut.nbytes / (1024**2):.1f} MB)")

    # Load the input image
    print(f"Loading input image '{input_path}'...")
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: '{input_path}'")
        sys.exit(1)

    img = Image.open(input_path).convert('RGB')
    width, height = img.size
    print(f"Image size: {width}x{height}")

    # Convert to numpy array
    img_array = np.array(img, dtype=np.uint8)

    # Create output array
    output_array = np.zeros_like(img_array)

    # Apply the LUT to each pixel
    print("Recoloring image...")
    for y in range(height):
        if y % 100 == 0:
            print(f"  Progress: {y}/{height} rows ({y/height*100:.1f}%)")

        for x in range(width):
            r, g, b = img_array[y, x]
            # Look up the recolored value in the 3D LUT
            output_array[y, x] = lut[r, g, b]

    print("  Progress: 100.0%")

    # Convert back to image
    output_img = Image.fromarray(output_array, 'RGB')

    # Generate output filename
    base, ext = os.path.splitext(input_path)
    output_path = f"{base}_recolorized{ext}"

    # Save the result
    print(f"Saving recolored image to '{output_path}'...")
    output_img.save(output_path)
    print(f"✅ Done! Output saved to: {output_path}")

    return output_path


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python recolor_image.py <input_image>")
        print("Example: python recolor_image.py photo.png")
        sys.exit(1)

    input_file = sys.argv[1]
    recolor_image(input_file)
