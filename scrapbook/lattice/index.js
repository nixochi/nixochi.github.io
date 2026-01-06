/*
animate the BCC lattice with simple functions. inspired (as in its a complete rip-off)
of tixy.land.
*/

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Create the Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
    stencil: false, // Disable stencil buffer
    depth: true
});
renderer.setPixelRatio(1); // Force 1x for maximum performance
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Setup Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(100, 100, 100);

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Setup Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false; // Disable panning
controls.target.set(0, 0, 0); // Look at center
controls.minDistance = 0.1;
controls.maxDistance = 500;

// BCC Lattice variables
let lattice = null;
let time = 0;
const size = 70;

// Generate BCC lattice points
function generateLattice() {
    const positions = [];
    const halfSize = size;

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
                // Radial wave equation: sin(t + sqrt(x^2+y^2+z^2)*10)*0.5 + 0.5
                // Where x,y,z are in [-1,1], so we normalize vPosition by 70.0
                float value = sin(uTime + length(vPosition) / 70.0 * 10.0) * 0.5 + 0.5;

                // Interpolate between red (value=0) and blue (value=1)
                gl_FragColor = vec4(1.0 - value, 0.0, value, 1.0);
            }
        `,
        depthTest: true,
        depthWrite: true,
        transparent: false
    });

    lattice = new THREE.Points(geometry, material);
    scene.add(lattice);

    console.log(`Generated BCC lattice with ${positions.length / 3} points (size: ${size}) using instanced rendering + GPU shaders`);
}

// Update shader with a new equation
function updateEquation(glslCode) {
    if (!lattice) {
        console.warn('No lattice to update');
        return;
    }

    // Store current time value
    const currentTime = time;

    // Dispose old material
    lattice.material.dispose();

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
    lattice.material = material;

    console.log('Shader equation updated');
}

// Generate the lattice
generateLattice();

// Expose for equation handling
window.worldInstance = { updateEquation };

console.log('Shader-based BCC lattice initialized');
console.log('Colors are calculated entirely on the GPU!');

// Render Loop
function animate() {
    requestAnimationFrame(animate);

    // Only update controls if damping is enabled
    if (controls.enableDamping) {
        controls.update();
    }

    // Update shader time (only updates a single uniform, not 650k colors!)
    if (lattice && lattice.material.uniforms) {
        time += 0.05;
        lattice.material.uniforms.uTime.value = time;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
