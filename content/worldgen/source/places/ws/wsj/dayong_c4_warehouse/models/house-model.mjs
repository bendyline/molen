/** Whole C4 warehouse; exact native horizontal corners, bounded photographic sections. */
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
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.8, metallic: 0.22 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.67, metallic: 0.36 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
};
const colors = {
    wall: rgb('77786a'),
    roof: rgb('354b43'),
    foundation: rgb('a3a69b'),
    steel: rgb('344445'),
    wood: rgb('4d4d40'),
  },
  rect = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up, tint) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      (p) => (typeof y === 'function' ? y(p) : y),
      [0, up, 0],
      (p) => p,
      tint ?? colors[k],
    )
  )
    throw Error('Invalid warehouse cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
      tint,
    );
}
function prism(o, k, r, y0, y1, tint) {
  const sg = Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ),
    top = (p) => (typeof y1 === 'function' ? y1(p) : y1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
      tint,
    );
  }
  cap(o, k, r, y0, -1, tint);
  cap(o, k, r, y1, 1, tint);
}
const box = (o, k, x, z, w, d, y0, y1, t) =>
    prism(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1, t),
  strut = (o, k, a, b, w = 0.07, t) => beam(o, k, a, b, w, w, t ?? colors[k]);
function split(r, keep) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ina = keep(a[0]),
      inb = keep(b[0]);
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = -a[0] / (b[0] - a[0]);
      out.push([0, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
function facade(o, z, n, x0, x1, y0, y1, k = 'steel', tint) {
  face(
    o,
    k,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, n],
    tint,
  );
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeRing,
    x0 = Math.min(...r.map((p) => p[0])),
    x1 = Math.max(...r.map((p) => p[0])),
    z0 = Math.min(...r.map((p) => p[1])),
    z1 = Math.max(...r.map((p) => p[1])),
    hw = (x1 - x0) / 2,
    roof = (p) => P.eave + (P.ridge - P.eave) * (1 - Math.abs(p[0]) / hw),
    body = [];
  prism(o, 'foundation', r, P.foundationBottom, P.foundationTop);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    body.push(a);
    if (a[0] * b[0] < 0) {
      const t = -a[0] / (b[0] - a[0]);
      body.push([0, a[1] + t * (b[1] - a[1])]);
    }
  }
  const sg = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length];
    face(
      o,
      'wall',
      [
        [a[0], P.floor, a[1]],
        [b[0], P.floor, b[1]],
        [b[0], roof(b), b[1]],
        [a[0], roof(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
    );
  }
  cap(o, 'wall', r, P.floor, -1);
  const over = P.roofOverhang,
    rr = rect(x0 - over, x1 + over, z0 - over, z1 + over),
    roofY = (p) => roof(p) + 0.12;
  for (const keep of [(x) => x <= 0, (x) => x >= 0]) cap(o, 'roof', split(rr, keep), roofY, 1);
  // All LODs retain full gables, entrance glazing, canopy, and main structural framing.
  for (const z of [z0 - 0.04, z1 + 0.04]) {
    const n = z > 0 ? 1 : -1;
    box(o, 'foundation', 0, z, x1 - x0, 0.18, 5.65, 5.95);
    for (const x of [x0 + 0.15, -3.15, 3.15, x1 - 0.15])
      box(o, 'foundation', x, z, 0.34, 0.2, P.floor, Math.min(roof([x, z]) - 0.08, 6.35));
    for (const side of [-1, 1])
      strut(
        o,
        'wood',
        [0, P.ridge + 0.07, z + n * over],
        [side * (hw + over), P.eave - 0.05, z + n * over],
        lod === 0 ? 0.16 : 0.22,
      );
  }
  let sideBays = 0;
  for (const x of [x0 - 0.035, x1 + 0.035]) {
    const n = x > 0 ? 1 : -1;
    box(o, 'foundation', x, 0, 0.22, z1 - z0, 5.65, 5.94);
    box(o, 'foundation', x, 0, 0.24, z1 - z0, 6.05, 6.23);
    const bays = 9;
    for (let j = 0; j <= bays; j++) {
      const z = z0 + ((z1 - z0) * j) / bays;
      box(o, 'foundation', x, z, 0.26, 0.38, P.floor, 6.34);
      sideBays++;
    }
    if (lod >= 1)
      for (let j = 1; j < bays; j++) {
        const z = z0 + ((z1 - z0) * j) / bays + 1.1;
        face(
          o,
          'steel',
          [
            [x + n * 0.13, 3.8, z - 0.8],
            [x + n * 0.13, 3.8, z + 0.8],
            [x + n * 0.13, 4.6, z + 0.8],
            [x + n * 0.13, 4.6, z - 0.8],
          ],
          [n, 0, 0],
          rgb('46524e'),
        );
      }
  }
  const front = z1 + 0.12;
  for (const [x, w] of [
    [-2.05, 2.65],
    [3.35, 2.7],
  ]) {
    facade(o, front, 1, x - w / 2, x + w / 2, P.floor + 0.06, 4.25, 'steel', rgb('152a2c'));
    for (const dx of [-w / 2, w / 2])
      box(o, 'foundation', x + dx, front + 0.02, 0.19, 0.18, P.floor, 4.45);
    box(o, 'foundation', x, front + 0.02, w + 0.36, 0.18, 4.25, 4.45);
    if (lod >= 1) {
      strut(o, 'steel', [x, P.floor + 0.1, front + 0.045], [x, 4.2, front + 0.045], 0.07);
      strut(o, 'steel', [x - w / 2, 2.35, front + 0.045], [x + w / 2, 2.35, front + 0.045], 0.065);
    }
  }
  facade(o, front + 0.03, 1, -0.95, 0.95, 7.05, 9.25, 'steel', rgb('213b3d'));
  for (const x of [-1.05, 1.05]) box(o, 'foundation', x, front + 0.05, 0.18, 0.15, 6.92, 9.38);
  box(o, 'foundation', 0, front + 0.05, 2.28, 0.15, 6.92, 7.1);
  box(o, 'foundation', 0, front + 0.05, 2.28, 0.15, 9.25, 9.4);
  const zcan = z1 + 1.3;
  box(o, 'steel', 3.5, zcan, 8.9, 2.5, 4.25, 4.39, rgb('687363'));
  for (const x of [-0.8, 7.8]) {
    box(o, 'foundation', x, z1 + 2.36, 0.22, 0.22, P.floor, 4.25);
    if (lod >= 1) strut(o, 'steel', [x, 3.95, z1 + 0.05], [x, 4.22, z1 + 2.4], 0.09);
  }
  box(o, 'steel', 3.5, z1 + 2.52, 9, 0.1, 4.24, 4.45, rgb('b0b2a1'));
  // Unseen rear is an explicit conservative service-door continuation.
  facade(o, z0 - 0.13, -1, -1.7, 1.7, P.floor + 0.04, 3.8, 'steel', rgb('40504b'));
  if (lod >= 1)
    for (const x of [-1.8, 1.8]) box(o, 'foundation', x, z0 - 0.16, 0.17, 0.18, P.floor, 3.95);
  if (lod >= 1) {
    const a = Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2;
      return [0.47 * Math.cos(t), 9.95 + 0.47 * Math.sin(t), front + 0.07];
    });
    face(o, 'foundation', a, [0, 0, 1], rgb('a4a594'));
    strut(
      o,
      'steel',
      [0, P.ridge + 0.14, z0 - over],
      [0, P.ridge + 0.14, z1 + over],
      0.15,
      rgb('40554a'),
    );
    for (const x of [x0 - over, x1 + over])
      strut(
        o,
        'steel',
        [x, P.eave - 0.06, z0 - over],
        [x, P.eave - 0.06, z1 + over],
        0.15,
        rgb('526251'),
      );
  }
  if (lod >= 2) {
    for (const side of [-1, 1]) {
      const x = side * (hw + 0.17);
      strut(o, 'steel', [x, 6.1, z1 - 1], [x, P.floor + 0.1, z1 - 1], 0.09, rgb('626e62'));
    }
    for (let i = 0; i < 28; i++) {
      const x = -8.8 + (i % 7) * 2.7,
        z = i % 2 ? z0 - 0.045 : z1 + 0.045,
        n = z > 0 ? 1 : -1,
        y = 0.8 + Math.floor(i / 7) * 1.1;
      facade(
        o,
        z,
        n,
        x,
        x + 0.4 + (i % 3) * 0.23,
        y,
        y + 0.38,
        'wall',
        rgb(i % 3 ? '8b8c7c' : '626858'),
      );
    }
  }
  if (lod === 3) {
    for (let j = 0; j <= 104; j++) {
      const z = z0 - over + ((z1 - z0 + 2 * over) * j) / 104;
      for (const side of [-1, 1])
        strut(
          o,
          'roof',
          [0, P.ridge + 0.15, z],
          [side * (hw + over), roof([side * (hw + over), z]) + 0.15, z],
          0.025,
          rgb('42564a'),
        );
    }
    for (const x of [-2.05, 3.35])
      strut(
        o,
        'steel',
        [x + 0.2, 1.35, front + 0.11],
        [x + 0.2, 1.85, front + 0.11],
        0.045,
        rgb('a7aea6'),
      );
  }
  componentEvidence.push({
    lod,
    nativeCorners: r.length,
    wholeBody: true,
    allWalls: true,
    fullGabledRoof: true,
    foundation: true,
    frontGlazedEntries: 2,
    entranceCanopy: true,
    upperGableWindow: true,
    sidePilasters: sideBays,
    blankMedallion: lod >= 1,
    notWholePier2Proxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [54, 30, 72],
  look = [0, 4, 0];
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
    'Whole actualC4warehouse four-corner longbody, full gabled corrugated roof, pale concrete pilasters/bands/weathered darkolivegraywalls, glazedfrontentries/canopy and uppergablewindow. All unseen details/section heights explicitly estimated.',
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
  embeddedCanonicalGraphs: [
    'stucco',
    'metal_corrugated',
    'concrete_plain',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'frontgable-entrances-canopy-and-full-longwall',
      position: [-31, 17, 62],
      lookAt: [0, 4, 10],
    },
    { name: 'whole-rear-roof-and-longwall', position: [40, 24, -64], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-warehouse-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. OSM horizontal numerical controls credited. Named photographer玄史生/玄史生FlickrCC0dedication for exact2019exterior reference; no photo pixels used as textures.',
};
