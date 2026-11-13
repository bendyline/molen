/** Exterior of the Crossley Telescope Dome on Mount Hamilton in August 2019. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const { drum, entrance, annex } = plan;
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.93, metallic: 0 },
  dome: { slot: 'roof', graph: 'metal_painted', roughness: 0.68, metallic: 0.28 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.13 },
  steps: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.71, metallic: 0.11 },
};
const tint = Object.fromEntries(
  Object.entries({
    wall: 'd0c7b2',
    annex: 'c9bda6',
    band: 'dad5c7',
    shade: 'b7b0a1',
    paleMetal: 'd6d8d7',
    silver: 'ccd1d3',
    lightSilver: 'e0e1de',
    seam: 'b9c0c3',
    roof: '9f9e92',
    door: 'b3ad9a',
    glazing: '444744',
    rails: '736456',
    steps: '969181',
    shutter: 'cbd1d3',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const tau = 2 * Math.PI;
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    rows = terrain.heightsMeters;
  return (
    mix(
      mix(rows[j][i], rows[j][i + 1], u - i),
      mix(rows[j + 1][i], rows[j + 1][i + 1], u - i),
      v - j,
    ) - terrain.modelDatumElevationMeters
  );
}

function panel(out, slot, points, normal, color) {
  const n = normalFor(...points);
  const ordered =
    n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}
const circular = (angle, y, r) => [r * Math.sin(angle), y, r * Math.cos(angle)];
const direction = (angle) => [Math.sin(angle), 0, Math.cos(angle)];
function band(out, slot, sides, fromR, toR, fromY, toY, color) {
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides,
      b = (tau * (i + 1)) / sides;
    const low = (t) => (typeof fromY === 'function' ? fromY(t) : fromY);
    const normal = fromY === toY ? [0, 1, 0] : direction((a + b) / 2);
    panel(
      out,
      slot,
      [
        circular(a, low(a), fromR),
        circular(b, low(b), fromR),
        circular(b, toY, toR),
        circular(a, toY, toR),
      ],
      normal,
      color,
    );
  }
}

function skin(angle, latitude, offset = 0) {
  const r = (drum.domeRadius + offset) * Math.cos(latitude);
  return circular(angle, drum.eave + (drum.domeRise + offset) * Math.sin(latitude), r);
}

function cladding(out, lod) {
  const sides = [16, 26, 38, 48][lod],
    rows = [5, 8, 11, 14][lod];
  const high = Math.PI / 2;
  const gradeAtAngle = (angle) =>
    grade(drum.radius * Math.sin(angle), drum.radius * Math.cos(angle)) - 0.31;
  band(out, 'wall', sides, drum.radius, drum.radius, gradeAtAngle, drum.skirt, tint.wall);
  band(
    out,
    'wall',
    sides,
    drum.radius + 0.03,
    drum.domeRadius + 0.04,
    drum.skirt,
    drum.skirt + 0.12,
    tint.shade,
  );
  band(
    out,
    'wall',
    sides,
    drum.domeRadius + 0.04,
    drum.domeRadius + 0.04,
    drum.skirt + 0.12,
    drum.eave,
    tint.band,
  );
  for (let j = 0; j < rows; j++) {
    const low = (j * high) / rows,
      top = ((j + 1) * high) / rows;
    for (let i = 0; i < sides; i++) {
      const a = (i * tau) / sides,
        b = ((i + 1) * tau) / sides;
      const color =
        lod >= 1 && (i * 11 + j * 3) % 13 < 3
          ? tint.silver
          : lod >= 2 && (i + j * 5) % 11 < 2
            ? tint.lightSilver
            : tint.paleMetal;
      const corners = [skin(a, low), skin(b, low), skin(b, top)];
      if (j !== rows - 1) corners.push(skin(a, top));
      const normal = [
        Math.sin((a + b) / 2),
        0.64 + Math.sin((low + top) / 2),
        Math.cos((a + b) / 2),
      ];
      panel(out, 'dome', corners, normal, color);
      if (lod >= 2 && j > 0) {
        panel(
          out,
          'dome',
          [
            skin(a, low - 0.003, 0.016),
            skin(b, low - 0.003, 0.016),
            skin(b, low + 0.002, 0.016),
            skin(a, low + 0.002, 0.016),
          ],
          normal,
          tint.seam,
        );
      }
    }
  }
  const tracks = [0.81, 1.1];
  const segments = [4, 7, 11, 14][lod];
  for (let i = 0; i < segments; i++) {
    const low = 0.64 + (i * 0.83) / segments,
      top = 0.64 + ((i + 1) * 0.83) / segments;
    panel(
      out,
      'dome',
      [
        skin(tracks[0], low, 0.034),
        skin(tracks[1], low, 0.034),
        skin(tracks[1], top, 0.034),
        skin(tracks[0], top, 0.034),
      ],
      [0.6, 1, 0.4],
      tint.shutter,
    );
    if (lod >= 1)
      for (const a of tracks) {
        panel(
          out,
          'dome',
          [
            skin(a - 0.01, low, 0.076),
            skin(a + 0.01, low, 0.076),
            skin(a + 0.01, top, 0.076),
            skin(a - 0.01, top, 0.076),
          ],
          [0.6, 1, 0.4],
          tint.seam,
        );
      }
  }
  box(
    out,
    'dome',
    [-0.79, drum.eave + drum.domeRise - 0.023, -0.2],
    [1.02, drum.eave + drum.domeRise + 0.139, 0.22],
    tint.shutter,
  );
  if (lod >= 2)
    beam(out, 'detail', [-0.82, 12.026, 0.05], [1.04, 12.026, 0.05], 0.065, 0.066, tint.silver);
}

function footprint(out, ring, height, color) {
  const roof = ring.map(([x, z]) => [x, height(x, z), z]);
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    panel(
      out,
      'roof',
      triangles.slice(i, i + 3).map((j) => roof[j]),
      [0, 1, 0],
      tint.roof,
    );
  }
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const next = (i + 1) % ring.length;
    const a = ring[i],
      b = ring[next],
      direction = Math.sign(area);
    panel(
      out,
      'wall',
      [[a[0], grade(...a) - 0.29, a[1]], [b[0], grade(...b) - 0.29, b[1]], roof[next], roof[i]],
      [direction * (b[1] - a[1]), 0, direction * (a[0] - b[0])],
      color,
    );
  }
}

function volumes(out, lod) {
  const entry = entrance.indices.map((i) => outline[i]);
  const [backRight, frontRight, frontLeft, backLeft] = entry;
  const center = (frontLeft[0] + frontRight[0]) / 2;
  const front = frontLeft[1],
    back = Math.min(backLeft[1], backRight[1]);
  const ridgeBack = [center, back],
    ridgeFront = [center, front];
  const slope = (x) =>
    entrance.eave +
    (entrance.ridge - entrance.eave) *
      Math.max(0, 1 - Math.abs(x - center) / ((frontRight[0] - frontLeft[0]) / 2));
  footprint(out, [frontLeft, ridgeFront, ridgeBack, backLeft], slope, tint.annex);
  footprint(out, [ridgeFront, frontRight, backRight, ridgeBack], slope, tint.annex);
  const side = annex.indices.map((i) => outline[i]);
  footprint(
    out,
    side,
    (x) => mix(annex.outerRoof, annex.innerRoof, Math.max(0, Math.min(1, (x + 10.1) / 6))),
    tint.annex,
  );
  const d = 0.67,
    z = front + 0.046,
    sill = entrance.doorThreshold;
  box(
    out,
    'detail',
    [center - d - 0.105, sill - 0.03, z - 0.075],
    [center + d + 0.105, sill + 2.29, z + 0.026],
    tint.shade,
  );
  box(out, 'detail', [center - d, sill, z - 0.01], [center + d, sill + 2.19, z + 0.046], tint.door);
  if (lod >= 1) {
    box(
      out,
      'detail',
      [center - 0.46, sill + 1.08, z + 0.04],
      [center + 0.46, sill + 2.0, z + 0.058],
      tint.glazing,
    );
    box(
      out,
      'detail',
      [center - 0.025, sill + 1.08, z + 0.058],
      [center + 0.025, sill + 2.0, z + 0.076],
      tint.band,
    );
    box(
      out,
      'detail',
      [center - 0.46, sill + 1.51, z + 0.058],
      [center + 0.46, sill + 1.56, z + 0.076],
      tint.band,
    );
  }
  const length = 1.92,
    steps = [3, 4, 5, 5][lod],
    half = 0.98;
  const pathGrade = grade(center, z + length) - 0.15;
  for (let i = 0; i < steps; i++) {
    const end = z + (length * (steps - i)) / steps;
    const top = mix(pathGrade + 0.15, sill, (i + 1) / steps);
    box(
      out,
      'steps',
      [center - half, Math.min(pathGrade, grade(center, end)) - 0.21, z - 0.01],
      [center + half, top, end],
      tint.steps,
    );
  }
  if (lod >= 1) {
    const x = center + half - 0.07;
    const a = [x, sill + 0.82, z + 0.13],
      b = [x, pathGrade + 0.9, z + length - 0.12];
    beam(out, 'detail', a, b, 0.052, 0.052, tint.rails);
    for (const p of [a, b])
      beam(out, 'detail', p, [p[0], p[1] - 0.78, p[2]], 0.042, 0.042, tint.rails);
  }
}

function sash(out, angle, lod) {
  const position = (u, y, r) => [
    r * Math.sin(angle) + u * Math.cos(angle),
    y,
    r * Math.cos(angle) - u * Math.sin(angle),
  ];
  const panelAt = (half, low, top, r, color) =>
    panel(
      out,
      'detail',
      [
        position(-half, low, r),
        position(half, low, r),
        position(half, top, r),
        position(-half, top, r),
      ],
      direction(angle),
      color,
    );
  panelAt(0.4, 2.53, 4.82, drum.radius + 0.052, tint.band);
  panelAt(0.31, 2.65, 4.71, drum.radius + 0.077, tint.glazing);
  if (lod >= 1) panelAt(0.31, 3.65, 3.72, drum.radius + 0.096, tint.shade);
}

function build(out, lod) {
  cladding(out, lod);
  volumes(out, lod);
  sash(out, 1.32, lod);
}
export const crossleySkyline = (out) => build(out, 0);
export const crossleyDistrict = (out) => build(out, 1);
export const crossleyStreet = (out) => build(out, 2);
export const crossleyCloseup = (out) => build(out, 3);
const recipe = 'crossley-telescope-model.mjs';
const camera = [27, 15, 34],
  lookAt = [-1.0, 4.8, 1.0];
export const crossleyModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: crossleyCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Crossley Telescope Dome at Lick Observatory, with its segmented metal hemisphere, round stucco drum and two projecting volumes on the original Mount Hamilton slope.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-16, 30, 32],
  mediumFiContext: {
    scale: 1.05,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The mapped round dome footprint and its two attached volumes.',
  },
  embeddedCanonicalGraphs: ['stucco', 'metal_painted', 'metal_standing_seam', 'concrete_plain'],
  qaCameras: [
    { name: 'northwest-approach-and-dome', position: [7.2, 4.6, 28.5], lookAt: [0, 4.35, 3.6] },
    { name: 'metal-dome-and-shutter', position: [21, 19, -17], lookAt: [0, 7.3, 0] },
    {
      name: 'side-sash-annex-and-hillside',
      position: [-24, 8.2, -14.4],
      lookAt: [-3.4, 4.2, -1.1],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-dome-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'crossleySkyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'crossleyDistrict', 0.34],
        ['street', 'crossleyStreet', 0.12],
        ['closeup', 'crossleyCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The footprint is ODbL. The exact Qualla photo by Thomson200 is CC0.',
};
