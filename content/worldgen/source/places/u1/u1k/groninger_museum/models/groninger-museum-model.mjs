/** The four postmodern pavilions on the Groningen canal island in 2015. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireWorldgen('earcut');

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const rings = new Map(frame.features.map((f) => [f.id.split('/')[1], f.points]));
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  tile: { slot: 'wall', graph: 'tile_mosaic', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.17 },
  stone: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55, metallic: 0.078 },
};
const t = Object.fromEntries(
  Object.entries({
    brick: '925f50',
    gold: 'ccaa3f',
    goldLight: 'dbb844',
    goldDark: 'bea047',
    mint: 'c5caa7',
    pond: '88aba9',
    walkway: '83949a',
    steel: 'c0c4bf',
    black: '4e4542',
    orange: 'c16549',
    darkOrange: 'a95847',
    white: 'd3cfc5',
    glass: '6d9191',
    glassDark: '536b6d',
    edge: '958674',
    deck: '6e7778',
    silver: 'aeb5b4',
    silverLight: 'bec4bf',
    pastelBlue: '87a7bf',
    pink: 'b390a1',
    yellow: 'c6ae69',
    sea: '7da7a0',
    terracotta: 'ba876c',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, u) => a.map((n, k) => n + (b[k] - n) * u);
const ring = (x, z, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (-i * Math.PI * 2) / n;
    return [x + r * Math.cos(a), z + r * Math.sin(a)];
  });
const winding = (p) =>
  p.reduce((a, [x, z], i) => {
    const [u, v] = p[(i + 1) % p.length];
    return a + x * v - u * z;
  }, 0) < 0
    ? p
    : p.toReversed();

function cap(out, slot, p, y, tint) {
  const indices = earcut(p.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0;
    if (up) triangle(out, slot, [a, b, c], tint);
    else triangle(out, slot, [a, c, b], tint);
  }
}

function island(out, slot, outline, low, high, tint, { taper = 0, roof = tint } = {}) {
  const outside = winding(outline);
  const midpoint = [0, 1].map((k) => outside.reduce((a, p) => a + p[k], 0) / outside.length);
  const upper = outside.map((p) => mix(p, midpoint, taper));
  for (let i = 0; i < outside.length; i++) {
    const j = (i + 1) % outside.length;
    const a = outside[i],
      b = outside[j],
      c = upper[j],
      d = upper[i];
    face(
      out,
      slot,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [c[0], high, c[1]],
        [d[0], high, d[1]],
      ],
      tint,
    );
  }
  cap(out, slot, upper, high, roof);
  return upper;
}

function wallPanel(out, slot, a, b, y0, y1, tint, reach = 0.034) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [((a[1] - b[1]) * reach) / length, ((b[0] - a[0]) * reach) / length];
  face(
    out,
    slot,
    [
      [a[0] + n[0], y0, a[1] + n[1]],
      [b[0] + n[0], y0, b[1] + n[1]],
      [b[0] + n[0], y1, b[1] + n[1]],
      [a[0] + n[0], y1, a[1] + n[1]],
    ],
    tint,
  );
}

function west(out, lod) {
  const base = rings.get('625729584');
  const {
    canalWallTop,
    starck: [x, z, r],
  } = plan.dimensions;
  island(out, 'stone', base, -1.83, 0.56, t.edge);
  island(out, 'brick', base, 0.49, canalWallTop, t.brick, { taper: 0.11 });
  const n = [12, 16, 24, 30][lod];
  const p = ring(x, z, r, n);
  island(out, 'metal', p, canalWallTop - 0.05, 10.82, t.silver, { roof: t.silverLight });
  if (lod) {
    for (let i = 0; i < n; i++) {
      const a = p[i],
        b = p[(i + 1) % n];
      wallPanel(out, 'metal', a, b, 10.57, 10.89, i % 2 === 0 ? t.silverLight : t.silver, 0.041);
      if (lod > 1) {
        const post = mix(a, b, 0.78),
          end = mix(a, b, 0.795);
        wallPanel(out, 'metal', post, end, canalWallTop, 10.62, t.steel, 0.044);
      }
    }
    for (let i = 0; i < 9; i++) {
      const front = -9.3 + i * 0.32,
        y = 1.0 + i * 0.42;
      box(out, 'stone', [-74.87, y - 0.15, front], [-72.92, y, front + 0.64], t.steel);
    }
    beam(out, 'metal', [-75.02, 2.17, -9.25], [-75.02, 5.55, -6.15], 0.075, 0.07, t.steel);
  }
}

function depot(out, lod) {
  const shell = winding(rings.get('625729586'));
  const y = plan.dimensions.towerTop;
  island(out, 'metal', shell, 0.55, y, t.gold, { roof: t.black });
  const threshold = [-0.45, 5.5],
    faceZ = 5.66;
  box(
    out,
    'tile',
    [threshold[0] - 2.54, 1.4, faceZ - 0.94],
    [threshold[0] + 2.62, 8.15, faceZ + 0.025],
    t.pastelBlue,
  );
  box(
    out,
    'glass',
    [threshold[0] - 1.58, 1.48, faceZ - 0.025],
    [threshold[0] + 1.54, 5.32, faceZ + 0.098],
    t.glassDark,
  );
  box(
    out,
    'metal',
    [threshold[0] - 1.73, 5.34, faceZ - 0.2],
    [threshold[0] + 1.69, 5.57, faceZ + 0.76],
    t.black,
  );
  if (lod) {
    for (const off of [-1.5, 0, 1.5])
      box(
        out,
        'metal',
        [threshold[0] + off - 0.045, 1.49, faceZ + 0.103],
        [threshold[0] + off + 0.045, 5.34, faceZ + 0.145],
        t.steel,
      );
    for (const [i, a] of shell.entries()) {
      const b = shell[(i + 1) % shell.length],
        len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (len < 3) continue;
      const columns = Math.max(2, Math.ceil(len / 2.55));
      for (let j = 1; j < columns; j++) {
        const u = j / columns;
        wallPanel(
          out,
          'metal',
          mix(a, b, u - 0.0017),
          mix(a, b, u + 0.0017),
          8.26,
          y - 0.02,
          t.goldDark,
          0.044,
        );
      }
      if (lod > 1)
        for (let j = 10; j < y; j += 2.85)
          wallPanel(out, 'metal', a, b, j, j + 0.029, t.goldDark, 0.045);
    }
    for (const [x, z] of [
      [-7.67, -4.7],
      [11.81, -5.64],
      [-6.83, 5.5],
      [12.07, 4.31],
    ]) {
      beam(out, 'metal', [x, y, z], [x, y + 1.16, z], 0.069, 0.069, t.pastelBlue);
    }
  }
}

function connector(out, lod) {
  const bands = [
    { id: '625729583', low: -1.25, high: 2.34, color: t.pond },
    { id: '625729582', low: -1.13, high: 2.58, color: t.pond },
    { id: '625729579', low: 0.33, high: 8.45, color: t.mint },
    { id: '625729580', low: 0.45, high: 8.45, color: t.mint },
  ];
  for (const p of bands) {
    const outline = winding(rings.get(p.id));
    island(out, 'metal', outline, p.low, p.high, p.color, { roof: t.deck });
    if (p.high < 8) continue;
    for (const [i, a] of outline.entries()) {
      const b = outline[(i + 1) % outline.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 5) continue;
      wallPanel(out, 'metal', a, b, p.low + 0.02, 2.75, t.pond);
      if (lod)
        for (let j = 0; j < Math.round(len / 2.35); j++) {
          const u = (j + 0.5) / Math.round(len / 2.35);
          wallPanel(
            out,
            'glass',
            mix(a, b, u - 0.034),
            mix(a, b, u + 0.034),
            6.43,
            7.31,
            t.glassDark,
            0.036,
          );
          if (lod > 1)
            wallPanel(
              out,
              'glass',
              mix(a, b, u - 0.032),
              mix(a, b, u + 0.032),
              3.61,
              5.68,
              t.glass,
            );
        }
    }
  }
  box(out, 'stone', [-23.35, 1.21, 7.1], [3.4, 2.27, 12.48], t.edge);
  box(out, 'stone', [-21.1, 1.16, 13.9], [-15.91, 2.34, 26.18], t.walkway);
  const span = winding(rings.get('773758337'));
  island(out, 'stone', span, 1.94, plan.dimensions.bridgeDeck, t.walkway);
  if (lod)
    for (const side of [-1, 1]) {
      const x = -17.25 + side * 2.6;
      beam(out, 'metal', [x, 3.43, 25.4], [x + 1.53, 3.43, 60.15], 0.08, 0.081, t.steel);
      for (let i = 0; i < (lod > 1 ? 19 : 9); i++) {
        const n = lod > 1 ? 19 : 9,
          z = 26 + (32.9 * i) / (n - 1),
          xx = x + 0.04 * (z - 25.4);
        box(out, 'metal', [xx - 0.047, 2.35, z - 0.048], [xx + 0.047, 3.45, z + 0.048], t.steel);
      }
    }
}

function eastPavilion(out, lod) {
  const [base, northEdge] = ['625729581', '896133987'].map((id) => winding(rings.get(id)));
  const top = island(out, 'tile', base, -1.2, 8.84, t.pastelBlue, { taper: 0.032, roof: t.steel });
  if (lod)
    for (const [i, a] of base.entries()) {
      const j = (i + 1) % base.length,
        b = base[j],
        a1 = top[i],
        b1 = top[j];
      const n = Math.max(
        2,
        Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / (lod > 1 ? 1.16 : 2.45)),
      );
      const rows = [0, 3, 6, 9][lod];
      for (let c = 0; c < n; c++)
        for (let r = 0; r < rows; r++) {
          const at = (u, v) => {
            const aa = mix(a, b, u),
              bb = mix(a1, b1, u),
              p = mix(aa, bb, v);
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            return [
              p[0] + (0.028 * (a[1] - b[1])) / len,
              0.4 + 8.43 * v,
              p[1] + (0.028 * (b[0] - a[0])) / len,
            ];
          };
          const u = (c + 0.08) / n,
            v = (r + 0.12) / rows,
            w = 0.84 / n,
            h = 0.78 / rows;
          const paints = [t.pastelBlue, t.pink, t.yellow, t.sea, t.terracotta, t.white];
          face(
            out,
            'tile',
            [at(u, v), at(u + w, v), at(u + w, v + h), at(u, v + h)],
            paints[(i * 5 + c * 7 + r * 13 + ((c + r) % 3)) % paints.length],
          );
        }
    }
  island(out, 'metal', northEdge, 8.3, 12.21, t.white, { taper: 0.018, roof: t.darkOrange });
  // Leading panels tilt and project beyond the footprint over the canal.
  const folds = [
    {
      a: [32.4, 9.34, 15.2],
      b: [43.2, 13.79, 16.8],
      c: [50.6, 17.6, 12.2],
      d: [40.98, 15.44, 9.7],
      color: t.black,
    },
    {
      a: [43.2, 13.79, 16.8],
      b: [56.2, 10.59, 18.4],
      c: [62.2, 17.7, 9.53],
      d: [50.6, 17.6, 12.2],
      color: t.glass,
    },
    {
      a: [56.2, 10.59, 18.4],
      b: [67.43, 13.18, 14.82],
      c: [64.8, 17.46, 8.44],
      d: [62.2, 17.7, 9.53],
      color: t.black,
    },
    {
      a: [58.65, 10.08, -22.93],
      b: [72.1, 8.11, -24.17],
      c: [72.8, 15.6, -23.06],
      d: [57.77, 14.72, -20.09],
      color: t.orange,
    },
    {
      a: [68.33, 8.19, 6.71],
      b: [73.42, 11.38, 7.06],
      c: [73.66, 15.14, -1.83],
      d: [65.01, 14.54, 1.34],
      color: t.darkOrange,
    },
  ];
  for (const { a, b, c, d, color } of folds) {
    triangle(out, color === t.glass ? 'glass' : 'metal', [b, a, d], color);
    triangle(out, color === t.glass ? 'glass' : 'metal', [b, d, c], color);
    triangle(out, 'metal', [b, d, a], color);
    triangle(out, 'metal', [b, c, d], color);
    if (lod) {
      beam(out, 'metal', d, c, 0.14, 0.12, t.orange);
      if (color === t.glass)
        for (const u of [0.16, 0.35, 0.54, 0.72, 0.88]) {
          const p = mix(a, b, u),
            q = mix(d, c, u);
          beam(
            out,
            'metal',
            [p[0], p[1], p[2] + 0.036],
            [q[0], q[1], q[2] + 0.036],
            0.072,
            0.075,
            t.steel,
          );
        }
    }
  }
  const a = [32.2, 12.22, 10.31],
    b = [39.4, 14.89, 8.44];
  const c = [64.81, 17.48, 8.35],
    d = [71.57, 13.92, -19.45];
  triangle(out, 'metal', [a, c, b], t.orange);
  triangle(out, 'metal', [a, c, d], t.orange);
  if (lod) {
    for (let i = 0; i < 11; i++) {
      const x = 66.95 + i * 0.51,
        y = 1.85 + i * 0.48;
      box(out, 'metal', [x, y, 14.51], [x + 0.62, y + 0.16, 16.02], t.orange);
    }
    beam(out, 'metal', [66.85, 2.92, 16.1], [72.58, 8.2, 16.1], 0.081, 0.092, t.steel);
  }
}

function build(out, lod) {
  west(out, lod);
  connector(out, lod);
  depot(out, lod);
  eastPavilion(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const recipe = 'groninger-museum-model.mjs';
const camera = [77, 55, 113],
  lookAt = [0, 8, 8];
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Groninger Museum’s 2015 exteriors on the canal island, with its circular west gallery, gold entrance tower, and folded metal and glass on the east.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [23, 43, 53],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    minimumCoverage: 0.91,
    basis: 'Mapped exterior building outlines of the connected four museum pavilions.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'tile_mosaic', 'metal_painted', 'concrete_panel'],
  qaCameras: [
    {
      name: 'de-lucchi-brick-and-round-starck-gallery',
      position: [-89, 12, 48],
      lookAt: [-57, 5, 3],
    },
    { name: 'gold-tower-and-entrance-bridge', position: [6, 19, 66], lookAt: [-5, 12, 1] },
    { name: 'mosaic-and-angular-coop-pavilion', position: [92, 16, 47], lookAt: [53, 7, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'groningen-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.64,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.3],
        ['street', 'museumStreet', 0.13],
        ['closeup', 'museumCloseup', 0.06],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data under ODbL. The four photographs used to derive the architecture were released to CC0 by Gouwenaar.',
};
