/** Trakai: open trapezoidal forecourt, three cone towers and the separate ducal palace. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u9/u99/n0280_trakai_island_castle/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
const references = JSON.parse(
  readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)),
);
export const trakaiPalette = {
  brick: '#c68d70',
  stone: '#c0b69e',
  roof: '#b77556',
  wood: '#987b58',
  trim: '#dfc7a1',
  glass: '#4d6178',
  paving: '#b5b0a3',
};
const colors = Object.fromEntries(
  Object.entries(trakaiPalette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function local(o, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, col) =>
        o[k](
          slot,
          ref,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + x, q[1], q[2] + z];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function face(o, points, col = 'brick', slot = 'brick', target) {
  let p = points;
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (axis === 1 ? [v[0], v[2]] : axis === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function cap(o, ring, y, col = 'paving', slot = 'stone') {
  const p =
    ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  const ids = earcut(p.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function rect(o, x, y, z, w, h, depth, col = 'brick', slot = 'brick') {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - depth / 2,
    e = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, e],
        [b, y, e],
        [b, t, e],
        [a, t, e],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, c],
        [a, y, c],
        [a, t, c],
        [b, t, c],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, c],
        [a, y, e],
        [a, t, e],
        [a, t, c],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, e],
        [b, y, c],
        [b, t, c],
        [b, t, e],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, c],
        [b, t, c],
        [b, t, e],
        [a, t, e],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function pane(o, x, y, z, w, h, d, arch = false, surround = false) {
  const p = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
  ];
  if (arch) {
    const n = d === 1 ? 3 : 5;
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / n;
      p.push([x + (w / 2) * Math.cos(a), y + h - w / 2 + (w / 2) * Math.sin(a), z]);
    }
  } else p.push([x + w / 2, y + h, z], [x - w / 2, y + h, z]);
  face(o, p, 'glass', 'glass', [0, 0, 1]);
  if (!surround || d < 3) return;
  for (const s of [-1, 1])
    face(
      o,
      [
        [x + (s * w) / 2, y, z + 0.025],
        [x + s * (w / 2 + 0.3), y, z + 0.025],
        [x + s * (w / 2 + 0.3), y + h, z + 0.025],
        [x + (s * w) / 2, y + h, z + 0.025],
      ],
      'trim',
      'brick',
      [0, 0, 1],
    );
}
function hip(o, w, depth, y, top) {
  const ridge = Math.max(0, (w - depth) / 2);
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [ridge, top, 0],
        [-ridge, top, 0],
      ],
      'roof',
      'tile',
      [0, 1, s],
    );
    face(
      o,
      [
        [(s * w) / 2, y, -depth / 2],
        [(s * w) / 2, y, depth / 2],
        [s * ridge, top, 0],
      ],
      'roof',
      'tile',
      [s, 1, 0],
    );
  }
}
function prism(o, loop, lo, hi, col, slot) {
  const area = loop.reduce((s, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = area > 0 ? 1 : -1;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length];
    face(
      o,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      col,
      slot,
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
  cap(o, loop, hi, col, slot);
}
function portal(o, w, depth, top, d) {
  const half = 1.65,
    spring = 3.3,
    n = d < 2 ? 4 : 8;
  for (const s of [-1, 1]) {
    const z = (s * depth) / 2,
      p = (x, y) => [x, y, z];
    for (const [lo, hi] of [
      [-w / 2, -half],
      [half, w / 2],
    ])
      face(o, [p(lo, 0), p(hi, 0), p(hi, top), p(lo, top)], 'brick', 'brick', [0, 0, s]);
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (i * Math.PI) / n,
        b = Math.PI - ((i + 1) * Math.PI) / n,
        x = half * Math.cos(a),
        e = half * Math.cos(b);
      face(
        o,
        [
          p(x, spring + half * Math.sin(a)),
          p(e, spring + half * Math.sin(b)),
          p(e, top),
          p(x, top),
        ],
        'brick',
        'brick',
        [0, 0, s],
      );
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      p = (t, z) => [half * Math.cos(t), spring + half * Math.sin(t), z];
    face(
      o,
      [p(a, -depth / 2), p(a, depth / 2), p(b, depth / 2), p(b, -depth / 2)],
      'brick',
      'brick',
      [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
    );
  }
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [s * half, 0, -depth / 2],
        [s * half, 0, depth / 2],
        [s * half, spring, depth / 2],
        [s * half, spring, -depth / 2],
      ],
      'brick',
      'brick',
      [-s, 0, 0],
    );
    face(
      o,
      [
        [(s * w) / 2, 0, -depth / 2],
        [(s * w) / 2, 0, depth / 2],
        [(s * w) / 2, top, depth / 2],
        [(s * w) / 2, top, -depth / 2],
      ],
      'brick',
      'brick',
      [s, 0, 0],
    );
  }
  face(
    o,
    [
      [-w / 2, top, -depth / 2],
      [w / 2, top, -depth / 2],
      [w / 2, top, depth / 2],
      [-w / 2, top, depth / 2],
    ],
    'brick',
    'brick',
    [0, 1, 0],
  );
}
function tower(o, t, d) {
  const q = local(o, ...t.center),
    n = d === 0 ? 8 : d === 1 ? 12 : 16;
  const loop = Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.5) * 2 * Math.PI) / n;
    return [t.radius * Math.cos(a), t.radius * Math.sin(a)];
  });
  prism(q, loop, 0, 6.2, 'stone', 'stone');
  prism(q, loop, 6.2, t.wallTop, 'brick', 'brick');
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / n,
      b = ((i + 1.5) * 2 * Math.PI) / n,
      r = t.radius + 0.55;
    face(
      q,
      [
        [r * Math.cos(a), t.wallTop, r * Math.sin(a)],
        [r * Math.cos(b), t.wallTop, r * Math.sin(b)],
        [0, t.roofTop, 0],
      ],
      'roof',
      'tile',
      [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
    );
  }
  if (d === 0) return;
  for (let i = 0; i < n; i += d === 1 ? 2 : 1) {
    const a = ((i + 1) * 2 * Math.PI) / n,
      f = local(q, 0, 0, Math.PI / 2 - a),
      z = t.radius * Math.cos(Math.PI / n) + 0.04;
    for (const y of d === 1 ? [3, 9] : [3, 7.2, 11.2])
      pane(f, 0, y, z, 1.15, 1.85, d, y > 7, d >= 3 && y === 7.2);
    if (d >= 2) pane(f, 0, t.wallTop - 1.1, z, 0.5, 0.6, d);
  }
}
function wall(o, a, b, height, d, { gate = false, roof = true } = {}) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
  const runs = gate
    ? [
        [-length / 2, -2.1],
        [2.1, length / 2],
      ]
    : [[-length / 2, length / 2]];
  for (const [lo, hi] of runs) {
    const width = hi - lo,
      x = (lo + hi) / 2;
    if (d === 0) rect(q, x, 0, 0, width, height, 2, 'stone', 'stone');
    else {
      rect(q, x, 0, 0, width, height - 1.8, 2, 'stone', 'stone');
      rect(q, x, height - 1.8, 0, width, 1.8, 2, 'brick', 'brick');
    }
    if (roof) hip(local(q, x, 0), width + 0.3, 2.8, height, height + 1.1);
    if (d >= 1 && height > 7) {
      const bays = Math.floor(width / (d === 1 ? 10 : 6));
      for (let j = 0; j < bays; j++)
        for (const s of [-1, 1])
          pane(
            local(q, 0, 0, s === 1 ? 0 : Math.PI),
            s * (lo + ((j + 0.5) * width) / bays),
            height - 1.1,
            1.04,
            0.65,
            0.75,
            d,
          );
    }
  }
}
function casemate(o, a, b, d) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    angle = Math.atan2(-dz, dx),
    nx = dz / length,
    nz = -dx / length;
  const q = local(o, (a[0] + b[0]) / 2 + nx * 4.6, (a[1] + b[1]) / 2 + nz * 4.6, angle),
    w = length - 10;
  rect(q, 0, 0, 0, w, 4.8, 10, 'stone', 'stone');
  rect(q, 0, 4.8, 0, w, 5.4, 10, 'brick', 'brick');
  hip(q, w + 0.5, 10.6, 10.2, 15.8);
  if (d === 0) return;
  for (const s of [-1, 1]) {
    const f = local(q, 0, 0, s === 1 ? 0 : Math.PI),
      bays = Math.floor(w / (d === 1 ? 9 : 5.5));
    for (let j = 0; j < bays; j++)
      pane(f, ((j + 0.5) * w) / bays - w / 2, 6, 5.04, 1.25, 2.2, d, true, d >= 3);
  }
  if (d >= 2)
    for (let x = -w / 2 + 5; x < w / 2 - 3; x += 10)
      rect(q, x, 0, -5.6, 1.25, 5.7, 1.5, 'stone', 'stone');
}
function gatehouse(o, d) {
  const c = frame.controls,
    b = c.forecourt[1],
    e = c.forecourt[2],
    angle = Math.atan2(-(e[1] - b[1]), e[0] - b[0]);
  // Keep the entry on the curtain line rather than the apparent center of its roof.
  const t = (c.gate.center[0] - b[0]) * (e[0] - b[0]) + (c.gate.center[1] - b[1]) * (e[1] - b[1]);
  const length2 = Math.pow(e[0] - b[0], 2) + Math.pow(e[1] - b[1], 2),
    u = t / length2;
  const center = [b[0] + u * (e[0] - b[0]), b[1] + u * (e[1] - b[1])],
    q = local(o, ...center, angle),
    w = 9.6,
    depth = 8.8;
  portal(q, w, depth, c.gate.wallTop, d);
  hip(q, w + 1, depth + 1, c.gate.wallTop, c.gate.roofTop);
  if (d >= 1)
    for (const s of [-1, 1]) {
      const f = local(q, 0, 0, s === 1 ? 0 : Math.PI);
      pane(f, 0, 9.3, depth / 2 + 0.04, 1.2, 3, d, true, d >= 3);
      for (const x of [-3, 3]) pane(f, x, 14.1, depth / 2 + 0.04, 0.7, 1, d);
    }
  const half = w / 2,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const p = (s) => [center[0] + s * half * cos, center[1] - s * half * sin];
  wall(o, b, p(-1), 8.3, d);
  wall(o, p(1), e, 8.3, d);
}
function palaceWing(o, bounds, eave, roofTop, d, outline) {
  const [a, b] = bounds,
    w = b[0] - a[0],
    depth = b[1] - a[1],
    x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2,
    q = local(o, x, z);
  const loop = outline ?? [a, [b[0], a[1]], b, [a[0], b[1]]];
  prism(o, loop, 0, 5.3, 'stone', 'stone');
  prism(o, loop, 5.3, eave, 'brick', 'brick');
  hip(local(q, 0, 0, Math.PI / 2), depth + 0.65, w + 0.6, eave, roofTop);
  if (d === 0) return;
  const area = loop.reduce((sum, p, i) => {
    const e = loop[(i + 1) % loop.length];
    return sum + p[0] * e[1] - e[0] * p[1];
  }, 0);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 6) continue;
    const sign = area > 0 ? 1 : -1,
      normal = [(sign * (b[1] - a[1])) / length, (sign * (a[0] - b[0])) / length];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      f = local(o, ...mid, Math.atan2(normal[0], normal[1]));
    const bays = Math.floor(length / (d === 1 ? 8 : 5.5));
    for (let j = 0; j < bays; j++) {
      const u = ((j + 0.5) * length) / bays - length / 2;
      pane(f, u, 7, 0.04, 1.6, 3.1, d, true, d >= 3);
      if (d >= 2) pane(f, u, 1.2, 0.04, 0.8, 1.5, d);
    }
    if (d >= 2 && Math.abs(mid[0]) > 16)
      for (let u = -length / 2 + 3; u < length / 2 - 1; u += 8) {
        // Broad sloping buttresses, not narrow facade ornament.
        face(
          f,
          [
            [u - 0.7, 0, 1.6],
            [u + 0.7, 0, 1.6],
            [u + 0.7, 8, 0.05],
            [u - 0.7, 8, 0.05],
          ],
          'stone',
          'stone',
          [0, 1, 1],
        );
        for (const t of [-1, 1])
          face(
            f,
            [
              [u + t * 0.7, 0, 0],
              [u + t * 0.7, 0, 1.6],
              [u + t * 0.7, 8, 0.05],
            ],
            'stone',
            'stone',
            [t, 0, 0],
          );
      }
  }
}
function donjon(o, d) {
  const t = frame.controls.donjon,
    q = local(o, ...t.center),
    w = t.width,
    depth = t.depth,
    y = t.wallTop;
  portal(q, w, depth, y, d);
  for (const s of [-1, 1]) {
    face(
      q,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [0, t.roofTop, (s * depth) / 2],
      ],
      'brick',
      'brick',
      [0, 0, s],
    );
    face(
      q,
      [
        [s * (w / 2 + 0.3), y, -depth / 2 - 0.3],
        [s * (w / 2 + 0.3), y, depth / 2 + 0.3],
        [0, t.roofTop, depth / 2 + 0.3],
        [0, t.roofTop, -depth / 2 - 0.3],
      ],
      'roof',
      'tile',
      [s, 1, 0],
    );
  }
  if (d === 0) return;
  for (const s of [-1, 1]) {
    const f = local(q, 0, 0, s === 1 ? 0 : Math.PI);
    for (const h of [7, 12, 17, 21.5])
      for (const x of d === 1 ? [0] : [-2.75, 0, 2.75])
        pane(f, x, h, depth / 2 + 0.04, 1.05, 1.9, d, true, d >= 3 && h === 12);
    if (d >= 2)
      for (const x of [-2, 0, 2])
        face(
          f,
          [
            [x - 0.22, 26, depth / 2 + 0.04],
            [x + 0.22, 26, depth / 2 + 0.04],
            [x + 0.22, 29.8 - Math.abs(x), depth / 2 + 0.04],
            [x - 0.22, 29.8 - Math.abs(x), depth / 2 + 0.04],
          ],
          'trim',
          'brick',
          [0, 0, 1],
        );
    for (const t of [-1, 1])
      for (const h of [7, 12, 17, 21.5])
        pane(
          local(q, 0, 0, (t * Math.PI) / 2),
          0,
          h,
          w / 2 + 0.04,
          1.1,
          1.8,
          d,
          true,
          d >= 3 && h === 12,
        );
  }
}
function gallery(o, d) {
  for (const [x, z, len, angle] of [
    [-3.56, -3.7, 17, Math.PI / 2],
    [2.32, -3.7, 17, Math.PI / 2],
    [-0.62, -11.62, 7.28, 0],
  ]) {
    const q = local(o, x, z, angle);
    rect(q, 0, 6.5, 0, len, 0.5, 1.4, 'wood', 'wood');
    rect(q, 0, 7, 0, len, 0.85, 0.3, 'wood', 'wood');
    if (d >= 1) rect(q, 0, 10.8, 0, len, 0.35, 1.4, 'wood', 'wood');
    if (d >= 2)
      for (let u = -len / 2 + 0.6; u < len / 2; u += 3.4)
        rect(q, u, 7, 0, 0.35, 3.9, 0.35, 'wood', 'wood');
  }
}
function bridge(o, d) {
  const t = frame.controls.bridge,
    w = t.width,
    x = t.centerX,
    a = t.startZ,
    b = t.endZ;
  rect(o, x, 0.08, (a + b) / 2, w, t.deckY - 0.08, b - a, 'wood', 'wood');
  if (d === 0) return;
  for (const s of [-1, 1]) {
    rect(o, x + s * (w / 2 - 0.2), t.deckY + 0.5, (a + b) / 2, 0.32, 0.32, b - a, 'wood', 'wood');
    rect(o, x + s * (w / 2 - 0.2), t.deckY + 1.15, (a + b) / 2, 0.32, 0.32, b - a, 'wood', 'wood');
    for (let z = a + 0.6; z < b; z += 3.2)
      rect(o, x + s * (w / 2 - 0.2), 0.08, z, 0.4, 1.7, 0.4, 'wood', 'wood');
  }
}
function precinct(o, d) {
  const c = frame.controls;
  cap(o, c.precinct, 0);
  for (let i = 0; i < 4; i++) {
    if (i === 2) {
      wall(o, c.precinct[i], [c.bridge.centerX + 2.2, 26], 2.8, d, { roof: false });
      wall(o, [c.bridge.centerX - 2.2, 26], c.precinct[3], 2.8, d, { roof: false });
    } else wall(o, c.precinct[i], c.precinct[(i + 1) % 4], 2.8, d, { roof: false });
  }
  if (d >= 2)
    for (const x of [-24, 24])
      for (const z of [-18, -6, 6, 18]) rect(o, x, 0, z, 2.4, 3.8, 1.2, 'stone', 'stone');
}
function castle(o, d) {
  const c = frame.controls,
    [a, b, e, f] = c.forecourt;
  cap(o, c.forecourt, 0);
  casemate(o, a, b, d);
  wall(o, e, f, 8.3, d);
  const x = c.bridge.centerX,
    z = c.bridge.endZ,
    dx = f[0] - a[0],
    dz = f[1] - a[1],
    len = Math.hypot(dx, dz),
    half = 2.2;
  wall(o, a, [x - (half * dx) / len, z - (half * dz) / len], 5.3, d, { roof: false });
  wall(o, [x + (half * dx) / len, z + (half * dz) / len], f, 5.3, d, { roof: false });
  gatehouse(o, d);
  for (const t of c.towers) tower(o, t, d);
  precinct(o, d);
  palaceWing(o, c.palace.left, c.palace.leftEave, c.palace.leftRoof, d, c.palace.leftOutline);
  palaceWing(o, c.palace.right, c.palace.rightEave, c.palace.rightRoof, d, c.palace.rightOutline);
  palaceWing(o, c.palace.back, c.palace.backEave, c.palace.backRoof, d);
  donjon(o, d);
  portal(local(o, c.donjon.center[0], (4.713 + 8.034) / 2), 7.28, 8.034 - 4.713, 11.5, d);
  gallery(o, d);
  bridge(o, d);
}
export const buildTrakaiRuntime = (o, level = 'closeup') =>
  castle(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildTrakaiSkyline = (o) =>
  castle(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            'silhouette',
            r,
            p,
            n,
            uv,
            c.map((v) => v * (s === 'glass' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const trakaiStudy = {
  id: 'N0280',
  key: 'trakai_island_castle',
  title: 'Trakai Island Castle',
  category: 'castle',
  wikidataId: 'Q1482013',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildTrakaiRuntime(o),
  brief:
    'Restored Trakai compound with open trapezoidal forecourt,three cone-roof corner towers,arched entry tower,western casemate and separate open-court ducal palace with a tall gabled donjon,short wooden bridge and stone precinct.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: trakaiPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Three faceted red-tile cone towers and square arched entrance',
      'Open trapezoidal forecourt with long western casemate',
      'Separate U-shaped palace,tall gabled donjon and connecting bridge',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/3111261 exact Q1482013 palace multipolygon only',
    mappedPalacePlanMeters: [38.019, 35.269],
    mappedPalaceCourtyardHoles: 1,
    documentedPlannedDonjonMeters: { width: 9.2, depth: 9.6, height: 33 },
    forecourtMetricSurvey: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped palace38.019×35.269m;primary archaeological site-plan forecourt trace at50/135m per pixel. Donjon9.2×9.6m/33m is a documented historical plan,not current as-built survey. Other dimensions are photo-based estimates.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors,ODbL-1.0. Research photos and archaeological aerial plan linked only,not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors. Trakai History Museum,Lithuanian Archaeological Society/Tautvydas Bajarūnas,Trakai Tourism Information Centre and Go Vilnius.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Cached palace frame and approximate whole-castle trace;forecourt registration,restored heights,moat/bridge levels,terrain and direction require real-site review.',
    reviewStatus: 'Inactive geographic draft;review pending',
  }),
  geographicNote:
    'Mapped identity covers palace only. Whole-compound trace is visually aligned,not surveyed. Actual island,terrain,moat,shore bridge,facade orientation and footprint replacement pending.',
  limitations: references.limitations,
  importReason:
    'Retain Trakai tower/forecourt/palace hierarchy,open courts,real gate voids and short connecting bridge in compact shared-material LODs.',
  mediumFiContext: { scale: '1.25', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [195, 135, 200], lookAt: [22, 9, 35], fov: 43 },
  qaCameras: [
    { name: 'three-cones-and-entry', position: [137, 26, 157], lookAt: [49, 11, 64] },
    { name: 'palace-donjon', position: [67, 28, 52], lookAt: [0, 19, 7] },
    { name: 'two-open-courts', position: [22, 240, 37], lookAt: [22, 0, 37] },
    { name: 'entry-passage', position: [90, 9, 116], lookAt: [56, 4, 82] },
    { name: 'palace-wood-gallery', position: [0, 8.5, 2.5], lookAt: [-3.56, 8, -3.7] },
    { name: 'moat-bridge-and-casemates', position: [-56, 50, 27], lookAt: [3, 7, 37] },
  ],
};
