/** Picture/PMTiles medium-fi Marunouchi frontage; original draft remains in its generator. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const TAU = 2 * Math.PI,
  X_SCALE = 319.17746935450333 / 335,
  MEANS = {
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    stone: [0.8863538324344638, 0.8863538324344638, 0.8863538324344638],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    metal: [0.7166240388540023, 0.7468631624871399, 0.755585931520634],
  };
const brick = [0.46, 0.155, 0.102],
  stone = [0.85, 0.77, 0.6],
  slate = [0.095, 0.105, 0.125],
  copper = [0.3, 0.17, 0.115],
  glass = [0.075, 0.12, 0.145],
  white = [0.83, 0.82, 0.73];
const ring = (cx, y, r, n) =>
  Array.from({ length: n }, (_, i) => [
    cx + r * Math.sin((TAU * i) / n + Math.PI / 8),
    y,
    r * Math.cos((TAU * i) / n + Math.PI / 8),
  ]);
const fit = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/xn/xn7/tokyo_station/pmtiles-fit.json',
      import.meta.url,
    ),
  ),
);
function ground(x, z) {
  const g = fit.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - fit.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function build(destination, d) {
  const far = d === 0;
  function emit(s, r, p, hint, _uv, c) {
    p = p.map(([x, y, z]) => [Math.fround(x * X_SCALE), Math.fround(y), Math.fround(z)]);
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        s,
        r,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        far ? c.map((v, j) => v * (MEANS[s]?.[j] ?? 1)) : c,
      );
    }
  }
  const o = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]),
    ),
    face = (s, p, c, h) => emit(s, 'palette:#ffffff', p, h, null, c),
    rect = (x, y, hx, hz) => [
      [x - hx, y, -hz],
      [x - hx, y, hz],
      [x + hx, y, hz],
      [x + hx, y, -hz],
    ],
    clock = (cx, y, z, r = 1.4) => {
      const n = far ? 8 : 24;
      for (let i = 0; i < n; i++)
        face(
          'stone',
          [
            [cx, y, z],
            [cx + r * Math.sin((i * TAU) / n), y + r * Math.cos((i * TAU) / n), z],
            [cx + r * Math.sin(((i + 1) * TAU) / n), y + r * Math.cos(((i + 1) * TAU) / n), z],
          ],
          stone,
          [0, 0, 1],
        );
      if (!far) {
        face(
          'glass',
          [
            [cx - 0.08, y - 0.1, z + 0.02],
            [cx - 0.7, y + 0.68, z + 0.02],
            [cx - 0.6, y + 0.76, z + 0.02],
            [cx + 0.08, y + 0.1, z + 0.02],
          ],
          glass,
          [0, 0, 1],
        );
        face(
          'glass',
          [
            [cx - 0.07, y - 0.1, z + 0.02],
            [cx + 0.78, y + 0.6, z + 0.02],
            [cx + 0.7, y + 0.7, z + 0.02],
            [cx + 0.07, y + 0.1, z + 0.02],
          ],
          glass,
          [0, 0, 1],
        );
      }
    };
  box(o, 'brick', [-167.5, 0, -14], [167.5, 21, 14], brick);
  loft(
    o,
    'stone',
    [
      rect(0, 0, 170, 15).map(([x, _, z]) => [x, Math.min(-0.2, ground(x * X_SCALE, z) - 0.2), z]),
      rect(0, 0.7, 170, 15),
    ],
    stone,
  );
  loft(o, 'slate', [rect(0, 21, 169, 15), rect(0, 24, 165, 11), rect(0, 25.5, 165, 6)], slate);
  for (const y of [0.8, 7.2, 14.1, 20.6])
    box(o, 'stone', [-167.7, y, 14], [167.7, y + 0.23, 14.3], stone);
  function window(x, y, z, w = 1.7, h = 3.45, side = 1) {
    face(
      'glass',
      [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ],
      glass,
      [0, 0, side],
    );
    if (!far) {
      const q = 0.14;
      for (const [a, b, c, e] of [
        [x - w / 2 - q, y - q, w + 2 * q, q],
        [x - w / 2 - q, y + h, w + 2 * q, q],
        [x - w / 2 - q, y, q, h],
        [x + w / 2, y, q, h],
      ])
        face(
          'stone',
          [
            [a, b, z + 0.02 * side],
            [a + c, b, z + 0.02 * side],
            [a + c, b + e, z + 0.02 * side],
            [a, b + e, z + 0.02 * side],
          ],
          stone,
          [0, 0, side],
        );
    }
    if (d >= 2 && side === 1) {
      face(
        'stone',
        [
          [x - 0.045, y, z + 0.04],
          [x + 0.045, y, z + 0.04],
          [x + 0.045, y + h, z + 0.04],
          [x - 0.045, y + h, z + 0.04],
        ],
        white,
        [0, 0, 1],
      );
      face(
        'stone',
        [
          [x - w / 2, y + h * 0.55, z + 0.04],
          [x + w / 2, y + h * 0.55, z + 0.04],
          [x + w / 2, y + h * 0.55 + 0.08, z + 0.04],
          [x - w / 2, y + h * 0.55 + 0.08, z + 0.04],
        ],
        white,
        [0, 0, 1],
      );
      box(o, 'stone', [x - w / 2 - 0.2, y - 0.18, z], [x + w / 2 + 0.2, y - 0.05, z + 0.4], stone);
    }
  }
  const bays = [12, 40, 64, 72, 72][d];
  for (let i = 0; i < bays; i++) {
    const x = -162 + (i * 324) / (bays - 1);
    if (Math.abs(Math.abs(x) - 116) < 18 || Math.abs(x) < 13 || Math.abs(Math.abs(x) - 68) < 11)
      continue;
    for (const z of [-14.04, 14.04])
      for (const y of [2.5, 9, 15.8]) window(x, y, z, 1.8, 3.45, Math.sign(z));
    if (d >= 2 && i % 3 === 0)
      box(o, 'stone', [x - 2.15, 0.7, 14.05], [x - 1.85, 20.7, 14.45], stone);
  }
  for (const x of [-68, 0, 68]) {
    const hx = x === 0 ? 12 : 10,
      h = x === 0 ? 24 : 22;
    box(o, 'brick', [x - hx, 0, -14], [x + hx, h, 18], brick);
    loft(
      o,
      'slate',
      [rect(x, h, hx + 0.5, 18.5), rect(x, h + 3, hx - 2, 12), rect(x, h + 4, hx - 3, 7)],
      slate,
    );
    for (const y of [0.8, 7.2, 14.1, h - 0.6])
      box(o, 'stone', [x - hx - 0.1, y, 18], [x + hx + 0.1, y + 0.25, 18.3], stone);
    for (const dx of [-6, 0, 6]) for (const y of [2.5, 9, 15.8]) window(x + dx, y, 18.04, 2, 3.45);
    if (x === 0) {
      face(
        'brick',
        [
          [x - 8, 24, 18.1],
          [x + 8, 24, 18.1],
          [x, 29, 18.1],
        ],
        brick,
        [0, 0, 1],
      );
      clock(x, 25.7, 18.15);
    }
  }
  const domeN = far ? 8 : d === 1 ? 12 : d === 2 ? 16 : 32;
  for (const cx of [-116, 116]) {
    loft(o, 'brick', [ring(cx, 0, 17.5, 8), ring(cx, 22.8, 17.5, 8)], brick);
    loft(o, 'stone', [ring(cx, 22.8, 17.8, 8), ring(cx, 23.2, 17.8, 8)], stone);
    loft(o, 'brick', [ring(cx, 23.2, 14.6, 8), ring(cx, 26, 14.6, 8)], brick);
    loft(
      o,
      'metal',
      (far
        ? [
            [26, 15.2],
            [30, 12.9],
            [33.4, 4.3],
            [36, 0.15],
          ]
        : [
            [26, 15.2],
            [27, 15],
            [30, 12.9],
            [32, 9.5],
            [33.4, 4.3],
            [34, 0.7],
            [36, 0.15],
          ]
      ).map(([y, r]) => ring(cx, y, r, domeN)),
      slate,
    );
    for (const y of [0.8, 7.2, 14.1, 20.6])
      box(o, 'stone', [cx - 13, y, 16.15], [cx + 13, y + 0.24, 16.4], stone);
    for (const dx of [-10, -5, 5, 10])
      for (const y of [2.5, 9, 15.8]) window(cx + dx, y, 16.2, 1.9, 3.3);
    for (const dx of [-8, -4, 0, 4, 8]) window(cx + dx, 23.5, 13.55, 1.1, 1.8);
    face(
      'brick',
      [
        [cx - 7, 21, 16.4],
        [cx + 7, 21, 16.4],
        [cx, 26, 16.4],
      ],
      brick,
      [0, 0, 1],
    );
    clock(cx, 23, 16.5, 1.2);
    face(
      'glass',
      [
        [cx - 3, 0.7, 16.2],
        [cx + 3, 0.7, 16.2],
        [cx + 3, 7, 16.2],
        [cx - 3, 7, 16.2],
      ],
      glass,
      [0, 0, 1],
    );
    if (d >= 2) {
      const rs = [
        [26, 15.22],
        [27, 15.02],
        [30, 12.92],
        [32, 9.52],
        [33.4, 4.32],
        [34, 0.72],
      ];
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + Math.PI / 8;
        for (let j = 0; j < rs.length - 1; j++) {
          const p = rs[j],
            q = rs[j + 1];
          beam(
            o,
            'metal',
            [cx + p[1] * Math.sin(a), p[0], p[1] * Math.cos(a)],
            [cx + q[1] * Math.sin(a), q[0], q[1] * Math.cos(a)],
            0.2,
            0.18,
            copper,
          );
        }
        const x = cx + 14 * Math.sin(a),
          z = 14 * Math.cos(a);
        loft(
          o,
          'metal',
          [
            ring(x, 28, 1.1, 8).map((v) => [v[0], v[1], v[2] + z]),
            ring(x, 29.5, 0.15, 8).map((v) => [v[0], v[1], v[2] + z]),
          ],
          copper,
        );
      }
      box(o, 'metal', [cx - 19, 0.8, 16.6], [cx + 19, 1.1, 23], copper);
      face(
        'metal',
        [
          [cx - 19, 3.6, 16.8],
          [cx + 19, 3.6, 16.8],
          [cx + 19, 3, 23],
          [cx - 19, 3, 23],
        ],
        copper,
        [0, 1, 0],
      );
    }
  }
  if (!far)
    for (const x of [-163, -68, 68, 163])
      for (const z of [12]) {
        loft(
          o,
          'brick',
          [
            ring(x, 19, 3, 8).map((v) => [v[0], v[1], v[2] + z]),
            ring(x, 23.3, 3, 8).map((v) => [v[0], v[1], v[2] + z]),
          ],
          brick,
        );
        loft(
          o,
          'metal',
          [
            ring(x, 23.3, 3.2, 8).map((v) => [v[0], v[1], v[2] + z]),
            ring(x, 26.5, 0.5, 8).map((v) => [v[0], v[1], v[2] + z]),
          ],
          copper,
        );
      }
  if (d >= 2)
    for (let i = 0; i < 20; i++) {
      const x = -156 + (i * 312) / 19;
      if (Math.abs(Math.abs(x) - 116) < 20 || Math.abs(x) < 13) continue;
      box(o, 'brick', [x - 1, 23.2, 9.8], [x + 1, 25.5, 12], brick);
      face(
        'glass',
        [
          [x - 0.65, 23.4, 12.04],
          [x + 0.65, 23.4, 12.04],
          [x + 0.65, 24.8, 12.04],
          [x - 0.65, 24.8, 12.04],
        ],
        glass,
        [0, 0, 1],
      );
      loft(o, 'slate', [rect(x, 25.5, 1.3, 2), rect(x, 26.1, 0.8, 1)], slate);
    }
}
export const buildTokyoStationMaster = (o) => build(o, 4);
export const buildTokyoStationSkyline = (o) => build(o, 0);
export const buildTokyoStationDistrict = (o) => build(o, 1);
export const buildTokyoStationStreet = (o) => build(o, 2);
export const buildTokyoStationCloseup = (o) => build(o, 3);
