/** Complete concrete memorial pavilion, native podium, 48 pillars and two-pitched roof. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
};
const colors = {
  wall: rgb('d9d5c5'),
  roof: rgb('8a6348'),
  base: rgb('a69e8b'),
  trim: rgb('c6bda8'),
};
export const componentEvidence = [];
export const at = (u, v, y) => [
  P.basis.center[0] + P.basis.U[0] * u + P.basis.V[0] * v,
  y,
  P.basis.center[1] + P.basis.U[1] * u + P.basis.V[1] * v,
];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
const rect = (u, v, hu, hv, y) => [
  at(u - hu, v - hv, y),
  at(u + hu, v - hv, y),
  at(u + hu, v + hv, y),
  at(u - hu, v + hv, y),
];
function solid(o, k, a, b, bottom = true) {
  const c = a[0].map((_, i) => a.reduce((s, p) => s + p[i], 0) / a.length);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(
      o,
      k,
      [a[i], a[j], b[j], b[i]],
      [(a[i][0] + a[j][0]) / 2 - c[0], 0, (a[i][2] + a[j][2]) / 2 - c[2]],
    );
  }
  if (bottom) face(o, k, a, [0, -1, 0]);
  face(o, k, b, [0, 1, 0]);
}
const block = (o, k, u, v, hu, hv, y0, y1) =>
  solid(o, k, rect(u, v, hu, hv, y0), rect(u, v, hu, hv, y1));
const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function cap(o, k, ring, y, up) {
  let ids = ring.map((_, i) => i),
    area = ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
    sign = Math.sign(area),
    guard = 0;
  while (ids.length > 3) {
    let found = false;
    for (let i = 0; i < ids.length; i++) {
      const aa = ids[(i + ids.length - 1) % ids.length],
        bb = ids[i],
        cc = ids[(i + 1) % ids.length],
        a = ring[aa],
        b = ring[bb],
        c = ring[cc];
      if (cross2(a, b, c) * sign < 1e-7) continue;
      if (
        ids.some(
          (j) =>
            ![aa, bb, cc].includes(j) &&
            [cross2(a, b, ring[j]), cross2(b, c, ring[j]), cross2(c, a, ring[j])].every(
              (q) => q * sign >= -1e-8,
            ),
        )
      )
        continue;
      face(
        o,
        k,
        [a, b, c].map((p) => [p[0], y, p[1]]),
        [0, up, 0],
      );
      ids.splice(i, 1);
      found = true;
      break;
    }
    if (!found || guard++ > 100) throw Error('Native concave podium cannot be triangulated');
  }
  face(
    o,
    k,
    ids.map((i) => [ring[i][0], y, ring[i][1]]),
    [0, up, 0],
  );
}
function nativeTier(o, scale, y0, y1) {
  const r = P.nativeBaseRing.map((p) =>
      p.map((q, i) => P.basis.center[i] + (q - P.basis.center[i]) * scale),
    ),
    area = r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [(b[1] - a[1]) * Math.sign(area), 0, -(b[0] - a[0]) * Math.sign(area)];
    face(
      o,
      'base',
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
    );
  }
  cap(o, 'base', r, y0, -1);
  cap(o, 'base', r, y1, 1);
}
function frustum(o, k, u, v, hu, hv, topu, topv, y0, y1) {
  solid(o, k, rect(u, v, hu, hv, y0), rect(u, v, topu, topv, y1));
}
function domePot(o, u, v, lod) {
  if (!lod) {
    block(o, 'trim', u, v, 0.55, 0.55, P.floor, 5.5);
    return;
  }
  block(o, 'base', u, v, 0.67, 0.67, P.floor, P.floor + 0.35);
  frustum(o, 'wall', u, v, 0.55, 0.55, 0.42, 0.42, P.floor + 0.35, 4.55);
  block(o, 'trim', u, v, 0.68, 0.68, 4.55, 4.82);
  sphere(
    o,
    'trim',
    at(u, v, 5.15),
    [0.42, 0.4, 0.42],
    colors.trim,
    [6, 8, 12][lod - 1],
    [3, 4, 6][lod - 1],
  );
  block(o, 'trim', u, v, 0.1, 0.1, 5.45, 5.68);
}
function lion(o, u, v, N, lod) {
  const W = [N[1], -N[0]],
    q = (s, t, y) => at(u + W[0] * s + N[0] * t, v + W[1] * s + N[1] * t, y),
    y = 0.75;
  if (!lod) {
    const a = [q(-0.28, -0.5, y), q(-0.28, 0.5, y), q(-0.28, -0.12, y + 1.25)],
      b = [q(0.28, -0.5, y), q(0.28, 0.5, y), q(0.28, -0.12, y + 1.25)];
    const d = at(W[0], W[1], 0).map((v, i) => v - at(0, 0, 0)[i]);
    face(
      o,
      'trim',
      a,
      d.map((v) => -v),
    );
    face(o, 'trim', b, d);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      face(o, 'trim', [a[i], a[j], b[j], b[i]]);
    }
    return;
  }
  const seg = [0, 6, 8, 12][lod],
    lat = [0, 3, 4, 6][lod];
  block(o, 'base', u, v, 0.6, 0.68, y - 0.14, y);
  sphere(o, 'trim', q(0, -0.1, y + 0.5), [0.38, 0.59, 0.43], colors.trim, seg, lat);
  sphere(o, 'trim', q(0, 0.03, y + 1.09), [0.35, 0.39, 0.35], colors.trim, seg, lat);
  sphere(o, 'trim', q(0, 0.27, y + 1.05), [0.24, 0.16, 0.23], colors.trim, seg, lat);
  if (lod > 1)
    for (const s of [-1, 1]) {
      sphere(o, 'trim', q(s * 0.2, 0.36, y + 0.18), [0.14, 0.22, 0.29], colors.trim, seg, lat);
      sphere(o, 'trim', q(s * 0.23, 0.01, y + 1.37), [0.1, 0.13, 0.08], colors.trim, seg, lat);
    }
  if (lod > 1) {
    for (const s of [-1, 1])
      beam(
        o,
        'trim',
        q(s * 0.22, 0.2, y + 0.2),
        q(s * 0.22, 0.03, y + 0.75),
        0.12,
        0.14,
        colors.trim,
      );
    beam(o, 'trim', q(0.34, -0.25, y + 0.45), q(0.46, -0.5, y + 0.05), 0.1, 0.1, colors.trim);
  }
}
function roof(o, lod) {
  const R = P.roof,
    A = rect(0, 0, R.halfLength, R.halfWidth, R.eaveY),
    B = rect(0, 0, R.halfLength - R.breakInset, R.halfWidth - R.breakInset, R.breakY),
    ridge = R.halfLength - R.halfWidth,
    ends = [at(-ridge, 0, R.ridgeY), at(ridge, 0, R.ridgeY)];
  for (let i = 0; i < 4; i++)
    face(o, 'roof', [A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]], [0, 1, 0]);
  face(o, 'roof', [B[0], B[1], ends[1], ends[0]], [0, 1, 0]);
  face(o, 'roof', [B[1], B[2], ends[1]], [0, 1, 0]);
  face(o, 'roof', [B[2], B[3], ends[0], ends[1]], [0, 1, 0]);
  face(o, 'roof', [B[3], B[0], ends[0]], [0, 1, 0]);
  face(
    o,
    'wall',
    A.map((p) => [p[0], P.pavilion.columnTop, p[2]]),
    [0, -1, 0],
  );
  if (lod) {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      beam(o, 'roof', A[i], A[j], 0.17, 0.22, colors.roof);
      beam(o, 'trim', B[i], B[j], 0.13, 0.13, colors.trim);
      beam(o, 'roof', A[i], B[i], 0.13, 0.13, colors.roof);
    }
    beam(o, 'trim', ends[0], ends[1], 0.26, 0.3, colors.trim);
    for (const s of [-1, 1]) {
      beam(
        o,
        'trim',
        at(s * ridge, 0, R.ridgeY),
        at(s * (ridge + 0.2), 0, R.ridgeY + 0.65),
        0.17,
        0.19,
        colors.trim,
      );
      beam(
        o,
        'trim',
        at(s * (ridge + 0.2), 0, R.ridgeY + 0.65),
        at(s * (ridge - 0.25), 0, R.ridgeY + 0.85),
        0.15,
        0.17,
        colors.trim,
      );
    }
  }
  if (lod > 1) {
    const rows = lod === 2 ? 8 : 16;
    for (let j = 1; j < rows; j++) {
      const t = j / rows;
      for (const s of [-1, 1]) {
        const v = s * (R.halfWidth - R.breakInset) * (1 - t),
          y = R.breakY + (R.ridgeY - R.breakY) * t + 0.025,
          hl = (R.halfLength - R.breakInset) * (1 - t) + ridge * t;
        beam(o, 'roof', at(-hl, v, y), at(hl, v, y), 0.035, 0.045, colors.roof);
      }
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  for (let i = 0; i < 3; i++)
    nativeTier(
      o,
      P.terrace.scales[i],
      i ? P.terrace.levels[i - 1] : P.terrace.bottom,
      P.terrace.levels[i],
    );
  componentEvidence.push(
    'full-original-twelve-control-podium-basement-exterior-three-tier-terrace',
  );
  const G = P.pavilion,
    us = Array.from(
      { length: G.rows },
      (_, i) => -G.gridHalfLength + (2 * G.gridHalfLength * i) / (G.rows - 1),
    ),
    vs = Array.from(
      { length: G.columns },
      (_, i) => -G.gridHalfWidth + (2 * G.gridHalfWidth * i) / (G.columns - 1),
    );
  // Two estimated local support piers bridge the inherited podium notch; no terrain/floor refit.
  for (const v of vs.filter((v) => v > 0))
    block(o, 'base', us[0], v, 0.49, 0.49, P.terrace.bottom, P.floor);
  for (const u of us)
    for (const v of vs) {
      if (!lod) {
        solid(
          o,
          'wall',
          rect(u, v, 0.29, 0.29, P.floor),
          rect(u, v, 0.29, 0.29, G.columnTop),
          false,
        );
        continue;
      }
      block(o, 'base', u, v, 0.47, 0.47, P.floor, P.floor + 0.28);
      frustum(o, 'wall', u, v, 0.35, 0.35, 0.29, 0.29, P.floor + 0.28, G.shaftTop);
      frustum(
        o,
        'trim',
        u,
        v,
        0.29,
        0.29,
        0.62,
        0.62,
        G.shaftTop,
        lod === 1 ? G.columnTop : G.shaftTop + 0.45,
      );
      if (lod > 1) block(o, 'trim', u, v, 0.64, 0.64, G.shaftTop + 0.45, G.columnTop);
      if (lod > 1) {
        for (const s of [-1, 1]) {
          beam(
            o,
            'trim',
            at(u, v, G.shaftTop + 0.06),
            at(u + s * 0.88, v, G.columnTop - 0.13),
            0.18,
            0.22,
            colors.trim,
          );
          beam(
            o,
            'trim',
            at(u, v, G.shaftTop + 0.06),
            at(u, v + s * 0.78, G.columnTop - 0.13),
            0.18,
            0.22,
            colors.trim,
          );
        }
        if (lod === 3) {
          for (const s of [-1, 1])
            for (const a of [-0.18, 0, 0.18]) {
              beam(
                o,
                'trim',
                at(u + a, v + s * 0.302, P.floor + 0.55),
                at(u + a, v + s * 0.302, G.shaftTop - 0.18),
                0.035,
                0.035,
                colors.trim,
              );
              beam(
                o,
                'trim',
                at(u + s * 0.302, v + a, P.floor + 0.55),
                at(u + s * 0.302, v + a, G.shaftTop - 0.18),
                0.035,
                0.035,
                colors.trim,
              );
            }
        }
      }
    }
  componentEvidence.push(
    'complete-open-sided-forty-eight-concrete-pillars-and-estimated-pekada-capitals',
  );
  const panels = [];
  for (const s of [-1, 1])
    for (let i = 0; i < us.length - 1; i++)
      panels.push([
        [us[i] + 0.64, s * G.gridHalfWidth],
        [us[i + 1] - 0.64, s * G.gridHalfWidth],
      ]);
  for (const s of [-1, 1])
    for (let i = 0; i < vs.length - 1; i++)
      panels.push([
        [s * G.gridHalfLength, vs[i] + 0.64],
        [s * G.gridHalfLength, vs[i + 1] - 0.64],
      ]);
  for (const [a, b] of panels) {
    const A = at(...a, 9.1),
      B = at(...b, 9.1),
      C = at(...b, 9.92),
      D = at(...a, 9.92);
    face(o, 'trim', [A, B, C, D]);
    face(o, 'trim', [D, C, B, A]);
    if (lod > 1) {
      beam(o, 'trim', A, B, 0.12, 0.12, colors.trim);
      beam(o, 'trim', D, C, 0.12, 0.12, colors.trim);
      if (lod > 1) {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        for (const s of [-1, 1])
          beam(
            o,
            'wall',
            at(m[0], m[1], 9.23),
            at(m[0] + (b[0] - a[0]) * 0.28 * s, m[1] + (b[1] - a[1]) * 0.28 * s, 9.72),
            0.08,
            0.12,
            colors.wall,
          );
      }
    }
  }
  componentEvidence.push('twenty-eight-interior-frieze-panels-with-original-abstract-decoration');
  roof(o, lod);
  componentEvidence.push('complete-two-pitched-kandyan-hipped-concrete-roof-and-ridge');
  // Tower plinths remain on the actual inset terrace, including its original corner notch.
  for (const u of [-1, 1])
    for (const v of [-1, 1])
      domePot(
        o,
        u * (P.basis.halfLength - (u < 0 && v > 0 ? 5.9 : 3.0)),
        v * (P.basis.halfWidth - 3.0),
        lod,
      );
  componentEvidence.push('four-symbolic-corner-towers-and-pots');
  for (const s of [-1, 1]) {
    for (const u of [-17, -6, 6, 17]) lion(o, u, s * (P.basis.halfWidth - 0.85), [0, s], lod);
    for (const v of [-5, 5]) lion(o, s * (P.basis.halfLength - 1.7), v, [s, 0], lod);
  }
  componentEvidence.push('twelve-symbolic-seated-lion-motifs-on-all-four-sides');
  if (lod) {
    for (const s of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const v = s * (G.gridHalfWidth + 1.1 + i * 0.15),
          y = P.floor - (i + 1) * 0.25;
        block(o, 'base', 0, v, 2.1, 0.16, P.terrace.bottom, y);
      }
    componentEvidence.push('estimated-integrated-side-stair-flights');
  }
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tc/tc0/independence_memorial_hall',
  camera = at(54, 52, 31),
  look = at(0, 0, 6);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Independence Memorial Hall — Colombo',
  wikidataId: 'Q6016118',
  cell: 'tc/tc0',
  category: 'memorial',
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
  portableGroundY: -0.21,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'tile_ceramic', 'stone_ashlar', 'plaster_lime'],
  qaCameras: [
    {
      name: 'whole-pavilion-native-terrace-and-complete-hipped-roof',
      position: camera,
      lookAt: look,
    },
    {
      name: 'open-forty-eight-pillar-hall-and-pekadas',
      position: at(9, 20, 6),
      lookAt: at(0, 0, 5.8),
    },
    {
      name: 'opposite-whole-hall-corner-towers-and-symbolic-lions',
      position: at(-51, -48, 26),
      lookAt: look,
    },
    {
      name: 'two-pitched-roof-ridge-and-closed-soffit',
      position: at(27, 26, 28),
      lookAt: at(0, 0, 12),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-memorial-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural whole-hall geometry under repository license; exact native hall/podium plan under ODbL. Official and traceably transmitted designer construction facts used as facts. No source photos, drawings, pictorial artworks, figure pixels or borrowed meshes. Qualla searched first, all uncertain/conflicted images unused and unchanged. Vertical sections, grid setout, roof profile, original abstract motifs and finish explicitly estimated; no photographic or survey fidelity claim.',
};
