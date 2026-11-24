import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  wood: { slot: 'wall', graph: 'wood_vertical', roughness: 0.96 },
  gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.74 },
  bronze: { slot: 'trim', graph: 'metal_copper', roughness: 0.74 },
  foundation: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  mosaic: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'colored-glass-mosaic',
    metallic: 0.36,
    roughness: 0.49,
  },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const D = site.frame.depth,
  g = site.grade;
const roof = rgb('8f6956');
const roofHigh = rgb('a2735a');
const plaster = rgb('ddd1b8');
const wood = rgb('685148');
const dark = rgb('5d4b44');
const red = rgb('a56253');
const gold = rgb('cab471');
const softgold = rgb('bda56d');
const jade = rgb('518475');
const stone = rgb('c9c5b5');
const mosaicColors = ['788faf', '6a89b2', 'a4aed1', '72a698', '7796ad', 'c4ba92'].map(rgb);
const mix = (a, b, t) => a + (b - a) * t;
const plate = (out, slot, f, u, U, y, Y, d, c) =>
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), c);
function slab(out, ring, y, Y, c) {
  extrude(out, 'foundation', ring, y, Y, c, { top: false });
  cap(out, 'foundation', ring, Y, c);
}

function swept(out, f, w, a, b, eave, peak, detail, { gable = true, finial = true } = {}) {
  const n = [2, 4, 7, 12][detail],
    curves = [1, 2, 3, 4][detail];
  const height = (t) => eave + (peak - eave) * Math.pow(1 - t, 1.79) + 0.065 * t * t;
  const pts = Array.from({ length: curves + 1 }, (_, j) => {
    const t = j / curves,
      d = mix(a, b, t);
    const lift = 0.14 * Math.sin(t * Math.PI) * Math.sin(t * Math.PI);
    return Array.from({ length: n * 2 + 1 }, (_, i) => {
      const s = i / n - 1,
        y = height(Math.abs(s));
      return f.P(w * s, y + lift, d);
    });
  });
  for (let j = 0; j < curves; j++)
    for (let i = 0; i < n * 2; i++) {
      const [a, b, c, d] = [pts[j + 1][i], pts[j + 1][i + 1], pts[j][i + 1], pts[j][i]];
      tri(out, 'tile', a, b, c, i % 4 === 0 ? roofHigh : roof);
      tri(out, 'tile', a, c, d, i % 4 === 0 ? roofHigh : roof);
    }
  for (const s of [-1, 1]) {
    const d = s === 1 ? b : a;
    const face = facade(
      xz(f.P(0, 0, d)),
      f.along.map((v) => v * s),
    );
    for (let i = 0; i < n * 2; i++) {
      const a = i / n - 1,
        b = (i + 1) / n - 1;
      const h = height(Math.abs(a)),
        H = height(Math.abs(b));
      const x = w * a,
        X = w * b;
      const rim = detail > 0 ? 0.19 : 0.139;
      quad4(
        out,
        'wall',
        face.P(x, h - rim, 0.014),
        face.P(X, H - rim, 0.014),
        face.P(X, H, 0.019),
        face.P(x, h, 0.019),
        plaster,
      );
      if (gable)
        quad4(
          out,
          'wood',
          face.P(x, eave - 0.08, -0.025),
          face.P(X, eave - 0.08, -0.025),
          face.P(X, H - 0.064, -0.025),
          face.P(x, h - 0.064, -0.025),
          wood,
        );
      if (detail > 2 && gable) {
        const q = (x + X) / 2,
          y = (h + H) / 2;
        if (y > eave + 0.48) {
          tri(
            out,
            'gold',
            face.P(q - 0.1, eave + 0.16, 0.001),
            face.P(q + 0.11, eave + 0.16, 0.001),
            face.P(q, y - 0.25, 0.003),
            softgold,
          );
        }
      }
    }
    if (finial) {
      const A = face.P(0, peak - 0.18, -0.01),
        B = face.P(0, peak + 0.51, 0.25),
        C = face.P(0, peak + 1.1, 0.63);
      beam(out, 'bronze', A, B, 0.211, 0.23, jade);
      if (detail > 0) beam(out, 'bronze', B, C, 0.087, 0.104, jade);
    }
  }
}

function stairs(out, f, u, w, y, Y, d, detail) {
  const n = [2, 3, 6, 8][detail];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    fbox(
      out,
      'foundation',
      f,
      u - w,
      u + w,
      y - 0.34,
      mix(y, Y, (i + 1) / n),
      d - 0.44,
      d + (1 - t) * 1.92,
      stone,
    );
  }
}

function archedBay(out, f, u, w, y, spring, top, detail) {
  const n = [4, 6, 9, 12][detail],
    rise = Math.min(w * 0.97, top - spring - 0.21);
  for (const s of [-1, 1]) {
    const x = u + s * w;
    fbox(out, 'wood', f, x - 0.14, x + 0.14, y - 0.06, spring + 0.09, -0.29, 0.071, wood);
    if (detail > 0)
      fbox(out, 'gold', f, x - 0.103, x + 0.105, y - 0.012, spring + 0.04, 0.076, 0.147, gold);
  }
  const point = (t, s, d) => f.P(u + (w + s) * Math.cos(t), spring + (rise + s) * Math.sin(t), d);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    const A = point(a, 0, 0.075),
      B = point(b, 0, 0.075);
    quad4(
      out,
      'wood',
      B,
      A,
      f.P(u + w * Math.cos(a), top, 0.075),
      f.P(u + w * Math.cos(b), top, 0.075),
      wood,
    );
    if (detail > 0) quad4(out, 'gold', B, A, point(a, 0.17, 0.096), point(b, 0.17, 0.096), gold);
  }
}

function tree(out, face, detail) {
  plate(out, 'wall', face, -3.2, 3.2, 1.18, 6.63, 0.118, red);
  if (detail === 0) return;
  const path = [
    [
      [0, 1.24],
      [0.24, 2.5],
      [-0.02, 3.38],
      [0.33, 4.62],
      [0.24, 5.78],
      [0.37, 6.47],
    ],
    [
      [0.16, 2.63],
      [-0.53, 3.17],
      [-1.61, 3.59],
      [-2.32, 4.18],
      [-2.71, 4.89],
    ],
    [
      [0.01, 3.48],
      [0.93, 3.88],
      [1.88, 4.29],
      [2.45, 4.61],
      [2.62, 5.19],
    ],
    [
      [0.32, 4.43],
      [-0.57, 4.73],
      [-1.47, 4.74],
      [-2.2, 5.32],
      [-2.37, 5.69],
    ],
    [
      [0.29, 4.67],
      [0.96, 5.11],
      [1.6, 5.46],
      [2.34, 5.71],
      [2.68, 6.12],
    ],
    [
      [0.21, 5.7],
      [-0.34, 5.99],
      [-1.11, 6.38],
      [-1.77, 6.48],
    ],
    [
      [0.22, 5.67],
      [0.96, 6.02],
      [1.21, 6.49],
    ],
  ];
  for (const [i, row] of path.entries()) {
    for (let j = 1; j < row.length; j++) {
      const d = 0.142;
      const [x, y] = row[j - 1],
        [X, Y] = row[j];
      const w =
        i === 0 ? mix(0.39, 0.065, j / (row.length - 1)) : mix(0.17, 0.042, j / (row.length - 1));
      beam(
        out,
        'mosaic',
        face.P(x, y, d),
        face.P(X, Y, d),
        w,
        0.038,
        mosaicColors[(i + j) % mosaicColors.length],
      );
    }
    if (i === 0) continue;
    const count = [0, 4, 8, 14][detail];
    for (let j = 0; j < count; j++) {
      const t = (j + 0.51) / count,
        e = Math.floor(t * (row.length - 1));
      const x = mix(row[e][0], row[e + 1][0], t * (row.length - 1) - e);
      const y = mix(row[e][1], row[e + 1][1], t * (row.length - 1) - e);
      const y0 = y + 0.18 + 0.2 * Math.sin(j * 2.26 + i);
      const x0 = x + 0.21 * Math.cos(j * 2.94 + i);
      const d = 0.167,
        w = 0.059 + 0.081 * (0.5 + 0.5 * Math.sin(i + j * 3.49));
      tri(
        out,
        'mosaic',
        face.P(x0 - w, y0 - 0.057, d),
        face.P(x0 + w, y0 - 0.057, d),
        face.P(x0, y0 + 0.15, d),
        mosaicColors[(i + j) % 6],
      );
    }
  }
  if (detail > 1)
    for (const s of [-1, 1]) {
      const x = s * 2.05,
        y = 2.17;
      tri(
        out,
        'mosaic',
        face.P(x - 0.49, y + 0.09, 0.155),
        face.P(x + 0.43, y + 0.07, 0.156),
        face.P(x, y - 0.12, 0.159),
        jade,
      );
      for (let i = 0; i < 5; i++) {
        const dx = (i - 2) * 0.13;
        tri(
          out,
          'mosaic',
          face.P(x + dx * 0.63, y + 0.04, 0.156),
          face.P(x + dx * 0.63 + 0.065, y + 0.03, 0.156),
          face.P(x + dx * 1.71, y + 0.62 - 0.08 * Math.abs(i - 2), 0.156),
          mosaicColors[i],
        );
      }
    }
}
function sim(out, detail) {
  slab(out, site.outline, g - 2.17, g + 0.76, stone);
  stairs(out, F, 0, 3.96, g - 0.12, g + 0.78, 0.14, detail);
  fbox(out, 'bronze', F, -6.05, 6.05, g + 0.68, g + 0.91, -23.5, 0.067, jade);
  fbox(out, 'wood', F, -5.32, 5.32, g + 0.77, 4.31, -D + 0.06, -3.73, dark);
  const portal = facade(xz(P(0, 0, -0.52)), F.along);
  for (const u of [-1.14, 1.14]) archedBay(out, portal, u, 0.91, g + 0.77, 3.32, 4.42, detail);
  for (const [a, b] of [
    [-5.73, -2.06],
    [2.06, 5.73],
  ])
    fbox(out, 'wood', portal, a, b, 3.38, 4.45, -0.461, 0.025, wood);
  const rear = facade(
    xz(P(0, 0, -D + 0.044)),
    F.along.map((x) => -x),
  );
  fbox(out, 'wall', rear, -4.54, 4.54, g + 0.73, 6.66, -0.89, 0.025, red);
  tree(out, rear, detail);
  for (const [w, a, b, low, high] of [
    [6.57, -7.51, 0.84, 3.13, 10.77],
    [8.77, -20.64, -6.44, 2.8, 11.66],
    [6.76, -24.24, -19.61, 3.12, 10.37],
  ]) {
    swept(out, F, w, a, b, low, high, detail);
    swept(out, F, w * 0.71, a + 0.07, b - 0.09, low + 0.77, high - 0.79, detail === 3 ? 2 : 0, {
      gable: false,
      finial: false,
    });
  }
  for (const [i, x] of [-5.7, -3.58, -2.15, 0, 2.15, 3.58, 5.7].entries()) {
    const h = 4.48 - 0.2 * Math.abs(i - 3);
    fbox(out, 'wood', portal, x - 0.127, x + 0.129, g + 0.77, h, -0.155, 0.178, dark);
    if (detail > 0) {
      fbox(out, 'gold', portal, x - 0.174, x + 0.174, h - 0.26, h + 0.07, -0.17, 0.22, softgold);
      for (const y of [g + 0.94, h - 1.17, h - 0.7])
        fbox(out, 'gold', portal, x - 0.114, x + 0.115, y, y + 0.094, 0.175, 0.209, gold);
    }
  }
  if (detail > 0) {
    const n = detail === 1 ? 5 : detail === 2 ? 9 : 11;
    for (const s of [-1, 1])
      for (let i = 0; i <= n; i++) {
        const x = s * mix(2.13, 5.83, i / n);
        plate(out, 'bronze', F, x - 0.028, x + 0.028, g + 0.78, g + 1.65, 0.087, jade);
      }
  }
  const at = xz(P(0, 0, -12.77));
  lathe(
    out,
    'gold',
    at,
    [
      [11.57, 0.39, 0.39],
      [11.82, 0.24, 0.24],
      [12.28, 0.19, 0.19],
      [13.95, 0, 0],
    ],
    detail > 1 ? 9 : 5,
    gold,
  );
  if (detail > 1)
    for (const s of [-1, 1])
      for (let i = 1; i <= 3; i++) {
        const d = -12.77 + s * 0.38 * i,
          at = xz(P(0, 0, d));
        lathe(
          out,
          'gold',
          at,
          [
            [11.65, 0.17, 0.17],
            [11.84, 0.139, 0.139],
            [13.81 - i * 0.52, 0, 0],
          ],
          6,
          gold,
        );
      }
}

function chapel(out, part, detail) {
  const f = facade(part.center, part.along),
    h = part.height,
    y = part.grade;
  const W = part.width / 2,
    D = part.depth / 2;
  const carriage = part.role === 'carriage chapel',
    little = part.role === 'small shrine';
  slab(out, part.outline, y - 1.52, y + 0.58, plaster);
  if (part.role === 'stupa') {
    lathe(
      out,
      'gold',
      part.center,
      [
        [y + 0.57, W * 0.59, W * 0.59],
        [y + 1.39, W * 0.49, W * 0.49],
        [y + 2.14, W * 0.39, W * 0.39],
        [y + 2.89, 0.25, 0.25],
        [y + 4.14, 0.13, 0.13],
        [y + h, 0, 0],
      ],
      detail < 2 ? 9 : 15,
      softgold,
    );
    return;
  }
  const w = W * (carriage ? 0.91 : 0.83),
    front = D * 0.73,
    t = y + h * 0.54,
    body = little ? plaster : carriage ? softgold : red;
  fbox(out, 'wall', f, -w, w, y + 0.56, t, -D + 0.22, front - 1.27, body);
  const gap = carriage ? 1.02 : 0.76;
  for (const [a, b] of [
    [-w, -gap],
    [gap, w],
  ])
    fbox(out, 'wood', f, a, b, y + 0.57, t, front - 0.49, front, body);
  fbox(out, 'gold', f, -gap, gap, y + h * 0.46, t, front - 0.34, front, softgold);
  stairs(out, f, 0, gap + 0.43, y - 0.05, y + 0.59, front + 0.13, detail);
  swept(out, f, W * 0.99, -D, D * 0.94, y + h * 0.48, y + h * 0.91, detail, { finial: false });
  if (!little && detail > 0)
    swept(out, f, W * 1.012, -D * 0.96, D * 0.96, y + h * 0.39, y + h * 0.72, Math.min(2, detail), {
      gable: false,
      finial: false,
    });
  const finial = xz(f.P(0, 0, D * 0.77));
  lathe(
    out,
    'bronze',
    finial,
    [
      [y + h * 0.9, 0.095, 0.095],
      [y + h, 0, 0],
    ],
    detail < 2 ? 4 : 7,
    gold,
  );
  if (detail > 0 && !little) {
    for (const x of [-w + 0.16, -gap - 0.15, gap + 0.15, w - 0.16])
      fbox(out, 'gold', f, x - 0.093, x + 0.093, y + 0.59, t, front + 0.013, front + 0.09, gold);
    for (const x of [-(w + gap) * 0.5, (w + gap) * 0.5]) {
      const n = detail === 3 ? 6 : 4;
      for (let j = 0; j < n; j++) {
        const h = mix(y + 1.24, t - 0.28, (j + 0.5) / n),
          w = 0.14 + 0.047 * (j % 2);
        tri(
          out,
          'gold',
          f.P(x - w, h, front + 0.115),
          f.P(x + w, h, front + 0.115),
          f.P(x, h + 0.34, front + 0.113),
          gold,
        );
      }
    }
  }
}

function build(out, detail) {
  sim(out, detail);
  for (const p of site.parts) chapel(out, p, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
