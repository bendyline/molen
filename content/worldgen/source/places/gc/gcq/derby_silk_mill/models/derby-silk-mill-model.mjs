/** Whole historic mill and current intrinsic mapped extensions; original architectural exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  R = f.geometry.outline.slice(0, -1),
  parts = f.features.slice(1),
  TAU = 2 * Math.PI;
const C = {
  brick: rgb('9a6950'),
  trim: rgb('b7b1a3'),
  metal: rgb('3d4341'),
  glass: rgb('64726e'),
  roof: rgb('505858'),
  frame: rgb('b7c2b8'),
};
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.04 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.92, metallic: 0 },
};
const G = ([x, y, z]) => [x, F + y, z],
  GN = (n) => n,
  sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const recessEvidence = [],
  nativeEvidence = [],
  lanternEvidence = [],
  entryEvidence = [],
  balconyEvidence = [];
function facade(a, b, name) {
  const u = unit(sub(b, a)),
    n = [u[1], -u[0]],
    L = Math.hypot(...sub(b, a)),
    M = ([x, y, z]) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z];
  return { a, b, u, n, L, name, M };
}
function T(o, k, q, n, col = C[k]) {
  q = q.map(G).map((q) => q.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0])),
    N = n && GN(n);
  if (Math.hypot(...c) < 1e-8) throw Error('Collapsed authored face');
  if (N && dot(c, N) < 0) [q[1], q[2]] = [q[2], q[1]];
  const normal = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normal,
    q.map((q) => (Math.abs(normal[1]) > 0.8 ? [q[0], q[2]] : [q[0] + q[2], q[1]])),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function triangulate(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-9) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-9 &&
            cr(r[b], r[c], r[k]) >= -1e-9 &&
            cr(r[c], r[a], r[k]) >= -1e-9,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid source ring');
  }
  out.push(ids);
  return out;
}
function cap(o, k, r, y, up = true, col) {
  for (const ids of triangulate(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function poly(o, k, r, y0, y1, col) {
  if (r.length < 3) return;
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r, y0, false, col);
  cap(o, k, r, y1, true, col);
}
function tube(o, k, a, b, r, N = 6, R = r, col) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    rad = (i) => u.map((x, j) => x * Math.cos((i * TAU) / N) + v[j] * Math.sin((i * TAU) / N)),
    P = (at, i, r) => at.map((x, j) => x + rad(i)[j] * r);
  for (let i = 0; i < N; i++) {
    Q(o, k, [P(a, i, r), P(a, i + 1, r), P(b, i + 1, R), P(b, i, R)], rad(i + 0.5), col);
    T(
      o,
      k,
      [a, P(a, i + 1, r), P(a, i, r)],
      d.map((x) => -x),
      col,
    );
    T(o, k, [b, P(b, i, R), P(b, i + 1, R)], d, col);
  }
}
function cone(o, k, r, y0, y1, col) {
  const center = [
    r.reduce((s, q) => s + q[0], 0) / r.length,
    y1,
    r.reduce((s, q) => s + q[1], 0) / r.length,
  ];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      mid = [(a[0] + b[0]) / 2 - center[0], 0, (a[1] + b[1]) / 2 - center[2]];
    T(o, k, [[a[0], y0, a[1]], [b[0], y0, b[1]], center], mid, col);
  }
  cap(o, k, r, y0, false, col);
}
function archCurve(t, pointed) {
  return pointed
    ? Math.sqrt(Math.max(0, 1 - (1 - Math.min(t, 1 - t)) * (1 - Math.min(t, 1 - t)))) /
        Math.sqrt(0.75)
    : Math.sqrt(Math.max(0, 1 - 4 * (t - 0.5) * (t - 0.5)));
}
/** Front face, physical deep reveals and a back closure only when explicitly requested. */
function archPanel(
  o,
  {
    x0,
    x1,
    y0,
    y1,
    front,
    depth,
    width,
    bottom,
    height,
    pointed = true,
    N = 6,
    glass = false,
    back = false,
    detail = false,
    label = 'opening',
    openingCenter,
    riseRatio = 0.23,
    rect = false,
    backSurface = 'glass',
    backColor = C.glass,
    k = 'brick',
    M = (q) => q,
  },
) {
  N = rect ? 1 : N;
  const center = openingCenter ?? (x0 + x1) / 2,
    l = center - width / 2,
    r = center + width / 2,
    rise = rect ? 0 : width * riseRatio,
    shoulder = bottom + height - rise,
    behind = front - depth,
    P = (x, y, z) => M([x, y, z]),
    direction = (n) => sub(M(n), M([0, 0, 0]));
  if (shoulder <= bottom) throw Error('Opening rise exceeds whole height');
  function solid(a, b, c, d) {
    if (d - c < 1e-6) return;
    const rr = [
        [a, c, front],
        [b, c, front],
        [b, d, front],
        [a, d, front],
      ],
      bb = rr.map((q) => [q[0], q[1], behind]);
    Q(o, k, rr.map(M), direction([0, 0, 1]));
    Q(o, k, bb.map(M), direction([0, 0, -1]));
  }
  for (const [q, n] of [
    [
      [P(x0, y0, front), P(x0, y1, front), P(x0, y1, behind), P(x0, y0, behind)],
      [-1, 0, 0],
    ],
    [
      [P(x1, y0, front), P(x1, y1, front), P(x1, y1, behind), P(x1, y0, behind)],
      [1, 0, 0],
    ],
    [
      [P(x0, y0, front), P(x1, y0, front), P(x1, y0, behind), P(x0, y0, behind)],
      [0, -1, 0],
    ],
    [
      [P(x0, y1, front), P(x1, y1, front), P(x1, y1, behind), P(x0, y1, behind)],
      [0, 1, 0],
    ],
  ])
    Q(o, k, q, direction(n));
  if (l > x0) solid(x0, l, y0, y1);
  if (r < x1) solid(r, x1, y0, y1);
  if (bottom > y0) solid(l, r, y0, bottom);
  for (let j = 0; j < N; j++) {
    const a = l + (width * j) / N,
      b = l + (width * (j + 1)) / N,
      ya = shoulder + rise * archCurve(j / N, pointed),
      yb = shoulder + rise * archCurve((j + 1) / N, pointed);
    Q(
      o,
      k,
      [P(a, ya, front), P(b, yb, front), P(b, y1, front), P(a, y1, front)],
      direction([0, 0, 1]),
    );
    Q(
      o,
      k,
      [P(a, ya, behind), P(b, yb, behind), P(b, y1, behind), P(a, y1, behind)],
      direction([0, 0, -1]),
    );
    Q(
      o,
      k,
      [P(a, ya, front), P(b, yb, front), P(b, yb, behind), P(a, ya, behind)],
      direction([yb - ya, -(b - a), 0]),
    );
    if (detail)
      Q(
        o,
        'brick',
        [
          P(a, ya, front + 0.025),
          P(b, yb, front + 0.025),
          P(b, yb + 0.13, front + 0.025),
          P(a, ya + 0.13, front + 0.025),
        ],
        direction([0, 0, 1]),
      );
  }
  for (const [x, sign] of [
    [l, 1],
    [r, -1],
  ])
    Q(
      o,
      k,
      [P(x, bottom, front), P(x, shoulder, front), P(x, shoulder, behind), P(x, bottom, behind)],
      direction([sign, 0, 0]),
    );
  if (bottom > y0)
    Q(
      o,
      k,
      [P(l, bottom, front), P(r, bottom, front), P(r, bottom, behind), P(l, bottom, behind)],
      direction([0, 1, 0]),
    );
  if (glass || back) {
    const q = [
      [l, bottom, behind + 0.015],
      [r, bottom, behind + 0.015],
      [r, shoulder, behind + 0.015],
    ];
    for (let j = N - 1; j >= 0; j--) {
      const x = l + (width * j) / N,
        y = shoulder + rise * archCurve(j / N, pointed);
      q.push([x, y, behind + 0.015]);
    }
    for (let i = 1; i < q.length - 1; i++)
      T(o, backSurface, [q[0], q[i], q[i + 1]].map(M), direction([0, 0, 1]), backColor);
  }
  recessEvidence.push({
    label,
    center: [center, bottom + Math.min(height * 0.5, 2), front - depth * 0.5],
    width,
    depth,
    closedBack: glass || back,
    transform: M,
  });
}

function clean(r) {
  r = r.map((q) => q.slice());
  let change = true;
  while (change && r.length > 3) {
    change = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        c = r[(i + 1) % r.length],
        v = sub(c, a),
        L = Math.hypot(...v),
        dist = Math.abs((b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]) / L;
      if (Math.hypot(...sub(a, b)) < 0.09 || dist < 0.035) {
        r.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return r;
}
function localBox(o, k, lo, hi, M, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi,
    origin = M([0, 0, 0]),
    n = (v) => sub(M(v), origin);
  for (const [q, N] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
      [0, -1, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
        [x, y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, Y, z],
        [X, Y, Z],
        [X, y, Z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 0, 1],
    ],
  ])
    Q(o, k, q.map(M), n(N), col);
}
function clip(r, n, d, keep = true) {
  const out = [],
    dist = (q) => (dot(q, n) - d) * (keep ? 1 : -1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      da = dist(a),
      db = dist(b);
    if (da >= -1e-8) out.push(a);
    if (da >= -1e-8 !== db >= -1e-8) out.push(lerp(a, b, da / (da - db)));
  }
  return out.filter((q, i) => !i || Math.hypot(...sub(q, out[i - 1])) > 1e-7);
}
function roof(o, r, eave, top, shape, axis, gableSurface = 'brick') {
  if (shape === 'flat') {
    cap(o, 'roof', r, eave + 0.05);
    return;
  }
  const u = unit(axis),
    n = [u[1], -u[0]],
    ds = r.map((q) => dot(q, n)),
    lo = Math.min(...ds),
    hi = Math.max(...ds),
    mid = (lo + hi) / 2,
    along = r.map((q) => dot(q, u)),
    a = Math.min(...along),
    b = Math.max(...along),
    cut = Math.min((hi - lo) / 2, (b - a) * 0.35),
    hip = shape === 'hipped',
    cuts = [
      [n, mid],
      ...(hip
        ? [
            [u, a + cut],
            [u, b - cut],
          ]
        : []),
    ];
  const H = (q) =>
    eave +
    (top - eave) *
      Math.max(
        0,
        Math.min(
          1 - Math.abs((dot(q, n) - mid) / ((hi - lo) / 2)),
          ...(hip ? [(dot(q, u) - a) / cut, (b - dot(q, u)) / cut] : [1]),
        ),
      );
  let cells = [r];
  for (const [n, d] of cuts) {
    const next = [];
    for (const cell of cells)
      for (const keep of [true, false]) {
        const c = clip(cell, n, d, keep);
        if (c.length >= 3 && Math.abs(area(c)) > 1e-7) next.push(c);
      }
    cells = next;
  }
  for (const cell of cells) cap(o, 'roof', cell, H);
  // Split boundary edges at every ridge/hip crease, closing their real vertical roof-end faces.
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const aa = r[i],
      bb = r[(i + 1) % r.length],
      ts = [0, 1];
    for (const [n, d] of cuts) {
      const x = dot(aa, n) - d,
        y = dot(bb, n) - d;
      if (x * y < -1e-10) ts.push(x / (x - y));
    }
    ts.sort((a, b) => a - b);
    for (let j = 0; j < ts.length - 1; j++) {
      const a = lerp(aa, bb, ts[j]),
        b = lerp(aa, bb, ts[j + 1]),
        ya = H(a),
        yb = H(b),
        normal = [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        a0 = [a[0], eave, a[1]],
        b0 = [b[0], eave, b[1]],
        at = [a[0], ya, a[1]],
        bt = [b[0], yb, b[1]],
        col = gableSurface === 'glass' ? rgb('6c8185') : C.brick;
      if (ya <= eave + 1e-6 && yb <= eave + 1e-6) continue;
      if (ya <= eave + 1e-6) T(o, gableSurface, [a0, b0, bt], normal, col);
      else if (yb <= eave + 1e-6) T(o, gableSurface, [a0, b0, at], normal, col);
      else Q(o, gableSurface, [a0, b0, bt, at], normal, col);
    }
  }
}
function wall(o, fa, bottom, top, col = C.brick, k = 'brick') {
  Q(
    o,
    k,
    [fa.M([0, bottom, 0]), fa.M([fa.L, bottom, 0]), fa.M([fa.L, top, 0]), fa.M([0, top, 0])],
    [fa.n[0], 0, fa.n[1]],
    col,
  );
}
function faces(r, id) {
  const rr = clean(r);
  if (area(rr) < 0) rr.reverse();
  return rr.map((a, i) => facade(a, rr[(i + 1) % rr.length], `${id}:${i}`));
}
function mullions(o, fa, x, y, w, h, lod, depth) {
  if (lod < 1) return;
  if (lod === 1) {
    const z = -depth + 0.055;
    localBox(
      o,
      'metal',
      [x - 0.03, y, z - 0.03],
      [x + 0.03, y + h - 0.12, z + 0.03],
      fa.M,
      C.frame,
    );
    localBox(o, 'trim', [x - w / 2 - 0.1, y - 0.11, -depth], [x + w / 2 + 0.1, y, 0.16], fa.M);
    return;
  }
  const z = -depth + 0.055,
    b = 0.035;
  localBox(o, 'metal', [x - w / 2, y, z - b], [x - w / 2 + 0.06, y + h, z + b], fa.M, C.frame);
  localBox(o, 'metal', [x + w / 2 - 0.06, y, z - b], [x + w / 2, y + h, z + b], fa.M, C.frame);
  localBox(o, 'metal', [x - 0.025, y, z - b], [x + 0.025, y + h - 0.12, z + b], fa.M, C.frame);
  for (const t of lod >= 3 ? [0.25, 0.5, 0.75] : [0.5])
    localBox(
      o,
      'metal',
      [x - w / 2, y + h * t, z - b],
      [x + w / 2, y + h * t + 0.045, z + b],
      fa.M,
      C.frame,
    );
  localBox(o, 'trim', [x - w / 2 - 0.1, y - 0.11, -depth], [x + w / 2 + 0.1, y, 0.16], fa.M);
}
function windowPanel(o, fa, x0, x1, y0, y1, bottom, height, lod, label, door = false) {
  const w = Math.min((x1 - x0) * 0.55, door ? 1.55 : 1.22),
    x = (x0 + x1) / 2,
    depth = door ? 0.52 : A.windowReveal;
  archPanel(o, {
    x0,
    x1,
    y0,
    y1,
    front: 0,
    depth,
    width: w,
    bottom,
    height,
    pointed: false,
    N: [2, 2, 4, 10][lod],
    glass: true,
    detail: lod >= 2,
    label,
    k: 'brick',
    riseRatio: 0.18,
    M: fa.M,
    backColor: door ? rgb('333b38') : C.glass,
  });
  mullions(o, fa, x, bottom, w, height, lod, depth);
  return { x, width: w, depth };
}
function balcony(o, fa, x, y, w, lod) {
  if (lod === 0) return;
  const z = 0.8;
  localBox(o, 'metal', [x - w / 2 - 0.14, y - 0.12, -0.08], [x + w / 2 + 0.14, y, z], fa.M);
  for (const side of [-1, 1]) {
    const xx = x + side * (w / 2 + 0.08);
    tube(
      o,
      'metal',
      fa.M([xx, y - 0.85, 0.06]),
      fa.M([xx, y - 0.12, z - 0.1]),
      0.035,
      lod >= 3 ? 6 : 4,
    );
    tube(o, 'metal', fa.M([xx, y, z]), fa.M([xx, y + 1, z]), 0.028, 4);
    tube(o, 'metal', fa.M([xx, y + 1, 0]), fa.M([xx, y + 1, z]), 0.025, 4);
  }
  tube(
    o,
    'metal',
    fa.M([x - w / 2 - 0.08, y + 1, z]),
    fa.M([x + w / 2 + 0.08, y + 1, z]),
    0.028,
    4,
  );
  for (let i = 0; i <= 4; i++)
    tube(
      o,
      'metal',
      fa.M([x - w / 2 + (w * i) / 4, y, z]),
      fa.M([x - w / 2 + (w * i) / 4, y + 1, z]),
      0.018,
      4,
    );
  balconyEvidence.push({ center: fa.M([x, y, z / 2]), width: w });
}
function inside(r, q) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function coveredByNeighbor(q, id) {
  return parts.some((p) => {
    const k = Number(p.id.split('/')[1]);
    if (k === id || [801297664, 801297667].includes(k)) return false;
    return q[1] < Number(p.properties.height) - 0.5 && inside(p.outline.slice(0, -1), [q[0], q[2]]);
  });
}
function brickBody(o, part, lod) {
  const id = Number(part.id.split('/')[1]),
    r = part.outline.slice(0, -1),
    t = part.properties,
    top = Number(t.height) - (Number(t['roof:height']) || 0);
  cap(o, 'brick', r, A.plinthTop, false);
  cap(o, 'brick', r, top, true);
  const fas = faces(r, id);
  for (const fa of fas) {
    const entry = id === 801297665 && fa.n[1] > 0.85 && fa.L < 3;
    if (entry) {
      archPanel(o, {
        x0: 0,
        x1: fa.L,
        y0: A.plinthTop,
        y1: top,
        front: 0,
        depth: 0.8,
        width: Math.min(1.6, fa.L * 0.83),
        bottom: A.entryThreshold,
        height: 2.65,
        rect: true,
        glass: true,
        label: 'historic-closed-entry',
        M: fa.M,
        k: 'brick',
        backColor: rgb('313a38'),
      });
      entryEvidence.push({ kind: 'historic', center: fa.M([fa.L / 2, 1.5, 0]), depth: 0.8 });
      if (lod >= 2) {
        localBox(o, 'metal', [0.08, 2.8, 0.02], [fa.L - 0.08, 3.06, 0.2], fa.M);
        localBox(o, 'trim', [0, 0, 0], [fa.L, 0.12, 0.6], fa.M);
      }
      continue;
    }
    const isTower = id === 801297659,
      isPavilion = id === 801297665,
      isStack = id === 801297666;
    if (lod === 0 || isStack || fa.L < 1.7 || (lod === 1 && !isTower && !isPavilion)) {
      wall(o, fa, A.plinthTop, top);
      continue;
    }
    let rows = isTower
      ? A.windowRows
      : isPavilion
        ? [0.65, 4.1, 7.3]
        : [0.75, 4.15, 7.55, 10.95, 14.35].filter((y) => y + 2 < top);
    const featured = isTower || isPavilion;
    if (lod === 1) rows = isTower ? [7.6] : [4.1];
    if (lod === 2 && !featured) rows = rows.filter((_, i) => i % 2 === 0);
    const count = Math.max(
        1,
        Math.floor(
          fa.L / (isPavilion ? 3.0 : featured ? 2.0 : lod === 1 ? 12 : lod === 2 ? 6.5 : 4.5),
        ),
      ),
      bw = fa.L / count;
    let prev = A.plinthTop;
    for (let j = 0; j < rows.length; j++) {
      const y = rows[j],
        end = j === rows.length - 1 ? top : Math.min(top, y + 3.25),
        h = isTower && j === 0 ? 1.6 : 1.95;
      for (let i = 0; i < count; i++) {
        const door = isPavilion && fa.n[1] > 0.8 && y > 3.5 && y < 5 && i === 0;
        const probe = fa.M([(i + 0.5) * bw, y + h * 0.5, 0.045]);
        if (coveredByNeighbor(probe, id)) {
          Q(
            o,
            'brick',
            [
              fa.M([i * bw, prev, 0]),
              fa.M([(i + 1) * bw, prev, 0]),
              fa.M([(i + 1) * bw, end, 0]),
              fa.M([i * bw, end, 0]),
            ],
            [fa.n[0], 0, fa.n[1]],
          );
          continue;
        }
        const win = windowPanel(
          o,
          fa,
          i * bw,
          (i + 1) * bw,
          prev,
          end,
          y,
          h,
          lod,
          door ? 'pavilion-closed-upper-door' : 'segmental-window',
          door,
        );
        if (door) balcony(o, fa, win.x, A.balconyFloor, win.width, lod);
      }
      prev = end;
    }
    if (rows.length === 0) wall(o, fa, A.plinthTop, top);
  }
  if (t['roof:shape'])
    roof(
      o,
      r,
      top,
      Number(t.height),
      t['roof:shape'],
      id === 801297657 || id === 801297662 ? [0.988, -0.155] : [0.215, 0.976],
    );
}
function glassAtrium(o, part, lod) {
  const r = part.outline.slice(0, -1),
    H = Number(part.properties.height);
  cap(o, 'metal', r, 0.24, false);
  cap(o, 'roof', r, H);
  for (const fa of faces(r, 'atrium')) {
    const front = fa.n[1] > 0.85 && fa.L > 5;
    if (front) {
      archPanel(o, {
        x0: 0,
        x1: fa.L,
        y0: 0,
        y1: 3.15,
        front: 0,
        depth: A.entryReveal,
        width: Math.min(2.8, fa.L * 0.42),
        bottom: A.entryThreshold,
        height: 2.55,
        rect: true,
        glass: true,
        k: 'glass',
        label: 'current-closed-atrium-entry',
        M: fa.M,
        backColor: rgb('35413e'),
      });
      entryEvidence.push({
        kind: 'current',
        center: fa.M([fa.L / 2, 1.5, 0]),
        depth: A.entryReveal,
      });
      Q(
        o,
        'glass',
        [fa.M([0, 3.15, 0]), fa.M([fa.L, 3.15, 0]), fa.M([fa.L, H, 0]), fa.M([0, H, 0])],
        [fa.n[0], 0, fa.n[1]],
        rgb('657a7f'),
      );
    } else wall(o, fa, 0.24, H, rgb('61767a'), 'glass');
    if (lod >= 1) {
      const n = Math.max(1, Math.floor(fa.L / (lod === 1 ? 10 : lod === 2 ? 5 : 2.3)));
      for (let i = 0; i <= n; i++) {
        const x = (fa.L * i) / n;
        localBox(
          o,
          'metal',
          [x - 0.045, front ? 3.1 : 0.24, -0.03],
          [x + 0.045, H + 0.08, 0.08],
          fa.M,
        );
      }
      for (const y of lod === 1 ? [H] : [3.1, 6, 9, H])
        localBox(o, 'metal', [0, y, -0.04], [fa.L, y + 0.1, 0.1], fa.M);
    }
  }
}
function lantern(o, lod) {
  const part = parts.find((p) => p.id === 'way/801297664'),
    r = part.outline.slice(0, -1);
  poly(o, 'roof', r, 17, 17.2);
  for (const fa of faces(r, 'open-lantern')) {
    const width = fa.L * 0.67;
    archPanel(o, {
      x0: 0,
      x1: fa.L,
      y0: 17.2,
      y1: A.lanternTop,
      front: 0,
      depth: lod === 0 ? 0.15 : 0.24,
      width,
      bottom: 17.4,
      height: 2.65,
      pointed: false,
      N: [2, 2, 4, 10][lod],
      glass: false,
      back: false,
      label: 'open-octagonal-lantern',
      M: fa.M,
      k: 'brick',
      riseRatio: 0.5,
      detail: lod >= 3,
    });
    lanternEvidence.push({
      center: fa.M([fa.L / 2, 18.55, -0.3]),
      normal: [fa.n[0], 0, fa.n[1]],
      outer: fa.M([fa.L / 2, 18.55, 0.08]),
    });
  }
  const roofPart = parts.find((p) => p.id === 'way/801297667'),
    rr = roofPart.outline.slice(0, -1);
  poly(o, 'roof', rr, 20.45, 20.58);
  cone(o, 'roof', rr, 20.58, A.towerRoofTop);
  const cen = [
    rr.reduce((s, p) => s + p[0], 0) / rr.length,
    rr.reduce((s, p) => s + p[1], 0) / rr.length,
  ];
  if (lod >= 1) tube(o, 'metal', [cen[0], 21.95, cen[1]], [cen[0], 22.55, cen[1]], 0.025, 4);
  if (lod >= 2)
    for (const fa of faces(rr, 'eaves')) {
      const n = Math.max(1, Math.floor(fa.L / 0.7));
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) * fa.L) / n;
        tube(
          o,
          'metal',
          fa.M([x, 20.1, -0.16]),
          fa.M([x, 20.47, 0.05]),
          0.04,
          4,
          0.04,
          rgb('41423b'),
        );
      }
    }
}
export function buildDerbySilkMill(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  nativeEvidence.length = 0;
  lanternEvidence.length = 0;
  entryEvidence.length = 0;
  balconyEvidence.length = 0;
  poly(o, 'brick', R, 0, A.plinthTop, rgb('4c4e46'));
  for (const q of R) nativeEvidence.push(q.slice());
  for (const part of parts) {
    const id = Number(part.id.split('/')[1]);
    if ([801297664, 801297667, 801297668].includes(id)) continue;
    if (id === 942372140) glassAtrium(o, part, lod);
    else brickBody(o, part, lod);
  }
  const hall = parts.find((p) => p.id === 'way/801297668'),
    r = hall.outline.slice(0, -1);
  roof(o, r, 11.5, 15, 'gabled', [0.215, 0.976], 'glass');
  // Native glass-ended roof: the two gable faces have closed opaque glazing and a structural grid.
  const u = unit([0.215, 0.976]);
  for (const fa of faces(r, 'hall-gable'))
    if (Math.abs(dot(fa.n, u)) > 0.7) {
      const a = fa.M([0, 11.5, 0]),
        b = fa.M([fa.L, 11.5, 0]),
        c = fa.M([fa.L / 2, 15, 0.025]);
      if (lod >= 1) {
        tube(o, 'metal', a, c, 0.055, 4);
        tube(o, 'metal', b, c, 0.055, 4);
        for (const t of lod >= 2 ? [0.25, 0.5, 0.75] : [0.5]) {
          const q = lerp(a, b, t),
            h = 3.5 * (1 - Math.abs(2 * t - 1));
          tube(o, 'metal', q, [q[0], 11.5 + h, q[2]], 0.04, 4);
        }
      }
    }
  lantern(o, lod);
}
export const derbySilkMillSkyline = (o) => buildDerbySilkMill(o, null, 0),
  derbySilkMillDistrict = (o) => buildDerbySilkMill(o, null, 1),
  derbySilkMillStreet = (o) => buildDerbySilkMill(o, null, 2),
  derbySilkMillCloseup = (o) => buildDerbySilkMill(o, null, 3);
export const derbySilkMillModel = {
  id: 'derby_silk_mill',
  key: 'derby_silk_mill',
  cell: 'gc/gcq',
  title: 'Derby Silk Mill',
  wikidataId: 'Q839047',
  category: p.category,
  recipe: 'derby-silk-mill-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildDerbySilkMill,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Derby Silk Mill/Museum of Making: native33control concave envelope and thirteen intrinsic building/roof plans, brick square tower/actually open octagonal arched lantern/deep slate eaves/cap, real segmental window recesses/shut glazing/mullions/sills, hipped river-side pavilion/shut upper balcony door/open metal rail, current mapped glazed atrium/recessed shut entry and glazed-ended gabled long mill hall, full rear brick wings/roofs/native narrow stack. Cleared published2009creatorPD-self front establishes historic details; current glass scope/materials/heights from native metadata, precise modern grid/hidden elevations/roof profiles/census bounded estimates. No supplemental photography, murals/artwork/text/logos/neighbors/park/river/bridge/interiors/people copied.',
  camera: [-65, 38, 95],
  lookAt: [0, 10, 0],
  portableGroundY: F - 0.18,
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  qaCameras: [
    { name: 'whole-rear-wings-and-native-parts', position: [48, 36, -74], lookAt: [0, 10, -10] },
    {
      name: 'open-octagonal-lantern-and-slate-cap',
      position: [23, 20, 42],
      lookAt: [15, 19.2, 27.8],
    },
    {
      name: 'historic-segmental-windows-and-closed-upper-balcony-door',
      position: [30, 5.8, 44],
      lookAt: [21, 5.2, 30],
    },
    { name: 'current-mapped-glazed-entry-and-gable', position: [-6, 7, 48], lookAt: [8, 6, 24] },
    {
      name: 'whole-native-envelope-and-component-roofs',
      position: [0, 110, 10],
      lookAt: [0, 10, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/derby-silk-mill-runtime-overlay.mjs',
    level: 'skyline',
    export: 'derbySilkMillSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'derbySilkMillDistrict', errorMeters: 1, surfaces },
      street: { export: 'derbySilkMillStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'derbySilkMillCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'One exact publishedQualla2009Charlesdrakew own/PD-self original individually inspected/nativeSHA1 matched/passed unchanged imagery policy. Supplemental modern standaloneCC0 photographs unselected after inventory guard; no source metadata repair or bypass. Precise modern glazing grid/hidden rear/currentfinish/roof profile/window census are bounded original estimates, with current physical component scope/materials/heights from native mapped metadata. No copied mural/artwork/logos/text/photo pixels/interiors/neighbors/river/park/bridge.',
    'Original400m129x12916641sample field/one rawtile fixedSW48.1847m provider-relative datum frozen before all floors/sections/geometry. No terrainfit/flatten/reacquire/modelraising. Preview/replacementfalse/exact contact unresolved. Flat isolated ground and synthetic neighbors are review fixtures.',
  ],
};
