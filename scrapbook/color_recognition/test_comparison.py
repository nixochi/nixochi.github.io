import scipy.io
import numpy as np
import random

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

# Load the MATLAB matrix
print("Loading MATLAB matrix...")
mat_data = scipy.io.loadmat('w2c39.mat')
w2c_matrix = mat_data['w2cBLall']
print(f"Matrix shape: {w2c_matrix.shape}")

# Load our generated text file (now LAB-indexed)
print("\nLoading our w2c39.txt file...")
our_data = {}
with open('w2c39.txt', 'r') as f:
    for line in f:
        values = line.strip().split()
        index = int(values[0])
        probs = [float(v) for v in values[1:]]
        our_data[index] = probs

print(f"Loaded {len(our_data)} entries from our file\n")

# Load color names
color_names = []
with open('cn39.txt', 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            # Extract color name from format like '1.black',
            line = line.strip("',")
            if '.' in line:
                name = line.split('.', 1)[1]
                color_names.append(name)
            else:
                color_names.append(line)

print(f"Color names: {color_names[:5]}...\n")

# Generate 1000 random RGB colors
print("=" * 80)
print("Testing 1000 random RGB colors")
print("=" * 80)

test_colors = []
for _ in range(1000):
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    test_colors.append((r, g, b))

# Statistics tracking
stats = {
    'total': 0,
    'top1_match': 0,
    'top3_match': 0,
    'max_diffs': [],
    'missing_keys': 0
}

for i, (r, g, b) in enumerate(test_colors, 1):
    if i % 100 == 0:
        print(f"Processing test {i}/1000...")

    stats['total'] += 1

    # Convert to LAB
    L, A, B = rgb_to_lab(r, g, b)

    # Get index using MATLAB formula
    L_bin = int(np.floor(L / 5))
    A_bin = int(np.floor(A / 5) + 21)
    B_bin = int(np.floor(B / 5) + 21)
    L_bin = max(0, min(19, L_bin))
    A_bin = max(0, min(41, A_bin))
    B_bin = max(0, min(41, B_bin))
    index = L_bin + 20 * A_bin + 20 * 42 * B_bin

    # Get probabilities from MATLAB matrix (normalized)
    matlab_probs = w2c_matrix[index]
    matlab_sum = matlab_probs.sum()
    matlab_normalized = matlab_probs / matlab_sum if matlab_sum > 0 else matlab_probs

    # Get probabilities from our file (using same LAB index)
    our_probs = our_data.get(index)

    if our_probs:
        # Compare top colors
        matlab_top3 = sorted(enumerate(matlab_normalized), key=lambda x: x[1], reverse=True)[:3]
        our_top3 = sorted(enumerate(our_probs), key=lambda x: x[1], reverse=True)[:3]

        matlab_top_idx = [x[0] for x in matlab_top3]
        our_top_idx = [x[0] for x in our_top3]

        # Check if top 1 matches
        if matlab_top_idx[0] == our_top_idx[0]:
            stats['top1_match'] += 1

        # Check if top 3 match
        if matlab_top_idx == our_top_idx:
            stats['top3_match'] += 1

        # Calculate max difference in probabilities
        max_diff = max(abs(matlab_normalized[i] - our_probs[i]) for i in range(len(our_probs)))
        stats['max_diffs'].append(max_diff)

        # Show first 5 in detail
        if i <= 5:
            print(f"\n--- Test {i}: RGB({r}, {g}, {b}) ---")
            print(f"LAB: ({L:.2f}, {A:.2f}, {B:.2f})")
            print(f"LAB bins: ({L_bin}, {A_bin}, {B_bin}) -> index {index}")
            print("\nMATLAB top 3:")
            for idx, prob in matlab_top3:
                print(f"  {color_names[idx]:15s} {prob*100:6.2f}%")
            print("\nOur implementation top 3:")
            for idx, prob in our_top3:
                print(f"  {color_names[idx]:15s} {prob*100:6.2f}%")
            print(f"Max probability difference: {max_diff:.6f}")
    else:
        stats['missing_keys'] += 1

print("\n" + "=" * 80)
print("SUMMARY STATISTICS")
print("=" * 80)
print(f"Total tests:              {stats['total']}")
print(f"Missing keys:             {stats['missing_keys']}")
print(f"Valid comparisons:        {stats['total'] - stats['missing_keys']}")
print()
print(f"Top-1 color matches:      {stats['top1_match']} / {stats['total'] - stats['missing_keys']} ({stats['top1_match']/(stats['total']-stats['missing_keys'])*100:.2f}%)")
print(f"Top-3 color matches:      {stats['top3_match']} / {stats['total'] - stats['missing_keys']} ({stats['top3_match']/(stats['total']-stats['missing_keys'])*100:.2f}%)")
print()
if stats['max_diffs']:
    print(f"Max prob difference:")
    print(f"  Min:                    {min(stats['max_diffs']):.6f}")
    print(f"  Max:                    {max(stats['max_diffs']):.6f}")
    print(f"  Mean:                   {np.mean(stats['max_diffs']):.6f}")
    print(f"  Median:                 {np.median(stats['max_diffs']):.6f}")
    print(f"  95th percentile:        {np.percentile(stats['max_diffs'], 95):.6f}")
print("=" * 80)
