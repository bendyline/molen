import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const controls = read('native-map/louisbourg-first-tower-controls');
const { towerEaves, lanternPlatform, lanternEaves, roofCrown, flueTop } = controls.localElevationM;

const surface = (slot, graph, roughness) => ({ slot, graph, roughness });
const surfaces = {
  wall: surface('wall', 'stone_ashlar', 0.95),
  base: surface('foundation', 'stone_limestone_weathered', 0.97),
  stonework: surface('trim', 'stone_limestone', 0.91),
  slate: surface('roof', 'slate', 0.91),
  timber: surface('door', 'wood_plain', 0.87),
  vent: surface('trim', 'metal_painted', 0.8),
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
};

const baseStone = rgb('a29781');
const stones = ['c4bca7', 'c5beaa', 'bbb39f', 'c0b8a4', 'c9c0ad'].map(rgb);
const cutStone = rgb('a39c85');
const lipStone = rgb('b3a991');
const slate = rgb('51565d');
const slateShade = rgb('454c55');
const charcoal = rgb('46433c');
const shutter = rgb('635343');
const lead = rgb('3b413b');
const panes = ['8c9b94', '93a29a', '97a59c', 'b5aa85', 'aca688', '899992'].map(rgb);
const turn = 2 * Math.PI;
const bodyRadius = (y) =>
  controls.scaledDiameterM / 2 -
  ((controls.scaledDiameterM / 2 - controls.towerRadiusAtEaveM) * Math.max(y, 0)) / towerEaves;

// Angles are measured from the doorway, clockwise around the tower in plan.
const polar = (angle, y, r) => [r * Math.sin(angle), y, r * Math.cos(angle)];
const portals = [
  { a: 0, y: 0.05, height: 2.02, width: 1.07, door: true },
  { a: 0.66, y: 2.79, height: 0.73, width: 0.49 },
  { a: 0.01, y: 6.36, height: 0.76, width: 0.61 },
  { a: 0.02, y: 10.54, height: 0.82, width: 0.61 },
  { a: -0.51, y: 13.95, height: 0.87, width: 0.59 },
].map((portal) => {
  const { a, y, height, width } = portal;
  const halfAngle = Math.asin(width / 2 / bodyRadius(y + height / 2));
  return { ...portal, a0: a - halfAngle, a1: a + halfAngle, top: y + height };
});

function stoneShell(out, level, sideCount, openings) {
  const rows = level < 2 ? 1 : level === 2 ? 14 : 35;
  const baseAngles = Array.from({ length: sideCount + 1 }, (_, i) =>
    i === sideCount ? Math.PI : -Math.PI + (i * turn) / sideCount,
  );
  const courses = [
    ...new Set([
      ...Array.from({ length: rows + 1 }, (_, i) =>
        i === rows ? towerEaves : (i * towerEaves) / rows,
      ),
      ...openings.flatMap(({ y, top }) => [y, top]),
    ]),
  ].sort((a, b) => a - b);
  const angles = [...new Set([...baseAngles, ...openings.flatMap(({ a0, a1 }) => [a0, a1])])].sort(
    (a, b) => a - b,
  );

  for (let row = 0; row + 1 < courses.length; row++) {
    const y = courses[row],
      top = courses[row + 1];
    const r = bodyRadius(y),
      upperR = bodyRadius(top);
    for (let face = 0; face + 1 < angles.length; face++) {
      const left = angles[face],
        right = angles[face + 1];
      if (openings.some((p) => y >= p.y && top <= p.top && left >= p.a0 && right <= p.a1)) continue;
      const color = level < 2 ? stones[0] : stones[(13 * row + 7 * face + ((row * face) % 9)) % 5];
      quad4(
        out,
        'wall',
        polar(left, y, r),
        polar(right, y, r),
        polar(right, top, upperR),
        polar(left, top, upperR),
        color,
      );
    }
  }
}

function finishPortal(out, p, level) {
  const r = bodyRadius(p.y + p.height / 2);
  const depth = p.door ? 0.26 : 0.18;
  const f = facade([r * Math.sin(p.a), r * Math.cos(p.a)], [Math.cos(p.a), -Math.sin(p.a)]);
  opening(out, f, 0, p.y, p.width, p.height, {
    glassSlot: p.door ? 'timber' : 'glazing',
    frameSlot: 'stonework',
    glass: p.door ? shutter : charcoal,
    frame: cutStone,
    frameWidth: p.door ? 0.22 : 0.14,
    frameDepth: 0.077,
    d: -depth,
    sill: !p.door,
  });
  const half = p.width / 2;
  for (const side of [-1, 1]) {
    const u = side * half;
    const front = f.P(u, p.y, 0.006),
      back = f.P(u, p.y, -depth);
    const frontTop = f.P(u, p.top, 0.006),
      backTop = f.P(u, p.top, -depth);
    if (side < 0) quad4(out, 'stonework', front, back, backTop, frontTop, cutStone);
    else quad4(out, 'stonework', back, front, frontTop, backTop, cutStone);
  }
  quad4(
    out,
    'stonework',
    f.P(-half, p.top, -depth),
    f.P(-half, p.top, 0.01),
    f.P(half, p.top, 0.01),
    f.P(half, p.top, -depth),
    cutStone,
  );
  if (p.door && level >= 1) {
    fbox(out, 'stonework', f, -0.63, 0.63, -0.045, 0.1, -0.32, 0.36, baseStone);
    for (let i = 1; i < 5; i++) {
      const x = -half + (p.width * i) / 5;
      fbox(out, 'timber', f, x - 0.007, x + 0.007, 0.061, 2.05, -depth, -depth + 0.016, charcoal);
    }
    fbox(out, 'vent', f, 0.32, 0.4, 0.94, 1.01, -depth, -depth + 0.047, charcoal);
    const shield = [
      [-0.29, 2.48],
      [0, 2.32],
      [0.29, 2.48],
      [0.32, 2.81],
      [0.18, 3.03],
      [0, 3.12],
      [-0.18, 3.03],
      [-0.32, 2.81],
    ];
    for (let i = 0; i < shield.length; i++) {
      const a = shield[i],
        b = shield[(i + 1) % shield.length];
      tri(out, 'stonework', f.P(0, 2.73, 0.14), f.P(...a, 0.04), f.P(...b, 0.04), cutStone);
      if (level >= 2)
        tri(
          out,
          'stonework',
          f.P(0, 2.73, 0.184),
          f.P(a[0] * 0.66, 2.73 + 0.69 * (a[1] - 2.73), 0.116),
          f.P(b[0] * 0.66, 2.73 + 0.69 * (b[1] - 2.73), 0.116),
          lipStone,
        );
    }
    fbox(out, 'stonework', f, -0.13, 0.13, 3.1, 3.28, -0.04, 0.06, lipStone);
  }
}

function lantern(out, level, towerSides) {
  const centre = [0, 0];
  const ring = (y, r) => [y, r, r];
  lathe(
    out,
    'slate',
    centre,
    [ring(towerEaves - 0.02, 3.76), ring(towerEaves + 0.02, 3.76), ring(lanternPlatform, 1.88)],
    towerSides,
    slate,
    { capTop: false },
  );
  const oct = 8;
  const phase = Math.PI / 8;
  const opts = { rotation: phase, capTop: false };
  const radius = 1.9;
  lathe(
    out,
    'timber',
    centre,
    [ring(lanternPlatform - 0.04, radius + 0.075), ring(lanternPlatform + 0.2, radius + 0.032)],
    oct,
    shutter,
    opts,
  );
  const y = lanternPlatform + 0.19;
  const high = lanternEaves - 0.145;
  const halfWidth = radius * Math.sin(phase);
  const apothem = radius * Math.cos(phase);
  const columns = [1, 2, 3, 5][level],
    rows = [1, 2, 5, 10][level];
  for (let i = 0; i < oct; i++) {
    const a = (i * turn) / oct;
    const f = facade([apothem * Math.sin(a), apothem * Math.cos(a)], [Math.cos(a), -Math.sin(a)]);
    fbox(
      out,
      'timber',
      f,
      -halfWidth - 0.055,
      -halfWidth + 0.09,
      y - 0.04,
      high + 0.09,
      -0.13,
      0.052,
      shutter,
    );
    fbox(out, 'timber', f, -halfWidth, halfWidth, high, high + 0.12, -0.08, 0.049, charcoal);
    const inset = level >= 2 ? 0.015 : 0.025;
    const start = -halfWidth + 0.056;
    const paneWidth = (halfWidth * 2 - 0.112) / columns;
    const paneHeight = (high - y) / rows;
    const colorIndex = (row, col) => (i + row * 3 + col * 5) % panes.length;
    quad4(
      out,
      'timber',
      f.P(start, y, -0.025),
      f.P(-start, y, -0.025),
      f.P(-start, high, -0.025),
      f.P(start, high, -0.025),
      lead,
    );
    for (let j = 0; j < rows; j++) {
      const bottom = y + j * paneHeight + inset,
        top = bottom + paneHeight - inset * 2;
      for (let k = 0; k < columns; k++) {
        const left = start + k * paneWidth + inset,
          right = left + paneWidth - inset * 2;
        quad4(
          out,
          'glazing',
          f.P(left, bottom),
          f.P(right, bottom),
          f.P(right, top),
          f.P(left, top),
          panes[colorIndex(j, k)],
        );
      }
    }
  }
  lathe(
    out,
    'slate',
    centre,
    [
      ring(lanternEaves - 0.055, 1.99),
      ring(lanternEaves + 0.055, 1.99),
      ring(lanternEaves + 0.23, 1.76),
      ring(roofCrown, 0.115),
    ],
    oct,
    slateShade,
    { rotation: phase },
  );
  abox(out, 'vent', [-0.086, roofCrown - 0.06, -0.086], [0.086, flueTop - 0.23, 0.086], charcoal);
  abox(out, 'vent', [-0.54, flueTop - 0.31, -0.08], [0.54, flueTop - 0.16, 0.08], charcoal);
  for (const x of [-0.56, 0.45])
    abox(out, 'vent', [x, flueTop - 0.49, -0.11], [x + 0.11, flueTop, 0.11], charcoal);
}

function build(out, level) {
  const sideCount = [12, 24, 40, 64][level];
  const openings = level === 0 ? [portals[0], portals[2], portals[3]] : portals;
  const plinth = controls.scaledDiameterM / 2 + 0.13;
  lathe(
    out,
    'base',
    [0, 0],
    [
      [-1.28, plinth, plinth],
      [-0.12, plinth, plinth],
      [0.015, plinth - 0.12, plinth - 0.12],
    ],
    sideCount,
    baseStone,
    { capTop: false },
  );
  stoneShell(out, level, sideCount, openings);
  for (const y of controls.mouldingBandsM) {
    const r = bodyRadius(y);
    const layers = [
      [y - 0.12, r + 0.025],
      [y - 0.05, r + 0.133],
      [y + 0.08, r + 0.138],
      [y + 0.14, r + 0.024],
    ];
    lathe(
      out,
      'stonework',
      [0, 0],
      layers.map(([h, radius]) => [h, radius, radius]),
      sideCount,
      lipStone,
      { capTop: false },
    );
  }
  for (const portal of openings) finishPortal(out, portal, level);
  lantern(out, level, sideCount);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'louisbourg-lighthouse-model.mjs';
const camera = [19, 14, 27];
const lookAt = [0, 10.5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: '1734-04-01',
    validUntil: '1736-09-12',
  },
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'First French lighthouse on Louisbourg Head, with a tapering circular stone tower, a glazed timber lantern and a slate cap as drawn in the original plan.',
  camera,
  lookAt,
  sunDirection: [-38, 56, 57],
  mediumFiContext: {
    scale: 0.75,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: controls.replacementBuildingOutline,
    minimumCoverage: 0.93,
    basis: 'Suppress the separately mapped 1923 lighthouse during the original tower’s date range.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'whole-tower-and-entrance', position: camera, lookAt },
    { name: 'lantern-and-hooded-vent', position: [8, 21.2, 14], lookAt: [0, 18.7, 0] },
    { name: 'doorway-and-ashlar', position: [-4, 3.5, 12], lookAt: [0, 3.4, 3.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'louisbourg-lighthouse-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.136, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from the public-domain ANOM drawing FR CAOM 3DFC172B, Parks Canada research, OpenStreetMap location and open Natural Resources Canada elevation.',
};
