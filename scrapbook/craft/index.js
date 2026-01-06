import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { World } from './world.js'
import Stats from 'three/addons/libs/stats.module.js'
import { createUI } from './ui.js';

const stats = new Stats();
document.body.append(stats.dom);

// Create the Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio); 
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild(renderer.domElement);

// Setup Camera
const camera = new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight);
camera.position.set(0, -15, 15); 

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

const world = new World();
world.generate();
scene.add(world);

function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene,camera);
    stats.update();
}

window.addEventListener('resize', () =>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
})

createUI(world)
animate();
