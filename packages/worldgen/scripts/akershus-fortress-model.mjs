/** Akershus: mapped open-court castle, two clock spires and an estimated inner fortress. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u4/u4x/n0282_akershus_fortress/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
const references = JSON.parse(
  readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)),
);
export const akershusPalette = {
  brick: '#c18e73',
  red: '#ae735b',
  stone: '#b4b19d',
  roof: '#606b71',
  tile: '#b27d5e',
  metal: '#8c9993',
  cream: '#e8d4a7',
  trim: '#e3d9be',
  glass: '#4d6178',
  timber: '#a49379',
  lawn: '#8aa065',
  paving: '#b4afa3',
  water: '#286d83',
  clock: '#3b3e42',
  gold: '#c6a45c',
};
const colors = Object.fromEntries(
  Object.entries(akershusPalette).map(([key, hex]) => [
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
function local(o, x, z, angle = 0, y = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    rot = ([u, h, v]) => [c * u + s * v, h, -s * u + c * v];
  return Object.fromEntries(
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
const openRing = (r) => (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r);
function cap(o, loop, y, col = 'paving', slot = 'foliage', holes = []) {
  const rings = [loop, ...holes].map(openRing),
    vertices = rings.flat(),
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
function prism(o, ring, lo, hi, col = 'stone', slot = 'stone') {
  const r = openRing(ring),
    sign =
      r.reduce((s, a, i) => {
        const b = r[(i + 1) % r.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0) > 0
        ? 1
        : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
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
  cap(o, r, hi, col, slot);
}
function rect(o, x, y, z, w, h, depth, col = 'brick', slot = 'brick') {
  prism(
    o,
    [
      [x - w / 2, z - depth / 2],
      [x + w / 2, z - depth / 2],
      [x + w / 2, z + depth / 2],
      [x - w / 2, z + depth / 2],
    ],
    y,
    y + h,
    col,
    slot,
  );
}
function edge(o, a, b, y = 0) {
  return {
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]), y),
  };
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
  if (d < 3 || !surround) return;
  // Broad selected window surrounds, never a closed frame ring per facade cell.
  for (const s of [-1, 1])
    face(
      o,
      [
        [x + (s * w) / 2, y, z + 0.04],
        [x + s * (w / 2 + 0.65), y, z + 0.04],
        [x + s * (w / 2 + 0.65), y + h, z + 0.04],
        [x + (s * w) / 2, y + h, z + 0.04],
      ],
      'trim',
      'plaster',
      [0, 0, 1],
    );
}
function hip(o, w, depth, eave, top, col = 'roof', slot = 'slate') {
  const ridge = Math.max(0, (w - depth) / 2);
  face(
    o,
    [
      [-w / 2, eave, -depth / 2],
      [w / 2, eave, -depth / 2],
      [w / 2, eave, depth / 2],
      [-w / 2, eave, depth / 2],
    ],
    col,
    slot,
    [0, -1, 0],
  );
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, eave, (s * depth) / 2],
        [w / 2, eave, (s * depth) / 2],
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
        [(s * w) / 2, eave, -depth / 2],
        [(s * w) / 2, eave, depth / 2],
        [s * ridge, top, 0],
      ],
      col,
      slot,
      [s, 1, 0],
    );
  }
}
function gable(o, w, depth, eave, top, d, col = 'brick') {
  face(
    o,
    [
      [-w / 2, eave, -depth / 2],
      [w / 2, eave, -depth / 2],
      [w / 2, eave, depth / 2],
      [-w / 2, eave, depth / 2],
    ],
    'roof',
    'slate',
    [0, -1, 0],
  );
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, eave, (s * depth) / 2],
        [w / 2, eave, (s * depth) / 2],
        [w / 2, top, 0],
        [-w / 2, top, 0],
      ],
      'roof',
      'slate',
      [0, 1, s],
    );
    const steps = d === 0 ? 4 : 6,
      h = (top - eave + 0.8) / steps;
    for (let i = 0; i < steps; i++) {
      const lo = (i * depth) / (2 * steps),
        hi = ((i + 1) * depth) / (2 * steps),
        height = top + 0.8 - i * h;
      for (const t of [-1, 1]) {
        if (d >= 2) {
          rect(
            o,
            (s * w) / 2,
            eave,
            (t * (lo + hi)) / 2,
            0.65,
            height - eave,
            hi - lo,
            col,
            'brick',
          );
          continue;
        }
        face(
          o,
          [
            [(s * w) / 2, eave, t * lo],
            [(s * w) / 2, eave, t * hi],
            [(s * w) / 2, height, t * hi],
            [(s * w) / 2, height, t * lo],
          ],
          col,
          'brick',
          [s, 0, 0],
        );
      }
    }
    if (d >= 2)
      for (const x of [-2, 2])
        pane(local(o, 0, 0, (s * Math.PI) / 2), x, eave + 1.4, w / 2 + 0.05, 1.1, 2.3, d, true);
  }
}
function portal(o, w, depth, top, d, half = 2.2, spring = 3.4, col = 'stone', slot = 'stone') {
  const n = d < 2 ? 4 : 8;
  for (const s of [-1, 1]) {
    const p = (x, y) => [x, y, (s * depth) / 2];
    for (const [a, b] of [
      [-w / 2, -half],
      [half, w / 2],
    ])
      face(o, [p(a, 0), p(b, 0), p(b, top), p(a, top)], col, slot, [0, 0, s]);
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (i * Math.PI) / n,
        b = Math.PI - ((i + 1) * Math.PI) / n,
        x = half * Math.cos(a),
        u = half * Math.cos(b);
      face(
        o,
        [
          p(x, spring + half * Math.sin(a)),
          p(u, spring + half * Math.sin(b)),
          p(u, top),
          p(x, top),
        ],
        col,
        slot,
        [0, 0, s],
      );
    }
    face(
      o,
      [
        [(s * w) / 2, 0, -depth / 2],
        [(s * w) / 2, 0, depth / 2],
        [(s * w) / 2, top, depth / 2],
        [(s * w) / 2, top, -depth / 2],
      ],
      col,
      slot,
      [s, 0, 0],
    );
    face(
      o,
      [
        [s * half, 0, -depth / 2],
        [s * half, spring, -depth / 2],
        [s * half, spring, depth / 2],
        [s * half, 0, depth / 2],
      ],
      col,
      slot,
      [-s, 0, 0],
    );
  }
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      p = (t, z) => [half * Math.cos(t), spring + half * Math.sin(t), z];
    face(o, [p(a, -depth / 2), p(a, depth / 2), p(b, depth / 2), p(b, -depth / 2)], col, slot, [
      -Math.cos((a + b) / 2),
      -Math.sin((a + b) / 2),
      0,
    ]);
  }
  face(
    o,
    [
      [-w / 2, top, -depth / 2],
      [w / 2, top, -depth / 2],
      [w / 2, top, depth / 2],
      [-w / 2, top, depth / 2],
    ],
    col,
    slot,
    [0, 1, 0],
  );
}
function roofProfile(o, rings, sides, col = 'metal', slot = 'patina') {
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) * 2 * Math.PI) / sides,
        b = a + (2 * Math.PI) / sides,
        p = (r, t) => [r[1] * Math.cos(t), r[0], r[1] * Math.sin(t)];
      face(o, [p(rings[j], a), p(rings[j], b), p(rings[j + 1], b), p(rings[j + 1], a)], col, slot, [
        Math.cos((a + b) / 2),
        0.1,
        Math.sin((a + b) / 2),
      ]);
    }
}
function clock(o, y, z, radius, d) {
  const n = d < 3 ? 8 : 12,
    ring = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [radius * Math.cos(a), y + radius * Math.sin(a), z];
    });
  face(o, ring, 'clock', 'glass', [0, 0, 1]);
  if (d < 2) return;
  for (const a of [Math.PI / 2, Math.PI / 5])
    face(
      o,
      [
        [-0.15 * Math.sin(a), y + 0.15 * Math.cos(a), z + 0.04],
        [0.15 * Math.sin(a), y - 0.15 * Math.cos(a), z + 0.04],
        [0.86 * radius * Math.cos(a), y + 0.86 * radius * Math.sin(a), z + 0.04],
      ],
      'gold',
      'plaster',
      [0, 0, 1],
    );
}
function clockTower(o, t, d) {
  const q = local(o, ...t.center),
    base = frame.controls.castleCourtY,
    n = d === 0 ? 6 : d === 1 ? 8 : 16;
  rect(q, 0, base, 0, t.width, t.wallTop - base, t.depth);
  const r = Math.hypot(t.width, t.depth) / 2 + 0.5;
  roofProfile(
    q,
    d === 0
      ? [
          [t.wallTop, r],
          [t.lanternBottom, r * 0.54],
        ]
      : [
          [t.wallTop, r],
          [t.wallTop + 1.8, r * 0.77],
          [t.lanternBottom, r * 0.54],
        ],
    d === 0 ? 4 : 8,
  );
  // Apertures are geometric voids between stout lantern piers in all levels.
  const radius = r * 0.5,
    height = t.lanternTop - t.lanternBottom;
  const piers = d === 0 ? 4 : 8;
  for (let i = 0; i < piers; i++) {
    const a = (i * 2 * Math.PI) / piers,
      f = local(q, radius * Math.cos(a), radius * Math.sin(a), Math.PI / 2 - a);
    rect(f, 0, t.lanternBottom, 0, 0.68, height, 0.7, 'trim', 'plaster');
    if (d >= 2) rect(f, 0, t.lanternTop - 0.4, 0, 2.5, 0.4, 0.72, 'trim', 'plaster');
  }
  roofProfile(
    q,
    [
      [t.lanternTop, radius + 1],
      [t.lanternTop + 1, radius * 0.95],
      [t.tip - 7, radius * 0.46],
      [t.tip, 0],
    ],
    n,
  );
  if (d === 0) return;
  for (const s of [-1, 1])
    for (const angle of [s === 1 ? 0 : Math.PI, (s * Math.PI) / 2]) {
      const f = local(q, 0, 0, angle);
      pane(f, 0, t.wallTop - 4.7, t.width / 2 + 0.05, 1.2, 2.4, d, true);
      clock(f, t.lanternBottom - 1.25, r * 0.72, 1.2, d);
    }
}
function castleWallHeight(x, z) {
  if (x < -28 && z < -36) return 22;
  if (z > 45) return 18;
  if (z > 35) return 16;
  if (x > 16 && z < 19) return 20;
  if (z < -29) return 29;
  if (z > 23) return 30;
  if (x < -11 && z > 0) return 23.5;
  return x < -10 ? 26.5 : 25.5;
}
function castleBody(o, d) {
  const c = frame.controls,
    gate = c.gate;
  cap(o, c.castleCourt, c.castleCourtY + 0.05, 'paving', 'foliage');
  const rings = [c.castleOutline, c.castleCourt].map(openRing);
  for (const [ri, r] of rings.entries()) {
    const area = r.reduce((s, a, i) => {
        const b = r[(i + 1) % r.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
      sign = (area > 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2,
        hi = castleWallHeight(x, z),
        base = z > 45 ? 4 : x < -28 ? 10 : 12;
      const normal = [(sign * (b[1] - a[1])) / len, 0, (sign * (a[0] - b[0])) / len];
      // Entry opening cut into both north-wing faces; tunnel added once below.
      const along = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
        gateOffset = (gate.center[0] - x) * along[0] + (gate.center[1] - z) * along[1];
      const northGate =
        ((ri === 0 && z < -39 && x > -20 && x < 10) || (ri === 1 && z < -28 && x > -10 && x < 5)) &&
        gateOffset + gate.width / 2 > -len / 2 &&
        gateOffset - gate.width / 2 < len / 2;
      if (northGate) {
        const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
          offset = (gate.center[0] - x) * u[0] + (gate.center[1] - z) * u[1],
          half = gate.width / 2;
        const p = (v, y) => [x + v * u[0], y, z + v * u[1]],
          n = d < 2 ? 4 : 8;
        for (const [lo, up] of [
          [-len / 2, Math.max(-len / 2, offset - half)],
          [Math.min(len / 2, offset + half), len / 2],
        ])
          if (up > lo)
            face(o, [p(lo, base), p(up, base), p(up, hi), p(lo, hi)], 'stone', 'stone', normal);
        for (let j = 0; j < n; j++) {
          const aa = Math.PI - (j * Math.PI) / n,
            bb = Math.PI - ((j + 1) * Math.PI) / n,
            lo = Math.max(-len / 2, offset + half * Math.cos(aa)),
            up = Math.min(len / 2, offset + half * Math.cos(bb));
          if (up <= lo) continue;
          const archY = (v) =>
            base + gate.spring + Math.sqrt(Math.max(0, half * half - (v - offset) * (v - offset)));
          face(
            o,
            [p(lo, archY(lo)), p(up, archY(up)), p(up, hi), p(lo, hi)],
            'stone',
            'stone',
            normal,
          );
        }
      } else if (d === 0) {
        face(
          o,
          [
            [a[0], base, a[1]],
            [b[0], base, b[1]],
            [b[0], hi, b[1]],
            [a[0], hi, a[1]],
          ],
          x < -28 || (ri === 0 && z < -39) ? 'stone' : 'brick',
          x < -28 || (ri === 0 && z < -39) ? 'stone' : 'brick',
          normal,
        );
      } else {
        const split = Math.min(hi, base + 4.2);
        face(
          o,
          [
            [a[0], base, a[1]],
            [b[0], base, b[1]],
            [b[0], split, b[1]],
            [a[0], split, a[1]],
          ],
          'stone',
          'stone',
          normal,
        );
        if (hi > split)
          face(
            o,
            [
              [a[0], split, a[1]],
              [b[0], split, b[1]],
              [b[0], hi, b[1]],
              [a[0], hi, a[1]],
            ],
            x < -28 || (ri === 0 && z < -39) ? 'stone' : 'brick',
            x < -28 || (ri === 0 && z < -39) ? 'stone' : 'brick',
            normal,
          );
      }
      if (d === 0 || len < 5 || x < -28 || (ri === 0 && z < -39)) continue;
      const q = local(o, x, z, Math.atan2(normal[0], normal[2])),
        bays = Math.max(1, Math.floor(len / (d === 1 ? 11 : 6.5)));
      for (let j = 0; j < bays; j++)
        for (const y of hi > 26 ? [18, 23, 27] : [17.2, 21.7]) {
          if (y + 2.4 > hi) continue;
          const v = ((j + 0.5) * len) / bays - len / 2;
          if (northGate && Math.abs(v) < 4 && y < 20) continue;
          pane(q, v, y, 0.06, 1.35, 2.4, d, y === 18, d >= 3 && y === 23);
        }
    }
  }
  // Vaulted soffit and jambs between the independently cut footprint faces.
  const n = d < 2 ? 4 : 8,
    half = gate.width / 2,
    outer = -40.65,
    inner = -29.85;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      p = (t, z) => [
        gate.center[0] + half * Math.cos(t),
        gate.base + gate.spring + half * Math.sin(t),
        z,
      ];
    face(o, [p(a, outer), p(a, inner), p(b, inner), p(b, outer)], 'stone', 'stone', [
      -Math.cos((a + b) / 2),
      -Math.sin((a + b) / 2),
      0,
    ]);
  }
  for (const s of [-1, 1])
    face(
      o,
      [
        [gate.center[0] + s * half, gate.base, outer],
        [gate.center[0] + s * half, gate.base, inner],
        [gate.center[0] + s * half, gate.base + gate.spring, inner],
        [gate.center[0] + s * half, gate.base + gate.spring, outer],
      ],
      'stone',
      'stone',
      [-s, 0, 0],
    );
}
function castle(o, d) {
  const c = frame.controls;
  castleBody(o, d);
  for (const key of ['northWing', 'southWing', 'chanceryWing']) {
    const w = c[key],
      q = local(o, ...w.center, w.angle ?? 0);
    hip(q, w.width + 0.7, w.depth + 0.7, w.eave, w.roof);
  }
  for (const key of ['romerikeWing', 'eastWing']) {
    const w = c[key],
      q = local(o, ...w.center, w.angle ?? 0);
    gable(q, w.width, w.depth, w.eave, w.roof, d);
  }
  hip(local(o, 8, 21), 16, 8, 25.5, 29.5);
  for (const t of c.towers) clockTower(o, t, d);
  const k = c.knut,
    m = c.munk;
  prism(o, k.outline, k.base, k.wallTop, 'stone', 'stone');
  hip(local(o, -36.5, -44), 9.3, 10.5, k.wallTop, k.roof);
  prism(o, m.outline, m.base, m.wallTop, 'stone', 'stone');
  hip(local(o, 18.3, 51.4), 9.4, 10.8, m.wallTop, m.roof, 'metal', 'patina');
  prism(o, c.stables, 4, 15, 'stone', 'stone');
  hip(local(o, 16, 41.1, Math.PI / 2), 15.2, 12, 15, 20, 'tile', 'tile');
  // Low pitched roof over the eastern curtain; no invented vanished keep.
  const e = edge(o, [14, 10], [23, 12]);
  hip(e.q, e.length + 1, 2.4, 20, 21.5, 'tile', 'tile');
  if (d >= 1) {
    for (const [x, y, z] of [
      [-10, 38, 31],
      [6, 38, 31],
      [-19, 29.1, -16],
      [-19, 29.1, -1],
    ])
      rect(o, x, y, z, 1.2, 2, 1.1, 'brick', 'brick');
    for (const t of [k, m]) {
      const r = openRing(t.outline);
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          e = edge(o, a, b);
        if (e.length < 6) continue;
        pane(e.q, 0, t.wallTop - 4, 1, 1.1, 1.8, d);
      }
    }
  }
}
function building(o, t, d) {
  const q = local(o, ...t.center, t.angle ?? 0),
    slot = t.kind === 'cream' ? 'plaster' : t.kind === 'stone' ? 'stone' : 'brick',
    col =
      t.kind === 'cream'
        ? 'cream'
        : t.kind === 'stone'
          ? 'stone'
          : t.kind === 'red'
            ? 'red'
            : 'brick';
  rect(q, 0, t.base, 0, t.width, t.eave - t.base, t.depth, col, slot);
  hip(
    q,
    t.width + 0.6,
    t.depth + 0.7,
    t.eave,
    t.roof,
    t.kind === 'timber-brick' ? 'tile' : 'roof',
    t.kind === 'timber-brick' ? 'tile' : 'slate',
  );
  if (d === 0) return;
  for (const s of [-1, 1]) {
    const f = local(q, 0, 0, s === 1 ? 0 : Math.PI),
      bays = Math.max(1, Math.floor(t.width / (d === 1 ? 12 : 7)));
    for (let i = 0; i < bays; i++)
      for (const y of t.eave - t.base > 10 ? [t.base + 3, t.base + 7.3] : [t.base + 2])
        pane(f, ((i + 0.5) * t.width) / bays - t.width / 2, y, t.depth / 2 + 0.05, 1.25, 2.1, d);
    if (t.kind === 'timber-brick' && d >= 2) {
      for (let x = -t.width / 2 + 1; x < t.width / 2; x += 5)
        face(
          f,
          [
            [x - 0.3, t.base + 0.5, t.depth / 2 + 0.09],
            [x + 0.3, t.base + 0.5, t.depth / 2 + 0.09],
            [x + 0.3, t.eave, t.depth / 2 + 0.09],
            [x - 0.3, t.eave, t.depth / 2 + 0.09],
          ],
          'timber',
          'plaster',
          [0, 0, 1],
        );
      for (const y of [t.base + 1, t.eave - 0.6])
        face(
          f,
          [
            [-t.width / 2, y, t.depth / 2 + 0.09],
            [t.width / 2, y, t.depth / 2 + 0.09],
            [t.width / 2, y + 0.6, t.depth / 2 + 0.09],
            [-t.width / 2, y + 0.6, t.depth / 2 + 0.09],
          ],
          'timber',
          'plaster',
          [0, 0, 1],
        );
    }
  }
  if (d >= 2)
    for (const x of [-t.width / 4, t.width / 4])
      rect(q, x, t.roof - 0.7, 0, 1, 2, 1, 'brick', 'brick');
}
function wall(o, a, b, lo, top, d) {
  const e = edge(o, a, b);
  if (d === 0) {
    for (const s of [-1, 1])
      face(
        e.q,
        [
          [-e.length / 2, lo, s * 1.4],
          [e.length / 2, lo, s * 1.4],
          [e.length / 2, top, s * 1.4],
          [-e.length / 2, top, s * 1.4],
        ],
        'stone',
        'stone',
        [0, 0, s],
      );
    face(
      e.q,
      [
        [-e.length / 2, top, -1.4],
        [e.length / 2, top, -1.4],
        [e.length / 2, top, 1.4],
        [-e.length / 2, top, 1.4],
      ],
      'stone',
      'stone',
      [0, 1, 0],
    );
  } else rect(e.q, 0, lo, 0, e.length, top - lo, 2.8, 'stone', 'stone');
  if (d >= 2) rect(e.q, 0, top, 0, e.length, 0.6, 3.4, 'stone', 'stone');
}
function terrain(o, d) {
  const c = frame.controls,
    r =
      d === 0
        ? [0, 4, 8, 10, 11, 12, 14, 15, 20, 22, 23, 24].map((i) => c.outerBoundary[i])
        : c.outerBoundary,
    inner = c.upperTerrace;
  cap(o, r, 0, 'lawn', 'foliage');
  // Sparse two-ring terrace mesh. This is authoring relief, never presented as a DEM.
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      top = (z) => (z < -190 ? 2 : z < -95 ? 7 : z < 25 ? 10 : 7);
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0] * 0.87, top(b[1]), b[1] * 0.93],
        [a[0] * 0.87, top(a[1]), a[1] * 0.93],
      ],
      'lawn',
      'foliage',
      [0, 1, 0],
    );
  }
  const middle = r.map(([x, z]) => [x * 0.87, z * 0.93]),
    ids = earcut(middle.flat(), null, 2),
    height = ([, z]) => (z < -190 ? 2 : z < -95 ? 7 : z < 25 ? 10 : 7);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [middle[j][0], height(middle[j]), middle[j][1]]),
      'lawn',
      'foliage',
      [0, 1, 0],
    );
  prism(o, inner, 7, 12, 'stone', 'stone');
  cap(o, inner, 12.01, 'lawn', 'foliage');
  prism(o, c.royalBastion, 4, 12, 'stone', 'stone');
  cap(o, c.royalBastion, 12.01, 'lawn', 'foliage');
}
function fortress(o, d) {
  const c = frame.controls;
  terrain(o, d);
  castle(o, d);
  const boundary =
    d === 0
      ? [0, 4, 8, 10, 11, 12, 14, 15, 20, 22, 23, 24].map((i) => c.outerBoundary[i])
      : c.outerBoundary;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length],
      z = (a[1] + b[1]) / 2,
      top = z < -200 ? 8 : z < -90 ? 11 : 14;
    // Actual entrance opening replaces the matching east segment; no solid wall across it.
    if (a === c.outerBoundary[11]) {
      const e = edge(o, a, b),
        t = (c.easternGate.center[1] - a[1]) / (b[1] - a[1]),
        mid = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        u = [(b[0] - a[0]) / e.length, (b[1] - a[1]) / e.length],
        half = c.easternGate.width / 2;
      wall(o, a, [mid[0] - u[0] * half, mid[1] - u[1] * half], 0, top, d);
      wall(o, [mid[0] + u[0] * half, mid[1] + u[1] * half], b, 0, top, d);
      portal(local(o, ...mid, Math.atan2(-(b[1] - a[1]), b[0] - a[0])), 10, 3, top, d, half, 3.3);
    } else wall(o, a, b, 0, top, d);
  }
  for (let i = 0; i < c.upperTerrace.length; i++)
    wall(o, c.upperTerrace[i], c.upperTerrace[(i + 1) % c.upperTerrace.length], 12, 14, d);
  for (const key of ['resistanceMuseum', 'corpsDeGarde', 'skarpenordMagazine', 'redHouse'])
    building(o, c[key], d);
  for (const t of c.outerBuildings) building(o, t, d);
  if (d >= 1) {
    // Broad colonnade is the guardhouse's identity feature; no ornamental capitals.
    const t = c.corpsDeGarde,
      q = local(o, ...t.center);
    rect(q, 0, 12, 8, 24, 0.5, 3, 'cream', 'plaster');
    hip(local(q, 0, 8), 26, 4, 19, 20.8);
    for (let x = -10; x <= 10; x += 4) rect(q, x, 12.5, 8, 0.7, 6.5, 0.8, 'cream', 'plaster');
    const t2 = c.skarpenordMagazine;
    portal(
      local(o, t2.center[0], t2.center[1] + 11, 0, t2.base),
      t2.width,
      4,
      8,
      d,
      2.5,
      3,
      'stone',
      'stone',
    );
  }
  if (d >= 2) {
    for (const pond of c.ponds) {
      const loop = Array.from({ length: 12 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 12;
        return [
          pond.center[0] + (pond.width / 2) * Math.cos(a),
          pond.center[1] + (pond.depth / 2) * Math.sin(a),
        ];
      });
      cap(o, loop, pond.base, 'water', 'foliage');
    }
    for (const [a, b] of [
      [
        [-35, -48],
        [-45, 15],
      ],
      [
        [5, -57],
        [50, -120],
      ],
      [
        [48, -160],
        [50, -249],
      ],
    ]) {
      const e = edge(o, a, b);
      cap(
        e.q,
        [
          [-e.length / 2, -2],
          [e.length / 2, -2],
          [e.length / 2, 2],
          [-e.length / 2, 2],
        ],
        a[1] < -100 ? 7.04 : 12.04,
        'paving',
        'foliage',
      );
    }
  }
}
export const buildAkershusRuntime = (o, level = 'closeup') =>
  fortress(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildAkershusSkyline = (o) =>
  fortress(
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
            c.map((v) => v * (s === 'glass' || s === 'foliage' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const akershusStudy = {
  id: 'N0282',
  key: 'akershus_fortress',
  title: 'Akershus Fortress',
  category: 'castle',
  wikidataId: 'Q644464',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildAkershusRuntime(o),
  brief:
    'Akershus inner-fortress study:open mapped castle court,two faceted clock spires,stepped-gable wings,stone lower towers,terraced bastion silhouette and selected low museums,magazines and barracks. Wider site/elevations explicitly approximate.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: akershusPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 8,
    materialBudgetReason:
      'Six shared architectural graphs plus untextured glazing and terraced ground;parts merged by material.',
    identityFeatures: [
      'Two broad-capped clock spires above a long open-court castle',
      'Mixed stone/brick wings with stepped gables and dark roofs',
      'Low polygonal ramparts,bastions and tiered supporting buildings',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/13931023 exactQ644464 castle only',
    mappedCastlePlanMeters: [117.171, 53.677],
    mappedCourtyardHoles: 1,
    measuredTowerHeight: null,
    wholeFortressMetricSurvey: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact mapped castle outline/court rotated into east/south axes. Wider enclosure and buildings are approximately inferred from official isometric trail plan. All elevations and54m highest spire over provisional lower-ground datum are estimates.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM castle data © OpenStreetMap contributors,ODbL-1.0. Primary photographs/brochure linked only,not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors;Forsvarsbygg/National Fortifications Heritage and Forsvarshistorisk museum.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Castle-derived east/south frame;outer layout,heights,terraces,terrain blend and replacement fit unverified.',
    reviewStatus: 'Inactive geographic draft;review pending',
  }),
  geographicNote:
    'Exact castle footprint/court only. Whole inner-fortress silhouette is approximate and excludes modern administrative parcels. Heading0,east/south nativeaxes;current terrain and absolute fit pending.',
  limitations: references.limitations,
  importReason:
    'Preserve Akershus open court,two spires,stepped gables and differentiated bastion/castle hierarchy in compact shared-material levels.',
  mediumFiContext: { scale: '2.4', neighborStyle: 'molen.worldgen.catalog.swedish_cottage' },
  camera: { position: [-420, 330, 150], lookAt: [-5, 14, -105], fov: 43 },
  qaCameras: [
    { name: 'castle-two-clock-spires', position: [-165, 69, 105], lookAt: [-3, 30, 0] },
    { name: 'open-court-and-roof-hierarchy', position: [0, 180, 0], lookAt: [0, 12, 0] },
    { name: 'northern-entry-vault', position: [-3.5, 17, -69], lookAt: [-3.5, 16, -30] },
    { name: 'stepped-gables-and-clock-lantern', position: [-45, 45, -70], lookAt: [-13, 33, -28] },
    { name: 'resistance-museum-guardhouse', position: [-140, 47, -172], lookAt: [-38, 15, -115] },
    { name: 'northern-magazine-bastions', position: [50, 85, -389], lookAt: [14, 10, -245] },
  ],
};
