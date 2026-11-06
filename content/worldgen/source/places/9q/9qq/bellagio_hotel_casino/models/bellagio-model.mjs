/** Original Bellagio exterior: three-wing hotel, Spa Tower and complete low resort. Meters,+Y up. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('dfcdb0'),
    trim: lin('eee8d9'),
    glass: lin('5b748c'),
    green: lin('6d8984'),
    terra: lin('d8b08c'),
    roof: lin('c2c3bc'),
    metal: lin('abaeaa'),
    ground: lin('b7af9f'),
    dark: lin('69716e'),
  };
export const bellagioSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.27, metallic: 0.12 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.5, metallic: 0.22 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.82, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.86, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
};
export const bellagioControls = a;
export function bellagioGroundY(x, z) {
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
const cfg = {
  skyline: { far: true, simplify: 8, bay: 30, rows: 1, archSides: 2, sides: 6, vault: 4 },
  district: { simplify: 4.5, bay: 18, rows: 5, archSides: 2, sides: 8, vault: 6, bands: true },
  street: {
    simplify: 1.3,
    bay: 7.8,
    rows: 16,
    archSides: 5,
    sides: 12,
    vault: 10,
    bands: true,
    entry: true,
  },
  closeup: {
    simplify: 0.5,
    bay: 6.2,
    rows: 32,
    archSides: 8,
    sides: 20,
    vault: 16,
    bands: true,
    entry: true,
    frames: true,
  },
  master: {
    simplify: 0,
    bay: 6.2,
    rows: 32,
    archSides: 12,
    sides: 32,
    vault: 24,
    bands: true,
    entry: true,
    frames: true,
    returns: true,
    plant: true,
  },
};
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((sum, p, i) => {
      const q = r[(i + 1) % r.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => (area(r) < 0 ? r : r.toReversed());
function simple(r, e) {
  r = r.map((p) => [...p]);
  if (!e) return r;
  let change = true;
  while (change && r.length > 8) {
    change = false;
    for (let i = 0; i < r.length; i++) {
      const p = r[(i + r.length - 1) % r.length],
        v = r[i],
        q = r[(i + 1) % r.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        L = Math.hypot(dx, dz);
      if (L < 0.001) continue;
      const t = ((v[0] - p[0]) * dx + (v[1] - p[1]) * dz) / (L * L),
        d = Math.abs(dx * (v[1] - p[1]) - dz * (v[0] - p[0])) / L;
      if (t > 0 && t < 1 && d < e) {
        r.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return r;
}
function tri(o, c, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((v, k, i) => v + k * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    color,
  );
}
function patch(o, c, s, p, color, n) {
  tri(o, c, s, p.slice(0, 3), color, n);
  tri(o, c, s, [p[0], p[2], p[3]], color, n);
}
function cap(o, c, rings, y, s = 'roof', color = C.roof, up = 1) {
  const flat = rings.flatMap((r) => r.flat()),
    holes = [];
  let count = rings[0].length;
  for (let i = 1; i < rings.length; i++) {
    holes.push(count);
    count += rings[i].length;
  }
  const ps = rings.flat(),
    ids = earcut(flat, holes);
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      c,
      s,
      ids
        .slice(i, i + 3)
        .map((k) => [ps[k][0], typeof y === 'function' ? y(...ps[k]) : y, ps[k][1]]),
      color,
      [0, up, 0],
    );
}
function face(p, q) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
    t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  return { p, q, L, t, n: [-t[1], t[0]] };
}
const P = (f, u, y, d = 0) => [
  f.p[0] + f.t[0] * u + f.n[0] * d,
  y,
  f.p[1] + f.t[1] * u + f.n[1] * d,
];
function panel(o, c, f, u0, u1, y0, y1, d, s, color) {
  if (u1 <= u0 || y1 <= y0) return;
  patch(o, c, s, [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
function glazing(o, c, f, u0, u1, y0, y1, d, columns = 1, rows = 1) {
  if (u1 <= u0 || y1 <= y0) return;
  const p = [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)];
  o.addQuad(
    S(c, 'glass'),
    'metric:uv',
    p,
    [f.n[0], 0, f.n[1]],
    [
      [0, 0],
      [columns * 0.5, 0],
      [columns * 0.5, rows],
      [0, rows],
    ],
    C.glass,
  );
}
function B(o, c, p, q, w = 0.16, color = C.trim, d = w) {
  if (Math.hypot(...p.map((v, i) => v - q[i])) > 0.001) beam(o, S(c, 'metal'), p, q, w, d, color);
}
function box(o, c, s, center, size, color) {
  if (size.some((v) => v <= 0)) throw Error('Positive dimensions required');
  boundsBox(
    o,
    S(c, s),
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    color,
  );
}
function shell(o, c, r, y0, y1, s = 'wall', color = C.wall, capTop = true) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    panel(o, c, f, 0, f.L, y0, y1, 0, s, color);
  }
  if (capTop) cap(o, c, [r], y1);
}
export const bellagioCanopyPoint = (u, y, v) => {
  const k = a.canopy,
    [tx, tz] = k.axis;
  return [k.center[0] + tx * u - tz * v, y, k.center[1] + tz * u + tx * v];
};
function entryFace() {
  const k = a.canopy,
    p = bellagioCanopyPoint(k.entryU, 0, 7),
    q = bellagioCanopyPoint(k.entryU, 0, -7);
  return face([p[0], p[2]], [q[0], q[2]]);
}
export const bellagioEntryPoint = (u, y, d = 0) => P(entryFace(), u, y, d);
function lowComplex(o, c) {
  const outer = cw(simple(a.podium.outline, c.simplify)),
    holes = a.podium.holes.map((r) => cw(simple(r, c.simplify)).toReversed()),
    canopy = cw(a.canopy.outline).toReversed();
  for (const [ri, r] of [outer, ...holes, canopy].entries())
    for (let i = 0; i < r.length; i++) {
      const f = face(r[i], r[(i + 1) % r.length]),
        isCanopy = ri === holes.length + 1,
        foundation = Math.min(-1.3, bellagioGroundY(...f.p) - 0.4, bellagioGroundY(...f.q) - 0.4),
        vehicle =
          ri === 0 &&
          f.n[1] > 0.7 &&
          f.L > 40 &&
          Math.min(f.p[0], f.q[0]) < 4 &&
          Math.max(f.p[0], f.q[0]) > -42;
      if (isCanopy) {
        panel(o, c, f, 0, f.L, 8.5, 11, 0, 'wall', C.wall);
        continue;
      }
      if (vehicle && c.entry) {
        const U = (x) => (x - f.p[0]) / f.t[0],
          u0 = Math.max(0, Math.min(U(-42), U(4))),
          u1 = Math.min(f.L, Math.max(U(-42), U(4)));
        panel(o, c, f, 0, u0, foundation, 11, 0, 'wall', C.wall);
        panel(o, c, f, u1, f.L, foundation, 11, 0, 'wall', C.wall);
        panel(o, c, f, u0, u1, 8.5, 11, 0, 'wall', C.wall);
      } else panel(o, c, f, 0, f.L, foundation, 11, 0, 'wall', C.wall);
      if (c.bands && !vehicle && f.L > 10) {
        const N = Math.max(1, Math.floor(f.L / (c.frames ? 5 : 14)));
        for (let j = 0; j < N; j++) {
          const u0 = ((j + 0.15) * f.L) / N,
            u1 = ((j + 0.7) * f.L) / N;
          glazing(o, c, f, u0, u1, 2, 7.5, 0.03, 1, 2);
        }
        panel(o, c, f, 0, f.L, 9.8, 10.3, 0.08, 'wall', C.trim);
      }
    }
  cap(o, c, [outer, ...holes, canopy], 11);
  if (c.entry) cap(o, c, [outer, ...holes, canopy], 10.65, 'wall', C.trim, -1);
  shell(
    o,
    c,
    simple(a.southLowExtension.outline, c.simplify),
    Math.min(-1.5, ...a.southLowExtension.outline.map((p) => bellagioGroundY(...p) - 0.3)),
    10,
  );
}
function towerBody(o, c, outline, y0, y1, rows = c.rows) {
  const r = cw(outline);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    if (c.far) {
      panel(o, c, f, 0, f.L, y0, y1, 0, 'wall', C.wall);
      continue;
    }
    const N = Math.max(1, Math.ceil(f.L / c.bay)),
      bay = f.L / N,
      w = bay * 0.43;
    glazing(o, c, f, 0, f.L, y0, y1, -0.12, N, (32 * (y1 - y0)) / 109);
    for (let j = 0; j <= N; j++) {
      const u = j * bay;
      panel(o, c, f, Math.max(0, u - w / 2), Math.min(f.L, u + w / 2), y0, y1, 0, 'wall', C.wall);
      if (c.returns && j > 0 && j < N)
        for (const edge of [u - w / 2, u + w / 2])
          patch(
            o,
            c,
            'wall',
            [P(f, edge, y0, 0), P(f, edge, y0, -0.12), P(f, edge, y1, -0.12), P(f, edge, y1, 0)],
            C.trim,
          );
    }
    for (let j = 0; j <= rows; j++) {
      const y = y0 + (j * (y1 - y0)) / rows;
      panel(o, c, f, 0, f.L, Math.max(y0, y - 0.35), Math.min(y1, y + 0.35), 0.02, 'wall', C.trim);
    }
    for (const t of [0.23, 0.75, 0.99]) {
      const y = y0 + t * (y1 - y0);
      panel(o, c, f, 0, f.L, y, y + (c.frames ? 1 : 0.65), 0.18, 'wall', C.trim);
      if (c.returns) {
        B(o, c, P(f, 0, y, 0.23), P(f, f.L, y, 0.23), 0.25, C.trim);
      }
    }
    if (c.frames)
      for (let j = 0; j < N; j++) {
        const u = (j + 0.5) * bay;
        panel(o, c, f, u - 0.045, u + 0.045, y0, y1, -0.09, 'metal', C.trim);
      }
  }
  cap(o, c, [r], y1);
}
export const bellagioMainGalleryTop = (x, z) =>
  a.main.galleryOuterTop +
  (a.main.galleryInnerTop - a.main.galleryOuterTop) *
    Math.max(0, 1 - Math.hypot(x - a.main.center[0], z - a.main.center[1]) / 125);
function archBay(o, c, f, u0, u1, y0, top) {
  const w = u1 - u0,
    margin = w * 0.24,
    r = w * 0.26,
    x = (u0 + u1) / 2,
    yTop = Math.min(top(...P(f, x, 0).filter((_, i) => i !== 1)) - 1.5, y0 + 20),
    spring = yTop - r,
    bottom = y0 + 1.2,
    n = [f.n[0], 0, f.n[1]];
  for (const [p, q] of [
    [u0, u0 + margin],
    [u1 - margin, u1],
  ]) {
    const P0 = P(f, p, 0),
      P1 = P(f, q, 0);
    patch(
      o,
      c,
      'wall',
      [P(f, p, y0), P(f, q, y0), P(f, q, top(P1[0], P1[2])), P(f, p, top(P0[0], P0[2]))],
      C.wall,
      n,
    );
  }
  panel(o, c, f, u0 + margin, u1 - margin, y0, bottom, 0, 'wall', C.trim);
  panel(o, c, f, x - r, x + r, bottom, spring, -0.15, 'glass', C.glass);
  const pts = Array.from({ length: c.archSides + 1 }, (_, j) => {
    const t = Math.PI - (j * Math.PI) / c.archSides;
    return [x + Math.cos(t) * r, spring + Math.sin(t) * r];
  });
  for (let j = 0; j < pts.length - 1; j++) {
    const p = pts[j],
      q = pts[j + 1],
      max0 = top(...P(f, p[0], 0).filter((_, i) => i !== 1)),
      max1 = top(...P(f, q[0], 0).filter((_, i) => i !== 1));
    patch(
      o,
      c,
      'wall',
      [P(f, p[0], p[1]), P(f, q[0], q[1]), P(f, q[0], max1), P(f, p[0], max0)],
      C.wall,
      n,
    );
    tri(
      o,
      c,
      'glass',
      [P(f, x, spring, -0.15), P(f, p[0], p[1], -0.15), P(f, q[0], q[1], -0.15)],
      C.glass,
      n,
    );
    if (c.frames) {
      if (c.returns) B(o, c, P(f, p[0], p[1], 0.08), P(f, q[0], q[1], 0.08), 0.13, C.trim);
      else {
        const outside = (p) => [
            x + ((p[0] - x) * (r + 0.16)) / r,
            spring + ((p[1] - spring) * (r + 0.16)) / r,
          ],
          P0 = outside(p),
          Q0 = outside(q);
        patch(
          o,
          c,
          'wall',
          [
            P(f, p[0], p[1], 0.085),
            P(f, q[0], q[1], 0.085),
            P(f, Q0[0], Q0[1], 0.085),
            P(f, P0[0], P0[1], 0.085),
          ],
          C.trim,
          n,
        );
      }
      if (c.returns)
        patch(
          o,
          c,
          'wall',
          [P(f, p[0], p[1]), P(f, p[0], p[1], -0.15), P(f, q[0], q[1], -0.15), P(f, q[0], q[1])],
          C.trim,
        );
    }
  }
  if (c.frames)
    for (const u of [x - r, x + r])
      panel(o, c, f, u - 0.08, u + 0.08, bottom, spring, 0.035, 'wall', C.trim);
}
function gallery(o, c, outline, base, top, roofRise = 2) {
  const r = cw(outline);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    if (c.far) {
      patch(
        o,
        c,
        'wall',
        [P(f, 0, base), P(f, f.L, base), P(f, f.L, top(...f.q)), P(f, 0, top(...f.p))],
        C.wall,
        [f.n[0], 0, f.n[1]],
      );
      continue;
    }
    const N = Math.max(1, Math.floor(f.L / (c.frames ? 6.2 : c.bay)));
    for (let j = 0; j < N; j++) archBay(o, c, f, (j * f.L) / N, ((j + 1) * f.L) / N, base, top);
    if (c.entry) B(o, c, P(f, 0, base, 0.15), P(f, f.L, base, 0.15), c.frames ? 0.4 : 0.25, C.trim);
    else panel(o, c, f, 0, f.L, base, base + 0.35, 0.15, 'wall', C.trim);
  }

  hipRoof(o, c, r, top, roofRise);
}
function hipRoof(o, c, r, top, roofRise) {
  // Hip strips keep a visible green ridge without a generic flat tower cap.
  const ctr = r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]),
    inner = r.map((p) => [ctr[0] + (p[0] - ctr[0]) * 0.965, ctr[1] + (p[1] - ctr[1]) * 0.965]);
  for (let i = 0; i < r.length; i++) {
    const k = (i + 1) % r.length;
    patch(
      o,
      c,
      'metal',
      [
        [r[i][0], top(...r[i]), r[i][1]],
        [r[k][0], top(...r[k]), r[k][1]],
        [inner[k][0], top(...inner[k]) + roofRise, inner[k][1]],
        [inner[i][0], top(...inner[i]) + roofRise, inner[i][1]],
      ],
      C.green,
      [0, 1, 0],
    );
  }
  cap(o, c, [inner], (x, z) => top(x, z) + roofRise, 'metal', C.green);
}

function dome(o, c, center, base, radius, height, color = C.trim) {
  const N = c.sides,
    rows = c.far ? 1 : c.frames ? 6 : c.entry ? 3 : 2;
  let prev = radialRing(base, radius, radius, N, center);
  for (let j = 1; j <= rows; j++) {
    const t = j / rows,
      r = Math.max(0.06, radius * Math.sqrt(Math.max(0, 1 - t * t))),
      next = radialRing(base + t * height, r, r, N, center);
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N;
      patch(o, c, 'metal', [prev[i], prev[k], next[k], next[i]], color);
    }
    prev = next;
  }
  cap(o, c, [prev.map((p) => [p[0], p[2]])], base + height, 'metal', color);
}
function mainCrown(o, c) {
  const m = a.main,
    [x, z] = m.center,
    r = radialRing(0, m.drumRadius, m.drumRadius, c.sides, [x, z]).map((p) => [p[0], p[2]]);
  towerBody(o, c, r, 11, m.lanternFloor, c.rows);
  shell(o, c, r, 142, m.lanternFloor, 'wall', C.trim, false);
  cap(o, c, [r], m.lanternFloor, 'wall', C.trim);
  const columns = c.far ? 6 : c.entry ? 12 : 8;
  for (let i = 0; i < columns; i++) {
    const t = (-i * 2 * Math.PI) / columns,
      p = [x + 8.7 * Math.cos(t), z + 8.7 * Math.sin(t)];
    loft(
      o,
      S(c, 'wall'),
      [
        radialRing(m.lanternFloor, 0.35, 0.35, c.entry ? 8 : 4, p),
        radialRing(m.lanternRoof, 0.35, 0.35, c.entry ? 8 : 4, p),
      ],
      C.trim,
    );
  }
  const ring = radialRing(m.lanternRoof, 9.3, 9.3, c.sides, [x, z]).map((p) => [p[0], p[2]]);
  shell(o, c, ring, m.lanternRoof - 0.3, m.lanternRoof + 0.2, 'wall', C.trim);
  dome(o, c, [x, z], m.lanternRoof + 0.2, 8.8, 154.45 - m.lanternRoof - 0.2, C.green);
  loft(
    o,
    S(c, 'metal'),
    [
      radialRing(154.45, 0.25, 0.25, c.far ? 4 : 8, [x, z]),
      radialRing(155, 0.08, 0.08, c.far ? 4 : 8, [x, z]),
    ],
    C.trim,
  );
}
function minorRoofs(o, c) {
  for (const part of a.nativeRoofs) {
    if (c.far && ![6, 8, 9, 10, 11, 21, 23].includes(part.index)) continue;
    if (part.index === 6) continue;
    const r = cw(simple(part.outline, c.simplify)),
      round = [8, 9, 10, 11, 13, 16, 17, 18, 26, 27].includes(part.index);
    if (round) {
      const ctr = r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]),
        R = Math.max(...r.map((p) => Math.hypot(p[0] - ctr[0], p[1] - ctr[1]))),
        sides = c.far ? 6 : c.sides,
        base = part.top - 5;
      const rr = radialRing(0, R * 0.86, R * 0.86, sides, ctr).map((p) => [p[0], p[2]]);
      if (c.entry) gallery(o, c, rr, 0, () => base + 2, 0);
      else shell(o, c, rr, 0, base + 2, 'wall', C.wall);
      dome(o, c, ctr, base + 2, R * 0.92, 3, C.trim);
    } else {
      const flat = [14, 19, 20, 21, 22, 24, 29].includes(part.index),
        top = Math.max(part.top, 11.5),
        wallTop = flat ? top : Math.max(11, top - 2);
      shell(o, c, r, 11, wallTop, 'wall', C.wall, false);
      if (!flat && [7, 15, 28].includes(part.index)) {
        const ctr = r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]);
        for (let i = 0; i < r.length; i++) {
          const k = (i + 1) % r.length;
          tri(
            o,
            c,
            'tile',
            [
              [r[i][0], wallTop, r[i][1]],
              [r[k][0], wallTop, r[k][1]],
              [ctr[0], Math.max(top, wallTop + 1.5), ctr[1]],
            ],
            C.terra,
            [0, 1, 0],
          );
        }
      } else cap(o, c, [r], top, flat ? 'roof' : 'tile', flat ? C.roof : C.terra);
    }
  }
}
function lakefrontArcade(o, c) {
  const centers = [11, 9, 10, 8].map((index) => {
      const r = a.nativeRoofs.find((p) => p.index === index).outline;
      return r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]);
    }),
    N = c.far ? 2 : c.frames ? 10 : 4;
  for (let k = 0; k < centers.length - 1; k++) {
    const p = centers[k],
      q = centers[k + 1],
      L = Math.hypot(q[0] - p[0], q[1] - p[1]),
      n = [-(q[1] - p[1]) / L, (q[0] - p[0]) / L],
      P = (t, v) => [
        p[0] + t * (q[0] - p[0]) + n[0] * v,
        11.5 + 2.5 * Math.sqrt(Math.max(0, 1 - (v / 5) ** 2)),
        p[1] + t * (q[1] - p[1]) + n[1] * v,
      ];
    for (let j = 0; j < N; j++) {
      const v0 = -5 + (j * 10) / N,
        v1 = -5 + ((j + 1) * 10) / N;
      patch(o, c, 'metal', [P(0, v0), P(1, v0), P(1, v1), P(0, v1)], C.green);
    }
  }
}
function vault(o, c) {
  const k = a.canopy,
    Cp = bellagioCanopyPoint,
    values = [
      -k.halfWidth,
      -4,
      4,
      k.halfWidth,
      ...Array.from(
        { length: c.vault + 1 },
        (_, i) => -k.halfWidth + (2 * k.halfWidth * i) / c.vault,
      ),
    ]
      .sort((a, b) => a - b)
      .filter((v, i, r) => !i || v - r[i - 1] > 0.0001),
    roofY = (v) => k.eave + (k.crest - k.eave) * Math.sqrt(Math.max(0, 1 - (v / k.halfWidth) ** 2));
  for (const [u0, u1] of [
    [-21, -14],
    [-14, 14],
    [14, 21],
  ])
    for (let i = 0; i < values.length - 1; i++) {
      const v0 = values[i],
        v1 = values[i + 1];
      if (u0 === -14 && v0 >= -4 && v1 <= 4) continue;
      const ps = [
        Cp(u0, roofY(v0), v0),
        Cp(u1, roofY(v0), v0),
        Cp(u1, roofY(v1), v1),
        Cp(u0, roofY(v1), v1),
      ];
      patch(o, c, 'metal', ps, C.green);
      if (c.entry) patch(o, c, 'metal', ps.toReversed(), C.green);
    }
  const N = c.vault;
  for (let i = 0; i < N; i++) {
    const v0 = -4 + (8 * i) / N,
      v1 = -4 + (8 * (i + 1)) / N,
      Y = (v) => 14.4 + 2.6 * Math.sqrt(Math.max(0, 1 - (v / 4) ** 2)),
      ps = [Cp(-14, Y(v0), v0), Cp(14, Y(v0), v0), Cp(14, Y(v1), v1), Cp(-14, Y(v1), v1)];
    patch(o, c, 'metal', ps, C.green);
    if (c.entry) patch(o, c, 'metal', ps.toReversed(), C.green);
  }
  for (const [u0, u1, width, Y] of [
    [-21, 21, 15, roofY],
    [-14, 14, 4, (v) => 14.4 + 2.6 * Math.sqrt(Math.max(0, 1 - (v / 4) ** 2))],
  ])
    for (const u of [u0, u1])
      for (let i = 0; i < N; i++) {
        const v0 = -width + (2 * width * i) / N,
          v1 = -width + (2 * width * (i + 1)) / N;
        tri(
          o,
          c,
          'metal',
          [Cp(u, width === 15 ? k.eave : 14.4, 0), Cp(u, Y(v0), v0), Cp(u, Y(v1), v1)],
          C.green,
        );
      }
  if (c.entry)
    for (const u of c.frames ? [-21, -17, -13, -9, -5, -1, 3, 7, 11, 15, 19, 21] : [-21, -7, 7, 21])
      for (let i = 0; i < values.length - 1; i++) {
        const v0 = values[i],
          v1 = values[i + 1];
        B(
          o,
          c,
          Cp(u, roofY(v0) + 0.04, v0),
          Cp(u, roofY(v1) + 0.04, v1),
          c.frames ? 0.12 : 0.18,
          C.metal,
        );
      }
  for (const u of c.far ? [-17, 17] : k.postU)
    for (const v of k.postV) {
      const p = Cp(u, 0, v),
        h = bellagioGroundY(p[0], p[2]);
      loft(
        o,
        S(c, 'ground'),
        [
          radialRing(h - 0.35, 0.7, 0.7, c.entry ? 8 : 4, [p[0], p[2]]),
          radialRing(h + 0.15, 0.7, 0.7, c.entry ? 8 : 4, [p[0], p[2]]),
        ],
        C.ground,
      );

      loft(
        o,
        S(c, 'wall'),
        [
          radialRing(h - 0.35, 0.55, 0.55, c.entry ? 8 : 4, [p[0], p[2]]),
          radialRing(k.eave, 0.55, 0.55, c.entry ? 8 : 4, [p[0], p[2]]),
        ],
        C.trim,
      );
    }
  if (c.entry) {
    for (const v of [-11.5, 11.5]) {
      patch(
        o,
        c,
        'wall',
        [Cp(-20, 9.15, v - 3), Cp(20, 9.15, v - 3), Cp(20, 9.15, v + 3), Cp(-20, 9.15, v + 3)],
        C.trim,
        [0, -1, 0],
      );
      if (c.frames)
        for (let u = -18; u < 20; u += 3) {
          B(o, c, Cp(u, 9.1, v - 3), Cp(u, 9.1, v + 3), 0.14, C.wall);
          for (const dv of [-1.5, 1.5])
            B(o, c, Cp(u, 9.1, v + dv), Cp(u + 3, 9.1, v + dv), 0.12, C.wall);
        }
    }
    const f = entryFace();
    glazing(o, c, f, 2, 12, 0.3, 6, -k.recess, 4, 2);
    for (const u of [2, 4.5, 7, 9.5, 12])
      B(o, c, P(f, u, 0.3, -k.recess + 0.04), P(f, u, 6, -k.recess + 0.04), 0.12, C.metal);
    for (const u of [2, 12])
      patch(
        o,
        c,
        'wall',
        [P(f, u, 0.3), P(f, u, 6), P(f, u, 6, -k.recess), P(f, u, 0.3, -k.recess)],
        C.trim,
      );
    patch(
      o,
      c,
      'wall',
      [P(f, 2, 6), P(f, 12, 6), P(f, 12, 6, -k.recess), P(f, 2, 6, -k.recess)],
      C.trim,
      [0, -1, 0],
    );
  }
}
function plant(o, c) {
  if (!c.plant) return;
  for (const [x, z, w, d, h, roof = 17] of [
    [-205, -30, 18, 12, 3],
    [-230, 50, 20, 10, 2.5],
    [-190, -60, 14, 8, 3],
    [-60, 110, 18, 12, 2, 10],
  ])
    box(o, c, 'metal', [x, roof + h / 2, z], [w, h, d], C.roof);
}
function spaOrnaments(o, c) {
  if (!c.frames) return;
  const r = cw(a.spa.upperOutline);
  for (const p of r) {
    const rr = radialRing(0, 0.85, 0.85, c.sides, p).map((p) => [p[0], p[2]]);
    shell(o, c, rr, 116, 116.4, 'wall', C.trim);
    dome(o, c, p, 116.4, 0.9, 1.25, C.green);
  }
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      N = Math.max(1, Math.floor(f.L / 2.6));
    for (let j = 0; j < N; j++) {
      const u = ((j + 0.5) * f.L) / N;
      patch(
        o,
        c,
        'wall',
        [
          P(f, u - 0.65, 115.15, 0.04),
          P(f, u, 114.7, 0.04),
          P(f, u + 0.65, 115.15, 0.04),
          P(f, u, 115.6, 0.04),
        ],
        C.terra,
        [f.n[0], 0, f.n[1]],
      );
    }
  }
}
export function buildBellagioLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error(`Unknown level ${level}`);
  lowComplex(o, c);
  towerBody(o, c, a.main.outline, 11, 120);
  gallery(o, c, a.main.outline, 120, bellagioMainGalleryTop);
  mainCrown(o, c);
  towerBody(o, c, a.spa.outline, 11, 100, Math.max(1, Math.round((c.rows * 89) / 109)));
  gallery(o, c, a.spa.upperOutline, 100, () => 116, 4);
  spaOrnaments(o, c);
  for (const r of [
    [a.spa.outline[0], a.spa.outline[1], a.spa.upperOutline[0], a.spa.upperOutline[3]],
    [a.spa.outline[2], a.spa.outline[3], a.spa.upperOutline[2], a.spa.upperOutline[1]],
  ])
    hipRoof(o, c, cw(r), () => 100, 3);
  minorRoofs(o, c);
  lakefrontArcade(o, c);
  vault(o, c);
  plant(o, c);
}
export const buildBellagioSkyline = (o) => buildBellagioLevel(o, 'skyline');
export const buildBellagioDistrict = (o) => buildBellagioLevel(o, 'district');
export const buildBellagioStreet = (o) => buildBellagioLevel(o, 'street');
export const buildBellagioCloseup = (o) => buildBellagioLevel(o, 'closeup');
