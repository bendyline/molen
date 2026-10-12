/** Original browser exterior; the detailed Cyclopean master remains unchanged. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildKazarma } from './kazarma-bridge-model.mjs';
import { kazarmaPhotographedOutlines } from './kazarma-masonry.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export const kazarmaBrowserSurfaces = {
  limestone: { graph: 'stone_limestone_weathered', slot: 'wall', roughness: 0.95, metallic: 0 },
  aggregate: { graph: 'gravel', slot: 'foundation', roughness: 0.98, metallic: 0 },
};
const stone = [0.655, 0.637, 0.574],
  earth = [0.54, 0.498, 0.413];
const means = JSON.parse(
  readFileSync(structureSourcePath('n0012_kazarma_mycenaean_bridge', 'surface-means.json')),
);
export const kazarmaRoadHeight = (x) => 3.88 - Math.abs(x) * 0.043 + Math.sin(x * 0.8) * 0.035;
function triangle(out, slot, p, color, flat) {
  out.addTriangle(
    flat ? 'flat' : slot,
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((v) => [v[0], v[1]]),
    flat ? color.map((v, i) => v * means[slot][i]) : color,
  );
}
function quad(out, slot, p, color, flat) {
  triangle(out, slot, [p[0], p[1], p[2]], color, flat);
  triangle(out, slot, [p[0], p[2], p[3]], color, flat);
}
function core(out, a, b, low, flat) {
  const top = (x) => kazarmaRoadHeight(x) - 0.025,
    w = (y) => 2.79 - y * 0.29 - 0.06;
  const p = [
    [a, low, -w(low)],
    [b, low, -w(low)],
    [b, low, w(low)],
    [a, low, w(low)],
    [a, top(a), -w(top(a))],
    [b, top(b), -w(top(b))],
    [b, top(b), w(top(b))],
    [a, top(a), w(top(a))],
  ];
  for (const ids of [
    [0, 1, 2, 3],
    [0, 4, 5, 1],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
    [1, 5, 6, 2],
    [4, 7, 6, 5],
  ])
    quad(
      out,
      'limestone',
      ids.map((i) => p[i]),
      stone,
      flat,
    );
}
function stoneFace(out, polygon, side, seed, detail, flat) {
  const boundary = polygon.map((p) => [...p]);
  const area = boundary.reduce((s, p, i) => {
    const q = boundary[(i + 1) % boundary.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area * side < 0) boundary.reverse();
  const c = [0, 1].map((axis) => boundary.reduce((s, p) => s + p[axis], 0) / boundary.length);
  const face = (y) => 2.79 - Math.max(0, y) * 0.29;
  const tint = stone.map((v) => v + Math.sin(seed * 11) * 0.04);
  const ring = (scale, inset) =>
    boundary.map((p) => {
      const x = c[0] + (p[0] - c[0]) * scale,
        y = c[1] + (p[1] - c[1]) * scale;
      return [x, y, side * (face(y) - inset)];
    });
  const rings =
    detail === 1
      ? [ring(1, 0.055)]
      : detail === 2
        ? [ring(0.9, 0.65), ring(1, 0.055)]
        : [
            ring(0.9, 0.65),
            ring(1, 0.055),
            ring(0.75, -0.08),
            ...(detail === 4 ? [ring(0.35, -0.12)] : []),
          ];
  for (let r = 1; r < rings.length; r++)
    for (let i = 0; i < boundary.length; i++) {
      const j = (i + 1) % boundary.length;
      quad(
        out,
        'limestone',
        [rings[r - 1][i], rings[r - 1][j], rings[r][j], rings[r][i]],
        tint,
        flat,
      );
    }
  const peak = [c[0], c[1], side * (face(c[1]) + 0.13)];
  for (let i = 0; i < boundary.length; i++)
    triangle(
      out,
      'limestone',
      [rings.at(-1)[i], rings.at(-1)[(i + 1) % boundary.length], peak],
      tint,
      flat,
    );
}
function build(out, detail, flat = false) {
  // Asymmetric horizontal corbels: no Roman arch or safety parapet is invented.
  for (const [a, b, y] of [
    [-11, -0.98, 0],
    [0.81, 11, 0],
    [-0.98, -0.86, 1.3],
    [0.64, 0.81, 1.1],
    [-0.86, -0.47, 1.65],
    [0.5, 0.64, 1.65],
    [-0.47, -0.2, 1.99],
    [0.28, 0.5, 1.91],
    [-0.2, 0.28, 2.19],
  ]) {
    const count = detail === 1 ? 1 : Math.ceil((b - a) / (detail === 2 ? 2 : 1));
    for (let i = 0; i < count; i++)
      core(out, a + ((b - a) * i) / count, a + ((b - a) * (i + 1)) / count, y, flat);
  }
  const outlines = kazarmaPhotographedOutlines();
  for (const side of [-1, 1])
    for (const [i, p] of outlines.entries()) stoneFace(out, p, side, i + 33, detail, flat);
  // Closed gravel road, with metric shared aggregate replacing tiny loose pebbles.
  const count = detail === 1 ? 8 : detail === 2 ? 22 : 44;
  for (let i = 0; i < count; i++) {
    const a = -11 + (22 * i) / count,
      b = -11 + (22 * (i + 1)) / count,
      ya = kazarmaRoadHeight(a),
      yb = kazarmaRoadHeight(b);
    const top = [
      [a, ya, -1.43],
      [a, ya, 1.43],
      [b, yb, 1.43],
      [b, yb, -1.43],
    ];
    quad(out, 'aggregate', top, earth, flat);
    quad(out, 'aggregate', top.map(([x, y, z]) => [x, y - 0.18, z]).toReversed(), earth, flat);
    for (const z of [-1.43, 1.43]) {
      const p = [
        [a, ya - 0.18, z],
        [b, yb - 0.18, z],
        [b, yb, z],
        [a, ya, z],
      ];
      if (z < 0) p.reverse();
      quad(out, 'aggregate', p, earth, flat);
    }
  }
  // Low threshold remains below the open tunnel.
  coreThreshold(out, flat);
}
function coreThreshold(out, flat) {
  const p = [
    [-0.79, 0, -2.79],
    [0.72, 0, -2.79],
    [0.72, 0, 2.79],
    [-0.79, 0, 2.79],
    [-0.79, 0.13, -2.79],
    [0.72, 0.13, -2.79],
    [0.72, 0.13, 2.79],
    [-0.79, 0.13, 2.79],
  ];
  for (const ids of [
    [0, 1, 2, 3],
    [0, 4, 5, 1],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
    [1, 5, 6, 2],
    [4, 7, 6, 5],
  ])
    quad(
      out,
      'limestone',
      ids.map((i) => p[i]),
      stone,
      flat,
    );
}
export const buildKazarmaSkyline = (out) => build(out, 1, true);
export const buildKazarmaDistrict = (out) => build(out, 2);
export const buildKazarmaStreet = (out) => build(out, 3);
export const buildKazarmaCloseup = (out) => build(out, 4);

/** Correct hidden core winding and close the crown bedding behind the face stones. */
export function buildKazarmaCurrent(out) {
  let corePhase = true;
  buildKazarma({
    addTriangle(slot, ref, points, normal, uv, color) {
      if (slot === 'limestone') corePhase = false;
      out.addTriangle(slot, ref, points, normal, uv, color);
    },
    addQuad(slot, ref, points, normal, uv, color) {
      const p = corePhase ? points.toReversed() : points;
      out.addQuad(
        slot,
        ref,
        p,
        corePhase ? normal.map((v) => -v) : normal,
        corePhase && Array.isArray(uv) ? uv.toReversed() : uv,
        color,
      );
    },
    addConvexPolygon(...args) {
      out.addConvexPolygon(...args);
    },
  });
  const p = [
    [-0.2, 2.19, -2.14],
    [0.28, 2.19, -2.14],
    [0.28, 2.19, 2.14],
    [-0.2, 2.19, 2.14],
    [-0.2, 2.27, -2.14],
    [0.28, 2.27, -2.14],
    [0.28, 2.27, 2.14],
    [-0.2, 2.27, 2.14],
  ];
  for (const ids of [
    [0, 1, 2, 3],
    [0, 4, 5, 1],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
    [1, 5, 6, 2],
    [4, 7, 6, 5],
  ])
    quad(
      out,
      'limestone',
      ids.map((i) => p[i]),
      stone,
      false,
    );
}
