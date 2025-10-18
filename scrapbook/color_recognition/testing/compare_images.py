#!/usr/bin/env python3
"""
Compare original and recolorized images side-by-side.
Creates a single image with original on the left and recolorized on the right.

Usage:
    python compare_images.py original.jpg recolorized.jpg output.png
"""

import sys
import os
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

def compare_images(original_path: str, recolorized_path: str, output_path: str):
    """
    Create a side-by-side comparison of original and recolorized images.

    Args:
        original_path: Path to original image
        recolorized_path: Path to recolorized image
        output_path: Path to save comparison image
    """
    # Load images
    print(f"Loading images...")
    original = np.array(Image.open(original_path).convert('RGB'))
    recolorized = np.array(Image.open(recolorized_path).convert('RGB'))

    # Get dimensions
    h, w = original.shape[:2]
    print(f"Image size: {w}x{h}")

    # Create figure with 1 row, 2 columns
    fig, axes = plt.subplots(1, 2, figsize=(16, 8))

    # Left: Original
    axes[0].imshow(original)
    axes[0].set_title('Original', fontsize=16, fontweight='bold')
    axes[0].axis('off')

    # Right: Recolorized
    axes[1].imshow(recolorized)
    axes[1].set_title('Recolorized (39-Color Model)', fontsize=16, fontweight='bold')
    axes[1].axis('off')

    # Get filename for title
    filename = os.path.basename(original_path)
    fig.suptitle(f'{filename}', fontsize=18, fontweight='bold')

    plt.tight_layout()

    # Save
    print(f"Saving comparison to '{output_path}'...")
    plt.savefig(output_path, bbox_inches='tight', dpi=150)
    plt.close()

    print(f"✅ Comparison saved!")


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python compare_images.py <original> <recolorized> <output>")
        print("Example: python compare_images.py image.jpg image_recolorized.jpg comparison.png")
        sys.exit(1)

    original_path = sys.argv[1]
    recolorized_path = sys.argv[2]
    output_path = sys.argv[3]

    if not os.path.exists(original_path):
        print(f"Error: Original image not found: {original_path}")
        sys.exit(1)

    if not os.path.exists(recolorized_path):
        print(f"Error: Recolorized image not found: {recolorized_path}")
        sys.exit(1)

    compare_images(original_path, recolorized_path, output_path)
