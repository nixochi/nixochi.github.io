import * as THREE from 'three';

/**
 * World class - manages BCC lattice with GPU shader-based coloring
 * Extends THREE.Group for easy scene integration
 */
export class World extends THREE.Group {
    constructor(size = 5) {
        super();
        this.size = size;
        this.lattice = null;
        this.time = 0;
    }

    /**
     * Generate BCC lattice points using shader-based coloring
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
                                positions.push(x, y, z);
                            }
                        }
                    }
                }
            }
        }

        // Create instanced geometry
        const geometry = new THREE.InstancedBufferGeometry();

        // Base geometry: single point at origin
        const basePosition = new Float32Array([0, 0, 0]);
        geometry.setAttribute('position', new THREE.BufferAttribute(basePosition, 3));

        // Instance attribute: position for each instance
        const positionsArray = new Float32Array(positions);
        geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(positionsArray, 3));

        // Custom shader material with instancing
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 }
            },
            vertexShader: `
                attribute vec3 instancePosition;
                varying vec3 vPosition;

                void main() {
                    vPosition = instancePosition;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(instancePosition, 1.0);
                    gl_PointSize = 2.0;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vPosition;

                void main() {
                    // Optimized: combine distance calculation with wave
                    float dist = length(vPosition);
                    float value = sin(uTime + dist * 0.1) * 0.5 + 0.5;

                    // Interpolate between red (value=0) and blue (value=1)
                    gl_FragColor = vec4(1.0 - value, 0.0, value, 1.0);
                }
            `,
            depthTest: true,
            depthWrite: true,
            transparent: false
        });

        this.lattice = new THREE.Points(geometry, material);
        this.add(this.lattice);

        console.log(`Generated BCC lattice with ${positions.length / 3} points (size: ${this.size}) using instanced rendering + GPU shaders`);

        return this;
    }

    /**
     * Update shader time uniform
     * Call this each frame to animate the colors
     */
    update(deltaTime) {
        if (this.lattice && this.lattice.material.uniforms) {
            this.time += deltaTime;
            this.lattice.material.uniforms.uTime.value = this.time;
        }
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
     * Update the shader with a new equation
     * @param {string} glslCode - GLSL code for calculating the value (already clamped to [0,1])
     */
    updateEquation(glslCode) {
        if (!this.lattice) {
            console.warn('No lattice to update');
            return;
        }

        // Store current time value
        const currentTime = this.time;

        // Dispose old material
        this.lattice.material.dispose();

        // Create new material with updated equation
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: currentTime }
            },
            vertexShader: `
                attribute vec3 instancePosition;
                varying vec3 vPosition;

                void main() {
                    vPosition = instancePosition;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(instancePosition, 1.0);
                    gl_PointSize = 2.0;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vPosition;

                void main() {
                    // User-defined equation (already clamped to [0,1])
                    float value = ${glslCode};

                    // Interpolate between red (value=0) and blue (value=1)
                    gl_FragColor = vec4(1.0 - value, 0.0, value, 1.0);
                }
            `,
            depthTest: true,
            depthWrite: true,
            transparent: false
        });

        // Update lattice material
        this.lattice.material = material;

        console.log('Shader equation updated');
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
