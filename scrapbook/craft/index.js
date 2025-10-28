import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { World } from './world.js'


// Create the Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: false, // Disable for better performance with many points
    powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild(renderer.domElement);

// Setup Camera
const camera = new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight);
camera.position.set(0,0,0);

// Scene Setup
const scene = new THREE.Scene();

// Setup Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 0.1;
controls.maxDistance = 500;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, -2);
scene.add(directionalLight);

// Create and generate the world
const world = new World(70);
world.generate();
scene.add(world);


// Color function: sin(t) applied to each point
function colorFunction(x, y, z, t) {
    // Example: sin wave based on distance from origin and time
    const dist = Math.sqrt(x*x + y*y + z*z);
    return (Math.sin(t + dist * 0.1) + 1) / 2; // Map [-1,1] to [0,1]
}

// Render Loop
let time = 0;

function animate(){
    requestAnimationFrame(animate);
    controls.update();

    // Update colors each frame
    time += 0.05;
    world.updateColors(colorFunction, time);

    renderer.render(scene,camera);
}

window.addEventListener('resize', () =>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
})

animate();
