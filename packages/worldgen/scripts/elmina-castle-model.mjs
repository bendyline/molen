/** Elmina exterior: battered bastions, open courts, church and governor gallery. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/eb/ebz/n0287_elmina_castle/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const elminaPalette = {
  wall: '#e8e3d4',
  trim: '#eee6d6',
  stone: '#c9bba5',
  roof: '#a5644b',
  brick: '#b2775b',
  wood: '#a77a54',
  recess: '#4d6178',
  paving: '#aaa59a',
  metal: '#575c62',
};
const colors = Object.fromEntries(
  Object.entries(elminaPalette).map(([k, h]) => [
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
// Mean linear base color of the five shared 256² graphs, measured without lighting.
// The flat level preserves their tint response without allocating any textures.
const flatSurfaceMeans = {
  plaster: [0.856015, 0.827728, 0.727643],
  limestone: [0.7539, 0.710243, 0.616244],
  tile: [0.559267, 0.552465, 0.529503],
  brick: [0.620345, 0.549823, 0.504963],
  wood: [0.825128, 0.825128, 0.825128],
};
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
      steps = d >= 2 ? 6 : d === 0 ? 3 : 4;
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

function terrace(o, outer, inner, y, col = 'paving', slot = 'limestone') {
  const pts = [...outer, ...inner],
    ix = earcut(pts.flat(), [outer.length]);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [pts[k][0], y, pts[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function shell(o, loop, low, high, col = 'wall', slot = 'plaster', upper = loop, inward = false) {
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length,
      a = loop[i],
      b = loop[j];
    const sign = inward ? -1 : 1;
    face(
      o,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [upper[j][0], high, upper[j][1]],
        [upper[i][0], high, upper[i][1]],
      ],
      col,
      slot,
      [(sign * (a[0] + b[0])) / 2, 0, (sign * (a[1] + b[1])) / 2],
    );
  }
}
function perimeter(o, d) {
  const loop = c.outerLoop,
    top = loop.map((p) => p.map((v) => v * 0.96)),
    inside = loop.map((p) => p.map((v) => v * 0.84));
  polygon(o, inside, c.courtY, 'paving', 'limestone');
  shell(o, loop, 0, c.batteryDeckY, 'wall', 'plaster', top);
  shell(
    o,
    [...inside].reverse(),
    c.courtY,
    c.batteryDeckY,
    'wall',
    'plaster',
    [...inside].reverse(),
    true,
  );
  terrace(o, top, inside, c.batteryDeckY);
  // Solid far parapets retain the defensive silhouette; selected embrasures arrive near.
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length,
      { q, length } = lineFrame(o, top[i], top[j]);
    if (d >= 2 && length > 20)
      arcade(
        q,
        length,
        0.8,
        c.batteryDeckY,
        c.batteryDeckY + 1.35,
        Math.floor(length / 4.5),
        1.3,
        c.batteryDeckY + 0.55,
        0.35,
        d,
        'wall',
        'plaster',
      );
    else box(q, 0, c.batteryDeckY, 0, length, 1.35, 0.8, 'wall', 'plaster');
  }
  for (const t of c.watchTowers) {
    const q = local(o, t.center, c.batteryDeckY);
    box(q, 0, 0, 0, t.width, t.height, t.depth, 'wall', 'plaster');
    box(q, 0, t.height, 0, t.width + 0.3, 0.55, t.depth + 0.3, 'trim', 'limestone');
    if (d >= 1)
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const v = local(q, [0, 0], 0, a);
        pane(v, 0, 2, -t.depth / 2 - 0.045, 1.1, 1.6, 0);
      }
  }
}
function roofParapet(o, w, depth, y, d) {
  if (d === 0) {
    // Joined strips omit hidden end faces at far distance while retaining the roof outline.
    const strip = (q, length) => {
      const a = -length / 2,
        b = length / 2;
      for (const s of [-1, 1])
        face(
          q,
          [
            [a, y, s * 0.3],
            [b, y, s * 0.3],
            [b, y + 1.25, s * 0.3],
            [a, y + 1.25, s * 0.3],
          ],
          'wall',
          'plaster',
          [0, 0, s],
        );
      face(
        q,
        [
          [a, y + 1.25, -0.3],
          [b, y + 1.25, -0.3],
          [b, y + 1.25, 0.3],
          [a, y + 1.25, 0.3],
        ],
        'wall',
        'plaster',
        [0, 1, 0],
      );
    };
    for (const s of [-1, 1]) {
      strip(local(o, [0, (s * depth) / 2]), w);
      strip(local(o, [(s * w) / 2, 0], 0, Math.PI / 2), depth);
    }
    return;
  }
  for (const s of [-1, 1]) {
    if (d >= 3) {
      const q = local(o, [0, (s * depth) / 2]);
      arcade(
        q,
        w,
        0.6,
        y,
        y + 1.25,
        Math.max(2, Math.floor(w / 2.4)),
        0.85,
        y + 0.68,
        0.25,
        d,
        'wall',
        'plaster',
      );
      box(q, 0, y, 0, w, 0.25, 0.65, 'trim', 'plaster');
    } else box(o, 0, y, (s * depth) / 2, w, 1.25, 0.6, 'wall', 'plaster');
  }
  for (const s of [-1, 1]) box(o, (s * w) / 2, y, 0, 0.6, 1.25, depth, 'wall', 'plaster');
}
function facade(o, w, depth, h, d, rows = [2.3, 7.1]) {
  if (d < 1) return;
  for (const s of [-1, 1])
    for (let i = 0; i < Math.max(2, Math.floor(w / 4.8)); i++) {
      const count = Math.max(2, Math.floor(w / 4.8)),
        x = ((i + 0.5) * w) / count - w / 2;
      for (const y of d === 1 ? rows.slice(-1) : rows) {
        if (y + 2.8 > h) continue;
        pane(o, x, y, s * (depth / 2 + 0.05), 1.25, 2.2, 0);
        if (d >= 3)
          box(o, x, y - 0.25, s * (depth / 2 + 0.1), 1.8, 0.35, 0.35, 'trim', 'limestone');
      }
    }
}
function innerBuildings(o, d) {
  const y = c.courtY;
  // Tall rear block and stepped front blocks leave a second, genuinely open courtyard.
  const q = local(o, [-42, 0], y);
  box(q, 0, 0, 0, 15, 23, 48, 'wall', 'plaster');
  hip(local(q, [0, 0], 0, Math.PI / 2), 0, 23, 0, 49, 16, 4, 'roof', 'tile');
  facade(q, 15, 48, 23, d, [3, 8.4, 14.5, 20]);
  facade(local(q, [0, 0], 0, Math.PI / 2), 48, 15, 23, d, [3, 8.4, 14.5, 20]);
  const front = local(o, [-27, -8], y);
  box(front, 0, 0, 0, 15, 18, 25, 'wall', 'plaster');
  roofParapet(front, 15, 25, 18, d);
  facade(front, 15, 25, 18, d, [2, 7.5, 13]);
  facade(local(front, [0, 0], 0, Math.PI / 2), 25, 15, 18, d, [2, 7.5, 13]);
  const screen = local(o, [-21, 14], y, -Math.PI / 2);
  arcade(screen, 14, 1.4, 0, 12, 2, 3.6, 3.3, 1.9, d, 'wall', 'plaster');
  roofParapet(screen, 14, 1.6, 12, d);
  if (d >= 2) for (const x of [-4, 4]) pane(screen, x, 8.2, -0.73, 1.2, 2, 0, true);
  const cap = local(o, [-29, 23], y);
  box(cap, 0, 0, 0, 14, 12, 5, 'wall', 'plaster');
  roofParapet(cap, 14, 5, 12, d);
  for (const w of c.sideWings) {
    const v = local(o, w.center, y);
    box(v, 0, 0, 0, w.width, w.height, w.depth, 'wall', 'plaster');
    roofParapet(v, w.width, w.depth, w.height, d);
    facade(v, w.width, w.depth, w.height, d);
  }
  const sea = c.seaWing,
    v = local(o, sea.center, y, Math.PI / 2);
  box(v, 0, 0, 0, sea.depth, sea.height, sea.width, 'wall', 'plaster');
  roofParapet(v, sea.depth, sea.width, sea.height, d);
  facade(v, sea.depth, sea.width, sea.height, d, [2.7, 6]);
  // Upper loggia is physically open; no painted dark arch on a filled rectangle.
  const gallery = local(o, [-35, -27], y);
  arcade(gallery, 28, 4, 16, 22, 6, 3.6, 18.5, 1.8, d, 'wall', 'plaster');
  box(gallery, 0, 16, 0, 29, 0.65, 4.7, 'trim', 'limestone');
  hip(gallery, 0, 22, 0, 29, 5.1, 1.8, 'roof', 'tile');
  if (d >= 2)
    for (const s of [-1, 1]) box(gallery, 0, 16.65, s * 2, 28, 0.65, 0.4, 'wall', 'plaster');
}
function chapel(o, d) {
  const t = c.church,
    q = local(o, t.center, c.courtY);
  box(q, 0, 0, 0, t.width, t.height, t.depth, 'wall', 'plaster');
  box(q, 0, t.height, 0, t.width, 0.65, t.depth, 'trim', 'limestone');
  // Broad brick pilasters and stepped flat parapet identify the former Portuguese church.
  box(q, 0, t.height + 0.65, t.depth / 2, 4, 0.85, 0.8, 'wall', 'plaster');
  for (const x of [-t.width / 2 + 0.55, -1.35, 1.35, t.width / 2 - 0.55])
    box(q, x, 0, t.depth / 2 + 0.06, 0.7, t.height, 0.22, 'brick', 'brick');
  if (d >= 1) {
    pane(q, 0, 0, t.depth / 2 + 0.18, 1.7, 3.6, 0);
    for (const x of [-3.25, 3.25]) {
      pane(q, x, 1.5, t.depth / 2 + 0.18, 1.5, 1.8, 0);
      pane(q, x, 6.2, t.depth / 2 + 0.18, 1.5, 2.2, 0);
    }
    for (const x of [-0.55, 0.55]) pane(q, x, 6.2, t.depth / 2 + 0.18, 0.85, 2.2, 0);
  }
  if (d >= 3) box(q, 0, 3.8, t.depth / 2 + 0.2, 2.4, 0.4, 0.3, 'trim', 'limestone');
}
function entrance(o, d) {
  const t = c.gate,
    q = local(o, t.center, 0, t.angle);
  box(q, 0, 0, 0, t.width, 4, t.depth, 'wall', 'plaster');
  arcade(q, t.width, t.depth, 4, 16, 1, 5.5, 8.2, 2.3, d, 'wall', 'plaster');
  box(q, 0, 16, 0, t.width + 1, 0.6, t.depth + 1, 'trim', 'limestone');
  if (d >= 2) box(q, 0, 13.1, t.depth / 2 + 0.1, 3.4, 1.6, 0.25, 'trim', 'limestone');
  const b = c.bridge,
    { q: v, length } = lineFrame(o, b.a, b.b);
  box(v, 0, b.deckY - 0.45, 0, length, 0.45, b.width, 'wood', 'wood');
  for (const s of [-1, 1])
    box(v, 0, b.deckY, (s * b.width) / 2, length, 0.75, 0.45, 'wood', 'wood');
  for (let i = 0; i < 5; i++)
    box(
      v,
      (i / 4 - 0.5) * (length - 3),
      0,
      0,
      1.5,
      b.deckY - 0.45,
      b.width + 1,
      'stone',
      'limestone',
    );
}
function barrel(o, length, r, center, n, col = 'metal') {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      p = pts[i],
      q = pts[j];
    face(
      o,
      [
        [center[0] - length / 2, center[1] + p[0], center[2] + p[1]],
        [center[0] + length / 2, center[1] + p[0], center[2] + p[1]],
        [center[0] + length / 2, center[1] + q[0], center[2] + q[1]],
        [center[0] - length / 2, center[1] + q[0], center[2] + q[1]],
      ],
      col,
      'foliage',
      [0, p[0] + q[0], p[1] + q[1]],
    );
  }
  for (const s of [-1, 1])
    face(
      o,
      pts.map((p) => [center[0] + (s * length) / 2, center[1] + p[0], center[2] + p[1]]),
      col,
      'foliage',
      [s, 0, 0],
    );
}
function cannonDetails(o, d) {
  if (d < 3) return;
  for (const p of [
    [50, 38],
    [52, -34],
    [-53, -33],
    [35, 32],
    [-45, 36],
    [57, 23],
  ]) {
    const a = -Math.atan2(p[1], p[0]),
      q = local(o, p, c.batteryDeckY, a);
    box(q, -0.6, 0, 0, 1.5, 0.75, 1.25, 'wood', 'wood');
    barrel(q, 2.6, 0.32, [0.35, 1.2, 0], 12);
    // Wheels are solid eight-sided discs, merged with the matte metal group.
    const v = local(q, [0, 0], 0, Math.PI / 2);
    for (const s of [-1, 1]) barrel(v, 0.24, 0.48, [s * 0.72, 0.48, 0.6], 8);
  }
}
function build(o, d) {
  perimeter(o, d);
  innerBuildings(o, d);
  chapel(o, d);
  entrance(o, d);
  cannonDetails(o, d);
}
export const buildElminaRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildElminaSkyline = (o) =>
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
            col.map((v, i) => v * (flatSurfaceMeans[s]?.[i] ?? 1)),
          ),
      ]),
    ),
    0,
  );
export const elminaStudy = {
  id: 'N0287',
  key: 'elmina_castle',
  title: 'Elmina Castle',
  category: 'castle',
  wikidataId: 'Q55264655',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildElminaRuntime(o),
  brief:
    'Original approximate exterior with battered white bastioned curtain walls,terraced batteries,open main and smaller courts,stepped governor blocks with a real upper loggia,brick-pilastered former church,and arched gateway approached over timber bridge.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: elminaPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: flatSurfaceMeans,
    materialBudget: 7,
    identityFeatures: [
      'White battered fort walls and angular projecting battery bastions',
      'Stepped white inner buildings and red-roof governor block with open gallery',
      'Open courtyard with brick-pilastered former church and smaller secondary court',
    ],
  },
  sourceFacts: {
    identity: 'Q55264655 reference coordinate;GMMB St.George’s Castle description',
    reportedStoreys: 4,
    measuredDimensionsAvailable: false,
    reconstructedHeightMeters: 31,
    reconstructedEnvelopeMeters: [134, 113],
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Original meter estimates from inspected operator and primary photographer images;no surveyed or verified mapped dimensions.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license. Operator/photographer images are private research only,not redistributed or embedded. No OSM geometry used.',
  dataAttribution:
    'Ghana Museums and Monuments Board;Ghana Tourism Authority;UNESCO;primary photographer sixthofdecember (external research references).',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    heading: 0,
    groundModelY: 0,
    mapGeometryLicense: 'Original reconstruction;no mapped geometry',
    attribution: 'Molen original reconstruction',
    reviewStatus: 'Inactive reference-only draft;heading placeholder',
    notes:
      'Reference coordinate only. All dimensions,outline,internal plan,heading and attachment datums estimated;independent scale/direction/terrain/site review pending.',
  }),
  geographicNote:
    'Reference coordinate only;original approximate plan with unresolved direction and scale. No mapped geometry used. Inactive pending site review.',
  limitations: refs.limitations,
  importReason:
    'Retain recognizable white fort/bastion envelope,open court/church and stepped governor/gallery identity in compact shared-material authored LODs.',
  mediumFiContext: { scale: '2', neighborStyle: 'molen.worldgen.catalog.west_african_compound' },
  camera: { position: [135, 90, 165], lookAt: [0, 12, 4], fov: 43 },
  qaCameras: [
    {
      name: 'entrance-bridge-and-battered-walls',
      position: [-108, 34, 116],
      lookAt: [-28, 11, 30],
    },
    { name: 'sea-battery-and-watch-towers', position: [119, 44, 78], lookAt: [34, 11, 1] },
    { name: 'open-courts-and-governor-roofs', position: [72, 117, 64], lookAt: [-7, 10, 0] },
    { name: 'former-church-brick-pilasters', position: [8, 13, 20], lookAt: [-7, 11, 8] },
    { name: 'upper-governor-loggia', position: [-72, 37, -87], lookAt: [-35, 24, -26] },
    { name: 'small-courtyard-openings', position: [-32, 8, 14], lookAt: [-21, 7, 14] },
  ],
};
