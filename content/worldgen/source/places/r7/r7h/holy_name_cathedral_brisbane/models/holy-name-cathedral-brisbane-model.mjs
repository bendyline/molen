/** The extant sandstone heritage fabric beside Ann and Gotha Streets. Distances are in metres. */
import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  carved: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.9, metallic: 0.08 },
};
const tint = Object.fromEntries(
  Object.entries({
    wall: 'd6c0a0',
    trim: 'd9c4a4',
    shade: 'afa087',
    stone: 'b9a58b',
    recess: '938672',
    iron: '5a5144',
    top: 'e1ccac',
  }).map(([key, value]) => [key, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const shade = (color, t) => color.map((v) => Math.min(1, v * t));

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function archRecess(out, center, bottom, top, lod) {
  const r = 0.66;
  const spring = bottom + 1.91;
  const sill = bottom + 0.37;
  const front = 0.034;
  const inner = -0.58;
  const divisions = [5, 8, 12, 16][lod];
  box(out, 'wall', [center - r, sill - 0.29, inner], [center + r, sill, front], tint.wall);
  box(
    out,
    'wall',
    [center - r - 0.19, sill, inner],
    [center - r, spring + 0.18, front + 0.016],
    tint.trim,
  );
  box(
    out,
    'wall',
    [center + r, sill, inner],
    [center + r + 0.19, spring + 0.18, front + 0.016],
    tint.trim,
  );
  const curve = (radius, angle, z) => [
    center + radius * Math.cos(angle),
    spring + radius * Math.sin(angle),
    z,
  ];
  for (let i = 0; i < divisions; i++) {
    const a = (i * Math.PI) / divisions;
    const b = ((i + 1) * Math.PI) / divisions;
    const [p, q] = [curve(r, a, front), curve(r, b, front)];
    const edge = r + 0.21;
    const [l, m] = [curve(edge, a, front), curve(edge, b, front)];
    face(out, 'wall', [m, l, [l[0], top, front], [m[0], top, front]], tint.wall);
    const inset = (point) => [point[0], point[1], inner];
    face(out, 'carved', [q, p, l, m], shade(tint.trim, 0.92 + 0.13 * Math.sin(i * 4.6)));
    face(out, 'carved', [inset(q), inset(p), p, q], tint.shade);
  }
  box(
    out,
    'base',
    [center - r - 0.045, sill - 0.04, inner - 0.15],
    [center + r + 0.045, spring + r + 0.22, inner],
    tint.recess,
  );
  if (lod > 1) {
    for (let k = -2; k <= 2; k++) {
      const x = center + k * 0.219;
      const h = spring + Math.sqrt(r * r - (x - center) * (x - center));
      box(
        out,
        'iron',
        [x - 0.018, sill, inner + 0.075],
        [x + 0.018, h - 0.048, inner + 0.12],
        tint.iron,
      );
    }
    box(
      out,
      'iron',
      [center - r + 0.04, bottom + 1.52, inner + 0.078],
      [center + r - 0.04, bottom + 1.56, inner + 0.13],
      tint.iron,
    );
  }
}

const nearProfile = [
  [0, 0.107],
  [0.07, 0.102],
  [0.15, 0.061],
  [0.27, 0.092],
  [0.38, 0.098],
  [0.53, 0.068],
  [0.69, 0.06],
  [0.77, 0.099],
];
const streetProfile = [
  [0, 0.106],
  [0.15, 0.065],
  [0.38, 0.103],
  [0.65, 0.06],
  [0.77, 0.097],
];
function railing(out, a, b, y, lod, stoneY) {
  box(out, 'carved', [a, y - 0.27, -1.37], [b, y - 0.13, 0.12], tint.shade);
  box(out, 'carved', [a, y - 0.12, -1.33], [b, y + 0.07, 0.19], tint.trim);
  box(out, 'carved', [a, y + 0.77, -0.89], [b, y + 0.91, -0.36], tint.trim);
  box(out, 'carved', [a, y + 0.9, -0.96], [b, y + 1.01, -0.27], tint.top);
  const density = lod === 2 ? 0.56 : 0.4;
  const count = Math.max(2, Math.round((b - a - 0.74) / density));
  const spacing = (b - a - 0.74) / count;
  const profile = lod === 2 ? streetProfile : nearProfile;
  const sides = lod === 2 ? 4 : 7;
  for (let i = 0; i < count; i++) {
    const x = a + 0.37 + (i + 0.5) * spacing;
    loft(
      out,
      'carved',
      profile.map(([dy, r]) => radialRing(y + dy, r, r, sides, [x, -0.63])),
      tint.trim,
      { cap: false },
    );
  }
  box(out, 'wall', [a - 0.18, stoneY, -1.36], [a + 0.22, y + 1.04, 0.19], tint.wall);
  box(out, 'carved', [a - 0.25, y + 0.98, -1.42], [a + 0.31, y + 1.12, 0.24], tint.top);
}

function wallRun(out, run, lod) {
  const { from, to, height } = run;
  const bays = lod === 0 ? Math.ceil(run.bays / 2) : run.bays;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const direction = -Math.atan2(dz, dx);
  const local = transform(out, direction, [from[0], 0, from[1]]);
  const step = length / bays;
  for (let i = 0; i < bays; i++) {
    const a = i * step;
    const b = (i + 1) * step;
    const middle = (a + b) / 2;
    const x = from[0] + (dx / length) * middle;
    const z = from[1] + (dz / length) * middle;
    const base = ground(x + Math.sin(direction) * 1.7, z + Math.cos(direction) * 1.7);
    const bottom = base - 0.53;
    const capY = base + height;
    const center = (a + b) / 2;
    if (lod < 2) {
      box(local, 'wall', [a, bottom, -1.35], [b, capY, 0.05], tint.wall);
      box(local, 'carved', [a, capY, -0.93], [b, capY + 0.16, -0.29], tint.trim);
      box(local, 'carved', [a, capY + 0.82, -0.91], [b, capY + 0.99, -0.31], tint.top);
      for (const x of [a + 0.14, center, b - 0.14]) {
        box(local, 'carved', [x - 0.115, capY, -0.81], [x + 0.115, capY + 0.84, -0.43], tint.trim);
      }
      if (lod === 1 && run.withNiches) {
        const spring = base + 1.91;
        const front = 0.058;
        const radius = 0.65;
        const p = [center, spring, front];
        face(
          local,
          'base',
          [
            [center - radius, base + 0.35, front],
            [center + radius, base + 0.35, front],
            [center + radius, spring, front],
            [center - radius, spring, front],
          ],
          tint.recess,
        );
        for (let j = 0; j < 7; j++) {
          const t = (j * Math.PI) / 7;
          const u = ((j + 1) * Math.PI) / 7;
          triangle(
            local,
            'base',
            [
              p,
              [center + radius * Math.cos(t), spring + radius * Math.sin(t), front],
              [center + radius * Math.cos(u), spring + radius * Math.sin(u), front],
            ],
            tint.recess,
          );
        }
      }
      continue;
    }
    box(local, 'base', [a, bottom, -1.28], [b, bottom + 0.64, 0.12], tint.stone);
    box(local, 'wall', [a, bottom + 0.46, -1.33], [b, capY - 0.13, -0.72], tint.wall);
    const color = shade(tint.wall, 0.97 + 0.033 * Math.cos(i * 1.9));
    if (run.withNiches) {
      const r = 0.66;
      const stoneFloor = bottom + 0.46;
      const shoulders = 0.02;
      box(local, 'wall', [a, stoneFloor, -0.75], [center - r, capY - 0.13, shoulders], color);
      box(local, 'wall', [center + r, stoneFloor, -0.75], [b, capY - 0.13, shoulders], color);
      archRecess(local, center, base, capY - 0.12, lod);
      box(local, 'wall', [center - r, stoneFloor, -0.58], [center + r, base + 0.12, 0.018], color);
      // Narrow trim across the sill emphasizes that the opening is a deep recess in a thick wall.
      if (lod > 1)
        box(
          local,
          'carved',
          [center - r - 0.14, base + 0.27, -0.48],
          [center + r + 0.14, base + 0.39, 0.095],
          tint.shade,
        );
    } else {
      box(local, 'wall', [a, bottom + 0.46, -0.74], [b, capY - 0.13, 0.02], color);
    }
    railing(local, a, b, capY, lod, stoneY(bottom));
    if (lod > 0)
      box(local, 'carved', [a - 0.06, capY - 0.31, -1.39], [b, capY - 0.24, 0.158], tint.top);
  }
  const tip = ground(...to);
  box(
    local,
    'wall',
    [length - 0.23, tip - 0.37, -1.35],
    [length + 0.22, tip + height + 1.03, 0.15],
    tint.wall,
  );
  box(
    local,
    'carved',
    [length - 0.28, tip + height + 0.98, -1.42],
    [length + 0.29, tip + height + 1.12, 0.21],
    tint.top,
  );
}
const stoneY = (floor) => floor + 0.08;

function build(out, lod) {
  for (const run of plan.section.wallRuns) wallRun(out, run, lod);
  const y = ground(0.64, -0.83);
  box(out, 'wall', [-0.13, y - 0.44, -2.39], [1.42, y + 4.74, -0.34], tint.wall);
  box(out, 'carved', [-0.22, y + 4.73, -2.48], [1.53, y + 4.95, -0.27], tint.top);
}
export const holyNameSkyline = (out) => build(out, 0);
export const holyNameDistrict = (out) => build(out, 1);
export const holyNameStreet = (out) => build(out, 2);
export const holyNameCloseup = (out) => build(out, 3);
const recipe = 'holy-name-cathedral-brisbane-model.mjs';
const camera = [86, 24, 109];
const lookAt = [47, 1.8, -9];
export const holyNameModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: holyNameCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The surviving Ann and Gotha Street sandstone walls, with round-headed recesses, square piers and continuous carved stone balustrades.',
  camera,
  lookAt,
  sunDirection: [-39, 60, 48],
  embeddedCanonicalGraphs: Object.values(surfaces).map(({ graph }) => graph),
  mediumFiContext: {
    scale: 1.35,
    cameraYaw: -0.48,
    focus: { center: [33, -3, -6] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'ann-street-and-gotha-return', position: camera, lookAt },
    {
      name: 'ann-street-recesses-and-turned-balusters',
      position: [20, 4.5, 25],
      lookAt: [28, 2.6, -0.7],
    },
    {
      name: 'gotha-street-return-and-corner-pier',
      position: [-35, 10, -20],
      lookAt: [4, 1.3, -18],
    },
    {
      name: 'registered-wall-strip-and-short-end-turn',
      position: [113, 26, 28],
      lookAt: [78, 2.8, -4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `holy-name-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'holyNameSkyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'holyNameDistrict', 0.36],
        ['street', 'holyNameStreet', 0.12],
        ['closeup', 'holyNameCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The reference photograph is CC0 from Queensland University of Technology. State heritage boundary and terrain from the Queensland Government; street context is OpenStreetMap ODbL 1.0.',
};
