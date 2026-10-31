/** Complete simple monument reconstructed from primary dimensions and description. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.96, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  marble: { slot: 'trim', localRef: 'palette:#d0cfc2', roughness: 0.72, metallic: 0 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.22 },
};
const colors = {
  stone: rgb('8d8f88'),
  concrete: rgb('c1c0b5'),
  marble: rgb('d0cfc2'),
  rail: rgb('57615c'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  p = p.filter((q, i) => i === 0 || Math.hypot(...q.map((v, j) => v - p[i - 1][j])) > 1e-8);
  if (p.length > 2 && Math.hypot(...p[0].map((v, j) => v - p.at(-1)[j])) < 1e-8) p.pop();
  if (p.length < 3) return;
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p.reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
function frustum(o, k, x, z, y0, y1, w0, d0, w1 = w0, d1 = d0) {
  const a = [
      [-w0 / 2, -d0 / 2],
      [w0 / 2, -d0 / 2],
      [w0 / 2, d0 / 2],
      [-w0 / 2, d0 / 2],
    ].map((p) => [p[0] + x, y0, p[1] + z]),
    b = [
      [-w1 / 2, -d1 / 2],
      [w1 / 2, -d1 / 2],
      [w1 / 2, d1 / 2],
      [-w1 / 2, d1 / 2],
    ].map((p) => [p[0] + x, y1, p[1] + z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i];
    face(o, k, [a[i], a[j], b[j], b[i]], n);
  }
  face(o, k, a, [0, -1, 0]);
  if (w1 > 0 && d1 > 0) face(o, k, b, [0, 1, 0]);
}
function rail(o, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    t = P.enclosure.railWidth / 2,
    n = [(-dz / l) * t, (dx / l) * t],
    y = P.enclosure.railHeight,
    r = [
      [a[0] + n[0], y - t, a[1] + n[1]],
      [b[0] + n[0], y - t, b[1] + n[1]],
      [b[0] - n[0], y - t, b[1] - n[1]],
      [a[0] - n[0], y - t, a[1] - n[1]],
    ],
    s = r.map((p) => [p[0], y + t, p[2]]);
  face(o, 'rail', r, [0, -1, 0]);
  face(o, 'rail', s, [0, 1, 0]);
  for (let i = 0; i < 4; i++) face(o, 'rail', [r[i], r[(i + 1) % 4], s[(i + 1) % 4], s[i]]);
}
function stones(o, lod) {
  if (lod === 0) return;
  const M = P.monument,
    rows = [0, 6, 12, 22][lod],
    cols = [0, 3, 5, 8][lod],
    w = (y) =>
      M.shaftBottomWidth +
      ((M.shaftTopWidth - M.shaftBottomWidth) * (y - M.shaftBottom)) / (M.shaftTop - M.shaftBottom);
  for (let side = 0; side < 4; side++) {
    const N = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ][side],
      U = [N[1], -N[0]],
      p = (u, y, d = 0) => [
        (U[0] * u * w(y)) / 2 + N[0] * (w(y) / 2 + d),
        y,
        (U[1] * u * w(y)) / 2 + N[1] * (w(y) / 2 + d),
      ];
    for (let row = 0; row < rows; row++) {
      const y0 = M.shaftBottom + (M.shaftTop - M.shaftBottom) * (row / rows) + 0.008,
        y1 = M.shaftBottom + (M.shaftTop - M.shaftBottom) * ((row + 1) / rows) - 0.008;
      const count = cols + (row % 2);
      for (let col = 0; col < count; col++) {
        const noise = ((side * 73 + row * 31 + col * 17) % 19) / 18,
          u0 = -1 + (col * 2) / count + 0.012,
          u1 = -1 + ((col + 1) * 2) / count - 0.012,
          skew = (noise - 0.5) * 0.025,
          points = [
            p(u0, y0 + Math.max(0, skew), 0.009),
            p(u1, y0 + Math.max(0, -skew), 0.009),
            p(u1, y1 - Math.max(0, skew), 0.009),
            p(u0, y1 - Math.max(0, -skew), 0.009),
          ],
          t = colors.stone.map((v) => Math.max(0, Math.min(1, v * (0.85 + noise * 0.26))));
        if (lod === 3) {
          const mid = p((u0 + u1) / 2, (y0 + y1) / 2, 0.012 + noise * 0.006);
          for (let i = 0; i < 4; i++)
            face(o, 'stone', [points[i], points[(i + 1) % 4], mid], [N[0], 0.2, N[1]], t);
        } else face(o, 'stone', points, [N[0], 0.2, N[1]], t);
      }
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const M = P.monument;
  for (const step of M.steps)
    frustum(o, 'concrete', 0, 0, step.y0, step.y1, step.width, step.width);
  componentEvidence.push('whole-stepped-base');
  frustum(
    o,
    'stone',
    0,
    0,
    M.shaftBottom,
    M.shaftTop,
    M.shaftBottomWidth,
    M.shaftBottomWidth,
    M.shaftTopWidth,
    M.shaftTopWidth,
  );
  frustum(o, 'stone', 0, 0, M.shaftTop, M.height, M.shaftTopWidth, M.shaftTopWidth, 0, 0);
  stones(o, lod);
  componentEvidence.push('whole-tapered-stone-obelisk');
  const plaques = [
    { y: 0.27, h: 0.16, w: 1.65, z: 1.327 },
    { y: 0.61, h: 0.23, w: 1.45, z: 1.108 },
    {
      y: 2.17,
      h: 0.88,
      w: 0.93,
      z:
        (M.shaftBottomWidth +
          ((M.shaftTopWidth - M.shaftBottomWidth) * (2.17 - M.shaftBottom)) /
            (M.shaftTop - M.shaftBottom)) /
          2 +
        0.025,
    },
  ];
  for (const p of plaques) {
    if (p.y < 1) {
      frustum(o, 'marble', 0, p.z, p.y - p.h / 2, p.y + p.h / 2, p.w, 0.035);
      continue;
    }
    const at = (x, y, offset) => [
      x,
      y,
      (M.shaftBottomWidth +
        ((M.shaftTopWidth - M.shaftBottomWidth) * (y - M.shaftBottom)) /
          (M.shaftTop - M.shaftBottom)) /
        2 +
        offset,
    ];
    const ring = [
      [-p.w / 2, p.y - p.h / 2],
      [p.w / 2, p.y - p.h / 2],
      [p.w / 2, p.y + p.h / 2],
      [-p.w / 2, p.y + p.h / 2],
    ];
    const front = ring.map((q) => at(...q, 0.065)),
      back = ring.map((q) => at(...q, 0.03));
    face(o, 'marble', front, [0, 0.15, 1]);
    face(o, 'marble', back, [0, -0.15, -1]);
    for (let i = 0; i < 4; i++)
      face(o, 'marble', [front[i], back[i], back[(i + 1) % 4], front[(i + 1) % 4]]);
  }
  componentEvidence.push('three-southern-marble-plaques');
  const E = P.enclosure,
    c = [
      [-E.halfWidth, E.halfDepth],
      [E.halfWidth, E.halfDepth],
      [E.halfWidth, -E.halfDepth],
      [-E.halfWidth, -E.halfDepth],
    ],
    posts = [];
  for (let side = 0; side < 4; side++)
    for (let j = 0; j < 3; j++) {
      const a = c[side],
        b = c[(side + 1) % 4],
        t = j / 3,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      posts.push([x, z]);
      frustum(o, 'concrete', x, z, -0.1, 0.13, E.postWidth * 1.6, E.postWidth * 1.6);
      frustum(
        o,
        'concrete',
        x,
        z,
        0.13,
        E.postHeight - 0.15,
        E.postWidth,
        E.postWidth,
        E.postWidth * 0.76,
        E.postWidth * 0.76,
      );
      frustum(
        o,
        'concrete',
        x,
        z,
        E.postHeight - 0.15,
        E.postHeight,
        E.postWidth * 0.76,
        E.postWidth * 0.76,
        0,
        0,
      );
    }
  for (let i = 0; i < posts.length; i++)
    if (i !== 1) rail(o, posts[i], posts[(i + 1) % posts.length]);
  componentEvidence.push('whole-low-enclosure-and-southern-access-gap');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r7/r7h/allan_cunningham_monument',
  camera = [8, 6, 12],
  look = [0, 2.1, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Allan Cunningham Monument — Cunningham’s Gap',
  wikidataId: 'Q130550538',
  cell: 'r7/r7h',
  category: 'monument',
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
  portableGroundY: -0.19,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_basalt_raw', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-monument-and-enclosure', position: camera, lookAt: look },
    {
      name: 'south-facing-marble-plaques-and-stepped-base',
      position: [1.5, 3, 6],
      lookAt: [0, 2, 0],
    },
    { name: 'rear-obelisk-stonework-and-complete-enclosure', position: [-7, 4, -9], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-cunningham-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.12,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.06, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.025, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Primary dimensional/construction facts used as facts; no source prose, archive photographs, photo textures, borrowed meshes or generated reference imagery incorporated. Qualla corpus screened first; all imagery unused. Exact native named memorial point under ODbL, matched to primary heritage site650225/Q130550538. Primary measured height/base and complete simple structure retained; fine divisions/stonework/plaques/enclosure are estimated. No photographic-fidelity or surveyed-ground-contact claim.',
};
