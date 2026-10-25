/** Surviving 1895 Albert Bridge: two complete hogback through-truss spans and own masonry supports. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/r7/r7h/albert_bridge_brisbane/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  L = plan.halfSteelLength,
  W = plan.deckWidth / 2,
  C = {
    steel: rgb('b8c3be'),
    stone: rgb('a99174'),
    cap: rgb('b5a18b'),
    wood: rgb('858778'),
    rail: rgb('697671'),
  },
  surfaces = {
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.18 },
    stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
    cap: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
    wood: { slot: 'trim', localRef: ref, roughness: 0.98, metallic: 0 },
    rail: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.72, metallic: 0.22 },
  };
function tri(o, s, ps, target) {
  if (target && normalFor(...ps).reduce((a, n, i) => a + n * target[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  const n = normalFor(...ps);
  o.addTriangle(
    s,
    ref,
    ps,
    n,
    ps.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
const B = (o, s, x0, y0, z0, x1, y1, z1) => box(o, s, [x0, y0, z0], [x1, y1, z1], C[s]);
function cap(o, s, r, y, up) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, ring, lo, hi) {
  const area = ring.reduce(
      (v, p, i) =>
        v + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
      0,
    ),
    r = area < 0 ? ring : [...ring].reverse();
  cap(o, s, r, lo, false);
  cap(o, s, r, hi, true);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [a[1] - b[1], 0, b[0] - a[0]],
    );
  }
}
function clip(r, z, less) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ia = less ? a[1] <= z : a[1] >= z,
      ib = less ? b[1] <= z : b[1] >= z;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), z]);
    }
  }
  return out;
}
function ribbon(o, s, a, b, width, n) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)).map((v) => (v * width) / 2),
    r = [
      a.map((v, i) => v + u[i]),
      b.map((v, i) => v + u[i]),
      b.map((v, i) => v - u[i]),
      a.map((v, i) => v - u[i]),
    ];
  Q(o, s, r, n);
  Q(
    o,
    s,
    [...r].reverse(),
    n.map((v) => -v),
  );
}
function bar(o, s, a, b, width, depth, n, closed = true) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)),
    v = cross(axis, u),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([j, k]) => p.map((x, i) => x + (j * width * u[i] + k * depth * v[i]) / 2));
  loft(o, s, [ring(a), ring(b)], C[s], { cap: closed });
}
function member(o, a, b, width, d, n = [1, 0, 0], primary = false, s = 'steel') {
  if (d === 0 || (d === 1 && !primary)) return ribbon(o, s, a, b, Math.max(width, 0.3), n);
  if (d === 1) return bar(o, s, a, b, width, width * 0.62, n, false);
  if (d === 2 || !primary) return bar(o, s, a, b, width, width * 0.62, n);
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)),
    shifted = (p, t) => p.map((v, i) => v + u[i] * t);
  // Actual flanges and a thin central web, with closed section ends.
  bar(o, s, a, b, width * 0.9, 0.045, n);
  for (const sign of [-1, 1])
    bar(
      o,
      s,
      shifted(a, sign * width * 0.44),
      shifted(b, sign * width * 0.44),
      width * 0.12,
      width * 0.65,
      n,
    );
}
const top = (t) => 7.3 + (13.2 - 7.3) * Math.sin(Math.PI * t);
function plate(o, x, y, z, d) {
  if (d < 2) return;
  const r = [
      [-0.42, -0.35],
      [0.36, -0.35],
      [0.53, 0.03],
      [0.32, 0.42],
      [-0.35, 0.42],
      [-0.52, 0.04],
    ],
    sg = Math.sign(x),
    a = x + sg * 0.15,
    b = a + sg * 0.035;
  for (let i = 1; i < r.length - 1; i++)
    for (const [xx, n] of [
      [a, -sg],
      [b, sg],
    ])
      tri(
        o,
        'steel',
        [r[0], r[i], r[i + 1]].map(([v, w]) => [xx, y + v, z + w]),
        [n, 0, 0],
      );
  if (d > 2)
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        q = r[(i + 1) % r.length];
      Q(o, 'steel', [
        [a, y + p[0], z + p[1]],
        [b, y + p[0], z + p[1]],
        [b, y + q[0], z + q[1]],
        [a, y + q[0], z + q[1]],
      ]);
    }
  if (d > 2)
    for (const [yy, zz] of [
      [-0.24, -0.24],
      [0.24, -0.24],
      [-0.24, 0.24],
      [0.24, 0.24],
      [0, -0.07],
      [0, 0.1],
    ]) {
      const ring = Array.from({ length: 6 }, (_, i) => [
          b,
          y + yy + 0.033 * Math.cos((i * Math.PI) / 3),
          z + zz + 0.033 * Math.sin((i * Math.PI) / 3),
        ]),
        crown = [b + sg * 0.024, y + yy, z + zz];
      for (let i = 0; i < 6; i++) tri(o, 'steel', [ring[i], ring[(i + 1) % 6], crown], [sg, 0, 0]);
    }
}
function spans(o, d) {
  const x = W - 0.4;
  for (const start of [-L, 0]) {
    const crownSegments = d === 0 ? 8 : 16;
    for (const sign of [-1, 1]) {
      const xx = sign * x;
      member(o, [xx, -0.65, start], [xx, -0.65, start + L], 0.82, d, [1, 0, 0], true);
      for (let j = 0; j < crownSegments; j++)
        member(
          o,
          [xx, top(j / crownSegments), start + (j / crownSegments) * L],
          [xx, top((j + 1) / crownSegments), start + ((j + 1) / crownSegments) * L],
          0.68,
          d,
          [1, 0, 0],
          true,
        );
      for (let j = 0; j <= 16; j++) {
        const z = start + (j / 16) * L,
          ty = top(j / 16);
        member(o, [xx, -0.3, z], [xx, ty, z], j === 0 || j === 16 ? 0.57 : 0.4, d, [1, 0, 0], true);
        plate(o, xx, -0.12, z, d);
        plate(o, xx, ty - 0.16, z, d);
      }
      for (let j = 0; j < 16; j++) {
        const z0 = start + (j / 16) * L,
          z1 = start + ((j + 1) / 16) * L;
        if (d === 0)
          member(
            o,
            j % 2 ? [xx, top(j / 16) - 0.1, z0] : [xx, -0.15, z0],
            j % 2 ? [xx, -0.15, z1] : [xx, top((j + 1) / 16) - 0.1, z1],
            0.22,
            d,
          );
        else {
          member(o, [xx, -0.15, z0], [xx, top((j + 1) / 16) - 0.2, z1], 0.19, d);
          member(o, [xx, top(j / 16) - 0.2, z0], [xx, -0.15, z1], 0.16, d);
        }
      }
    }
    const pitch = d === 0 ? 4 : d === 1 ? 2 : 1;
    for (let j = 0; j <= 16; j += pitch) {
      const z = start + (j / 16) * L,
        y = top(j / 16) - 0.2;
      member(o, [-x, y, z], [x, y, z], 0.34, d, [0, 0, 1], d > 2);
      if (d > 0) {
        // Portal knee braces keep the train passage genuinely open.
        member(o, [-x, y - 2.0, z], [-x + 2.0, y, z], 0.19, d, [0, 0, 1]);
        member(o, [x, y - 2.0, z], [x - 2.0, y, z], 0.19, d, [0, 0, 1]);
      }
    }
    if (d > 0)
      for (let j = 0; j < 16; j += 2) {
        const z0 = start + (j / 16) * L,
          z1 = start + ((j + 2) / 16) * L;
        member(
          o,
          [-x, top(j / 16) - 0.12, z0],
          [x, top((j + 2) / 16) - 0.12, z1],
          0.17,
          d,
          [0, 1, 0],
        );
        member(
          o,
          [x, top(j / 16) - 0.12, z0],
          [-x, top((j + 2) / 16) - 0.12, z1],
          0.17,
          d,
          [0, 1, 0],
        );
      }
  }
}
function deck(o, d) {
  if (d < 2) B(o, 'wood', -W, -0.4, -L, W, -0.29, L);
  else
    for (let z = -L + 0.12; z < L; z += 0.64)
      B(o, 'wood', -W + 0.4, -0.38, z, W - 0.4, -0.15, Math.min(z + 0.22, L));
  for (const track of [-2.15, 2.15])
    for (const side of [-1, 1]) {
      const x = track + (side * 1.067) / 2;
      if (d < 2) member(o, [x, -0.04, -L], [x, -0.04, L], 0.08, d, [1, 0, 0], false, 'rail');
      else {
        B(o, 'rail', x - 0.075, -0.15, -L, x + 0.075, -0.12, L);
        B(o, 'rail', x - 0.028, -0.12, -L, x + 0.028, -0.025, L);
        B(o, 'rail', x - 0.046, -0.025, -L, x + 0.046, 0.01, L);
      }
    }
  for (const x of [-3.1, -1.2, 1.2, 3.1])
    member(o, [x, -0.8, -L], [x, -0.8, L], 0.52, d, [1, 0, 0], true);
  const count = d === 0 ? 8 : 32;
  for (let j = 0; j <= count; j++) {
    const z = -L + (j / count) * 2 * L;
    member(o, [-W, -0.84, z], [W, -0.84, z], 0.72, d, [0, 0, 1], true);
    if (j < count) {
      const zz = -L + ((j + 1) / count) * 2 * L;
      member(o, [-W + 0.5, -1.18, z], [W - 0.5, -1.18, zz], 0.16, d, [0, 1, 0]);
      if (d > 0) member(o, [W - 0.5, -1.18, z], [-W + 0.5, -1.18, zz], 0.16, d, [0, 1, 0]);
    }
  }
  if (d)
    for (const sign of [-1, 1]) {
      const x = sign * (W - 0.18);
      B(o, 'wood', x - 0.25, -0.23, -L, x + 0.25, -0.12, L);
      member(o, [x, 1.02, -L], [x, 1.02, L], 0.07, d, [1, 0, 0], false, 'rail');
      if (d > 1) member(o, [x, 0.5, -L], [x, 0.5, L], 0.055, d, [1, 0, 0], false, 'rail');
      for (let z = -L; z < L; z += d === 1 ? 13 : 3.25)
        member(o, [x, -0.12, z], [x, 1.02, z], 0.055, d, [1, 0, 0], false, 'rail');
    }
}
function supports(o, d) {
  const pier = [
    [-5.3, -2.3],
    [-7.0, 0],
    [-5.3, 2.3],
    [5.3, 2.3],
    [7.0, 0],
    [5.3, -2.3],
  ];
  prism(o, 'stone', pier, -14.5, -2.1);
  prism(
    o,
    'cap',
    pier.map((p) => p.map((v) => v * 1.05)),
    -2.1,
    -1.4,
  );
  const south = clip(plan.outline, -L + 0.6, true),
    north = [
      [-W - 0.35, L - 0.5],
      [W + 0.35, L - 0.5],
      [W + 0.35, L + 6.2],
      [-W - 0.35, L + 6.2],
    ];
  prism(o, 'stone', south, -12.2, -1.4);
  prism(o, 'stone', north, -10.8, -1.4);
  if (d)
    for (const [ring, lo, hi] of [
      [pier, -14.3, -2.2],
      [south, -12, -1.5],
      [north, -10.6, -1.5],
    ])
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.2) continue;
        const winding =
            ring.reduce(
              (v, p, j) =>
                v + p[0] * ring[(j + 1) % ring.length][1] - p[1] * ring[(j + 1) % ring.length][0],
              0,
            ) < 0
              ? -1
              : 1,
          normal = normalize([(b[1] - a[1]) * winding, 0, (a[0] - b[0]) * winding]),
          offset = 0.012;
        for (let y = lo + 0.55; y < hi; y += d > 2 ? 0.6 : 1.2) {
          const p = [
            [a[0] + normal[0] * offset, y, a[1] + normal[2] * offset],
            [b[0] + normal[0] * offset, y, b[1] + normal[2] * offset],
            [b[0] + normal[0] * offset, y + 0.028, b[1] + normal[2] * offset],
            [a[0] + normal[0] * offset, y + 0.028, a[1] + normal[2] * offset],
          ];
          Q(o, 'cap', p);
          Q(o, 'cap', [...p].reverse());
        }
      }
  for (const z of [-L, 0, L])
    for (const sign of [-1, 1])
      B(o, 'steel', sign * (W - 0.4) - 0.5, -1.4, z - 0.7, sign * (W - 0.4) + 0.5, -0.96, z + 0.7);
  if (d > 1)
    for (const sign of [-1, 1])
      for (const z of [-L - 2, L + 2])
        B(o, 'cap', sign * (W + 0.1) - 0.22, -1.4, z - 1.3, sign * (W + 0.1) + 0.22, 1.2, z + 1.3);
}
function electrification(o, d) {
  if (!d) return;
  for (const x of [-2.15, 2.15]) {
    member(o, [x, 5.6, -L], [x, 5.6, L], 0.038, d, [1, 0, 0], false, 'rail');
    if (d > 1) member(o, [x, 6.1, -L], [x, 6.1, L], 0.032, d, [1, 0, 0], false, 'rail');
    for (let z = -L; z < L; z += 13) {
      const t = ((z + L) % L) / L,
        y = top(t) - 0.3;
      member(o, [x, 5.6, z], [x, y, z], 0.035, d, [1, 0, 0], false, 'rail');
    }
  }
}
function build(o, _f, d = 3) {
  supports(o, d);
  deck(o, d);
  spans(o, d);
  electrification(o, d);
}
export const albertBridgeSkyline = (o, f) => build(o, f, 0);
export const albertBridgeDistrict = (o, f) => build(o, f, 1);
export const albertBridgeStreet = (o, f) => build(o, f, 2);
export const albertBridgeModel = {
  id: 'albert_bridge_brisbane',
  key: 'albert_bridge_brisbane',
  recipe: 'structure-albert-bridge-brisbane.mjs',
  cell: 'r7/r7h',
  title: 'Albert Bridge, Brisbane',
  category: 'railway-bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole surviving1895AlbertBridge/native207.64msteelspanextent and9.61mwidth: two paired hogback through-truss spans, lower/curvedtopchords/verticals/doublelattice/portal knees/upperwindbracing, open twintrackdeck/rails/sleepers/stringers/crossgirders/underXbracing, one central masonrycutwaterpier/ownbothbankabutments/nativeendjogs/bearings. Palegrey rivetedsteel/builtupflanges/gussets and warmfreestone masonry; only1895bridge, not its distinctneighbours.',
  camera: [145, 62, 185],
  lookAt: [0, 0, 0],
  portableGroundY: -14.8,
  mediumFiContext: { scale: 3, groundY: -14.8 },
  qaCameras: [
    {
      name: 'two-complete-hogback-through-truss-spans',
      position: [190, 35, 110],
      lookAt: [0, 3, 0],
    },
    {
      name: 'open-twin-track-end-portal-and-overhead-bracing',
      position: [2, 7.5, 126],
      lookAt: [0, 5.5, 72],
    },
    {
      name: 'riveted-underside-crossgirders-stringers-and-lateral-bracing',
      position: [20, -6.8, -32],
      lookAt: [0, -0.65, -32],
    },
    {
      name: 'central-freestone-cutwater-pier-bearing-caps-and-steelwork',
      position: [28, -4, 11],
      lookAt: [0, -7, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent600mfield frozen before geometry.31extreme negative provider cells outside native footprint retained/flagged in terrain-source-note, never used for model sections. Rail deckY0/ownpiersnegativeY; exact rail/riverdatum/footings/hostcontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-albert-bridge-brisbane.mjs',
    level: 'skyline',
    export: 'albertBridgeSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'albertBridgeDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'albertBridgeStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Entire surviving1895two-span bridge/nativefull14vertexoutline/ownendjogs,207.64299591696968msteellength/9.612554754788912mwidth and onecentralmasonrypier retained. Governmentheritage text confirms two hogback trussspans/centralpier/materials/originalbankabutments; no lost1876bridge or distinct1957rail/JackPeschfoot/WalterTaylorroad bridge substitution.',
    'Only exact already-published1024x683PaulGuardQualla2008ownphotograph/nativeSHA1/explicitPD-user-enrelease. Observed palegrey rivetedsteel chord/vertical/lattice/floor crossgirders/stringers/underbracing/open deck and masonrypier control near section forms; no historical/unknownauthor/attribution/unrelatedimagery. Governmentarchive primarytext facts only, its1896image unused. No copiedpixels/generatedbitmap.',
    'Allverticalsections/deckheight/pierdepth/bankabutmentprofiles/curvedchordheight/panelcensus/hiddenupperbracing/trackgauge/rail/slat/catenary sections are explicit photographic medium-fi estimates.16panelsper103.82mspan is representative, not surveyed. Near double lattice/open rail/sleepers/crossgirders/overheadtrainpassage retained; close adds actual flange/webbuiltup sections/gussets/originalrivets. Skyline uses ribbon truss/alternating diagonal proxies/coarse topcurve/flatdeck, district open uncapped member proxies/coarse ties/rails within small section errors. Deep buriedcaisson/foundations notsurveyed or claimed.',
    'Independent600m151x151at4mTerrariumfield/rawtiles/grid/PNG preserved without fitting/flattening/clipping. FixedNEbankapproach[0,121.82149795848484] provider5.671m precedesgeometry; it is not a surveyed rail elevation.31extreme negative provider cells are all outside exactnativebridgefootprint and retained only as diagnostic evidence, never as credible bridge/riverfloor. Nativefootprint samples3..19.6226m mayincludeDSMbridge/vegetation. Exactrailgrade/riverdatum/pierfoot/deckvsDSMclassification/hostcontact remain unverified; geographicpreview/replaceFootprintfalse. No river/water/groundbank/landscape/roads/houses/people/trains/signage.',
  ],
};
