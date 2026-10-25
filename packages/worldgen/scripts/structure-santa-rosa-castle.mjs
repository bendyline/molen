/** Whole Santa Rosa hill fort: native bastions, open courtyard and original low barracks. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/d9/d9f/santa_rosa_de_la_eminencia_castle/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  R = p.outline.slice(0, -1),
  ref = 'palette:#ffffff';
const C = {
    rubble: rgb('898276'),
    plaster: rgb('bf987c'),
    roof: rgb('ac6549'),
    trim: rgb('c6bca5'),
    wood: rgb('57554a'),
    metal: rgb('44483e'),
  },
  surfaces = {
    rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.99, metallic: 0 },
    plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
    roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
    wood: { slot: 'window', localRef: ref, roughness: 0.93, metallic: 0 },
    metal: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.85, metallic: 0.12 },
  };
const sub = (a, b) => a.map((x, k) => x - b[k]),
  dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0),
  area = (r) =>
    r.reduce((v, a, i) => {
      const b = r[(i + 1) % r.length];
      return v + a[0] * b[1] - a[1] * b[0];
    }, 0) / 2;
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, n) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, q, n, col) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function flat(o, s, outer, y, holes = [], up = true, col) {
  const all = [outer, ...holes].flat(),
    ix = earcut(
      all.flat(),
      holes.map((_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [all[k][0], F + y, all[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function inset(r, d) {
  const sign = Math.sign(area(r));
  return r.map((b, i) => {
    const a = r[(i + r.length - 1) % r.length],
      c = r[(i + 1) % r.length],
      u = normalize([b[0] - a[0], 0, b[1] - a[1]]),
      v = normalize([c[0] - b[0], 0, c[1] - b[1]]),
      n = [sign * -u[2] + sign * -v[2], sign * u[0] + sign * v[0]],
      den = 1 + u[0] * v[0] + u[2] * v[2];
    return [b[0] + (d * n[0]) / den, b[1] + (d * n[1]) / den];
  });
}
const top = inset(R, A.wallBatterInset),
  inside = inset(top, A.parapetThickness),
  front = R[A.gateEdge],
  frontEnd = R[A.gateEdge + 1],
  frontLen = Math.hypot(...sub(frontEnd, front)),
  U = [(frontEnd[0] - front[0]) / frontLen, (frontEnd[1] - front[1]) / frontLen],
  V = [U[1], -U[0]],
  K = (u, v) => [front[0] + U[0] * u + V[0] * v, front[1] + U[1] * u + V[1] * v],
  W = (u, y, v) => {
    const [x, z] = K(u, v);
    return [x, F + y, z];
  },
  rect = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  court = p.parameters.court.rect;
function frame(a, b) {
  const l = Math.hypot(...sub(b, a)),
    u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l],
    n = [-u[1], 0, u[0]];
  return {
    l,
    n,
    u,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, F + y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, r, P, n, holes = [], col) {
  const all = [r, ...holes].flat(),
    ix = earcut(
      all.flat(),
      holes.map((_, i) => r.length + holes.slice(0, i).reduce((s, x) => s + x.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => P(...all[k])),
      n,
      col,
    );
}
function box(o, s, P, x, y, z, w, h, dep, col) {
  const a = P(x - w / 2, y, z - dep / 2),
    b = P(x + w / 2, y, z - dep / 2),
    c = P(x + w / 2, y, z + dep / 2),
    d = P(x - w / 2, y, z + dep / 2),
    up = (v) => v.map((q, k) => q + (k === 1 ? h : 0));
  Q(o, s, [a, b, c, d], [0, -1, 0], col);
  Q(o, s, [up(a), up(b), up(c), up(d)], [0, 1, 0], col);
  const center = P(x, y + h / 2, z);
  for (const [v, t] of [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ])
    Q(
      o,
      s,
      [v, t, up(t), up(v)],
      v.map((q, k) => (q + t[k]) / 2 - center[k]),
      col,
    );
}
function beam(o, s, a, b, r, n = 4, col) {
  const axis = normalize(sub(b, a)),
    u = normalize(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(axis, u),
    rings = [a, b].map((p) =>
      Array.from({ length: n }, (_, i) =>
        p.map(
          (q, k) =>
            q +
            r * (u[k] * Math.cos((i * 2 * Math.PI) / n) + v[k] * Math.sin((i * 2 * Math.PI) / n)),
        ),
      ),
    );
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(o, s, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]], sub(rings[0][i], a), col);
    T(
      o,
      s,
      [a, rings[0][j], rings[0][i]],
      axis.map((x) => -x),
      col,
    );
    T(o, s, [b, rings[1][i], rings[1][j]], axis, col);
  }
}
function arch(x, y, w, h, n) {
  const r = w / 2,
    s = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos((i * Math.PI) / n),
      s + r * Math.sin((i * Math.PI) / n),
    ]),
  ];
}
function reveal(o, s, r, P, n, depth, back = true, col) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [P(...a), P(...b), P(...b, -depth), P(...a, -depth)]);
  }
  if (back) panel(o, 'wood', r, (x, y) => P(x, y, -depth), n, [], col ?? rgb('41463b'));
}
function wall(o, d, i) {
  const a = R[i],
    b = R[(i + 1) % R.length],
    at = top[i],
    bt = top[(i + 1) % R.length],
    f = frame(a, b),
    ft = frame(at, bt),
    WP = (x, y, z = 0) => {
      const t = x / f.l,
        h = y / A.walkFloor;
      return [
        (a[0] + (b[0] - a[0]) * t) * (1 - h) + (at[0] + (bt[0] - at[0]) * t) * h + f.n[0] * z,
        F + y,
        (a[1] + (b[1] - a[1]) * t) * (1 - h) + (at[1] + (bt[1] - at[1]) * t) * h + f.n[2] * z,
      ];
    },
    gate = i === A.gateEdge,
    gx = f.l * A.gateStation,
    holes = [];
  if (gate) {
    const l = gx - A.gateWidth / 2 - 0.12,
      r = gx + A.gateWidth / 2 + 0.12;
    for (const q of [
      rect(0, 0, l, A.walkFloor),
      rect(r, 0, f.l, A.walkFloor),
      rect(l, 0, r, A.gateFloor),
    ])
      panel(o, 'rubble', q, WP, f.n);
  } else panel(o, 'rubble', rect(0, 0, f.l, A.walkFloor), WP, f.n, holes);
  const h = gate ? A.gateParapetTop : A.walkFloor + A.parapetHeight,
    station = p.parameters.cannonSlots.find((c) => c.edge === i),
    slot = station ? ft.l * station.t : null;
  const notch = (P, n, len, x, width, base) => {
    for (const r of [
      rect(0, A.walkFloor, x - width, h),
      rect(x + width, A.walkFloor, len, h),
      rect(x - width, A.walkFloor, x + width, base),
    ])
      panel(o, 'plaster', r, P, n);
  };
  if (station) notch(ft.P, ft.n, ft.l, slot, 0.52, A.walkFloor + 0.25);
  else if (gate) {
    const x = ft.l * A.gateStation,
      l = x - 0.97,
      r = x + 0.97,
      slit = (xx) => rect(xx - 0.065, 5.05, xx + 0.065, 5.62);
    panel(o, 'plaster', rect(0, A.walkFloor, l, h), ft.P, ft.n, d ? [slit(x - 1.55)] : []);
    panel(o, 'plaster', rect(r, A.walkFloor, ft.l, h), ft.P, ft.n, d ? [slit(x + 1.55)] : []);
    panel(o, 'plaster', rect(l, A.gateFloor + A.gateHeight, r, h), ft.P, ft.n);
  } else panel(o, 'plaster', rect(0, A.walkFloor, ft.l, h), ft.P, ft.n);
  const ia = inside[i],
    ib = inside[(i + 1) % inside.length],
    fi = frame(ia, ib);
  if (station)
    notch(
      fi.P,
      fi.n.map((x) => -x),
      fi.l,
      fi.l * station.t,
      0.92,
      A.walkFloor + 0.2,
    );
  else
    panel(
      o,
      'plaster',
      rect(0, A.walkFloor, fi.l, h),
      fi.P,
      fi.n.map((x) => -x),
    );
  // Join outside/inside embrasures as real splayed open notches; no face seals the cannon mouth.
  if (station) {
    const x = slot,
      xi = fi.l * station.t;
    Q(
      o,
      'plaster',
      [
        ft.P(x - 0.52, A.walkFloor + 0.25),
        fi.P(xi - 0.92, A.walkFloor + 0.2),
        fi.P(xi + 0.92, A.walkFloor + 0.2),
        ft.P(x + 0.52, A.walkFloor + 0.25),
      ],
      [0, 1, 0],
    );
    for (const s of [-1, 1])
      Q(o, 'plaster', [
        ft.P(x + s * 0.52, A.walkFloor + 0.25),
        ft.P(x + s * 0.52, h),
        fi.P(xi + s * 0.92, h),
        fi.P(xi + s * 0.92, A.walkFloor + 0.2),
      ]);
    for (const [lo, hi, li, ri] of [
      [0, x - 0.52, 0, xi - 0.92],
      [x + 0.52, ft.l, xi + 0.92, fi.l],
    ])
      Q(o, 'plaster', [ft.P(lo, h), ft.P(hi, h), fi.P(ri, h), fi.P(li, h)], [0, 1, 0]);
  } else Q(o, 'plaster', [ft.P(0, h), ft.P(ft.l, h), fi.P(fi.l, h), fi.P(0, h)], [0, 1, 0]);
  if (gate) {
    const outer = rect(
      ft.l * A.gateStation - 0.97,
      A.walkFloor,
      ft.l * A.gateStation + 0.97,
      A.gateFloor + A.gateHeight,
    );
    reveal(o, 'trim', outer, ft.P, ft.n, 0.42);
    if (d)
      for (const x of [-1.55, 1.55])
        reveal(
          o,
          'plaster',
          rect(ft.l * A.gateStation + x - 0.065, 5.05, ft.l * A.gateStation + x + 0.065, 5.62),
          ft.P,
          ft.n,
          0.25,
        );
  }
  // A narrow original horizontal string course separates rubble from plaster in close views.
  if (d > 1 && !gate)
    beam(
      o,
      'rubble',
      ft.P(0, A.walkFloor + 0.015, 0.025),
      ft.P(ft.l, A.walkFloor + 0.015, 0.025),
      0.065,
      4,
      rgb('a89c84'),
    );
}
const lowerUV = [
    [0.7, 2],
    [14.5, 2],
    [14.5, 7.6],
    [16.6, 7.6],
    [16.6, 17.8],
    [14.5, 17.8],
    [14.5, 19.5],
    [1.2, 19.5],
    [1.2, 21.8],
    [-3.7, 21.8],
    [-3.7, 7.6],
    [0.7, 7.6],
  ],
  LOWER = lowerUV.map((v) => K(...v));
function courtyard(o, d) {
  flat(o, 'rubble', top, A.walkFloor, [LOWER], true, rgb('b3a28b'));
  flat(o, 'rubble', LOWER, A.courtFloor, [], true, rgb('b3a28b'));
  for (let i = 0; i < LOWER.length; i++) {
    const f = frame(LOWER[i], LOWER[(i + 1) % LOWER.length]);
    Q(
      o,
      'plaster',
      [f.P(0, A.courtFloor), f.P(f.l, A.courtFloor), f.P(f.l, A.walkFloor), f.P(0, A.walkFloor)],
      f.n.map((x) => -x),
    );
  }
  const x = (court[0] + court[2]) / 2,
    lo = court[3];
  if (d === 0) {
    Q(
      o,
      'rubble',
      [
        W(x - 1.5, A.courtFloor, lo - 1.8),
        W(x + 1.5, A.courtFloor, lo - 1.8),
        W(x + 1.5, A.walkFloor, lo),
        W(x - 1.5, A.walkFloor, lo),
      ],
      [0, 1, 0],
    );
    return;
  }
  const steps = 6,
    rise = (A.walkFloor - A.courtFloor) / steps;
  for (let j = 0; j < steps; j++)
    box(
      o,
      'rubble',
      W,
      x,
      A.courtFloor + j * rise,
      lo - (steps * 0.3 - 0.15) + j * 0.3,
      3,
      rise,
      0.3,
      rgb('aa9783'),
    );
}
function doorway(o, d) {
  const f = frame(top[A.gateEdge], top[A.gateEdge + 1]),
    x = f.l * A.gateStation,
    y = A.gateFloor,
    w = A.gateWidth,
    h = A.gateHeight,
    P = f.P;
  box(o, 'wood', P, x, y, -0.42, w, h, 0.12);
  for (const s of [-1, 1]) box(o, 'trim', P, x + s * (w / 2 + 0.12), y, 0.03, 0.24, h + 0.22, 0.55);
  box(o, 'trim', P, x, y + h, 0.03, w + 0.48, 0.24, 0.55);
  box(o, 'trim', P, x, y + h + 0.3, 0.02, w * 0.94, 0.64, 0.21);
  if (d > 1) {
    for (const sign of [-1, 1])
      for (let j = 0; j < 14; j++)
        box(
          o,
          'roof',
          P,
          x + sign * (w / 2 + 0.4),
          y + j * 0.15,
          0.04,
          0.42,
          0.13,
          0.13,
          rgb('a3745d'),
        );
    box(o, 'wood', P, x, y + h + 0.43, 0.14, 0.52, 0.37, 0.04, rgb('777c6d'));
    for (const s of [-1, 1])
      beam(
        o,
        'trim',
        P(x + s * 0.24, y + h + 0.77, 0.12),
        P(x + s * 0.14, y + h + 0.9, 0.12),
        0.035,
        4,
      );
    for (const xx of [-0.55, -0.28, 0, 0.28, 0.55])
      for (let j = 0; j < 6; j++)
        box(o, 'metal', P, x + xx, y + 0.2 + j * 0.32, -0.335, 0.035, 0.035, 0.025);
    for (let j = 1; j < 7; j++)
      beam(
        o,
        'wood',
        P(x - w / 2 + (j * w) / 7, y + 0.03, -0.35),
        P(x - w / 2 + (j * w) / 7, y + h - 0.03, -0.35),
        0.012,
        4,
        rgb('393e36'),
      );
  }
  // Intrinsic tapered brick access, not a hill or site pavement plate.
  const steps = d === 0 ? 1 : d === 1 ? 7 : A.stairCount,
    depth = 4.35,
    rise = y / steps;
  if (d === 0) {
    Q(
      o,
      'roof',
      [P(x - 2.2, 0, depth), P(x + 2.2, 0, depth), P(x + w / 2, y, 0), P(x - w / 2, y, 0)],
      [0, 1, 0],
    );
    return;
  }
  for (let j = 0; j < steps; j++) {
    const t = j / steps,
      z = depth * (1 - t),
      zz = depth * (1 - (j + 1) / steps),
      ww = 4.4 - (4.4 - w - 0.3) * t,
      hh = (j + 1) * rise;
    Q(
      o,
      'roof',
      [P(x - ww / 2, hh, z), P(x + ww / 2, hh, z), P(x + ww / 2, hh, zz), P(x - ww / 2, hh, zz)],
      [0, 1, 0],
    );
    Q(
      o,
      'roof',
      [
        P(x - ww / 2, j * rise, z),
        P(x + ww / 2, j * rise, z),
        P(x + ww / 2, hh, z),
        P(x - ww / 2, hh, z),
      ],
      f.n,
    );
    for (const s of [-1, 1])
      Q(o, 'roof', [
        P(x + (s * ww) / 2, 0, z),
        P(x + (s * ww) / 2, hh, z),
        P(x + (s * ww) / 2, hh, zz),
        P(x + (s * ww) / 2, 0, zz),
      ]);
  }
}
function room(o, room, d) {
  const [x0, v0, x1, v1] = room.rect,
    guard = room.role === 'small-guardroom',
    eave = guard ? A.guardRoof - 0.55 : A.barracksEaves,
    roof = guard ? A.guardRoof : A.barracksRidge,
    poly = rect(x0, v0, x1, v1).map((v) => K(...v)),
    passage = room.role === 'front-barracks',
    gx = frontLen * A.gateStation;
  for (let i = 0; i < 4; i++) {
    const a = poly[i],
      b = poly[(i + 1) % 4],
      f = frame(a, b),
      out = f.n,
      holes = [],
      specs = []; // The UV frame maps room rectangles into the same clockwise native winding.
    const long = f.l > 6;
    if (passage && (i === 0 || i === 2)) {
      const pos = i === 0 ? gx - x0 : x1 - gx;
      holes.push(arch(pos, A.courtFloor, 1.9, 2.57, d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 10 : 16));
      specs.push({ kind: 'passage', r: holes.at(-1) });
    }
    if (d > 0 && (i === 2 || (room.role !== 'front-barracks' && long))) {
      const count = Math.max(1, Math.floor(f.l / 3.1));
      for (let j = 0; j < count; j++) {
        const x = (f.l * (j + 0.5)) / count;
        if (specs.some((s) => Math.abs(x - (s.r[0][0] + s.r[1][0]) / 2) < 1.7)) continue;
        const door = (j + i) % 3 === 0,
          r = rect(
            x - (door ? 0.4 : 0.32),
            door ? A.courtFloor : A.courtFloor + 1.05,
            x + (door ? 0.4 : 0.32),
            door ? A.courtFloor + 2.1 : A.courtFloor + 2.03,
          );
        holes.push(r);
        specs.push({ kind: door ? 'door' : 'window', r });
      }
    }
    panel(o, 'plaster', rect(0, A.courtFloor, f.l, eave), f.P, out, holes);
    for (const h of specs) {
      if (h.kind === 'passage') continue;
      const depth = h.kind === 'window' ? A.windowRecess : A.doorRecess,
        P = f.P;
      reveal(o, 'plaster', h.r, P, out, depth);
      if (d > 1 && h.kind === 'window') {
        const l = h.r[0][0],
          r = h.r[1][0],
          y = h.r[0][1],
          yy = h.r[2][1];
        for (let j = 1; j < 4; j++)
          beam(
            o,
            'metal',
            P(l + ((r - l) * j) / 4, y, -depth + 0.035),
            P(l + ((r - l) * j) / 4, yy, -depth + 0.035),
            0.025,
            4,
          );
        beam(
          o,
          'metal',
          P(l, (y + yy) / 2, -depth + 0.035),
          P(r, (y + yy) / 2, -depth + 0.035),
          0.025,
          4,
        );
      }
      if (d > 1)
        beam(
          o,
          'trim',
          f.P(h.r[0][0] - 0.12, h.r[2][1] + 0.05, 0.02),
          f.P(h.r[1][0] + 0.12, h.r[2][1] + 0.05, 0.02),
          0.065,
          4,
        );
    }
  }
  if (passage) {
    const archR = arch(gx, A.courtFloor, 1.9, 2.57, d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 10 : 16);
    for (let i = 0; i < archR.length; i++) {
      const a = archR[i],
        b = archR[(i + 1) % archR.length];
      Q(o, 'plaster', [W(a[0], a[1], v0), W(b[0], b[1], v0), W(b[0], b[1], v1), W(a[0], a[1], v1)]);
    }
    Q(
      o,
      'rubble',
      [
        W(gx - 0.95, A.courtFloor, v0),
        W(gx + 0.95, A.courtFloor, v0),
        W(gx + 0.95, A.courtFloor, v1),
        W(gx - 0.95, A.courtFloor, v1),
      ],
      [0, 1, 0],
    );
  }
  const alongU = x1 - x0 >= v1 - v0,
    lo = alongU ? x0 : v0,
    hi = alongU ? x1 : v1,
    side0 = (alongU ? v0 : x0) - 0.23,
    side1 = (alongU ? v1 : x1) + 0.23,
    mid = (side0 + side1) / 2,
    RP = (l, y, s) => (alongU ? W(l, y, s) : W(s, y, l));
  for (const side of [side0, side1])
    Q(
      o,
      'roof',
      [
        RP(lo - 0.23, eave, side),
        RP(hi + 0.23, eave, side),
        RP(hi + 0.23, roof, mid),
        RP(lo - 0.23, roof, mid),
      ],
      [0, 1, 0],
    );
  for (const end of [lo, hi]) {
    const axis = alongU ? U : V,
      sign = end === lo ? -1 : 1;
    T(
      o,
      'plaster',
      [RP(end, eave, side0 + 0.23), RP(end, eave, side1 - 0.23), RP(end, roof, mid)],
      [axis[0] * sign, 0, axis[1] * sign],
    );
  }
  if (d > 1) {
    const pitch = d === 3 ? 0.3 : 0.62,
      count = Math.ceil((hi - lo) / pitch),
      n = d === 3 ? 5 : 3;
    for (let j = 0; j <= count; j++) {
      const l = lo + ((hi - lo) * j) / count;
      for (const side of [side0, side1]) {
        const a = RP(l, eave + 0.02, side),
          b = RP(l, roof + 0.02, mid),
          axis = normalize(sub(b, a)),
          across = normalize(sub(RP(l + 1, 0, side), RP(l, 0, side))),
          up = normalize(cross(axis, across)),
          UP = up[1] < 0 ? up.map((x) => -x) : up,
          rad = 0.07;
        for (let k = 0; k < n; k++) {
          const aa = (k * Math.PI) / n,
            bb = ((k + 1) * Math.PI) / n,
            vertex = (q, t) =>
              q.map((v, i) => v + rad * (across[i] * Math.cos(t) + UP[i] * Math.sin(t)));
          Q(o, 'roof', [vertex(a, aa), vertex(b, aa), vertex(b, bb), vertex(a, bb)], UP);
        }
      }
    }
    beam(
      o,
      'roof',
      RP(lo - 0.25, roof + 0.06, mid),
      RP(hi + 0.25, roof + 0.06, mid),
      0.12,
      d === 3 ? 8 : 5,
    );
  } else if (d)
    beam(o, 'roof', RP(lo - 0.23, roof + 0.03, mid), RP(hi + 0.23, roof + 0.03, mid), 0.1, 4);
}
function cannon(o, d, c) {
  const a = top[c.edge],
    b = top[(c.edge + 1) % top.length],
    f = frame(a, b),
    P = (x, y, z) => f.P(f.l * c.t + x, y, z),
    axis = A.walkFloor + 0.73,
    n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 12 : 20,
    ls =
      d === 0
        ? [
            [-2.35, 0.27],
            [0.35, 0.17],
          ]
        : [
            [-2.5, 0.15],
            [-2.3, 0.29],
            [-1.9, 0.29],
            [-1.7, 0.255],
            [-0.45, 0.19],
            [0.3, 0.17],
            [0.38, 0.19],
          ],
    rings = ls.map(([z, r]) =>
      Array.from({ length: n }, (_, i) =>
        P(r * Math.sin((i * 2 * Math.PI) / n), axis + r * Math.cos((i * 2 * Math.PI) / n), z),
      ),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        center = P(0, axis, (ls[j][0] + ls[j - 1][0]) / 2);
      Q(
        o,
        'metal',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        sub(rings[j][i], center),
      );
    }
  for (let i = 0; i < n; i++)
    T(
      o,
      'metal',
      [P(0, axis, ls[0][0]), rings[0][i], rings[0][(i + 1) % n]],
      f.n.map((x) => -x),
    );
  if (d > 1) {
    const inner = [0.38, -0.28].map((z) =>
      Array.from({ length: n }, (_, i) =>
        P(
          0.115 * Math.sin((i * 2 * Math.PI) / n),
          axis + 0.115 * Math.cos((i * 2 * Math.PI) / n),
          z,
        ),
      ),
    );
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      Q(o, 'metal', [rings.at(-1)[i], rings.at(-1)[j], inner[0][j], inner[0][i]], f.n);
      Q(
        o,
        'metal',
        [inner[0][i], inner[0][j], inner[1][j], inner[1][i]],
        sub(P(0, axis, 0.1), inner[0][i]),
      );
      T(o, 'wood', [P(0, axis, -0.28), inner[1][j], inner[1][i]], f.n);
    }
    beam(o, 'metal', P(-0.43, axis, -1.7), P(0.43, axis, -1.7), 0.105, n);
    beam(o, 'metal', P(0, axis, -2.63), P(0, axis, -2.48), 0.13, n);
  } else
    for (let i = 0; i < n; i++)
      T(o, 'metal', [P(0, axis, ls.at(-1)[0]), rings.at(-1)[i], rings.at(-1)[(i + 1) % n]], f.n);
  box(o, 'wood', P, 0, A.walkFloor, -1.4, 0.68, 0.37, 1.75, rgb('666052'));
  if (d > 0)
    for (const s of [-1, 1])
      box(o, 'wood', P, s * 0.34, A.walkFloor + 0.15, -1.7, 0.14, 0.42, 0.55, rgb('605d50'));
}
function bartizan(o, d) {
  const c = top[11],
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 20,
    levels = [
      [3.8, 0.14],
      [4.2, 0.72],
      [4.35, 0.83],
      [4.43, 0.68],
      [6.1, 0.68],
    ],
    rings = levels.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => [
        c[0] + r * Math.sin((i * 2 * Math.PI) / n),
        F + y,
        c[1] + r * Math.cos((i * 2 * Math.PI) / n),
      ]),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(
        o,
        'plaster',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [rings[j][i][0] - c[0], 0, rings[j][i][2] - c[1]],
      );
    }
  const bands = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 9;
  let last = rings.at(-1);
  for (let j = 1; j <= bands; j++) {
    const a = (j * (Math.PI / 2 - 0.035)) / bands,
      r = 0.72 * Math.cos(a),
      y = 6.1 + 0.72 * Math.sin(a),
      rr = Array.from({ length: n }, (_, i) => [
        c[0] + r * Math.sin((i * 2 * Math.PI) / n),
        F + y,
        c[1] + r * Math.cos((i * 2 * Math.PI) / n),
      ]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(
        o,
        'plaster',
        [last[i], last[k], rr[k], rr[i]],
        [rr[i][0] - c[0], rr[i][1] - F - 6.1, rr[i][2] - c[1]],
      );
    }
    last = rr;
  }
  beam(o, 'trim', [c[0], F + 6.8, c[1]], [c[0], F + 7.15, c[1]], 0.08, d === 0 ? 4 : 8);
  if (d) {
    const f = frame([c[0] - 0.35, c[1] + 0.67], [c[0] + 0.35, c[1] + 0.67]);
    panel(o, 'wood', arch(0.35, 4.45, 0.48, 1.3, d === 3 ? 10 : 5), f.P, [0, 0, 1]);
  }
}
function build(o, _f, d = 3) {
  for (let i = 0; i < R.length; i++) wall(o, d, i);
  flat(o, 'rubble', R, 0, [], false);
  courtyard(o, d);
  for (const r of p.parameters.rooms) room(o, r, d);
  doorway(o, d);
  for (const c of p.parameters.cannonSlots) cannon(o, d, c);
  bartizan(o, d);
}
export const santaRosaSkyline = (o, f) => build(o, f, 0),
  santaRosaDistrict = (o, f) => build(o, f, 1),
  santaRosaStreet = (o, f) => build(o, f, 2),
  santaRosaCloseup = (o, f) => build(o, f, 3);
export const santaRosaModel = {
  id: 'santa_rosa_de_la_eminencia_castle',
  key: 'santa_rosa_de_la_eminencia_castle',
  cell: 'd9/d9f',
  recipe: 'structure-santa-rosa-castle.mjs',
  title: 'Santa Rosa de la Eminencia Castle, La Asunción',
  category: 'palace-castle-fort',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-57, 40, 68],
  lookAt: [0, F + 3.9, 0],
  portableGroundY: F - 0.12,
  mediumFiContext: { scale: 1, groundY: F - 0.12 },
  qaCameras: [
    {
      name: 'whole-native19-control-bastions-and-complete-open-fort',
      position: [-52, 48, 64],
      lookAt: [0, F + 3.5, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'front-battered-rubble-wall-gatedoor-crest-and-tapered-brickstairs',
      position: [-27, 12, 36],
      lookAt: W(frontLen * A.gateStation, 3.8, 0),
    },
    {
      name: 'open-courtyard-lower-floor-roofed-barracks-true-arch-and-guardroom',
      position: [15, 28, -20],
      lookAt: W(5, 4.8, 10),
    },
    {
      name: 'splayed-physical-embrasure-and-hollow-cannon-barrel',
      position: [29, 10, 32],
      lookAt: [12.5, F + 4.9, 17.5],
    },
    {
      name: 'northeastern-domed-bartizan-and-native-bastion-returns',
      position: [37, 18, -31],
      lookAt: [20, F + 5, -9.6],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-santa-rosa-castle.mjs',
    level: 'skyline',
    export: 'santaRosaSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'santaRosaDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'santaRosaStreet', errorMeters: 0.13, surfaces },
      closeup: { export: 'santaRosaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole native19-control fort/bastions/batteredroughrubblecurtain/ochreparapets/realopenembrasures/fiveintrinsiccannons/wholelowercourtyardandraisedwalk/Ushapedlowbarracks/trueopenarchpassage/higherguardroom/domedbartizan/realrecessedwoodgate/cresttablet/taperedbrickentrystair. Interiorroomplan/heights/batter/roofprofiles/cannoncensus/gatestation/bartizanlocation/hiddenwindows original boundedphotoestimates, notmetricpanorama projection or privateinterior. Finecrest is simplified originalrelief withoutlettering.',
    'Five exactpublishedQualla creatorOwn/selfCC0 originals byWilfredor/ThePhotographer individuallyinspected/nativeSHA1matched. No supplemental photos/generatedbitmap/photo textures/copiedmesh/protectedplan/rightsmetadata repair. Otherislandforts/roads/trees/hill/people/antenna/flags/lettering excluded.',
    'Six actualmaterialcombinations maximum: stone_drywall/plaster_lime/clay_fired/stone_limestone_raw plusopaquewood/metal palettes. Physicalbarreltile ribs/windowbars/doorstuds/hollowcannonbores atnear levels; skyline preserveswholefort/court/roof/arch/gate/cannons withreducedprofiles.',
    'Independent400m129x129/16641values/two rawTerrariumtiles frozen before allfloors/sections/geometry. Floor0 relativefixed96.5453m datum unsurveyed; exacthillfoundation/gatestep/plazaattachment unresolved. No fieldfit/flatten/reacquire, geographicpreview/replaceFootprintfalse. Intrinsiccourt/gunwalk arestructure; no hill/road/siteplate.',
  ],
};
