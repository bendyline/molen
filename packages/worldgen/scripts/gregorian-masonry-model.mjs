/** 'N0624': notched stepped tower, real recessed shutters and open terrace rails. */
import earcut from 'earcut';
import { cross, normalize } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildGregorianMasonry(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      r.floorY + y,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    beam = (role, a, b, width, depth = width) => {
      const axis = normalize(b.map((v, k) => v - a[k])),
        u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
        v = cross(axis, u),
        end = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([x, y]) => p.map((q, k) => q + (x * u[k] * width) / 2 + (y * v[k] * depth) / 2)),
        A = end(a),
        B = end(b);
      for (let i = 0; i < 4; i++) {
        const k = (i + 1) % 4;
        f(
          role,
          [A[i], A[k], B[k], B[i]],
          A[i].map((q, k) => q + A[(i + 1) % 4][k] - 2 * a[k]),
        );
      }
      f(
        role,
        A,
        axis.map((v) => -v),
      );
      f(role, B, axis);
    },
    offset = (p, factor) => {
      const c = p.outline.reduce((a, q) => a.map((v, k) => v + q[k] / p.outline.length), [0, 0]);
      return { outline: p.outline.map((p) => p.map((v, k) => c[k] + (v - c[k]) * factor)) };
    };
  // The bounded tower footprint, including its actual northeast setback.
  prism(f, 'base', { outline: r.outline }, r.bottomY - r.floorY, 0.14);

  function volume(p, bottom, top, kind) {
    const cap = (role, ps, n) => {
      if (Math.abs(n[1]) > 0.5) f(role, ps, n);
    };
    prism(cap, 'wall', p, bottom, top);
    const outline = p.outline,
      area = outline.reduce((s, a, i) => {
        const b = outline[(i + 1) % outline.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sign = Math.sign(area);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        n = [u[1] * sign, 0, -u[0] * sign],
        map = ([s, y], depth = 0) => [
          a[0] + u[0] * s + n[0] * depth,
          y,
          a[1] + u[1] * s + n[2] * depth,
        ],
        side = Math.abs(n[0]) > 0.8 ? (n[0] < 0 ? 'west' : 'east') : n[2] < 0 ? 'north' : 'south';
      let windows = [];
      const shared =
        kind !== 'house' && Math.abs(a[0] - 1.376) < 0.003 && Math.abs(b[0] - 1.376) < 0.003;
      if (!shared && L > 4) {
        if (kind === 'west')
          windows = (side === 'north' ? [0.3, 0.7] : [0.5]).map((t) => ({
            u: t * L,
            bottom: 15.9,
            width: 1.04,
            height: 3.3,
          }));
        else if (kind === 'east')
          windows = [
            { u: L * 0.52, bottom: 24.0, width: 0.95, height: 3.0 },
            ...[0.27, 0.77].map((t) => ({ u: t * L, bottom: 19.3, width: 0.72, height: 1.35 })),
          ];
        else
          windows = (L > 7 ? [0.28, 0.72] : [0.5]).map((t) => ({
            u: t * L,
            bottom: bottom + 1.0,
            width: 0.88,
            height: 2.7,
          }));
      }
      const outer = [
          [0, bottom],
          [L, bottom],
          [L, top],
          [0, top],
        ],
        holes = windows.map((w) => [
          [w.u - w.width / 2, w.bottom],
          [w.u + w.width / 2, w.bottom],
          [w.u + w.width / 2, w.bottom + w.height],
          [w.u - w.width / 2, w.bottom + w.height],
        ]),
        rings = [outer, ...holes],
        flat = rings.flat(),
        starts = [];
      let count = outer.length;
      for (const h of holes) {
        starts.push(count);
        count += h.length;
      }
      const ix = earcut(flat.flat(), starts);
      for (let j = 0; j < ix.length; j += 3)
        f(
          'wall',
          ix.slice(j, j + 3).map((k) => map(flat[k])),
          n,
        );
      for (let j = 0; j < holes.length; j++) {
        const h = holes[j],
          w = windows[j],
          back = h.map((p) => map(p, -0.18));
        f('shutter', back, n);
        for (let k = 0; k < 4; k++) {
          const next = (k + 1) % 4,
            mid = h[k].map((v, i) => (v + h[next][i]) / 2),
            center = [w.u, w.bottom + w.height / 2],
            inward = [u[0] * (center[0] - mid[0]), center[1] - mid[1], u[1] * (center[0] - mid[0])];
          f('stone', [map(h[k]), map(h[next]), back[next], back[k]], inward);
        }
        // Sparse broad sill/frame members; closed shutters do not imply open rooms.
        if (detail > 0)
          beam(
            'stone',
            map([w.u - w.width / 2 - 0.14, w.bottom - 0.08], 0.06),
            map([w.u + w.width / 2 + 0.14, w.bottom - 0.08], 0.06),
            0.16,
            0.16,
          );
        if (detail >= 2) {
          for (let k = 0; k < 4; k++)
            beam('stone', map(h[k], 0.035), map(h[(k + 1) % 4], 0.035), 0.12, 0.14);
          beam(
            'stone',
            map([w.u, w.bottom], -0.14),
            map([w.u, w.bottom + w.height], -0.14),
            0.07,
            0.06,
          );
          if (detail === 3)
            for (const t of [0.33, 0.66])
              beam(
                'stone',
                map([w.u - w.width / 2, w.bottom + w.height * t], -0.14),
                map([w.u + w.width / 2, w.bottom + w.height * t], -0.14),
                0.065,
                0.06,
              );
        }
      }
    }
  }
  function cornice(p, y) {
    for (const [offsetY, height, factor] of detail === 0
      ? [[-0.15, 0.3, 1.04]]
      : [
          [-0.55, 0.16, 1.015],
          [-0.39, 0.2, 1.035],
          [-0.19, 0.25, 1.065],
        ])
      prism(f, 'stone', offset(p, factor), y + offsetY, y + offsetY + height);
  }
  for (const p of r.westPolygons) {
    volume(p, 0, r.westTop, 'west');
    cornice(p, r.westTop);
    prism(f, 'stone', offset(p, 1.015), 14.35, 14.55);
  }
  for (const p of r.eastPolygons) {
    volume(p, 0, r.eastTop, 'east');
    cornice(p, r.eastTop);
    prism(f, 'stone', offset(p, 1.01), 21.0, 21.22);
  }
  if (detail >= 1)
    for (const x of [-8.32, 0.9])
      for (const z of [-7.33, 7.3]) box(f, 'stone', x, 14.55, z, 0.24, r.westTop - 14.9, 0.24);

  function rail(rect, y, stone) {
    const outline = rect,
      role = stone ? 'stone' : 'metal';
    for (let side = 0; side < 4; side++) {
      const a = outline[side],
        b = outline[(side + 1) % 4],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = detail === 0 ? 1 : Math.max(2, Math.round(length / (detail === 1 ? 2.8 : 1.2))),
        at = (t, h) => [a[0] + (b[0] - a[0]) * t, h, a[1] + (b[1] - a[1]) * t];
      for (const h of detail === 0 ? [y + 1.0] : [y + 0.12, y + 1.0])
        beam(role, at(0, h), at(1, h), stone ? 0.14 : 0.08);
      for (let i = 0; i < count; i++) {
        const t = i / count,
          p = at(t, y);
        if (i === 0) box(f, 'stone', p[0], y, p[2], 0.32, 1.1, 0.32);
        else beam(role, p, at(t, y + 1.0), stone ? 0.13 : 0.065);
        if (detail === 3 && stone) {
          const q = at((i + 0.5) / count, y + 0.15);
          box(f, 'stone', q[0], y + 0.16, q[2], 0.15, 0.67, 0.15);
        }
      }
    }
  }
  rail(
    [
      [-8.35, -7.3],
      [1.15, -7.3],
      [1.15, 7.27],
      [-8.35, 7.27],
    ],
    r.westTop + 0.08,
    true,
  );
  rail(
    [
      [1.62, -5.1],
      [8.27, -5.1],
      [8.27, 7.26],
      [1.62, 7.26],
    ],
    r.eastTop + 0.08,
    false,
  );
  const h = r.house,
    housePolygon = {
      outline: [
        [h.x - h.width / 2, h.z - h.depth / 2],
        [h.x + h.width / 2, h.z - h.depth / 2],
        [h.x + h.width / 2, h.z + h.depth / 2],
        [h.x - h.width / 2, h.z + h.depth / 2],
      ],
    };
  volume(housePolygon, h.bottom, h.top, 'house');
  cornice(housePolygon, h.top);
  const a = [h.x - h.width / 2 - 0.17, h.top, h.z - h.depth / 2 - 0.17],
    b = [h.x + h.width / 2 + 0.17, h.top, h.z - h.depth / 2 - 0.17],
    c = [h.x, h.peak, h.z - h.depth / 2 - 0.17],
    d = a.map((v, k) => (k === 2 ? v + h.depth + 0.34 : v)),
    e = b.map((v, k) => (k === 2 ? v + h.depth + 0.34 : v)),
    g = c.map((v, k) => (k === 2 ? v + h.depth + 0.34 : v));
  f('metal', [a, c, g, d], [0, 1, 0]);
  f('metal', [c, b, e, g], [0, 1, 0]);
  f('wall', [a, b, c], [0, 0, -1]);
  f('wall', [d, e, g], [0, 0, 1]);
  // Solid roof house: real inner roof faces, ridge and closed triangular ends.
  f(
    'metal',
    [a, d, g, c].map((p) => [p[0], p[1] - 0.13, p[2]]),
    [0, -1, 0],
  );
  f(
    'metal',
    [c, g, e, b].map((p) => [p[0], p[1] - 0.13, p[2]]),
    [0, -1, 0],
  );
  const roofBoundary = [a, c, b, e, g, d];
  for (let i = 0; i < roofBoundary.length; i++) {
    const p = roofBoundary[i],
      q = roofBoundary[(i + 1) % roofBoundary.length];
    f(
      'metal',
      [p, q, [q[0], q[1] - 0.13, q[2]], [p[0], p[1] - 0.13, p[2]]],
      [(p[0] + q[0]) / 2 - h.x, 0, (p[2] + q[2]) / 2 - h.z],
    );
  }
  if (detail > 0) {
    for (const [u, v] of [
      [a, b],
      [a, c],
      [c, b],
    ])
      beam(
        'stone',
        u.map((v, k) => (k === 2 ? v - 0.08 : v)),
        v.map((v, k) => (k === 2 ? v - 0.08 : v)),
        0.23,
        0.23,
      );
    for (const x of [a[0] + 0.18, h.x, b[0] - 0.18]) {
      const y = x === h.x ? h.peak : h.top + 0.12;
      box(f, 'stone', x, y, h.z - h.depth / 2 - 0.18, 0.35, 0.35, 0.35);
      prism(
        f,
        'stone',
        {
          outline: Array.from({ length: 6 }, (_, i) => [
            x + Math.cos((i * Math.PI) / 3) * 0.2,
            h.z - h.depth / 2 - 0.18 + Math.sin((i * Math.PI) / 3) * 0.2,
          ]),
        },
        y + 0.35,
        y + 0.7,
      );
    }
  }
  // Selected downpipes communicate the vertical rhythm; thin wires/antennas are omitted.
  if (detail >= 2)
    for (const [x, z, top] of [
      [-8.42, -6.7, r.westTop],
      [8.42, -4.7, r.eastTop],
    ])
      beam('metal', [x, 14.2, z], [x, top - 0.3, z], 0.09);
}
