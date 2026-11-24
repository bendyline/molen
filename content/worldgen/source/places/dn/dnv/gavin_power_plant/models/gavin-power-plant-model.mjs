import fs from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const settings = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const controls = JSON.parse(
  fs.readFileSync(new URL('../native-map/gavin-plant-site-controls.json', import.meta.url)),
);
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const {
  foundation,
  verifiedMainStackHeight,
  verifiedStackInsideTopWidth,
  shortStackHeightEstimate,
  coolingHeightEstimate,
  hallRoofHeightEstimate,
} = settings.dimensions;

const surfaces = {
  shell: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  chimney: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  lining: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.97 },
  wall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.84, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.82 },
};

const concrete = rgb('a8a29a');
const concreteRim = rgb('918780');
const interior = rgb('766f68');
const baseColor = rgb('a69a82');
const panels = rgb('b7ac92');
const lightPanels = rgb('c2b59a');
const roofColor = rgb('92928a');
const steel = rgb('7b817d');
const lightSteel = rgb('a5a7a0');
const dark = rgb('505653');
const glazing = rgb('525c60');

function groundAt([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const h = terrain.heightsMeters;
  return (
    (1 - b) * ((1 - a) * h[j][i] + a * h[j][i + 1]) +
    b * ((1 - a) * h[j + 1][i] + a * h[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function rectangular(out, slot, [x0, z0, x1, z1], floor, top, color) {
  abox(out, slot, [x0, floor, z0], [x1, top, z1], color, { bottom: false });
}

function hallSlab(out, slot, low, high, color, topSlot = slot, topColor = color) {
  const outline = controls.mainHallOutline;
  extrude(out, slot, outline, low, high, color, { top: false });
  const triangles = earcut(outline.flat(), [], 2);
  for (let i = 0; i < triangles.length; i += 3) {
    const uv = [triangles[i], triangles[i + 2], triangles[i + 1]].map((index) => outline[index]);
    out.addTriangle(
      topSlot,
      'palette:#ffffff',
      uv.map(([x, z]) => [x, high, z]),
      [0, 1, 0],
      uv,
      topColor,
    );
  }
}

const hallBlocks = [
  { bounds: [-81, -133, -24, 145], y: 41.4, color: panels },
  { bounds: [-65, -73, 36.7, 2.3], y: hallRoofHeightEstimate, color: lightPanels },
  { bounds: [-65, 33, 35.1, 108], y: hallRoofHeightEstimate - 2.3, color: panels },
  { bounds: [-79.1, 112, -38.4, 143], y: 27.1, color: lightPanels },
];

function generatingHall(out, lod) {
  hallSlab(out, 'base', foundation, 2.1, baseColor);
  hallSlab(out, 'wall', 1.93, 18.65, panels, 'roof', roofColor);
  for (const { bounds, y, color } of hallBlocks) {
    rectangular(out, 'wall', bounds, 17.96, y, color);
    const [x0, z0, x1, z1] = bounds;
    rectangular(
      out,
      'roof',
      [x0 - 0.35, z0 - 0.32, x1 + 0.35, z1 + 0.32],
      y - 0.28,
      y + 0.32,
      roofColor,
    );
    if (lod === 0) continue;
    const faces = [
      { at: facade([x1, z1], [0, -1]), length: z1 - z0, east: true },
      { at: facade([x0, z0], [0, 1]), length: z1 - z0 },
      { at: facade([x0, z1], [1, 0]), length: x1 - x0 },
      { at: facade([x1, z0], [-1, 0]), length: x1 - x0 },
    ];
    for (const { at, length, east } of faces) {
      for (const floor of [22.6, y - 8.6]) {
        if (floor + 3.2 >= y) continue;
        if (lod === 1) {
          if (east || length < 115)
            fbox(out, 'glass', at, 1.4, length - 1.4, floor, floor + 2.8, 0.0, 0.09, glazing);
          continue;
        }
        const bay = east ? 9 : 13;
        for (let u = 4.8; u < length - 3.2; u += bay) {
          opening(out, at, u, floor, east ? 5.7 : 4.2, 2.9, {
            d: 0.21,
            frameSlot: 'steel',
            frame: lightSteel,
            glass: glazing,
            frameWidth: lod === 3 ? 0.13 : 0,
            frameDepth: 0.34,
            sill: false,
            mullions: lod === 3 && east ? 2 : 0,
          });
        }
      }
      if (lod < 2 || !east) continue;
      for (let u = 1.25; u < length - 0.8; u += lod === 3 ? 6.2 : 10.5) {
        fbox(out, 'steel', at, u - 0.14, u + 0.14, 19.26, y - 0.38, 0.01, 0.3, steel);
      }
    }
  }
  if (lod === 0) return;
  for (const z of [-34, 70]) {
    rectangular(
      out,
      'roof',
      [-54, z - 13, -19, z + 13],
      hallRoofHeightEstimate - 2.19,
      hallRoofHeightEstimate + 1.55,
      roofColor,
    );
    rectangular(
      out,
      'wall',
      [-28, z - 6, -10, z + 6],
      hallRoofHeightEstimate - 2.21,
      hallRoofHeightEstimate + 4.25,
      lightPanels,
    );
  }
}

const phase = -0.08;
const ring = (center, y, rad, sides) => radialRing(y, rad, rad, sides, center, phase);

function skin(out, slot, center, profile, sides, colors, inner = false) {
  for (let i = 1; i < profile.length; i++) {
    const [ay, ar] = profile[i - 1];
    const [by, br] = profile[i];
    const low = ring(center, ay, ar, sides);
    const high = ring(center, by, br, sides);
    if (inner) {
      low.reverse();
      high.reverse();
    }
    loft(out, slot, [low, high], colors[(i - 1) % colors.length], { cap: false });
  }
}

function ringCap(out, slot, center, y, outer, inner, sides, tone) {
  const a = ring(center, y, outer, sides);
  const b = ring(center, y, inner, sides);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    quad4(out, slot, a[i], a[j], b[j], b[i], tone);
  }
}

const stackColors = ['b7a584', 'b09d7c', 'a79577', 'a18d70', '8a7b66', '796b5e', '6b6056'].map(rgb);

function chimney(out, center, full, lod) {
  const base = groundAt(center);
  const sides = [9, 16, 24, 36][lod];
  const height = full ? verifiedMainStackHeight : shortStackHeightEstimate;
  const top = base + height;
  const inside = full ? verifiedStackInsideTopWidth / 2 : 6.62;
  const bodyRadius = full ? 9.78 : 8.83;
  const topRadius = inside + (full ? 0.94 : 1.04);
  const relative = lod === 0 ? [0, 0.73, 0.93, 1] : [0, 0.18, 0.39, 0.62, 0.81, 0.93, 1];
  const profileR = (fraction) => bodyRadius + (topRadius - bodyRadius) * fraction;
  const contour = relative.map((f) => [base + f * height, profileR(f)]);
  skin(
    out,
    'chimney',
    center,
    [[base - 6.8, bodyRadius + 0.02], ...contour],
    sides,
    lod === 0 ? [stackColors[0], stackColors[1], stackColors[4], stackColors[6]] : stackColors,
  );
  const rimRadius = topRadius + (full ? 0.63 : 0.28);
  skin(
    out,
    'chimney',
    center,
    [
      [top - 2.1, rimRadius],
      [top, rimRadius],
    ],
    sides,
    [concreteRim],
  );
  skin(
    out,
    'lining',
    center,
    [
      [top - 19, inside],
      [top, inside],
    ],
    sides,
    [interior],
    true,
  );
  ringCap(out, 'chimney', center, top, rimRadius, inside, sides, concreteRim);
  if (lod === 0) return;
  skin(
    out,
    'base',
    center,
    [
      [base - 3.7, bodyRadius + 4.0],
      [base + 2.65, bodyRadius + 4.0],
    ],
    sides,
    [baseColor],
  );
  ringCap(out, 'base', center, base + 2.65, bodyRadius + 4.0, bodyRadius, sides, baseColor);
  if (!full) return;
  for (const fraction of [0.65, 0.715]) {
    const y = base + fraction * height;
    const r = profileR(fraction);
    skin(
      out,
      'steel',
      center,
      [
        [y - 0.64, r + 1.45],
        [y, r + 1.45],
      ],
      sides,
      [steel],
    );
    ringCap(out, 'steel', center, y, r + 1.45, r - 0.08, sides, lightSteel);
    if (lod >= 2) {
      beamPath(
        out,
        'steel',
        ring(center, y + 1.12, r + 1.38, sides),
        0.105,
        0.105,
        lightSteel,
        true,
      );
      const rail = ring(center, y, r + 1.38, sides);
      for (const q of rail.filter((_, i) => i % (lod === 3 ? 2 : 3) === 0)) {
        beam(out, 'steel', q, [q[0], y + 1.12, q[2]], 0.12, 0.12, steel);
      }
    }
  }
  if (lod < 2) return;
  for (const p of ring(center, base + 1.5, bodyRadius + 2.8, 8)) {
    const q = [
      center[0] + (p[0] - center[0]) * 0.89,
      base + 26,
      center[1] + (p[2] - center[1]) * 0.89,
    ];
    beam(out, 'steel', p, q, 0.8, 0.7, lightSteel);
  }
}

function towerOuterRadius(r, f) {
  const throat = 0.64;
  const taper = (f - 0.73) / 0.73;
  return r * Math.sqrt(throat * throat + (1 - throat * throat) * taper * taper);
}

function coolingTower(out, control, lod) {
  const { center, outline } = control;
  const base = groundAt(center);
  const height = coolingHeightEstimate;
  const radius =
    outline.reduce((sum, [x, z]) => sum + Math.hypot(x - center[0], z - center[1]), 0) /
    outline.length;
  const rungs = [4, 12, 17, 23][lod];
  const sides = [9, 18, 36, 54][lod];
  const spring = lod === 0 ? 0.025 : 0.077;
  const thickness = 0.76;
  const roofY = base + height;
  const shell = Array.from({ length: rungs + 1 }, (_, i) => {
    const f = spring + ((1 - spring) * i) / rungs;
    return [base + f * height, towerOuterRadius(radius, f)];
  });
  const innerFrom = Math.max(0, rungs - (lod >= 2 ? 5 : 2));
  skin(out, 'shell', center, shell, sides, [concrete]);
  skin(
    out,
    'lining',
    center,
    shell.slice(innerFrom).map(([y, r]) => [y, r - thickness]),
    sides,
    [interior],
    true,
  );
  const mouthR = shell.at(-1)[1];
  skin(
    out,
    'shell',
    center,
    [
      [roofY - 1.12, mouthR + 0.35],
      [roofY, mouthR + 0.35],
    ],
    sides,
    [concreteRim],
  );
  ringCap(out, 'shell', center, roofY, mouthR + 0.35, mouthR - thickness, sides, concreteRim);
  const plinth = [
    [base - 5, radius + 1.9],
    [base + 1.6, radius + 1.9],
  ];
  skin(out, 'base', center, plinth, sides, [baseColor]);
  const [springY, springR] = shell[0];
  if (lod === 0) {
    skin(
      out,
      'base',
      center,
      [
        [base + 1.55, radius + 1.9],
        [springY, springR],
      ],
      sides,
      [baseColor],
    );
    return;
  }
  ringCap(out, 'base', center, base + 1.6, radius + 1.9, radius - 8.0, sides, concrete);
  const legs = lod === 1 ? 12 : lod === 2 ? 24 : 36;
  const foot = ring(center, base + 1.6, radius - 0.72, legs);
  const head = ring(center, springY + 0.23, springR + 0.35, legs);
  for (let i = 0; i < legs; i++) {
    beam(out, 'base', foot[i], head[i], 1.39, 1.23, concrete);
    if (lod >= 2) beam(out, 'base', foot[i], head[(i + 1) % legs], 1.18, 1.12, concrete);
  }
}

function steelApron(out, lod) {
  const eastApron = [
    [[42, -65, 88, 3], 21, lightPanels],
    [[42, 33, 80, 102], 20, panels],
    [[76, -80, 114, -42], 14, panels],
    [[75, 57, 117, 87], 13.3, lightPanels],
    [[140, -59, 173, -33], 18.5, lightPanels],
    [[141, 72, 171, 102], 18.5, panels],
  ];
  if (lod === 0) return;
  for (const [bounds, top, tone] of eastApron) {
    rectangular(out, 'wall', bounds, -0.9, top, tone);
    const [x0, z0, x1, z1] = bounds;
    rectangular(
      out,
      'roof',
      [x0 - 0.12, z0 - 0.12, x1 + 0.12, z1 + 0.12],
      top - 0.27,
      top + 0.37,
      roofColor,
    );
    if (lod >= 2) {
      for (const z of [z0 + (z1 - z0) * 0.28, z0 + (z1 - z0) * 0.73]) {
        const f = facade([x1, z], [0, -1]);
        fbox(out, 'steel', f, -2.31, 2.31, 2.1, 6.89, 0.0, 0.18, steel);
        fbox(out, 'glass', f, -3.44, 3.44, top - 5.7, top - 3.2, 0.01, 0.13, glazing);
      }
    }
  }
  if (lod < 2) return;
  const row = [54, 83, 113, 141, 171, 195];
  for (const [z, y] of [
    [-43.2, 17.2],
    [91.09, 18.9],
  ]) {
    for (const sign of [-1, 1]) {
      const edgeZ = z + sign * 3.9;
      beamPath(
        out,
        'steel',
        row.map((x) => [x, y, edgeZ]),
        0.64,
        0.62,
        lightSteel,
      );
      beamPath(
        out,
        'steel',
        row.map((x) => [x, y - 4.35, edgeZ]),
        0.63,
        0.68,
        steel,
      );
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i];
        const b = row[i + 1];
        beam(out, 'steel', [a, y - 4.35, edgeZ], [b, y, edgeZ], 0.43, 0.42, lightSteel);
        if (lod === 3) beam(out, 'steel', [a, y, edgeZ], [b, y - 4.35, edgeZ], 0.4, 0.42, steel);
        beam(
          out,
          'steel',
          [a, groundAt([a, edgeZ]) - 0.3, edgeZ],
          [a, y, edgeZ],
          0.91,
          0.89,
          steel,
        );
      }
    }
    for (const x of row.slice(0, -1)) {
      beam(out, 'steel', [x, y, z - 3.9], [x, y, z + 3.9], 0.54, 0.57, lightSteel);
    }
    rectangular(out, 'roof', [43, z - 2.47, 188, z + 2.45], y - 3.09, y - 1.35, dark);
  }
}

function build(out, lod) {
  generatingHall(out, lod);
  steelApron(out, lod);
  for (const [i, point] of controls.nativeChimneys.entries()) chimney(out, point.local, i < 2, lod);
  for (const tower of controls.towerSections) coolingTower(out, tower, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'gavin-power-plant-model.mjs';
const camera = [866, 295, 438];
const lookAt = [39, 81, -9];
export const model = {
  id: settings.model,
  key: settings.model,
  cell: settings.cell,
  recipe,
  title: settings.title,
  category: 'industrial',
  wikidataId: settings.wikidataId,
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Cheshire’s Gavin Power Plant with three chimneys, two open-rim cooling towers, and its generating hall.',
  camera,
  lookAt,
  sunDirection: [72, 82, 59],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: controls.mainHallOutline,
    minimumCoverage: 0.93,
    basis: 'Native roof outline of the generating hall.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: settings.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'three-chimneys-two-cooling-towers', position: [941, 198, 181], lookAt },
    {
      name: 'street-side-stack-galleries-and-steelwork',
      position: [556, 28, 198],
      lookAt: [89, 110, 16],
    },
    { name: 'open-cooling-tower-rims-and-hall', position: [-384, 269, 488], lookAt: [18, 81, 46] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'gavin-power-plant-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' +
      settings.cell +
      '/' +
      settings.model +
      '/models/' +
      recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.74,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.15, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.095, surfaces },
    },
  },
  limitations: settings.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation tiles.',
};
