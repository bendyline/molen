import fs from 'node:fs';
import {
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
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, stageHeight, stageCrown } = plan.dimensions;
const surfaces = {
  cast: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92 },
  tile: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.95 },
  exposed: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93 },
  opening: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.84 },
  grass: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.96 },
};
const concrete = rgb('b6ad9a');
const stageStone = rgb('c6bfae');
const pale = rgb('cec6b5');
const base = rgb('a29a8a');
const bench = rgb('aaa293');
const aisle = rgb('b7ad99');
const deck = rgb('918984');
const shadow = rgb('5e5548');
const grass = rgb('7d895c');
const center = [-10.47, -0.26];

function box(out, slot, x0, x1, z0, z1, low, high, color) {
  abox(out, slot, [x0, low, z0], [x1, high, z1], color, { bottom: false });
}
const edge = outline
  .slice(2, 24)
  .reverse()
  .map(([x, z]) => {
    const dx = x - center[0],
      dz = z - center[1];
    return [Math.atan2(dz, dx), Math.hypot(dx, dz)];
  });
const northLimit = edge[0][0],
  southLimit = edge.at(-1)[0];

function radius(angle) {
  if (angle >= southLimit) return edge.at(-1)[1];
  const i = Math.max(
    1,
    edge.findIndex(([a]) => a >= angle),
  );
  const [start, r0] = edge[i - 1],
    [finish, r1] = edge[i];
  return r0 + ((r1 - r0) * (angle - start)) / (finish - start);
}
const point = (angle, distance, y) => [
  center[0] + Math.cos(angle) * distance,
  y,
  center[1] + Math.sin(angle) * distance,
];
const widthAt = (angle, t) => 14.5 + (radius(angle) - 1.81 - 14.5) * t;
const tierHeight = (t) => 2.39 + t * (9.95 + 0.97 * t);
function band(out, slot, a0, a1, inner0, inner1, outer0, outer1, low, high, color) {
  quad4(
    out,
    slot,
    point(a0, inner0, high),
    point(a1, inner1, high),
    point(a1, outer1, high),
    point(a0, outer0, high),
    color,
  );
  quad4(
    out,
    slot,
    point(a0, inner0, low),
    point(a1, inner1, low),
    point(a1, inner1, high),
    point(a0, inner0, high),
    color,
  );
}
function bowl(out, lod) {
  const rows = [5, 10, 19, 19][lod];
  const wedges = lod === 0 ? 14 : lod === 1 ? 22 : lod === 2 ? 35 : 57;
  const sweep = southLimit - northLimit;
  for (let i = 0; i < wedges; i++) {
    const a0 = northLimit + (i * sweep) / wedges,
      a1 = northLimit + ((i + 1) * sweep) / wedges;
    for (let row = 0; row < rows; row++) {
      const u = row / rows,
        v = (row + 1) / rows;
      const lo = row === 0 ? stageHeight - 0.72 : tierHeight(u) - 0.006;
      const high = tierHeight(v);
      const r0 = widthAt(a0, u),
        r1 = widthAt(a1, u),
        s0 = widthAt(a0, v),
        s1 = widthAt(a1, v);
      const stair =
        lod >= 2 &&
        Math.abs(((i + 0.5) * 11) / wedges - Math.round(((i + 0.5) * 11) / wedges)) < 0.13;
      band(out, 'tile', a0, a1, r0, r1, s0, s1, lo, high, stair ? aisle : bench);
      if (lod === 3 && !stair) {
        const step = Math.min(0.53, (s0 - r0) * 0.35);
        band(
          out,
          'cast',
          a0,
          a1,
          s0 - step,
          s1 - step,
          s0 - 0.033,
          s1 - 0.033,
          high,
          high + 0.16,
          concrete,
        );
      }
    }
    const r0 = widthAt(a0, 1),
      r1 = widthAt(a1, 1),
      s0 = radius(a0),
      s1 = radius(a1);
    band(out, 'grass', a0, a1, r0, r1, s0, s1, tierHeight(1), tierHeight(1) + 0.3, grass);
    quad4(
      out,
      'exposed',
      point(a1, s1, foundation),
      point(a0, s0, foundation),
      point(a0, s0, tierHeight(1) + 0.29),
      point(a1, s1, tierHeight(1) + 0.29),
      concrete,
    );
    if (lod > 0)
      band(
        out,
        'trim',
        a0,
        a1,
        s0 - 0.38,
        s1 - 0.38,
        s0,
        s1,
        tierHeight(1) + 0.3,
        tierHeight(1) + 0.55,
        pale,
      );
  }
  for (const side of [northLimit, southLimit]) {
    const high = tierHeight(1) + 0.3;
    const facePoint = point(side, 14.35, 0);
    const F = facade([facePoint[0], facePoint[2]], [Math.cos(side), Math.sin(side)]);
    for (let i = 0; i < (lod === 0 ? 5 : 19); i++) {
      const steps = lod === 0 ? 5 : 19;
      const a = i / steps,
        b = (i + 1) / steps;
      const left = widthAt(side, a) - 14.5,
        right = widthAt(side, b) - 14.5;
      fbox(
        out,
        'exposed',
        F,
        left,
        right,
        foundation,
        Math.min(high, tierHeight(b) + 0.15),
        -0.28,
        0.28,
        base,
      );
    }
  }
}

function orchestra(out, lod) {
  const y = stageHeight - 0.75;
  const sides = lod === 0 ? 12 : lod === 1 ? 20 : 36;
  for (let i = 0; i < sides; i++) {
    const a0 = (i * 2 * Math.PI) / sides,
      a1 = ((i + 1) * 2 * Math.PI) / sides;
    const ring = point(a0, 14.53, y),
      next = point(a1, 14.53, y);
    tri(out, 'tile', [center[0], y, center[1]], next, ring, aisle);
    quad4(
      out,
      'exposed',
      [next[0], foundation, next[2]],
      [ring[0], foundation, ring[2]],
      ring,
      next,
      base,
    );
  }
}
function pilaster(out, x, z, low, high, lod) {
  const n = [5, 8, 12, 16][lod];
  const ring = (y, r) => radialRing(y, r, r, n, [x, z], Math.PI / 6);
  loft(out, 'trim', [ring(low, 0.58), ring(high - 0.34, 0.46), ring(high, 0.55)], pale, {
    cap: false,
  });
  box(out, 'trim', x - 0.56, x + 0.58, z - 0.64, z + 0.64, high - 0.02, high + 0.29, pale);
  if (lod > 1)
    box(out, 'wall', x - 0.31, x + 0.29, z - 0.39, z + 0.39, low - 0.15, low + 0.01, stageStone);
}
function monumentalDoor(out, F, zOffset, w, h, lod) {
  opening(out, F, zOffset, stageHeight + 0.06, w, h, {
    glassSlot: 'opening',
    frameSlot: 'trim',
    glass: shadow,
    frame: pale,
    frameWidth: lod > 0 ? 0.16 : 0,
    frameDepth: 0.24,
    d: 0.026,
    sill: false,
  });
  fbox(
    out,
    'trim',
    F,
    zOffset - w / 2 - 0.2,
    zOffset + w / 2 + 0.2,
    stageHeight + h + 0.04,
    stageHeight + h + 0.43,
    0.02,
    0.31,
    stageStone,
  );
}
function stage(out, lod) {
  box(out, 'exposed', -29.17, -10.34, -22.1, 21.88, foundation, stageHeight, deck);
  box(
    out,
    'cast',
    -30.85,
    -27.55,
    -22.03,
    21.88,
    stageHeight - 0.08,
    stageCrown - 0.69,
    stageStone,
  );
  box(out, 'trim', -30.99, -27.22, -22.12, 22, stageCrown - 1.05, stageCrown - 0.22, pale);
  box(out, 'roof', -31.13, -27.11, -22.25, 22.12, stageCrown - 0.25, stageCrown - 0.04, concrete);
  const front = facade([-27.54, -0.12], [0, -1]);
  for (const end of [-1, 1]) {
    const z = 21.08 * end;
    box(
      out,
      'wall',
      -27.63,
      -16.21,
      z - 0.74,
      z + 0.74,
      stageHeight,
      stageCrown - 0.59,
      stageStone,
    );
    box(out, 'trim', -28.02, -15.74, z - 0.84, z + 0.84, stageCrown - 1.09, stageCrown - 0.2, pale);
    box(out, 'wall', -17.22, -15.32, z - 1.33, z + 1.33, stageHeight, stageCrown, stageStone);
    box(
      out,
      'trim',
      -17.39,
      -15.13,
      z - 1.44,
      z + 1.44,
      stageCrown - 0.78,
      stageCrown + 0.12,
      pale,
    );
    if (lod > 0)
      for (const x of [-25.88, -22.78, -19.64])
        pilaster(out, x, z - end * 0.69, stageHeight, stageCrown - 1.11, lod);
  }
  for (const u of [-17.1, -13.57, -10.1, -6.62, -3.11, 3.11, 6.62, 10.1, 13.57, 17.1]) {
    if (lod === 0 && Math.round(Math.abs(u) * 10) % 2 === 0) continue;
    const [x, , z] = front.P(u, 0, 0.31);
    pilaster(out, x, z, stageHeight, stageCrown - 1.09, lod);
  }
  monumentalDoor(out, front, 0, 3.17, 5.38, lod);
  for (const u of [-18.65, 18.65]) monumentalDoor(out, front, u, 1.71, 3.72, lod);
  if (lod > 1) {
    for (let i = -15; i <= 15; i++) {
      const u = i * 1.23;
      fbox(
        out,
        'trim',
        front,
        u - 0.13,
        u + 0.13,
        stageCrown - 1.35,
        stageCrown - 0.97,
        0.04,
        0.29,
        pale,
      );
    }
  }
  for (let step = 0; step < (lod === 0 ? 1 : 5); step++)
    box(
      out,
      'tile',
      -12.07,
      -6.97 + step * 0.21,
      -17.8,
      17.7,
      stageHeight - 1.07,
      stageHeight - 0.72 + step * 0.14,
      aisle,
    );
}
function wings(out, lod) {
  for (const [z0, z1] of [
    [-38.05, -22.12],
    [22.1, 38.56],
  ]) {
    const z = (z0 + z1) / 2;
    const wall = [
      [-13.06, z0],
      [-10.48, z0],
      [-10.48, z1],
      [-13.06, z1],
    ];
    extrude(out, 'exposed', wall, foundation, stageHeight + 3.28, base, { top: false });
    box(out, 'trim', -13.24, -10.3, z0, z1, stageHeight + 3.25, stageHeight + 3.58, concrete);
    if (lod > 0)
      box(out, 'tile', -20.69, -13.03, z - 5.6, z + 5.6, foundation, stageHeight - 0.14, aisle);
  }
}
function build(out, lod) {
  orchestra(out, lod);
  stage(out, lod);
  wings(out, lod);
  bowl(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'hearst-greek-theatre-model.mjs';
const camera = [105, 55, 45];
const lookAt = [-6, 6, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The open-air Hearst Greek Theatre, with the natural hillside bowl, concrete bench tiers and three-sided Doric stage.',
  camera,
  lookAt,
  sunDirection: [48, 54, -34],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'Individually mapped theatre bowl and stage footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'open-bowl-and-doric-stage', position: camera, lookAt },
    { name: 'stage-enclosure-and-monumental-door', position: [10, 13, 18], lookAt: [-23, 6, -2] },
    { name: 'stepped-concrete-audience-bowl', position: [-65, 35, 53], lookAt: [5, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hearst-greek-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.58, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
