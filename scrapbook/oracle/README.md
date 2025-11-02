# Oracle - Poset Characteristic Polynomial Calculator

A WebAssembly-powered tool for computing characteristic polynomials of partially ordered sets (posets).

## Prerequisites

- Rust (install from https://rustup.rs/)
- wasm-pack (install with `cargo install wasm-pack`)

## Building

Run the build script:

```bash
./build.sh
```

Or manually:

```bash
wasm-pack build --target web --out-dir pkg
```

This will generate the WASM module in the `pkg/` directory.

## Usage

The WASM module exports a function `compute_characteristic_polynomial(matrix, size)` that takes:
- `matrix`: A flat array representing the adjacency matrix of the poset (row-major order)
- `size`: The size of the poset (number of elements)

Returns: A string representation of the characteristic polynomial.

### Example

```javascript
import init, { compute_characteristic_polynomial } from './pkg/oracle_wasm.js';

await init();

// Example: Chain poset 0 < 1 < 2
const matrix = new Uint8Array([
    1, 1, 1,
    0, 1, 1,
    0, 0, 1,
]);

const result = compute_characteristic_polynomial(matrix, 3);
console.log(result); // Outputs the characteristic polynomial
```

## Poset Input Format

The adjacency matrix should represent the transitive closure of the poset relation:
- `matrix[i][j] = 1` if element i ≤ element j in the poset
- `matrix[i][j] = 0` otherwise

The matrix should be reflexive (diagonal elements are 1).

## Next Steps

- Connect the WASM module to the search bar UI
- Add poset visualization
- Support different input formats (Hasse diagram, etc.)
