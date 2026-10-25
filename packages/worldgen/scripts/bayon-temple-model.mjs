/** Bayon's specific galleries and stone face towers; secondary positions are declared estimates. */
export const bayonCandidateId = 'bayon';
function box(f, role, x, y, z, w, h, d) {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - d / 2,
    e = z + d / 2,
    t = y + h;
  for (const [ps, n] of [
    [
      [
        [a, y, c],
        [a, t, c],
        [a, t, e],
        [a, y, e],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, c],
        [b, t, c],
        [b, t, e],
        [b, y, e],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, y, c],
        [b, y, c],
        [b, t, c],
        [a, t, c],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, e],
        [b, y, e],
        [b, t, e],
        [a, t, e],
      ],
      [0, 0, 1],
    ],
    [
      [
        [a, t, c],
        [b, t, c],
        [b, t, e],
        [a, t, e],
      ],
      [0, 1, 0],
    ],
    [
      [
        [a, y, c],
        [b, y, c],
        [b, y, e],
        [a, y, e],
      ],
      [0, -1, 0],
    ],
  ])
    f(role, ps, n);
}
function polygonPrism(f, role, ring, triangles, bottom, top) {
  for (const ids of triangles) {
    f(
      role,
      ids.map((i) => [ring[i][0], top(i), ring[i][1]]),
      [0, 1, 0],
    );
    f(
      role,
      ids.map((i) => [ring[i][0], bottom(i), ring[i][1]]),
      [0, -1, 0],
    );
  }
  const area = ring.reduce((n, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = Math.sign(area);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j];
    f(
      role,
      [
        [a[0], bottom(i), a[1]],
        [b[0], bottom(j), b[1]],
        [b[0], top(j), b[1]],
        [a[0], top(i), a[1]],
      ],
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
}
const bump = (x, m, r) => {
  const a = Math.max(0, 1 - Math.pow((x - m) / r, 2));
  return a * a;
};
/** Sculpted polynomial relief: eyelid recesses, broad nose, full cheeks and smiling lips. */
export function bayonFaceDepth(x, y) {
  const envelope = bump(x, 0, 1) * bump(y, 0, 1.05),
    smile = 0.14 * Math.pow(x / 0.65, 2),
    cheek = (bump(x, -0.48, 0.32) + bump(x, 0.48, 0.32)) * bump(y, -0.1, 0.44) * 0.19,
    nose =
      bump(x, 0, 0.31) * bump(y, 0.02, 0.56) * 0.32 +
      Math.max(0, 1 - Math.pow(x / 0.33, 4)) * bump(y, -0.16, 0.17) * 0.4,
    eyes = (bump(x, -0.36, 0.27) + bump(x, 0.36, 0.27)) * bump(y, 0.22, 0.075) * 0.18,
    brows = (bump(x, -0.36, 0.32) + bump(x, 0.36, 0.32)) * bump(y, 0.34, 0.12) * 0.13,
    lips =
      bump(x, 0, 0.64) *
      (bump(y, -0.45 + smile, 0.085) * 0.26 +
        bump(y, -0.59 + smile, 0.09) * 0.2 -
        bump(y, -0.52 + smile, 0.032) * 0.12),
    ears = (bump(x, -0.84, 0.12) + bump(x, 0.84, 0.12)) * bump(y, -0.08, 0.6) * 0.17;
  return envelope * (0.13 + cheek + nose - eyes + brows + lips) + ears;
}
function squareRing(y, r, chamfer) {
  return chamfer
    ? [
        [-r + chamfer, y, -r],
        [r - chamfer, y, -r],
        [r, y, -r + chamfer],
        [r, y, r - chamfer],
        [r - chamfer, y, r],
        [-r + chamfer, y, r],
        [-r, y, r - chamfer],
        [-r, y, -r + chamfer],
      ]
    : [
        [-r, y, -r],
        [r, y, -r],
        [r, y, r],
        [-r, y, r],
      ];
}
function loft(f, role, rings) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length,
        a = rings[j - 1][i],
        b = rings[j - 1][k];
      f(role, [a, b, rings[j][k], rings[j][i]], [b[2] - a[2], 0.01, a[0] - b[0]]);
    }
  for (const [ring, n] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), [0, 1, 0]],
  ])
    for (let i = 1; i < ring.length - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], n);
}
function tower(f, t, d, axis, mappedFootprint) {
  const foot = t.attachment === 'native-terrain' ? -1.2 : -0.8;
  if (t.central && d > 0) {
    let ps = mappedFootprint;
    const area = ps.reduce((n, a, i) => {
      const b = ps[(i + 1) % ps.length];
      return n + a[0] * b[1] - a[1] * b[0];
    }, 0);
    if (area < 0) ps = ps.toReversed();
    loft(
      f,
      'rubble',
      [
        [-0.8, 1],
        [5, 0.96],
        [8, 0.9],
      ].map(([y, scale]) =>
        ps.map(([x, z]) => [
          t.point[0] + (x - t.point[0]) * scale,
          t.baseY + y,
          t.point[1] + (z - t.point[1]) * scale,
        ]),
      ),
    );
    t = { ...t, width: t.width * 0.55, baseY: t.baseY + 8, height: t.height - 8 };
  }
  const c = Math.cos(axis),
    s = Math.sin(axis),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [
          t.point[0] + x * c - z * s,
          t.baseY + y,
          t.point[1] + x * s + z * c,
        ]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    r = t.width / 2,
    h = t.height - (t.mapped ? 5.5 : 0),
    low = h * 0.43,
    high = h * 0.68;
  if (d === 0) {
    loft(
      at,
      'wall',
      t.central
        ? [
            squareRing(foot, r, 0),
            squareRing(8, r * 0.9, 0),
            squareRing(h * 0.77, r * 0.45, 0),
            squareRing(h, r * 0.13, 0),
          ]
        : [squareRing(foot, r, 0), squareRing(h * 0.77, r * 0.8, 0), squareRing(h, r * 0.2, 0)],
    );
    return;
  }
  const detailed = d >= 2 || t.mapped;
  if (t.central && d >= 1) {
    for (const y of [4.3, 7.8, 10.8])
      box(
        at,
        'wall',
        0,
        y,
        0,
        t.width * (1.04 - (y / h) * 0.1),
        0.35,
        t.width * (1.04 - (y / h) * 0.1),
      );
    if (d >= 2)
      for (const x of [-r * 0.84, r * 0.84])
        for (const z of [-r * 0.84, r * 0.84]) box(at, 'wall', x, -0.6, z, 1.2, low + 0.6, 1.2);
  }
  if (d >= 2) {
    // Four open base portals are geometry, rather than dark painted rectangles.
    for (let face = 0; face < 4; face++) {
      const a = (face * Math.PI) / 2,
        co = Math.cos(a),
        si = Math.sin(a),
        side = (role, ps, n) =>
          at(
            role,
            ps.map(([x, y, z]) => [x * co - z * si, y, x * si + z * co]),
            [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
          ),
        door = Math.min(1.5, r * 0.38),
        top = Math.min(4, low * 0.8),
        p = (x, y, depth = 0) => [
          x * (1 - (0.07 * (y + 0.8)) / (low + 0.8)),
          y,
          r * (1 - (0.07 * (y + 0.8)) / (low + 0.8)) - depth,
        ];
      for (const [x0, x1, y0, y1] of [
        [-r, -door, foot, low],
        [door, r, foot, low],
        [-door, door, top, low],
      ])
        side('wall', [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)], [0, 0, 1]);
      for (const x of [-door, door])
        side(
          'wall',
          [p(x, foot), p(x, top), p(x, top, r * 0.4), p(x, foot, r * 0.4)],
          [x < 0 ? 1 : -1, 0, 0],
        );
      side(
        'wall',
        [p(-door, top), p(door, top), p(door, top, r * 0.4), p(-door, top, r * 0.4)],
        [0, -1, 0],
      );
    }
  } else loft(at, 'wall', [squareRing(foot, r, 0), squareRing(low, r * 0.93, 0)]);
  const xs = !detailed
      ? [-1, 1]
      : d === 1
        ? [-1, 0, 1]
        : d === 2
          ? [-1, -0.6, -0.2, 0.2, 0.6, 1]
          : d === 3
            ? [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]
            : [-1, -0.8, -0.58, -0.36, -0.18, 0, 0.18, 0.36, 0.58, 0.8, 1],
    ys = !detailed
      ? [-1, 1]
      : d === 1
        ? [-1, -0.45, 0.22, 1]
        : d === 2
          ? [-1, -0.6, -0.2, 0.2, 0.6, 1]
          : d === 3
            ? [-1, -0.8, -0.6, -0.45, -0.2, 0, 0.22, 0.35, 0.55, 0.75, 1]
            : [-1, -0.85, -0.7, -0.59, -0.45, -0.32, -0.15, 0.08, 0.22, 0.34, 0.52, 0.72, 1];
  for (let face = 0; face < 4; face++) {
    const a = (face * Math.PI) / 2,
      co = Math.cos(a),
      si = Math.sin(a),
      point = (x, y) => {
        const v = (y + 1) / 2,
          rad = r * (0.93 - 0.11 * v),
          depth = detailed ? bayonFaceDepth(x, y) * t.width * 0.16 : 0,
          px = x * rad * (detailed ? 0.75 : 1),
          pz = rad + depth;
        return [px * co - pz * si, low + v * (high - low), px * si + pz * co];
      };
    for (let j = 1; j < ys.length; j++)
      for (let i = 1; i < xs.length; i++)
        at(
          'face',
          [
            point(xs[i - 1], ys[j - 1]),
            point(xs[i], ys[j - 1]),
            point(xs[i], ys[j]),
            point(xs[i - 1], ys[j]),
          ],
          [-si, 0, co],
        );
    if (detailed) {
      const edge = (radius, y, next) => {
        const x = next ? radius : radius * 0.75,
          z = next ? radius * 0.75 : radius;
        return [x * co - z * si, y, x * si + z * co];
      };
      at(
        'face',
        [
          edge(r * 0.93, low, false),
          edge(r * 0.93, low, true),
          edge(r * 0.82, high, true),
          edge(r * 0.82, high, false),
        ],
        [co - si, 0, si + co],
      );
      if (d >= 2) {
        const corner = [r * 0.93 * (co - si), low, r * 0.93 * (si + co)];
        at('wall', [corner, edge(r * 0.93, low, false), edge(r * 0.93, low, true)], [0, 1, 0]);
      }
    }
  }
  if (d >= 2) {
    const top = squareRing(high, r * 0.82, r * 0.82 * 0.25);
    for (let i = 1; i < top.length - 1; i++) at('wall', [top[0], top[i], top[i + 1]], [0, 1, 0]);
  }
  const ch = d >= 3 ? r * 0.2 : 0,
    levels =
      d === 1
        ? [
            [high, r * 0.82],
            [h * 0.87, r * 0.61],
            [h, r * 0.2],
          ]
        : d === 2
          ? [
              [high, r * 0.95],
              [h * 0.79, r * 0.8],
              [h * 0.9, r * 0.56],
              [h, r * 0.26],
            ]
          : [
              [high, r * 0.82],
              [h * 0.76, r * 0.9],
              [h * 0.79, r * 0.85],
              [h * 0.83, r * 0.63],
              [h * 0.87, r * 0.69],
              [h * 0.9, r * 0.5],
              [h * 0.94, r * 0.53],
              [h * 0.97, r * 0.3],
              [h, r * 0.26],
            ];
  const rings = levels.map(([y, radius], j) => {
    if (d === 1) return squareRing(y, radius, ch ? Math.min(ch, radius * 0.28) : 0);
    const n = d === 2 ? 8 : 12;
    return Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n,
        seed = ((t.variation * 7 + i * 3 + j * 5) % 13) / 13 - 0.5,
        rad = radius * (1 + seed * 0.1),
        lift = j === 0 || j === levels.length - 1 ? 0 : seed * t.width * 0.08;
      return [Math.cos(a) * rad, y + lift, Math.sin(a) * rad];
    });
  });
  loft(at, 'rubble', rings);
}
function gallery(f, g, d) {
  const c = Math.cos(g.angle),
    s = Math.sin(g.angle),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [
          g.point[0] + x * c - z * s,
          g.baseY + y,
          g.point[1] + x * s + z * c,
        ]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    w = g.length;
  for (const x of [-w / 2 + 0.38, w / 2 - 0.38])
    for (const z of d === 2 ? [2.0] : [-2.0, 2.0])
      box(at, 'wall', x, d === 1 ? -3.3 : -2.1, z, 0.7, d === 1 ? 8.6 : 7.4, 0.7);
  box(at, 'wall', 0, 5.1, -2, w + 0.25, 0.65, 0.95);
  box(at, 'wall', 0, 5.1, 2, w + 0.25, 0.65, 0.95);
  box(at, 'rubble', 0, d === 1 ? -3.7 : -2.5, 0, w, d === 1 ? 4.2 : 3.0, 5.5);
  if (g.roofed) {
    if (d < 3) box(at, 'wall', 0, 5.75, 0, w + 0.2, 1.0, 5.0);
    else
      loft(at, 'wall', [
        [
          [-w / 2, 5.75, -2.5],
          [w / 2, 5.75, -2.5],
          [w / 2, 5.75, 2.5],
          [-w / 2, 5.75, 2.5],
        ],
        [
          [-w / 2, 7.2, -0.6],
          [w / 2, 7.2, -0.6],
          [w / 2, 7.2, 0.6],
          [-w / 2, 7.2, 0.6],
        ],
      ]);
  }
}
export function buildBayon(f, d, r) {
  const ring = r.innerOutline,
    controls = r.platformControls;
  polygonPrism(
    f,
    'rubble',
    ring,
    r.platformTriangles,
    (i) => controls[i].bottomY,
    (i) => controls[i].topY,
  );
  for (const t of r.towers)
    tower(
      f,
      t,
      d,
      r.mainAxisRadians,
      t.central ? r.controls.find((c) => c.id === t.id).polygons[0].outline : undefined,
    );
  if (d === 0) {
    const c = Math.cos(r.mainAxisRadians),
      s = Math.sin(r.mainAxisRadians),
      o = r.mainAxisOrigin,
      at = (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [o[0] + x * c - z * s, r.baseHeight + y, o[1] + x * s + z * c]),
          [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
        );
    for (const z of [-50, 50]) box(at, 'wall', 0, 6, z, 108, 1.2, 5);
    for (const x of [-54, 54]) box(at, 'wall', x, 6, 0, 5, 1.2, 100);
    for (const corner of r.coarseGalleryCorners)
      box(at, 'wall', corner.x, corner.bottomY, corner.z, 1.4, 6 - corner.bottomY, 1.4);
  } else {
    const stride = d === 1 ? 6 : d === 2 ? 2 : 1;
    for (const [i, g] of r.galleries.entries())
      if (i % stride === 0) gallery(f, { ...g, length: g.length * stride }, d);
    const o = r.mainAxisOrigin;
    for (let side = 0; side < 4; side++) {
      const a = r.mainAxisRadians + (side * Math.PI) / 2,
        co = Math.cos(a),
        si = Math.sin(a),
        at = (role, ps, n) =>
          f(
            role,
            ps.map(([x, y, z]) => [
              o[0] + x * co - z * si,
              r.baseHeight + y,
              o[1] + x * si + z * co,
            ]),
            [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
          );
      for (let k = 0; k < 4; k++) box(at, 'wall', 0, k * 1.05, 40 - k * 1.8, 6.0, 1.05, 2.1);
    }
  }
  for (const lib of r.libraries) {
    const ps = lib.outline,
      center = [0, 1].map((k) => ps.reduce((n, p) => n + p[k], 0) / 4),
      a = ps[0],
      b = ps[1],
      angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
      c = Math.cos(angle),
      s = Math.sin(angle),
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      depth = Math.hypot(ps[2][0] - b[0], ps[2][1] - b[1]),
      at = (role, qs, n) =>
        f(
          role,
          qs.map(([x, y, z]) => [
            center[0] + x * c - z * s,
            lib.baseY + y,
            center[1] + x * s + z * c,
          ]),
          [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
        );
    polygonPrism(
      f,
      'rubble',
      ps,
      lib.triangles,
      () => lib.baseY - 3,
      () => lib.baseY + 0.4,
    );
    if (d === 0) box(at, 'wall', 0, 0.4, 0, length, 5, depth);
    else {
      for (const z of [-depth / 2 + 0.35, depth / 2 - 0.35])
        box(at, 'wall', 0, 0.4, z, length, 4.8, 0.7);
      for (const x of [-length / 2 + 0.3, length / 2 - 0.3])
        for (const z of [-depth / 2 + 0.35, depth / 2 - 0.35])
          box(at, 'wall', x, 0.4, z, 0.7, 5, 0.7);
      loft(at, 'wall', [
        [
          [-length / 2, 5.2, -depth / 2],
          [length / 2, 5.2, -depth / 2],
          [length / 2, 5.2, depth / 2],
          [-length / 2, 5.2, depth / 2],
        ],
        [
          [-length / 2, 7, -0.7],
          [length / 2, 7, -0.7],
          [length / 2, 7, 0.7],
          [-length / 2, 7, 0.7],
        ],
      ]);
    }
  }
}
