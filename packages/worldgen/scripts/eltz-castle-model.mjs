/** Eltz: individually reconstructed family houses around an open court, in the mapped frame. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u0v/n0266_eltz_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const eltzPalette = {
  wall: '#c8bca6',
  warm: '#d7c6a3',
  trim: '#efe6cf',
  plaster: '#eee7d8',
  slate: '#626b74',
  glass: '#4d6178',
  paving: '#b6b0a1',
  timber: '#9f4238',
  door: '#86644c',
};
const colors = Object.fromEntries(
  Object.entries(eltzPalette).map(([key, hex]) => [
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
const rect = (o, x, y, z, w, h, d, color = 'wall', slot = 'sandstone') =>
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
function face(o, p, color = 'wall', slot = 'sandstone', up = false) {
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
function slab(o, rings, y, color = 'paving', slot = 'sandstone') {
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
function shell(o, outer, holes, base, top, color = 'wall', slot = 'sandstone') {
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
  if (d >= 2) draw(o, x, y - 0.14, z, w + 0.28, h + 0.28, 'trim', 'sandstone');
  draw(o, x, y, z + 0.03, w, h, 'glass', 'glass');
  if (d >= 2 && !arched)
    for (const side of [-1, 1])
      panel(o, x + side * w * 0.79, y, z + 0.05, w * 0.48, h, 'timber', 'wood');
  if (d === 3 && w >= 1.5) panel(o, x, y + h * 0.55, z + 0.07, w, 0.18, 'trim', 'sandstone');
}
function windows(o, p, rows, d, spacing = 3.5, arched = false) {
  if (!d) return;
  const r = ring(p);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3.6) continue;
    const n = Math.max(1, Math.floor(len / spacing)),
      q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
    for (let j = 0; j < n; j++)
      for (const [y, h] of rows)
        window(q, ((j + 0.5) * len) / n, y, 0.08, Math.min(1.25, (len / n) * 0.4), h, d, arched);
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
function cylinder(o, x, z, radii, d, color = 'wall', slot = 'sandstone', n) {
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
    'sandstone',
    true,
  );
}

const P = frame.geometry.outline;
// Part boundaries are a reconstruction of the owner's numbered plan within the OSM shell.
const houses = [
  {
    name: 'Platt-Eltz',
    p: [P[24], P[25], P[26], [-15, -16], P[18], P[19], P[20], P[23]],
    e: 18.5,
    r: 26,
    color: 'warm',
    a: [-27, -9],
    b: [-20, -9],
  },
  {
    name: 'Rübenach',
    p: [[-6.4, -15.2], P[32], P[14], P[15], P[16]],
    e: 18.7,
    r: 26,
    color: 'wall',
    a: [-2, -9.5],
    b: [10, -8],
  },
  {
    name: 'Gross Rodendorf',
    p: [
      P[32],
      P[33],
      P[34],
      P[35],
      P[36],
      P[37],
      P[38],
      P[0],
      P[1],
      P[2],
      P[3],
      [20, 10],
      [15, 2],
      P[14],
    ],
    e: 20.3,
    r: 27,
    color: 'wall',
    a: [21, -8],
    b: [25, 1],
  },
  {
    name: 'Rodendorf middle',
    p: [[15, 2], [20, 10], P[4], P[5], [7.9, 6.58], P[12], P[13]],
    e: 18.5,
    r: 25.5,
    color: 'wall',
    a: [14, 6],
    b: [16, 10],
  },
  {
    name: 'Klein Rodendorf',
    p: [P[5], [0, 16.42], [0, 6.54], P[12]],
    e: 17.5,
    r: 24,
    color: 'wall',
    a: [3, 10.8],
    b: [6, 10.8],
  },
  {
    name: 'Kempenich northeast',
    p: [[0, 6.54], [0, 16.42], P[6], [-10.9, 6.6]],
    e: 19.4,
    r: 27.5,
    color: 'wall',
    a: [-8, 11.5],
    b: [-2, 11.5],
  },
  {
    name: 'Kempenich southeast',
    p: [P[6], P[7], P[8], [-18, 1.4], [-10.9, 2.3]],
    e: 18.2,
    r: 25.2,
    color: 'wall',
    a: [-20, 7.6],
    b: [-14, 7.6],
  },
  {
    name: 'Kempenich court stair',
    p: [[-18, 1.4], P[9], P[10], P[11], [-10.9, 6.6], [-10.9, 2.3]],
    e: 17,
    r: 23.8,
    color: 'warm',
    a: [-13, 2.2],
    b: [-9, 2.2],
  },
];
function roof(o, p, eave, top, a, b) {
  const r = ring(p),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    cx = (a[0] + b[0]) / 2,
    cz = (a[1] + b[1]) / 2;
  const choose = (v) => ((v[0] - cx) * dx + (v[1] - cz) * dz < 0 ? a : b);
  for (let i = 0; i < r.length; i++) {
    const u = r[i],
      v = r[(i + 1) % r.length],
      ra = choose(u),
      rb = choose(v);
    const points = [
      [u[0], eave, u[1]],
      [v[0], eave, v[1]],
      [rb[0], top, rb[1]],
    ];
    if (ra !== rb) points.push([ra[0], top, ra[1]]);
    face(o, points, 'slate', 'slate', true);
  }
}
function stripe(o, a, b, width = 0.19) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    u = (-dy * width) / len / 2,
    v = (dx * width) / len / 2;
  face(
    o,
    [
      [a[0] + u, a[1] + v, a[2]],
      [a[0] - u, a[1] - v, a[2]],
      [b[0] - u, b[1] - v, b[2]],
      [b[0] + u, b[1] + v, b[2]],
    ],
    'timber',
    'wood',
  );
}
function timberWall(o, width, base, top, d) {
  panel(o, 0, base, 0.03, width, top - base, 'plaster', 'plaster');
  if (!d) return;
  const n = Math.max(1, Math.round(width / 2.4)),
    floors = Math.max(1, Math.round((top - base) / 2.8));
  for (let j = 0; j <= floors; j++)
    panel(o, 0, base + (j * (top - base)) / floors - 0.1, 0.07, width, 0.2, 'timber', 'wood');
  for (let i = 0; i <= n; i++)
    panel(o, -width / 2 + (i * width) / n, base, 0.07, 0.2, top - base, 'timber', 'wood');
  if (d >= 2)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < floors; j++) {
        const x = -width / 2 + (i * width) / n,
          y = base + (j * (top - base)) / floors,
          h = (top - base) / floors;
        if (j === floors - 1)
          panel(
            o,
            x + width / n / 2,
            y + 0.7,
            0.1,
            Math.min(0.8, (width / n) * 0.5),
            Math.min(1.2, h - 1),
            'glass',
            'glass',
          );
        else {
          stripe(o, [x, y, 0.11], [x + width / n, y + h, 0.11]);
          if (d === 3) stripe(o, [x + width / n, y, 0.115], [x, y + h, 0.115]);
        }
      }
}
function turret(o, x, z, base, eave, top, r, d, painted = true) {
  const p = ring(
    Array.from({ length: d ? 8 : 6 }, (_, i) => [
      x + r * Math.cos((i * Math.PI * 2) / (d ? 8 : 6)),
      z + r * Math.sin((i * Math.PI * 2) / (d ? 8 : 6)),
    ]),
  );
  shell(o, p, [], base, eave, painted ? 'plaster' : 'warm', painted ? 'plaster' : 'sandstone');
  cone(o, x, z, eave, top, r * 1.15, d, 'slate', 'slate', d ? 8 : 6);
  if (!d) return;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0])),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (painted) timberWall(q, len, base, eave, d);
    else if (i % 2 === 0) panel(q, 0, base + 0.8, 0.08, 0.6, 1.5);
  }
}
function dormer(o, x, y, z, angle, d) {
  const q = local(o, x, z, angle);
  rect(q, 0, y, 0, 1.05, 1.2, 0.7, 'timber', 'wood');
  panel(q, 0, y + 0.18, 0.37, 0.68, 0.85);
  hip(q, 0, 0, 1.35, 1.05, y + 1.2, y + 2);
  if (d === 3) panel(q, 0, y + 0.08, 0.4, 1.25, 0.18, 'trim', 'sandstone');
}
function mainCastle(o, d) {
  // Lower walls follow the mapped main-building outline; there is no terrain rock mesh.
  shell(
    o,
    d
      ? P
      : [0, 2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 18, 20, 24, 26, 29, 32, 35, 38].map(
          (i) => P[i],
        ),
    [],
    -8,
    0,
    'wall',
  );
  slab(
    o,
    [
      [
        [-19, -1],
        [-6, -5.7],
        [12.7, -3.8],
        [13.6, 1.7],
        [9.1, 6.58],
        [-5.65, 6.52],
        [-5.2, 0.94],
        [-17, -0.65],
      ],
    ],
    0,
    'paving',
  );
  for (const h of houses) {
    shell(o, h.p, [], 0, h.name === 'Rübenach' ? 16.1 : h.e, h.color);
    roof(o, h.p, h.e, h.r, h.a, h.b);
    if (d)
      windows(
        o,
        h.p,
        h.name === 'Platt-Eltz'
          ? [
              [4.2, 1.1],
              [11.5, 1.25],
            ]
          : h.name.includes('Rodendorf')
            ? [
                [1.3, 1.15],
                [6.2, 1.6],
                [11.3, 1.7],
                [15.8, 1.05],
              ]
            : [
                [3.2, 1.55],
                [8, 1.7],
                [12.8, 1.6],
              ],
        d,
        h.name === 'Platt-Eltz' ? 8.5 : d === 1 ? 5.1 : 3.8,
      );
  }
  // Rübenach's white upper band and three projecting polygonal red-timber bays.
  const rub = houses[1];
  shell(o, rub.p, [], 16.1, 18.75, 'plaster', 'plaster');
  if (d) windows(o, rub.p, [[16.8, 0.75]], 1, 4.5);
  if (d >= 2) windows(o, P, [[-4.8, 1.4]], 1, 7.5);
  for (const [x, z, r] of [
    [-5.7, -5.7, 1.45],
    [6, -4.45, 1.55],
    [13, -4, 1.5],
    ...(d
      ? [
          [-5.9, -14.9, 1.35],
          [13.8, -12.5, 1.45],
        ]
      : []),
  ])
    turret(o, x, z, 18.6, 22.2, 26.2, r, d);
  // Gross Rodendorf, north face: timber oriels and the tall pale chimney stacks.
  for (const [x, z, r] of [
    [24.2, -10.1, 1.65],
    [31.3, -3.6, 1.65],
    [26, 6.7, 1.55],
  ])
    turret(o, x, z, 19.3, 23.1, 27.7, r, d);
  for (const [x, z, y] of [
    [20.5, -10, 20.3],
    [22.8, 3.9, 20.3],
    [-9.3, 10.1, 19.4],
    [-1.7, 13.5, 19.4],
  ]) {
    rect(o, x, y, z, 0.85, 28.5 - y, 1.05, 'trim', 'plaster');
    if (d) rect(o, x, 28.15, z, 1.05, 0.35, 1.25, 'trim', 'plaster');
  }
  // Platt-Eltz's ochre Romanesque tower and southwest timber corner bays.
  for (const [x, z] of [[-29.9, -8.7], [-16.5, -5.2], ...(d ? [[-22.5, -16.8]] : [])])
    turret(o, x, z, 17.8, 21.3, 25.5, 1.4, d);
  // Kempenich's east-facing timber gable projects from the southern family-house range.
  const k = local(o, -5.4, 16.3, 0);
  rect(k, 0, 11.5, 0, 8, 7.9, 2.1, 'plaster', 'plaster');
  const kfront = local(k, 0, 1.06, 0);
  timberWall(kfront, 8, 11.5, 19.4, d);
  face(
    kfront,
    [
      [-4, 19.4, 0.03],
      [4, 19.4, 0.03],
      [0, 27.5, 0.03],
    ],
    'plaster',
    'plaster',
  );
  face(
    k,
    [
      [-4, 19.4, -4.8],
      [0, 27.5, -4.8],
      [0, 27.5, 1.1],
      [-4, 19.4, 1.1],
    ],
    'slate',
    'slate',
    true,
  );
  face(
    k,
    [
      [4, 19.4, 1.1],
      [0, 27.5, 1.1],
      [0, 27.5, -4.8],
      [4, 19.4, -4.8],
    ],
    'slate',
    'slate',
    true,
  );
  if (d) {
    for (const y of [19.6, 22.2, 24.1, 26])
      panel(kfront, 0, y, 0.07, Math.max(1, (8 * (27.5 - y)) / 8.1), 0.2, 'timber', 'wood');
    stripe(kfront, [-4, 19.4, 0.09], [0, 27.5, 0.09], 0.22);
    stripe(kfront, [4, 19.4, 0.09], [0, 27.5, 0.09], 0.22);
    panel(kfront, 0, 19.4, 0.1, 0.22, 8, 'timber', 'wood');
  }
  // Courtyard stair towers, projecting chapel oriel and the supported rectangular Rübenach bay.
  if (d) {
    turret(o, -13.8, 0.8, 0, 15.9, 20.2, 1.6, d, false);
    turret(o, 11.5, 1.2, 0, 15.2, 19.8, 1.45, d, false);
  }
  if (d) {
    const q = local(o, 8.7, -3.45, 0);
    const p = [
      [-1.5, -0.5],
      [-1.5, 1],
      [-0.7, 1.7],
      [0.7, 1.7],
      [1.5, 1],
      [1.5, -0.5],
    ];
    shell(q, p, [], 5.1, 10.2, 'trim', 'sandstone');
    windows(q, p, [[6, 3.2]], d, 1.7, true);
    hip(q, 0, 0.4, 3.6, 3.1, 10.2, 12.4);
    rect(o, -1, 4.9, -4.4, 4.6, 4.2, 1.8, 'trim', 'sandstone');
    panel(o, -1, 5.6, -3.48, 3.8, 2.8);
    for (const x of [-2.5, 0.5])
      cylinder(
        o,
        x,
        -3.9,
        [
          [0, 0.23],
          [4.9, 0.23],
        ],
        d,
        'wall',
        'sandstone',
        8,
      );
    for (const [x, z, y, a] of [
      [-2, -13.8, 20.8, Math.PI],
      [7, -12.5, 20.8, Math.PI],
      [-1, -5.4, 20.8, 0],
      [7, -5.2, 20.8, 0],
      [28, -5, 22, Math.PI / 2],
      [27, 0, 22, Math.PI / 2],
      [-23, -14.8, 21.4, Math.PI],
      [-17, 11, 21, 0],
      [-6, 15.1, 22, 0],
      [4, 14.8, 19.4, 0],
    ])
      dormer(o, x, y, z, a, d);
  }
}
function nearBailey(o, d) {
  // Terrace south of Rübenach is open. It must not inherit a roof from the OSM outline.
  const terrace = [
    [-15.6, -16],
    [-6.4, -15.2],
    [-6.5, -8],
    [-15, -9.4],
  ];
  shell(o, terrace, [], 0, 2, 'wall');
  for (let i = 0; i < terrace.length; i++) {
    const a = terrace[i],
      b = terrace[(i + 1) % terrace.length];
    beam(o, 'sandstone', [a[0], 2.5, a[1]], [b[0], 2.5, b[1]], 0.65, 1, colors.wall);
  }
  // Two short southern terrace walls; no ground mesh or fabricated mountain.
  for (const [a, b] of [
    [
      [P[24][0], P[24][1]],
      [-34, 6],
    ],
    [
      [-34, 6],
      [-28, 13],
    ],
    [[-28, 13], P[7]],
  ])
    beam(o, 'sandstone', [a[0], -4, a[1]], [b[0], -4, b[1]], 1, 8, colors.wall);
  shell(
    o,
    [
      [29, -8],
      [44, -7],
      [53, -1],
      [75, -2],
      [75, 4],
      [49, 4],
      [30, 13],
    ],
    [],
    -8,
    -3,
    'wall',
  );
  for (const [a, b] of [
    [
      [29, -8],
      [44, -7],
    ],
    [
      [44, -7],
      [53, -1],
    ],
    [
      [53, -1],
      [70, -2],
    ],
    [
      [49, 4],
      [70, 4],
    ],
  ])
    beam(o, 'sandstone', [a[0], -4.1, a[1]], [b[0], -4.1, b[1]], 0.8, 6.6, colors.wall);
  const coach = local(o, 31, 21, 0.44);
  rect(coach, 0, -8, 0, 18, 10.6, 7.5);
  hip(coach, 0, 0, 18.6, 8.1, 2.6, 9.2);
  if (d) windows(coach, rectangle(0, 0, 18, 7.5), [[-2, 1.7]], d, 4.2);
  const gold = local(o, 56.4, -1.5, 0.09);
  rect(gold, 0, -8, 0, 8.2, 11, 6.5);
  hip(gold, 0, 0, 8.8, 7.1, 3, 10.8);
  if (d) turret(gold, -3.9, 3, 1.2, 5.8, 10.5, 1.45, d);
  if (d)
    windows(
      gold,
      rectangle(0, 0, 8.2, 6.5),
      [
        [-2, 1.4],
        [1.3, 1.4],
      ],
      d,
      3.6,
    );
  const craft = local(o, 40, -11.9, -0.12);
  rect(craft, 0, -8, 0, 8.8, 9.8, 6.4);
  hip(craft, 0, 0, 9.4, 7, 1.8, 7.2);
  if (d) windows(craft, rectangle(0, 0, 8.8, 6.4), [[-1.8, 1.5]], d, 3.8);
  // Open outer gate and a short approach bridge on the northern side.
  const gate = local(o, 74, 0.8, Math.PI / 2);
  archway(gate, 0, -3, 0, 3.3, 4.5, 1.9, 5.8, 4.2, d);
  hip(gate, 0, 0, 6.3, 2.6, 4.2, 6.8);
  rect(o, 80, d ? -3.65 : -8, 0.8, 10, d ? 0.65 : 5, 4.1, 'paving');
  if (d) for (const x of [76, 84]) rect(o, x, -8, 0.8, 1.2, 4.35, 4.1);
  for (const z of [-1.5, 3.1]) rect(o, 80, -3, z, 10, 0.9, 0.5);
  // Inner gate shelters a real opening between the north houses and Rübenach.
  const inner = local(o, 21, -15.6, Math.PI);
  archway(inner, 0, -2, 0, 2.2, 3.4, 2.8, 5, 4.9, d);
  hip(inner, 0, 0, 5.5, 3.4, 4.9, 7.9);
}
export function buildEltzRuntime(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  // Author in court coordinates, export with the lowest foundations at zero.
  const lifted = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) =>
        o[k](
          s,
          r,
          p.map(([x, y, z]) => [x, y + 8, z]),
          n,
          uv,
          c,
        ),
    ]),
  );
  mainCastle(lifted, d);
  nearBailey(lifted, d);
}
export const buildEltzSkyline = (o) =>
  buildEltzRuntime(
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
export const eltzStudy = {
  id: 'N0266',
  key: 'eltz_castle',
  title: 'Eltz Castle',
  category: 'castle',
  wikidataId: 'Q153426',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildEltzRuntime(o),
  brief:
    'Eight adjoining houses around a narrow open court, steep slate roofs, red-and-cream timber oriels, pale chimneys and the lower northern outer bailey.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: eltzPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Tall clustered family houses around an open courtyard',
      'Steep grey slate roofs, polygonal timber oriels and pale chimneys',
      'Ochre Platt-Eltz, white Rübenach upper band and projecting Kempenich timber gable',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/238981197 exact Wikidata Q153426',
    publishedResidentialTowers: 8,
    publishedMaximumTowerHeightMeters: 35,
    rockSpurHeightMeters: 60,
  },
  reconstruction: {
    basis:
      'Attributed OSM main-building outline plus owner numbered plan, scaled section and current photographs',
    scope:
      'Exterior main castle and immediate outer bailey; terrain, distant ruined outer ward and interiors excluded',
  },
  scaleBasis:
    'Mapped main footprint 65.003×35.497m; reconstructed house partitions, eaves and roofs. Exported foundation Y=0, inner court Y=8m, highest ridge35.5m and chimney36.5m. Roofs stand24–27.5m above court. Published35m tower height includes lower slope floors. Outbuildings manually aligned from owner plan; terrain seating pending.',
  refs: [
    'https://burg-eltz.de/en/the-castle',
    'https://burg-eltz.de/en/history',
    'https://burg-eltz.de/files/Unterschriften%20und%20anderes/kernburg_lageplan.pdf',
    'https://www.openstreetmap.org/way/238981197',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original reconstruction under repository license. OSM frame © OpenStreetMap contributors, ODbL-1.0. Owner research photographs/plans linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0; owner plan and photographs used as linked research evidence.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X north toward the outer gate',
    front: '+Z east',
    origin: 'OSM main-building center, lowest exterior foundations Y=0, inner court Y=8m',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 8,
    notes:
      'Owner plan resolves north-facing outer gate; reconstructed slope levels and outbuildings still need real-site terrain review.',
    reviewStatus: 'Signed frame and reconstructed compound; slope and entrance seating pending',
  }),
  geographicNote:
    'OSM main-building geometry does not contain the outer bailey. Additional outbuildings are reconstructed from the owner plan. No terrain is authored; the court and lower external walls require a real-site terrain review before activation.',
  limitations: [
    'Exterior only, with simplified window rhythms and timber patterns; no photos or unique textures.',
    'House boundaries, roof profiles, gate/outbuilding coordinates and height datums are reconstructed, not a survey.',
    'Real terrain contact, continuous-motion shimmer and physical-device performance are pending.',
  ],
  importReason:
    'Preserve Eltz-specific clustered houses, open courtyard, timber bays and contrasting slate roofs through every level.',
  mediumFiContext: { scale: '1.35', neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  camera: { position: [108, 60, -95], lookAt: [11, 18, 0], fov: 43 },
  qaCameras: [
    { name: 'north-gate-and-rodendorf', position: [95, 38, -22], lookAt: [19, 20, -1] },
    { name: 'east-kempenich', position: [-5, 38, 85], lookAt: [0, 19, 1] },
    { name: 'south-platteltz', position: [-82, 31, -11], lookAt: [-15, 20, 0] },
    { name: 'west-rubenach', position: [7, 37, -80], lookAt: [0, 20, -2] },
    { name: 'open-court', position: [-4, 49, 0], lookAt: [2, 12, 0] },
    { name: 'compound-plan', position: [17, 153, 0], lookAt: [17, 8, 0] },
  ],
};
