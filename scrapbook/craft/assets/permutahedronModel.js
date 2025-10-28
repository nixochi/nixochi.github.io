import * as THREE from 'three';

// Permutahedron polytope data
const permutahedronData = {
  "vertices": [
    [1,0.5,0],
    [1,-0.5,0],
    [-1,0.5,0],
    [-1,-0.5,0],
    [1,0,0.5],
    [1,0,-0.5],
    [-1,0,0.5],
    [-1,0,-0.5],
    [0.5,1,0],
    [0.5,-1,0],
    [-0.5,1,0],
    [-0.5,-1,0],
    [0.5,0,1],
    [0.5,0,-1],
    [-0.5,0,1],
    [-0.5,0,-1],
    [0,1,0.5],
    [0,1,-0.5],
    [0,-1,0.5],
    [0,-1,-0.5],
    [0,0.5,1],
    [0,0.5,-1],
    [0,-0.5,1],
    [0,-0.5,-1]
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
 * Create a wireframe representation of the permutahedron edges
 * @param {Object} options - Options for the edges
 * @param {number} options.color - Hex color for the edges
 * @returns {THREE.LineSegments}
 */
export function createPermutahedronEdges(options = {}) {
  const { color = 0x000000 } = options;

  const edges = [
    [15,21], [13,21], [13,23], [15,23],
    [12,20], [14,20], [14,22], [12,22],
    [1,5], [1,9], [9,19], [19,23], [5,13],
    [8,17], [0,8], [0,5], [17,21],
    [3,11], [3,7], [7,15], [11,19],
    [9,18], [11,18], [3,6], [18,22], [6,14],
    [2,6], [2,7], [4,12], [1,4], [0,4],
    [10,17], [2,10], [8,16], [10,16], [16,20]
  ];

  const positions = [];
  for (const [start, end] of edges) {
    const v1 = permutahedronData.vertices[start];
    const v2 = permutahedronData.vertices[end];
    positions.push(...v1, ...v2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({ color: color });

  return new THREE.LineSegments(geometry, material);
}
