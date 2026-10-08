/** Vaduz's present exterior: mapped open courts, two different roundels and a square keep. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u0q/n0269_vaduz_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const vaduzPalette = {
  wall: '#e7e1d3',
  trim: '#f0e8d7',
  stone: '#b7b1a5',
  paving: '#b2ad9f',
  tile: '#80664f',
  wood: '#947355',
  red: '#a24547',
  white: '#eee6d9',
  glass: '#4d6178',
  door: '#765d49',
};
const colors = Object.fromEntries(
  Object.entries(vaduzPalette).map(([k, hex]) => [
    k,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const rect = (o, x, y, z, w, h, d, col = 'wall', slot = 'plaster') =>
  box(o, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[col]);
const rectangle = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x - w / 2, z + d / 2],
  [x + w / 2, z + d / 2],
  [x + w / 2, z - d / 2],
];
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
function face(o, p, col = 'wall', slot = 'plaster', up = false) {
  if (up && normalFor(...p.slice(0, 3))[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    // Meter-scaled planar UVs; the shared graph supplies its own physical repeat.
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
function ring(p, positive = false) {
  const r = p.slice();
  if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  const area = r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area > 0 !== positive) r.reverse();
  return r;
}
function slab(o, rings, y, col = 'paving', slot = 'limestone') {
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
      col,
      slot,
      true,
    );
}
function shell(o, outer, holes, base, top, col = 'wall', slot = 'plaster') {
  const rs = [ring(outer), ...holes.map((p) => ring(p, true))];
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
        col,
        slot,
      );
    }
  slab(o, rs, top, col, slot);
}
function panel(o, x, y, z, w, h, col = 'glass', slot = 'glass') {
  face(
    o,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    col,
    slot,
  );
}
function windows(o, p, rows, d, spacing = 6) {
  if (!d) return;
  const r = ring(p);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 5) continue;
    const q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0])),
      n = Math.floor(len / spacing) || 1;
    for (let j = 0; j < n; j++)
      for (const [y, h] of rows) {
        const x = ((j + 0.5) * len) / n,
          w = Math.min(1.8, (len / n) * 0.35);
        if (d >= 2) panel(q, x, y - 0.25, 0.055, w + 0.5, h + 0.5, 'trim', 'plaster');
        panel(q, x, y, 0.09, w, h);
        if (d === 3 && h >= 3) panel(q, x, y + h * 0.55, 0.12, w, 0.45, 'trim', 'plaster');
      }
  }
}
function hip(o, x, z, w, depth, eave, ridge) {
  const p = rectangle(x, z, w, depth).map(([u, v]) => [u, eave, v]);
  const inset = Math.min(w * 0.2, depth * 0.45),
    a = [x - w / 2 + inset, ridge, z],
    b = [x + w / 2 - inset, ridge, z];
  for (const f of [
    [p[0], p[1], a],
    [p[1], p[2], b, a],
    [p[2], p[3], b],
    [p[3], p[0], a, b],
  ])
    face(o, f, 'tile', 'tile', true);
}
function gable(o, x, z, w, depth, eave, ridge) {
  for (const side of [-1, 1])
    face(
      o,
      [
        [x + (side * w) / 2, eave, z - depth / 2],
        [x + (side * w) / 2, eave, z + depth / 2],
        [x, ridge, z + depth / 2],
        [x, ridge, z - depth / 2],
      ],
      'tile',
      'tile',
      true,
    );
  face(o, [
    [x + w / 2, eave, z - depth / 2],
    [x - w / 2, eave, z - depth / 2],
    [x, ridge, z - depth / 2],
  ]);
  face(o, [
    [x - w / 2, eave, z + depth / 2],
    [x + w / 2, eave, z + depth / 2],
    [x, ridge, z + depth / 2],
  ]);
}
function cylinder(o, x, z, rs, d, col = 'wall', slot = 'plaster', n) {
  loft(
    o,
    slot,
    rs.map(([y, r]) => radialRing(y, r, r, n ?? [6, 10, 14, 18][d], [x, z])),
    colors[col],
  );
}
function cone(o, x, z, base, top, r, d, col = 'tile', slot = 'tile', n) {
  cylinder(
    o,
    x,
    z,
    [
      [base, r],
      [top, 0.08],
    ],
    d,
    col,
    slot,
    n,
  );
}
function wall(o, a, b, base, top, thick = 2, col = 'wall', slot = 'plaster') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  rect(q, 0, base, 0, len, top - base, thick, col, slot);
}
function pathWall(o, points, base, top, thick, col = 'wall', slot = 'plaster') {
  for (let i = 1; i < points.length; i++)
    wall(o, points[i - 1], points[i], base, top, thick, col, slot);
}
function archway(o, x, y, z, w, h, fullWidth, top, depth, d, col = 'wall', slot = 'plaster') {
  rect(o, x - (fullWidth + w) / 4, y, z, (fullWidth - w) / 2, top - y, depth, col, slot);
  rect(o, x + (fullWidth + w) / 4, y, z, (fullWidth - w) / 2, top - y, depth, col, slot);
  const n = d ? 6 : 2,
    r = w / 2,
    cy = y + h - r;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      p = [x + r * Math.cos(a), cy + r * Math.sin(a)],
      q = [x + r * Math.cos(b), cy + r * Math.sin(b)];
    face(
      o,
      [
        [q[0], q[1], z + depth / 2],
        [p[0], p[1], z + depth / 2],
        [p[0], top, z + depth / 2],
        [q[0], top, z + depth / 2],
      ],
      col,
      slot,
    );
    face(
      o,
      [
        [p[0], p[1], z - depth / 2],
        [q[0], q[1], z - depth / 2],
        [q[0], top, z - depth / 2],
        [p[0], top, z - depth / 2],
      ],
      col,
      slot,
    );
    face(
      o,
      [
        [q[0], q[1], z - depth / 2],
        [p[0], p[1], z - depth / 2],
        [p[0], p[1], z + depth / 2],
        [q[0], q[1], z + depth / 2],
      ],
      col,
      slot,
    );
  }
  face(
    o,
    [
      [x - fullWidth / 2, top, z - depth / 2],
      [x - fullWidth / 2, top, z + depth / 2],
      [x + fullWidth / 2, top, z + depth / 2],
      [x + fullWidth / 2, top, z - depth / 2],
    ],
    col,
    slot,
    true,
  );
}
function pyramid(o, x, z, w, depth, base, top) {
  const p = rectangle(x, z, w, depth).map(([u, v]) => [u, base, v]);
  for (let i = 0; i < 4; i++) face(o, [p[i], p[(i + 1) % 4], [x, top, z]], 'tile', 'tile', true);
}
function shutter(o, x, y, z, w, h, d) {
  panel(o, x, y, z, w, h, 'red', 'wood');
  if (d < 2) return;
  // Broad painted saltire; two flat strips, not a fine frame around every pane.
  for (const sign of [-1, 1]) {
    const ax = x - w * 0.4,
      bx = x + w * 0.4,
      ay = y + (sign > 0 ? 0.15 : h - 0.15),
      by = y + (sign > 0 ? h - 0.15 : 0.15),
      len = Math.hypot(bx - ax, by - ay),
      dx = (-(by - ay) / len) * 0.085,
      dy = ((bx - ax) / len) * 0.085;
    face(
      o,
      [
        [ax - dx, ay - dy, z + 0.018],
        [bx - dx, by - dy, z + 0.018],
        [bx + dx, by + dy, z + 0.018],
        [ax + dx, ay + dy, z + 0.018],
      ],
      'white',
      'wood',
    );
  }
}
function residentialWindows(o, p, rows, d, spacing = 4.3) {
  if (!d) return;
  const r = ring(p);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3.4) continue;
    const q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0])),
      n = Math.max(1, Math.floor(len / spacing));
    for (let j = 0; j < n; j++)
      for (const [y, h] of rows) {
        const x = ((j + 0.5) * len) / n,
          w = Math.min(1.15, (len / n) * 0.27);
        if (d >= 2) panel(q, x, y - 0.16, 0.055, w + 0.32, h + 0.32, 'trim', 'plaster');
        panel(q, x, y, 0.085, w, h);
        for (const sign of [-1, 1]) shutter(q, x + sign * (w / 2 + 0.29), y, 0.09, 0.5, h, d);
        if (d === 3 && h > 1.3) {
          panel(q, x, y + h * 0.5, 0.12, w, 0.16, 'trim', 'plaster');
          panel(q, x, y, 0.12, 0.16, h, 'trim', 'plaster');
        }
      }
  }
}
function keep(o, d) {
  const x = -6.8,
    z = 13.3,
    w = 12.3,
    depth = 12.9;
  rect(o, x, 0, z, w, 23, depth, 'stone', 'limestone');
  // Under the present roof, widely spaced upper openings preserve the old crenellated crown.
  if (!d) rect(o, x, 23, z, w, 2.1, depth, 'wall', 'limestone');
  else {
    rect(o, x, 22.7, z, w + 0.5, 0.8, depth + 0.5, 'stone', 'limestone');
    for (const side of [-1, 1]) {
      for (const u of [-4.6, -1.55, 1.55, 4.6])
        rect(o, x + u, 23.5, z + side * (depth / 2 - 0.4), 1.6, 1.7, 1, 'stone', 'limestone');
      for (const v of [-4.85, -1.62, 1.62, 4.85])
        rect(o, x + side * (w / 2 - 0.4), 23.5, z + v, 1, 1.7, 1.7, 'stone', 'limestone');
    }
    rect(o, x, 24.95, z, w + 0.8, 0.25, depth + 0.8, 'wood', 'wood');
    windows(
      o,
      rectangle(x, z, w, depth),
      [
        [12.5, 1.5],
        [18.2, 1.35],
      ],
      1,
      8,
    );
    if (d >= 2) {
      for (const side of [-1, 1])
        for (const u of [-4.6, -1.55, 1.55, 4.6])
          rect(o, x + u, 22.3, z + side * (depth / 2 + 0.16), 0.7, 0.6, 0.65, 'stone', 'limestone');
      // Large cornerstone accents carry the rough stone character without individual block geometry.
      for (const y of [5, 9, 13, 17, 21])
        for (const u of [-1, 1])
          for (const v of [-1, 1])
            rect(
              o,
              x + u * (w / 2 - 0.42),
              y,
              z + v * (depth / 2 - 0.42),
              0.9,
              0.45,
              0.9,
              'trim',
              'limestone',
            );
    }
  }
  pyramid(o, x, z, w + 1.6, depth + 1.6, 25.2, 30);
}
function southRoundel(o, d) {
  const x = -26.7,
    z = 15.1,
    n = [8, 12, 18, 24][d];
  cylinder(
    o,
    x,
    z,
    [
      [0, 10.3],
      [4.5, 11.1],
      [12, 11.1],
    ],
    d,
    'stone',
    'limestone',
    n,
  );
  cylinder(
    o,
    x,
    z,
    [
      [12, 11.1],
      [17, 11.1],
    ],
    d,
    'wall',
    'plaster',
    n,
  );
  cylinder(
    o,
    x,
    z,
    [
      [17, 11.8],
      [20, 11.8],
    ],
    d,
    'wood',
    'wood',
    n,
  );
  cone(o, x, z, 20, 24.3, 12.4, d, 'tile', 'tile', n);
  if (d)
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / n,
        q = local(o, x + 11.12 * Math.sin(a), z + 11.12 * Math.cos(a), a);
      panel(q, 0, 13.1, 0.04, 1.3, 2.1);
      for (const side of [-1, 1]) shutter(q, side * 0.99, 13.1, 0.06, 0.55, 2.1, d);
      if (d >= 2) {
        const timber = local(o, x + 11.83 * Math.sin(a), z + 11.83 * Math.cos(a), a);
        panel(timber, 0, 17.4, 0.04, 0.8, 1.45, 'door', 'glass');
        // The hoarding's vertical rhythm is coarse and merged into the common wood group.
        for (const u of [-0.8, 0.8]) rect(timber, u, 17.1, 0.05, 0.18, 2.7, 0.18, 'wood', 'wood');
      }
    }
}
function northRoundel(o, d) {
  const x = 23.2,
    z = 11.9,
    n = [8, 12, 18, 24][d];
  const outer = radialRing(0, 14.4, 14.4, n, [x, z]).map((p) => [p[0], p[2]]);
  const inner = frame.geometry.holes[1];
  shell(o, outer, [inner], 0, 13.1, 'stone', 'limestone');
  slab(o, [inner], 4.5);
  // Annular hipped roof leaves the historical gun platform open, unlike the southern cone.
  const loops = [
    [13.1, 14.8],
    [16.2, 9],
    [14.3, 5.4],
  ].map(([y, r]) => radialRing(y, r, r, n, [x, z]));
  for (let j = 1; j < loops.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(o, [loops[j - 1][i], loops[j - 1][k], loops[j][k], loops[j][i]], 'tile', 'tile', true);
    }
  if (d) {
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / n,
        q = local(o, x + 14.41 * Math.sin(a), z + 14.41 * Math.cos(a), a);
      panel(q, 0, 8.3, 0.04, 0.7, 1.4);
      if (d >= 2) panel(q, 0, 3.2, 0.04, 0.55, 1.1);
    }
    // A short timber wall sits below the courtyard edge of the annular roof.
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      wall(
        o,
        [x + 5.4 * Math.cos(a), z + 5.4 * Math.sin(a)],
        [x + 5.4 * Math.cos(b), z + 5.4 * Math.sin(b)],
        12.5,
        14.3,
        0.45,
        'wood',
        'wood',
      );
    }
  }
}
function gabledWing(o, x, z, w, depth, base, eave, ridge, d, a = 0) {
  const q = local(o, x, z, a);
  rect(q, 0, base, 0, w, eave - base, depth);
  gable(q, 0, 0, w + 0.5, depth + 0.65, eave, ridge);
  residentialWindows(
    q,
    rectangle(0, 0, w, depth),
    [
      [base + 2, 1.65],
      [base + 6, 1.65],
      [eave - 2.8, 1.4],
    ],
    d,
    4.5,
  );
  if (d)
    for (const side of [-1, 1]) {
      const f = local(q, 0, side * (depth / 2 + 0.35), side < 0 ? Math.PI : 0);
      panel(f, 0, eave + 1, 0.025, 0.85, 1.5);
      if (d >= 2) panel(f, 0, eave + 0.85, 0.012, 1.15, 1.85, 'trim', 'plaster');
      if (d >= 2) panel(f, 0, eave + 1, 0.04, 0.85, 1.5);
    }
}
function residences(o, d) {
  // Western valley facade: two transverse gabled wings joined by a long dormered range.
  gabledWing(o, 18.6, -9.5, 12.4, 22.5, 0, 18.2, 23.3, d, 0.06);
  gabledWing(o, -20.2, -8.4, 10.3, 23, 0, 18.8, 23.7, d, -0.015);
  const p = [
    [-15.2, -15.5],
    [-15, -4.5],
    [12.5, -3.1],
    [13.3, -12.5],
    [5.2, -14.1],
  ];
  shell(o, p, [], 0, 18.8);
  // Main ridge follows the long north-south axis; crossed roofs distinguish the end wings.
  const bar = local(o, -1.1, -9.3, Math.PI / 2);
  gable(bar, 0, 0, 12.2, 28.5, 18.8, 23.2);
  residentialWindows(
    o,
    p,
    [
      [6.2, 1.7],
      [10.8, 1.7],
      [15.5, 1.6],
    ],
    d,
    4.4,
  );
  if (d >= 2)
    for (const x of [-10.5, -4, 2.5, 9]) {
      const q = local(o, x, -12.8, Math.PI);
      rect(q, 0, 20, 0, 1.8, 1.8, 2.1);
      gable(q, 0, 0, 2.2, 2.5, 21.8, 23.1);
      panel(q, 0, 20.4, 1.1, 1.1, 1.15);
    }
  // East residential/service range runs between the keep and the northern roundel.
  const ep = [
    [0.2, 7],
    [9, 3.9],
    [11.2, 6.1],
    [13.7, 17.1],
    [-0.5, 18.8],
  ];
  shell(o, ep, [], 4.5, 14.3);
  hip(local(o, 6.3, 11.6, -0.12), 0, 0, 15, 12, 14.3, 18.6);
  residentialWindows(
    o,
    ep,
    [
      [7, 1.6],
      [11.4, 1.5],
    ],
    d,
    4.6,
  );
  // North court wing sits between the roundel and the western residence.
  const np = [
    [11, -6],
    [17, -6.2],
    [23.8, 6.2],
    [18.1, 11.3],
    [12.4, 3.4],
    [10.4, 5.6],
    [8.6, 3.3],
  ];
  shell(o, np, [], 4.5, 16);
  hip(local(o, 17, 1.2, Math.PI / 2 - 0.2), 0, 0, 18, 8.3, 16, 20.8);
  windows(
    o,
    np,
    [
      [8, 1.6],
      [12.4, 1.5],
    ],
    d,
    4.5,
  );
  // St.Anna chapel occupies the south range; it is not a separate tall church.
  const sp = [
    [-25.1, -4.5],
    [-25.1, 4.4],
    [-14.6, 5.9],
    [-14.6, -2.1],
    [-15.7, -4.5],
  ];
  shell(o, sp, [], 4.5, 15.4);
  hip(o, -20, 0.3, 11, 10.5, 15.4, 20.6);
  if (d)
    for (const x of [-23, -19, -16]) {
      const q = local(o, x, 5.8, 0);
      const p = [
        [-0.65, 7, 0.03],
        [0.65, 7, 0.03],
        [0.65, 10.5, 0.03],
        [0, 11.5, 0.03],
        [-0.65, 10.5, 0.03],
      ];
      face(q, p, 'glass', 'glass');
    }
  // Small southeast stair tower carries a pointed tile roof in current photographs.
  rect(o, -18.1, 4.5, 6.8, 3.2, 17, 3.8, 'stone', 'limestone');
  pyramid(o, -18.1, 6.8, 4.3, 4.9, 21.5, 25.6);
  if (d) windows(o, rectangle(-18.1, 6.8, 3.2, 3.8), [[17.6, 1.8]], 1, 3.5);
  if (d === 3) {
    for (const [x, z, y] of [
      [15, -7, 22],
      [-21, -7, 22],
      [-7, -8, 22],
      [4, 11, 18],
    ])
      rect(o, x, y, z, 0.7, 2.4, 0.9, 'trim');
  }
}
function curtain(o, d) {
  const p = [
    [25, -21.5],
    [16, -26],
    [2, -28.5],
    [-16, -29],
    [-28, -24],
  ];
  pathWall(o, p, 0, 8.2, 1.5, 'stone', 'limestone');
  slab(o, [[...p, [-24, -19], [-16, -18], [0, -15], [14, -14], [25, -17]]], 4.5);
  if (d) {
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
      for (let x = 1; x < len - 0.5; x += 2.5)
        rect(q, x, 8.2, 0, 1.3, 1.1, 1.5, 'stone', 'limestone');
    }
  }
  for (const x of [-25, 23]) {
    const z = x < 0 ? -23.2 : -22.5;
    rect(o, x, 4.5, z, 3.6, 7.7, 3.6, 'wall', 'limestone');
    pyramid(o, x, z, 4.5, 4.5, 12.2, 15.4);
    if (d) windows(o, rectangle(x, z, 3.6, 3.6), [[9.7, 1.35]], 1, 3.5);
  }
  // Low tiled annex inside the northern west curtain, clear of the courtyard.
  rect(o, 15.5, 4.5, -21.5, 14, 3.8, 6.5);
  hip(o, 15.5, -21.5, 15, 7.2, 8.3, 11.2);
  windows(o, rectangle(15.5, -21.5, 14, 6.5), [[6, 1.2]], d, 3.3);
  // Southwest gate under the passage, using the mapped entrance notch.
  const gate = local(o, -28.4, -12.7, -0.35);
  archway(gate, 0, 4.5, 0, 2.5, 3.8, 6.2, 11.8, 4.2, d, 'stone', 'limestone');
  hip(gate, 0, 0, 7.1, 5.1, 11.8, 14.5);
  if (d) panel(gate, 0, 9.8, 2.14, 1.2, 1.3);
}
export function buildVaduzRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  // Mapped negative spaces stay open: core court, roundel and the entrance turn.
  shell(o, frame.geometry.outline, frame.geometry.holes, 0, 4.5, 'stone', 'limestone');
  slab(o, [frame.geometry.holes[0]], 4.5);
  keep(o, d);
  southRoundel(o, d);
  northRoundel(o, d);
  residences(o, d);
  curtain(o, d);
}
export const buildVaduzSkyline = (o) =>
  buildVaduzRuntime(
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
            c.map((v) => v * (s === 'glass' ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const vaduzStudy = {
  id: 'N0269',
  key: 'vaduz_castle',
  title: 'Vaduz Castle',
  category: 'castle',
  wikidataId: 'Q694782',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildVaduzRuntime(o),
  brief:
    'Present-day Vaduz Castle: square stone keep with pyramidal tile roof, roofed southern roundel with timber hoarding, open northern roundel, cream valley-facing residence and red/white shutters.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: vaduzPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Square rough-stone keep with wide pyramidal roof',
      'Covered south roundel and contrasting open annular-roof north roundel',
      'Cream crossed-gable residence, red/white shutters and low west curtain',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/1252853 exact Q694782',
    mappedHeightMeters: 30,
    mappedPlanMeters: [75.448, 52.756],
    northwestResidentialTowerDendroDate: 1287,
    southRoundelDate: 1523,
    northRoundelDate: '1528/29',
  },
  reconstruction: {
    basis:
      'OSM complete building multipolygon and current municipal/tourism photographs; architectural research model cross-checks internal arrangement',
    scope:
      'Current main compound, western curtain and immediate entry; no mountain, palace interiors, distant garden or ancillary estate buildings',
  },
  scaleBasis:
    'OSM 75.448×52.756m main building envelope and mapped30m height; outer west curtain extends beyond that building footprint. Roundels approximated from mapped lobes; wing divisions and elevations inferred from official photographs. Court4.5m is a proposed datum, not a terrain survey.',
  refs: [
    'https://www.vaduz.li/en/living-environment/living-building/listed-buildings/schloss-vaduz',
    'https://schloss-vaduz-erleben.li/en/',
    'https://historisches-lexikon.li/Vaduz_%28Schloss%29',
    'https://historisches-lexikon.li/Datei:Schloss_Vaduz_Modell_MA.jpg',
    'https://www.openstreetmap.org/relation/1252853',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original reconstruction under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0; research photographs linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. Official municipal/tourism images and the Amt für Kultur architectural research model used as references.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 4.5,
    notes:
      'Covered south/open north roundels resolve the signed axis; wing fit, outer curtain and4.5m court datum require real hillside review.',
    reviewStatus: 'Research frame only; terrain seating pending',
  }),
  geographicNote:
    'Mapped complete compound establishes anchor and axis. Internal reconstructions and lower foundation skirts require actual terrain review before activation.',
  limitations: [
    'Simplified present exterior; internal wing dimensions and most heights inferred, not surveyed.',
    'No interiors, mountain mesh, private textures or distant estate grounds.',
    'Actual hillside seating, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve the asymmetric pair of roundels, square keep, valley residences and open core court through all four levels.',
  mediumFiContext: { scale: '1.2', neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  camera: { position: [105, 75, -110], lookAt: [0, 11, 0], fov: 43 },
  qaCameras: [
    { name: 'west-valley-front', position: [5, 45, -115], lookAt: [0, 13, 0] },
    { name: 'north-open-roundel', position: [110, 46, 2], lookAt: [5, 12, 1] },
    { name: 'south-covered-roundel', position: [-108, 44, -8], lookAt: [-10, 13, 3] },
    { name: 'east-keep-and-roundels', position: [5, 54, 112], lookAt: [-1, 13, 7] },
    { name: 'inner-court', position: [7, 10, 0.5], lookAt: [-13, 13, -3] },
    { name: 'compound-plan', position: [0, 155, 1], lookAt: [0, 4.5, 0] },
  ],
};
