/** N0511: surviving podium, eroded cores and the modern altar canopy. */
import earcut from 'earcut';
export const caesarCandidateId = 'N0511';

function box(f, role, x, y, z, w, h, d) {
  const a = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([u, v]) => [x + u, y, z + v]),
    b = a.map(([u, v, t]) => [u, v + h, t]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
}
function pose(f, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c]),
      [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
    );
}
function beam(f, role, a, b, width) {
  const axis = b.map((v, i) => v - a[i]),
    length = Math.hypot(...axis),
    n = axis.map((v) => v / length),
    v = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    u0 = cross(n, v),
    u = u0.map((x) => x / Math.hypot(...u0)),
    w = cross(n, u),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => p.map((v, i) => v + ((u[i] * x + w[i] * z) * width) / 2)),
    p = ring(a),
    q = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      role,
      [p[i], p[j], q[j], q[i]],
      p[i].map((v, k) => (v + p[j][k]) / 2 - a[k]),
    );
  }
  f(
    role,
    p,
    n.map((v) => -v),
  );
  f(role, q, n);
}
function prism(f, role, outline, bottom, top, detail, seed = 0, eroded = false) {
  const ps = [],
    edges = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      count = detail
        ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / [6, 2.2, 1.1, 0.65][detail]))
        : 1;
    for (let j = 0; j < count; j++) {
      ps.push([a[0] + ((b[0] - a[0]) * j) / count, a[1] + ((b[1] - a[1]) * j) / count]);
      edges.push(i);
    }
  }
  const base = ps.map(([x, z]) => [x, typeof bottom === 'function' ? bottom(x, z) : bottom, z]),
    center = ps.reduce((a, p) => a.map((v, i) => v + p[i] / ps.length), [0, 0]),
    rim = ps.map(([x, z], i) => [
      x + (eroded && detail ? (center[0] - x) * (0.002 + 0.001 * Math.sin(i * 2.17 + seed)) : 0),
      top +
        (eroded && detail
          ? Math.sin(i * 2.17 + seed) * 0.18 + Math.sin(i * 0.77 + seed) * 0.12
          : 0),
      z + (eroded && detail ? (center[1] - z) * (0.002 + 0.001 * Math.sin(i * 2.17 + seed)) : 0),
    ]);
  for (let i = 0; i < ps.length; i++) {
    const j = (i + 1) % ps.length,
      n = [ps[j][1] - ps[i][1], 0, ps[i][0] - ps[j][0]];
    if (eroded && detail >= 1) {
      const strip = detail === 1 ? 2 : 3;
      for (let k = 0; k < strip; k++) {
        const a = k / strip,
          b = (k + 1) / strip,
          at = (p, t) => p.map((v, l) => v * (1 - t) + rim[p === base[i] ? i : j][l] * t),
          p = at(base[i], a),
          q = at(base[j], a),
          r = at(base[j], b),
          s = at(base[i], b);
        f((edges[i] + seed) % 3 === 0 && k === 0 ? 'brick' : role, [p, q, r, s], n);
      }
    } else f(role, [base[i], base[j], rim[j], rim[i]], n);
  }
  // Triangulate the actual eroded rim, retaining its non-collinear boundary vertices.
  const ix = earcut(rim.flatMap((p) => [p[0], p[2]]));
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => rim[k]),
      [0, 1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => base[k]),
      [0, -1, 0],
    );
  }
}
export function buildCaesarRuins(face, detail, r, sample) {
  const f = pose(face, r.architecturalAngleRadians),
    main = r.controls.find((p) => p.kind === 'podium'),
    shelter = r.controls.find((p) => p.kind === 'shelter');
  for (const p of r.podiumPolygons)
    prism(
      face,
      'core',
      p.outline,
      (x, z) => sample(x, z) - 0.65,
      main.baseY + p.height,
      detail,
      0,
      false,
    );
  for (const [i, p] of r.controls.entries())
    if (p.kind === 'core' || p.kind === 'trace')
      for (const poly of p.polygons)
        prism(
          face,
          p.kind === 'trace' ? 'marble' : 'core',
          poly.outline,
          p.foundationY,
          p.baseY + p.height,
          detail,
          i,
          p.kind === 'core',
        );
  // The mapped canopy remains open below; the modern cover is not an ancient temple roof.
  const outer = r.roofLocal,
    eave = shelter.eaveY,
    apex = [shelter.ridgeLocal[0], shelter.ridgeY, shelter.ridgeLocal[1]],
    under = apex.map((v, i) => v - (i === 1 ? 0.12 : 0));
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      a = [outer[i][0], eave, outer[i][1]],
      b = [outer[j][0], eave, outer[j][1]],
      ua = [a[0], eave - 0.12, a[2]],
      ub = [b[0], eave - 0.12, b[2]];
    f('roof', [apex, a, b], [0, 1, 0]);
    f('timber', [under, ub, ua], [0, -1, 0]);
    f('timber', [ua, ub, b, a], [b[2] - a[2], 0, a[0] - b[0]]);
    if (detail >= 1) {
      beam(f, 'timber', ua, ub, 0.16);
      if (i % 2 === 0 || detail >= 2) beam(f, 'timber', [a[0], eave - 0.2, a[2]], under, 0.13);
    }
  }
  if (detail >= 1) {
    beam(f, 'timber', [-7.3, 2.72, 5.8], [0.05, 2.72, 5.8], 0.18);
    beam(f, 'timber', [-7.1, 2.75, 5.8], [-3.6, 3.85, 3.1], 0.17);
    beam(f, 'timber', [0, 2.75, 5.8], [-3.6, 3.85, 3.1], 0.17);
    for (const x of [-7.1, 0]) box(f, 'timber', x, 0, 5.8, 0.16, 2.9, 0.16);
  }
  // Picture-led rough altar remnant, separately seated inside the mapped recess.
  const [ax, az] = r.altar.localCenter,
    y = r.altar.floorY;
  const ring = Array.from({ length: detail === 0 ? 8 : 16 }, (_, i) => [
    ax + Math.cos((i * Math.PI * 2) / (detail === 0 ? 8 : 16)) * 1.35,
    az + Math.sin((i * Math.PI * 2) / (detail === 0 ? 8 : 16)) * 1.02,
  ]);
  prism(f, 'core', ring, y - 0.2, y + 0.3, 0);
  box(f, 'core', ax, y + 0.28, az, 2.45, 0.23, 1.65);
  for (const [i, p] of [
    [-0.55, 0, 0.95, 0.85, 0.8],
    [0.53, 0.15, 0.8, 0.7, 0.7],
    [-0.45, -0.32, 0.9, 0.6, 0.45],
  ].entries()) {
    const [x, z, w, d, h] = p;
    box(f, 'core', ax + x, y + 0.51 + (i === 2 ? 0.75 : 0), az + z, w, h, d);
  }
  if (detail >= 1) {
    // Low surviving ashlar ends and a few fallen cornice fragments, no invented inscriptions.
    for (const side of [-1, 1])
      for (let k = 0; k < (detail >= 2 ? 4 : 2); k++)
        box(f, 'marble', -3.6 + side * 4.0, y + k * 0.45, 6.1, 1.1, 0.43, 0.85);
    for (let k = 0; k < (detail >= 2 ? 8 : 3); k++) {
      const x = -11.3 + k * 2.2;
      box(
        f,
        'marble',
        x,
        main.baseY + 3.25,
        0.2,
        0.95 + (k % 2) * 0.35,
        0.28 + (k % 3) * 0.12,
        0.6,
      );
    }
    const rails = [
      [-8.1, 8.1, 0.5, 8.1],
      [-8.1, 8.1, -8.1, 6.5],
      [0.5, 8.1, 0.5, 6.5],
    ];
    for (const [a, b, c, d] of rails) {
      for (const h of [0.45, 0.85]) beam(f, 'rail', [a, y + h, b], [c, y + h, d], 0.035);
      const n = Math.ceil(Math.hypot(c - a, d - b) / 1.4);
      for (let j = 0; j <= n; j++)
        beam(
          f,
          'rail',
          [a + ((c - a) * j) / n, y - 0.12, b + ((d - b) * j) / n],
          [a + ((c - a) * j) / n, y + 0.9, b + ((d - b) * j) / n],
          0.045,
        );
    }
  }
}
