/** Reusable metric Khmer masonry, corbel roofs and silhouette lofts. */
import earcut from 'earcut';
export function prism(f, role, p, lo, hi, bottom = true) {
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
export const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
export const box = (f, role, x, y, z, w, h, d) => prism(f, role, rect(x, z, w, d), y, y + h);
export function loft(f, role, x, z, profile, chamfer, footprint) {
  const rings = profile.map(([y, w]) =>
    (footprint
      ? footprint(w)
      : chamfer
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
  for (const [ring, normal] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), [0, 1, 0]],
  ]) {
    const indices = earcut(ring.flatMap((p) => [p[0], p[2]]));
    for (let i = 0; i < indices.length; i += 3)
      f(
        role,
        indices.slice(i, i + 3).map((k) => ring[k]),
        normal,
      );
  }
}
export function corbel(f, center, length, width, alongX, detail) {
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

export function pediment(f, x, y, z, w, h, detail) {
  const outline =
      detail === 0
        ? [
            [-0.5, 0],
            [0.5, 0],
            [0, 1],
          ]
        : detail === 1
          ? [
              [-0.5, 0],
              [-0.4, 0.4],
              [-0.2, 0.65],
              [0, 1],
              [0.2, 0.65],
              [0.4, 0.4],
              [0.5, 0],
            ]
          : [
              [-0.5, 0],
              [-0.48, 0.22],
              [-0.37, 0.45],
              [-0.29, 0.48],
              [-0.2, 0.75],
              [-0.12, 0.81],
              [0, 1],
              [0.12, 0.81],
              [0.2, 0.75],
              [0.29, 0.48],
              [0.37, 0.45],
              [0.48, 0.22],
              [0.5, 0],
            ],
    a = outline.map(([u, v]) => [x + u * w, y + v * h, z]),
    b = a.map(([u, v, t]) => [u, v, t + 0.28]),
    ix = earcut(outline.flat());
  for (let i = 0; i < ix.length; i += 3) {
    f(
      'carved',
      ix.slice(i, i + 3).map((k) => a[k]),
      [0, 0, -1],
    );
    f(
      'stone',
      ix.slice(i, i + 3).map((k) => b[k]),
      [0, 0, 1],
    );
  }
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    f('stone', [a[i], a[j], b[j], b[i]], [a[j][1] - a[i][1], a[i][0] - a[j][0], 0]);
  }
  if (detail >= 2) {
    // Broad original scrolling/rim forms imply architectural carving, not copied narratives.
    for (let i = 0; i < outline.length - 1; i++) {
      const [u, v] = outline[i],
        [p, q] = outline[i + 1],
        dx = (p - u) * w,
        dy = (q - v) * h,
        len = Math.hypot(dx, dy),
        nx = (-dy / len) * 0.12,
        ny = (dx / len) * 0.12;
      f(
        'stone',
        [
          [x + u * w + nx, y + v * h + ny, z + 0.32],
          [x + p * w + nx, y + q * h + ny, z + 0.32],
          [x + p * w - nx, y + q * h - ny, z + 0.32],
          [x + u * w - nx, y + v * h - ny, z + 0.32],
        ],
        [0, 0, 1],
      );
    }
    for (const hand of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const px = x + hand * (0.16 + i * 0.1) * w,
          py = y + (0.25 + i * 0.15) * h;
        box(f, 'stone', px, py, z + 0.3, w * 0.1, h * 0.12, 0.14);
      }
  }
}
