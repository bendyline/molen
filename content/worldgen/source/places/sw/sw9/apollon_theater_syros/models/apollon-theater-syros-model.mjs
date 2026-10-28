/** Whole Apollon Municipal Theater, Syros, with native projecting three-bay marble frontage. */
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
  TAU = 2 * Math.PI;
const C = {
  wall: rgb('dbb9a6'),
  cream: rgb('e3decb'),
  marble: rgb('d6d8d2'),
  wood: rgb('713c35'),
  glass: rgb('697c80'),
  roof: rgb('737a77'),
  metal: rgb('72756b'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.8, metallic: 0 },
  wood: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metallic: 0.025 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.15 },
};
const G = ([x, y, z]) => [x, F + y, z],
  GN = (n) => n,
  sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const recessEvidence = [],
  nativeEvidence = [],
  entryEvidence = [],
  pilasterEvidence = [];
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
    k = 'marble',
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
        'marble',
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
export const frontFrame = facade(R[2], R[3], 'projecting-three-bay-front');
function coat(o, col) {
  return {
    addTriangle: (slot, ref, p, n, uv, color) =>
      o.addTriangle(slot, ref, p, n, uv, slot === 'wall' ? col : color),
  };
}
function panel(
  o,
  fa,
  lod,
  {
    x0 = 0,
    x1 = fa.L,
    y0 = A.landingY,
    y1 = A.lowerTop,
    bottom = A.landingY,
    height = A.doorHeight,
    width = A.doorWidth,
    depth = A.doorReveal,
    rect = false,
    k = 'marble',
    door = false,
    label = 'closed-opening',
    color,
  } = {},
) {
  const receiver = color ? coat(o, color) : o,
    N = rect ? 1 : [2, 4, 10, 24][lod],
    x = (x0 + x1) / 2,
    l = x - width / 2,
    r = x + width / 2,
    rise = rect ? 0 : width * 0.5,
    shoulder = bottom + height - rise,
    behind = -depth + 0.025;
  archPanel(receiver, {
    x0,
    x1,
    y0,
    y1,
    front: 0,
    depth,
    width,
    bottom,
    height,
    pointed: false,
    N,
    glass: true,
    rect,
    k,
    backSurface: door ? 'wood' : 'glass',
    backColor: door ? C.wood : C.glass,
    label,
    M: fa.M,
    riseRatio: 0.5,
  });
  if (!rect) {
    const q = [fa.M([l, shoulder, behind]), fa.M([r, shoulder, behind])];
    for (let j = N - 1; j > 0; j--)
      q.push(
        fa.M([
          l + (width * j) / N,
          shoulder + rise * Math.sqrt(Math.max(0, 1 - 4 * (j / N - 0.5) * (j / N - 0.5))),
          behind,
        ]),
      );
    for (let j = 1; j < q.length - 1; j++)
      T(o, 'glass', [q[0], q[j], q[j + 1]], [fa.n[0], 0, fa.n[1]]);
  }
  if (!rect && !door && lod >= 1) {
    const at = (a, b) => fa.M([a, b, behind + 0.06]),
      normal = [fa.n[0], 0, fa.n[1]];
    for (let j = 0; j < N; j++) {
      const a = (j * Math.PI) / N,
        b = ((j + 1) * Math.PI) / N,
        r0 = width * 0.5 - 0.07,
        r1 = width * 0.5;
      Q(
        o,
        'wood',
        [
          at(x + r0 * Math.cos(a), shoulder + r0 * Math.sin(a)),
          at(x + r0 * Math.cos(b), shoulder + r0 * Math.sin(b)),
          at(x + r1 * Math.cos(b), shoulder + r1 * Math.sin(b)),
          at(x + r1 * Math.cos(a), shoulder + r1 * Math.sin(a)),
        ],
        normal,
      );
    }
    for (const xx of [l, x - 0.025, r - 0.06])
      localBox(o, 'wood', [xx, bottom, behind + 0.015], [xx + 0.05, shoulder, behind + 0.07], fa.M);
    for (const yy of [bottom, shoulder])
      localBox(o, 'wood', [l, yy, behind + 0.015], [r, yy + 0.055, behind + 0.07], fa.M);
  }
  if (door) {
    entryEvidence.push({
      center: fa.M([x + 0.15, bottom + 1.65, -depth * 0.5]),
      outer: fa.M([x + 0.15, bottom + 1.65, 0.08]),
      normal: [fa.n[0], 0, fa.n[1]],
      width,
      height,
      shoulder,
      bottom,
    });
    if (lod >= 1) {
      for (const [a, b] of [
        [l + 0.15, x - 0.1],
        [x + 0.1, r - 0.15],
      ])
        Q(
          o,
          'glass',
          [
            fa.M([a, bottom + 0.65, behind + 0.02]),
            fa.M([b, bottom + 0.65, behind + 0.02]),
            fa.M([b, bottom + 1.95, behind + 0.02]),
            fa.M([a, bottom + 1.95, behind + 0.02]),
          ],
          [fa.n[0], 0, fa.n[1]],
        );
      for (const xx of [l + 0.08, x - 0.035, r - 0.14])
        localBox(
          o,
          'wood',
          [xx, bottom, -depth + 0.015],
          [xx + 0.065, shoulder, -depth + 0.08],
          fa.M,
        );
      for (const yy of [bottom + 0.65, bottom + 1.95, shoulder])
        localBox(o, 'wood', [l, yy, -depth + 0.015], [r, yy + 0.07, -depth + 0.085], fa.M);
      const n = lod === 1 ? 3 : 5;
      for (let j = 1; j < n; j++) {
        const xx = l + (width * j) / n,
          h = rise * Math.sqrt(Math.max(0, 1 - 4 * (j / n - 0.5) * (j / n - 0.5)));
        localBox(
          o,
          'wood',
          [xx - 0.025, shoulder, -depth + 0.02],
          [xx + 0.025, shoulder + h - 0.02, -depth + 0.09],
          fa.M,
        );
      }
      for (const t of lod >= 2 ? [0.3, 0.62] : [0.48]) {
        const yy = shoulder + rise * t,
          half = width * 0.5 * Math.sqrt(1 - t * t);
        localBox(
          o,
          'wood',
          [x - half, yy, -depth + 0.02],
          [x + half, yy + 0.05, -depth + 0.09],
          fa.M,
        );
      }
    }
    if (lod >= 2) {
      for (const yy of [bottom + 0.13, bottom + 2.18])
        for (const xx of [l + 0.14, x + 0.13])
          localBox(
            o,
            'wood',
            [xx, yy, -depth + 0.025],
            [xx + width * 0.37, yy + 0.37, -depth + 0.09],
            fa.M,
            rgb('824c41'),
          );
      for (const side of [-1, 1])
        tube(
          o,
          'metal',
          fa.M([x + side * 0.16, bottom + 0.47, -depth + 0.085]),
          fa.M([x + side * 0.16, bottom + 0.47, -depth + 0.16]),
          0.035,
          lod >= 3 ? 8 : 4,
        );
    }
  }
  if (lod >= 1) {
    const n = [fa.n[0], 0, fa.n[1]];
    if (rect) {
      localBox(
        o,
        'wood',
        [l, bottom, -depth + 0.015],
        [l + 0.06, bottom + height, -depth + 0.085],
        fa.M,
      );
      localBox(
        o,
        'wood',
        [r - 0.06, bottom, -depth + 0.015],
        [r, bottom + height, -depth + 0.085],
        fa.M,
      );
      localBox(
        o,
        'wood',
        [x - 0.025, bottom, -depth + 0.015],
        [x + 0.025, bottom + height, -depth + 0.085],
        fa.M,
      );
      for (const t of lod >= 2 ? [0.17, 0.73, 0.83, 0.93] : [0.78])
        localBox(
          o,
          'wood',
          [l, bottom + height * t, -depth + 0.015],
          [r, bottom + height * t + 0.045, -depth + 0.085],
          fa.M,
        );
      localBox(o, 'marble', [l - 0.1, bottom - 0.1, -depth], [r + 0.1, bottom, 0.16], fa.M);
      if (lod >= 2)
        for (const xx of [l - 0.07, r])
          localBox(
            o,
            'marble',
            [xx, bottom - 0.02, -0.025],
            [xx + 0.07, bottom + height + 0.07, 0.07],
            fa.M,
          );
    }
    if (!rect) {
      for (let j = 0; j < N; j++) {
        const a = (j * Math.PI) / N,
          b = ((j + 1) * Math.PI) / N,
          rr = width * 0.5 + 0.045;
        const P = (t, v) => fa.M([x + v * Math.cos(t), shoulder + v * Math.sin(t), 0.035]);
        Q(o, 'marble', [P(a, rr), P(b, rr), P(b, rr + 0.12), P(a, rr + 0.12)], n);
      }
      for (const xx of [l - 0.07, r])
        localBox(o, 'marble', [xx, bottom, -0.03], [xx + 0.07, shoulder, 0.08], fa.M);
    }
  }
}
function flutedPilasters(o, lod) {
  const fa = frontFrame,
    N = [1, 8, 24, 48][lod],
    count = [0, 4, 6, 8][lod],
    L = fa.L,
    xs = [0.38, L / 3, (L * 2) / 3, L - 0.38];
  for (const x of xs) {
    const ring = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        z = lod === 0 ? 0.19 : 0.19 - (0.065 * (1 - Math.cos(t * TAU * count))) / 2,
        q = fa.M([x - A.pilasterWidth / 2 + A.pilasterWidth * t, 0, z]);
      ring.push([q[0], q[2]]);
    }
    for (const xx of [x + A.pilasterWidth / 2, x - A.pilasterWidth / 2]) {
      const q = fa.M([xx, 0, -0.025]);
      ring.push([q[0], q[2]]);
    }
    poly(o, 'marble', ring, A.landingY + 0.45, A.pilasterTop - 0.16);
    localBox(o, 'marble', [x - 0.61, A.landingY, -0.03], [x + 0.61, A.landingY + 0.18, 0.36], fa.M);
    localBox(
      o,
      'marble',
      [x - 0.49, A.landingY + 0.18, -0.03],
      [x + 0.49, A.landingY + 0.45, 0.28],
      fa.M,
    );
    localBox(
      o,
      'marble',
      [x - 0.53, A.pilasterTop - 0.16, -0.03],
      [x + 0.53, A.pilasterTop, 0.28],
      fa.M,
    );
    if (lod >= 2)
      localBox(
        o,
        'marble',
        [x - 0.62, A.pilasterTop, -0.03],
        [x + 0.62, A.pilasterTop + 0.13, 0.33],
        fa.M,
      );
    pilasterEvidence.push({ x, profileControls: ring.length, flutes: count });
  }
}
function wall(o, fa, y0, y1, k = 'wall', col) {
  Q(
    o,
    k,
    [fa.M([0, y0, 0]), fa.M([fa.L, y0, 0]), fa.M([fa.L, y1, 0]), fa.M([0, y1, 0])],
    [fa.n[0], 0, fa.n[1]],
    col,
  );
}
function roofAndParapet(o, lod) {
  const r = R.map((q) => q.slice());
  if (area(r) < 0) r.reverse();
  const inner = r.map((q) => q.map((v) => v * 0.987));
  cap(o, 'roof', r, A.roofY);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      a = r[i],
      b = r[j],
      c = inner[i],
      d = inner[j],
      n = [b[1] - a[1], 0, a[0] - b[0]],
      fa = facade(a, b, 'parapet'),
      isMarble = Math.hypot(...sub(a, R[2])) < 0.001 && Math.hypot(...sub(b, R[3])) < 0.001;
    wall(o, fa, A.upperTop, A.parapetTop, isMarble ? 'marble' : 'wall');
    Q(
      o,
      'marble',
      [
        [a[0], A.parapetTop, a[1]],
        [b[0], A.parapetTop, b[1]],
        [d[0], A.parapetTop, d[1]],
        [c[0], A.parapetTop, c[1]],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'wall',
      [
        [c[0], A.roofY, c[1]],
        [c[0], A.parapetTop, c[1]],
        [d[0], A.parapetTop, d[1]],
        [d[0], A.roofY, d[1]],
      ],
      n.map((x) => -x),
    );
    if (lod >= 1) {
      localBox(
        o,
        'marble',
        [0, A.corniceTop - 0.16, -0.05],
        [fa.L, A.corniceTop + 0.08, 0.26],
        fa.M,
      );
      if (lod >= 2) {
        const N = Math.max(1, Math.floor(fa.L / (lod === 2 ? 0.9 : 0.42)));
        for (let k = 0; k < N; k++) {
          const x = ((k + 0.5) * fa.L) / N;
          localBox(
            o,
            'marble',
            [x - 0.08, A.corniceTop - 0.36, -0.02],
            [x + 0.08, A.corniceTop - 0.14, 0.22],
            fa.M,
          );
        }
      }
    }
  }
}
export function buildApollonTheater(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  nativeEvidence.length = 0;
  entryEvidence.length = 0;
  pilasterEvidence.length = 0;
  poly(o, 'marble', R, 0, A.landingY);
  nativeEvidence.push(...R.map((q) => q.slice()));
  for (let i = 0; i < R.length; i++) {
    const fa = facade(R[i], R[(i + 1) % R.length], `native-${i}`);
    if (i === 2) {
      for (let j = 0; j < 3; j++) {
        const x0 = (fa.L * j) / 3,
          x1 = (fa.L * (j + 1)) / 3;
        panel(o, fa, lod, { x0, x1, door: true, label: 'closed-arched-main-entry' });
        panel(o, fa, lod, {
          x0,
          x1,
          y0: A.lowerTop,
          y1: A.upperTop,
          bottom: A.upperWindowBottom,
          height: A.upperWindowHeight,
          width: A.upperWindowWidth,
          depth: 0.25,
          rect: true,
          label: 'central-upper-window',
        });
      }
      continue;
    }
    if (i === 0 || i === 4) {
      panel(o, fa, lod, {
        bottom: 1.05,
        height: 3.15,
        width: 1.45,
        depth: 0.24,
        k: 'wall',
        color: C.cream,
        label: 'wing-lower-arched-window',
      });
      panel(o, fa, lod, {
        y0: A.lowerTop,
        y1: A.upperTop,
        bottom: 6.45,
        height: 2.9,
        width: 1.45,
        depth: 0.24,
        rect: true,
        k: 'wall',
        label: 'wing-upper-window',
      });
      if (lod >= 1)
        localBox(o, 'marble', [0, A.lowerTop - 0.08, -0.02], [fa.L, A.lowerTop + 0.06, 0.13], fa.M);
      continue;
    }
    if ([1, 3].includes(i)) {
      wall(o, fa, A.landingY, A.upperTop, 'marble');
      continue;
    }
    if (fa.L < 2.5 || lod === 0) {
      wall(o, fa, A.landingY, A.lowerTop, 'wall', C.cream);
      wall(o, fa, A.lowerTop, A.upperTop);
      continue;
    }
    const N = Math.max(1, Math.floor(fa.L / (lod === 1 ? 10 : 5.8)));
    for (let j = 0; j < N; j++) {
      const x0 = (fa.L * j) / N,
        x1 = (fa.L * (j + 1)) / N;
      panel(o, fa, lod, {
        x0,
        x1,
        bottom: 1.4,
        height: 2.8,
        width: 1.15,
        depth: 0.2,
        rect: true,
        k: 'wall',
        color: C.cream,
        label: 'bounded-side-lower-window',
      });
      panel(o, fa, lod, {
        x0,
        x1,
        y0: A.lowerTop,
        y1: A.upperTop,
        bottom: 6.45,
        height: 2.9,
        width: 1.15,
        depth: 0.2,
        rect: true,
        k: 'wall',
        label: 'bounded-side-upper-window',
      });
    }
  }
  flutedPilasters(o, lod);
  roofAndParapet(o, lod);
  for (let j = 0; j < A.frontSteps; j++) {
    const z = (A.frontSteps - j) * 0.34;
    localBox(
      o,
      'marble',
      [-0.35, 0, z - 0.34],
      [frontFrame.L + 0.35, A.stepRise * (j + 1), z],
      frontFrame.M,
    );
  }
}
export const apollonTheaterSkyline = (o) => buildApollonTheater(o, null, 0),
  apollonTheaterDistrict = (o) => buildApollonTheater(o, null, 1),
  apollonTheaterStreet = (o) => buildApollonTheater(o, null, 2),
  apollonTheaterCloseup = (o) => buildApollonTheater(o, null, 3);
export const apollonTheaterModel = {
  id: 'apollon_theater_syros',
  key: 'apollon_theater_syros',
  cell: 'sw/sw9',
  title: 'Apollon Municipal Theater, Syros',
  wikidataId: 'Q16327379',
  category: p.category,
  recipe: 'apollon-theater-syros-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildApollonTheater,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole actual fifteen-control Apollon Municipal Theater/auditorium envelope with projecting marblethree-bayfront/three realroundarched shutredwood doors/opaqueglazed griddedfanlights/three tall upperwindows, four fullheightflutedmarblepilasters/capitals, peachupper-creamground sidewings/lowerarchedwindowrecesses, intrinsic three shallow frontsteps/dentilcornice/visible lowflatgreyroof/parapet and whole irregularrearbody/opennative side service recess. Two exactpublished2015creatorCC0 front originals; hiddenrear/roof/profiles/census/sections/currentfinefinish bounded estimates. No interior/ceilingpaintings/inscriptions/banner/bust/streetlamps/neighborhotel/publicpaving/trees/people/sourcepixels copied.',
  camera: frontFrame.M([32, 25, 42]),
  lookAt: [0, 6, 0],
  portableGroundY: F - 0.18,
  sunDirection: sub(frontFrame.M([8, 16, 14]), frontFrame.M([0, 0, 0])),
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_marble', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-rear-auditorium-and-native-side-recess',
      position: frontFrame.M([-23, 28, -53]),
      lookAt: [0, 6, 0],
    },
    {
      name: 'three-roundarched-shut-doors-and-gridded-fanlights',
      position: frontFrame.M([8, 4.2, 18]),
      lookAt: frontFrame.M([8, 3.4, 0]),
    },
    {
      name: 'four-fluted-pilasters-upper-windows-and-dentil-cornice',
      position: frontFrame.M([9, 10.1, 20]),
      lookAt: frontFrame.M([8, 8.7, 0]),
    },
    {
      name: 'cream-peach-wing-closed-arched-window-and-intrinsic-steps',
      position: frontFrame.M([-5, 4.9, 13]),
      lookAt: frontFrame.M([-2, 3.8, -1]),
    },
    {
      name: 'whole-native-fifteen-control-envelope-flat-roof-and-parapet',
      position: [0, 78, 3],
      lookAt: [0, 5, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/apollon-theater-syros-runtime-overlay.mjs',
    level: 'skyline',
    export: 'apollonTheaterSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'apollonTheaterDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'apollonTheaterStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'apollonTheaterCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Two exactpublished2015ZachariasMitzelos/Zmitzieown-selfCC0 near/widefront originals individuallyinspected/nativeSHA1matched/passed unchanged publishedinventory. No supplemental/questionable imagery. Fourflutedpilasters/three mainarchedcloseddoors/fanlightwoodgrids/upperwindows/completewings/steps/roofparapet retained; hiddenrear/stage/roof/profiles/windowcensus/currentfinefinish/sections are bounded original estimates. Actualdoorbacks terminate exteriorrecesses; no auditoriuminterior reconstruction or traversalclaim. Sourceinscription/bust/ceilingpaintings/banner/lamps/publicpaving/trees/neighborhotels/houses/people/photo pixels notcopied.',
    'Original400m129x12916641sample field/one rawtile/fixedSW21.5244m providerrelative datum frozen before all floors/sections/geometry. No terrainfit/flatten/reacquire/modelraising. Preview/replacementfalse/exact foundation/threshold contact unresolved. Isolatedflatground and syntheticneighbors are fixtures only.',
  ],
};
