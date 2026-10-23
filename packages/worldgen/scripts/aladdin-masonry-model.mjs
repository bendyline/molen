/** 'N0625': thirty-two brick flutes, conical cap and original nonliteral frieze cells. */
import earcut from 'earcut';
import { cross, normalize } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildAladdinMasonry(face, detail, r) {
  const f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => [x + r.center[0], y + r.floorY, z + r.center[1]]),
        n,
      ),
    c = Math.cos(r.portalAngle),
    s = Math.sin(r.portalAngle),
    P = ([u, y, t]) => [-s * u + c * t, y, c * u + s * t],
    D = P,
    portal = (role, ps, n) => f(role, ps.map(P), D(n)),
    beam = (at, role, a, b, width, depth = width) => {
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
        at(
          role,
          [A[i], A[k], B[k], B[i]],
          A[i].map((q, k) => q + A[(i + 1) % 4][k] - 2 * a[k]),
        );
      }
      at(
        role,
        A,
        axis.map((v) => -v),
      );
      at(role, B, axis);
    },
    arch = (width, bottom, height, spring) => {
      const steps = [1, 2, 3, 4][detail],
        rise = (height - spring) / (Math.sqrt(3) / 2),
        out = [
          [-width / 2, bottom],
          [width / 2, bottom],
          [width / 2, bottom + spring],
        ];
      for (let i = 1; i <= steps; i++) {
        const a = (i * Math.PI) / (3 * steps);
        out.push([-width / 2 + width * Math.cos(a), bottom + spring + rise * Math.sin(a)]);
      }
      for (let i = 1; i <= steps; i++) {
        const a = (Math.PI * 2) / 3 + (i * Math.PI) / (3 * steps);
        out.push([width / 2 + width * Math.cos(a), bottom + spring + rise * Math.sin(a)]);
      }
      return out;
    },
    ring = (radius, n = 64) =>
      Array.from({ length: n }, (_, i) => [
        Math.cos(r.phaseRadians + (i * Math.PI * 2) / n) * radius,
        Math.sin(r.phaseRadians + (i * Math.PI * 2) / n) * radius,
      ]);
  prism(
    f,
    'base',
    { outline: ring(r.peakRadius + 0.12, detail === 0 ? 32 : 64) },
    r.bottomY - r.floorY,
    0.15,
  );
  const shaft = Array.from({ length: 64 }, (_, i) => {
      const a = r.phaseRadians + (i * Math.PI) / 32,
        rad = i % 2 ? r.valleyRadius : r.peakRadius;
      return [Math.cos(a) * rad, Math.sin(a) * rad];
    }),
    low = shaft.map(([x, z]) => [x, 0.15, z]),
    upper = shaft.map(([x, z]) => [x, r.friezeBottom, z]),
    shoulder = ring(r.peakRadius + 0.05).map(([x, z]) => [x, r.shoulderY, z]);
  for (let i = 0; i < 64; i++) {
    const k = (i + 1) % 64,
      n = [low[i][0] + low[k][0], 0, low[i][2] + low[k][2]];
    f('brick', [low[i], low[k], upper[k], upper[i]], n);
    f('brick', [upper[i], upper[k], shoulder[k], shoulder[i]], n);
    f('roof', [shoulder[i], shoulder[k], [0, r.height, 0]], [n[0], 1, n[2]]);
  }
  const p = r.porch,
    foot = {
      outline: [
        [-p.width / 2, p.back],
        [p.width / 2, p.back],
        [p.width / 2, p.front],
        [-p.width / 2, p.front],
      ],
    };
  prism(portal, 'base', foot, r.bottomY - r.floorY, 0.14);
  prism(
    (role, ps, n) => {
      if (n[2] < 0.5) portal(role, ps, n);
    },
    'plaster',
    foot,
    0,
    p.top,
  );
  const doors = [
      { width: 1.35, bottom: 0.12, height: 2.55, spring: 1.9, depth: 0.38, role: 'gate' },
      { width: 2.72, bottom: 2.95, height: 2.8, spring: 1.8, depth: 0.28, role: 'plaster' },
      { width: 2.75, bottom: 6.0, height: 1.1, spring: 0.12, depth: 0.4, role: 'plaster' },
    ],
    outer = [
      [-p.width / 2, 0],
      [p.width / 2, 0],
      [p.width / 2, p.top],
      [-p.width / 2, p.top],
    ],
    holes = doors.map((d) => arch(d.width, d.bottom, d.height, d.spring)),
    flat = [outer, ...holes].flat(),
    starts = [];
  let count = outer.length;
  for (const h of holes) {
    starts.push(count);
    count += h.length;
  }
  const ix = earcut(flat.flat(), starts),
    map = ([u, y], depth = 0) => [u, y, p.front + depth];
  for (let i = 0; i < ix.length; i += 3)
    portal(
      'plaster',
      ix.slice(i, i + 3).map((k) => map(flat[k])),
      [0, 0, 1],
    );
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i],
      d = doors[i],
      center = [0, d.bottom + d.height / 2];
    portal(
      d.role,
      h.map((v) => map(v, -d.depth)),
      [0, 0, 1],
    );
    for (let j = 0; j < h.length; j++) {
      const k = (j + 1) % h.length,
        mid = h[j].map((v, i) => (v + h[k][i]) / 2);
      portal(
        'plaster',
        [map(h[j]), map(h[k]), map(h[k], -d.depth), map(h[j], -d.depth)],
        [center[0] - mid[0], center[1] - mid[1], 0],
      );
    }
  }
  if (detail > 0) {
    for (const u of [-0.47, -0.24, 0, 0.24, 0.47])
      beam(portal, 'gate', [u, 0.22, p.front - 0.1], [u, 2.02, p.front - 0.1], 0.065);
    for (const y of [0.3, 1.95])
      beam(portal, 'gate', [-0.59, y, p.front - 0.1], [0.59, y, p.front - 0.1], 0.075);
  }
  box(portal, 'base', 0, 0, p.front + 0.21, 1.65, 0.12, 0.45);

  // Closed blind cells use actual reveals; blue inserts are original geometric fragments.
  function niche(angle, width, bottom, height, spring, front, back, role = 'brick', tile = false) {
    const normal = [Math.cos(angle), 0, Math.sin(angle)],
      u = [-normal[2], 0, normal[0]],
      point = ([x, y], t) => [u[0] * x + normal[0] * t, y, u[2] * x + normal[2] * t],
      inside = arch(width, bottom, height, spring),
      outside = arch(width + 0.18, bottom - 0.06, height + 0.14, spring + 0.08),
      flat = [...outside, ...inside],
      ix = earcut(flat.flat(), [outside.length]);
    for (let i = 0; i < ix.length; i += 3)
      f(
        'relief',
        ix.slice(i, i + 3).map((k) => point(flat[k], front)),
        normal,
      );
    f(
      role,
      inside.map((p) => point(p, back)),
      normal,
    );
    for (const [ring, end, sign] of [
      [outside, r.valleyRadius - 0.15, 1],
      [inside, back, -1],
    ]) {
      const center = [0, ring.reduce((s, p) => s + p[1], 0) / ring.length];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          mid = a.map((v, k) => (v + b[k]) / 2),
          dx = (mid[0] - center[0]) * sign,
          dy = (mid[1] - center[1]) * sign;
        f(
          'relief',
          [point(a, front), point(b, front), point(b, end), point(a, end)],
          [u[0] * dx, dy, u[2] * dx],
        );
      }
    }
    if (tile && detail > 0) {
      for (const sign of [-1, 1]) {
        const x = sign * width * 0.25,
          y = bottom + 0.22;
        f(
          'tile',
          [
            [x - 0.09, y],
            [x + 0.09, y],
            [x + 0.09, y + 0.36],
            [x - 0.09, y + 0.36],
          ].map((p) => point(p, back + 0.012)),
          normal,
        );
      }
      if (detail >= 2)
        f(
          'tile',
          [
            [-0.14, bottom + 0.8],
            [0, bottom + 1.02],
            [0.14, bottom + 0.8],
            [0, bottom + 0.62],
          ].map((p) => point(p, back + 0.012)),
          normal,
        );
    }
  }
  for (let i = 0; i < r.flutes; i++) {
    const angle = r.phaseRadians + ((i + 0.5) * Math.PI * 2) / r.flutes;
    if (detail === 0) {
      const n = [Math.cos(angle), 0, Math.sin(angle)],
        u = [-n[2], 0, n[0]],
        rad = r.peakRadius + 0.07;
      f(
        'relief',
        [
          [-0.48, 18.45],
          [0.48, 18.45],
          [0, 19.8],
        ].map(([x, y]) => [u[0] * x + n[0] * rad, y, u[2] * x + n[2] * rad]),
        n,
      );
    } else
      niche(
        angle,
        0.82,
        18.35,
        1.42,
        0.74,
        r.peakRadius + 0.18,
        r.peakRadius + 0.04,
        'brick',
        [2, 5, 11, 17, 23, 28].includes(i),
      );
  }
  if (detail > 0)
    niche(
      r.portalAngle,
      0.62,
      11.4,
      2.35,
      1.65,
      r.peakRadius - 0.04,
      r.peakRadius - 0.26,
      'plaster',
    );
}
