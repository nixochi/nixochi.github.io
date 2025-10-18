#!/bin/bash

echo "=========================================="
echo "Running Color Recognition Tests"
echo "=========================================="
echo ""

# Run Node.js test
echo "Running Node.js test..."
node test_node.js
echo ""

# Run Python test
echo "Running Python test..."
python3 test_python.py
echo ""

# Detailed comparison
python3 compare_detailed.py
