#!/usr/bin/env python3

import sys

# Read both result files
with open('results_node.txt', 'r') as f:
    node_results = f.readlines()

with open('results_python.txt', 'r') as f:
    python_results = f.readlines()

print("=" * 80)
print("DETAILED COMPARISON: Node.js vs Python")
print("=" * 80)
print()

if len(node_results) != len(python_results):
    print(f"❌ Different number of results!")
    print(f"   Node.js: {len(node_results)} lines")
    print(f"   Python: {len(python_results)} lines")
    sys.exit(1)

total = len(node_results)
identical = 0
differences = []

for i, (node_line, python_line) in enumerate(zip(node_results, python_results), 1):
    node_line = node_line.strip()
    python_line = python_line.strip()

    if node_line == python_line:
        identical += 1
    else:
        differences.append({
            'line': i,
            'node': node_line,
            'python': python_line
        })

print(f"Total tests: {total}")
print(f"Identical: {identical} ({identical/total*100:.1f}%)")
print(f"Different: {len(differences)} ({len(differences)/total*100:.1f}%)")
print()

if identical == total:
    print("✅ ALL RESULTS MATCH PERFECTLY!")
    print()
    print("Sample results (first 5):")
    for line in node_results[:5]:
        print(f"  {line.strip()}")
else:
    print(f"❌ Found {len(differences)} differences")
    print()
    print("First 10 differences:")
    print()
    for diff in differences[:10]:
        print(f"Line {diff['line']}:")
        print(f"  Node:   {diff['node']}")
        print(f"  Python: {diff['python']}")
        print()
