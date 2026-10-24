/** Mapped corridor, double-ring pavilion and selected precinct controls; approximate exterior fit. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';

const root = new URL(
  '../../../content/worldgen/source/places/wx/wx4/temple_of_heaven/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  fit = JSON.parse(readFileSync(new URL('pmtiles-fit.json', root)));
if (frame.candidateId !== 'temple_of_heaven') throw new Error('Wrong Temple precinct source');
const rec = frame.reconstruction.precinct;
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const green = linear('#617465'),
  blue = linear('#597f88'),
  gold = linear('#c6ab72'),
  red = linear('#b65b49');
function ground(x, z) {
  const g = fit.grid,
    u = (x + fit.modelOrigin[0] - g.origin[0]) / g.stepMeters,
    v = (z + fit.modelOrigin[1] - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  if (i < 0 || j < 0 || i >= g.width - 1 || j >= g.height - 1)
    throw Error('Precinct outside retained DEM');
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function space(face, center, floor, axis = [1, 0], normal = [0, 1]) {
  const point = (u, y, v) => [
    center[0] + axis[0] * u + normal[0] * v,
    floor + y,
    center[1] + axis[1] * u + normal[1] * v,
  ];
  const quad = (role, p, n, tint) =>
    face(
      role,
      p.map((p) => point(...p)),
      [axis[0] * n[0] + normal[0] * n[2], n[1], axis[1] * n[0] + normal[1] * n[2]],
      tint,
    );
  const box = (role, u0, u1, v0, v1, lo, hi, tint, top = true) => {
    for (const sign of [-1, 1]) {
      const u = sign < 0 ? u0 : u1,
        v = sign < 0 ? v0 : v1;
      quad(
        role,
        [
          [u0, lo, v],
          [u1, lo, v],
          [u1, hi, v],
          [u0, hi, v],
        ],
        [0, 0, sign],
        tint,
      );
      quad(
        role,
        [
          [u, lo, v0],
          [u, lo, v1],
          [u, hi, v1],
          [u, hi, v0],
        ],
        [sign, 0, 0],
        tint,
      );
    }
    if (top)
      quad(
        role,
        [
          [u0, hi, v0],
          [u1, hi, v0],
          [u1, hi, v1],
          [u0, hi, v1],
        ],
        [0, 1, 0],
        tint,
      );
  };
  return { point, quad, box };
}
function polygon(face, role, ring, y, tint) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      role,
      indices
        .slice(i, i + 3)
        .map((k) => [ring[k][0], typeof y === 'function' ? y(ring[k]) : y, ring[k][1]]),
      [0, 1, 0],
      tint,
    );
}
function hip(w, width, depth, eave, ridge, d, tint) {
  const a = width / 2 + 0.8,
    b = depth / 2 + 0.8,
    r = Math.max(0.1, a - b * 0.55);
  for (const sign of [-1, 1]) {
    w.quad(
      'roof',
      [
        [-a, eave, sign * b],
        [a, eave, sign * b],
        [r, ridge, 0],
        [-r, ridge, 0],
      ],
      [0, 0.5, sign],
      tint,
    );
    w.quad(
      'roof',
      [
        [sign * a, eave, -b],
        [sign * a, eave, b],
        [sign * r, ridge, 0],
      ],
      [sign, 0.5, 0],
      tint,
    );
  }
  if (d > 0)
    w.quad(
      'band',
      [
        [-a, eave, -b],
        [a, eave, -b],
        [a, eave, b],
        [-a, eave, b],
      ],
      [0, -1, 0],
      blue,
    );
  if (d >= 3) w.box('roof', -r - 0.1, r + 0.1, -0.12, 0.12, ridge, ridge + 0.25, tint);
}
function cylinder(w, u, v, r, lo, hi, n = 6, role = 'wall') {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    w.quad(
      role,
      [
        [u + Math.cos(a) * r, lo, v + Math.sin(a) * r],
        [u + Math.cos(b) * r, lo, v + Math.sin(b) * r],
        [u + Math.cos(b) * r, hi, v + Math.sin(b) * r],
        [u + Math.cos(a) * r, hi, v + Math.sin(a) * r],
      ],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      role === 'wall' ? red : undefined,
    );
  }
}
function corridor(face, d) {
  const c = rec.corridor;
  for (let j = 1; j < c.sections.length; j++) {
    const a = c.sections[j - 1],
      b = c.sections[j],
      len = Math.hypot(...b.center.map((v, k) => v - a.center[k])),
      count =
        d === 0
          ? 1
          : d === 1
            ? Math.max(1, Math.round(len / 40))
            : Math.ceil(len / (d === 2 ? 12 : 8));
    const cross = (t) => a.edges.map((p, k) => p.map((v, i) => v + (b.edges[k][i] - v) * t)),
      height = (t) => a.floorY + (b.floorY - a.floorY) * t;
    const p = (_edge, t, u, y) => {
      const q = cross(t),
        v = q[0].map((v, k) => v + (q[1][k] - v) * u);
      return [v[0], height(t) + y, v[1]];
    };
    for (let i = 0; i < count; i++) {
      const t = i / count,
        s = (i + 1) / count;
      face('brick', [p(0, t, 0, 0), p(0, t, 1, 0), p(0, s, 1, 0), p(0, s, 0, 0)], [0, 1, 0]);
      for (const sign of [0, 1]) {
        const normal = cross((t + s) / 2)[1].map((v, k) => v - cross((t + s) / 2)[0][k]);
        face(
          'roof',
          [p(0, t, sign, 4.05), p(0, s, sign, 4.05), p(0, s, 0.5, 5.7), p(0, t, 0.5, 5.7)],
          [normal[0] * (sign ? 1 : -1), 0.8, normal[1] * (sign ? 1 : -1)],
          green,
        );
        if (d > 0) {
          face(
            'band',
            [p(0, t, sign, 3.45), p(0, s, sign, 3.45), p(0, s, sign, 4), p(0, t, sign, 4)],
            [normal[0] * (sign ? 1 : -1), 0, normal[1] * (sign ? 1 : -1)],
            blue,
          );
          face(
            'brick',
            [p(0, t, sign, -0.35), p(0, s, sign, -0.35), p(0, s, sign, 0), p(0, t, sign, 0)],
            [normal[0] * (sign ? 1 : -1), 0, normal[1] * (sign ? 1 : -1)],
          );
        }
      }
      if (d > 0)
        face(
          'band',
          [p(0, t, 0, 3.95), p(0, t, 1, 3.95), p(0, s, 1, 3.95), p(0, s, 0, 3.95)],
          [0, -1, 0],
          blue,
        );
    }
    if (d === 0) continue;
    const bays = d === 1 ? Math.max(1, Math.round(len / 24)) : Math.ceil(len / (d === 2 ? 6.2 : 4));
    for (let i = 0; i <= bays; i++) {
      if (j > 1 && i === 0) continue;
      const t = i / bays,
        edges = cross(t),
        h = height(t),
        v = edges[1].map((v, k) => v - edges[0][k]),
        length = Math.hypot(...v),
        normal = v.map((v) => v / length),
        axis = [normal[1], -normal[0]],
        center = edges[0].map((v, k) => (v + edges[1][k]) / 2),
        w = space(face, center, h, axis, normal);
      for (const sign of [-1, 1]) {
        const at = sign * (length / 2 - 0.6);
        if (d === 1) {
          const q = [
            [-0.32, 0, at],
            [0.32, 0, at],
            [0.32, 3.95, at],
            [-0.32, 3.95, at],
          ];
          w.quad('wall', q, [0, 0, sign], red);
          w.quad('wall', q, [0, 0, -sign], red);
        } else if (d === 2) w.box('wall', -0.16, 0.16, at - 0.16, at + 0.16, 0, 3.95, red, false);
        else {
          cylinder(w, 0, at, 0.18, 0.1, 3.95);
          w.box('stone', -0.26, 0.26, at - 0.26, at + 0.26, 0, 0.12);
        }
      }
    }
    if (d >= 2)
      for (const sign of [0, 1]) {
        const normal = cross(0.5)[1].map((v, k) => v - cross(0.5)[0][k]),
          n = [normal[0] * (sign ? 1 : -1), 0, normal[1] * (sign ? 1 : -1)];
        for (const [lo, hi] of d >= 3
          ? [
              [0.2, 0.65],
              [0.9, 1.05],
            ]
          : [[0.2, 0.85]])
          face(
            'band',
            [p(0, 0, sign, lo), p(0, 1, sign, lo), p(0, 1, sign, hi), p(0, 0, sign, hi)],
            n,
            green,
          );
      }
  }
}
function clipHalf(points, sign) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      ia = a[0] * sign >= -1e-9,
      ib = b[0] * sign >= -1e-9;
    if (ia) result.push(a);
    if (ia !== ib) {
      const t = a[0] / (a[0] - b[0]);
      result.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return result;
}
function longevity(face, d) {
  const b = rec.longevity,
    w = space(face, b.center, b.floorY, b.axis, b.normal),
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16;
  polygon(face, 'stone', b.polygons[0].outline, b.floorY + 0.15);
  for (const sign of [-1, 1]) {
    const center = sign * b.halfSeparation;
    const part = (role, points, normal, tint) => {
      const p = clipHalf(points, sign);
      if (p.length > 2) w.quad(role, p, normal, tint);
    };
    for (const profile of [
      [
        [3.9, b.radius],
        [4.6, 2.8],
      ],
      [
        [5.4, 3.7],
        [7.3, 0.45],
      ],
    ]) {
      for (let j = 1; j < profile.length; j++)
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n,
            c = ((i + 1) * Math.PI * 2) / n,
            p = (q, s) => [center + Math.cos(q) * s[1], s[0], Math.sin(q) * s[1]];
          part(
            'roof',
            [p(a, profile[j - 1]), p(c, profile[j - 1]), p(c, profile[j]), p(a, profile[j])],
            [Math.cos((a + c) / 2), 0.65, Math.sin((a + c) / 2)],
            blue,
          );
        }
      if (d > 0) {
        const last = profile[0];
        part(
          'band',
          Array.from({ length: n }, (_, i) => [
            center + Math.cos((i * Math.PI * 2) / n) * last[1],
            last[0],
            Math.sin((i * Math.PI * 2) / n) * last[1],
          ]),
          [0, -1, 0],
          blue,
        );
      }
    }
    if (d > 0)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          c = ((i + 1) * Math.PI * 2) / n,
          p = (q, y) => [center + Math.cos(q) * 2.8, y, Math.sin(q) * 2.8];
        part(
          'band',
          [p(a, 4.6), p(c, 4.6), p(c, 5.4), p(a, 5.4)],
          [Math.cos((a + c) / 2), 0, Math.sin((a + c) / 2)],
          blue,
        );
      }
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        c = ((i + 1) * Math.PI * 2) / n;
      w.quad(
        'gold',
        [
          [center + Math.cos(a) * 0.45, 7.3, Math.sin(a) * 0.45],
          [center + Math.cos(c) * 0.45, 7.3, Math.sin(c) * 0.45],
          [center, 8.2, 0],
        ],
        [Math.cos((a + c) / 2), 0.5, Math.sin((a + c) / 2)],
      );
    }
    if (d === 0) continue;
    const count = d === 1 ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        u = center + Math.cos(a) * 3.3,
        v = Math.sin(a) * 3.3;
      if (u * sign < 0.5) continue;
      if (d === 1) {
        const q = [
          [u - 0.22, 0.15, v],
          [u + 0.22, 0.15, v],
          [u + 0.22, 3.95, v],
          [u - 0.22, 3.95, v],
        ];
        w.quad('wall', q, [0, 0, 1], red);
        w.quad('wall', q, [0, 0, -1], red);
      } else {
        cylinder(w, u, v, 0.2, 0.15, 3.95);
        if (d >= 3) w.box('stone', u - 0.28, u + 0.28, v - 0.28, v + 0.28, 0, 0.2);
      }
    }
    if (d >= 3)
      for (const y of [3.9, 5.4])
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n,
            c = ((i + 1) * Math.PI * 2) / n,
            r = y === 3.9 ? b.radius : 3.7;
          part(
            'roof',
            [
              [center + Math.cos(a) * r, y, Math.sin(a) * r],
              [center + Math.cos(c) * r, y, Math.sin(c) * r],
              [center + Math.cos(c) * r, y + 0.12, Math.sin(c) * r],
              [center + Math.cos(a) * r, y + 0.12, Math.sin(a) * r],
            ],
            [Math.cos((a + c) / 2), 0, Math.sin((a + c) / 2)],
            gold,
          );
        }
  }
}
function gate(face, b, d, offset = 0, width = b.width, top = b.wallTop, ridge = b.roofRidge) {
  const w = space(face, b.center, b.floorY, b.axis, b.normal),
    half = width / 2,
    depth = Math.max(0.5, b.depth / 2);
  const box = (...args) => {
    const [role, a, c, ...tail] = args;
    w.box(role, a + offset, c + offset, ...tail);
  };
  const q = (role, p, n, tint) =>
    w.quad(
      role,
      p.map((p) => [p[0] + offset, p[1], p[2]]),
      n,
      tint,
    );
  if (d === 0) {
    box('gate', -half, half, -depth, depth, -0.15, top, red, false);
    hip(
      space(
        face,
        [b.center[0] + b.axis[0] * offset, b.center[1] + b.axis[1] * offset],
        b.floorY,
        b.axis,
        b.normal,
      ),
      width,
      b.depth,
      top + 0.2,
      ridge,
      0,
    );
    return;
  }
  const single = b.pointDerived || b.variant === 'three-portals',
    centers = single ? [0] : [-width * 0.3, 0, width * 0.3],
    opening = single ? Math.min(width * 0.24, 1.7) : width * 0.06;
  let previous = -half;
  const panel = (a, c, lo, hi) => {
    if (d === 1) {
      const p = [
        [a, lo, 0],
        [c, lo, 0],
        [c, hi, 0],
        [a, hi, 0],
      ];
      q('gate', p, [0, 0, 1], red);
      q('gate', p, [0, 0, -1], red);
    } else box('gate', a, c, -depth, depth, lo, hi, red, false);
  };
  for (const u of centers) {
    const radius = opening * (u === 0 ? 1.18 : 1),
      spring = u === 0 ? 3.1 : 2.6,
      cap = Math.min(spring, top - 1.5);
    panel(previous, u - radius, -0.15, top);
    if (d === 1) panel(u - radius, u + radius, cap, top);
    else {
      const count = d === 2 ? 2 : 8;
      for (let i = 0; i < count; i++) {
        const a = Math.PI - (i * Math.PI) / count,
          c = Math.PI - ((i + 1) * Math.PI) / count,
          x0 = u + Math.cos(a) * radius,
          x1 = u + Math.cos(c) * radius,
          y0 = cap + Math.sin(a) * radius,
          y1 = cap + Math.sin(c) * radius;
        for (const sign of [-1, 1])
          q(
            'gate',
            [
              [x0, y0, sign * depth],
              [x1, y1, sign * depth],
              [x1, top, sign * depth],
              [x0, top, sign * depth],
            ],
            [0, 0, sign],
            red,
          );
        q(
          'gate',
          [
            [x0, y0, -depth],
            [x1, y1, -depth],
            [x1, y1, depth],
            [x0, y0, depth],
          ],
          [u - (x0 + x1) / 2, -1, 0],
          red,
        );
      }
      for (const sign of [-1, 1])
        q(
          'gate',
          [
            [u + sign * radius, 0, -depth],
            [u + sign * radius, 0, depth],
            [u + sign * radius, cap, depth],
            [u + sign * radius, cap, -depth],
          ],
          [-sign, 0, 0],
          red,
        );
    }
    if (u === 0) {
      const p = [
        [u - radius, 0, 0],
        [u + radius, 0, 0],
        [u + radius, cap, 0],
        [u - radius, cap, 0],
      ];
      q('wall', p, [0, 0, 1], red);
      q('wall', p, [0, 0, -1], red);
    }
    previous = u + radius;
  }
  panel(previous, half, -0.15, top);
  const shifted = space(
    face,
    [b.center[0] + b.axis[0] * offset, b.center[1] + b.axis[1] * offset],
    b.floorY,
    b.axis,
    b.normal,
  );
  hip(shifted, width, b.depth, top + 0.2, ridge, d);
  if (d >= 2)
    box(
      'band',
      -half - 0.04,
      half + 0.04,
      -depth - 0.04,
      depth + 0.04,
      top - 0.6,
      top + 0.02,
      blue,
    );
  if (d >= 3) box('stone', -half - 0.25, half + 0.25, -depth - 0.4, depth + 0.4, -0.3, 0);
}
function walls(face, d) {
  for (const wall of rec.walls) {
    const selected =
      d === 0
        ? wall.points.filter((_, i) => i === 0 || i === wall.points.length - 1 || i % 6 === 0)
        : wall.points;
    for (let j = 1; j < selected.length; j++) {
      const a = selected[j - 1],
        b = selected[j],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]),
        count = d < 2 ? 1 : Math.ceil(length / (d === 2 ? 70 : 30)),
        cuts = [];
      // Clip against each gate's oriented envelope, including at low-detail wall segments.
      // A midpoint test leaves long panels running across the actual gate openings.
      for (const gate of rec.gates) {
        let lo = 0,
          hi = 1;
        for (const [axis, half] of [
          [gate.axis, gate.width / 2 + 0.6],
          [gate.normal, gate.depth / 2 + 0.6],
        ]) {
          const start = (a[0] - gate.center[0]) * axis[0] + (a[2] - gate.center[1]) * axis[1],
            delta = (b[0] - a[0]) * axis[0] + (b[2] - a[2]) * axis[1];
          if (Math.abs(delta) < 1e-9) {
            if (Math.abs(start) > half) hi = -1;
          } else {
            const t0 = (-half - start) / delta,
              t1 = (half - start) / delta;
            lo = Math.max(lo, Math.min(t0, t1));
            hi = Math.min(hi, Math.max(t0, t1));
          }
        }
        if (hi > lo) cuts.push([lo, hi]);
      }
      let intervals = [[0, 1]];
      for (const [lo, hi] of cuts)
        intervals = intervals.flatMap(([a, b]) =>
          hi <= a || lo >= b
            ? [[a, b]]
            : [...(lo > a ? [[a, lo]] : []), ...(hi < b ? [[hi, b]] : [])],
        );
      for (const [start, end] of intervals)
        for (let i = 0; i < count; i++) {
          const t = start + ((end - start) * i) / count,
            s = start + ((end - start) * (i + 1)) / count,
            p = (t) => a.map((v, k) => v + (b[k] - v) * t),
            x = p(t),
            z = p(s),
            normal = [z[2] - x[2], 0, x[0] - z[0]],
            lo = -1.5,
            hi = 3.2;
          for (const sign of [-1, 1])
            face(
              'gate',
              [
                [x[0], x[1] + lo, x[2]],
                [z[0], z[1] + lo, z[2]],
                [z[0], z[1] + hi, z[2]],
                [x[0], x[1] + hi, x[2]],
              ],
              normal.map((v) => v * sign),
              red,
            );
          if (d > 0) {
            const l = Math.hypot(normal[0], normal[2]),
              nx = (normal[0] / l) * 0.38,
              nz = (normal[2] / l) * 0.38;
            face(
              'roof',
              [
                [x[0] - nx, x[1] + hi, x[2] - nz],
                [z[0] - nx, z[1] + hi, z[2] - nz],
                [z[0] + nx, z[1] + hi, z[2] + nz],
                [x[0] + nx, x[1] + hi, x[2] + nz],
              ],
              [0, 1, 0],
            );
          }
        }
    }
  }
}
function clipZ(points, bound, upper) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      ia = upper ? a[1] <= bound : a[1] >= bound,
      ib = upper ? b[1] <= bound : b[1] >= bound;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (bound - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, bound]);
    }
  }
  return out;
}
function causeway(face) {
  const ring = rec.causeway.outline,
    min = Math.min(...ring.map((p) => p[1])),
    max = Math.max(...ring.map((p) => p[1])),
    // Keep the deck profile identical across levels; only its surrounding architecture simplifies.
    n = Math.ceil((max - min) / 20);
  for (let i = 0; i < n; i++) {
    const p = clipZ(
      clipZ(ring, min + ((max - min) * i) / n, false),
      min + ((max - min) * (i + 1)) / n,
      true,
    );
    if (p.length >= 3) polygon(face, 'brick', p, (p) => ground(...p) + 0.15);
  }
}
export function buildHeavenPrecinct(face, d) {
  corridor(face, d);
  longevity(face, d);
  for (const b of rec.gates) {
    if (d === 0 && !rec.farGateIds.includes(b.id)) continue;
    const detail = d === 1 ? 0 : d;
    if (b.variant === 'three-portals') {
      for (const i of [-1, 0, 1])
        gate(
          face,
          b,
          detail,
          i * b.width * 0.32,
          b.width * 0.3,
          b.wallTop - (i ? 1 : 0),
          b.roofRidge - (i ? 1 : 0),
        );
    } else gate(face, b, detail);
  }
  walls(face, d);
  causeway(face);
}
