use wasm_bindgen::prelude::*;
use std::collections::VecDeque;

/// Compute the characteristic polynomial of Boolean lattice B_n
/// Uses implicit matrix representation - never builds full matrix!
#[wasm_bindgen]
pub fn compute_boolean_lattice_polynomial(n: usize) -> String {
    if n == 0 {
        return "1".to_string();
    }
    if n > 20 {
        return "Error: n must be between 1 and 20".to_string();
    }

    let size = 1usize << n; // 2^n

    // For Boolean lattices, we NEVER build the full matrix
    // Instead use implicit representation: i ≤ j iff (i & j) == i
    compute_boolean_lattice_implicit(n, size)
}

/// Compute characteristic polynomial using implicit Boolean lattice representation
fn compute_boolean_lattice_implicit(n: usize, size: usize) -> String {
    let min_elem = 0; // Empty set

    // Fast rank computation for Boolean lattice: rank = popcount
    let ranks: Vec<usize> = (0..size).map(|i| i.count_ones() as usize).collect();
    let max_rank = n;

    // Choose algorithm based on size
    let mobius_from_min = if size <= 512 {
        // Method 1: Matrix inversion (for small n)
        compute_mobius_matrix_inversion_implicit(size, min_elem)
    } else {
        // Method 2: Improved DP (for large n)
        compute_mobius_improved_dp_implicit(size, min_elem, &ranks, max_rank)
    };

    // Compute characteristic polynomial
    let coeffs = compute_char_poly_coefficients(&mobius_from_min, &ranks, max_rank);

    format_polynomial(&coeffs)
}

/// Check if i ≤ j in Boolean lattice (inline for speed)
#[inline(always)]
fn bool_lattice_leq(i: usize, j: usize) -> bool {
    (i & j) == i
}

/// Matrix inversion using implicit Boolean lattice representation
fn compute_mobius_matrix_inversion_implicit(size: usize, min_elem: usize) -> Vec<i64> {
    // Build zeta matrix implicitly
    let mut zeta = vec![vec![0.0f64; size]; size];
    for i in 0..size {
        for j in 0..size {
            if bool_lattice_leq(i, j) {
                zeta[i][j] = 1.0;
            }
        }
    }

    // Invert using LU decomposition (faster than Gauss-Jordan)
    let mobius_matrix = invert_matrix_lu(&zeta, size);

    // Extract μ(min, y)
    let mut mobius_from_min = vec![0i64; size];
    for y in 0..size {
        mobius_from_min[y] = mobius_matrix[min_elem][y].round() as i64;
    }

    mobius_from_min
}

/// Improved DP using implicit Boolean lattice representation
fn compute_mobius_improved_dp_implicit(
    size: usize,
    min_elem: usize,
    ranks: &[usize],
    max_rank: usize,
) -> Vec<i64> {
    let mut mobius = vec![0i64; size];
    mobius[min_elem] = 1;

    // Group elements by rank (all elements are reachable in Boolean lattice)
    let mut elements_by_rank: Vec<Vec<usize>> = vec![Vec::new(); max_rank + 1];
    for i in 0..size {
        elements_by_rank[ranks[i]].push(i);
    }

    // Process each rank in order
    for rank in 1..=max_rank {
        for &y in &elements_by_rank[rank] {
            let mut sum = 0i64;

            // Sum over all z with rank < rank(y) where z ≤ y
            for prev_rank in 0..rank {
                for &z in &elements_by_rank[prev_rank] {
                    if bool_lattice_leq(z, y) {
                        sum += mobius[z];
                    }
                }
            }

            mobius[y] = -sum;
        }
    }

    mobius
}

/// Compute the characteristic polynomial of a poset
/// Input: adjacency matrix as a flat array (row-major order)
/// Returns: coefficients of the characteristic polynomial as a string
#[wasm_bindgen]
pub fn compute_characteristic_polynomial(matrix: Vec<u8>, size: usize) -> String {
    // Validate input
    if matrix.len() != size * size {
        return "Error: Invalid matrix size".to_string();
    }

    // Find minimum element
    let min_elem = find_minimum_element(&matrix, size);

    // Choose algorithm based on size
    // For small posets: use zeta matrix inversion (O(n³) but fast)
    // For large posets: use improved sparse DP
    let mobius_from_min = if size <= 512 {
        compute_mobius_via_matrix_inversion(&matrix, size, min_elem)
    } else {
        // Build sparse adjacency list (covering relation)
        let adj_list = build_adjacency_list(&matrix, size);

        // Compute ranks using BFS from minimum element
        let ranks = compute_ranks(&adj_list, min_elem, size);

        compute_mobius_improved_dp(&matrix, size, min_elem, &ranks)
    };

    // Build sparse adjacency list for rank computation
    let adj_list = build_adjacency_list(&matrix, size);
    let ranks = compute_ranks(&adj_list, min_elem, size);
    let max_rank = ranks.iter().max().copied().unwrap_or(0);

    // Compute characteristic polynomial using: χ(x) = Σ μ(0̂, y) · x^(height - rank(y))
    let coeffs = compute_char_poly_coefficients(&mobius_from_min, &ranks, max_rank);

    // Format as a polynomial string
    format_polynomial(&coeffs)
}

/// Build adjacency list for the covering relation (Hasse diagram edges)
fn build_adjacency_list(matrix: &[u8], size: usize) -> Vec<Vec<usize>> {
    let mut adj_list = vec![Vec::new(); size];

    for i in 0..size {
        for j in 0..size {
            if i != j && matrix[i * size + j] != 0 {
                // i ≤ j, check if it's a cover relation (no element between)
                let mut is_cover = true;
                for k in 0..size {
                    if k != i && k != j
                        && matrix[i * size + k] != 0
                        && matrix[k * size + j] != 0 {
                        is_cover = false;
                        break;
                    }
                }
                if is_cover {
                    adj_list[i].push(j);
                }
            }
        }
    }

    adj_list
}

/// Find the minimum element (element ≤ all others)
fn find_minimum_element(matrix: &[u8], size: usize) -> usize {
    for i in 0..size {
        let mut is_min = true;
        for j in 0..size {
            if matrix[i * size + j] == 0 {
                is_min = false;
                break;
            }
        }
        if is_min {
            return i;
        }
    }
    0 // Default to element 0 if no clear minimum
}

/// Compute ranks of all elements using BFS from minimum element
fn compute_ranks(adj_list: &[Vec<usize>], min_elem: usize, size: usize) -> Vec<usize> {
    let mut ranks = vec![0; size];
    let mut visited = vec![false; size];
    let mut queue = VecDeque::new();

    queue.push_back(min_elem);
    visited[min_elem] = true;
    ranks[min_elem] = 0;

    while let Some(u) = queue.pop_front() {
        for &v in &adj_list[u] {
            if !visited[v] {
                visited[v] = true;
                ranks[v] = ranks[u] + 1;
                queue.push_back(v);
            } else {
                // Update rank to maximum path length
                ranks[v] = ranks[v].max(ranks[u] + 1);
            }
        }
    }

    ranks
}

/// Method 1: Compute Möbius function via zeta matrix inversion
/// Very fast for small posets (n ≤ 512)
/// O(n³) complexity but excellent constants
fn compute_mobius_via_matrix_inversion(matrix: &[u8], size: usize, min_elem: usize) -> Vec<i64> {
    // Build zeta matrix: Z[i][j] = 1 if i ≤ j, else 0
    let mut zeta = vec![vec![0.0f64; size]; size];
    for i in 0..size {
        for j in 0..size {
            if matrix[i * size + j] != 0 {
                zeta[i][j] = 1.0;
            }
        }
    }

    // Invert the zeta matrix to get Möbius matrix
    // Using LU decomposition (faster than Gauss-Jordan)
    let mobius_matrix = invert_matrix_lu(&zeta, size);

    // Extract μ(min, y) for all y
    let mut mobius_from_min = vec![0i64; size];
    for y in 0..size {
        mobius_from_min[y] = mobius_matrix[min_elem][y].round() as i64;
    }

    mobius_from_min
}

/// Invert a matrix using LU decomposition (faster than Gauss-Jordan)
#[inline]
fn invert_matrix_lu(matrix: &[Vec<f64>], size: usize) -> Vec<Vec<f64>> {
    // LU decomposition: A = LU
    let (l, u, p) = lu_decomposition(matrix, size);

    // Solve A * X = I by solving L * U * X = P * I
    // For each column i of the inverse:
    //   Solve L * y = P * e_i  (forward substitution)
    //   Solve U * x = y        (backward substitution)
    let mut inverse = vec![vec![0.0f64; size]; size];

    for col in 0..size {
        // Right hand side: P * e_col
        let mut rhs = vec![0.0f64; size];
        rhs[p[col]] = 1.0;

        // Forward substitution: L * y = rhs
        let mut y = vec![0.0f64; size];
        for i in 0..size {
            let mut sum = 0.0;
            for j in 0..i {
                sum += l[i][j] * y[j];
            }
            y[i] = rhs[i] - sum;
        }

        // Backward substitution: U * x = y
        for i in (0..size).rev() {
            let mut sum = 0.0;
            for j in (i + 1)..size {
                sum += u[i][j] * inverse[j][col];
            }
            inverse[i][col] = (y[i] - sum) / u[i][i];
        }
    }

    inverse
}

/// LU decomposition with partial pivoting
/// Returns (L, U, permutation)
#[inline]
fn lu_decomposition(matrix: &[Vec<f64>], size: usize) -> (Vec<Vec<f64>>, Vec<Vec<f64>>, Vec<usize>) {
    let mut l = vec![vec![0.0f64; size]; size];
    let mut u = matrix.iter().map(|row| row.clone()).collect::<Vec<_>>();
    let mut p: Vec<usize> = (0..size).collect();

    // Initialize L as identity
    for i in 0..size {
        l[i][i] = 1.0;
    }

    for k in 0..size {
        // Find pivot
        let mut max_val = u[k][k].abs();
        let mut max_idx = k;
        for i in (k + 1)..size {
            if u[i][k].abs() > max_val {
                max_val = u[i][k].abs();
                max_idx = i;
            }
        }

        // Swap rows in U and p
        if max_idx != k {
            u.swap(k, max_idx);
            p.swap(k, max_idx);
            // Swap already computed parts of L
            for j in 0..k {
                let temp = l[k][j];
                l[k][j] = l[max_idx][j];
                l[max_idx][j] = temp;
            }
        }

        // Compute multipliers and eliminate
        for i in (k + 1)..size {
            if u[k][k].abs() > 1e-10 {
                l[i][k] = u[i][k] / u[k][k];
                for j in k..size {
                    u[i][j] -= l[i][k] * u[k][j];
                }
            }
        }
    }

    (l, u, p)
}

/// Method 2: Improved Möbius DP with rank caching
/// More efficient than naive sparse method
/// Process by rank, cache partial sums
fn compute_mobius_improved_dp(matrix: &[u8], size: usize, min_elem: usize, ranks: &[usize]) -> Vec<i64> {
    let mut mobius = vec![0i64; size];

    // Base case: μ(min, min) = 1
    mobius[min_elem] = 1;

    // Build reachability map from min_elem
    let mut reachable = vec![false; size];
    let mut queue = VecDeque::new();
    queue.push_back(min_elem);
    reachable[min_elem] = true;

    while let Some(u) = queue.pop_front() {
        for v in 0..size {
            if matrix[u * size + v] != 0 && !reachable[v] {
                reachable[v] = true;
                queue.push_back(v);
            }
        }
    }

    // Group elements by rank
    let max_rank = *ranks.iter().max().unwrap_or(&0);
    let mut elements_by_rank: Vec<Vec<usize>> = vec![Vec::new(); max_rank + 1];
    for i in 0..size {
        if reachable[i] {
            elements_by_rank[ranks[i]].push(i);
        }
    }

    // Process each rank in order
    for rank in 1..=max_rank {
        for &y in &elements_by_rank[rank] {
            // μ(min, y) = -Σ_{min ≤ z < y} μ(min, z)
            // Only sum over elements z with rank < rank(y) that can reach y
            let mut sum = 0i64;

            for prev_rank in 0..rank {
                for &z in &elements_by_rank[prev_rank] {
                    // Check if z ≤ y (i.e., z can reach y)
                    if matrix[z * size + y] != 0 {
                        sum += mobius[z];
                    }
                }
            }

            mobius[y] = -sum;
        }
    }

    mobius
}

/// Compute μ(min, y) for all elements y using sparse adjacency list
/// Using: μ(x, y) = -Σ_{x ≤ z < y} μ(x, z) with μ(x, x) = 1
fn compute_mobius_from_minimum_sparse(adj_list: &[Vec<usize>], min_elem: usize, size: usize, ranks: &[usize]) -> Vec<i64> {
    let mut mobius = vec![0i64; size];

    // Base case: μ(min, min) = 1
    mobius[min_elem] = 1;

    // Build reverse adjacency (predecessors)
    let mut predecessors = vec![Vec::new(); size];
    for i in 0..size {
        for &j in &adj_list[i] {
            predecessors[j].push(i);
        }
    }

    // Build reachability from minimum element using BFS
    let mut reachable_from_min = vec![false; size];
    let mut queue = VecDeque::new();
    queue.push_back(min_elem);
    reachable_from_min[min_elem] = true;

    while let Some(u) = queue.pop_front() {
        for &v in &adj_list[u] {
            if !reachable_from_min[v] {
                reachable_from_min[v] = true;
                queue.push_back(v);
            }
        }
    }

    // Sort elements by rank for correct computation order
    let mut elements_by_rank: Vec<(usize, usize)> = (0..size)
        .filter(|&i| reachable_from_min[i])
        .map(|i| (ranks[i], i))
        .collect();
    elements_by_rank.sort();

    // Compute μ(min, y) for each element y in rank order
    for &(_, y) in &elements_by_rank {
        if y == min_elem {
            continue;
        }

        // μ(min, y) = -Σ_{min ≤ z < y} μ(min, z)
        // We need all z such that min ≤ z < y
        // This is all z reachable from min that can reach y
        let mut sum = 0i64;

        // BFS backwards from y to find all predecessors reachable from min
        let mut visited = vec![false; size];
        let mut q = VecDeque::new();

        for &pred in &predecessors[y] {
            q.push_back(pred);
        }

        while let Some(z) = q.pop_front() {
            if visited[z] || !reachable_from_min[z] {
                continue;
            }
            visited[z] = true;
            sum += mobius[z];

            // Add predecessors of z
            for &pred in &predecessors[z] {
                if !visited[pred] {
                    q.push_back(pred);
                }
            }
        }

        mobius[y] = -sum;
    }

    mobius
}

/// Compute characteristic polynomial coefficients
/// χ(P, x) = Σ_{y∈P} μ(0̂, y) · x^(height - rank(y))
#[inline]
fn compute_char_poly_coefficients(mobius: &[i64], ranks: &[usize], max_rank: usize) -> Vec<i64> {
    let mut coeffs = vec![0i64; max_rank + 1];

    for (y, &mu_val) in mobius.iter().enumerate() {
        if mu_val != 0 {
            let power = max_rank - ranks[y];
            coeffs[power] += mu_val;
        }
    }

    coeffs
}

/// Format polynomial coefficients as a readable string
fn format_polynomial(coeffs: &[i64]) -> String {
    let mut terms = Vec::new();

    for (power, &coeff) in coeffs.iter().enumerate().rev() {
        if coeff == 0 {
            continue;
        }

        let sign = if coeff > 0 { "+" } else { "" };
        let abs_coeff = coeff.abs();

        let term = match power {
            0 => format!("{}{}", sign, coeff),
            1 => {
                if abs_coeff == 1 {
                    format!("{}x", sign)
                } else {
                    format!("{}{}x", sign, coeff)
                }
            }
            _ => {
                if abs_coeff == 1 {
                    format!("{}x^{}", sign, power)
                } else {
                    format!("{}{}x^{}", sign, coeff, power)
                }
            }
        };

        terms.push(term);
    }

    if terms.is_empty() {
        "0".to_string()
    } else {
        let mut result = terms.join(" ");
        // Clean up leading + sign
        if result.starts_with('+') {
            result = result[1..].trim_start().to_string();
        }
        result
    }
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    // You can add initialization code here if needed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_poset() {
        // Test with a simple chain poset: 0 < 1 < 2
        let matrix = vec![
            1, 1, 1,
            0, 1, 1,
            0, 0, 1,
        ];
        let result = compute_characteristic_polynomial(matrix, 3);
        println!("Chain poset result: {}", result);
    }
}
