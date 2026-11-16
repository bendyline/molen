/** Exterior of Toyo Ito's National Taichung Theater and its plaza-facing concrete folds. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const d = outline[2].map((v, i) => v - outline[3][i]);
const angle = Math.atan2(d[1], d[0]);
const c = Math.cos(angle),
  s = Math.sin(angle);
const at = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const halfWidth = Math.hypot(...d) / 2;
const halfDepth = Math.hypot(...outline[1].map((v, i) => v - outline[2][i])) / 2;
const H = plan.section.mainShellHeight;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  shell: { slot: 'wall', graph: 'concrete_plain', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.58, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.39, metallic: 0.17 },
  planting: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const tones = {
  gray: rgb('a6a7a2'),
  seam: rgb('999c97'),
  shell: rgb('dddcd0'),
  roof: rgb('bcbcb1'),
  mold: rgb('d6d5cb'),
  deepMold: rgb('c7c7ba'),
  glass: rgb('4b6267'),
  glassLight: rgb('687d80'),
  mullion: rgb('35494e'),
  dark: rgb('303c42'),
  grass: rgb('757852'),
  pavement: rgb('b1b0a3'),
};

function plane(out, slot, points, normal, color) {
  const facing = normalFor(...points).reduce((sum, n, i) => sum + n * normal[i], 0) > 0;
  face(out, slot, facing ? points : points.toReversed(), color);
}

const mix = (a, b, t) => a + (b - a) * t;
const levels = [
  [0, 1],
  [0.09, 0.95],
  [0.19, 0.77],
  [0.29, 0.56],
  [0.44, 0.46],
  [0.58, 0.5],
  [0.67, 0.67],
  [0.77, 0.95],
  [0.83, 1],
  [0.9, 0.88],
  [0.97, 0.61],
  [1, 0.53],
];

function apertureWidth(t) {
  for (let i = 1; i < levels.length; i++) {
    const [finish, right] = levels[i];
    if (t <= finish) {
      const [start, left] = levels[i - 1],
        u = (t - start) / (finish - start);
      return mix(left, right, u * u * (3 - 2 * u));
    }
  }
  return levels.at(-1)[1];
}

const frontage = [
  { x: -42.5, w: 10.8, tilt: 1.5, inset: 0.74 },
  { x: -9, w: 17.3, tilt: -1.8, inset: 0.83 },
  { x: 30.8, w: 18.1, tilt: 1.8, inset: 8.55, entry: true },
];
const back = [
  { x: -29, w: 15.6, tilt: 1.8, inset: 1.43 },
  { x: 20, w: 17.1, tilt: -3.2, inset: 1.25 },
];
const flank = [{ x: 4, w: 13.2, tilt: 1.25, inset: 1.14 }];
const spring = H - 0.3;
function opening(bay, t) {
  const x = bay.x + bay.tilt * (t - 0.5);
  const w = apertureWidth(t) * bay.w;
  return [x - w, x + w];
}

function windowBars(out, p, normal, bay, lod) {
  const columns = lod === 1 ? 4 : lod === 2 ? 7 : 10;
  const rows = lod === 1 ? 5 : lod === 2 ? 9 : 12;
  // Refer bars to the glazed face. The reveal covers their clipped ends.
  const depth = bay.inset - 0.052;
  const panel = (u0, u1, t0, t1) => {
    const [la, ra] = opening(bay, t0),
      [lb, rb] = opening(bay, t1);
    return [
      p(mix(la, ra, u0), t0 * spring, depth),
      p(mix(la, ra, u1), t0 * spring, depth),
      p(mix(lb, rb, u1), t1 * spring, depth),
      p(mix(lb, rb, u0), t1 * spring, depth),
    ];
  };
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    plane(out, 'metal', panel(0.008, 0.992, t, t + 0.004), normal, tones.mullion);
  }
  // Vertical mullions stay straight and terminate where the curved reveal narrows.
  const xAt = (i) => bay.x - bay.w * 0.94 + (1.88 * bay.w * i) / columns;
  for (let j = 1; j < columns; j++) {
    const x = xAt(j),
      sampleCount = rows + 4;
    for (let i = 0; i < sampleCount; i++) {
      const a = i / sampleCount,
        b = (i + 1) / sampleCount;
      const [la, ra] = opening(bay, a),
        [lb, rb] = opening(bay, b);
      const left = Math.max(x - 0.05, la + 0.03, lb + 0.03);
      const right = Math.min(x + 0.05, ra - 0.03, rb - 0.03);
      if (left >= right) continue;
      plane(
        out,
        'metal',
        [
          p(left, a * spring, depth),
          p(right, a * spring, depth),
          p(right, b * spring, depth),
          p(left, b * spring, depth),
        ],
        normal,
        tones.mullion,
      );
    }
  }
}

function elevation(out, p, normal, width, bays, lod, litFace) {
  const count = [8, 16, 24, 34][lod];
  const solid = (a, b, u, v, slot = 'concrete', color = tones.gray, offset = 0) =>
    plane(
      out,
      slot,
      [p(a[0], u, offset), p(a[1], u, offset), p(b[1], v, offset), p(b[0], v, offset)],
      normal,
      color,
    );
  for (let row = 0; row < count; row++) {
    const t0 = row / count,
      t1 = (row + 1) / count,
      u = spring * t0,
      v = spring * t1;
    let last = [-width, -width];
    for (const bay of bays) {
      const a = opening(bay, t0),
        b = opening(bay, t1);
      solid([last[0], a[0]], [last[1], b[0]], u, v);
      last = [a[1], b[1]];
      if (!bay.entry) {
        solid(a, b, u, v, 'glass', litFace ? tones.glass : tones.glassLight, bay.inset);
      } else {
        const inset = bay.inset;
        const caveLow = (t) => Math.min(t * 0.86 + 0.1, 0.85);
        // The wall funnels toward a lower recessed entry and an upper shadowed opening.
        const inner = (edge, t) => {
          const z = inset * (0.95 - 0.38 * Math.sin(Math.PI * t));
          return p(mix(edge, bay.x, 0.46), spring * caveLow(t), z);
        };
        const lower = [inner(a[0], t0), inner(a[1], t0)];
        const upper = [inner(b[0], t1), inner(b[1], t1)];
        plane(
          out,
          'shell',
          [lower[0], lower[1], upper[1], upper[0]],
          normal,
          row < count * 0.13 ? tones.glass : tones.shell,
        );
      }
      for (const k of [0, 1]) {
        const direction = k === 0 ? 1 : -1;
        const inner = (edge, t) => {
          if (!bay.entry) return p(edge + direction * 0.05, t * spring, bay.inset);
          const z = bay.inset * (0.95 - 0.38 * Math.sin(Math.PI * t));
          return p(mix(edge, bay.x, 0.46), spring * Math.min(t * 0.86 + 0.1, 0.85), z);
        };
        const lip = [p(a[k], u, 0.04), p(b[k], v, 0.04)];
        const reveal = [inner(a[k], t0), inner(b[k], t1)];
        const revealNormal =
          k === 0
            ? [p(1, 0, 0)[0] - p(0, 0, 0)[0], 0, p(1, 0, 0)[2] - p(0, 0, 0)[2]]
            : [p(0, 0, 0)[0] - p(1, 0, 0)[0], 0, p(0, 0, 0)[2] - p(1, 0, 0)[2]];
        if (!bay.entry || lod === 0) {
          plane(
            out,
            'shell',
            [...lip, reveal[1], reveal[0]],
            bay.entry ? normal : revealNormal,
            tones.shell,
          );
        } else {
          const middle = (index) =>
            lip[index].map((value, axis) =>
              mix(value, reveal[index][axis], axis === 1 ? 0.28 : 0.47),
            );
          const m0 = middle(0),
            m1 = middle(1);
          plane(out, 'shell', [...lip, m1, m0], normal, tones.mold);
          plane(out, 'shell', [m0, m1, reveal[1], reveal[0]], normal, tones.deepMold);
        }
        const rimWidth = lod === 0 ? 0.24 : 0.33;
        const edgeA = [
          Math.min(a[k], a[k] - direction * rimWidth),
          Math.max(a[k], a[k] - direction * rimWidth),
        ];
        const edgeB = [
          Math.min(b[k], b[k] - direction * rimWidth),
          Math.max(b[k], b[k] - direction * rimWidth),
        ];
        solid(edgeA, edgeB, u, v, 'shell', tones.mold, -0.027);
      }
    }
    solid([last[0], width], [last[1], width], u, v);
  }
  solid([-width, width], [-width, width], spring, H);
  if (lod >= 1) for (const bay of bays) if (!bay.entry) windowBars(out, p, normal, bay, lod);
}

function roofGarden(out, lod) {
  box(
    out,
    'roof',
    [-halfWidth, H - 0.09, -halfDepth],
    [halfWidth, H + 0.09, halfDepth],
    tones.roof,
  );
  const levels = [
    [-34, -7, 15.9, 11.3, 3.2],
    [4, -12, 12.6, 9.7, 2],
    [36, 13.9, 18.3, 13.5, plan.section.overallHeight - H],
  ];
  for (const [x, z, sx, sz, h] of levels) {
    const n = [9, 14, 20, 28][lod];
    const ring = (y, scale) => radialRing(y, sx * scale, sz * scale, n, [x, z]);
    loft(out, 'shell', [ring(H, 1), ring(H + h * 0.52, 0.91), ring(H + h, 0.73)], tones.gray);
    if (lod > 0 && H + h + 0.38 < plan.section.overallHeight) {
      loft(out, 'planting', [ring(H + h + 0.04, 0.53), ring(H + h + 0.38, 0.38)], tones.grass);
    }
  }
  if (lod > 0) {
    for (const x of [-35, -8, 17, 45]) {
      loft(
        out,
        'planting',
        [radialRing(H + 0.1, 7, 3.8, 12, [x, -23]), radialRing(H + 0.34, 6.3, 3.25, 12, [x, -23])],
        tones.grass,
      );
    }
  }
}

function build(out, lod) {
  const shell = transform(out, -angle);
  box(shell, 'roof', [-halfWidth, -5.9, -halfDepth], [halfWidth, 0.11, halfDepth], tones.pavement);
  elevation(shell, (x, y, z) => [x, y, halfDepth - z], [0, 0, 1], halfWidth, frontage, lod, true);
  elevation(shell, (x, y, z) => [-x, y, -halfDepth + z], [0, 0, -1], halfWidth, back, lod, false);
  elevation(shell, (x, y, z) => [halfWidth - z, y, -x], [1, 0, 0], halfDepth, flank, lod, false);
  elevation(shell, (x, y, z) => [-halfWidth + z, y, x], [-1, 0, 0], halfDepth, flank, lod, false);
  roofGarden(shell, lod);
}

export const theaterSkyline = (out) => build(out, 0);
export const theaterDistrict = (out) => build(out, 1);
export const theaterStreet = (out) => build(out, 2);
export const theaterCloseup = (out) => build(out, 3);
const camera = at(119, 62, 156),
  lookAt = at(0, 13.7, 0);
const recipe = 'national-taichung-theater-model.mjs';
export const theaterModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'structure-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: theaterCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Toyo Ito’s National Taichung Theater with curving concrete walls, hourglass glazing, a recessed plaza entrance and roof gardens.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: at(-42, 54, 130),
  portableGroundY: -0.18,
  mediumFiContext: {
    scale: 1.05,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.88,
    basis: 'The named National Taichung Theater mapped building perimeter.',
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'plaza-curved-concrete-and-glass', position: at(65, 12, 121), lookAt: at(0, 15.9, 30) },
    {
      name: 'white-catenoid-at-the-east-entrance',
      position: at(45, 14, 74),
      lookAt: at(30, 15.6, 32),
    },
    { name: 'roof-garden-and-clerestory-form', position: at(-59, 80, 70), lookAt: at(4, 25, 6) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `taichung-theater-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'theaterSkyline',
    errorMeters: 0.81,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'theaterDistrict', 0.43],
        ['street', 'theaterStreet', 0.2],
        ['closeup', 'theaterCloseup', 0.052],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap map data is ODbL. The exact Qualla photo is CC0 own work credited to Theserious.',
};
