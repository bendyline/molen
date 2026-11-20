import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url)));
const plan = read('plan-controls.json'),
  field = read('terrain-grid.json');
const d = plan.dimensions;
const granite = rgb('68675e'),
  stone = rgb('817a68'),
  molding = rgb('989081');
const ivory = rgb('d2b77b'),
  gold = rgb('ad914e'),
  pale = rgb('e0c99a');
const blue = rgb('506e83'),
  blueTrim = rgb('668698'),
  shadow = rgb('3b3730');
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  foot: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93, metallic: 0 },
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_copper', roughness: 0.77, metallic: 0.21 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
};

function grade([x, z]) {
  const fx = (x - field.origin[0]) / field.stepMeters,
    fz = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(fx),
    j = Math.floor(fz),
    u = fx - i,
    v = fz - j;
  if (i < 0 || j < 0 || i >= field.size[0] - 1 || j >= field.size[1] - 1)
    throw Error('Outside hill terrain');
  const lo = field.heightsMeters[j],
    hi = field.heightsMeters[j + 1];
  return (
    (lo[i] * (1 - u) + lo[i + 1] * u) * (1 - v) +
    (hi[i] * (1 - u) + hi[i + 1] * u) * v -
    field.modelDatumElevationMeters
  );
}
const rectangle = (x, z, w, l) => [
  [x - w / 2, z - l / 2],
  [x + w / 2, z - l / 2],
  [x + w / 2, z + l / 2],
  [x - w / 2, z + l / 2],
];
function face(out, slot, points, tint) {
  const n = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, n, tint);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, n, (p) => [p[0], p[2]], tint);
}
function mass(out, slot, x, z, w, l, bottom, top, tint) {
  box(out, slot, [x - w / 2, bottom, z - l / 2], [x + w / 2, top, z + l / 2], tint);
}
function loft(out, slot, sections, tint, cap = true) {
  for (let k = 1; k < sections.length; k++) {
    const [a, y0] = sections[k - 1],
      [b, y1] = sections[k];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      face(
        out,
        slot,
        [
          [a[j][0], y0, a[j][1]],
          [a[i][0], y0, a[i][1]],
          [b[i][0], y1, b[i][1]],
          [b[j][0], y1, b[j][1]],
        ],
        tint,
      );
    }
  }
  if (cap) {
    const [p, y] = sections.at(-1);
    face(
      out,
      slot,
      p.toReversed().map(([x, z]) => [x, y, z]),
      tint,
    );
  }
}
function ring(out, slot, x, z, profile, segments, tint, rib = 0) {
  const sections = profile.map(([h, r]) => [
    Array.from({ length: segments }, (_, i) => {
      const angle = (2 * Math.PI * i) / segments,
        radius = r * (i % 2 === 0 ? 1 : 1 - rib);
      return [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
    }),
    h,
  ]);
  loft(out, slot, sections, tint, false);
}
function crouchedRoof(out, x, z, w, l, base, rise, lod, tint = stone) {
  const lengths = lod === 0 ? [0, 1] : [0, 0.17, 0.35, 0.53, 0.71, 0.88, 1];
  const levels = lengths.map((f) => [
    rectangle(x, z, w * (1 - f * 0.75), l * (1 - f * 0.79)),
    base + f * rise,
  ]);
  loft(out, 'granite', levels, tint);
  if (lod >= 1) {
    for (const f of [0.11, 0.36, 0.61, 0.84]) {
      mass(
        out,
        'trim',
        x,
        z,
        w * (1 - f * 0.75) + 0.3,
        l * (1 - f * 0.79) + 0.3,
        base + f * rise - 0.16,
        base + f * rise + 0.07,
        molding,
      );
    }
  }
}

function gopuram(out, lod) {
  const g = d.gate,
    [x, z] = g.center,
    y = g.grade,
    half = g.width / 2,
    opening = 5.65;
  for (const side of [-1, 1]) {
    const w = (g.width - opening) / 2,
      center = z + side * (opening / 2 + w / 2);
    mass(out, 'stucco', x, center, g.depth, w, y - 2.75, y + g.base * 0.88, blue);
    mass(out, 'trim', x, center, g.depth + 0.42, w + 0.27, y + 0.52, y + 1.43, blueTrim);
    if (lod > 0) {
      for (const f of [2.0, 4.3, 7.4, 9.4])
        mass(out, 'trim', x, center, g.depth + 0.42, w + 0.17, y + f, y + f + 0.32, blueTrim);
      for (let i = 0; i < 4; i++) {
        const zp = center + ((i - 1.5) * w) / 4;
        mass(out, 'trim', x - g.depth / 2 - 0.15, zp, 0.37, 0.46, y + 1.58, y + 9.32, blueTrim);
      }
    }
  }
  mass(out, 'stucco', x, z, g.depth, g.width, y + g.base * 0.7, y + g.base, blue);
  mass(
    out,
    'trim',
    x,
    z,
    g.depth + 0.55,
    g.width + 0.52,
    y + g.base - 0.77,
    y + g.base + 0.13,
    blueTrim,
  );
  const crown = y + g.height - 1.75;
  const lo = y + g.base;
  const first = g.width * 0.9,
    last = g.width * 0.56;
  for (let i = 0; i < g.tiers; i++) {
    const a = i / g.tiers,
      b = (i + 1) / g.tiers,
      top = lo + (crown - lo) * b,
      foot = lo + (crown - lo) * a;
    const w = first + (last - first) * a,
      depth = g.depth * (0.91 - a * 0.33);
    loft(
      out,
      'stucco',
      [
        [rectangle(x, z, depth, w), foot],
        [rectangle(x, z, depth * 0.96, w * 0.97), top - 0.38],
      ],
      ivory,
    );
    mass(out, 'trim', x, z, depth + 0.34, w + 0.55, top - 0.38, top, pale);
    if (!lod) continue;
    mass(out, 'stucco', x - depth / 2 - 0.018, z, 0.05, 1.1, foot + 0.72, top - 0.65, shadow);
    const count = lod === 1 ? 4 : lod === 2 ? 6 : 9;
    for (const side of [-1, 1]) {
      for (let j = 0; j < count; j++) {
        const zz = z + (j / (count - 1) - 0.5) * (w - 1.25),
          xx = x + side * (depth / 2 + 0.055);
        mass(out, 'trim', xx, zz, 0.32, 0.48, foot + 0.28, top - 0.62, pale);
        if (lod >= 2) {
          mass(out, 'trim', xx + side * 0.12, zz, 0.37, 0.84, foot + 0.36, foot + 0.63, pale);
          const sat = j % 2 === 0 ? ivory : blueTrim;
          const p = [
            [xx + side * 0.28, foot + 0.72, zz - 0.36],
            [xx + side * 0.28, foot + 0.72, zz + 0.36],
            [xx + side * 0.28, top - 1.38, zz + 0.28],
            [xx + side * 0.28, top - 0.77, zz],
            [xx + side * 0.28, top - 1.38, zz - 0.28],
          ];
          face(out, 'stucco', side < 0 ? p : p.toReversed(), sat);
        }
      }
    }
  }
  loft(
    out,
    'stucco',
    [
      [rectangle(x, z, 4.88, 9.92), crown],
      [rectangle(x, z, 4.42, 9.25), crown + 0.92],
      [rectangle(x, z, 2.12, 8.91), crown + 1.36],
    ],
    ivory,
  );
  for (let i = -2; i <= 2; i++) {
    const p = [x, z + i * 1.32];
    if (lod === 0) {
      mass(out, 'bronze', ...p, 0.37, 0.37, crown + 1.3, crown + 2.1, gold);
      continue;
    }
    const y0 = crown + 1.31;
    ring(
      out,
      'bronze',
      ...p,
      [
        [y0, 0.31],
        [y0 + 0.22, 0.38],
        [y0 + 0.5, 0.22],
        [y0 + 0.72, 0.1],
        [y0 + 0.9, 0.028],
      ],
      lod > 1 ? 8 : 5,
      gold,
    );
  }
  if (lod >= 2) {
    for (const offset of [-4.92, 4.92]) {
      ring(
        out,
        'stucco',
        x,
        z + offset,
        [
          [crown, 0.34],
          [crown + 1.11, 0.39],
          [crown + 1.51, 0.55],
          [crown + 1.74, 0.23],
        ],
        9,
        pale,
      );
    }
    const xx = x - g.depth * 0.467 - 0.24;
    mass(out, 'stucco', xx, z, 0.24, 1.81, lo + 0.37, lo + 2.27, pale);
    const mark = [
      [xx - 0.15, lo + 0.62, z - 0.15],
      [xx - 0.15, lo + 2.07, z],
      [xx - 0.15, lo + 0.62, z + 0.15],
    ];
    face(out, 'stucco', mark, rgb('94463b'));
  }
}

function templeAxis(out, lod) {
  const y = d.floor,
    [x, z] = d.inner.shrine;
  const bottom = Math.min(...d.body.map(grade), y) - 1.22;
  mass(out, 'foot', 0, 0, 56.96, 38.03, bottom, y + 0.41, granite);
  if (lod >= 1) mass(out, 'trim', 0, 0, 56.96, 38.03, y + 0.38, y + 0.8, molding);
  mass(out, 'granite', x, z, 21.4, 23.1, y + 0.77, y + 9.3, granite);
  const tower = [
    [9.2, 1],
    [12.75, 0.991],
    [17.1, 0.931],
    [21.4, 0.827],
    [25.35, 0.669],
    [28.08, 0.487],
    [29.61, 0.302],
  ];
  loft(
    out,
    'granite',
    tower
      .filter((_, i) => lod > 0 || i % 2 === 0)
      .map(([h, k]) => [rectangle(x, z, 21.4 * k, 23.1 * k), y + h]),
    stone,
  );
  if (lod >= 1) {
    for (const [h, k] of tower.slice(0, -1)) {
      mass(out, 'trim', x, z, 21.4 * k + 0.48, 23.1 * k + 0.41, y + h, y + h + 0.21, molding);
    }
  }
  ring(
    out,
    'trim',
    x,
    z,
    [
      [y + 29.59, 3.61],
      [y + 30.32, 4.0],
      [y + 31.26, 3.67],
      [y + 31.74, 2.31],
    ],
    lod === 0 ? 7 : lod === 1 ? 12 : 24,
    molding,
    lod >= 2 ? 0.12 : 0,
  );
  ring(
    out,
    'bronze',
    x,
    z,
    [
      [y + 31.65, 0.92],
      [y + 32.21, 1.0],
      [y + 33, 0.67],
      [y + 33.51, 0.02],
    ],
    lod === 0 ? 6 : 12,
    gold,
  );
  const [p, q] = d.inner.portico;
  mass(out, 'granite', p, q, 13.3, 17.6, y + 0.75, y + 7.6, granite);
  ring(
    out,
    'trim',
    p,
    q,
    [
      [y + 7.6, 7.35],
      [y + 9.35, 6.7],
      [y + 11.6, 5.56],
      [y + 14.2, 2.85],
      [y + 15.2, 0.65],
    ],
    lod === 0 ? 8 : lod === 1 ? 12 : 24,
    stone,
  );
  const [mx, mz] = d.inner.mandapa;
  const span = 20.5;
  crouchedRoof(out, mx, mz, span, 29.7, y + 7.43, 6.48, lod);
  mass(out, 'granite', mx, mz, span, 29.7, y + 7.1, y + 7.52, granite);
  for (const row of [-1, 1]) {
    const x = mx + row * span * 0.41;
    const columns = lod === 0 ? 4 : 8;
    for (let i = 0; i < columns; i++) {
      const z = mz + (i / (columns - 1) - 0.5) * 26.8;
      mass(out, 'granite', x, z, 0.64, 0.68, y + 0.79, y + 7.22, granite);
      if (lod >= 1) {
        mass(out, 'trim', x, z, 0.95, 0.97, y + 0.75, y + 1.26, molding);
        mass(out, 'trim', x, z, 1.12, 1.26, y + 6.78, y + 7.18, molding);
      }
    }
  }
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const z = (i - 3.5) * 2.54,
          xx = x + side * 10.76;
        mass(out, 'dark', xx, z, 0.1, 1.33, y + 2.48, y + 6.72, shadow);
        mass(out, 'trim', xx + side * 0.12, z, 0.34, 1.94, y + 2.05, y + 2.37, molding);
        mass(out, 'trim', xx + side * 0.12, z, 0.42, 1.98, y + 6.51, y + 6.9, molding);
      }
    }
  }
}

function range(out, row, lod) {
  const w = Math.hypot(row.ring[0][0] - row.ring[1][0], row.ring[0][1] - row.ring[1][1]);
  const l = Math.hypot(row.ring[1][0] - row.ring[2][0], row.ring[1][1] - row.ring[2][1]);
  const [x, z] = [0, 1].map((j) => row.ring.reduce((s, p) => s + p[j], 0) / row.ring.length);
  const [width, depth] = [Math.max(w, l), Math.min(w, l)],
    y = row.floor;
  mass(out, 'foot', x, z, width, depth, row.foundation, y + 0.48, stone);
  mass(out, 'granite', x, z, width, depth, y + 0.49, y + 4.91, granite);
  crouchedRoof(out, x, z, width + 0.49, depth + 0.59, y + 4.89, 2.88, lod);
  if (lod >= 1) {
    const n = Math.round(width / 4.35);
    for (let i = 0; i < n; i++) {
      const xx = x + ((i + 0.5) / n) * width - width / 2,
        zz = z - Math.sign(z) * (depth / 2 + 0.035);
      mass(out, 'dark', xx, zz, 0.93, 0.12, y + 1.11, y + 3.59, shadow);
      mass(out, 'trim', xx, zz, 1.43, 0.35, y + 3.47, y + 3.82, molding);
    }
  }
}

function enclosure(out, lod) {
  for (let i = 0; i < d.outline.length; i++) {
    const a = d.outline[i],
      b = d.outline[(i + 1) % d.outline.length];
    const runs =
      i === 2
        ? [
            [a, [d.gate.center[0] + 0.45, 9.7]],
            [[d.gate.center[0] + 0.4, -9.7], b],
          ]
        : [[a, b]];
    for (const [a, b] of runs) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.ceil(L / (lod >= 2 ? 9.2 : 14));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          p = a.map((v, k) => v + (b[k] - v) * t);
        const [x, z] = p,
          lo = grade(p) - 1.64,
          height = lo + 6.2;
        const u = (b[0] - a[0]) / L,
          v = (b[1] - a[1]) / L;
        const at = (u0, v0) => [x + u * u0 - v * v0, z + v * u0 + u * v0];
        const r = [
          at(-L / n / 2, -0.72),
          at(L / n / 2, -0.72),
          at(L / n / 2, 0.72),
          at(-L / n / 2, 0.72),
        ];
        loft(
          out,
          'granite',
          [
            [r, lo],
            [r, height],
          ],
          granite,
        );
        if (lod >= 1)
          beam(
            out,
            'trim',
            [x - (u * L) / n / 2, height, z - (v * L) / n / 2],
            [x + (u * L) / n / 2, height, z + (v * L) / n / 2],
            1.84,
            0.28,
            molding,
          );
      }
    }
  }
}

function courtSteps(out, lod) {
  const west = -40.4;
  const east = -28.39;
  const start = grade([west, 0]) + 0.18;
  const top = d.floor + 0.42;
  const count = [2, 7, 17, 25][lod];
  for (let i = 0; i < count; i++) {
    const a = west + ((east - west) * i) / count;
    const b = west + ((east - west) * (i + 1)) / count;
    const y = start + ((top - start) * (i + 1)) / count;
    box(out, 'foot', [a, Math.min(grade([a, 0]), start) - 1.25, -3.72], [b, y, 3.72], stone);
  }
}

function build(out, lod) {
  gopuram(out, lod);
  courtSteps(out, lod);
  templeAxis(out, lod);
  d.halls.forEach((row) => range(out, row, lod));
  enclosure(out, lod);
}
export const skyline = (o) => build(o, 0);
export const district = (o) => build(o, 1);
export const street = (o) => build(o, 2);
export const closeup = (o) => build(o, 3);
const recipe = 'varaha-lakshmi-narasimha-temple-simhachalam-model.mjs';
const camera = [-118, 104, 126],
  lookAt = [-5, 19, 0];
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  wikidataId: 'Q2620389',
  category: 'landmark',
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-exterior',
  groundContactBasis:
    'Independent native terrain sampled at the hilltop inner entrance court and four building outlines.',
  brief:
    'The west-facing blue and cream Raja Gopuram, granite shrine and its curved tower, pillared halls and roofed court enclosure at Simhachalam.',
  camera,
  lookAt,
  sunDirection: [-71, 63, 42],
  embeddedCanonicalGraphs: Object.values(surfaces)
    .map((s) => s.graph)
    .filter(Boolean),
  buildingCutout: {
    outline: d.outline,
    outlines: [d.body, ...d.halls.map((h) => h.ring)],
    minimumCoverage: 0.88,
    basis: 'Only the five native building footprints inside the exact temple enclosure.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'west-raja-gopuram', position: [-129, 24, 9], lookAt: [-44, 15, 0] },
    { name: 'gopuram-five-sculpted-tiers', position: [-72, 31, 21], lookAt: [-43, 23, 1] },
    { name: 'mandapa-portico-and-rekha-sanctum', position: [-12, 49, 64], lookAt: [4, 17, 0] },
    { name: 'granite-enclosure-and-hill', position: [58, 83, -85], lookAt: [0, 13, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'simhachalam-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.87, surfaces },
      street: { export: 'street', errorMeters: 0.31, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Both photographic references have creator CC0 dedications. OpenStreetMap controls are ODbL 1.0.',
};
