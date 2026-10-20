/** N0524: mapped courts, ruined Khmer galleries and the outer eastern face gateway. */
import earcut from 'earcut';
import { bayonFaceDepth } from './bayon-temple-model.mjs';
export const kdeiCandidateId = 'N0524';
function prism(f, role, p, lo, hi, bottom = true) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, lo, z]),
    high = flat.map(([x, z]) => [x, hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    if (bottom)
      f(
        role,
        ix.slice(i, i + 3).map((k) => low[k]),
        [0, -1, 0],
      );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
const box = (f, role, x, y, z, w, h, d) => prism(f, role, rect(x, z, w, d), y, y + h);
function loft(f, role, x, z, profile, chamfer) {
  const rings = profile.map(([y, w]) =>
    (chamfer
      ? [
          [-w / 2 + 0.18, -w / 2],
          [w / 2 - 0.18, -w / 2],
          [w / 2, -w / 2 + 0.18],
          [w / 2, w / 2 - 0.18],
          [w / 2 - 0.18, w / 2],
          [-w / 2 + 0.18, w / 2],
          [-w / 2, w / 2 - 0.18],
          [-w / 2, -w / 2 + 0.18],
        ]
      : [
          [-w / 2, -w / 2],
          [w / 2, -w / 2],
          [w / 2, w / 2],
          [-w / 2, w / 2],
        ]
    ).map(([u, v]) => [x + u, y, z + v]),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < rings[k].length; i++) {
      const j = (i + 1) % rings[k].length,
        a = rings[k][i],
        b = rings[k][j];
      f(role, [a, b, rings[k + 1][j], rings[k + 1][i]], [b[2] - a[2], 0.01, a[0] - b[0]]);
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
function corbel(f, center, length, width, alongX, detail) {
  const count = Math.max(1, Math.ceil(length / (detail >= 2 ? 6 : 12))),
    profile =
      detail === 1
        ? [
            [-0.5, 4.2],
            [0, 5.6],
            [0.5, 4.2],
          ]
        : [
            [-0.5, 4.2],
            [-0.42, 4.65],
            [-0.32, 4.95],
            [-0.2, 5.4],
            [-0.08, 5.6],
            [0.08, 5.6],
            [0.2, 5.4],
            [0.32, 4.95],
            [0.42, 4.65],
            [0.5, 4.2],
          ];
  for (let k = 0; k < count; k++) {
    const start = -length / 2 + (k * length) / count,
      end = -length / 2 + ((k + 1) * length) / count,
      at = (t, [u, y]) =>
        alongX
          ? [center[0] + t, y, center[1] + u * width]
          : [center[0] + u * width, y, center[1] + t],
      p = profile.map((q) => at(start, q)),
      q = profile.map((q) => at(end, q));
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length,
        n = alongX
          ? [0, profile[j][0] - profile[i][0], profile[i][1] - profile[j][1]]
          : [profile[i][1] - profile[j][1], profile[j][0] - profile[i][0], 0];
      f('trim', [p[i], q[i], q[j], p[j]], n);
    }
    // Only the exposed ends need caps; intermediate sections meet exactly.
    if (k === 0) f('trim', p, alongX ? [-1, 0, 0] : [0, 0, -1]);
    if (k === count - 1) f('trim', q, alongX ? [1, 0, 0] : [0, 0, 1]);
  }
}
function crown(f, x, z, base, width, height, detail) {
  // Broken stacked storeys, rather than a smooth pyramid or a restored full finial.
  const h = height - base;
  const shape =
    detail === 0
      ? [
          [0, 1],
          [0.5, 0.71],
          [1, 0.42],
        ]
      : detail === 1
        ? [
            [0, 1],
            [0.32, 0.97],
            [0.36, 0.77],
            [0.72, 0.65],
            [1, 0.42],
          ]
        : (() => {
            const widths = [1, 0.82, 0.64, 0.48, 0.36],
              out = [[0, 1]];
            for (let k = 0; k < 4; k++) {
              const lo = k / 4,
                hi = (k + 1) / 4;
              out.push(
                [lo + 0.17, widths[k] * 0.91],
                [hi - 0.018, widths[k] * 0.98],
                [hi, widths[k + 1]],
              );
            }
            return out;
          })();
  loft(
    f,
    'wall',
    x,
    z,
    shape.map(([t, w]) => [base + t * h, width * w]),
    detail >= 2,
  );
  if (detail >= 2) {
    const radiusAt = (y) => {
      const t = (y - base) / h;
      let i = 1;
      while (i < shape.length - 1 && shape[i][0] < t) i++;
      const [a, b] = [shape[i - 1], shape[i]],
        q = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      return (width * (a[1] + (b[1] - a[1]) * q)) / 2;
    };
    for (const alongX of [false, true])
      for (const side of [-1, 1]) {
        const fw = width * 0.3,
          fh = Math.min(1.55, h * 0.35),
          bottom = base + 0.15;
        // Frames hug each taper; detached rectangular boxes resemble railings.
        const panel = (u0, u1, y0, y1) => {
          const P = (u, y, push) => [
              x + (alongX ? side * (radiusAt(y) + push) : u),
              y,
              z + (alongX ? u : side * (radiusAt(y) + push)),
            ],
            front = [P(u0, y0, 0.08), P(u1, y0, 0.08), P(u1, y1, 0.08), P(u0, y1, 0.08)],
            back = [P(u0, y0, 0), P(u1, y0, 0), P(u1, y1, 0), P(u0, y1, 0)],
            n = alongX ? [side, 0, 0] : [0, 0, side];
          f('trim', front, n);
          for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4,
              d = front[j].map((v, k) => v - front[i][k]);
            f(
              'trim',
              [back[i], back[j], front[j], front[i]],
              [d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]],
            );
          }
        };
        for (const edge of [-1, 1])
          panel((edge * fw) / 2 - 0.08, (edge * fw) / 2 + 0.08, bottom, bottom + fh);
        panel(-fw / 2 - 0.15, fw / 2 + 0.15, bottom + fh, bottom + fh + 0.2);
      }
  }
}
function faceBlock(f, x, z, base, width, detail) {
  const xs =
      detail === 1 ? [-1, 0, 1] : [-1, -0.8, -0.58, -0.36, -0.18, 0, 0.18, 0.36, 0.58, 0.8, 1],
    ys = detail === 1 ? [-1, 0, 1] : [-1, -0.8, -0.6, -0.45, -0.2, 0, 0.22, 0.35, 0.55, 0.75, 1],
    radius = width / 2;
  loft(
    f,
    'wall',
    x,
    z,
    [
      [base, radius * 2],
      [base + 2.7, radius * 1.82],
    ],
    detail >= 2,
  );
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a),
      P = (u, v) => {
        const h = (v + 1) / 2,
          r = radius * (1 - 0.09 * h),
          depth = bayonFaceDepth(u, v) * width * 0.16;
        return [
          x + c * u * r * 0.85 - s * (r + depth + 0.015),
          base + h * 2.7,
          z + s * u * r * 0.85 + c * (r + depth + 0.015),
        ];
      };
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++)
        f(
          'face',
          [P(xs[i], ys[j]), P(xs[i + 1], ys[j]), P(xs[i + 1], ys[j + 1]), P(xs[i], ys[j + 1])],
          [-s, 0, c],
        );
  }
}
export function buildKdeiTemple(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    pose = ([u, v]) => [c * u - s * v, s * u + c * v],
    grade = (u, v) => sampleTerrain(...pose([u, v])),
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    ground = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u, grade(u, v) + y, v]),
        n,
      ),
    m = r.main;
  if (detail === 0) {
    const strips = [
      ...[-21.4, 21.4].map((z) => ({ x: -14, z, w: 60, d: 2.5 })),
      ...[-43, 15].map((x) => ({ x, z: 0, w: 2.5, d: 41 })),
      ...[-13, 0, 13].map((z) => ({ x: -15.5, z, w: 33, d: 3.5 })),
      ...[-31, -15, 0].map((x) => ({ x, z: 0, w: 3.5, d: 28 })),
      { x: 21, z: 0, w: 12, d: 4.4 },
      { x: -47, z: 0, w: 7, d: 4.4 },
    ];
    for (const p of strips) {
      const n = Math.ceil(Math.max(p.w, p.d) / 20);
      for (let i = 0; i < n; i++)
        box(
          ground,
          'wall',
          p.x + (p.w > p.d ? ((i + 0.5) / n - 0.5) * p.w : 0),
          -0.7,
          p.z + (p.d >= p.w ? ((i + 0.5) / n - 0.5) * p.d : 0),
          p.w > p.d ? p.w / n : p.w,
          6.1,
          p.d >= p.w ? p.d / n : p.d,
        );
    }
  } else {
    const levels = m.meshLevels[detail];
    for (const p of levels.low) prism(ground, 'wall', p, -0.7, detail === 1 ? 3 : 1.2, false);
    if (detail >= 2) for (const p of levels.window) prism(ground, 'wall', p, 1.2, 3);
    for (const p of levels.upper) prism(ground, 'wall', p, 3, 4.2);
    for (const p of levels.doorFloors) prism(ground, 'trim', p, -0.7, 0.2, false);
    for (const p of levels.hall) prism(ground, 'trim', p, -0.7, 0.2, false);
    for (const roof of m.roofs)
      corbel(ground, roof.center, roof.length, roof.width, roof.alongX, detail);
  }
  // Nine mapped gallery intersections retain individually varied, broken tower crowns.
  for (const t of m.towers) {
    const [x, z] = t.center,
      base = grade(x, z);
    crown(
      (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [u, y + base, v]),
          n,
        ),
      x,
      z,
      4.2,
      t.width,
      t.height,
      detail,
    );
  }
  // Eastern cloister: an open floor and surviving pillar/lintel masses, not a solid hall box.
  if (detail === 0) box(ground, 'trim', 38, -0.7, 0, 25, 1, 21);
  const xs = detail === 0 ? [30, 46] : [30, 38, 46],
    zs = detail === 0 ? [-8, 8] : [-8, -2.7, 2.7, 8];
  for (const x of xs)
    for (const z of zs) {
      const h =
        detail === 0 ? 3.4 : (x === 38 && z === 2.7) || (x === 30 && z === -2.7) ? 1.8 : 3.5;
      box(ground, 'wall', x, 0.2, z, 0.85, h, 0.85);
      if (detail >= 1) box(ground, 'trim', x, 0.2 + h, z, 1.1, 0.25, 1.1);
    }
  if (detail >= 1)
    for (const z of [-8, 8])
      for (const [x, w] of [
        [34, 8],
        [42, 8],
      ])
        box(ground, 'trim', x, 3.7, z, w, 0.45, 0.75);
  for (const gate of r.gates) {
    const [x, z] = gate.center;
    if (detail === 0) {
      const width = gate.width,
        span = gate.span,
        opening = 1.8;
      for (const side of [-1, 1]) {
        const u = gate.alongX ? 0 : (side * (span + opening)) / 4,
          v = gate.alongX ? (side * (span + opening)) / 4 : 0;
        box(
          ground,
          'wall',
          x + u,
          -0.7,
          z + v,
          gate.alongX ? width : (span - opening) / 2,
          4.9,
          gate.alongX ? (span - opening) / 2 : width,
        );
      }
      box(
        ground,
        'wall',
        x,
        3,
        z,
        gate.alongX ? width : opening,
        1.2,
        gate.alongX ? opening : width,
      );
    } else {
      for (const p of gate.pierPolygons) prism(ground, 'wall', p, -0.7, 3, false);
      for (const p of gate.footprints) prism(ground, 'wall', p, 3, 4.2);
      // Threshold closes the portal floor while keeping the passage truly open.
      box(
        ground,
        'trim',
        x,
        -0.7,
        z,
        gate.alongX ? gate.width : 1.8,
        0.9,
        gate.alongX ? 1.8 : gate.width,
      );
      const wing = {
        center: gate.center,
        length: gate.span,
        width: Math.min(6, gate.width),
        alongX: !gate.alongX,
      };
      corbel(ground, wing.center, wing.length, wing.width, wing.alongX, detail);
    }
    const base = grade(x, z),
      fixed = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [u, base + y, v]),
          n,
        );
    if (gate.face && detail > 0) {
      faceBlock(fixed, x, z, 5.4, gate.towerWidth, detail);
      crown(fixed, x, z, 8.1, gate.towerWidth * 0.95, gate.height, detail);
    } else crown(fixed, x, z, 4.2, gate.towerWidth, gate.height, detail);
  }
}
