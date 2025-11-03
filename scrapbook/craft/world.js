import * as THREE from 'three';
import { createPermutahedron } from './assets/permutahedronModel.js';

/**
 * World class - manages permutahedra placement
 * Extends THREE.Group for easy scene integration
 */
export class World extends THREE.Group {
    constructor(size = 5) {
        super();
        this.size = size;
        this.permutahedra = [];
    }

    /**
     * Generate a floor of permutahedra in a BCC lattice pattern
     */
    generate() {
        // Clear existing permutahedra if any
        this.permutahedra.forEach(item => {
            this.remove(item);
            if (item.geometry) item.geometry.dispose();
            if (item.material) item.material.dispose();
        });
        this.permutahedra = [];

        const positions = [];
        const halfSize = this.size;

        // BCC lattice on a floor: single layer (z fixed), points where (x + y + z) is even
        // We'll use z = 0, so we need x + y to be even
        for (let xo = 0; xo < 2; xo++) {
            for (let yo = 0; yo < 2; yo++) {
                const zo = 0; // Floor layer

                // Only keep offsets where sum is even (BCC condition)
                if ((xo + yo + zo) % 2 !== 0) continue;

                // Generate lattice points with this offset, stepping by 2
                for (let x = -halfSize + xo; x <= halfSize; x += 2) {
                    for (let y = -halfSize + yo; y <= halfSize; y += 2) {
                        positions.push({ x, y, z: 0 });
                    }
                }
            }
        }

        // Create permutahedra at each position
        positions.forEach((pos, index) => {
            // Generate a unique color for each permutahedron using HSL
            const hue = (index * 137.5) % 360; // Golden angle for nice distribution
            const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.5);

            const permutahedron = createPermutahedron({
                color: color.getHex(),
                edgeColor: 0x000000
            });

            permutahedron.position.set(pos.x, pos.y, pos.z);
            permutahedron.scale.setScalar(1.0);

            this.add(permutahedron);
            this.permutahedra.push(permutahedron);
        });

        console.log(`Generated floor with ${this.permutahedra.length} permutahedra (${this.size}x${this.size} BCC grid)`);

        return this;
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.permutahedra.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.remove(mesh);
        });
        this.permutahedra = [];
    }
}
