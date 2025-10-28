import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { World } from './world.js'


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

// Create and generate the world
const world = new World(70);
world.generate();
scene.add(world);

// Expose world instance globally for equation handling
window.worldInstance = world;

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
    world.update(0.05);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
