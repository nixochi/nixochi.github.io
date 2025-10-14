/**
 * OBJ File Loader Module
 * Handles parsing and loading of .obj files
 */

/**
 * Parse an OBJ file text into vertices and faces
 * @param {string} text - The OBJ file content as text
 * @returns {{vertices: Array<Array<number>>, faces: Array<Array<number>>}}
 */
export function parseOBJ(text) {
  const lines = text.split('\n');
  const vertices = [];
  const faces = [];

  lines.forEach(line => {
    line = line.trim();

    // Parse vertex line (v x y z)
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      vertices.push([+x, +y, +z]);
    }
    // Parse face line (f v1 v2 v3 ...)
    else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1).map(p => parseInt(p) - 1);
      // Triangulate faces (convert polygon to triangles)
      for (let i = 1; i < parts.length - 1; i++) {
        faces.push([parts[0], parts[i], parts[i + 1]]);
      }
    }
  });

  console.log(`Parsed OBJ: ${vertices.length} vertices, ${faces.length} triangles`);
  return { vertices, faces };
}

/**
 * Load an OBJ file from a File object
 * @param {File} file - The file to load
 * @returns {Promise<{vertices: Array<Array<number>>, faces: Array<Array<number>>}>}
 */
export function loadOBJFile(file) {
  return new Promise((resolve, reject) => {
    console.log("Loading file:", file.name);
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const model = parseOBJ(reader.result);
        resolve(model);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Load an OBJ file from a URL
 * @param {string} url - The URL to load from
 * @returns {Promise<{vertices: Array<Array<number>>, faces: Array<Array<number>>}>}
 */
export async function loadOBJFromURL(url) {
  console.log("Loading OBJ from URL:", url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load OBJ file: ${response.statusText}`);
  }

  const text = await response.text();
  return parseOBJ(text);
}
