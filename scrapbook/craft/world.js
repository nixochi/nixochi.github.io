import * as THREE from 'three';

/**
 * World class - manages BCC lattice and world generation
 * Extends THREE.Group for easy scene integration
 */
export class World extends THREE.Group {
    constructor(size = 5) {
        super();
        this.size = size;
        this.lattice = null;
    }

    /**
     * Generate BCC lattice points using InstancedMesh for performance
     */
    generate() {
        // Clear existing lattice if any
        if (this.lattice) {
            this.remove(this.lattice);
            this.lattice.geometry.dispose();
            this.lattice.material.dispose();
        }

        const positions = [];
        const halfSize = this.size;

        // BCC lattice: points where (x + y + z) is even
        for (let xo = 0; xo < 2; xo++) {
            for (let yo = 0; yo < 2; yo++) {
                for (let zo = 0; zo < 2; zo++) {
                    // Only keep offsets where sum is even (BCC condition)
                    if ((xo + yo + zo) % 2 !== 0) continue;

                    // Generate lattice points with this offset, stepping by 2
                    for (let x = -halfSize + xo; x <= halfSize; x += 2) {
                        for (let y = -halfSize + yo; y <= halfSize; y += 2) {
                            for (let z = -halfSize + zo; z <= halfSize; z += 2) {
                                positions.push({ x, y, z });
                            }
                        }
                    }
                }
            }
        }

        // Use Points for maximum performance with large counts
        const geometry = new THREE.BufferGeometry();

        // Convert positions to Float32Array for better performance
        const positionsArray = new Float32Array(positions.length * 3);
        positions.forEach((pos, i) => {
            positionsArray[i * 3] = pos.x;
            positionsArray[i * 3 + 1] = pos.y;
            positionsArray[i * 3 + 2] = pos.z;
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));

        // Add color attribute (will be updated per frame)
        const colorsArray = new Float32Array(positions.length * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

        const material = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: false,
            vertexColors: true // Enable per-vertex colors
        });

        this.lattice = new THREE.Points(geometry, material);

        // Store positions for color calculation
        this.positions = positions;

        this.add(this.lattice);

        console.log(`Generated BCC lattice with ${positions.length} points (size: ${this.size})`);

        return this;
    }

    /**
     * Update colors based on a function that returns [0,1]
     * @param {Function} colorFunc - Function that takes (x, y, z, t) and returns value in [0,1]
     * @param {number} time - Current time value
     */
    updateColors(colorFunc, time = 0) {
        if (!this.lattice || !this.positions) return;

        const colorAttribute = this.lattice.geometry.getAttribute('color');
        const colors = colorAttribute.array;

        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];

            // Get value from function and clamp to [0,1]
            let value = colorFunc(pos.x, pos.y, pos.z, time);
            value = Math.max(0, Math.min(1, value));

            // Interpolate between red (value=0) and blue (value=1)
            const r = 1 - value; // Red decreases
            const g = 0;         // No green
            const b = value;     // Blue increases

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }

        colorAttribute.needsUpdate = true;
    }

    /**
     * Update the world size and regenerate
     */
    setSize(newSize) {
        this.size = newSize;
        this.generate();
        return this;
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.lattice) {
            this.lattice.geometry.dispose();
            this.lattice.material.dispose();
            this.remove(this.lattice);
        }
    }
}
