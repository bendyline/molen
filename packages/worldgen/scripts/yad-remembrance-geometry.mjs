/** 'hall_of_remembrance_yad_vashem': square floating concrete roof over a faceted fieldstone base. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYadRemembrance(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    polygon = (outline) => ({ outline, holes: [] }),
    random = (n) => ((Math.imul((n + 1831) ^ 0x7f4a7c15, 0x45d9f3b) >>> 0) % 10000) / 10000;

  prism(f, 'floor', polygon(r.base), r.foundationY, Y, true);
  for (const p of r.bodyCut) prism(f, 'joint', p, Y, Y + 2.65, true);
  prism(f, 'joint', polygon(r.base), Y + 2.65, Y + 3, true);
  // The solid backing makes the exterior watertight; the entrance has real depth.
  box(f, 'bronze', -7.35, Y + 0.04, 9.68, 4.4, 2.55, 0.15);
  box(f, 'floor', -7.35, Y - 0.08, 11.2, 4.7, 0.08, 3.4);
  box(f, 'metal', 0, Y + 3, 0, 20.3, 0.3, 20.3);
  if (detail) {
    for (const x of [-9.6, -5.1]) box(f, 'metal', x, Y + 0.03, 9.8, 0.12, 2.58, 0.2);
    box(f, 'metal', -7.35, Y + 2.57, 9.8, 4.6, 0.12, 0.2);
    for (const x of [-8.7, -7.35, -6]) box(f, 'bronze', x, Y + 0.12, 9.8, 0.13, 2.25, 0.08);
  }

  // A roof slab closes the underside; the thick ring encloses the depressed roof plane.
  prism(f, 'concrete', polygon(r.outer), Y + 3.3, Y + 4.1, true);
  prism(f, 'roof', polygon(r.topInner), Y + 4.1, Y + 4.14, true);
  prism(f, 'concrete', { outline: r.outer, holes: [r.topInner] }, Y + 4.1, Y + 7.2, true);
  if (detail > 1) {
    for (const i of [0, 1, 2, 3]) {
      const p = r.outer[i].map((v) => v * 0.965);
      box(f, 'metal', p[0], Y + 7.2, p[1], 0.16, 0.32, 0.16);
      box(f, 'metal', p[0], Y + 7.48, p[1], 0.48, 0.45, 0.2);
    }
    for (const p of r.base) box(f, 'metal', p[0] * 0.92, Y + 3, p[1] * 0.92, 0.25, 0.3, 0.25);
  }

  // Broad faceted stones retain the characteristic base at every distance. Surface grain
  // uses the same continuous raw-stone graph as other modeled masonry, without drawn joints.
  const rows = [2, 2, 3, 4][detail],
    nominalColumns = [4, 12, 20, 22][detail],
    sides = detail === 0 ? 4 : detail === 3 ? 8 : 6;
  for (let wallIndex = 0; wallIndex < r.walls.length; wallIndex++) {
    const wall = r.walls[wallIndex],
      columns = Math.max(4, Math.round((wall.length / 24) * nominalColumns)),
      cellWidth = wall.length / columns,
      cellHeight = 3 / rows;
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++) {
        const seed = wallIndex * 5000 + row * 100 + column,
          boundary = (j) =>
            j === 0
              ? 0
              : j === columns
                ? wall.length
                : j * cellWidth +
                  (random(wallIndex * 5000 + row * 100 + j + 330) - 0.5) * cellWidth * 0.45,
          start = boundary(column),
          end = boundary(column + 1),
          mid = (start + end) / 2,
          center = [wall.a[0] + wall.u[0] * mid, wall.a[1] + wall.u[1] * mid],
          height = cellHeight * (1.03 + 0.05 * random(seed)),
          width = (end - start) * (1.03 + 0.05 * random(seed + 19)),
          cy = Y + (row + 0.5) * cellHeight + (random(seed + 41) - 0.5) * cellHeight * 0.1;
        if (
          end - start < 0.15 ||
          (wall.front && center[0] > -10.3 && center[0] < -4.4 && cy < Y + 2.85)
        )
          continue;
        const role = `stone${seed % 4}`,
          point = (u, y, depth) => [
            center[0] + wall.u[0] * u + wall.n[0] * depth,
            y,
            center[1] + wall.u[1] * u + wall.n[1] * depth,
          ],
          extent = Math.max(
            ...Array.from({ length: sides }, (_, i) =>
              Math.abs(Math.cos(((i + 0.5) * Math.PI * 2) / sides)),
            ),
          ),
          outline = Array.from({ length: sides }, (_, i) => {
            const angle = ((i + 0.5) * Math.PI * 2) / sides,
              rad = 0.94 + 0.06 * random(seed + i * 7);
            return [
              (Math.cos(angle) / extent) * width * 0.5 * rad,
              cy + (Math.sin(angle) / extent) * height * 0.5 * rad,
            ];
          }),
          back = outline.map(([u, y]) => point(u, y, 0.005)),
          front = outline.map(([u, y]) =>
            point(u * 0.97, cy + (y - cy) * 0.97, 0.16 + 0.07 * random(seed + 3)),
          ),
          cap = point(0, cy, 0.26);
        f(role, back, [-wall.n[0], 0, -wall.n[1]]);
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides;
          f(role, [front[i], front[j], cap], [wall.n[0], 0, wall.n[1]]);
          const u = (outline[i][0] + outline[j][0]) / 2,
            v = (outline[i][1] + outline[j][1]) / 2 - cy;
          f(role, [back[i], back[j], front[j], front[i]], [wall.u[0] * u, v, wall.u[1] * u]);
        }
      }
  }
}
