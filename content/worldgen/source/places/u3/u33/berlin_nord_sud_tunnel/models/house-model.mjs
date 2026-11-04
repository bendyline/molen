/** Whole physical Nord-Sud S-Bahn tunnel: original numeric network/envelopes, written facts only. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const D = JSON.parse(
  fs.readFileSync(new URL('../native-map/derived-tunnel-plan.json', import.meta.url)),
);
export const surfaces = {
  lining: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_boardformed', roughness: 0.94, metallic: 0 },
  bed: { slot: 'foundation', graph: 'gravel', roughness: 0.99, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.3 },
  platform: { slot: 'door', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
};
const C = {
  lining: rgb('b5b4aa'),
  roof: rgb('a6aaa2'),
  bed: rgb('88867a'),
  metal: rgb('59636a'),
  platform: rgb('b6b1a5'),
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0) / 2;
export const componentEvidence = [];
function face(o, k, q, n) {
  q = q.map((p) => p.map(Math.fround));
  for (let i = 1; i < q.length - 1; i++) {
    let t = [q[0], q[i], q[i + 1]],
      v = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    if (Math.hypot(...v) < 1e-7) continue;
    if (n && dot(v, n) < 0) t = [t[0], t[2], t[1]];
    o.addTriangle(
      k,
      'palette:#ffffff',
      t,
      normalFor(...t),
      t.map((p) => [p[0] + p[2], p[1]]),
      C[k],
    );
  }
}
export function floorAt(z) {
  const a = D.profileLocalZ;
  if (z <= a[0][0]) return a[0][1];
  if (z >= a.at(-1)[0]) return a.at(-1)[1];
  for (let i = 1; i < a.length; i++)
    if (z <= a[i][0]) {
      const t = (z - a[i - 1][0]) / (a[i][0] - a[i - 1][0]);
      return a[i - 1][1] + t * (a[i][1] - a[i - 1][1]);
    }
  throw Error('Grade interpolation failed');
}
export function ceilingAt(z) {
  let factor = 0;
  const b = D.transitionMeters;
  for (const [lo, hi] of D.junctionZonesLocalZ)
    factor = Math.max(
      factor,
      Math.max(0, Math.min(1, (z - lo + b) / (2 * b), (hi + b - z) / (2 * b))),
    );
  return (
    floorAt(z) +
    P.tunnel.railTop +
    P.tunnel.clearance +
    factor * (P.tunnel.junctionClearance - P.tunnel.clearance)
  );
}
export const roofAt = (z) => ceilingAt(z) + P.tunnel.roofThickness;
const cuts = [
  ...new Set([
    ...D.profileLocalZ.map((p) => p[0]),
    ...D.junctionZonesLocalZ.flatMap(([a, b]) => [
      a - D.transitionMeters,
      a + D.transitionMeters,
      b - D.transitionMeters,
      b + D.transitionMeters,
    ]),
  ]),
].sort((a, b) => a - b);
function clip(q, z, greater) {
  const out = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      aa = greater ? a[1] >= z : a[1] <= z,
      bb = greater ? b[1] >= z : b[1] <= z;
    if (aa) out.push(a);
    if (aa !== bb) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), z]);
    }
  }
  return out;
}
function cap(o, k, rings, height, up, lod) {
  const tmp = new MeshBufferBuilder();
  if (
    !tmp.addCap(
      k,
      'palette:#ffffff',
      rings[0],
      rings.slice(1),
      () => 0,
      [0, up, 0],
      (p) => p,
      C[k],
    )
  )
    throw Error('Whole tunnel envelope cap failed');
  const m = tmp.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const q = Array.from(m.indices.slice(i, i + 3)).map((j) => [
      m.positions[j * 3],
      m.positions[j * 3 + 2],
    ]);
    const min = Math.min(...q.map((p) => p[1])),
      max = Math.max(...q.map((p) => p[1]));
    let pieces = [q];
    for (const z of cuts)
      if (z > min + 0.001 && z < max - 0.001) {
        const next = [];
        for (const p of pieces) {
          const a = clip(p, z, true),
            b = clip(p, z, false);
          if (a.length >= 3) next.push(a);
          if (b.length >= 3) next.push(b);
        }
        pieces = next;
      }
    for (const p of pieces)
      face(
        o,
        k,
        p.map(([x, z]) => [x, height(z), z]),
        [0, up, 0],
      );
  }
  componentEvidence.push({ kind: 'complete-envelope-cap', slot: k, lod, rings: rings.length });
}
function distance(p, a, b) {
  const v = sub(b, a),
    w = sub(p, a),
    L = dot(v, v),
    t = L ? Math.max(0, Math.min(1, dot(w, v) / L)) : 0;
  return Math.hypot(...p.map((q, i) => q - a[i] - t * v[i]));
}
function rdp(q, tol) {
  if (q.length < 3) return q;
  let k = 0,
    best = tol;
  for (let i = 1; i < q.length - 1; i++) {
    const d = distance(q[i], q[0], q.at(-1));
    if (d > best) {
      best = d;
      k = i;
    }
  }
  return k
    ? [...rdp(q.slice(0, k + 1), tol).slice(0, -1), ...rdp(q.slice(k), tol)]
    : [q[0], q.at(-1)];
}
function simplify(r, tol) {
  if (!tol) return r;
  let k = 1,
    best = 0;
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(...sub(r[i], r[0]));
    if (d > best) {
      best = d;
      k = i;
    }
  }
  const q = [
    ...rdp(r.slice(0, k + 1), tol).slice(0, -1),
    ...rdp([...r.slice(k), r[0]], tol).slice(0, -1),
  ];
  return q.length >= 3 ? q : r;
}
export function ringsFor(lod) {
  const tol = [8, 1.5, 0.15, 0.001][lod];
  return D.rings
    .filter((r, i) => i === 0 || Math.abs(area(r)) >= [500, 60, 1, 0.1][lod])
    .map((r) => simplify(r, tol));
}
const headFrames = P.portals.map((p) => {
  const w = P.nativeRailways.find((w) => w.nodes[0] === p.id || w.nodes.at(-1) === p.id),
    q = w.nodes[0] === p.id ? w.local[1] : w.local.at(-2),
    d = sub(q, p.local),
    L = Math.hypot(...d),
    v = d.map((x) => x / L);
  return { ...p, V: v, N: [v[1], -v[0]] };
});
function portalIntervals(a, b) {
  const out = [];
  for (const h of headFrames) {
    let lo = 0,
      hi = 1;
    for (const [axis, min, max] of [
      [h.N, -P.tunnel.portalCutHalfWidth, P.tunnel.portalCutHalfWidth],
      [h.V, -P.tunnel.portalCutDepth, P.tunnel.portalCutDepth],
    ]) {
      const p = dot(sub(a, h.local), axis),
        v = dot(sub(b, a), axis);
      if (Math.abs(v) < 1e-10) {
        if (p < min || p > max) {
          lo = 2;
          break;
        }
      } else {
        const x = (min - p) / v,
          y = (max - p) / v;
        lo = Math.max(lo, Math.min(x, y));
        hi = Math.min(hi, Math.max(x, y));
      }
    }
    if (lo < hi && hi > 0 && lo < 1) out.push([Math.max(0, lo), Math.min(1, hi)]);
  }
  return out;
}
function walls(o, r, lod) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      L = Math.hypot(...sub(b, a));
    if (L < 0.001) continue;
    const n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L],
      intervals = portalIntervals(a, b),
      ts = [
        0,
        1,
        ...intervals.flat(),
        ...cuts
          .filter((z) => z > Math.min(a[1], b[1]) && z < Math.max(a[1], b[1]))
          .map((z) => (z - a[1]) / (b[1] - a[1])),
      ].sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const t0 = ts[j - 1],
        t1 = ts[j];
      if (t1 - t0 < 1e-7) continue;
      const p = a.map((x, k) => x + (b[k] - x) * t0),
        q = a.map((x, k) => x + (b[k] - x) * t1),
        isPortal = intervals.some(([lo, hi]) => (t0 + t1) / 2 > lo && (t0 + t1) / 2 < hi),
        quad = (k, aa, bb, low, high, normal) =>
          face(
            o,
            k,
            [
              [aa[0], low(aa[1]), aa[1]],
              [bb[0], low(bb[1]), bb[1]],
              [bb[0], high(bb[1]), bb[1]],
              [aa[0], high(aa[1]), aa[1]],
            ],
            normal,
          );
      if (isPortal) {
        quad('roof', p, q, ceilingAt, roofAt, [n[0], 0, n[1]]);
        quad('lining', p, q, (z) => floorAt(z) - 0.6, floorAt, [n[0], 0, n[1]]);
      } else {
        quad('lining', p, q, (z) => floorAt(z) - 0.6, roofAt, [n[0], 0, n[1]]);
        if (lod > 1) {
          const pp = p.map((x, k) => x - n[k] * P.tunnel.wallThickness),
            qq = q.map((x, k) => x - n[k] * P.tunnel.wallThickness);
          quad('lining', pp, qq, floorAt, ceilingAt, [-n[0], 0, -n[1]]);
        }
      }
    }
  }
}
function box(o, k, center, V, N, length, width, lo, hi) {
  const p = (u, v, y) => [center[0] + V[0] * u + N[0] * v, y, center[1] + V[1] * u + N[1] * v],
    q = [
      p(-length / 2, -width / 2, lo),
      p(length / 2, -width / 2, lo),
      p(length / 2, width / 2, lo),
      p(-length / 2, width / 2, lo),
      p(-length / 2, -width / 2, hi),
      p(length / 2, -width / 2, hi),
      p(length / 2, width / 2, hi),
      p(-length / 2, width / 2, hi),
    ],
    mid = [center[0], (lo + hi) / 2, center[1]];
  for (const ids of [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ]) {
    const a = ids.map((i) => q[i]),
      c = a.reduce((s, p) => s.map((v, i) => v + p[i] / 4), [0, 0, 0]);
    face(o, k, a, sub(c, mid));
  }
}
function portal(o, h, lod) {
  const c = h.local,
    y = floorAt(c[1]),
    top = ceilingAt(c[1]);
  for (const side of [-1, 1]) {
    const p = c.map((v, k) => v + h.N[k] * side * 2.18);
    box(o, 'platform', p, h.V, h.N, 0.9, 0.36, y - 0.6, top + 0.22);
  }
  box(o, 'roof', c, h.V, h.N, 1.0, 4.9, top, top + 0.8);
  if (lod > 0) {
    box(o, 'platform', c, h.V, h.N, 5.5, 4.3, y - 0.12, y + 0.05);
    for (const side of [-1, 1]) {
      const p = c.map((v, k) => v + h.N[k] * side * 2.43 + h.V[k] * -2.0);
      box(o, 'lining', p, h.V, h.N, 4, 0.3, y - 0.4, y + 1.2);
    }
  }
  componentEvidence.push({
    kind: 'actual-external-track-mouth',
    node: h.id,
    local: c,
    originalTrackhead: true,
  });
}
function tracks(o, lod) {
  if (lod === 0) return;
  for (const w of P.nativeRailways) {
    const coords = lod === 1 ? rdp(w.local, 1.5) : lod === 2 ? rdp(w.local, 0.15) : w.local;
    const upper =
        w.tags.service === 'yard' &&
        w.tags.level === '-1' &&
        coords.some(
          (p) => p[1] > D.junctionZonesLocalZ[0][0] && p[1] < D.junctionZonesLocalZ[0][1],
        ),
      rise = upper ? P.tunnel.upperSidingRise : 0;
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1],
        b = coords[i],
        L = Math.hypot(...sub(b, a));
      if (L < 0.05) continue;
      const V = sub(b, a).map((v) => v / L),
        N = [V[1], -V[0]],
        point = (p, t, y) => [p[0] + N[0] * t, floorAt(p[1]) + rise + y, p[1] + N[1] * t];
      for (const side of [-1, 1]) {
        const t = side * 0.7175;
        face(
          o,
          'metal',
          [
            point(a, t - 0.035, 0.22),
            point(b, t - 0.035, 0.22),
            point(b, t + 0.035, 0.22),
            point(a, t + 0.035, 0.22),
          ],
          [0, 1, 0],
        );
        if (lod === 3)
          for (const s of [-1, 1])
            face(
              o,
              'metal',
              [
                point(a, t + s * 0.035, 0.08),
                point(b, t + s * 0.035, 0.08),
                point(b, t + s * 0.035, 0.22),
                point(a, t + s * 0.035, 0.22),
              ],
              [N[0] * s, 0, N[1] * s],
            );
      }
      if (lod === 3 && w.tags.usage === 'main' && i % 3 === 0) {
        const c = a.map((v, k) => (v + b[k]) / 2),
          y = floorAt(c[1]) + rise;
        box(o, 'platform', c, V, N, 0.24, 2.5, y + 0.02, y + 0.08);
      }
    }
    componentEvidence.push({
      kind: 'complete-original-track-path',
      nativeWay: w.id,
      controls: w.local.length,
      fullPath: true,
      upperSidingEstimated: upper,
    });
  }
}
function roofFrames(o, lod) {
  if (lod < 2) return;
  const spacing = lod === 3 ? 130 : 320;
  for (const w of P.nativeRailways.filter((w) => w.tags.usage === 'main')) {
    let carry = 0;
    for (let i = 1; i < w.local.length; i++) {
      const a = w.local[i - 1],
        b = w.local[i],
        L = Math.hypot(...sub(b, a));
      if (L < 0.1) continue;
      const V = sub(b, a).map((v) => v / L),
        N = [V[1], -V[0]];
      carry += L;
      if (carry < spacing) continue;
      carry = 0;
      const c = a.map((v, k) => (v + b[k]) / 2),
        y = floorAt(c[1]),
        top = ceilingAt(c[1]);
      for (const s of [-1, 1]) {
        const p = c.map((v, k) => v + N[k] * s * 1.96);
        box(o, 'metal', p, V, N, 0.15, 0.15, y + 0.4, top);
      }
      box(o, 'metal', c, V, N, 0.18, 4.1, top - 0.02, top + 0.65);
    }
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const rings = ringsFor(lod);
  cap(o, 'roof', rings, roofAt, 1, lod);
  if (lod > 1) {
    cap(o, 'lining', rings, ceilingAt, -1, lod);
    cap(o, 'bed', rings, floorAt, 1, lod);
    cap(o, 'lining', rings, (z) => floorAt(z) - 0.6, -1, lod);
  }
  for (const r of rings) walls(o, r, lod);
  for (const h of headFrames) portal(o, h, lod);
  tracks(o, lod);
  roofFrames(o, lod);
  componentEvidence.push({
    kind: 'whole-original-network-envelope',
    nativeRoutes: 98,
    nativeEnvelopes: 17,
    nativeRailControls: 765,
    nativeEnvelopeControls: 2104,
    externalTrackHeads: 6,
    stationWidenings: 6,
    wholeBranchesAndIntrinsicStubs: true,
    solidPropertySlab: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/u3/u33/berlin_nord_sud_tunnel',
  camera = [4300, 3800, 5200],
  look = [0, -5, 0],
  north = headFrames.find((p) => p.id === 249189056),
  south = headFrames.find((p) => p.id === 290175306),
  headCamera = (h) => [
    h.local[0] - h.V[0] * 65,
    floorAt(h.local[1]) + 20,
    h.local[1] - h.V[1] * 65,
  ],
  headLook = (h) => [h.local[0], floorAt(h.local[1]) + 2, h.local[1]];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'u3/u33',
  title: 'Berlin Nord–Süd S-Bahn tunnel — complete original network',
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
    'Whole original curved S-Bahn tunnel/17officialstation-tunnel envelopes/98complete750VDBrailpaths/bothsouthernbranches/all6externaltrackheads/6stationwidenings/intrinsicupper/sidingstubs. Full thinroof/floor/lining shell with hollowrailspace, actualmouths/rectangularframes, estimated3.8mstandard/7.04mjunctionclearance and frozenoriginalgrade. OfficialnumericALKIS/OSMand writtenengineer/operatorfacts only; everyimageunused. Missing/layeredplan, exactprofile/section/finish/grade are estimates; no mainline/U-Bahn/newS21 or arbitraryoneportalproxy.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -16.63,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 100000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'concrete_boardformed',
    'gravel',
    'metal_painted',
    'stone_ashlar',
  ],
  qaCameras: [
    { name: 'complete-curved-network-both-southern-branches', position: camera, lookAt: look },
    {
      name: 'actual-northern-open-tunnel-mouth',
      position: headCamera(north),
      lookAt: headLook(north),
    },
    {
      name: 'potsdamer-widening-upper-sidings-roof',
      position: [-200, 95, 1100],
      lookAt: [-400, -5, 850],
    },
    {
      name: 'actual-southern-paired-portal-mouths',
      position: headCamera(south),
      lookAt: headLook(south),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-original-nordsud-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Allimages/photographs/figures/drawings unused; writtenengineer/operatorfacts only. OfficialBerlinALKISnumericdataDL-DE-Zero2.0; originalOSMnumericnetworkODbL1.0. Missing/layeredplan/verticalprofile/sections/roofconstruction/finish/grade estimated; no sourceimagetracing or surveyed/currentreplacementclaim.',
};
