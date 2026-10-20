/** Kukulcan's mapped stage/step controls with picture-guided panels and serpent terminals. */
export const kukulcanCandidateId = 'N0499';

const ring = (b, y) => [
  [b[0], y, b[1]],
  [b[2], y, b[1]],
  [b[2], y, b[3]],
  [b[0], y, b[3]],
];
function hull(points) {
  const ps = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    lower = [],
    upper = [];
  for (const p of ps) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of ps.toReversed()) {
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function band(f, role, a, b) {
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      role,
      [a[i], a[j], b[j], b[i]],
      [
        [0, 0.3, -1],
        [1, 0.3, 0],
        [0, 0.3, 1],
        [-1, 0.3, 0],
      ][i],
    );
  }
}
function prism(f, role, poly, bottom, top) {
  for (const t of poly.triangles) {
    f(
      role,
      t.map((p) => [p[0], top, p[1]]),
      [0, 1, 0],
    );
    f(
      role,
      t.map((p) => [p[0], bottom, p[1]]),
      [0, -1, 0],
    );
  }
  for (const [k, ps] of [poly.outline, ...poly.holes].entries()) {
    const winding =
      Math.sign(
        ps.reduce(
          (n, p, i) => n + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      ) * (k ? -1 : 1);
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length];
      f(
        role,
        [
          [a[0], bottom, a[1]],
          [b[0], bottom, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        [winding * (b[1] - a[1]), 0, -winding * (b[0] - a[0])],
      );
    }
  }
}
function box(f, role, b, bottom, top) {
  const a = ring(b, bottom),
    z = ring(b, top);
  band(f, role, a, z);
  f(role, z, [0, 1, 0]);
  f(role, a, [0, -1, 0]);
}
function wedge(f, role, flight, y0, y1, width, thickness, flatBase = false) {
  const a = flight.start,
    b = flight.end,
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    nx = ((-(b[1] - a[1]) / length) * width) / 2,
    nz = (((b[0] - a[0]) / length) * width) / 2;
  const ps = [
      [a[0] - nx, y0, a[1] - nz],
      [a[0] + nx, y0, a[1] + nz],
      [b[0] + nx, y1, b[1] + nz],
      [b[0] - nx, y1, b[1] - nz],
    ],
    qs = ps.map((p) => [p[0], flatBase ? 0 : p[1] - thickness, p[2]]);
  f(role, ps, [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [ps[i], ps[j], qs[j], qs[i]], [ps[i][0] + ps[j][0], 0, ps[i][2] + ps[j][2]]);
  }
}
function stage(f, p, d) {
  const b = p.bounds,
    upper = [b[0] + 0.65, b[1] + 0.65, b[2] - 0.65, b[3] - 0.65],
    a = ring(b, p.bottom),
    z = ring(upper, p.wallTop);
  if (d < 2) band(f, 'wall', a, z);
  else
    for (let side = 0; side < 4; side++) {
      const j = (side + 1) % 4,
        normal = [
          [0, 0, -1],
          [1, 0, 0],
          [0, 0, 1],
          [-1, 0, 0],
        ][side],
        length = Math.hypot(a[j][0] - a[side][0], a[j][2] - a[side][2]),
        count = Math.max(2, Math.round(length / (d === 2 ? 7.5 : 5))),
        xs = [0, 1];
      for (let k = 0; k < count; k++)
        for (const q of [0.14, 0.25, 0.75, 0.86]) xs.push((k + q) / count);
      xs.sort((a, b) => a - b);
      const ys = [0, 0.52, 0.63, 0.89, 0.98, 1],
        point = (u, v) => {
          const lo = a[side].map((x, k) => x + (a[j][k] - x) * u),
            hi = z[side].map((x, k) => x + (z[j][k] - x) * u),
            cycle = (u * count) % 1,
            inset =
              cycle >= 0.25 - 1e-6 && cycle <= 0.75 + 1e-6 && v >= 0.63 && v <= 0.89 ? 0.09 : 0;
          return lo.map((x, k) => x + (hi[k] - x) * v - normal[k] * inset);
        };
      for (let k = 1; k < xs.length; k++)
        for (let l = 1; l < ys.length; l++)
          f(
            'wall',
            [
              point(xs[k - 1], ys[l - 1]),
              point(xs[k], ys[l - 1]),
              point(xs[k], ys[l]),
              point(xs[k - 1], ys[l]),
            ],
            [normal[0], 0.3, normal[2]],
          );
    }
  const cap = [upper[0] - 0.12, upper[1] - 0.12, upper[2] + 0.12, upper[3] + 0.12];
  band(f, 'trim', z, ring(cap, p.top));
  f('trim', ring(cap, p.top), [0, 1, 0]);
}
function serpent(f, d, h, r) {
  const width = 0.9,
    profile = r.headProfile,
    ps = profile.map(([z, y]) => [z + h.point[1], y]),
    x0 = h.point[0] - width / 2,
    x1 = h.point[0] + width / 2;
  if (d < 2) {
    box(f, 'trim', [x0, h.point[1] - 1.6, x1, h.point[1] + 0.8], 0, 1.1);
    return;
  }
  for (const x of [x0, x1])
    for (let i = 0; i < r.headTriangles.length; i += 3)
      f(
        'trim',
        r.headTriangles.slice(i, i + 3).map((k) => [x, ps[k][1], ps[k][0]]),
        [x === x0 ? -1 : 1, 0, 0],
      );
  for (let i = 0; i < ps.length; i++) {
    const j = (i + 1) % ps.length,
      a = ps[i],
      b = ps[j];
    f(
      'trim',
      [
        [x0, a[1], a[0]],
        [x1, a[1], a[0]],
        [x1, b[1], b[0]],
        [x0, b[1], b[0]],
      ],
      [0, -(b[0] - a[0]), b[1] - a[1]],
    );
  }
  if (d >= 3)
    for (const x of [x0, x1])
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5,
          b = ((i + 1) * Math.PI) / 5,
          p = (t, rad, depth) => [
            x + (x === x0 ? -depth : depth),
            1.22 + Math.sin(t) * rad,
            h.point[1] - 0.45 + Math.cos(t) * rad,
          ];
        f(
          'trim',
          [p(a, 0.15, 0.035), p(b, 0.15, 0.035), p(b, 0.08, 0.005), p(a, 0.08, 0.005)],
          [x === x0 ? -1 : 1, 0, 0],
        );
      }
}
export function buildKukulcan(f, d, r) {
  // A complete footprint floor remains under every stair and every LOD.
  for (const t of r.groundTriangles)
    f(
      'ground',
      t.map((p) => [p[0], r.floorY, p[1]]),
      [0, 1, 0],
    );
  for (const e of r.groundEdges)
    f(
      'ground',
      [
        [e.a[0], r.floorY, e.a[1]],
        [e.b[0], r.floorY, e.b[1]],
        [e.b[0], e.heightB, e.b[1]],
        [e.a[0], e.heightA, e.a[1]],
      ],
      [e.b[1] - e.a[1], 0, e.a[0] - e.b[0]],
    );
  const c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians),
    o = r.mainAxisOrigin,
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [o[0] + x * c - z * s, r.floorY + y, o[1] + x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      );
  for (const p of r.stages) stage(at, p, d);
  for (const flight of r.flights) wedge(at, 'wall', flight, 0, 23.4, 7.4, 0, true);
  if (d === 0) {
    box(at, 'wall', [-5, -4.7, 5, 4.7], 23.94, 29.5);
    box(at, 'trim', [-5.3, -5, 5.3, 5], 29.5, 30);
  } else {
    const stride = d === 1 ? 5 : d === 2 ? 2 : 1;
    for (let i = 0; i < r.stairs.length; i += stride) {
      const a = r.stairs[i],
        prev = i === 0 ? 0 : r.stairs[i - 1].height,
        upper = r.stairs[Math.min(r.stairs.length - 1, i + stride - 1)],
        polys = a.polygons.map((p, j) => {
          const q = upper.polygons[j],
            outline = hull([...p.outline, ...q.outline]);
          return stride === 1
            ? p
            : {
                ...p,
                outline,
                triangles: Array.from({ length: outline.length - 2 }, (_, k) => [
                  outline[0],
                  outline[k + 1],
                  outline[k + 2],
                ]),
              };
        });
      for (const p of polys) prism(f, 'trim', p, r.floorY + prev, r.floorY + upper.height);
    }
    for (const p of r.parts) {
      // Long low parts describe sloping balustrades, supplied by the mapped flights below.
      if (p.height < 24) continue;
      if (p.height < 1.1 || (d === 1 && p.height > 27 && p.height < 29.9)) continue;
      for (const poly of p.polygons)
        prism(
          f,
          p.height >= 27 ? 'trim' : 'wall',
          poly,
          r.floorY + p.minHeight,
          r.floorY + p.height,
        );
    }
    // Broad rails retain the north approach and the visual four-way stair rhythm.
    for (const flight of r.flights) {
      const a = flight.start,
        b = flight.end,
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = -(b[1] - a[1]) / len,
        nz = (b[0] - a[0]) / len;
      for (const sign of [-1, 1])
        wedge(
          at,
          'trim',
          {
            start: [a[0] + nx * sign * 3.85, a[1] + nz * sign * 3.85],
            end: [b[0] + nx * sign * 3.85, b[1] + nz * sign * 3.85],
          },
          0.75,
          24.05,
          0.7,
          0.55,
        );
    }
    // Two round columns divide the photographed north summit doorway into three openings.
    const sides = d === 1 ? 4 : d === 2 ? 6 : 8;
    for (const x of [-1.4, 1.4])
      for (let k = 0; k < sides; k++) {
        const a = (k * Math.PI * 2) / sides,
          b = ((k + 1) * Math.PI * 2) / sides;
        at(
          'trim',
          [
            [x + Math.cos(a) * 0.3, 23.94, -4.42 + Math.sin(a) * 0.3],
            [x + Math.cos(b) * 0.3, 23.94, -4.42 + Math.sin(b) * 0.3],
            [x + Math.cos(b) * 0.3, 27, -4.42 + Math.sin(b) * 0.3],
            [x + Math.cos(a) * 0.3, 27, -4.42 + Math.sin(a) * 0.3],
          ],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      }
    for (const h of r.heads) serpent(at, d, h, r);
  }
}
