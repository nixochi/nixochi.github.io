"""
generate_textures.py

Standalone script to precompute and save representative textures for Lab binning.
No external dependencies - all functions are self-contained.

This script generates RGB-indexed textures that map each RGB value to its Lab bin representative.
The texture allows direct lookup: texture[r, g, b] → representative RGB color.

Algorithm:
1. Enumerate all RGB values [0-255]³ (the sRGB gamut)
2. Convert each RGB → Lab and assign to bins
3. Compute representatives for each occupied bin
4. Build lookup texture mapping RGB → representative
"""

import os
import numpy as np
import torch
import time
import json
from PIL import Image

#############################################
# CONFIGURATION
#############################################

BINS = 3                           # Number of bins per channel (total bins = BINS³)
METHOD = 'average'                  # Options: 'average', 'darkest', 'brightest'
OUTPUT_DIR = "textures"             # Output directory for texture files
JS_FORMAT = 'png_atlas'             # Options: 'bin' (binary), 'png_slices', 'png_atlas', 'all'

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
    return L_bin + a_bin * bins + b_bin * (bins ** 2)

#############################################
# GAMUT ANALYSIS
#############################################

def check_lab_gamut_coverage(device: torch.device) -> float:
    """
    Check what percentage of Lab space is covered by sRGB gamut.

    Enumerates all sRGB values [0-255]³, converts to Lab, and counts
    how many discrete Lab grid points are occupied.

    Args:
        device: PyTorch device for conversions

    Returns:
        Percentage of Lab grid points (101 × 256 × 256) occupied by sRGB
    """
    print("Checking sRGB gamut coverage of Lab space...")
    print("Enumerating all sRGB values (16,777,216 points)...")

    start_time = time.time()

    # Track which Lab grid points are occupied
    # Use a set to store unique (L, a, b) integer coordinates
    occupied_lab_points = set()

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
    batch_size = 100000
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

        # Round Lab values to integer grid coordinates
        L_int = np.round(lab_batch[:, 0]).astype(np.int32)
        a_int = np.round(lab_batch[:, 1]).astype(np.int32)
        b_int = np.round(lab_batch[:, 2]).astype(np.int32)

        # Clip to valid Lab ranges
        L_int = np.clip(L_int, 0, 100)
        a_int = np.clip(a_int, -128, 127)
        b_int = np.clip(b_int, -128, 127)

        # Add to set of occupied points
        for i in range(len(L_int)):
            occupied_lab_points.add((L_int[i], a_int[i], b_int[i]))

    elapsed = time.time() - start_time

    # Total Lab grid points: 101 × 256 × 256
    total_lab_points = 101 * 256 * 256
    occupied_count = len(occupied_lab_points)
    percentage = (occupied_count / total_lab_points) * 100

    print(f"  Occupied Lab grid points: {occupied_count:,}/{total_lab_points:,} ({percentage:.1f}%)")
    print(f"  Time: {elapsed:.2f}s")
    print()

    return percentage

#############################################
# BIN REPRESENTATIVES COMPUTATION
#############################################

def compute_bin_representatives(bins: int, method: str, device: torch.device) -> np.ndarray:
    """
    Compute representative RGB colors for each Lab bin by enumerating the sRGB gamut.

    This function:
    1. Enumerates all sRGB values [0-255]³ (16,777,216 points - the RGB gamut)
    2. Converts each RGB → Lab and assigns to bins
    3. Groups RGB values by their Lab bin
    4. Computes a representative for each occupied bin using the specified method

    Args:
        bins: Number of bins per channel (total bins = bins³)
        method: 'average', 'darkest', or 'brightest'
        device: PyTorch device for conversions

    Returns:
        Array of shape (bins³, 3) with RGB representatives for each bin
        Bins not occupied by the sRGB gamut get white (1.0, 1.0, 1.0)
    """
    print(f"Computing bin representatives for bins={bins}, method={method}...")
    print("Enumerating all sRGB values (16,777,216 points)...")

    start_time = time.time()

    # Process in batches to avoid memory issues
    batch_size = 100000
    total_bins = bins ** 3

    # Store RGB values per bin
    bin_points = {i: [] for i in range(total_bins)}

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

        bin_indices = lab_bin_index(L_batch, a_batch, b_batch, bins)

        # Group by bin (store RGB and Lab)
        for i, bin_idx in enumerate(bin_indices):
            bin_points[bin_idx].append({
                'rgb': rgb_batch[i],        # RGB [0,1]
                'L': L_batch[i],
                'a': a_batch[i],
                'b': b_batch[i]
            })

        if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == num_batches:
            print(f"  Processed batch {batch_idx + 1}/{num_batches}")

    # Count occupied bins
    occupied_bins = sum(1 for points in bin_points.values() if len(points) > 0)
    print(f"Occupied bins: {occupied_bins}/{total_bins} ({100*occupied_bins/total_bins:.1f}%)")

    # Compute representatives for each bin
    print(f"Computing representatives using method: {method}...")
    representatives = np.ones((total_bins, 3), dtype=np.float32)  # Default to white

    for bin_idx in range(total_bins):
        points = bin_points[bin_idx]

        if len(points) == 0:
            continue  # Keep white default

        if method == 'average':
            # Average all Lab values in the bin, then convert to RGB
            avg_L = np.mean([p['L'] for p in points])
            avg_a = np.mean([p['a'] for p in points])
            avg_b = np.mean([p['b'] for p in points])

            # Convert average Lab back to RGB
            avg_lab = torch.tensor([[avg_L, avg_a, avg_b]], device=device, dtype=torch.float32)
            avg_rgb_tensor = lab_to_rgb(avg_lab)
            avg_rgb = avg_rgb_tensor.cpu().numpy()[0]

            representatives[bin_idx] = avg_rgb

        elif method == 'darkest':
            # Find RGB with minimum L value
            darkest_point = min(points, key=lambda p: p['L'])
            representatives[bin_idx] = darkest_point['rgb']

        elif method == 'brightest':
            # Find RGB with maximum L value
            brightest_point = max(points, key=lambda p: p['L'])
            representatives[bin_idx] = brightest_point['rgb']

        else:
            raise ValueError(f"Unknown method: {method}. Must be 'average', 'darkest', or 'brightest'")

    print(f"Computed representatives for {occupied_bins}/{total_bins} bins")

    elapsed = time.time() - start_time
    print(f"Time: {elapsed:.2f}s")
    print()

    return representatives

#############################################
# RGB-INDEXED TEXTURE CONSTRUCTION
#############################################

def build_rgb_texture(representatives: np.ndarray, bins: int, device: torch.device) -> np.ndarray:
    """
    Build RGB-indexed texture from bin representatives.

    For each RGB value [0-255], converts to Lab, finds its bin, and stores the representative.

    Args:
        representatives: Array of shape (bins³, 3) with RGB representatives
        bins: Number of bins per channel
        device: PyTorch device for conversions

    Returns:
        Array of shape (256, 256, 256, 3) where texture[r, g, b]
        gives the RGB representative for input RGB value (r, g, b)
    """
    print("Building RGB-indexed texture (256×256×256×3)...")
    print("This will process 16,777,216 RGB values...")

    start_time = time.time()

    texture = np.zeros((256, 256, 256, 3), dtype=np.float32)

    # Process in batches for efficiency
    batch_size = 100000
    total_pixels = 256 ** 3

    # Create all RGB values [0-255]
    r_vals = np.arange(256, dtype=np.uint8)
    g_vals = np.arange(256, dtype=np.uint8)
    b_vals = np.arange(256, dtype=np.uint8)

    # Meshgrid and flatten
    r_grid, g_grid, b_grid = np.meshgrid(r_vals, g_vals, b_vals, indexing='ij')
    r_flat = r_grid.flatten()
    g_flat = g_grid.flatten()
    b_flat = b_grid.flatten()

    num_batches = (total_pixels + batch_size - 1) // batch_size

    for batch_idx in range(num_batches):
        start_idx = batch_idx * batch_size
        end_idx = min(start_idx + batch_size, total_pixels)

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

        bin_indices = lab_bin_index(L_batch, a_batch, b_batch, bins)

        # Look up representatives
        representatives_batch = representatives[bin_indices]

        # Store in texture (using original uint8 indices)
        r_indices = r_flat[start_idx:end_idx]
        g_indices = g_flat[start_idx:end_idx]
        b_indices = b_flat[start_idx:end_idx]

        texture[r_indices, g_indices, b_indices] = representatives_batch

        if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == num_batches:
            print(f"  Processed batch {batch_idx + 1}/{num_batches}")

    elapsed = time.time() - start_time
    print(f"Texture construction complete!")
    print(f"Time: {elapsed:.2f}s")
    print()

    return texture

#############################################
# JAVASCRIPT-COMPATIBLE EXPORT FUNCTIONS
#############################################

def save_as_binary(texture: np.ndarray, output_dir: str, bins: int, method: str) -> str:
    """
    Save texture as raw binary file (Float32) for JavaScript.

    JavaScript can load this with:
    ```javascript
    const response = await fetch('texture.bin');
    const buffer = await response.arrayBuffer();
    const data = new Float32Array(buffer);
    // data[r*256*256*3 + g*256*3 + b*3 + channel]
    ```

    Args:
        texture: Array of shape (256, 256, 256, 3)
        output_dir: Output directory
        bins: Number of bins
        method: Representative method

    Returns:
        Path to saved file
    """
    output_filename = f"rgb_texture_bins{bins}_{method}.bin"
    output_path = os.path.join(output_dir, output_filename)

    print(f"Saving as binary: {output_path}")
    start = time.time()

    # Convert to Uint8 (0-255 range) for smaller file size
    texture_uint8 = (texture * 255).astype(np.uint8)

    # Save as raw binary in C-order (row-major)
    texture_uint8.tobytes('C').tofile(output_path)

    elapsed = time.time() - start
    file_size_mb = os.path.getsize(output_path) / 1024**2

    print(f"  Size: {file_size_mb:.1f} MB")
    print(f"  Format: Uint8 (256×256×256×3)")
    print(f"  Time: {elapsed:.2f}s")
    print()

    # Save metadata JSON
    metadata = {
        "format": "uint8",
        "shape": [256, 256, 256, 3],
        "bins": bins,
        "method": method,
        "description": "3D RGB-indexed texture. Access as: data[r*256*256*3 + g*256*3 + b*3 + channel]"
    }

    metadata_path = os.path.join(output_dir, f"rgb_texture_bins{bins}_{method}.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata: {metadata_path}")
    print()

    return output_path


def save_as_png_slices(texture: np.ndarray, output_dir: str, bins: int, method: str) -> str:
    """
    Save texture as 256 PNG images (one per R channel value).

    JavaScript can load with:
    ```javascript
    const img = new Image();
    img.src = `textures/slice_${r}.png`;
    // Then read pixel at (g, b) to get RGB value
    ```

    Args:
        texture: Array of shape (256, 256, 256, 3)
        output_dir: Output directory
        bins: Number of bins
        method: Representative method

    Returns:
        Path to slice directory
    """
    slice_dir = os.path.join(output_dir, f"slices_bins{bins}_{method}")
    os.makedirs(slice_dir, exist_ok=True)

    print(f"Saving as PNG slices: {slice_dir}/")
    start = time.time()

    # Convert to Uint8
    texture_uint8 = (texture * 255).astype(np.uint8)

    for r in range(256):
        # Extract slice for this R value (256×256×3)
        slice_data = texture_uint8[r, :, :, :]

        # Save as PNG
        img = Image.fromarray(slice_data, mode='RGB')
        img.save(os.path.join(slice_dir, f"slice_{r:03d}.png"))

        if (r + 1) % 32 == 0:
            print(f"  Saved {r + 1}/256 slices")

    elapsed = time.time() - start

    print(f"  Files: 256 PNG images (256×256 each)")
    print(f"  Time: {elapsed:.2f}s")
    print()

    return slice_dir


def save_as_png_atlas(texture: np.ndarray, output_dir: str, bins: int, method: str) -> str:
    """
    Save texture as single PNG atlas (16×16 grid of 256×256 slices = 4096×4096).

    JavaScript can load with:
    ```javascript
    const img = new Image();
    img.src = 'texture_atlas.png';
    // Calculate tile position: tile_x = r % 16, tile_y = floor(r / 16)
    // Pixel position: x = tile_x * 256 + g, y = tile_y * 256 + b
    ```

    Args:
        texture: Array of shape (256, 256, 256, 3)
        output_dir: Output directory
        bins: Number of bins
        method: Representative method

    Returns:
        Path to atlas file
    """
    output_filename = f"rgb_texture_atlas_bins{bins}_{method}.png"
    output_path = os.path.join(output_dir, output_filename)

    print(f"Saving as PNG atlas: {output_path}")
    start = time.time()

    # Convert to Uint8
    texture_uint8 = (texture * 255).astype(np.uint8)

    # Create 4096×4096 atlas (16×16 grid)
    atlas = np.zeros((4096, 4096, 3), dtype=np.uint8)

    for r in range(256):
        # Calculate tile position
        tile_x = r % 16
        tile_y = r // 16

        # Calculate pixel offset
        x_offset = tile_x * 256
        y_offset = tile_y * 256

        # Copy slice into atlas
        atlas[y_offset:y_offset+256, x_offset:x_offset+256, :] = texture_uint8[r, :, :, :]

    # Save atlas
    img = Image.fromarray(atlas, mode='RGB')
    img.save(output_path, optimize=True)

    elapsed = time.time() - start
    file_size_mb = os.path.getsize(output_path) / 1024**2

    print(f"  Size: {file_size_mb:.1f} MB")
    print(f"  Dimensions: 4096×4096 (16×16 grid of 256×256 tiles)")
    print(f"  Time: {elapsed:.2f}s")
    print()

    # Save metadata JSON
    metadata = {
        "format": "png_atlas",
        "dimensions": [4096, 4096],
        "tile_size": 256,
        "grid_size": 16,
        "bins": bins,
        "method": method,
        "description": "Access with: tile_x=r%16, tile_y=floor(r/16), pixel=(tile_x*256+g, tile_y*256+b)"
    }

    metadata_path = os.path.join(output_dir, f"rgb_texture_atlas_bins{bins}_{method}.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata: {metadata_path}")
    print()

    return output_path

#############################################
# MAIN SCRIPT
#############################################

def main():
    total_start_time = time.time()

    print("="*70)
    print("RGB-Indexed Lab Representative Texture Generator (Standalone)")
    print("="*70)
    print()
    print(f"Configuration:")
    print(f"  Bins: {BINS}")
    print(f"  Method: {METHOD}")
    print(f"  Output directory: {OUTPUT_DIR}/")
    print()

    # Detect device
    device = torch.device('cuda' if torch.cuda.is_available() else
                         'mps' if torch.backends.mps.is_available() else 'cpu')
    print(f"Using device: {device}")
    print()

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 0: Check Lab gamut coverage (optional analysis)
    gamut_percentage = check_lab_gamut_coverage(device)

    # Step 1: Compute bin representatives (from RGB gamut enumeration)
    representatives = compute_bin_representatives(BINS, METHOD, device)

    # Step 2: Build RGB-indexed texture
    texture = build_rgb_texture(representatives, BINS, device)

    # Step 3: Save texture in requested format(s)
    print("="*70)
    print("Saving Textures for JavaScript")
    print("="*70)
    print()

    saved_files = []

    if JS_FORMAT in ['bin', 'all']:
        path = save_as_binary(texture, OUTPUT_DIR, BINS, METHOD)
        saved_files.append(path)

    if JS_FORMAT in ['png_slices', 'all']:
        path = save_as_png_slices(texture, OUTPUT_DIR, BINS, METHOD)
        saved_files.append(path)

    if JS_FORMAT in ['png_atlas', 'all']:
        path = save_as_png_atlas(texture, OUTPUT_DIR, BINS, METHOD)
        saved_files.append(path)

    # Also save NumPy format for Python compatibility
    npy_filename = f"rgb_texture_bins{BINS}_{METHOD}.npy"
    npy_path = os.path.join(OUTPUT_DIR, npy_filename)
    print(f"Saving NumPy format: {npy_path}")
    np.save(npy_path, texture)
    print()

    total_elapsed = time.time() - total_start_time

    print("="*70)
    print("Complete!")
    print("="*70)
    print()
    print("Summary:")
    print(f"  sRGB gamut in Lab space: {gamut_percentage:.1f}%")
    print(f"  Total execution time: {total_elapsed:.2f}s")
    print(f"  Format: {JS_FORMAT}")
    print()

    if JS_FORMAT in ['bin', 'all']:
        print("JavaScript usage (binary):")
        print("  const response = await fetch('rgb_texture_bins3_average.bin');")
        print("  const buffer = await response.arrayBuffer();")
        print("  const data = new Uint8Array(buffer);")
        print("  const idx = (r*256*256*3 + g*256*3 + b*3);")
        print("  const rgb = [data[idx], data[idx+1], data[idx+2]];")
        print()

    if JS_FORMAT in ['png_atlas', 'all']:
        print("JavaScript usage (PNG atlas):")
        print("  const img = new Image();")
        print("  img.src = 'rgb_texture_atlas_bins3_average.png';")
        print("  const tile_x = r % 16, tile_y = Math.floor(r / 16);")
        print("  const x = tile_x * 256 + g, y = tile_y * 256 + b;")
        print("  // Sample pixel at (x, y) from loaded image")
        print()

if __name__ == "__main__":
    main()
