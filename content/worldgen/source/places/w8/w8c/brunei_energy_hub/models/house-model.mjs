/** Entire two-storey former Customs House, true central passage and flat-roof museum exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  B = P.basis,
  H = P.building;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.91, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.18 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.5, metallic: 0.25 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.15 },
};
const colors = {
  wall: rgb('e1dfd2'),
  foundation: rgb('b9b7a9'),
  roof: rgb('9daca8'),
  trim: rgb('b0c1bf'),
  window: rgb('536f78'),
  door: rgb('5e706d'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up) {
  const t = new MeshBufferBuilder();
  if (
    !t.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid complete CustomsHouse cap');
  const m = t.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
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
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
export const projectU = (p) => (p[0] - B.center[0]) * B.U[0] + (p[1] - B.center[1]) * B.U[1],
  at = (u, v, y) => [
    B.center[0] + B.U[0] * u + B.V[0] * v,
    y,
    B.center[1] + B.U[1] * u + B.V[1] * v,
  ];
function clip(r, u, sign) {
  const out = [],
    d = (p) => (projectU(p) - u) * sign;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = d(a),
      C = d(b);
    if (A >= -1e-8) out.push(a);
    if (A >= 0 !== C >= 0) {
      const t = A / (A - C);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out;
}
export const lowerRings = [
    clip(P.nativeBuildingRing, -P.passage.width / 2, -1),
    clip(P.nativeBuildingRing, P.passage.width / 2, 1),
  ],
  passageRing = clip(clip(P.nativeBuildingRing, -P.passage.width / 2, 1), P.passage.width / 2, -1);
function strip(o, k, a, b, width, y0, y1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [-dz / l, dx / l],
    r = [
      [a[0] - (n[0] * width) / 2, a[1] - (n[1] * width) / 2],
      [b[0] - (n[0] * width) / 2, b[1] - (n[1] * width) / 2],
      [b[0] + (n[0] * width) / 2, b[1] + (n[1] * width) / 2],
      [a[0] + (n[0] * width) / 2, a[1] + (n[1] * width) / 2],
    ];
  polygon(o, k, r, y0, y1);
}
export const facadeEvidence = [];
function opening(o, edge, index, count, storey, lod) {
  const r = P.nativeBuildingRing,
    a = r[edge],
    b = r[(edge + 1) % 4],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    t = (index + 0.5) / count,
    c = a.map((v, k) => v * (1 - t) + b[k] * t),
    long = edge % 2 === 0,
    w = long ? P.windows.width : 2.35,
    h = P.windows.height,
    y = P.floor + storey * H.storeyHeight + P.windows.sillAboveFloor;
  if (storey === 0 && Math.abs(projectU(c)) < P.passage.width / 2 + w / 2 + 0.3) return;
  const p = (u, Y, d) => [c[0] + U[0] * u + N[0] * d, Y, c[1] + U[1] * u + N[1] * d],
    normal = [N[0], 0, N[1]];
  face(
    o,
    'window',
    [p(-w / 2, y, 0.025), p(w / 2, y, 0.025), p(w / 2, y + h, 0.025), p(-w / 2, y + h, 0.025)],
    normal,
  );
  facadeEvidence.push({ edge, storey, index, center: c });
  if (!lod) return;
  const frameBar = (u0, Y0, u1, Y1, width) => {
    if (lod > 1) {
      beam(o, 'trim', p(u0, Y0, 0.08), p(u1, Y1, 0.08), width, 0.1, colors.trim);
      return;
    }
    const du = u1 - u0,
      dy = Y1 - Y0,
      L = Math.hypot(du, dy),
      x = ((-dy / L) * width) / 2,
      z = ((du / L) * width) / 2;
    face(
      o,
      'trim',
      [
        p(u0 + x, Y0 + z, 0.08),
        p(u1 + x, Y1 + z, 0.08),
        p(u1 - x, Y1 - z, 0.08),
        p(u0 - x, Y0 - z, 0.08),
      ],
      normal,
    );
  };
  for (const side of [-1, 1]) frameBar((side * w) / 2, y, (side * w) / 2, y + h, 0.12);
  for (const Y of [y, y + h]) frameBar(-w / 2, Y, w / 2, Y, 0.12);
  frameBar(0, y, 0, y + h, 0.08);
  const blades = [0, 3, 5, P.windows.louvreBlades][lod];
  for (let j = 0; j < blades; j++) {
    const Y = y + 0.15 + ((j + 0.5) * (h - 0.3)) / blades,
      A = p(-w / 2 + 0.1, Y, 0.1),
      C = p(w / 2 - 0.1, Y, 0.1);
    beam(o, 'trim', A, C, ((h - 0.3) / blades) * 0.37, 0.15, colors.trim);
  }
  if (lod > 1 && storey === 0) {
    const bars = lod === 2 ? 3 : P.windows.gridBars;
    for (let j = 1; j <= bars; j++) {
      const u = -w / 2 + (j * w) / (bars + 1);
      beam(o, 'door', p(u, y + 0.15, 0.18), p(u, y + h - 0.15, 0.18), 0.045, 0.045, colors.door);
    }
    if (lod === 3)
      for (let j = 0; j < 3; j++) {
        const Y = y + 0.5 + j * 0.55;
        beam(o, 'door', p(-w / 2 + 0.1, Y, 0.18), p(w / 2 - 0.1, Y, 0.18), 0.04, 0.04, colors.door);
      }
  }
}
const glyph = {
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
  C: [
    [
      [1, 1],
      [0, 1],
    ],
    [
      [0, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 0],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [1, 1],
    ],
  ],
  S: [
    [
      [1, 1],
      [0, 1],
    ],
    [
      [0, 1],
      [0, 0.5],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
    [
      [1, 0.5],
      [1, 0],
    ],
    [
      [1, 0],
      [0, 0],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  O: [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [1, 1],
      [0, 1],
    ],
    [
      [0, 1],
      [0, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [0.5, 0.45],
    ],
    [
      [0.5, 0.45],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 0],
    ],
  ],
  E: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
    [
      [0, 0],
      [1, 0],
    ],
  ],
  '.': [
    [
      [0.4, 0],
      [0.6, 0],
    ],
  ],
};
function sign(o, lod) {
  const h = P.signs.letterHeight,
    w = h * 0.62,
    advance = w * 1.35,
    text = P.signs.text,
    start = (-(text.length - 1) * advance) / 2,
    y = P.passage.top + 0.13,
    depth = B.depth / 2 + 0.08;
  if (!lod) return;
  for (let i = 0; i < text.length; i++)
    for (const [a, b] of glyph[text[i]] ?? []) {
      const point = (p) => at(start + i * advance + p[0] * w, depth, y + p[1] * h);
      beam(o, 'door', point(a), point(b), 0.026, 0.026, colors.door);
    }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  facadeEvidence.length = 0;
  for (const r of lowerRings) {
    polygon(o, 'foundation', r, P.floor - H.plinthDepth, P.floor);
    polygon(o, 'wall', r, P.floor, H.upperFloor);
  }
  componentEvidence.push(
    'whole-original-four-control-two-storey-building-both-full-long-facades-and-ends',
  );
  polygon(o, 'wall', P.nativeBuildingRing, P.passage.top, H.wallTop);
  componentEvidence.push('true-full-depth-central-vehicle-passage-open-through-lower-storey');
  polygon(o, 'foundation', passageRing, P.floor - 0.14, P.floor);
  componentEvidence.push('complete-intrinsic-passage-floor-and-lintel-not-a-black-facade-panel');
  polygon(o, 'roof', P.nativeBuildingRing, H.wallTop, H.roofTop);
  for (let i = 0; i < 4; i++) {
    const a = P.nativeBuildingRing[i],
      b = P.nativeBuildingRing[(i + 1) % 4];
    strip(o, 'wall', a, b, H.parapetThickness, H.roofTop, H.parapetTop);
    if (lod)
      strip(o, 'foundation', a, b, H.parapetThickness + 0.08, H.parapetTop, H.parapetTop + 0.07);
    strip(o, 'foundation', a, b, 0.15, H.upperFloor - 0.13, H.upperFloor + 0.05);
  }
  componentEvidence.push('whole-flat-roof-and-continuous-four-sided-parapet');
  for (let edge = 0; edge < 4; edge++)
    for (let storey = 0; storey < 2; storey++)
      for (let j = 0; j < (edge % 2 === 0 ? H.longFacadeBays : 2); j++)
        opening(o, edge, j, edge % 2 === 0 ? H.longFacadeBays : 2, storey, lod);
  componentEvidence.push('both-storeys-all-four-facades-with-estimated-louvre-and-grille-census');
  sign(o, lod);
  componentEvidence.push(
    'plain-original-procedural-exterior-customs-house-replica-lettering-no-copied-sign-art',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/w8/w8c/brunei_energy_hub',
  camera = [120, 65, 115],
  look = [0, 4, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Brunei Energy Hub — former Royal Customs House',
  wikidataId: 'Q115946015',
  cell: 'w8/w8c',
  category: 'museum',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: P.floor - H.plinthDepth - 0.04,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-customs-house-two-storeys-and-full-flat-roof', position: camera, lookAt: look },
    {
      name: 'genuine-central-through-passage-and-customs-sign',
      position: [12, 8, 28],
      lookAt: [0, 3.8, 0],
    },
    {
      name: 'whole-rear-facade-and-preserved-louvre-forms',
      position: [-105, 35, -85],
      lookAt: look,
    },
    { name: 'front-louvre-and-grille-section', position: [31, 5.3, 16], lookAt: [29, 3.6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-brunei-customs-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural entire customs-house/museum exterior under repository license. Exact whole native four-control/2storey building ODbL, independently bound to institutionalQ115946015identity. Renovation-designer written flatbox/louvres/signage facts/partner identity and user-owned Qualla passage text only; every image/video/figure unused. Floors/roof/bay census/fittings/finish/grade explicit estimates. Basic new procedural letter strokes, no copied historic sign artwork, borrowed meshes or texture pixels. No surveyed/photographic/current-world replacement approval.',
};
