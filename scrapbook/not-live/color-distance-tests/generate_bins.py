"""
generate_bins.py

Generates a visual document showing Lab bin analysis.

Creates a two-column document where each row shows:
- Bin label (e.g., "L0a3b4")
- Representative color in a 64×64 box
- All RGB colors in that bin displayed in a grid (64×64 or larger if needed)
"""

import os
import numpy as np
import torch
import time
from PIL import Image, ImageDraw, ImageFont

#############################################
# CONFIGURATION
#############################################

BINS = 3                           # Number of bins per channel (total bins = BINS³)
METHOD = 'average'                  # Options: 'average', 'darkest', 'brightest'
OUTPUT_DIR = "bin_analysis"         # Output directory
BOX_SIZE = 64                       # Size of color boxes
MARGIN = 10                         # Margin between elements
LABEL_HEIGHT = 30                   # Height for bin label text

#############################################
# COLOR SPACE CONVERSION FUNCTIONS
#############################################

def rgb_to_lab(rgb: torch.Tensor) -> torch.Tensor:
    """
    Convert sRGB to CIE Lab color space (D65 illuminant).

    Args:
        rgb: Tensor of shape (..., 3) with RGB values in [0, 1]

    Returns:
        Tensor of shape (..., 3) with Lab values
    """
    # sRGB to linear RGB (inverse gamma correction)
    mask = rgb > 0.04045
    linear = torch.where(
        mask,
        torch.pow((rgb + 0.055) / 1.055, 2.4),
        rgb / 12.92
    )

    # Linear RGB to XYZ (D65 illuminant)
    transform_matrix = torch.tensor([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ], device=rgb.device, dtype=rgb.dtype)

    xyz = torch.matmul(linear, transform_matrix.T)

    # XYZ to Lab (D65 white point)
    white_point = torch.tensor([0.95047, 1.00000, 1.08883], device=rgb.device, dtype=rgb.dtype)
    xyz_normalized = xyz / white_point

    epsilon = 0.008856
    kappa = 903.3

    mask = xyz_normalized > epsilon
    f = torch.where(
        mask,
        torch.pow(xyz_normalized, 1.0 / 3.0),
        (kappa * xyz_normalized + 16.0) / 116.0
    )

    L = 116.0 * f[..., 1] - 16.0
    a = 500.0 * (f[..., 0] - f[..., 1])
    b = 200.0 * (f[..., 1] - f[..., 2])

    return torch.stack([L, a, b], dim=-1)


def lab_to_rgb(lab: torch.Tensor) -> torch.Tensor:
    """
    Convert CIE Lab to sRGB color space (D65 illuminant).

    Args:
        lab: Tensor of shape (..., 3) with Lab values

    Returns:
        Tensor of shape (..., 3) with RGB values in [0, 1]
    """
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # Lab to XYZ
    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0

    epsilon = 0.008856
    kappa = 903.3

    xr = torch.where(fx**3 > epsilon, fx**3, (116.0 * fx - 16.0) / kappa)
    yr = torch.where(L > kappa * epsilon, ((L + 16.0) / 116.0)**3, L / kappa)
    zr = torch.where(fz**3 > epsilon, fz**3, (116.0 * fz - 16.0) / kappa)

    # D65 white point
    white_point = torch.tensor([0.95047, 1.00000, 1.08883], device=lab.device, dtype=lab.dtype)
    xyz = torch.stack([xr, yr, zr], dim=-1) * white_point

    # XYZ to linear RGB
    inverse_transform = torch.tensor([
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252]
    ], device=lab.device, dtype=lab.dtype)

    linear = torch.matmul(xyz, inverse_transform.T)

    # Linear RGB to sRGB (gamma correction)
    mask = linear > 0.0031308
    rgb = torch.where(
        mask,
        1.055 * torch.pow(linear, 1.0 / 2.4) - 0.055,
        12.92 * linear
    )

    return rgb.clamp(0, 1)

#############################################
# LAB BIN INDEX COMPUTATION
#############################################

def lab_bin_index(L: np.ndarray, a: np.ndarray, b: np.ndarray, bins: int) -> np.ndarray:
    """
    Convert Lab coordinates to bin indices.

    Args:
        L: Array of L values [0, 100]
        a: Array of a values [-128, 127]
        b: Array of b values [-128, 127]
        bins: Number of bins per channel

    Returns:
        Array of bin indices in range [0, bins³)
    """
    # Normalize to [0, 1]
    L_norm = L / 100.0
    a_norm = (a + 128.0) / 255.0
    b_norm = (b + 128.0) / 255.0

    # Compute bin indices [0, bins-1]
    L_bin = np.clip(np.floor(L_norm * bins).astype(np.int32), 0, bins - 1)
    a_bin = np.clip(np.floor(a_norm * bins).astype(np.int32), 0, bins - 1)
    b_bin = np.clip(np.floor(b_norm * bins).astype(np.int32), 0, bins - 1)

    # Convert 3D bin coordinates to 1D index
    return L_bin, a_bin, b_bin, L_bin + a_bin * bins + b_bin * (bins ** 2)


def bin_label(L_bin: int, a_bin: int, b_bin: int) -> str:
    """Generate a label for a bin like 'L0a3b4'"""
    return f"L{L_bin}a{a_bin}b{b_bin}"

#############################################
# BIN ANALYSIS
#############################################

def analyze_bins(bins: int, method: str, device: torch.device):
    """
    Analyze all Lab bins by enumerating the sRGB gamut.

    Returns:
        Dictionary mapping bin_idx to {
            'label': str (e.g., 'L0a3b4'),
            'representative': np.ndarray (RGB in [0,1]),
            'colors': list of np.ndarray (RGB values in [0,1])
        }
    """
    print(f"Analyzing bins (bins={bins}, method={method})...")
    print("Enumerating all sRGB values (16,777,216 points)...")

    start_time = time.time()

    # Process in batches
    batch_size = 100000
    total_bins = bins ** 3

    # Store RGB values per bin
    bin_data = {}

    # Create all RGB values [0-255]
    r_vals = np.arange(256, dtype=np.uint8)
    g_vals = np.arange(256, dtype=np.uint8)
    b_vals = np.arange(256, dtype=np.uint8)

    # Meshgrid and flatten
    r_grid, g_grid, b_grid = np.meshgrid(r_vals, g_vals, b_vals, indexing='ij')
    r_flat = r_grid.flatten()
    g_flat = g_grid.flatten()
    b_flat = b_grid.flatten()

    total_points = len(r_flat)
    print(f"Total RGB points: {total_points:,}")

    num_batches = (total_points + batch_size - 1) // batch_size

    for batch_idx in range(num_batches):
        start_idx = batch_idx * batch_size
        end_idx = min(start_idx + batch_size, total_points)

        # Get batch of RGB values and normalize to [0, 1]
        r_batch = r_flat[start_idx:end_idx].astype(np.float32) / 255.0
        g_batch = g_flat[start_idx:end_idx].astype(np.float32) / 255.0
        b_batch = b_flat[start_idx:end_idx].astype(np.float32) / 255.0

        # Stack and convert to torch
        rgb_batch = np.stack([r_batch, g_batch, b_batch], axis=1)
        rgb_tensor = torch.from_numpy(rgb_batch).to(device)

        # Convert RGB to Lab
        lab_tensor = rgb_to_lab(rgb_tensor)
        lab_batch = lab_tensor.cpu().numpy()

        # Get bin indices for Lab values
        L_batch = lab_batch[:, 0]
        a_batch = lab_batch[:, 1]
        b_batch = lab_batch[:, 2]

        L_bins, a_bins, b_bins, bin_indices = lab_bin_index(L_batch, a_batch, b_batch, bins)

        # Group by bin
        for i, bin_idx in enumerate(bin_indices):
            if bin_idx not in bin_data:
                bin_data[bin_idx] = {
                    'label': bin_label(L_bins[i], a_bins[i], b_bins[i]),
                    'L_bin': L_bins[i],
                    'a_bin': a_bins[i],
                    'b_bin': b_bins[i],
                    'points': []
                }

            bin_data[bin_idx]['points'].append({
                'rgb': rgb_batch[i],
                'L': L_batch[i],
                'a': a_batch[i],
                'b': b_batch[i]
            })

        if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == num_batches:
            print(f"  Processed batch {batch_idx + 1}/{num_batches}")

    # Count occupied bins
    occupied_bins = len(bin_data)
    print(f"Occupied bins: {occupied_bins}/{total_bins} ({100*occupied_bins/total_bins:.1f}%)")

    # Compute representatives for each bin
    print(f"Computing representatives using method: {method}...")

    for bin_idx, data in bin_data.items():
        points = data['points']

        if method == 'average':
            # Average all Lab values in the bin, then convert to RGB
            avg_L = np.mean([p['L'] for p in points])
            avg_a = np.mean([p['a'] for p in points])
            avg_b = np.mean([p['b'] for p in points])

            # Convert average Lab back to RGB
            avg_lab = torch.tensor([[avg_L, avg_a, avg_b]], device=device, dtype=torch.float32)
            avg_rgb_tensor = lab_to_rgb(avg_lab)
            avg_rgb = avg_rgb_tensor.cpu().numpy()[0]

            data['representative'] = avg_rgb

        elif method == 'darkest':
            # Find RGB with minimum L value
            darkest_point = min(points, key=lambda p: p['L'])
            data['representative'] = darkest_point['rgb']

        elif method == 'brightest':
            # Find RGB with maximum L value
            brightest_point = max(points, key=lambda p: p['L'])
            data['representative'] = brightest_point['rgb']

        else:
            raise ValueError(f"Unknown method: {method}")

        # Store just the RGB values
        data['colors'] = [p['rgb'] for p in points]
        del data['points']  # Free memory

    elapsed = time.time() - start_time
    print(f"Analysis complete! Time: {elapsed:.2f}s")
    print()

    return bin_data

#############################################
# VISUALIZATION
#############################################

def create_color_grid(colors, box_size=64):
    """
    Create a grid showing all colors.
    If there are more than box_size² colors, increase resolution.
    """
    num_colors = len(colors)

    # Determine grid size
    grid_size = box_size
    while grid_size * grid_size < num_colors:
        grid_size *= 2

    # Create grid
    grid = np.ones((grid_size, grid_size, 3), dtype=np.float32)

    # Fill with colors
    for idx, color in enumerate(colors):
        if idx >= grid_size * grid_size:
            break  # Safety check
        row = idx // grid_size
        col = idx % grid_size
        grid[row, col] = color

    # Convert to uint8
    grid_uint8 = (grid * 255).astype(np.uint8)

    return Image.fromarray(grid_uint8, mode='RGB')


def generate_document(bin_data, output_path, box_size=64, margin=10, label_height=30):
    """
    Generate a two-column document showing bins.

    Each row contains:
    - Column 1: Bin label + representative color box
    - Column 2: Grid of all colors in that bin
    """
    print(f"Generating visual document...")

    # Sort bins by label for consistent ordering
    sorted_bins = sorted(bin_data.items(), key=lambda x: x[1]['label'])

    num_bins = len(sorted_bins)

    # Calculate document dimensions
    # Each row: label_height + max(box_size, grid_size) + margin
    max_grid_size = box_size
    for _, data in sorted_bins:
        num_colors = len(data['colors'])
        grid_size = box_size
        while grid_size * grid_size < num_colors:
            grid_size *= 2
        max_grid_size = max(max_grid_size, grid_size)

    row_height = label_height + max_grid_size + margin

    # Column widths
    col1_width = 200 + box_size + margin  # label width + box + margin
    col2_width = max_grid_size + margin

    doc_width = margin + col1_width + margin + col2_width + margin
    doc_height = margin + row_height * num_bins + margin

    # Create white background
    doc = Image.new('RGB', (doc_width, doc_height), color='white')
    draw = ImageDraw.Draw(doc)

    # Try to use a font, fall back to default if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except:
        font = ImageFont.load_default()

    print(f"Document size: {doc_width}×{doc_height}")
    print(f"Processing {num_bins} bins...")

    y_offset = margin

    for bin_idx, (_, data) in enumerate(sorted_bins):
        label = data['label']
        representative = data['representative']
        colors = data['colors']

        # Calculate grid size for this bin
        num_colors = len(colors)
        grid_size = box_size
        while grid_size * grid_size < num_colors:
            grid_size *= 2

        # Column 1: Label
        draw.text((margin, y_offset), label, fill='black', font=font)

        # Column 1: Representative color box
        rep_box = Image.new('RGB', (box_size, box_size),
                           color=tuple((representative * 255).astype(np.uint8)))
        doc.paste(rep_box, (margin + 200, y_offset + label_height))

        # Column 2: Color grid
        color_grid = create_color_grid(colors, box_size)
        doc.paste(color_grid, (margin + col1_width + margin, y_offset + label_height))

        y_offset += row_height

        if (bin_idx + 1) % 5 == 0:
            print(f"  Processed {bin_idx + 1}/{num_bins} bins")

    print(f"Saving document to {output_path}...")
    doc.save(output_path, optimize=True)

    file_size_mb = os.path.getsize(output_path) / 1024**2
    print(f"  Size: {file_size_mb:.1f} MB")
    print()

#############################################
# MAIN SCRIPT
#############################################

def main():
    total_start_time = time.time()

    print("="*70)
    print("Lab Bin Analysis - Visual Document Generator")
    print("="*70)
    print()
    print(f"Configuration:")
    print(f"  Bins: {BINS}")
    print(f"  Method: {METHOD}")
    print(f"  Box size: {BOX_SIZE}")
    print(f"  Output directory: {OUTPUT_DIR}/")
    print()

    # Detect device
    device = torch.device('cuda' if torch.cuda.is_available() else
                         'mps' if torch.backends.mps.is_available() else 'cpu')
    print(f"Using device: {device}")
    print()

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Analyze bins
    bin_data = analyze_bins(BINS, METHOD, device)

    # Generate visual document
    output_filename = f"bin_analysis_bins{BINS}_{METHOD}.png"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    generate_document(bin_data, output_path, BOX_SIZE, MARGIN, LABEL_HEIGHT)

    total_elapsed = time.time() - total_start_time

    print("="*70)
    print("Complete!")
    print("="*70)
    print()
    print(f"Total execution time: {total_elapsed:.2f}s")
    print(f"Output: {output_path}")
    print()

if __name__ == "__main__":
    main()
