/**
 * Low benches and broad-leaf trees on the Square of Hope paving, shared by
 * 'museum_of_holocaust_art_yad_vashem' and 'exhibitions_pavilion_yad_vashem'.
 */
import { sphere } from './authored-structure-mesh.mjs';
import { box } from './khmer-structure-geometry.mjs';
import { tube } from './structure-mesh.mjs';

export function addSquareOfHopeLandscape(face, detail, court) {
  if (!detail) return;
  const y = court.floorY;
  const emit = (role, _ref, points, normal, _uv, color) => face(role, points, normal, color);
  const out = { addTriangle: emit, addQuad: emit, addConvexPolygon: emit };
  for (const { x, z, axis } of court.benches) {
    const alongX = axis === 'x';
    box(face, 'concrete', x, y + 0.31, z, alongX ? 1.7 : 0.44, 0.16, alongX ? 0.44 : 1.7);
    for (const offset of [-0.55, 0.55])
      box(
        face,
        'concrete',
        x + (alongX ? offset : 0),
        y,
        z + (alongX ? 0 : offset),
        alongX ? 0.24 : 0.34,
        0.31,
        alongX ? 0.34 : 0.24,
      );
  }
  for (const [index, { x, z, size }] of court.trees.entries()) {
    const drift = (index % 2 ? -0.27 : 0.2) * size;
    box(face, 'floor', x, y, z, 1.24, 0.026, 1.24);
    const top = [x + drift, y + 2.15 * size, z - 0.13 * size];
    tube(out, 'bark', [x, y, z], top, 0.106 * size, [0.28, 0.22, 0.14], detail > 1 ? 7 : 5);
    const branches =
      detail === 1
        ? [[0, 0, 0, 1.15]]
        : [
            [-0.63, -0.22, 0.22, 0.75],
            [0.64, -0.12, 0.15, 0.8],
            [0.14, 0.14, -0.54, 0.71],
            [-0.19, 0.5, 0.11, 0.8],
          ];
    branches.forEach(([dx, dy, dz, radius], branch) => {
      const q = [top[0] + dx * size, y + (3.15 + dy) * size, top[2] + dz * size];
      const r = radius * size;
      const tint = [0.198 + 0.014 * branch, 0.269 + 0.016 * branch, 0.112 + 0.006 * branch];
      if (detail > 1)
        tube(out, 'bark', top, [q[0], q[1] - 0.18, q[2]], 0.045 * size, [0.26, 0.2, 0.14], 5);
      sphere(
        out,
        'leaves',
        q,
        [r * 1.14, r * 0.83, r],
        tint,
        detail === 3 ? 9 : 7,
        detail === 3 ? 5 : 4,
      );
    });
  }
}
