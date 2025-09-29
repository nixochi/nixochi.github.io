// Polytope definitions with metadata
export const polytopeOptions = [
    {
        id: 'permutahedron',
        name: 'Permutahedron',
        icon: '🔄',
        description: 'Convex hull of permutations of [1,2,3,4]',
        active: true
    },
    {
        id: 'cube',
        name: 'Cube',
        icon: '🧊',
        description: '3D hypercube with 8 vertices'
    },
    {
        id: 'tetrahedron',
        name: 'Tetrahedron',
        icon: '🔺',
        description: 'Simplest 3D polytope with 4 vertices'
    },
    {
        id: 'octahedron',
        name: 'Octahedron',
        icon: '💎',
        description: '8-faced regular solid'
    },
    {
        id: 'dodecahedron',
        name: 'Dodecahedron',
        icon: '⚽',
        description: '12 pentagonal faces'
    },
    {
        id: 'icosahedron',
        name: 'Icosahedron',
        icon: '🔮',
        description: '20 triangular faces'
    },
    {
        id: 'tesseract',
        name: 'Tesseract',
        icon: '📦',
        description: '4D hypercube projection'
    },
    {
        id: 'truncated_tetrahedron',
        name: 'Truncated Tetrahedron',
        icon: '🔶',
        description: '4 triangular and 4 hexagonal faces'
    },
    {
        id: 'cuboctahedron',
        name: 'Cuboctahedron',
        icon: '🔹',
        description: '8 triangular and 6 square faces'
    },
    {
        id: 'truncated_cube',
        name: 'Truncated Cube',
        icon: '🟫',
        description: '8 triangular and 6 octagonal faces'
    },
    {
        id: 'snub_cube',
        name: 'Snub Cube',
        icon: '🎲',
        description: '32 triangular and 6 square faces'
    },
    {
        id: 'rhombicuboctahedron',
        name: 'Rhombicuboctahedron',
        icon: '💠',
        description: '8 triangular and 18 square faces'
    },
    {
        id: 'pentagonal_prism',
        name: 'Pentagonal Prism',
        icon: '🏛️',
        description: '2 pentagonal and 5 rectangular faces'
    }
];

// Polytope vertex data
export const polytopeVertices = {
    permutahedron: [
  [-2.121320343559642, -0.408248290463863,  0.577350269189626],
  [-2.121320343559642,  0.408248290463863, -0.577350269189626],
  [-1.414213562373095, -1.632993161855452,  0.577350269189626],
  [-1.414213562373095,  0.000000000000000, -1.732050807568877],
  [-1.414213562373095,  0.000000000000000,  1.732050807568877],
  [-1.414213562373095,  1.632993161855452, -0.577350269189626],
  [-0.707106781186548, -2.041241452319315, -0.577350269189626],
  [-0.707106781186548, -1.224744871391589, -1.732050807568877],
  [-0.707106781186548, -1.224744871391589,  1.732050807568877],
  [-0.707106781186548,  1.224744871391589, -1.732050807568877],
  [-0.707106781186548,  1.224744871391589,  1.732050807568877],
  [-0.707106781186548,  2.041241452319315,  0.577350269189626],
  [ 0.707106781186548, -2.041241452319315, -0.577350269189626],
  [ 0.707106781186548, -1.224744871391589, -1.732050807568877],
  [ 0.707106781186548, -1.224744871391589,  1.732050807568877],
  [ 0.707106781186548,  1.224744871391589, -1.732050807568877],
  [ 0.707106781186548,  1.224744871391589,  1.732050807568877],
  [ 0.707106781186548,  2.041241452319315,  0.577350269189626],
  [ 1.414213562373095, -1.632993161855452,  0.577350269189626],
  [ 1.414213562373095,  0.000000000000000, -1.732050807568877],
  [ 1.414213562373095,  0.000000000000000,  1.732050807568877],
  [ 1.414213562373095,  1.632993161855452, -0.577350269189626],
  [ 2.121320343559642, -0.408248290463863,  0.577350269189626],
  [ 2.121320343559642,  0.408248290463863, -0.577350269189626]
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
    dodecahedron: [
        // Golden ratio approximation for dodecahedron vertices
        [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
        [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
        [0, 1.618, 0.618], [0, 1.618, -0.618], [0, -1.618, 0.618], [0, -1.618, -0.618],
        [0.618, 0, 1.618], [-0.618, 0, 1.618], [0.618, 0, -1.618], [-0.618, 0, -1.618],
        [1.618, 0.618, 0], [1.618, -0.618, 0], [-1.618, 0.618, 0], [-1.618, -0.618, 0]
    ],
    icosahedron: [
        // Golden ratio based icosahedron
        [0, 1, 1.618], [0, 1, -1.618], [0, -1, 1.618], [0, -1, -1.618],
        [1, 1.618, 0], [1, -1.618, 0], [-1, 1.618, 0], [-1, -1.618, 0],
        [1.618, 0, 1], [1.618, 0, -1], [-1.618, 0, 1], [-1.618, 0, -1]
    ],
    tesseract: [
        // 4D tesseract projected to 3D
        [ 1,  1,  1], [-1,  1,  1], [-1, -1,  1], [ 1, -1,  1],
        [ 1,  1, -1], [-1,  1, -1], [-1, -1, -1], [ 1, -1, -1],
        [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5], [-0.5, -0.5,  0.5], [ 0.5, -0.5,  0.5],
        [ 0.5,  0.5, -0.5], [-0.5,  0.5, -0.5], [-0.5, -0.5, -0.5], [ 0.5, -0.5, -0.5]
    ],
    truncated_tetrahedron: [
        [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
        [0, 1/Math.sqrt(3), 2*Math.sqrt(2/3)], [0, -1/Math.sqrt(3), -2*Math.sqrt(2/3)],
        [2*Math.sqrt(2/3), 0, 1/Math.sqrt(3)], [-2*Math.sqrt(2/3), 0, -1/Math.sqrt(3)],
        [1/Math.sqrt(3), 2*Math.sqrt(2/3), 0], [-1/Math.sqrt(3), -2*Math.sqrt(2/3), 0]
    ],
    cuboctahedron: [
        [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
        [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
        [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]
    ],
    truncated_cube: [
        [1, 1, Math.sqrt(2)+1], [1, -1, Math.sqrt(2)+1], [-1, 1, Math.sqrt(2)+1], [-1, -1, Math.sqrt(2)+1],
        [1, 1, -(Math.sqrt(2)+1)], [1, -1, -(Math.sqrt(2)+1)], [-1, 1, -(Math.sqrt(2)+1)], [-1, -1, -(Math.sqrt(2)+1)],
        [Math.sqrt(2)+1, 1, 1], [Math.sqrt(2)+1, -1, 1], [-(Math.sqrt(2)+1), 1, 1], [-(Math.sqrt(2)+1), -1, 1],
        [Math.sqrt(2)+1, 1, -1], [Math.sqrt(2)+1, -1, -1], [-(Math.sqrt(2)+1), 1, -1], [-(Math.sqrt(2)+1), -1, -1],
        [1, Math.sqrt(2)+1, 1], [-1, Math.sqrt(2)+1, 1], [1, -(Math.sqrt(2)+1), 1], [-1, -(Math.sqrt(2)+1), 1],
        [1, Math.sqrt(2)+1, -1], [-1, Math.sqrt(2)+1, -1], [1, -(Math.sqrt(2)+1), -1], [-1, -(Math.sqrt(2)+1), -1]
    ],
    snub_cube: [
        // Simplified snub cube vertices
        [1, 1/1.618, 1.618], [1, -1/1.618, 1.618], [-1, 1/1.618, 1.618], [-1, -1/1.618, 1.618],
        [1, 1/1.618, -1.618], [1, -1/1.618, -1.618], [-1, 1/1.618, -1.618], [-1, -1/1.618, -1.618],
        [1.618, 1, 1/1.618], [1.618, -1, 1/1.618], [-1.618, 1, 1/1.618], [-1.618, -1, 1/1.618],
        [1.618, 1, -1/1.618], [1.618, -1, -1/1.618], [-1.618, 1, -1/1.618], [-1.618, -1, -1/1.618],
        [1/1.618, 1.618, 1], [-1/1.618, 1.618, 1], [1/1.618, -1.618, 1], [-1/1.618, -1.618, 1],
        [1/1.618, 1.618, -1], [-1/1.618, 1.618, -1], [1/1.618, -1.618, -1], [-1/1.618, -1.618, -1]
    ],
    rhombicuboctahedron: [
        [1+Math.sqrt(2), 1, 1], [1+Math.sqrt(2), 1, -1], [1+Math.sqrt(2), -1, 1], [1+Math.sqrt(2), -1, -1],
        [-(1+Math.sqrt(2)), 1, 1], [-(1+Math.sqrt(2)), 1, -1], [-(1+Math.sqrt(2)), -1, 1], [-(1+Math.sqrt(2)), -1, -1],
        [1, 1+Math.sqrt(2), 1], [1, 1+Math.sqrt(2), -1], [-1, 1+Math.sqrt(2), 1], [-1, 1+Math.sqrt(2), -1],
        [1, -(1+Math.sqrt(2)), 1], [1, -(1+Math.sqrt(2)), -1], [-1, -(1+Math.sqrt(2)), 1], [-1, -(1+Math.sqrt(2)), -1],
        [1, 1, 1+Math.sqrt(2)], [-1, 1, 1+Math.sqrt(2)], [1, -1, 1+Math.sqrt(2)], [-1, -1, 1+Math.sqrt(2)],
        [1, 1, -(1+Math.sqrt(2))], [-1, 1, -(1+Math.sqrt(2))], [1, -1, -(1+Math.sqrt(2))], [-1, -1, -(1+Math.sqrt(2))]
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