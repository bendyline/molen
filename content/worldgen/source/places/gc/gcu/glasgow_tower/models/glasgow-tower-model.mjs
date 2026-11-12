/** Glasgow Tower at Pacific Quay. The upper assembly has a fixed preview bearing. */
import fs from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const section = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const surfaces = {
  cladding: { slot: 'wall', graph: 'metal_stainless_beadblasted', roughness: 0.58, metallic: 0.34 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.22 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.66, metallic: 0.3 },
  concrete: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metallic: 0.1 },
};
const color = Object.fromEntries(
  Object.entries({
    shaft: 'aeb7b7',
    fin: '899593',
    cross: '818c8b',
    ladder: '697677',
    bracket: 'abb0a9',
    collar: '878781',
    coping: 'a4a39c',
    base: '777770',
    cabin: '909b9d',
    roof: '8d9b9e',
    lip: '647275',
    glass: '34484f',
    glassShade: '46565b',
    steel: 'aab2ae',
    seam: '8c9898',
    antenna: '676f6e',
    red: 'b74432',
    white: 'd6d0b9',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function localGround(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

function base(out, lod) {
  const count = [12, 20, 30, 60][lod],
    r = section.baseRadius;
  const ring = (height, scale) =>
    Array.from({ length: count }, (_, i) => {
      const [x, z] = outline[(i * 60) / count];
      return [x * scale, height, z * scale];
    }).reverse();
  const rim = ring(section.baseRoof, 1);
  const feet = rim.map(([x, , z]) => [x, Math.min(-0.24, localGround(x, z) - 0.26), z]);
  loft(out, 'concrete', [feet, rim], color.base, { cap: false });
  loft(
    out,
    'concrete',
    [ring(section.baseRoof, 1), ring(section.baseRoof + 0.22, 0.98)],
    color.coping,
  );
  loft(
    out,
    'frame',
    [
      radialRing(0.78, r * 0.72, r * 0.72, count),
      radialRing(0.96, r * 0.67, r * 0.67, count),
      radialRing(1.24, r * 0.6, r * 0.6, count),
    ],
    color.collar,
  );
  if (lod >= 2) {
    const rail = (y) => radialRing(y, r * 0.946, r * 0.946, count);
    const low = rail(0.76),
      top = rail(1.68);
    for (let i = 0; i < count; i++) {
      if (i % (lod === 3 ? 3 : 2) === 0) {
        beam(out, 'frame', low[i], top[i], 0.071, 0.071, color.steel);
      }
      beam(out, 'frame', top[i], top[(i + 1) % count], 0.053, 0.055, color.steel);
    }
  }
}

function outriggerCenter(part, y) {
  const t = Math.max(0, Math.min(1, (y - 0.8) / 33));
  const curve = t * (2 - t);
  return part.root.map((value, i) => value + (part.upper[i] - value) * curve);
}
function outrigger(out, part, lod) {
  const rings = lod >= 2 ? [0.9, 3, 7, 12, 18, 24, 31, 45, 76, 103.75] : [0.9, 10, 20, 33, 103.75];
  const profile = rings.map((y) => {
    const taper = y < 18 ? 1.04 : y > 103 ? 0.83 : 0.93;
    return radialRing(
      y,
      part.radiusX * taper,
      part.radiusZ * taper,
      [5, 8, 12, 16][lod],
      outriggerCenter(part, y),
      Math.PI / 8,
    );
  });
  loft(out, 'cladding', profile, color.fin);
}

function shaft(out, lod) {
  const shaft = section.stairShaft;
  const count = [8, 12, 20, 24][lod];
  const ring = (y, scale = 1) =>
    radialRing(
      y,
      shaft.radiusX * scale,
      shaft.radiusZ * scale,
      count,
      shaft.center,
      Math.PI / count,
    );
  const levels =
    lod < 2 ? [1.03, 102.8, shaft.top] : [1.03, 16.4, 34.5, 52.8, 71, 89.2, 102.8, shaft.top];
  loft(
    out,
    'cladding',
    levels.map((y, i) => ring(y, i === levels.length - 1 ? 0.81 : 1)),
    color.shaft,
  );
  if (lod >= 2) {
    const seams = lod === 3 ? section.braceHeights.slice(0, -2) : [24.3, 48.6, 73.0, 97.4];
    for (const y of seams) {
      loft(out, 'frame', [ring(y - 0.03, 1.004), ring(y + 0.035, 1.004)], color.seam, {
        cap: false,
      });
    }
  }
}

function bracing(out, lod) {
  const parts = [section.visibleOutrigger, section.rearOutrigger];
  const heights = lod ? section.braceHeights : section.braceHeights.filter((_, i) => i % 2 === 0);
  for (const [i, y] of heights.entries()) {
    const feet = parts.map((part) => {
      const [x, z] = outriggerCenter(part, y);
      return [x, y, z];
    });
    for (const [j, foot] of feet.entries()) {
      const head = [2.24, y + (j === 0 ? 0.32 : 0.18), j === 0 ? 1.53 : -1.24];
      beam(out, 'frame', foot, head, lod ? 0.32 : 0.43, lod ? 0.24 : 0.31, color.cross);
      if (lod >= 2 && i >= 2) {
        const end = [1.62, y + 1.74, head[2]];
        beam(out, 'frame', foot, end, 0.17, 0.18, color.cross);
      }
    }
    if (lod && i % 3 === 0) beam(out, 'frame', feet[0], feet[1], 0.2, 0.2, color.cross);
  }
  for (const part of parts) {
    const [x, z] = part.upper;
    beam(out, 'frame', [x, 102.25, z], [1.1, 105.3, 0.05], 0.27, 0.3, color.cross);
    beam(out, 'frame', [x, 106.1, z], [1.0, 101.0, 0.05], 0.23, 0.27, color.cross);
  }

  // The external rack and its maintenance rungs sit alongside the cladded shaft.
  const railX = [-0.27, 0.47];
  for (const x of railX)
    beam(out, 'frame', [x, 1.2, 1.16], [x, 103.4, 1.16], lod ? 0.15 : 0.25, 0.16, color.ladder);
  if (lod >= 2) {
    const spacing = lod === 3 ? 0.78 : 1.57;
    for (let y = 3.2; y < 102; y += spacing) {
      beam(out, 'frame', [railX[0], y, 1.21], [railX[1], y, 1.21], 0.095, 0.1, color.ladder);
    }
    for (const y of section.braceHeights) {
      beam(out, 'frame', [railX[1], y, 1.16], [1.82, y, 1.16], 0.11, 0.12, color.ladder);
    }
  }
}

function cabin(out, lod) {
  const y = section.viewingFloor,
    count = [10, 16, 24, 32][lod];
  // The point at the antenna end is pinched, and the glazed end bulges across the shaft.
  const ring = (height, xSize, zSize) =>
    radialRing(height, xSize, zSize, count, [-0.73, 0.53]).map(([x, yy, z]) => [
      x,
      yy,
      0.53 + (z - 0.53) * (0.81 + (0.25 * (x + 0.73)) / xSize),
    ]);
  const lower = ring(y - 1.73, 2.15, 1.43);
  const belt = ring(y - 0.48, 5.69, 2.6);
  const sill = ring(y + 0.21, 5.71, 2.62);
  const lintel = ring(y + 2.16, 5.45, 2.52);
  loft(out, 'cladding', [lower, belt, sill], color.cabin);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const isGlass = (sill[i][0] + sill[j][0]) / 2 > -0.48;
    const points = [sill[i], sill[j], lintel[j], lintel[i]];
    const shade = i % 4 === 0 ? color.glassShade : color.glass;
    quad(
      out,
      isGlass ? 'glass' : 'cladding',
      points,
      normalFor(...points),
      isGlass ? shade : color.cabin,
    );
    if (isGlass && lod && (i % 2 === 0 || lod === 3)) {
      const move = ([x, h, z]) => [-0.73 + (x + 0.73) * 1.008, h, 0.53 + (z - 0.53) * 1.008];
      beam(out, 'frame', move(sill[i]), move(lintel[i]), 0.107, 0.105, color.lip);
    }
  }
  loft(out, 'frame', [ring(y - 0.04, 5.73, 2.64), ring(y + 0.23, 5.74, 2.66)], color.lip, {
    cap: false,
  });
  loft(
    out,
    'roof',
    [lintel, ring(y + 2.52, 5.38, 2.57), ring(y + 3.18, 3.39, 1.94), ring(y + 3.64, 1.23, 0.79)],
    color.roof,
  );
  if (lod >= 2) {
    const lightLevel = 98.7;
    const lights = [
      [-5.95, 2.74],
      [0.46, 1.33],
      [4.59, 0.36],
      [2.45, -2.02],
    ];
    beam(
      out,
      'frame',
      [4.36, lightLevel - 0.2, 0.36],
      [4.59, lightLevel - 0.2, 0.36],
      0.16,
      0.16,
      color.bracket,
    );
    beam(
      out,
      'frame',
      [2.45, lightLevel - 0.2, -1.67],
      [2.45, lightLevel - 0.2, -2.02],
      0.16,
      0.16,
      color.bracket,
    );
    for (const [x, z] of lights) {
      beam(out, 'frame', [x, lightLevel - 0.23, z], [x, lightLevel, z], 0.34, 0.26, color.bracket);
      box(out, 'frame', x, lightLevel, z, 0.31, 0.29, 0.26, color.red);
    }
  }
}

function antenna(out, lod) {
  const center = section.antennaCenter;
  const count = [5, 8, 10, 12][lod];
  const stages = [
    [103.4, 0.41],
    [106.9, 0.36],
    [110.7, 0.29],
    [115.4, 0.175],
    [122.3, 0.11],
    [section.overallHeight, 0.075],
  ];
  loft(
    out,
    'frame',
    stages.map(([y, r]) => radialRing(y, r, r, count, center)),
    color.antenna,
  );
  if (lod >= 2) {
    const [x, z] = center;
    for (const [y, reach] of [
      [106.5, 0.83],
      [108.2, 0.52],
    ]) {
      beam(out, 'frame', [x, y, z], [x + reach, y, z], 0.085, 0.095, color.antenna);
      box(out, 'frame', x + reach, y, z, 0.13, 0.26, 0.14, color.white);
    }
  }
}

function build(out, lod) {
  base(out, lod);
  shaft(out, lod);
  outrigger(out, section.visibleOutrigger, lod);
  outrigger(out, section.rearOutrigger, lod);
  bracing(out, lod);
  cabin(out, lod);
  antenna(out, lod);
}

export const glasgowSkyline = (out) => build(out, 0);
export const glasgowDistrict = (out) => build(out, 1);
export const glasgowStreet = (out) => build(out, 2);
export const glasgowCloseup = (out) => build(out, 3);

const recipe = 'glasgow-tower-model.mjs';
const camera = [53, 68, 205];
const lookAt = [-0.8, 63, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'glasgowDistrict', 0.28],
    ['street', 'glasgowStreet', 0.13],
    ['closeup', 'glasgowCloseup', 0.045],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const glasgowModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: glasgowCloseup,
  category: 'tower',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Glasgow Tower at Pacific Quay with triangular aerofoil supports, thin braces, glazed viewing pod and an aerial 127 metres above ground.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.89,
    basis: 'Named Glasgow Tower circular footprint, OpenStreetMap way 222709055.',
  },
  mediumFiContext: {
    scale: 0.76,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_panel',
    'metal_painted',
    'metal_standing_seam',
    'metal_stainless_beadblasted',
  ],
  qaCameras: [
    { name: 'whole-tower-pacific-quay-profile', position: [0, 17, 229], lookAt: [-1.6, 60.7, 0] },
    {
      name: 'observation-pod-aerial-and-braces',
      position: [17, 109, 43],
      lookAt: [-1.7, 107.2, 0],
    },
    {
      name: 'turntable-enclosure-and-shaft-root',
      position: [-11, 8.6, 32],
      lookAt: [-0.9, 6.7, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-glasgow-tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'glasgowSkyline',
    errorMeters: 0.69,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party CC0 Qualla photo.',
};
