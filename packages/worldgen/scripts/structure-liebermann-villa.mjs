/** Restored Liebermann villa: separately observed street and lake elevations. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff';
const plaster = rgb('a98f7d'),
  stone = rgb('cdc5ad'),
  trim = rgb('e5dfcb'),
  roof = rgb('71635b'),
  mint = rgb('83a38b'),
  glass = rgb('485658'),
  iron = rgb('323a37');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uu = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uu[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function window(o, x, y, z, w, h, d, shutters = false, closed = false) {
  face(o, closed ? 'wood' : 'glass', x, y, z, w, h, closed ? mint : glass);
  if (d < 2) {
    if (shutters)
      for (const sg of [-1, 1])
        face(o, 'wood', x + sg * (w * 0.76 + 0.14), y, z + 0.02, w * 0.48, h, mint);
    return;
  }
  for (const xx of [-w / 2 - 0.05, w / 2 + 0.05])
    face(o, 'stone', x + xx, y - 0.08, z + 0.02, 0.1, h + 0.16, trim);
  for (const yy of [y - 0.08, y + h]) face(o, 'stone', x, yy, z + 0.025, w + 0.2, 0.1, trim);
  if (!closed) {
    face(o, 'wood', x, y, z + 0.04, 0.06, h, trim);
    for (const yy of [y + h * 0.34, y + h * 0.77]) face(o, 'wood', x, yy, z + 0.04, w, 0.055, trim);
  }
  B(o, 'stone', x, y - 0.16, z + 0.05, w + 0.28, 0.1, 0.23, stone);
  if (shutters)
    for (const sg of [-1, 1]) {
      const xx = x + sg * (w * 0.76 + 0.14);
      B(o, 'wood', xx, y - 0.04, z + 0.03, w * 0.48, h + 0.1, 0.07, mint);
      if (d > 2) {
        for (const dx of [-w * 0.2, w * 0.2])
          face(o, 'wood', xx + dx, y, z + 0.075, 0.055, h, trim);
        for (let yy = y + 0.08; yy < y + h; yy += 0.11)
          face(o, 'wood', xx, yy, z + 0.08, w * 0.38, 0.035, iron);
      }
    }
  if (closed && d > 2)
    for (let yy = y + 0.07; yy < y + h; yy += 0.11)
      face(o, 'wood', x, yy, z + 0.05, w - 0.1, 0.025, rgb('5e7f6a'));
}
function guard(o, x, y, z, w, d) {
  if (d < 2) return;
  for (const yy of [y, y + 0.85]) B(o, 'metal', x, yy, z, w, 0.045, 0.04, iron);
  const n = d > 2 ? Math.round(w / 0.17) : 5;
  for (let i = 0; i <= n; i++) {
    const xx = x - w / 2 + (i * w) / n;
    B(o, 'metal', xx, y, z, 0.025, 0.9, 0.025, iron);
    if (d > 2) {
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4,
          b = ((j + 1) * Math.PI) / 4;
        beam(
          o,
          'metal',
          [xx + Math.sin(a) * 0.07, y + 0.4 + Math.cos(a) * 0.35, z],
          [xx + Math.sin(b) * 0.07, y + 0.4 + Math.cos(b) * 0.35, z],
          0.018,
          0.022,
          iron,
        );
      }
    }
  }
}
function column(o, x, z, y, h, r, d, ionic = false) {
  const n = d > 2 ? 24 : d > 1 ? 16 : 8;
  B(o, 'stone', x, y, z, r * 2.5, 0.16, r * 2.5, stone);
  loft(
    o,
    'stone',
    [
      [0.16, r * 1.16],
      [0.27, r * 1.22],
      [0.37, r],
      [h - 0.5, r * 0.84],
      [h - 0.38, r],
      [h - 0.27, r * 1.1],
    ].map(([yy, rr]) => radialRing(y + yy, rr, rr, n, [x, z])),
    stone,
  );
  B(o, 'stone', x, y + h - 0.27, z, r * 2.8, 0.27, r * 2.35, trim);
  if (ionic && d > 1)
    for (const sg of [-1, 1]) {
      const xx = x + sg * r * 0.93;
      for (let k = 0; k < (d > 2 ? 24 : 12); k++) {
        const steps = d > 2 ? 24 : 12,
          a = (k * Math.PI * 3) / steps,
          b = ((k + 1) * Math.PI * 3) / steps,
          ra = r * 0.5 * (1 - (k / steps) * 0.75),
          rb = r * 0.5 * (1 - ((k + 1) / steps) * 0.75);
        beam(
          o,
          'stone',
          [xx + Math.cos(a) * ra, y + h - 0.28 + Math.sin(a) * ra, z + r * 1.1],
          [xx + Math.cos(b) * rb, y + h - 0.28 + Math.sin(b) * rb, z + r * 1.1],
          0.055,
          0.08,
          stone,
        );
      }
    }
}
function balustrade(o, x, y, z, w, d) {
  B(o, 'stone', x, y, z, w, 0.1, 0.23, stone);
  B(o, 'stone', x, y + 0.75, z, w + 0.15, 0.12, 0.27, stone);
  if (d > 1) {
    const n = Math.round(w / 0.31);
    for (let i = 0; i <= n; i++) {
      const xx = x - w / 2 + (i * w) / n;
      loft(
        o,
        'stone',
        [
          [0, 0.055],
          [0.12, 0.08],
          [0.28, 0.055],
          [0.39, 0.1],
          [0.55, 0.055],
          [0.65, 0.065],
        ].map(([yy, r]) => radialRing(y + 0.1 + yy, r, r, d > 2 ? 8 : 4, [xx, z])),
        stone,
      );
    }
  }
}
function eyebrowHeight(x, z) {
  const bump =
    Math.abs(x) < 3.15
      ? 1.2 * Math.max(0, 1 - (x / 3.15) * (x / 3.15)) * Math.max(0, Math.min(1, (z - 2.5) / 3.3))
      : 0;
  return 8.65 + ((7.7 - z) * 5.45) / 7.7 + (z <= 5.8 ? bump : 0);
}
function tileRoof(o, d) {
  // The street roof has an actual curved raised sheet and an open vertical dormer face.
  const rows = d > 2 ? 30 : d > 1 ? 14 : 6,
    cols = d > 2 ? 48 : d > 1 ? 24 : 12;
  for (const [za, zb] of [
    [0.001, 5.8],
    [5.8, 7.7],
  ])
    for (let j = 0; j < (d > 0 ? rows : 3); j++) {
      const nr = d > 0 ? rows : 3,
        z0 = za + ((zb - za) * j) / nr,
        z1 = za + ((zb - za) * (j + 1)) / nr;
      for (let i = 0; i < (d > 0 ? cols : 6); i++) {
        const nc = d > 0 ? cols : 6,
          t0 = -1 + (2 * i) / nc,
          t1 = -1 + (2 * (i + 1)) / nc,
          xx = (t, z) => t * (4.7 + (5.6 * z) / 7.7),
          yy = (x, z) => (za === 5.8 ? 8.65 + ((7.7 - z) * 5.45) / 7.7 : eyebrowHeight(x, z)),
          p = [
            [xx(t0, z0), yy(xx(t0, z0), z0), z0],
            [xx(t1, z0), yy(xx(t1, z0), z0), z0],
            [xx(t1, z1), yy(xx(t1, z1), z1), z1],
            [xx(t0, z1), yy(xx(t0, z1), z1), z1],
          ];
        quad(o, 'roof', p, normalFor(p[3], p[2], p[1]), roof);
      }
    }
  const y0 = 8.65 + ((7.7 - 5.8) * 5.45) / 7.7;
  {
    const n = d > 2 ? 30 : d > 0 ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const x0 = -3.15 + (6.3 * i) / n,
        x1 = -3.15 + (6.3 * (i + 1)) / n,
        h0 = 1.2 * (1 - (x0 / 3.15) * (x0 / 3.15)),
        h1 = 1.2 * (1 - (x1 / 3.15) * (x1 / 3.15));
      const p = [
        [x0, y0, 5.81],
        [x1, y0, 5.81],
        [x1, y0 + h1, 5.81],
        [x0, y0 + h0, 5.81],
      ];
      if (h0 < 0.001 || h1 < 0.001) {
        const pp = h0 < 0.001 ? p.slice(0, 3) : [p[0], p[1], p[3]];
        o.addTriangle(
          'wood',
          ref,
          pp,
          [0, 0, 1],
          pp.map((v) => [v[0], v[1]]),
          trim,
        );
      } else quad(o, 'wood', p, [0, 0, 1], trim);
      if (h0 > 0.15 && h1 > 0.15)
        quad(
          o,
          'glass',
          [
            [x0, y0 + 0.08, 5.82],
            [x1, y0 + 0.08, 5.82],
            [x1, y0 + h1 - 0.1, 5.82],
            [x0, y0 + h0 - 0.1, 5.82],
          ],
          [0, 0, 1],
          glass,
        );
      if (d > 1) beam(o, 'wood', [x0, y0 + h0, 5.84], [x1, y0 + h1, 5.84], 0.1, 0.12, trim);
    }
    if (d > 1) {
      for (const x of [-2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1])
        face(o, 'wood', x, y0, 5.85, 0.07, 1.2 * (1 - (x / 3.15) * (x / 3.15)), trim);
      B(o, 'wood', 0, y0, 5.85, 6.3, 0.1, 0.13, trim);
      face(o, 'wood', 0, y0 + 0.43, 5.86, 4.9, 0.05, trim);
    }
  }
  quad(
    o,
    'roof',
    [
      [-10.3, 8.65, -7.7],
      [10.3, 8.65, -7.7],
      [4.7, 14.1, 0],
      [-4.7, 14.1, 0],
    ],
    [0, 1, -0.71],
    roof,
  );
  for (const s of [-1, 1])
    o.addTriangle(
      'roof',
      ref,
      [
        [s * 10.3, 8.65, -7.7],
        [s * 10.3, 8.65, 7.7],
        [s * 4.7, 14.1, 0],
      ],
      [s * 0.98, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      roof,
    );
  if (d > 1) {
    B(o, 'roof', 0, 14.08, 0, 9.6, 0.12, 0.22, rgb('625850'));
    for (const s of [-1, 1])
      for (const z of [-7.7, 7.7])
        beam(o, 'roof', [s * 10.3, 8.66, z], [s * 4.7, 14.12, 0], 0.14, 0.14, rgb('625850'));
  }
  // Row seams resolve the tile scale without embedding reference photographs.
  if (d > 2)
    for (let z = 0.25; z < 7.7; z += 0.28) {
      const n = 40,
        w = 4.7 + (5.6 * z) / 7.7;
      for (let i = 0; i < n; i++) {
        const x0 = -w + (2 * w * i) / n,
          x1 = -w + (2 * w * (i + 1)) / n;
        quad(
          o,
          'roof',
          [
            [x0, eyebrowHeight(x0, z) + 0.015, z],
            [x1, eyebrowHeight(x1, z) + 0.015, z],
            [x1, eyebrowHeight(x1, z + 0.025) + 0.015, z + 0.025],
            [x0, eyebrowHeight(x0, z + 0.025) + 0.015, z + 0.025],
          ],
          [0, 1, 0.71],
          rgb('5b534c'),
        );
      }
      const y = 8.65 + ((7.7 - z) * 5.45) / 7.7;
      quad(
        o,
        'roof',
        [
          [-w, y + 0.015, -z],
          [w, y + 0.015, -z],
          [w, y + 0.005, -z - 0.025],
          [-w, y + 0.005, -z - 0.025],
        ],
        [0, 1, -0.71],
        rgb('5b534c'),
      );
    }
}
function villa(o, _frame, d = 3) {
  // Split ground mass leaves the southwest lake-facing loggia genuinely open.
  B(o, 'stone', 0, -1.2, 0, 19.45, 1.75, 14.3, stone);
  B(o, 'wall', 0, 0.55, 1.3, 19.45, 7.7, 9.7, plaster);
  B(o, 'wall', -2.6, 0.55, -5.3, 14.25, 7.7, 3.7, plaster);
  B(o, 'wall', 7.15, 4.3, -5.3, 5.2, 3.95, 3.7, plaster);
  // Recessed three-bay street centre flanked by two solid outer bays.
  for (const x of [-7.15, 7.15]) B(o, 'wall', x, 0.55, 6.65, 5.15, 7.7, 1, plaster);
  B(o, 'stone', 0, 8.1, 0, 19.8, 0.3, 14.65, stone);
  B(o, 'stone', 0, 8.4, 0, 20.3, 0.25, 15.15, trim);
  B(o, 'stone', 0, 0.25, 7.05, 9, 0.3, 2.5, stone);
  for (let k = 0; k < 3; k++) B(o, 'stone', 0, k * 0.16, 8.4 - k * 0.32, 3.5, 0.16, 0.35, stone);
  for (const x of [-1.65, 1.65]) column(o, x, 7.04, 0.55, 7.55, 0.48, d, true);
  if (d > 0) {
    for (const x of [-7, 7]) {
      window(o, x, 0.7, 7.16, 1.4, 3.2, d, true);
      window(o, x, 5.1, 7.16, 1.4, 2.5, d, true);
      guard(o, x, 0.75, 7.3, 1.45, d);
    }
    for (const x of [-3.2, 0, 3.2]) {
      window(o, x, 0.7, 6.17, 1.35, 3.2, d);
      window(o, x, 5.1, 6.17, 1.35, 2.5, d, false, x === -3.2);
    }
    for (const x of [-3.25, 3.25]) balustrade(o, x, 0.65, 7.05, 2.45, d);
  }
  if (d === 0)
    for (const x of [-7, 0, 7])
      for (const y of [0.8, 5.1]) face(o, 'glass', x, y, x === 0 ? 6.17 : 7.16, 1.4, 2.5, glass);
  if (d > 1) face(o, 'wood', 0, 0.7, 6.23, 1.28, 0.5, trim);
  // Lake risalit and its three tall openings, flanked by two bays on each side.
  B(o, 'wall', 0, 0.55, -7.38, 8.7, 7.7, 0.55, plaster);
  const lake = facing(o, Math.PI);
  for (const x of [-4.3, -1.45, 1.45, 4.3]) B(lake, 'stone', x, 0.55, 7.71, 0.3, 7.65, 0.12, stone);
  B(lake, 'stone', 0, 8.1, 7.74, 8.9, 0.3, 0.25, trim);
  o.addTriangle(
    'wall',
    ref,
    [
      [-4.5, 8.4, -7.85],
      [4.5, 8.4, -7.85],
      [0, 11.1, -7.85],
    ],
    [0, 0, -1],
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    plaster,
  );
  for (const s of [-1, 1]) {
    beam(o, 'stone', [s * 4.6, 8.4, -7.88], [0, 11.18, -7.88], 0.19, 0.25, stone);
    quad(
      o,
      'roof',
      [
        [s * 4.6, 8.6, -7.78],
        [0, 11.26, -7.78],
        [0, 11.26, -3.8],
        [s * 4.6, 8.6, -3.8],
      ],
      [s * 0.6, 1, 0],
      roof,
    );
  }
  if (d > 0) {
    for (const x of [-2.8, 0, 2.8]) {
      window(lake, x, 0.6, 7.76, 1.5, 3.15, d);
      window(lake, x, 4.75, 7.76, 1.5, 2.95, d, false, x !== -2.8);
      guard(lake, x, 4.8, 7.95, 1.55, d);
    }
    for (const x of [-8.3, -5.8, 5.8, 8.3]) {
      window(lake, x, 5.1, 7.16, 1.25, 2.4, d, true, true);
      if (x > 0) window(lake, x, 0.6, 7.16, 1.25, 3.15, d, true);
    }
    const n = d > 2 ? 32 : 16,
      p = [];
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      p.push([Math.cos(a) * 0.48, 9.6 + Math.sin(a) * 0.63, 7.9]);
    }
    lake.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
    for (let i = 0; i < n; i++) beam(lake, 'stone', p[i], p[(i + 1) % n], 0.12, 0.15, trim);
    if (d > 1) {
      face(lake, 'wood', 0, 9.04, 8.0, 0.045, 1.12, trim);
      face(lake, 'wood', 0, 9.6, 8.0, 0.85, 0.045, trim);
    }
  }
  // Open southwest loggia: one pier at the outer corner and one slender round support.
  B(o, 'stone', 9.47, 0.55, -7.0, 0.5, 3.75, 0.45, stone);
  column(o, 6.1, -7.04, 0.55, 3.75, 0.16, d);
  B(o, 'stone', 7.1, 4.12, -7.08, 5.25, 0.18, 0.35, trim);
  if (d > 0) {
    const inside = facing(o, Math.PI);
    window(inside, -7.2, 1.1, 3.48, 2.8, 2.7, d);
  }
  // Upper terrace only; wider stepped garden and freestanding garden house are outside scope.
  B(o, 'stone', 0, -1.2, -9.18, 22.8, 1.75, 4.05, stone);
  B(o, 'stone', 0, 0.5, -9.18, 23, 0.12, 4.2, stone);
  for (const x of [-10.5, 10.5])
    for (let k = 0; k < 5; k++)
      B(o, 'stone', x, -0.35 + k * 0.18, -12.0 + k * 0.32, 1.8, 0.18, 0.36, stone);
  if (d > 1) {
    for (let x = -11.1; x < 11.1; x += 0.75)
      face(lake, 'stone', x, -0.5, 11.23, 0.025, 1.0, rgb('a19987'));
  }
  for (const s of [-1, 1]) {
    const side = facing(o, (s * Math.PI) / 2, s * 9.73, 0);
    if (d > 0)
      for (const x of [-4.6, 0, 4.6]) {
        if (!(s > 0 && x > 2)) window(side, x, 0.85, 0, 1.3, 2.9, d, true);
        window(side, x, 5.1, 0, 1.3, 2.4, d, true);
      }
    if (d > 1) {
      B(o, 'metal', s * 9.8, 0.3, 6.7, 0.11, 8.1, 0.11, rgb('626b61'));
      B(o, 'metal', s * 9.8, 0.3, -6.8, 0.11, 8.1, 0.11, rgb('626b61'));
    }
  }
  tileRoof(o, d);
  for (const [x, z] of [
    [-4.2, -1.2],
    [4.1, 1.0],
  ]) {
    B(o, 'wall', x, 12.8, z, 0.6, 2.05, 0.65, rgb('925f46'));
    B(o, 'stone', x, 14.8, z, 0.68, 0.12, 0.73, stone);
    if (d > 2)
      for (let y = 13; y < 14.8; y += 0.15)
        for (const s of [-1, 1])
          face(facing(o, s < 0 ? Math.PI : 0), 'stone', s * x, y, s * z + 0.33, 0.6, 0.018, stone);
  }
}
export function liebermannSkyline(o) {
  villa(o, undefined, 0);
}
export function liebermannDistrict(o) {
  villa(o, undefined, 1);
}
export function liebermannStreet(o) {
  villa(o, undefined, 2);
}
const surfaces = {
  wall: { ...landmarkSurfaces.stone, graph: 'plaster_lime', slot: 'wall' },
  stone: { ...landmarkSurfaces.stone, graph: 'stone_limestone' },
  roof: { ...landmarkSurfaces.roof, graph: 'tile_flat' },
  wood: { ...landmarkSurfaces.stone, graph: 'wood_painted_lap', slot: 'trim' },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const liebermannModel = {
  id: 'liebermann_villa',
  recipe: 'structure-liebermann-villa.mjs',
  key: 'liebermann_villa',
  cell: 'u3/u33',
  title: 'Liebermann Villa',
  brief:
    'Restored Wannsee villa with two tall street-front Ionic columns, curved eyebrow dormer, hipped tile roof, lake-facing three-bay pediment, open side loggia, mint shutters and raised terrace.',
  camera: [32, 24, 40],
  lookAt: [0, 5, 0],
  qaCameras: [
    { name: 'front', position: [0, 8, 42], lookAt: [0, 6, 0] },
    { name: 'back', position: [-26, 18, -38], lookAt: [0, 5, -3] },
  ],
  build: villa,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Street-side approach [0,10] outside the entrance steps; independent terrain is preserved unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-liebermann-villa.mjs',
    level: 'skyline',
    export: 'liebermannSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'liebermannDistrict', errorMeters: 0.22, surfaces },
      street: { export: 'liebermannStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    'Original medium-fi restored villa exterior reviewed against the public-domain 1918 painting already published on Qualla and factual descriptions by Berlin heritage authorities, the restoring architects and the museum. Earlier attribution-only photos are excluded from the current review; this is not a measured survey.',
    'Mapped rectangle controls main building width and depth. Roof pitch and eyebrow curve, paint shades, terrace depth, side openings, small side entrance/pergola and Ionic capitals are approximate; the painting does not establish every elevation or current paint colour.',
    'Street columns, lake pediment and southwest open loggia are distinct. Wider garden, separate garden house, interiors, furniture and vegetation are excluded.',
    'No reference-image pixels are embedded. Shared materials and original simplified geometry represent tile, shutters, iron guards and limestone.',
    'Independent terrain remains unchanged; another host DEM can change exact foundation contact.',
  ],
};
