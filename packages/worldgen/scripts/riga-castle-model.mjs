/** Riga's two-court compound; source geometry follows the medium-fi budget itself. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ud/ud1/n0264_riga_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const rigaPalette = {
  cream: '#eee8db',
  yellow: '#e6cf8f',
  roof: '#aa6e54',
  copper: '#96b8a5',
  stone: '#c7baa0',
  glass: '#4d6178',
  trim: '#4d585e',
  white: '#f0ece2',
  red: '#983c4c',
  gold: '#d8b968',
  paving: '#b8b0a0',
};
const colors = Object.fromEntries(
  Object.entries(rigaPalette).map(([k, h]) => [
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
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const area = (p) =>
  p.reduce((v, a, i) => {
    const b = p[(i + 1) % p.length];
    return v + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function ring(p, positive = false) {
  const r = p.slice();
  if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  if (area(r) > 0 !== positive) r.reverse();
  return r;
}
function local(o, x, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, r, p, n, uv, col) =>
        o[k](
          slot,
          r,
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
const edge = (o, a, b) => local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const rect = (o, s, x, y, z, w, h, d, c) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[c]);
function face(o, s, p, c, up = false) {
  if (up && normalFor(p[0], p[1], p[2])[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      s,
      'palette:#ffffff',
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      colors[c],
    );
  }
}
function floor(o, rings, y, c = 'paving', s = 'limestone') {
  const pts = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(offset);
    offset += r.length;
  }
  const idx = earcut(pts.flat(), holes, 2);
  for (let i = 0; i < idx.length; i += 3)
    face(
      o,
      s,
      idx.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      c,
      true,
    );
}
function shell(o, outer, holes, base, top, c = 'cream', s = 'plaster') {
  const rs = [ring(outer), ...holes.map((p) => ring(p, true))];
  for (const r of rs)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        o,
        s,
        [
          [a[0], base, a[1]],
          [b[0], base, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        c,
      );
    }
  floor(o, rs, top, c, s);
}
function hip(o, p, eave, ridge) {
  const a = mix(p[0], p[3], 0.5),
    b = mix(p[1], p[2], 0.5),
    r0 = mix(a, b, 0.12),
    r1 = mix(a, b, 0.88);
  for (const q of [
    [p[0], p[1], r1, r0],
    [p[2], p[3], r0, r1],
    [p[3], p[0], r0],
    [p[1], p[2], r1],
  ])
    face(
      o,
      'tile',
      q.map((v, i) => [v[0], i < 2 ? eave : ridge, v[1]]),
      'roof',
      true,
    );
}
function panel(o, x, y, z, w, h, c, s = 'plaster') {
  face(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    c,
  );
}
function arch(o, x, y, z, w, h, c, s = 'glass', n = 6) {
  const r = w / 2,
    cy = y + h - r;
  face(
    o,
    s,
    [
      [x - r, y, z],
      [x + r, y, z],
      ...Array.from({ length: n + 1 }, (_, i) => [
        x + r * Math.cos((i * Math.PI) / n),
        cy + r * Math.sin((i * Math.PI) / n),
        z,
      ]),
    ],
    c,
  );
}
function window(o, x, y, z, w, h, d, { arched = false, frame = 'cream', cross = true } = {}) {
  const p = arched ? arch : panel;
  if (d >= 2) p(o, x, y - 0.15, z, w + 0.34, h + 0.3, frame, 'plaster');
  p(o, x, y, z + 0.025, w, h, 'glass', 'glass');
  if (d === 3 && cross && w >= 1.3) {
    panel(o, x, y, z + 0.06, 0.23, h, 'cream');
    panel(o, x, y + h * 0.56, z + 0.06, w, 0.23, 'cream');
  }
}
function windows(o, p, ys, d, { courtyard = false, skip = () => false } = {}) {
  if (!d) return;
  const r = ring(p, courtyard);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 4 || skip(a, b)) continue;
    const g = edge(o, a, b),
      n = Math.max(1, Math.round(l / 4.8));
    for (let j = 0; j < n; j++)
      for (const [y, h, arched] of ys)
        window(g, ((j + 0.5) * l) / n, y, 0.08, 1.5, h, d, { arched });
  }
}
function cone(
  o,
  slot,
  x,
  z,
  base,
  tip,
  radius,
  d,
  c = 'roof',
  n = d === 0 ? 8 : d === 1 ? 12 : 24,
) {
  loft(
    o,
    slot,
    [
      radialRing(base, radius, radius, n, [x, z], n === 4 ? Math.PI / 4 : 0),
      radialRing(tip, 0.06, 0.06, n, [x, z], n === 4 ? Math.PI / 4 : 0),
    ],
    colors[c],
  );
}
function flag(o, x, z, base, width, d) {
  rect(o, 'foliage', x, base, z, 0.24, 12, 0.24, 'white');
  const top = base + 11.6,
    h = width * 0.5;
  for (const [a, b, c] of [
    [0, 0.4, 'red'],
    [0.4, 0.6, 'white'],
    [0.6, 1, 'red'],
  ]) {
    const n = d ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const u = i / n,
        v = (i + 1) / n,
        z0 = d ? 0.3 * Math.sin(u * Math.PI * 2) : 0,
        z1 = d ? 0.3 * Math.sin(v * Math.PI * 2) : 0,
        p = [
          [x + u * width, top - a * h - u * 0.18, z + z0],
          [x + v * width, top - a * h - v * 0.18, z + z1],
          [x + v * width, top - b * h - v * 0.18, z + z1],
          [x + u * width, top - b * h - u * 0.18, z + z0],
        ];
      face(o, 'foliage', p, c);
      face(o, 'foliage', [...p].reverse(), c);
    }
  }
}
const outer = [
  [-5.3, -44.1],
  [49.9, -44.1],
  [51.1, 19.4],
  [-4.2, 24.4],
];
const court = [
  frame.geometry.holes[0][1],
  frame.geometry.holes[0][3],
  frame.geometry.holes[0][7],
  frame.geometry.holes[0][8],
];
function medieval(o, d) {
  const eave = 19.96,
    ridge = 26.815;
  shell(o, outer, [court], 0, eave);
  floor(o, [court], 1.8);
  const r = outer.map((p, i) => mix(p, court[i], 0.5));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      o,
      'tile',
      [
        [outer[i][0], eave, outer[i][1]],
        [outer[j][0], eave, outer[j][1]],
        [r[j][0], ridge, r[j][1]],
        [r[i][0], ridge, r[i][1]],
      ],
      'roof',
      true,
    );
    face(
      o,
      'tile',
      [
        [court[j][0], eave, court[j][1]],
        [court[i][0], eave, court[i][1]],
        [r[i][0], ridge, r[i][1]],
        [r[j][0], ridge, r[j][1]],
      ],
      'roof',
      true,
    );
  }
  // The west facade has four rows; the south chapel has tall second-floor arched bays.
  if (d) {
    const sides = [
      {
        a: outer[3],
        b: outer[2],
        rows: [
          [3.51, 1.98],
          [7.93, 2.52, true],
          [12.025, 2.25],
          [16.435, 2.26],
        ],
        count: 9,
      },
      {
        a: outer[2],
        b: outer[1],
        rows: [
          [3, 2.2],
          [6.84, 7.01, true],
          [16.435, 2.26],
        ],
        count: 8,
      },
    ];
    for (const { a, b, rows, count } of sides) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        g = edge(o, a, b);
      for (let i = 0; i < count; i++)
        for (const [y, h, arched] of rows)
          window(g, ((i + 0.5) * l) / count, y, 0.08, arched && h > 5 ? 2.55 : 1.85, h, d, {
            arched,
          });
      rect(g, 'plaster', l / 2, 6.6, 0.12, l, 0.32, 0.4, 'cream');
      rect(g, 'plaster', l / 2, eave - 0.4, 0.14, l, 0.45, 0.45, 'cream');
    }
    // Plain eastern range and forecourt-facing north wall retain their own opening rhythm.
    windows(
      o,
      outer,
      [
        [2.7, 2],
        [7.2, 2.2],
        [12, 2.3],
        [16.5, 1.9],
      ],
      d,
      { skip: (a, b) => (a[0] > 45 && b[0] > 45) || (a[1] > 18 && b[1] > 18) },
    );
    windows(
      o,
      court,
      [
        [10.2, 2],
        [15.3, 2],
      ],
      d,
      { courtyard: true },
    );
    for (let i = 0; i < 4; i++) {
      const a = court[i],
        b = court[(i + 1) % 4],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        g = edge(o, a, b),
        n = Math.max(3, Math.round(l / 4.2));
      // Shallow arcades are exterior reveals; no unmodeled interior spaces are implied.
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) * l) / n;
        arch(g, x, 1.85, 0.1, 3.1, 4.3, 'stone', 'plaster');
        arch(g, x, 2, 0.13, 2.55, 3.95, 'glass', 'glass');
      }
      rect(g, 'plaster', l / 2, 6.45, 0.12, l, 0.35, 0.45, 'cream');
    }
    const g = edge(o, outer[2], outer[1]),
      l = Math.hypot(outer[2][0] - outer[1][0], outer[2][1] - outer[1][1]);
    window(g, l * 0.45, 1.8, 0.2, 2.3, 3.2, d, { frame: 'stone', cross: false });
    rect(g, 'limestone', l * 0.45, 5.15, 0.35, 3.5, 0.4, 0.7, 'stone');
  }
  if (d >= 2) {
    // Sparse roof chimneys are the largest repeated roof features, not every ventilation stack.
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4];
      for (const t of [0.22, 0.53, 0.79]) {
        const p = mix(a, b, t);
        rect(o, 'plaster', p[0], ridge - 0.5, p[1], 0.95, 2.8, 1.1, 'cream');
        rect(o, 'plaster', p[0], ridge + 2.1, p[1], 1.3, 0.3, 1.4, 'cream');
      }
    }
    // Glass stair gallery along the east courtyard face, interpreted from the architect's design.
    const a = court[0],
      b = court[1],
      g = edge(o, a, b),
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    rect(g, 'glass', l / 2, 1.8, 1.1, l - 2, 7.5, 2.2, 'glass');
    for (const y of [1.8, 5.3, 9.3]) rect(g, 'plaster', l / 2, y, 1.2, l - 1, 0.3, 2.5, 'trim');
    for (let x = 1; x < l - 1; x += 3.5) rect(g, 'plaster', x, 1.8, 2.24, 0.25, 7.8, 0.25, 'trim');
    const p = court[3];
    rect(o, 'plaster', p[0] + 2.5, 1.8, p[1] - 0.6, 4.4, 16.8, 2, 'cream');
    face(
      o,
      'plaster',
      [
        [p[0] + 0.3, 18.6, p[1] + 0.45],
        [p[0] + 4.7, 18.6, p[1] + 0.45],
        [p[0] + 2.5, 21, p[1] + 0.45],
      ],
      'cream',
    );
  }
}
function mainTowers(o, d) {
  const n = d === 0 ? 8 : d === 1 ? 12 : 24;
  // Holy Spirit: open battlemented crown and the national flag; no pointed tower roof.
  const x = -4.55,
    z = 27.3,
    r = 7.55,
    top = 28.5;
  loft(
    o,
    'plaster',
    [
      radialRing(0, r, r, n, [x, z]),
      radialRing(15, r, r, n, [x, z]),
      radialRing(15.45, r + 0.18, r + 0.18, n, [x, z]),
      radialRing(top, r + 0.18, r + 0.18, n, [x, z]),
    ],
    colors.cream,
    { cap: false },
  );
  if (d) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        g = local(o, x + Math.sin(a) * r, z + Math.cos(a) * r, a);
      rect(g, 'plaster', 0, top, 0, 1.25, 0.42, 0.5, 'cream');
    }
    for (let i = 0; i < n; i += d === 1 ? 3 : 4) {
      const a = (i * Math.PI * 2) / n,
        g = local(o, x + Math.sin(a) * (r + 0.18), z + Math.cos(a) * (r + 0.18), a);
      for (const y of [6.2, 17.5, 23.5])
        window(g, 0, y, 0.07, 1.15, 2.65, d, { arched: true, cross: false });
    }
  }
  floor(o, [radialRing(top, r + 0.18, r + 0.18, n, [x, z]).map((p) => [p[0], p[2]])], top, 'stone');
  flag(o, x - 1.7, z, top, 4.4, d);
  // Lead Tower: tapered white drum and shallow conical red-tile cap.
  const lx = 51.75,
    lz = -37.35,
    lr = 7.5,
    le = 27.14;
  loft(
    o,
    'plaster',
    [radialRing(0, lr, lr, n, [lx, lz]), radialRing(le, lr - 0.25, lr - 0.25, n, [lx, lz])],
    colors.cream,
  );
  cone(o, 'tile', lx, lz, le, 32.13, lr + 0.3, d);
  if (d) {
    for (let i = 0; i < n; i += d === 1 ? 3 : 4) {
      const a = (i * Math.PI * 2) / n,
        g = local(o, lx + Math.sin(a) * lr, lz + Math.cos(a) * lr, a);
      for (const [y, h] of [
        [7.04, 3.35],
        [16.175, 2.845],
        [21.185, 2.09],
      ])
        window(g, 0, y, 0.05, 1.3, h, d, { arched: true, cross: false });
    }
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        g = local(o, lx + Math.sin(a) * (lr - 0.25), lz + Math.cos(a) * (lr - 0.25), a);
      panel(g, 0, le - 1, 0.05, 0.55, 0.45, 'stone', 'limestone');
    }
  }
  for (const [sx, sz, w, top, tip] of [
    [51.25, 17.7, 4.8, 25.02, 31.285],
    [-4, -40.6, 5.2, 26.6, 33.2],
  ]) {
    rect(o, 'plaster', sx, 0, sz, w, top, w, 'cream');
    cone(o, 'tile', sx, sz, top, tip, w * 0.76, d, 'roof', 4);
    if (d)
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const g = local(o, sx + (Math.sin(a) * w) / 2, sz + (Math.cos(a) * w) / 2, a);
        for (const y of [8, 15, top - 3]) window(g, 0, y, 0.08, 0.6, 1.2, 1);
      }
  }
}
function star(o, x, y, z, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5,
      s = i % 2 ? r * 0.42 : r;
    p.push([x + Math.cos(a) * s, y + Math.sin(a) * s, z]);
  }
  const idx = earcut(
    p.flatMap((p) => [p[0], p[1]]),
    [],
    2,
  );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => p[j]);
    face(o, 'foliage', q, 'gold');
    face(o, 'foliage', [...q].reverse(), 'gold');
  }
}
function threeStars(o, d) {
  const x = -45.2,
    z = -1.45,
    n = d === 0 ? 8 : d === 1 ? 12 : 16;
  rect(o, 'plaster', x, 0, z, 7.5, 30.5, 7.4, 'yellow');
  for (const [y, w, h] of [
    [28.9, 8.1, 0.4],
    [30.1, 8.5, 0.45],
  ])
    rect(o, 'plaster', x, y, z, w, h, w, 'cream');
  // Stepped copper spire: broad bell, narrow shaft, tapered tip and a three-star finial.
  loft(
    o,
    'patina',
    [
      [30.5, 4.05],
      [31.3, 4.05],
      [32.4, 2.65],
      [34.2, 2.4],
      [34.8, 3.0],
      [35.3, 2.9],
      [36.0, 2.1],
      [47.3, 1.55],
      [47.7, 1.85],
      [48.2, 1.5],
      [53.7, 0.3],
    ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    colors.copper,
  );
  rect(o, 'foliage', x, 53.6, z, 0.22, 2.3, 0.22, 'gold');
  star(o, x, 56.2, z, 0.55);
  star(o, x - 0.65, 55.55, z, 0.5);
  star(o, x + 0.65, 55.55, z, 0.5);
  if (d) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const g = local(o, x + Math.sin(a) * 3.75, z + Math.cos(a) * 3.75, a);
      for (const y of [8, 16, 25.5]) window(g, 0, y, 0.1, 0.48, 1.6, 1);
      if (d >= 2) {
        const h = local(o, x + Math.sin(a) * 2.5, z + Math.cos(a) * 2.5, a);
        window(h, 0, 32.6, 0.15, 0.6, 1.05, 1);
      }
    }
  }
}
function forecourt(o, d) {
  const parts = [
    {
      p: [
        [-41.8, -33.3],
        [-29.1, -32.1],
        [-30.49, 29.29],
        [-41.3, 33.7],
      ],
      e: 18.5,
      r: 23.5,
    },
    {
      p: [
        [-40.1, 36.3],
        [-5.6, 43.9],
        [-5.6, 33],
        [-30.49, 29.29],
      ],
      e: 8.6,
      r: 13.1,
    },
    {
      p: [
        [-38.2, -44.5],
        [-5.3, -44.1],
        [-5.3, -29.0],
        [-39, -33.8],
      ],
      e: 18.5,
      r: 23.5,
    },
  ];
  for (const b of parts) {
    shell(o, b.p, [], 0, b.e, 'yellow');
    hip(o, b.p, b.e, b.r);
    windows(
      o,
      b.p,
      b.e > 10
        ? [
            [1.8, 2],
            [6.4, 2],
            [11.1, 2],
            [15.5, 1.8],
          ]
        : [
            [1.5, 2.1],
            [5.0, 2.0],
          ],
      d,
    );
  }
  floor(o, [frame.geometry.holes[1]], 0);
  // Eastern annex is the modern low service block in the mapped compound, not a second castle.
  const annex = [
    [-59, -44.9],
    [-41.86, -44.26],
    [-42.38, -33.17],
    [-49.15, -32.95],
    [-49.68, -20.91],
    [-59.25, -20.82],
  ];
  shell(o, annex, [], 0, 7, 'cream');
  floor(o, [annex], 7.02, 'stone');
  windows(
    o,
    annex,
    [
      [1.5, 2],
      [4.7, 1.5],
    ],
    d,
  );
  if (d >= 2) {
    // The principal forecourt range has a central gable and four broad dormers.
    const g = local(o, -35.6, 28.5);
    face(
      g,
      'plaster',
      [
        [-4, 18.5, 0],
        [4, 18.5, 0],
        [0, 22, 0],
      ],
      'yellow',
    );
    for (const z of [-24, -12, 11, 22]) {
      const q = local(o, -28.9, z, Math.PI / 2);
      rect(q, 'plaster', 0, 19, 0, 2.2, 1.8, 2.2, 'yellow');
      cone(q, 'tile', 0, 0, 20.8, 22.5, 1.8, d, 'roof', 4);
      window(q, 0, 19.3, 1.16, 1.5, 1.1, d);
    }
  }
  // Small Erker at the riverside corner, with a corbelled octagonal bay.
  const ex = -40.15,
    ez = 35.02;
  loft(
    o,
    'plaster',
    [
      radialRing(5.5, 0.6, 0.6, 8, [ex, ez]),
      radialRing(7, 1.75, 1.75, 8, [ex, ez]),
      radialRing(16.8, 1.75, 1.75, 8, [ex, ez]),
    ],
    colors.yellow,
  );
  cone(o, 'tile', ex, ez, 16.8, 21.1, 2.1, d, 'roof', 8);
  if (d)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        g = local(o, ex + Math.sin(a) * 1.75, ez + Math.cos(a) * 1.75, a);
      for (const y of [8, 12.8]) window(g, 0, y, 0.06, 0.65, 1.4, 1);
    }
}
export function buildRigaRuntime(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  medieval(o, d);
  forecourt(o, d);
  mainTowers(o, d);
  threeStars(o, d);
}
export const buildRigaSkyline = (o) =>
  buildRigaRuntime(
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
export const rigaStudy = {
  id: 'N0264',
  key: 'riga_castle',
  title: 'Riga Castle',
  category: 'castle',
  wikidataId: 'Q322183',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildRigaRuntime(o),
  brief:
    'Two-court Riga Castle with the white medieval quadrangle, flat-crowned Holy Spirit tower and flag, shallow conical Lead Tower, two square stair towers, yellow presidential ranges, small Erker and copper Three Stars steeple.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: rigaPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 6,
    materialBudgetReason:
      'Plaster, stone, tile and patinated copper carry distinct architectural surfaces; glass and flags/finials are local colors.',
    identityFeatures: [
      'White four-wing medieval castle with round Holy Spirit and Lead towers',
      'Yellow northern presidential forecourt and tall green Three Stars steeple',
      'Open inner court, red roof ring and tall south chapel bays',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/1393926 exact Wikidata Q322183',
    mappedCourtyards: 2,
    architectDrawingDatumMeters: {
      southEave: 18.16,
      ridge: 25.015,
      leadEave: 25.34,
      leadTip: 30.33,
      southStairTowerTip: 29.485,
      lowestAdjacentGround: -1.8,
    },
    publishedHistoricalFlagMastMeters: 12,
  },
  reconstruction: {
    basis:
      'Attributed OSM compound outline and courtyard holes; Sudraba Arhitektura published elevations/plans and official presidency photographs',
    scope:
      'Present-day exterior castle and presidential forecourt; neighboring church spires, gardens, river walls and interiors excluded',
    referenceState:
      'Restored exterior, with the courtyard glass gallery represented as a simplified opaque PBR volume',
  },
  scaleBasis:
    'Horizontal extent from OSM. Published architect elevations are shifted +1.8m to a conservative flat attachment plane. Tower positions, northern wing and Three Stars heights are photographic reconstructions; Three Stars finial maximum 56.75m is not a surveyed height. A 12m flagmast is supported by RTU historical documentation. Actual stepped street/court levels need placement review.',
  refs: [
    'https://www.president.lv/en/riga-castle',
    'https://lnvm.gov.lv/en/riga-castle/history-of-riga-castle/',
    'https://sudraba-arhitektura.lv/riga-castle/',
    'https://www.openstreetmap.org/relation/1393926',
    'https://hesihe-journals.rtu.lv/iav/article/download/IAV.2025.008/154/323',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  dataAttribution:
    'Footprints © OpenStreetMap contributors, ODbL-1.0. Architectural drawings and official photographs are linked research references, not redistributed images or textures.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X southeast along the riverbank',
    front: '+Z southwest toward Daugava',
    origin: 'Mapped compound center; Y=0 conservative external attachment plane',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Signed river-facing frame; local ground and entrance contact pending',
  }),
  geographicNote:
    'The exact compound footprint preserves both courtyards. River-facing +Z excludes neighboring St James and Our Lady of Sorrows spires. Real street levels and the forecourt-to-castellum connection require terrain review before activation.',
  limitations: [
    'Northern wing heights, individual tower placement and Three Stars proportions are estimates from published imagery; only the medieval elevation labels are dimensional evidence.',
    'Courtyard arcades are shallow exterior reveals; the stair gallery is an opaque medium-fi representation. No navigable interiors or room reconstruction.',
    'Static source review does not prove real-site terrain fit, moving-camera shimmer or physical-device performance.',
  ],
  importReason:
    'Preserve the paired courts, distinct tower crowns, copper steeple and asymmetric chapel windows within medium-fi budgets.',
  mediumFiContext: { scale: '1.8', neighborStyle: 'molen.worldgen.catalog.bohemian_townhouse' },
  camera: { position: [130, 85, 165], lookAt: [0, 18, 0], fov: 43 },
  qaCameras: [
    { name: 'river-front-and-flag', position: [29, 21, 115], lookAt: [22, 14, 21] },
    { name: 'south-chapel-and-lead', position: [117, 20, -8], lookAt: [50, 14, -8] },
    { name: 'medieval-courtyard', position: [30, 22, 1], lookAt: [14, 7, -13] },
    { name: 'mapped-two-court-plan', position: [0, 225, 0], lookAt: [0, 0, 0] },
    { name: 'three-stars-and-forecourt', position: [-112, 43, 64], lookAt: [-40, 29, 0] },
    { name: 'holy-spirit-crown', position: [18, 40, 66], lookAt: [-4, 29, 27] },
  ],
};
