/** Heidelberg's present-day compound: roofless Renaissance wings and broken defensive towers. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
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
    const v = (s, rad, y) => {
      const X = x + rad * Math.cos(s.a),
        Z = z + rad * Math.sin(s.a);
      return [X, y === 0 ? Math.min(11, heidelbergGround(X, Z) - (floor - 12) - 1.5) : y, Z];
    };
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
  const q = part(o, 'friedrich', 39, 18),
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
  const q = part(o, 'gate', 18, 18);
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
  o = part(o, 'bell', 20.6, 20.6);
  cylindrical(o, 0, 0, 10.3, 0, 22, [6, 12, 16, 16][d]);
  hollowRound(o, 0, 0, 8.8, 1.4, 22, 38, d ? 8 : 4, d, d > 0);
  hollowRound(o, 0, 0, 7.3, 1.2, 38, 45.5, d ? 8 : 4, d, d >= 2);
  if (d >= 2) cylindrical(o, 10, 0, 2, 12, 35, 8, 'warm');
}
function hallGlass(o, d) {
  const q = part(o, 'glasshall', 24, 10);
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
  hip(q, 25, 2.2, 33.5, 35, 'tile', 'tile');
  loft(
    q,
    'glass',
    [-12, 12].map((x) =>
      Array.from({ length: d ? 7 : 3 }, (_, i) => {
        const a = (i * Math.PI) / (d ? 6 : 2);
        return [x, 34 + Math.sin(a) * 2, -0.8 + Math.cos(a) * 4.1];
      }),
    ),
    colors.glass,
  );
}

const frame = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u0/u0y/n0267_heidelberg_castle/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u0/u0y/n0267_heidelberg_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    sandstone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
  };
export function heidelbergGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
const floor = grade.workingCourtFloor;
function part(o, name, w, dep, level = floor) {
  const p = frame.reviewedParts[name],
    c = Math.cos(p.angle),
    s = Math.sin(p.angle),
    sx = p.width / w,
    sz = p.depth / dep;
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, ps, _n, uv, col) => {
        const mapped = ps.map(([x, y, z]) => {
          const X = p.center[0] + c * x * sx + s * z * sz,
            Z = p.center[1] - s * x * sx + c * z * sz;
          return [
            X,
            y === 0 ? Math.min(level - 1, heidelbergGround(X, Z) - 1.5) : y - 12 + level,
            Z,
          ];
        });
        o[k](slot, ref, mapped, normalFor(...mapped.slice(0, 3)), uv, col);
      },
    ]),
  );
}
function flat(o, y) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, r, p, n, uv, c) =>
        o[k](
          slot,
          r,
          p.map((v) => [v[0], v[1] + y, v[2]]),
          n,
          uv,
          c,
        ),
    ]),
  );
}
function slab(o, p, y, color = 'paving') {
  const ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      color,
      'sandstone',
      true,
    );
}
function footing(o, p, y, color = 'wall') {
  const r = p.slice();
  if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  const area = r.reduce((n, a, i) => {
    const b = r[(i + 1) % r.length];
    return n + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area > 0) r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      [
        [...a.slice(0, 1), Math.min(y - 0.5, heidelbergGround(...a) - 1.5), a[1]],
        [b[0], Math.min(y - 0.5, heidelbergGround(...b) - 1.5), b[1]],
        [b[0], y, b[1]],
        [a[0], y, a[1]],
      ],
      color,
    );
  }
  slab(o, r, y, color);
}
function roofed(o, name, w, dep, eave, top, d, color = 'warm', roof = 'tile') {
  const q = part(o, name, w, dep);
  rect(q, 0, 0, 0, w, eave, dep, color, color === 'plaster' ? 'plaster' : 'sandstone');
  hip(q, w + 0.5, dep + 0.5, eave, top, roof, roof);
  for (const s of [-1, 1])
    windows(
      local(q, 0, s * (dep / 2 + 0.05), s < 0 ? Math.PI : 0),
      w - 0.8,
      0,
      [
        [14, 2.8],
        [20, 2.3],
      ].filter((r) => r[0] + r[1] < eave),
      Math.max(2, Math.round(w / 5)),
      d,
    );
}
function otherWings(o, d) {
  roofed(o, 'kings', 35, 17, 24, 32, d);
  roofed(o, 'ruprecht', 33, 17, 22, 29, d);
  roofed(o, 'economy', 48, 18, 25, 32, d, 'plaster');
  const barrel = part(o, 'barrel', 21, 20);
  rect(barrel, 0, 0, 0, 21, 27, 20, 'warm');
  rect(barrel, 0, 27, 0, 21, 0.5, 20, 'paving');
  for (const s of [-1, 1]) {
    rect(barrel, 0, 27.5, s * 9.8, 21, 1.2, 0.6, 'trim');
    windows(local(barrel, 0, s * 10.02, s < 0 ? Math.PI : 0), 19, 0, [[16, 7]], 3, d);
  }
  ruin(part(o, 'library', 22, 18), 0, 0, 22, 18, 29, d, {
    n: 4,
    backWindows: true,
    rows: [
      [15, 3],
      [22, 3],
    ],
  });
  ruin(part(o, 'ludwig', 38, 15), 0, 0, 38, 15, 27, d, {
    n: 6,
    backWindows: false,
    rows: [
      [15, 3],
      [21, 3],
    ],
  });
  roofed(o, 'fountain', 8.5, 5.5, 18, 22, d, 'plaster');
}
function grounds(o, d) {
  footing(o, grade.courtOutline, floor, 'paving');
  const p = frame.reviewedParts.altan.outline;
  footing(o, p, floor, 'warm');
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d && len > 2)
      rect(
        local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0])),
        0,
        floor,
        0,
        len,
        1.2,
        0.6,
        'warm',
      );
  }
  const [a, b] = [grade.bridgeInner, grade.bridgeOuter],
    ya = grade.gateFloor,
    yb = grade.bridgeOuterFloor,
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  loft(
    q,
    'sandstone',
    [
      [-len / 2, ya],
      [len / 2, yb],
    ].map(([x, y]) => [
      [x, y - 0.7, -2.3],
      [x, y, -2.3],
      [x, y, 2.3],
      [x, y - 0.7, 2.3],
    ]),
    colors.paving,
  );
  for (const s of [-1, 1])
    loft(
      q,
      'sandstone',
      [
        [-len / 2, ya],
        [len / 2, yb],
      ].map(([x, y]) => [
        [x, y, s * 2.3 - 0.25],
        [x, y + 1, s * 2.3 - 0.25],
        [x, y + 1, s * 2.3 + 0.25],
        [x, y, s * 2.3 + 0.25],
      ]),
      colors.trim,
    );
  for (const [p, y] of [
    [a, ya],
    [b, yb],
  ])
    rect(
      o,
      p[0],
      heidelbergGround(...p) - 1.5,
      p[1],
      1.2,
      Math.max(0.5, y - heidelbergGround(...p) + 0.8),
      4.6,
      'warm',
    );
  const gate = part(o, 'torhaus', 14, 8, grade.bridgeOuterFloor),
    h = hole(0, 12, 4.6, 5, true, d ? 6 : 2);
  polygon(
    gate,
    [[-7, 12], [-2.3, 12], ...h.slice(2).reverse(), [2.3, 12], [7, 12], [7, 21], [-7, 21]],
    0,
    8,
    'warm',
  );
  hip(gate, 15, 9, 21, 26, 'tile', 'tile');
  const e = part(o, 'elisabeth', 11.25, 1.08, grade.elisabethFloor),
    h2 = hole(0, 12, 3.8, 4.8, true, d ? 6 : 2);
  polygon(
    e,
    [[-5.6, 12], [-1.9, 12], ...h2.slice(2).reverse(), [1.9, 12], [5.6, 12], [5.6, 19], [-5.6, 19]],
    0,
    1.08,
    'trim',
  );
  // Retaining walls bound only the visible western court/garden; no whole-precinct pedestal.
  for (const [a, b] of [
    [
      [-38, 65],
      [78, 76],
    ],
    [
      [78, 76],
      [90, 68],
    ],
    [
      [-38, 100],
      [92, 105],
    ],
    [
      [92, 105],
      [90, 68],
    ],
  ]) {
    const q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0])),
      top = grade.gardenFloor;
    loft(
      q,
      'sandstone',
      [a, b].map((p, i) => {
        const x = (i - 0.5) * Math.hypot(b[0] - a[0], b[1] - a[1]),
          low = heidelbergGround(...p) - 1.5,
          wallTop = Math.max(top, low + 2);
        return [
          [x, low, -0.8],
          [x, wallTop, -0.8],
          [x, wallTop, 0.8],
          [x, low, 0.8],
        ];
      }),
      colors.warm,
    );
  }
}
function reviewed(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level],
    out = !d
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
            k,
            (s, r, p, n, uv, c) =>
              n[1] >= -0.98 &&
              o[k](
                s,
                r,
                p,
                n,
                uv,
                c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)),
              ),
          ]),
        )
      : o;
  grounds(out, d);
  friedrich(out, d);
  gateTower(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          out[k](
            s,
            r,
            p.map((v) => [v[0], v[1] + grade.gateFloor - floor, v[2]]),
            n,
            uv,
            c,
          ),
      ]),
    ),
    d,
  );
  bellTower(out, d);
  hallGlass(out, d);
  otherWings(out, d);
  ruin(part(out, 'ottheinrich', 37, 25), 0, 0, 37, 25, 35, d, { n: 8 });
  hollowRound(
    part(out, 'apothecary', 22, 22),
    0,
    0,
    11,
    2.5,
    0,
    37.5,
    [6, 12, 16, 20][d],
    d,
    d >= 2,
  );
  ruin(part(out, 'english', 37, 23), 0, 0, 37, 23, 32, d, {
    n: 7,
    rows: [
      [18, 3.5],
      [25, 3.5],
    ],
    angle: Math.PI,
    backWindows: true,
  });
  const dk = frame.reviewedParts.dicker,
    k = frame.reviewedParts.kraut;
  brokenTower(flat(out, floor - 12), ...dk.center, 14.5, 7, 32, d, -0.8, Math.PI * 1.25);
  brokenTower(flat(out, floor - 12), ...k.center, 12, 6.5, 32, d, 0.15, Math.PI * 1.45);
  const fallen = local(
    flat(out, heidelbergGround(k.center[0] + 19, k.center[1] - 3)),
    k.center[0] + 19,
    k.center[1] - 3,
    0.25,
  );
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
export const buildHeidelbergReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildHeidelbergReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildHeidelbergReviewedDistrict = (o) => reviewed(o, 'district');
export const buildHeidelbergReviewedStreet = (o) => reviewed(o, 'street');
export const buildHeidelbergReviewedCloseup = (o) => reviewed(o, 'closeup');
