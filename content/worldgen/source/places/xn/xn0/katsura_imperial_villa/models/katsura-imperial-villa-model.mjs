import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/katsura-plan-controls');
const surfaces = {
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.87 },
  paper: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  earth: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  footing: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  bark: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.95 },
  reed: { slot: 'roof', graph: 'wood_board_batten', roughness: 0.96 },
  straw: { slot: 'trim', graph: 'wood_plain', roughness: 0.96 },
  bamboo: { slot: 'trim', graph: 'wood_vertical', roughness: 0.91 },
};
const brown = rgb('49382d');
const wood = rgb('70513c');
const shadow = rgb('3b3126');
const cream = rgb('e0d7bf');
const clay = rgb('a0866b');
const stone = rgb('8a8171');
const bark = rgb('565049');
const reed = rgb('8b7961');
const straw = rgb('b9a580');
const bamboo = rgb('8b8b69');

function axes(degrees) {
  const angle = (degrees * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    fromPlan: ([u, v]) => [c * u - s * v, s * u + c * v],
    toPlan: ([x, z]) => [c * x + s * z, -s * x + c * z],
    along: [c, s],
  };
}

function box(out, slot, A, u0, v0, u1, v1, low, high, color) {
  const edge = facade(A.fromPlan([0, v1]), A.along);
  fbox(out, slot, edge, u0, u1, low, high, v0 - v1, 0, color);
}

function hipGable(out, A, rectangle, base, ridge, material, tone, openHip = false) {
  const [u0, v0, u1, v1] = rectangle;
  let ring = [
    [u0, v1],
    [u1, v1],
    [u1, v0],
    [u0, v0],
  ];
  if (v1 - v0 > u1 - u0) ring = [...ring.slice(1), ring[0]];
  const blend = (p, q, amount) => p.map((val, i) => val + (q[i] - val) * amount);
  const put = (p, y) => {
    const [x, z] = A.fromPlan(p);
    return [x, y, z];
  };
  const [a, b, c, d] = ring;
  const mid0 = blend(a, d, 0.5);
  const mid1 = blend(b, c, 0.5);
  const top0 = blend(mid0, mid1, 0.16);
  const top1 = blend(mid1, mid0, 0.16);
  const lowerGable = openHip ? 0.51 : 0.63;
  const hipHeight = base + (ridge - base) * lowerGable;
  const l = blend(a, top0, lowerGable);
  const r = blend(b, top1, lowerGable);
  const rBack = blend(c, top1, lowerGable);
  const lBack = blend(d, top0, lowerGable);
  const [la, rb, rc, ld] = [l, r, rBack, lBack].map((p) => put(p, hipHeight));
  const [e0, e1, e2, e3] = ring.map((p) => put(p, base));
  const [t0, t1] = [top0, top1].map((p) => put(p, ridge));
  quad4(out, material, e0, e1, rb, la, tone);
  quad4(out, material, e1, e2, rc, rb, tone);
  quad4(out, material, e2, e3, ld, rc, tone);
  quad4(out, material, e3, e0, la, ld, tone);
  quad4(out, material, la, rb, t1, t0, tone);
  quad4(out, material, rc, ld, t0, t1, tone);
  tri(out, 'timber', rb, rc, t1, brown);
  tri(out, 'timber', ld, la, t0, brown);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    quad4(
      out,
      'timber',
      put(p, base - 0.16),
      put(q, base - 0.16),
      put(q, base),
      put(p, base),
      brown,
    );
  }
  const [x0, z0] = A.fromPlan(top0);
  const [x1, z1] = A.fromPlan(top1);
  fbox(
    out,
    material,
    facade([x0, z0], [x1 - x0, z1 - z0]),
    -0.17,
    Math.hypot(x1 - x0, z1 - z0) + 0.17,
    ridge - 0.025,
    ridge + 0.075,
    -0.1,
    0.1,
    tone,
  );
}

function facing(out, F, slot, begin, end, bottom, top, depth, color) {
  quad4(
    out,
    slot,
    F.P(begin, bottom, depth),
    F.P(end, bottom, depth),
    F.P(end, top, depth),
    F.P(begin, top, depth),
    color,
  );
}

function shoji(out, F, left, right, base, top, level, depth = 0.04) {
  facing(out, F, 'paper', left, right, base, top, depth, cream);
  facing(out, F, 'timber', left, right, base, base + 0.38, depth + 0.012, wood);
  if (level < 2) return;
  for (let i = 1; i < 4; i++) {
    const u = left + ((right - left) * i) / 4;
    facing(out, F, 'timber', u - 0.014, u + 0.014, base + 0.38, top, depth + 0.018, brown);
  }
  for (let i = 1; i < (level === 3 ? 6 : 3); i++) {
    const y = base + 0.38 + ((top - base - 0.38) * i) / (level === 3 ? 6 : 3);
    facing(out, F, 'timber', left, right, y - 0.013, y + 0.013, depth + 0.018, brown);
  }
}

function residenceWalls(out, ring, floor, inside, level) {
  const edges = inside ? outwardRing(ring).reverse() : outwardRing(ring);
  for (const [i, p] of edges.entries()) {
    const F = wallFace(p, edges[(i + 1) % edges.length]);
    const eave = 4.1;
    if (level === 0) {
      facing(out, F, 'timber', 0, F.length, 0.14, floor + 0.08, 0.03, shadow);
      facing(out, F, 'paper', 0, F.length, floor + 0.08, eave, 0.04, cream);
      continue;
    }
    const bayCount = Math.max(1, Math.round(F.length / (level === 0 ? 4.9 : 1.96)));
    const bay = F.length / bayCount;
    facing(out, F, 'timber', 0, F.length, 0.14, floor + 0.05, 0.028, shadow);
    facing(out, F, 'paper', 0, F.length, floor + 0.05, eave - 0.1, 0.036, cream);
    facing(out, F, 'timber', 0, F.length, floor + 0.05, floor + 0.16, 0.049, brown);
    facing(out, F, 'timber', 0, F.length, 3.38, 3.51, 0.05, brown);
    for (let j = 0; j < bayCount; j++) {
      const u = j * bay;
      const width = level < 2 ? 0.085 : 0.11;
      facing(out, F, 'timber', u, u + width, floor, eave - 0.02, 0.055, brown);
      if ((i + j) % 4 === 1)
        facing(out, F, 'timber', u + width, u + bay - 0.027, floor + 0.16, 3.39, 0.057, wood);
      else if (bay > 1.08 && level >= 1)
        shoji(out, F, u + width, u + bay - 0.036, floor + 0.16, 3.39, level, 0.06);
      if (level === 3 && !inside && bay > 1.05) {
        for (let k = 1; k < 8; k++) {
          const a = u + (bay * k) / 8;
          facing(out, F, 'timber', a, a + 0.024, 0.35, floor - 0.06, 0.045, wood);
        }
      }
    }
  }
}

function residence(out, level) {
  const A = axes(site.shoin.angleDegrees);
  const perimeter = site.shoin.outline;
  const court = site.courtyard.outline;
  const floor = 1.42;
  extrude(out, 'footing', perimeter, 0.05, 0.51, stone, { holes: [court], top: false });
  residenceWalls(out, perimeter, floor, false, level);
  residenceWalls(out, court, floor, true, level);

  // The staggered roof volumes link around the open court. Each ridge follows
  // the parallel walls of its own section of the mapped outer perimeter.
  const roofs = [
    [[-10.5, 30.65, 1.64, 46.62], 6.76],
    [[-8.38, 37.8, 1.28, 56.43], 6.23],
    [[-6.85, 47.31, 11.07, 56.72], 6.18],
    [[7.92, 49.75, 21.39, 64.15], 7.12],
    [[1.54, 56.25, 14.12, 72.38], 6.9],
    [[-18.02, 58.54, -5.48, 76.12], 6.48],
    [[-19.28, 68.15, 6.5, 78.66], 7.01],
    [[-21.38, 77.72, 1.9, 89.24], 7.38],
  ];
  for (const [rectangle, ridge] of roofs) hipGable(out, A, rectangle, 4.07, ridge, 'bark', bark);
  const engawa = facade(A.fromPlan([1.11, 31.4]), [-A.along[1], A.along[0]]);
  fbox(out, 'timber', engawa, 0, 15.1, floor - 0.15, floor, -1.25, 0.02, brown);
  const deck = [1.1, 34.3, 3.83, 42.85];
  box(out, 'timber', A, ...deck, floor - 0.16, floor + 0.022, wood);
  const { fromPlan } = A;
  const platformEdge = facade(fromPlan([1.12, 42.85]), A.along);
  fbox(out, 'timber', platformEdge, -0.03, 2.71, floor - 0.19, floor + 0.02, -8.55, -8.41, wood);
  if (level >= 1) {
    for (let i = 0; i < (level === 3 ? 29 : 13); i++) {
      const v = 34.38 + i * (level === 3 ? 0.29 : 0.64);
      box(out, 'bamboo', A, 1.15, v, 3.82, v + 0.037, floor + 0.02, floor + 0.038, straw);
    }
  }
  for (const u of [1.37, 3.58])
    for (const v of [34.48, 42.5])
      box(out, 'timber', A, u - 0.15, v - 0.14, u + 0.15, v + 0.14, 0.35, floor - 0.15, brown);
}

function pavilion(out, part, level, westBank) {
  const A = axes(part.angleDegrees);
  const rim = outwardRing(part.outline);
  const floor = westBank ? 1.79 : 0.64;
  const eave = floor + (westBank ? 2.65 : 2.8);
  const projected = rim.map(A.toPlan);
  const coordinates = (i) => projected.map((p) => p[i]);
  const u0 = Math.min(...coordinates(0));
  const v0 = Math.min(...coordinates(1));
  const u1 = Math.max(...coordinates(0));
  const v1 = Math.max(...coordinates(1));
  const openingFacesPond = (F) => (westBank ? F.normal[0] : -F.normal[0]) > 0.37;
  extrude(out, 'timber', rim, floor - 0.2, floor, brown, { top: false });
  const cap = new MeshBufferBuilder();
  if (
    !cap.addCap(
      'straw',
      'palette:#ffffff',
      rim,
      [],
      () => floor,
      [0, 1, 0],
      (p) => p,
      straw,
    )
  )
    throw new Error('Invalid teahouse floor outline');
  const mesh = cap.finalize();
  const point = (i) => [...mesh.positions.subarray(i * 3, i * 3 + 3)];
  for (let i = 0; i < mesh.indices.length; i += 3)
    tri(
      out,
      'straw',
      point(mesh.indices[i]),
      point(mesh.indices[i + 1]),
      point(mesh.indices[i + 2]),
      straw,
    );
  for (const [i, p] of rim.entries()) {
    const F = wallFace(p, rim[(i + 1) % rim.length]);
    const bays = Math.max(1, Math.round(F.length / 1.85));
    const bay = F.length / bays;
    const open = openingFacesPond(F);
    const support = Math.max(0.13, bay * 0.08);
    const startGrade = part.gradeMeters[part.outline.indexOf(p)];
    const endGrade = part.gradeMeters[part.outline.indexOf(rim[(i + 1) % rim.length])];
    if (level === 0) {
      if (!open) facing(out, F, 'earth', 0, F.length, floor, eave - 0.1, 0, clay);
      fbox(out, 'timber', F, -0.06, 0.06, startGrade - 0.12, eave - 0.06, -0.17, 0.01, brown);
      continue;
    }
    fbox(out, 'timber', F, 0, F.length, eave - 0.42, eave - 0.06, -0.29, 0.04, brown);
    for (let j = 0; j < bays; j++) {
      const u = j * bay;
      const base = startGrade + (endGrade - startGrade) * (j / bays);
      fbox(out, 'footing', F, u - 0.21, u + 0.21, base - 0.28, base + 0.07, -0.37, 0.04, stone);
      fbox(
        out,
        'timber',
        F,
        u - support / 2,
        u + support / 2,
        base - 0.06,
        eave - 0.07,
        -0.21,
        0.018,
        brown,
      );
      if (!open || j === 0 || j % 4 === 3) {
        const depth = open ? -0.22 : -0.03;
        if (open || j % 3 === 2)
          shoji(out, F, u + support, u + bay - 0.06, floor + 0.02, eave - 0.42, level, depth);
        else {
          facing(
            out,
            F,
            'earth',
            u + support,
            u + bay - 0.06,
            floor + 0.02,
            eave - 0.42,
            depth,
            clay,
          );
          facing(
            out,
            F,
            'timber',
            u + support,
            u + bay - 0.06,
            floor + 0.02,
            floor + 0.64,
            depth + 0.01,
            wood,
          );
        }
      }
    }
    if (open) {
      fbox(out, 'timber', F, 0, F.length, floor - 0.135, floor + 0.015, -0.09, 0.58, wood);
      if (level >= 1)
        fbox(out, 'timber', F, 0.03, F.length - 0.03, floor + 0.61, floor + 0.7, 0.5, 0.57, brown);
    }
  }
  const mainRoof = westBank
    ? [u0 - 0.67, v0 - 0.64, u1 + 0.68, v1 + 0.65]
    : [u0 - 0.75, v0 - 0.72, u1 + 0.72, v1 + 0.76];
  hipGable(out, A, mainRoof, eave - 0.16, eave + (westBank ? 1.62 : 2.76), 'reed', reed, true);
  if (level >= 2) {
    const rafters = level === 3 ? 14 : 7;
    for (let k = 1; k < rafters; k++) {
      const u = u0 + ((u1 - u0) * k) / rafters;
      for (const v of [v0, v1])
        box(
          out,
          'timber',
          A,
          u - 0.035,
          v - 0.57,
          u + 0.035,
          v + 0.57,
          eave - 0.25,
          eave - 0.17,
          wood,
        );
    }
  }
}

function frontGate(out, level) {
  const gate = site.gate;
  const A = axes(gate.angleDegrees);
  const F = facade(gate.point, A.along);
  const ground = gate.gradeMeters;
  const top = ground + 1.96;
  for (const [lo, hi] of [
    [-6.4, -1.68],
    [-1.61, -0.04],
    [0.04, 1.61],
    [1.68, 6.4],
  ]) {
    const centerLeaf = Math.abs(lo + hi) < 3;
    const bottom = ground + (centerLeaf ? 0.11 : -0.17);
    const cap = top + (centerLeaf ? 0.03 : -0.11);
    fbox(out, 'bamboo', F, lo, hi, bottom, cap, -0.092, 0.045, bamboo);
    fbox(out, 'timber', F, lo, hi, cap - 0.045, cap + 0.01, -0.117, 0.075, wood);
    if (level < 2) continue;
    const count = Math.round((hi - lo) / (level === 3 ? 0.072 : 0.15));
    for (let i = 1; i < count; i++) {
      const u = lo + ((hi - lo) * i) / count;
      facing(out, F, 'straw', u, u + 0.021, bottom + 0.017, cap, 0.052, straw);
    }
  }
  for (const u of [-6.41, -1.69, 0, 1.69, 6.41]) {
    const height = Math.abs(u) < 2 ? top + 0.21 : top - 0.08;
    fbox(out, 'timber', F, u - 0.075, u + 0.075, ground - 0.19, height, -0.16, 0.12, wood);
  }
}

function build(out, level) {
  residence(out, level);
  pavilion(out, site.gepparo, level, true);
  pavilion(out, site.shokintei, level, false);
  frontGate(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'katsura-imperial-villa-model.mjs';
const camera = [103, 72, 116];
const lookAt = [-5, 1.7, 14];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Katsura Imperial Villa’s staggered Shoin residence, moon-viewing platform, open teahouses and bamboo front gate.',
  camera,
  lookAt,
  sunDirection: [-30, 65, 40],
  mediumFiContext: {
    scale: 1.04,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    holes: frame.geometry.holes,
    minimumCoverage: 0.85,
    basis: 'The native mapped outline of the main Shoin, with its open courtyard.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'shoin-courtyard-and-roofs', position: [22, 25, 105], lookAt: [-26, 3.3, 49] },
    { name: 'old-shoin-moon-viewing-veranda', position: [5, 4.9, 21.2], lookAt: [-16, 2.8, 32.7] },
    { name: 'gepparo-veranda', position: [13.5, 5.5, 54.3], lookAt: [-3.5, 2.7, 36.6] },
    { name: 'shokintei-pond-approach', position: [38, 5.9, 39.5], lookAt: [64, 2.5, 54] },
    { name: 'omotemon-bamboo-gate', position: [4.6, 3.6, -94.5], lookAt: [10, 1.7, -82.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'katsura-imperial-villa-' + reviewLod,
    position: [22, 22, 105],
    lookAt: [-26, 3.3, 49],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.099, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.041, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by Raphael Azevedo Franca’s public-domain photographs, OpenStreetMap survey data and GSI numerical terrain.',
};
