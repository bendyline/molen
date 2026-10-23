/** 'N0765_TRICLINIUM': a pale framed shelter over the mapped triapsidal dining hall. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildCasaleTriclinium(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, y, z, w, h, d),
    Y = r.floorY,
    E = Y + r.eave,
    outline = r.floors[0].outline;
  const beam = (a, b, w) => {
    const d = b.map((v, k) => v - a[k]),
      l = Math.hypot(...d);
    if (l < 1e-7) return;
    const t = d.map((v) => v / l),
      u = Math.abs(t[1]) < 0.9 ? [-t[2], 0, t[0]] : [1, 0, 0],
      ul = Math.hypot(...u),
      v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]],
      ring = (p) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, z]) => p.map((q, k) => q + ((u[k] * x + v[k] * z) * w) / (2 * ul))),
      lo = ring(a),
      hi = ring(b);
    for (let i = 0; i < 4; i++)
      f(
        'frame',
        [lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]],
        lo[i].map((x, k) => x - a[k]),
      );
    f(
      'frame',
      lo,
      t.map((v) => -v),
    );
    f('frame', hi, t);
  };
  prism(f, 'stone', r.floors[0], r.foundationY, Y);
  if (detail) prism(f, 'floor', r.floors[0], Y, Y + 0.025);
  const area = outline.reduce(
      (s, p, i) =>
        s +
        p[0] * outline[(i + 1) % outline.length][1] -
        p[1] * outline[(i + 1) % outline.length][0],
      0,
    ),
    sign = Math.sign(area);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      n = [(dz * sign) / length, 0, (-dx * sign) / length],
      ts = [0, 1];
    if (Math.abs(a[0] - r.entry.x) < 0.001 && Math.abs(b[0] - r.entry.x) < 0.001)
      for (const z of [-r.entry.width / 2, r.entry.width / 2]) {
        const t = (z - a[1]) / dz;
        if (t > 0 && t < 1) ts.push(t);
      }
    ts.sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const p = a.map((v, k) => v + (b[k] - v) * ts[j - 1]),
        q = a.map((v, k) => v + (b[k] - v) * ts[j]),
        isEntry =
          Math.abs(p[0] - r.entry.x) < 0.001 &&
          Math.abs((p[1] + q[1]) / 2) < r.entry.width / 2 - 0.001;
      const panel = (role, lo, hi) =>
        f(
          role,
          [
            [p[0], lo, p[1]],
            [q[0], lo, q[1]],
            [q[0], hi, q[1]],
            [p[0], hi, p[1]],
          ],
          n,
        );
      if (!detail) {
        panel('glass', Y, E);
        continue;
      }
      if (!isEntry) {
        panel('stone', Y, Y + 1);
        panel('glass', Y + 1, E);
      } else panel('glass', Y + r.entry.height, E);
    }
    if (detail) {
      const count = detail === 1 ? 1 : Math.max(1, Math.ceil(length / (detail === 3 ? 2.8 : 4.5)));
      for (let j = 0; j < count; j++) {
        const t = j / count,
          x = a[0] + dx * t,
          z = a[1] + dz * t;
        if (Math.abs(x - r.entry.x) < 0.001 && Math.abs(z) < r.entry.width / 2 - 0.1) continue;
        beam([x, Y + 0.9, z], [x, E + 0.06, z], detail === 3 ? 0.12 : 0.16);
      }
      beam([a[0], E, a[1]], [b[0], E, b[1]], 0.13);
      if (detail > 1 && length > 2.4 && Math.abs(a[0] - r.entry.x) > 0.01)
        beam([a[0], Y + 1.02, a[1]], [b[0], Y + 1.02, b[1]], 0.09);
    }
  }
  const coreHeight = ([x, z]) =>
    E + (r.centralPeak - r.eave) * Math.max(0, 1 - Math.max(Math.abs(x) / 8.35, Math.abs(z) / 7.8));
  const closeEnough = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j],
        b = ring[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)),
        );
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < 0.002) return true;
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    return inside;
  };
  for (const region of r.roofRegions) {
    const p = region.outline,
      c = region.kind === 'core' ? [0, 0] : region.center,
      nearCenter = closeEnough(c, p),
      h =
        region.kind === 'core'
          ? coreHeight
          : (q) =>
              E +
              (r.apsePeak - r.eave) * Math.max(0, 1 - Math.hypot(q[0] - c[0], q[1] - c[1]) / 5.5),
      triangles = [];
    if (nearCenter)
      for (let i = 0; i < p.length; i++) triangles.push([c, p[i], p[(i + 1) % p.length]]);
    else {
      const ix = earcut(p.flat());
      for (let i = 0; i < ix.length; i += 3) triangles.push(ix.slice(i, i + 3).map((k) => p[k]));
    }
    for (const t of triangles) {
      const ps = t.map((q) => [q[0], h(q), q[1]]);
      f('roof', ps, [0, 1, 0]);
      if (detail)
        f(
          'roof',
          ps.map((q) => [q[0], q[1] - 0.1, q[2]]),
          [0, -1, 0],
        );
    }
    const s = Math.sign(
      p.reduce(
        (sum, a, i) => sum + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
        0,
      ),
    );
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        n = [(b[1] - a[1]) * s, 0, (a[0] - b[0]) * s];
      if (detail) {
        f(
          'roof',
          [
            [a[0], h(a) - 0.1, a[1]],
            [b[0], h(b) - 0.1, b[1]],
            [b[0], h(b), b[1]],
            [a[0], h(a), a[1]],
          ],
          n,
        );
        if (Math.max(h(a), h(b)) - E > 0.12)
          f(
            'glass',
            [
              [a[0], E - 0.1, a[1]],
              [b[0], E - 0.1, b[1]],
              [b[0], h(b) - 0.1, b[1]],
              [a[0], h(a) - 0.1, a[1]],
            ],
            n,
          );
      }
      if (nearCenter && detail && (detail > 1 || i % 3 === 0))
        beam([c[0], h(c) + 0.055, c[1]], [a[0], h(a) + 0.055, a[1]], detail === 3 ? 0.11 : 0.14);
      if (nearCenter && detail === 3 && Math.hypot(b[0] - a[0], b[1] - a[1]) > 2.8) {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        beam([c[0], h(c) + 0.055, c[1]], [m[0], h(m) + 0.055, m[1]], 0.075);
      }
    }
  }
  if (detail) {
    const e = r.entry,
      x = e.x,
      z0 = -e.width / 2,
      z1 = e.width / 2,
      back = x + e.depth;
    f(
      'glass',
      [
        [back, Y + 0.025, z0],
        [back, Y + 0.025, z1],
        [back, Y + e.height, z1],
        [back, Y + e.height, z0],
      ],
      [-1, 0, 0],
    );
    f(
      'stone',
      [
        [x, Y, z0],
        [back, Y, z0],
        [back, Y + e.height, z0],
        [x, Y + e.height, z0],
      ],
      [0, 0, 1],
    );
    f(
      'stone',
      [
        [back, Y, z1],
        [x, Y, z1],
        [x, Y + e.height, z1],
        [back, Y + e.height, z1],
      ],
      [0, 0, -1],
    );
    f(
      'roof',
      [
        [x, Y + e.height, z0],
        [back, Y + e.height, z0],
        [back, Y + e.height, z1],
        [x, Y + e.height, z1],
      ],
      [0, -1, 0],
    );
    B('stone', (x + back) / 2, Y, z0 + e.width / 2, e.depth, 0.06, e.width);
    for (const z of [z0, z1]) beam([x - 0.03, Y, z], [x - 0.03, Y + e.height + 0.12, z], 0.18);
    beam([x - 0.03, Y + e.height, z0], [x - 0.03, Y + e.height, z1], 0.18);
    beam([back - 0.02, Y + 0.05, 0], [back - 0.02, Y + e.height, 0], 0.07);
    for (let j = 0; j < 3; j++) {
      const lo = x - 1.2 + j * 0.4,
        top = Y - (2 - j) * 0.18;
      B('stone', lo + 0.2, r.foundationY, 0, 0.4, top - r.foundationY, e.width);
    }
  }
}
