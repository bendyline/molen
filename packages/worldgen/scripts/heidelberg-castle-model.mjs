/** Heidelberg's present-day compound: roofless Renaissance wings and broken defensive towers. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

export const heidelbergPalette = {
  wall: '#bd8c73',
  warm: '#c8a080',
  trim: '#d6b594',
  plaster: '#ddcbae',
  slate: '#626872',
  tile: '#a66c52',
  glass: '#4d6178',
  paving: '#b4ada0',
};
const colors = Object.fromEntries(
  Object.entries(heidelbergPalette).map(([key, hex]) => [
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
function polygon(o, p, z, depth, color = 'wall', slot = 'sandstone', holes = []) {
  // Both faces and every opening reveal are real geometry, with no dark pane filling ruins.
  const rings = [p, ...holes],
    pts = rings.flat(),
    starts = [];
  let off = p.length;
  for (const h of holes) {
    starts.push(off);
    off += h.length;
  }
  const ids = earcut(pts.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3) {
    const tri = ids.slice(i, i + 3).map((j) => [pts[j][0], pts[j][1], z + depth / 2]);
    if (normalFor(...tri)[2] < 0) tri.reverse();
    face(o, tri, color, slot);
    face(o, tri.map((v) => [v[0], v[1], z - depth / 2]).reverse(), color, slot);
  }
  for (let k = 0; k < rings.length; k++) {
    let r = rings[k];
    const area = r.reduce((sum, a, i) => {
      const b = r[(i + 1) % r.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    if (area > 0 !== (k === 0)) r = [...r].reverse();
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        o,
        [
          [a[0], a[1], z - depth / 2],
          [b[0], b[1], z - depth / 2],
          [b[0], b[1], z + depth / 2],
          [a[0], a[1], z + depth / 2],
        ],
        color,
        slot,
      );
    }
  }
}
function hole(x, y, w, h, arch = false, n = 4) {
  if (!arch)
    return [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w / 2, y + h],
      [x - w / 2, y + h],
    ];
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + (w / 2) * Math.cos(a), y + h - w / 2 + (w / 2) * Math.sin(a)];
    }),
  ];
}
function pierced(
  o,
  w,
  base,
  top,
  z,
  t,
  rows,
  count,
  d,
  color = 'wall',
  slot = 'sandstone',
  arched = false,
) {
  const holes = [];
  if (d)
    for (const [y, h] of rows)
      for (let i = 0; i < count; i++)
        holes.push(
          hole(
            ((i + 0.5) * w) / count - w / 2,
            y,
            Math.min(2.8, (w / count) * 0.55),
            h,
            arched && d >= 2,
          ),
        );
  polygon(
    o,
    [
      [-w / 2, base],
      [w / 2, base],
      [w / 2, top],
      [-w / 2, top],
    ],
    z,
    t,
    color,
    slot,
    holes,
  );
}
function hip(o, w, depth, eave, top, color = 'slate', slot = 'slate') {
  const v = [
      [-w / 2, eave, -depth / 2],
      [-w / 2, eave, depth / 2],
      [w / 2, eave, depth / 2],
      [w / 2, eave, -depth / 2],
    ],
    a = [-w / 2 + Math.min(w * 0.2, depth * 0.45), top, 0],
    b = [w / 2 - Math.min(w * 0.2, depth * 0.45), top, 0];
  for (const p of [
    [v[0], v[1], a],
    [v[1], v[2], b, a],
    [v[2], v[3], b],
    [v[3], v[0], a, b],
  ])
    face(o, p, color, slot, true);
}
function windows(o, width, z, rows, n, d, color = 'trim') {
  if (!d) return;
  for (const [y, h] of rows)
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * width) / n - width / 2,
        w = Math.min(2.5, (width / n) * 0.53);
      if (d >= 2) panel(o, x, y - 0.3, z, w + 0.6, h + 0.6, color, 'sandstone');
      panel(o, x, y, z + 0.04, w, h);
      if (d === 3) panel(o, x, y + h * 0.52, z + 0.08, w, 0.4, color, 'sandstone');
    }
}
function cornices(o, w, z, ys, d) {
  if (d < 2) return;
  for (const y of ys) rect(o, 0, y, z, w, 0.55, 0.75, 'trim');
}
function curvedRoof(o, eave, top, r) {
  loft(
    o,
    'slate',
    [
      [eave, r],
      [eave + 1, r * 0.96],
      [top - 2, r * 0.45],
      [top, r * 0.18],
    ].map(([y, v]) => [
      [-v, y, -v],
      [-v, y, v],
      [v, y, v],
      [v, y, -v],
    ]),
    colors.slate,
  );
}
function cylindrical(o, x, z, r, base, top, n = 12, color = 'wall') {
  loft(
    o,
    'sandstone',
    [radialRing(base, r, r, n, [x, z]), radialRing(top, r, r, n, [x, z])],
    colors[color],
  );
}
function brokenTower(o, x, z, r, t, top, d, start = -0.3, end = Math.PI * 1.4) {
  const n = [4, 8, 12, 16][d];
  const samples = Array.from({ length: n + 1 }, (_, i) => {
    const a = start + ((end - start) * i) / n;
    // Broad missing masonry and uneven parapet, not per-stone rubble.
    const y = top - (i === 0 ? 5 : i === n ? 7 : d >= 2 && i % 4 === 0 ? 1.4 : 0);
    return { a, y };
  });
  for (let i = 0; i < n; i++) {
    const a = samples[i],
      b = samples[i + 1];
    const v = (s, rad, y) => [x + rad * Math.cos(s.a), y, z + rad * Math.sin(s.a)];
    face(o, [v(a, r, a.y), v(b, r, b.y), v(b, r, 0), v(a, r, 0)]);
    face(o, [v(b, r - t, b.y), v(a, r - t, a.y), v(a, r - t, 0), v(b, r - t, 0)], 'warm');
    face(
      o,
      [v(a, r, a.y), v(b, r, b.y), v(b, r - t, b.y), v(a, r - t, a.y)],
      'warm',
      'sandstone',
      true,
    );
    if (i === 0) face(o, [v(a, r - t, a.y), v(a, r, a.y), v(a, r, 0), v(a, r - t, 0)]);
    if (i === n - 1) face(o, [v(b, r, b.y), v(b, r - t, b.y), v(b, r - t, 0), v(b, r, 0)]);
  }
  if (d >= 2) cylindrical(o, x, z, 2.4, 0, top * 0.52, 8, 'warm');
}
function hollowRound(o, x, z, r, t, base, top, n, d, openings = false) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    if (!openings || !d) {
      const p = (a, rad, y) => [x + rad * Math.cos(a), y, z + rad * Math.sin(a)];
      face(o, [p(a, r, base), p(a, r, top), p(b, r, top), p(b, r, base)]);
      face(o, [p(b, r - t, base), p(b, r - t, top), p(a, r - t, top), p(a, r - t, base)]);
      face(
        o,
        [p(a, r, top), p(a, r - t, top), p(b, r - t, top), p(b, r, top)],
        'warm',
        'sandstone',
        true,
      );
      continue;
    }
    const ax = x + r * Math.cos(a),
      az = z + r * Math.sin(a),
      bx = x + r * Math.cos(b),
      bz = z + r * Math.sin(b);
    const q = local(o, (ax + bx) / 2, (az + bz) / 2, Math.atan2(az - bz, bx - ax));
    pierced(
      q,
      Math.hypot(bx - ax, bz - az) + 0.12,
      base,
      top,
      0,
      t,
      [[top - Math.min(8, top - base - 1.3), Math.min(6.5, top - base - 2.8)]],
      1,
      openings ? d : 0,
    );
  }
}
function ruin(
  o,
  x,
  z,
  width,
  depth,
  top,
  d,
  {
    angle = 0,
    color = 'wall',
    backWindows = true,
    n = 7,
    rows = [
      [15, 3],
      [22, 3],
      [29, 3],
    ],
  } = {},
) {
  const q = local(o, x, z, angle);
  rect(q, 0, 0, 0, width + 1.4, 12, depth + 1.4, color);
  pierced(q, width, 12, top, depth / 2, 1.4, rows, n, d, color);
  const back = local(q, 0, -depth / 2, Math.PI);
  pierced(back, width, 12, top, 0, 1.4, rows, n, backWindows && d >= 2 ? d : 0, color);
  rect(q, -width / 2, 12, 0, 1.4, top - 12, depth, color);
  rect(q, width / 2, 12, 0, 1.4, top - 12, depth, color);
  // Only the lowest surviving storey has a modern protective floor/roof.
  rect(q, 0, 18, 0, width - 1.4, 0.5, depth - 1.4, 'paving');
  cornices(q, width + 1.2, depth / 2 + 0.45, [20.4, 27.4, top - 0.3], d);
  if (d === 3) {
    for (let i = 0; i <= n; i++)
      rect(q, (i * width) / n - width / 2, 12, depth / 2 + 0.86, 0.6, top - 12, 0.5, 'trim');
    for (let i = 0; i < n; i++) {
      const xx = ((i + 0.5) * width) / n - width / 2;
      polygon(
        q,
        [
          [xx - 1.8, 26],
          [xx + 1.8, 26],
          [xx, 27.4],
        ],
        depth / 2 + 0.9,
        0.5,
        'trim',
      );
    }
  }
}
function friedrich(o, d) {
  // +X faces the courtyard. Gables project from the transverse slate roof.
  const q = local(o, -53, -5, Math.PI / 2),
    w = 39,
    dep = 18;
  rect(q, 0, 0, 0, w, 35, dep, 'warm');
  hip(q, w + 1, dep + 1, 35, 43);
  for (const side of [-1, 1]) {
    const front = local(q, 0, (side * dep) / 2, side < 0 ? Math.PI : 0);
    windows(
      front,
      w,
      0.12,
      [
        [14.2, 4],
        [22, 3.4],
        [29, 3.4],
      ],
      8,
      d,
    );
    cornices(front, w + 1, 0.5, [20.2, 27.2, 34.7], d);
    for (const x of [-10, 10]) {
      const p = d
        ? [
            [x - 8, 35],
            [x + 8, 35],
            [x + 8, 36],
            [x + 5.6, 37.3],
            [x + 5.6, 39],
            [x + 3.2, 40.5],
            [x + 3.2, 42],
            [x, 44],
            [x - 3.2, 42],
            [x - 3.2, 40.5],
            [x - 5.6, 39],
            [x - 5.6, 37.3],
            [x - 8, 36],
          ]
        : [
            [x - 8, 35],
            [x + 8, 35],
            [x, 44],
          ];
      polygon(front, p, 0.15, 0.7, 'warm');
      if (d) {
        panel(front, x, 36, 0.54, 2.2, 3);
        panel(front, x, 40.2, 0.54, 1.25, 1.6);
      }
    }
    if (d >= 2)
      for (let i = 0; i <= 8; i++) {
        const x = (i * w) / 8 - w / 2;
        rect(front, x, 12, 0.65, 0.65, 23, 0.6, 'trim');
        if (d === 3)
          for (const y of [23.5, 30.5]) {
            rect(front, x, y, 0.98, 0.72, 1.65, 0.65, 'trim');
            rect(front, x, y + 1.65, 0.98, 0.65, 0.6, 0.65, 'trim');
          }
      }
  }
}
function gateTower(o, d) {
  const q = local(o, 60, 21, Math.PI / 2);
  rect(q, 0, 0, 0, 18, 12, 18);
  const arch = hole(0, 12, 5.5, 8, true, d ? 6 : 2);
  const outline = [
    [-9, 12],
    [-2.75, 12],
    ...arch.slice(2).reverse(),
    [2.75, 12],
    [9, 12],
    [9, 37],
    [-9, 37],
  ];
  polygon(q, outline, 0, 18);
  curvedRoof(q, 37, 46, 9.8);
  if (d) {
    for (const sign of [-1, 1]) {
      const f = local(q, 0, sign * 9.04, sign < 0 ? Math.PI : 0);
      windows(
        f,
        13,
        0,
        [
          [24, 2],
          [32, 2],
        ],
        2,
        1,
      );
      const pts = Array.from({ length: 12 }, (_, i) => [
        3.1 * Math.cos((i * Math.PI) / 6),
        32 + 3.1 * Math.sin((i * Math.PI) / 6),
        0.08,
      ]);
      face(f, pts, 'trim');
      panel(f, 0, 32, 0.12, 0.45, 2.3, 'slate', 'slate');
      panel(f, 0.8, 31.8, 0.12, 2, 0.45, 'slate', 'slate');
    }
  }
  // Open lantern; far level keeps a small solid silhouetted crown.
  if (d) {
    for (const x of [-1.3, 1.3])
      for (const z of [-1.3, 1.3]) rect(q, x, 46, z, 0.5, 3, 0.5, 'slate', 'slate');
  } else rect(q, 0, 46, 0, 2.8, 3, 2.8, 'slate', 'slate');
  hip(q, 3.8, 3.8, 49, 52);
}
function bellTower(o, d) {
  cylindrical(o, -58, -52, 10.3, 0, 22, [6, 12, 16, 16][d]);
  hollowRound(o, -58, -52, 8.8, 1.4, 22, 38, 8, d, d > 0);
  hollowRound(o, -58, -52, 7.3, 1.2, 38, 45.5, 8, d, d >= 2);
  if (d >= 2) cylindrical(o, -48, -52, 2, 12, 35, 8, 'warm');
}
function hallGlass(o, d) {
  const q = local(o, -48, -37, Math.PI / 2);
  // Back wall and side blocks leave the three tiers of arcades genuinely recessed.
  rect(q, 0, 12, -5, 24, 20, 1.5, 'plaster', 'plaster');
  for (const x of [-10.3, 10.3]) rect(q, x, 12, 0, 3.4, 23, 10, 'plaster', 'plaster');
  for (const [base, top, n] of [
    [12, 19, 2],
    [19, 26, 4],
    [26, 33, 4],
  ]) {
    if (d) {
      const hs = Array.from({ length: n }, (_, i) =>
        hole(
          ((i + 0.5) * 17) / n - 8.5,
          base + 0.5,
          17 / n - 1.3,
          top - base - 1.3,
          true,
          d === 1 ? 2 : 6,
        ),
      );
      polygon(
        q,
        [
          [-8.5, base],
          [8.5, base],
          [8.5, top],
          [-8.5, top],
        ],
        5,
        1,
        'plaster',
        'plaster',
        hs,
      );
    } else rect(q, 0, base, 5, 17, top - base, 1, 'plaster', 'plaster');
  }
  hip(q, 25, 12, 35, 37, 'tile', 'tile');
}
function otherWings(o, d) {
  // West courtyard: King's Hall, roofless library and Ruprecht upper rooms.
  const kings = local(o, -20, 29);
  rect(kings, 0, 0, 0, 35, 24, 17, 'warm');
  hip(kings, 36, 18, 24, 32, 'tile', 'tile');
  for (const sign of [-1, 1])
    windows(local(kings, 0, sign * 8.55, sign < 0 ? Math.PI : 0), 33, 0, [[15, 4]], 6, d);
  ruin(o, 23, 29, 42, 17, 31, d, {
    angle: Math.PI,
    color: 'warm',
    n: 7,
    rows: [
      [14.5, 3.5],
      [22.5, 3.8],
    ],
    backWindows: false,
  });
  if (d >= 2) {
    const oriel = local(o, 26, 19);
    rect(oriel, 0, 22, 0, 4, 5, 3, 'warm');
    hip(oriel, 4.6, 4, 27, 30);
    windows(oriel, 3, 1.54, [[23, 2.8]], 1, d);
  }
  // South economy wing joins gate to the broken powder tower.
  const south = local(o, 57, -30, Math.PI / 2);
  rect(south, 0, 0, 0, 84, 25, 17, 'plaster', 'plaster');
  hip(south, 85, 18, 25, 32, 'tile', 'tile');
  windows(
    local(south, 0, 8.55),
    80,
    0,
    [
      [16, 3],
      [21, 2],
    ],
    14,
    d,
  );
  windows(
    local(south, 0, -8.55, Math.PI),
    80,
    0,
    [
      [16, 3],
      [21, 2],
    ],
    14,
    d,
  );
  // Low entrance range bridges the gate to Ruprecht, leaving the inner court open.
  const porter = local(o, 47.5, 32);
  rect(porter, 0, 0, 0, 7, 20, 8, 'warm');
  hip(porter, 8, 9, 20, 24, 'tile', 'tile');
  windows(local(porter, 0, -4.03, Math.PI), 6, 0, [[14, 3.4]], 2, d);
  // Barrel building: flat rooftop terrace, never a pitched roof.
  const barrel = local(o, -59, 27, Math.PI / 2);
  rect(barrel, 0, 0, 0, 21, 27, 20, 'warm');
  rect(barrel, 0, 27, 0, 21, 0.5, 20, 'paving');
  for (const sign of [-1, 1]) {
    rect(barrel, 0, 27.5, sign * 9.8, 21, 1.2, 0.6, 'trim');
    windows(local(barrel, 0, sign * 10.02, sign < 0 ? Math.PI : 0), 19, 0, [[16, 7]], 3, d);
  }
  if (d >= 2) for (const x of [-7, 0, 7]) rect(barrel, x, 16, 10.13, 0.45, 7, 0.3, 'trim');
}
function grounds(o, d) {
  // Court and northern Altan are architectural slabs; no invented terrain pedestal.
  rect(o, 0, 11.5, -17, 92, 0.5, 84, 'paving');
  rect(o, -70, 0, -4, 16, 12, 73, 'warm');
  rect(o, -78, 12, -4, 1.5, 1.5, 73, 'warm');
  for (const z of [-40, 32]) rect(o, -70, 12, z, 16, 1.5, 1.5, 'warm');
  // Lower outer shielding keeps the west Hirschgraben23m wide.
  rect(o, 27, 0, 44, 91, 10, 7, 'warm');
  rect(o, 33, 0, 73, 106, 12, 2.3, 'warm');
  rect(o, 84, 0, 86, 2.3, 12, 28, 'warm');
  rect(o, 33, 0, 100, 106, 12, 2.3, 'warm');
  // Twenty-metre entrance bridge leaves the southern moat open.
  rect(o, 79, 11, 21, 20, 1, 7, 'paving');
  for (const z of [17.7, 24.3]) rect(o, 79, 12, z, 20, 1, 0.6, 'trim');
  if (d) for (const x of [74, 84]) rect(o, x, 0, 21, 1.5, 11, 5, 'warm');
  if (d) {
    const q = local(o, 84, 74, Math.PI / 2);
    const h = hole(0, 12, 3.8, 4.8, true, 6);
    polygon(
      q,
      [
        [-3.5, 12],
        [-1.9, 12],
        ...h.slice(2).reverse(),
        [1.9, 12],
        [3.5, 12],
        [3.5, 19],
        [-3.5, 19],
      ],
      0,
      1.5,
      'trim',
    );
    rect(q, 0, 19, 0, 8, 0.8, 2, 'trim');
  }
}
export function buildHeidelbergRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  grounds(o, d);
  friedrich(o, d);
  gateTower(o, d);
  bellTower(o, d);
  otherWings(o, d);
  hallGlass(o, d);
  // Eastern Ottheinrich facade faces +Z into the court, upper storeys open to sky.
  ruin(o, -5, -67, 49, 19, 35, d, { n: 8 });
  hollowRound(o, -7, -87, 12.6, 2.5, 0, 37.5, [6, 12, 16, 20][d], d, d >= 2);
  // English wing follows the northwest wall toward Dicker Turm.
  const english = local(o, -45, 59, -1.12);
  ruin(english, 0, 0, 41, 15, 32, d, {
    n: 7,
    rows: [
      [18, 3.5],
      [25, 3.5],
    ],
    angle: Math.PI,
    backWindows: true,
  });
  brokenTower(o, -32, 83, 15, 7, 32, d, -0.8, Math.PI * 1.25);
  brokenTower(o, 62, -88, 15, 6.5, 32, d, 0.15, Math.PI * 1.45);
  // Detached powder-tower wedge in the moat, identifiable at every level.
  const fallen = local(o, 82, -91, 0.25);
  polygon(
    fallen,
    [
      [-8, 0],
      [10, 0],
      [8, 6],
      [-5, 12],
      [-9, 9],
    ],
    0,
    7,
    'warm',
  );
}
export const buildHeidelbergSkyline = (o) =>
  buildHeidelbergRuntime(
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
export const heidelbergStudy = {
  id: 'N0267',
  key: 'heidelberg_castle',
  title: 'Heidelberg Castle',
  category: 'castle',
  wikidataId: 'Q327265',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildHeidelbergRuntime(o),
  brief:
    'Present-day red-sandstone palace ruins around an open court: restored twin-gabled Friedrich wing, roofless Ottheinrich and English wings, broken defensive towers and52m gate.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: heidelbergPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Twin Friedrich gables and slate roof above the northern terrace',
      'Roofless Ottheinrich and English wings with true through-openings',
      'Broken round towers, fallen powder-tower wall and curved-roof gate tower',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/254154168 exact Wikidata Q327265',
    publishedGateHeightMeters: 52,
    publishedGateMoatWidthMeters: 20,
    publishedWestMoatWidthMeters: 23,
  },
  reconstruction: {
    basis: 'Official current-site isometry, owner photographs and OSM site boundary',
    scope:
      'Main castle and immediate defensive terraces; no distant gardens, interiors or terrain mesh',
  },
  scaleBasis:
    'Mapped273.118×214.468m site frame includes garden grounds. Individual wing footprints and heights reconstructed from owner plan/photos; gate52m from moat base, courtyard12m. No extrusion of the entire site boundary. Terrain attachment pending.',
  refs: [
    'https://www.schloss-heidelberg.de/en/visitor-experience/castle-garden/buildings',
    'https://www.schloss-heidelberg.de/fileadmin/Broschueren/Abrissplaene/ssg_schloss-heidelberg_kunstfuehrer-lageplan.pdf',
    'https://www.schloss-heidelberg.de/wissenswert-amuesant/geschichtshaeppchen',
    'https://www.openstreetmap.org/way/254154168',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original reconstruction under repository license. OSM frame © OpenStreetMap contributors, ODbL-1.0. Owner references linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0; owner plans and photographs used as research.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X approximately south',
    front: '+Z approximately west',
    origin: 'Mapped site center; lowest moat foundations Y=0, court Y=12m',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 12,
    notes:
      'Signed frame from south gate/north terrace; manually reconstructed wings and12m court datum need hillside/moat terrain review.',
    reviewStatus: 'Research frame only; actual terrain seating pending',
  }),
  geographicNote:
    'Site envelope includes gardens and is not a building footprint. Component coordinates and elevations are reconstructed and require real-site fit review before activation.',
  limitations: [
    'Simplified current exterior, not a historical reconstruction or measured survey.',
    'No unique textures, sculptures in full detail, palace interiors, terrain or distant gardens.',
    'Hillside contact, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve Heidelberg-specific restored/ruined wing contrast, twin gables, broken towers and open courtyard at all levels.',
  mediumFiContext: { scale: '3', neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  camera: { position: [235, 180, 270], lookAt: [-4, 23, 0], fov: 43 },
  qaCameras: [
    { name: 'south-gate-and-broken-tower', position: [230, 100, -60], lookAt: [38, 25, -25] },
    { name: 'north-terrace-and-friedrich', position: [-230, 100, 5], lookAt: [-48, 26, 0] },
    { name: 'west-english-wing', position: [-10, 110, 220], lookAt: [-25, 24, 48] },
    { name: 'east-ruined-wings', position: [5, 115, -220], lookAt: [-10, 25, -50] },
    { name: 'courtyard-facades', position: [25, 46, 2], lookAt: [-40, 28, -30] },
    { name: 'compound-plan', position: [0, 365, 1], lookAt: [0, 12, 0] },
  ],
};
