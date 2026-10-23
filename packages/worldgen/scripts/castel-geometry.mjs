/** 'N0758': mapped keep and fortification envelope, terraces, corbels and roof figure. */
import './install-deterministic-math.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildCastel(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    bands = r.profiles[detail === 0 ? 'skyline' : detail === 1 ? 'district' : 'full'],
    roleAt = (y) =>
      y < 5 ? 'stone' : y >= 32 ? 'render' : (y >= 14.5 && y < 16) || y >= 31 ? 'stone' : 'wall';
  for (const p of r.footing) prism(f, 'stone', p, r.foundationY, Y);
  for (const band of bands) {
    const role = roleAt((band.lo + band.hi) / 2);
    for (const p of band.polygons)
      prism(
        (role, ps, n) => {
          if (!n[1]) f(role, ps, n);
        },
        role,
        p,
        Y + band.lo,
        Y + band.hi,
      );
    for (const p of band.tops)
      prism(
        (role, ps, n) => {
          if (n[1] > 0) f(role, ps, n);
        },
        'paving',
        p,
        Y + band.hi,
        Y + band.hi,
      );
    if (band.lo > 0)
      for (const p of band.bottoms)
        prism(
          (role, ps, n) => {
            if (n[1] < 0) f(role, ps, n);
          },
          'stone',
          p,
          Y + band.lo,
          Y + band.lo,
        );
  }
  const E = r.entry,
    F = E.center[1],
    at = (u, y, d) => [E.back[0] + u, Y + y, E.back[1] + d];
  if (detail === 0) {
    const points = [
      [-E.width / 2, 0.03],
      [E.width / 2, 0.03],
    ];
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 6;
      points.push([(Math.cos(a) * E.width) / 2, 3.5 + (Math.sin(a) * E.width) / 2]);
    }
    f(
      'dark',
      points.map(([u, y]) => [E.center[0] + u, Y + y, F + 0.04]),
      [0, 0, 1],
    );
  } else {
    // Closed arched south entrance, with an actual recessed gate and a working threshold.
    f(
      'dark',
      [
        at(-E.width / 2, 0.03, 0.025),
        at(E.width / 2, 0.03, 0.025),
        at(E.width / 2, 5.4, 0.025),
        at(-E.width / 2, 5.4, 0.025),
      ],
      [0, 0, 1],
    );
    f(
      'stone',
      [
        at(-E.width / 2, 0.04, 0),
        at(E.width / 2, 0.04, 0),
        at(E.width / 2, 0.04, E.depth),
        at(-E.width / 2, 0.04, E.depth),
      ],
      [0, 1, 0],
    );
    const archSegments = detail > 1 ? 10 : 6;
    for (let i = 0; i < archSegments; i++) {
      const a = (i * Math.PI) / archSegments,
        b = ((i + 1) * Math.PI) / archSegments,
        u0 = (Math.cos(a) * E.width) / 2,
        u1 = (Math.cos(b) * E.width) / 2,
        y0 = 3.5 + (Math.sin(a) * E.width) / 2,
        y1 = 3.5 + (Math.sin(b) * E.width) / 2;
      f(
        'wall',
        [at(u0, y0, E.depth), at(u1, y1, E.depth), at(u1, 5.4, E.depth), at(u0, 5.4, E.depth)],
        [0, 0, 1],
      );
      f(
        'stone',
        [at(u0, y0, 0.03), at(u1, y1, 0.03), at(u1, y1, E.depth), at(u0, y0, E.depth)],
        [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
      );
      if (detail) {
        const p = [u0, y0],
          q = [u1, y1],
          v = [Math.cos(a) * 0.3, Math.sin(a) * 0.3],
          w = [Math.cos(b) * 0.3, Math.sin(b) * 0.3];
        f(
          'stone',
          [
            at(p[0], p[1], E.depth + 0.035),
            at(q[0], q[1], E.depth + 0.035),
            at(q[0] + w[0], q[1] + w[1], E.depth + 0.035),
            at(p[0] + v[0], p[1] + v[1], E.depth + 0.035),
          ],
          [0, 0, 1],
        );
      }
    }
    if (detail)
      for (const s of [-1, 1])
        B('stone', E.center[0] + s * (E.width / 2 + 0.15), 0, F + 0.03, 0.3, 3.5, 0.12);
  }
  // A restrained original faceted winged figure carries the roof silhouette.
  const cx = -0.3,
    cz = 3;
  if (detail < 2) {
    B('stone', cx, 41, cz, 1.9, 2.4, 1.9);
    B('patina', cx, 43.4, cz, 0.55, 3.4, 0.5);
    for (const side of [-1, 1])
      prism(
        (role, ps, n) =>
          f(
            role,
            ps.map(([x, y, z]) => [x, Y + z, cz + y]),
            [n[0], n[2], n[1]],
          ),
        'patina',
        {
          outline: [
            [cx + 0.1 * side, 44.8],
            [cx + 2.2 * side, 47.4],
            [cx + 0.4 * side, 46.4],
          ],
          holes: [],
        },
        -0.25,
        0,
      );
    B('patina', cx + 0.4, 45.8, cz, 0.8, 0.25, 0.25);
    B('patina', cx + 0.62, 45.8, cz, 0.15, 3.3, 0.14);
  } else {
    B('stone', cx, 41, cz, 1.8, 2.2, 1.8);
    B('stone', cx, 43.2, cz, 2.1, 0.2, 2.1);
    for (const x of [-0.2, 0.2]) B('patina', cx + x, 43.4, cz, 0.22, 1.1, 0.28);
    B('patina', cx, 44.5, cz, 0.65, 1.7, 0.5);
    B('patina', cx, 46.2, cz, 0.5, 0.6, 0.5);
    for (const side of [-1, 1]) {
      const wing = [
        [0.15, 45.3],
        [0.6, 46.4],
        [2.2, 47.4],
        [1.8, 46.2],
        [0.4, 44.9],
      ].map(([x, y]) => [cx + x * side, y]);
      prism(
        (role, ps, n) =>
          f(
            role,
            ps.map(([x, y, z]) => [x, Y + z, cz + y]),
            [n[0], n[2], n[1]],
          ),
        'patina',
        { outline: wing, holes: [] },
        -0.35,
        -0.12,
      );
    }
    B('patina', cx + 0.45, 45.7, cz, 0.3, 1.65, 0.3);
    B('patina', cx + 0.62, 47.2, cz, 0.15, 1.9, 0.14);
  }
  if (!detail) return;
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0],
    center = r.drum.center,
    outerR = (angle, y) => {
      const d = [Math.cos(angle), Math.sin(angle)],
        band = bands.find((b) => b.lo <= y && b.hi > y);
      let radius = 0;
      for (const p of band?.polygons ?? [])
        for (let i = 0; i < p.outline.length; i++) {
          const a = p.outline[i].map((v, k) => v - center[k]),
            b = p.outline[(i + 1) % p.outline.length].map((v, k) => v - center[k]),
            v = b.map((x, k) => x - a[k]),
            den = cross(d, v);
          if (Math.abs(den) < 1e-8) continue;
          const t = cross(a, v) / den,
            u = cross(a, d) / den;
          if (t > 0 && u >= 0 && u <= 1) radius = Math.max(radius, t);
        }
      return radius;
    },
    radial = (role, a, y, w, h, rad) => {
      const n = [Math.cos(a), Math.sin(a)],
        t = [-n[1], n[0]];
      f(
        role,
        [
          [-w / 2, y],
          [w / 2, y],
          [w / 2, y + h],
          [-w / 2, y + h],
        ].map(([u, y]) => [
          center[0] + n[0] * rad + t[0] * u,
          Y + y,
          center[1] + n[1] * rad + t[1] * u,
        ]),
        [n[0], 0, n[1]],
      );
    };
  // Low-frequency gallery openings follow the actual exposed circular envelope.
  const windows = detail === 1 ? 12 : 32;
  for (let i = 0; i < windows; i++) {
    const a = (i * Math.PI * 2) / windows,
      rad = outerR(a, 29.5);
    if (rad > 0) radial('glass', a, 28.6, 1.35, 1.65, rad + 0.035);
  }
  if (detail > 1) {
    const cornice = bands.find((b) => b.lo <= 27.5 && b.hi > 27.5);
    for (const p of cornice?.polygons ?? []) {
      const extended = p.outline.map((q) => {
        const d = q.map((v, k) => v - center[k]),
          length = Math.hypot(...d);
        return q.map((v, k) => v + (d[k] * 0.65) / length);
      });
      prism(f, 'wall', { outline: extended, holes: [p.outline] }, Y + 27.35, Y + 27.65);
    }
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / 12,
        rad = outerR(a, 20),
        n = [Math.cos(a), Math.sin(a)],
        t = [-n[1], n[0]],
        ps = Array.from({ length: 8 }, (_, j) => {
          const b = (j * Math.PI * 2) / 8;
          return [
            center[0] + n[0] * (rad + 0.04) + t[0] * Math.cos(b) * 0.35,
            Y + 20 + Math.sin(b) * 0.35,
            center[1] + n[1] * (rad + 0.04) + t[1] * Math.cos(b) * 0.35,
          ];
        });
      for (let j = 1; j < ps.length - 1; j++) f('dark', [ps[0], ps[j], ps[j + 1]], [n[0], 0, n[1]]);
    }
    const count = detail === 2 ? 48 : 64;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        n = [Math.cos(a), Math.sin(a)],
        t = [-n[1], n[0]],
        lo = outerR(a, 26) - 0.04,
        hi = outerR(a, 28) + 0.64;
      if (lo <= 0 || hi <= 0) continue;
      const at = (u, y, rad) => [
          center[0] + n[0] * rad + t[0] * u,
          Y + y,
          center[1] + n[1] * rad + t[1] * u,
        ],
        profile = [
          [26, lo],
          [27.45, lo],
          [27.45, hi],
        ];
      for (const s of [-1, 1])
        f(
          'wall',
          profile.map(([y, rad]) => at(s * 0.3, y, rad)),
          [t[0] * s, 0, t[1] * s],
        );
      for (let j = 0; j < 3; j++) {
        const p = profile[j],
          q = profile[(j + 1) % 3];
        f(
          'wall',
          [at(-0.3, ...p), at(0.3, ...p), at(0.3, ...q), at(-0.3, ...q)],
          j === 0 ? [-n[0], 0, -n[1]] : j === 1 ? [0, 1, 0] : [n[0], -0.5, n[1]],
        );
      }
    }
  }
  // Window rhythm is applied only to existing exposed upper-room walls.
  for (const y of detail > 1 ? [33.3, 38.2] : []) {
    const band = bands.find((b) => b.lo <= y && b.hi > y);
    if (!band) continue;
    for (const p of band.polygons)
      for (const ring of [p.outline, ...(detail > 1 ? p.holes : [])]) {
        const s =
          Math.sign(
            ring.reduce((n, a, i) => {
              const b = ring[(i + 1) % ring.length];
              return n + a[0] * b[1] - a[1] * b[0];
            }, 0),
          ) * (ring === p.outline ? 1 : -1);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            v = b.map((v, k) => v - a[k]),
            L = Math.hypot(...v);
          if (L < 4) continue;
          const t = v.map((v) => v / L),
            n = [t[1] * s, -t[0] * s],
            count = Math.max(1, Math.round(L / (detail === 1 ? 6 : 4)));
          for (let j = 0; j < count; j++) {
            const u = ((j + 0.5) * L) / count,
              at = (du, y) => [
                a[0] + t[0] * (u + du) + n[0] * 0.045,
                Y + y,
                a[1] + t[1] * (u + du) + n[1] * 0.045,
              ];
            f(
              'glass',
              [at(-0.55, y), at(0.55, y), at(0.55, y + 1.8), at(-0.55, y + 1.8)],
              [n[0], 0, n[1]],
            );
            if (detail > 1)
              f(
                'stone',
                [at(-0.7, y - 0.15), at(0.7, y - 0.15), at(0.7, y), at(-0.7, y)],
                [n[0], 0, n[1]],
              );
          }
        }
      }
  }
  // The mapped stair is rebuilt as working treads instead of one flat six-metre block.
  const p = r.steps.polygons[0].outline,
    xs = p.map((p) => p[0]),
    zs = p.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    count = detail === 1 ? 4 : detail === 2 ? 8 : 12;
  for (let i = 0; i < count; i++)
    B(
      'stone',
      (x0 + x1) / 2,
      22,
      z0 + ((i + 0.5) * (z1 - z0)) / count,
      x1 - x0,
      (6 * (count - i)) / count,
      (z1 - z0) / count,
    );
}
