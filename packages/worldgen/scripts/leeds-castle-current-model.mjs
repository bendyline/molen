/** Graded current derivative; retain the original water-plane reconstruction recipe. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildLeedsRuntime, leedsSurfaces } from './leeds-castle-model.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const relief = JSON.parse(
  readFileSync(structureSourcePath('n0304_leeds_castle', 'terrain-grid.json')),
);
export const leedsCurrentSurfaces = Object.fromEntries(
  Object.entries(leedsSurfaces).map(([name, surface]) => [
    name,
    surface.graph ? surface : { ...surface, localRef: 'palette:#ffffff' },
  ]),
);
export const leedsCurrentFloor = relief.reconstruction.baileyFloorModelY;
const priorFloor = 4.4;
export const leedsCurrentY = (y) =>
  y < priorFloor ? y * (leedsCurrentFloor / priorFloor) : y + leedsCurrentFloor - priorFloor;

export function buildLeedsCurrentRuntime(out, level = 'closeup') {
  buildLeedsRuntime(
    {
      addTriangle(slot, ref, points, _normal, uv, color) {
        const p = points.map(([x, y, z]) => [x, leedsCurrentY(y), z].map(Math.fround));
        const n = normalFor(...p);
        if (Math.hypot(...n) > 0.5) out.addTriangle(slot, ref, p, n, uv, color);
      },
    },
    level,
  );
  const path = relief.approachWay;
  const pairs = path.points.map((p, i, points) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    return [-1, 1].map((s) =>
      [
        p[0] - ((s * dz) / length) * 1.5,
        path.modelHeights[i] + 0.035,
        p[1] + ((s * dx) / length) * 1.5,
      ].map(Math.fround),
    );
  });
  for (let i = 0; i < pairs.length - 1; i++) {
    const q = [pairs[i][0], pairs[i + 1][0], pairs[i + 1][1], pairs[i][1]];
    for (const ix of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      let p = ix.map((j) => q[j]),
        n = normalFor(...p);
      if (n[1] < 0) {
        p = p.toReversed();
        n = normalFor(...p);
      }
      out.addTriangle(
        'paving',
        'palette:#ffffff',
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        level === 'skyline' ? [0.36, 0.32, 0.26] : [0.52, 0.47, 0.38],
      );
    }
  }
}
export const buildLeedsCurrent = (out) => buildLeedsCurrentRuntime(out);
export const buildLeedsCurrentSkyline = (out) => buildLeedsCurrentRuntime(out, 'skyline');
export const buildLeedsCurrentDistrict = (out) => buildLeedsCurrentRuntime(out, 'district');
export const buildLeedsCurrentStreet = (out) => buildLeedsCurrentRuntime(out, 'street');
