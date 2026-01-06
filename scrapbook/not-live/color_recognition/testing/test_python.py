import sys
import os

# Add parent directory to path to access w2c39.txt and cn39.txt
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

# Load w2c39.txt
print('Loading w2c39.txt...')
color_data = {}
w2c39_path = os.path.join(os.path.dirname(__file__), '..', 'w2c39.txt')
with open(w2c39_path, 'r') as f:
    for line in f:
        values = line.strip().split()
        index = int(values[0])
        probs = [float(v) for v in values[1:]]
        color_data[index] = probs

print(f'Loaded {len(color_data)} entries\n')

# Load color names
color_names = []
cn39_path = os.path.join(os.path.dirname(__file__), '..', 'cn39.txt')
with open(cn39_path, 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            line = line.strip("',")
            if '.' in line:
                name = line.split('.', 1)[1]
                color_names.append(name)
            else:
                color_names.append(line)

print(f'Loaded {len(color_names)} color names\n')

# Load test colors
test_colors = []
test_colors_path = os.path.join(os.path.dirname(__file__), 'test_colors.txt')
with open(test_colors_path, 'r') as f:
    for line in f:
        r, g, b = map(int, line.strip().split(','))
        test_colors.append((r, g, b))

print(f'Loaded {len(test_colors)} test colors\n')

# Process each color
results = []

for r, g, b in test_colors:
    # Convert RGB to LAB
    L, A, B = rgb_to_lab(r, g, b)

    # Compute LAB bin indices
    L_bin = int(L // 5)
    A_bin = int(A // 5) + 21
    B_bin = int(B // 5) + 21

    # Clamp to valid ranges
    L_bin = max(0, min(19, L_bin))
    A_bin = max(0, min(41, A_bin))
    B_bin = max(0, min(41, B_bin))

    # Compute index using MATLAB formula
    index = L_bin + 20 * A_bin + 20 * 42 * B_bin

    # Get probabilities
    probs = color_data.get(index)

    if probs:
        # Get top 3 colors
        sorted_colors = sorted(
            enumerate(probs),
            key=lambda x: x[1],
            reverse=True
        )
        top3 = sorted_colors[:3]

        results.append({
            'rgb': f'{r},{g},{b}',
            'lab': f'{L:.2f},{A:.2f},{B:.2f}',
            'bins': f'{L_bin},{A_bin},{B_bin}',
            'index': index,
            'top1': color_names[top3[0][0]],
            'top1_prob': f'{top3[0][1] * 100:.2f}',
            'top2': color_names[top3[1][0]],
            'top2_prob': f'{top3[1][1] * 100:.2f}',
            'top3': color_names[top3[2][0]],
            'top3_prob': f'{top3[2][1] * 100:.2f}'
        })
    else:
        print(f'ERROR: No data for RGB({r},{g},{b}) index={index}')

# Write results
output_path = os.path.join(os.path.dirname(__file__), 'results_python.txt')
with open(output_path, 'w') as f:
    for r in results:
        f.write(f"RGB({r['rgb']}) LAB({r['lab']}) bins({r['bins']}) index={r['index']} | "
                f"{r['top1']}:{r['top1_prob']}% {r['top2']}:{r['top2_prob']}% {r['top3']}:{r['top3_prob']}%\n")

print(f'Results written to {output_path}')
print(f'Processed {len(results)} colors successfully')
