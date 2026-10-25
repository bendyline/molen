/** Hayashi: native chamfer, rounded porthole shoulders, two street wings and stepped roof terraces. */
import './install-deterministic-math.mjs';
import nativeFrame from '../../../content/worldgen/source/places/ws/wsj/hayashi_department_store/map-frame.json' with {
  type: 'json',
};
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  tan = rgb('c5ac81'),
  cream = rgb('d4ccba'),
  cap = rgb('beb49b'),
  dark = rgb('3b3831'),
  glass = rgb('587273'),
  stone = rgb('b5aaa0'),
  red = rgb('aa7053');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    p = (q) => {
      const r = v(q);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, q, n, u, col) => o.addTriangle(s, r, q.map(p), v(n), u, col),
    addQuad: (s, r, q, n, u, col) => o.addQuad(s, r, q.map(p), v(n), u, col),
    addConvexPolygon: (s, r, q, n, u, col) => {
      const pp = q.map(p),
        uv = q.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], col);
    },
  };
}
function face(o, s, x, y, z, w, h, col) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    col,
  );
}
function poly(o, s, outline, y0, y1, col) {
  const r = outline.slice();
  if (Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 0.001) r.pop();
  if (
    r.reduce(
      (sum, p, i) => sum + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  for (const [y, up] of [
    [y0, false],
    [y1, true],
  ]) {
    const q = (up ? [...r].reverse() : r).map((p) => [p[0], y, p[1]]);
    o.addConvexPolygon(s, ref, q, [0, up ? 1 : -1, 0], (p) => [p[0], p[2]], col);
  }
}
function disk(o, s, x, y, z, r, col, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    o.addTriangle(
      s,
      ref,
      [
        [x, y, z],
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
      ],
      [0, 0, 1],
      [
        [0.5, 0.5],
        [0, 0],
        [1, 1],
      ],
      col,
    );
  }
}
function holePanel(o, x, y, z, w, h, r, d, { slot = 'brick', col = tan, back = true } = {}) {
  const cy = y + h / 2,
    n = [4, 8, 20, 32][d];
  if (!d) {
    face(o, slot, x, y, z, w, h, col);
    disk(o, 'glass', x, cy, z + 0.012, r, glass, n);
    return;
  }
  const angles = [
      ...Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2),
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (Math.atan2((sy * h) / 2, (sx * w) / 2) + Math.PI * 2) % (Math.PI * 2)),
      ),
    ]
      .sort((a, b) => a - b)
      .filter((a, i, arr) => i === 0 || a - arr[i - 1] > 0.00001),
    inner = (a) => [x + r * Math.cos(a), cy + r * Math.sin(a), z],
    outer = (a) => {
      const c = Math.cos(a),
        s = Math.sin(a),
        t = Math.min(w / 2 / Math.max(Math.abs(c), 1e-9), h / 2 / Math.max(Math.abs(s), 1e-9));
      return [x + c * t, cy + s * t, z];
    };
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = i === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[i + 1],
      ia = inner(a),
      ib = inner(b);
    quad(o, slot, [ia, outer(a), outer(b), ib], [0, 0, 1], col);
    const p = [ia, ib, [ib[0], ib[1], z - 0.24], [ia[0], ia[1], z - 0.24]];
    quad(o, slot, p, normalFor(...p.slice(0, 3)), cap);
  }
  if (back) {
    disk(o, 'glass', x, cy, z - 0.255, r, glass, n);
    if (d >= 2) {
      face(o, 'metal', x, cy - 0.025, z - 0.24, r * 1.9, 0.05, dark);
      face(o, 'metal', x, cy - r, z - 0.24, 0.045, r * 2, dark);
    }
  }
}
function window(o, x, y, z, w, h, d) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (!d) return;
  for (const xx of [-w / 2, w / 2])
    face(o, 'metal', x + xx, y - 0.04, z + 0.012, 0.08, h + 0.08, dark);
  for (const yy of [y, y + h]) face(o, 'metal', x, yy - 0.03, z + 0.014, w + 0.1, 0.07, dark);
  const nx = d === 1 ? 2 : Math.max(3, Math.round(w / 0.42)),
    ny = d === 1 ? 2 : Math.max(3, Math.round(h / 0.38));
  for (let i = 1; i < nx; i++)
    face(o, 'metal', x - w / 2 + (i * w) / nx, y, z + 0.02, d === 3 ? 0.035 : 0.05, h, dark);
  for (let j = 1; j < ny; j++)
    face(o, 'metal', x, y + (j * h) / ny, z + 0.025, w, d === 3 ? 0.035 : 0.05, dark);
  if (d >= 2) B(o, 'concrete', x, y - 0.09, z + 0.03, w + 0.18, 0.1, 0.3, cap);
}
function railing(o, w, y, z, d, metal = false) {
  if (!d) {
    face(o, metal ? 'metal' : 'concrete', 0, y + 0.62, z, w, 0.16, metal ? dark : cream);
    return;
  }
  const slot = metal ? 'metal' : 'concrete',
    col = metal ? dark : cream,
    h = metal ? 0.85 : 0.74;
  if (d >= 2) {
    B(o, slot, 0, y, z, w, 0.09, 0.16, col);
    B(o, slot, 0, y + h, z, w, 0.1, 0.2, col);
  } else {
    face(o, slot, 0, y, z, w, 0.07, col);
    face(o, slot, 0, y + h, z, w, 0.08, col);
  }
  const n = Math.max(2, Math.round(w / (d === 1 ? 1.0 : metal ? 0.27 : 0.3)));
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (i * w) / n;
    if (d === 1) {
      face(o, slot, x, y, z, 0.065, h, col);
      face(facing(o, Math.PI), slot, -x, y, -z, 0.065, h, col);
    } else B(o, slot, x, y, z, metal ? 0.045 : 0.095, h, metal ? 0.045 : 0.11, col);
  }
  if (metal && d >= 2) B(o, 'metal', 0, y + h * 0.48, z, w, 0.035, 0.04, dark);
}
function fillet(r, i, radius) {
  const a = r[(i + r.length - 1) % r.length],
    b = r[i],
    c = r[(i + 1) % r.length],
    u = b.map((v, k) => v - a[k]),
    v = c.map((n, k) => n - b[k]),
    ul = Math.hypot(...u),
    vl = Math.hypot(...v),
    p = u.map((n) => n / ul),
    q = v.map((n) => n / vl),
    turn = Math.atan2(p[0] * q[1] - p[1] * q[0], p[0] * q[0] + p[1] * q[1]),
    t = radius * Math.tan(turn / 2),
    start = b.map((n, k) => n - p[k] * t),
    end = b.map((n, k) => n + q[k] * t),
    centre = [start[0] - p[1] * radius, start[1] + p[0] * radius],
    a0 = Math.atan2(start[1] - centre[1], start[0] - centre[0]);
  return { start, end, centre, a0, turn, radius, length: radius * turn };
}
function curve(o, a) {
  const map = (p) => {
    const t = 0.5 - p[0] / a.length,
      theta = a.a0 + a.turn * t,
      n = [Math.cos(theta), Math.sin(theta)];
    return [a.centre[0] + (a.radius + p[2]) * n[0], p[1], a.centre[1] + (a.radius + p[2]) * n[1]];
  };
  return {
    addTriangle: (s, r, p, _n, u, col) => {
      const q = p.map(map);
      o.addTriangle(s, r, q, normalFor(...q), u, col);
    },
    addQuad: (s, r, p, _n, u, col) => {
      const q = p.map(map);
      o.addQuad(s, r, q, normalFor(...q.slice(0, 3)), u, col);
    },
  };
}
function edge(o, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz);
  return { o: facing(o, Math.atan2(dz, -dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), w };
}
function street(out, a, b, d, north) {
  const { o, w } = edge(out, a, b),
    bays = 4,
    bay = w / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -w / 2 + i * bay;
    B(o, 'concrete', x, 0.15, -0.2, 0.55, 3.12, 0.65, cream);
    if (d >= 2) {
      B(o, 'concrete', x, 0.15, -0.2, 0.74, 0.22, 0.78, cap);
      B(o, 'concrete', x, 3.03, -0.2, 0.72, 0.24, 0.75, cream);
    }
  }
  for (let i = 0; i < bays; i++)
    window(o, -w / 2 + (i + 0.5) * bay, 0.45, -1.35, bay - 0.55, 2.5, d);
  B(o, 'concrete', 0, 3.1, -0.03, w, 0.5, 0.85, cream);
  if (!d) {
    B(o, 'brick', 0, 3.8, -0.18, w, 13.6, 0.5, tan);
  } else
    for (let i = 0; i <= bays; i++)
      B(o, 'brick', -w / 2 + i * bay, 3.8, -0.16, 0.48, 13.6, 0.64, tan);
  for (let floor = 1; floor <= 4; floor++) {
    const y = 3.8 + (floor - 1) * 3.4;
    B(o, 'brick', 0, y + 2.64, -0.16, w, 0.76, 0.64, tan);
    if (d >= 1) B(o, 'concrete', 0, y - 0.12, 0.17, w, 0.16, 1.05, cap);
    for (let i = 0; i < bays; i++)
      window(o, -w / 2 + (i + 0.5) * bay, y + 0.43, -0.38, bay - 0.55, 2.15, d);
    railing(o, w - 0.4, y + 0.02, 0.73, d, floor === 2);
    if (d >= 2)
      for (let i = 0; i < bays; i++)
        for (const sign of [-1, 1])
          B(
            o,
            'concrete',
            -w / 2 + (i + 0.5) * bay + sign * bay * 0.34,
            y - 0.28,
            0.35,
            0.13,
            0.22,
            0.7,
            cap,
          );
    // Two characteristic shallow curved balcony panels on the north street elevation.
    if (north && floor >= 2 && floor <= 3 && d >= 1) {
      const n = d === 1 ? 4 : d === 2 ? 8 : 16,
        ww = bay * 0.86,
        x = -w / 2 + bay * 1.5;
      for (let i = 0; i < n; i++) {
        const a = -ww / 2 + (i * ww) / n,
          b = -ww / 2 + ((i + 1) * ww) / n,
          za = 0.75 + 0.45 * Math.sin((i / n) * Math.PI),
          zb = 0.75 + 0.45 * Math.sin(((i + 1) / n) * Math.PI);
        quad(
          o,
          'concrete',
          [
            [x + a, y + 0.05, za],
            [x + b, y + 0.05, zb],
            [x + b, y + 0.5, zb],
            [x + a, y + 0.5, za],
          ],
          normalFor([x + a, y + 0.05, za], [x + b, y + 0.05, zb], [x + b, y + 0.5, zb]),
          cream,
        );
      }
    }
  }
  // Window-sized holes in the roof parapet, separated from its solid lower wall.
  B(o, 'brick', 0, 17.4, -0.18, w, 0.48, 0.5, tan);
  B(o, 'concrete', 0, 18.18, -0.18, w, 0.12, 0.64, cap);
  const holes = d ? 5 : 0,
    hw = 0.42;
  if (!d) B(o, 'brick', 0, 17.88, -0.18, w, 0.3, 0.5, tan);
  else {
    let left = -w / 2;
    for (let i = 0; i < holes; i++) {
      const cx = -w / 2 + ((i + 0.5) * w) / holes,
        l = cx - hw / 2,
        r = cx + hw / 2;
      if (l > left) B(o, 'brick', (l + left) / 2, 17.88, -0.18, l - left, 0.3, 0.5, tan);
      left = r;
    }
    if (left < w / 2) B(o, 'brick', (left + w / 2) / 2, 17.88, -0.18, w / 2 - left, 0.3, 0.5, tan);
  }
}
function rear(out, r, d) {
  for (const index of [0, 4]) {
    const a = r[index],
      b = r[(index + 1) % r.length],
      { o, w } = edge(out, a, b);
    B(o, 'brick', 0, 0.15, -0.18, w, d ? 13.85 : 14.9, 0.5, tan);
    if (d)
      for (const y of [4.6, 8.0, 11.4])
        for (const x of [-w * 0.28, 0, w * 0.28]) window(o, x, y, 0.085, 1.3, 1.8, d === 1 ? 0 : 1);
    if (d) B(o, 'brick', 0, 14, -0.18, w, 1.05, 0.5, tan);
    if (d) B(o, 'concrete', 0, 15.05, -0.18, w, 0.1, 0.65, cap);
  }
}
function tower(out, a, b, d) {
  const { o, w } = edge(out, a, b); // True diagonal entrance bay, not a round tower.
  const doorW = w - 0.8;
  for (const sign of [-1, 1])
    B(o, 'brick', sign * (w / 2 - 0.18), 0.15, -0.18, 0.36, 17.25, 0.6, tan);
  window(o, 0, 0.35, -1.3, doorW, 2.62, d);
  B(o, 'concrete', 0, 3.05, -0.04, w, 0.65, 0.85, cream);
  face(o, 'metal', 0, 3.31, 0.41, w - 0.25, 0.3, dark);
  if (d >= 2) disk(o, 'concrete', 0, 3.46, 0.425, 0.19, cream, 16);
  for (let i = 0; i < 4; i++) {
    const y = 3.8 + i * 3.4;
    window(o, 0, y + 0.4, -0.35, w - 0.75, 2.2, d);
    B(o, 'brick', 0, y + 2.7, -0.12, w, 0.7, 0.52, tan);
    B(o, 'concrete', 0, y - 0.11, 0.3, w - 0.48, 0.18, 1.25, cap);
    railing(o, w - 0.6, y + 0.03, 0.89, d, i === 2);
  }
  B(o, 'brick', 0, 17.4, -1.8, w, 2.72, 3.6, tan);
  window(o, 0, 17.8, 0.022, w * 0.72, 1.58, d);
  B(o, 'concrete', 0, 17.56, 0.4, w * 0.85, 0.16, 1.2, cap);
  if (!d) face(o, 'concrete', 0, 17.75, 1.02, w * 0.82, 0.7, cream);
  else
    for (let i = 0; i < 5; i++) {
      const pw = (w * 0.82) / 5,
        x = (i - 2) * pw;
      holePanel(o, x, 17.75, 1.02, pw, 0.75, pw * 0.32, d, {
        slot: 'concrete',
        col: cream,
        back: false,
      });
    }
  B(o, 'concrete', 0, 18.5, 1.02, w * 0.85, 0.12, 0.32, cap);
  B(o, 'concrete', 0, 19.25, 0.14, w * 0.95, 0.15, 0.76, cap);
  window(o, 0, 19.65, 0.022, w * 0.52, 0.48, d);
  const tops = [
    [-w / 2, 20.2],
    [-w * 0.35, 20.2],
    [-w * 0.35, 20.8],
    [-w * 0.24, 20.8],
    [-w * 0.24, 21.4],
    [0, 21.7],
    [w * 0.24, 21.4],
    [w * 0.24, 20.8],
    [w * 0.35, 20.8],
    [w * 0.35, 20.2],
    [w / 2, 20.2],
  ];
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i],
      b = tops[i + 1];
    if (Math.abs(a[0] - b[0]) < 0.001) continue;
    quad(
      o,
      'brick',
      [
        [a[0], 20.12, 0.01],
        [b[0], 20.12, 0.01],
        [b[0], b[1], 0.01],
        [a[0], a[1], 0.01],
      ],
      [0, 0, 1],
      tan,
    );
    if (d >= 1) beam(o, 'concrete', [a[0], a[1], 0.0], [b[0], b[1], 0.0], 0.1, 0.23, cap);
  }
  if (d >= 1) {
    disk(o, 'concrete', 0, 20.85, 0.025, 0.2, cream, 12);
    B(o, 'metal', 0, 21.5, -0.12, 0.045, 2.05, 0.045, dark);
  }
  // Back observation-house wall remains inside the native corner envelope.
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign * (w / 2 - 0.15), -1.9);
    window(q, 0, 18.1, 0.18, 1.5, 1.1, Math.min(d, 1));
  }
}
function lantern(o, x, z, y, d) {
  B(o, 'stone', x, y, z, 0.8, 0.18, 0.8, stone);
  B(o, 'stone', x, y + 0.18, z, 0.59, 0.22, 0.59, stone);
  B(o, 'stone', x, y + 0.4, z, 0.18, 1.05, 0.18, stone);
  B(o, 'stone', x, y + 1.38, z, 0.7, 0.12, 0.7, stone);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      B(o, 'stone', x + sx * 0.25, y + 1.5, z + sz * 0.25, 0.08, 0.55, 0.08, stone);
  B(o, 'stone', x, y + 2.05, z, 0.86, 0.12, 0.86, stone);
  loft(
    o,
    'stone',
    [
      [
        [-0.43, y + 2.17, -0.43],
        [0.43, y + 2.17, -0.43],
        [0.43, y + 2.17, 0.43],
        [-0.43, y + 2.17, 0.43],
      ]
        .reverse()
        .map((p) => [p[0] + x, p[1], p[2] + z]),
      [
        [-0.13, y + 2.4, -0.13],
        [0.13, y + 2.4, -0.13],
        [0.13, y + 2.4, 0.13],
        [-0.13, y + 2.4, 0.13],
      ]
        .reverse()
        .map((p) => [p[0] + x, p[1], p[2] + z]),
    ],
    stone,
  );
  if (d >= 2) sphere(o, 'stone', [x, y + 2.52, z], [0.12, 0.12, 0.12], stone, 8, 4);
}
function shrine(out, d) {
  const o = facing(out, Math.PI / 2, 7, 5),
    y = 17.4;
  B(o, 'stone', 0, y, 0, 4.3, 0.22, 3.4, stone);
  for (let i = 0; i < 3; i++)
    B(o, 'stone', 0, y + 0.22, -0.0 + 1.3 - i * 0.27, 1.05, (i + 1) * 0.16, 0.27, stone);
  B(o, 'stone', 0, y + 0.22, -0.15, 1.5, 0.72, 1.2, stone);
  B(o, 'stone', 0, y + 0.94, -0.15, 1.8, 0.16, 1.35, stone);
  B(o, 'stone', 0, y + 1.1, -0.4, 0.75, 0.92, 0.22, stone);
  const n = d < 2 ? 4 : d === 2 ? 8 : 12;
  for (const sign of [-1, 1]) {
    loft(
      o,
      'stone',
      [
        radialRing(y + 0.22, 0.19, 0.19, n, [sign * 1.55, 1.45]),
        radialRing(y + 3.1, 0.15, 0.15, n, [sign * 1.45, 1.45]),
      ],
      stone,
    );
    if (d >= 2) B(o, 'metal', sign * 1.45, y + 3.08, 1.45, 0.02, 0.2, 0.02, dark);
  }
  B(o, 'stone', 0, y + 2.57, 1.45, 4.0, 0.23, 0.23, stone);
  if (d) for (const sign of [-1, 1]) lantern(o, sign * 1.37, -0.15, y + 0.22, d);
}
function rooftop(out, d) {
  // Own flat roof/restaurant wings, open fifth-floor terrace and elevator house.
  const north = [
      [-11.225, -12.399],
      [8.127, -12.399],
      [11.59, -7.773],
      [11.598, -5],
      [-11.237, -5],
    ],
    east = [
      [3.4, -5],
      [11.598, -5],
      [11.645, 11.849],
      [3.4, 12.008],
    ];
  for (const p of [north, east]) poly(out, 'roof', p, 17.22, 17.4, cap);
  // The back-west fifth-floor terrace is open to the sky. Backings are restrained photo estimates.
  B(out, 'brick', -2.8, 14.0, -4.75, 17.4, 3.22, 0.4, tan);
  B(out, 'brick', 3.2, 14.0, 3.4, 0.4, 3.22, 16.8, tan);
  if (d) {
    const q = facing(out, 0, -2.8, -4.48);
    for (const x of [-5.6, -1.9, 1.9, 5.6]) window(q, x, 14.45, 0.01, 3.1, 2.2, d === 1 ? 0 : 2);
    const e = facing(out, -Math.PI / 2, 2.98, 3.4);
    for (const x of [-5, 0, 5]) window(e, x, 14.45, 0.01, 3.4, 2.2, d === 1 ? 0 : 2);
  }
  B(out, 'brick', -7.2, 14.0, 8.1, 4.2, 3.1, 4.7, tan);
  B(out, 'concrete', -7.2, 17.1, 8.1, 4.5, 0.2, 5.0, cap); // Small elevator headhouse.
  if (d) {
    window(facing(out, 0, -7.2, 10.47), 0, 14.4, 0.01, 2.4, 2.1, d === 1 ? 0 : 1);
    railing(facing(out, Math.PI / 2, -5.0, 8.1), 4.7, 17.3, 0, d);
  }
  shrine(out, d);
}
export function hayashiDepartmentStore(out, frame = nativeFrame, d = 3) {
  const r = frame.geometry.outline.slice(0, -1),
    f1 = fillet(r, 2, 1.15),
    f2 = fillet(r, 3, 1.15),
    n = [1, 2, 5, 10][d],
    arc = (a) =>
      Array.from({ length: n + 1 }, (_, i) => [
        a.centre[0] + a.radius * Math.cos(a.a0 + (a.turn * i) / n),
        a.centre[1] + a.radius * Math.sin(a.a0 + (a.turn * i) / n),
      ]),
    round = [r[0], r[1], ...arc(f1), ...arc(f2), r[4]];
  poly(out, 'concrete', round, -0.6, 0.15, cap);
  for (const y of d ? [3.65, 7.05, 10.45, 13.85] : [3.65, 13.85])
    poly(out, 'concrete', round, y, y + 0.15, cap);
  // The fifth-floor terrace is the actual fourth-floor roof slab, not an enclosing solid building.
  if (d) poly(out, 'roof', round, 13.99, 14.0, red);
  street(out, r[1], f1.start, d, true);
  street(out, f2.end, r[4], d, false);
  rear(out, r, d);
  tower(out, f1.end, f2.start, d);
  for (const a of [f1, f2]) {
    const q = curve(out, a);
    face(q, 'brick', 0, 0.15, 0, a.length, 3.5, tan);
    for (let i = 0; i < 4; i++) holePanel(q, 0, 3.8 + i * 3.4, 0, a.length, 3.4, 0.28, d);
  }
  rooftop(out, d);
}
export const hayashiDepartmentStoreSkyline = (o) => hayashiDepartmentStore(o, nativeFrame, 0);
export const hayashiDepartmentStoreDistrict = (o) => hayashiDepartmentStore(o, nativeFrame, 1);
export const hayashiDepartmentStoreStreet = (o) => hayashiDepartmentStore(o, nativeFrame, 2);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.93, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.1 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.04 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
};
export const hayashiDepartmentStoreModel = {
  id: 'hayashi_department_store',
  key: 'hayashi_department_store',
  recipe: 'structure-hayashi-department-store.mjs',
  cell: 'ws/wsj',
  title: 'Hayashi Department Store',
  build: hayashiDepartmentStore,
  surfaces,
  brief:
    'Native northeast chamfer with rounded porthole shoulders, five primary store floors, two broad horizontal-window street facades and concrete/iron balconies. Sixth-floor corner observation bay with five circular balcony holes and stepped parapet, fifth-floor open terrace, elevator headhouse and stone torii/shrine remains. Buff grooved tile, gray concrete/stone, dark frames and opaque backed glazing; own structure only, excluding neighboring stores, street scenery, temporary signs and interiors.',
  camera: [47, 32, -53],
  lookAt: [0, 10, 0],
  portableGroundY: -0.15,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'medium-fi-exterior-source-preview-reviewed-in-qa',
  geographicStatus: 'bounded-preview',
  groundContactBasis:
    'Native chamfered polygon and exterior dry threshold datum fixed before independently frozen published third-party NLSC-claimed2024 20mDTM and model geometry. Datum9.2145m; actual17.59m pixels interpolated at1m. Original official raster/private conversion unavailable. Floor.15/base-.6 are photographic architecture, not terrain-fitting controls; original source field retained.',
  qaCameras: [
    { name: 'corner-entry-arcade', position: [17, 2.2, -19], lookAt: [9, 1.8, -10] },
    { name: 'corner-front', position: [35, 13, -39], lookAt: [7, 10, -8] },
    { name: 'north-balconies', position: [-13, 11, -41], lookAt: [-2, 9, -11] },
    { name: 'east-balconies', position: [38, 12, 12], lookAt: [11, 10, 0] },
    { name: 'observation-and-portholes', position: [24, 24, -27], lookAt: [9, 17, -9] },
    { name: 'roof-terrace', position: [-30, 35, 22], lookAt: [-3, 15, 2] },
    { name: 'rooftop-shrine', position: [15, 24, 6], lookAt: [7, 19, 5] },
    { name: 'rear-elevations', position: [-35, 16, 30], lookAt: [0, 9, 3] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hayashi-department-store.mjs',
    level: 'skyline',
    export: 'hayashiDepartmentStoreSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'hayashiDepartmentStoreDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'hayashiDepartmentStoreStreet', errorMeters: 0.5, surfaces },
    },
  },
  limitations: [
    'Approximate photographic exterior with bounded source-ground preview. Current source/story completion evidence is bound in qa.json; this is not a surveyed current replacement or navigable interior.',
    'Quantized native551.25m² polygon and generic15m map height retained as map facts. Photo-directed approximately17.4m street roof and21.7m corner parapet are visualization estimates, not survey dimensions.',
    'Rounded corner shoulders, terrace/elevator-house/shrine positions, upper/rear fenestration and fine artwork are conservative estimates; interior and neighboring buildings excluded.',
    'Third-party published NLSC-claimed20mDTM preserved before geometry; original official raster/private conversion unavailable.1m interpolation is not1m accuracy. Compatible source preview only; another host DEM needs contact review.',
    'Original photo pixels are not model textures; all shared materials use ordinary catalog graphs. No generic footprint replacement or whole-site terrain pad.',
  ],
};
