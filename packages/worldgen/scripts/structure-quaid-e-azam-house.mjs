/** Original restored main-house exterior; native outline, creator-CC0 front photograph. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/tk/tkr/quaid_e_azam_house/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('b69d65'),
    trim: rgb('c8af75'),
    roof: rgb('b98968'),
    green: rgb('376d5b'),
    wood: rgb('735e3b'),
    glass: rgb('343b35'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
    roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.9, metallic: 0 },
    green: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
    glass: { slot: 'window', localRef: ref, roughness: 0.47, metallic: 0.08 },
  };
function T(o, s, q, n) {
  q = q.map((v) => v.map(Math.fround));
  let nn = normalFor(...q);
  if (nn.every((v) => v === 0)) return;
  if (n && nn.reduce((v, x, i) => v + x * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => [v[0] + v[2], v[1]]),
    C[s],
  );
}
function Q(o, s, q, n) {
  T(o, s, q.slice(0, 3), n);
  T(o, s, [q[0], q[2], q[3]], n);
}
function B(o, s, x, y, z, w, h, depth) {
  if (w > 0 && h > 0 && depth > 0)
    box(o, s, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], C[s]);
}
function L(o, s, a, b, w, depth = w) {
  beam(o, s, a, b, w, depth, C[s]);
}
function cap(o, outline, y) {
  const ids = earcut(outline.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      'stone',
      ids.slice(i, i + 3).map((k) => [outline[k][0], y, outline[k][1]]),
      [0, 1, 0],
    );
}
function column(o, x, z, y, h, r, d, s = 'trim') {
  const n = [4, 5, 8, 12][d],
    profile =
      d < 2
        ? [
            [y, r],
            [y + h, r * 0.82],
          ]
        : [
            [y, r * 1.18],
            [y + h * 0.12, r],
            [y + h * 0.48, r * 0.94],
            [y + h * 0.88, r * 0.79],
            [y + h, r * 1.14],
          ];
  loft(
    o,
    s,
    profile.map(([yy, rr]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i / n) * Math.PI * 2;
        return [x + rr * Math.cos(a), yy, z + rr * Math.sin(a)];
      }),
    ),
    C[s],
  );
}
function screen(o, x, z, y, w, h, d) {
  Q(
    o,
    'glass',
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
  );
  if (!d) return;
  for (const xx of [x - w / 2, x, x + w / 2]) B(o, 'wood', xx, y, z + 0.045, 0.055, h, 0.07);
  for (const yy of [y, y + h * 0.5, y + h]) B(o, 'wood', x, yy, z + 0.047, w, 0.055, 0.07);
}
/** Genuine arch cutout, with solid spandrels and intrados, never a dark flush decal. */
function arch(o, x, z, y, w, spring, crown, top, d) {
  const r = w / 2,
    n = [3, 5, 9, 14][d],
    depth = 0.35;
  for (let i = 0; i < n; i++) {
    const aa = (i / n) * Math.PI,
      bb = ((i + 1) / n) * Math.PI,
      a = [x - r * Math.cos(aa), spring + (crown - spring) * Math.sin(aa)],
      b = [x - r * Math.cos(bb), spring + (crown - spring) * Math.sin(bb)];
    Q(
      o,
      'stone',
      [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], top, z],
        [a[0], top, z],
      ],
      [0, 0, 1],
    );
    Q(
      o,
      'stone',
      [
        [a[0], a[1], z - depth],
        [a[0], top, z - depth],
        [b[0], top, z - depth],
        [b[0], b[1], z - depth],
      ],
      [0, 0, -1],
    );
    Q(o, 'trim', [
      [a[0], a[1], z],
      [a[0], a[1], z - depth],
      [b[0], b[1], z - depth],
      [b[0], b[1], z],
    ]);
    if (d > 1) {
      const t = 0.15,
        outer = (v) => [
          x - (r + t) * Math.cos(v),
          spring + (crown - spring + t) * Math.sin(v),
          z + 0.045,
        ];
      Q(
        o,
        'trim',
        [[a[0], a[1], z + 0.045], [b[0], b[1], z + 0.045], outer(bb), outer(aa)],
        [0, 0, 1],
      );
    }
  }
  if (d) {
    const yy = spring + 0.02;
    const curve = [
      [x - r, yy, z - 0.1],
      [x + r, yy, z - 0.1],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = (i / n) * Math.PI;
        return [x + r * Math.cos(a), spring + (crown - spring) * Math.sin(a), z - 0.1];
      }),
    ];
    o.addConvexPolygon('green', ref, curve, [0, 0, 1], (q) => [q[0], q[1]], C.green);
    if (d > 1)
      for (let v = 0.18; v < crown - spring - 0.06; v += d > 2 ? 0.14 : 0.28) {
        const ww = w * Math.sqrt(Math.max(0, 1 - (v / (crown - spring)) ** 2));
        B(o, 'green', x, spring + v, z - 0.065, ww, 0.04, 0.07);
      }
  }
  // The lower opening is unfilled down to its low balustrade; screens sit behind it.
  if (y > 0.1 && d) B(o, 'stone', x, y - 0.15, z - depth / 2, w + 0.35, 0.15, depth);
}
function railing(o, points, y, d) {
  if (!d) return;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    L(o, 'trim', [a[0], y + 0.93, a[1]], [b[0], y + 0.93, b[1]], 0.13, 0.18);
    if (!d) continue;
    const count = Math.max(
      1,
      Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (d === 1 ? 0.8 : 0.43)),
    );
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      column(o, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, y, 0.86, 0.082, d > 2 ? 2 : 1);
    }
  }
}
function balcony(o, x, z, d) {
  const n = [4, 6, 12, 20][d],
    points = Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI;
      return [x + 1.15 * Math.cos(a), z + 0.94 * Math.sin(a)];
    });
  cap(o, [[x - 1.15, z], ...points], 5.28);
  const profile = [
    [4.32, 0.25],
    [4.5, 0.48],
    [4.82, 0.85],
    [5.12, 1.04],
    [5.28, 1.15],
  ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const P = (k, row) => {
        const a = (k / n) * Math.PI,
          [y, r] = profile[row];
        return [x + r * Math.cos(a), y, z + r * 0.82 * Math.sin(a)];
      };
      Q(o, 'trim', [P(i, j - 1), P(i + 1, j - 1), P(i + 1, j), P(i, j)]);
    }
  railing(o, points, 5.32, d);
}
function hip(o, x0, x1, z0, z1, y0, y1, innerW, innerD, d) {
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2,
    a = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    b = [
      [x - innerW / 2, y1, z - innerD / 2],
      [x + innerW / 2, y1, z - innerD / 2],
      [x + innerW / 2, y1, z + innerD / 2],
      [x - innerW / 2, y1, z + innerD / 2],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, 'roof', [a[i], a[j], b[j], b[i]], [0, 1, 0]);
    if (d > 1) L(o, 'green', a[i], a[j], 0.14, 0.18);
    if (d > 1)
      for (let t = 0.1; t < 0.99; t += d > 2 ? 0.1 : 0.2) {
        const lerp = (aa, bb) => aa.map((v, k) => v + (bb[k] - v) * t + (k === 1 ? 0.022 : 0));
        L(o, 'roof', lerp(a[i], b[i]), lerp(a[j], b[j]), 0.055, 0.055);
      }
    if (d > 1) {
      const length = Math.hypot(a[i][0] - a[j][0], a[i][2] - a[j][2]);
      for (let k = 0; k < length; k += d > 2 ? 0.38 : 0.8) {
        const t = (k + 0.15) / length,
          q = a[i].map((v, k) => v + (a[j][k] - v) * t);
        L(o, 'green', [q[0], y0 - 0.42, q[2]], [q[0], y0, q[2]], 0.055);
      }
    }
  }
  Q(o, 'roof', b, [0, 1, 0]);
}
function gable(o, x0, x1, z0, z1, eave, ridge, d) {
  const x = (x0 + x1) / 2;
  Q(
    o,
    'roof',
    [
      [x0, eave, z0],
      [x, ridge, z0],
      [x, ridge, z1],
      [x0, eave, z1],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [x, ridge, z0],
      [x1, eave, z0],
      [x1, eave, z1],
      [x, ridge, z1],
    ],
    [0, 1, 0],
  );
  for (const [z, sign] of [
    [z0, -1],
    [z1, 1],
  ]) {
    T(
      o,
      'green',
      [
        [x0, eave, z],
        [x1, eave, z],
        [x, ridge, z],
      ],
      [0, 0, sign],
    );
    if (d > 1) for (const xx of [x0, x1]) L(o, 'green', [xx, eave, z], [x, ridge, z], 0.15, 0.2);
    if (d > 1)
      for (let xx = x0 + 0.15; xx < x1; xx += d > 2 ? 0.22 : 0.5) {
        const h = (1 - Math.abs(xx - x) / ((x1 - x0) / 2)) * (ridge - eave);
        L(o, 'green', [xx, eave, z + sign * 0.025], [xx, eave + h, z + sign * 0.025], 0.035);
      }
  }
}
function wing(o, a, b, z, d) {
  const pitch = (b - a) / 3;
  for (const [base, spring, crown, ceiling] of [
    [0.35, 3.22, 4.35, 5.15],
    [5.28, 8.28, 9.42, 10.05],
  ]) {
    for (let k = 0; k < 3; k++) {
      const x = a + (k + 0.5) * pitch;
      arch(o, x, z, base, pitch - 0.42, spring, crown, ceiling, d);
      screen(o, x, z - 1.35, base + 0.15, pitch - 0.45, ceiling - base - 0.45, d);
      if (d)
        railing(
          o,
          [
            [x - pitch / 2 + 0.2, z + 0.04],
            [x + pitch / 2 - 0.2, z + 0.04],
          ],
          base + 0.18,
          d,
        );
    }
    for (let k = 0; k <= 3; k++) {
      const x = a + k * pitch;
      if (!d) B(o, 'stone', x, base, z - 0.17, 0.42, spring - base, 0.42);
      else {
        column(o, x, z - 0.1, base, spring - base - 0.12, 0.17, d);
        B(o, 'trim', x, spring - 0.2, z - 0.1, 0.61, 0.22, 0.58);
      }
    }
  }
  for (const yy of [0.1, 5.05, 10.05, 10.67])
    B(o, 'trim', (a + b) / 2, yy, z - 0.1, b - a + 0.35, 0.18, 0.6);
  balcony(o, (a + b) / 2, z + 0.08, d);
  if (d > 1)
    for (const x of [a, b]) {
      B(o, 'trim', x, 5.25, z + 0.02, 0.6, 5.1, 0.38);
      for (const dx of [-0.16, 0, 0.16]) B(o, 'stone', x + dx, 5.65, z + 0.23, 0.045, 3.85, 0.04);
      B(o, 'trim', x, 9.8, z + 0.05, 0.85, 0.3, 0.6);
    }
}
function house(o, _frame, d = 3) {
  const outline = p.outline,
    frontEdges = new Set([18, 22, 24, 25]);
  for (let i = 0; i < outline.length; i++) {
    if (frontEdges.has(i)) continue;
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    Q(
      o,
      'stone',
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], 10.05, b[1]],
        [a[0], 10.05, a[1]],
      ],
      n,
    );
  }
  for (const y of [0.35, 5.15, 10.05]) cap(o, outline, y);
  wing(o, ...p.front.left, d);
  wing(o, ...p.front.right, d);
  const [a, b, z] = p.front.center,
    x = (a + b) / 2;
  arch(o, x, z, 0.35, 3.3, 3.2, 4.35, 5.15, d);
  for (const xx of [a + 0.55, b - 0.55]) B(o, 'stone', xx, 0, z - 0.18, 1.1, 5.15, 0.65);
  screen(o, x, z - 2.1, 0.4, 3.2, 4.1, d);
  screen(o, x, z - 1.15, 5.35, 5.7, 4.85, d);
  for (const xx of [a + 0.2, x, b - 0.2]) {
    if (d) column(o, xx, z - 0.1, 5.2, 5.12, 0.2, d);
    else B(o, 'trim', xx, 5.2, z - 0.1, 0.35, 5.12, 0.4);
  }
  railing(
    o,
    [
      [a + 0.2, z],
      [b - 0.2, z],
    ],
    5.3,
    d,
  );
  B(o, 'green', x, 10.18, z - 0.1, b - a + 0.35, 0.28, 0.32);
  for (const xx of [a + 0.2, b - 0.2])
    B(o, 'green', xx, 10.18, (z + 8.7) / 2, 0.2, 0.28, z - 8.7 + 0.5);
  gable(o, a - 0.45, b + 0.45, 8.7, z + 0.55, 10.4, 12.45, d);
  if (d > 1)
    for (let yy = 0.5; yy < 4.9; yy += 0.4)
      for (const xx of [a + 0.55, b - 0.55]) B(o, 'trim', xx, yy, z + 0.18, 1.03, 0.16, 0.08);
  // Two complete front hips with separate raised, green-trimmed ventilator caps.
  for (const [x0, x1, z0, z1] of [
    [-11.2, -1.75, -0.8, 9.55],
    [4.5, 14.05, -0.7, 9.3],
  ]) {
    hip(o, x0, x1, z0, z1, 10.95, 12.35, 3.25, 2.6, d);
    B(o, 'stone', (x0 + x1) / 2, 10.05, (z0 + z1) / 2, x1 - x0 - 0.7, 0.9, z1 - z0 - 0.65);
    B(o, 'green', (x0 + x1) / 2, 12.35, (z0 + z1) / 2, 3.25, 0.75, 2.6);
    hip(
      o,
      (x0 + x1) / 2 - 1.85,
      (x0 + x1) / 2 + 1.85,
      (z0 + z1) / 2 - 1.55,
      (z0 + z1) / 2 + 1.55,
      13.1,
      13.9,
      0.3,
      0.25,
      d,
    );
  }
  gable(o, -11.0, 13.6, -7.1, 0.1, 10.15, 11.65, d);
  hip(o, -11.3, -3.8, -13.7, -5.8, 10.1, 11.55, 1.1, 1.5, d);
  hip(o, 6.4, 13.8, -11.8, -5.8, 10.1, 11.55, 1.1, 1.0, d);
  // Unseen side/rear shutter census is an explicit bounded interpretation.
  if (d)
    for (const i of [0, 4, 8, 14, 19, 23]) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz),
        nx = dz / length,
        nz = -dx / length;
      for (let k = 0; k < 3; k++)
        for (const y of [1.3, 6.3]) {
          const t = (k + 0.5) / 3,
            cx = a[0] + dx * t,
            cz = a[1] + dz * t,
            w = Math.min(1.1, length / 4),
            u = [((dx / length) * w) / 2, ((dz / length) * w) / 2];
          Q(
            o,
            'green',
            [
              [cx - u[0] + nx * 0.03, y, cz - u[1] + nz * 0.03],
              [cx + u[0] + nx * 0.03, y, cz + u[1] + nz * 0.03],
              [cx + u[0] + nx * 0.03, y + 2.5, cz + u[1] + nz * 0.03],
              [cx - u[0] + nx * 0.03, y + 2.5, cz - u[1] + nz * 0.03],
            ],
            [nx, 0, nz],
          );
          if (d > 1) {
            const P = (t, yy) => [
              cx + (dx / length) * t + nx * 0.07,
              yy,
              cz + (dz / length) * t + nz * 0.07,
            ];
            for (const t of [-w / 2 - 0.07, w / 2 + 0.07])
              L(o, 'trim', P(t, y - 0.1), P(t, y + 2.6), 0.1);
            for (const yy of [y - 0.07, y + 2.55])
              L(o, 'trim', P(-w / 2 - 0.1, yy), P(w / 2 + 0.1, yy), 0.14);
            L(o, 'green', P(0, y), P(0, y + 2.5), 0.06);
          }
        }
    }
}
export function quaidHouseSkyline(o) {
  house(o, undefined, 0);
}
export function quaidHouseDistrict(o) {
  house(o, undefined, 1);
}
export function quaidHouseStreet(o) {
  house(o, undefined, 2);
}
export function quaidHouseCloseup(o) {
  house(o, undefined, 3);
}
export const quaidHouseModel = {
  id: 'quaid_e_azam_house',
  key: 'quaid_e_azam_house',
  cell: 'tk/tkr',
  recipe: 'structure-quaid-e-azam-house.mjs',
  title: 'Quaid-e-Azam House',
  category: 'residence',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: p.authoringDirection,
  build: house,
  surfaces,
  camera: [25, 17, 37],
  lookAt: [1, 6, 1],
  qaCameras: [
    {
      name: 'front-arches-balconies-green-gable-and-tiled-caps',
      position: [1, 8, 47],
      lookAt: [1, 6.6, 9],
    },
    {
      name: 'three-arch-two-storey-bay-and-round-balcony',
      position: [-9, 7, 21],
      lookAt: [-6.5, 6.3, 8.8],
    },
    {
      name: 'central-gabled-porch-real-ground-passage-and-screen',
      position: [8, 7, 26],
      lookAt: [0.9, 6, 13],
    },
    {
      name: 'native-rear-wings-and-roof-sections-estimated',
      position: [-28, 22, -32],
      lookAt: [1, 6, -3],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent160m65x65field frozen before geometry; fixed front-approach datum. Coarse urban DEM returns do not certify threshold/live host ground contact.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-quaid-e-azam-house.mjs',
    level: 'skyline',
    export: 'quaidHouseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'quaidHouseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'quaidHouseStreet', errorMeters: 0.14, surfaces },
      closeup: { export: 'quaidHouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'One exact4896x3672Miansari66own-workCC0original individually inspected after Qualla-first30family inventory. All local house photographs require attribution; unrelated PD FaizMahal excluded. No photographic textures or generated bitmap.',
    'Original complete medium-fi main-house exterior. Native two-storey outline controls ground perimeter; photographer front controls paired three-arch loggias, semicircular balconies, green fanlights/screens/gable, mouldings and separate red tiled hips/caps. Height13.9m, front partition/bearing, balcony sections, fine fluting/capital/fretwork/tile census and hidden roof/side/rear forms are bounded estimates, not measured elevations.',
    'Operator describes the main limestone/timber/red-tile house, annexe and out-houses separately. Detached auditorium/annexe/offices/garages/guard/kitchen buildings, fountain, garden/compound, flags/signs/people and interiors excluded; no whole-site pad.',
    'Independent160m65x65field/4225samples/one rawTerrariumtile unchanged after acquisition.2.5mgrid and4.33moutputpixels may oversample coarser native DEM and include urban/vegetation returns. Preview replaceFootprint=false; actual compatible host ground/threshold contact unverified.',
  ],
};
