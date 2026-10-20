/** Restored Tophane tower: exposed base, two clocks and original carved crown silhouette. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('c7c4b8'),
  trim = rgb('dedbd0'),
  weather = rgb('b6b3a8'),
  black = rgb('242a2b'),
  white = rgb('e9e8e0'),
  gold = rgb('a58c49');
function facing(o, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(v), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(v), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(v),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, slot, x, y, z, w, h, c) {
  quad(
    o,
    slot,
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
function tri(o, slot, p, c) {
  o.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    c,
  );
}
function round(o, slot, levels, d, c = trim, x = 0, z = 0) {
  loft(
    o,
    slot,
    levels.map(([y, r]) => radialRing(y, r, r, d < 2 ? 4 : d === 2 ? 10 : 20, [x, z])),
    c,
  );
}
function disk(o, slot, x, y, z, r, c, n) {
  for (let i = 0; i < n; i++) {
    const p = (a) => [x + r * Math.cos(a), y + r * Math.sin(a), z];
    tri(o, slot, [[x, y, z], p((i / n) * Math.PI * 2), p(((i + 1) / n) * Math.PI * 2)], c);
  }
}
function annulus(o, slot, x, y, z, r0, r1, c, n, start = 0, end = Math.PI * 2) {
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n,
      p = (r, t) => [x + r * Math.cos(t), y + r * Math.sin(t), z];
    quad(o, slot, [p(r0, a), p(r1, a), p(r1, b), p(r0, b)], [0, 0, 1], c);
  }
}
function cornice(o, y, w, d) {
  B(o, 'stone', 0, y, 0, w - 0.22, 0.16, w - 0.22, stone);
  if (d > 0) B(o, 'trim', 0, y + 0.16, 0, w - 0.08, 0.12, w - 0.08, trim);
  B(o, 'trim', 0, y + (d > 0 ? 0.28 : 0.16), 0, w, d > 0 ? 0.13 : 0.25, w, trim);
  if (d > 1) {
    for (let i = 0; i < 4; i++) {
      const q = facing(o, (i * Math.PI) / 2);
      for (let j = 0; j < 8; j++)
        B(q, 'trim', ((j - 3.5) * (w - 0.55)) / 8, y - 0.08, w / 2 - 0.12, 0.1, 0.16, 0.16, trim);
    }
  }
}
/** Separate jambs, arch spandrels, reveal and closed panel; no wall behind the shallow opening. */
function stage(o, y0, y1, w, doorY, doorH, doorW, arch, d, index) {
  const z = w / 2,
    depth = index === 0 ? 0.38 : 0.26,
    half = doorW / 2;
  if (d === 0 && index > 0) {
    B(o, 'stone', 0, y0, 0, w, y1 - y0, w, stone);
    for (let i = 0; i < 4; i++) {
      const q = facing(o, (i * Math.PI) / 2);
      face(q, 'metal', 0, doorY, z + 0.004, doorW, doorH - (arch ? half : 0), black);
      if (arch) disk(q, 'metal', 0, doorY + doorH - half, z + 0.003, half, black, 6);
    }
    return;
  }
  B(o, 'stone', 0, y0, 0, w - 2 * depth, y1 - y0, w - 2 * depth, stone);
  for (let i = 0; i < 4; i++) {
    const q = facing(o, (i * Math.PI) / 2),
      isDoor = index === 0 && i === 0,
      blind = index === 0 && i !== 0,
      hh = blind ? 1.65 : doorH,
      yy = blind ? doorY + 0.45 : doorY,
      ss = yy + hh - (arch ? half : 0);
    for (const sign of [-1, 1])
      B(q, 'stone', (sign * (z + half)) / 2, y0, z - depth / 2, z - half, y1 - y0, depth, stone);
    B(q, 'stone', 0, y0, z - depth / 2, doorW, yy - y0, depth, stone);
    if (arch) {
      const n = d === 0 ? 3 : d === 1 ? 6 : d === 2 ? 12 : 20;
      for (let j = 0; j < n; j++) {
        const a = Math.PI - (Math.PI * j) / n,
          b = Math.PI - (Math.PI * (j + 1)) / n,
          x0 = half * Math.cos(a),
          x1 = half * Math.cos(b),
          yA = ss + half * Math.sin(a),
          yB = ss + half * Math.sin(b),
          p = [
            [x0, yA, z],
            [x1, yB, z],
            [x1, y1, z],
            [x0, y1, z],
          ];
        quad(q, 'stone', p, normalFor(...p), stone);
        const reveal = [
          [x0, yA, z],
          [x0, yA, z - depth],
          [x1, yB, z - depth],
          [x1, yB, z],
        ];
        quad(q, 'trim', reveal, normalFor(...reveal), weather);
      }
    } else B(q, 'stone', 0, ss, z - depth / 2, doorW, y1 - ss, depth, stone);
    for (const sign of [-1, 1]) {
      const p = [
        [sign * half, yy, z],
        [sign * half, ss, z],
        [sign * half, ss, z - depth],
        [sign * half, yy, z - depth],
      ];
      if (sign < 0) p.reverse();
      quad(q, 'trim', p, normalFor(...p), weather);
    }
    quad(
      q,
      'trim',
      [
        [-half, yy, z],
        [half, yy, z],
        [half, yy, z - depth],
        [-half, yy, z - depth],
      ],
      normalFor([-half, yy, z], [half, yy, z], [half, yy, z - depth]),
      trim,
    );
    face(
      q,
      blind ? 'stone' : 'metal',
      0,
      yy,
      z - depth + 0.004,
      doorW,
      hh,
      blind ? weather : black,
    );
    if (d > 0) {
      for (const sign of [-1, 1])
        B(q, 'trim', sign * (half + 0.12), yy - 0.03, z + 0.055, 0.18, hh + 0.05, 0.12, trim);
      if (arch)
        annulus(
          q,
          'trim',
          0,
          ss,
          z + 0.12,
          half + 0.01,
          half + 0.22,
          trim,
          d === 1 ? 6 : d === 2 ? 12 : 20,
          0,
          Math.PI,
        );
      else B(q, 'trim', 0, ss, z + 0.075, doorW + 0.36, 0.18, 0.16, trim);
      if (!blind) {
        for (const x of [-0.24, 0.24])
          B(q, 'metal', x, yy + 0.08, z - depth + 0.035, 0.035, hh - 0.16, 0.035, black);
        if (d > 1)
          for (let j = 1; j < 5; j++)
            B(
              q,
              'metal',
              0,
              yy + (j * (hh - 0.18)) / 5,
              z - depth + 0.035,
              doorW - 0.1,
              0.025,
              0.04,
              black,
            );
      }
      if (index === 1) {
        annulus(
          q,
          'trim',
          0,
          yy + hh - 0.05,
          z + 0.19,
          doorW * 0.56,
          doorW * 0.56 + 0.12,
          trim,
          d === 1 ? 5 : 12,
          0.15,
          Math.PI - 0.15,
        );
        B(q, 'trim', 0, yy + hh - 0.08, z + 0.1, doorW + 0.45, 0.13, 0.24, trim);
      }
      if (isDoor) {
        disk(q, 'metal', 0, y1 - 0.22, z + 0.12, 0.22, gold, d === 1 ? 10 : 20);
        if (d > 1) {
          for (const x of [-0.08, 0, 0.08])
            beam(
              q,
              'metal',
              [x, y1 - 0.36, z + 0.15],
              [x + 0.025, y1 - 0.15, z + 0.15],
              0.02,
              0.025,
              gold,
            );
        }
      }
    }
    if (d > 1) {
      for (const x of [-z + 0.15, z - 0.15])
        B(q, 'trim', x, y0 + 0.08, z + 0.035, 0.18, y1 - y0 - 0.1, 0.1, trim);
      for (let row = 1; row < 6; row++) {
        const y = y0 + ((y1 - y0) * row) / 6;
        for (const sign of [-1, 1])
          face(
            q,
            'stone',
            (sign * (z + half + 0.24)) / 2,
            y,
            z + 0.002,
            z - half - 0.26,
            0.012,
            weather,
          );
      }
    }
  }
}
function rosette(o, x, y, z, r, d) {
  if (d < 2) return;
  const n = d === 2 ? 3 : 8;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2;
    sphere(
      o,
      'trim',
      [x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, z],
      [r * 0.32, r * 0.42, 0.045],
      trim,
      d === 2 ? 6 : 10,
      d === 2 ? 3 : 6,
    );
  }
  sphere(o, 'trim', [x, y, z + 0.03], [r * 0.24, r * 0.24, 0.06], trim, d === 2 ? 6 : 10, 4);
}
function leaf(o, x, y, z, w, h, d, sign = 1) {
  if (d < 2) return;
  const n = d === 2 ? 2 : 5;
  for (let j = 0; j < n; j++) {
    const t = j / (n - 1),
      xx = x + sign * w * (0.15 + 0.5 * Math.sin(t * Math.PI)),
      yy = y + h * t;
    sphere(
      o,
      'trim',
      [xx, yy, z],
      [w * 0.38, h / (n + 1), 0.055],
      trim,
      d === 2 ? 6 : 10,
      d === 2 ? 3 : 6,
    );
  }
  beam(o, 'trim', [x, y, z + 0.04], [x + sign * w * 0.25, y + h, z + 0.04], 0.028, 0.04, weather);
}
function dial(o, d) {
  const n = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 48 : 72,
    y = 13.05,
    z = 1.34,
    r = 0.93;
  disk(o, 'dial', 0, y, z, r, white, n);
  annulus(o, 'metal', 0, y, z + 0.012, r - 0.035, r + 0.025, black, n);
  annulus(o, 'metal', 0, y, z + 0.014, 0.51, 0.535, black, n);
  annulus(o, 'trim', 0, y, z - 0.01, r + 0.03, r + 0.21, trim, n);
  for (let j = 0; j < 12; j++) {
    const a = (j * Math.PI) / 6,
      p = (t, rad) => [Math.sin(t) * rad, y + Math.cos(t) * rad, z + 0.022];
    tri(o, 'metal', [p(a + 0.055, 0.81), p(a - 0.055, 0.81), p(a, 0.56)], black);
    if (d > 0) beam(o, 'metal', p(a, 0.85), p(a, 0.9), 0.022, 0.015, black);
    if (d > 1) {
      const x = Math.sin(a) * 0.87,
        yy = y + Math.cos(a) * 0.87;
      face(o, 'metal', x, yy, z + 0.024, 0.025, 0.055, black);
    }
  }
  const hand = (a, l, w) => {
    const p = (xx, yy) => [
      Math.sin(a) * yy + Math.cos(a) * xx,
      y + Math.cos(a) * yy - Math.sin(a) * xx,
      z + 0.045,
    ];
    tri(o, 'metal', [p(-w / 2, -0.14), p(w / 2, -0.14), p(0, l)], black);
  };
  hand(0, 0.86, 0.075);
  hand(Math.PI / 3, 0.65, 0.14);
  disk(o, 'metal', 0, y, z + 0.055, 0.075, black, d === 0 ? 6 : 12);
  if (d > 1) {
    rosette(o, 0, y - 0.29, z + 0.038, 0.09, d);
  }
}
function crown(o, d) {
  const w = 2.6;
  B(o, 'stone', 0, 11.8, 0, w, 2.45, w, stone);
  for (let i = 0; i < 4; i++) {
    const q = facing(o, (i * Math.PI) / 2);
    if (i % 2 === 0) dial(q, d);
    else {
      face(q, 'stone', 0, 12.04, 1.302, 1.9, 1.85, weather);
      if (d > 0) rosette(q, 0, 13.0, 1.35, 0.48, d);
    }
    for (const sign of [-1, 1]) {
      const pairs = [
        [11.85, 1.83],
        [12.2, 1.69],
        [12.7, 1.5],
        [13.24, 1.44],
        [13.72, 1.56],
        [14.0, 1.38],
      ];
      for (let j = 1; j < pairs.length; j++) {
        const [y0, x0] = pairs[j - 1],
          [y1, x1] = pairs[j],
          p = [
            [sign * 1.12, y0, 1.45],
            [sign * x0, y0, 1.45],
            [sign * x1, y1, 1.45],
            [sign * 1.12, y1, 1.45],
          ];
        if (sign < 0) p.reverse();
        quad(q, 'trim', p, normalFor(...p), trim);
        if (d > 1) beam(q, 'trim', [sign * x0, y0, 1.45], [sign * x1, y1, 1.45], 0.11, 0.18, trim);
      }
      if (d > 1) {
        rosette(q, sign * 1.48, 13.75, 1.49, 0.18, d);
        leaf(q, sign * 1.18, 12, 1.5, 0.3, 1.25, d, sign);
      }
    }
    if (d > 0) {
      B(q, 'trim', 0, 14.08, 1.36, 2.8, 0.16, 0.24, trim);
      if (d > 1) {
        rosette(q, 0, 12.0, 1.35, 0.22, d);
        for (const sign of [-1, 1]) leaf(q, sign * 0.2, 14.28, 1.0, 0.5, 0.28, d, sign);
      }
    }
  }
  for (const y of [11.85, 14.15]) {
    if (d === 0) continue;
    const r = y < 12 ? 1.77 : 1.31;
    for (const x of [-r, r])
      for (const z of [-r, r]) {
        round(
          o,
          'trim',
          [
            [y, 0.15],
            [y + 0.09, 0.18],
          ],
          d,
          trim,
          x,
          z,
        );
        sphere(
          o,
          'trim',
          [x, y + 0.23, z],
          [0.16, 0.18, 0.16],
          trim,
          d === 1 ? 6 : 10,
          d === 1 ? 4 : 6,
        );
        round(
          o,
          'trim',
          [
            [y + 0.36, 0.11],
            [y + 0.46, 0.08],
            [y + 0.58, 0.018],
          ],
          d,
          trim,
          x,
          z,
        );
      }
  }
  round(
    o,
    'trim',
    [
      [14.25, 1.18],
      [14.48, 1.02],
      [14.6, 0.72],
      [14.7, 0.7],
      [15.0, 0.6],
      [15.2, 0.47],
    ],
    d,
  );
  if (d > 1)
    for (let j = 0; j < 8; j++) {
      const q = facing(o, (j * Math.PI) / 4);
      leaf(q, -0.18, 14.68, 0.61, 0.25, 0.38, d, 1);
    }
  round(
    o,
    'metal',
    [
      [15.18, 0.12],
      [23.45, 0.08],
      [23.6, 0.035],
    ],
    d,
    black,
  );
  round(
    o,
    'metal',
    [
      [23.6, 0.055],
      [23.7, 0.015],
    ],
    d,
    gold,
  );
}
export function nusretiyeClockTower(o, _frame, d = 3) {
  B(o, 'stone', 0, -0.9, 0, 5.25, 1.9, 5.25, weather);
  B(o, 'trim', 0, 1, 0, 5.5, 0.18, 5.5, trim);
  B(o, 'trim', 0, 1.18, 0, 4.85, 0.13, 4.85, trim);
  stage(o, 1.31, 4.68, 3.7, 1.42, 2.62, 1.35, true, d, 0);
  for (let i = 0; i < 4; i++) {
    const q = facing(o, (i * Math.PI) / 2);
    for (const x of [-1.65, 1.65]) {
      if (d === 0) B(q, 'trim', x, 1.31, 2.08, 0.38, 3.34, 0.38, trim);
      else {
        B(q, 'trim', x, 1.31, 2.08, 0.55, 0.15, 0.55, trim);
        round(
          q,
          'trim',
          [
            [1.46, 0.25],
            [1.55, 0.22],
            [1.64, 0.19],
            [4.35, 0.16],
            [4.43, 0.25],
            [4.53, 0.26],
          ],
          d,
          trim,
          x,
          2.08,
        );
        B(q, 'trim', x, 4.53, 2.08, 0.55, 0.15, 0.55, trim);
      }
    }
  }
  cornice(o, 4.68, 5.05, d);
  stage(o, 5.09, 8.3, 3.38, 5.42, 2.45, 1.1, false, d, 1);
  cornice(o, 8.3, 4.35, d);
  stage(o, 8.71, 11.4, 3.05, 8.96, 2.18, 1.03, true, d, 2);
  cornice(o, 11.4, 4.05, d);
  crown(o, d);
  if (d > 0) {
    for (let i = 0; i < 4; i++) {
      const q = facing(o, (i * Math.PI) / 2);
      for (const x of [-1.38, 1.38]) {
        B(q, 'trim', x, 5.22, 1.76, 0.18, 2.92, 0.16, trim);
        B(q, 'trim', x, 8.83, 1.6, 0.15, 2.43, 0.14, trim);
      }
      if (d > 1) {
        for (const x of [-1.28, 1.28]) {
          rosette(q, x, 9.4, 1.64, 0.15, d);
          rosette(q, x, 10.55, 1.64, 0.16, d);
          leaf(q, x, 9.7, 1.64, 0.16, 0.5, d, x < 0 ? -1 : 1);
        }
        for (const x of [-2.05, 2.05]) {
          round(
            q,
            'trim',
            [
              [5.09, 0.11],
              [5.27, 0.12],
              [5.42, 0.04],
            ],
            d,
            trim,
            x,
            2.05,
          );
          sphere(q, 'trim', [x, 5.21, 2.05], [0.13, 0.13, 0.13], trim, 8, 4);
        }
      }
    }
  }
}
export const nusretiyeClockTowerSkyline = (o) => nusretiyeClockTower(o, undefined, 0);
export const nusretiyeClockTowerDistrict = (o) => nusretiyeClockTower(o, undefined, 1);
export const nusretiyeClockTowerStreet = (o) => nusretiyeClockTower(o, undefined, 2);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.2 },
  dial: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45, metallic: 0 },
};
export const nusretiyeClockTowerModel = {
  id: 'nusretiye_clock_tower',
  key: 'nusretiye_clock_tower',
  recipe: 'structure-nusretiye-clock-tower.mjs',
  cell: 'sx/sxk',
  title: 'Nusretiye Clock Tower',
  brief:
    'Restored square stone clock tower with exposed lower plinth, paired columns, deep arched entrance, rectangular and round-headed upper openings, stepped cornices, two white Ottoman-style dials, floral scroll crown and integral black flagmast. Surrounding mosque, museums, sculptures and square excluded.',
  camera: [22, 16, 30],
  lookAt: [0, 10, 0],
  qaCameras: [
    { name: 'front', position: [0, 13, 51], lookAt: [0, 11, 0] },
    { name: 'front-detail', position: [-5.5, 15.1, 10.2], lookAt: [0, 12.9, 0] },
    { name: 'back', position: [-26, 16, -39], lookAt: [0, 11, 0] },
    { name: 'base-detail', position: [7, 5.5, 11], lookAt: [0, 3.2, 0] },
  ],
  mediumFiContext: { scale: 1.2 },
  build: nusretiyeClockTower,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry sea-facing square pavement[0,4.3] establishes native Terrarium datum9.1322m. Preserved ground spans+.054..+.664m around the actual own plinth, whose footing reaches-.9m and cap stands1.31m. Entrance threshold1.42m remains above the own cap. Southeast-facing entrance and rotated tower reviewed from2024 original and aerial; coarse map context is generalized. Bounded preview only, footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-nusretiye-clock-tower.mjs',
    level: 'skyline',
    export: 'nusretiyeClockTowerSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'nusretiyeClockTowerDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'nusretiyeClockTowerStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Restored2024 exterior: newly exposed lower plinth and repaired two land/sea clocks from primary caretaker record. Fixed batch four-clock wording is not used for geometry. Older2012 original controls silhouette only.',
    'Masonry height15.2m and23.7m integral flagmast height are photo-derived estimates against generalized map14m/7.4m footprint; no surveyed scale claim. Fine floral relief and Ottoman-style hour marks are original approximations, not facsimiles. Hidden elevations/openings remain conservative symmetric interpretations.',
    'Neighboring mosque, museums, modern sphere sculpture, chain security perimeter, surrounding square pavement and interiors excluded. Cloth flag omitted; integral flagmast retained. No photographic pixels redistributed. Independent native terrain unchanged; own plinth contact reviewed as a bounded preview. Coarse urban/coastal terrain and compatibility with other host terrain remain limitations; footprint replacement disabled.',
  ],
};
