/** Hohensalzburg's present exterior, authored from the site frame and primary visual references. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u23/n0268_hohensalzburg_fortress/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const hohensalzburgPalette = {
  wall: '#e8e5dc',
  trim: '#eee7d8',
  stone: '#b0aba0',
  paving: '#b6b1a1',
  slate: '#626972',
  copper: '#608779',
  glass: '#4d6178',
  door: '#775d4d',
};
const colors = Object.fromEntries(
  Object.entries(hohensalzburgPalette).map(([k, hex]) => [
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
    face(o, f, 'slate', 'slate', true);
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
      'slate',
      'slate',
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
function cone(o, x, z, base, top, r, d, col = 'slate', slot = 'slate', n) {
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
function squareTower(o, x, z, w, base, top, d) {
  const p = rectangle(x, z, w, w);
  if (!d) {
    rect(o, x, base, z, w, top - base, w);
    return;
  }
  rect(o, x, base, z, w, top - base - 2, w);
  shell(o, rectangle(x, z, w + 0.6, w + 0.6), [rectangle(x, z, w - 2, w - 2)], top - 2, top);
  for (const side of [-1, 1])
    for (const u of [-w * 0.37, 0, w * 0.37]) {
      rect(o, x + u, top, z + (side * w) / 2, 1.5, 1.25, 1.2);
      if (u === 0) rect(o, x + (side * w) / 2, top, z, 1.2, 1.25, 1.5);
    }
  windows(
    o,
    p,
    [
      [top - 15, 2.6],
      [top - 7, 2],
    ],
    d,
    8,
  );
}
function roundTower(o, x, z, r, base, top, d, roof = false) {
  cylinder(
    o,
    x,
    z,
    [
      [base, r],
      [top, r],
    ],
    d,
  );
  if (roof) {
    cone(o, x, z, top, top + 5, r + 0.5, d);
    return;
  }
  if (d) {
    const n = [6, 10, 14, 18][d],
      outer = radialRing(top, r + 0.3, r + 0.3, n, [x, z]).map((p) => [p[0], p[2]]),
      inner = radialRing(top, r - 1, r - 1, n, [x, z]).map((p) => [p[0], p[2]]);
    shell(o, outer, [inner], top, top + 1.4);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      panel(local(o, x + r * Math.sin(a), z + r * Math.cos(a), a), 0, top - 8, 0.04, 1.2, 2.2);
  }
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
function palace(o, d) {
  // North facade follows the site's irregular cliff edge; the hall extends behind it.
  const p = [
    [-64, -19],
    [-28, -14],
    [5, -11],
    [5, 28],
    [-56, 28],
    [-64, 18],
  ];
  // Foundation skirts descend to the declared datum; terrain hides their lower portions in situ.
  shell(o, p, [], 0, 52);
  // Eight shallow parallel roofs survive at skyline: the steep medieval roof was removed in1643.
  for (let i = 0; i < 8; i++) gable(o, -58 + i * 7.7, 7, 7.7, 38, 52, 55.7);
  // Fire walls stand above the ends of the concealed valley roofs.
  for (const x of [-63, 3.8]) rect(o, x, 50, 7, 2, 5, 40);
  for (const [x, z] of [
    [3, -10],
    [-62, 26],
    [3, 26],
  ]) {
    rect(o, x, 0, z, 6, 56, 6);
    if (d) rect(o, x, 55.5, z, 6.5, 0.6, 6.5, 'trim');
  }
  windows(
    o,
    p,
    [
      [25, 2.1],
      [36, 3.4],
      [44, 3.4],
    ],
    d,
    6.5,
  );
  if (d >= 2) {
    // Coarse projecting garderobes, paired window rhythm and wall piers.
    for (const x of [-45, -26, -8]) {
      const z = -19 + ((x + 64) * 8) / 69;
      rect(o, x, 32, z - 0.4, 2.1, 4.8, 1.4);
      panel(local(o, x, z - 1.15, Math.PI), 0, 33, 0.03, 0.8, 1.8);
    }
    windows(o, p, [[49, 1.1]], 1, 13);
  }
  // Northwest Krautturm with a green flared lantern above its open crown.
  cylinder(
    o,
    -65,
    -20,
    [
      [0, 6.4],
      [50, 6.4],
      [51, 7],
      [53.2, 7],
    ],
    d,
  );
  if (d) {
    const n = [6, 10, 14, 18][d],
      outer = radialRing(53.2, 7, 7, n, [-65, -20]).map((v) => [v[0], v[2]]),
      inner = radialRing(53.2, 5.8, 5.8, n, [-65, -20]).map((v) => [v[0], v[2]]);
    shell(o, outer, [inner], 53.2, 54.5);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      rect(o, -65 + 6.4 * Math.cos(a), 54.5, -20 + 6.4 * Math.sin(a), 1.2, 1.2, 1.2);
    }
  }
  cylinder(
    o,
    -65,
    -20,
    [
      [53.2, 4.8],
      [54.2, 3.2],
      [56.5, 2.3],
      [57.5, 3.1],
      [60, 0.08],
    ],
    d,
    'copper',
    'patina',
    d ? 8 : 6,
  );
  if (d)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const q = local(o, -65 + 6.42 * Math.sin(a), -20 + 6.42 * Math.cos(a), a);
      for (const y of [24, 35, 44]) panel(q, 0, y, 0.04, 1.3, 2.5);
    }
}
function chapel(o, d) {
  const p = frame.chapelControl.outline;
  shell(o, p, [], 30, 40);
  hip(o, 19, -1, 18, 9.3, 40, 44.8);
  // Steeple at the western end of the mapped church, separate from the high palace.
  rect(o, 12.5, 39, -1, 3.8, 6, 3.8);
  cone(o, 12.5, -1, 45, 57, 2.4, d, 'copper', 'patina', d ? 8 : 4);
  if (d)
    for (const z of [-5.34, 3.29]) {
      const q = local(o, 0, z, z < 0 ? Math.PI : 0);
      for (const x of [16, 21, 25]) {
        panel(q, z < 0 ? -x : x, 33, 0.04, 1.5, 4.3);
        if (d >= 2) panel(q, z < 0 ? -x : x, 35, 0.08, 1.5, 0.45, 'trim', 'plaster');
      }
    }
  // Adjacent administration wing, not another copy of the church.
  rect(o, 29.5, 30, 9, 27, 10.5, 11);
  hip(o, 29.5, 9, 28, 12, 40.5, 47);
  windows(
    o,
    rectangle(29.5, 9, 27, 11),
    [
      [32, 2.4],
      [37, 2.1],
    ],
    d,
    5.5,
  );
}
function ranges(o, d) {
  // South and west ranges surround the open outer court, with a second open terrace around the palace.
  const ranges = [
    [-19, 49, 92, 14, 30, 40, 47, -0.18],
    [-91, 22, 59, 13, 27, 37, 42, Math.PI / 2],
    [-104, -7, 28, 10, 25, 34, 39, 0.08],
    [54, -21, 52, 13, 30, 39, 45, 0.03],
  ];
  for (const [x, z, w, depth, base, eave, ridge, a] of ranges) {
    const q = local(o, x, z, a);
    rect(q, 0, base, 0, w, eave - base, depth);
    hip(q, 0, 0, w + 0.7, depth + 0.7, eave, ridge);
    windows(
      q,
      rectangle(0, 0, w, depth),
      [
        [base + 2, 2.2],
        [eave - 3.1, 1.8],
      ],
      d,
      6.5,
    );
    if (d === 3)
      for (const u of [-w * 0.26, w * 0.26]) rect(q, u, ridge - 2, 1, 1.5, 4, 1.5, 'trim');
  }
  squareTower(o, -116, -17, 10, 10, 44, d);
  squareTower(o, -96, 46, 9, 20, 45, d);
  squareTower(o, -63, 46, 8, 28, 51, d);
  roundTower(o, 34, 47, 5, 16, 41, d);
  roundTower(o, 83, -28, 5.7, 15, 43, d);
  // Inner bastion's walk encloses an open terrace around the southern and western palace sides.
  pathWall(
    o,
    [
      [-69, -12],
      [-74, 18],
      [-65, 34],
      [-7, 35],
      [12, 21],
      [12, 7],
    ],
    30,
    34,
    1.8,
  );
  if (d >= 2) {
    for (const [x, z] of [
      [-69, 26],
      [4, 31],
    ])
      roundTower(o, x, z, 2.6, 32, 36, d);
    for (const [x, z] of [
      [-48, 50],
      [-8, 43],
    ]) {
      const q = local(o, x, z, -0.18);
      rect(q, 0, 42, 0, 4, 4, 4);
      hip(q, 0, 0, 4.8, 4.8, 46, 49);
      panel(q, 0, 43, 2.04, 1.8, 2);
    }
  }
}
function grounds(o, d) {
  // Separate architectural terraces leave the hillside between them empty for actual terrain.
  slab(
    o,
    [
      [
        [-116, -15],
        [-72, -20],
        [-65, 0],
        [-60, 31],
        [-5, 35],
        [12, 14],
        [40, 12],
        [48, -26],
        [86, -29],
        [97, 23],
        [36, 48],
        [-9, 65],
        [-89, 54],
        [-111, 36],
      ],
    ],
    30,
  );
  slab(
    o,
    [
      [
        [-72, -9],
        [-69, 32],
        [-3, 35],
        [12, 19],
        [5, 9],
        [-60, -10],
      ],
    ],
    33,
  );
  // Kuenburg northern retaining bastion: documented30m height, open viewing terrace on top.
  const k = [
    [13, -39],
    [52, -37],
    [85, -46],
    [91, -29],
    [42, -21],
    [14, -24],
  ];
  shell(o, k, [], 0, 30, 'stone', 'limestone');
  slab(o, [k], 30.01);
  pathWall(o, [k[0], k[1], k[2]], 30, 31.4, 1.5);
  // Western artillery terraces and eastern Nonnberg outworks follow the full site outline.
  const west = [
    [-132, -19],
    [-96, -23],
    [-75, -35],
    [-69, -22],
    [-93, -16],
    [-113, -9],
    [-116, 20],
    [-104, 43],
    [-73, 50],
    [-49, 57],
    [-5, 64],
    [-3, 76],
    [-50, 71],
    [-60, 85],
    [-78, 72],
    [-75, 65],
    [-83, 59],
    [-112, 60],
    [-112, 45],
    [-133, 13],
    [-124, 9],
  ];
  shell(o, west, [], 0, 11, 'stone', 'limestone');
  slab(o, [west], 11.01);
  pathWall(
    o,
    [
      [-132, -19],
      [-96, -23],
      [-75, -35],
    ],
    11,
    12.6,
    1.5,
  );
  if (d)
    pathWall(
      o,
      [
        [-133, 13],
        [-112, 45],
        [-112, 60],
        [-83, 59],
        [-75, 65],
        [-78, 72],
        [-60, 85],
      ],
      11,
      12.6,
      1.5,
    );
  const east = [
    [92, -42],
    [108, -72],
    [126, -53],
    [119, -46],
    [119, -39],
    [130, -18],
    [125, 30],
    [101, 30],
    [95, 20],
  ];
  shell(o, east, [], 0, 10, 'stone', 'limestone');
  slab(o, [east], 10.01);
  pathWall(
    o,
    [
      [126, -53],
      [119, -46],
      [119, -39],
      [130, -18],
      [125, 30],
      [101, 30],
    ],
    10,
    12,
    1.7,
  );
  // White high curtain on the inner court's perimeter, distinct from dark stone retaining walls.
  pathWall(
    o,
    [
      [-116, -17],
      [-110, 27],
      [-92, 47],
      [-68, 53],
      [-8, 63],
      [34, 47],
      [83, 27],
      [93, 7],
      [83, -28],
    ],
    11,
    32,
    2.4,
  );
  pathWall(
    o,
    [
      [-116, -17],
      [-93, -18],
      [-69, -20],
    ],
    11,
    35,
    2.8,
  );
  if (d) {
    for (const [x, z] of [
      [15, -38],
      [84, -44],
      [-124, 9],
      [-112, 55],
      [129, -16],
      [126, 29],
    ]) {
      const y = x > 0 && z < -30 ? 30 : 11;
      cylinder(
        o,
        x,
        z,
        [
          [y - 2, 0.8],
          [y, 1.7],
          [y + 3, 1.7],
        ],
        d,
      );
      cone(o, x, z, y + 3, y + 5, 2.1, d);
    }
    // Sparse broad buttresses; no replicated masonry blocks or baked weathering.
    for (const x of [27, 46, 66]) rect(o, x, 0, -37.5, 3.5, 14, 4, 'stone', 'limestone');
    for (const z of [4, 22, 38]) rect(o, -112, 11, z, 4.5, 13, 4.5, 'stone', 'limestone');
  }
}
function gates(o, d) {
  // Northwestern funicular entry opens through the low Hasengraben terrace.
  const west = local(o, -121, -24, 0.16);
  archway(west, 0, 0, 0, 4.8, 7, 15, 11, 8, d, 'stone', 'limestone');
  if (d) {
    rect(west, 0, 11, 0, 15, 4, 8);
    hip(west, 0, 0, 16, 9, 15, 19);
    panel(west, 0, 12, 4.05, 8, 2.2);
  }
  // Eastern gate house and roofed approach; only the immediate precinct is modeled.
  const east = local(o, 106, -45, 0.28);
  archway(east, 0, 10, 0, 4.4, 6, 12, 24, 8, d);
  hip(east, 0, 0, 13, 9, 24, 28.5);
  if (d) {
    windows(east, rectangle(0, 0, 12, 8), [[18, 2.5]], d, 6);
    // Reconstructed stepped path to the outer court, broad surfaces rather than individual stair nosings.
    for (let i = 0; i < 6; i++)
      rect(o, 92 - i * 1.5, 10 + i * 3.33, -23 + i * 3.4, 5, 3.4, 4, 'paving', 'limestone');
    // Courtyard cistern: stone octagon, four substantial posts and green cap.
    cylinder(
      o,
      40,
      23,
      [
        [30, 2.6],
        [31.2, 2.6],
      ],
      d,
      'stone',
      'limestone',
      8,
    );
    for (const u of [-1.7, 1.7])
      for (const v of [-1.7, 1.7]) rect(o, 40 + u, 31.2, 23 + v, 0.5, 2.8, 0.5, 'trim');
    cone(o, 40, 23, 34, 36.8, 3, d, 'copper', 'patina', 8);
  }
}
export function buildHohensalzburgRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  grounds(o, d);
  palace(o, d);
  chapel(o, d);
  ranges(o, d);
  gates(o, d);
}
export const buildHohensalzburgSkyline = (o) =>
  buildHohensalzburgRuntime(
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
export const hohensalzburgStudy = {
  id: 'N0268',
  key: 'hohensalzburg_fortress',
  title: 'Hohensalzburg Fortress',
  category: 'castle',
  wikidataId: 'Q679292',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildHohensalzburgRuntime(o),
  brief:
    'Salzburg hilltop fortress: broad white high palace under eight shallow parallel roofs, green Krautturm lantern, chapel spire, open courts and stepped artillery bastions.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: hohensalzburgPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'High white palace with eight parallel valley roofs and corner fire walls',
      'Krautturm green lantern and slender courtyard chapel spire',
      'Tiered stone bastions and irregular white curtain around open courtyards',
    ],
  },
  sourceFacts: {
    mapIdentity: 'Full fortress way/58379993 exact Q679292; chapel way/58379483 is a control only',
    publishedSiteAreaSquareMeters: 32000,
    publishedKuenburgBastionHeightMeters: 30,
    publishedOriginal1220CorePlanMeters: [22, 33],
    roofReplacedYear: 1643,
  },
  reconstruction: {
    basis:
      'OSM precinct/chapel control, Salzburg Museum Hettwer plan and current owner aerial/courtyard photographs',
    scope: 'Main fortress and immediate terraces; no hillside or distant outerworks',
  },
  scaleBasis:
    'Mapped267m-wide site frame; individual wings manually reconstructed. Published30m Kuenburg wall controls court datum, inferred upper terrace33m and maximum60m. Original1220core22×33m is not the current enlarged palace. Terrain attachment pending.',
  refs: [
    'https://www.festung-hohensalzburg.at/en/the-fortress',
    'https://www.stadt-salzburg.at/festung-hohensalzburg',
    'https://sammlung-online.salzburgmuseum.at/detail/collection/f0ee88fa-68c2-4ced-bde8-b4c337e1c59c',
    'https://hdbg.eu/burgen/detail/burgschloss-hohensalzburg/237?lang=de&p=1',
    'https://www.openstreetmap.org/way/58379993',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original reconstruction under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0; reference photographs and historical plan linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0; owner, city and museum references used as research.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-northeast',
    front: '-Z north-northwest toward old town',
    origin: 'Site bounds center; lowest retaining baseY=0, main courtY=30m',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 30,
    notes:
      'Full-site frame corrects chapel-only map match; reconstructed wing positions and terraced elevations require real hillside fit review.',
    reviewStatus: 'Research frame only; terrain seating pending',
  }),
  geographicNote:
    'Site boundary is a precinct, not a building footprint. Correct anchor and signed axis do not prove individual massing or terrain fit.',
  limitations: [
    'Simplified current exterior; most individual dimensions inferred, not surveyed.',
    'No mountain pedestal, interiors, private images or distant ramparts.',
    'Hillside contact, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve Hohensalzburg-specific roof rhythm, white palace, green lantern, chapel spire and terraced courts at every level.',
  mediumFiContext: { scale: '3.5', neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  camera: { position: [-280, 205, -315], lookAt: [0, 25, 0], fov: 43 },
  qaCameras: [
    { name: 'north-palace-and-bastions', position: [-60, 95, -300], lookAt: [-5, 30, 0] },
    { name: 'south-courts-and-ranges', position: [15, 130, 290], lookAt: [-20, 30, 5] },
    { name: 'west-hasengraben', position: [-315, 95, 20], lookAt: [-50, 30, 5] },
    { name: 'east-chapel-and-outworks', position: [295, 115, -45], lookAt: [25, 30, 0] },
    { name: 'chapel-courtyard', position: [78, 53, 30], lookAt: [0, 42, 0] },
    { name: 'compound-plan', position: [0, 410, 1], lookAt: [0, 20, 0] },
  ],
};
