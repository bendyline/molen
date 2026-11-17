/** The historic brick sanctuary and west assembly hall at Matabari, Udaipur. */
import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline, hallOutline, porchOutline] = read('map-frame').geometry.polygons;
const [a, b] = outline.slice(1, 3);
const [dx, dz] = a.map((value, i) => value - b[i]);
const angle = Math.atan2(dz, dx);
const c = Math.cos(angle);
const s = Math.sin(angle);
const at = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const local = ([x, z]) => [c * x + s * z, -s * x + c * z];
const surface = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  plinth: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  brass: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.12 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89, metallic: 0 },
};
const tone = {
  red: rgb('a3463b'),
  roof: rgb('ab5544'),
  shadow: rgb('783b32'),
  course: rgb('ba6250'),
  stone: rgb('ab9582'),
  hall: rgb('dfd7c1'),
  hallTrim: rgb('ece0c8'),
  hallRoof: rgb('aaa393'),
  opening: rgb('54443c'),
  wood: rgb('784b37'),
  brass: rgb('c49b54'),
};
const { sanctuaryWidth, crownHeight, plinthHeight, mainRoofSpring, crownSpring } = plan.section;
const half = sanctuaryWidth / 2;
const fromRect = (r, y) => [
  [r[0], y, r[2]],
  [r[0], y, r[3]],
  [r[1], y, r[3]],
  [r[1], y, r[2]],
];
const centered = (h) => [-h, h, -h, h];
const solid = (out, slot, r, y0, y1, color) =>
  box(out, slot, [r[0], y0, r[2]], [r[1], y1, r[3]], color);
const profile = (out, slot, pairs, color) =>
  loft(
    out,
    slot,
    pairs.map(([y, r]) => fromRect(centered(r), y)),
    color,
    { cap: false },
  );

function arch(out, { x, z, base, spring, radius, frame, axis, exterior, pier }, lod) {
  const make = (u, y, depth = 0) =>
    axis === 'west' ? [x - depth, y, z + u] : [x + u, y, z - depth];
  const normal = axis === 'west' ? [-1, 0, 0] : [0, 0, -1];
  const face = (slot, p, color) =>
    quad(out, slot, axis === 'west' ? p : p.toReversed(), normal, color);
  const count = [6, 8, 12, 16][lod];
  const point = (r, f, depth) => make(r * Math.cos(f), spring + r * Math.sin(f), depth);
  const inner = radius - frame;
  face(
    'recess',
    [
      make(-inner, base, 0.014),
      make(inner, base, 0.014),
      make(inner, spring, 0.014),
      make(-inner, spring, 0.014),
    ],
    tone.opening,
  );
  for (let i = 0; i < count; i++) {
    const t0 = (Math.PI * i) / count,
      t1 = (Math.PI * (i + 1)) / count;
    const p = [make(0, spring, 0.015), point(inner, t0, 0.015), point(inner, t1, 0.015)];
    out.addTriangle(
      'recess',
      'palette:#ffffff',
      axis === 'west' ? p : p.toReversed(),
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tone.opening,
    );
    face(
      pier,
      [
        point(radius, t0, 0.042),
        point(radius, t1, 0.042),
        point(inner, t1, 0.042),
        point(inner, t0, 0.042),
      ],
      exterior,
    );
  }
  for (const side of [-1, 1]) {
    const i = side < 0 ? -radius : inner;
    face(
      pier,
      [
        make(i, base, 0.042),
        make(i + frame, base, 0.042),
        make(i + frame, spring, 0.042),
        make(i, spring, 0.042),
      ],
      exterior,
    );
  }
}

function curvedRoof(out, lod) {
  const count = [2, 6, 8, 10][lod];
  const rows = lod ? [0, 0.19, 0.42, 0.66, 0.84, 1] : [0, 0.3, 0.65, 1];
  const roofRing = (t) => {
    const w = 4.52 - 2.46 * t;
    const y = mainRoofSpring + (crownSpring - mainRoofSpring) * (2 * t - t * t);
    const corners = fromRect(centered(w), y);
    return corners.flatMap((p, i) => {
      const q = corners[(i + 1) % corners.length];
      return Array.from({ length: count }, (_, step) => {
        const u = step / count;
        return [
          p[0] * (1 - u) + q[0] * u,
          y + Math.sin(Math.PI * u) * (1 - t) * 1.35,
          p[2] * (1 - u) + q[2] * u,
        ];
      });
    });
  };
  const roof = rows.map(roofRing);
  const soffit = roof[0].map(([x, , z]) => [x * 0.79, 9.61, z * 0.79]);
  loft(out, 'roof', [soffit, ...roof], tone.roof, { cap: false });
  const circle = (y, r, petal = false) => {
    const n = [8, 16, 24, 32][lod];
    return radialRing(y, r, r, n).map(([x, h, z], i) =>
      petal && i % 2 ? [x * 0.927, h - 0.07, z * 0.927] : [x, h, z],
    );
  };
  const dome = [
    [crownSpring - 0.36, 3.38],
    [crownSpring + 0.14, 3.12],
    [15.1, 2.79],
    [16.25, 2.56],
    [17.45, 2.13],
    [18.71, 1.54],
    [19.58, 0.96],
    [20.27, 0.55],
    [20.58, 0.49],
  ];
  loft(
    out,
    'roof',
    (lod ? dome : dome.filter((_, i) => i % 2 === 0)).map(([y, r]) => circle(y, r)),
    tone.roof,
  );
  loft(
    out,
    'wall',
    [circle(14.18, 3.21), circle(14.41, 3.23, lod > 0), circle(14.78, 2.91)],
    tone.course,
    { cap: false },
  );
  const pots = [1, 4, 7, 7][lod];
  const rim = [
    [20.51, 0.58],
    [20.67, 0.53],
  ];
  for (let i = 0; i < pots; i++) {
    const h = 20.73 + (1.62 * i) / pots,
      r = 0.36 - (i * 0.2) / pots;
    rim.push([h, r * 0.58], [h + 0.065, r], [h + 0.14, r * 0.68]);
  }
  rim.push([22.51, 0.07], [crownHeight, 0.026]);
  loft(
    out,
    'brass',
    rim.map(([y, r]) => circle(y, r)),
    tone.brass,
  );
}

function sanctuary(out, lod) {
  solid(out, 'plinth', centered(4.26), -1.53, plinthHeight - 0.19, tone.stone);
  solid(out, 'plinth', centered(4.13), plinthHeight - 0.26, plinthHeight, tone.hallRoof);
  solid(out, 'wall', centered(half), plinthHeight, 9.72, tone.red);
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      solid(out, 'wall', [x - 0.34, x + 0.34, z - 0.34, z + 0.34], plinthHeight, 9.69, tone.course);
      if (lod >= 1) {
        const points = [
          [9.6, 0.53],
          [9.8, 0.55],
          [10.11, 0.37],
          [10.47, 0.24],
        ];
        loft(
          out,
          'wall',
          points.map(([y, r]) => radialRing(y, r, r, lod === 1 ? 6 : 10, [x, z])),
          tone.course,
        );
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    if (lod === 0 && i % 2 === 1) continue;
    const h = 1.74 + 1.18 * i;
    // Stop the north and west courses at the low doorway heads.
    const r = half + 0.11;
    const walls = [
      [r - 0.21, r, -r, r],
      [-r, r, r - 0.21, r],
    ];
    if (h > 3.8) walls.push([-r, -r + 0.21, -r, r], [-r, r, -r, -r + 0.21]);
    else
      walls.push(
        [-r, -r + 0.21, -r, -1.09],
        [-r, -r + 0.21, 1.09, r],
        [-r, -1.09, -r, -r + 0.21],
        [1.09, r, -r, -r + 0.21],
      );
    for (const ring of walls) solid(out, 'wall', ring, h, h + 0.105, tone.course);
  }
  profile(
    out,
    'wall',
    [
      [8.97, half],
      [9.19, 4.03],
      [9.34, 4.12],
      [9.57, 4.51],
      [9.66, 4.52],
    ],
    tone.course,
  );
  arch(
    out,
    {
      x: -half,
      z: 0,
      base: 1.04,
      spring: 2.92,
      radius: 1.02,
      frame: 0.12,
      axis: 'west',
      exterior: tone.brass,
      pier: 'brass',
    },
    lod,
  );
  arch(
    out,
    {
      x: 0,
      z: -half,
      base: 1.04,
      spring: 2.65,
      radius: 0.91,
      frame: 0.115,
      axis: 'north',
      exterior: tone.shadow,
      pier: 'wall',
    },
    lod,
  );
  if (lod >= 2) {
    solid(out, 'recess', [-0.64, 0.63, -3.726, -3.67], 1.05, 2.03, tone.wood);
    solid(out, 'wall', [3.66, 3.75, -0.58, 0.58], 3.65, 4.19, tone.shadow);
  }
  curvedRoof(out, lod);
}

function boundsFor(points) {
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}
const hall = boundsFor(hallOutline.map(local));
const porch = boundsFor(porchOutline.map(local));
function assembly(out, lod) {
  const [x0, , z0, z1] = hall;
  const z = (z0 + z1) / 2;
  solid(out, 'plinth', [x0, -3.53, z0, z1], -0.32, 1.22, tone.stone);
  solid(out, 'wall', [x0 + 0.09, -3.56, z0 + 0.09, z1 - 0.09], 0.74, 6.36, tone.hall);
  solid(out, 'roof', [x0 - 0.22, -3.37, z0 - 0.18, z1 + 0.18], 6.21, 6.51, tone.hallRoof);
  solid(out, 'wall', [x0 - 0.09, -3.42, z0 - 0.03, z1 + 0.03], 6.51, 6.7, tone.hallTrim);
  // The lower porch contains a row of bays, leaving the west approach visibly open.
  const [p0, , q0, q1] = porch;
  solid(out, 'plinth', [p0 - 0.19, x0 + 0.15, q0, q1], 0.28, 1.25, tone.stone);
  solid(out, 'roof', [p0 - 0.25, x0 + 0.21, q0 - 0.18, q1 + 0.18], 4.24, 4.59, tone.hallRoof);
  for (const f of [0.04, 0.34, 0.66, 0.96]) {
    const p = q0 + f * (q1 - q0);
    for (const x of [p0 + 0.22, p0 + 4.18])
      solid(out, 'wall', [x - 0.19, x + 0.19, p - 0.2, p + 0.2], 1.25, 4.27, tone.hallTrim);
  }
  arch(
    out,
    {
      x: x0 + 0.083,
      z,
      base: 1.24,
      spring: 2.19,
      radius: 1.26,
      frame: 0.15,
      axis: 'west',
      exterior: tone.hallTrim,
      pier: 'wall',
    },
    lod,
  );
  for (let i = 0; i < 4; i++) {
    if (lod === 0 && i % 2 === 1) continue;
    const x = x0 + 2.32 + i * 3.0;
    arch(
      out,
      {
        x,
        z: z0 + 0.085,
        base: 1.62,
        spring: 3.07,
        radius: 0.67,
        frame: 0.11,
        axis: 'north',
        exterior: tone.hallTrim,
        pier: 'wall',
      },
      lod,
    );
    solid(out, 'wall', [x - 0.74, x + 0.74, z0 - 0.15, z0 + 0.1], 1.53, 1.64, tone.hallTrim);
  }
  const stepCount = lod === 0 ? 2 : 4;
  const tread = 1.42 / stepCount;
  for (let i = 0; i < stepCount; i++) {
    const x = p0 - 0.12 - tread * i;
    solid(
      out,
      'plinth',
      [x - tread, x, q0 + 0.4, q1 - 0.4],
      0.31,
      1.25 - (0.42 * (i + 1)) / stepCount,
      tone.stone,
    );
  }
}

function build(out, detail) {
  const aligned = transform(out, -angle);
  sanctuary(aligned, detail);
  assembly(aligned, detail);
}
export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);
const camera = at(-44, 31, -25);
const lookAt = at(-10, 8.8, 0);
const recipe = 'tripura-sundari-temple-model.mjs';
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'structure-mesh.mjs'],
  surfaces: surface,
  category: 'landmark',
  build: templeCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Tripura Sundari’s historic red sanctuary with a curving Bengali roof, tall finial and lower west assembly hall.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: at(-25, 32, -19),
  portableGroundY: -2.2,
  mediumFiContext: {
    scale: 0.95,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.88,
    basis: 'Approximate mapped roof of the historic sanctuary.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'metal_painted'],
  qaCameras: [
    {
      name: 'north-approach-and-red-sanctuary',
      position: at(-31, 10, -23),
      lookAt: at(-10, 8.8, -0.4),
    },
    { name: 'roof-and-finial-from-northeast', position: at(17, 23, -17), lookAt: at(0, 13.3, 0) },
    { name: 'west-portico-and-assembly', position: at(-38, 6, -10), lookAt: at(-15, 3.0, 0) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `matabari-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 0.43,
    surfaces: surface,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'templeDistrict', 0.2],
        ['street', 'templeStreet', 0.09],
        ['closeup', 'templeCloseup', 0.039],
      ].map(([level, name, errorMeters]) => [
        level,
        { export: name, errorMeters, surfaces: surface },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap and Overture map geometry are used under their source terms. The exact Qualla photo is CC0 own work by Apurv013.',
};
