/** Whole independent communications tower from written engineering specifications and tables. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  paint: { slot: 'wall', graph: 'metal_painted', roughness: 0.75, metallic: 0.2 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.64, metallic: 0.65 },
  antenna: { slot: 'roof', graph: 'metal_painted', roughness: 0.85, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const colors = {
    paint: rgb('d8dbd4'),
    steel: rgb('8b9794'),
    antenna: rgb('d4d6d0'),
    foundation: rgb('aaa899'),
  },
  red = rgb('b44e42'),
  white = rgb('e5e3d9');
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function prism(o, k, r, y0, y1, tint = colors[k]) {
  const sg = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
      tint,
    );
  }
  for (const [y, s] of [
    [y0, -1],
    [y1, 1],
  ])
    face(
      o,
      k,
      r.map((p) => [p[0], y, p[1]]),
      [0, s, 0],
      tint,
    );
}
const box = (o, k, x, z, w, d, y0, y1, tint) =>
    prism(
      o,
      k,
      [
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x + w / 2, z + d / 2],
        [x - w / 2, z + d / 2],
      ],
      y0,
      y1,
      tint,
    ),
  strut = (o, k, a, b, w = 0.04, tint = colors[k]) => beam(o, k, a, b, w, w, tint),
  radius = (h) =>
    P.bodyRadiusTop + (P.bodyRadiusBase - P.bodyRadiusTop) * Math.max(0, 1 - h / P.towerHeight),
  vertex = (i, h) => {
    const a = ((P.towerFaceBearingDegrees + 30 + 120 * i) * Math.PI) / 180;
    return [radius(h) * Math.sin(a), P.floor + h, -radius(h) * Math.cos(a)];
  };
export function antennaBasis(a) {
  const b = (a.bearing * Math.PI) / 180,
    n = [Math.sin(b), 0, -Math.cos(b)],
    u = [Math.cos(b), 0, Math.sin(b)],
    r = radius(a.height) + 0.5;
  const offset = a.type === 'dish' ? 1.2 : 0;
  return { n, u, center: [n[0] * r + u[0] * offset, P.floor + a.height, n[2] * r + u[2] * offset] };
}
const add = (a, b, t = 1) => a.map((v, i) => v + t * b[i]);
function antennaPanel(o, a, lod) {
  const { n, u, center } = antennaBasis(a),
    q = (x, y, z) => add(add(add(center, u, x), [0, 1, 0], y), n, z),
    w = P.panels.width / 2,
    h = P.panels.height / 2,
    d = P.panels.depth / 2;
  for (const [s, nn] of [
    [1, n],
    [-1, n.map((v) => -v)],
  ])
    face(o, 'antenna', [q(-w, -h, s * d), q(w, -h, s * d), q(w, h, s * d), q(-w, h, s * d)], nn);
  for (const [s, nn] of [
    [1, u],
    [-1, u.map((v) => -v)],
  ])
    face(o, 'antenna', [q(s * w, -h, -d), q(s * w, -h, d), q(s * w, h, d), q(s * w, h, -d)], nn);
  for (const s of [-1, 1])
    face(
      o,
      'antenna',
      [q(-w, s * h, -d), q(w, s * h, -d), q(w, s * h, d), q(-w, s * h, d)],
      [0, s, 0],
    );
  for (const y of lod === 0 ? [] : [-0.8, 0.8])
    strut(o, 'steel', q(0, y, -d), q(0, y, -0.55), 0.06);
  if (lod >= 2) {
    strut(o, 'steel', q(0, -1.5, -0.45), q(0, 1.5, -0.45), 0.09);
    strut(o, 'steel', q(-0.15, -1.5, -0.4), q(0.15, -1.5, -0.4), 0.05);
  }
}
function antennaDish(o, a, lod) {
  const { n, u, center } = antennaBasis(a),
    r = a.diameter / 2,
    depth = a.diameter * 0.15,
    N = [8, 12, 20, 28][lod],
    q = (rr, t, back = 0) => {
      const rad = rr / r,
        along = depth * rad * rad - back;
      return add(add(add(center, u, rr * Math.cos(t)), [0, 1, 0], rr * Math.sin(t)), n, along);
    },
    front = q(0, 0),
    back = q(0, 0, 0.035);
  for (let i = 0; i < N; i++) {
    const t = (i * 2 * Math.PI) / N,
      t2 = ((i + 1) * 2 * Math.PI) / N;
    face(o, 'antenna', [front, q(r, t), q(r, t2)], n);
    face(
      o,
      'steel',
      [back, q(r, t, 0.035), q(r, t2, 0.035)],
      n.map((v) => -v),
    );
    face(
      o,
      'steel',
      [q(r, t), q(r, t, 0.035), q(r, t2, 0.035), q(r, t2)],
      add(
        u.map((v) => v * Math.cos((t + t2) / 2)),
        [0, Math.sin((t + t2) / 2), 0],
      ),
    );
  }
  const feed = add(center, n, a.diameter * 0.46);
  if (lod >= 1) {
    for (let i = 0; i < 3; i++) strut(o, 'steel', q(r * 0.85, (i * 2 * Math.PI) / 3), feed, 0.018);
    strut(o, 'steel', feed, add(feed, n, 0.09), 0.07);
  }
  strut(o, 'steel', add(center, n, -0.55), back, 0.1);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const H = P.towerHeight,
    N = Math.ceil(H / [12, 3.3, 2.5, 2.5][lod]),
    paint = (h) => (Math.floor(h / (H / 7)) % 2 === 0 ? red : white),
    legWidth = [0.14, 0.12, 0.105, 0.095][lod];
  for (let i = 0; i < 3; i++) {
    const p = vertex(i, 0);
    box(o, 'foundation', p[0], p[2], 0.78, 0.78, P.foundationBottom, P.foundationTop);
    if (lod >= 2) box(o, 'steel', p[0], p[2], 0.4, 0.4, P.floor, P.floor + 0.07);
    for (let j = 0; j < N; j++) {
      const h = (H * j) / N,
        h2 = (H * (j + 1)) / N,
        a = vertex(i, h),
        b = vertex(i, h2),
        c = vertex((i + 1) % 3, h),
        d = vertex((i + 1) % 3, h2);
      strut(o, 'paint', a, b, legWidth, paint((h + h2) / 2));
      strut(o, 'paint', a, c, legWidth * 0.65, paint(h));
      strut(o, 'paint', a, d, legWidth * 0.6, paint((h + h2) / 2));
      if (lod >= 1) strut(o, 'paint', c, b, legWidth * 0.6, paint((h + h2) / 2));
    }
    strut(o, 'paint', vertex(i, H), vertex((i + 1) % 3, H), legWidth, red);
  }
  // All written platform levels retained; mesh floors and railing profiles simplified.
  for (const h of P.platforms) {
    const ring = Array.from({ length: 3 }, (_, i) => {
      const p = vertex(i, h);
      return [p[0] * 0.9, p[2] * 0.9];
    });
    prism(o, 'steel', ring, P.floor + h - 0.06, P.floor + h);
    if (lod >= 1)
      for (let i = 0; i < 3; i++) {
        const a = ring[i],
          b = ring[(i + 1) % 3];
        strut(o, 'steel', [a[0], P.floor + h, a[1]], [a[0], P.floor + h + 0.85, a[1]], 0.035);
        strut(
          o,
          'steel',
          [a[0], P.floor + h + 0.85, a[1]],
          [b[0], P.floor + h + 0.85, b[1]],
          0.035,
        );
      }
  }
  const lx = 0.22,
    lz = 0.1,
    top = P.floor + H;
  for (const x of [lx - 0.19, lx + 0.19]) strut(o, 'steel', [x, P.floor, lz], [x, top, lz], 0.035);
  const step = [H / 8, 1, 0.65, 0.5][lod];
  for (let h = 0.5; h < H; h += step)
    strut(o, 'steel', [lx - 0.19, P.floor + h, lz], [lx + 0.19, P.floor + h, lz], 0.025);
  if (lod >= 2) {
    for (let h = 2; h < H; h += 2.5)
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          b = ((i + 1) * Math.PI) / 3;
        strut(
          o,
          'steel',
          [lx + 0.36 * Math.cos(a), P.floor + h, lz + 0.36 * Math.sin(a)],
          [lx + 0.36 * Math.cos(b), P.floor + h, lz + 0.36 * Math.sin(b)],
          0.025,
        );
      }
  }
  // Cable route represented on the body, without guessed ancillary shelter position.
  if (lod >= 1) strut(o, 'steel', [-0.27, P.floor, 0.12], [-0.27, top, 0.12], 0.1);
  for (const a of P.antennas) {
    if (a.type === 'panel') antennaPanel(o, a, lod);
    else if (a.type === 'dish') antennaDish(o, a, lod);
    else {
      const x = 0.18,
        z = -0.1,
        y = P.floor + a.height;
      strut(o, 'antenna', [x, y - 0.5, z], [x, y + 1.15, z], 0.045);
      if (lod >= 2)
        for (let i = 0; i < 3; i++) {
          const b = (i * 2 * Math.PI) / 3;
          strut(
            o,
            'steel',
            [x, y - 0.1, z],
            [x + 0.25 * Math.sin(b), y - 0.12, z + 0.25 * Math.cos(b)],
            0.022,
          );
        }
    }
  }
  strut(o, 'steel', [0, top - 0.2, 0], [0, top + 0.7, 0], 0.035);
  box(o, 'paint', 0, 0, 0.12, 0.12, top + 0.08, top + 0.21, red);
  componentEvidence.push({
    lod,
    wholeTower: true,
    threeSupportLegs: true,
    allHeightOpenLattice: true,
    concreteFootings: 3,
    ladder: true,
    platforms: P.platforms,
    antennas: P.antennas,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  H = P.towerHeight,
  camera = [H * 0.9, H * 0.7, H * 1.15],
  look = [0, H * 0.49, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Whole independent original communications tower: three-legged steel lattice, concrete footings, ladders/platforms and complete original numerical antenna set. Original height/type/true bearings/dish diameters retained; exact lattice/brackets/platform shapes and phase carryover explicitly estimated. Every image unused.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.63,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'metal_stainless_beadblasted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'upper-array-and-platforms',
      position: [8, P.floor + H - 3, 12],
      lookAt: [0, P.floor + H - 7, 0],
    },
    { name: 'lower-lattice-ladder-and-three-footings', position: [8, 6, 12], lookAt: [0, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-tower-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.4,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license; numerical operator engineering tables and written specifications only. No source photograph/figure/diagram/plan used.',
};
