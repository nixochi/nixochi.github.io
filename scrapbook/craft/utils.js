// Lattice basis vectors:
// v₁ = (4,0,0)
// v₂ = (0,4,0)
// v₃ = (2,2,2)

export function latticeToPosition(i, j, k) {
    return {
        x: 4*i + 2*k,
        y: 4*j + 2*k,
        z: 2*k
    };
}
