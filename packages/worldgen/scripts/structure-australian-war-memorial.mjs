/** Connected memorial galleries, open cloisters, Hall dome and current extensions. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/r3/r3d/australian_war_memorial/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff';
const C = {
    stone: rgb('c5b899'),
    trim: rgb('d2c7ab'),
    roof: rgb('60786e'),
    base: rgb('a5a799'),
    glass: rgb('405b5c'),
    bronze: rgb('665e43'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.7, metallic: 0.55 },
    base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.35, metallic: 0.05 },
    bronze: { slot: 'door', graph: 'metal_bronze_cast', roughness: 0.8, metallic: 0.5 },
  };
export function australianWarMemorialGround(x, z) {
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
function T(o, s, q, n, col = C[s]) {
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
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  if (h <= 0) return;
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    b = a.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, a.toReversed(), [0, -1, 0], col);
  Q(o, s, b, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], col);
  }
}
const area = (P) =>
  P.reduce((a, q, i) => a + q[0] * P[(i + 1) % P.length][1] - q[1] * P[(i + 1) % P.length][0], 0) /
  2;
function simplify(P, tol) {
  P = P.map((q) => [...q]);
  if (tol === 0) return P;
  let change = true;
  while (change && P.length > 5) {
    change = false;
    for (let i = 0; i < P.length; i++) {
      const a = P[(i + P.length - 1) % P.length],
        b = P[i],
        c = P[(i + 1) % P.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        u = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz);
      if (u > 0 && u < 1 && Math.hypot(b[0] - a[0] - u * dx, b[1] - a[1] - u * dz) < tol) {
        P.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return P;
}
function plane(o, s, P, Y, holes = [], col = C[s]) {
  const V = [...P, ...holes.flat()],
    ends = [];
  let k = P.length;
  for (const h of holes) {
    ends.push(k);
    k += h.length;
  }
  const ids = earcut(V.flat(), ends);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [V[k][0], typeof Y === 'function' ? Y(...V[k]) : Y, V[k][1]]),
      [0, 1, 0],
      col,
    );
}
function face(a, b, y = 0, inward = false) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    vx = (b[0] - a[0]) / L,
    vz = (b[1] - a[1]) / L,
    n = [vz * (inward ? -1 : 1), 0, -vx * (inward ? -1 : 1)];
  return { L, n, P: (u, h, v = 0) => [a[0] + vx * u + n[0] * v, y + h, a[1] + vz * u + n[2] * v] };
}
function patch(o, s, F, l, r, lo, hi, depth = 0, col = C[s]) {
  if (hi <= lo || r <= l) return;
  Q(o, s, [F.P(l, lo, depth), F.P(r, lo, depth), F.P(r, hi, depth), F.P(l, hi, depth)], F.n, col);
}
function profile(o, s, F, P, depth, d, col = C[s]) {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const v = ids.slice(i, i + 3).map((k) => P[k]);
    T(
      o,
      s,
      v.map((q) => F.P(...q)),
      F.n,
      col,
    );
    if (d > 0)
      T(
        o,
        s,
        v.toReversed().map((q) => F.P(...q, -depth)),
        F.n.map((v) => -v),
        col,
      );
  }
  if (d > 0)
    for (let i = 0; i < P.length; i++) {
      if (d === 1 && (i === 0 || i >= P.length - 4)) continue;
      const j = (i + 1) % P.length;
      Q(o, s, [F.P(...P[i]), F.P(...P[j]), F.P(...P[j], -depth), F.P(...P[i], -depth)], null, col);
    }
}
function arch(
  o,
  F,
  L,
  H,
  { radius, spring, base = 0, depth = 0.45, closed = false, glazing = false } = {},
  d,
) {
  const R = radius ?? L * 0.3,
    xc = L / 2,
    s = spring ?? 3.4,
    n = [2, 3, 10, 18][d],
    P = [
      [0, 0],
      [xc - R, 0],
      [xc - R, s],
    ];
  for (let i = 1; i <= n; i++) {
    const t = Math.PI - (Math.PI * i) / n;
    P.push([xc + R * Math.cos(t), s + R * Math.sin(t)]);
  }
  P.push([xc + R, 0], [L, 0], [L, H], [0, H]);
  profile(o, 'stone', F, P, depth, d);
  if (base > 0) patch(o, 'stone', F, xc - R, xc + R, 0, base);
  if (closed) {
    const D = (u, y) => F.P(u, y, -0.4),
      P = [
        [xc - R, base],
        [xc + R, base],
        [xc + R, s],
      ];
    for (let i = 1; i <= n; i++) {
      const t = (Math.PI * i) / n;
      P.push([xc + R * Math.cos(t), s + R * Math.sin(t)]);
    }
    const ids = earcut(P.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        base > 2 || glazing ? 'glass' : 'bronze',
        ids.slice(i, i + 3).map((k) => D(...P[k])),
        F.n,
      );
    if (d > 1) {
      if (base > 2 || glazing) {
        for (let j = 1; j < 5; j++) {
          const u = xc - R + (2 * R * j) / 5;
          patch(
            o,
            'bronze',
            F,
            u - 0.025,
            u + 0.025,
            base,
            s + Math.sqrt(R * R - (u - xc) * (u - xc)),
            -0.36,
          );
        }
      } else patch(o, 'bronze', F, xc - 0.055, xc + 0.055, base, s + R, -0.36);
      patch(o, 'bronze', F, xc - R, xc + R, s - 0.05, s + 0.05, -0.35);
    }
  }
}
function wall(o, F, H, d, { portal = false, tower = false } = {}) {
  if (portal) {
    arch(o, F, F.L, H, { radius: tower ? 2.3 : 2.5, spring: tower ? 5.2 : 3.4, closed: tower }, d);
    return;
  }
  if (tower && F.L > 14) {
    arch(o, F, F.L, H, { radius: 1.25, spring: 15.6, base: 9.3, closed: true }, d);
    return;
  }
  const N = Math.max(1, Math.floor(F.L / (tower ? 5 : 3.7))),
    w = tower ? 1.1 : 1.35,
    bottom = tower ? 9.4 : 1.15,
    h = tower ? 5 : 2.6;
  if (d < 2) {
    patch(o, 'stone', F, 0, F.L, 0, H);
    if (F.L > 9)
      for (let i = 0; i < N; i += d === 0 ? 2 : 1)
        patch(
          o,
          'glass',
          F,
          (F.L * (i + 0.5)) / N - w / 2,
          (F.L * (i + 0.5)) / N + w / 2,
          bottom,
          bottom + h,
          0.02,
        );
    return;
  }
  for (let i = 0; i < N; i++) {
    const l = (F.L * i) / N,
      r = (F.L * (i + 1)) / N,
      c = (l + r) / 2,
      low = c - w / 2,
      high = c + w / 2;
    if (F.L < 6) {
      patch(o, 'stone', F, l, r, 0, H);
      continue;
    }
    patch(o, 'stone', F, l, low, 0, H);
    patch(o, 'stone', F, high, r, 0, H);
    patch(o, 'stone', F, low, high, 0, bottom);
    patch(o, 'stone', F, low, high, bottom + h, H);
    patch(o, 'glass', F, low, high, bottom, bottom + h, -0.26);
    if (d > 1) {
      for (const u of [low, high])
        Q(
          o,
          'trim',
          [F.P(u, bottom), F.P(u, bottom + h), F.P(u, bottom + h, -0.27), F.P(u, bottom, -0.27)],
          null,
        );
      for (const y of [bottom, bottom + h])
        Q(o, 'trim', [F.P(low, y), F.P(high, y), F.P(high, y, -0.27), F.P(low, y, -0.27)], null);
      patch(o, 'bronze', F, c - 0.045, c + 0.045, bottom, bottom + h, -0.22);
    }
  }
}
function main(o, d) {
  const tol = [0.8, 0.25, 0.04, 0][d],
    P = simplify(p.outline, tol),
    outer = area(P) > 0 ? P : P.toReversed(),
    back = [
      [-11.2, 14.0],
      [-11.2, 73.0],
      [11.2, 73.0],
      [11.2, 14.0],
    ],
    f = A.mainFloor;
  plane(o, 'base', outer, f + A.mainWallHeight, [p.court], rgb('898f86'));
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      F = face(a, b, f),
      mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      portal = mid[1] > 77 && Math.abs(mid[0]) < 5;
    wall(o, F, A.mainParapet, d, { portal });
    const lowa = australianWarMemorialGround(...a) - 0.3,
      lowb = australianWarMemorialGround(...b) - 0.3;
    Q(
      o,
      'base',
      [
        [a[0], lowa, a[1]],
        [b[0], lowb, b[1]],
        [b[0], f, b[1]],
        [a[0], f, a[1]],
      ],
      F.n,
    );
    if (d > 0) {
      patch(o, 'trim', F, 0, F.L, 7.9, 8.15, 0.06);
      patch(o, 'trim', F, 0, F.L, 9.05, 9.25, 0.06);
    }
  }
  // Back of each cloister is recessed; the open arcade forms its courtyard edge.
  for (let i = 0; i < back.length; i++) {
    const a = back[i],
      b = back[(i + 1) % back.length],
      F = face(a, b, f);
    if (i === 3) continue;
    if (i === 1) {
      arch(o, F, F.L, 8.25, { radius: 2.5, spring: 3.4 }, d);
      continue;
    }
    patch(o, 'stone', F, 0, F.L, 0, 8.25);
    const panelCount = d === 0 ? 6 : 15;
    for (let k = 0; k < panelCount; k++) {
      const c = (F.L * (k + 0.5)) / panelCount;
      patch(o, 'bronze', F, c - 1.35, c + 1.35, 1, 4.5, 0.025);
      if (d > 1)
        for (let j = 0; j < 9; j++)
          patch(
            o,
            'bronze',
            F,
            c - 1.1,
            c + 1.1,
            1.2 + j * 0.34,
            1.23 + j * 0.34,
            0.04,
            rgb('877d57'),
          );
    }
  }
  plane(
    o,
    'trim',
    [
      [-11.2, 25],
      [-11.2, 74],
      [11.2, 74],
      [11.2, 25],
    ],
    f,
  );
  const count = d === 0 ? 8 : A.cloisterArches,
    L = 59 / count;
  for (const side of [-1, 1]) {
    const x = side * 7.76;
    for (let i = 0; i < count; i++) {
      const z0 = 14 + i * L,
        z1 = 14 + (i + 1) * L,
        F = side < 0 ? face([x, z0], [x, z1], f) : face([x, z1], [x, z0], f);
      arch(o, F, L, 8.25, { radius: (L - 0.68) / 2, spring: 3.75 }, d);
      if (d > 0) {
        patch(o, 'trim', F, 0, L, 7.9, 8.45, 0.09);
        if (d > 1) {
          const a = F.P(L * 0.5, 7.4, 0.2);
          box(o, 'trim', a[0], a[1], a[2], 0.38, 0.35, 0.55);
        }
      }
    }
  }
  // Level reflection pool and stepped approach remain intrinsic courtyard geometry.
  box(o, 'trim', 0, f, 46.5, 5.2, 0.28, 30);
  Q(
    o,
    'glass',
    [
      [-2.35, f + 0.295, 31.75],
      [2.35, f + 0.295, 31.75],
      [2.35, f + 0.295, 61.25],
      [-2.35, f + 0.295, 61.25],
    ],
    [0, 1, 0],
    rgb('426b71'),
  );
  const N = d === 0 ? 3 : d === 1 ? 5 : 9;
  for (let i = 0; i < N; i++) {
    const z = 25 - ((i + 0.5) * 11) / N,
      y = f + ((A.hallFloor - f) * (i + 1)) / N;
    box(o, 'trim', 0, f - 0.05, z, 15.45, y - f + 0.05, 11 / N + 0.012);
  }
  const steps = d === 0 ? 3 : d === 1 ? 10 : 20;
  for (let i = 0; i < steps; i++) {
    const z = 78 + ((i + 0.5) * 12) / steps,
      y = f - ((f - A.foyerUpper) * (i + 1)) / steps;
    box(o, 'trim', 0, A.foyerUpper - 0.05, z, 10.1, y - A.foyerUpper + 0.05, 12 / steps + 0.012);
  }
  for (const side of [-1, 1]) {
    box(o, 'stone', side * 6.7, f, 76.5, 2.5, 8.7, 5);
    if (d > 0) box(o, 'trim', side * 6.7, f + 8.7, 76.5, 2.8, 0.3, 5.3);
  }
}
function hall(o, d) {
  const f = A.hallFloor,
    P = simplify(p.tower, [0.65, 0.2, 0.03, 0.025][d]),
    outer = area(P) > 0 ? P : P.toReversed();
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      F = face(a, b, f),
      front = (a[1] + b[1]) / 2 > 13;
    if (front) {
      arch(o, F, F.L, 8.2, { radius: 2.3, spring: 5.2, closed: true }, d);
      arch(
        o,
        face(a, b, f + 8.2),
        F.L,
        A.hallWallTop - 8.2,
        { radius: 1.25, spring: 7.4, base: 1.1, closed: true, glazing: true },
        d,
      );
    } else if (F.L > 14 && Math.abs((a[0] + b[0]) / 2) > 11) {
      wall(o, F, A.hallWallTop, d, { tower: true });
    } else patch(o, 'stone', F, 0, F.L, 0, A.hallWallTop);
    if (d > 0) {
      patch(o, 'trim', F, 0, F.L, 18.7, 19.05, 0.1);
      patch(o, 'trim', F, 0, F.L, 19.45, 19.7, 0.18);
    }
  }
  plane(o, 'trim', outer, f + A.hallWallTop);
  const N = [8, 24, 48, 72][d],
    K = [2, 5, 9, 14][d],
    Pnt = (r, t, y) => [r * Math.cos(t), f + y, r * Math.sin(t)];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N,
      b = (2 * Math.PI * (i + 1)) / N;
    Q(
      o,
      'trim',
      [
        Pnt(A.domeRadius, a, A.hallWallTop),
        Pnt(A.domeRadius, b, A.hallWallTop),
        Pnt(A.domeRadius, b, A.domeSpring),
        Pnt(A.domeRadius, a, A.domeSpring),
      ],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    for (let j = 0; j < K; j++) {
      const t0 = ((j / K) * Math.PI) / 2,
        t1 = (((j + 1) / K) * Math.PI) / 2,
        r0 = A.domeRadius * Math.cos(t0),
        r1 = A.domeRadius * Math.cos(t1),
        y0 = A.domeSpring + (A.domeCap - A.domeSpring) * Math.sin(t0),
        y1 = A.domeSpring + (A.domeCap - A.domeSpring) * Math.sin(t1);
      Q(
        o,
        'roof',
        [Pnt(r0, a, y0), Pnt(r0, b, y0), Pnt(r1, b, y1), Pnt(r1, a, y1)],
        [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
      );
    }
  }
  if (d > 1)
    for (let i = 0; i < 24; i++) {
      const t = (i * Math.PI) / 12,
        w = 0.012;
      for (let j = 0; j < K; j++) {
        const q = ((j / K) * Math.PI) / 2,
          r = (((j + 1) / K) * Math.PI) / 2,
          Qp = (a, t) =>
            Pnt(
              (A.domeRadius + 0.03) * Math.cos(a),
              t,
              A.domeSpring + (A.domeCap - A.domeSpring + 0.03) * Math.sin(a),
            );
        Q(o, 'roof', [Qp(q, t - w), Qp(q, t + w), Qp(r, t + w), Qp(r, t - w)], null, rgb('789185'));
      }
    }
}
function northern(o, d) {
  const P = simplify(p.anzac, [1.1, 0.4, 0.08, 0][d]),
    outer = area(P) > 0 ? P : P.toReversed(),
    f = A.northernFloor,
    roof = (_x, z) =>
      f +
      A.northernRoofFront +
      Math.max(0, Math.min(1, (-z - 20) / 49)) * (A.northernRoofRear - A.northernRoofFront),
    inner = p.anzac.slice(0, 20),
    dist = (x, z) =>
      Math.min(
        ...inner.slice(0, -1).map((a, i) => {
          const b = inner[i + 1],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
          return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
        }),
      );
  const ids = earcut(outer.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => outer[k]),
      x = q.reduce((a, v) => a + v[0], 0) / 3,
      z = q.reduce((a, v) => a + v[1], 0) / 3,
      isLink = dist(x, z) < 8;
    T(
      o,
      isLink ? 'glass' : 'base',
      q.map(([x, z]) => [x, roof(x, z), z]),
      [0, 1, 0],
      isLink ? rgb('809798') : rgb('8b9589'),
    );
  }
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      F = face(a, b),
      ya = roof(...a),
      yb = roof(...b),
      lowA = australianWarMemorialGround(...a) - 0.3,
      lowB = australianWarMemorialGround(...b) - 0.3;
    Q(
      o,
      'base',
      [
        [a[0], lowA, a[1]],
        [b[0], lowB, b[1]],
        [b[0], f, b[1]],
        [a[0], f, a[1]],
      ],
      F.n,
    );
    Q(
      o,
      'glass',
      [
        [a[0], f, a[1]],
        [b[0], f, b[1]],
        [b[0], yb - 0.3, b[1]],
        [a[0], ya - 0.3, a[1]],
      ],
      F.n,
      rgb('4a6260'),
    );
    Q(
      o,
      'trim',
      [
        [a[0], ya - 0.3, a[1]],
        [b[0], yb - 0.3, b[1]],
        [b[0], yb, b[1]],
        [a[0], ya, a[1]],
      ],
      F.n,
      rgb('b5b7a7'),
    );
    if (d > 0) {
      const N = Math.max(1, Math.ceil(F.L / (d === 1 ? 10 : 4)));
      for (let j = 0; j < N; j++) {
        const t = (j + 0.5) / N,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        box(o, 'bronze', x, f, z, 0.12, roof(x, z) - f, 0.12);
      }
    }
  }
  // A translucent band follows the real semicircular inner boundary, without a copied roof render.
  if (d > 0)
    for (let i = 0; i < inner.length - 1; i++) {
      const a = inner[i],
        b = inner[i + 1];
      Q(
        o,
        'glass',
        [
          [a[0], roof(...a) + 0.025, a[1]],
          [b[0], roof(...b) + 0.025, b[1]],
          [b[0], roof(b[0], b[1] - 5) + 0.025, b[1] - 5],
          [a[0], roof(a[0], a[1] - 5) + 0.025, a[1] - 5],
        ],
        [0, 1, 0],
        rgb('91a7a6'),
      );
    }
}
function southern(o, d) {
  const O = A.southernOculus,
    N = [12, 24, 48, 72][d],
    circle = Array.from({ length: N }, (_, i) => [
      O.x + O.radius * Math.cos((i * 2 * Math.PI) / N),
      O.z + O.radius * Math.sin((i * 2 * Math.PI) / N),
    ]),
    P = simplify(p.southern, [0.6, 0.2, 0.03, 0][d]),
    outer = area(P) > 0 ? P : P.toReversed(),
    f = A.foyerLower,
    Y = A.foyerUpper;
  plane(o, 'trim', outer, Y, [circle], rgb('c0bca7'));
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      F = face(a, b, f),
      mid = (a[1] + b[1]) / 2;
    if (mid < 78) continue;
    if (
      Math.abs(a[0]) > 25 &&
      Math.abs(b[0]) > 25 &&
      Math.abs(b[1] - a[1]) > 8 &&
      Math.min(a[1], b[1]) <= 110 &&
      Math.max(a[1], b[1]) >= 118
    ) {
      const cuts = [110, 118].map((z) => ((z - a[1]) / (b[1] - a[1])) * F.L).sort((a, b) => a - b);
      patch(o, 'glass', F, 0, cuts[0], 0, Y - f - 0.4);
      patch(o, 'glass', F, cuts[1], F.L, 0, Y - f - 0.4);
    } else patch(o, 'glass', F, 0, F.L, 0, Y - f - 0.4);
    Q(
      o,
      'trim',
      [
        [a[0], Y - 0.4, a[1]],
        [b[0], Y - 0.4, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      F.n,
    );
    if (d > 0) {
      for (let j = 0; j < Math.ceil(F.L / (d === 1 ? 7 : 3.5)); j++) {
        const t = (j + 0.5) / Math.ceil(F.L / (d === 1 ? 7 : 3.5)),
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        if (z < 110 || z > 118) box(o, 'stone', x, f, z, 0.3, Y - f, 0.3);
      }
    }
  }
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N,
      pt = (r, t, h) => [O.x + r * Math.cos(t), h, O.z + r * Math.sin(t)];
    Q(
      o,
      'bronze',
      [
        pt(O.radius - 0.12, a, Y + O.rise),
        pt(O.radius + 0.12, a, Y + O.rise),
        pt(O.radius + 0.12, b, Y + O.rise),
        pt(O.radius - 0.12, b, Y + O.rise),
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'glass',
      [
        pt(O.radius, a, Y),
        pt(O.radius, b, Y),
        pt(O.radius, b, Y + O.rise),
        pt(O.radius, a, Y + O.rise),
      ],
      null,
      rgb('6c8b8e'),
    );
    const K = d === 0 ? 1 : 4;
    for (let j = 0; j < K; j++) {
      const r0 = (O.radius * j) / K,
        r1 = (O.radius * (j + 1)) / K,
        yp = (r) => Y - 0.7 + (O.rise + 0.7) * (r / O.radius) * (r / O.radius);
      Q(
        o,
        'glass',
        [pt(r0, a, yp(r0)), pt(r1, a, yp(r1)), pt(r1, b, yp(r1)), pt(r0, b, yp(r0))],
        [0, 1, 0],
        rgb('65858b'),
      );
    }
  }
  // Two recessed side entries below the forecourt are genuine open porches.
  for (const side of [-1, 1]) {
    const doorX = side * 26.3;
    Q(
      o,
      'bronze',
      [
        [doorX, f, 111],
        [doorX, f, 117],
        [doorX, Y - 0.55, 117],
        [doorX, Y - 0.55, 111],
      ],
      [side, 0, 0],
    );
    if (d > 0) {
      const x = side * 28.1,
        z = 114;
      box(o, 'trim', x, f, z, 4, 0.18, 8);
      box(o, 'trim', x, Y - 0.45, z, 4, 0.3, 8);
      for (const zz of [110.25, 117.75]) box(o, 'stone', x + side * 1.6, f, zz, 0.32, Y - f, 0.32);
    }
  }
}
function build(o, _f, d = 3) {
  main(o, d);
  hall(o, d);
  northern(o, d);
  southern(o, d);
}
export const australianWarMemorialSkyline = (o, f) => build(o, f, 0),
  australianWarMemorialDistrict = (o, f) => build(o, f, 1),
  australianWarMemorialStreet = (o, f) => build(o, f, 2),
  australianWarMemorialCloseup = (o, f) => build(o, f, 3);
export const australianWarMemorialModel = {
  id: 'australian_war_memorial',
  key: 'australian_war_memorial',
  cell: 'r3/r3d',
  recipe: 'structure-australian-war-memorial.mjs',
  title: 'Australian War Memorial',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [139, 111, 197],
  lookAt: [0, 15, 24],
  mediumFiContext: { scale: 1.22 },
  qaCameras: [
    {
      name: 'whole-current-memorial-and-both-connected-extensions',
      position: [139, 111, 197],
      lookAt: [0, 15, 24],
      reviewLod: 'skyline',
    },
    {
      name: 'open-cloisters-reflection-pool-and-hall-copper-dome',
      position: [0, 23, 70],
      lookAt: [0, 22, 5],
    },
    {
      name: 'hall-stepped-buttresses-arched-lights-and-copper-seams',
      position: [-40, 36, -3],
      lookAt: [0, 30, 0],
    },
    {
      name: 'northern-semicircular-anzac-hall-and-translucent-link',
      position: [82, 63, -106],
      lookAt: [0, 19, -39],
    },
    {
      name: 'southern-forecourt-inverted-glass-oculus-and-entry-porches',
      position: [62, 31, 145],
      lookAt: [0, 6, 103],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-australian-war-memorial.mjs',
    level: 'skyline',
    export: 'australianWarMemorialSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'australianWarMemorialDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'australianWarMemorialStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'australianWarMemorialCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole connected native2026 main memorial/court/tower/dome plus northern semicircular hall/link extent and southern underground-entrance roof/forecourt. No campus office/BeanResearchCentre/cafe/carpark, sculpture garden, independent monuments, interiors, people, inscriptions or copied artwork. Main horizontal outline and current added volumes are not replaced by a generic narrow facade model.',
    'One exact published2006 creator-PD courtyard-edge image and two explicitly expired primary1946 KeithBenjaminDavis archive renditions were inspected. Both old exterior images show nearly the same west/north-west composition, not independent all-side coverage. They control older stone/gallery/tower/dome character only. Primary textual descriptions/current native geometry control modern additions; exact Anzac Hall roof/link partition, foyer/oculus position and section, bay/window census, wall/roof heights and fine finishes are bounded medium-fi estimates. No modern copyrighted gallery/architect pixels, CC/BSD imagery, questionable third-party public-domain-photo archive, DVIDS pixels, photographic textures, generated images or borrowed meshes used.',
    'Cloister passages and commemorative entrance arch remain genuine voids, with recessed bronze Roll of Honour panels without copied names. Twin side porches and southern circular skylight are geometric structures. The apparent native glass/3m tag on the Hall dome is superseded by primary copper-cladding and24m interior-height evidence; exterior cap26m is explicitly estimated. Lower foyer and slab elevations/contact/excavation remain approximate, original16641 terrain values/PNG/four raw tiles unchanged and replacement disabled.',
    'Four LODs preserve the full T galleries/open court/stepped Hall/copper dome, real cloister arch voids, north semicircular mass and south forecourt/oculus. Skyline simplifies minor native spurs and arcade census; near views restore15 bays per side, reveals, bronze panel divisions, dome seams, cornices and glazing frames. Six actual canonical surface slots, five shared graphs and local glazing. Reflection pool is an opaque original color approximation, not simulated water.',
  ],
};
