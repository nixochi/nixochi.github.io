#!/usr/bin/env python3
"""
Generate test suite by:
1. Downloading 15 random images from Lorem Picsum
2. Recoloring each with recolor_image.py
3. Creating comparison images with compare_images.py
4. Compiling all comparisons into a single PDF document
"""

import os
import sys
import subprocess
from PIL import Image
import requests
from io import BytesIO

# Directories
TEST_IMAGES_DIR = 'test_images'
COMPARISONS_DIR = 'comparisons'
OUTPUT_PDF = 'all_comparisons.pdf'

# Image settings
NUM_IMAGES = 15
IMAGE_WIDTH = 1920
IMAGE_HEIGHT = 1080

def download_lorem_picsum_image(index, width=IMAGE_WIDTH, height=IMAGE_HEIGHT):
    """
    Download a random image from Lorem Picsum.

    Args:
        index: Image number (for filename)
        width: Image width
        height: Image height

    Returns:
        Path to saved image
    """
    # Lorem Picsum URL with specific dimensions and random seed
    url = f"https://picsum.photos/seed/{index}/{ width}/{height}"

    print(f"  Downloading image {index} from Lorem Picsum...")

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # Open image from response
        img = Image.open(BytesIO(response.content))

        # Save to test_images directory
        filename = f"test_{index:02d}.jpg"
        filepath = os.path.join(TEST_IMAGES_DIR, filename)
        img.save(filepath, quality=95)

        file_size = os.path.getsize(filepath) / 1024
        print(f"    ✓ Saved {filename} ({file_size:.1f} KB)")

        return filepath

    except Exception as e:
        print(f"    ✗ Error downloading image {index}: {e}")
        return None


def recolor_image(input_path):
    """
    Recolor an image using recolor_image.py.

    Args:
        input_path: Path to input image

    Returns:
        Path to recolored image
    """
    print(f"  Recoloring {os.path.basename(input_path)}...")

    try:
        result = subprocess.run(
            ['python3', '../recolor_image.py', input_path],
            capture_output=True,
            text=True,
            check=True
        )

        # Output path is input path with _recolorized suffix
        base, ext = os.path.splitext(input_path)
        recolored_path = f"{base}_recolorized{ext}"

        if os.path.exists(recolored_path):
            print(f"    ✓ Created {os.path.basename(recolored_path)}")
            return recolored_path
        else:
            print(f"    ✗ Recolored image not found")
            return None

    except subprocess.CalledProcessError as e:
        print(f"    ✗ Error recoloring: {e}")
        print(e.stderr)
        return None


def create_comparison(original_path, recolored_path, output_path):
    """
    Create a side-by-side comparison image.

    Args:
        original_path: Path to original image
        recolored_path: Path to recolored image
        output_path: Path to save comparison

    Returns:
        Path to comparison image
    """
    print(f"  Creating comparison for {os.path.basename(original_path)}...")

    try:
        result = subprocess.run(
            ['python3', 'compare_images.py', original_path, recolored_path, output_path],
            capture_output=True,
            text=True,
            check=True
        )

        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path) / 1024
            print(f"    ✓ Created comparison ({file_size:.1f} KB)")
            return output_path
        else:
            print(f"    ✗ Comparison image not found")
            return None

    except subprocess.CalledProcessError as e:
        print(f"    ✗ Error creating comparison: {e}")
        print(e.stderr)
        return None


def compile_to_pdf(comparison_paths, output_pdf):
    """
    Compile all comparison images into a single PDF.

    Args:
        comparison_paths: List of paths to comparison images
        output_pdf: Path to output PDF file
    """
    print(f"\nCompiling {len(comparison_paths)} comparisons into PDF...")

    if not comparison_paths:
        print("  ✗ No comparison images to compile")
        return

    try:
        # Open all images
        images = []
        for path in comparison_paths:
            img = Image.open(path)
            # Convert to RGB if necessary (PDF requires RGB)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            images.append(img)

        # Save as PDF (first image with rest appended)
        if images:
            images[0].save(
                output_pdf,
                save_all=True,
                append_images=images[1:],
                resolution=100.0,
                quality=95
            )

            file_size = os.path.getsize(output_pdf) / (1024 * 1024)
            print(f"  ✓ PDF created: {output_pdf} ({file_size:.1f} MB)")
            print(f"  ✓ Contains {len(images)} pages")

    except Exception as e:
        print(f"  ✗ Error creating PDF: {e}")


def main():
    """Main execution function"""
    print("=" * 70)
    print("COLOR RECOGNITION TEST SUITE GENERATOR")
    print("=" * 70)
    print()

    # Create directories
    os.makedirs(TEST_IMAGES_DIR, exist_ok=True)
    os.makedirs(COMPARISONS_DIR, exist_ok=True)

    # Check dependencies
    if not os.path.exists('../texture/color_texture_256.npy'):
        print("Error: Color lookup table not found!")
        print("Please run 'python3 texture/build_texture.py' first.")
        sys.exit(1)

    comparison_paths = []

    # Process each image
    for i in range(1, NUM_IMAGES + 1):
        print(f"\n[{i}/{NUM_IMAGES}] Processing test image {i}")
        print("-" * 70)

        # Download image
        original_path = download_lorem_picsum_image(i, IMAGE_WIDTH, IMAGE_HEIGHT)
        if not original_path:
            continue

        # Recolor image
        recolored_path = recolor_image(original_path)
        if not recolored_path:
            continue

        # Create comparison
        comparison_filename = f"comparison_{i:02d}.png"
        comparison_path = os.path.join(COMPARISONS_DIR, comparison_filename)

        result_path = create_comparison(original_path, recolored_path, comparison_path)
        if result_path:
            comparison_paths.append(result_path)

    # Compile to PDF
    print("\n" + "=" * 70)
    compile_to_pdf(comparison_paths, OUTPUT_PDF)

    print("\n" + "=" * 70)
    print("✅ TEST SUITE GENERATION COMPLETE!")
    print("=" * 70)
    print(f"  Original images: {TEST_IMAGES_DIR}/")
    print(f"  Comparisons: {COMPARISONS_DIR}/")
    print(f"  PDF document: {OUTPUT_PDF}")
    print()


if __name__ == '__main__':
    main()
