import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const asset = 'south-carolina-state-house-model.mjs';
const stone = rgb('c7c2b8');
const trim = rgb('d9d3c6');
const foundation = rgb('aba79e');
const copper = rgb('62504a');
const seam = rgb('78645a');
const roofColor = rgb('666665');
const windowColor = rgb('32424a');
const dark = rgb('39312b');
const stepsColor = rgb('aeaaa2');
const materials = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.88, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.75, metallic: 0.31 },
  roofShade: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.05 },
};
const levels = [
  { column: 4, dome: 12, facade: 0, stairs: 1, rails: 0 },
  { column: 8, dome: 20, facade: 1, stairs: 6, rails: 1 },
  { column: 16, dome: 32, facade: 2, stairs: 14, rails: 2 },
  { column: 24, dome: 48, facade: 3, stairs: 29, rails: 3 },
];

function surface(out, slot, points, color, isRoof = false) {
  const n = normalFor(...points);
  const p = isRoof && n[1] < 0 ? points.toReversed() : points;
  if (p.length === 4) {
    quad(out, slot, p, normalFor(...p), color);
  } else {
    out.addConvexPolygon(
      slot,
      'palette:#ffffff',
      p,
      normalFor(...p),
      (position) => [position[0], position[1] + position[2]],
      color,
    );
  }
}

function cylinder(out, slot, x, z, profile, segments, color, flutes = false) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: segments }, (_, i) => {
      const angle = (2 * Math.PI * i) / segments;
      const radius = r * (flutes && i % 2 ? 0.933 : 1);
      return [x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius];
    }),
  );
  for (let k = 1; k < profile.length; k++) {
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const a = rings[k - 1],
        b = rings[k];
      surface(out, slot, [a[i], b[i], b[j], a[j]], color);
    }
  }
}

function cornice(out, x0, x1, z0, z1, y, scale = 1) {
  box(
    out,
    'trim',
    [x0 - 0.2 * scale, y, z0 - 0.2 * scale],
    [x1 + 0.2 * scale, y + 0.26, z1 + 0.2 * scale],
    stone,
  );
  box(
    out,
    'trim',
    [x0 - 0.48 * scale, y + 0.26, z0 - 0.48 * scale],
    [x1 + 0.48 * scale, y + 0.56, z1 + 0.48 * scale],
    trim,
  );
}

function houseBlock(out, lod) {
  const { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } = d.main;
  box(out, 'base', [x0, -2.35, z0], [x1, d.floor, z1], foundation);
  box(out, 'stone', [x0, d.floor, z0], [x1, 20.25, z1], stone);
  cornice(out, x0, x1, z0, z1, d.roofEdge - 0.56);
  const lower = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ].map(([x, z]) => [x, 20.61, z]);
  const upper = [
    [x0 + 12, z0 + 11],
    [x1 - 12, z0 + 11],
    [x1 - 12, z1 - 11],
    [x0 + 12, z1 - 11],
  ].map(([x, z]) => [x, 23.85, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    surface(out, 'roofShade', [lower[i], lower[j], upper[j], upper[i]], roofColor, true);
  }
  surface(out, 'roofShade', upper, roofColor, true);
  const face = [
    [x0, z0, x1, z0],
    [x1, z0, x1, z1],
    [x1, z1, x0, z1],
    [x0, z1, x0, z0],
  ];
  for (const [side, [ax, az, bx, bz]] of face.entries()) {
    const length = Math.hypot(bx - ax, bz - az);
    const ex = (bx - ax) / length,
      ez = (bz - az) / length;
    const nx = ez,
      nz = -ex;
    const at = (s, y, depth = 0) => [ax + ex * s + nx * depth, y, az + ez * s + nz * depth];
    for (const y of [5.28, 5.66, 13.6]) {
      if (!lod.facade && y !== 5.28) continue;
      beam(out, 'trim', at(0, y, 0.06), at(length, y, 0.06), 0.29, 0.22, trim);
    }
    if (lod.facade >= 2) {
      for (let y = 1.03; y < 5.2; y += 0.67)
        beam(out, 'base', at(0, y, 0.014), at(length, y, 0.014), 0.038, 0.041, dark);
      for (let i = 1; i < Math.floor(length / 0.88); i++) {
        const s = i * 0.88;
        surface(
          out,
          'trim',
          [
            at(s + 0.1, 19.96, 0.38),
            at(s - 0.1, 19.96, 0.38),
            at(s - 0.1, 20.24, 0.38),
            at(s + 0.1, 20.24, 0.38),
          ],
          trim,
        );
      }
      for (let i = 0; i < 13; i++) {
        const y = 6.15 + i * 0.99;
        const w = i % 2 ? 0.62 : 0.93;
        for (const [left, right] of [
          [0.03, w],
          [length - w, length - 0.03],
        ]) {
          surface(
            out,
            'trim',
            [
              at(right, y, 0.19),
              at(left, y, 0.19),
              at(left, y + 0.49, 0.19),
              at(right, y + 0.49, 0.19),
            ],
            trim,
          );
        }
      }
    }
    const bays = side % 2 ? 5 : 19;
    for (let n = 0; n < bays; n++) {
      const s = ((n + 0.5) * length) / bays;
      if (!lod.facade && n % 3 !== 1) continue;
      const inPortico = side % 2 === 0 && Math.abs(s - length / 2) < 15.7;
      if (inPortico && lod.facade === 0) continue;
      if (inPortico && n === 9) {
        opening(out, at, s, d.floor, 2.15, 4.8, 'arch', lod);
        continue;
      }
      if (!inPortico)
        opening(out, at, s, 0.92, 1.33, 2.9, side % 2 && n === 2 ? 'arch' : 'segment', lod);
      opening(out, at, s, 7.42, 1.62, 4.82, 'pediment', lod);
      opening(out, at, s, 15.31, 1.42, 2.34, 'plain', lod);
    }
    const omitCenter = side % 2 === 0 ? 15.8 : 0;
    const ranges = omitCenter
      ? [
          [0, length / 2 - omitCenter],
          [length / 2 + omitCenter, length],
        ]
      : [[0, length]];
    for (const [a, b] of ranges) balustrade(out, at, a, b, 20.62, lod);
  }
}

function opening(out, at, x, bottom, width, height, kind, lod) {
  const left = x - width / 2,
    right = x + width / 2,
    top = bottom + height;
  const glass = (a, y) => at(a, y, 0.035);
  const surround = (a, y) => at(a, y, 0.12);
  const arched = kind === 'arch' || kind === 'segment';
  const rise = arched ? (kind === 'arch' ? width * 0.48 : width * 0.21) : 0;
  const spring = top - rise;
  const panel = (slot, points, color) => surface(out, slot, points.toReversed(), color);
  panel(
    'dark',
    [glass(left, bottom), glass(right, bottom), glass(right, spring), glass(left, spring)],
    windowColor,
  );
  const basic = (a, b, y0, y1) =>
    panel('trim', [surround(a, y0), surround(b, y0), surround(b, y1), surround(a, y1)], trim);
  if (rise) {
    const center = glass(x, spring);
    const segments = lod.facade >= 2 ? 9 : 5;
    const arc = Array.from({ length: segments + 1 }, (_, i) => {
      const angle = (i * Math.PI) / segments;
      return [x + (Math.cos(angle) * width) / 2, spring + Math.sin(angle) * rise];
    });
    for (let i = 1; i < arc.length; i++) {
      const [a, ay] = arc[i],
        [b, by] = arc[i - 1];
      panel('dark', [center, glass(b, by), glass(a, ay)], windowColor);
      if (lod.facade >= 2) {
        const shell = (w, y) => surround(x + 1.23 * (w - x), spring + 1.42 * (y - spring));
        panel('trim', [surround(b, by), shell(b, by), shell(a, ay), surround(a, ay)], stone);
      }
    }
  }
  if (!lod.facade) return;
  if (lod.facade >= 2) {
    basic(left - 0.18, left, bottom - 0.11, spring + 0.15);
    basic(right, right + 0.18, bottom - 0.11, spring + 0.15);
  }
  basic(left - 0.36, right + 0.36, bottom - 0.22, bottom);
  if (kind === 'pediment') {
    basic(left - 0.3, right + 0.3, top, top + 0.24);
    panel(
      'trim',
      [
        surround(left - 0.34, top + 0.24),
        surround(right + 0.34, top + 0.24),
        surround(x, top + 0.78),
      ],
      trim,
    );
    if (lod.facade >= 2) {
      const ridge = at(x, top + 0.82, 0.25);
      beam(out, 'trim', at(left - 0.38, top + 0.25, 0.25), ridge, 0.19, 0.17, trim);
      beam(out, 'trim', ridge, at(right + 0.38, top + 0.25, 0.25), 0.19, 0.17, trim);
    }
  } else if (!arched) {
    basic(left - 0.16, right + 0.16, top, top + 0.16);
  }
  if (lod.facade >= 2) {
    beam(out, 'dark', glass(x, bottom), glass(x, top - 0.03), 0.067, 0.075, trim);
    const y = bottom + height * 0.51;
    beam(out, 'dark', glass(left, y), glass(right, y), 0.067, 0.075, trim);
  }
}

function balustrade(out, at, a, b, y, lod) {
  const band = (dy, width) =>
    beam(out, 'trim', at(a, y + dy, 0.14), at(b, y + dy, 0.14), 0.3, width, trim);
  if (!lod.rails) {
    band(0.27, 0.51);
    return;
  }
  band(0.12, 0.42);
  band(1.11, 0.37);
  const increment = lod.rails === 1 ? 1.8 : lod.rails === 2 ? 0.74 : 0.54;
  const count = Math.round((b - a) / increment);
  for (let i = 0; i <= count; i++) {
    const s = a + ((b - a) * i) / count;
    const width = i % 7 === 0 ? 0.46 : 0.15;
    if (lod.rails === 3) {
      beam(out, 'trim', at(s, y + 0.22, 0.14), at(s, y + 0.99, 0.14), width, width, trim);
    } else {
      surface(
        out,
        'trim',
        [
          at(s + width / 2, y + 0.22, 0.24),
          at(s - width / 2, y + 0.22, 0.24),
          at(s - width / 2, y + 0.99, 0.24),
          at(s + width / 2, y + 0.99, 0.24),
        ],
        trim,
      );
    }
  }
}

function portico(out, data, side, lod) {
  const { minX: x0, maxX: x1, front } = data;
  const body = side < 0 ? d.main.minZ : d.main.maxZ;
  const z0 = Math.min(body, front),
    z1 = Math.max(body, front);
  box(out, 'base', [x0, -1.95, z0], [x1, d.floor, z1], foundation);
  const columnZ = front - side * 0.92;
  const count = 10;
  for (let i = 0; i < count; i++) {
    const x = x0 + 1.1 + ((x1 - x0 - 2.2) * i) / (count - 1);
    const top = d.porticoCornice - 1.03;
    if (lod.facade) {
      box(
        out,
        'trim',
        [x - 0.71, d.floor, columnZ - 0.68],
        [x + 0.71, d.floor + 0.34, columnZ + 0.68],
        trim,
      );
      box(
        out,
        'trim',
        [x - 0.78, top + 0.15, columnZ - 0.74],
        [x + 0.78, top + 0.56, columnZ + 0.74],
        trim,
      );
    }
    const profile =
      lod.column < 10
        ? [
            [d.floor, 0.48],
            [top + 0.17, 0.42],
          ]
        : [
            [d.floor + 0.29, 0.58],
            [d.floor + 0.67, 0.54],
            [d.floor + 1.03, 0.49],
            [top - 0.28, 0.42],
            [top + 0.22, 0.63],
          ];
    cylinder(out, 'trim', x, columnZ, profile, lod.column, stone, lod.column >= 16);
  }
  box(
    out,
    'trim',
    [x0 - 0.34, d.porticoCornice - 1.05, z0 - 0.32],
    [x1 + 0.34, d.porticoCornice, z1 + 0.32],
    trim,
  );
  const apex = d.porticoCornice + 3.33;
  const u = x0 - 0.62,
    v = x1 + 0.62;
  const boundary = front + side * 0.56;
  const end = body - side * 0.29;
  const face = [
    [u, d.porticoCornice, boundary],
    [v, d.porticoCornice, boundary],
    [0, apex, boundary],
  ];
  surface(out, 'stone', side < 0 ? face.toReversed() : face, stone);
  for (const x of [u, v]) {
    surface(
      out,
      'roofShade',
      [
        [x, d.porticoCornice, boundary],
        [x, d.porticoCornice, end],
        [0, apex, end],
        [0, apex, boundary],
      ],
      roofColor,
      true,
    );
    beam(out, 'trim', [x, d.porticoCornice, boundary], [0, apex, boundary], 0.43, 0.32, trim);
  }
  if (lod.facade >= 2) {
    for (let x = u + 0.55; x < v - 0.4; x += 0.81)
      box(
        out,
        'trim',
        [x - 0.12, d.porticoCornice - 0.43, Math.min(boundary, boundary - side * 0.33)],
        [x + 0.12, d.porticoCornice - 0.18, Math.max(boundary, boundary - side * 0.33)],
        trim,
      );
  }
}

function staircase(out, side, lod) {
  const data = side < 0 ? d.north : d.south;
  const inner = Math.abs(data.front),
    middle = side < 0 ? 43.55 : 38.88,
    outer = side < 0 ? 53.02 : 53.74;
  const width = side < 0 ? 12.95 : 11.7;
  const t = (z) => side * z;
  const step = (a, b, lo, hi, n, w) => {
    for (let i = 0; i < n; i++) {
      const za = t(a + ((b - a) * i) / n),
        zb = t(a + ((b - a) * (i + 1)) / n);
      const top = hi + ((lo - hi) * i) / n;
      box(out, 'base', [-w, -2.35, Math.min(za, zb)], [w, top, Math.max(za, zb)], stepsColor);
    }
  };
  step(inner, middle, 2.29, d.floor, lod.stairs, width);
  step(middle, middle + 4.19, 2.24, 2.25, 1, width);
  step(middle + 4.19, outer, -0.8, 2.24, Math.max(1, Math.ceil(lod.stairs * 0.51)), width);
  for (const sign of [-1, 1]) {
    const x = sign * (width + 0.74);
    for (const [a, b, h0, h1] of [
      [inner, middle, d.floor + 0.82, 3.24],
      [middle, middle + 4.19, 3.24, 3.24],
      [middle + 4.19, outer, 3.24, 0.42],
    ]) {
      const za = t(a),
        zb = t(b);
      const p = [
        [x - 0.7, h0, za],
        [x + 0.7, h0, za],
        [x + 0.7, h1, zb],
        [x - 0.7, h1, zb],
      ];
      surface(out, 'trim', p, trim, true);
      for (const xx of [x - 0.7, x + 0.7]) {
        const face = [
          [xx, -2.4, za],
          [xx, -2.4, zb],
          [xx, h1, zb],
          [xx, h0, za],
        ];
        surface(out, 'base', (xx === x - 0.7) === side < 0 ? face : face.toReversed(), foundation);
      }
    }
    if (lod.facade >= 2) {
      for (const z of [inner, middle, middle + 4.19, outer]) {
        const y = z === inner ? d.floor + 0.8 : z === outer ? 0.43 : 3.22;
        box(out, 'trim', [x - 0.82, y - 0.62, t(z) - 0.8], [x + 0.82, y + 0.13, t(z) + 0.8], trim);
      }
    }
  }
}

function dome(out, lod) {
  const n = lod.dome;
  box(out, 'stone', [-8.07, 22.4, -8.07], [8.07, d.domeBase, 8.07], stone);
  cylinder(
    out,
    'stone',
    0,
    0,
    [
      [d.domeBase, 7.55],
      [d.drumTop, 7.55],
    ],
    n,
    stone,
  );
  if (lod.facade) {
    for (let i = 0; i < 16; i++) {
      const a = (2 * Math.PI * i) / 16,
        ca = Math.cos(a),
        sa = Math.sin(a);
      const at = (x, y, q = 0) => {
        const r = 7.58 + q;
        return [r * ca - x * sa, y, r * sa + x * ca];
      };
      opening(out, at, 0, d.domeBase + 0.55, 1.26, 5.66, 'arch', lod);
    }
  }
  cylinder(
    out,
    'copper',
    0,
    0,
    [
      [d.drumTop - 0.28, 7.66],
      [d.drumTop + 0.1, 8.64],
      [d.drumTop + 0.65, 8.65],
      [d.drumTop + 1.07, 8.13],
      [35.52, 7.73],
      [37.97, 6.61],
      [40.21, 4.89],
      [42.1, 2.87],
      [d.roofTop, 1.76],
    ].filter((_, i) => lod.facade || i % 2 === 0),
    n,
    copper,
  );
  cylinder(
    out,
    'copper',
    0,
    0,
    [
      [d.roofTop - 0.3, 1.76],
      [d.roofTop + 0.3, 2.19],
      [d.roofTop + 3.9, 2.07],
      [d.lanternTop - 1.02, 2.6],
      [d.lanternTop - 0.44, 2.37],
      [d.lanternTop, 0.7],
      [d.lanternTop + 0.1, 0.035],
    ],
    Math.max(6, n / 2),
    copper,
  );
  if (lod.facade >= 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        ca = Math.cos(a),
        sa = Math.sin(a);
      const at = (x, y, offset = 0) => [
        (6.65 + offset) * ca + x * sa,
        y,
        (6.65 + offset) * sa - x * ca,
      ];
      const face = [
        at(-0.71, 37.36),
        at(0.71, 37.36),
        at(0.71, 38.43),
        at(0, 39.22),
        at(-0.71, 38.43),
      ];
      surface(
        out,
        'copper',
        face.map(([x, y, z]) => [x + ca * 0.66, y, z + sa * 0.66]),
        seam,
      );
      surface(
        out,
        'dark',
        [
          at(-0.39, 37.58, 0.72),
          at(0.39, 37.58, 0.72),
          at(0.39, 38.37, 0.72),
          at(-0.39, 38.37, 0.72),
        ],
        windowColor,
      );
      const x = 1.98 * ca,
        z = 1.98 * sa;
      beam(out, 'copper', [x, d.roofTop + 0.36, z], [x, d.lanternTop - 1.12, z], 0.28, 0.26, seam);
    }
  }
  beam(out, 'dark', [0, d.lanternTop - 0.05, 0], [0, d.flagTop, 0], 0.115, 0.115, trim);
}

function build(out, level) {
  const lod = levels[level];
  houseBlock(out, lod);
  portico(out, d.north, -1, lod);
  portico(out, d.south, 1, lod);
  staircase(out, -1, lod);
  staircase(out, 1, lod);
  dome(out, lod);
}

export const stateHouseSkyline = (out) => build(out, 0);
export const stateHouseDistrict = (out) => build(out, 1);
export const stateHouseStreet = (out) => build(out, 2);
export const stateHouseCloseup = (out) => build(out, 3);
const camera = [95, 60, -125],
  lookAt = [0, 20, 0];
const terrain = {
  descriptor: 'terrain-review.terrain.json',
  heightmap: 'terrain-review.height.png',
};
export const stateHouseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe: asset,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces: materials,
  category: 'landmark',
  wikidataId: 'Q2915276',
  build: stateHouseCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-exterior',
  groundContactBasis:
    'USGS 3DEP bare-earth surface along the west foundation, independently sampled in the native survey frame.',
  brief:
    'Columbia State House with its two ten-column granite porticoes, matching double stairs, rusticated basement, balustrade and dark copper dome.',
  camera,
  lookAt,
  sunDirection: [-54, 69, -62],
  embeddedCanonicalGraphs: Object.values(materials)
    .map((s) => s.graph)
    .filter(Boolean),
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.91,
    basis: 'The exact mapped named State House outline, bounded to the wall and portico footprint.',
  },
  mediumFiContext: { scale: 1, groundY: -0.1, terrain },
  qaCameras: [
    { name: 'main-stair-and-north-portico', position: [7, 17, -76], lookAt: [0, 15, -18] },
    { name: 'south-stairs-and-east-wing', position: [69, 30, 67], lookAt: [2, 16, 10] },
    { name: 'copper-dome-and-drum', position: [24, 43, -48], lookAt: [0, 37, 0] },
    {
      name: 'rusticated-basement-and-three-sash-tiers',
      position: [-71, 13, -29],
      lookAt: [-27, 10, -2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'state-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + asset,
    level: 'skyline',
    export: 'stateHouseSkyline',
    errorMeters: 1.62,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'stateHouseDistrict', errorMeters: 0.76, surfaces: materials },
      street: { export: 'stateHouseStreet', errorMeters: 0.24, surfaces: materials },
      closeup: { export: 'stateHouseCloseup', errorMeters: 0.081, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original Molen model geometry under repository license. Verified Qualla photographic references are public domain. OpenStreetMap controls are ODbL 1.0.',
};
