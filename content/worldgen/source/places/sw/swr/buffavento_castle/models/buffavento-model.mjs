/** Complete ruined castle from a released whole plan; natural hillside stays separate. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  n = JSON.parse(fs.readFileSync(new URL('../native-controls.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  c = Math.cos(n.theta),
  s = Math.sin(n.theta);
export const chartPoint = (q) => {
  const [x, z] = q.map((v, k) => v - n.chartAnchor[k]);
  return [
    n.nativeAnchor[0] + n.scale * (c * x - s * z),
    n.nativeAnchor[1] + n.scale * (s * x + c * z),
  ];
};
const C = {
  stone: rgb('bcb6a7'),
  cap: rgb('c5c1ae'),
  brick: rgb('a5725b'),
  earth: rgb('afa28d'),
  lime: rgb('d1cdbc'),
  iron: rgb('bbc0bc'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98, metallic: 0 },
  cap: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.96, metallic: 0 },
  earth: { slot: 'wall', graph: 'earth_rammed', roughness: 1, metallic: 0 },
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  norm = (q) => {
    const L = Math.hypot(...q);
    return q.map((x) => x / L);
  },
  lift = (q, y) => [q[0], y, q[1]],
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
function T(o, k, q, v, col = C[k]) {
  q = q.map((q) => q.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (v && dot(cr, v) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, v, col) {
  T(o, k, q.slice(0, 3), v, col);
  T(o, k, [q[0], q[2], q[3]], v, col);
}
function cap(o, k, r, y, holes = [], up = 1) {
  const points = [r, ...holes].flat(),
    ts = ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((h) => h.map((q) => new Vector2(...q))),
    );
  for (const t of ts)
    T(
      o,
      k,
      t.map((i) => lift(points[i], typeof y === 'function' ? y(points[i]) : y)),
      [0, up, 0],
    );
}
function solid(o, k, r, y, Y) {
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [lift(a, y), lift(b, y), lift(b, Y), lift(a, Y)],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
  cap(o, k, r, Y);
  cap(o, k, r, y, [], -1);
}
function inset(r, d) {
  const sign = Math.sign(area(r));
  return r.map((q, i) => {
    const a = norm(sub(q, r[(i + r.length - 1) % r.length])),
      b = norm(sub(r[(i + 1) % r.length], q)),
      u = [-a[1] * sign, a[0] * sign],
      v = [-b[1] * sign, b[0] * sign],
      h = d / (1 + dot(u, v));
    return q.map((x, k) => x + (u[k] + v[k]) * h);
  });
}
const centroid = (r) => r.reduce((a, q) => a.map((v, k) => v + q[k] / r.length), [0, 0]),
  roomRing = (r) => r.chart.map(chartPoint),
  wallFoot = (a, b, w) => {
    const u = norm(sub(b, a)),
      v = [(-u[1] * w) / 2, (u[0] * w) / 2];
    return [
      a.map((x, k) => x + v[k]),
      b.map((x, k) => x + v[k]),
      b.map((x, k) => x - v[k]),
      a.map((x, k) => x - v[k]),
    ];
  };
export const partEvidence = [],
  doorEvidence = [],
  stairEvidence = [],
  cisternEvidence = [],
  wallEvidence = [];
function wall(o, a, b, y, Y, height, width, lod, seed = 0, endCaps = true) {
  const L = Math.hypot(...sub(b, a));
  if (L < 1e-5) return;
  const u = norm(sub(b, a)),
    v = [-u[1], u[0]],
    count = seed === -1 ? 1 : [1, 2, 6, 6][lod],
    amplitude = seed === -1 ? 0 : A.raggedAmplitude,
    q = (t, h, side) => [
      a[0] + u[0] * L * t + ((v[0] * width) / 2) * side,
      h,
      a[1] + u[1] * L * t + ((v[1] * width) / 2) * side,
    ],
    top = (t) =>
      y +
      (Y - y) * t +
      height -
      amplitude *
        (0.45 +
          0.4 * Math.sin((seed + 1) * 1.7 + t * Math.PI * 5) +
          0.15 * Math.cos(t * Math.PI * 9 + seed));
  for (let i = 0; i < count; i++) {
    const t = i / count,
      T1 = (i + 1) / count,
      h = top(t),
      H = top(T1),
      lo = y + (Y - y) * t - 0.65,
      LO = y + (Y - y) * T1 - 0.65;
    for (const side of [-1, 1])
      Q(
        o,
        'stone',
        [q(t, lo, side), q(T1, LO, side), q(T1, H, side), q(t, h, side)],
        [v[0] * side, 0, v[1] * side],
      );
    Q(o, 'cap', [q(t, h, -1), q(T1, H, -1), q(T1, H, 1), q(t, h, 1)], [0, 1, 0]);
  }
  if (endCaps && lod)
    for (const [t, sign] of [
      [0, -1],
      [1, 1],
    ])
      Q(
        o,
        'stone',
        [
          q(t, y + (Y - y) * t - 0.65, -1),
          q(t, y + (Y - y) * t - 0.65, 1),
          q(t, top(t), 1),
          q(t, top(t), -1),
        ],
        [u[0] * sign, 0, u[1] * sign],
      );
  wallEvidence.push({ a, b, y, Y, height, width, segments: count });
}
function gate(o, r, ring, edge, lod) {
  const a = ring[edge],
    b = ring[(edge + 1) % ring.length],
    u = norm(sub(b, a)),
    L = Math.hypot(...sub(b, a)),
    v = [-u[1], u[0]],
    sign = Math.sign(area(ring)),
    w = r.id === 'gate_tower' ? A.gateThickness : A.wallThickness,
    D = r.door,
    mid = D.center ?? 0.5,
    half = D.width / 2 / L,
    l = mid - half,
    R = mid + half,
    Y = r.floor,
    H = r.height,
    pt = (t, h, side) => [
      a[0] + (b[0] - a[0]) * t + ((v[0] * w) / 2) * side,
      h,
      a[1] + (b[1] - a[1]) * t + ((v[1] * w) / 2) * side,
    ];
  wall(o, a, mix(a, b, l), Y, Y, H, w, lod, edge);
  wall(o, mix(a, b, R), b, Y, Y, H, w, lod, edge + 3);
  const count = [2, 4, 8, 12][lod],
    arch = (i) => {
      const t = i / count,
        theta = Math.PI - t * Math.PI;
      return [
        mid + half * (2 * t - 1),
        Y + D.spring + D.rise * (D.pointed ? 1 - Math.abs(2 * t - 1) : Math.sin(theta)),
      ];
    };
  for (let i = 0; i < count; i++) {
    const [t, h] = arch(i),
      [T1, H1] = arch(i + 1);
    for (const side of [-1, 1])
      Q(
        o,
        'stone',
        [pt(t, h, side), pt(T1, H1, side), pt(T1, Y + H, side), pt(t, Y + H, side)],
        [v[0] * side, 0, v[1] * side],
      );
    Q(o, 'brick', [pt(t, h, -1), pt(t, h, 1), pt(T1, H1, 1), pt(T1, H1, -1)], [0, -1, 0]);
    Q(
      o,
      'cap',
      [pt(t, Y + H, -1), pt(T1, Y + H, -1), pt(T1, Y + H, 1), pt(t, Y + H, 1)],
      [0, 1, 0],
    );
    if (lod > 1)
      for (const side of [-1, 1])
        Q(
          o,
          'brick',
          [
            pt(t, h, side * 1.025),
            pt(T1, H1, side * 1.025),
            pt(T1, H1 + 0.2, side * 1.025),
            pt(t, h + 0.2, side * 1.025),
          ],
          [v[0] * side, 0, v[1] * side],
        );
  }
  for (const [t, dir] of [
    [l, 1],
    [R, -1],
  ])
    Q(
      o,
      'stone',
      [pt(t, Y, -1), pt(t, Y + D.spring, -1), pt(t, Y + D.spring, 1), pt(t, Y, 1)],
      [u[0] * dir, 0, u[1] * dir],
    );
  doorEvidence.push({
    id: r.id,
    part: r.part,
    center: mix(a, b, mid),
    axis: [-v[0] * sign, 0, -v[1] * sign],
    width: D.width,
    spring: D.spring,
    rise: D.rise,
    floor: r.floor,
    wallWidth: w,
    pointed: D.pointed === true,
  });
}
function vault(o, r, ring, lod) {
  const a = ring[0],
    u = norm(sub(ring[1], a)),
    v = norm(sub(ring.at(-1), a)),
    L = Math.hypot(...sub(ring[1], a)),
    W = Math.hypot(...sub(ring.at(-1), a)),
    count = [2, 4, 8, 12][lod],
    q = (i, j, outer) => {
      const x = i / count,
        z = j / count,
        u1 = 2 * x - 1,
        v1 = 2 * z - 1,
        h =
          3.2 +
          1.1 * Math.max(Math.sqrt(Math.max(0, 1 - u1 * u1)), Math.sqrt(Math.max(0, 1 - v1 * v1))) +
          (outer ? 0.3 : 0);
      return [a[0] + u[0] * L * x + v[0] * W * z, r.floor + h, a[1] + u[1] * L * x + v[1] * W * z];
    };
  for (let i = 0; i < count; i++)
    for (let j = 0; j < count; j++)
      for (const out of [false, true])
        Q(
          o,
          out ? 'cap' : 'stone',
          [q(i, j, out), q(i + 1, j, out), q(i + 1, j + 1, out), q(i, j + 1, out)],
          [0, out ? 1 : -1, 0],
        );
}
function cistern(o, r, ring, lod) {
  const inner = inset(ring, 0.65),
    c = centroid(inner),
    hole = rect(c[0], c[1], 1.5, 1.1),
    top = r.floor + 0.15,
    base = r.floor - A.cisternDepth;
  if (lod) solid(o, 'earth', inner, base - 0.2, base);
  else cap(o, 'earth', inner, base);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j],
      u = sub(b, a);
    if (lod)
      Q(o, 'stone', [lift(a, base), lift(b, base), lift(b, top), lift(a, top)], [u[1], 0, -u[0]]);
    const A1 = inner[i],
      B = inner[j],
      v = sub(B, A1);
    Q(o, 'lime', [lift(A1, base), lift(B, base), lift(B, top), lift(A1, top)], [-v[1], 0, v[0]]);
  }
  cap(o, 'cap', ring, top, [hole]);
  if (lod) cap(o, 'lime', ring, top - 0.22, [hole], -1);
  for (let i = 0; lod && i < 4; i++) {
    const a = hole[i],
      b = hole[(i + 1) % 4],
      v = sub(b, a);
    Q(
      o,
      'lime',
      [lift(a, top - 0.22), lift(b, top - 0.22), lift(b, top), lift(a, top)],
      [-v[1], 0, v[0]],
    );
  }
  cisternEvidence.push({ id: r.id, hole, center: c, base, top, fullRing: ring, inner, lod });
}
function room(o, r, lod) {
  const ring = roomRing(r);
  if (r.cistern) {
    cistern(o, r, ring, lod);
    return;
  }
  if (lod) solid(o, 'earth', ring, r.floor - 0.18, r.floor);
  else cap(o, 'earth', ring, r.floor);
  for (let i = 0; i < ring.length; i++) {
    if (i === r.door?.edge) gate(o, r, ring, i, lod);
    else if (i === r.extraDoor?.edge)
      gate(o, { ...r, id: `${r.id}_south_access`, door: r.extraDoor }, ring, i, lod);
    else
      wall(
        o,
        ring[i],
        ring[(i + 1) % ring.length],
        r.floor,
        r.floor,
        r.height,
        r.id === 'gate_tower' ? A.gateThickness : A.wallThickness,
        lod,
        i + r.part,
      );
  }
  if (r.vault) vault(o, r, ring, lod);
}
export function stairProfile(st) {
  const pts = st.chart.map(chartPoint),
    lengths = pts.slice(1).map((q, i) => Math.hypot(...sub(q, pts[i]))),
    dist = [0];
  for (const L of lengths) dist.push(dist.at(-1) + L);
  const anchors = [
    { i: 0, y: st.start },
    ...(st.fixedJunctions ?? []).map((x) => ({ i: x.pointIndex, y: x.floor })),
    { i: pts.length - 1, y: st.end },
  ];
  const levels = pts.map((_, i) => {
    let j = 0;
    while (j < anchors.length - 2 && i > anchors[j + 1].i) j++;
    const a = anchors[j],
      b = anchors[j + 1],
      t = (dist[i] - dist[a.i]) / (dist[b.i] - dist[a.i]);
    return a.y + (b.y - a.y) * t;
  });
  return { pts, lengths, levels };
}
function stairs(o, st, lod) {
  const { pts, lengths, levels } = stairProfile(st);
  for (let i = 0; i < lengths.length; i++) {
    const a = pts[i],
      b = pts[i + 1],
      len = lengths[i],
      u = norm(sub(b, a)),
      v = [(-u[1] * st.width) / 2, (u[0] * st.width) / 2],
      y = levels[i],
      Y = levels[i + 1],
      raw = Math.max(1, Math.ceil(Math.abs(Y - y) / A.stepRiseMax)),
      count = lod === 0 ? 1 : lod === 1 ? Math.max(1, Math.ceil(raw / 2)) : raw,
      at = (t, h, side) => [
        a[0] + u[0] * len * t + v[0] * side,
        h,
        a[1] + u[1] * len * t + v[1] * side,
      ];
    if (!lod) {
      Q(o, 'cap', [at(0, y, -1), at(1, Y, -1), at(1, Y, 1), at(0, y, 1)], [0, 1, 0]);
      for (const side of [-1, 1])
        Q(
          o,
          'stone',
          [at(0, y - 0.3, side), at(1, Y - 0.3, side), at(1, Y, side), at(0, y, side)],
          [-u[1] * side, 0, u[0] * side],
        );
    } else
      for (let j = 0; j < count; j++) {
        const t = j / count,
          T1 = (j + 1) / count,
          h = y + ((Y - y) * (j + 1)) / count,
          lo = y + ((Y - y) * j) / count;
        Q(o, 'cap', [at(t, h, -1), at(T1, h, -1), at(T1, h, 1), at(t, h, 1)], [0, 1, 0]);
        Q(o, 'stone', [at(t, lo, -1), at(t, h, -1), at(t, h, 1), at(t, lo, 1)], [-u[0], 0, -u[1]]);
        for (const side of [-1, 1])
          Q(
            o,
            'stone',
            [at(t, lo - 0.3, side), at(T1, h - 0.3, side), at(T1, h, side), at(t, h, side)],
            [-u[1] * side, 0, u[0] * side],
          );
      }
    stairEvidence.push({
      id: st.id,
      part: st.part,
      flight: i,
      a,
      b,
      y,
      Y,
      steps: count,
      width: st.width,
      rawSteps: raw,
      length: len,
    });
  }
}
function bay(o, lod) {
  const b = p.roundedBay,
    c = chartPoint(b.chartCenter),
    r = b.radiusChart * n.scale,
    count = [4, 6, 10, 16][lod],
    ring = Array.from({ length: count + 1 }, (_, i) => [
      c[0] + r * Math.cos((i * Math.PI) / count),
      c[1] + r * Math.sin((i * Math.PI) / count),
    ]);
  cap(o, 'earth', [...ring, c], b.base);
  for (let i = 0; i < count; i++)
    wall(o, ring[i], ring[i + 1], b.base, b.base, b.height, 0.65, lod, -1);
}
function rails(o, st, lod) {
  if (!lod) return;
  const q = st.chart.map(chartPoint),
    a = q[0],
    b = q[1],
    u = norm(sub(b, a)),
    v = [(-u[1] * st.width) / 2, (u[0] * st.width) / 2],
    L = Math.hypot(...sub(b, a));
  for (const side of [-1, 1]) {
    const A1 = [a[0] + v[0] * side, st.start + 0.9, a[1] + v[1] * side],
      B = [b[0] + v[0] * side, stairProfile(st).levels[1] + 0.9, b[1] + v[1] * side];
    beam(o, 'iron', A1, B, 0.045, 0.045, C.iron);
    const count = Math.ceil(L / 2);
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        P = mix(A1, B, t);
      beam(o, 'iron', [P[0], P[1] - 0.9, P[2]], P, 0.04, 0.04, C.iron);
    }
  }
}
export function buildBuffavento(target, _frame, lod = 3) {
  for (const a of [partEvidence, doorEvidence, stairEvidence, cisternEvidence, wallEvidence])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(k, ref, q, v, uv, col) {
        o.addTriangle(k, ref, q.slice(0, 3), v, uv.slice(0, 3), col);
        o.addTriangle(k, ref, [q[0], q[2], q[3]], v, [uv[0], uv[2], uv[3]], col);
      },
      addConvexPolygon(k, ref, q, v, uv, col) {
        for (let i = 1; i < q.length - 1; i++)
          o.addTriangle(k, ref, [q[0], q[i], q[i + 1]], v, [q[0], q[i], q[i + 1]].map(uv), col);
      },
    },
    part = (id, name, fn) => {
      const q = count;
      fn();
      partEvidence.push({ id, name, triangles: count - q });
    };
  for (const r of p.rooms) part(r.part, r.id, () => room(o, r, lod));
  for (const f of p.fragments)
    part(f.part, f.id, () => {
      const pts = f.chart.map(chartPoint);
      for (let i = 0; i < pts.length - 1; i++)
        wall(o, pts[i], pts[i + 1], f.base[i], f.base[i + 1], f.height, 0.7, lod, i + f.part);
    });
  part(6, 'whole-lower-rounded-Byzantine-bay', () => bay(o, lod));
  for (const st of p.stairs) part(st.part, st.id, () => stairs(o, st, lod));
  part(1, 'estimated-modern-intrinsic-lower-terrace-guardrails', () => rails(o, p.stairs[1], lod));
}
export const buffaventoSkyline = (o) => buildBuffavento(o, null, 0),
  buffaventoDistrict = (o) => buildBuffavento(o, null, 1),
  buffaventoStreet = (o) => buildBuffavento(o, null, 2),
  buffaventoCloseup = (o) => buildBuffavento(o, null, 3);
const outlines = p.rooms
    .map((r) => roomRing(r))
    .concat(
      p.stairs.flatMap((st) => {
        const pts = st.chart.map(chartPoint);
        return pts.slice(1).map((q, i) => wallFoot(pts[i], q, st.width));
      }),
    ),
  at = (q, y) => lift(chartPoint(q), y),
  topCenter = [0, 4, 0];
export const buffaventoModel = {
  id: 'buffavento_castle',
  key: 'buffavento_castle',
  cell: 'sw/swr',
  title: 'Buffavento Castle',
  wikidataId: 'Q301376',
  category: 'castle-ruins',
  recipe: 'buffavento-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBuffavento,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole13-partBuffavento ruinedcastle architecturalassembly: entrance/gatetower/partialgroinvault, lowerbalcony/hall/Byzantinehousing/roundedbay, bothoutlyinghollowcisterns/stableoutwork, fullintrinsicwindingstairs, upperchapel/barracks/westroomrange/northplateauwall. ClearedpublishedPDwholeplan andexactownCC0ruinphoto, singleexplicitapproximategeographicplanregistration. Nointactkeeporwholemountainsolid; naturalhillsidegapsretainoriginalfield. Hiddenruinprofiles/verticalsections/floors/roofsurvival/staircounts/registration explicitestimates.',
  camera: [95, 80, 110],
  lookAt: topCenter,
  mediumFiContext: {
    scale: 1.7,
    groundY: -18,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 2200,
  },
  embeddedCanonicalGraphs: [
    'stone_drywall',
    'stone_limestone_raw',
    'brick',
    'earth_rammed',
    'plaster_lime',
    'metal_painted',
  ],
  groundCutout: {
    outline: outlines[0],
    additionalOutlines: outlines.slice(1),
    outlines,
    basis:
      'Separatedoriginalplan-roomfloor/cistern/stairfootprintsonly,individualphysicalopenings. Naturalhillgaps/whole14controlsiteextentnotclearedorflattened;originalfieldbytesunchanged. Planregistration/roomfloorsoriginalapproximateestimates.',
  },
  qaCameras: [
    {
      name: 'whole-upper-lower-wards-cisterns-and-stairs',
      position: [95, 90, 110],
      lookAt: topCenter,
    },
    { name: 'whole-thirteen-part-plan', position: [0, 190, 0.1], lookAt: [0, 0, 0] },
    {
      name: 'eastern-pointed-entry-and-surviving-vault',
      position: at([1210, 1250], 11),
      lookAt: at([1000, 1100], 2.7),
    },
    {
      name: 'lower-housing-rounded-bay-and-large-hall',
      position: [-75, 35, 70],
      lookAt: at([370, 1040], 0),
    },
    {
      name: 'upper-chapel-room-range-and-switchbacks',
      position: [80, 48, 65],
      lookAt: at([780, 490], 6),
    },
    {
      name: 'lowest-zone-hollow-cistern-and-outwork',
      position: [-14, 12, 73],
      lookAt: at([680, 1440], -14),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-castle-${reviewLod}`,
    position: [95, 90, 110],
    lookAt: topCenter,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/buffavento-runtime-overlay.mjs',
    level: 'skyline',
    export: 'buffaventoSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'buffaventoDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'buffaventoStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'buffaventoCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Whole13partreleasedplanretainedunderoneuniformsimilaritytransformusingmanuallyhypothesizedupperrow/path-endpointcorrespondence. Nativeextent14controlsisnotroomwallgeometry. Wholeplanhasno metric/verticalsurvey; actualruinheight/windowcensus/roofsurvival/daylightmaterial/currentconservation/floors/railplacements explicitlyoriginalestimated. Exact2024ruinphoto roomID notindependentlybound; onlymasonry/cappedtops/arch/stepappearance adopted. Nodrawingtext/art/sculpture/completeintactmedievalcastle fabricated.',
    'Originalfield/frame/allfloors/mainsections frozenbeforemesh; coarseDEMprovider-relativepeaksdifferfrompublishedsummitaltitudes. No surveyedaltitude/contact/thresholdclaim. Modelrooms/cisterns/stepshavephysicalindividualgroundopenings, naturalhillgapsremain; sourceelevationsneverreplaced/fitted. Geographicpreview/replacementfalse. External600stepapproach/roads/memorial/trees remainoutsideasset.',
  ],
};
