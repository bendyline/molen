/** Whole native National Congress Palace; original bounded exterior geometry. */
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
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
  wall: rgb('d5d7d3'),
  trim: rgb('bbc0bd'),
  foundation: rgb('aeb5ae'),
  roof: rgb('e7e8df'),
  dark: rgb('485956'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_marble', roughness: 0.62, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_stainless', roughness: 0.36, metallic: 0.65 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.12 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  facadeEvidence = [],
  roofEvidence = [],
  towerEvidence = [],
  supportEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
export const ring = () =>
  frame.features[0].outline
    .slice(0, -1)
    .map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  if (!q.flat().every(Number.isFinite)) throw Error(JSON.stringify({ k, q, n }));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) < 1e-6) return;
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function triangles(r) {
  return ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  );
}
function cap(o, k, r, y, up, col = C[k]) {
  for (const ix of triangles(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], bottom = false, top = true) {
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  if (bottom) cap(o, k, r, y, false, col);
  if (top) cap(o, k, r, Y, true, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  positive = (r) => (area(r) > 0 ? r : [...r].reverse());
export const plans = Object.fromEntries(
  frame.features.map((f) => [
    Number(f.id.slice(4)),
    f.outline.slice(0, -1).map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]),
  ]),
);
const mean = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length),
  angle = (q, c) => {
    const a = Math.atan2(q[1] - c[1], q[0] - c[0]);
    return a < 0 ? a + 2 * Math.PI : a;
  };
function polarRing(r, c, density = 1) {
  const sorted = r.map((q) => ({ q, a: angle(q, c) })).sort((a, b) => a.a - b.a),
    out = [];
  for (let i = 0; i < sorted.length; i++) {
    const x = sorted[i],
      y = sorted[(i + 1) % sorted.length],
      a = x.a,
      b = y.a + (i === sorted.length - 1 ? 2 * Math.PI : 0),
      R = Math.hypot(...sub(x.q, c)),
      RR = Math.hypot(...sub(y.q, c));
    for (let j = 0; j < density; j++) {
      if (j === 0) {
        out.push({ q: x.q, a });
        continue;
      }
      const t = j / density,
        phi = a + (b - a) * t,
        rr = R + (RR - R) * t;
      out.push({
        q: [c[0] + rr * Math.cos(phi), c[1] + rr * Math.sin(phi)],
        a: phi % (2 * Math.PI),
      });
    }
  }
  return out.sort((a, b) => a.a - b.a);
}
function sampleRing(r, c, phi) {
  const a = polarRing(r, c);
  let left = a.at(-1),
    right = a[0];
  for (let i = 0; i < a.length; i++) {
    if (a[i].a <= phi) left = a[i];
    if (a[i].a >= phi) {
      right = a[i];
      break;
    }
  }
  let l = left.a,
    h = right.a;
  if (h < l) h += 2 * Math.PI;
  let v = phi;
  if (v < l) v += 2 * Math.PI;
  const t = (v - l) / (h - l || 1);
  return left.q.map((q, i) => q + (right.q[i] - q) * t);
}
function closed(r, c, y) {
  const q0 = sampleRing(r, c, 0),
    ps = polarRing(r, c)
      .filter((q) => q.a > 1e-8)
      .map((q) => ({ p: [q.q[0], y, q.q[1]], a: q.a }));
  return [{ p: [q0[0], y, q0[1]], a: 0 }, ...ps, { p: [q0[0], y, q0[1]], a: 2 * Math.PI }];
}
function loft(o, k, r, y, s, Y, c, inward = false, desiredY = -1) {
  const a = closed(r, c, y),
    b = closed(s, c, Y);
  let i = 0,
    j = 0;
  while (i < a.length - 1 || j < b.length - 1) {
    const A = a[i],
      B = b[j];
    let q;
    if (i < a.length - 1 && (j === b.length - 1 || a[i + 1].a <= b[j + 1].a)) {
      q = [A.p, a[i + 1].p, B.p];
      i++;
    } else {
      q = [A.p, b[j + 1].p, B.p];
      j++;
    }
    const m = q.reduce((s, p) => s.map((v, i) => v + p[i] / 3), [0, 0, 0]),
      n = [m[0] - c[0], inward ? 1 : desiredY, m[2] - c[1]];
    if (inward) {
      n[0] *= -1;
      n[2] *= -1;
    }
    T(o, k, q, n);
  }
}
function cylinder(o, k, u, v, y, Y, r, N, col = C[k]) {
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N,
      b = (2 * Math.PI * (i + 1)) / N;
    Q(
      o,
      k,
      [
        [u + r * Math.cos(a), y, v + r * Math.sin(a)],
        [u + r * Math.cos(b), y, v + r * Math.sin(b)],
        [u + r * Math.cos(b), Y, v + r * Math.sin(b)],
        [u + r * Math.cos(a), Y, v + r * Math.sin(a)],
      ],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      col,
    );
  }
}
function panel(a, b) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    n = [u[1], -u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[1] * t + n[1] * d],
  };
}
function plane(o, k, p, l, r, y, Y, d = 0, col = C[k]) {
  Q(o, k, [p.P(l, y, d), p.P(r, y, d), p.P(r, Y, d), p.P(l, Y, d)], [p.n[0], 0, p.n[1]], col);
}
function bar(o, k, p, l, r, y, Y, d, depth, col = C[k]) {
  const q = (t, v) => {
    const x = p.P(t, 0, v);
    return [x[0], x[2]];
  };
  solid(o, k, [q(l, d), q(r, d), q(r, d - depth), q(l, d - depth)], y, Y, col, false, true);
}
function emitNative() {
  for (const f of frame.features) {
    const h =
      f.id === 'way/128360953'
        ? A.senateDomeFoot
        : f.id === 'way/825499922'
          ? A.chamberBowlFoot
          : f.id === 'way/825499921'
            ? A.chamberBowlMiddle
            : f.id === 'way/128360954'
              ? A.chamberBowlRim
              : 0;
    for (const q of plans[Number(f.id.slice(4))])
      nativeEvidence.push({ id: f.id, point: toWorld([q[0], h, q[1]]) });
  }
}
function senateDome(o, lod) {
  const base = plans[128360953],
    c = mean(base),
    density = [1, 1, 2, 4][lod],
    r = polarRing(base, c, density).map((q) => q.q),
    R = base.reduce((s, q) => s + Math.hypot(...sub(q, c)), 0) / base.length,
    h = A.senateDomeTop - A.senateDomeFoot,
    sphere = (R * R + h * h) / (2 * h),
    theta = Math.acos((sphere - h) / sphere),
    cy = A.senateDomeTop - sphere,
    N = [2, 4, 8, 16][lod];
  let prior = r,
    Y = A.senateDomeFoot;
  for (let j = 1; j < N; j++) {
    const t = theta * (1 - j / N),
      rr = sphere * Math.sin(t),
      yy = cy + sphere * Math.cos(t),
      next = r.map((q) => [c[0] + ((q[0] - c[0]) * rr) / R, c[1] + ((q[1] - c[1]) * rr) / R]);
    loft(o, 'roof', prior, Y, next, yy, c, false, 1);
    prior = next;
    Y = yy;
  }
  for (let i = 0; i < prior.length; i++)
    T(
      o,
      'roof',
      [
        [prior[i][0], Y, prior[i][1]],
        [prior[(i + 1) % prior.length][0], Y, prior[(i + 1) % prior.length][1]],
        [c[0], A.senateDomeTop, c[1]],
      ],
      [0, 1, 0],
    );
  roofEvidence.push({
    kind: 'senate-convex-dome',
    native: 128360953,
    foot: A.senateDomeFoot,
    top: A.senateDomeTop,
  });
}
function chamberBowl(o, lod) {
  const raw = [plans[825499922], plans[825499921], plans[128360954]],
    c = mean(raw[2]),
    density = [1, 2, 3, 4][lod],
    rings = raw.map((r) => polarRing(r, c, density).map((q) => q.q)),
    ys = [A.chamberBowlFoot, A.chamberBowlMiddle, A.chamberBowlRim],
    N = [1, 2, 4, 8][lod];
  for (let k = 0; k < 2; k++) {
    const angles = [
      ...new Set([...polarRing(rings[k], c), ...polarRing(rings[k + 1], c)].map((q) => q.a)),
    ].sort((a, b) => a - b);
    let prev = rings[k],
      py = ys[k];
    for (let j = 1; j <= N; j++) {
      const t = j / N,
        yy = ys[k] + (ys[k + 1] - ys[k]) * t;
      let r;
      if (j === N) r = rings[k + 1];
      else {
        const a = t * t * (3 - 2 * t);
        const w = t + 0.1 * (a - t);
        r = angles.map((phi) => {
          const q = sampleRing(rings[k], c, phi),
            s = sampleRing(rings[k + 1], c, phi);
          return q.map((v, i) => v + (s[i] - v) * w);
        });
      }
      loft(o, 'roof', prev, py, r, yy, c);
      prev = r;
      py = yy;
    }
  }
  const rim = rings[2],
    inside = rim.map((q) => [c[0] + (q[0] - c[0]) * 0.985, c[1] + (q[1] - c[1]) * 0.985]);
  loft(o, 'roof', rim, A.chamberBowlRim, inside, A.chamberInnerRoof, c, true);
  cap(o, 'roof', inside, A.chamberInnerRoof, true, rgb('d8ddd6'));
  roofEvidence.push({
    kind: 'chamber-inverted-bowl',
    nativeContours: [825499922, 825499921, 128360954],
    foot: ys[0],
    middle: ys[1],
    rim: ys[2],
    innerRoof: A.chamberInnerRoof,
  });
}
function tower(o, id, lod) {
  const r = positive(plans[id]),
    top = A.towerTop;
  solid(o, 'wall', r, top - 0.35, top, C.wall, false, true);
  cap(o, 'foundation', r, A.towerBase, false);
  let glassFaces = 0;
  for (let i = 0; i < r.length; i++) {
    const p = panel(r[i], r[(i + 1) % r.length]);
    if (Math.abs(p.u[1]) < 0.7 || p.L < 3) {
      plane(o, 'wall', p, 0, p.L, A.towerBase, top);
      continue;
    }
    glassFaces++;
    const y = A.towerWindowsBottom,
      Y = A.towerWindowsTop,
      dep = lod === 0 ? 0 : A.towerWindowDepth,
      bays = Math.max(1, Math.round(p.L / [45, 4.5, 3, 1.5][lod])),
      rows = [1, 14, 28, 28][lod],
      dx = p.L / bays,
      dy = (Y - y) / rows;
    plane(o, 'wall', p, 0, p.L, A.towerBase, y);
    plane(o, 'wall', p, 0, p.L, Y, top);
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < bays; k++) {
        const col = rgb(['485956', '526360', '3f514e', '596965'][(j * 7 + k * 11) % 4]);
        plane(o, 'dark', p, k * dx, (k + 1) * dx, y + j * dy, y + (j + 1) * dy, -dep, col);
      }
    if (lod > 0) {
      const draw = (l, r, y, Y) =>
        lod === 1
          ? plane(o, 'trim', p, l, r, y, Y, 0.012)
          : bar(o, 'trim', p, l, r, y, Y, 0.035, dep + 0.035);
      for (let j = 0; j <= rows; j++) {
        const q = y + j * dy;
        draw(
          0,
          p.L,
          Math.max(y, q - A.towerHorizontalMullionHeight / 2),
          Math.min(Y, q + A.towerHorizontalMullionHeight / 2),
        );
      }
      for (let k = 0; k <= bays; k++) {
        const q = k * dx;
        draw(Math.max(0, q - 0.05), Math.min(p.L, q + 0.05), y, Y);
      }
      if (lod > 1) {
        bar(o, 'wall', p, 0, 0.12, A.towerBase, top, 0.02, dep + 0.04);
        bar(o, 'wall', p, p.L - 0.12, p.L, A.towerBase, top, 0.02, dep + 0.04);
      }
    }
    facadeEvidence.push({
      kind: 'tower-long-glazed-face',
      id,
      a: p.a,
      b: p.b,
      depth: dep,
      bays,
      rows,
      bottom: y,
      top: Y,
    });
  }
  towerEvidence.push({ id, top, storeys: A.towerStoreys, glassFaces });
}
function platformRoof(o, lod) {
  const r = plans[825499918],
    lo = [9, 10, 13, 14].reduce((s, i) => s + r[i][0] / 4, 0),
    hi = [1, 2, 5, 6].reduce((s, i) => s + r[i][0] / 4, 0),
    front = (r[0][1] + r[15][1]) / 2,
    back = (r[7][1] + r[8][1]) / 2;
  solid(o, 'roof', rect(lo, hi, front, back), A.podiumRoofBottom, A.podiumRoofTop, C.roof, lod > 0);
  const P = (q, top) => [q[0], top ? A.podiumRoofTop : A.rampStartY, q[1]],
    polys = [
      [[hi, front], true, 0, false, 1, true],
      [2, true, 3, false, 4, false, 5, true],
      [6, true, 7, false, [hi, back], true],
      [[lo, back], true, 8, false, 9, true],
      [10, true, 11, false, 12, false, 13, true],
      [14, true, 15, false, [lo, front], true],
    ];
  for (const list of polys) {
    const q = [];
    for (let i = 0; i < list.length; i += 2)
      q.push(P(typeof list[i] === 'number' ? r[list[i]] : list[i], list[i + 1]));
    for (let i = 1; i < q.length - 1; i++) T(o, 'roof', [q[0], q[i], q[i + 1]], [0, 1, 0]);
    if (lod > 0) {
      for (let i = 0; i < q.length; i++) {
        const a = q[i],
          b = q[(i + 1) % q.length],
          n = [b[2] - a[2], 0, a[0] - b[0]];
        Q(
          o,
          'roof',
          [a, b, [b[0], b[1] - A.rampThickness, b[2]], [a[0], a[1] - A.rampThickness, a[2]]],
          n,
        );
      }
      for (let i = 1; i < q.length - 1; i++)
        T(
          o,
          'roof',
          [q[0], q[i], q[i + 1]].map((v) => [v[0], v[1] - A.rampThickness, v[2]]),
          [0, -1, 0],
        );
    }
  }
}
function podium(o, lod) {
  const native = plans[124198934],
    body = positive(plans[825499920]);
  solid(o, 'foundation', native, A.foundationBottom, 0.12, C.foundation, lod > 0);
  solid(o, 'wall', body, A.podiumDeckBottom, A.podiumDeckTop, C.wall, lod > 0);
  platformRoof(o, lod);
  for (let i = 0; i < body.length; i++) {
    const p = panel(body[i], body[(i + 1) % body.length]),
      bays = Math.max(1, Math.round(p.L / (lod === 0 ? 24 : lod === 1 ? 12 : A.podiumBayMeters))),
      w = p.L / bays,
      depth = lod === 0 ? 0.02 : 0.55;
    for (let j = 0; j < bays; j++) {
      plane(
        o,
        'dark',
        p,
        j * w,
        (j + 1) * w,
        A.podiumGlazingBottom,
        A.podiumGlazingTop,
        -depth,
        rgb(['526461', '485b57', '5a6a65'][j % 3]),
      );
      if (lod > 1) {
        const mid = (j + 0.5) * w;
        if (lod === 2) {
          plane(
            o,
            'trim',
            p,
            mid - 0.045,
            mid + 0.045,
            A.podiumGlazingBottom,
            A.podiumGlazingTop,
            -depth + 0.03,
          );
          plane(o, 'trim', p, j * w, (j + 1) * w, 6.3, 6.38, -depth + 0.03);
        } else {
          bar(
            o,
            'trim',
            p,
            mid - 0.045,
            mid + 0.045,
            A.podiumGlazingBottom,
            A.podiumGlazingTop,
            -depth + 0.04,
            0.06,
          );
          bar(o, 'trim', p, j * w, (j + 1) * w, 6.3, 6.38, -depth + 0.04, 0.06);
          for (const t of [j * w + 0.04, (j + 1) * w - 0.04])
            bar(
              o,
              'trim',
              p,
              t - 0.035,
              t + 0.035,
              A.podiumGlazingBottom,
              A.podiumGlazingTop,
              -depth + 0.04,
              0.06,
            );
        }
      }
    }
    for (let j = 0; j <= bays; j++) {
      const q = p.P(j * w, 0);
      if (lod === 0)
        plane(o, 'wall', p, j * w - 0.18, j * w + 0.18, A.groundPilotis, A.podiumRoofBottom, 0.03);
      else
        cylinder(
          o,
          'wall',
          q[0],
          q[2],
          A.groundPilotis,
          A.podiumRoofBottom,
          A.podiumColumnRadius,
          [0, 4, 8, 12][lod],
        );
      supportEvidence.push({
        kind: 'podium-pilotis-column',
        point: [q[0], q[2]],
        radius: A.podiumColumnRadius,
      });
    }
    facadeEvidence.push({
      kind: 'whole-podium-glazed-face',
      a: p.a,
      b: p.b,
      depth,
      bays,
      bottom: A.podiumGlazingBottom,
      top: A.podiumGlazingTop,
    });
  }
}
function connections(o, lod) {
  solid(o, 'dark', plans[429913466], A.bridgeBottom, A.bridgeTop, C.dark, lod > 0);
  if (lod > 0) {
    const r = positive(plans[429913466]);
    for (let i = 0; i < r.length; i++) {
      const p = panel(r[i], r[(i + 1) % r.length]);
      for (let j = 0; j <= 3; j++) {
        const y = A.bridgeBottom + (j * (A.bridgeTop - A.bridgeBottom)) / 3;
        bar(o, 'trim', p, 0, p.L, y - 0.12, y + 0.12, 0.025, 0.1);
      }
      if (lod > 1)
        for (let j = 1; j < 5; j++) {
          const t = (p.L * j) / 5;
          bar(o, 'trim', p, t - 0.04, t + 0.04, A.bridgeBottom, A.bridgeTop, 0.03, 0.12);
        }
    }
  }
  solid(o, 'roof', plans[825499919], A.podiumRoofBottom, A.podiumRoofTop, C.roof, lod > 0);
  for (const q of plans[825499919]) {
    cylinder(o, 'wall', q[0], q[1], A.groundPilotis, A.podiumRoofBottom, 0.3, lod === 0 ? 4 : 8);
  }
  solid(
    o,
    'trim',
    rect(10.2, 20.1, 60.2, 61.2),
    A.topConnectorBottom,
    A.topConnectorBottom + 0.13,
    C.trim,
    lod > 0,
  );
  if (lod > 0) {
    for (let i = 0; i < 7; i++) {
      const u = 10.3 + i * 1.6;
      solid(
        o,
        'trim',
        rect(u - 0.03, u + 0.03, 60.2, 60.25),
        A.topConnectorBottom,
        A.topConnectorTop,
      );
    }
    B(o, 'trim', [10.2, A.topConnectorTop, 60.22], [20.1, A.topConnectorTop, 60.22], 0.045, 0.045);
  }
}
function ramp(o, lod) {
  const u = A.rampCenterU,
    w = A.rampHalfWidth,
    z = A.rampStartV,
    Z = A.rampEndV,
    y = A.rampStartY,
    Y = A.rampEndY,
    t = A.rampThickness,
    points = [
      [u - w, y, z],
      [u + w, y, z],
      [u + w, Y, Z],
      [u - w, Y, Z],
    ];
  Q(o, 'roof', points, [0, 1, -1]);
  Q(
    o,
    'roof',
    points.map((q) => [q[0], q[1] - t, q[2]]),
    [0, -1, 1],
  );
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4];
    Q(
      o,
      'roof',
      [a, b, [b[0], b[1] - t, b[2]], [a[0], a[1] - t, a[2]]],
      [i === 1 ? 1 : i === 3 ? -1 : 0, 0, i === 0 ? -1 : i === 2 ? 1 : 0],
    );
  }
  if (lod > 1)
    for (const side of [-1, 1]) {
      const x = u + side * w;
      B(o, 'trim', [x, y + 0.8, z], [x, Y + 0.8, Z], 0.045, 0.045);
      for (let j = 0; j < 7; j++) {
        const f = j / 6,
          yy = y + (Y - y) * f,
          v = z + (Z - z) * f;
        B(o, 'trim', [x, yy, v], [x, yy + 0.8, v], 0.035, 0.035);
      }
    }
  partEvidence.push({
    name: 'photo-bounded-intrinsic-front-marble-ramp',
    width: 2 * w,
    rise: Y - y,
    run: Z - z,
  });
}
export function buildNationalCongressPalace(target, _frame, lod = 3) {
  for (const a of [
    partEvidence,
    nativeEvidence,
    openingEvidence,
    facadeEvidence,
    roofEvidence,
    towerEvidence,
    supportEvidence,
  ])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-native-podium-glazing-pilotis-and-roof-platform', () => podium(o, lod));
  part('two-native28-storey-slab-towers-and-recessed-long-glazed-faces', () => {
    tower(o, 230844490, lod);
    tower(o, 230844491, lod);
  });
  part('intrinsic-midheight-bridge-lowconnection-and-roofconnector', () => connections(o, lod));
  part('whole-native-senate-convex-dome', () => senateDome(o, lod));
  part('whole-native-chamber-inverted-bowl-three-contours', () => chamberBowl(o, lod));
  part('intrinsic-front-entrance-ramp', () => ramp(o, lod));
  emitNative();
}
export const nationalCongressPalaceSkyline = (o) => buildNationalCongressPalace(o, null, 0),
  nationalCongressPalaceDistrict = (o) => buildNationalCongressPalace(o, null, 1),
  nationalCongressPalaceStreet = (o) => buildNationalCongressPalace(o, null, 2),
  nationalCongressPalaceCloseup = (o) => buildNationalCongressPalace(o, null, 3);
export const nationalCongressPalaceModel = {
  id: 'national_congress_palace',
  key: 'national_congress_palace',
  cell: '6v/6vj',
  title: 'National Congress Palace',
  wikidataId: 'Q4155889',
  category: p.category,
  recipe: 'national-congress-palace-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildNationalCongressPalace,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole National Congress Palace/Palácio Nereu Ramos: native principal podium/glazedbody/pilotis/roofplatform, both28-storey native slabtowers with recessed longfaces, midheight bridge/lowconnection/roofconnector, Senate convex dome and Chamber inverted-bowl shell retaining all mapped contours, intrinsic whitefrontentranceramp. Published Qualla references searchedfirst; three distinct photographer-ownPD/CC0 originals inspected. Whole physical palace, no separate annexes/plaza/pools/gardens/flags/statues.',
  camera: toWorld([-210, 140, -270]),
  lookAt: toWorld([0, 35, 8]),
  portableGroundY: F - 0.2,
  mediumFiContext: { scale: '1.3', groundY: F - 0.05, cameraYaw: 0.5 },
  embeddedCanonicalGraphs: [
    'stone_marble',
    'metal_stainless',
    'stone_limestone_raw',
    'concrete_plain',
  ],
  qaCameras: [
    {
      name: 'whole-palace-two-cupolas-twin-towers-and-front-ramp',
      position: toWorld([-160, 100, -260]),
      lookAt: toWorld([0, 34, 8]),
    },
    {
      name: 'whole-eleven-native-component-palace-plan',
      position: toWorld([0, 390, 0.3]),
      lookAt: toWorld([0, 5, 8]),
    },
    {
      name: 'glazed-podium-round-pilotis-marble-ramp-and-two-roof-shells',
      position: toWorld([-70, 25, -122]),
      lookAt: toWorld([-5, 10, -20]),
    },
    {
      name: 'whole-rear-twin-towers-midbridge-and-two-cupolas',
      position: toWorld([170, 120, 240]),
      lookAt: toWorld([0, 36, 8]),
    },
    {
      name: 'actual-native-tower-gap-bridge-and-recessed-glazing',
      position: toWorld([70, 66, 143]),
      lookAt: toWorld([15, 48, 60]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/national-congress-palace-runtime-overlay.mjs',
    level: 'skyline',
    export: 'nationalCongressPalaceSkyline',
    errorMeters: 6,
    surfaces,
    authoredLevels: {
      district: { export: 'nationalCongressPalaceDistrict', errorMeters: 2.8, surfaces },
      street: { export: 'nationalCongressPalaceStreet', errorMeters: 0.7, surfaces },
      closeup: { export: 'nationalCongressPalaceCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Qualla-first46families screened; localeligibleAnexoIV is a differentbuilding and archival mainpalace references unbound, unselected. Three distinct exact creator-ownPD/CC0 originals guide wholepalace and glazing:Alex982015CC0/AlexPereira2007PDself/MarioRobertoDuránOrtiz2006PDself. No source pixels embedded or protectedsigns/art copied.',
    'All157 native XZ controls retained across11 physical components. Nativeendprojections interpreted as six sloped intrinsic sideaccess planes using already fixed0.15/11m ramp levels, rather than flying horizontalcanopies; centralroofplate bounded from their native inner edges. Original bounded smooth cupola profiles/closed shallow bowl innerroof/28-storey glazing groups/pilotis/windowframe census/topconnector/frontentryramp/hidden roof/currentfinish. Native92m towerroof retained; ownernews rounded100m differs. Bridge40–50/nativefixme originalbounded. No exact roof/interior/repair survey claim. SeparateAnexoII/III/IV/plaza/pools/lawns/flags/statues/roads excluded.',
    'Original independent512mfield/floor/sections fixed beforegeometry, exactcontactunverified, preview/replacementfalse. Flatground/context neighbors are review fixtures.',
  ],
};
