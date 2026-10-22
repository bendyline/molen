/** Complete representative2016Homer Tunnel: true bore and two distinct covered portals. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/r8/r8p/homer_tunnel/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  rock: rgb('7e8581'),
  inside: rgb('656e69'),
  concrete: rgb('a8b2aa'),
  floor: rgb('555e5b'),
  roof: rgb('a3b5af'),
  trim: rgb('748e87'),
};
const surfaces = {
  rock: { slot: 'wall', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  inside: { slot: 'wall', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.97, metallic: 0 },
  floor: { slot: 'foundation', graph: 'membrane', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.94, metallic: 0.1 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.94, metallic: 0 },
};
function T(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  const q = normalFor(...p);
  if (q.every((v) => v === 0)) return;
  if (n && q.reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, [p[0], p[1], p[2]], n);
  T(o, s, [p[0], p[2], p[3]], n);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function station(line, lengths, s) {
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < s) i++;
  const t = (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
  return mix(line[i - 1], line[i], t);
}
function atLine(line, ys, p) {
  let best = { distance: Infinity };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      v = b.map((q, k) => q - a[k]),
      t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
      ),
      q = mix(a, b, t),
      distance = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (distance < best.distance) best = { distance, y: ys[i - 1] + (ys[i] - ys[i - 1]) * t };
  }
  return best;
}
function normal(line, i) {
  const a = line[Math.max(0, i - 1)],
    b = line[Math.min(line.length - 1, i + 1)],
    n = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [-(b[1] - a[1]) / n, (b[0] - a[0]) / n];
}
function sheet(o, s, r, Y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], Y(r[k]), r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function slab(o, r, Y, t = 0.22) {
  sheet(o, 'floor', r, Y);
  sheet(o, 'floor', r, (p) => Y(p) - t, false);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, 'floor', [
      [...a.slice(0, 1), Y(a), a[1]],
      [b[0], Y(b), b[1]],
      [b[0], Y(b) - t, b[1]],
      [a[0], Y(a) - t, a[1]],
    ]);
  }
}
function stick(o, s, a, b, w, d) {
  if (d) beam(o, s, a, b, w, w, C[s]);
  else {
    const v = b.map((v, i) => v - a[i]),
      len = Math.hypot(v[0], v[2]),
      u = len ? [v[2] / len, 0, -v[0] / len] : [1, 0, 0];
    const p = [
      a.map((v, i) => v - (u[i] * w) / 2),
      b.map((v, i) => v - (u[i] * w) / 2),
      b.map((v, i) => v + (u[i] * w) / 2),
      a.map((v, i) => v + (u[i] * w) / 2),
    ];
    Q(o, s, p);
    Q(o, s, [...p].reverse());
  }
}
const boreInner = [
    [-3, 0],
    [-3, 2.8],
    [-2.3, 4.6],
    [0, 5.3],
    [2.3, 4.6],
    [3, 2.8],
    [3, 0],
  ],
  boreOuter = [
    [-3.45, -0.22],
    [-3.45, 2.95],
    [-2.62, 4.96],
    [0, 5.75],
    [2.62, 4.96],
    [3.45, 2.95],
    [3.45, -0.22],
  ],
  eastInner = [
    [-3, 0],
    [-3, 2.8],
    [-2.2, 4.25],
    [-0.8, 4.65],
    [0.8, 4.65],
    [2.2, 4.25],
    [3, 2.8],
    [3, 0],
  ],
  eastOuter = [
    [-3.35, -0.22],
    [-3.35, 3.0],
    [-2.42, 4.52],
    [-0.9, 5.0],
    [0.9, 5.0],
    [2.42, 4.52],
    [3.35, 3.0],
    [3.35, -0.22],
  ];
function tube(o, line, ys, inside, outside, _d, slot = 'rock', extras = []) {
  const rings = line.map((p, i) => {
    const n = normal(line, i),
      extra = extras[i] ?? 0,
      P = ([z, y]) => [
        p[0] + n[0] * (z > 0 ? z + extra : z),
        ys[i] + y,
        p[1] + n[1] * (z > 0 ? z + extra : z),
      ];
    return { inner: inside.map(P), outer: outside.map(P) };
  });
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1],
      b = rings[i],
      center = [
        (line[i - 1][0] + line[i][0]) / 2,
        (ys[i - 1] + ys[i]) / 2 + 2.5,
        (line[i - 1][1] + line[i][1]) / 2,
      ];
    for (let j = 1; j < inside.length; j++) {
      const p = [a.inner[j - 1], b.inner[j - 1], b.inner[j], a.inner[j]],
        q = [a.outer[j - 1], b.outer[j - 1], b.outer[j], a.outer[j]],
        mid = p[0].map((_, k) => p.reduce((s, p) => s + p[k], 0) / 4);
      Q(
        o,
        slot === 'rock' ? 'inside' : slot,
        p,
        center.map((v, k) => v - mid[k]),
      );
      Q(
        o,
        slot,
        q,
        mid.map((v, k) => v - center[k]),
      );
    }
    const fl = [a.inner[0], b.inner[0], b.inner.at(-1), a.inner.at(-1)];
    Q(o, 'floor', fl, [0, 1, 0]);
    Q(o, 'floor', [a.outer[0], b.outer[0], b.outer.at(-1), a.outer.at(-1)], [0, -1, 0]);
  }
  for (const k of [0, rings.length - 1]) {
    const r = rings[k],
      a = line[Math.max(0, k - 1)],
      b = line[Math.min(line.length - 1, k + 1)],
      sign = k === 0 ? -1 : 1,
      face = [(b[0] - a[0]) * sign, 0, (b[1] - a[1]) * sign];
    for (let j = 1; j < inside.length; j++)
      Q(o, slot, [r.inner[j - 1], r.outer[j - 1], r.outer[j], r.inner[j]], face);
    Q(o, 'floor', [r.inner[0], r.inner.at(-1), r.outer.at(-1), r.outer[0]], face);
  }
  return rings;
}
function body(o, d) {
  const knots = new Set(plan.lengths);
  for (const b of plan.passingBays) for (const t of [-35, -25, 25, 35]) knots.add(b.station + t);
  if (d > 1) for (let s = 22; s < plan.namedNativeRoadLength; s += d > 2 ? 15 : 30) knots.add(s);
  const ss = [...knots].sort((a, b) => a - b),
    line = ss.map((s) => station(plan.line, plan.lengths, s)),
    ys = ss.map((s) => plan.boreEastFloorY - s / 10),
    extras = ss.map((s) =>
      Math.max(
        0,
        ...plan.passingBays.map((b) => {
          const t = Math.abs(s - b.station);
          return t <= 25 ? 1.2 : t < 35 ? (1.2 * (35 - t)) / 10 : 0;
        }),
      ),
    );
  tube(o, line, ys, boreInner, boreOuter, d, 'rock', extras);
  if (d > 1) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i],
        na = normal(line, i - 1),
        nb = normal(line, i);
      for (const side of [-1, 1])
        stick(
          o,
          'trim',
          [a[0] + na[0] * 2.88 * side, ys[i - 1] + 0.55, a[1] + na[1] * 2.88 * side],
          [b[0] + nb[0] * 2.88 * side, ys[i] + 0.55, b[1] + nb[1] * 2.88 * side],
          0.09,
          d,
        );
    }
    for (let s = 20; s < plan.namedNativeRoadLength; s += 40) {
      const p = station(plan.line, plan.lengths, s),
        y = plan.boreEastFloorY - s / 10 + 5.05;
      stick(o, 'trim', [p[0] - 0.7, y, p[1]], [p[0] + 0.7, y, p[1]], 0.12, d);
    }
  }
}
function east(o, d) {
  tube(o, plan.eastApproach, plan.eastApproachY, eastInner, eastOuter, d, 'concrete');
  const a = plan.eastApproach[0],
    b = plan.eastApproach[1],
    n = normal(plan.eastApproach, 0),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = d > 2 ? Math.ceil(len / 1.2) : d > 1 ? Math.ceil(len / 3) : d ? 6 : 0;
  for (let k = 0; k <= count; k++) {
    if (!count) break;
    const t = k / count,
      p = mix(a, b, t),
      y = plan.eastApproachY[0] + (plan.eastApproachY[1] - plan.eastApproachY[0]) * t;
    for (let i = 1; i < eastOuter.length; i++)
      stick(
        o,
        'concrete',
        [
          p[0] + n[0] * eastOuter[i - 1][0],
          y + eastOuter[i - 1][1],
          p[1] + n[1] * eastOuter[i - 1][0],
        ],
        [p[0] + n[0] * eastOuter[i][0], y + eastOuter[i][1], p[1] + n[1] * eastOuter[i][0]],
        d > 1 ? 0.065 : 0.09,
        d,
      );
  }
  const r = plan.shelters.east.slice(6, 10),
    floor = (p) => plan.boreEastFloorY - p[0] / 10,
    Y = (p) => floor(p) + 2.8 - 0.01 * (p[1] - 3.8);
  slab(o, r, floor);
  sheet(o, 'roof', r, Y);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      nn = [-dz, 0, dx],
      len = Math.hypot(dx, dz),
      u = [dx / len, dz / len],
      P = (t, y, depth = 0) => [
        a[0] + u[0] * t + (nn[0] / len) * depth,
        floor(mix(a, b, t / len)) + y,
        a[1] + u[1] * t + (nn[2] / len) * depth,
      ],
      opening = d > 1 && i === 1;
    if (opening) {
      const w = 1.0,
        left = len / 2 - w / 2,
        right = len / 2 + w / 2,
        patches = [
          [
            [0, 0],
            [left, 0],
            [left, 2.8],
            [0, 2.8],
          ],
          [
            [right, 0],
            [len, 0],
            [len, 2.8],
            [right, 2.8],
          ],
          [
            [left, 2.1],
            [right, 2.1],
            [right, 2.8],
            [left, 2.8],
          ],
        ];
      for (const p of patches)
        Q(
          o,
          'concrete',
          p.map((p) => P(...p)),
          nn,
        );
      Q(
        o,
        'trim',
        [
          [left, 0],
          [right, 0],
          [right, 2.1],
          [left, 2.1],
        ].map((p) => P(...p, -0.12)),
        nn,
      );
      for (const t of [left, right])
        Q(o, 'concrete', [P(t, 0), P(t, 2.1), P(t, 2.1, -0.12), P(t, 0, -0.12)]);
      Q(o, 'concrete', [P(left, 2.1), P(right, 2.1), P(right, 2.1, -0.12), P(left, 2.1, -0.12)]);
      if (d > 2)
        for (let y = 0.15; y < 2.1; y += 0.18)
          stick(o, 'trim', P(left, y, -0.08), P(right, y, -0.08), 0.035, d);
    } else
      Q(
        o,
        'concrete',
        [
          [a[0], floor(a), a[1]],
          [b[0], floor(b), b[1]],
          [b[0], Y(b), b[1]],
          [a[0], Y(a), a[1]],
        ],
        nn,
      );
  }
}
function west(o, d) {
  const r = plan.shelters.west,
    edgeA = r.slice(0, 6),
    edgeB = r.slice(7, 13).reverse(),
    centers = edgeA.map((p, i) =>
      i === 0 ? r[13] : i === 5 ? r[6] : p.map((v, k) => (v + edgeB[i][k]) / 2),
    ),
    Y = (p) => atLine(plan.westGallery, plan.westGalleryY, p).y;
  slab(o, r, Y);
  const sides = [edgeA, edgeB];
  for (let i = 1; i < centers.length; i++)
    for (const edge of sides) {
      const a = edge[i - 1],
        b = edge[i],
        c = centers[i - 1],
        e = centers[i];
      Q(
        o,
        'roof',
        [
          [a[0], Y(a) + 4.2, a[1]],
          [b[0], Y(b) + 4.2, b[1]],
          [e[0], Y(e) + 5.9, e[1]],
          [c[0], Y(c) + 5.9, c[1]],
        ],
        [0, 1, 0],
      );
      Q(
        o,
        'roof',
        [
          [a[0], Y(a) + 3.98, a[1]],
          [b[0], Y(b) + 3.98, b[1]],
          [e[0], Y(e) + 5.68, e[1]],
          [c[0], Y(c) + 5.68, c[1]],
        ],
        [0, -1, 0],
      );
    }
  for (const side of sides)
    for (let i = 1; i < side.length; i++) {
      const a = side[i - 1],
        b = side[i];
      stick(o, 'trim', [a[0], Y(a) + 4.1, a[1]], [b[0], Y(b) + 4.1, b[1]], 0.12, d);
    }
  for (let i = 1; i < edgeB.length; i++) {
    const a = edgeB[i - 1],
      b = edgeB[i],
      mid = mix(a, b, 0.5),
      c = mix(centers[i - 1], centers[i], 0.5);
    Q(
      o,
      'roof',
      [
        [a[0], Y(a) + 0.2, a[1]],
        [b[0], Y(b) + 0.2, b[1]],
        [b[0], Y(b) + 3.98, b[1]],
        [a[0], Y(a) + 3.98, a[1]],
      ],
      [mid[0] - c[0], 0, mid[1] - c[1]],
    );
    Q(
      o,
      'roof',
      [
        [a[0], Y(a) + 0.2, a[1]],
        [a[0], Y(a) + 3.98, a[1]],
        [b[0], Y(b) + 3.98, b[1]],
        [b[0], Y(b) + 0.2, b[1]],
      ],
      [c[0] - mid[0], 0, c[1] - mid[1]],
    );
  }
  for (let i = 0; i < centers.length; i++) {
    const a = edgeA[i],
      b = edgeB[i],
      c = centers[i];
    for (const p of [a, b])
      stick(o, 'concrete', [p[0], Y(p), p[1]], [p[0], Y(p) + 4.2, p[1]], d ? 0.24 : 0.3, d);
    if (d) {
      for (const p of [a, b])
        stick(o, 'concrete', [p[0], Y(p) + 4.05, p[1]], [c[0], Y(c) + 5.8, c[1]], 0.18, d);
      stick(o, 'trim', [a[0], Y(a) + 4.0, a[1]], [b[0], Y(b) + 4.0, b[1]], 0.1, d);
    }
  }
  if (d)
    for (let i = 1; i < edgeA.length; i++) {
      const a = edgeA[i - 1],
        b = edgeA[i],
        c = centers[i - 1],
        e = centers[i],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (d > 1 ? 2.5 : 5));
      for (let k = 1; k < n; k++) {
        const t = k / n,
          p = mix(a, b, t),
          q = mix(c, e, t);
        stick(o, 'concrete', [p[0], Y(p), p[1]], [p[0], Y(p) + 4.2, p[1]], 0.22, d);
        if (d > 1)
          stick(o, 'concrete', [p[0], Y(p) + 4.05, p[1]], [q[0], Y(q) + 5.8, q[1]], 0.14, d);
      }
    }
  // Exposed gable edges remain open beneath the roof; no black billboard across the vehicle way.
  for (const k of [0, 5])
    for (const p of [edgeA[k], edgeB[k]])
      stick(
        o,
        'concrete',
        [p[0], Y(p) + 4.2, p[1]],
        [centers[k][0], Y(centers[k]) + 5.9, centers[k][1]],
        0.24,
        d,
      );
  if (d > 1)
    for (let i = 1; i < edgeA.length; i++) {
      const a = edgeA[i - 1],
        b = edgeA[i],
        c = centers[i - 1],
        e = centers[i];
      for (let k = 1; k < 7; k++) {
        const t = k / 7,
          p = mix(a, c, t),
          q = mix(b, e, t);
        stick(
          o,
          'roof',
          [p[0], Y(p) + 4.22 + 1.7 * t, p[1]],
          [q[0], Y(q) + 4.22 + 1.7 * t, q[1]],
          0.025,
          d,
        );
      }
    }
}
function build(o, _f, d = 3) {
  body(o, d);
  east(o, d);
  west(o, d);
}
export const homerTunnelSkyline = (o, f) => build(o, f, 0);
export const homerTunnelDistrict = (o, f) => build(o, f, 1);
export const homerTunnelStreet = (o, f) => build(o, f, 2);
const ew = plan.eastApproach[0],
  wy = plan.westGalleryY.at(-1),
  ww = plan.westGallery.at(-1);
export const homerTunnelModel = {
  id: 'homer_tunnel',
  key: 'homer_tunnel',
  recipe: 'structure-homer-tunnel.mjs',
  cell: 'r8/r8p',
  title: 'Homer Tunnel (2016)',
  category: 'transport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Complete representative2016Homer Tunnel along original nine-point route and both covered approaches. Truly open granite road bore/descending1:10grade/two mapped passing bays, old eastern faceted concrete shelter and own annex, full curved western gabled roof gallery with open frames/one clad side. Both actual opposite portal positions and original western envelope retained. Historical-only2016because east shelter replaced2024. No mountain/site slab/road network/vehicles/signs/people or new protected artwork; hidden sections and precise historic grade/contact estimated.',
  camera: [650, 420, 990],
  lookAt: [620, -65, 5],
  portableGroundY: -150,
  mediumFiContext: { scale: 1.35, groundY: -150 },
  qaCameras: [
    {
      name: 'whole-native-descending-bore-and-two-distinct-portals',
      position: [610, 260, 930],
      lookAt: [610, -65, 15],
    },
    {
      name: 'old-east-open-faceted-concrete-shelter-and-annex',
      position: [ew[0] - 16, 7, ew[1] + 14],
      lookAt: [ew[0] + 6, 1.6, ew[1]],
    },
    {
      name: 'full-curved-west-open-framed-gabled-gallery',
      position: [ww[0] + 22, wy + 15, ww[1] + 24],
      lookAt: [ww[0] - 12, wy + 2, ww[1] - 16],
    },
    {
      name: 'true-open-granite-bore-and-passing-bay',
      position: [157, plan.boreEastFloorY - 15.7 + 2.2, -0.4],
      lookAt: [200, plan.boreEastFloorY - 20 + 2, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Modern3072mfield frozen before geometry. Road grade is primary1:10continuous estimate, not DEMfit. Portal/shelter-to-mountain cutouts and exact historic contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-homer-tunnel.mjs',
    level: 'skyline',
    export: 'homerTunnelSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'homerTunnelDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'homerTunnelStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical-only representative2016, valid2016-01-01through2017-01-01dated opt-in. Old eastern shelter was replaced mid2024, as confirmed by NZTAtext; new current shelter/iwi artwork not claimed or used. Native modern position/envelope data register2016geometry; not an exact historic survey. Both full portals/covered approaches/continuous bore retained, rather than an isolated generic mouth.',
    'Two exact published public-domain Qualla originals inspected: east550x413Mikedux/photo2007/nativeSHA1102d557fc930eca9b93f86241c112a091c2f0138and west4637x2982Szilas2016/nativeSHA1e820be0076a35f3dea59de6902595fb83dfaa732. Native PD-user-en/ownphoto-PD-self releases pinned; full41source families inventoried without conflicts. All other imagery excluded. Primary engineer/operator facts are text only; no external photo/diagram/copied pixels/generated bitmap.',
    'Native route1227.367491mplus33.876684meast cover/61.345057mcurved west gallery kept at original scale, without stretching to varying nominal1240/1270mmeasurements. Primary1:10grade gives estimated boreeastfloor-3.887604m/finalwestgallery-132.758859mrelative to fixed east approach. Bore6mminimum width/5.3mcrown, east faceted arch4.65mcrown/west gable5.9m, passing-bay width/side/tapers, equipment annex/hidden lining/frame/roof/cable census and exact original floor/cross-sections remain estimates. No traffic furniture/copied signs/whole cliff or topographic mountain added.',
    'Independent3072m129x129at24mfield/16641samples from25original Terrarium tiles, frozen before geometry at fixed eastern approach. Provider921.0921m/whole relative[-208.5507,1153.1756]m; raw tiles/grid/PNG unchanged without road fitting/clipping/flattening.3.3919moutput pixels may oversample coarser DEM;24mgrid cannot resolve portals or historic road level. Underground bore requires compatible host excavation; default terrain/contact not certified. Isolated/context floorY-150is a review fixture, not modeled landscape or claimed geology.',
  ],
};
