/** Kariba: whole native double-curved concrete arch, six real sluices and intrinsic crest works. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/kt/kth/kariba_dam/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    concrete: rgb('aaa99b'),
    metal: rgb('555e5c'),
    road: rgb('777b73'),
    joint: rgb('7e8179'),
    gate: rgb('454e4c'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.18 },
    road: { slot: 'roof', localRef: ref, roughness: 0.99, metallic: 0 },
    joint: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
    gate: { slot: 'door', graph: 'metal_painted', roughness: 0.92, metallic: 0.1 },
  },
  upper = p.outline.slice(0, 21),
  toe = [p.outline[0], ...p.outline.slice(21).reverse(), p.outline[20]],
  mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
function pathInfo(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  return { points, lengths, total: lengths.at(-1), knots: lengths.map((s) => s / lengths.at(-1)) };
}
const up = pathInfo(upper),
  down = pathInfo(toe),
  road = pathInfo(p.crestline.slice(1)),
  width = 9.14,
  sill = -36,
  crown = sill + 8.84,
  gates = Array.from({ length: 6 }, (_, i) => 0.44 + ((i - 2.5) * 13.2) / up.total),
  gateHalf = width / 2 / up.total;
function at(line, t) {
  const s = Math.max(0, Math.min(1, t)) * line.total;
  let i = line.lengths.findIndex((x) => x >= s);
  i = Math.max(1, i);
  const a = line.points[i - 1],
    b = line.points[i],
    u = (s - line.lengths[i - 1]) / (line.lengths[i] - line.lengths[i - 1]),
    v = normalize([b[0] - a[0], 0, b[1] - a[1]]),
    n = [v[2], 0, -v[0]];
  return { p: mix(a, b, u), u: v, n };
}
const depth = (t) => 6 + 122 * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.68);
/** Top uses native upstream edge; downstream toe uses original second native edge. */
function point(t, y, side, offset = 0) {
  const a = at(up, t),
    b = at(down, t),
    u = Math.max(0, Math.min(1, -y / depth(t))),
    top = [a.p[0] + (side > 0 ? 13 : 0) * a.n[0], a.p[1] + (side > 0 ? 13 : 0) * a.n[2]],
    bottom = [b.p[0] - (side > 0 ? 0 : 24) * a.n[0], b.p[1] - (side > 0 ? 0 : 24) * a.n[2]],
    v = mix(top, bottom, Math.pow(u, side > 0 ? 1.35 : 0.88));
  return [v[0] + offset * a.n[0], y, v[1] + offset * a.n[2]];
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function L(o, s, a, b, w, d, n = [0, 0, 1]) {
  if (d > 0) {
    beam(o, s, a, b, w, w, C[s]);
    return;
  }
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, n)).map((v) => (v * w) / 2),
    q = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  Q(o, s, q, n);
  Q(
    o,
    s,
    [...q].reverse(),
    n.map((v) => -v),
  );
}
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const inGate = (t) => gates.findIndex((g) => Math.abs(t - g) < gateHalf - 1e-8);
function gridFor(d) {
  const ss = new Set([
    ...up.knots,
    ...(d > 0 ? down.knots : []),
    0.5,
    ...gates.flatMap((g) => [g - gateHalf, g + gateHalf]),
  ]);
  for (let i = 1; i < [0, 16, 42, 84][d]; i++) ss.add(i / [0, 16, 42, 84][d]);
  const ts = [...ss].sort((a, b) => a - b),
    ys = [
      ...new Set([
        0,
        crown,
        sill,
        -128,
        ...(d === 0 ? [-78] : []),
        ...Array.from(
          { length: [0, 2, 7, 15][d] },
          (_, i) => (-128 * (i + 1)) / ([0, 2, 7, 15][d] + 1),
        ),
      ]),
    ].sort((a, b) => b - a);
  return { ts, ys };
}
function body(o, d) {
  const { ts, ys } = gridFor(d);
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1],
      b = ts[i],
      n = at(up, (a + b) / 2).n,
      gate = inGate((a + b) / 2) >= 0;
    for (let j = 1; j < ys.length; j++) {
      if (gate && ys[j - 1] <= crown + 1e-7 && ys[j] >= sill - 1e-7) continue;
      for (const side of [-1, 1]) {
        const A = (y) => Math.max(y, -depth(a)),
          B = (y) => Math.max(y, -depth(b));
        Q(
          o,
          'concrete',
          [
            point(a, A(ys[j - 1]), side),
            point(b, B(ys[j - 1]), side),
            point(b, B(ys[j]), side),
            point(a, A(ys[j]), side),
          ],
          n.map((v) => v * side),
        );
      }
    }
    Q(o, 'concrete', [point(a, 0, -1), point(b, 0, -1), point(b, 0, 1), point(a, 0, 1)], [0, 1, 0]);
    Q(
      o,
      'concrete',
      [
        point(a, -depth(a), -1),
        point(b, -depth(b), -1),
        point(b, -depth(b), 1),
        point(a, -depth(a), 1),
      ],
      [0, -1, 0],
    );
    if (gate)
      for (const [y, sg] of [
        [crown, -1],
        [sill, 1],
      ])
        Q(
          o,
          'concrete',
          [point(a, y, -1), point(b, y, -1), point(b, y, 1), point(a, y, 1)],
          [0, sg, 0],
        );
  }
  for (const t of [0, 1])
    for (let j = 1; j < ys.length; j++) {
      const a = Math.max(ys[j - 1], -depth(t)),
        b = Math.max(ys[j], -depth(t)),
        u = at(up, t).u;
      Q(
        o,
        'concrete',
        [point(t, a, -1), point(t, a, 1), point(t, b, 1), point(t, b, -1)],
        u.map((v) => v * (t === 0 ? -1 : 1)),
      );
    }
  for (const g of gates)
    for (const [dt, sg] of [
      [-gateHalf, 1],
      [gateHalf, -1],
    ]) {
      const t = g + dt,
        u = at(up, t).u;
      Q(
        o,
        'concrete',
        [point(t, crown, -1), point(t, crown, 1), point(t, sill, 1), point(t, sill, -1)],
        u.map((v) => v * sg),
      );
    }
}
function crest(o, d) {
  // Original native road nodes, without the separate short northern datum approach.
  const pp = road.points;
  for (let i = 1; i < pp.length; i++) {
    const a = pp[i - 1],
      b = pp[i],
      v = normalize([b[0] - a[0], 0, b[1] - a[1]]),
      n = [v[2], 0, -v[0]],
      P = (p, q, y) => [p[0] + n[0] * q, y, p[1] + n[2] * q];
    Q(o, 'road', [P(a, -3, 0.035), P(b, -3, 0.035), P(b, 3, 0.035), P(a, 3, 0.035)], [0, 1, 0]);
  }
  for (const side of [-1, 1]) {
    const n =
        d === 0
          ? up.knots
          : [
              ...new Set([
                ...up.knots,
                ...Array.from(
                  { length: [0, 28, 60, 120][d] + 1 },
                  (_, i) => i / [0, 28, 60, 120][d],
                ),
              ]),
            ].sort((a, b) => a - b),
      sg = side;
    for (let i = 1; i < n.length; i++) {
      const a = n[i - 1],
        b = n[i],
        N = at(up, (a + b) / 2).n,
        P = (t, y, q = 0) => {
          const v = point(t, 0, side, q);
          v[1] = y;
          return v;
        };
      Q(
        o,
        'concrete',
        [P(a, 0), P(b, 0), P(b, 1.08), P(a, 1.08)],
        N.map((v) => v * sg),
        rgb('bdbbaa'),
      );
      if (d > 0) {
        Q(
          o,
          'concrete',
          [
            P(a, 0, -sg * 0.38),
            P(a, 1.08, -sg * 0.38),
            P(b, 1.08, -sg * 0.38),
            P(b, 0, -sg * 0.38),
          ],
          N.map((v) => -v * sg),
        );
        Q(
          o,
          'concrete',
          [P(a, 1.08), P(b, 1.08), P(b, 1.08, -sg * 0.38), P(a, 1.08, -sg * 0.38)],
          [0, 1, 0],
          rgb('c4c2b2'),
        );
      }
    }
  }
  // Three small intrinsic service cabinets; separate powerhouses/offices are absent.
  for (const t of [0.19, 0.61, 0.85]) {
    const f = at(up, t),
      s = point(t, 0, -1, 2.2),
      out = {
        addQuad(k, r, q, n, uv, col) {
          const P = (v) => [
              s[0] + f.u[0] * v[0] + f.n[0] * v[2],
              v[1],
              s[2] + f.u[2] * v[0] + f.n[2] * v[2],
            ],
            N = [f.u[0] * n[0] + f.n[0] * n[2], n[1], f.u[2] * n[0] + f.n[2] * n[2]];
          o.addQuad(k, r, q.map(P).reverse(), N, [...uv].reverse(), col);
        },
      };
    box(out, 'concrete', [-1.7, 0.06, -0.9], [1.7, 2.45, 0.9], rgb('c6c4b6'));
    if (d >= 2) box(out, 'gate', [-0.45, 0.06, 0.905], [0.45, 1.95, 0.93], C.gate);
  }
}
function sluices(o, d) {
  for (const g of gates) {
    const f = at(up, g),
      N = f.n,
      P = (t, y, q = 0) => point(t, y, 1, q),
      left = g - gateHalf,
      right = g + gateHalf;
    // Gate leaf is deep at the upstream entrance, behind the genuine concrete tunnel.
    const back = (t, y) => {
      const a = point(t, y, -1),
        b = point(t, y, 1);
      return mix(a, b, 0.08);
    };
    Q(o, 'gate', [back(left, sill), back(right, sill), back(right, crown), back(left, crown)], N);
    if (d > 0)
      Q(
        o,
        'gate',
        [back(left, crown), back(right, crown), back(right, sill), back(left, sill)],
        N.map((v) => -v),
      );
    // Dark hanging frames are a bounded interpretation of the cleared2005 whole photograph.
    for (const t of [left - 0.35 / up.total, right + 0.35 / up.total])
      L(o, 'metal', P(t, crown + 2.4, 1.5), P(t, -59, 0.25), d === 0 ? 0.85 : 0.5, d, N);
    L(
      o,
      'metal',
      P(left - 0.5 / up.total, crown + 2.4, 1.5),
      P(right + 0.5 / up.total, crown + 2.4, 1.5),
      0.7,
      d,
      N,
    );
    if (d >= 2) {
      for (const t of [left, right])
        L(o, 'metal', P(t, crown + 0.8, 1.5), P(t, sill - 3, 1.1), 0.26, d, N);
      for (const y of [crown - 1, sill + 1])
        L(o, 'metal', P(left, y, 1.1), P(right, y, 1.1), 0.28, d, N);
      for (const t of [left, right]) {
        const A = P(t, crown + 2.5, 1.55),
          B = P(t, crown - 9, 0.1);
        L(o, 'metal', A, B, 0.18, d, N);
      }
      // Cast-concrete mouth coamings emphasize actual depth rather than black facade stickers.
      for (const t of [left - 0.25 / up.total, right + 0.25 / up.total])
        L(o, 'concrete', P(t, sill - 0.25, 0.3), P(t, crown + 0.25, 0.3), 0.42, d, N);
      for (const y of [sill - 0.25, crown + 0.25])
        L(o, 'concrete', P(left, y, 0.3), P(right, y, 0.3), 0.42, d, N);
    }
    if (d === 3) {
      for (const y of [sill + 2, sill + 4, sill + 6])
        L(o, 'metal', back(left, y), back(right, y), 0.22, d, N);
      for (let k = 0; k < 4; k++) {
        const t = left + ((right - left) * (k + 0.5)) / 4;
        L(o, 'metal', back(t, sill + 0.2), back(t, crown - 0.2), 0.16, d, N);
      }
    }
  }
}
function details(o, d) {
  if (d < 2) return;
  const { ts, ys } = gridFor(d);
  let previous = -100;
  for (let i = 1; i < ts.length - 1; i++) {
    const t = ts[i];
    if (t < 0.055 || t > 0.945 || t * up.total - previous < 13) continue;
    previous = t * up.total;
    const n = at(up, t).n,
      w = 0.045;
    // Lay the seam on actual mesh-row edges, avoiding analytical-detail z fighting.
    for (let j = 1; j < ys.length; j++) {
      const ya = Math.max(ys[j - 1], -depth(t)),
        yb = Math.max(ys[j], -depth(t));
      if (ya - yb < 0.1) continue;
      if (inGate(t) >= 0 && yb < crown && ya > sill) continue;
      const A = point(t, ya, 1, 0.13),
        B = point(t, yb, 1, 0.13),
        tangent = normalize(
          subtract(point(ts[i + 1], (ya + yb) / 2, 1), point(ts[i - 1], (ya + yb) / 2, 1)),
        ),
        P = (v, sign) => v.map((x, k) => x + sign * w * tangent[k]);
      Q(o, 'joint', [P(A, -1), P(A, 1), P(B, 1), P(B, -1)], n);
      if (d === 3 && i % 3 === 0 && ya < -0.5 && yb > -100) {
        const ww = 0.18 + (i % 4) * 0.06,
          R = (v, sign) => v.map((x, k) => x + sign * ww * tangent[k]);
        Q(o, 'concrete', [R(A, -1), R(A, 1), R(B, 1), R(B, -1)], n, rgb('989b90'));
      }
    }
  }
  for (let j = 1; j < ys.length - 1; j++) {
    const y = ys[j];
    if (j % 2 === 0 && d === 2) continue;
    for (let i = 1; i < ts.length; i++) {
      const a = ts[i - 1],
        b = ts[i];
      if (y < -depth(a) + 0.25 || y < -depth(b) + 0.25) continue;
      if (inGate((a + b) / 2) >= 0 && y < crown && y > sill) continue;
      Q(
        o,
        'concrete',
        [
          point(a, y - 0.02, 1, 0.13),
          point(b, y - 0.02, 1, 0.13),
          point(b, y + 0.02, 1, 0.13),
          point(a, y + 0.02, 1, 0.13),
        ],
        at(up, (a + b) / 2).n,
        rgb('9c9f95'),
      );
    }
  }
  if (d === 3)
    for (let k = 1; k < 120; k++) {
      const t = k / 120;
      for (const side of [-1, 1]) {
        const v = point(t, 0, side, -side * 0.24);
        L(o, 'metal', [v[0], 1.08, v[2]], [v[0], 1.65, v[2]], 0.04, d);
      }
    }
}
function build(o, _f, d = 3) {
  body(o, d);
  crest(o, d);
  sluices(o, d);
  details(o, d);
}
export const karibaSkyline = (o, f) => build(o, f, 0);
export const karibaDistrict = (o, f) => build(o, f, 1);
export const karibaStreet = (o, f) => build(o, f, 2);
export const karibaCloseup = (o, f) => build(o, f, 3);
export const karibaModel = {
  id: 'kariba_dam',
  key: 'kariba_dam',
  cell: 'kt/kth',
  recipe: 'structure-kariba-dam.mjs',
  title: 'Kariba Dam',
  category: 'dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [395, 160, 520],
  lookAt: [0, -46, -10],
  portableGroundY: -130,
  mediumFiContext: { scale: 2.3, groundY: -130 },
  qaCameras: [
    {
      name: 'whole-double-curved-concrete-arch-and-six-sluices',
      position: [120, 100, 560],
      lookAt: [0, -49, -5],
      reviewLod: 'skyline',
    },
    {
      name: 'six-real-sluice-mouths-hanging-frames-and-deep-gates',
      position: [85, -7, 125],
      lookAt: [28, -35, -25],
    },
    {
      name: 'curved-crest-native-road-parapets-and-service-cabinets',
      position: [190, 34, 32],
      lookAt: [35, -2, -41],
    },
    {
      name: 'upstream-tapered-wall-and-native-abutments',
      position: [-250, 60, -355],
      lookAt: [0, -51, -23],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent1200mfield is diagnostic only: deep negative reservoir artifacts remain unchanged. Fixed north-bank crest reference; maximum128mwall section from operator, live gorge/water/toe contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-kariba-dam.mjs',
    level: 'skyline',
    export: 'karibaSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'karibaDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'karibaStreet', errorMeters: 0.45, surfaces },
      closeup: { export: 'karibaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole original concrete arch-dam exterior, upper edge from original native upstream boundary, downstream toe from original native opposite boundary,13mcrest/24mbase/maximum128msection controls from operator. True horizontal and vertical curvature, six9.14x8.84mconcrete flow tunnels with closed gate leaves deep behind downstream mouths, hanging metal frames, actual native crest-road nodes, low parapets and intrinsic small cabinets. Native mapped curve is not stretched to nominal617mengineering length. Skyline simplifies the toe curve between original upstream-edge stations; higher levels retain all38native plan controls.',
    'Exact456x262BenBird2005creator-public-domain original individually inspected/nativeSHA1matched. Qualla17families searched first:CC0portrait unrelated and excluded, uncertain Spencerconstruction pictures not used, other dam photos require attribution. Native explicitPD-user-en and original own-photo uploadlog bind Benbbb/BenBird; originalCommons transfer separately retained. No image upscaling, agency photographic controls, generated bitmap or photo textures.',
    'Photographic low resolution does not establish fine mechanics. Gate grouping/pitch/height, broad hanging-frame forms, contraction courses/runoff, rail/cabinet census and original foundation/abutment and upstream profile are medium-fi estimates. OperatorMay2026text confirms ongoing hoist replacement; current detailed mechanisms are not certified by2005photo. The full stable concrete structure is modeled; no claim of exact present refitted machinery.',
    'Native dam polygon is an overall structural envelope, not128mtallverticalextrusion. Upper/lower side curves are paired by native arc-distance with original vertices retained at detailed levels. Operator height/section and smoothly varying bounded exposed toe follow a plausible gorge section, not the bad DEM. Maximum wallheight128m at center, abutments shorten toward ends; buried foundation/real exposure and actual geographic ground contact remain unverified.',
    'Independent1200m129x129field/16641samples/4rawTerrariumtiles frozen before geometry, crest reference497.7347m. Implausible negative lake returns down to-986.7526m remain untouched and are not used as water/riverbed/foundation controls. Portable/shared/context use clearly separate flat review ground below foundation. No artificial gorge/river/reservoir mesh, landscape floor or flattened sourcefield. Native placement preview/replaceFootprint=false; compatible live terrain/water/toe contact unverified.',
    'Separate north/south underground powerstations, intake/portal structures, substations, project offices/civil construction plant and neighboring roads outside the intrinsic dam crest are excluded. Water/river/gorge/trees/people/signs/vehicles are absent. No photographed shape/style from the excluded sources is adopted.',
  ],
};
