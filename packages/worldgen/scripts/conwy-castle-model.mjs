/** Present-day Conwy: eight open towers, four stair turrets and two roofless wards. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcm/n0270_conwy_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const conwyPalette = {
  stone: '#babcb4',
  coping: '#c9c2ae',
  pink: '#c9aa92',
  paving: '#b1ab9c',
  slate: '#60656a',
  wood: '#a18b68',
  grass: '#859f67',
};
const colors = Object.fromEntries(
  Object.entries(conwyPalette).map(([k, hex]) => [
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
const rect = (o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') =>
  box(o, slot, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], colors[col]);
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
function face(o, p, col = 'stone', slot = 'limestone', up = false) {
  if (up && normalFor(...p.slice(0, 3))[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t),
      axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
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
function slab(o, points, y, col = 'paving', slot = 'limestone') {
  const ids = earcut(points.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      col,
      slot,
      true,
    );
}
function wall(o, a, b, base, top, thick = 3, col = 'stone', slot = 'limestone') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  rect(q, 0, base, 0, len, top - base, thick, col, slot);
}
// True pointed openings through thick masonry, with a polygonal arch soffit.
function opening(o, x, z, base, sill, width, head, top, depth, d) {
  if (sill > base) rect(o, x, base, z, width, sill - base, depth);
  const spring = head - width * 0.5,
    n = d >= 2 ? 6 : 2;
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const u = -1 + (2 * i) / n;
    return [x + (u * width) / 2, spring + Math.sqrt(1 - Math.abs(u)) * width * 0.5];
  });
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(o, [
      [a[0], a[1], z + depth / 2],
      [b[0], b[1], z + depth / 2],
      [b[0], top, z + depth / 2],
      [a[0], top, z + depth / 2],
    ]);
    face(o, [
      [b[0], b[1], z - depth / 2],
      [a[0], a[1], z - depth / 2],
      [a[0], top, z - depth / 2],
      [b[0], top, z - depth / 2],
    ]);
    face(
      o,
      [
        [a[0], a[1], z - depth / 2],
        [b[0], b[1], z - depth / 2],
        [b[0], b[1], z + depth / 2],
        [a[0], a[1], z + depth / 2],
      ],
      'pink',
      'sandstone',
    );
  }
  face(
    o,
    [
      [x - width / 2, top, z - depth / 2],
      [x - width / 2, top, z + depth / 2],
      [x + width / 2, top, z + depth / 2],
      [x + width / 2, top, z - depth / 2],
    ],
    'stone',
    'limestone',
    true,
  );
  if (d >= 2)
    for (const side of [-1, 1])
      rect(
        o,
        x + side * (width / 2 + 0.2),
        sill,
        z,
        0.4,
        spring - sill,
        depth + 0.12,
        'pink',
        'sandstone',
      );
}
function piercedWall(o, a, b, base, top, thick, holes, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
  let cursor = 0;
  for (const h of holes) {
    const x = h.at * len,
      left = x - h.width / 2,
      right = x + h.width / 2;
    if (left > cursor) rect(q, (cursor + left) / 2, base, 0, left - cursor, top - base, thick);
    opening(q, x, 0, base, h.sill, h.width, h.head, top, thick, d);
    cursor = right;
  }
  if (cursor < len) rect(q, (cursor + len) / 2, base, 0, len - cursor, top - base, thick);
}
function circular(
  o,
  x,
  z,
  r,
  inner,
  base,
  top,
  n,
  d,
  { windows = false, merlons = 0, col = 'stone', slot = 'limestone' } = {},
) {
  const at = (a, y, rr) => [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
  const levels = windows && d >= 2 ? [base, 7, 10, 14, 17, top] : [base, top];
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n,
        b = (2 * Math.PI * (i + 1)) / n,
        y0 = levels[j - 1],
        y1 = levels[j];
      const hole =
        windows && d >= 2 && [2, 4].includes(j) && i % Math.max(1, Math.floor(n / 4)) === 0;
      const po = [at(a, y0, r), at(b, y0, r), at(b, y1, r), at(a, y1, r)];
      const pi = [at(b, y0, inner), at(a, y0, inner), at(a, y1, inner), at(b, y1, inner)];
      // Clockwise outward winding for an XZ ring viewed from above.
      if (!hole) {
        face(o, [...po].reverse(), col, slot);
        face(o, [...pi].reverse(), col, slot);
      } else {
        face(
          o,
          [at(a, y0, r), at(a, y1, r), at(a, y1, inner), at(a, y0, inner)],
          'pink',
          'sandstone',
        );
        face(
          o,
          [at(b, y1, r), at(b, y0, r), at(b, y0, inner), at(b, y1, inner)],
          'pink',
          'sandstone',
        );
        face(
          o,
          [at(a, y0, r), at(b, y0, r), at(b, y0, inner), at(a, y0, inner)],
          'pink',
          'sandstone',
          true,
        );
        face(
          o,
          [at(b, y1, r), at(a, y1, r), at(a, y1, inner), at(b, y1, inner)],
          'pink',
          'sandstone',
        );
      }
    }
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      b = (2 * Math.PI * (i + 1)) / n;
    face(o, [at(a, top, r), at(b, top, r), at(b, top, inner), at(a, top, inner)], col, slot, true);
  }
  if (merlons)
    for (let i = 0; i < merlons; i++) {
      const a = (2 * Math.PI * i) / merlons,
        q = local(o, x + Math.cos(a) * (r - 0.5), z + Math.sin(a) * (r - 0.5), Math.PI / 2 - a);
      rect(q, 0, top, 0, r * 0.31, 1.4, 1.05, col, slot);
      if (d === 3) {
        const w = r * 0.31;
        face(
          q,
          [
            [-w / 2, top + 1.4, -0.56],
            [w / 2, top + 1.4, -0.56],
            [w / 2, top + 1.62, 0],
            [-w / 2, top + 1.62, 0],
          ],
          'coping',
          'limestone',
          true,
        );
        face(
          q,
          [
            [-w / 2, top + 1.62, 0],
            [w / 2, top + 1.62, 0],
            [w / 2, top + 1.4, 0.56],
            [-w / 2, top + 1.4, 0.56],
          ],
          'coping',
          'limestone',
          true,
        );
      }
    }
}
function tower(o, t, d) {
  const [x, z] = t.center,
    r = t.radius,
    n = [6, 12, 16, 24][d];
  circular(o, x, z, r, r - 2.1, 0, 22, n, d, { windows: true, merlons: d ? 10 : 0 });
  const floor = Array.from({ length: n }, (_, i) => [
    x + (r - 2.1) * Math.cos((i * 2 * Math.PI) / n),
    z + (r - 2.1) * Math.sin((i * 2 * Math.PI) / n),
  ]);
  slab(o, floor, 2);
  if (t.turret) {
    const tx = x + t.turret[0],
      tz = z + t.turret[1];
    circular(o, tx, tz, 1.85, 1.1, 20.5, d ? 29.2 : 30, [6, 8, 12, 16][d], d);
    // The small stair-turret crown stays at 30m in every level.
    if (d)
      for (let i = 0; i < 5; i++) {
        const a = (2 * Math.PI * i) / 5;
        rect(
          local(o, tx + 1.4 * Math.cos(a), tz + 1.4 * Math.sin(a), Math.PI / 2 - a),
          0,
          29.2,
          0,
          0.9,
          0.8,
          0.9,
        );
      }
  }
  if (t.roof) {
    // Restored chapel roof is recessed below its open parapet, as in the current aerial.
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n,
        b = (2 * Math.PI * (i + 1)) / n;
      face(
        o,
        [
          [x + (r - 2.05) * Math.cos(a), 18, z + (r - 2.05) * Math.sin(a)],
          [x + (r - 2.05) * Math.cos(b), 18, z + (r - 2.05) * Math.sin(b)],
          [x, 20, z],
        ],
        'slate',
        'slate',
        true,
      );
    }
  }
  if (d >= 2) {
    // Broad corbel/wall-walk ledge around the chamber, without individual stone blocks.
    circular(o, x, z, r + 0.13, r - 0.45, 19.6, 20.15, n, d);
  }
}
const north = [
  [-47.2, -16.2],
  [-19.5, -17.1],
  [8.65, -19.5],
  [37.5, -20.9],
];
const south = [
  [-46.4, 8.2],
  [-36.4, 12.1],
  [-18.8, 18.1],
  [9.6, 11.8],
  [40.8, 5.6],
];
function curtains(o, d) {
  for (let i = 1; i < north.length; i++) {
    const a = north[i - 1],
      b = north[i];
    if (d >= 2)
      piercedWall(
        o,
        a,
        b,
        0,
        16,
        3,
        [
          { at: 0.35, sill: 9, width: 0.55, head: 12 },
          { at: 0.7, sill: 9, width: 0.55, head: 12 },
        ],
        d,
      );
    else wall(o, a, b, 0, 16);
    // Narrow parapet follows the outside; interior edge stays walkable.
    if (d) wall(o, [a[0], a[1] - 1], [b[0], b[1] - 1], 16, 17.2, 1);
  }
  for (let i = 1; i < south.length; i++) {
    const a = south[i - 1],
      b = south[i];
    if (d)
      piercedWall(
        o,
        a,
        b,
        0,
        16,
        3,
        [
          { at: 0.28, sill: 8.5, width: 1.9, head: 12.8 },
          { at: 0.67, sill: 8.5, width: 1.9, head: 12.8 },
        ],
        d,
      );
    else wall(o, a, b, 0, 16);
    if (d) wall(o, [a[0], a[1] + 1], [b[0], b[1] + 1], 16, 17.2, 1);
  }
  piercedWall(
    o,
    [-45, -16],
    [-43.9, 9],
    0,
    17,
    2.8,
    [{ at: 0.54, sill: 2, width: 3.4, head: 7 }],
    d,
  );
  piercedWall(
    o,
    [8.65, -19.5],
    [9.6, 11.8],
    0,
    17,
    3,
    [{ at: 0.56, sill: 2, width: 2.7, head: 6 }],
    d,
  );
  piercedWall(
    o,
    [37.5, -20.9],
    [40.8, 5.6],
    0,
    16,
    3,
    [{ at: 0.6, sill: 2, width: 2.6, head: 6 }],
    d,
  );
  if (d >= 2) {
    for (const x of [-43, 8, 37])
      for (const z of [-8, 0, 4]) rect(o, x, 15.2, z, 1.1, 1.2, 1.2, 'coping');
    // Surviving short crenellations are restrained; much of the wall top is eroded.
    for (const x of [-39, -34, -29, -12, -7, -2, 19, 24, 29])
      rect(o, x, 17.2, -18.8, 1.3, 0.9, 1, 'coping');
  }
}
// Surviving transverse pointed roof arch, open above and below: no reconstructed roof.
function transverseArch(o, x, z, width, spring, peak, d) {
  const q = local(o, x, z, Math.PI / 2),
    segments = d >= 2 ? 8 : 4,
    w = width / 2,
    points = Array.from({ length: segments + 1 }, (_, i) => {
      const t = -1 + (2 * i) / segments;
      return [t * w, spring + (peak - spring) * Math.sqrt(1 - Math.abs(t))];
    });
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      thick = 0.65;
    for (const side of [-1, 1]) {
      const p = [
        [a[0], a[1], side * 0.55],
        [b[0], b[1], side * 0.55],
        [b[0], b[1] + thick, side * 0.55],
        [a[0], a[1] + thick, side * 0.55],
      ];
      face(q, side > 0 ? p : p.reverse(), 'pink', 'sandstone');
    }
    face(
      q,
      [
        [a[0], a[1] + thick, -0.55],
        [a[0], a[1] + thick, 0.55],
        [b[0], b[1] + thick, 0.55],
        [b[0], b[1] + thick, -0.55],
      ],
      'pink',
      'sandstone',
      true,
    );
    face(
      q,
      [
        [a[0], a[1], 0.55],
        [a[0], a[1], -0.55],
        [b[0], b[1], -0.55],
        [b[0], b[1], 0.55],
      ],
      'pink',
      'sandstone',
    );
  }
}
function ranges(o, d) {
  if (!d) {
    for (const [a, b] of [
      [
        [-37, 1.7],
        [-18.5, 7.6],
      ],
      [
        [-18.5, 7.6],
        [-0.7, 3.9],
      ],
      [
        [-37, 1.7],
        [-39.5, 11.1],
      ],
      [
        [-0.7, 3.9],
        [3.4, 13.4],
      ],
      [
        [14, -3],
        [33, -5.1],
      ],
      [
        [30, -17.5],
        [32.4, -5],
      ],
    ])
      wall(o, a, b, 0, 13.8, 1.7);
    return;
  }
  const front = [
    [-37, 1.7],
    [-30.7, 3.5],
    [-18.5, 7.6],
    [-0.7, 3.9],
  ];
  for (let i = 1; i < front.length; i++) {
    if (d)
      piercedWall(
        o,
        front[i - 1],
        front[i],
        0,
        13.8,
        1.7,
        [
          {
            at: 0.5,
            sill: i === 1 ? 6.5 : 2,
            width: i === 1 ? 1.8 : 2.6,
            head: i === 1 ? 11 : 7.5,
          },
        ],
        d,
      );
    else wall(o, front[i - 1], front[i], 0, 13.8, 1.7);
  }
  wall(o, [-37, 1.7], [-39.5, 11.1], 0, 15, 1.7);
  wall(o, [-0.7, 3.9], [3.4, 13.4], 0, 15.5, 1.7);
  for (const [a, b] of [
    [
      [-29, 4.2],
      [-31.5, 13.8],
    ],
    [
      [-26, 5.2],
      [-29, 14.7],
    ],
    [
      [-10, 5.8],
      [-7, 16.3],
    ],
  ])
    wall(o, a, b, 0, d ? 5.2 : 3, 1.2);
  slab(
    o,
    [
      [-38, 2],
      [-18, 7],
      [-1, 3.9],
      [3, 13],
      [-18, 18],
      [-40, 11],
    ],
    0.2,
  );
  if (d) {
    transverseArch(o, -4, 9.7, 11, 12.7, 16.7, d);
    // Broken haunches in the great hall are broad fragments, not a complete bay arcade.
    for (const x of [-33, -28, -23, -18, -13])
      for (const side of [-1, 1]) {
        const z = 12 + side * 4.6,
          q = local(o, x, z);
        face(
          q,
          [
            [-0.6, 12, 0],
            [0.6, 12, 0],
            [0.6, 13.7, -side * 1.7],
            [-0.6, 13.7, -side * 1.7],
          ],
          'pink',
          'sandstone',
          true,
        );
      }
  }
  // L-shaped royal range: south hall/chamber and eastern great chamber, all roofless.
  piercedWall(
    o,
    [14, -3],
    [33, -5.1],
    0,
    13.5,
    1.5,
    d
      ? [
          { at: 0.22, sill: 2, width: 2.2, head: 5.5 },
          { at: 0.57, sill: 7, width: 2, head: 10.7 },
          { at: 0.84, sill: 7, width: 2, head: 10.7 },
        ]
      : [],
    d,
  );
  wall(o, [14, -3], [14, 10], 0, 13.5, 1.5);
  wall(o, [24, -4.1], [24, 7.6], 0, d ? 5.5 : 3, 1.1);
  piercedWall(
    o,
    [30, -17.5],
    [32.4, -5],
    0,
    13.5,
    1.5,
    d ? [{ at: 0.45, sill: 6.7, width: 2.2, head: 10.5 }] : [],
    d,
  );
  wall(o, [30, -17.5], [37.7, -18.5], 0, 13.5, 1.5);
  wall(o, [32.4, -5], [39.4, -5], 0, 13.5, 1.5);
  if (d) transverseArch(o, 25, 1.65, 12, 12.5, 16.5, d);
  // Low kitchen, guardroom and granary footings follow the plan without invented roofs.
  for (const [a, b] of [
    [
      [-40, -10],
      [-29, -10],
    ],
    [
      [-29, -10],
      [-29, -16],
    ],
    [
      [-24, -8],
      [-1, -10],
    ],
    [
      [-1, -10],
      [-1, -18],
    ],
    [
      [17, -13],
      [27, -13],
    ],
    [
      [17, -13],
      [17, -20],
    ],
    [
      [-40, -10],
      [-40, -16],
    ],
    [
      [-40, 2],
      [-42, 8],
    ],
  ])
    wall(o, a, b, 2, d ? 3 : 2.7, 0.85);
  if (d) circular(o, 2, -3, 1.9, 1.25, 2, 3.2, 12, d);
  if (d >= 2) {
    // Present visitor bridge spans the lowered great-hall floor.
    rect(o, -4, 5.9, 9.4, 1.9, 0.4, 11, 'wood', 'wood');
    for (const x of [-5, -3]) {
      wall(o, [x, 4], [x, 15], 6.8, 7.05, 0.25, 'wood', 'wood');
      for (const z of [4, 7.6, 11.2, 14.8]) rect(o, x, 6, z, 0.25, 1.1, 0.25, 'wood', 'wood');
    }
  }
}
function barbicans(o, d) {
  const west = [
      [-54.8, 8],
      [-57.5, -9],
      [-60, -21],
    ],
    east = [
      [43.8, -22],
      [49, -24],
      [56.8, -14],
      [59, -1.2],
      [45, 7],
    ];
  for (const p of [west, east])
    for (let i = 1; i < p.length; i++) wall(o, p[i - 1], p[i], 0, 8.1, 1.5);
  wall(o, [-54.8, 8], [-47, 10], 0, 8.1, 1.5);
  // North-facing approach to the western barbican: one open gate, no solid road slab.
  piercedWall(o, [-60, -21], [-49, -23], 0, 9, 1.7, [{ at: 0.5, sill: 2, width: 2.8, head: 6 }], d);
  if (d)
    for (const [x, z] of [
      [-55.3, 7],
      [-57.4, -6],
      [-59, -18.5],
      [49, -24],
      [56.8, -14],
      [59, -1.2],
    ])
      circular(o, x, z, 1.8, 1.1, 0, 9, [6, 8, 12, 16][d], d);
  slab(
    o,
    [
      [-55, 8],
      [-58, -9],
      [-60, -21],
      [-49, -23],
      [-45, -16],
      [-45, 8],
    ],
    2,
  );
  slab(o, [...east, [39, 4], [38, -19]], 2);
  if (d >= 2)
    for (const p of [west, east])
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1],
          b = p[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          q = local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
        for (let x = 1; x < len - 0.5; x += 2.8) rect(q, x, 8.1, 0, 1.4, 1, 1.5);
      }
}
export function buildConwyRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  // Open wards with distinct internal grass and circulation; no fabricated terrain hill.
  slab(
    o,
    [
      [-44, -15],
      [8, -18],
      [8, 10],
      [-18, 7],
      [-37, 1],
      [-43, 4],
    ],
    2,
  );
  slab(
    o,
    [
      [12, -18],
      [29, -19],
      [31, -6],
      [14, -3],
      [14, 9],
      [11, 10],
    ],
    2,
  );
  if (d) {
    slab(
      o,
      [
        [-34, -7],
        [-3, -9],
        [-1, -1],
        [-16, 3],
        [-35, -1],
      ],
      2.03,
      'grass',
      'foliage',
    );
    slab(
      o,
      [
        [15, -10],
        [27, -12],
        [28, -7],
        [16, -4],
      ],
      2.03,
      'grass',
      'foliage',
    );
  }
  for (const t of frame.towers) tower(o, t, d);
  curtains(o, d);
  ranges(o, d);
  barbicans(o, d);
}
export const buildConwySkyline = (o) =>
  buildConwyRuntime(
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
            c.map((v) => v * (s === 'foliage' ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const conwyStudy = {
  id: 'N0270',
  key: 'conwy_castle',
  title: 'Conwy Castle',
  category: 'castle',
  wikidataId: 'Q756830',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildConwyRuntime(o),
  brief:
    'Present-day roofless Conwy Castle: eight open round towers, four tall inner-ward stair turrets, bent south hall range, paired open wards and low end barbicans.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: conwyPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Eight round towers and four taller eastern stair turrets',
      'Long western ward with faceted south great hall and surviving roof arch',
      'Smaller eastern royal ward, roofless L-shaped rooms and low end barbicans',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/52467063 exact Q756830',
    mappedPlanMeters: [122.293, 58.695],
    cachedUnreferencedMaximumHeightMeters: 30,
    publishedCurtainThicknessMeters: 3,
    publishedRiverRelativeHeightMeters: { curtain: 27, towers: 41 },
  },
  reconstruction: {
    basis: 'OSM perimeter/tower lobes, Cadw ground plan and current operator photographs',
    scope:
      'Castle exterior, open wards and end barbicans; no surrounding town walls, bridges, visitor facilities or invented cliff',
  },
  scaleBasis:
    'Mapped 122.293×58.695m outline and plan scale establish footprint. Cached 30m maximum is provisional and unreferenced. Tower bodies22m, crowns23.4m, turret tops30m, curtain16m and court2m are inferred. Published 27m/41m heights are above river and do not define model-ground elevations.',
  refs: [
    'https://cadw.gov.wales/visit/places-to-visit/castell-conwy',
    'https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?id=3250',
    'https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?id=3411&lang=en',
    'https://commons.wikimedia.org/wiki/File:Conwy_Castle_plan.jpg',
    'https://cadw.gov.wales/more-about-castell-conwy',
    'https://www.openstreetmap.org/way/52467063',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Contains information from the Cadw ground plan, Crown copyright, licensed under Open Government Licence v1.0; https://www.nationalarchives.gov.uk/doc/open-government-licence/version/1/. Reference photographs linked, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. Cadw plan: Crown copyright, Open Government Licence v1.0. Current Cadw photographs used as visual references only.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 2,
    notes:
      'River-facing east barbican resolves +X east. Actual rock, court and west entry fit require review; inferred heights are not a survey.',
    reviewStatus: 'Research frame only; terrain seating pending',
  }),
  geographicNote:
    'Map-aligned perimeter and named plan components resolve orientation. Tower heights, internal walls and court datum remain approximate; geographic activation awaits terrain review.',
  limitations: [
    'Simplified current ruin exterior; lower interiors, fine tracery and stairs abbreviated.',
    'Tower elevations are inferred; cached30m maximum lacks a reference. River-relative published heights are distinct from model heights.',
    'Town walls, adjacent bridges, visitor buildings and natural bedrock omitted.',
    'Actual terrain seating, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve eight hollow towers, four raised stair turrets and open wards in all levels; surviving hall arches appear from district onward.',
  mediumFiContext: { scale: '1.15', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [130, 88, 145], lookAt: [0, 10, 0], fov: 43 },
  qaCameras: [
    { name: 'south-hall-and-towers', position: [-10, 50, 135], lookAt: [0, 11, 0] },
    { name: 'north-tower-row', position: [10, 45, -140], lookAt: [0, 12, -5] },
    { name: 'east-royal-turrets', position: [135, 52, -12], lookAt: [18, 13, -3] },
    { name: 'west-entry', position: [-130, 45, 10], lookAt: [-12, 11, -3] },
    { name: 'great-hall-arch', position: [-17, 7, 12], lookAt: [-3, 14, 9.5] },
    { name: 'castle-plan', position: [0, 205, 1], lookAt: [0, 2, 0] },
  ],
};
