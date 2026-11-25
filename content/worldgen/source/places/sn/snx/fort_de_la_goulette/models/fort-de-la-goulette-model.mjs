import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const shape = read('native-map/fort-de-la-goulette-shape-controls');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.98 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94 },
  terrace: { slot: 'roof', graph: 'plaster_lime', roughness: 0.99 },
  court: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.98 },
  gate: { slot: 'door', graph: 'wood_plain', roughness: 0.95 },
};

const color = {
  stone: rgb('beaf93'),
  stoneWarm: rgb('b4a286'),
  base: rgb('ad9b7f'),
  trim: rgb('c0ae91'),
  foot: rgb('97856c'),
  terrace: rgb('afa28b'),
  court: rgb('a89a81'),
  shadow: rgb('655840'),
  wood: rgb('5c4940'),
};
const deckY = 8.25;
const baseY = -3.4;
const beltY = 4.45;
const omittedGateVertices = new Set([20, 27, 28]);
const outer = outwardRing(shape.outer.filter((_, i) => !omittedGateVertices.has(i)));
const courtyard = outwardRing(shape.inner);
const outerFaces = outer.map((a, i) => wallFace(a, outer[(i + 1) % outer.length]));
const canalFace = outerFaces.find(({ origin }, i) => {
  const end = outer[(i + 1) % outer.length];
  return (
    (origin === shape.outer[24] && end === shape.outer[23]) ||
    (origin === shape.outer[23] && end === shape.outer[24])
  );
});
const tint = (value, seed) => value.map((v) => v * (0.94 + 0.015 * ((seed * 11 + 3) % 9)));

function onFace(face, [x, z]) {
  const dx = x - face.origin[0];
  const dz = z - face.origin[1];
  const u = dx * face.along[0] + dz * face.along[1];
  const outside = dx * face.normal[0] + dz * face.normal[1];
  const overflow = Math.max(0, -u, u - face.length);
  return { u, distance: Math.hypot(outside, overflow) };
}

const gates = shape.gates.map((gate, i) => {
  const mapped = outerFaces
    .map((face) => ({ face, ...onFace(face, gate.point) }))
    .sort((a, b) => a.distance - b.distance)[0];
  const half = i === 0 ? 1.85 : i === 1 ? 1.37 : 1.69;
  return {
    ...mapped,
    u: Math.max(half + 0.14, Math.min(mapped.face.length - half - 0.14, mapped.u)),
    half,
    ground: gate.ground + 0.12,
  };
});

function cap(out, slot, ring, holes, y, shade) {
  if (!out.addCap(slot, 'palette:#ffffff', ring, holes, y, [0, 1, 0], (p) => p, shade)) {
    throw new Error('Fort de la Goulette terrace cannot be triangulated');
  }
}

function stoneCourse(out, F, u0, u1, i, detail) {
  const surface = (u, y, d = 0) => F.P(u, y, d);
  const batter = detail ? 1.18 : 0.82;
  quad4(
    out,
    'base',
    surface(u0, baseY, batter),
    surface(u1, baseY, batter),
    surface(u1, beltY, 0),
    surface(u0, beltY, 0),
    tint(color.base, i),
  );
  quad4(
    out,
    'wall',
    surface(u0, beltY),
    surface(u1, beltY),
    surface(u1, deckY),
    surface(u0, deckY),
    tint(i % 3 ? color.stone : color.stoneWarm, i + 5),
  );
  if (detail) {
    fbox(out, 'trim', F, u0, u1, beltY - 0.105, beltY + 0.09, -0.04, 0.155, tint(color.trim, i));
  }
  if (detail < 2 || u1 - u0 < 4.1) return;
  const count = Math.floor((u1 - u0) / (detail === 3 ? 2.4 : 4.3));
  for (let j = 0; j < count; j++) {
    const x = u0 + ((j + 0.5) * (u1 - u0)) / count;
    const y = 1.9 + 0.31 * ((j * 3 + i) % 5);
    const width = (detail === 3 ? 0.46 : 0.71) + (j % 3) * 0.17;
    const offset = (batter * (beltY - y)) / (beltY - baseY);
    const point = (dx, dy) =>
      surface(x + dx, y + dy, offset - (batter * dy) / (beltY - baseY) + 0.0025);
    quad4(
      out,
      'base',
      point(-width, 0),
      point(width, 0),
      point(width - 0.045, 0.19),
      point(-width + 0.032, 0.19),
      tint(color.base, j + i + 6),
    );
  }
}

function arch(out, F, u, half, ground, rise, spring, top, depth, level, isGate) {
  const at = (x, y, d = 0) => F.P(x + u, y, d);
  const archRadius = (p) => (p[1] / half) * rise;
  const segments = roundArch(half, [4, 5, 8, 12][level]);
  const slot = isGate ? 'wall' : 'base';
  const shade = isGate ? color.stoneWarm : color.stone;
  const skirt = isGate ? 0.34 : 0;
  for (let j = 1; j < segments.length; j++) {
    const a = segments[j - 1];
    const b = segments[j];
    const ya = spring + archRadius(a);
    const yb = spring + archRadius(b);
    const af = at(a[0], ya, skirt);
    const bf = at(b[0], yb, skirt);
    const ab = at(a[0], ya, -depth);
    const bb = at(b[0], yb, -depth);
    quad4(out, slot, af, bf, at(b[0], top, skirt), at(a[0], top, skirt), shade);
    quad4(out, slot, bb, ab, at(a[0], top, -depth), at(b[0], top, -depth), shade);
    quad4(out, 'base', bf, af, ab, bb, tint(color.shadow, j + 3));
    if (level) {
      const band = isGate ? 0.31 : 0.125;
      const edge = (p, offset) =>
        at(p[0] * (1 + offset / half), spring + archRadius(p) * (1 + offset / rise), skirt + 0.026);
      quad4(
        out,
        'trim',
        edge(a, 0),
        edge(b, 0),
        edge(b, band),
        edge(a, band),
        tint(color.trim, j + 2),
      );
    }
  }
  for (const side of [-1, 1]) {
    const x = side * half;
    const front = at(x, ground, skirt);
    const back = at(x, ground, -depth);
    const frontTop = at(x, spring, skirt);
    const backTop = at(x, spring, -depth);
    if (side < 0) quad4(out, 'base', front, frontTop, backTop, back, color.shadow);
    else quad4(out, 'base', back, backTop, frontTop, front, color.shadow);
    if (level && isGate) {
      const x2 = u + x + side * 0.31;
      fbox(
        out,
        'trim',
        F,
        Math.min(u + x, x2),
        Math.max(u + x, x2),
        ground,
        spring,
        skirt - 0.05,
        skirt + 0.026,
        color.trim,
      );
    }
  }
  if (!isGate) return;
  fbox(
    out,
    'gate',
    F,
    u - half,
    u + half,
    ground,
    spring + rise + 0.12,
    -depth - 0.13,
    -depth,
    color.wood,
  );
  fbox(out, 'base', F, u - half, u + half, baseY - 0.1, ground + 0.02, -depth, 0.65, color.foot);
  if (level >= 2) {
    for (let j = 1; j < 14; j++) {
      const x = u - half + (2 * half * j) / 14;
      fbox(out, 'gate', F, x, x + 0.025, ground, spring, -depth, -depth + 0.009, color.shadow);
    }
  }
}

function parapet(out, slot, F, a, b, y, top, back, front, shade) {
  const p = F.P;
  quad4(out, slot, p(a, y, front), p(b, y, front), p(b, top, front), p(a, top, front), shade);
  quad4(out, slot, p(b, y, back), p(a, y, back), p(a, top, back), p(b, top, back), shade);
  quad4(out, slot, p(a, top, front), p(b, top, front), p(b, top, back), p(a, top, back), shade);
}

function terraceEdge(out, F, i, level) {
  const waterBastion = F === canalFace;
  const heights = { large: 2.05, regular: 1.18, lower: 0.73 };
  const h = F.length > 22 ? (i % 3 ? heights.large : heights.regular) : heights.lower;
  const top = deckY + (waterBastion ? 2.25 : h);
  const render = (a, b) =>
    parapet(out, 'wall', F, a, b, deckY - 0.023, top, -0.67, -0.03, tint(color.stone, i));
  if (waterBastion) {
    const half = 0.52;
    let start = 0;
    for (const u of [F.length * 0.22, F.length * 0.276, F.length * 0.332]) {
      render(start, u - half);
      parapet(
        out,
        'trim',
        F,
        u - half,
        u + half,
        deckY - 0.02,
        deckY + 0.4,
        -0.69,
        0.025,
        color.trim,
      );
      arch(out, F, u, half, deckY + 0.4, 0.42, deckY + 1.11, top, 0.67, level, false);
      start = u + half;
    }
    render(start, F.length);
  } else {
    render(0, F.length);
  }
  if (level) fbox(out, 'trim', F, 0, F.length, top - 0.05, top + 0.135, -0.77, 0.105, color.trim);
}

function outlineWalls(out, level) {
  for (const [i, F] of outerFaces.entries()) {
    const next = outerFaces[(i + 1) % outerFaces.length];
    const batter = level ? 1.18 : 0.82;
    tri(
      out,
      'base',
      F.P(F.length, baseY, batter),
      next.P(0, baseY, batter),
      F.P(F.length, beltY),
      tint(color.base, i),
    );
    const openings = gates.filter((gate) => gate.face === F).sort((a, b) => a.u - b.u);
    let previous = 0;
    for (const { u, ground, half } of openings) {
      const wall = (min, max) => stoneCourse(out, F, min, max, i, level);
      wall(previous, u - half);
      arch(out, F, u, half, ground, half * 0.68, ground + 2.05, deckY, 2.15, level, true);
      previous = u + half;
    }
    stoneCourse(out, F, previous, F.length, i, level);
    terraceEdge(out, F, i, level);
  }
}

function courtyardWalls(out, level) {
  for (const [i, point] of courtyard.entries()) {
    const F = wallFace(courtyard[(i + 1) % courtyard.length], point);
    const p = F.P;
    quad4(
      out,
      'wall',
      p(0, -2.7),
      p(F.length, -2.7),
      p(F.length, deckY),
      p(0, deckY),
      tint(color.stoneWarm, i),
    );
    parapet(out, 'base', F, 0, F.length, deckY - 0.025, deckY + 0.71, -0.51, 0.015, color.stone);
    if (level)
      fbox(
        out,
        'trim',
        F,
        0,
        F.length,
        deckY + 0.67,
        deckY + 0.83,
        -0.64,
        0.11,
        tint(color.trim, i),
      );
    if (level < 2 || F.length < 8.0) continue;
    const bays = Math.round(F.length / (level === 3 ? 5.2 : 7.2));
    for (let bay = 0; bay < bays; bay++) {
      const u = ((bay + 0.5) * F.length) / bays;
      fbox(out, 'wall', F, u - 0.27, u + 0.27, 4.61, 5.55, 0.013, 0.035, color.shadow);
      fbox(out, 'trim', F, u - 0.47, u + 0.47, 4.51, 4.62, 0.02, 0.15, color.trim);
    }
  }
}

function guardTurret(out, level) {
  const [x, z] = shape.outer[24];
  const sides = [8, 11, 15, 22][level];
  const cylinder = (r, y, top, slot, shade) => {
    const ring = Array.from({ length: sides }, (_, i) => {
      const a = (i * Math.PI * 2) / sides;
      return [x + 1.62 + Math.cos(a) * r, z + 0.25 + Math.sin(a) * r];
    });
    extrude(out, slot, ring, y, top, shade);
    return outwardRing(ring);
  };
  cylinder(1.05, 7.2, 9.9, 'base', color.base);
  cylinder(1.5, 9.4, 12.48, 'wall', color.stone);
  const rim = cylinder(1.62, 12.41, 12.68, 'trim', color.trim);
  const cp = [x + 1.62, 13.53, z + 0.25];
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i];
    const b = rim[(i + 1) % rim.length];
    tri(out, 'trim', [a[0], 12.68, a[1]], [b[0], 12.68, b[1]], cp, tint(color.trim, i));
  }
}

function build(sink, level) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
  };
  cap(out, 'terrace', outer, [courtyard], () => deckY, color.terrace);
  cap(out, 'court', courtyard, [], ([x]) => 1.78 - x * 0.064, color.court);
  outlineWalls(out, level);
  courtyardWalls(out, level);
  guardTurret(out, level);
  fbox(out, 'wall', canalFace, 19.8, 38.1, deckY, deckY + 2.5, -12.2, -6.8, color.stoneWarm);
  if (level) {
    fbox(out, 'trim', canalFace, 19.6, 38.3, deckY + 2.45, deckY + 2.65, -12.4, -6.6, color.trim);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-de-la-goulette-model.mjs';
const camera = [-165, 96, 170];
const lookAt = [-5, 4.5, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-fortress',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The standing Karaka fort with continuous splayed limestone walls, irregular bastioned wings, arched openings and the curved open court.',
  camera,
  lookAt,
  sunDirection: [-55, 62, 76],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: shape.outer,
    minimumCoverage: 0.87,
    basis:
      'The named castle exterior is the full surveyed occupation perimeter around its courtyard.',
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map((surface) => surface.graph))],
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'canal-facing-bastion', position: [-108, 15, 122], lookAt: [-48, 5.7, 65] },
    { name: 'west-gate', position: [-64, 4.3, -6], lookAt: [-45, 3.1, 11] },
    { name: 'curved-courtyard', position: [17, 20, 21], lookAt: [10, 4.4, -9] },
    { name: 'eastern-fortifications', position: [125, 40, 46], lookAt: [17, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-de-la-goulette-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.75,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.034, surfaces },
    },
  },
};
