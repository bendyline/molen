/** Polygon tessellation owned by molen.worldgen.structure.bridge_over_saint_volodymyr_descent. */
import earcut from 'earcut';
export function volodymyrDeckTriangles(outer, holes = []) {
  const vertices = [...outer],
    offsets = [];
  for (const ring of holes) {
    offsets.push(vertices.length);
    vertices.push(...ring);
  }
  const indices = earcut(vertices.flat(), offsets, 2);
  return Array.from({ length: indices.length / 3 }, (_, i) =>
    indices.slice(i * 3, i * 3 + 3).map((index) => vertices[index]),
  ).filter((triangle) => {
    // Parallel window rows can produce microscopic earcut slivers. They have no visible
    // area and can invert after glTF Float32 conversion; preserve all actual deck faces.
    const [a, b, c] = triangle.map((p) => p.map(Math.fround));
    const twiceArea = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(twiceArea) > 1e-5;
  });
}
