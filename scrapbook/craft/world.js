import * as THREE from 'three';
import { PermutahedronGeometry, PermutahedronEdgesGeometry } from './geometry/permutahedronModel.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { latticeToPosition } from './utils.js';
import { RNG } from './rng.js';

export class World extends THREE.Group {
    /**
     * @type {{
     * id: number,
     * instanceId: number
     * }[][][]}
     */
    data;


    params = {
        seed: 0,
        terrain: {
            scale: 30,
            magnitude: 0.5,
            offset: 0.2
        }
    };

    constructor(width = 5, length = 5, height = 5) {
        super();
        this.size = { width, length, height};
        this.instancedMesh = null;
        this.data = [];
    }

    generate(){
        this.generateTerrain();
        this.generateMeshes();
    }
    
    /**
     * Initialize the world terrain data
     */
    initializeTerrain(){
        this.data = [];
        for (let x = 0; x < this.size.width; x++){
            const slice = [];
            for (let y = 0; y < this.size.height; y++){
                const row = [];
                for (let z = 0; z < this.size.length; z++){
                    row.push({
                        id: 0,
                        instanceId: null
                    });
                }
                slice.push(row);
            }
            this.data.push(slice);
        }
    }

    generateTerrain(){
        const rng = new RNG(this.params.seed);
        this.initializeTerrain();
        const simplex = new SimplexNoise(rng);

        for (let x = 0; x < this.size.width; x++){
            for (let z = 0; z < this.size.length; z++){
                const value = simplex.noise(
                    x / this.params.terrain.scale,
                    z / this.params.terrain.scale
                );

                const scaledNoise = this.params.terrain.offset +
                    this.params.terrain.magnitude * value;

                let height = Math.floor(this.size.height * scaledNoise);
                height = Math.max(0, Math.min(height, this.size.height - 1));

                for (let y = 0; y <= height; y++){
                    this.setBlockId(x, y, z, 1);
                }
            }
        }
    }

    generateMeshes() {
        if (this.instancedMesh) {
            this.remove(this.instancedMesh);
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
        }

        const count = this.size.width * this.size.length * this.size.height;
        const geometry = PermutahedronGeometry();
        const material = new THREE.MeshPhongMaterial({
            color: 0x44aa88,
            flatShading: true,
            side: THREE.DoubleSide
        });

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);

        const matrix = new THREE.Matrix4();
        let instanceId = 0;

        for (let i = 0; i < this.size.width; i++) {
            for (let j = 0; j < this.size.length; j++) {
                for (let k = 0; k < this.size.height; k++) {
                    const block = this.getBlock(i, j, k);

                    if (block && block.id !== 0) {
                        const pos = latticeToPosition(i, j, k);
                        matrix.setPosition(pos.x, pos.y, pos.z);
                        this.instancedMesh.setMatrixAt(instanceId, matrix);
                        this.setBlockInstanceId(i, j, k, instanceId);
                        instanceId++;
                    }
                }
            }
        }

        this.instancedMesh.count = instanceId;

        this.instancedMesh.instanceMatrix.needsUpdate = true;

        this.add(this.instancedMesh);

        return this;
    }

    dispose() {
        if (this.instancedMesh) {
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
            this.remove(this.instancedMesh);
            this.instancedMesh = null;
        }
    }

    getBlock(x,y,z){
        if (this.inBounds(x,y,z)){
            return this.data[x][y][z]
        }
        else{
            return null;
        }
    }

    inBounds(x,y,z){
        if (x >= 0 && x < this.size.width &&
            y >= 0 && y < this.size.height &&
            z >= 0 && z < this.size.length){
            return true;
        }
        else{
            return false;
        }
    }

    setBlockId(x,y,z,id){
        if (this.inBounds(x,y,z)){
            this.data[x][y][z].id = id;
        }
    }
    
    setBlockInstanceId(x,y,z,instanceId){
        if (this.inBounds(x,y,z)){
            this.data[x][y][z].instanceId = instanceId;
        }
    }
}


