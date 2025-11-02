#!/usr/bin/env python3
"""
Calculate color probabilities for a single RGB pixel.

This module provides functions to:
1. Convert RGB values to LAB color space
2. Calculate the LAB bin index
3. Look up color probabilities from the w2c39 matrix
4. Find the most probable color name and its representative RGB value
"""

import numpy as np
import os

# Color name to RGB mapping (same as in build_texture.py)
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
    'burgundy': (128, 0, 32),
    'tan': (210, 180, 140)
}

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

def calculate_lab_index(r, g, b):
    """
    Calculate the LAB bin index for an RGB pixel.

    Args:
        r, g, b: RGB values (0-255)

    Returns:
        index: Integer index into the w2c39 probability matrix
    """
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

    return index

def load_color_data(matrix_path='color-matrices/w2c39.txt'):
    """
    Load the w2c39 color probability matrix.

    Args:
        matrix_path: Path to the w2c39.txt file

    Returns:
        dict: Mapping from LAB bin index to probability array
    """
    color_data = {}
    with open(matrix_path, 'r') as f:
        for line in f:
            values = line.strip().split()
            index = int(values[0])
            probs = np.array([float(v) for v in values[1:]])
            color_data[index] = probs
    return color_data

def load_color_names(names_path='color-matrices/cn39.txt'):
    """
    Load the color names from cn39.txt.

    Args:
        names_path: Path to the cn39.txt file

    Returns:
        list: Color name strings
    """
    color_names = []
    with open(names_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                line = line.strip("',")
                if '.' in line:
                    name = line.split('.', 1)[1]
                    color_names.append(name)
                else:
                    color_names.append(line)
    return color_names

def get_color_probabilities(r, g, b, color_data):
    """
    Get color probabilities for an RGB pixel.

    Args:
        r, g, b: RGB values (0-255)
        color_data: Loaded probability matrix from load_color_data()

    Returns:
        numpy.array: Probability array for each color, or None if not found
    """
    index = calculate_lab_index(r, g, b)
    return color_data.get(index, None)

def apply_matrix_to_pixel(r, g, b, color_data=None, color_names=None):
    """
    Apply the color probability matrix to a single pixel.
    Returns the RGB value of the most probable color.

    Args:
        r, g, b: Input RGB values (0-255)
        color_data: Loaded probability matrix (will load if None)
        color_names: Loaded color names (will load if None)

    Returns:
        tuple: (output_r, output_g, output_b) - RGB of most probable color
    """
    # Load data if not provided
    if color_data is None:
        color_data = load_color_data()
    if color_names is None:
        color_names = load_color_names()

    # Get probabilities
    probs = get_color_probabilities(r, g, b, color_data)

    if probs is None:
        # No data for this color, return original
        return (r, g, b)

    # Find color with highest probability
    max_idx = np.argmax(probs)
    color_name = color_names[max_idx]

    # Get representative RGB value
    if color_name in COLOR_RGB_VALUES:
        return COLOR_RGB_VALUES[color_name]
    else:
        # Fallback to original if color not defined
        return (r, g, b)

# Example usage
if __name__ == '__main__':
    # Load data once
    print("Loading color data...")
    color_data = load_color_data()
    color_names = load_color_names()
    print(f"Loaded {len(color_data)} LAB bins and {len(color_names)} color names")

    # Test some colors
    test_colors = [
        (255, 0, 0, "Red"),
        (0, 255, 0, "Green"),
        (0, 0, 255, "Blue"),
        (128, 128, 128, "Grey"),
        (200, 100, 50, "Orange-ish")
    ]

    print("\nTesting color mapping:")
    for r, g, b, label in test_colors:
        output_rgb = apply_matrix_to_pixel(r, g, b, color_data, color_names)
        probs = get_color_probabilities(r, g, b, color_data)

        if probs is not None:
            max_idx = np.argmax(probs)
            color_name = color_names[max_idx]
            max_prob = probs[max_idx]
            print(f"{label:15s} RGB({r:3d},{g:3d},{b:3d}) -> {color_name:15s} RGB{output_rgb} (prob: {max_prob:.3f})")
        else:
            print(f"{label:15s} RGB({r:3d},{g:3d},{b:3d}) -> No data (keeping original)")
