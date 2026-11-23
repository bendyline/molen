import fs from 'node:fs';
import {
  abox,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  face,
  floorSampler,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const grade = floorSampler(read('terrain-grid'));
const fieldData = read('native-map/california-memorial-stadium-mapped-parts');
const ring = fieldData.outline;
const press = outwardRing(fieldData.pressBox);
const color = {
  wall: rgb('b7afa2'),
  coping: rgb('c3beb3'),
  damp: rgb('a79f91'),
  concrete: rgb('aca89b'),
  aisle: rgb('c4c0b2'),
  foundation: rgb('998f7e'),
  gold: rgb('b5a66d'),
  bleacher: rgb('beb37f'),
  navy: rgb('3e4a5a'),
  turf: rgb('627a54'),
  darkTurf: rgb('556d4a'),
  white: rgb('dbdad0'),
  fascia: rgb('959c9d'),
  glass: rgb('526672'),
  dark: rgb('4a5356'),
  screen: rgb('394856'),
  rail: rgb('8e938e'),
  pole: rgb('a4a6a2'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.18 },
  grass: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
  bleacher: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93 },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.97 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.71 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const turn = Math.PI * 2;
const fieldY = 0.19;
const yds = 0.9144;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const mix = (a, b, t) => a + (b - a) * t;
const blend = (p, q, t) => [mix(p[0], q[0], t), mix(p[1], q[1], t)];
const at = (p, y) => [p[0], y, p[1]];

function radius(angle) {
  const d = [Math.cos(angle), Math.sin(angle)];
  let nearest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = [b[0] - a[0], b[1] - a[1]];
    const denom = cross(d, edge);
    if (Math.abs(denom) < 1e-8) continue;
    const u = cross(a, d) / denom;
    const t = cross(a, edge) / denom;
    if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
  }
  return d.map((p) => p * nearest);
}

function fieldEdge(angle, pad = 0) {
  const d = [Math.cos(angle), Math.sin(angle)];
  const x = 33.2 + pad,
    z = 70.3 + pad;
  const norm = Math.pow(
    Math.pow(Math.abs(d[0] / x), 3.45) + Math.pow(Math.abs(d[1] / z), 3.45),
    1 / 3.45,
  );
  return d.map((p) => p / norm);
}

const rimY = (p) => Math.max(20.45 + 0.6 * Math.max(0, p[1] / 118), grade(p) + 0.45);

function levelSurface(out, slot, p, q, r, s, y, yy, tint) {
  face(out, slot, [at(p, y), at(q, yy), at(r, yy), at(s, y)], up, tint);
}

function wall(out, slot, a, b, lowA, lowB, highA, highB, dir, tint) {
  const n = [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2].map((x) => x * dir);
  face(out, slot, [at(a, lowA), at(b, lowB), at(b, highB), at(a, highA)], n, tint);
}

function slab(out, slot, x0, x1, z0, z1, y0, y1, tint) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], tint, { bottom: false });
}

function patch(out, slot, x0, x1, z0, z1, y, tint) {
  face(
    out,
    slot,
    [
      [x0, y, z0],
      [x0, y, z1],
      [x1, y, z1],
      [x1, y, z0],
    ],
    up,
    tint,
  );
}

function field(out, lod) {
  const floor = Array.from({ length: lod === 0 ? 28 : 48 }, (_, i) =>
    fieldEdge((turn * i) / (lod === 0 ? 28 : 48), 0.3),
  );
  cap(out, 'grass', floor, fieldY, color.darkTurf);
  const paintY = fieldY + 0.042;
  const half = 50 * yds;
  const x = 24.45;
  patch(out, 'grass', -x - 1.79, x + 1.79, -56.0, 56.0, fieldY + 0.016, color.navy);
  for (let i = 0; i < 10; i++) {
    const a = (i - 5) * 10 * yds;
    patch(
      out,
      'grass',
      -x,
      x,
      a,
      a + 10 * yds,
      paintY - 0.013,
      i % 2 ? color.turf : color.darkTurf,
    );
  }
  for (const end of [-1, 1]) {
    const far = end * (half + 9.144),
      near = end * half;
    patch(
      out,
      'paint',
      -x + 0.21,
      x - 0.21,
      Math.min(near, far),
      Math.max(near, far),
      paintY,
      color.gold,
    );
    const x0 = end < 0 ? -1.55 : 1.55;
    if (lod > 0) {
      slab(out, 'steel', x0 - 0.08, x0 + 0.08, far - 0.1, far + 0.1, 0.18, 3.58, color.gold);
      beam(out, 'bleacher', [x0, 3.25, far], [x0 - 2.8, 3.89, far], 0.08, 0.08, color.gold);
      beam(out, 'bleacher', [x0, 3.25, far], [x0 + 2.8, 3.89, far], 0.08, 0.08, color.gold);
      for (const axis of [x0 - 2.81, x0 + 2.81])
        slab(
          out,
          'bleacher',
          axis - 0.032,
          axis + 0.032,
          far - 0.03,
          far + 0.03,
          3.79,
          8.7,
          color.gold,
        );
    }
  }
  patch(out, 'paint', -x - 0.1, -x + 0.08, -54.9, 54.9, paintY + 0.006, color.white);
  patch(out, 'paint', x - 0.08, x + 0.1, -54.9, 54.9, paintY + 0.006, color.white);
  for (let j = -10; j <= 10; j++) {
    if (lod === 0 && j % 2) continue;
    const z = j * 5 * yds;
    patch(out, 'paint', -x, x, z - 0.058, z + 0.058, paintY + 0.006, color.white);
  }
  if (lod >= 2) {
    for (let j = -45; j <= 45; j++) {
      if (j % 5 === 0) continue;
      const z = j * yds;
      for (const h of [-22.9, -5.5, 5.5, 22.9])
        patch(
          out,
          'paint',
          h - 0.255,
          h + 0.255,
          z - 0.045,
          z + 0.045,
          paintY + 0.004,
          color.white,
        );
    }
  }
}

function bowl(out, lod) {
  const sectors = [28, 57, 92, 112][lod];
  const rows = [1, 6, 17, 30][lod];
  for (let i = 0; i < sectors; i++) {
    const angle = (turn * i) / sectors,
      angle2 = (turn * (i + 1)) / sectors;
    const A = radius(angle),
      B = radius(angle2);
    const a = fieldEdge(angle),
      b = fieldEdge(angle2);
    const rA = rimY(A),
      rB = rimY(B);
    const pathA = blend(A, a, 0.054),
      pathB = blend(B, b, 0.054);
    const isAisle = i % Math.max(2, Math.round(sectors / 23)) === 0;
    const tint = isAisle ? color.aisle : i % 5 === 0 ? color.bleacher : color.gold;
    for (let j = 0; j < rows; j++) {
      const low = j / rows,
        high = (j + 1) / rows;
      const eye = (v, limit) => 1.1 + (limit - 1.3) * v;
      const q = blend(a, pathA, low),
        p = blend(b, pathB, low);
      const s = blend(a, pathA, high),
        t = blend(b, pathB, high);
      const y = eye(high, rA),
        yy = eye(high, rB);
      if (lod === 0) {
        face(
          out,
          'bleacher',
          [at(q, eye(low, rA)), at(p, eye(low, rB)), at(t, yy), at(s, y)],
          up,
          tint,
        );
      } else {
        levelSurface(
          out,
          'bleacher',
          q,
          p,
          t,
          s,
          y,
          yy,
          j === 3 || j === 16 ? color.concrete : tint,
        );
        wall(out, 'concrete', q, p, eye(low, rA), eye(low, rB), y, yy, -1, color.concrete);
      }
    }
    levelSurface(out, 'concrete', pathA, pathB, B, A, rA - 0.19, rB - 0.19, color.aisle);
    wall(out, 'concrete', a, b, fieldY - 0.55, fieldY - 0.55, 1.155, 1.155, -1, color.navy);
    const lowerA = Math.min(rA - 1.2, grade(A) - 0.68),
      lowerB = Math.min(rB - 1.2, grade(B) - 0.68);
    const east = (A[0] + B[0]) * 0.5;
    if (east >= -3) {
      wall(out, 'wall', A, B, lowerA, lowerB, rA, rB, 1, color.wall);
    }
    if (lod >= 2 && i % 2 === 0) {
      const capA = blend(A, a, 0.024),
        capB = blend(B, b, 0.024);
      beam(out, 'steel', at(capA, rA + 0.81), at(capB, rB + 0.81), 0.048, 0.055, color.rail);
      if (lod >= 2)
        beam(out, 'steel', at(capB, rB - 0.12), at(capB, rB + 0.83), 0.05, 0.06, color.rail);
    }
  }
}

function facadePanel(out, slot, F, left, right, floor, top, tint, d = 0) {
  if (right - left < 0.001 || top - floor < 0.001) return;
  quad4(
    out,
    slot,
    F.P(left, floor, d),
    F.P(right, floor, d),
    F.P(right, top, d),
    F.P(left, top, d),
    tint,
  );
}

function arcades(out, lod) {
  const begin = 1.6,
    end = 4.69;
  const count = [12, 22, 36, 42][lod];
  for (let i = 0; i < count; i++) {
    const a = radius(mix(begin, end, i / count)),
      b = radius(mix(begin, end, (i + 1) / count));
    const f = wallFace(b, a);
    const L = f.length;
    const y = (rimY(a) + rimY(b)) * 0.5;
    const floor = Math.min(y - 7.2, Math.min(grade(a), grade(b)) - 0.73);
    const mid = L / 2,
      half = Math.min(1.8, L * 0.28);
    const sill = Math.max(floor + 2.6, y - 10.95),
      spring = y - 5.25;
    const opening = roundArch(half, [4, 5, 9, 9][lod]);
    facadePanel(out, 'wall', f, 0, L, floor, sill, color.wall);
    facadePanel(out, 'wall', f, 0, mid - half, sill, y, color.wall);
    facadePanel(out, 'wall', f, mid + half, L, sill, y, color.wall);
    for (let j = 0; j < opening.length - 1; j++) {
      const [u, dy] = opening[j],
        [v, dyy] = opening[j + 1];
      const P = f.P(mid + u, spring + dy),
        Q = f.P(mid + v, spring + dyy);
      quad4(out, 'wall', P, Q, f.P(mid + v, y), f.P(mid + u, y), color.wall);
      quad4(
        out,
        'concrete',
        Q,
        P,
        f.P(mid + u, spring + dy, -1.83),
        f.P(mid + v, spring + dyy, -1.83),
        color.damp,
      );
    }
    facadePanel(
      out,
      'dark',
      f,
      mid - half,
      mid + half,
      sill,
      spring + half + 0.27,
      color.dark,
      -1.9,
    );
    if (lod > 0) {
      fbox(out, 'concrete', f, 0.1, L - 0.1, y - 0.62, y - 0.24, -0.02, 0.21, color.coping);
      fbox(out, 'concrete', f, 0.13, 0.54, sill - 1.12, y - 0.6, -0.04, 0.18, color.damp);
      if (lod >= 2 && i % 2 === 1)
        facadePanel(
          out,
          'dark',
          f,
          mid - 0.69,
          mid + 0.69,
          Math.max(floor + 0.16, sill - 3.9),
          sill - 0.5,
          color.dark,
          0.03,
        );
    }
  }
}

function pressBox(out, lod) {
  const base = 22.66,
    y0 = 23.22,
    y1 = 25.78,
    y2 = 28.7,
    roof = 29.71;
  cap(out, 'steel', press, base, color.fascia);
  cap(out, 'steel', press, roof, color.fascia);
  for (let i = 0; i < press.length; i++) {
    const a = press[i],
      b = press[(i + 1) % press.length],
      f = wallFace(a, b),
      L = f.length;
    facadePanel(out, 'steel', f, 0, L, base, y0, color.fascia);
    facadePanel(out, 'glass', f, 0, L, y0, y1, color.glass);
    facadePanel(out, 'steel', f, 0, L, y1, y1 + 0.5, color.fascia);
    facadePanel(out, 'glass', f, 0, L, y1 + 0.5, y2, color.glass);
    fbox(out, 'steel', f, 0, L, y2, roof, -0.01, 0.68, color.fascia);
    if (lod >= 2) {
      const bays = Math.ceil(L / 2.28);
      for (let j = 1; j < bays; j++) {
        const u = (L * j) / bays;
        fbox(out, 'steel', f, u - 0.059, u + 0.059, y0, y2, -0.018, 0.11, color.fascia);
      }
    }
  }
  for (const [x, z] of [
    [-78, -42],
    [-82, -16],
    [-82, 16],
    [-78, 40],
  ]) {
    slab(out, 'wall', x - 2.2, x + 2.2, z - 2.09, z + 2.09, 17.18, base + 0.11, color.coping);
    if (lod >= 2)
      slab(out, 'glass', x + 2.18, x + 2.23, z - 1.43, z + 1.43, 19.32, 22.09, color.glass);
  }
}

function videoBoards(out, lod) {
  for (const s of [-1, 1]) {
    const z = s * (s > 0 ? 108.7 : 103.1);
    const x = s > 0 ? 10.2 : -8.3;
    const base = 21.0;
    for (const leg of [-7.08, 7.08])
      slab(
        out,
        'wall',
        x + leg - 0.64,
        x + leg + 0.64,
        z - 0.61,
        z + 0.61,
        17.35,
        base + 4.1,
        color.concrete,
      );
    slab(out, 'steel', x - 8.3, x + 8.3, z - 0.43, z + 0.43, base + 1.7, base + 8.16, color.navy);
    const f = facade([x, z - 0.44 * s], [-s, 0]);
    facadePanel(out, 'dark', f, -7.35, 7.35, base + 2.19, base + 7.67, color.screen, 0.002);
    if (lod >= 2)
      fbox(out, 'steel', f, -7.35, 7.35, base + 7.78, base + 7.98, -0.01, 0.032, color.rail);
  }
}

function lighting(out, lod) {
  if (lod === 0) return;
  const angles = [0.18, 0.73, 1.14, 1.97, 2.47, 3.07, 3.84, 4.27, 5.05, 5.72, 6.16];
  for (const [i, a] of angles.entries()) {
    if (lod === 1 && i % 2) continue;
    const basePt = radius(a),
      p = blend(basePt, [0, 0], 0.035);
    const base = rimY(basePt),
      top = base + 7.9;
    beam(out, 'steel', at(p, base - 0.17), at(p, top), 0.145, 0.145, color.pole);
    const dx = 0.51 * Math.sin(a),
      dz = -0.51 * Math.cos(a);
    beam(
      out,
      'steel',
      [p[0] - dx, top, p[1] - dz],
      [p[0] + dx, top, p[1] + dz],
      0.182,
      0.168,
      color.dark,
    );
    if (lod >= 2) {
      for (const j of [-1, 0, 1]) {
        const x = p[0] + dx * j * 0.76,
          z = p[1] + dz * j * 0.76;
        slab(
          out,
          'bleacher',
          x - 0.12,
          x + 0.12,
          z - 0.11,
          z + 0.11,
          top + 0.079,
          top + 0.36,
          color.white,
        );
      }
    }
  }
}

function build(out, lod) {
  field(out, lod);
  bowl(out, lod);
  arcades(out, lod);
  pressBox(out, lod);
  videoBoards(out, lod);
  lighting(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'california-memorial-stadium-model.mjs';
const camera = [-231, 112, 165],
  lookAt = [-1, 8, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'stadium',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Measured 3DEP playing surface and the current surrounding grade at Strawberry Canyon.',
  brief:
    'The current California Memorial Stadium bowl with Berkeley’s historic west arches, gold bleachers, west press box and the hillside east terraces.',
  camera,
  lookAt,
  sunDirection: [-94, 90, 67],
  mediumFiContext: {
    scale: 2.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.94,
    basis: 'The named stadium’s mapped outer perimeter.',
  },
  groundCutout: {
    outline: ring.map((p) => p.map((v) => v * 0.974)),
    minHeight: -0.65,
    basis:
      'The recess follows the stadium bowl and the surveyed playing field. Adjoining canyon terrain stays at source grade.',
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'whole-stadium-and-historic-west-arcade', position: camera, lookAt },
    { name: 'open-bowl-from-the-east-hillside', position: [122, 46, -101], lookAt: [-7, 8, 10] },
    {
      name: 'west-facade-and-two-storey-press-box',
      position: [-164, 19, 18],
      lookAt: [-83, 16, 6],
    },
    { name: 'playing-surface-and-seating-aisles', position: [46, 21, 77], lookAt: [-20, 3, -9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'california-memorial-stadium-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.074, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model. Creator-dedicated CC0 photographs, OpenStreetMap ODbL outlines and public-domain U.S. Geological Survey elevation.',
};
