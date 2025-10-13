// Polytope definitions with metadata
export const polytopeOptions = [
    {
        id: 'permutahedron',
        name: 'Permutahedron',
        description: 'Convex hull of permutations of [1,2,3,4]',
        active: true
    },
    {
        id: 'signed_permutahedron',
        name: 'Signed Permutahedron',
        description: 'Convex hull of permutations of [1,2,3] with signs'
    },
    {
        id: 'cube',
        name: 'Cube',
        description: '3D hypercube with 8 vertices'
    },
    {
        id: 'tetrahedron',
        name: 'Tetrahedron',
        description: 'Simplest 3D polytope with 4 vertices'
    },
    {
        id: 'octahedron',
        name: 'Octahedron',
        description: '8-faced regular solid'
    },
    {
        id: 'dodecahedron',
        name: 'Dodecahedron',
        description: '12 pentagonal faces'
    },
    {
        id: 'icosahedron',
        name: 'Icosahedron',
        description: '20 triangular faces'
    },
    {
        id: 'pentagonal_prism',
        name: 'Pentagonal Prism',
        description: '2 pentagonal and 5 rectangular faces'
    }
];

// Polytope vertex data
export const polytopeVertices = {
    permutahedron: [
  [ 1.0,  0.5,  0.0],
  [ 1.0, -0.5,  0.0],
  [-1.0,  0.5,  0.0],
  [-1.0, -0.5,  0.0],

  [ 1.0,  0.0,  0.5],
  [ 1.0,  0.0, -0.5],
  [-1.0,  0.0,  0.5],
  [-1.0,  0.0, -0.5],

  [ 0.5,  1.0,  0.0],
  [ 0.5, -1.0,  0.0],
  [-0.5,  1.0,  0.0],
  [-0.5, -1.0,  0.0],

  [ 0.5,  0.0,  1.0],
  [ 0.5,  0.0, -1.0],
  [-0.5,  0.0,  1.0],
  [-0.5,  0.0, -1.0],

  [ 0.0,  1.0,  0.5],
  [ 0.0,  1.0, -0.5],
  [ 0.0, -1.0,  0.5],
  [ 0.0, -1.0, -0.5],

  [ 0.0,  0.5,  1.0],
  [ 0.0,  0.5, -1.0],
  [ 0.0, -0.5,  1.0],
  [ 0.0, -0.5, -1.0]
    ],
    cube: [
        [ 1,  1,  1], [-1,  1,  1], [-1, -1,  1], [ 1, -1,  1],
        [ 1,  1, -1], [-1,  1, -1], [-1, -1, -1], [ 1, -1, -1]
    ],
    tetrahedron: [
        [ 1,  1,  1],
        [ 1, -1, -1],
        [-1,  1, -1],
        [-1, -1,  1]
    ],
    octahedron: [
        [ 1,  0,  0],
        [-1,  0,  0],
        [ 0,  1,  0],
        [ 0, -1,  0],
        [ 0,  0,  1],
        [ 0,  0, -1]
    ],
    dodecahedron: (() => {
        const phi = (1 + Math.sqrt(5)) / 2;
        const inv_phi = 1 / phi;
        return [
            // (±1, ±1, ±1)
            [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
            [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
            // (0, ±φ, ±1/φ)
            [0, phi, inv_phi], [0, phi, -inv_phi], [0, -phi, inv_phi], [0, -phi, -inv_phi],
            // (±1/φ, 0, ±φ)
            [inv_phi, 0, phi], [-inv_phi, 0, phi], [inv_phi, 0, -phi], [-inv_phi, 0, -phi],
            // (±φ, ±1/φ, 0)
            [phi, inv_phi, 0], [phi, -inv_phi, 0], [-phi, inv_phi, 0], [-phi, -inv_phi, 0]
        ];
    })(),
    icosahedron: (() => {
        // Golden ratio: φ = (1 + √5)/2
        const phi = (1 + Math.sqrt(5)) / 2;
        return [
            // (0, ±1, ±φ)
            [0, 1, phi], [0, 1, -phi], [0, -1, phi], [0, -1, -phi],
            // (±1, ±φ, 0)
            [1, phi, 0], [1, -phi, 0], [-1, phi, 0], [-1, -phi, 0],
            // (±φ, 0, ±1)
            [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1]
        ];
    })(),
    signed_permutahedron: [
        // All permutations of [1,2,3] with all sign combinations (48 vertices)
        [1, 2, 3], [1, 2, -3], [1, -2, 3], [1, -2, -3], [-1, 2, 3], [-1, 2, -3], [-1, -2, 3], [-1, -2, -3],
        [1, 3, 2], [1, 3, -2], [1, -3, 2], [1, -3, -2], [-1, 3, 2], [-1, 3, -2], [-1, -3, 2], [-1, -3, -2],
        [2, 1, 3], [2, 1, -3], [2, -1, 3], [2, -1, -3], [-2, 1, 3], [-2, 1, -3], [-2, -1, 3], [-2, -1, -3],
        [2, 3, 1], [2, 3, -1], [2, -3, 1], [2, -3, -1], [-2, 3, 1], [-2, 3, -1], [-2, -3, 1], [-2, -3, -1],
        [3, 1, 2], [3, 1, -2], [3, -1, 2], [3, -1, -2], [-3, 1, 2], [-3, 1, -2], [-3, -1, 2], [-3, -1, -2],
        [3, 2, 1], [3, 2, -1], [3, -2, 1], [3, -2, -1], [-3, 2, 1], [-3, 2, -1], [-3, -2, 1], [-3, -2, -1]
    ],
    pentagonal_prism: [
        // Top pentagon
        [Math.cos(0), Math.sin(0), 1],
        [Math.cos(2*Math.PI/5), Math.sin(2*Math.PI/5), 1],
        [Math.cos(4*Math.PI/5), Math.sin(4*Math.PI/5), 1],
        [Math.cos(6*Math.PI/5), Math.sin(6*Math.PI/5), 1],
        [Math.cos(8*Math.PI/5), Math.sin(8*Math.PI/5), 1],
        // Bottom pentagon
        [Math.cos(0), Math.sin(0), -1],
        [Math.cos(2*Math.PI/5), Math.sin(2*Math.PI/5), -1],
        [Math.cos(4*Math.PI/5), Math.sin(4*Math.PI/5), -1],
        [Math.cos(6*Math.PI/5), Math.sin(6*Math.PI/5), -1],
        [Math.cos(8*Math.PI/5), Math.sin(8*Math.PI/5), -1]
    ]
};

// Helper function to get vertices for a polytope
export function getPolytopeVertices(type) {
    return polytopeVertices[type] || polytopeVertices.permutahedron;
}