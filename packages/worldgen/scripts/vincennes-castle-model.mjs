/** Present-day Vincennes compound: attributed map plans, individually authored medium-fi LODs. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u09/n0265_chateau_de_vincennes/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const vincennesPalette = {
  wall: '#e6dcc7',
  trim: '#efe5d1',
  slate: '#626b74',
  tile: '#ac775c',
  glass: '#4d6178',
  paving: '#b6b0a1',
  door: '#78594a',
  red: '#ba394a',
  blue: '#3e6098',
  white: '#eae5db',
  lawn: '#8aa065',
};
const colors = Object.fromEntries(
  Object.entries(vincennesPalette).map(([key, hex]) => [
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
const rect = (o, x, y, z, w, h, d, color = 'wall', slot = 'limestone') =>
  box(o, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[color]);
function local(o, x, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
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
function face(o, p, color = 'wall', slot = 'limestone', up = false) {
  if (up && normalFor(...p.slice(0, 3))[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      colors[color],
    );
  }
}
const signedArea = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function ring(p, positive = false) {
  const r = p.slice();
  if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  if (signedArea(r) > 0 !== positive) r.reverse();
  return r;
}
function slab(o, rings, y, color = 'paving', slot = 'limestone') {
  const pts = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(offset);
    offset += r.length;
  }
  const ids = earcut(pts.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      color,
      slot,
      true,
    );
}
function shell(o, outer, holes, base, top, color = 'wall', slot = 'limestone') {
  const rs = [ring(outer), ...holes.map((r) => ring(r, true))];
  for (const r of rs)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        o,
        [
          [a[0], base, a[1]],
          [b[0], base, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        color,
        slot,
      );
    }
  slab(o, rs, top, color, slot);
}
function panel(o, x, y, z, w, h, color = 'glass', slot = 'glass') {
  face(
    o,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    color,
    slot,
  );
}
function archPoints(x, y, z, w, h, pointed = false, steps = 6) {
  const r = w / 2,
    cy = y + h - (pointed ? r * 1.5 : r);
  return [
    [x - r, y, z],
    [x + r, y, z],
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i * Math.PI) / steps;
      return [x + r * Math.cos(a), cy + r * Math.sin(a) * (pointed ? 1.5 : 1), z];
    }),
  ];
}
function arch(o, x, y, z, w, h, color = 'glass', slot = 'glass', pointed = false, steps = 6) {
  face(o, archPoints(x, y, z, w, h, pointed, steps), color, slot);
}
function window(o, x, y, z, w, h, d, arched = false) {
  const draw = arched ? arch : panel;
  if (d >= 2) draw(o, x, y - 0.3, z, w + 0.6, h + 0.6, 'trim', 'limestone');
  draw(o, x, y, z + 0.03, w, h, 'glass', 'glass');
  if (d === 3 && w >= 2.6) panel(o, x, y + h * 0.55, z + 0.07, w, 0.55, 'trim', 'limestone');
}
function windows(o, p, rows, d, spacing = 5.2, arched = false) {
  if (!d) return;
  const r = ring(p);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 6) continue;
    const n = Math.max(1, Math.floor(len / spacing)),
      q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
    for (let j = 0; j < n; j++)
      for (const [y, h] of rows)
        window(q, ((j + 0.5) * len) / n, y, 0.08, Math.min(2.1, (len / n) * 0.45), h, d, arched);
  }
}
const rectangle = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x - w / 2, z + d / 2],
  [x + w / 2, z + d / 2],
  [x + w / 2, z - d / 2],
];
function hip(o, x, z, w, depth, eave, ridge, color = 'slate', slot = 'slate') {
  const p = rectangle(x, z, w, depth),
    a = [x - w / 2 + Math.min(w * 0.15, depth * 0.45), ridge, z],
    b = [x + w / 2 - Math.min(w * 0.15, depth * 0.45), ridge, z];
  const v = p.map((q) => [q[0], eave, q[1]]);
  for (const f of [
    [v[0], v[1], a],
    [v[1], v[2], b, a],
    [v[2], v[3], b],
    [v[3], v[0], a, b],
  ])
    face(o, f, color, slot, true);
}
function cylinder(o, x, z, radii, d, color = 'wall', slot = 'limestone', n) {
  const count = n ?? [6, 10, 14, 18][d];
  loft(
    o,
    slot,
    radii.map(([y, r]) => radialRing(y, r, r, count, [x, z])),
    colors[color],
  );
}
function cone(o, x, z, base, top, r, d, color = 'slate', slot = 'slate', n) {
  cylinder(
    o,
    x,
    z,
    [
      [base, r],
      [top, 0.03],
    ],
    d,
    color,
    slot,
    n,
  );
}
function archway(o, x, y, z, w, h, depth, fullWidth, top, d) {
  rect(o, x - (fullWidth + w) / 4, y, z, (fullWidth - w) / 2, top - y, depth);
  rect(o, x + (fullWidth + w) / 4, y, z, (fullWidth - w) / 2, top - y, depth);
  const p = archPoints(0, y, 0, w, h, true, d ? 6 : 2).slice(2);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      q = [
        [x + a[0], a[1]],
        [x + b[0], b[1]],
        [x + b[0], top],
        [x + a[0], top],
      ];
    face(
      o,
      q.map(([u, v]) => [u, v, z + depth / 2]),
    );
    face(
      o,
      [...q].reverse().map(([u, v]) => [u, v, z - depth / 2]),
    );
    face(o, [
      [x + b[0], b[1], z - depth / 2],
      [x + a[0], a[1], z - depth / 2],
      [x + a[0], a[1], z + depth / 2],
      [x + b[0], b[1], z + depth / 2],
    ]);
  }
  face(
    o,
    [
      [x - fullWidth / 2, top, z - depth / 2],
      [x - fullWidth / 2, top, z + depth / 2],
      [x + fullWidth / 2, top, z + depth / 2],
      [x + fullWidth / 2, top, z - depth / 2],
    ],
    'wall',
    'limestone',
    true,
  );
}
function keep(o, d) {
  const x = -21.7,
    z = -76.4;
  rect(o, x, 0, z, 16.2, 48.6, 16.2);
  const towers = [
    [-28.4, -69.9],
    [-15, -69.9],
    [-15, -83.1],
    [-28.4, -83.1],
  ];
  for (const [u, v] of towers) {
    cylinder(
      o,
      u,
      v,
      d
        ? [
            [0, 3.2],
            [38.5, 3.2],
            [39.4, 3.8],
            [40.3, 3.8],
            [40.7, 3.3],
            [48.4, 3.3],
            [49, 3.7],
            [50, 3.7],
          ]
        : [
            [0, 3.2],
            [39, 3.2],
            [40, 3.7],
            [50, 3.7],
          ],
      d,
    );
    if (d)
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const q = local(o, u + 3.21 * Math.sin(a), v + 3.21 * Math.cos(a), a);
        for (const y of [9, 20, 31]) window(q, 0, y, 0.035, 0.9, 2.4, 1, true);
      }
  }
  rect(o, x, 39.2, z, 18.1, 1.1, 18.1, 'trim');
  rect(o, x, 48.6, z, 17.5, 1.4, 17.5, 'trim');
  slab(o, [rectangle(x, z, 15, 15)], 50.01, 'paving');
  if (d) {
    windows(
      o,
      rectangle(x, z, 16.2, 16.2),
      [
        [8, 3],
        [19, 3.5],
        [30, 3],
      ],
      d,
      8,
      true,
    );
    for (const y of [15.7, 28]) rect(o, x, y, z, 16.5, 0.6, 16.5, 'trim');
    // Projection at the northwestern corner: latrine shaft and corbelled upper room.
    rect(o, -8.5, 0, -83.3, 3.5, 39.5, 2.2);
    cylinder(
      o,
      -6.8,
      -83.3,
      [
        [38, 1.4],
        [40, 2.2],
        [47, 2.2],
      ],
      d,
      'wall',
      'limestone',
      8,
    );
  }
  cylinder(
    o,
    -26.5,
    -81.4,
    [
      [50, 1.5],
      [53.2, 1.5],
    ],
    d,
    'wall',
    'limestone',
    d ? 10 : 6,
  );
  cylinder(
    o,
    -22,
    -76,
    [
      [50, 0.29],
      [59, 0.29],
    ],
    0,
    'white',
    'foliage',
    4,
  );
  for (let i = 0; i < 3; i++) {
    const a = -22 + i * 1.2,
      p = [
        [a, 55.5, -76],
        [a + 1.2, 55.3 + i * 0.04, -76],
        [a + 1.2, 58, -76],
        [a, 58.2, -76],
      ];
    face(o, p, ['blue', 'white', 'red'][i], 'foliage');
    face(o, [...p].reverse(), ['blue', 'white', 'red'][i], 'foliage');
  }
}
function keepEnclosure(o, d) {
  const x = -21.5,
    z = -76.5;
  // Walls descend to a declared moat datum. Flat-ground previews conceal their lower 6m.
  for (const [cx, cz, angle] of [
    [x, -104, 0],
    [x, -49, 0],
    [-49, z, Math.PI / 2],
    [5, z, Math.PI / 2],
  ]) {
    const q = local(o, cx, cz, angle),
      len = angle ? 55 : 54;
    if (cz === -49 && !angle) {
      rect(q, -18, -6, 0, 18, 18, 2);
      rect(q, 18, -6, 0, 18, 18, 2);
      hip(q, -18, 0, 18, 3.1, 14.4, 16.8);
      hip(q, 18, 0, 18, 3.1, 14.4, 16.8);
    } else {
      rect(q, 0, -6, 0, len, 20.4, 2);
      hip(q, 0, 0, len + 0.4, 3.1, 14.4, 16.8);
    }
    if (d)
      for (let u = -len / 2 + 3; u < len / 2 - 2; u += 5) {
        if (cz === -49 && Math.abs(u) < 10) continue;
        for (const side of [-1, 1])
          panel(local(q, 0, side * 1.025, side > 0 ? 0 : Math.PI), u, 12, 0.03, 1.1, 1.8);
        if (d >= 2) rect(q, u, 10.2, 1.5, 0.75, 0.8, 1.1, 'trim');
      }
  }
  for (const u of [-49, 5])
    for (const v of [-104, -49]) {
      cylinder(
        o,
        u,
        v,
        [
          [10.5, 0.7],
          [12, 1.65],
          [17, 1.65],
        ],
        d,
      );
      cone(o, u, v, 17, 21.8, 2, d);
    }
  slab(o, [rectangle(x, z, 52, 53)], 0, 'paving');
  // Châtelet is a separate roofless gate with twin round towers and an open arch.
  archway(o, -21.5, 0, -48.5, 4.5, 5.4, 6, 12, 22, d);
  for (const u of [-27, -16])
    cylinder(
      o,
      u,
      -47.5,
      [
        [0, 2.8],
        [21.3, 2.8],
        [22, 3.1],
        [23.1, 3.1],
      ],
      d,
    );
  if (d) {
    arch(o, -21.5, 13, -45.42, 2.2, 4, 'glass', 'glass', true);
    for (const u of [-24.9, -21.5, -18.1])
      arch(o, u, 7.4, -45.41, 1.6, 3.6, 'paving', 'limestone', true);
  }
  rect(o, -21.5, -0.7, -35, 5.2, 0.7, 25, 'paving');
  for (const u of [-24.4, -18.6]) rect(o, u, 0, -34, 0.6, 0.95, 23, 'trim');
  rect(o, -21.5, -6, -35, 2.2, 5.3, 2.2);
  // Elevated passage connects the eastern keep door to the châtelet.
  if (d) {
    rect(o, -21.5, 7.2, -59, 2.8, 0.8, 20);
    for (const u of [-23, -20]) rect(o, u, 8, -59, 0.6, 1.1, 20);
  }
}
function chapel(o, d) {
  const q = local(o, -45.5, 36.5, 0.105),
    outline = [
      [-7.5, 0],
      [-7.5, 32],
      [-6.1, 37],
      [-2.5, 40.8],
      [2.5, 40.8],
      [6.1, 37],
      [7.5, 32],
      [7.5, 0],
    ];
  shell(q, outline, [], 0, 23.2);
  face(
    q,
    [
      [-7.8, 23.2, 0],
      [0, 32.6, 0],
      [0, 32.6, 32],
      [-7.8, 23.2, 32],
    ],
    'slate',
    'slate',
    true,
  );
  face(
    q,
    [
      [7.8, 23.2, 32],
      [0, 32.6, 32],
      [0, 32.6, 0],
      [7.8, 23.2, 0],
    ],
    'slate',
    'slate',
    true,
  );
  for (let i = 1; i < outline.length - 2; i++) {
    const a = outline[i],
      b = outline[i + 1];
    face(
      q,
      [
        [0, 32.6, 32],
        [a[0], 23.2, a[1]],
        [b[0], 23.2, b[1]],
      ],
      'slate',
      'slate',
      true,
    );
  }
  // West rose facade and its steep gable face west, toward the keep.
  const west = local(q, 0, -0.08, Math.PI);
  face(
    west,
    [
      [-7.5, 23.2, 0],
      [7.5, 23.2, 0],
      [0, 33.4, 0],
    ],
    'trim',
  );
  if (d) {
    arch(west, 0, 0.3, 0.1, 3.5, 7.1, 'door', 'foliage', true);
    const rose = Array.from({ length: d === 1 ? 8 : 12 }, (_, i) => {
      const a = (i * Math.PI * 2) / (d === 1 ? 8 : 12);
      return [4.3 * Math.cos(a), 15.3 + 4.3 * Math.sin(a), 0.14];
    });
    face(west, rose);
    face(
      west,
      rose.map(([x, y]) => [x * 0.87, 15.3 + (y - 15.3) * 0.87, 0.17]),
      'glass',
      'glass',
    );
    if (d >= 2)
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        beam(
          west,
          'limestone',
          [0, 15.3, 0.24],
          [3.8 * Math.cos(a), 15.3 + 3.8 * Math.sin(a), 0.24],
          0.6,
          0.55,
          colors.trim,
        );
      }
    for (const side of [-1, 1]) {
      const wall = local(q, side * 7.52, 0, (side * Math.PI) / 2);
      for (let v = 3.5; v < 31; v += 6.3) {
        const x = -side * v;
        arch(wall, x, 4.8, 0.03, 4.1, 15.8, 'glass', 'glass', true);
        if (d >= 2) {
          panel(wall, x, 4.8, 0.09, 0.58, 12, 'trim', 'limestone');
          panel(wall, x, 15.5, 0.1, 3.9, 0.55, 'trim', 'limestone');
        }
      }
    }
    const r = ring(outline);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (a[1] < 31 || b[1] < 31) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        wall = local(q, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
      arch(wall, len / 2, 5.5, 0.08, len * 0.55, 14.5, 'glass', 'glass', true);
    }
  }
  for (const side of [-1, 1])
    for (const v of d ? [0.5, 6.3, 12.6, 18.9, 25.2, 32] : [0.5, 32]) {
      rect(q, side * 8.3, 0, v, 2.3, 18, 1.2);
      rect(q, side * 7.9, 18, v, 1.5, 7, 1.2, 'trim');
      cone(q, side * 7.9, v, 25, v < 1 ? 32.6 : 28.7, 0.9, 0, 'trim', 'limestone', 4);
    }
  // North sacristy/treasury and its small octagonal stair projection.
  rect(q, 11.3, 0, 31.4, 7.6, 12, 11);
  hip(local(q, 11.3, 31.4, Math.PI / 2), 0, 0, 11.6, 8.2, 12, 17.2);
  cylinder(
    q,
    15,
    28,
    [
      [0, 1.7],
      [17.5, 1.7],
    ],
    d,
    'wall',
    'limestone',
    8,
  );
  cone(q, 15, 28, 17.5, 22, 1.9, d);
}
function royalRange(o, x, z, d) {
  rect(o, x, 0, z, 91, 18.8, 25);
  hip(o, x, z, 92, 26, 18.8, 29.7);
  for (const u of [x - 35, x + 35]) {
    rect(o, u, 0, z, 20, 21, 27);
    hip(o, u, z, 21, 28, 21, 31);
  }
  if (!d) return;
  // Place each window on the stepped facade, including the forward end pavilions.
  for (const side of [-1, 1]) {
    for (let u = -41; u <= 41; u += 5.125) {
      const depth = Math.abs(u) > 25 ? 13.5 : 12.5;
      const f = local(o, x + u, z + side * depth, side > 0 ? 0 : Math.PI);
      for (const [y, h] of [
        [1.5, 3.2],
        [7.4, 4],
        [14.2, 2.5],
      ])
        window(f, 0, y, 0.07, 2.1, h, d);
    }
  }
  for (const side of [-1, 1]) {
    const f = local(o, x + side * 45.5, z, (side * Math.PI) / 2);
    for (const u of [-8, -3, 3, 8])
      for (const [y, h] of [
        [1.5, 3.2],
        [7.4, 4],
        [14.2, 2.5],
      ])
        window(f, u, y, 0.08, 2.1, h, d);
  }
  for (const side of [-1, 1]) {
    for (const [u, w, dep] of [
      [x, 51, 12.65],
      [x - 35, 20, 13.65],
      [x + 35, 20, 13.65],
    ]) {
      rect(o, u, 6.2, z + side * dep, w, 0.65, 0.65, 'trim');
      rect(o, u, 13.2, z + side * dep, w, 0.6, 0.65, 'trim');
    }
    if (d >= 2)
      for (let u = x - 39; u < x + 42; u += 6.5)
        rect(o, u, 6.6, z + side * (Math.abs(u - x) > 25 ? 13.8 : 12.8), 0.6, 11.4, 0.65, 'trim');
    if (d >= 2)
      for (let u = x - 23; u < x + 27; u += 11.5) {
        const q = local(o, u, z + side * 10.3, side > 0 ? 0 : Math.PI);
        rect(q, 0, 22, 0, 2.8, 2.8, 2.3);
        hip(q, 0, 0, 3.2, 2.8, 24.8, 26.3);
        window(q, 0, 22.3, 1.19, 1.5, 1.9, 1);
      }
  }
  if (d === 3)
    for (const u of [x - 36, x - 11, x + 11, x + 36]) rect(o, u, 28, z + 3, 2.5, 4.5, 1.8, 'trim');
}
function villageGate(o, d) {
  const q = local(o, 168, 18.5, Math.PI / 2);
  archway(q, 0, -6, 0, 5.2, 12, 12, 18, 33, d);
  rect(q, 0, 32.5, 0, 21.5, 1.5, 14.2, 'trim');
  for (const x of [-9.3, 9.3]) {
    rect(q, x, -6, 4.9, 1.7, 39, 3.4);
    rect(q, x, -6, -4.9, 1.7, 39, 3.4);
  }
  cylinder(
    q,
    -7,
    -4.2,
    [
      [34, 1.8],
      [41, 1.8],
      [42, 2],
    ],
    d,
  );
  if (d)
    for (const side of [-1, 1]) {
      const f = local(q, 0, side * 6.03, side > 0 ? 0 : Math.PI);
      for (const y of [10, 18.3, 26]) {
        arch(f, 0, y, 0.02, 2.4, 5, 'glass', 'glass', true);
        if (d >= 2) {
          panel(f, 0, y + 2.4, 0.07, 2.4, 0.6, 'trim', 'limestone');
        }
      }
    }
  rect(q, 0, -0.7, 19, 6, 0.7, 30, 'paving');
  for (const x of [-3.2, 3.2]) rect(q, x, 0, 19, 0.6, 1, 30);
  if (d) for (const v of [11, 25]) rect(q, 0, -6, v, 3.7, 5.3, 2.5);
}
function portico(o, x, z, length, d, centerGate = false) {
  const q = local(o, x, z, Math.PI / 2);
  if (!d) {
    rect(q, 0, 0, 0, length, 6.6, 2);
    return;
  }
  const count = Math.round(length / 7),
    width = length / count;
  for (let i = 0; i < count; i++) {
    const u = -length / 2 + (i + 0.5) * width;
    if (centerGate && Math.abs(u) < 12) continue;
    archway(q, u, 0, 0, width * 0.62, 4.8, 1.6, width, 6.6, d);
  }
  rect(q, 0, 6.6, 0, length, 0.65, 2.2, 'trim');
}
function compound(o, d) {
  // Present low enceinte: the original nine 40m towers are not reconstructed.
  rect(o, 159, -6, -37, 20, 18, 61);
  rect(o, 159, -6, 65, 20, 18, 72);
  rect(o, 57, -6, -69.5, 172, 17.6, 2.5);
  rect(o, -109, -6, -69.5, 116, 17.6, 2.5);
  rect(o, 0, -6, 105, 330, 17.6, 2.5);
  // Low northern ranges have pale flat roofs, rather than invented medieval tall roofs.
  for (const [cx, cz, w, dep] of [
    [156, -36, 19, 61],
    [156, 65, 19, 73],
    [70, 95, 153, 18],
    [-27, 98, 78, 13],
  ]) {
    rect(o, cx, 0, cz, w, 12, dep);
    slab(o, [rectangle(cx, cz, w, dep)], 12.05, 'paving');
    if (d)
      windows(
        o,
        rectangle(cx, cz, w, dep),
        [
          [1.6, 2],
          [6.2, 2.2],
        ],
        d,
        6,
      );
  }
  for (const x of [-167, 167])
    for (const z of [-69, 104]) {
      rect(o, x, -6, z, 16, 20, 15);
      rect(o, x, 13.5, z, 16.6, 0.8, 15.6, 'trim');
      if (d) {
        windows(
          o,
          rectangle(x, z, 16, 15),
          [
            [0.5, 2],
            [6.1, 2.4],
          ],
          d,
          7,
        );
        for (const side of [-1, 1]) rect(o, x + side * 6.8, -6, z, 1.1, 20, 17.4);
      }
    }
  rect(o, 0, -6, 105, 18, 19, 18);
  rect(o, -87, -6, 105, 15, 18, 18);
  villageGate(o, d);
  royalRange(o, -122.5, -55.4, d);
  royalRange(o, -122.5, 95.3, d);
  portico(o, -63, 18, 132, d, true);
  portico(o, -167, 18, 135, d, true);
  for (const [x, h] of [
    [-61, 15.9],
    [-168, 21.8],
  ]) {
    const q = local(o, x, 17.7, -Math.PI / 2);
    archway(q, 0, 0, 0, 6.5, 8, 9, 18.5, h, d);
    rect(q, 0, h, 0, 19.8, 0.8, 10, 'trim');
    if (d >= 2) for (const u of [-7.5, 7.5]) rect(q, u, 0, 5.1, 1.2, h, 0.75, 'trim');
  }
  // Ancillary buildings retain their IGN outlines; roofs are reconstructed separate ridges.
  for (const [index, eave, roof, color] of [
    [3, 8.4, 12.8, 'tile'],
    [7, 11.9, 17.1, 'tile'],
    [8, 15.8, 22.3, 'slate'],
    [0, 4, 6.5, 'tile'],
    [12, 7, 12.3, 'tile'],
  ]) {
    const p = frame.components.parts[index],
      r = p.rings[0],
      [lo, hi] = p.bounds,
      w = hi[0] - lo[0],
      dep = hi[1] - lo[1],
      x = (lo[0] + hi[0]) / 2,
      z = (lo[1] + hi[1]) / 2;
    if (!d && index === 0) continue;
    shell(o, r, [], 0, eave);
    // The broad northern service block has two parallel gables, not one enormous roof.
    if (index === 7)
      for (const sign of [-1, 1])
        hip(o, x, z + (sign * dep) / 4, w, dep / 2, eave, roof, color, color);
    else hip(o, x, z, w, dep, eave, roof, color, color);
    windows(
      o,
      r,
      eave > 11
        ? [
            [1.4, 2.2],
            [6.3, 2.6],
            [10.5, 2],
          ]
        : [[1.4, 2.2]],
      d,
    );
  }
}
function skyline(o) {
  // Individually authored compound silhouette: preserve each principal volume, omit facade rhythm.
  for (const [x, z, w, dep] of [
    [156, -36, 19, 61],
    [156, 65, 19, 73],
    [70, 95, 153, 18],
    [-27, 98, 78, 13],
  ])
    rect(o, x, 0, z, w, 12, dep);
  for (const [x, z, w, h, dep] of [
    [159, -37, 20, 12, 61],
    [159, 65, 20, 12, 72],
    [57, -69.5, 172, 11.6, 2.5],
    [-109, -69.5, 116, 11.6, 2.5],
    [0, 105, 330, 11.6, 2.5],
  ])
    rect(o, x, -6, z, w, h + 6, dep);
  for (const x of [-167, 167]) for (const z of [-69, 104]) rect(o, x, -6, z, 16, 20, 15);
  for (const z of [-55.4, 95.3]) {
    rect(o, -122.5, 0, z, 91, 21, 27);
    hip(o, -122.5, z, 92, 28, 21, 29.7);
    for (const x of [-157.5, -87.5]) hip(o, x, z, 21, 28, 21, 31);
  }
  for (const x of [-63, -167]) rect(o, x, 0, 18, 2, 6.6, 135);
  rect(o, -168, 0, 17.7, 9, 21.8, 18.5);
  rect(o, 168, -6, 18.5, 12, 40, 20);
  cylinder(
    o,
    172,
    11.5,
    [
      [34, 1.8],
      [42, 1.8],
    ],
    0,
    'wall',
    'limestone',
    4,
  );
  for (const [i, e, r, col] of [
    [3, 8.4, 12.8, 'tile'],
    [7, 11.9, 17.1, 'tile'],
    [8, 15.8, 22.3, 'slate'],
  ]) {
    const p = frame.components.parts[i],
      [lo, hi] = p.bounds,
      w = hi[0] - lo[0],
      dep = hi[1] - lo[1],
      x = p.center[0],
      z = p.center[1];
    rect(o, x, 0, z, w, e, dep);
    hip(o, x, z, w, dep, e, r, col, col);
  }
  for (const [x, z, a] of [
    [-21.5, -104, 0],
    [-21.5, -49, 0],
    [-49, -76.5, Math.PI / 2],
    [5, -76.5, Math.PI / 2],
  ]) {
    const q = local(o, x, z, a);
    rect(q, 0, -6, 0, 54, 20.4, 2);
    hip(q, 0, 0, 54, 3.1, 14.4, 16.8);
  }
  for (const x of [-49, 5])
    for (const z of [-104, -49]) cone(o, x, z, 16.8, 21.8, 2, 0, 'slate', 'slate', 4);
  rect(o, -21.5, 0, -48.5, 12, 22, 6);
  for (const x of [-27, -16])
    cylinder(
      o,
      x,
      -47.5,
      [
        [0, 2.8],
        [23.1, 2.8],
      ],
      0,
      'wall',
      'limestone',
      6,
    );
  rect(o, -21.7, 0, -76.4, 16.2, 50, 16.2);
  for (const x of [-28.4, -15])
    for (const z of [-83.1, -69.9])
      cylinder(
        o,
        x,
        z,
        [
          [0, 3.3],
          [50, 3.3],
        ],
        0,
        'wall',
        'limestone',
        6,
      );
  cylinder(
    o,
    -26.5,
    -81.4,
    [
      [50, 1.5],
      [53.2, 1.5],
    ],
    0,
    'wall',
    'limestone',
    4,
  );
  cylinder(
    o,
    -22,
    -76,
    [
      [50, 0.29],
      [59, 0.29],
    ],
    0,
    'white',
    'foliage',
    4,
  );
  for (let i = 0; i < 3; i++) {
    const x = -22 + i * 1.2,
      p = [
        [x, 55.5, -76],
        [x + 1.2, 55.5, -76],
        [x + 1.2, 58, -76],
        [x, 58, -76],
      ];
    face(o, p, ['blue', 'white', 'red'][i], 'foliage');
    face(o, [...p].reverse(), ['blue', 'white', 'red'][i], 'foliage');
  }
  const q = local(o, -45.5, 36.5, 0.105);
  rect(q, 0, 0, 16, 15, 23.2, 32);
  hip(local(q, 0, 16, Math.PI / 2), 0, 0, 34, 15.6, 23.2, 32.6);
  const apse = [
    [-7.5, 32],
    [-6.1, 37],
    [-2.5, 40.8],
    [2.5, 40.8],
    [6.1, 37],
    [7.5, 32],
  ];
  for (let i = 1; i < apse.length; i++)
    face(
      q,
      [
        [0, 32.6, 32],
        [apse[i - 1][0], 23.2, apse[i - 1][1]],
        [apse[i][0], 23.2, apse[i][1]],
      ],
      'slate',
      'slate',
      true,
    );
  shell(
    q,
    [
      [-7.5, 32],
      [-6.1, 37],
      [-2.5, 40.8],
      [2.5, 40.8],
      [6.1, 37],
      [7.5, 32],
    ],
    [],
    0,
    23.2,
  );
  for (const x of [-8, 8]) {
    rect(q, x, 0, 0.5, 2, 25, 1.2);
    cone(q, x, 0.5, 25, 32.6, 0.9, 0, 'trim', 'limestone', 4);
  }
  rect(q, 11.3, 0, 31.4, 7.6, 12, 11);
}
export function buildVincennesRuntime(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  if (!d) {
    skyline(o);
    return;
  }
  compound(o, d === 1 ? 0 : d);
  keepEnclosure(o, d === 1 ? 0 : d);
  keep(o, d);
  chapel(o, d);
  if (d === 1) {
    // Coarse facade rhythms carry through the district transition without tiny frames.
    for (const z of [-55.4, 95.3])
      for (const side of [-1, 1]) {
        for (let u = -39; u < 40; u += 7.1) {
          const f = local(
            o,
            -122.5 + u,
            z + side * (Math.abs(u) > 25 ? 13.5 : 12.5),
            side > 0 ? 0 : Math.PI,
          );
          for (const y of [3, 10]) panel(f, 0, y, 0.04, 2.8, 4);
        }
      }
    for (const i of [3, 7, 8]) windows(o, frame.components.parts[i].rings[0], [[2, 2.6]], 1, 7);
  }
}
export const buildVincennesSkyline = (o) =>
  buildVincennesRuntime(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            s,
            r,
            p,
            n,
            uv,
            c.map((v) => v * (['glass', 'foliage'].includes(s) ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const vincennesStudy = {
  id: 'N0265',
  key: 'chateau_de_vincennes',
  title: 'Château de Vincennes',
  category: 'castle',
  wikidataId: 'Q663673',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildVincennesRuntime(o),
  brief:
    'Present-day Vincennes compound: round-cornered tall keep and covered chemise, Gothic Sainte-Chapelle, Tour du Village, reduced enceinte towers, paired royal pavilions and open courts.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: vincennesPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Tall four-turret keep and separate covered chemise',
      'Sainte-Chapelle with west rose, pointed bays and buttresses',
      'Tour du Village and broad enclosure with paired slate-roofed royal pavilions',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/23032971 exact Wikidata Q663673',
    buildingPlans: 'IGN BD TOPO V3; 14 component features retained with stable CLEABS identifiers',
    keepPublishedHeightMeters: 50,
    keepSquareCoreMeters: 16.2,
    keepWallThicknessMeters: 3.25,
    chapelInteriorMeters: [40, 12, 20],
    ignHeightMeters: { keep: 50.1, chapel: 32.6, villageTower: 42 },
  },
  reconstruction: {
    basis:
      'Attributed OSM compound and IGN component footprints; CMN visitor plan and current official photographs',
    scope:
      'Present-day exterior compound, covered keep enclosure, chapel, royal pavilions and ancillary ranges; terrain, gardens, buried manor remains and interiors excluded',
    referenceState:
      'Reduced perimeter towers and uncrenellated present keep parapets; no reconstruction of vanished medieval towers',
  },
  scaleBasis:
    'IGN plan precision for keep 3m and height precision 2.5m. Main keep height uses CMN 50m. Compound height fields are not treated as uniform roofs. Moat -6m, flag 59m, pavilions, window rhythms and smaller roofs are reconstructed. Court Y=0; actual stepped ground requires geographic review.',
  refs: [
    'https://www.chateau-de-vincennes.fr/en/discover/una-fortaleza-real',
    'https://www.chateau-de-vincennes.fr/enseignants/mediatheque-espace-enseignant/fiche-de-visite',
    'https://www.chateau-de-vincennes.fr/en/discover/history-of-the-chateau-de-vincennes',
    'https://www.openstreetmap.org/way/23032971',
    'https://www.data.gouv.fr/datasets/bd-topo-r',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original reconstruction under repository license. OSM identity/frame © OpenStreetMap contributors ODbL-1.0. Component plan geometry © IGN BD TOPO, Licence Ouverte 2.0. Research photos/plans linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0; © IGN BD TOPO, Licence Ouverte 2.0, retrieved 2026-10-07. Official CMN references are linked evidence only.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X north toward Tour du Village',
    front: '+Z east across the main court',
    origin: 'OSM compound center; court Y=0, moat wall bases Y=-6m',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Signed map frame and IGN parts; terrain/moat and entrance contact pending',
  }),
  geographicNote:
    'The outer OSM polygon includes the grounds and moat. IGN components locate the keep, chapel, gate and pavilions separately. Court Y=0 and moat walls -6m require real-site terrain review. No full-footprint replacement while inactive.',
  limitations: [
    'IGN aggregate shapes require reconstructed partitions and roof heights; individual windows, porticoes and turrets are simplified.',
    'Exterior-only reconstruction; glass is opaque PBR and no public interiors are implied.',
    'Moat depth, real terrain seating, camera-motion shimmer and physical-device performance remain unmeasured.',
  ],
  importReason:
    'Retain the spatially separated keep, chapel and royal court with distinct silhouettes and inexpensive shared materials.',
  mediumFiContext: { scale: '3.8', neighborStyle: 'molen.worldgen.catalog.paris_mansard' },
  camera: { position: [290, 225, 420], lookAt: [0, 15, 0], fov: 43 },
  qaCameras: [
    { name: 'keep-and-chatelet', position: [22, 31, 19], lookAt: [-21, 24, -73] },
    { name: 'chapel-west-rose', position: [-52, 20, -28], lookAt: [-43, 17, 50] },
    { name: 'royal-court', position: [-20, 60, 20], lookAt: [-128, 10, 20] },
    { name: 'tour-du-village', position: [235, 22, 22], lookAt: [168, 19, 18] },
    { name: 'compound-plan', position: [0, 580, 0], lookAt: [0, 0, 0] },
    { name: 'keep-west-and-covered-walk', position: [-75, 33, -150], lookAt: [-21, 22, -79] },
  ],
};
