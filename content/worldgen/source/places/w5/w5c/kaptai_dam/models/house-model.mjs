/** Entire Kaptai earthfill dam, sixteen radial gates and western five-unit powerhouse. */
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
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  rock: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  crown: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.25 },
  gate: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.3 },
  window: { slot: 'window', graph: 'window_punched', roughness: 0.4, metallic: 0.1 },
};
const colors = {
  concrete: rgb('b8b5a5'),
  rock: rgb('999477'),
  crown: rgb('8a8b80'),
  metal: rgb('95a5aa'),
  gate: rgb('4b6069'),
  window: rgb('354f55'),
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
function cap(o, k, ring, y, up, holes = []) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      k,
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid full dam/plant cap');
  const m = temp.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3)).map((j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, p, [0, up, 0]);
  }
}

function outward(r, a, b, inward = false) {
  const area = r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
    sign = Math.sign(area) * (inward ? -1 : 1);
  return [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign];
}
function polygon(o, k, r, y0, y1) {
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
      outward(r, a, b),
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
function block(o, k, c, U, V, w, d, y0, y1) {
  polygon(
    o,
    k,
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [
      c[0] + (U[0] * u * w) / 2 + (V[0] * v * d) / 2,
      c[1] + (U[1] * u * w) / 2 + (V[1] * v * d) / 2,
    ]),
    y0,
    y1,
  );
}
export function crestAt(x) {
  const r = P.nativeCrest;
  for (let i = 1; i < r.length; i++)
    if (x >= r[i - 1][0] - 1e-7 && x <= r[i][0] + 1e-7) {
      const t = (x - r[i - 1][0]) / (r[i][0] - r[i - 1][0]);
      return [x, r[i - 1][1] * (1 - t) + r[i][1] * t];
    }
  return x < r[0][0] ? [...r[0]] : [...r.at(-1)];
}
const route = (x0, x1) => [
  crestAt(x0),
  ...P.nativeCrest.filter((p) => p[0] > x0 + 1e-6 && p[0] < x1 - 1e-6),
  crestAt(x1),
];
function normals(r) {
  return r.map((_, i) => {
    const a = r[Math.max(0, i - 1)],
      b = r[Math.min(r.length - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    return [-dz / l, dx / l];
  });
}
function earth(o, section, lod) {
  let r = route(...section.x);
  if (lod > 1) {
    const step = lod === 2 ? 35 : 18,
      more = [];
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1],
        b = r[i],
        n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < n; j++) more.push(a.map((v, k) => v * (1 - j / n) + (b[k] * j) / n));
    }
    more.push(r.at(-1));
    r = more;
  }
  const ns = normals(r),
    half = P.dam.crownWidth / 2,
    foot = half + P.dam.nominalHeight * P.dam.sideSlope,
    ring = (p, n) =>
      [
        [-foot, P.floor],
        [-half, P.dam.crestY],
        [half, P.dam.crestY],
        [foot, P.floor],
      ].map(([w, y]) => [p[0] + n[0] * w, y, p[1] + n[1] * w]);
  const rings = r.map((p, i) => ring(p, ns[i]));
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1],
      b = rings[i];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      face(
        o,
        j === 1 ? 'crown' : 'rock',
        [a[j], b[j], b[k], a[k]],
        j === 3 ? [0, -1, 0] : [0, 1, 0],
      );
    }
  }
  face(o, 'rock', rings[0], [-(r[1][0] - r[0][0]), 0, -(r[1][1] - r[0][1])]);
  face(o, 'rock', rings.at(-1), [r.at(-1)[0] - r.at(-2)[0], 0, r.at(-1)[1] - r.at(-2)[1]]);
}
function crestRoad(o, lod) {
  const r = P.nativeCrest,
    ns = normals(r),
    y = P.dam.crestY + 0.015,
    w = P.dam.roadWidth / 2,
    p = (i, s, h) => [r[i][0] + ns[i][0] * s, h, r[i][1] + ns[i][1] * s];
  for (let i = 1; i < r.length; i++)
    face(
      o,
      'crown',
      [p(i - 1, -w, y), p(i, -w, y), p(i, w, y), p(i - 1, w, y)],
      [0, 1, 0],
      rgb('787d76'),
    );
  if (lod)
    for (const side of [-1, 1])
      for (let i = 1; i < r.length; i++) {
        const a = p(i - 1, side * (w + 0.35), y + 1.1),
          b = p(i, side * (w + 0.35), y + 1.1);
        beam(o, 'metal', a, b, 0.07, 0.08, colors.metal);
        const count = Math.ceil(
          Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]) / [1, 48, 18, 9][lod],
        );
        for (let j = 0; j < count; j++) {
          const t = j / count,
            q = a.map((v, k) => v * (1 - t) + b[k] * t);
          beam(o, 'metal', [q[0], y, q[2]], q, 0.07, 0.07, colors.metal);
        }
      }
}
const spoint = (u, v, y) => {
  const B = P.spillway.basis;
  return [B.center[0] + B.U[0] * u + B.V[0] * v, y, B.center[1] + B.U[1] * u + B.V[1] * v];
};
function spillway(o, lod) {
  const S = P.spillway,
    B = S.basis,
    bay = B.length / S.gates;
  polygon(o, 'concrete', P.nativeSpillwayRing, P.floor, S.sillY - 0.3);
  // Every gate and supporting pier survives every authored level.
  for (let i = 0; i <= S.gates; i++) {
    const u = -B.length / 2 + i * bay,
      c = spoint(u, 0, 0);
    block(
      o,
      'concrete',
      [c[0], c[2]],
      B.U,
      B.V,
      bay - S.clearGateWidth,
      15,
      S.sillY - 0.3,
      S.pierTopY,
    );
  }
  block(o, 'crown', B.center, B.U, B.V, B.length + 3, 6, S.pierTopY, S.bridgeY);
  for (let i = 0; i < S.gates; i++) {
    const u = -B.length / 2 + (i + 0.5) * bay,
      w = S.clearGateWidth / 2,
      top = S.sillY + S.gateHeight;
    if (lod === 0) {
      const c = spoint(u, -2.5, 0);
      block(o, 'gate', [c[0], c[2]], B.U, B.V, S.clearGateWidth, 1.2, S.sillY, top);
    } else {
      const count = [1, 4, 8, 14][lod],
        radius = S.gateHeight / Math.sin(0.9),
        q = (side, t, thick) =>
          spoint(
            u + side * w,
            -radius * (1 - Math.cos(t * 0.9)) + thick,
            top - radius * Math.sin(t * 0.9),
          );
      for (let j = 1; j <= count; j++) {
        const a = (j - 1) / count,
          b = j / count;
        for (const thick of [0, 0.35])
          face(
            o,
            'gate',
            [q(-1, a, thick), q(1, a, thick), q(1, b, thick), q(-1, b, thick)],
            [B.V[0] * (thick === 0 ? -1 : 1), 0, B.V[1] * (thick === 0 ? -1 : 1)],
          );
        for (const side of [-1, 1])
          face(
            o,
            'gate',
            [q(side, a, 0), q(side, b, 0), q(side, b, 0.35), q(side, a, 0.35)],
            [side * B.U[0], 0, side * B.U[1]],
          );
      }
      for (const t of [0, 1])
        face(
          o,
          'gate',
          [q(-1, t, 0), q(1, t, 0), q(1, t, 0.35), q(-1, t, 0.35)],
          [0, t === 0 ? 1 : -1, 0],
        );
      for (const side of [-1, 1]) {
        const p = spoint(u + side * (bay / 2 - 0.5), 0, S.bridgeY);
        beam(o, 'metal', p, [p[0], S.hoistY - 1, p[2]], 0.22, 0.28, colors.metal);
      }
      beam(
        o,
        'metal',
        spoint(u - bay / 2 + 0.5, 0, S.hoistY - 1),
        spoint(u + bay / 2 - 0.5, 0, S.hoistY - 1),
        0.26,
        0.35,
        colors.metal,
      );
      const c = spoint(u, 0, 0);
      block(o, 'metal', [c[0], c[2]], B.U, B.V, 1.9, 1.4, S.hoistY - 1.4, S.hoistY);
      if (lod > 1) {
        for (const side of [-1, 1])
          beam(
            o,
            'metal',
            spoint(u + side * (w - 0.5), -3, top - 4),
            spoint(u + side * (w - 0.5), 4, S.sillY + 5),
            0.16,
            0.2,
            colors.metal,
          );
        for (const t of [0.25, 0.5, 0.75])
          beam(o, 'metal', q(-1, t, 0.38), q(1, t, 0.38), 0.12, 0.15, colors.metal);
      }
    }
  }
  const width = B.length + 3,
    v0 = 7.5,
    v1 = S.chuteLength;
  for (const down of [0, 1])
    face(
      o,
      'concrete',
      [
        spoint(-width / 2, v0, S.sillY - 0.3 - down),
        spoint(width / 2, v0, S.sillY - 0.3 - down),
        spoint(width / 2, v1, S.chuteEndY - down),
        spoint(-width / 2, v1, S.chuteEndY - down),
      ],
      [0, down ? -1 : 1, 0],
    );
  for (const side of [-1, 1]) {
    const u = (side * width) / 2;
    face(
      o,
      'concrete',
      [
        spoint(u, v0, S.sillY - 0.3),
        spoint(u, v1, S.chuteEndY),
        spoint(u, v1, S.chuteEndY + 2.4),
        spoint(u, v0, S.sillY + 2.1),
      ],
      [side * B.U[0], 0, side * B.U[1]],
    );
    face(
      o,
      'concrete',
      [
        spoint(u - side * 0.8, v0, S.sillY + 2.1),
        spoint(u - side * 0.8, v1, S.chuteEndY + 2.4),
        spoint(u, v1, S.chuteEndY + 2.4),
        spoint(u, v0, S.sillY + 2.1),
      ],
      [0, 1, 0],
    );
    face(
      o,
      'concrete',
      [
        spoint(u - side * 0.8, v0, S.sillY - 0.3),
        spoint(u - side * 0.8, v1, S.chuteEndY),
        spoint(u - side * 0.8, v1, S.chuteEndY + 2.4),
        spoint(u - side * 0.8, v0, S.sillY + 2.1),
      ],
      [-side * B.U[0], 0, -side * B.U[1]],
    );
  }
  const end = spoint(0, v1 + 8, 0);
  block(o, 'concrete', [end[0], end[2]], B.U, B.V, width, 16, S.chuteEndY - 1, S.chuteEndY);
  if (lod) {
    for (const side of [-1, 1])
      beam(
        o,
        'metal',
        spoint(-B.length / 2, side * 2.6, S.bridgeY + 1.05),
        spoint(B.length / 2, side * 2.6, S.bridgeY + 1.05),
        0.06,
        0.07,
        colors.metal,
      );
    for (let i = 0; i <= S.gates; i++)
      for (const side of [-1, 1])
        beam(
          o,
          'metal',
          spoint(-B.length / 2 + i * bay, side * 2.6, S.bridgeY),
          spoint(-B.length / 2 + i * bay, side * 2.6, S.bridgeY + 1.05),
          0.06,
          0.07,
          colors.metal,
        );
  }
}
function pipe(o, a, b, r, n) {
  const d = b.map((v, i) => v - a[i]),
    l = Math.hypot(...d),
    axis = d.map((v) => v / l),
    U = [0, 0, 1],
    V = [axis[1], -axis[0], 0],
    ring = (c) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (U[k] * Math.cos(t) + V[k] * Math.sin(t)));
      }),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      norm = A[i].map((v, k) => v - a[k]);
    face(o, 'gate', [A[i], A[j], B[j], B[i]], norm);
  }
  face(
    o,
    'gate',
    A,
    axis.map((v) => -v),
  );
  face(o, 'gate', B, axis);
}
export const plantPoint = (u, v, y) => {
  const H = P.powerhouse;
  return [H.center[0] + H.U[0] * u + H.V[0] * v, y, H.center[1] + H.U[1] * u + H.V[1] * v];
};
function powerhouse(o, lod) {
  const H = P.powerhouse,
    L = H.length / 2,
    D = H.depth / 2;
  block(o, 'concrete', H.center, H.U, H.V, H.length + 2, H.depth + 2, P.floor, H.floor);
  block(o, 'concrete', H.center, H.U, H.V, H.length, H.depth, H.floor, H.wallTop);
  for (const side of [-1, 1])
    face(
      o,
      'metal',
      [
        plantPoint(-L, 0, H.ridge),
        plantPoint(L, 0, H.ridge),
        plantPoint(L, side * D, H.wallTop),
        plantPoint(-L, side * D, H.wallTop),
      ],
      [side * H.V[0], 1, side * H.V[1]],
      rgb('707d80'),
    );
  for (const side of [-1, 1])
    face(
      o,
      'concrete',
      [
        plantPoint(side * L, -D, H.wallTop),
        plantPoint(side * L, D, H.wallTop),
        plantPoint(side * L, 0, H.ridge),
      ],
      [side * H.U[0], 0, side * H.U[1]],
    );
  block(
    o,
    'concrete',
    H.intakeCenter,
    H.U,
    H.V,
    H.intakeLength,
    H.intakeDepth,
    H.intakeBottom,
    H.intakeTop,
  );
  const bay = H.length / H.units;
  for (let i = 0; i < H.units; i++) {
    const u = -L + (i + 0.5) * bay,
      z = H.center[1] + u;
    pipe(
      o,
      [H.intakeCenter[0] - H.intakeDepth / 2, H.penstockTop, z],
      [H.center[0] + D, H.penstockBottom, z],
      H.penstockRadius,
      [8, 12, 20, 32][lod],
    );
    for (const side of [-1, 1]) {
      const n = [side * H.V[0], 0, side * H.V[1]],
        p = (a, y) => plantPoint(a, side * (D + 0.025), y);
      face(
        o,
        'window',
        [
          p(u - bay * 0.34, H.wallTop - 5.5),
          p(u + bay * 0.34, H.wallTop - 5.5),
          p(u + bay * 0.34, H.wallTop - 1.5),
          p(u - bay * 0.34, H.wallTop - 1.5),
        ],
        n,
      );
      if (lod) {
        for (const a of [u - bay * 0.34, u + bay * 0.34])
          beam(o, 'concrete', p(a, H.floor), p(a, H.wallTop), 0.5, 0.5, colors.concrete);
        for (let j = 1; j < [0, 2, 4, 6][lod]; j++)
          beam(
            o,
            'metal',
            p(u - bay * 0.34 + (bay * 0.68 * j) / [1, 2, 4, 6][lod], H.wallTop - 5.5),
            p(u - bay * 0.34 + (bay * 0.68 * j) / [1, 2, 4, 6][lod], H.wallTop - 1.5),
            0.09,
            0.12,
            colors.metal,
          );
      }
    }
    const outletX = H.center[0] - D - 0.03;
    face(
      o,
      'gate',
      [
        [outletX, H.floor + 0.8, z - 4],
        [outletX, H.floor + 0.8, z + 4],
        [outletX, H.floor + 4.2, z + 4],
        [outletX, H.floor + 4.2, z - 4],
      ],
      [-1, 0, 0],
      rgb('283d40'),
    );
    if (lod > 1)
      for (const side of [-1, 1])
        beam(
          o,
          'metal',
          plantPoint(u, 0, H.ridge + 0.05),
          plantPoint(u, side * D, H.wallTop + 0.05),
          0.08,
          0.12,
          colors.metal,
        );
    if (lod) {
      const c = [H.intakeCenter[0], z];
      block(o, 'gate', c, H.U, H.V, 7, 3, H.intakeTop + 0.1, H.intakeTop + 1.6);
      beam(
        o,
        'metal',
        [c[0] - 3, H.intakeTop + 3, c[1] - 4],
        [c[0] - 3, H.intakeTop + 3, c[1] + 4],
        0.16,
        0.22,
        colors.metal,
      );
      for (const q of [-4, 4])
        beam(
          o,
          'metal',
          [c[0] - 3, H.intakeTop, c[1] + q],
          [c[0] - 3, H.intakeTop + 3, c[1] + q],
          0.16,
          0.2,
          colors.metal,
        );
    }
  }
  if (lod > 1) {
    for (const u of [-L, L])
      for (const side of [-1, 1])
        beam(
          o,
          'metal',
          plantPoint(u, 0, H.ridge + 0.05),
          plantPoint(u, side * D, H.wallTop + 0.05),
          0.1,
          0.16,
          colors.metal,
        );
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  earth(o, { x: [P.nativeCrest[0][0], P.nativeCrest.at(-1)[0]] }, lod);
  componentEvidence.push('entire-45point7m-earthfill-dam-on-all-sixteen-original-crest-controls');
  crestRoad(o, lod);
  componentEvidence.push('entire-native-666point66m-crest-road-and-safety-rails');
  spillway(o, lod);
  componentEvidence.push('complete-original-leftbank-spillway-envelope-all-sixteen-radial-gates');
  componentEvidence.push('full-spillway-bridge-piers-hoists-downstream-chute-and-apron');
  powerhouse(o, lod);
  componentEvidence.push('whole-western-five-unit-powerhouse-all-walls-and-entire-roof');
  componentEvidence.push('whole-five-bay-intake-all-five-penstocks-and-tailrace-outlets');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/w5/w5c/kaptai_dam',
  camera = [1300, 850, 1380],
  look = [230, -2, 75],
  B = P.spillway.basis,
  H = P.powerhouse;
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Kaptai Dam — Karnaphuli',
  wikidataId: 'Q1734089',
  cell: 'w5/w5c',
  category: 'dam',
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
  portableGroundY: P.floor - 0.02,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 16000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'stone_basalt_raw',
    'metal_painted',
    'window_punched',
  ],
  qaCameras: [
    { name: 'whole-dam-spillway-and-western-powerhouse', position: camera, lookAt: look },
    {
      name: 'complete-sixteen-radial-gate-spillway-and-chute',
      position: [B.center[0] + 150, 170, B.center[1] + 260],
      lookAt: [B.center[0], -3, B.center[1] + 30],
    },
    {
      name: 'whole-western-five-unit-powerhouse-and-intake',
      position: [H.center[0] - 145, 95, H.center[1] + 170],
      lookAt: [H.center[0] + 30, -9, H.center[1]],
    },
    {
      name: 'complete-original-curved-main-embankment-crest',
      position: [-40, 180, 410],
      lookAt: [20, 0, 50],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-kaptai-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.55, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural complete dam/spillway/five-unitpowerhouse exterior under repositorylicense. Original numerical map underODbL; primary writtenengineering facts only, no sourcephoto/figure/drawing pixels/borrowedmesh/textures. Quallasearchedfirst, allimageryunused/questionablesourcesskipped. Exactprofile/plantplan/roof/chute/gradeestimates disclosed; originalproviderfieldandDEMvoid preserved. No surveyed/currentworld/photoaccuracy claim.',
};
