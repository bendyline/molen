import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const control = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = control('plan-controls');
const frame = control('map-frame');
const shape = control('native-map/fort-of-san-diego-shape-controls');
const outer = outwardRing(shape.counterscarp);
const cut = outwardRing(shape.wallRing);
const courtyard = outwardRing(shape.courtyard);
const outsideGate = shape.bridgeAxis[1];
const insideGate = shape.bridgeAxis[0];
const bridgeEnd = shape.bridgeAxis[2];
const crest = shape.ramparts.mappedWallCrest;
const parapet = shape.ramparts.parapetTop;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.98 },
  render: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  paving: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.94 },
  grass: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98 },
  pale: { slot: 'trim', graph: 'concrete_plain', roughness: 0.89 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
};
const stone = rgb('a1937b');
const darkerStone = rgb('837962');
const chalk = rgb('d7cdb0');
const plaster = rgb('bfb79d');
const cobble = rgb('a89d88');
const capStone = rgb('b9a990');
const dirt = rgb('999271');
const door = rgb('4b3c2e');
const iron = rgb('4f4c3e');

function nearGround(point) {
  const ranks = shape.counterscarp.map(([x, z], i) => [
    Math.hypot(x - point[0], z - point[1]),
    shape.outerGroundSamples[i],
  ]);
  ranks.sort(([a], [b]) => a - b);
  if (ranks[0][0] < 0.001) return ranks[0][1];
  const nearest = ranks.slice(0, 3);
  const sum = nearest.reduce((n, [d]) => n + 1 / d, 0);
  return nearest.reduce((n, [d, y]) => n + y / d, 0) / sum;
}

const floorHeight = (point) =>
  Math.min(shape.ramparts.approximateMoatFloor, nearGround(point) - 0.64);

function offset(ring, distance) {
  return ring.map((p, i) => {
    const prev = wallFace(ring[(i + ring.length - 1) % ring.length], p).normal;
    const next = wallFace(p, ring[(i + 1) % ring.length]).normal;
    const denominator = Math.max(0.48, 1 + prev[0] * next[0] + prev[1] * next[1]);
    return [
      p[0] + (distance * (prev[0] + next[0])) / denominator,
      p[1] + (distance * (prev[1] + next[1])) / denominator,
    ];
  });
}

const scarpFoot = offset(cut, 1.46);
const innerParapet = offset(cut, -0.86);
const rimToe = offset(outer, -1.07);
const rims = outer.map((p) => [p[0], nearGround(p) + 0.015, p[1]]);
const floorRing = rimToe.map((p) => [p[0], floorHeight(p), p[1]]);

function cap(out, slot, outline, holes, height, color) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(outline),
      holes.map((r) => outwardRing(r).reverse()),
      height,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Fort surface outline could not be triangulated');
  const { positions, indices } = b.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = [];
    for (let j = 0; j < 3; j++) {
      const n = indices[i + j] * 3;
      vertices.push([positions[n], positions[n + 1], positions[n + 2]]);
    }
    tri(out, slot, ...vertices, color);
  }
}

function skin(out, slot, base, top, lower, upper, color, inside = false, spread = 0.0) {
  const sideColors = [
    color,
    color.map((part) => part * (1 - spread)),
    color.map((part) => part * (1 + spread)),
  ];
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    const points = [
      [base[i][0], lower(base[i]), base[i][1]],
      [base[j][0], lower(base[j]), base[j][1]],
      [top[j][0], upper(top[j]), top[j][1]],
      [top[i][0], upper(top[i]), top[i][1]],
    ];
    quad4(out, slot, ...(inside ? points.reverse() : points), sideColors[i % sideColors.length]);
  }
}

function moat(out, level) {
  cap(out, 'grass', rimToe, [scarpFoot], floorHeight, dirt);
  for (let i = 0; i < rims.length; i++) {
    const j = (i + 1) % rims.length;
    quad4(out, 'rubble', floorRing[j], floorRing[i], rims[i], rims[j], darkerStone);
    if (level >= 2) {
      const a = rims[i],
        b = rims[j],
        c = floorRing[j],
        d = floorRing[i];
      const interpolate = (p, q, t) => p.map((v, k) => v + (q[k] - v) * t);
      const lip = 0.035;
      const p = interpolate(a, d, 0.19),
        q = interpolate(b, c, 0.19);
      const pre = interpolate(a, d, 0.095),
        post = interpolate(b, c, 0.095);
      const moveSide = ([x, y, z]) => [x + (d[0] - a[0]) * lip, y, z + (d[2] - a[2]) * lip];
      quad4(out, 'stone', moveSide(p), moveSide(q), moveSide(post), moveSide(pre), capStone);
    }
  }
  cap(out, 'paving', courtyard, [], () => 0.02, cobble);
}

function wallGeometry(out, level) {
  skin(out, 'stone', scarpFoot, cut, floorHeight, () => crest, stone, false, 0.043);
  const faceBand = offset(cut, 0.16);
  skin(
    out,
    'stone',
    faceBand,
    cut,
    () => crest - 0.42,
    () => crest + 0.018,
    capStone,
  );
  skin(
    out,
    'render',
    cut,
    cut,
    () => crest,
    () => parapet - 0.235,
    chalk,
  );
  skin(
    out,
    'pale',
    cut,
    cut,
    () => parapet - 0.235,
    () => parapet,
    chalk,
  );
  skin(
    out,
    'render',
    innerParapet,
    innerParapet,
    () => crest,
    () => parapet,
    chalk,
    true,
  );
  cap(out, 'pale', cut, [innerParapet], () => parapet, chalk);
  cap(out, 'paving', innerParapet, [courtyard], () => crest, cobble);
  skin(
    out,
    'render',
    courtyard,
    courtyard,
    () => 0.02,
    () => crest,
    plaster,
    true,
    0.025,
  );
  if (level >= 1) {
    const ring = offset(cut, 0.088);
    skin(
      out,
      'pale',
      ring,
      ring,
      () => crest + 0.21,
      () => crest + 0.44,
      chalk,
    );
    const flush = offset(courtyard, -0.028);
    skin(
      out,
      'pale',
      flush,
      flush,
      () => crest - 0.16,
      () => crest + 0.005,
      capStone,
      true,
    );
  }
}

function segmentalDoor(out, f, u) {
  const half = 1.21,
    base = 0.38,
    spring = 3.23,
    rise = 0.53,
    finish = 0.344,
    frameWidth = 0.2;
  const radius = (half * half + rise * rise) / (2 * rise);
  const at = (x) => spring + Math.sqrt(radius * radius - x * x) - radius + rise;
  quad4(
    out,
    'timber',
    f.P(u - half, base, finish),
    f.P(u + half, base, finish),
    f.P(u + half, spring, finish),
    f.P(u - half, spring, finish),
    door,
  );
  for (const x of [u - half - frameWidth / 2, u + half + frameWidth / 2])
    fbox(out, 'pale', f, x - frameWidth / 2, x + frameWidth / 2, base, spring, 0.24, 0.54, chalk);
  for (let i = 0; i < 9; i++) {
    const a = -half + (2 * half * i) / 9,
      b = -half + (2 * half * (i + 1)) / 9;
    quad4(
      out,
      'timber',
      f.P(u + a, spring - 0.06, finish),
      f.P(u + b, spring - 0.06, finish),
      f.P(u + b, at(b), finish),
      f.P(u + a, at(a), finish),
      door,
    );
    quad4(
      out,
      'pale',
      f.P(u + a, at(a) - 0.025, 0.54),
      f.P(u + b, at(b) - 0.025, 0.54),
      f.P(u + b, at(b) + frameWidth, 0.54),
      f.P(u + a, at(a) + frameWidth, 0.54),
      chalk,
    );
  }
  fbox(
    out,
    'iron',
    f,
    u - 0.027,
    u + 0.027,
    base,
    spring + rise - 0.025,
    finish,
    finish + 0.028,
    iron,
  );
}

function portals(out, level) {
  const gateFront = wallFace(
    [outsideGate[0] - 3.35, outsideGate[1] + 0.99],
    [outsideGate[0] + 3.35, outsideGate[1] + 0.99],
  );
  const center = gateFront.length / 2;
  fbox(out, 'stone', gateFront, center - 2.4, center + 2.4, 0.21, 4.34, -0.91, 0.29, capStone);
  fbox(out, 'pale', gateFront, center - 2.69, center + 2.69, 4.09, 4.36, -0.26, 0.5, chalk);
  const width = 4.99,
    tip = 5.28;
  tri(
    out,
    'pale',
    gateFront.P(center - width / 2, 4.36, 0.32),
    gateFront.P(center + width / 2, 4.36, 0.32),
    gateFront.P(center, tip, 0.32),
    chalk,
  );
  if (level === 0) {
    quad4(
      out,
      'timber',
      gateFront.P(center - 1.11, 0.39, 0.321),
      gateFront.P(center + 1.11, 0.39, 0.321),
      gateFront.P(center + 1.11, 3.41, 0.321),
      gateFront.P(center - 1.11, 3.41, 0.321),
      door,
    );
    return;
  }
  segmentalDoor(out, gateFront, center);
  for (const dx of [-1.91, 1.91]) {
    fbox(
      out,
      'pale',
      gateFront,
      center + dx - 0.28,
      center + dx + 0.28,
      0.42,
      4.08,
      0.29,
      0.57,
      chalk,
    );
    fbox(
      out,
      'pale',
      gateFront,
      center + dx - 0.44,
      center + dx + 0.44,
      0.37,
      0.79,
      0.26,
      0.66,
      chalk,
    );
    fbox(
      out,
      'pale',
      gateFront,
      center + dx - 0.36,
      center + dx + 0.36,
      3.94,
      4.09,
      0.28,
      0.63,
      chalk,
    );
  }
  if (level >= 2) {
    for (const [l, r, y0, y1] of [
      [-width / 2, 0, 4.36, tip],
      [0, width / 2, tip, 4.36],
    ]) {
      quad4(
        out,
        'pale',
        gateFront.P(center + l, y0 - 0.066, 0.47),
        gateFront.P(center + r, y1 - 0.066, 0.47),
        gateFront.P(center + r, y1 + 0.11, 0.47),
        gateFront.P(center + l, y0 + 0.11, 0.47),
        chalk,
      );
    }
    for (const [dx, y] of [
      [-2.21, 4.54],
      [0, 5.37],
      [2.21, 4.54],
    ]) {
      fbox(
        out,
        'pale',
        gateFront,
        center + dx - 0.17,
        center + dx + 0.17,
        y - 0.14,
        y + 0.075,
        0.17,
        0.46,
        chalk,
      );
      const [x, , z] = gateFront.P(center + dx, 0, 0.36);
      lathe(
        out,
        'pale',
        [x, z],
        [
          [y + 0.07, 0.13, 0.13],
          [y + 0.2, 0.167, 0.167],
          [y + 0.35, 0.09, 0.09],
          [y + 0.4, 0, 0],
        ],
        level === 3 ? 8 : 5,
        chalk,
        { capTop: false },
      );
    }
  }
}

function masonryBridge(out, level) {
  const width = 2.3;
  const begin = outsideGate[1] + 0.52;
  const end = bridgeEnd[1] + 0.34;
  const x = (bridgeEnd[0] + outsideGate[0]) / 2;
  abox(out, 'stone', [x - width, -0.42, begin], [x + width, 0.47, end], stone);
  abox(
    out,
    'paving',
    [x - width - 0.03, 0.42, begin - 0.1],
    [x + width + 0.03, 0.525, end + 0.08],
    cobble,
  );
  const side = [
    [x - width, x - width + 0.25],
    [x + width - 0.25, x + width],
  ];
  for (const [a, b] of side) {
    abox(out, 'stone', [a, 0.49, begin], [b, 1.43, end], stone);
    abox(out, 'pale', [a - 0.065, 1.41, begin - 0.01], [b + 0.065, 1.55, end + 0.02], capStone);
  }
  for (const z of [begin + 4.8, end - 4.7]) {
    abox(
      out,
      'rubble',
      [x - width + 0.11, floorHeight([x, z]) - 0.1, z - 0.62],
      [x + width - 0.11, -0.43, z + 0.62],
      darkerStone,
    );
    if (level >= 2)
      abox(
        out,
        'stone',
        [x - width - 0.033, -0.69, z - 0.91],
        [x + width + 0.035, -0.45, z + 0.91],
        capStone,
      );
  }
  abox(out, 'paving', [x - width - 0.55, 0.06, end], [x + width + 0.55, 0.52, end + 1.3], capStone);
  if (level >= 3) {
    for (let z = begin + 0.41; z < end - 0.13; z += 1.08) {
      abox(
        out,
        'stone',
        [x - width + 0.11, 0.521, z],
        [x + width - 0.11, 0.526, z + 0.053],
        darkerStone,
      );
    }
  }
}

function gallery(out, level) {
  if (level < 1) return;
  const inner = outwardRing(courtyard).reverse();
  for (let i = 0; i < inner.length; i++) {
    const f = wallFace(inner[i], inner[(i + 1) % inner.length]);
    if (f.length < 6.21) continue;
    const count = Math.max(1, Math.round(f.length / 3.79));
    for (let j = 0; j < count; j++) {
      const u = (f.length * (j + 0.5)) / count;
      const [x, , z] = f.P(u, 0);
      const tall = Math.hypot(x - insideGate[0], z - insideGate[1]) < 2.81;
      const w = tall ? 2.49 : 1.61;
      if (level === 1) {
        quad4(
          out,
          'timber',
          f.P(u - w / 2, 0.17, 0.04),
          f.P(u + w / 2, 0.17, 0.04),
          f.P(u + w / 2, 2.51, 0.04),
          f.P(u - w / 2, 2.51, 0.04),
          door,
        );
      } else {
        const y = tall ? 3.64 : 2.61;
        opening(out, f, u, 0.17, w, y, {
          head: 'round',
          glassSlot: 'timber',
          frameSlot: 'pale',
          glass: door,
          frame: chalk,
          frameWidth: tall ? 0.18 : 0.102,
          frameDepth: 0.17,
          d: 0.045,
          sill: false,
          mullions: level === 3 ? 1 : 0,
          mullionColor: iron,
        });
        fbox(out, 'stone', f, u - w * 0.61, u + w * 0.61, 0.037, 0.174, -0.07, 0.45, capStone);
      }
    }
  }
}

function sentry(out, x, z, level) {
  const sides = level === 0 ? 5 : level === 3 ? 12 : 7;
  lathe(
    out,
    'pale',
    [x, z],
    [
      [crest, 0.96, 0.96],
      [crest + 0.32, 0.92, 0.92],
      [crest + 0.47, 0.61, 0.61],
      [crest + 2.69, 0.61, 0.61],
      [crest + 2.84, 0.72, 0.72],
      [crest + 3.39, 0, 0],
    ],
    sides,
    chalk,
    { capTop: false },
  );
  if (level < 2) return;
  const f = wallFace([x - 0.54, z + 0.5], [x + 0.54, z + 0.5]);
  const u = f.length / 2;
  opening(out, f, u, crest + 0.83, 0.181, 0.6, {
    head: 'round',
    glassSlot: 'timber',
    frameSlot: 'stone',
    glass: door,
    frame: chalk,
    frameWidth: 0.061,
    frameDepth: 0.094,
    d: 0.032,
    sill: false,
  });
}

function build(out, level) {
  moat(out, level);
  wallGeometry(out, level);
  portals(out, level);
  masonryBridge(out, level);
  gallery(out, level);
  for (const [x, z] of [
    [-29.32, 43.8],
    [-50.81, -18.3],
    [-0.12, -56.4],
    [51.46, -16.45],
    [32.99, 44.6],
  ])
    sentry(out, x, z, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-of-san-diego-model.mjs';
const camera = [93, 98, 134];
const lookAt = [0, 1, -1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-fort-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Standing Acapulco coastal fortress with five stone points, dry moat, an open museum court and a masonry approach to its neoclassical gate.',
  camera,
  lookAt,
  sunDirection: [-36, 45, 31],
  mediumFiContext: {
    scale: 1.17,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: outer,
    basis:
      'The model supplies the dry moat floor and museum paving inside the native counterscarp. The headland remains outside the mapped edge.',
  },
  buildingCutout: {
    outline: cut,
    minimumCoverage: 0.86,
    basis: 'Replace only the mapped historic fort body at the Acapulco museum.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'public-bridge-and-neoclassical-gate', position: [23, 12, 63], lookAt: [0, 3, 31] },
    { name: 'museum-court-and-stone-galleries', position: [-24, 30, 32], lookAt: [0, 1, -6] },
    { name: 'coastal-bastion-and-dry-moat', position: [76, 35, -44], lookAt: [26, 0, -13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-of-san-diego-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.57, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.071, surfaces },
    },
  },
};
