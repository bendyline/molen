/** Durham Castle: mapped ranges, open bailey, gatehouse and separate octagonal keep. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcw/n0256_durham_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.6, 0.52, 0.39],
  trim = [0.72, 0.65, 0.5],
  wood = [0.23, 0.18, 0.12],
  glass = [0.105, 0.13, 0.135];
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  color = (a, t) => a.map((v) => v * t);
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function cap(o, p, y, slot = 'stone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function line(o, a, b, w = 0.12, slot = 'carved', c = trim) {
  if (Math.hypot(...b.map((v, i) => v - a[i])) < 0.001) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (master(o) || len < 0.001) {
    beam(o, slot, a, b, w, w, c);
    return;
  }
  const dx = ((b[1] - a[1]) * w) / (2 * len),
    dy = ((a[0] - b[0]) * w) / (2 * len),
    p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
  if (normalFor(...p)[2] < 0) p.reverse();
  face(o, slot, p, c);
}
function opening(x, y, w, h, pointed = false, steps = 12) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  if (!pointed) return [...p, [x + w / 2, y + h], [x - w / 2, y + h]];
  if (pointed !== 'round') {
    const rise = Math.min(w * 0.866, h * 0.6),
      spring = y + h - rise;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const xx =
        t <= 0.5
          ? -w / 2 + w * Math.cos((t * 2 * Math.PI) / 3)
          : w / 2 + w * Math.cos((2 * Math.PI) / 3 + ((t - 0.5) * 2 * Math.PI) / 3);
      const yy =
        t <= 0.5
          ? Math.sin((t * 2 * Math.PI) / 3)
          : Math.sin((2 * Math.PI) / 3 + ((t - 0.5) * 2 * Math.PI) / 3);
      p.push([x + xx, spring + (yy / 0.8660254037844386) * rise]);
    }
    return p;
  }
  const ry = Math.min(w / 2, h * 0.65),
    spring = y + h - ry;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + Math.sin(angle) * ry]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'sandstone', c = stone) {
  const valid = !fine(o) ? windows.filter((v) => v[5]) : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], master(o) ? 10 : 6)),
  ];
  const p = all.flat(),
    holes = [];
  let n = 4;
  for (const r of all.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]),
      ) < 0.00001
    )
      continue;
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  if (o.detail === 'district' || o.detail === 'street')
    for (const v of windows.filter((v) => !v[5])) {
      face(
        o,
        'glass',
        [
          [v[0] - v[2] / 2, v[1], 0.025],
          [v[0] + v[2] / 2, v[1], 0.025],
          [v[0] + v[2] / 2, v[1] + v[3], 0.025],
          [v[0] - v[2] / 2, v[1] + v[3], 0.025],
        ],
        glass,
      );
    }
  for (let i = 0; i < valid.length; i++) {
    const v = valid[i],
      r = all[i + 1];
    const ix = earcut(r.flat());
    for (let k = 0; k < ix.length; k += 3) {
      const p = ix.slice(k, k + 3).map((j) => [r[j][0], r[j][1], -0.34]);
      if (normalFor(...p)[2] < 0) p.reverse();
      if (!v[5]) tri(o, 'glass', p, glass);
    }
    if (fine(o)) {
      for (let j = 0; j < r.length; j++) {
        const a = r[j],
          b = r[(j + 1) % r.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -0.34],
            [a[0], a[1], -0.34],
          ],
          trim,
        );
        if (master(o) && !(v[5] && j === 0)) line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
      }
      if (v[2] > 1.1 && !v[5]) {
        line(o, [v[0], v[1], -0.12], [v[0], v[1] + v[3] - 0.2, -0.12], 0.09, 'wood', wood);
        line(
          o,
          [v[0] - v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          [v[0] + v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          0.08,
          'wood',
          wood,
        );
      }
    }
    if (master(o) && !v[5])
      for (let y = v[1] + 0.28; y < v[1] + v[3] - (v[4] ? v[2] * 0.9 : 0.15); y += 0.42)
        line(
          o,
          [v[0] - v[2] * 0.42, y, -0.19],
          [v[0] + v[2] * 0.42, y, -0.19],
          0.025,
          'metal',
          [0.24, 0.23, 0.2],
        );
  }
}

function edges(o, p, fn, closed = true) {
  for (let i = 0; i < p.length - (closed ? 0 : 1); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.02)
      fn(edgeFrame(o, closed ? b : a, closed ? a : b), len, i, closed ? b : a, closed ? a : b);
  }
}
function solid(o, p, lo, hi, slot = 'sandstone', c = stone) {
  p = poly(p);
  edges(o, p, (f, len) => panel(f, len, lo, hi, [], slot, c));
  cap(o, p, hi, slot, c);
}
const low = (o) => o.detail === 'skyline';
const poly = (p) => {
  const q = p.filter((a, i) => !i || Math.hypot(a[0] - p[i - 1][0], a[1] - p[i - 1][1]) > 0.02);
  if (q.length > 2 && Math.hypot(q[0][0] - q.at(-1)[0], q[0][1] - q.at(-1)[1]) < 0.02) q.pop();
  return area(q) > 0 ? q : q.reverse();
};
const feature = (id) => map.features.find((p) => p.id === `way/${id}`).points;
const simple = (p, t = 0.7) => {
  let q = p.slice(),
    change = true;
  while (change && q.length > 4) {
    change = false;
    for (let i = 0; i < q.length; i++) {
      const a = q[(i + q.length - 1) % q.length],
        b = q[i],
        c = q[(i + 1) % q.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (d && Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < t) {
        q.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return q;
};
function clipping(p, a, b, positive = true) {
  const d = (q) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]),
    out = [];
  for (let i = 0; i < p.length; i++) {
    const q = p[i],
      r = p[(i + 1) % p.length],
      u = d(q) * (positive ? 1 : -1),
      v = d(r) * (positive ? 1 : -1);
    if (u >= 0) out.push(q);
    if (u >= 0 !== v >= 0) out.push(mix(q, r, u / (u - v)));
  }
  return out;
}
function battlements(o, p, y, { step = 2.0, h = 0.85, w = 0.85, thick = 0.6 } = {}) {
  if (!near(o)) return;
  edges(o, poly(p), (f, len) => {
    box(f, 'sandstone', [0, y - 0.55, -thick], [len, y, 0.06], stone);
    if (!near(o)) return;
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * len) / n;
      box(
        f,
        'sandstone',
        [Math.max(0, x - w / 2), y, -thick],
        [Math.min(len, x + w / 2), y + h, 0.06],
        color(stone, 1.03),
      );
      if (master(o))
        box(
          f,
          'carved',
          [Math.max(0, x - w / 2 - 0.05), y + h, -thick - 0.03],
          [Math.min(len, x + w / 2 + 0.05), y + h + 0.07, 0.12],
          trim,
        );
    }
  });
}
function ringSolid(o, p, lo, hi, c = stone) {
  solid(o, poly(low(o) ? simple(p) : p), lo, hi, 'sandstone', c);
}
function strip(o, w, y, depth = 0.2, height = 0.2) {
  if (near(o)) box(o, 'carved', [0, y - height / 2, -0.05], [w, y + height / 2, depth], trim);
}
function masonry(o, w, lo, hi, ws = []) {
  if (!master(o)) return;
  let row = 0;
  for (let y = lo + 0.04; y < hi - 0.2; y += 0.42, row++) {
    for (let x = -((row % 2) * 0.52); x < w; x += 1.03) {
      const x0 = Math.max(0, x + 0.015),
        x1 = Math.min(w, x + 0.99),
        y1 = Math.min(hi, y + 0.375);
      if (
        x1 - x0 < 0.06 ||
        ws.some(
          (v) =>
            x1 > v[0] - v[2] / 2 - 0.16 &&
            x0 < v[0] + v[2] / 2 + 0.16 &&
            y1 > v[1] - 0.12 &&
            y < v[1] + v[3] + 0.12,
        )
      )
        continue;
      const shade = 0.93 + ((((row * 31 + Math.round(x * 100)) % 13) + 13) % 13) * 0.01;
      face(
        o,
        'sandstone',
        [
          [x0, y, 0.008],
          [x1, y, 0.008],
          [x1, y1, 0.008],
          [x0, y1, 0.008],
        ],
        color(stone, shade),
      );
    }
  }
}
function gothic(o, x, y, w, h, lights = 3) {
  if (!near(o)) return;
  const spring = y + h - w * 0.55;
  for (let j = 1; j < lights; j++) {
    const u = x - w / 2 + (w * j) / lights;
    line(o, [u, y, -0.09], [u, spring, -0.09], 0.12);
  }
  if (fine(o)) {
    const n = master(o) ? 8 : 4;
    for (let j = 0; j < lights; j++) {
      const cx = x - w / 2 + (w * (j + 0.5)) / lights,
        r = (w / lights) * 0.47;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * i) / n,
          b = (Math.PI * (i + 1)) / n;
        line(
          o,
          [cx + Math.cos(a) * r, spring - 0.25 + Math.sin(a) * r * 1.5, -0.07],
          [cx + Math.cos(b) * r, spring - 0.25 + Math.sin(b) * r * 1.5, -0.07],
          0.09,
        );
      }
    }
    line(o, [x - w / 2, y + h * 0.48, -0.09], [x + w / 2, y + h * 0.48, -0.09], 0.15);
  }
  if (master(o)) {
    for (let j = 0; j < lights; j++) {
      const u = x - w / 2 + (w * (j + 0.5)) / lights;
      for (let y0 = y + 0.25; y0 < spring - 0.4; y0 += 0.32)
        line(
          o,
          [u - (w / lights) * 0.42, y0, -0.16],
          [u + (w / lights) * 0.42, y0, -0.16],
          0.022,
          'metal',
          [0.27, 0.27, 0.23],
        );
    }
  }
}
function facadeLoop(
  o,
  p,
  lo,
  hi,
  {
    spacing = 4.2,
    floors = [2, 6.8, 11.6],
    windowHeight = 2.3,
    windowWidth = 1.35,
    skip = [],
  } = {},
) {
  edges(o, poly(p), (f, w, _i, a, b) => {
    if (
      skip.some(([u, v, t = 1]) =>
        [a, b].every(
          (q) =>
            Math.abs((q[0] - u[0]) * (v[1] - u[1]) - (q[1] - u[1]) * (v[0] - u[0])) /
              Math.hypot(v[0] - u[0], v[1] - u[1]) <
            t,
        ),
      )
    )
      return;
    const ws = [];
    if (w > 2.3)
      for (let k = 0, n = Math.max(1, Math.round(w / spacing)); k < n; k++)
        for (const y of floors)
          if (y + windowHeight < hi - 0.4)
            ws.push([
              ((k + 0.5) * w) / n,
              y,
              Math.min(windowWidth, (w / n) * 0.5),
              windowHeight,
              false,
            ]);
    panel(f, w, lo, hi, low(o) ? [] : ws);
    masonry(f, w, lo, hi, ws);
    strip(f, w, hi - 0.4);
  });
  cap(o, poly(p), hi, 'slate', [0.34, 0.33, 0.3]);
}
function turret(o, x, z, base, top, r = 0.83, dome = true) {
  const n = 8;
  loft(
    o,
    'sandstone',
    [
      radialRing(base, r, r, n, [x, z], Math.PI / 8),
      radialRing(top, r * 0.86, r * 0.86, n, [x, z], Math.PI / 8),
    ],
    trim,
  );
  if (near(o))
    for (const y of [base + 0.45, base + 7, top - 0.55])
      loft(
        o,
        'carved',
        [
          radialRing(y, r * 1.03, r * 1.03, n, [x, z]),
          radialRing(y + 0.18, r * 1.03, r * 1.03, n, [x, z]),
        ],
        trim,
      );
  if (dome) {
    const rings = [
      [top, 0.93],
      [top + 0.22, 0.97],
      [top + 0.8, 0.8],
      [top + 1.3, 0.45],
      [top + 1.6, 0.16],
    ].map(([y, s]) => radialRing(y, r * s, r * s, low(o) ? 8 : 16, [x, z]));
    loft(o, 'slate', rings, [0.35, 0.34, 0.27]);
    if (near(o))
      beam(o, 'metal', [x, top + 1.6, z], [x, top + 2, z], 0.07, 0.07, [0.21, 0.22, 0.18]);
  }
}
function westRange(o) {
  const west = poly(map.west.slice(3)),
    a = [-25.638, 23.989],
    b = [-6.825, -9.355];
  // Lower garden stair at the south end and taller Great Hall, using the original range boundary.
  const south = poly(clipping(west, [-25.638, 23.989], [-45.695, 20.849], false));
  const hall = poly(clipping(west, [-25.638, 23.989], [-45.695, 20.849], true));
  facadeLoop(o, low(o) ? simple(south) : south, 0, 12.5, { floors: [1, 5, 9], windowHeight: 1.65 });
  facadeLoop(o, low(o) ? simple(hall) : hall, 0, 20.5, {
    floors: [2, 7.5, 13.3, 17.3],
    windowHeight: 2.2,
    skip: [[a, b, 3.8]],
  });
  battlements(o, hall, 20.5);
  battlements(o, south, 12.5);
  // Four octagonal turrets and four contrasting hall bays; facade stands just proud of mapped buttresses.
  const f = edgeFrame(o, a, b),
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ws = [];
  const turretX = [0.8, 9.8, 19.9, 29.9];
  ws.push(
    [5.4, 2, 1.9, 2.4, false],
    [5.4, 6.2, 2.5, 7.5, false],
    [4.2, 16.7, 1, 2, false],
    [6.6, 16.7, 1, 2, false],
  );
  ws.push([14.6, 2.15, 2.45, 4.9, true]);
  for (const x of [24.8, 34.7]) ws.push([x, 2.7, 3.4, 10.4, true]);
  const front = frame(f, 0, 0, 0.1);
  panel(front, w, 0, 20.5, low(o) ? [] : ws);
  masonry(front, w, 0, 20.5, ws);
  strip(front, w, 19.8, 0.32, 0.35);
  for (const x of low(o) ? [0.8, 29.9] : turretX) turret(front, x, 0.62, 0, 21.3, 0.85);
  if (near(o)) {
    for (const x of [24.8, 34.7]) gothic(front, x, 2.7, 3.4, 10.4, 3);
    // Two-storey projecting oriel with its own mullions and stone sill.
    const oriel = frame(front, 5.4, 0, 0.48);
    box(oriel, 'carved', [-1.48, 6.1, -0.35], [1.48, 14.15, 0.07], trim);
    for (const y of [6.45, 10.25]) {
      panel(frame(oriel, -1.2, 0, 0.44), 2.4, y, y + 3.5, [[1.2, y + 0.2, 2.15, 3, false]]);
      gothic(frame(oriel, -1.2, 0, 0.44), 1.2, y + 0.2, 2.15, 3, 3);
    }
    strip(frame(oriel, -1.4, 0, 0.2), 2.8, 14.25, 0.35, 0.22);
    // Cosin porch: wide eight-sided stair flight and paired columns, with a broken curved pediment.
    for (let i = 0; i < 8; i++) {
      const y = (i + 1) * 0.22,
        z = 4.4 - i * 0.39;
      solid(
        front,
        [
          [10.5, z - 0.5],
          [11.1, z],
          [18.1, z],
          [18.7, z - 0.5],
          [18.7, 0.35],
          [10.5, 0.35],
        ],
        i * 0.22,
        y,
        'carved',
        trim,
      );
    }
    for (const x of [12.1, 12.65, 16.55, 17.1]) {
      loft(
        front,
        'carved',
        [radialRing(1.76, 0.2, 0.2, 8, [x, 1.2]), radialRing(6.4, 0.18, 0.18, 8, [x, 1.2])],
        trim,
      );
      box(front, 'carved', [x - 0.3, 1.75, 0.88], [x + 0.3, 2.12, 1.52], trim);
      box(front, 'carved', [x - 0.3, 6.15, 0.88], [x + 0.3, 6.5, 1.52], trim);
    }
    box(front, 'carved', [11.65, 6.5, 0.2], [17.55, 6.86, 1.63], trim);
    for (let i = 0; i < 12; i++) {
      const t0 = (Math.PI * i) / 12,
        t1 = (Math.PI * (i + 1)) / 12;
      if (i === 5 || i === 6) continue;
      line(
        front,
        [14.6 + 2.6 * Math.cos(t0), 6.9 + 1.15 * Math.sin(t0), 1.32],
        [14.6 + 2.6 * Math.cos(t1), 6.9 + 1.15 * Math.sin(t1), 1.32],
        0.2,
      );
    }
    // A plain shield reserve marks the heraldic panel; no invented figurative carving.
    box(front, 'carved', [13.8, 8.5, 0.07], [15.4, 10, 0.35], trim);
  }
  // Black Stairs at the elbow, tall irregular polygon distinct from the low gallery.
  const stair = poly([
    [1.357, -9.47],
    [-0.07, -6.939],
    [-1.634, -6.416],
    [-6.825, -9.355],
    [-3.7, -15],
    [3, -12.8],
  ]);
  facadeLoop(o, stair, 0, 22.3, {
    floors: [1.1, 5.1, 9.1, 13.1, 17.1],
    windowHeight: 2.1,
    spacing: 3.5,
  });
  battlements(o, stair, 22.3, { step: 1.6, h: 0.7 });
}
function northRange(o) {
  const p = poly([...map.main.slice(63, 77), ...map.main.slice(3, 13)]),
    start = [1.357, -9.47],
    end = [16.804, 6.667],
    dir = [end[0] - start[0], end[1] - start[1]],
    l = Math.hypot(...dir),
    normal = [-dir[1] / l, dir[0] / l];
  // Gallery is in front of the upper hall. A setback physically preserves the lower roof terrace.
  const offset = -5.4,
    cutA = start.map((v, i) => v + normal[i] * offset),
    cutB = end.map((v, i) => v + normal[i] * offset);
  const gallery = poly(clipping(p, cutA, cutB, true)),
    upper = poly(clipping(p, cutA, cutB, false));
  facadeLoop(o, low(o) ? simple(gallery) : gallery, 0, 9.8, {
    floors: [0.9, 5.4],
    windowHeight: 2.15,
    spacing: 4.2,
    windowWidth: 2.1,
    skip: [[start, end, 0.3]],
  });
  facadeLoop(o, low(o) ? simple(upper) : upper, 0, 21.4, {
    floors: [3, 7.5, 12, 16],
    windowHeight: 2.3,
    skip: [[cutA, cutB, 0.3]],
  });
  battlements(o, gallery, 9.8, { step: 1.4, h: 0.55 });
  battlements(o, upper, 21.4);
  const f = edgeFrame(o, start, end),
    ws = [];
  for (let k = 0; k < 5; k++) {
    const x = ((k + 0.5) * l) / 5;
    ws.push([x, 0.85, 1.6, 2.4, false], [x, 5.25, 2.4, 2.7, false]);
  }
  // Projected gallery entrance has the broad five-light window.
  ws[7] = [l * 0.7, 4.5, 3.2, 4.5, false];
  ws[6] = [l * 0.7, 0.15, 1.7, 2.9, true];
  const gf = frame(f, 0, 0, 0.07);
  panel(gf, l, 0, 9.8, low(o) ? [] : ws);
  masonry(gf, l, 0, 9.8, ws);
  if (near(o)) for (const v of ws) if (!v[5]) gothic(gf, ...v.slice(0, 4), v[2] > 3 ? 5 : 3);
  // Close the entire setback face, including its ends beyond the narrower gallery.
  edges(o, upper, (f, w, _i, a, b) => {
    const dist = (q) => Math.abs((q[0] - cutA[0]) * dir[1] - (q[1] - cutA[1]) * dir[0]) / l;
    if (dist(a) > 0.3 || dist(b) > 0.3) return;
    const sign = ((b[0] - a[0]) * dir[0] + (b[1] - a[1]) * dir[1]) / (w * l);
    const offset = ((cutA[0] - a[0]) * (b[0] - a[0]) + (cutA[1] - a[1]) * (b[1] - a[1])) / w;
    const ws = Array.from({ length: 7 }, (_, k) => [
      offset + (sign * (k + 0.5) * l) / 7,
      14.4,
      1.25,
      3.2,
      true,
    ]).filter((v) => v[0] > 0.7 && v[0] < w - 0.7);
    panel(f, w, 0, 21.4, low(o) ? [] : ws);
    masonry(f, w, 9.8, 21.4, ws);
    if (near(o)) for (const v of ws) gothic(f, ...v.slice(0, 4), 2);
  });
  // Clock stair; polygon taken from the front projection and enlarged only vertically.
  const clock = poly([
    [12.8, 9.53],
    [13.605, 8.044],
    [16.804, 6.667],
    [18.1, 9.45],
    [15.096, 11.749],
    [13.428, 11.106],
  ]);
  facadeLoop(o, clock, 0, 19.5, {
    floors: [1.1, 6.3, 11.5],
    windowHeight: 2.7,
    spacing: 3.7,
    windowWidth: 1.6,
  });
  battlements(o, clock, 19.5, { step: 1.35, h: 0.7 });
  const cf = edgeFrame(o, [13.428, 11.106], [15.096, 11.749]);
  clockFace(frame(cf, 0.83, 16.8, 0.1), o);
  // Tunstall chapel above the Norman chapel, separate from the long upper hall.
  const rearLink = poly([...map.main.slice(76), ...map.main.slice(0, 4)]);
  facadeLoop(o, low(o) ? simple(rearLink) : rearLink, 0, 16.8, {
    floors: [3, 8, 12],
    windowHeight: 2.1,
  });
  const chapel = poly(feature(81522956));
  facadeLoop(o, chapel, 0, 18.4, {
    floors: [1, 13.7],
    windowHeight: 2.1,
    spacing: 4,
    windowWidth: 1.65,
    skip: [[[19.976, 9.569], [26.541, 26.265], 0.3]],
  });
  battlements(o, chapel, 18.4, { step: 1.7 });
  const ca = [19.976, 9.569],
    cb = [26.541, 26.265],
    cl = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
  const cw = Array.from({ length: 4 }, (_, i) => [((i + 0.5) * cl) / 4, 5.1, 2.65, 5.6, true]);
  for (let i = 0; i < 4; i++) cw.push([((i + 0.5) * cl) / 4, 13.5, 1.7, 2.4, false]);
  const cp = frame(edgeFrame(o, ca, cb), 0, 0, 0.09);
  panel(cp, cl, 0, 18.4, low(o) ? [] : cw);
  masonry(cp, cl, 0, 18.4, cw);
  if (near(o)) {
    for (const v of cw.slice(0, 4)) gothic(cp, ...v.slice(0, 4), 3);
    for (let i = 0; i <= 4; i++) {
      const x = (i * cl) / 4;
      box(cp, 'sandstone', [x - 0.16, 0, -0.03], [x + 0.16, 11.3, 0.44], trim);
    }
    strip(cp, cl, 12.4, 0.25, 0.25);
  }
  // Small service and stair blocks remain at their individual mapped locations.
  if (!low(o))
    for (const [id, h] of [
      [1435108890, 8],
      [1435108893, 10.7],
      [1435108891, 11.2],
      [1435108878, 13.4],
      [1435108879, 7.1],
      [1435108901, 7.5],
    ]) {
      const q = poly(feature(id));
      facadeLoop(o, low(o) ? simple(q) : q, 0, h, { floors: [1.2, 4.8, 8.3], windowHeight: 1.6 });
    }
}
function clockFace(f, o) {
  if (low(o)) return;
  const n = master(o) ? 48 : near(o) ? 24 : 12,
    r = 0.85,
    p = Array.from({ length: n }, (_, i) => [
      Math.cos((i * Math.PI * 2) / n) * r,
      Math.sin((i * Math.PI * 2) / n) * r,
      0.06,
    ]);
  for (let i = 0; i < n; i++)
    tri(f, 'recess', [[0, 0, 0.06], p[i], p[(i + 1) % n]], [0.035, 0.055, 0.055]);
  if (near(o)) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      line(
        f,
        [Math.sin(a) * 0.63, Math.cos(a) * 0.63, 0.09],
        [Math.sin(a) * 0.77, Math.cos(a) * 0.77, 0.09],
        0.04,
        'carved',
        [0.84, 0.78, 0.5],
      );
    }
    line(f, [0, 0, 0.1], [0.45, 0.39, 0.1], 0.05, 'carved', [0.87, 0.8, 0.51]);
    line(f, [0, 0, 0.1], [-0.19, 0.56, 0.1], 0.05, 'carved', [0.87, 0.8, 0.51]);
  }
}
function keep(o) {
  const p = poly(simple(map.keep, 0.32)),
    lo = 10,
    hi = 28.5;
  ringSolid(
    o,
    p.map((q) => mix([43, 44], q, 1.035)),
    lo - 0.7,
    lo + 0.8,
    color(stone, 0.9),
  );
  edges(o, p, (f, len, i) => {
    const ws = [];
    if (len > 4) {
      const n = i % 3 === 0 ? 2 : 1;
      for (let k = 0; k < n; k++)
        for (let j = 0; j < 3; j++) {
          const x = ((k + 0.5) * len) / n,
            y = lo + 2 + j * 5.05,
            w = j === 2 && i % 2 === 0 ? 2.1 : 1.35;
          ws.push([x, y, w, j === 2 ? 3.6 : 2.4, j === 2 && i % 2 === 0]);
        }
    }
    panel(f, len, lo, hi, low(o) ? [] : ws);
    masonry(f, len, lo, hi, ws);
    strip(f, len, lo + 1.1, 0.35, 0.3);
    if (near(o)) {
      for (const v of ws) gothic(f, ...v.slice(0, 4), v[2] > 2 ? 2 : 1);
      strip(f, len, hi - 0.5, 0.45, 0.32);
    }
  });
  cap(o, p, hi - 0.3, 'slate', [0.3, 0.3, 0.28]);
  battlements(o, p, hi, { step: 1.8, h: 0.95, thick: 0.8 });
  for (const q of p) {
    const dx = q[0] - 43,
      dz = q[1] - 44,
      mag = Math.hypot(dx, dz),
      x = q[0] + (dx / mag) * 0.1,
      z = q[1] + (dz / mag) * 0.1;
    turret(o, x, z, 10, !near(o) ? 30.2 : 29.5, low(o) ? 0.5 : 0.62, false);
    if (near(o)) {
      const r = 0.72,
        c = poly(radialRing(0, r, r, 4, [x, z], Math.PI / 4).map((v) => [v[0], v[2]]));
      battlements(o, c, 29.5, { step: 1.05, h: 0.7, w: 0.38, thick: 0.25 });
    }
  }
  // Keep approach stair climbs the actual bailey-to-motte edge, never an invented central keep.
  if (near(o))
    for (let k = 0; k < 32; k++) {
      const a = [26.7, 27.3],
        b = [38.6, 33.7],
        t = k / 32,
        u = (k + 1) / 32,
        pa = mix(a, b, t),
        pb = mix(a, b, u);
      beam(
        o,
        'carved',
        [pa[0], 0.3 + t * 9.6, pa[1]],
        [pb[0], 0.3 + u * 9.6, pb[1]],
        1.4,
        0.26,
        trim,
      );
    }
}
function gate(o) {
  // Native gate face is 19.5m long, oblique to both castle ranges.
  const a = [-16.861, 42.132],
    b = [-0.495, 48.114],
    f = edgeFrame(o, a, b),
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    depth = 8.2,
    cx = w * 0.51,
    archW = 3.7,
    archH = 5.7;
  const g = frame(f, 0, 0, 0.02),
    ws = [
      [cx, 0.02, archW, archH, 'round', true],
      [cx, 7.2, 1.8, 3.4, true],
      [2.6, 6.7, 1.6, 3.1, true],
      [w - 2.6, 6.7, 1.6, 3.1, true],
    ];
  // Both ends and the vault leave the passage physically open.
  for (const [obj, xform] of [
    [g, false],
    [frame(g, w, 0, -depth, Math.PI), true],
  ]) {
    const v = ws.map((v) => [xform ? w - v[0] : v[0], ...v.slice(1)]);
    panel(obj, w, 0, 17.5, v);
    masonry(obj, w, 0, 17.5, v);
    if (near(o)) for (const v0 of v.slice(1)) gothic(obj, ...v0.slice(0, 4), 2);
  }
  panel(frame(g, 0, 0, -depth, -Math.PI / 2), depth, 0, 17.5);
  panel(frame(g, w, 0, 0, Math.PI / 2), depth, 0, 17.5);
  face(
    g,
    'slate',
    [
      [0, 17.5, 0],
      [w, 17.5, 0],
      [w, 17.5, -depth],
      [0, 17.5, -depth],
    ],
    [0.3, 0.3, 0.28],
  );
  const ring = opening(cx, 0.02, archW, archH, 'round', master(o) ? 24 : 8);
  for (let i = 1; i < ring.length; i++) {
    const u = ring[i],
      v = ring[(i + 1) % ring.length];
    face(
      g,
      'sandstone',
      [
        [u[0], u[1], 0],
        [u[0], u[1], -depth],
        [v[0], v[1], -depth],
        [v[0], v[1], 0],
      ],
      trim,
    );
  }
  if (near(o))
    for (const offset of [0, 0.18, 0.36, 0.55]) {
      const rr = opening(
        cx - offset * 0.04,
        0.02,
        archW + offset * 2,
        archH + offset,
        'round',
        master(o) ? 24 : 8,
      );
      for (let i = 1; i < rr.length; i++)
        line(
          g,
          [...rr[i], 0.18 + offset * 0.2],
          [...rr[(i + 1) % rr.length], 0.18 + offset * 0.2],
          0.11,
        );
    }
  if (!low(o))
    for (const x of [2.6, w - 2.6]) {
      const f = frame(g, x - 1.7, 0, 1.2),
        wins = [[1.7, 6.7, 1.6, 3.1, true]];
      panel(f, 3.4, 0, 16.6, wins);
      masonry(f, 3.4, 0, 16.6, wins);
      for (const xx of [0, 3.4])
        panel(
          frame(f, xx, 0, xx === 0 ? -1.2 : 0, xx === 0 ? -Math.PI / 2 : Math.PI / 2),
          1.2,
          0,
          16.6,
        );
      face(
        f,
        'slate',
        [
          [0, 16.6, 0],
          [3.4, 16.6, 0],
          [3.4, 16.6, -1.2],
          [0, 16.6, -1.2],
        ],
        [0.3, 0.3, 0.28],
      );
      if (near(o)) gothic(f, 1.7, 6.7, 1.6, 3.1, 2);
      if (fine(o)) {
        line(f, [1.7, 13.3, 0.06], [1.7, 14.5, 0.06], 0.08, 'recess', [0.14, 0.13, 0.11]);
        line(f, [1.3, 13.95, 0.06], [2.1, 13.95, 0.06], 0.08, 'recess', [0.14, 0.13, 0.11]);
      }
      battlements(
        f,
        [
          [0, 0],
          [0, -1.2],
          [3.4, -1.2],
          [3.4, 0],
        ],
        16.6,
        { step: 1.4, h: 0.7, w: 0.6 },
      );
    }
  battlements(
    g,
    [
      [0, 0],
      [0, -depth],
      [w, -depth],
      [w, 0],
    ],
    17.5,
    { step: 1.5, h: 0.85 },
  );
  for (const x of [1, w - 1])
    for (const z of low(o) ? [0.45] : [0.45, -depth + 0.25]) {
      turret(g, x, z, 0, 18.1, 0.68, false);
      if (near(o))
        battlements(
          g,
          poly(radialRing(0, 0.74, 0.74, 4, [x, z], Math.PI / 4).map((v) => [v[0], v[2]])),
          18.1,
          { step: 0.9, h: 0.7, w: 0.45, thick: 0.25 },
        );
    }
  if (!low(o)) {
    // Rose window is recessed visually; radial stone bars and a moulded ring.
    const rose = frame(g, cx, 13.5, 0.085),
      n = master(o) ? 32 : 12,
      r = 1.08;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      tri(
        rose,
        'glass',
        [
          [0, 0, 0],
          [Math.cos(a) * r, Math.sin(a) * r, 0],
          [Math.cos(b) * r, Math.sin(b) * r, 0],
        ],
        glass,
      );
      if (near(o))
        line(
          rose,
          [Math.cos(a) * r, Math.sin(a) * r, 0.05],
          [Math.cos(b) * r, Math.sin(b) * r, 0.05],
          0.14,
        );
    }
    if (near(o))
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        line(rose, [0, 0, 0.04], [Math.cos(a) * r, Math.sin(a) * r, 0.04], 0.08);
      }
  }
}
function terrain(o) {
  const court = poly(feature(1435108880));
  solid(o, low(o) ? simple(court) : court, 0, 0.12, 'aggregate', [0.64, 0.61, 0.54]);
  for (const id of [1434670112, 1434670113, 1435108881]) {
    const p = poly(feature(id));
    cap(o, low(o) ? simple(p, 0.6) : p, 0.135, 'foliage', [0.3, 0.43, 0.19]);
  }
  const outer = feature(1435129790),
    inner = feature(1435129792);
  // Two mapped concentric retaining arcs; continuous sloped earth behind the keep.
  const rings = [
    [0, outer],
    [3.6, outer],
    [4, inner],
    [7.3, inner],
    [10.0, map.keep.slice(2, 9)],
  ];
  for (let j = 1; j < rings.length; j++) {
    const [y0, pa] = rings[j - 1],
      [y1, pb] = rings[j];
    const n = low(o) ? 8 : near(o) ? 36 : 16;
    const sample = (p, t) => {
      const k = t * (p.length - 1),
        i = Math.min(p.length - 2, Math.floor(k));
      return mix(p[i], p[i + 1], k - i);
    };
    for (let k = 0; k < n; k++) {
      const a = sample(pa, k / n),
        b = sample(pa, (k + 1) / n),
        c = sample(pb, (k + 1) / n),
        d = sample(pb, k / n);
      const q = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [c[0], y1, c[1]],
        [d[0], y1, d[1]],
      ];
      const slot = j % 2 ? 'sandstone' : 'foliage',
        col = j % 2 ? color(stone, 0.82) : [0.31, 0.43, 0.21];
      for (const ix of [
        [0, 1, 2],
        [2, 3, 0],
      ]) {
        const t = ix.map((i) => q[i]),
          normal = normalFor(...t);
        if (j % 2 === 0 && normal[1] < 0) t.reverse();
        tri(o, slot, t, col);
      }
    }
  }
  // West-facing motte slopes behind the court boundary; courtyard stays open.
  const slope = [
    [24.573, 21.269],
    [33.458, 23.553],
    [38.711, 34.347],
    [31.525, 43.564],
    [25.512, 44.356],
    [5.505, 40.306],
  ];
  const sy = [0.15, 5.7, 10, 10, 3, 0.15];
  for (let i = 1; i < slope.length - 1; i++) {
    const q = [0, i, i + 1].map((k) => [slope[k][0], sy[k], slope[k][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, 'foliage', q, [0.33, 0.45, 0.22]);
  }
  if (fine(o)) {
    const walls = [feature(1435364719).slice(0, 22), feature(1434670115)];
    for (const p of walls)
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i],
          b = p[i + 1],
          f = edgeFrame(o, a, b),
          len = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (len < 0.6) continue;
        box(f, 'sandstone', [0, 0, -0.45], [len, 4.2, 0.45], stone);
        battlements(
          f,
          [
            [0, -0.45],
            [len, -0.45],
            [len, 0.45],
            [0, 0.45],
          ],
          4.2,
          { step: 1.9, h: 0.6, w: 0.8 },
        );
      }
  }
  if (master(o)) {
    // Courtyard paver seams are geometry only; central reusable gravel graph supplies the aggregate.
    for (const p of [court])
      edges(o, p, (f, w) => {
        box(f, 'carved', [0, 0.12, -0.16], [w, 0.2, 0.16], color(trim, 0.86));
      });
  }
}
export function buildDurhamRuntime(out, detail) {
  const o = {
    detail,
    addQuad: (...v) => out.addQuad(...v),
    addTriangle: (...v) => out.addTriangle(...v),
    addConvexPolygon: (...v) => out.addConvexPolygon(...v),
  };
  terrain(o);
  westRange(o);
  northRange(o);
  keep(o);
  gate(o);
}
export const buildDurhamSkyline = (o) => buildDurhamRuntime(o, 'skyline');
export const durhamStudy = {
  id: 'N0256',
  key: 'durham_castle',
  title: 'Durham Castle',
  category: 'castle',
  wikidataId: 'Q752266',
  mapFrame: 'map-frame.json',
  build: (o) => buildDurhamRuntime(o),
  brief:
    'Durham Castle exterior: Great Hall and four domed octagonal turrets, Black Stairs, low Tunstall Gallery with upper hall, polygonal clock stair, chapel, separate raised octagonal keep, open gatehouse passage, and landscaped open bailey.',
  sourceFacts: {
    identity: 'Q752266 west/north ranges plus mapped keep way/81522969 and gatehouse way/81522972',
    mappedMainRangeEnvelopeMeters: [98.284, 67.703],
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'Attributed OpenStreetMap building and courtyard footprints; Historic England four listed entries and Durham University courtyard photographs.',
    verticalDatum:
      'Courtyard Y=0.12; keep platform Y=10, keep corner battlements Y=30.2. Relative levels are estimated from exterior photos, not a survey.',
  },
  scaleBasis:
    'Horizontal meters from mapped components. Facade elevations, wall thickness, roof slopes, window tracery and motte heights are interpreted from the identified exterior photographs.',
  refs: [
    'https://historicengland.org.uk/listing/the-list/list-entry/1121383',
    'https://historicengland.org.uk/listing/the-list/list-entry/1160921',
    'https://historicengland.org.uk/listing/the-list/list-entry/1322868',
    'https://historicengland.org.uk/listing/the-list/list-entry/1322867',
    'https://dur.ac.uk/things-to-do/venues/durham-castle/history-and-architecture/external-architecture-overview/',
    'https://dur.ac.uk/things-to-do/venues/durham-castle/history-and-architecture/norman-castle/',
    'https://www.openstreetmap.org/way/81522967',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Original deterministic geometry; no reference photos or third-party meshes embedded.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X 30.047 degrees north of east',
    front: 'Open bailey toward native +Z; keep toward +X,+Z',
    origin: 'Main-range mapped anchor; courtyard ground datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft: terrain fit and exact architectural review pending',
    notes:
      'Includes mapped castle ranges, keep and gatehouse; surrounding library and city buildings excluded. Motte height is provisional.',
  }),
  geographicNote:
    'Signed native map frame preserves mapped component separation. Terrain and in-world directional fit still require review.',
  limitations: [
    'Maximum exterior fidelity remains pending: rear elevation window rhythms, precise stone tracery, roof junctions, heraldic shields and figurative porch carvings need more bespoke reference work. Plain reserved panels are not complete carvings.',
    'Motte and floor elevations are inferred from courtyard photographs. In-world terrain contact and orientation review remain pending; replaceFootprint=false.',
    'Interior rooms, Norman Chapel vaults, Cathedral, Palace Green Library and surrounding city are outside this exterior asset.',
    'Detailed master and four independent runtime levels share central surfaces. Physical laptop and phone performance measurements remain pending.',
  ],
  camera: { position: [104, 90, 140], lookAt: [6, 10, 13], fov: 43 },
  qaCameras: [
    { name: 'castle-and-open-bailey', position: [6, 184, 14], lookAt: [6, 0, 13] },
    { name: 'great-hall-four-domed-turrets', position: [35, 18, 40], lookAt: [-16, 11, 5] },
    { name: 'cosin-porch-and-oriel', position: [8, 9, 28], lookAt: [-18, 8, 9] },
    { name: 'tunstall-gallery-and-clock', position: [-10, 13, 36], lookAt: [9, 10, 0] },
    { name: 'chapel-and-motte', position: [8, 11, 28], lookAt: [27, 12, 17] },
    { name: 'octagonal-keep', position: [87, 37, 91], lookAt: [43, 19, 44] },
    { name: 'gatehouse-open-passage', position: [-18, 8, 82], lookAt: [-8, 8, 41] },
    { name: 'north-and-west-ranges', position: [-60, 60, -89], lookAt: [0, 11, -4] },
    { name: 'motte-retaining-walls', position: [91, 33, 112], lookAt: [38, 7, 44] },
  ],
};
