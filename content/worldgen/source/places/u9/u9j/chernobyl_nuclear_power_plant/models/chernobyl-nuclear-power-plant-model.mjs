import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  silver: 'b1b8b7',
  light: 'c1c6c4',
  grey: 'aeb5b6',
  shadow: 'a0aaab',
  trim: 'c0c6c4',
  concrete: 'a9aba1',
  footing: '97988e',
  wall: 'b9b9a8',
  beige: 'b9b8a0',
  pale: 'c4c6b5',
  green: 'aab79b',
  roof: '858b89',
  roofLight: 'a3a7a1',
  strip: '727a77',
  glass: '657875',
});
const surfaces = {
  shell: surface('roof', 'metal_standing_seam', 0.65, 0.23),
  end: surface('wall', 'metal_corrugated', 0.7, 0.15),
  trim: surface('trim', 'metal_painted', 0.75, 0.12),
  slab: surface('foundation', 'concrete_panel', 0.92),
  wall: surface('wall', 'concrete_boardformed', 0.9),
  windows: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.5, metallic: 0.06 },
};
const walls = (outline) => pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
const bottom = (p) => Math.min(-0.55, grade(p) - 0.38);
const floor = 1.12;
const crownBase = floor + 1.25;
const arche = d.arch;
const radius = arche.span / 2;
const curve = (theta) => {
  const v = Math.max(0, Math.sin(theta));
  return [
    crownBase + (arche.height - 1.25) * Math.pow(v, 0.91),
    arche.centerZ + radius * Math.cos(theta),
  ];
};
const zNorth = arche.centerZ - radius,
  zSouth = arche.centerZ + radius;
const roofPt = (x, theta, lift = 0) => {
  const [y, z] = curve(theta);
  return [x, y + lift, z];
};
const archColor = [
  c.silver,
  c.grey,
  c.silver,
  c.light,
  c.silver,
  c.shadow,
  c.silver,
  c.grey,
  c.light,
];
const boundAtHeight = (y) => {
  const u = Math.max(0, Math.min(1, (y - crownBase) / (arche.height - 1.25)));
  const spike = Math.pow(u, 1 / 0.91);
  return radius * Math.sqrt(1 - spike * spike);
};
function enclosure(out, level) {
  const west = arche.westX,
    east = arche.eastX;
  const n = [18, 32, 56, 80][level];
  const steps = [2, 4, 9, 13][level];
  const angular = (i) => (Math.PI * i) / n;
  for (let i = 0; i < n; i++) {
    const a = angular(i),
      b = angular(i + 1);
    const turn = (a + b) * 0.5;
    const normal = [0, Math.sin(turn) + 0.05, Math.cos(turn)];
    for (let j = 0; j < steps; j++) {
      const u = mix(west, east, j / steps),
        v = mix(west, east, (j + 1) / steps);
      const shade = archColor[(i + 2 * (j % 3)) % archColor.length];
      face(out, 'shell', [roofPt(u, a), roofPt(v, a), roofPt(v, b), roofPt(u, b)], normal, shade);
    }
    if (level >= 1)
      for (const x of [west, east - 1.31]) {
        face(
          out,
          'trim',
          [
            roofPt(x, a, 0.07),
            roofPt(x + 1.31, a, 0.07),
            roofPt(x + 1.31, b, 0.07),
            roofPt(x, b, 0.07),
          ],
          normal,
          c.trim,
        );
      }
    if (level >= 2 && i > 0 && i % (level === 2 ? 7 : 4) === 0) {
      const t = a + 0.0065;
      face(
        out,
        'trim',
        [
          roofPt(west + 0.9, a, 0.055),
          roofPt(east - 0.9, a, 0.055),
          roofPt(east - 0.9, t, 0.055),
          roofPt(west + 0.9, t, 0.055),
        ],
        normal,
        c.shadow,
      );
    }
  }
  for (const [x, facing] of [
    [west, -1],
    [east, 1],
  ]) {
    const w = {
      normal: [facing, 0, 0],
      p: (u, y, dep = 0) => [x + facing * dep, y, arche.centerZ + u],
    };
    for (let i = 0; i < n; i++) {
      const [y, z] = curve(angular(i)),
        [top, next] = curve(angular(i + 1));
      face(
        out,
        'end',
        [
          [x, floor - 0.03, z],
          [x, floor - 0.03, next],
          [x, top, next],
          [x, y, z],
        ],
        w.normal,
        i % 7 === 3 ? c.grey : c.silver,
      );
    }
    const levels = level === 0 ? [23, 55, 81] : [11.3, 22.1, 26, 45.5, 62.3, 79.2, 93.8];
    for (const elevation of levels) {
      const y = floor + elevation;
      const r = boundAtHeight(y + 1.22) - 1;
      if (r <= 2) continue;
      panel(
        out,
        'trim',
        w,
        -r,
        r,
        y,
        y + (elevation === 22.1 ? 2.2 : 0.56),
        0.052,
        elevation === 22.1 ? c.light : c.grey,
      );
    }
    if (level >= 1) {
      const u = facing === -1 ? 11.7 : -9.2;
      const height = curve(Math.acos(u / radius))[0] - 1.0;
      panel(out, 'end', w, u - 2.93, u + 2.93, floor + 0.29, height, 0.28, c.grey);
      for (let y = 11.8; y < height - 2; y += level >= 2 ? 8.5 : 17) {
        panel(out, 'trim', w, u - 3.26, u + 3.26, y, y + 0.38, 0.5, c.trim);
      }
    }
  }
  for (const z of [zNorth - 5.52, zSouth - 1.43]) {
    const base = rect(west - 5.65, z, east + 5.05, z + 7.01);
    shell(out, base, bottom, crownBase + 0.23, {
      wall: 'slab',
      roof: 'slab',
      color: c.footing,
      roofColor: c.concrete,
    });
    block(
      out,
      'slab',
      west - 4.9,
      crownBase + 0.21,
      z + 0.22,
      east - west + 9.7,
      0.31,
      6.58,
      c.concrete,
    );
  }
}

function facade(out, w, low, high, kind, level) {
  const step = level === 0 ? 22 : level === 1 ? 9.75 : level === 2 ? 5.48 : 3.18;
  const count = Math.max(1, Math.round(w.length / step));
  const cap = high - 1.04;
  panel(out, 'slab', w, 0, w.length, cap, high, 0.065, c.pale);
  if (w.length < 7.0) return;
  const floats =
    kind === 'hall'
      ? [
          [0.67, 0.84],
          [0.1, 0.25],
        ]
      : [
          [0.53, 0.73],
          [0.12, 0.26],
        ];
  const y = (t) => mix(low, high, t);
  const panes = level === 0 ? [floats[0]] : floats;
  for (const [a, b] of panes) {
    panel(out, 'trim', w, 0.23, w.length - 0.23, y(a) - 0.14, y(b) + 0.16, 0.053, c.strip);
    for (let j = 0; j < count; j++) {
      const s = (w.length * j) / count,
        t = (w.length * (j + 1)) / count,
        gap = Math.min(0.27, (t - s) * 0.13);
      panel(
        out,
        'windows',
        w,
        s + gap,
        t - gap,
        y(a),
        y(b),
        0.075,
        (j + 1) % 6 === 0 ? c.strip : c.glass,
      );
    }
  }
  if (level >= 1) {
    const divisions = Math.max(1, Math.round(w.length / (kind === 'hall' ? 15.5 : 11.8)));
    for (let j = 0; j <= divisions; j++) {
      const u = (w.length * j) / divisions;
      const a = Math.max(0.02, u - 0.24),
        b = Math.min(w.length - 0.02, u + 0.24);
      panel(out, 'slab', w, a, b, y(0.026), cap, 0.11, c.concrete);
    }
  }
}
function building(out, outline, height, kind, level) {
  const base = 0.19;
  const shade = kind === 'west' ? c.beige : kind === 'hall' ? c.pale : c.wall;
  shell(out, outline, bottom, base, {
    wall: 'slab',
    roof: 'slab',
    color: c.footing,
    roofColor: c.concrete,
  });
  shell(out, outline, () => base, height, {
    wall: 'wall',
    roof: 'shell',
    color: shade,
    roofColor: c.roof,
  });
  for (const w of walls(outline)) {
    // The small changes in the surveyed long wall remain distinct in plan.
    if (w.length < 0.8) continue;
    facade(out, w, base, height, kind, level);
    if (kind === 'west' && level >= 1) {
      panel(out, 'wall', w, 0, w.length, height * 0.73, height * 0.91, 0.125, c.green);
    }
  }
}

const roofSections = [
  [94.0, 273.0, 54.9],
  [285.5, 412.0, 53.55],
  [424.0, 566.0, 54.1],
  [579.0, 697.0, 52.9],
];
function longHall(out, level) {
  building(out, d.hall, d.hallHeight, 'hall', level);
  for (const [x0, x1, high] of roofSections) {
    const z0 = 27.3,
      z1 = 76.9,
      cen = (z0 + z1) * 0.5;
    const bottom = d.hallHeight - 0.052;
    const ends = [
      [
        [x0, bottom, z0],
        [x0, high, cen],
        [x0, bottom, z1],
      ],
      [
        [x1, bottom, z0],
        [x1, high, cen],
        [x1, bottom, z1],
      ],
    ];
    for (const [i, edge] of ends.entries())
      face(out, 'end', edge, [i === 0 ? -1 : 1, 0, 0], c.grey);
    for (const z of [z0, z1]) {
      face(
        out,
        'shell',
        [
          [x0, bottom, z],
          [x1, bottom, z],
          [x1, high, cen],
          [x0, high, cen],
        ],
        up,
        c.roofLight,
      );
    }
    if (level === 0) continue;
    const stripes = level === 1 ? 3 : level === 2 ? 9 : 15;
    for (let i = 1; i < stripes; i++) {
      const x = mix(x0, x1, i / stripes);
      for (const z of [z0, z1]) {
        face(
          out,
          'trim',
          [
            [x - 0.08, bottom + 0.07, z],
            [x + 0.08, bottom + 0.07, z],
            [x + 0.08, high + 0.072, cen],
            [x - 0.08, high + 0.072, cen],
          ],
          up,
          c.strip,
        );
      }
    }
    block(out, 'trim', x0 + 0.17, high - 0.08, cen - 0.36, x1 - x0 - 0.34, 0.44, 0.72, c.grey);
  }
}

function build(out, level) {
  enclosure(out, level);
  longHall(out, level);
  building(out, d.block3, d.westBlockHeight, 'west', level);
  building(out, d.block2, d.eastBlockHeight, 'lower', level);
  building(out, d.block1, d.eastBlockHeight, 'lower', level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'chernobyl-nuclear-power-plant-model.mjs';
const camera = [-532, 242, -610],
  lookAt = [240, 33, 1];
const errors = { district: 1.24, street: 0.52, closeup: 0.14 };
const cutout = [
  [-96, -142],
  [81, -142],
  [81, -110],
  [116, -110],
  [116, -75],
  [157, -75],
  [157, -61],
  [168.5, -61],
  [168.5, 16.5],
  [356, 16.5],
  [356, -32.8],
  [421, -33.5],
  [421, 16.5],
  [517, 16.5],
  [517, -33],
  [590, -33],
  [590, 16.5],
  [706, 16.5],
  [706, 87],
  [80.3, 87],
  [80.3, 135.5],
  [-95.4, 137],
];
export const chernobylPlantAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original terrain immediately west of the mapped central building envelopes.',
  brief:
    'The silver New Safe Confinement arch and the contiguous industrial roofline at the Chernobyl Nuclear Power Plant.',
  camera,
  lookAt,
  sunDirection: [-205, 220, -129],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: cutout,
    basis:
      'Bounded around the visible industrial envelopes where the source field includes roof returns.',
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Independently mapped arch and adjacent exposed industrial buildings.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'silver-arch-and-west-end', position: [-294, 24, -156], lookAt: [-10, 50, -1] },
    { name: 'north-exterior-and-visible-hall', position: [200, 147, -410], lookAt: [232, 33, 6] },
    {
      name: 'industrial-roofline-and-lower-elevations',
      position: [639, 72, 313],
      lookAt: [397, 28, 43],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'chernobyl-nuclear-power-plant-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.34,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Mapzen terrain and © OpenStreetMap contributors.',
};
