import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  pairs,
  palette,
  panel,
  plane,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  stone: 'a39f8c',
  stoneShade: '969182',
  sandstone: 'b2a996',
  pale: 'cecbc0',
  concrete: 'd8d6cd',
  light: 'e3e0d9',
  dark: '777b74',
  trim: '7d8989',
  glass: '56696d',
  reflection: '6b7b7a',
  paving: 'a9aa9e',
  interior: '4a5857',
  roof: '928c7e',
});
const surfaces = {
  oldStone: surface('wall', 'stone_limestone_raw', 0.94),
  newStone: surface('wall', 'stone_sandstone', 0.93),
  concrete: surface('trim', 'concrete_panel', 0.94),
  roof: surface('roof', 'metal_painted', 0.9, 0.08),
  pavement: surface('foundation', 'stone_limestone', 0.96),
  glass: surface('window', 'window_grid', 0.62),
};
const floor = d.principalFloor;
const history = d.outline.map(([x, z], i) => [x, i <= 2 ? d.entryRear + 0.31 : z]);
const eastEdge = history.slice(4, 14);
const galleryJoint = [27.221, -6.792];
const eastMass = [...eastEdge, galleryJoint];
const originalOutline = [...history.slice(0, 5), galleryJoint, ...history.slice(14)];
const west = d.entryWest,
  east = d.entryEast;
const lobbyCenter = (west + east) * 0.5;
const entrySpan = east - west;
const concavity = (x) =>
  d.entryFront - 1.14 * (1 - Math.pow((x - lobbyCenter) / (entrySpan * 0.5), 2));

function mass(out, outline, bottom, top, slot, color, roof = slot, roofColor = color) {
  shell(out, outline, typeof bottom === 'function' ? bottom : () => bottom, top, {
    wall: slot,
    color,
    roof,
    roofColor,
  });
}

function originalGalleries(out, lod) {
  mass(
    out,
    originalOutline,
    (p) => Math.min(grade(p) - 0.41, floor - 0.43),
    floor,
    'pavement',
    colors.dark,
  );
  mass(
    out,
    originalOutline,
    floor - 0.02,
    d.originalRoof - 0.31,
    'oldStone',
    colors.stone,
    'roof',
    colors.roof,
  );
  const sign = areaSign(originalOutline);
  for (const [[a, b], i] of pairs(closed(originalOutline)).map((p, i) => [p, i])) {
    if (i === 4) continue;
    const w = edge(a, b, sign);
    panel(
      out,
      'concrete',
      w,
      0,
      w.length,
      d.originalRoof - 0.75,
      d.originalRoof - 0.1,
      0.053,
      colors.pale,
    );
    if (lod === 0 || w.length < 8 || i < 3) continue;
    if (w.normal[2] < -0.53 || w.normal[0] < -0.88) {
      const count = w.normal[0] < -0.88 ? 2 : Math.max(1, Math.round(w.length / 7.8));
      for (let j = 0; j < count; j++) {
        const x = mix(0.5, w.length - 0.5, (j + 0.5) / count);
        const body = w.normal[0] < -0.88 ? 4.65 : 3.76;
        opening(
          out,
          w,
          x - 0.95,
          x + 0.95,
          floor + 0.48,
          body,
          'concrete',
          colors.glass,
          'glass',
          colors.trim,
          Math.max(lod - 1, 0),
          0.032,
        );
      }
    }
    if (lod > 1)
      for (const pos of [0.23, w.length - 0.22])
        panel(
          out,
          'concrete',
          w,
          pos - 0.055,
          pos + 0.055,
          floor + 0.02,
          d.originalRoof - 0.31,
          0.049,
          colors.pale,
        );
  }
}

function highPavilion(out, lod) {
  const base = 3.66,
    h = d.eastGalleryRoof;
  mass(
    out,
    eastMass,
    (p) => Math.min(grade(p) - 0.36, floor - 0.43),
    floor,
    'pavement',
    colors.dark,
  );
  mass(out, eastMass, floor, base, 'glass', colors.glass, 'concrete', colors.dark);
  mass(out, eastMass, base - 0.031, h, 'newStone', colors.sandstone, 'roof', colors.roof);
  const sign = areaSign(eastMass);
  for (const [[a, b], i] of pairs(closed(eastMass)).map((p, i) => [p, i])) {
    const w = edge(a, b, sign);
    panel(out, 'concrete', w, 0, w.length, base - 0.12, base + 0.08, 0.048, colors.pale);
    panel(out, 'concrete', w, 0, w.length, h - 0.19, h + 0.019, 0.05, colors.pale);
    if (lod > 0 && w.length >= 6) {
      const count = Math.max(1, Math.floor(w.length / 2.18));
      for (let n = 1; n < count; n++) {
        const x = mix(0.15, w.length - 0.15, n / count);
        panel(out, 'concrete', w, x - 0.047, x + 0.047, floor + 0.028, base, 0.038, colors.trim);
      }
    }
    const isCathedralGreenElevation = i === 5;
    if (!isCathedralGreenElevation && i !== 6) continue;
    const width = w.length * (isCathedralGreenElevation ? 0.68 : 0.59),
      center = w.length * 0.52;
    const from = center - width / 2,
      to = center + width / 2;
    if (lod > 0)
      trimBlock(
        out,
        'newStone',
        w,
        from - 0.19,
        to + 0.19,
        base + 0.72,
        h - 0.72,
        0.006,
        0.15,
        colors.pale,
      );
    panel(out, 'glass', w, from, to, base + 0.9, h - 1.08, 0.176, colors.glass);
    if (lod < 2) continue;
    for (let j = 1; j < 6; j++) {
      const u = mix(from, to, j / 6);
      panel(out, 'concrete', w, u - 0.042, u + 0.042, base + 0.9, h - 1.07, 0.193, colors.trim);
    }
    panel(out, 'concrete', w, from, to, base + 2.95, base + 3.01, 0.19, colors.trim);
  }
}

function frontBand(out, span, base, top, pad, slot, color) {
  const points = span.map((x) => [x, concavity(x) + pad]);
  const polygon = [...points, [east, d.entryRear], [west, d.entryRear]];
  mass(out, polygon, base, top, slot, color, slot, color);
}

function screenFin(out, x, y, top, lod) {
  const front = concavity(x) + 0.06;
  const a = ((x - lobbyCenter) / entrySpan) * 0.295;
  const w = 0.29,
    t = 0.95;
  const shape = [
    [-w * 0.5, -t * 0.63],
    [w * 0.5, -t * 0.63],
    [w * 0.5, t * 0.37],
    [-w * 0.5, t * 0.37],
  ].map(([u, v]) => [
    x + Math.cos(a) * u + Math.sin(a) * v,
    front - Math.sin(a) * u + Math.cos(a) * v,
  ]);
  mass(out, shape, y, top, 'concrete', colors.concrete);
  if (lod > 1) {
    const body = shape.map(([x, z]) => [x, z + 0.066]);
    mass(out, body, y - 0.04, y + 0.105, 'concrete', colors.pale);
  }
}

function entranceStairs(out, points, lod) {
  const mainFloor = 0.87;
  const n = lod === 0 ? 3 : 5;
  for (const [a, b] of pairs(points)) {
    for (let i = 0; i < n; i++) {
      const f = 0.15 + 0.64 * (n - i);
      const y = mix(
        Math.max(grade([a, concavity(a) + 3.5]), grade([b, concavity(b) + 3.5])) + 0.08,
        mainFloor,
        (i + 1) / n,
      );
      const p = [
        [a, concavity(a) + f],
        [b, concavity(b) + f],
        [b, concavity(b) + f - 0.68],
        [a, concavity(a) + f - 0.68],
      ];
      mass(
        out,
        p,
        (q) => Math.min(grade(q) - 0.09, y - 0.16),
        y,
        'pavement',
        i % 2 === 0 ? colors.paving : colors.pale,
      );
    }
  }
}

function entrancePavilion(out, lod) {
  const frontY = 0.88,
    h = d.entranceTop;
  const pieces = [6, 16, 24, 36][lod];
  const arc = Array.from({ length: pieces + 1 }, (_, i) => mix(west, east, i / pieces));
  const entryLeft = lobbyCenter - 4.3,
    entryRight = lobbyCenter + 1.3;
  frontBand(out, arc, h - 0.71, h, 0.2, 'concrete', colors.light);
  const thin = arc.map((x) => [x, concavity(x) - 1.4]);
  const glassWall = [...thin, [east, d.entryRear], [west, d.entryRear]];
  const sign = areaSign(glassWall);
  mass(
    out,
    glassWall,
    (p) => Math.min(grade(p) - 0.33, frontY - 0.24),
    frontY,
    'pavement',
    colors.paving,
  );
  mass(out, glassWall, frontY, h - 0.7, 'glass', colors.glass, 'roof', colors.roof);
  const base = arc.map((x) => [x, concavity(x) + 0.24]);
  cap(
    out,
    'pavement',
    [...base, [east, d.entryRear + 0.03], [west, d.entryRear + 0.03]],
    frontY + 0.019,
    colors.pale,
  );
  for (const [[a, b], i] of pairs(thin).map((p, i) => [p, i])) {
    const w = edge(a, b, sign);
    if (lod === 0) continue;
    panel(out, 'concrete', w, 0, w.length, frontY, frontY + 0.12, 0.074, colors.trim);
    panel(out, 'concrete', w, 0, w.length, h - 1.01, h - 0.69, 0.059, colors.pale);
    if (lod === 1) continue;
    panel(out, 'concrete', w, 0, 0.064, frontY + 0.07, h - 0.99, 0.083, colors.trim);
    if (i % 3 === 0)
      panel(
        out,
        'glass',
        w,
        0.12,
        w.length - 0.12,
        frontY + 0.37,
        h - 1.12,
        0.035,
        colors.reflection,
      );
  }
  const count = [13, 21, 27, 29][lod];
  for (let i = 0; i < count; i++) {
    const x = mix(west + 0.34, east - 0.34, i / (count - 1));
    if (x > entryLeft && x < entryRight) continue;
    screenFin(out, x, frontY, h - 0.57, lod);
  }
  if (lod > 0) {
    for (const x of [entryLeft, entryRight]) screenFin(out, x, frontY, h - 0.57, lod);
    const mid = plane(concavity(lobbyCenter) - 1.33, 1);
    for (const x of [entryLeft + 0.81, (entryLeft + entryRight) / 2, entryRight - 0.79]) {
      panel(out, 'glass', mid, x - 0.63, x + 0.63, frontY + 0.06, h - 1.65, 0.06, colors.interior);
      panel(out, 'concrete', mid, x - 0.026, x + 0.026, frontY + 0.06, h - 1.6, 0.1, colors.trim);
    }
  }
  entranceStairs(out, arc, lod);
}

function build(out, lod) {
  originalGalleries(out, lod);
  highPavilion(out, lod);
  entrancePavilion(out, lod);
  if (lod > 1) {
    for (const [x, z] of [
      [-33, -2],
      [-11, 6],
      [10, -4],
    ])
      block(out, 'roof', x, d.originalRoof - 0.32, z, 3.5, 0.78, 1.72, colors.roof);
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'beaverbrook-art-gallery-model.mjs',
  camera = [67, 31, 105],
  lookAt = [-2, 5, 5];
export const beaverbrookGalleryModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The named current gallery map and Queen Street alignment determine position; entrance steps reach the independent original floodplain ground.',
  brief:
    'Beaverbrook Art Gallery’s low stone galleries and two modern additions. A gently curved precast colonnade fronts the glazed Harrison McCain Pavilion on Queen Street.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-37, 65, 61],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis:
      'Named current gallery outline identifies all connected wings, including the 2022 public entry.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'queen-street-colonnade', position: [10, 11, 61], lookAt: [-14, 4, 29] },
    { name: 'east-pavilion-and-sculpture-court', position: [69, 16, 42], lookAt: [34, 5, 14] },
    { name: 'riverside-gallery-wings', position: [45, 32, -68], lookAt: [-1, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'beaverbrook-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.93,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.52, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
};
