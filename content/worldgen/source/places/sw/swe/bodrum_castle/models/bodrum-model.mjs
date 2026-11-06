/** Original Bodrum fortress exterior. Meters,+Y up;+X ESE,+Z SSW. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const bodrumControls = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const a = bodrumControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('c6c0ad'),
  trim: lin('d5ccba'),
  ground: lin('aaa595'),
  roof: lin('a6654e'),
  metal: lin('444845'),
  glass: lin('4d6178'),
  pale: lin('ded5c1'),
};
export const bodrumSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.3, metallic: 0.1 },
};
const configs = {
  skyline: { far: true, sides: 4, arch: 1, spacing: 50 },
  district: { sides: 10, arch: 3, spacing: 18, merlons: true, openings: true },
  street: {
    sides: 12,
    arch: 4,
    spacing: 6.5,
    merlons: true,
    openings: true,
    frames: true,
    bands: true,
    steps: true,
  },
  closeup: {
    sides: 24,
    arch: 8,
    spacing: 3.3,
    merlons: true,
    openings: true,
    frames: true,
    bands: true,
    steps: true,
    corbels: true,
    rails: true,
  },
  master: {
    sides: 40,
    arch: 12,
    spacing: 3.1,
    merlons: true,
    openings: true,
    frames: true,
    bands: true,
    steps: true,
    corbels: true,
    rails: true,
    quoins: true,
    roofTiles: true,
  },
};
export function bodrumGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  open = (r) => (r[0].every((v, i) => v === r.at(-1)[i]) ? r.slice(0, -1) : r),
  cw = (r) => (area(open(r)) < 0 ? open(r) : open(r).toReversed());
function tri(o, c, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    color,
  );
}
function quad(o, c, s, p, color, n) {
  tri(o, c, s, p.slice(0, 3), color, n);
  tri(o, c, s, [p[0], p[2], p[3]], color, n);
}
function cap(o, c, rings, y, s = 'wall', color = C.wall, up = 1) {
  let count = rings[0].length;
  const holes = [];
  for (const r of rings.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const ps = rings.flat(),
    ids = earcut(ps.flat(), holes);
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      c,
      s,
      ids
        .slice(i, i + 3)
        .map((i) => [ps[i][0], typeof y === 'function' ? y(...ps[i]) : y, ps[i][1]]),
      color,
      [0, up, 0],
    );
}
const face = (p, q) => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
      t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    return { p, q, L, t, n: [-t[1], t[0]] };
  },
  P = (f, u, y, d = 0) => [f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d],
  Y = (y, p) => (typeof y === 'function' ? y(...p) : y);
function panel(o, c, f, u0, u1, y0, y1, d = 0, s = 'wall', color = C.wall) {
  if (u1 - u0 < 1e-5 || y1 - y0 < 1e-5) return;
  quad(o, c, s, [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
const B = (o, c, p, q, w, color = C.trim, s = 'trim', depth = w) =>
  beam(o, S(c, s), p, q, w, depth, color);
function box(o, c, s, p, size, color) {
  boundsBox(
    o,
    S(c, s),
    p.map((v, i) => v - size[i] / 2),
    p.map((v, i) => v + size[i] / 2),
    color,
  );
}
function shell(o, c, ring, y0, y1, s = 'wall', color = C.wall, top = true, inside = false) {
  const r = inside ? cw(ring).toReversed() : cw(ring);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      f = face(p, q);
    quad(
      o,
      c,
      s,
      [
        [p[0], Y(y0, p), p[1]],
        [q[0], Y(y0, q), q[1]],
        [q[0], Y(y1, q), q[1]],
        [p[0], Y(y1, p), p[1]],
      ],
      color,
      [f.n[0], 0, f.n[1]],
    );
  }
  if (top) cap(o, c, [r], y1, s, color);
}
function offset(r, d) {
  r = cw(r);
  return r.map((p, i) => {
    const prev = face(r[(i + r.length - 1) % r.length], p),
      next = face(p, r[(i + 1) % r.length]),
      n = [prev.n[0] + next.n[0], prev.n[1] + next.n[1]],
      dot = n[0] * next.n[0] + n[1] * next.n[1],
      k = Math.abs(dot) > 0.15 ? d / dot : d;
    return [p[0] + n[0] * k, p[1] + n[1] * k];
  });
}
function scaled(r, k) {
  r = cw(r);
  const m = r.reduce((s, p) => s.map((v, i) => v + p[i] / r.length), [0, 0]);
  return r.map((p) => p.map((v, i) => m[i] + (v - m[i]) * k));
}
function ringLoft(o, c, r, y0, y1, k0 = 1, k1 = 1, s = 'wall', color = C.wall) {
  loft(
    o,
    S(c, s),
    [scaled(r, k0).map(([x, z]) => [x, y0, z]), scaled(r, k1).map(([x, z]) => [x, y1, z])],
    color,
  );
}
function cylinder(o, c, center, y0, y1, r0, r1, s = 'trim', color = C.trim) {
  loft(
    o,
    S(c, s),
    [
      radialRing(y0, r0, r0, c.far ? 3 : c.sides, center),
      radialRing(y1, r1, r1, c.far ? 3 : c.sides, center),
    ],
    color,
  );
}
function gateProjection(k, p) {
  const d = p.map((v, i) => v - k.center[i]),
    t = k.axis,
    n = [-t[1], t[0]];
  return { u: d[0] * t[0] + d[1] * t[1], v: d[0] * n[0] + d[1] * n[1] };
}
function gateInterval(f, k) {
  const n = [-k.axis[1], k.axis[0]],
    p = gateProjection(k, f.p),
    du = f.t[0] * k.axis[0] + f.t[1] * k.axis[1],
    dv = f.t[0] * n[0] + f.t[1] * n[1];
  let lo = 0,
    hi = f.L;
  for (const [v, t, r] of [
    [p.u, du, k.halfLength],
    [p.v, dv, k.radius],
  ]) {
    if (Math.abs(t) < 1e-8) {
      if (Math.abs(v) > r) return null;
    } else {
      const l = (-r - v) / t,
        h = (r - v) / t;
      lo = Math.max(lo, Math.min(l, h));
      hi = Math.min(hi, Math.max(l, h));
    }
  }
  return hi - lo > 1e-5 ? [lo, hi] : null;
}
const gateHead = (k, v) => k.spring + Math.sqrt(Math.max(0, k.radius * k.radius - v * v));
function cutFace(o, c, f, y0, y1, gates, s = 'wall', color = C.wall) {
  const ranges = gates.map((k) => ({ k, r: gateInterval(f, k) })).filter((p) => p.r),
    cuts = [0, f.L, ...ranges.flatMap((p) => p.r)]
      .sort((a, b) => a - b)
      .filter((v, i, r) => !i || v - r[i - 1] > 1e-5);
  for (let i = 1; i < cuts.length; i++) {
    const l = cuts[i - 1],
      r = cuts[i],
      mid = (l + r) / 2,
      gate = ranges.find((p) => mid > p.r[0] - 1e-5 && mid < p.r[1] + 1e-5)?.k;
    if (!gate) {
      quad(
        o,
        c,
        s,
        [
          P(
            f,
            l,
            Y(
              y0,
              P(f, l, 0).filter((_, i) => i !== 1),
            ),
          ),
          P(f, r, Y(y0, [P(f, r, 0)[0], P(f, r, 0)[2]])),
          P(f, r, Y(y1, [P(f, r, 0)[0], P(f, r, 0)[2]])),
          P(f, l, Y(y1, [P(f, l, 0)[0], P(f, l, 0)[2]])),
        ],
        color,
        [f.n[0], 0, f.n[1]],
      );
      continue;
    }
    const floor = gate.floor;
    panel(o, c, f, l, r, Math.min(Y(y0, f.p), Y(y0, f.q)), floor, 0, s, color);
    const N = c.arch;
    for (let j = 0; j < N; j++) {
      const u = l + ((r - l) * j) / N,
        v = l + ((r - l) * (j + 1)) / N,
        p = P(f, u, 0),
        q = P(f, v, 0),
        h0 = gateHead(gate, gateProjection(gate, [p[0], p[2]]).v),
        h1 = gateHead(gate, gateProjection(gate, [q[0], q[2]]).v);
      quad(
        o,
        c,
        s,
        [P(f, u, h0), P(f, v, h1), P(f, v, Y(y1, [q[0], q[2]])), P(f, u, Y(y1, [p[0], p[2]]))],
        color,
        [f.n[0], 0, f.n[1]],
      );
    }
  }
}
function gateBarrel(o, c, k) {
  const half = k.barrelHalfLength ?? k.halfLength,
    t = k.axis,
    n = [-t[1], t[0]],
    p = (u, v, y) => [k.center[0] + t[0] * u + n[0] * v, y, k.center[1] + t[1] * u + n[1] * v],
    N = c.arch * 2;
  for (let j = 0; j < N; j++) {
    const t0 = (Math.PI * j) / N,
      t1 = (Math.PI * (j + 1)) / N,
      v0 = -k.radius * Math.cos(t0),
      v1 = -k.radius * Math.cos(t1),
      y0 = k.spring + k.radius * Math.sin(t0),
      y1 = k.spring + k.radius * Math.sin(t1);
    quad(
      o,
      c,
      'trim',
      [p(-half, v0, y0), p(half, v0, y0), p(half, v1, y1), p(-half, v1, y1)],
      C.trim,
      [0, -1, 0],
    );
  }
  for (const v of [-k.radius, k.radius])
    quad(
      o,
      c,
      'trim',
      [p(-half, v, k.floor), p(half, v, k.floor), p(half, v, k.spring), p(-half, v, k.spring)],
      C.trim,
    );
  const pr = [
    p(-k.halfLength, -k.radius, 0),
    p(k.halfLength, -k.radius, 0),
    p(k.halfLength, k.radius, 0),
    p(-k.halfLength, k.radius, 0),
  ].map(([x, , z]) => [x, z]);
  shell(o, c, pr, (x, z) => bodrumGroundY(x, z) - 0.3, k.floor - 0.05, 'ground', C.ground);
}
function crenels(o, c, r, y, spacing = 3.2, h = 1.2, w = 1, closed = true) {
  r = closed ? cw(r) : r;
  for (let i = 0; i < r.length - (closed ? 0 : 1); i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      N = Math.max(1, Math.floor(f.L / spacing));
    for (let j = 0; j < N; j++) {
      const u = ((j + 0.5) * f.L) / N,
        lo = Math.max(0, u - w / 2),
        hi = Math.min(f.L, u + w / 2),
        p = P(f, lo, Y(y, [P(f, u, 0)[0], P(f, u, 0)[2]]) - 0.03, 0),
        q = P(f, hi, Y(y, [P(f, u, 0)[0], P(f, u, 0)[2]]) - 0.03, 0);
      const pr = [
        [p[0], p[2]],
        [q[0], q[2]],
        [q[0] - f.n[0] * 0.75, q[2] - f.n[1] * 0.75],
        [p[0] - f.n[0] * 0.75, p[2] - f.n[1] * 0.75],
      ];
      shell(o, c, pr, p[1], p[1] + h, 'wall');
      if (c.corbels) {
        B(o, c, P(f, lo, p[1] + h - 0.1), P(f, hi, p[1] + h - 0.1), 0.18, C.trim);
      }
    }
  }
}
function curtain(o, c) {
  const r = cw(a.outline),
    inner = offset(r, -2.6),
    crest = (x, z) => 7.8 + ((z + 87) / 174) * 4.7;
  for (const wall of [r, inner.toReversed()])
    for (let i = 0; i < wall.length; i++)
      cutFace(
        o,
        c,
        face(wall[i], wall[(i + 1) % wall.length]),
        (x, z) => bodrumGroundY(x, z) - 0.5,
        crest,
        a.gates.filter((k) => k.target === 'outer'),
      );
  cap(o, c, [r, inner], crest);
  if (c.merlons) crenels(o, c, r, crest, c.spacing, 1.2, 1.2);
  const ir = cw(parts[24].polygons[0][0]);
  for (let i = 0; i < ir.length; i++)
    cutFace(
      o,
      c,
      face(ir[i], ir[(i + 1) % ir.length]),
      (x, z) => bodrumGroundY(x, z) - 0.5,
      15,
      a.gates.filter((k) => k.target === 'inner'),
    );
  cap(o, c, [ir], 15);
  if (c.merlons) {
    const path = [
      [-62.7, 65.8],
      [-51.5, -33],
      [-7.4, -28.4],
      [-2.5, -46],
      [8.1, -54.8],
      [60.2, -52.3],
    ];
    crenels(o, c, path, 15, c.spacing * 1.3, 0.9, 0.9, false);
  }
}
function frameBeam(o, c, f, p, q, w) {
  if (c.corbels) {
    B(o, c, P(f, ...p, 0.05), P(f, ...q, 0.05), w, C.trim);
    return;
  }
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
    u = (-(q[1] - p[1]) * w) / (2 * L),
    v = ((q[0] - p[0]) * w) / (2 * L);
  quad(
    o,
    c,
    'trim',
    [
      P(f, p[0] + u, p[1] + v, 0.04),
      P(f, q[0] + u, q[1] + v, 0.04),
      P(f, q[0] - u, q[1] - v, 0.04),
      P(f, p[0] - u, p[1] - v, 0.04),
    ],
    C.trim,
    [f.n[0], 0, f.n[1]],
  );
}
function opening(
  o,
  c,
  f,
  u,
  w,
  b,
  t,
  { arch = true, pointed = false, door = false, surfaceDepth } = {},
) {
  const l = u - w / 2,
    r = u + w / 2,
    spring = arch ? t - (pointed ? w * 0.8 : w * 0.5) : t,
    N = arch ? c.arch * 2 : 1,
    depth = surfaceDepth ?? (door ? 0.02 : -0.22);
  for (let j = 0; j < N; j++) {
    const x = l + (w * j) / N,
      q = l + (w * (j + 1)) / N,
      head = (v) =>
        arch
          ? spring +
            (pointed
              ? w * 0.8 * (1 - Math.abs((v - u) / (w / 2)))
              : Math.sqrt(Math.max(0, (w / 2) ** 2 - (v - u) ** 2)))
          : t,
      h0 = head(x),
      h1 = head(q);
    if (Math.min(h0, h1) <= b) continue;
    const p = [P(f, x, b, depth), P(f, q, b, depth), P(f, q, h1, depth), P(f, x, h0, depth)];
    o.addQuad(
      door ? S(c, 'metal') : S(c, 'glass'),
      'metric:uv',
      p,
      [f.n[0], 0, f.n[1]],
      [
        [j / N, 0],
        [(j + 1) / N, 0],
        [(j + 1) / N, (h1 - b) / w],
        [j / N, (h0 - b) / w],
      ],
      door ? C.metal : C.glass,
    );
    if (c.frames) frameBeam(o, c, f, [x, h0], [q, h1], 0.2);
  }
  if (c.frames) {
    for (const x of [l, r]) frameBeam(o, c, f, [x, b], [x, spring], 0.22);
    frameBeam(o, c, f, [l - 0.16, b - 0.06], [r + 0.16, b - 0.06], 0.22);
  }
  if (c.rails) {
    for (let x = l + 0.18; x < r; x += 0.32)
      B(o, c, P(f, x, b + 0.05, -0.15), P(f, x, spring, -0.15), 0.045, C.metal, 'metal');
  }
}
function towerFacade(o, c, r, y0, y1, { chapel = false } = {}) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    if (!c.openings || f.L < 3) {
      panel(o, c, f, 0, f.L, y0, y1);
      continue;
    }
    const levels = chapel
        ? [[y0 + 1.1, y0 + 4.4]]
        : [
            [y0 + 1, y0 + 3.3],
            [y1 - 7, y1 - 4.4],
          ],
      w = chapel ? 1.1 : Math.min(1.15, f.L * 0.16),
      N = chapel ? Math.max(1, Math.floor(f.L / 4.8)) : 1;
    for (let j = 0; j < N; j++) {
      const lo = (j * f.L) / N,
        hi = ((j + 1) * f.L) / N,
        u = (lo + hi) / 2,
        l = u - w / 2,
        q = u + w / 2;
      panel(o, c, f, lo, l, y0, y1);
      panel(o, c, f, q, hi, y0, y1);
      let last = y0;
      for (const [b, t] of levels) {
        panel(o, c, f, l, q, last, b);
        const spring = t - (chapel ? w * 0.8 : w * 0.5),
          steps = c.arch * 2;
        for (let k = 0; k < steps; k++) {
          const u0 = l + (w * k) / steps,
            u1 = l + (w * (k + 1)) / steps,
            head = (x) =>
              spring +
              (chapel
                ? w * 0.8 * (1 - Math.abs((x - u) / (w / 2)))
                : Math.sqrt(Math.max(0, (w / 2) ** 2 - (x - u) ** 2)));
          quad(
            o,
            c,
            'wall',
            [P(f, u0, head(u0)), P(f, u1, head(u1)), P(f, u1, t), P(f, u0, t)],
            C.wall,
            [f.n[0], 0, f.n[1]],
          );
        }
        opening(o, c, f, u, w, b, t, { pointed: chapel });
        last = t;
      }
      panel(o, c, f, l, q, last, y1);
    }
    if (c.quoins) {
      for (let y = y0 + 0.5; y < y1 - 0.5; y += 0.8) {
        const w = 0.8 + (Math.round(y / 0.8) % 2) * 0.35;
        panel(o, c, f, 0, w, y, y + 0.65, 0.035, 'trim', C.trim);
        panel(o, c, f, f.L - w, f.L, y, y + 0.65, 0.035, 'trim', C.trim);
      }
    }
  }
}
function principalTower(o, c, name, index) {
  const r = cw(parts[index].polygons[0][0]),
    l = a.levels[name],
    inner = offset(r, -0.85);
  if (c.far) {
    shell(o, c, r, (x, z) => bodrumGroundY(x, z) - 0.5, l.parapet);
    for (const p of r)
      box(
        o,
        c,
        'wall',
        [p[0], (l.parapet + l.top) / 2, p[1]],
        [0.8, l.top - l.parapet, 0.8],
        C.wall,
      );
    if (name === 'italian') shell(o, c, scaled(r, 0.37), l.parapet, l.roofHouseTop);
    return;
  }
  shell(o, c, r, (x, z) => bodrumGroundY(x, z) - 0.5, l.floor, 'ground', C.ground);
  towerFacade(o, c, r, l.floor, l.deck);
  cap(o, c, [r], l.deck, 'ground', C.ground);
  for (const [i, wall] of [r, inner].entries())
    shell(o, c, wall, l.deck, l.parapet, 'wall', C.wall, false, !!i);
  cap(o, c, [r, inner], l.parapet);
  if (c.merlons)
    crenels(
      o,
      c,
      r,
      l.parapet,
      c.far ? 20 : Math.max(2.6, c.spacing * 0.7),
      l.top - l.parapet,
      0.9,
    );
  else {
    for (const p of r)
      box(
        o,
        c,
        'wall',
        [p[0], (l.parapet + l.top) / 2, p[1]],
        [0.8, l.top - l.parapet, 0.8],
        C.wall,
      );
  }
  if (c.bands) {
    const lip = offset(r, 0.25);
    ringLoft(o, c, lip, l.deck - 0.5, l.deck, 1, 1, 'trim');
    if (c.corbels)
      for (let i = 0; i < r.length; i++) {
        const f = face(r[i], r[(i + 1) % r.length]);
        for (let u = 0.6; u < f.L; u += 1.15) {
          const p = P(f, u, l.deck - 0.7, 0.14);
          box(o, c, 'trim', p, [0.28, 0.8, 0.35], C.trim);
        }
      }
  }
  if (name === 'italian') {
    const center = r.reduce((s, p) => s.map((v, i) => v + p[i] / r.length), [0, 0]);
    const house = scaled(r, 0.37).map((p) => [p[0] + 1, p[1] - 0.8]);
    shell(o, c, house, l.deck, l.roofHouseTop);
    cap(o, c, [offset(house, 0.18)], l.roofHouseTop + 0.05, 'trim', C.trim);
    if (c.openings) {
      const f = face(house[0], house[1]);
      opening(o, c, f, f.L / 2, 0.7, l.deck + 0.6, l.deck + 2.2, { door: true, arch: false });
    }
    void center;
  }
  if (name === 'french') {
    const p = r[0],
      center = [p[0] - 0.25, p[1] - 0.25];
    cylinder(o, c, center, l.deck - 4, l.deck - 0.8, 0.45, 1);
    cylinder(o, c, center, l.deck - 0.8, l.parapet, 1, 1);
    if (c.merlons)
      for (let j = 0; j < 4; j++) {
        const t = (j * Math.PI) / 2;
        box(
          o,
          c,
          'wall',
          [center[0] + 0.75 * Math.cos(t), l.top - 0.4, center[1] + 0.75 * Math.sin(t)],
          [0.5, 0.8, 0.5],
          C.wall,
        );
      }
  }
}
function roundAndD(o, c) {
  const center = [10.365, -26.925],
    l = a.levels.round,
    n = c.sides,
    r = radialRing(0, 5.35, 5.35, n, center).map(([x, , z]) => [x, z]);
  shell(o, c, scaled(r, 1.35), (x, z) => bodrumGroundY(x, z) - 0.5, 11, 'wall');
  ringLoft(o, c, r, 11, 14.2, 1.35, 1);
  shell(o, c, r, 14.2, l.deck);
  cap(o, c, [r], l.deck, 'ground', C.ground);
  const inner = scaled(r, 0.85);
  shell(o, c, r, l.deck, l.parapet, 'wall', C.wall, false);
  shell(o, c, inner, l.deck, l.parapet, 'wall', C.wall, false, true);
  cap(o, c, [r, inner], l.parapet);
  if (c.merlons) {
    // Space teeth around the circumference, independently of tessellation density.
    const count = Math.max(5, Math.round((Math.PI * 10.7) / c.spacing));
    for (let j = 0; j < count; j++) {
      const angle = (j * Math.PI * 2) / count,
        n = [Math.cos(angle), Math.sin(angle)],
        t = [-n[1], n[0]],
        p = [center[0] + n[0] * 5.05, center[1] + n[1] * 5.05],
        tooth = [
          [-0.5, -0.4],
          [0.5, -0.4],
          [0.5, 0.4],
          [-0.5, 0.4],
        ].map(([u, v]) => [p[0] + t[0] * u + n[0] * v, p[1] + t[1] * u + n[1] * v]);
      shell(o, c, tooth, l.parapet - 0.04, l.top);
    }
  }
  if (c.openings)
    for (const j of [1, Math.floor(n / 2), n - 2]) {
      const f = face(r[j], r[(j + 1) % n]);
      opening(o, c, f, f.L / 2, 0.48, 16, 17.8, { arch: false, surfaceDepth: 0.015 });
    }
  const d = cw(parts[25].polygons[0][0]),
    dl = a.levels.dShape;
  shell(o, c, d, (x, z) => bodrumGroundY(x, z) - 0.5, dl.deck);
  cap(o, c, [d], dl.deck, 'ground', C.ground);
  const di = offset(d, -0.55);
  shell(o, c, d, dl.deck, dl.parapet, 'wall', C.wall, false);
  shell(o, c, di, dl.deck, dl.parapet, 'wall', C.wall, false, true);
  cap(o, c, [d, di], dl.parapet);
  if (c.openings) {
    const f = face(d[0], d[1]);
    opening(o, c, f, f.L * 0.5, 0.6, 16, 18, { arch: false, surfaceDepth: 0.015 });
  }
}
function chapel(o, c) {
  const r = cw(parts[7].polygons[0][0]),
    l = a.levels.chapel;
  shell(o, c, r, (x, z) => bodrumGroundY(x, z) - 0.5, l.floor, 'ground', C.ground);
  towerFacade(o, c, r, l.floor, l.eaves, { chapel: true });
  cap(o, c, [r], l.eaves, 'ground', C.ground);
  // A long-X pitched roof; west gable receives the mapped chapel approach.
  const p0 = [-36, l.eaves, 50.8],
    p1 = [-21.8, l.eaves, 50.5],
    p2 = [-21.5, l.eaves, 61],
    p3 = [-35.9, l.eaves, 61.3],
    r0 = [-36, l.ridge, 56.05],
    r1 = [-21.65, l.ridge, 55.75];
  quad(o, c, 'roof', [p0, p1, r1, r0], C.roof, [0, 1, -1]);
  quad(o, c, 'roof', [r0, r1, p2, p3], C.roof, [0, 1, 1]);
  tri(o, c, 'wall', [p0, r0, p3], C.wall, [-1, 0, 0]);
  tri(o, c, 'wall', [p1, p2, r1], C.wall, [1, 0, 0]);
  if (c.frames) {
    B(o, c, p0, r0, 0.23);
    B(o, c, r0, p3, 0.23);
    B(o, c, p1, r1, 0.23);
    B(o, c, r1, p2, 0.23);
    B(o, c, r0, r1, 0.22, C.roof, 'roof');
  }
  if (c.roofTiles)
    for (let x = -35.8; x < -21.8; x += 0.55) {
      const t = (x + 36) / 14.35,
        rz = 56.05 - 0.3 * t;
      for (const sign of [-1, 1])
        B(
          o,
          c,
          [x, l.ridge + 0.035, rz],
          [x, l.eaves + 0.035, rz + sign * 5.25],
          0.075,
          C.roof,
          'roof',
        );
    }
  if (c.openings) {
    const f = face([-35.9, 61.3], [-36, 50.8]);
    opening(o, c, f, 5.2, 1.4, l.floor, l.floor + 3.8, { pointed: true, door: true });
    opening(o, c, f, 5.2, 0.9, 14.7, 17.2, { pointed: true, surfaceDepth: 0.02 });
  }
  const m = a.levels.minaret;
  box(o, c, 'trim', [...m.center.slice(0, 1), 9.5, m.center[1]], [2.5, 4, 2.5], C.pale);
  cylinder(o, c, m.center, 11.5, 12.5, 1.25, 0.85, 'trim', C.pale);
  cylinder(o, c, m.center, 12.5, 24.1, 0.78, 0.7, 'trim', C.pale);
  cylinder(o, c, m.center, 24.1, 24.7, 0.72, 1.35, 'trim', C.pale);
  cylinder(o, c, m.center, 24.7, 25.1, 1.35, 1.35, 'trim', C.pale);
  cylinder(o, c, m.center, 25.1, 30.5, 0.65, 0.6, 'trim', C.pale);
  cylinder(o, c, m.center, 30.5, 33, 0.66, 0.05, 'metal', C.metal);
  cylinder(o, c, m.center, 33, 33.5, 0.06, 0.035, 'metal', C.metal);
  if (c.rails) {
    for (let j = 0; j < c.sides; j++) {
      const t = (j * Math.PI * 2) / c.sides;
      B(
        o,
        c,
        [m.center[0] + 1.2 * Math.cos(t), 25.1, m.center[1] + 1.2 * Math.sin(t)],
        [m.center[0] + 1.2 * Math.cos(t), 26, m.center[1] + 1.2 * Math.sin(t)],
        0.08,
        C.pale,
      );
    }
    cylinder(o, c, m.center, 25.95, 26.1, 1.3, 1.3, 'trim', C.pale);
  }
}
function lowRanges(o, c) {
  for (const item of a.ranges) {
    const r = cw(parts[item.part].polygons[0][0]),
      gates = a.gates.filter((k) => k.target === 'range' && item.part === 23);
    for (let i = 0; i < r.length; i++)
      cutFace(
        o,
        c,
        face(r[i], r[(i + 1) % r.length]),
        (x, z) => bodrumGroundY(x, z) - 0.5,
        item.roof,
        gates,
      );
    cap(o, c, [r], item.roof, 'ground', C.ground);
    if (c.bands) {
      for (let i = 0; i < r.length; i++) {
        const f = face(r[i], r[(i + 1) % r.length]);
        B(o, c, P(f, 0, item.roof, 0.08), P(f, f.L, item.roof, 0.08), 0.24, C.trim);
      }
    }
    if (c.openings && item.part !== 16 && item.part !== 23)
      for (let i = 0; i < r.length; i++) {
        const f = face(r[i], r[(i + 1) % r.length]),
          N = Math.max(1, Math.floor(f.L / (c.frames ? 5 : 15)));
        for (let j = 0; j < N; j++)
          opening(o, c, f, ((j + 0.5) * f.L) / N, 0.65, item.roof - 2.8, item.roof - 1.2, {
            arch: false,
            surfaceDepth: 0.015,
          });
      }
  }
  const b = a.levels.bath,
    N = c.far ? 3 : c.arch + 2,
    rings = Array.from({ length: N + 1 }, (_, i) => {
      const t = ((i / N) * Math.PI) / 2,
        R = Math.max(0.05, b.radius * Math.cos(t));
      return radialRing(b.base + b.height * Math.sin(t), R, R, c.sides, b.center);
    });
  loft(o, S(c, 'trim'), rings, C.pale);
  if (c.rails)
    for (let j = 0; j < 8; j++) {
      const t = (j * Math.PI) / 4,
        center = [b.center[0] + 1.9 * Math.cos(t), b.center[1] + 1.9 * Math.sin(t)];
      cylinder(o, c, center, 10.65, 10.83, 0.13, 0.11, 'glass', C.glass);
    }
}
function stair(o, c, start, end, y0, y1, width = 2) {
  if (c.far) return;
  const f = face(start, end),
    N = c.steps ? Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.22)) : 1;
  for (let j = 0; j < N; j++) {
    const lo = (j * f.L) / N,
      hi = ((j + 1) * f.L) / N,
      top = y0 + ((y1 - y0) * (j + 1)) / N,
      pr = [
        P(f, lo, 0, -width / 2),
        P(f, hi, 0, -width / 2),
        P(f, hi, 0, width / 2),
        P(f, lo, 0, width / 2),
      ].map(([x, , z]) => [x, z]);
    shell(
      o,
      c,
      pr,
      (x, z) => Math.min(bodrumGroundY(x, z) - 0.3, top - 0.25),
      top,
      'ground',
      C.ground,
    );
  }
}
function terraces(o, c) {
  if (c.far) return;
  for (const t of a.terraces)
    shell(o, c, t.outline, (x, z) => bodrumGroundY(x, z) - 0.5, t.floor, 'ground', C.ground);
  for (const k of a.gates.filter((k) => k.target !== 'range')) {
    const t = k.axis;
    for (const sign of [-1, 1]) {
      const inner = k.center.map((v, i) => v + t[i] * k.halfLength * sign),
        outer = k.center.map((v, i) => v + t[i] * (k.halfLength + 5) * sign);
      stair(o, c, outer, inner, bodrumGroundY(...outer) + 0.15, k.floor, 2 * k.radius);
    }
  }
  stair(o, c, [-45, -6], [-37, -6], 4.5, 7, 2.5);
  stair(o, c, [-9, 15], [-1, 15], 7, 12.5, 2.6);
  stair(o, c, [27, 3], [27, 11], 9.5, 12.5, 2.5);
  stair(o, c, [-35.6, 57.23], [-43, 57.23], 7.5, 7, 1.7);
  // Open stone walks around the sea-facing lower court and the raised tower bailey.
  for (const [p, q, y, w] of [
    [[-67, 78], [-32, 78], 5, 2],
    [[-29, 75], [70, 75], 7, 2],
    [[69, 71], [62, 58], 7, 2],
    [[54, 14], [58, 59], 12.5, 2],
  ]) {
    const f = face(p, q),
      pr = [P(f, 0, 0, -w / 2), P(f, f.L, 0, -w / 2), P(f, f.L, 0, w / 2), P(f, 0, 0, w / 2)].map(
        ([x, , z]) => [x, z],
      );
    shell(o, c, pr, (x, z) => bodrumGroundY(x, z) - 0.25, y, 'ground', C.ground);
  }
  if (c.steps) {
    stair(o, c, [-69, 59], [-65, 70], 3, 5, 2);
    stair(o, c, [55, 60], [48, 68], 12.5, 7, 2.2);
  }
}
export function buildBodrumLevel(o, level) {
  const c = configs[level];
  if (!c) throw Error('Unknown Bodrum level ' + level);
  curtain(o, c);
  terraces(o, c);
  for (const [name, index] of [
    ['french', 5],
    ['italian', 3],
    ['english', 4],
    ['german', 15],
  ])
    principalTower(o, c, name, index);
  roundAndD(o, c);
  lowRanges(o, c);
  chapel(o, c);
  if (!c.far) for (const k of a.gates) gateBarrel(o, c, k);
}
export const buildBodrumSkyline = (o) => buildBodrumLevel(o, 'skyline');
export const buildBodrumDistrict = (o) => buildBodrumLevel(o, 'district');
export const buildBodrumStreet = (o) => buildBodrumLevel(o, 'street');
export const buildBodrumCloseup = (o) => buildBodrumLevel(o, 'closeup');
