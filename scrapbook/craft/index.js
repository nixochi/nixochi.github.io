import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { World } from './world.js'


// Create the Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: false, // Disable for better performance with many points
    powerPreference: "high-performance"
});
renderer.setPixelRatio(window.devicePixelRatio); // Cap at 2x for performance
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild(renderer.domElement);

// Setup Camera
const camera = new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight);
camera.position.set(0, -15, 15); // Position camera up and back to look down at the floor

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7EC8E3); // Sky blue

// Setup Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 0.1;
controls.maxDistance = 500;
controls.target.set(0, 0, 0); // Look at the center of the floor

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

// Create and generate the world
const world = new World(10);
world.generate();
scene.add(world);

// Render Loop
function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene,camera);
}

window.addEventListener('resize', () =>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
})

animate();
