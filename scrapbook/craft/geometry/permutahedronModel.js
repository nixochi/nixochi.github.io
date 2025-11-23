import * as THREE from 'three';
import { latticeToPosition } from '../utils.js';

// Truncated octahedron (BCC Voronoi cell) - all permutations of (±2, ±1, 0)
const permutahedronData = {
  "vertices": [
    [2,1,0],
    [2,-1,0],
    [-2,1,0],
    [-2,-1,0],
    [2,0,1],
    [2,0,-1],
    [-2,0,1],
    [-2,0,-1],
    [1,2,0],
    [1,-2,0],
    [-1,2,0],
    [-1,-2,0],
    [1,0,2],
    [1,0,-2],
    [-1,0,2],
    [-1,0,-2],
    [0,2,1],
    [0,2,-1],
    [0,-2,1],
    [0,-2,-1],
    [0,1,2],
    [0,1,-2],
    [0,-1,2],
    [0,-1,-2]
  ],
  "faces": [
    [15,21,13,23],
    [12,20,14,22],
    [5,1,9,19,23,13],
    [17,8,0,5,13,21],
    [11,3,7,15,23,19],
    [11,19,9,18],
    [6,3,11,18,22,14],
    [6,2,7,3],
    [4,12,22,18,9,1],
    [4,1,5,0],
    [10,17,21,15,7,2],
    [16,8,17,10],
    [16,10,2,6,14,20],
    [16,20,12,4,0,8]
  ]
};

/**
 * Triangulate a polygon face using fan triangulation
 * @param {number[]} face - Array of vertex indices
 * @returns {number[][]} Array of triangles, each as [i1, i2, i3]
 */
function triangulateFace(face) {
  const triangles = [];
  for (let i = 1; i < face.length - 1; i++) {
    triangles.push([face[0], face[i], face[i + 1]]);
  }
  return triangles;
}

/**
 * Create a Three.js BufferGeometry for the Permutahedron
 * @returns {THREE.BufferGeometry}
 */
export function PermutahedronGeometry() {
  const geometry = new THREE.BufferGeometry();

  // Collect all triangulated faces
  const triangles = [];
  for (const face of permutahedronData.faces) {
    triangles.push(...triangulateFace(face));
  }

  // Build position and index arrays
  const positions = [];
  const indices = [];

  // Add all vertices
  for (const vertex of permutahedronData.vertices) {
    positions.push(...vertex);
  }

  // Add all triangle indices
  for (const triangle of triangles) {
    indices.push(...triangle);
  }

  // Set attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  // Compute normals for lighting
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Create a complete Permutahedron mesh with material
 * @param {Object} options - Options for the mesh
 * @param {number} options.color - Hex color for the material
 * @param {boolean} options.wireframe - Whether to render as wireframe
 * @returns {THREE.Mesh}
 */
export function createPermutahedronMesh(options = {}) {
  const {
    color = 0x44aa88,
    wireframe = false
  } = options;

  const geometry = PermutahedronGeometry();
  const material = new THREE.MeshPhongMaterial({
    color: color,
    wireframe: wireframe,
    flatShading: false,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Create BufferGeometry for permutahedron edges
 * Extracts edges from face data
 * @returns {THREE.BufferGeometry}
 */
export function PermutahedronEdgesGeometry() {
  const edgeSet = new Set();

  // Extract edges from each face
  for (const face of permutahedronData.faces) {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      // Store edge with smaller index first for uniqueness
      const edge = v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
      edgeSet.add(edge);
    }
  }

  // Convert to array of [start, end] pairs
  const edges = Array.from(edgeSet).map(e => e.split(',').map(Number));

  const positions = [];
  for (const [start, end] of edges) {
    const v1 = permutahedronData.vertices[start];
    const v2 = permutahedronData.vertices[end];
    positions.push(...v1, ...v2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  return geometry;
}

/**
 * Create a wireframe representation of the permutahedron edges
 * @param {Object} options - Options for the edges
 * @param {number} options.color - Hex color for the edges
 * @returns {THREE.LineSegments}
 */
export function createPermutahedronEdges(options = {}) {
  const { color = 0x000000 } = options;
  const geometry = PermutahedronEdgesGeometry();
  const material = new THREE.LineBasicMaterial({ color: color });
  return new THREE.LineSegments(geometry, material);
}

/**
 * Create a complete permutahedron with mesh and edges in a group
 * @param {Object} options - Options for the permutahedron
 * @param {number} options.color - Hex color for the mesh material
 * @param {number} options.edgeColor - Hex color for the edges
 * @param {boolean} options.wireframe - Whether to render mesh as wireframe
 * @param {Object} options.latticePosition - BCC lattice coordinates {a, b, c}
 * @returns {THREE.Group}
 */
export function createPermutahedron(options = {}) {
  const {
    color = 0x44aa88,
    edgeColor = 0x000000,
    wireframe = false,
    latticePosition = { i: 0, j: 0, k: 0 }
  } = options;

  const group = new THREE.Group();

  const mesh = createPermutahedronMesh({ color, wireframe: false });
  const edges = createPermutahedronEdges({ color: edgeColor });

  if (wireframe) {
    mesh.visible = false;
  }

  group.add(mesh);
  group.add(edges);

  const { i, j, k } = latticePosition;
  const pos = latticeToPosition(i, j, k);
  group.position.set(pos.x, pos.y, pos.z);

  return group;
}
