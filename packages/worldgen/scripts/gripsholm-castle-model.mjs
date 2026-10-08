/** Gripsholm: mapped two-court brick compound and four different copper tower caps. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u6/u6s/n0279_gripsholm_castle/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
const references = JSON.parse(
  readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)),
);
export const gripsholmPalette = {
  brick: '#c58d72',
  red: '#bf7965',
  stone: '#b9b2a2',
  trim: '#e4ddc9',
  copper: '#71877c',
  tile: '#ae8667',
  glass: '#4d6178',
  clock: '#3b3e42',
  paving: '#b5afa1',
};
const colors = Object.fromEntries(
  Object.entries(gripsholmPalette).map(([key, hex]) => [
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
const rect = (o, x, y, z, w, h, depth, col = 'brick', slot = 'brick') =>
  box(o, slot, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], colors[col]);
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
function cap(o, loop, y, holes = [], col = 'paving', slot = 'stone') {
  const rings = [loop, ...holes].map((r) =>
    r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r,
  );
  const vertices = rings.flat(),
    offsets = [];
  let count = rings[0].length;
  for (const r of rings.slice(1)) {
    offsets.push(count);
    count += r.length;
  }
  const ids = earcut(vertices.flat(), offsets, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [vertices[j][0], y, vertices[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function edge(o, a, b) {
  return {
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0])),
  };
}
function pane(o, x, y, z, w, h, d, arch = false, surround = false) {
  const p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
    ],
    n = d === 1 ? 3 : 5;
  if (arch)
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / n;
      p.push([x + (w / 2) * Math.cos(a), y + h - w / 2 + (w / 2) * Math.sin(a), z]);
    }
  else p.push([x + w / 2, y + h, z], [x - w / 2, y + h, z]);
  face(o, p, 'glass', 'glass', [0, 0, 1]);
  if (d < 3 || !surround) return;
  const top = arch ? y + h - w / 2 : y + h;
  for (const s of [-1, 1])
    face(
      o,
      [
        [x + (s * w) / 2, y, z + 0.04],
        [x + s * (w / 2 + 0.28), y, z + 0.04],
        [x + s * (w / 2 + 0.28), top, z + 0.04],
        [x + (s * w) / 2, top, z + 0.04],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
  if (!arch)
    face(
      o,
      [
        [x - w / 2 - 0.28, top, z + 0.04],
        [x + w / 2 + 0.28, top, z + 0.04],
        [x + w / 2 + 0.28, top + 0.28, z + 0.04],
        [x - w / 2 - 0.28, top + 0.28, z + 0.04],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
}
function portalFace(o, a, b, top, normal, d) {
  const { length } = edge(o, a, b),
    center = frame.controls.gate.center;
  const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    offset = (center[0] - (a[0] + b[0]) / 2) * u[0] + (center[1] - (a[1] + b[1]) / 2) * u[1];
  const half = 3.2,
    spring = 3.6,
    n = d < 2 ? 4 : 8;
  const p = (x, y) => [a[0] + (x + length / 2) * u[0], y, a[1] + (x + length / 2) * u[1]];
  for (const [lo, hi] of [
    [-length / 2, offset - half],
    [offset + half, length / 2],
  ]) {
    face(o, [p(lo, 0), p(hi, 0), p(hi, 2.8), p(lo, 2.8)], 'stone', 'stone', normal);
    face(o, [p(lo, 2.8), p(hi, 2.8), p(hi, top), p(lo, top)], 'red', 'brick', normal);
  }
  for (let i = 0; i < n; i++) {
    const c = Math.PI - (i * Math.PI) / n,
      e = Math.PI - ((i + 1) * Math.PI) / n;
    const x = offset + half * Math.cos(c),
      z = offset + half * Math.cos(e);
    face(
      o,
      [p(x, spring + half * Math.sin(c)), p(z, spring + half * Math.sin(e)), p(z, top), p(x, top)],
      'red',
      'brick',
      normal,
    );
  }
  // The through tunnel is added once,between the corresponding external/internal openings.
}
function gateTunnel(o, d) {
  const t = frame.controls.gate,
    n = d < 2 ? 4 : 8,
    p = (x, a) => [
      x,
      t.spring + t.halfWidth * Math.sin(a),
      t.center[1] + t.halfWidth * Math.cos(a),
    ];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(o, [p(t.outerX, a), p(t.innerX, a), p(t.innerX, b), p(t.outerX, b)], 'brick', 'brick', [
      0,
      -Math.sin((a + b) / 2),
      -Math.cos((a + b) / 2),
    ]);
  }
  for (const s of [-1, 1])
    face(
      o,
      [
        [t.outerX, 0, t.center[1] + s * t.halfWidth],
        [t.innerX, 0, t.center[1] + s * t.halfWidth],
        [t.innerX, t.spring, t.center[1] + s * t.halfWidth],
        [t.outerX, t.spring, t.center[1] + s * t.halfWidth],
      ],
      'stone',
      'stone',
      [0, 0, -s],
    );
}
function body(o, loop, top, d, { holes = [], col = 'brick', gates = [] } = {}) {
  const rings = [loop, ...holes].map((r) =>
    r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r,
  );
  cap(o, rings[0], top, rings.slice(1), col, 'brick');
  for (const [ri, r] of rings.entries()) {
    const area = r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const sign = (area > 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const normal = [(sign * (b[1] - a[1])) / length, 0, (sign * (a[0] - b[0])) / length];
      if (ri === 0 && gates.includes(i)) {
        portalFace(o, a, b, top, normal, d);
        continue;
      }
      if (d === 0)
        face(
          o,
          [
            [a[0], 0, a[1]],
            [b[0], 0, b[1]],
            [b[0], top, b[1]],
            [a[0], top, a[1]],
          ],
          col,
          'brick',
          normal,
        );
      else {
        face(
          o,
          [
            [a[0], 0, a[1]],
            [b[0], 0, b[1]],
            [b[0], 2.8, b[1]],
            [a[0], 2.8, a[1]],
          ],
          'stone',
          'stone',
          normal,
        );
        face(
          o,
          [
            [a[0], 2.8, a[1]],
            [b[0], 2.8, b[1]],
            [b[0], top, b[1]],
            [a[0], top, a[1]],
          ],
          col,
          'brick',
          normal,
        );
      }
      if (d === 0 || length < 5) continue;
      const q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(normal[0], normal[2]));
      const bays = Math.max(1, Math.floor(length / (d === 1 ? 10 : 6))),
        floors = top > 18 ? [4, 9, 14, 18] : top > 11 ? [4, 8.6] : [4.2];
      for (let j = 0; j < bays; j++)
        for (const y of floors) {
          if (d === 1 && y === 18) continue;
          pane(
            q,
            ((j + 0.5) * length) / bays - length / 2,
            y,
            0.06,
            top > 18 ? 1.25 : 1.35,
            top > 11 ? 2.2 : 1.8,
            d,
            top > 18 && y === 18,
            d >= 3 && (y === 9 || top < 18),
          );
        }
    }
  }
}
function radial(o, radius, y, top, sides, col = 'brick', slot = 'brick', upper = radius) {
  const a = Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides + Math.PI / sides;
    return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
  });
  const b = a.map(([x, , z]) => [(x * upper) / radius, top, (z * upper) / radius]);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    face(o, [a[i], a[j], b[j], b[i]], col, slot, [a[i][0] + a[j][0], 0, a[i][2] + a[j][2]]);
  }
  face(o, b, col, slot, [0, 1, 0]);
}
function profile(o, rings, sides, col = 'copper', slot = 'patina') {
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < sides; i++) {
      const a = (2 * Math.PI * i) / sides + Math.PI / sides,
        b = a + (2 * Math.PI) / sides;
      const p = (r, angle) => [r[1] * Math.cos(angle), r[0], r[1] * Math.sin(angle)];
      face(o, [p(rings[j], a), p(rings[j], b), p(rings[j + 1], b), p(rings[j + 1], a)], col, slot, [
        Math.cos((a + b) / 2),
        0.1,
        Math.sin((a + b) / 2),
      ]);
    }
  const last = rings.at(-1);
  face(
    o,
    Array.from({ length: sides }, (_, i) => {
      const a = (2 * Math.PI * i) / sides + Math.PI / sides;
      return [last[1] * Math.cos(a), last[0], last[1] * Math.sin(a)];
    }),
    col,
    slot,
    [0, 1, 0],
  );
}
function lantern(o, radius, y, top, d) {
  const n = d === 0 ? 4 : 8;
  radial(o, radius + 0.25, y, y + 0.45, 8, 'copper', 'patina');
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    rect(
      local(o, radius * Math.cos(a), radius * Math.sin(a), Math.PI / 2 - a),
      0,
      y + 0.45,
      0,
      0.6,
      top - y - 0.45,
      0.7,
      'copper',
      'patina',
    );
  }
  // Real open lantern,with no dark enclosing cylinder between the supports.
  radial(o, radius + 0.25, top - 0.3, top, 8, 'copper', 'patina');
}
function tower(o, t, d) {
  const q = local(o, ...t.center),
    n = d === 0 ? 6 : d === 1 ? 12 : 16,
    col = t.roofType === 'helmet' ? 'red' : 'brick';
  if (d === 0) radial(q, t.radius, 0, t.wallTop, n, col);
  else {
    radial(q, t.radius, 0, 2.8, n, 'stone', 'stone');
    radial(q, t.radius, 2.8, t.wallTop, n, col);
  }
  radial(q, t.radius + 0.4, t.wallTop, t.wallTop + 0.6, n, 'trim', 'limestone');
  if (t.roofType === 'lantern') {
    profile(
      q,
      d === 0
        ? [
            [24.6, 8.55],
            [28, 8],
            [31, 5.2],
            [33.2, 2.3],
          ]
        : [
            [24.6, 8.55],
            [26, 8.5],
            [28, 7.9],
            [30, 6.4],
            [32, 3.8],
            [33.2, 2.3],
          ],
      n,
    );
    lantern(q, 2.25, 33.2, 37.5, d);
    profile(
      q,
      [
        [37.5, 3.1],
        [38.4, 2.1],
        [40, 0.85],
        [40.8, 0.3],
        [42, 0.08],
      ],
      n,
    );
  } else if (t.roofType === 'helmet') {
    profile(
      q,
      d === 0
        ? [
            [26.6, 10.5],
            [29, 8.8],
            [31.5, 4],
            [32.4, 2.2],
          ]
        : [
            [26.6, 10.5],
            [27.3, 10],
            [28.5, 9.1],
            [30, 7.7],
            [31.5, 4],
            [32.4, 2.2],
          ],
      n,
    );
    radial(q, 2.2, 32.4, 34.2, 8, col);
    profile(
      q,
      [
        [34.2, 3],
        [35.2, 1.5],
        [36, 0.3],
        [37, 0.08],
      ],
      n,
    );
    if (d >= 1)
      for (let i = 0; i < 8; i++)
        pane(local(q, 0, 0, (2 * Math.PI * i) / 8), 0, 32.7, 2.09, 0.75, 1, d);
  } else if (t.roofType === 'onion') {
    profile(
      q,
      d === 0
        ? [
            [24.6, 7.7],
            [28, 7.2],
            [31, 4.5],
            [32, 1.4],
            [33.3, 2],
            [34.4, 1.8],
            [35.5, 0.3],
            [37, 0.08],
          ]
        : [
            [24.6, 7.7],
            [26, 7.8],
            [28, 7.2],
            [30, 5.6],
            [31.6, 2.3],
            [32, 1.4],
            [33.3, 2],
            [34.4, 1.8],
            [35.5, 0.3],
            [37, 0.08],
          ],
      n,
    );
  } else {
    profile(
      q,
      [
        [23.1, 9.1],
        [25.5, 7.8],
        [28, 3.3],
        [29, 1.8],
      ],
      n,
    );
    radial(q, 1.8, 29, 30.5, 8, col);
    profile(
      q,
      [
        [30.5, 2.3],
        [31.4, 1.3],
        [32, 0.25],
        [33, 0.08],
      ],
      n,
    );
  }
  if (d === 0) return;
  for (let i = 0; i < n; i += d === 1 ? 2 : 1) {
    const a = (2 * Math.PI * (i + 1)) / n,
      f = local(q, 0, 0, Math.PI / 2 - a),
      z = t.radius * Math.cos(Math.PI / n) + 0.06;
    for (const y of [4, 9, 14, 19]) pane(f, 0, y, z, 1.1, 2, d, y === 19, d >= 3 && y === 9);
  }
  if (d >= 2) {
    radial(q, t.radius + 0.18, 13.3, 13.65, n, 'trim', 'limestone');
    if (t.roofType === 'helmet') radial(q, t.radius + 0.2, 20.8, 21.2, n, 'trim', 'limestone');
  }
  if (d >= 2 && t.roofType === 'lantern')
    clock(local(q, 0, 0, Math.PI), 0, 21.8, t.radius * Math.cos(Math.PI / n) + 0.1, d);
}
function clock(o, x, y, z, d) {
  const n = 12,
    r = 1.6;
  face(
    o,
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((2 * Math.PI * i) / n),
      y + r * Math.sin((2 * Math.PI * i) / n),
      z,
    ]),
    'clock',
    'glass',
    [0, 0, 1],
  );
  if (d < 3) return;
  // Broad hands survive the 0.21m closeup error; minute tick geometry is omitted.
  face(
    o,
    [
      [x - 0.14, y - 0.15, z + 0.04],
      [x + 0.14, y - 0.15, z + 0.04],
      [x + 0.14, y + 1.2, z + 0.04],
      [x - 0.14, y + 1.2, z + 0.04],
    ],
    'trim',
    'limestone',
    [0, 0, 1],
  );
  face(
    o,
    [
      [x - 0.14, y - 0.14, z + 0.05],
      [x + 0.93, y + 0.37, z + 0.05],
      [x + 0.81, y + 0.63, z + 0.05],
      [x - 0.26, y + 0.12, z + 0.05],
    ],
    'trim',
    'limestone',
    [0, 0, 1],
  );
}
function hip(o, w, depth, y, top, col = 'tile') {
  const ridge = Math.max(0, (w - depth) * 0.5),
    slot = col === 'tile' ? 'tile' : 'patina';
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [ridge, top, 0],
        [-ridge, top, 0],
      ],
      col,
      slot,
      [0, 1, s],
    );
    face(
      o,
      [
        [(s * w) / 2, y, -depth / 2],
        [(s * w) / 2, y, depth / 2],
        [s * ridge, top, 0],
      ],
      col,
      slot,
      [s, 1, 0],
    );
  }
}
function courtyardRoof(o) {
  const inner = frame.geometry.holes[0].slice(0, -1),
    outer = frame.controls.innerRoofOuter;
  const ridge = inner.map((p, i) => [(p[0] + outer[i][0]) / 2, 28, (p[1] + outer[i][1]) / 2]);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length,
      a = [outer[i][0], 21, outer[i][1]],
      b = [outer[j][0], 21, outer[j][1]],
      c = [inner[j][0], 21, inner[j][1]],
      e = [inner[i][0], 21, inner[i][1]];
    face(o, [a, b, ridge[j], ridge[i]], 'copper', 'patina', [0, 1, 0]);
    face(o, [ridge[i], ridge[j], c, e], 'copper', 'patina', [0, 1, 0]);
  }
}
function dormer(o, x, z, angle, d) {
  const q = local(o, x, z, angle),
    w = 3.2,
    bottom = 23.7;
  // Stepped silhouette as one planar brick face, not separate stones or carved ornaments.
  const p = [
    [-w / 2, bottom, 1.35],
    [w / 2, bottom, 1.35],
    [w / 2, 26.1, 1.35],
    [1.1, 26.1, 1.35],
    [1.1, 27, 1.35],
    [0.65, 27, 1.35],
    [0.65, 27.8, 1.35],
    [0.25, 27.8, 1.35],
    [0.25, 28.5, 1.35],
    [-0.25, 28.5, 1.35],
    [-0.25, 27.8, 1.35],
    [-0.65, 27.8, 1.35],
    [-0.65, 27, 1.35],
    [-1.1, 27, 1.35],
    [-1.1, 26.1, 1.35],
    [-w / 2, 26.1, 1.35],
  ];
  const ids = earcut(p.map((v) => [v[0], v[1]]).flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      q,
      ids.slice(i, i + 3).map((j) => p[j]),
      'brick',
      'brick',
      [0, 0, 1],
    );
  face(
    q,
    [
      [-w / 2, bottom, -2],
      [w / 2, bottom, -2],
      [w / 2, 26.1, 1.35],
      [-w / 2, 26.1, 1.35],
    ],
    'copper',
    'patina',
    [0, 1, 0],
  );
  if (d >= 1) pane(q, 0, 24.5, 1.41, 1.2, 1.5, d, false, d >= 3);
}
function castle(o, d) {
  const c = frame.controls;
  for (const r of frame.geometry.holes) cap(o, r, 0);
  body(o, c.mainPolygon, c.bodyHeights.main, d, { holes: [frame.geometry.holes[0]] });
  body(o, c.westPolygon, c.bodyHeights.west, d, { col: 'red', gates: [0, 10] });
  body(o, c.northPolygon, c.bodyHeights.north, d);
  body(o, c.southPolygon, c.bodyHeights.south, d, { col: 'red' });
  gateTunnel(o, d);
  courtyardRoof(o);
  for (const t of c.towers) tower(o, t, d);
  for (const t of c.outerRoofs) {
    const e = edge(o, ...t.ends);
    hip(e.q, e.length + 0.6, t.depth, t.eave, t.top, t.col);
  }
  const extension = edge(o, [57, 10], [62, 23]);
  hip(extension.q, extension.length + 1, 12, 21, 28, 'copper');
  for (const x of [-6, 0, 6]) {
    const a = Math.atan2(8, 18),
      p = [42 + x * Math.cos(a), 12 - x * Math.sin(a)];
    dormer(o, ...p, a, d);
  }
  if (d >= 1) {
    for (const t of c.outerRoofs) {
      const e = edge(o, ...t.ends);
      for (const x of [-e.length / 4, e.length / 4])
        rect(e.q, x, t.top - 0.3, 0, 0.8, 2, 1, 'brick');
    }
  }
}
export const buildGripsholmRuntime = (o, level = 'closeup') =>
  castle(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildGripsholmSkyline = (o) =>
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
export const gripsholmStudy = {
  id: 'N0279',
  key: 'gripsholm_castle',
  title: 'Gripsholm Castle',
  category: 'castle',
  wikidataId: 'Q714783',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildGripsholmRuntime(o),
  brief:
    'Mapped Gripsholm brick castle with open inner and outer courts, four differentiated oxidized-copper tower caps, a tall open lantern, broad red helmet tower, onion cap, stepped brick dormers, low tiled wings and a real northwest entrance passage.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: gripsholmPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 6,
    materialBudgetReason:
      'Compound shares brick, granite, limestone, oxidized copper and roof-tile graphs, plus untextured blue-grey glass. Parts merge by material.',
    identityFeatures: [
      'Four brick towers with different copper caps and an open tall lantern',
      'Small polygonal inner court and long open outer court',
      'Stepped brick dormers and lower tiled wings around the northwest entrance',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/2848711 exact Q714783 building multipolygon',
    mappedPlanMeters: [137.835, 63.929],
    mappedCourtyardHoles: 2,
    verifiedTowerHeightsMeters: null,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped 137.835×63.929m building plan and exact two courtyard holes. Tower arc centers/radii are approximated; elevations and cap profiles are interpreted from Royal Palaces/SFV exterior photos. Highest roof42m is inferred,not surveyed.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors,ODbL-1.0. Operator photographs and visitor map linked research only,not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors. The Royal Palaces/Swedish Royal Court and Statens Fastighetsverk primary references.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Mapped body/courtyard plan and northwest-entrance/southeast-core sign; heights,terrain seating and real-site fit pending.',
    reviewStatus: 'Inactive geographic draft;review pending',
  }),
  geographicNote:
    'Exact mapped building ring and two courtyard holes retained. Official visitor map supplies entrance/core sign,not completed geographic review. Actual ground differences,shore approach,height datum and footprint replacement pending.',
  limitations: references.limitations,
  importReason:
    'Preserve two open courts,four different copper roof silhouettes,open clock lantern and stepped dormers through compact runtime levels.',
  mediumFiContext: { scale: '0.7', neighborStyle: 'molen.worldgen.catalog.swedish_cottage' },
  camera: { position: [150, 90, 145], lookAt: [7, 12, 0], fov: 43 },
  qaCameras: [
    { name: 'four-copper-caps', position: [115, 40, 96], lookAt: [31, 18, 1] },
    { name: 'clock-open-lantern', position: [65, 34, -67], lookAt: [25, 29, -24] },
    { name: 'two-open-courts', position: [0, 185, 1], lookAt: [0, 0, 0] },
    { name: 'northwest-entrance', position: [-109, 17, 16], lookAt: [-62, 6, 12] },
    { name: 'stepped-brick-dormers', position: [68, 33, 64], lookAt: [42, 24, 12] },
    { name: 'outer-court-tiled-wings', position: [-25, 43, 0], lookAt: [-24, 0, 2] },
  ],
};
