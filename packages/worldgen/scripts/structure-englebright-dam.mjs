/** Englebright: dry constant-angle arch, ungated crest and four intermediate piers. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/9q/9qc/englebright_dam/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = { concrete: rgb('b3b1a3'), steel: rgb('a0aaa2'), joint: rgb('999c91') };
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.15 },
};
const halfChord = plan.nativeEndpointChord / 2,
  sag = -Math.min(...plan.upstreamEdge.map((p) => p[1])),
  radius = (halfChord * halfChord + sag * sag) / (2 * sag),
  theta = Math.asin(halfChord / radius),
  mainLength = radius * theta * 2,
  extension = (plan.officialNominal.overallCrestLength - mainLength) / 2,
  halfMain = mainLength / 2,
  halfFull = halfMain + extension,
  width = plan.officialNominal.topWidth,
  spill = halfMain * 0.6,
  pierStations = [-0.36, -0.12, 0.12, 0.36].map((t) => t * halfMain);
function tri(o, s, ps, n, color = C[s]) {
  const rounded = ps.map((p) => p.map(Math.fround)),
    cr = cross(
      rounded[1].map((v, i) => v - rounded[0][i]),
      rounded[2].map((v, i) => v - rounded[0][i]),
    );
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && cr.reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), color);
}
function Q(o, s, ps, n, color = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], n, color);
  tri(o, s, [ps[0], ps[2], ps[3]], n, color);
}
function at(s) {
  const clamped = Math.max(-halfMain, Math.min(halfMain, s)),
    a = clamped / radius,
    u = [Math.cos(a), Math.sin(a)],
    n = [-u[1], u[0]],
    edge = [radius * Math.sin(a), radius - sag - radius * Math.cos(a)],
    extra = s - clamped;
  return {
    u,
    n,
    p: (y, q = 0) => [edge[0] + extra * u[0] + q * n[0], y, edge[1] + extra * u[1] + q * n[1]],
  };
}
const depth = (s) =>
  14 +
  (plan.officialNominal.structuralHeight - 14) *
    Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s) / halfFull, 2)), 0.76);
const lowerWidth = (s) =>
  width + (30 - width) * Math.pow(depth(s) / plan.officialNominal.structuralHeight, 0.65);
function downstream(s, t, offset = 0) {
  const f = at(s),
    h = depth(s),
    q = width + 1.2 + (lowerWidth(s) - width - 1.2) * Math.pow(t, 1.16);
  return f.p(-2.3 - (h - 2.3) * t, q + offset);
}
function profile(s, n, overflow) {
  const h = depth(s),
    ps = overflow
      ? [
          [0, 0],
          [width - 1.1, 0],
          [width - 0.2, -0.3],
          [width + 0.6, -1],
          [width + 1.2, -2.3],
        ]
      : [
          [0, 3.2],
          [width, 3.2],
          [width, -2.3],
          [width + 1.2, -2.3],
        ];
  for (let j = 1; j <= n; j++) {
    const t = j / n;
    ps.push([
      width + 1.2 + (lowerWidth(s) - width - 1.2) * Math.pow(t, 1.16),
      -2.3 - (h - 2.3) * t,
    ]);
  }
  ps.push([-h * 0.06, -h]);
  return ps;
}
function endCap(o, s, p, sign) {
  const f = at(s),
    ids = earcut(p.flat());
  for (let j = 0; j < ids.length; j += 3)
    tri(
      o,
      'concrete',
      ids.slice(j, j + 3).map((k) => f.p(p[k][1], p[k][0])),
      [f.u[0] * sign, 0, f.u[1] * sign],
    );
}
function body(o, d) {
  const count = [14, 40, 80, 140][d],
    stations = new Set([-halfFull, -halfMain, -spill, 0, spill, halfMain, halfFull]);
  for (let i = 1; i < count; i++) stations.add(-halfFull + (i / count) * 2 * halfFull);
  const ss = [...stations].sort((a, b) => a - b),
    n = [1, 3, 7, 13][d];
  for (let i = 1; i < ss.length; i++) {
    const a = ss[i - 1],
      b = ss[i],
      ch = Math.abs((a + b) / 2) < spill,
      pa = profile(a, n, ch),
      pb = profile(b, n, ch),
      fa = at(a),
      fb = at(b);
    for (let j = 0; j < pa.length; j++) {
      const k = (j + 1) % pa.length,
        points = [
          fa.p(pa[j][1], pa[j][0]),
          fb.p(pb[j][1], pb[j][0]),
          fb.p(pb[k][1], pb[k][0]),
          fa.p(pa[k][1], pa[k][0]),
        ];
      const normal = normalFor(...points).map((v) => -v);
      Q(o, 'concrete', points, normal);
    }
    if (i === 1 || Math.abs(a + spill) < 1e-7 || Math.abs(a - spill) < 1e-7) endCap(o, a, pa, -1);
    if (i === ss.length - 1 || Math.abs(b + spill) < 1e-7 || Math.abs(b - spill) < 1e-7)
      endCap(o, b, pb, 1);
  }
}
function pier(o, s, d, end = false) {
  const f = at(s),
    w = end ? 1.3 : d === 0 ? 1.25 : 1.0,
    top = end ? 1.5 : 4.0,
    r = [
      [-0.35, -0.1],
      [-0.35, top],
      [width - 0.8, top],
      [width, top - 0.25],
      [width + 0.6, -0.7],
      [width + 3, -6.5],
      [width - 0.8, -6.5],
    ],
    P = (q, y, x) => {
      const p = f.p(y, q);
      return [p[0] + f.u[0] * x, p[1], p[2] + f.u[1] * x];
    };
  const ids = earcut(r.flat());
  for (const side of [-1, 1])
    for (let j = 0; j < ids.length; j += 3)
      tri(
        o,
        'concrete',
        ids.slice(j, j + 3).map((k) => P(...r[k], (side * w) / 2)),
        [f.u[0] * side, 0, f.u[1] * side],
      );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [P(...a, -w / 2), P(...b, -w / 2), P(...b, w / 2), P(...a, w / 2)];
    Q(o, 'concrete', ps, normalFor(...ps));
  }
}
function bar(o, a, b, w, d, n) {
  if (d === 1) {
    const u = normalize(cross(n, normalize(b.map((v, i) => v - a[i])))).map((v) => (v * w) / 2),
      ps = [
        a.map((v, i) => v + u[i]),
        b.map((v, i) => v + u[i]),
        b.map((v, i) => v - u[i]),
        a.map((v, i) => v - u[i]),
      ];
    Q(o, 'steel', ps, n);
    Q(
      o,
      'steel',
      [...ps].reverse(),
      n.map((v) => -v),
    );
    return;
  }
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)),
    v = cross(axis, u),
    ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([j, k]) => c.map((p, i) => p + ((u[i] * j + v[i] * k) * w) / 2));
  loft(o, 'steel', [ring(a), ring(b)], C.steel);
}
function rails(o, d) {
  if (d === 0) return;
  for (const side of [-1, 1]) {
    const lo = side < 0 ? -halfFull : spill + 4,
      hi = side < 0 ? -spill - 4 : halfFull,
      count = Math.ceil((hi - lo) / (d === 1 ? 8 : 4)),
      ss = Array.from({ length: count + 1 }, (_, i) => lo + (i / count) * (hi - lo));
    for (const q of [0.35, width - 0.35]) {
      for (const s of ss) {
        const f = at(s);
        bar(o, f.p(3.2, q), f.p(4.25, q), 0.055, d, [f.n[0], 0, f.n[1]]);
      }
      for (let i = 1; i < ss.length; i++)
        for (const y of d === 1 ? [4.25] : [3.75, 4.25])
          bar(o, at(ss[i - 1]).p(y, q), at(ss[i]).p(y, q), 0.045, d, [0, 1, 0]);
    }
  }
}
function joints(o, d) {
  if (d < 2) return;
  const steps = d === 2 ? 65 : 135,
    rows = d === 2 ? 6 : 14;
  for (let row = 1; row <= rows; row++) {
    const y = (-row * plan.officialNominal.structuralHeight) / (rows + 1);
    for (let i = 1; i <= steps; i++) {
      const a = -halfFull + ((i - 1) / steps) * halfFull * 2,
        b = -halfFull + (i / steps) * halfFull * 2;
      if (y < -depth(a) + 0.15 || y < -depth(b) + 0.15) continue;
      const P = (s, yy) => downstream(s, (-yy - 2.3) / (depth(s) - 2.3), 0.012),
        ps = [P(a, y - 0.025), P(b, y - 0.025), P(b, y + 0.025), P(a, y + 0.025)],
        n = at((a + b) / 2).n;
      Q(o, 'concrete', ps, [n[0], 0.2, n[1]], C.joint);
    }
  }
  for (let s = -halfMain + 10; s < halfMain; s += d === 2 ? 24 : 15) {
    const count = d === 2 ? 6 : 12,
      f = at(s);
    for (let i = 1; i <= count; i++) {
      const a = downstream(s - 0.035, (i - 1) / count, 0.014),
        b = downstream(s + 0.035, (i - 1) / count, 0.014),
        c = downstream(s + 0.035, i / count, 0.014),
        e = downstream(s - 0.035, i / count, 0.014);
      Q(o, 'concrete', [a, b, c, e], [f.n[0], 0.2, f.n[1]], C.joint);
    }
  }
}
function build(o, _frame, d = 3) {
  body(o, d);
  for (const s of pierStations) pier(o, s, d);
  for (const s of [-spill, spill]) pier(o, s, d, true);
  rails(o, d);
  joints(o, d);
}
export const englebrightSkyline = (o, f) => build(o, f, 0);
export const englebrightDistrict = (o, f) => build(o, f, 1);
export const englebrightStreet = (o, f) => build(o, f, 2);
export const englebrightDamModel = {
  id: 'englebright_dam',
  key: 'englebright_dam',
  recipe: 'structure-englebright-dam.mjs',
  cell: '9q/9qc',
  title: 'Englebright Dam',
  category: 'dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Dry concrete arch dam with rounded ungated five-bay overflow crest, four tall intermediate concrete piers, two low end transitions, raised nonoverflow abutment wings, tapered upstream/downstream walls and own end maintenance rails. Original NHD dam envelope controls location/chord/curvature; official348.08mcrest/79.248mheight/6.4008mwidth control bounded section estimates. No river/gorge/water or separate powerhouses/intakes.',
  camera: [330, 145, 340],
  lookAt: [0, -30, -27],
  portableGroundY: -81,
  mediumFiContext: { scale: 3, groundY: -81 },
  qaCameras: [
    {
      name: 'curved-dry-arch-five-ungated-bays-and-raised-wings',
      position: [10, 50, 230],
      lookAt: [0, -28, -28],
    },
    {
      name: 'rounded-ogee-crest-and-four-concrete-piers',
      position: [35, 18, 5],
      lookAt: [18, -3, -57],
    },
    {
      name: 'west-nonoverflow-wing-and-maintenance-rails',
      position: [-170, 28, 50],
      lookAt: [-110, -3, -10],
    },
    { name: 'upstream-face-and-open-crest', position: [155, 80, -260], lookAt: [0, -28, -34] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed dry western bank approach precedes independent raw terrain. CrestY0, maximum foundation-79.248m; actual rock/abutment and crest-MSL/provider-relative datums approximate. No DEM fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-englebright-dam.mjs',
    level: 'skyline',
    export: 'englebrightSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'englebrightDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'englebrightStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Original coarse NHDupstream edge302.13m/chord249.90m/sag71.99m is preserved as evidence. A circular arc from original chord/sag interprets the owner-described constant-angle arch; short tangent end-wing extensions supply the remaining nominal348.0816moverall crest. This is an explicit section/wing interpretation, not a claim of exact native crest boundaries or a surveyed length match.',
    'Owner260ft/79.248mcentral structural height and21ft/6.4008mcrest width bound the dry structure. Lower wall thickening/ogee curvature, rising bank foundations, wing/pier height, rail/joint sections and concealed bedrock contact are estimates; native85mheight is not substituted for owner facts. Spillway crest527ftMSL is separate from frozen provider-relative western-bank reference.',
    'Two exact published Qualla originals, USACE MichaelNevins aerial and MichaelJ.NevinsJune2010spillway photograph, were inspected at native detail and bound to explicit government-work primary records/nativeSHA1. An omitted generated Qualla category for the latter is resolved with a hash-bound exact primary USACE release/agency/named Army photo credit; Qualla media metadata is untouched. No questionable/attribution image, generated bitmap or copied pixels.',
    'Four tall intermediate piers divide five ungated central overflow bays, with low end transitions and raised nonoverflow wings/own rails. Flowing water conceals the lower center in the close photo; no guessed outlet, gate, roadway bridge or covered spillway is added. Lower body is a bounded tapered arch estimate; no engineering/hydraulic/interior replica claim.',
    'Static dry dam only. Narrows I/IIpowerhouses/intakes/operation buildings, canyon/river/lake/rock/forest, access roads, boats/people/water/spray/rainbow and signs are separate and excluded. Raw500mTerrariumfield remains unchanged with fixed dry bank reference; illustrative stage below foundation is not surveyed terrain or certified gorge/abutment contact.',
  ],
};
