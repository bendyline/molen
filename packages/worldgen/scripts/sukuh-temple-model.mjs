/** 'N0538': Sukuh's west stair pyramid, detached platforms and lower stone gateway. */
import earcut from 'earcut';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

function ellipsoid(f, role, x, y, z, rx, ry, rz, detail) {
  const n = detail >= 2 ? 12 : 6,
    bands = detail >= 2 ? 6 : 3;
  const p = (i, j) => {
    const a = (i * Math.PI) / bands,
      b = (j * 2 * Math.PI) / n;
    return [
      x + rx * Math.sin(a) * Math.cos(b),
      y + ry * Math.cos(a),
      z + rz * Math.sin(a) * Math.sin(b),
    ];
  };
  for (let i = 0; i < bands; i++)
    for (let j = 0; j < n; j++) {
      const ps = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
      f(role, ps, [(ps[1][0] - x) / rx, (ps[1][1] - y) / ry, (ps[1][2] - z) / rz]);
    }
}
function ringFaces(f, role, low, high) {
  for (let i = 0; i < low.length; i++) {
    const j = (i + 1) % low.length,
      a = low[i],
      b = low[j];
    f(role, [a, b, high[j], high[i]], [b[2] - a[2], 0, a[0] - b[0]]);
  }
}
function cap(f, role, ring) {
  const ix = earcut(ring.flatMap((p) => [p[0], p[2]]));
  for (let i = 0; i < ix.length; i += 3)
    f(
      role,
      ix.slice(i, i + 3).map((k) => ring[k]),
      [0, 1, 0],
    );
}
export function buildSukuhTemple(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z);
  const f = (role, ps, n) => {
    if (detail === 0 && n[1] < -0.5) return;
    face(
      role,
      ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
  };
  function buried(p, top, role = 'dressed') {
    const pts = p.outline.flatMap((a, i) => {
      const b = p.outline[(i + 1) % p.outline.length],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      return Array.from({ length: n + 1 }, (_, k) => [
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
    });
    prism(f, role, p, Math.min(...pts.map((p) => grade(...p))) - 0.65, top);
  }
  const p = r.pyramid,
    base = p.floorY,
    h = p.height,
    half = p.channelWidth / 2;
  // The concave western notch is a real shaft, not a dark surface on a solid pyramid.
  const ring = (t, y, extra = 0) => {
    const w = p.width + (p.topWidth - p.width) * t + extra,
      d = p.depth + (p.topDepth - p.depth) * t + extra,
      x = p.center[0],
      z = p.center[1];
    return [
      [x - w / 2, y, z - d / 2],
      [x + w / 2, y, z - d / 2],
      [x + w / 2, y, z + d / 2],
      [x - w / 2, y, z + d / 2],
      [x - w / 2, y, half],
      [p.channelEnd, y, half],
      [p.channelEnd, y, -half],
      [x - w / 2, y, -half],
    ];
  };
  const n = [3, 12, 25, 29][detail],
    bottom =
      Math.min(...r.controls[0].localPolygons.flatMap((q) => q.outline.map((p) => grade(...p)))) -
      0.65;
  ringFaces(f, 'stone', ring(0, bottom), ring(0, base));
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = (i + 1) / n,
      lip = detail >= 1 ? 0.025 : 0;
    ringFaces(f, 'stone', ring(t, base + t * (h - 1.05), lip), ring(u, base + u * (h - 1.05)));
  }
  const summit = [
    [0, 0],
    [0.14, 0.32],
    [0.38, 0.14],
    [0.78, 0.1],
    [0.91, 0.36],
    [1.05, 0.36],
  ];
  for (let i = 0; i < summit.length - 1; i++)
    ringFaces(
      f,
      'dressed',
      ring(1, base + h - 1.05 + summit[i][0], summit[i][1]),
      ring(1, base + h - 1.05 + summit[i + 1][0], summit[i + 1][1]),
    );
  cap(f, 'dressed', ring(1, base + h, 0.36));
  const stairOuter = p.center[0] - p.width / 2 - 0.05,
    stairEnd = p.channelEnd + 0.01,
    steps = [8, 20, 33, 38][detail];
  for (let i = 0; i < steps; i++) {
    const x = stairOuter + ((stairEnd - stairOuter) * (i + 0.5)) / steps,
      top = base + (h * (i + 1)) / steps;
    box(
      f,
      'dressed',
      x,
      bottom,
      0,
      (stairEnd - stairOuter) / steps + 0.008,
      top - bottom,
      p.channelWidth - 0.06,
    );
  }
  // Two pale sloping strips flank the dark ascending stair shaft.
  for (const side of [-1, 1]) {
    const z = side * (half + 0.38),
      x0 = stairOuter,
      x1 = p.center[0] - p.topWidth / 2;
    const ps = [
      [x0, base, z - 0.29],
      [x1, base + h - 0.7, z - 0.29],
      [x1, base + h - 0.7, z + 0.29],
      [x0, base, z + 0.29],
    ];
    f('dressed', ps, [-1, 0.4, 0]);
    for (const dz of [-0.29, 0.29])
      f(
        'dressed',
        [
          [x0, bottom, z + dz],
          [x1, bottom, z + dz],
          [x1, base + h - 0.7, z + dz],
          [x0, base, z + dz],
        ],
        [0, 0, Math.sign(dz)],
      );
    if (detail >= 1)
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        box(f, 'dressed', x0 + (x1 - x0) * t, base + (h - 0.7) * t, z, 0.16, 0.07, 0.62);
      }
  }
  box(
    f,
    'dressed',
    p.center[0] - p.topWidth / 2 + 0.12,
    base + h - 1.3,
    0,
    0.9,
    0.43,
    p.channelWidth + 1.35,
  );
  box(
    f,
    'dressed',
    p.center[0] - p.topWidth / 2 + 0.12,
    base + h - 0.87,
    0,
    1.02,
    0.2,
    p.channelWidth + 1.65,
  );
  for (const q of r.parts.slice(2)) {
    const [x, z] = q.center,
      small = q.owner === 35185018533593;
    for (const poly of q.polygons) buried(poly, q.floorY + 0.18);
    box(f, 'dressed', x, q.floorY + 0.18, z, q.width, 0.18, q.depth);
    box(f, 'stone', x, q.floorY + 0.36, z, q.width - 0.32, small ? 1.5 : 0.35, q.depth - 0.32);
    box(f, 'dressed', x, q.floorY + (small ? 1.86 : 0.71), z, q.width - 0.05, 0.15, q.depth - 0.05);
    if (small) {
      loft(
        f,
        'carved',
        x,
        z,
        [
          [q.floorY + 2.01, 2.55],
          [q.floorY + 2.32, 2.02],
          [q.floorY + 2.48, 1.1],
        ],
        true,
      );
      if (detail >= 1)
        for (const k of [-1, 0, 1]) {
          box(f, 'carved', x - q.width / 2 + 0.1, q.floorY + 0.48, z + k * 0.65, 0.17, 1.05, 0.38);
          ellipsoid(
            f,
            'carved',
            x - q.width / 2 - 0.02,
            q.floorY + 1.28,
            z + k * 0.65,
            0.13,
            0.2,
            0.18,
            detail,
          );
        }
    } else if (q.owner === 35185018533591) {
      const top = q.floorY + 0.86;
      for (const dx of [-2.45, 0.1, 2.55]) {
        const sx = x + dx;
        box(f, 'carved', sx, top, z, 1.05, detail === 0 ? 1.5 : 1.9, 0.52);
        if (detail >= 1) {
          ellipsoid(f, 'carved', sx, top + 1.95, z, 0.5, 0.38, 0.26, detail);
          for (const dz of [-0.32, 0.32])
            box(f, 'carved', sx - 0.12, top + 0.6, z + dz, 0.13, 0.9, 0.12);
        }
      }
      if (detail >= 1) {
        const sx = x + 0.1,
          sy = top;
        ellipsoid(f, 'carved', sx - 0.45, sy + 1, z, 0.4, 0.75, 0.38, detail);
        ellipsoid(f, 'carved', sx - 0.54, sy + 1.9, z, 0.34, 0.38, 0.32, detail);
        loft(
          (role, ps, _n) =>
            f(
              role,
              ps.map(([u, v, w]) => [sx - 0.75 - u * 0.4, sy + 1.85 + v * 0.18, z + w * 0.28]),
              [-1, 0, 0],
            ),
          'carved',
          0,
          0,
          [
            [0, 0.5],
            [1, 0.12],
          ],
          false,
        );
        for (const side of [-1, 1])
          f(
            'carved',
            [
              [sx - 0.43, sy + 1.5, z],
              [sx - 0.3, sy + 1.65, z + side * 1.2],
              [sx - 0.2, sy + 0.5, z + side * 0.75],
            ],
            [-1, 0, 0],
          );
      }
    } else {
      const top = q.floorY + 0.86;
      loft(
        f,
        'carved',
        x,
        z,
        [
          [top, 1.85],
          [top + 0.35, 1.85],
          [top + 0.55, 1.24],
          [top + 2.3, 0.75],
          [top + 2.8, 0.35],
        ],
        false,
      );
    }
  }
  for (const [x, z] of r.turtles) {
    const y = grade(x, z) + 0.14;
    if (detail === 0) box(f, 'carved', x, y, z, 1.7, 0.3, 1.15);
    else {
      ellipsoid(f, 'carved', x, y + 0.19, z, 0.87, 0.28, 0.61, detail);
      ellipsoid(f, 'carved', x - 0.92, y + 0.13, z, 0.28, 0.15, 0.2, detail);
      for (const dx of [-0.52, 0.5])
        for (const dz of [-0.55, 0.55])
          ellipsoid(f, 'carved', x + dx, y + 0.02, z + dz, 0.21, 0.1, 0.19, detail);
    }
  }
  const gate = r.parts[1],
    [gx, gz] = gate.center,
    gy = gate.floorY;
  const front = (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, v]) => [gx - v, gy + y, gz + u]),
      [-n[2], n[1], n[0]],
    );
  const opening = 1.04,
    span = gate.depth,
    pier = (span - opening) / 2;
  const gateBottom =
    Math.min(...gate.polygons.flatMap((p) => p.outline.map((p) => grade(...p)))) - gy - 0.65;
  for (const side of [-1, 1])
    loft(
      (role, ps, n) =>
        front(
          role,
          ps.map(([u, y, v]) => [(side * (opening + pier)) / 2 + u, y, (v * gate.width) / pier]),
          n,
        ),
      'stone',
      0,
      0,
      [
        [gateBottom, pier],
        [0, pier],
        [3.6, pier * 0.83],
      ],
      false,
    );
  box(front, 'dressed', 0, 2.8, 0, opening + 0.46, 0.32, gate.width - 0.3);
  box(front, 'stone', 0, 3.12, 0, span - 0.6, 0.6, gate.width - 0.7);
  for (let i = 0; i < 4; i++)
    box(
      front,
      'dressed',
      0,
      3.72 + i * 0.33,
      0,
      span - 0.25 - i * 0.98,
      0.33,
      Math.max(1.35, gate.width - 0.3 - i * 0.65),
    );
  if (detail >= 1)
    for (const side of [-1, 1]) {
      const z = side * (gate.width / 2 - 0.18);
      ellipsoid(front, 'carved', 0, 3.55, z, 0.4, 0.46, 0.22, detail);
      for (const x of [-0.22, 0.22])
        ellipsoid(front, 'carved', x, 3.62, z + side * 0.15, 0.14, 0.13, 0.1, detail);
      for (const x of [-0.25, -0.08, 0.08, 0.25])
        box(front, 'carved', x, 3.13, z + side * 0.19, 0.11, 0.19, 0.12);
    }
  const gateBase =
    Math.min(...gate.polygons.flatMap((p) => p.outline.map((p) => grade(...p)))) - 0.65;
  // Narrow threshold and short western approach; the stone passage stays open.
  box(f, 'dressed', gx, gateBase, gz, gate.width + 0.1, gy + 0.08 - gateBase, opening - 0.06);
  for (let i = 0; i < 4; i++) {
    const x = gx - gate.width / 2 - (i + 0.5) * 0.4,
      top = gy - 0.12 - i * 0.18;
    buried(rect(x, gz, 0.42, 1.65), top);
  }
  for (const t of r.terraces) {
    const gap = t.x < -70 ? gz : 0,
      step = detail === 0 ? 12 : detail === 1 ? 6 : 3;
    for (const [lo, hi] of [
      [t.zLow, gap - 1.75],
      [gap + 1.75, t.zHigh],
    ]) {
      const n = Math.ceil((hi - lo) / step);
      for (let i = 0; i < n; i++) {
        const z = lo + ((hi - lo) * (i + 0.5)) / n,
          poly = rect(t.x, z, 0.52, (hi - lo) / n + 0.01),
          top = Math.max(...poly.outline.map((p) => grade(...p))) + t.height;
        buried(poly, top, 'stone');
        if (detail >= 1) box(f, 'dressed', t.x, top, z, 0.64, 0.12, (hi - lo) / n + 0.01);
      }
    }
    if (t.x > -70)
      for (let i = 0; i < 5; i++) {
        const x = t.x - 1.9 + i * 0.66,
          top = grade(x, 0) + 0.18;
        buried(rect(x, 0, 0.68, 2.5), top);
      }
  }
}
