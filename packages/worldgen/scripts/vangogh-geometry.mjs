/** 'van_gogh_museum': mapped stepped museum, glazed stacks and elliptical exhibition/entry volumes. */
import './install-deterministic-math.mjs';
import { prism } from './khmer-structure-geometry.mjs';

export function buildVangogh(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n));
  const slab = (role, p, lo, hi) => prism(f, role, p, Y + lo, Y + hi);
  const variable = (role, p, lo, hi) =>
    prism(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, Y + (y ? hi(x, z) : lo(x, z)), z]),
          n,
        ),
      role,
      p,
      0,
      1,
    );
  const reduced = (p) => {
    if (detail > 1) return p;
    const ring = p.outline,
      n = ring.length,
      stride = detail === 0 ? 4 : 2;
    let chord = 0;
    for (let i = 1; i < n; i++)
      if (
        Math.hypot(...ring[i].map((v, k) => v - ring[(i + 1) % n][k])) >
        Math.hypot(...ring[chord].map((v, k) => v - ring[(chord + 1) % n][k]))
      )
        chord = i;
    const a = [];
    for (let j = 0; j < n; j++)
      if (j % stride === 0 || j === n - 1) a.push(ring[(chord + 1 + j) % n]);
    return { outline: a, holes: [] };
  };
  const edges = (p) => {
    const ring = p.outline,
      s = Math.sign(
        ring.reduce((n, a, i) => {
          const b = ring[(i + 1) % ring.length];
          return n + a[0] * b[1] - a[1] * b[0];
        }, 0),
      );
    return ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      return { a, b, length, t, n: [t[1] * s, -t[0] * s] };
    });
  };
  const panel = (role, e, y, h, u1 = 0, u2 = e.length, offset = 0.035) =>
    f(
      role,
      [
        [u1, y],
        [u2, y],
        [u2, y + h],
        [u1, y + h],
      ].map(([u, v]) => [
        e.a[0] + e.t[0] * u + e.n[0] * offset,
        Y + v,
        e.a[1] + e.t[1] * u + e.n[1] * offset,
      ]),
      [e.n[0], 0, e.n[1]],
    );
  for (const p of r.footing) prism(f, 'stone', p, r.foundationY, Y);
  // A low sealed fallback covers only the mapped main block; height parts define its silhouette.
  slab('wall', r.mainFloor, 0, 2);
  for (const part of r.mainParts) {
    const roofOnly = part.id === 35185126413510,
      role = part.height === 20 ? 'frosted' : part.height === 16 ? 'glass' : 'wall';
    for (const p of part.polygons) {
      if (roofOnly) {
        slab('roof', p, part.height - 0.18, part.height);
        continue;
      }
      prism((role, ps, n) => f(n[1] > 0.5 ? 'roof' : role, ps, n), role, p, Y, Y + part.height);
      if (detail === 0) continue;
      for (const e of edges(p)) {
        if (e.length < 1.2) continue;
        const glazed = role === 'glass' || role === 'frosted',
          step = detail === 1 ? 5 : 3.2;
        if (glazed) {
          for (let y = 0.2; y < part.height; y += 3.2)
            panel('frame', e, y, 0.12, 0, e.length, 0.065);
          const count = Math.max(1, Math.round(e.length / step));
          for (let j = 0; j <= count; j++)
            panel(
              'frame',
              e,
              0.2,
              part.height - 0.2,
              Math.max(0, (j * e.length) / count - 0.07),
              Math.min(e.length, (j * e.length) / count + 0.07),
              0.075,
            );
        } else {
          const upper = part.height <= 6 ? part.height - 0.5 : 4.1;
          panel('glass', e, 0.35, upper, 0.3, e.length - 0.3, 0.045);
          const count = Math.max(1, Math.round(e.length / step));
          for (let j = 0; j <= count; j++)
            panel(
              'frame',
              e,
              0.2,
              upper + 0.25,
              Math.max(0, (j * e.length) / count - 0.09),
              Math.min(e.length, (j * e.length) / count + 0.09),
              0.065,
            );
          panel('frame', e, upper + 0.35, 0.16, 0, e.length, 0.06);
        }
        panel('frame', e, part.height - 0.14, 0.14, 0, e.length, 0.045);
      }
    }
  }
  // Four modest rooflights are photo-led approximations on the upper brick volume.
  for (const x of [-7, -1, 5, 11]) {
    const z = -15,
      lo = 18.02,
      hi = 19.0;
    f(
      'frosted',
      [
        [x - 1.4, Y + lo, z - 1.5],
        [x, Y + hi, z - 1.5],
        [x, Y + hi, z + 1.5],
        [x - 1.4, Y + lo, z + 1.5],
      ],
      [-1, 1, 0],
    );
    f(
      'frosted',
      [
        [x, Y + hi, z - 1.5],
        [x + 1.4, Y + lo, z - 1.5],
        [x + 1.4, Y + lo, z + 1.5],
        [x, Y + hi, z + 1.5],
      ],
      [1, 1, 0],
    );
    for (const dz of [-1.5, 1.5])
      f(
        'frame',
        [
          [x - 1.4, Y + lo, z + dz],
          [x + 1.4, Y + lo, z + dz],
          [x, Y + hi, z + dz],
        ],
        [0, 0, dz],
      );
    f(
      'frosted',
      [
        [x - 1.4, Y + lo, z - 1.5],
        [x + 1.4, Y + lo, z - 1.5],
        [x + 1.4, Y + lo, z + 1.5],
        [x - 1.4, Y + lo, z + 1.5],
      ],
      [0, -1, 0],
    );
  }
  const stone = reduced(r.stoneWing),
    glass = reduced(r.glassWing),
    minZ = Math.min(...r.glassWing.outline.map((p) => p[1])),
    maxZ = Math.max(...r.glassWing.outline.map((p) => p[1]));
  const glassTop = (_x, z) => 5.6 + (2.4 * (z - minZ)) / (maxZ - minZ),
    roofTop = (_x, z) => 9.8 + 0.025 * (z - 53);
  slab('stone', stone, 0, 7.8);
  variable(
    'glass',
    stone,
    () => 7.8,
    (x, z) => roofTop(x, z) - 0.22,
  );
  const center = stone.outline.reduce(
      (p, q) => p.map((v, i) => v + q[i] / stone.outline.length),
      [0, 0],
    ),
    cap = {
      outline: stone.outline.map((p) => p.map((v, i) => center[i] + (v - center[i]) * 1.025)),
      holes: [],
    };
  variable('roof', cap, (x, z) => roofTop(x, z) - 0.22, roofTop);
  if (detail === 0) variable('glass', glass, () => 0, glassTop);
  else {
    for (const p of r.lowerGlass) slab('glass', p, 0, 2.9);
    variable('glass', r.glassWing, () => 2.9, glassTop);
    const E = r.entry,
      back = E.back,
      at = (u, y, d) => [
        back[0] + E.tangent[0] * u + E.normal[0] * d,
        Y + y,
        back[1] + E.tangent[1] * u + E.normal[1] * d,
      ];
    f(
      'dark',
      [
        at(-E.width / 2, 0.02, 0),
        at(E.width / 2, 0.02, 0),
        at(E.width / 2, 2.85, 0),
        at(-E.width / 2, 2.85, 0),
      ],
      [E.normal[0], 0, E.normal[1]],
    );
    for (const u of [-E.width / 2, 0, E.width / 2])
      f(
        'frame',
        [
          at(u - 0.055, 0.02, 0.02),
          at(u + 0.055, 0.02, 0.02),
          at(u + 0.055, 2.82, 0.02),
          at(u - 0.055, 2.82, 0.02),
        ],
        [E.normal[0], 0, E.normal[1]],
      );
    // One working threshold within the actual mouth; no invented descent into the basement.
    f(
      'stone',
      [
        at(-E.width / 2, 0.03, 0),
        at(E.width / 2, 0.03, 0),
        at(E.width / 2, 0.03, 1.2),
        at(-E.width / 2, 0.03, 1.2),
      ],
      [0, 1, 0],
    );
  }
  variable(
    'frosted',
    glass,
    (x, z) => glassTop(x, z),
    (x, z) => glassTop(x, z) + 0.12,
  );
  if (detail > 0) {
    for (const e of edges(r.glassWing)) {
      const steps = detail === 1 ? 1 : Math.max(1, Math.round(e.length / 3));
      for (let i = 0; i <= steps; i++) {
        if (e.length > 30 && detail === 1 && i > 0 && i < steps) continue;
        const u = (i * e.length) / steps,
          x = e.a[0] + e.t[0] * u,
          z = e.a[1] + e.t[1] * u;
        if (Math.hypot(x - r.entry.center[0], z - r.entry.center[1]) < r.entry.width / 2 + 0.2)
          continue;
        panel(
          'frame',
          e,
          0.12,
          glassTop(x, z) - 0.12,
          Math.max(0, u - 0.055),
          Math.min(e.length, u + 0.055),
          0.055,
        );
      }
      for (const y of [2.9, 5.3]) {
        const lo = glassTop(...e.a),
          hi = glassTop(...e.b);
        if (Math.min(lo, hi) > y + 0.12) panel('frame', e, y, 0.12, 0, e.length, 0.055);
      }
      // Roof edge is a closed cap, the frame follows its varying plane.
      const a = e.a,
        b = e.b,
        n = e.n;
      f(
        'frame',
        [
          [a[0] + n[0] * 0.04, Y + glassTop(...a), a[1] + n[1] * 0.04],
          [b[0] + n[0] * 0.04, Y + glassTop(...b), b[1] + n[1] * 0.04],
          [b[0] + n[0] * 0.04, Y + glassTop(...b) + 0.14, b[1] + n[1] * 0.04],
          [a[0] + n[0] * 0.04, Y + glassTop(...a) + 0.14, a[1] + n[1] * 0.04],
        ],
        [n[0], 0, n[1]],
      );
    }
    for (const e of edges(r.stoneWing)) {
      if (e.length > 30) continue;
      for (let y = detail === 1 ? 2.6 : 1.3; y < 7.7; y += detail === 1 ? 2.6 : 1.3)
        panel('seam', e, y, 0.035, 0, e.length, 0.02);
      if (detail > 1) panel('seam', e, 0.12, 7.6, e.length - 0.04, e.length, 0.02);
    }
    // Broad canopy grid, clipped to the actual northern elliptical half.
    const ring = r.glassWing.outline;
    for (let z = minZ + 2; z < maxZ - 0.5; z += detail === 1 ? 6 : 3) {
      const xs = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if ((a[1] <= z && b[1] > z) || (b[1] <= z && a[1] > z))
          xs.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      if (xs.length >= 2)
        f(
          'frame',
          [
            [xs[0] + 0.1, Y + glassTop(0, z) + 0.13, z - 0.055],
            [xs.at(-1) - 0.1, Y + glassTop(0, z) + 0.13, z - 0.055],
            [xs.at(-1) - 0.1, Y + glassTop(0, z) + 0.13, z + 0.055],
            [xs[0] + 0.1, Y + glassTop(0, z) + 0.13, z + 0.055],
          ],
          [0, 1, 0],
        );
    }
  }
}
