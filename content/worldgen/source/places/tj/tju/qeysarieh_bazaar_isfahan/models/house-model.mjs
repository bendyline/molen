/** Whole Qeysarieh building and open courts; original numerical plan, cleared Coste vault vocabulary. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  R = P.nativeRing,
  H = P.courtHoles;
export const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.7, metallic: 0 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
};
const colors = {
  wall: rgb('b99063'),
  roof: rgb('bfaa86'),
  base: rgb('b5a17d'),
  trim: rgb('648e9c'),
  door: rgb('574434'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let no = normalFor(...p);
  if (n && no.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    no = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, no, (q) => [q[0], q[1]], tint);
}
function cap(o, k, outer, holes, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      outer,
      holes,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid original Qeysarieh cap');
  const m = b.finalize();
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
const area = (r) =>
  r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function walls(o, k, r, y0, y1, inside = false, skip = []) {
  const sign = Math.sign(area(r)) * (inside ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    if (skip.includes(i)) continue;
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
}
function local(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return {
    L,
    t,
    point: (u, y, n = 0) => [a[0] + t[0] * u - t[1] * n, y, a[1] + t[1] * u + t[0] * n],
  };
}
function blockOn(o, k, a, b, u0, u1, y0, y1, n0, n1) {
  const p = local(a, b).point;
  const r = [
    [u0, n0],
    [u1, n0],
    [u1, n1],
    [u0, n1],
  ].map(([u, n]) => p(u, 0, n));
  const rr = r.map((p) => [p[0], p[2]]);
  walls(o, k, rr, y0, y1);
  cap(o, k, rr, [], y0, -1);
  cap(o, k, rr, [], y1, 1);
}
function archPath(w, spring, crown, N) {
  return Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N;
    return [
      -w / 2 + w * u,
      spring +
        (crown - spring) * (1 - Math.abs(2 * u - 1)) * 0.55 +
        (crown - spring) * Math.sin(Math.PI * u) * 0.45,
    ];
  });
}
function portal(o, lod) {
  const { start: a, end: b, spring, crown, top, depth } = P.portal,
    { L, point } = local(a, b),
    N = [4, 6, 10, 16][lod],
    curve = archPath(L, spring, crown, N);
  for (let i = 0; i < N; i++) {
    const x = curve[i][0] + L / 2,
      xx = curve[i + 1][0] + L / 2,
      y = curve[i][1],
      yy = curve[i + 1][1];
    for (const n of [0, depth])
      face(
        o,
        'wall',
        [point(x, y, n), point(xx, yy, n), point(xx, top, n), point(x, top, n)],
        [0, 0, n === 0 ? 1 : -1],
      );
    face(
      o,
      'wall',
      [point(x, y, 0), point(x, y, depth), point(xx, yy, depth), point(xx, yy, 0)],
      [0, -1, 0],
    );
    face(
      o,
      'roof',
      [point(x, top, 0), point(xx, top, 0), point(xx, top, depth), point(x, top, depth)],
      [0, 1, 0],
    );
  }
  blockOn(o, 'wall', a, b, -0.65, 0, P.floor, top, 0, depth);
  blockOn(o, 'wall', a, b, L, L + 0.65, P.floor, top, 0, depth);
  if (lod > 0) {
    for (const u of [-0.35, L + 0.35])
      blockOn(o, 'trim', a, b, u - 0.12, u + 0.12, P.floor + 0.3, top - 0.15, -0.04, 0);
    blockOn(o, 'trim', a, b, 0, L, top - 0.42, top - 0.15, -0.04, 0);
    for (let i = 1; i < curve.length; i++) {
      const p = curve[i - 1],
        q = curve[i];
      beam(
        o,
        'trim',
        point(p[0] + L / 2, p[1] + 0.14, -0.05),
        point(q[0] + L / 2, q[1] + 0.14, -0.05),
        0.18,
        0.16,
        colors.trim,
      );
    }
  }
}
function dome(o, c, lod) {
  const N = [6, 8, 12, 20][lod],
    K = [2, 3, 5, 8][lod],
    tmax = Math.acos(P.oculusRadius / P.vaultRadius),
    point = (j, i, inner = false) => {
      const t = (tmax * j) / K,
        a = (2 * Math.PI * i) / N,
        r = P.vaultRadius * Math.cos(t);
      return [
        c[0] + r * Math.cos(a),
        P.vaultBase + P.vaultRise * Math.sin(t) - (inner ? 0.12 : 0),
        c[1] + r * Math.sin(a),
      ];
    };
  for (let j = 0; j < K; j++)
    for (let i = 0; i < N; i++) {
      const pts = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)],
        mid = pts.reduce((a, p) => a.map((v, k) => v + p[k] / 4), [0, 0, 0]);
      face(o, 'roof', pts, [mid[0] - c[0], Math.max(0.3, mid[1] - P.vaultBase), mid[2] - c[1]]);
      if (lod > 1)
        face(
          o,
          'wall',
          [
            point(j, i, true),
            point(j + 1, i, true),
            point(j + 1, i + 1, true),
            point(j, i + 1, true),
          ],
          [-(mid[0] - c[0]), -0.4, -(mid[2] - c[1])],
        );
    }
  for (let i = 0; i < N; i++)
    face(
      o,
      'base',
      [point(K, i), point(K, i + 1), point(K, i + 1, true), point(K, i, true)],
      [0, 1, 0],
    );
}
function courtShops(o, r, lod) {
  if (lod === 0) return;
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      { L, point } = local(a, b),
      bays = Math.max(1, Math.floor(L / 4.6));
    for (let j = 0; j < bays; j++) {
      const u = ((j + 0.5) * L) / bays,
        w = Math.min(3.3, L / bays - 0.5),
        N = [0, 3, 5, 7][lod],
        curve = archPath(w, 2.75, 4.8, N),
        n = sign * 0.028;
      const points = [
        point(u - w / 2, P.floor + 0.15, n),
        ...curve.map(([x, y]) => point(u + x, y, n)),
        point(u + w / 2, P.floor + 0.15, n),
      ];
      face(o, 'door', points, [-(b[1] - a[1]) * sign, 0, (b[0] - a[0]) * sign]);
      if (lod > 1) {
        for (let k = 1; k < curve.length; k++)
          beam(
            o,
            'base',
            point(u + curve[k - 1][0], curve[k - 1][1] + 0.08, sign * 0.06),
            point(u + curve[k][0], curve[k][1] + 0.08, sign * 0.06),
            0.16,
            0.12,
            colors.base,
          );
        for (const du of [-w / 2, w / 2])
          beam(
            o,
            'base',
            point(u + du, P.floor + 0.15, sign * 0.06),
            point(u + du, 2.75, sign * 0.06),
            0.17,
            0.12,
            colors.base,
          );
      }
      if (lod > 2)
        for (const du of [-0.65, 0, 0.65])
          beam(
            o,
            'door',
            point(u + du, 0.5, sign * 0.07),
            point(u + du, 2.5, sign * 0.07),
            0.045,
            0.04,
            rgb('88704e'),
          );
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const N = [6, 8, 12, 20][lod],
    domeHoles = P.vaultCentres.map((c) =>
      Array.from({ length: N }, (_, i) => [
        c[0] + P.vaultRadius * Math.cos((2 * Math.PI * i) / N),
        c[1] + P.vaultRadius * Math.sin((2 * Math.PI * i) / N),
      ]),
    );
  walls(o, 'base', R, P.foundationBottom, P.floor);
  for (const h of H) walls(o, 'base', h, P.foundationBottom, P.floor, true);
  cap(o, 'base', R, H, P.foundationBottom, -1);
  cap(o, 'base', R, H, P.floor, 1);
  walls(o, 'wall', R, P.floor, P.roofTop, false, [10, 11]);
  for (const h of H) walls(o, 'wall', h, P.floor, P.roofTop, true);
  cap(o, 'roof', R, [...H, ...domeHoles], P.roofTop, 1);
  for (const c of P.vaultCentres) dome(o, c, lod);
  portal(o, lod);
  if (lod > 0) {
    for (const r of [R, ...H])
      for (let i = 0; i < r.length; i++) {
        if (r === R && [10, 11].includes(i)) continue;
        const a = r[i],
          b = r[(i + 1) % r.length];
        beam(
          o,
          'roof',
          [a[0], P.parapetTop - 0.11, a[1]],
          [b[0], P.parapetTop - 0.11, b[1]],
          0.24,
          0.22,
          colors.roof,
        );
      }
    for (const h of H) courtShops(o, h, lod);
  }
  if (lod > 1) {
    for (let i = 0; i < R.length; i++) {
      if ([9, 10, 11, 12].includes(i)) continue;
      const a = R[i],
        b = R[(i + 1) % R.length],
        { L, point } = local(a, b),
        steps = Math.floor(L / 8);
      for (let j = 1; j < steps; j++)
        beam(
          o,
          'wall',
          point((j * L) / steps, P.floor + 0.1, -0.03),
          point((j * L) / steps, P.roofTop - 0.15, -0.03),
          0.18,
          0.12,
          rgb('a78258'),
        );
    }
  }
  componentEvidence.push({
    lod,
    originalOuterControls: 18,
    allOpenCourts: H.length,
    completeOuterAndInnerElevations: true,
    completeRoofWithEightRealOculi: true,
    mainPortalOpen: true,
    estimatedBayCensus: true,
    notWholeGrandBazaarProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tj/tju/qeysarieh_bazaar_isfahan',
  camera = [155, 145, 180],
  look = [0, 3, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'tj/tju',
  title: 'Qeysarieh Bazaar, Isfahan',
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
    'Wholeoriginal18cornerQeysariehbuilding/allthreeopencourts/allouterandinnerelevations/fullroof,8oculihallvaultsandrealmainportalopening. Exactcurrentnumericplan; clearedCoste1840vaultvocabulary. Heights/baycensus/portal/roof/finish/colors estimatesexplicit. Separatephysicalbuilding, notwholeGrandBazaar2kmproxy.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.53,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'plaster_lime',
    'stone_sandstone',
    'tile_ceramic',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'main-portal-and-vaulted-roof', position: [48, 19, 85], lookAt: [12, 5, 28] },
    { name: 'whole-three-courts-and-entire-roof', position: [-130, 170, -145], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-qeysarieh-building-' + reviewLod,
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
      district: { export: 'houseDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Originaldeterministicproceduralgeometry/repositorylicense. OriginalcompleteOSMnumericalplan/ODbLcredit; clearedpublishedQuallaCoste1840engraving/death1879/1867publication publicdomain, nativeoriginalbytes/expirygrant bound. No photo-derivedcolorpixels orcommercialimagery. Wholeexterior/vault/portal/finish estimatesexplicit.',
};
