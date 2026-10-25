/** Fort Lytton: mapped earthworks, casemates, seven open gun positions and stores. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL('../../../content/worldgen/source/places/r7/r7h/fort_lytton/', import.meta.url),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  plan = JSON.parse(fs.readFileSync(new URL('derived-plan.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('b3b2a4'),
    brick: rgb('b19a72'),
    metal: rgb('737d7a'),
    wood: rgb('625b4d'),
    glass: rgb('40524d'),
    ground: rgb('839461'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.98, metallic: 0 },
    metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.88, metallic: 0.1 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0 },
    ground: { slot: 'foundation', localRef: 'palette:#fdffff', roughness: 0.98, metallic: 0 },
  };
export function fortLyttonGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, color = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    color,
  );
}
function Q(o, s, q, n, color = C[s]) {
  T(o, s, q.slice(0, 3), n, color);
  T(o, s, [q[0], q[2], q[3]], n, color);
}
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  ring = (ps) =>
    ps.length > 1 && Math.hypot(ps[0][0] - ps.at(-1)[0], ps[0][1] - ps.at(-1)[1]) < 1e-7
      ? ps.slice(0, -1)
      : ps,
  feature = (role) => ring(p.features.find((f) => f.role === role).outline),
  centroid = (r) => [0, 1].map((k) => ring(r).reduce((s, v) => s + v[k], 0) / ring(r).length),
  tint = (c, k) => c.map((v) => v * k),
  roofY = (_x, z) => (z > 8 ? A.engineTop : A.casemateTop);
function distance(P, line) {
  let best = Infinity;
  for (let i = 0; i < line.length; i++) {
    const a = line[i],
      b = line[(i + 1) % line.length],
      v = b.map((q, k) => q - a[k]),
      t = Math.max(
        0,
        Math.min(1, ((P[0] - a[0]) * v[0] + (P[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
      );
    best = Math.min(best, Math.hypot(P[0] - a[0] - t * v[0], P[1] - a[1] - t * v[1]));
  }
  return best;
}
function simplify(ps, d) {
  let r = ring(ps);
  if (d > 0 || r.length < 8) return r;
  // Skyline removes sub-metre bends, retaining the researched outer plan and pit openings.
  r = r.filter((v, i) => {
    const a = r[(i + r.length - 1) % r.length],
      b = r[(i + 1) % r.length];
    return Math.hypot(v[0] - a[0], v[1] - a[1]) > 0.65 && distance(v, [a, b]) > 0.08;
  });
  return r;
}
function flat(o, s, polygons, Y, d, color = C[s]) {
  for (const poly of polygons) {
    const rings = [poly.outer, ...(poly.holes ?? [])].map((r) => simplify(r, d)),
      starts = [],
      points = [];
    for (const [i, r] of rings.entries()) {
      if (i) starts.push(points.length);
      points.push(...r);
    }
    const ids = earcut(points.flat(), starts),
      yy = typeof Y === 'function' ? Y : () => Y;
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        s,
        ids.slice(i, i + 3).map((k) => [points[k][0], yy(...points[k]), points[k][1]]),
        [0, 1, 0],
        color,
      );
  }
}
function box(o, s, x, y, z, w, h, depth, color = C[s]) {
  if (h <= 0) return;
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * depth) / 2]),
    b = a.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, a.toReversed(), [0, -1, 0], color);
  Q(o, s, b, [0, 1, 0], color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], color);
  }
}
function beam(o, s, a, b, w, h, color = C[s]) {
  const axis = b.map((v, k) => v - a[k]),
    L = Math.hypot(...axis),
    n = axis.map((v) => v / L),
    v = cross(n, Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    V = v.map((x) => x / Math.hypot(...v)),
    U = cross(n, V),
    rr = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + (V[k] * i * w) / 2 + (U[k] * j * h) / 2)),
    a0 = rr(a),
    b0 = rr(b);
  Q(
    o,
    s,
    a0.toReversed(),
    n.map((v) => -v),
    color,
  );
  Q(o, s, b0, n, color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a0[i], a0[j], b0[j], b0[i]], null, color);
  }
}
function tube(o, a, b, r0, r1, N, color, hollow = false) {
  const n = b.map((v, k) => v - a[k]),
    L = Math.hypot(...n),
    axis = n.map((v) => v / L),
    v = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    V = v.map((x) => x / Math.hypot(...v)),
    U = cross(axis, V),
    P = (c, r, i) =>
      c.map(
        (x, k) =>
          x + r * (V[k] * Math.cos((i * 2 * Math.PI) / N) + U[k] * Math.sin((i * 2 * Math.PI) / N)),
      );
  for (let i = 0; i < N; i++) {
    Q(o, 'metal', [P(a, r0, i), P(a, r0, i + 1), P(b, r1, i + 1), P(b, r1, i)], null, color);
    if (hollow) {
      const back = mix(b, a, Math.min(0.45, 0.7 / L));
      Q(
        o,
        'metal',
        [P(b, r1, i), P(b, r1, i + 1), P(b, r1 * 0.67, i + 1), P(b, r1 * 0.67, i)],
        axis,
        color,
      );
      Q(
        o,
        'metal',
        [
          P(b, r1 * 0.67, i),
          P(b, r1 * 0.67, i + 1),
          P(back, r1 * 0.66, i + 1),
          P(back, r1 * 0.66, i),
        ],
        null,
        rgb('343e3a'),
      );
      if (N > 3)
        T(
          o,
          'metal',
          [back, P(back, r1 * 0.66, i), P(back, r1 * 0.66, i + 1)],
          axis,
          rgb('29332f'),
        );
    } else T(o, 'metal', [b, P(b, r1, i), P(b, r1, i + 1)], axis, color);
  }
}
function face(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    vx = (b[0] - a[0]) / L,
    vz = (b[1] - a[1]) / L,
    n = [vz, 0, -vx];
  return { L, n, P: (u, y, v = 0) => [a[0] + vx * u + n[0] * v, y, a[1] + vz * u + n[2] * v] };
}
function patch(o, s, F, l, r, lo, hi, v = 0, color = C[s]) {
  if (r <= l || hi <= lo) return;
  Q(o, s, [F.P(l, lo, v), F.P(r, lo, v), F.P(r, hi, v), F.P(l, hi, v)], F.n, color);
}
function wall(
  o,
  a,
  b,
  lo,
  hi,
  d,
  { s = 'wall', th = 0.35, portal = null, slits = [], inside = false, color = C[s] } = {},
) {
  const F = face(a, b),
    holes = [];
  if (portal)
    holes.push({
      c: F.L / 2,
      w: portal.w ?? 1.5,
      b: lo,
      h: portal.h ?? 2.3,
      arch: portal.arch !== false,
    });
  for (const e of slits) holes.push({ ...e, b: lo + (e.b ?? 0.6) });
  holes.sort((a, b) => a.c - b.c);
  let prev = 0;
  const panel = (l, r, b, t) => {
    if (r <= l || t <= b) return;
    if (d === 0 && inside)
      Q(
        o,
        s,
        [F.P(l, b, -th), F.P(r, b, -th), F.P(r, t, -th), F.P(l, t, -th)],
        F.n.map((v) => -v),
        color,
      );
    else patch(o, s, F, l, r, b, t, 0, color);
    if (d > 0)
      Q(
        o,
        s,
        [F.P(l, b, -th), F.P(r, b, -th), F.P(r, t, -th), F.P(l, t, -th)],
        F.n.map((v) => -v),
        color,
      );
  };
  for (const e of holes) {
    const l = Math.max(0, e.c - e.w / 2),
      r = Math.min(F.L, e.c + e.w / 2),
      top = e.b + e.h;
    panel(prev, l, lo, hi);
    panel(l, r, lo, e.b);
    if (e.arch) {
      const N = [2, 6, 10, 14][d],
        rr = (r - l) / 2,
        cy = top - rr;
      for (let i = 0; i < N; i++) {
        const u = l + ((r - l) * i) / N,
          v = l + ((r - l) * (i + 1)) / N,
          y = cy + Math.sqrt(Math.max(0, rr * rr - (u - e.c) * (u - e.c))),
          z = cy + Math.sqrt(Math.max(0, rr * rr - (v - e.c) * (v - e.c)));
        for (const depth of d === 0 ? [inside ? -th : 0] : [0, -th])
          Q(
            o,
            s,
            [F.P(u, y, depth), F.P(v, z, depth), F.P(v, hi, depth), F.P(u, hi, depth)],
            depth < 0 ? F.n.map((v) => -v) : F.n,
            color,
          );
        if (d > 0)
          Q(o, s, [F.P(u, y), F.P(v, z), F.P(v, z, -th), F.P(u, y, -th)], null, tint(color, 0.85));
      }
    } else {
      panel(l, r, top, hi);
      if (d > 0)
        Q(o, s, [F.P(l, top), F.P(r, top), F.P(r, top, -th), F.P(l, top, -th)], null, color);
    }
    if (d > 0)
      for (const u of [l, r])
        Q(
          o,
          s,
          [
            F.P(u, e.b),
            F.P(u, top - (e.arch ? e.w / 2 : 0)),
            F.P(u, top - (e.arch ? e.w / 2 : 0), -th),
            F.P(u, e.b, -th),
          ],
          null,
          tint(color, 0.9),
        );
    prev = r;
  }
  panel(prev, F.L, lo, hi);
  if (d > 0)
    Q(o, s, [F.P(0, hi), F.P(F.L, hi), F.P(F.L, hi, -th), F.P(0, hi, -th)], [0, 1, 0], color);
  if (d > 1 && s === 'wall') {
    const N = Math.max(1, Math.floor(F.L / 2.7));
    for (let i = 0; i < N; i++) {
      const u = ((i + 0.3) * F.L) / N;
      if (holes.some((e) => Math.abs(u - e.c) < e.w * 0.7)) continue;
      patch(
        o,
        s,
        F,
        u,
        u + 0.15,
        lo + 0.25,
        Math.min(hi - 0.15, lo + 1.2 + ((i * 7) % 5) * 0.2),
        0.008,
        tint(color, 0.79),
      );
    }
  }
}
function bankBaseY(x, z) {
  const q = [x, z];
  if (distance(q, plan.ridge) < 1e-5) return A.bankTop;
  if (distance(q, plan.bankOuter) < 1e-5) return fortLyttonGround(x, z) - 0.12;
  if (distance(q, plan.court[0].outer) < 1e-5) return A.courtFloor + 0.025;
  if (distance(q, plan.mainShell[0].outer) < 1e-5) return roofY(x, z) + 0.03;
  for (const i of [1, 2, 3, 4, 7])
    if (distance(q, plan.pits[i].footprint[0].outer) < 1e-5)
      return i === 7 ? A.bankTop - 0.25 : A.casemateTop;
  // Boolean intersections on the entry cut meet the authored passage floor, not a modified DEM.
  return A.courtFloor + 0.08;
}
function bankY(x, z) {
  const y = bankBaseY(x, z);
  // Pit4's open firing face stands above the local terreplein; keep grass below its barrel.
  return x < 12 && z > -18 && z < 7
    ? Math.min(y, A.gun4FiringBankTop + 0.15 * Math.max(0, Math.abs(z + 3.3) - 4))
    : y;
}
function landscape(o, d) {
  flat(o, 'ground', plan.court, A.courtFloor, d);
  for (const area of [plan.grassOuter, plan.grassInner]) flat(o, 'ground', area, bankY, d);
  flat(o, 'ground', plan.moat, A.moatWater, d, rgb('526b63'));
  if (d > 0)
    for (const poly of plan.moat)
      for (const r of [poly.outer, ...poly.holes])
        for (let i = 0; i < r.length; i++) {
          const a = r[i],
            b = r[(i + 1) % r.length];
          Q(
            o,
            'ground',
            [
              [a[0], A.moatWater - 0.35, a[1]],
              [b[0], A.moatWater - 0.35, b[1]],
              [b[0], fortLyttonGround(...b) + 0.02, b[1]],
              [a[0], fortLyttonGround(...a) + 0.02, a[1]],
            ],
            null,
            rgb('7f8767'),
          );
        }
  const path = plan.entryPath;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      F = face(a, b),
      w = plan.entryWidth / 2;
    Q(
      o,
      'wall',
      [
        F.P(0, A.courtFloor, w),
        F.P(F.L, A.courtFloor, w),
        F.P(F.L, A.courtFloor, -w),
        F.P(0, A.courtFloor, -w),
      ],
      [0, 1, 0],
      rgb('b5b2a1'),
    );
    for (const side of [-1, 1]) {
      const aa = F.P(0, A.courtFloor, side * (w + 0.2)),
        bb = F.P(F.L, A.courtFloor, side * (w + 0.2));
      if (i === 0)
        wall(o, [aa[0], aa[2]], [bb[0], bb[2]], A.courtFloor, A.bankTop - 0.55, d, {
          th: 0.4,
          color: rgb('c2c1ae'),
        });
      else if (d > 0) {
        beam(
          o,
          'metal',
          [...aa.slice(0, 1), aa[1] + 0.9, aa[2]],
          [bb[0], bb[1] + 0.9, bb[2]],
          0.07,
          0.07,
          rgb('535e59'),
        );
        for (let t = 0; t <= 1; t += 0.25) {
          const q = mix(aa, bb, t);
          beam(o, 'metal', q, [q[0], q[1] + 1, q[2]], 0.08, 0.08, rgb('535e59'));
        }
      }
    }
  }
  if (d > 0)
    for (const poly of plan.nordenfeltTrace) {
      flat(o, 'ground', [poly], A.casemateTop - 0.42, d, rgb('626b4f'));
      const r = poly.outer;
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        wall(o, a, b, A.casemateTop - 0.42, A.casemateTop + 0.04, d, {
          th: 0.18,
          color: rgb('aaa78f'),
        });
      }
    }
}
function casemates(o, d) {
  const raw = plan.mainShell[0].outer,
    short = simplify(raw, d),
    r =
      d === 0
        ? raw.filter(
            (v) => short.includes(v) || distance(v, plan.pits[4].footprint[0].outer) < 1e-5,
          )
        : raw;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      F = face(a, b),
      m = mix(a, b, 0.5),
      Y = Math.min(roofY(...a), roofY(...b));
    let portal = null,
      slits = [];
    if (
      F.L > 4 &&
      ((m[0] > 46 && m[0] < 80 && m[1] > -23 && m[1] < -17) ||
        (m[0] > 14 && m[0] < 30 && m[1] > -16 && m[1] < 4))
    )
      portal = { w: m[0] > 40 ? 1.65 : 1.4, h: 2.45 };
    if (m[1] > 14 && F.L > 6) portal = { w: 2.0, h: 2.0, arch: false };
    if (F.L > 12 && m[0] > 50 && m[1] < -19 && m[1] > -24)
      slits = [
        { c: F.L * 0.27, w: 1.15, b: 0.2, h: 2.1 },
        { c: F.L * 0.73, w: 1.15, b: 0.2, h: 2.1 },
      ];
    if (distance(m, plan.pits[4].footprint[0].outer) < 1e-5) {
      wall(o, a, b, A.courtFloor, A.pitFloor + 0.22, d);
      wall(o, a, b, A.casemateTop - 0.5, A.casemateTop, d);
      continue;
    }
    if (
      F.L > 3.5 &&
      [1, 2].some((k) => distance(m, plan.pits[k].footprint[0].outer) < 1e-5) &&
      m[1] > -29
    )
      portal = { w: 1.65, h: 3.2 };
    wall(o, a, b, A.courtFloor, Y, d, { portal, slits, color: m[1] > 8 ? rgb('999e92') : C.wall });
  }
  flat(o, 'wall', plan.mainRoof, roofY, d);
  if (d > 0) flat(o, 'ground', plan.mainTurf, (x, z) => roofY(x, z) + 0.035, d, rgb('7b8d57'));
  if (d > 0) flat(o, 'wall', plan.mainShell, A.courtFloor + 0.012, d, rgb('999c8c'));
  // Recessed central loading gallery's corrugated iron awning, held above real openings.
  const a = [71.8, -20.4],
    b = [54.5, -22.1],
    F = face(a, b),
    lo = A.courtFloor + 2.8;
  Q(
    o,
    'metal',
    [F.P(0, lo, 1.7), F.P(F.L, lo, 1.7), F.P(F.L, lo + 0.55, -0.25), F.P(0, lo + 0.55, -0.25)],
    [0, 1, 0],
    rgb('8c5148'),
  );
  if (d > 0)
    for (let u = 0; u < F.L; u += 2.8)
      beam(o, 'metal', F.P(u, A.courtFloor, 1.5), F.P(u, lo, 1.5), 0.055, 0.055, rgb('51594f'));
  if (d > 1)
    for (let u = 0.15; u < F.L; u += 0.23)
      Q(
        o,
        'metal',
        [
          F.P(u, lo + 0.01, 1.7),
          F.P(u + 0.025, lo + 0.035, 1.7),
          F.P(u + 0.025, lo + 0.585, -0.25),
          F.P(u, lo + 0.56, -0.25),
        ],
        [0, 1, 0],
        rgb('a96d5d'),
      );
}
function stairs(o, a, b, y0, y1, w, d) {
  const F = face(a, b),
    N = d === 0 ? 3 : Math.max(5, Math.ceil((y1 - y0) / 0.22));
  for (let i = 0; i < N; i++) {
    const l = (F.L * i) / N,
      r = (F.L * (i + 1)) / N,
      y = y0 + ((y1 - y0) * (i + 1)) / N;
    Q(
      o,
      'wall',
      [F.P(l, y, -w / 2), F.P(r, y, -w / 2), F.P(r, y, w / 2), F.P(l, y, w / 2)],
      [0, 1, 0],
    );
    Q(
      o,
      'wall',
      [
        F.P(l, y0 + ((y1 - y0) * i) / N, -w / 2),
        F.P(l, y0 + ((y1 - y0) * i) / N, w / 2),
        F.P(l, y, w / 2),
        F.P(l, y, -w / 2),
      ],
      null,
    );
  }
}
function pits(o, d) {
  for (let i = 1; i <= 7; i++) {
    const west = i === 5 || i === 6,
      floor = west ? A.westernFloor : i === 7 ? A.courtFloor + 2.3 : A.pitFloor,
      top = west ? A.westernParapet : i === 7 ? A.bankTop - 0.25 : A.casemateTop,
      rr = i === 4 ? plan.pits[i].footprint[0].outer : simplify(plan.pits[i].footprint[0].outer, d),
      c = centroid(rr);
    flat(o, 'wall', plan.pits[i].footprint, floor, d, rgb('9b9f91'));
    for (let k = 0; k < rr.length; k++) {
      const a = rr[k],
        b = rr[(k + 1) % rr.length],
        F = face(a, b),
        m = mix(a, b, 0.5),
        south = m[1] > c[1] + 1.5;
      if (i < 5 && distance(m, plan.mainShell[0].outer) < 1e-5) continue;
      if (i === 4) {
        // Curving overhead slab is open to the northwest; its rear wall has actual open slits.
        if (k >= 3) {
          continue;
        }
        wall(o, a, b, A.courtFloor, top, d, {
          th: 0.45,
          portal: F.L > 5 ? { w: 1.05, h: 1.55, arch: false } : null,
          slits:
            F.L > 5
              ? [
                  { c: F.L * 0.22, w: 0.35, b: 1.8, h: 1.7 },
                  { c: F.L * 0.78, w: 0.35, b: 1.8, h: 1.7 },
                ]
              : [],
        });
      } else
        wall(o, a, b, floor, top, d, {
          th: west ? 0.32 : 0.38,
          inside: true,
          portal:
            south && F.L > (west ? 4 : 3.5)
              ? { w: west ? 2.0 : 1.45, h: west ? 1.3 : 2.2, arch: i < 3 }
              : null,
          color: west ? rgb('a8aaa0') : C.wall,
        });
    }
    if (i === 1) {
      flat(o, 'metal', plan.pits[1].roof, top + 0.1, d, rgb('9da6a0'));
      if (d > 0)
        for (const [x, z] of [
          [74, -26],
          [79, -25.5],
          [77.5, -31],
          [73.7, -29.8],
        ])
          beam(o, 'metal', [x, floor, z], [x, top, z], 0.085, 0.085, rgb('434f4a'));
    } else if (i === 4) {
      const raw = plan.pits[4].footprint[0].outer,
        a = raw[1],
        b = raw[2],
        F = face(a, b),
        c = mix(a, b, 0.5),
        N = [6, 10, 18, 24][d],
        radius = F.L / 2 + A.gun4RoofRearOverhang,
        vx = (b[0] - a[0]) / F.L,
        vz = (b[1] - a[1]) / F.L,
        arc = Array.from({ length: N + 1 }, (_, k) => {
          const t = (k * Math.PI) / N;
          return [
            c[0] - vx * Math.cos(t) * radius - F.n[0] * Math.sin(t) * A.gun4RoofFrontDepth,
            c[1] - vz * Math.cos(t) * radius - F.n[2] * Math.sin(t) * A.gun4RoofFrontDepth,
          ];
        });
      flat(o, 'wall', [{ outer: arc, holes: [] }], top + 0.15, 1, rgb('aaa99c'));
      for (let k = 0; k < N; k++)
        wall(o, arc[k], arc[k + 1], top - 0.5, top + 0.15, d, { th: 0.35 });
    }
    if (i === 2)
      tube(
        o,
        [c[0], floor, c[1]],
        [c[0], floor + 0.2, c[1]],
        1.15,
        1.15,
        [5, 8, 12, 16][d],
        rgb('737c71'),
      );
    if (i === 3) stairs(o, [25, -15.3], [27, -21.7], A.courtFloor, top, 1.2, d);
  }
  // Low western battery wall retains both mapped semicircular open pits.
  const r = simplify(plan.western[0].outer, d);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 12)
      wall(o, a, b, A.westernFloor, A.westernParapet, d, { th: 0.4, color: rgb('999e91') });
  }
}
function artillery(o, d) {
  const items = [
      [76.6364, -28.5646, A.pitFloor, 0, -1, 5.2, 'disappearing'],
      [22.1262, -22.1303, A.pitFloor, -0.65, -0.76, 2.4, 'light'],
      [7.3029, -3.2839, A.pitFloor, -0.79, -0.61, 5.5, 'naval'],
      [-39.6375, 33.5406, A.westernFloor, -0.36, -0.93, 3.2, 'muzzle'],
      [-58.0183, 39.3292, A.westernFloor, -0.36, -0.93, 3.2, 'muzzle'],
      [37.25, -48.1, A.courtFloor + 2.3, -0.1, -0.995, 2.6, 'twin'],
      [38.3, -48.1, A.courtFloor + 2.3, -0.1, -0.995, 2.6, 'twin'],
    ],
    N = [3, 6, 12, 16][d];
  for (const [x, z, y, dx, dz, L, kind] of items) {
    const big = kind === 'disappearing',
      small = kind === 'light' || kind === 'twin',
      base = big ? 1.55 : small ? 0.55 : 0.9,
      pivot = y + (big ? 1.6 : small ? 1.0 : 1.35),
      r = big ? 0.4 : small ? 0.12 : kind === 'naval' ? 0.22 : 0.3,
      a = [x - dx * 0.9, pivot - 0.12, z - dz * 0.9],
      b = [x + dx * L, pivot + L * 0.16, z + dz * L],
      dark = rgb('46534d'),
      light = rgb('c5cbc3');
    if (d === 0) {
      T(
        o,
        'metal',
        [0, 1, 2].map((i) => [
          x + Math.cos((i * 2 * Math.PI) / 3) * base,
          y + 0.12,
          z + Math.sin((i * 2 * Math.PI) / 3) * base,
        ]),
        [0, 1, 0],
        dark,
      );
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3,
          b = ((i + 1) * 2 * Math.PI) / 3,
          aa = [x + Math.cos(a) * base, y + 0.12, z + Math.sin(a) * base],
          bb = [x + Math.cos(b) * base, y + 0.12, z + Math.sin(b) * base];
        T(o, 'metal', [aa, bb, [x, pivot, z]], null, dark);
      }
    } else {
      tube(o, [x, y, z], [x, y + 0.2, z], base, base, N, dark);
      for (const side of [-1, 1]) {
        const px = -dz * side * (big ? 0.65 : 0.35),
          pz = dx * side * (big ? 0.65 : 0.35);
        beam(
          o,
          'metal',
          [x + px, y + 0.2, z + pz],
          [x + px + dx * 0.45, pivot, z + pz + dz * 0.45],
          big ? 0.25 : 0.16,
          big ? 0.3 : 0.15,
          dark,
        );
        if (big)
          beam(
            o,
            'metal',
            [x + px - dx * 0.8, y + 0.35, z + pz - dz * 0.8],
            [x + px + dx * 0.45, pivot, z + pz + dz * 0.45],
            0.17,
            0.18,
            dark,
          );
      }
      if (kind === 'naval') {
        const F = face([x - dz * 0.9, z + dx * 0.9], [x + dz * 0.9, z - dx * 0.9]);
        patch(o, 'metal', F, 0, F.L, y + 0.35, y + 1.45, 0, light);
      }
    }
    if (d === 0) tube(o, a, b, r * 1.18, r * 0.7, N, kind === 'muzzle' ? dark : light, true);
    else {
      tube(o, a, mix(a, b, 0.55), r * 1.18, r, N, kind === 'muzzle' ? dark : light);
      tube(o, mix(a, b, 0.55), b, r, r * 0.7, N, kind === 'muzzle' ? dark : light, true);
    }
    if (d > 1) {
      tube(
        o,
        [a[0], a[1], a[2]],
        [a[0] - dx * 0.18, a[1] - 0.03, a[2] - dz * 0.18],
        r * 1.2,
        r * 1.2,
        N,
        dark,
      );
      const xx = x - dz * (big ? 1.05 : 0.65),
        zz = z + dx * (big ? 1.05 : 0.65);
      tube(
        o,
        [xx - dz * 0.04, pivot - 0.25, zz + dx * 0.04],
        [xx + dz * 0.04, pivot - 0.25, zz - dx * 0.04],
        0.32,
        0.32,
        N,
        dark,
        true,
      );
    }
  }
}
function stores(o, d) {
  for (const S of A.stores) {
    const r = feature(S.role),
      a = r[0],
      b = r[1],
      F = face(a, b),
      ex = [(b[0] - a[0]) / F.L, (b[1] - a[1]) / F.L],
      c = r[2],
      D = Math.hypot(c[0] - b[0], c[1] - b[1]),
      ez = [(c[0] - b[0]) / D, (c[1] - b[1]) / D],
      P = (u, y, v) => [a[0] + ex[0] * u + ez[0] * v, S.floorY + y, a[1] + ex[1] * u + ez[1] * v],
      localFace = (l, r) => face([P(...l)[0], P(...l)[2]], [P(...r)[0], P(...r)[2]]),
      H = S.wallHeight;
    for (const [v, reverse] of [
      [0, false],
      [D, true],
    ]) {
      const ends = reverse
          ? [
              [F.L, 0, v],
              [0, 0, v],
            ]
          : [
              [0, 0, v],
              [F.L, 0, v],
            ],
        BF = localFace(...ends),
        windows = [0.19, 0.5, 0.81].map((q) => ({ c: BF.L * q, w: 0.95, b: 1.1, h: 1.6 }));
      wall(
        o,
        [BF.P(0, 0)[0], BF.P(0, 0)[2]],
        [BF.P(BF.L, 0)[0], BF.P(BF.L, 0)[2]],
        S.floorY,
        S.floorY + H,
        d,
        { s: 'brick', th: 0.3, slits: d === 0 ? [] : windows },
      );
      for (const e of windows) {
        patch(
          o,
          'glass',
          BF,
          e.c - e.w / 2,
          e.c + e.w / 2,
          S.floorY + 1.1,
          S.floorY + 2.7,
          d === 0 ? 0.01 : -0.13,
        );
        if (d > 0) {
          for (const u of [e.c - 0.49, e.c + 0.46, e.c - 0.02])
            patch(
              o,
              'wall',
              BF,
              u,
              u + 0.045,
              S.floorY + 1.08,
              S.floorY + 2.72,
              -0.05,
              rgb('d0d0b9'),
            );
          for (const y of [1.08, 1.88, 2.68])
            patch(
              o,
              'wall',
              BF,
              e.c - 0.49,
              e.c + 0.49,
              S.floorY + y,
              S.floorY + y + 0.045,
              -0.04,
              rgb('d0d0b9'),
            );
        }
      }
    }
    for (const u of [0, F.L]) {
      const BF = u === 0 ? localFace([u, 0, D], [u, 0, 0]) : localFace([u, 0, 0], [u, 0, D]),
        dw = u === 0 ? 2.1 : 1.05,
        dh = u === 0 ? 2.9 : 2.15;
      wall(
        o,
        [BF.P(0, 0)[0], BF.P(0, 0)[2]],
        [BF.P(D, 0)[0], BF.P(D, 0)[2]],
        S.floorY,
        S.floorY + H,
        d,
        { s: 'brick', portal: d === 0 ? null : { w: dw, h: dh, arch: false }, th: 0.3 },
      );
      patch(
        o,
        'wood',
        BF,
        D / 2 - dw / 2,
        D / 2 + dw / 2,
        S.floorY,
        S.floorY + dh,
        d === 0 ? 0.01 : -0.1,
      );
      T(
        o,
        'brick',
        [P(u, H, 0), P(u, H, D), P(u, H + S.ridgeRise, D / 2)],
        u === 0 ? [-ex[0], 0, -ex[1]] : [ex[0], 0, ex[1]],
      );
    }
    const high = H + S.ridgeRise;
    for (const v of [0, D])
      Q(
        o,
        'metal',
        [
          P(-0.22, H - 0.05, v === 0 ? -0.22 : D + 0.22),
          P(F.L + 0.22, H - 0.05, v === 0 ? -0.22 : D + 0.22),
          P(F.L + 0.22, high, D / 2),
          P(-0.22, high, D / 2),
        ],
        [0, 1, 0],
        rgb('985f51'),
      );
    if (d > 1)
      for (let u = 0.15; u < F.L; u += 0.26)
        for (const v of [0, D])
          Q(
            o,
            'metal',
            [
              P(u, H, v),
              P(u + 0.025, H + 0.035, v),
              P(u + 0.025, high + 0.035, D / 2),
              P(u, high, D / 2),
            ],
            [0, 1, 0],
            rgb('b5826c'),
          );
    if (d > 0)
      for (const v of [0, D])
        beam(o, 'metal', P(-0.3, H - 0.06, v), P(F.L + 0.3, H - 0.06, v), 0.1, 0.1, rgb('695d4c'));
    if (d > 0) flat(o, 'wall', [{ outer: r, holes: [] }], S.floorY - 0.03, d, rgb('aaa796'));
  }
}
function traces(o, d) {
  const q = feature('1943-searchlight'),
    floor = A.searchlightFloor,
    top = floor + 5.6;
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      F = face(a, b);
    wall(o, a, b, floor, top, d, {
      portal: i === 0 ? { w: Math.min(2.5, F.L - 0.4), h: 2.25, arch: false } : null,
      slits:
        i === 1 || i === 3 ? [{ c: F.L / 2, w: Math.min(3.8, F.L - 0.6), b: 3.6, h: 0.85 }] : [],
    });
  }
  flat(o, 'wall', [{ outer: q, holes: [] }], top, d);
  const cp = feature('WWII-command-post'),
    cpY = A.courtFloor;
  for (let i = 0; i < cp.length; i++) {
    const a = cp[i],
      b = cp[(i + 1) % cp.length],
      F = face(a, b);
    wall(o, a, b, cpY, cpY + (i === 2 ? 3.2 : 5.6), d, {
      th: 0.4,
      portal: i === 1 ? { w: 1.2, h: 2.15, arch: false } : null,
      slits: i === 0 || i === 3 ? [{ c: F.L * 0.5, w: F.L * 0.58, b: 3.75, h: 0.8 }] : [],
    });
  }
  // Distinct mapped fallen ruin slab beside pit7, kept askew rather than restored as a second tower.
  const fallen = feature('fallen-WWII-command-post'),
    cy = centroid(fallen),
    fy = fortLyttonGround(...cy) + 0.08;
  flat(
    o,
    'wall',
    [{ outer: fallen, holes: [] }],
    (x, _z) => fy + 0.35 + (x - cy[0]) * 0.17,
    d,
    rgb('92998b'),
  );
  for (let i = 0; i < 2; i++) {
    const a = fallen[i],
      b = fallen[i + 1];
    wall(o, a, b, fy - 0.2, fy + 1.5, d, {
      th: 0.35,
      portal: i === 0 ? { w: 1.75, h: 1.2, arch: false } : null,
      color: rgb('949b90'),
    });
  }
  for (const f of p.features.filter(
    (f) => f.role.includes('concrete-slab') || f.role === 'removed-building-slab',
  )) {
    const r = ring(f.outline),
      c = centroid(r),
      y = f.role === 'inner-concrete-slab' ? A.courtFloor + 0.05 : fortLyttonGround(...c) + 0.08;
    flat(o, 'wall', [{ outer: r, holes: [] }], y, d, rgb('a3a591'));
  }
  const S = A.cottonStore,
    x = S.x,
    z = S.z,
    y = S.floorY,
    w = S.w,
    D = S.depth;
  flat(
    o,
    'wall',
    [
      {
        outer: [
          [x - w / 2, z - D / 2],
          [x + w / 2, z - D / 2],
          [x + w / 2, z + D / 2],
          [x - w / 2, z + D / 2],
        ],
        holes: [],
      },
    ],
    y,
    d,
    rgb('969784'),
  );
  for (const [a, b] of [
    [
      [x - w / 2, z - D / 2],
      [x + w / 2, z - D / 2],
    ],
    [
      [x + w / 2, z - D / 2],
      [x + w / 2, z + D / 2],
    ],
    [
      [x + w / 2, z + D / 2],
      [x - w / 2, z + D / 2],
    ],
    [
      [x - w / 2, z + D / 2],
      [x - w / 2, z - D / 2],
    ],
  ])
    wall(o, a, b, y, y + S.wallHeight, d, { s: 'brick', th: 0.35, color: rgb('8d8871') });
  if (d > 0) {
    for (const xx of [x - w * 0.13, x + w * 0.2])
      wall(o, [xx, z - D / 2], [xx, z + D / 2 - 0.8], y, y + 0.65, d, {
        s: 'brick',
        th: 0.25,
        color: rgb('8f8974'),
      });
    box(o, 'ground', x + 0.3, y + 0.015, z, 0.18, 0.025, D - 0.25, rgb('495c50'));
    if (d > 1)
      for (let i = 0; i < 14; i++) {
        const xx = x - w * 0.38 + (i % 5) * 0.54,
          zz = z - D * 0.3 + Math.floor(i / 5) * 0.3;
        box(o, 'brick', xx, y + 0.02, zz, 0.25, 0.11 + (i % 3) * 0.08, 0.14, rgb('898773'));
      }
  }
  const P = A.primingPit;
  flat(
    o,
    'wall',
    [
      {
        outer: [
          [P.x - P.w / 2, P.z - P.depth / 2],
          [P.x + P.w / 2, P.z - P.depth / 2],
          [P.x + P.w / 2, P.z + P.depth / 2],
          [P.x - P.w / 2, P.z + P.depth / 2],
        ],
        holes: [],
      },
    ],
    P.floorY + 0.03,
    d,
    rgb('929982'),
  );
  for (const side of [-1, 1])
    wall(
      o,
      [P.x + (side * P.w) / 2, P.z - P.depth / 2],
      [P.x + (side * P.w) / 2, P.z + P.depth / 2],
      P.floorY,
      P.floorY + 0.5,
      d,
      { th: 0.25 },
    );
  const L = A.oldSearchlight;
  for (const [a, b] of [
    [
      [-L.w / 2, -L.depth / 2],
      [L.w / 2, -L.depth / 2],
    ],
    [
      [L.w / 2, -L.depth / 2],
      [L.w / 2, L.depth / 2],
    ],
    [
      [-L.w / 2, L.depth / 2],
      [-L.w / 2, -L.depth / 2],
    ],
  ])
    wall(o, [L.x + a[0], L.z + a[1]], [L.x + b[0], L.z + b[1]], L.floorY, L.floorY + 2.05, d, {
      th: 0.3,
      color: rgb('9da292'),
    });
  flat(
    o,
    'wall',
    [
      {
        outer: [
          [L.x - L.w / 2, L.z - L.depth / 2],
          [L.x + L.w / 2, L.z - L.depth / 2],
          [L.x + L.w / 2, L.z + L.depth / 2],
          [L.x - L.w / 2, L.z + L.depth / 2],
        ],
        holes: [],
      },
    ],
    L.floorY + 2.1,
    d,
  );
  const J = A.jettyTrace;
  box(o, 'wall', J.x, J.floorY - 0.1, J.z, 7, 0.38, 2.2, rgb('8f9789'));
  for (const [x, z] of A.winchPads)
    box(o, 'wall', x, fortLyttonGround(x, z) + 0.05, z, 3.1, 0.45, 2.2, rgb('8f9889'));
}
function build(o, _f, d = 3) {
  landscape(o, d);
  casemates(o, d);
  pits(o, d);
  artillery(o, d);
  stores(o, d);
  traces(o, d);
}
export function fortLyttonTriangleStats(d) {
  return Object.fromEntries(
    [landscape, casemates, pits, artillery, stores, traces].map((fn) => {
      let count = 0;
      fn(
        {
          addTriangle() {
            count++;
          },
        },
        d,
      );
      return [fn.name, count];
    }),
  );
}
export const fortLyttonSkyline = (o, f) => build(o, f, 0),
  fortLyttonDistrict = (o, f) => build(o, f, 1),
  fortLyttonStreet = (o, f) => build(o, f, 2),
  fortLyttonCloseup = (o, f) => build(o, f, 3);
export const fortLyttonModel = {
  id: 'fort_lytton',
  key: 'fort_lytton',
  cell: 'r7/r7h',
  recipe: 'structure-fort-lytton.mjs',
  title: 'Fort Lytton',
  category: 'palace-castle-fort',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-170, 150, 220],
  lookAt: [26, 3, -2],
  mediumFiContext: { scale: 1.35 },
  qaCameras: [
    {
      name: 'whole-pentagonal-earthworks-moat-seven-pits-and-brick-stores',
      position: [-170, 150, 220],
      lookAt: [26, 3, -2],
      reviewLod: 'skyline',
    },
    {
      name: 'inner-court-arched-casemates-loading-gallery-and-northern-pits',
      position: [59, 13, 7],
      lookAt: [55, 6, -23],
    },
    {
      name: 'western-open-gun-pits-cannons-searchlight-and-cotton-ruin',
      position: [-102, 37, 76],
      lookAt: [-48, 2, 26],
    },
    {
      name: 'open-rectangular-pit3-and-curved-pit4-naval-gun',
      position: [-5, 16, 12],
      lookAt: [13, 5, -12],
    },
    {
      name: 'disappearing-gun1-open-arched-entry-and-covered-mount',
      position: [75.37, 4.36, -15.46],
      lookAt: [76.6, 5.36, -28],
    },
    {
      name: 'northern-pit7-twin-guns-command-ruins-and-steep-glacis',
      position: [10, 23, -76],
      lookAt: [39, 7, -43],
    },
    {
      name: 'causeway-whitewashed-entry-and-two-brick-store-gables',
      position: [142, 29, 70],
      lookAt: [87, 5, 25],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fort-lytton.mjs',
    level: 'skyline',
    export: 'fortLyttonSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'fortLyttonDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'fortLyttonStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'fortLyttonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    p.firingSectorDecision,
    p.gun4RoofDecision,
    'Complete surviving fort exterior: actual main pentagonal glacis/court/moat/causeway and entry, genuine casemate openings/loading gallery, seven mapped gun positions/fixed artillery, mapped two brick stores/slabs/western battery/WWII searchlight and separate command-post ruin components. Gun-cotton and priming-pit ruin,1903searchlight, old jetty/winch and T trace use explicit bounded primary relative-location estimates. No quarantine chimney/buildings, refinery, modern movie-set/picnic/display shelters, modern floating pontoon, museum collections, ships, vegetation, people or copied text/artwork.',
    'Four exact2010 Commander Keane creator-PD originals control inner casemate character, disappearing mounting, curved pit4 protection/naval gun and roofless cotton-store brick ruin. Three are selected local Qualla references; exact unchanged local inner-court bytes are copied into the model and bound to the native own/PD-self grant with the existing adapter because local metadata omitted a PD basis. Native vectors fix horizontal layout; primary2024-updated QHR description fixes functional forms. Hidden sections, heights/opening census/roof details/mechanical engineering and unmapped traces are estimates, not all-side surveyed reconstruction.',
    'Six actual canonical slots: concrete wall, brick trim, painted metal roof/artillery, plain timber door, local glazing window and local tinted foundation terrain/water. Four shared graphs plus two local materials. Neutral opaque moat colour is an appearance approximation; no water physics or surveyed tidal level. Authored grass banks are construction geometry, never a modified source heightfield; source composite may occlude parts of the mapped channel or below-grade details. Geographic preview approximate/replacement disabled.',
    'All four levels retain whole fort/moat/entry/court, open pits and casemate voids, all fixed guns/stores/western structures. Skyline simplifies small plan bends, support mechanics and wall thickness; near levels restore arches/reveals, slits, gun muzzles/mechanics, six-pane windows/corrugated roof strips, brick ruin divisions/drain/rubble and stair treads. Distinct mapped command-post ruin components remain incomplete; no second intact command tower is asserted.',
  ],
};
