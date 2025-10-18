import scipy.io
import numpy as np

def rgb_to_xyz(r, g, b):
    """Convert RGB (0-255) to XYZ color space"""
    # Normalize to 0-1
    r, g, b = r/255.0, g/255.0, b/255.0

    # Apply gamma correction
    r = ((r + 0.055) / 1.055) ** 2.4 if r > 0.04045 else r / 12.92
    g = ((g + 0.055) / 1.055) ** 2.4 if g > 0.04045 else g / 12.92
    b = ((b + 0.055) / 1.055) ** 2.4 if b > 0.04045 else b / 12.92

    # Convert to XYZ using sRGB matrix
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

    return x * 100, y * 100, z * 100

def xyz_to_lab(x, y, z):
    """Convert XYZ to LAB color space"""
    # Reference white D65
    xn, yn, zn = 95.047, 100.000, 108.883

    x, y, z = x/xn, y/yn, z/zn

    # Apply LAB function
    def f(t):
        return t ** (1/3) if t > 0.008856 else (7.787 * t + 16/116)

    fx, fy, fz = f(x), f(y), f(z)

    L = 116 * fy - 16
    A = 500 * (fx - fy)
    B = 200 * (fy - fz)

    return L, A, B

def rgb_to_lab(r, g, b):
    """Convert RGB (0-255) to LAB color space"""
    x, y, z = rgb_to_xyz(r, g, b)
    return xyz_to_lab(x, y, z)

# Load the MATLAB file
mat_data = scipy.io.loadmat('../39/w2c39.mat')

# Print keys to see what's in the file
print("Keys in mat file:", mat_data.keys())

# Get the matrix (usually the non-metadata key)
for key in mat_data.keys():
    if not key.startswith('__'):
        print(f"Found data key: {key}")
        data = mat_data[key]
        print(f"Shape: {data.shape}")
        print(f"Data type: {data.dtype}")
        print(f"Expected: 20*42*42 = {20*42*42}")

        # The data is indexed by LAB space: index_im = 1+floor(L/5)+20*(floor(A/5)+21)+20*42*(floor(B/5)+21)
        # L: 0-100 -> bins 0-19 (20 bins)
        # A: -105 to +105 -> bins 0-41 (42 bins)
        # B: -105 to +105 -> bins 0-41 (42 bins)
        # Total: 20*42*42 = 35,280 entries

        # Write the matrix directly indexed by LAB bins
        # Format: index <space> prob1 prob2 ... prob39
        with open('w2c39.txt', 'w') as f:
            for index in range(data.shape[0]):
                # Normalize probabilities to sum to 1
                probs_array = data[index]
                prob_sum = probs_array.sum()
                if prob_sum > 0:
                    normalized_probs = probs_array / prob_sum
                else:
                    normalized_probs = probs_array

                # Write index and normalized probabilities
                probs = ' '.join(f'{p:.6f}' for p in normalized_probs)
                f.write(f'{index} {probs}\n')

        print(f"Wrote w2c39.txt with {data.shape[0]} LAB-indexed entries")