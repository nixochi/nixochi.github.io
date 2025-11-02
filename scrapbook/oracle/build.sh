#!/bin/bash

# Build the WASM module
wasm-pack build --target web --out-dir pkg

echo "Build complete! The WASM module is in the pkg/ directory."
