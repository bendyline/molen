/** Whole operating observatory ridge group; original medium-fi exterior geometry. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/66/66v/las_campanas_observatory/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters.architecturalSections,
  levels = p.parameters.perBuildingLevels,
  feature = (id) => p.features.find((f) => f.id === id),
  ring = (P) =>
    Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 1e-6 ? P.slice(0, -1) : P,
  plan = (id) => ring(feature(id).outline),
  C = {
    wall: rgb('cdd2d0'),
    roof: rgb('bbc4c5'),
    trim: rgb('e2e3dc'),
    foundation: rgb('a5a39b'),
    glass: rgb('576c7e'),
    door: rgb('555e61'),
    brown: rgb('957d65'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'metal_painted', roughness: 0.85, metallic: 0.18 },
    roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.25 },
    trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.18 },
    foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.31, metallic: 0.2 },
    door: { slot: 'door', localRef: 'palette:#fffffd', roughness: 0.87, metallic: 0.25 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]);
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((sum, v, k) => sum + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function flat(o, s, P, y, col = C[s], down = false) {
  P = ring(P);
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [P[k][0], typeof y === 'function' ? y(...P[k]) : y, P[k][1]]),
      [0, down ? -1 : 1, 0],
      col,
    );
}
function faces(P) {
  P = ring(P);
  const area = P.reduce(
    (s, v, k) => s + v[0] * P[(k + 1) % P.length][1] - P[(k + 1) % P.length][0] * v[1],
    0,
  );
  if (area < 0) P = P.toReversed();
  return P.map((a, k) => {
    const b = P[(k + 1) % P.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      w = Math.hypot(dx, dz);
    return { a, b, w, n: [dz / w, 0, -dx / w], u: [dx / w, dz / w] };
  }).filter((f) => f.w > 0.01);
}
function small(P, d) {
  if (d > 0 || P.length < 10) return P;
  // Each retained side is constrained against all original intervening vertices.
  const dist = (q, a, b) => {
      const v = sub(b, a),
        t = Math.max(
          0,
          Math.min(1, ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
        );
      return Math.hypot(q[0] - a[0] - v[0] * t, q[1] - a[1] - v[1] * t);
    },
    rdp = (P) => {
      if (P.length <= 2) return P;
      let best = 0,
        k = 0;
      for (let i = 1; i < P.length - 1; i++) {
        const v = dist(P[i], P[0], P.at(-1));
        if (v > best) {
          best = v;
          k = i;
        }
      }
      return best > 0.9
        ? [...rdp(P.slice(0, k + 1)).slice(0, -1), ...rdp(P.slice(k))]
        : [P[0], P.at(-1)];
    };
  let k = 1;
  for (let i = 2; i < P.length; i++)
    if (Math.hypot(...sub(P[i], P[0])) > Math.hypot(...sub(P[k], P[0]))) k = i;
  return [...rdp(P.slice(0, k + 1)).slice(0, -1), ...rdp([...P.slice(k), P[0]]).slice(0, -1)];
}
function side(o, s, f, x0, x1, y0, y1, offset = 0, col = C[s]) {
  const pt = (x, y) => [
    f.a[0] + f.u[0] * x + f.n[0] * offset,
    y,
    f.a[1] + f.u[1] * x + f.n[2] * offset,
  ];
  Q(o, s, [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)], f.n, col);
}
function prism(o, s, P, y0, y1, col = C[s], bottom = false) {
  for (const f of faces(P)) side(o, s, f, 0, f.w, y0, y1, 0, col);
  flat(o, s, P, y1, col);
  if (bottom) flat(o, s, P, y0, col, true);
}
function opening(o, f, box, d, s = 'glass') {
  const [x0, x1, y0, y1] = box;
  if (d < 2) {
    side(o, s, f, x0, x1, y0, y1, 0.025);
    return;
  }
  side(o, s, f, x0, x1, y0, y1, -0.16);
  const at = (x, y, off) => [
      f.a[0] + f.u[0] * x + f.n[0] * off,
      y,
      f.a[1] + f.u[1] * x + f.n[2] * off,
    ],
    a = at(x0, y0, 0),
    b = at(x1, y0, 0),
    c = at(x1, y1, 0),
    e = at(x0, y1, 0),
    aa = at(x0, y0, -0.16),
    bb = at(x1, y0, -0.16),
    cc = at(x1, y1, -0.16),
    ee = at(x0, y1, -0.16);
  Q(o, 'trim', [a, aa, ee, e], [f.u[0], 0, f.u[1]]);
  Q(o, 'trim', [b, c, cc, bb], [-f.u[0], 0, -f.u[1]]);
  Q(o, 'trim', [a, b, bb, aa], [0, 1, 0]);
  Q(o, 'trim', [e, ee, cc, c], [0, -1, 0]);
  if (d === 3) {
    const mid = (x0 + x1) / 2;
    side(o, 'trim', f, mid - 0.035, mid + 0.035, y0, y1, -0.11);
    side(o, 'trim', f, x0, x1, (y0 + y1) / 2 - 0.035, (y0 + y1) / 2 + 0.035, -0.11);
  }
}
function facade(o, P, bottom, top, d, { brown = false, stories = 1, windows = true } = {}) {
  for (const f of faces(P)) {
    const holes = [],
      col = brown ? C.brown : C.wall;
    if (d > 0 && windows && f.w > 2.7) {
      const n = Math.max(1, Math.floor(f.w / 4.4));
      for (let row = 0; row < stories; row++)
        for (let i = 0; i < n; i++) {
          const x = ((i + 0.5) * f.w) / n,
            w = Math.min(1.3, (f.w / n) * 0.48),
            y = bottom + 1.05 + row * 2.8;
          if (y + 1.25 < top - 0.2) holes.push([x - w / 2, x + w / 2, y, y + 1.25]);
        }
    }
    if (d < 2 || !holes.length) side(o, 'wall', f, 0, f.w, bottom, top, 0, col);
    else {
      const xs = [...new Set([0, f.w, ...holes.flatMap((h) => h.slice(0, 2))])].sort(
          (a, b) => a - b,
        ),
        ys = [...new Set([bottom, top, ...holes.flatMap((h) => h.slice(2))])].sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i++)
        for (let j = 0; j < ys.length - 1; j++) {
          const x = (xs[i] + xs[i + 1]) / 2,
            y = (ys[j] + ys[j + 1]) / 2;
          if (holes.some((h) => x > h[0] && x < h[1] && y > h[2] && y < h[3])) continue;
          side(o, 'wall', f, xs[i], xs[i + 1], ys[j], ys[j + 1], 0, col);
        }
    }
    for (const h of holes) opening(o, f, h, d);
    if (d === 3 && brown && f.w > 7) side(o, 'trim', f, 0, f.w, bottom + 2.7, bottom + 2.83, 0.025);
  }
}
const circle = (c, r, n, heading = 0) =>
  Array.from({ length: n }, (_, i) => [
    c[0] + r * Math.cos(heading + (2 * Math.PI * i) / n),
    c[1] + r * Math.sin(heading + (2 * Math.PI * i) / n),
  ]);
function loft(o, s, P, y0, R, y1, col = C[s]) {
  const center = P.reduce((c, v) => [c[0] + v[0] / P.length, c[1] + v[1] / P.length], [0, 0]);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    Q(
      o,
      s,
      [
        [P[i][0], y0, P[i][1]],
        [P[j][0], y0, P[j][1]],
        [R[j][0], y1, R[j][1]],
        [R[i][0], y1, R[i][1]],
      ],
      [(P[i][0] + P[j][0]) / 2 - center[0], 0, (P[i][1] + P[j][1]) / 2 - center[1]],
      col,
    );
  }
}
function dome(o, c, r, y, rise, d, heading = 0.4) {
  const n = [8, 12, 24, 32][d],
    steps = [1, 3, 5, 8][d];
  let prev = circle(c, r, n, heading),
    h = y;
  for (let j = 1; j <= steps; j++) {
    const t = (j * Math.PI) / (2 * (steps + 1)),
      R = circle(c, r * Math.cos(t), n, heading),
      Y = y + rise * Math.sin(t);
    loft(o, 'trim', prev, h, R, Y);
    prev = R;
    h = Y;
  }
  for (let i = 0; i < n; i++)
    T(
      o,
      'trim',
      [
        [prev[i][0], h, prev[i][1]],
        [prev[(i + 1) % n][0], h, prev[(i + 1) % n][1]],
        [c[0], y + rise, c[1]],
      ],
      [0, 1, 0],
    );
  if (d > 0) {
    const w = d === 1 ? 0.38 : 0.55,
      v = [Math.cos(heading), Math.sin(heading)],
      u = [-v[1], v[0]];
    for (let j = 0; j < 2 * (steps + 1); j++) {
      const a = (Math.PI * j) / (2 * (steps + 1)),
        b = (Math.PI * (j + 1)) / (2 * (steps + 1)),
        q = (t) => [
          c[0] + v[0] * r * Math.cos(t),
          y + rise * Math.sin(t) + 0.045,
          c[1] + v[1] * r * Math.cos(t),
        ],
        a0 = q(a),
        b0 = q(b);
      Q(
        o,
        'door',
        [
          [a0[0] - (u[0] * w) / 2, a0[1], a0[2] - (u[1] * w) / 2],
          [b0[0] - (u[0] * w) / 2, b0[1], b0[2] - (u[1] * w) / 2],
          [b0[0] + (u[0] * w) / 2, b0[1], b0[2] + (u[1] * w) / 2],
          [a0[0] + (u[0] * w) / 2, a0[1], a0[2] + (u[1] * w) / 2],
        ],
        [0, 1, 0],
      );
    }
  }
}
function gable(o, P, y, rise, d) {
  const fs = faces(P),
    f = fs.toSorted((a, b) => b.w - a.w)[0],
    c = P.reduce((a, v) => [a[0] + v[0] / P.length, a[1] + v[1] / P.length], [0, 0]),
    proj = (q) => (q[0] - c[0]) * f.n[0] + (q[1] - c[1]) * f.n[2],
    lo = Math.min(...P.map(proj)),
    hi = Math.max(...P.map(proj)),
    mid = (lo + hi) / 2,
    Y = (x, z) =>
      y +
      rise * (1 - Math.abs(((x - c[0]) * f.n[0] + (z - c[1]) * f.n[2] - mid) / ((hi - lo) / 2)));
  // Clip both roof slopes to the actual irregular footprint, preserving L-shaped wings.
  const clip = (P, positive) => {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i],
        b = P[(i + 1) % P.length],
        fa = (proj(a) - mid) * (positive ? 1 : -1),
        fb = (proj(b) - mid) * (positive ? 1 : -1);
      if (fa >= -1e-7) out.push(a);
      if (fa < 0 !== fb < 0) {
        const t = fa / (fa - fb);
        out.push(a.map((v, k) => v + (b[k] - v) * t));
      }
    }
    return out;
  };
  for (const positive of [false, true]) {
    const R = clip(P, positive);
    if (R.length > 2) flat(o, 'roof', R, Y);
  }
  for (const face of fs) {
    const fa = proj(face.a) - mid,
      fb = proj(face.b) - mid;
    const pts = [face.a];
    if (fa * fb < 0) {
      const t = fa / (fa - fb);
      pts.push(face.a.map((v, k) => v + (face.b[k] - v) * t));
    }
    pts.push(face.b);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k],
        b = pts[k + 1];
      Q(
        o,
        'roof',
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], Y(...b), b[1]],
          [a[0], Y(...a), a[1]],
        ],
        face.n,
      );
    }
  }
  if (d > 1) flat(o, 'trim', P, y, C.trim, true);
}
function standard(o, id, d) {
  const P = small(plan(id), d),
    floor = levels[id].floorY,
    brown = A.brownServiceBars.includes(+id.slice(4)),
    narrow = A.minorRollOff.includes(+id.slice(4)),
    large = id === 'way/136126238' || id === 'way/136126239',
    h = large ? A.largeServiceEaves : brown ? 4.2 : A.serviceEaves;
  if (d > 0) prism(o, 'foundation', P, floor - A.foundationDepth, floor);
  facade(o, P, d === 0 ? floor - A.foundationDepth : floor, floor + h, d, {
    brown,
    stories: large ? 2 : 1,
    windows: !narrow,
  });
  if (d > 0 && (narrow || brown)) gable(o, P, floor + h, narrow ? 1.2 : A.roofRise, d);
  else flat(o, 'roof', P, floor + h);
  if (d > 1) {
    const f = faces(P).toSorted((a, b) => b.w - a.w)[0];
    if (f.w > 3) {
      const x = f.w * 0.44;
      side(o, 'door', f, x, x + 1.05, floor, floor + 2.2, 0.03);
      side(o, 'trim', f, x - 0.08, x + 1.13, floor + 2.2, floor + 2.32, 0.045);
    }
  }
}
function older(o, S, d) {
  const P = small(plan(S.id), d),
    c = feature(S.node).outline[0],
    floor = levels[S.id].floorY;
  if (S === A.duPont) {
    prism(o, 'wall', P, floor - A.foundationDepth, floor + S.annexTop);
    flat(o, 'roof', P, floor + S.annexTop);
  }
  const n = [8, 12, 24, 32][d],
    R = circle(c, S.radius, n);
  if (d > 0) prism(o, 'foundation', R, floor - A.foundationDepth, floor);
  const bodyP = S === A.duPont ? R : P;
  facade(o, bodyP, d === 0 ? floor - A.foundationDepth : floor, floor + S.drumTop, d, {
    windows: false,
  });
  flat(o, 'roof', bodyP, floor + S.drumTop);
  dome(o, c, S.radius, floor + S.drumTop, S.domeRise, d);
  if (d > 0) {
    const f = faces(R)[1];
    side(
      o,
      'door',
      f,
      Math.max(0.15, f.w / 2 - 0.55),
      Math.min(f.w - 0.15, f.w / 2 + 0.55),
      floor,
      floor + 2.1,
      0.025,
    );
  }
}
function magellan(o, d) {
  const S = A.magellan,
    P = small(plan(S.id), d),
    base = levels[S.id].floorY;
  // Actual complete combined footprint is the low connection and foundation envelope.
  if (d > 0) prism(o, 'foundation', P, base - S.foundationDepth, base + 0.45);
  facade(o, P, d === 0 ? base - S.foundationDepth : base + 0.45, base + S.connectorTop, d, {
    windows: d > 0,
  });
  flat(o, 'roof', P, base + S.connectorTop);
  for (const [node, floor] of [
    [S.clayNode, S.clayFloorY],
    [S.baadeNode, S.baadeFloorY],
  ]) {
    const c = feature(node).outline[0],
      n = 8,
      R = circle(c, S.radius, n, Math.PI / 8),
      shoulder = circle(c, S.radius * 0.97, n, Math.PI / 8),
      top = circle(c, S.topRadius, n, Math.PI / 8);
    facade(o, R, floor, floor + S.drumTop, d, { windows: false });
    loft(o, 'wall', R, floor + S.drumTop, shoulder, floor + S.roofShoulder);
    loft(o, 'trim', shoulder, floor + S.roofShoulder, top, floor + S.roofTop);
    flat(o, 'trim', top, floor + S.roofTop);
    if (d > 0) {
      for (const f of faces(R)) {
        side(o, 'trim', f, 0, f.w, floor + 6.0, floor + 6.24, 0.035);
        side(o, 'trim', f, 0, f.w, floor + S.drumTop - 0.2, floor + S.drumTop + 0.08, 0.04);
        if (d > 1 && f.w > 3) {
          const box = [f.w * 0.15, f.w * 0.85, floor + 8.0, floor + 11.0];
          opening(o, f, box, 1, 'glass');
          for (let k = 1; k < (d === 2 ? 4 : 7); k++) {
            const y = box[2] + ((box[3] - box[2]) * k) / (d === 2 ? 4 : 7);
            side(o, 'trim', f, box[0], box[1], y, y + 0.08, 0.07);
          }
        }
      }
      const f = faces(R)[5];
      side(o, 'door', f, f.w * 0.36, f.w * 0.64, floor + 0.4, floor + 3.0, 0.05);
      // Closed split shutter seam follows the faceted roof, never an invented open interior.
      const a = [c[0] - S.radius * 0.86, floor + S.roofShoulder, c[1]],
        b = [c[0] - S.topRadius * 0.9, floor + S.roofTop, c[1]],
        v = [0.12, 0, 0.12];
      Q(o, 'door', [a, b, b.map((x, k) => x + v[k]), a.map((x, k) => x + v[k])], null);
      Q(
        o,
        'door',
        [
          [c[0] - S.topRadius, floor + S.roofTop + 0.035, c[1] - 0.12],
          [c[0] + S.topRadius, floor + S.roofTop + 0.035, c[1] - 0.12],
          [c[0] + S.topRadius, floor + S.roofTop + 0.035, c[1] + 0.12],
          [c[0] - S.topRadius, floor + S.roofTop + 0.035, c[1] + 0.12],
        ],
        [0, 1, 0],
      );
    }
  }
}
function pagoda(o, d) {
  const S = A.pagoda,
    P = plan(S.id),
    floor = levels[S.id].floorY,
    c = P.reduce((a, v) => [a[0] + v[0] / P.length, a[1] + v[1] / P.length], [0, 0]),
    R = P.map((v) => v.map((q, k) => c[k] + (q - c[k]) * 1.15));
  facade(o, P, floor - A.foundationDepth, floor + S.eaves, d, { windows: d > 0 });
  flat(o, 'trim', R, floor + S.eaves);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    T(
      o,
      'roof',
      [
        [R[i][0], floor + S.eaves, R[i][1]],
        [R[j][0], floor + S.eaves, R[j][1]],
        [c[0], floor + S.eaves + S.rise, c[1]],
      ],
      [0, 1, 0],
    );
  }
}
function build(o, _f, d = 3) {
  const special = new Set([
    A.magellan.id,
    A.swope.id,
    A.duPont.id,
    A.warsaw.id,
    A.pagoda.id,
    A.chat.id,
  ]);
  for (const f of p.features.filter((f) => f.id.startsWith('way/')))
    if (!special.has(f.id)) standard(o, f.id, d);
  magellan(o, d);
  for (const S of [A.swope, A.duPont, A.warsaw, A.chat]) older(o, S, d);
  pagoda(o, d);
}
export const campanasSkyline = (o, f) => build(o, f, 0),
  campanasDistrict = (o, f) => build(o, f, 1),
  campanasStreet = (o, f) => build(o, f, 2),
  campanasCloseup = (o, f) => build(o, f, 3);
export const lasCampanasObservatoryModel = {
  id: 'las_campanas_observatory',
  key: 'las_campanas_observatory',
  cell: '66/66v',
  recipe: 'structure-las-campanas-observatory.mjs',
  title: 'Las Campanas Observatory',
  category: 'landmark',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [1650, 720, 1720],
  lookAt: [0, -60, 0],
  mediumFiContext: { scale: 4, groundY: -130 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    {
      name: 'whole-operating-observatory-ridges-and-all38-native-buildings',
      position: [1650, 720, 1720],
      lookAt: [0, -60, 0],
    },
    {
      name: 'opposite-whole-ridge-group-and-older-telescope-line',
      position: [-1700, 580, -1520],
      lookAt: [0, -60, 0],
    },
    {
      name: 'twin-magellan-faceted-enclosures-low-connection-and-closed-shutters',
      position: [570, 32, -75],
      lookAt: [485, 12, 0],
    },
    {
      name: 'opposite-magellan-clay-baade-distinct-native-centers',
      position: [400, 38, 85],
      lookAt: [485, 12, 0],
    },
    {
      name: 'swope-closed-white-dome-drum-and-entrance',
      position: [-246, -93, -216],
      lookAt: [-276, -99, -249],
    },
    {
      name: 'du-pont-dome-whole-native-annex-and-service-projection',
      position: [-597, -90, -720],
      lookAt: [-639, -101, -762],
    },
    {
      name: 'warsaw-ogle-dome-chat-and-smaller-instrument-ridge',
      position: [-450, -103, -448],
      lookAt: [-409, -113, -479],
    },
    {
      name: 'lower-magellan-brown-service-bar-and-native-wing',
      position: [550, -18, 225],
      lookAt: [511, -30, 189],
    },
    {
      name: 'southern-accommodation-l-wings-and-main-service-building',
      position: [760, -12, 748],
      lookAt: [641, -40, 607],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-las-campanas-observatory.mjs',
    level: 'skyline',
    export: 'campanasSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'campanasDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'campanasStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'campanasCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole38-building operating observatory group retains actual native footprints and positions, both individually mapped Magellan enclosures/low connector, Swope/duPont/Warsaw domes, Pagoda, CHAT/TMMT and named minor roll-off instruments, service and accommodation wings. Separate futureGMT construction/three support ways excluded; no whole mountain/campus floor, roads, landscape, snow, people, optics/interiors/text.',
    'One exact2288x1712 cleared Qualla GeneralEpitaph2008 own/PD-self original first, individually inspected/nativeSHA1matched. Primary institution text confirms principal operating instruments; no protected galleries/PDF pixels, attribution-only or uncertain imagery, generated bitmap/borrowed mesh or policy changes. Photo does not survey later small-instrument roofs/hidden faces or current fixtures.',
    'Original bounded medium-fi sections: twin faceted enclosure heights/radii/closed shutter seams/vent panels, older dome proportions/native duPont annex, low service bar/brown accommodation roofs, smaller instrument enclosures, window/door census and hidden faces. Actual footprint/position controls retained; per-building floor estimates rounded from previously frozen independent coarse source field do not certify separately surveyed terrace/threshold/contact.',
    'Original2500m independent16641-value field/twelve raw tiles/PNG frozen before geometry and per-building levels, unchanged. Rugged site includes many separate floors; per-building source-center estimates/footing depths do not establish exact source or host contact, especially two steep lower service footprints. No field flattening/fitting/reacquisition; geographic preview approximate/replacementfalse.',
  ],
};
