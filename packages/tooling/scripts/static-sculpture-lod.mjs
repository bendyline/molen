/** Source-authoring reduction for 'new_york_stock_exchange' and 'trevi_fountain'. */
import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

/** Reduce a uniformly colored, already posed sculpture in meters; retain the master separately. */
export function simplifyStaticSculpture(triangles, targetTriangles, errorMeters) {
  if (triangles.length <= targetTriangles) return triangles;
  const vertices = [],
    indices = [],
    lookup = new Map();
  for (const triangle of triangles)
    for (const point of triangle) {
      const p = point.map(Math.fround),
        key = p.join(',');
      if (!lookup.has(key)) {
        lookup.set(key, vertices.length / 3);
        vertices.push(...p);
      }
      indices.push(lookup.get(key));
    }
  const [reduced, error] = MeshoptSimplifier.simplify(
    new Uint32Array(indices),
    new Float32Array(vertices),
    3,
    targetTriangles * 3,
    errorMeters,
    ['ErrorAbsolute'],
  );
  if (!reduced.length || reduced.length / 3 > targetTriangles || error > errorMeters)
    throw new Error(
      `Sculpture cannot meet ${targetTriangles} triangles within ${errorMeters}m: ${reduced.length / 3} triangles, ${error}m`,
    );
  return Array.from({ length: reduced.length / 3 }, (_, i) =>
    [0, 1, 2].map((j) => vertices.slice(reduced[i * 3 + j] * 3, reduced[i * 3 + j] * 3 + 3)),
  );
}
