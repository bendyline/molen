/** Corvin's current exterior: Gothic roofline, bridge and detached Neboisa gallery. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u8/u80/n0285_corvin_castle/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const corvinPalette = {
  stone: '#b6b09d',
  trim: '#d2c5aa',
  roof: '#9d6050',
  roofPattern: '#a48c67',
  slate: '#636369',
  wood: '#9c7b55',
  recess: '#4d6178',
  paving: '#aaa59a',
  rock: '#a8a694',
};
const colors = Object.fromEntries(
  Object.entries(corvinPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, p, col = 'stone', slot = 'limestone', target) {
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const a = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (a === 1 ? [v[0], v[2]] : a === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function box(o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function local(o, center, y = 0, a = 0) {
  const rot = ([x, h, z]) => [
    Math.cos(a) * x + Math.sin(a) * z,
    h,
    -Math.sin(a) * x + Math.cos(a) * z,
  ];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, col) =>
        o[k](
          s,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + center[0], q[1] + y, q[2] + center[1]];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function lineFrame(o, a, b, y = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    length: Math.hypot(dx, dz),
    q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y, -Math.atan2(dz, dx)),
  };
}
function polygon(o, loop, y, col, slot = 'limestone') {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], y, loop[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function rings(o, center, levels, n, col = 'stone', slot = 'limestone', phase = 0, cap = true) {
  const circle = ([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
    });
  for (let j = 1; j < levels.length; j++) {
    const a = circle(levels[j - 1]),
      b = circle(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = [a[i], a[k], b[k], b[i]],
        target = [(a[i][0] + a[k][0]) / 2 - center[0], 0, (a[i][2] + a[k][2]) / 2 - center[1]];
      face(o, p, col, slot, target);
    }
  }
  if (cap) {
    const r = circle(levels.at(-1));
    polygon(
      o,
      r.map((p) => [p[0], p[2]]),
      r[0][1],
      col,
      slot,
    );
  }
}
function hip(o, x, y, z, length, depth, rise, col = 'roof', slot = 'tile', pyramid = false) {
  const a = x - length / 2,
    b = x + length / 2,
    u = z - depth / 2,
    v = z + depth / 2;
  const inset = pyramid ? length / 2 : Math.min(depth / 2, length * 0.28),
    r0 = [a + inset, y + rise, z],
    r1 = [b - inset, y + rise, z];
  for (const p of [
    [[a, y, u], [b, y, u], r1, r0],
    [[b, y, v], [a, y, v], r0, r1],
    [[a, y, v], [a, y, u], r0],
    [[b, y, u], [b, y, v], r1],
  ])
    face(o, p, col, slot, [0, 1, 0]);
}
function steepGateRoof(o, y) {
  const n = 4,
    angles = Array.from({ length: n }, (_, i) => Math.PI / 4 + (i * Math.PI) / 2);
  const r = (h, w) =>
    angles.map((a) => [(Math.cos(a) * w) / Math.SQRT2, h, (Math.sin(a) * w) / Math.SQRT2]);
  for (const [a, b] of [
    [r(y, 11.8), r(y + 1.5, 9.8)],
    [r(y + 1.5, 9.8), r(y + 14, 0.65)],
  ])
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(o, [a[i], a[k], b[k], b[i]], 'roof', 'tile', [0, 1, 0]);
    }
  polygon(
    o,
    r(y + 14, 0.65).map((p) => [p[0], p[2]]),
    y + 14,
    'roof',
    'tile',
  );
}
/** A real opening: pier masses, spandrels and soffits leave the arch empty. */
function arcade(
  o,
  length,
  depth,
  bottom,
  top,
  bays,
  span,
  spring,
  rise,
  d,
  col = 'stone',
  slot = 'limestone',
  pointed = false,
) {
  const pitch = length / bays,
    pier = pitch - span;
  box(o, -length / 2 + pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  box(o, length / 2 - pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  for (let i = 1; i < bays; i++)
    box(o, -length / 2 + i * pitch, bottom, 0, pier, top - bottom, depth, col, slot);
  for (let j = 0; j < bays; j++) {
    const mid = -length / 2 + (j + 0.5) * pitch,
      steps = d >= 2 ? 6 : 4;
    const curve = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const half = span / 2,
        radius = (half * half + rise * rise) / (2 * half),
        offset = Math.min(t, 1 - t) * span - radius;
      return [
        mid + (t - 0.5) * span,
        spring +
          (pointed
            ? Math.sqrt(Math.max(0, radius * radius - offset * offset))
            : rise * Math.sin(Math.PI * t)),
      ];
    });
    for (let i = 0; i < steps; i++) {
      const a = curve[i],
        b = curve[i + 1];
      for (const s of [-1, 1])
        face(
          o,
          [
            [a[0], a[1], (s * depth) / 2],
            [b[0], b[1], (s * depth) / 2],
            [b[0], top, (s * depth) / 2],
            [a[0], top, (s * depth) / 2],
          ],
          col,
          slot,
          [0, 0, s],
        );
      face(
        o,
        [
          [a[0], a[1], -depth / 2],
          [b[0], b[1], -depth / 2],
          [b[0], b[1], depth / 2],
          [a[0], a[1], depth / 2],
        ],
        col,
        slot,
        [0, -1, 0],
      );
    }
  }
  face(
    o,
    [
      [-length / 2, top, -depth / 2],
      [length / 2, top, -depth / 2],
      [length / 2, top, depth / 2],
      [-length / 2, top, depth / 2],
    ],
    col,
    slot,
    [0, 1, 0],
  );
}
function pane(o, x, y, z, w, h, d, pointed = false) {
  const p = pointed
    ? [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h * 0.65, z],
        [x, y + h, z],
        [x - w / 2, y + h * 0.65, z],
      ]
    : [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ];
  face(o, p, 'recess', 'glass', [0, 0, z < 0 ? -1 : 1]);
  if (d >= 3) {
    box(o, x, y - 0.3, z, w + 0.6, 0.3, 0.3, 'trim');
    if (!pointed) box(o, x, y + h, z, w + 0.6, 0.3, 0.3, 'trim');
    box(o, x, y, z, 0.3, h, 0.3, 'trim');
  }
}
function plinth(o) {
  const p = [
    [-35, -4],
    [-28, -17],
    [-10, -27],
    [31, -29],
    [44, -13],
    [61, -8],
    [63, 5],
    [58, 14],
    [44, 30],
    [-15, 34],
    [-30, 27],
    [-30, 13],
  ];
  polygon(o, p, c.courtY, 'paving', 'foliage');
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      a = p[i],
      b = p[j],
      expand = (v) => [v[0] * 1.035, 0, v[1] * 1.035];
    face(
      o,
      [expand(a), expand(b), [b[0], c.courtY, b[1]], [a[0], c.courtY, a[1]]],
      'rock',
      'limestone',
      [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
    );
  }
}
function bridge(o, d) {
  const a = c.bridge.approach,
    b = c.bridge.gate,
    { q, length } = lineFrame(o, a, b),
    w = c.bridge.width,
    y = c.bridge.deckY;
  box(q, 0, y - 0.45, 0, length, 0.45, w, 'wood', 'wood');
  for (const s of [-1, 1]) box(q, 0, y, s * (w / 2 - 0.18), length, 1.15, 0.36, 'wood', 'wood');
  for (let i = 0; i < 7; i++)
    box(q, -length / 2 + 2 + (i * (length - 4)) / 6, 0, 0, 2.2, y - 0.45, w + 1.4, 'stone');
  if (d >= 2)
    for (let i = 0; i < 20; i++) {
      const x = -length / 2 + ((i + 0.5) * length) / 20,
        bw = (length / 20) * 0.8;
      for (const s of [-1, 1])
        face(
          q,
          [
            [x - bw / 2, y + 0.05, (s * w) / 2],
            [x + bw / 2, y + 0.86, (s * w) / 2],
            [x + bw / 2, y + 1.1, (s * w) / 2],
            [x - bw / 2, y + 0.29, (s * w) / 2],
          ],
          'wood',
          'wood',
          [0, 0, s],
        );
    }
}
function palace(o, d) {
  const p = c.palace,
    { q, length } = lineFrame(o, p.a, p.b, c.courtY);
  box(q, 0, 0, 0, length, p.bodyHeight, p.width);
  hip(q, 0, p.bodyHeight, 0, length + 1, p.width + 1, p.roofHeight);
  for (const f of p.orielFractions) {
    const x = (f - 0.5) * length,
      z = -p.width / 2 - 1.05;
    box(q, x, 7, z, 2.9, 5.7, 1.9, 'trim');
    hip(q, x, 12.7, z, 3.35, 2.3, 5.2, 'roof', 'tile', true);
    if (d >= 2) {
      const base = [
        [x - 0.75, 5.7, z - 0.3],
        [x + 0.75, 5.7, z - 0.3],
        [x + 1.45, 7, z - 0.95],
        [x - 1.45, 7, z - 0.95],
      ];
      face(q, base, 'trim', 'limestone', [0, 0, -1]);
      pane(q, x, 8.6, z - 0.97, 1.65, 2.2, d);
      box(q, x, 7, z - 0.97, 3.15, 0.25, 0.15, 'trim');
    }
  }
  if (d >= 2) {
    for (let i = 0; i < 7; i++) {
      const x = (i / 6 - 0.5) * (length - 4);
      pane(q, x, 2.2, -p.width / 2 - 0.02, 1.2, 2.4, d, true);
      pane(q, x, 8.1, p.width / 2 + 0.02, 1.4, 2.6, d, true);
    }
    const l = local(q, [0, p.width / 2 + 1.65]);
    arcade(l, length - 6, 1.6, 0, 6, 7, 4, 3.5, 2.2, d, 'trim', 'limestone', true);
    arcade(l, length - 6, 1.6, 6, 11.8, 14, 2, 9.2, 1.4, d, 'trim', 'limestone', true);
    box(l, 0, 6.1, 0, length - 6, 0.75, 1.8, 'trim');
    hip(l, 0, 11.8, 0, length - 4, 4, 2.1);
  }
}
function gate(o, d) {
  const q = local(o, c.gate.center, c.courtY),
    h = c.gate.wallHeight;
  arcade(q, 10.2, 10.4, 0, h, 1, 3.5, 3.1, 2, d, 'stone', 'limestone', true);
  if (d >= 1) {
    box(q, 0, h - 3.1, 0, 11.3, 1.6, 11.3, 'wood', 'wood');
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const v = local(q, [0, 0], 0, a);
      for (const x of [-3.7, -1.25, 1.25, 3.7]) pane(v, x, h - 1.45, -5.67, 1.65, 1.4, d, true);
    }
  }
  steepGateRoof(q, h);
  if (d >= 2) {
    for (const x of [-3.1, 3.1]) {
      box(q, x, 8, -5.6, 2.1, 5.5, 1.1, 'trim');
      hip(q, x, 13.5, -5.6, 2.6, 1.5, 2.8);
      pane(q, x, 9, -6.17, 1.1, 1.8, d);
    }
    for (const x of [-2.5, 2.5]) pane(q, x, 16, -5.23, 1, 1.8, d);
  }
}
function paintedTower(o, d) {
  const t = c.paintedTower,
    y = c.courtY,
    n = [6, 8, 12, 16][d];
  rings(
    o,
    t.center,
    [
      [y, t.radius],
      [y + t.bodyHeight - 3, t.radius],
      [y + t.bodyHeight - 2, t.radius + 1],
      [y + t.bodyHeight, t.radius + 1],
    ],
    n,
  );
  // Broad geometric diamonds are vertex colors, not a unique texture or tile-per-cell mesh.
  const rr = t.radius + 1.2;
  if (d < 1)
    rings(
      o,
      t.center,
      [
        [y + t.bodyHeight, rr],
        [y + 30, 0.025],
      ],
      n,
      'roof',
      'tile',
    );
  else {
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < n; i++) {
        const v = (k, h) => {
          const a = (k * Math.PI * 2) / n,
            r = rr * (1 - h / 4);
          return [
            t.center[0] + Math.cos(a) * r,
            y + t.bodyHeight + (t.roofHeight * h) / 4,
            t.center[1] + Math.sin(a) * r,
          ];
        };
        const p = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)];
        face(o, [p[0], p[1], p[2]], (i + j) % 2 ? 'roof' : 'roofPattern', 'tile', [0, 1, 0]);
        face(o, [p[0], p[2], p[3]], (i + j) % 2 ? 'roofPattern' : 'roof', 'tile', [0, 1, 0]);
      }
  }
  if (d >= 2)
    for (let i = 0; i < n; i += 2) {
      const a = ((i + 0.5) * Math.PI * 2) / n,
        q = local(o, t.center, 0, -a - Math.PI / 2);
      pane(q, 0, y + 15, -t.radius - 1.01, 0.8, 1.4, d);
    }
}
function otherTowers(o, d) {
  const n = [6, 8, 12, 16][d];
  for (const t of c.roundTowers) {
    rings(
      o,
      t.center,
      [
        [c.courtY, t.radius],
        [c.courtY + t.height - 1.8, t.radius],
        [c.courtY + t.height - 1, t.radius + 0.5],
        [c.courtY + t.height, t.radius + 0.5],
      ],
      n,
    );
    if (t.roof)
      rings(
        o,
        t.center,
        [
          [c.courtY + t.height, t.radius + 0.8],
          [c.courtY + t.height + t.roof, 0.025],
        ],
        n,
        'roof',
        'tile',
      );
    else if (d >= 1)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          q = local(o, t.center, c.courtY, -a);
        box(q, t.radius, 13, 0, 1.1, 1.2, 1.4);
      }
    if (d >= 2)
      for (let i = 0; i < n; i += Math.max(1, n / 4)) {
        const a = (i * Math.PI * 2) / n,
          q = local(o, t.center, c.courtY, -a - Math.PI / 2);
        pane(q, 0, t.height - 3, -t.radius - 0.52, 0.8, 1.3, d);
      }
  }
  const q = local(o, [23, 22], c.courtY);
  box(q, 0, 0, 0, 8, 15, 8);
  hip(q, 0, 15, 0, 9, 9, 5, 'roof', 'tile', true);
  if (d >= 2) {
    pane(q, 0, 9, 4.02, 1.7, 2.5, d, true);
    pane(q, 0, 3, 4.02, 1.3, 2, d);
  }
}
function wings(o, d) {
  const s = c.southWing,
    { q, length } = lineFrame(o, s.a, s.b, c.courtY);
  box(q, 0, 0, 0, length, s.height, s.width);
  hip(q, 0, s.height, 0, length + 1, s.width + 1, s.roofHeight);
  const n = c.northWing,
    v = local(o, n.center, c.courtY, n.angle);
  box(v, 0, 0, 0, n.width, n.height, n.depth);
  hip(v, 0, n.height, 0, n.width + 1, n.depth + 1, n.roofHeight);
  const h = c.chapel,
    k = local(o, h.center, c.courtY, h.angle);
  box(k, 0, 0, 0, h.length, h.wallHeight, h.width);
  hip(k, 0, h.wallHeight, 0, h.length + 1, h.width + 1, h.roofHeight);
  if (d >= 2) {
    for (let i = 0; i < 7; i++) {
      const x = (i / 6 - 0.5) * (length - 4);
      pane(q, x, 6, -s.width / 2 - 0.02, 1.4, 2.5, d);
      pane(q, x, 5, s.width / 2 + 0.02, 1.3, 2.2, d);
    }
    for (const x of [-7, -3.5, 0, 3.5, 7]) {
      pane(k, x, 7, -h.width / 2 - 0.02, 1.15, 5.5, d, true);
      box(k, x, 0, -h.width / 2 - 0.65, 0.9, 12, 1.3, 'trim');
    }
    for (const x of [-6, 0, 6]) pane(v, x, 7, -n.depth / 2 - 0.02, 1.5, 2.8, d);
  }
}
function neboisa(o, d) {
  const t = c.neboisa,
    q = local(o, t.center);
  box(q, 0, 0, 0, t.width, t.bodyHeight - 4, t.depth);
  box(q, 0, t.bodyHeight - 4, 0, t.width + 1.5, 4, t.depth + 1.5);
  hip(q, 0, t.bodyHeight, 0, t.width + 2, t.depth + 2, t.roofHeight, 'slate', 'slate', true);
  if (d >= 1)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const v = local(q, [0, 0], 0, a);
      for (const x of [-3.1, 0, 3.1])
        pane(v, x, t.bodyHeight - 3.5, -(t.depth + 1.5) / 2 - 0.02, 0.7, 1.5, d);
    }
  const g = c.gallery,
    { q: v, length } = lineFrame(o, g.a, g.b);
  arcade(v, length, g.width, 0, 11.5, 6, length / 6 - 1.1, 6.6, 2.2, d);
  box(v, 0, 11.5, 0, length, 1.1, g.width);
  box(v, 0, 12.6, 0, length, 0.6, g.width);
  hip(v, 0, 13.2, 0, length, g.width + 1.4, 1.8);
  if (d >= 2)
    for (let i = 0; i < 8; i++)
      pane(v, (i / 7 - 0.5) * (length - 3), 12.2, -g.width / 2 - 0.02, 0.6, 0.8, d);
}
function build(o, d) {
  plinth(o);
  bridge(o, d);
  palace(o, d);
  wings(o, d);
  otherTowers(o, d);
  paintedTower(o, d);
  gate(o, d);
  neboisa(o, d);
}
export const buildCorvinRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildCorvinSkyline = (o) =>
  build(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, col) =>
          o[k](
            'silhouette',
            r,
            p,
            n,
            uv,
            col.map((v) => v * (s === 'foliage' || s === 'glass' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const corvinStudy = {
  id: 'N0285',
  key: 'corvin_castle',
  title: 'Corvin Castle',
  category: 'castle',
  wikidataId: 'Q126576',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildCorvinRuntime(o),
  brief:
    'Current Gothic-Renaissance exterior with steep flared gate roof,painted conical tower,four projecting palace oriels,open court loggia,long timber entrance bridge and detached Neboisa tower on a narrow arched gallery.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: corvinPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 6,
    identityFeatures: [
      'Steep square gate roof with flared skirt beside patterned round tower',
      'Four projecting palace oriels and varied red Gothic roofline',
      'Long entrance bridge and detached square Neboisa tower joined by open arched gallery',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/1327914056 exactQ126576',
    mappedEnvelopeMeters: [125.819, 61.936],
    reportedGateHeightMeters: 22,
    gateHeightInterpretation:
      'Body estimate;primary definition unclear,roof14m estimated separately',
    paintedTowerHeightMeters: 30,
    smallTowerDiameterMeters: 6,
    neboisaGalleryMeters: [35.5, 2.4, 15],
    courtYEstimate: 9,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact cached map envelope,primary operator dimensions and approximate internal controls interpreted from inspected official photographs.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license. Cached OSM envelope © OpenStreetMap contributors,ODbL-1.0. Operator photographs stay external research references;no image,diagram or traced third-party geometry redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors;Corvin Castle operator primary factual/photo references.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Inactive geographic draft;review pending',
    notes:
      'Undirected cached map axis. Internal plan,bridge direction/gradient,vertical datum and signed whole-site fit pending.',
  }),
  geographicNote:
    'Original approximate exterior study with cached mapped boundary;inactive pending real-site/terrain review.',
  limitations: refs.limitations,
  importReason:
    'Retain compact shared-material Gothic roofline,oriels and real bridge/gallery openings across authored levels.',
  mediumFiContext: { scale: '1.75', neighborStyle: 'molen.worldgen.catalog.balkan_konak' },
  camera: { position: [130, 95, -160], lookAt: [0, 17, -15], fov: 43 },
  qaCameras: [
    { name: 'bridge-gate-and-painted-tower', position: [104, 52, -125], lookAt: [31, 24, -20] },
    { name: 'gothic-palace-four-oriels', position: [-16, 38, -79], lookAt: [5, 24, -23] },
    { name: 'neboisa-open-gallery', position: [-95, 37, -63], lookAt: [-35, 16, -21] },
    { name: 'courtyard-two-level-loggia', position: [8, 29, 8], lookAt: [4, 15, -14] },
    { name: 'chapel-and-white-tower', position: [52, 55, 90], lookAt: [10, 24, 18] },
    { name: 'roofline-and-open-court', position: [60, 93, 72], lookAt: [12, 21, 0] },
  ],
};
