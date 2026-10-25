/** 'drottningholm_palace': connected palace, open courtyards, hipped roofs and two domed ends. */
import './install-deterministic-math.mjs';
import { box, prism, rect } from './khmer-structure-geometry.mjs';

export function buildDrottningholm(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    wall = (role, ps, n) => f(n[1] > 0.5 ? 'roof' : role, ps, n),
    slab = (role, p, lo, hi) => prism(wall, role, p, Y + lo, Y + hi);
  const hip = (x, z, w, d, lo, rise) => {
    const a = rect(x, z, w, d).outline,
      inset = Math.min(w, d) * 0.36,
      b = rect(x, z, Math.max(0.7, w - inset * 2), Math.max(0.7, d - inset * 2)).outline;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        n = [a[j][1] - a[i][1], 1, a[i][0] - a[j][0]];
      f(
        'roof',
        [
          [...a[i].slice(0, 1), Y + lo, a[i][1]],
          [a[j][0], Y + lo, a[j][1]],
          [b[j][0], Y + lo + rise, b[j][1]],
          [b[i][0], Y + lo + rise, b[i][1]],
        ],
        n,
      );
    }
    f(
      'roof',
      b.map(([x, z]) => [x, Y + lo + rise, z]),
      [0, 1, 0],
    );
    f(
      'roof',
      a.map(([x, z]) => [x, Y + lo, z]),
      [0, -1, 0],
    );
  };
  const edges = (p) =>
    [p.outline, ...(detail > 1 ? p.holes : [])].flatMap((ring, ri) => {
      const s =
        Math.sign(
          ring.reduce((n, a, i) => {
            const b = ring[(i + 1) % ring.length];
            return n + a[0] * b[1] - a[1] * b[0];
          }, 0),
        ) * (ri ? -1 : 1);
      return ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]),
          t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        return { a, b, length, t, n: [t[1] * s, -t[0] * s] };
      });
    });
  const panel = (role, e, u, width, y, h, offset = 0.05) =>
    f(
      role,
      [
        [u - width / 2, y],
        [u + width / 2, y],
        [u + width / 2, y + h],
        [u - width / 2, y + h],
      ].map(([u, y]) => [
        e.a[0] + e.t[0] * u + e.n[0] * offset,
        Y + y,
        e.a[1] + e.t[1] * u + e.n[1] * offset,
      ]),
      [e.n[0], 0, e.n[1]],
    );
  const window = (e, u, y, h, arch = false) => {
    const w = 1.55;
    if (arch && detail > 1) {
      const ps = [
        [-w / 2, 0],
        [w / 2, 0],
      ];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 6;
        ps.push([(Math.cos(a) * w) / 2, h - w / 2 + (Math.sin(a) * w) / 2]);
      }
      const at = ([x, v]) => [
        e.a[0] + e.t[0] * (u + x) + e.n[0] * 0.06,
        Y + y + v,
        e.a[1] + e.t[1] * (u + x) + e.n[1] * 0.06,
      ];
      for (let i = 1; i < ps.length - 1; i++)
        f('glass', [at(ps[0]), at(ps[i]), at(ps[i + 1])], [e.n[0], 0, e.n[1]]);
    } else panel('glass', e, u, w, y, h);
    panel('stone', e, u, w + 0.35, y - 0.15, 0.16, 0.09);
    if (detail > 1) {
      for (const du of [-w / 2 - 0.08, w / 2 + 0.08]) panel('trim', e, u + du, 0.12, y, h, 0.085);
      if (!arch) panel('stone', e, u, w + 0.35, y + h, 0.17, 0.09);
      panel('trim', e, u, 0.09, y + 0.05, h - 0.1, 0.09);
      panel('trim', e, u, w, y + h * 0.52, 0.08, 0.09);
    }
  };
  for (const p of r.floors) {
    if (detail === 0) prism(wall, 'wall', p, r.foundationY, Y + 9.5);
    else {
      prism(f, 'stone', p, r.foundationY, Y);
      slab('wall', p, 3.8, 9.5);
    }
  }
  if (detail) for (const p of r.lower) slab('wall', p, 0, 3.8);
  for (const p of r.main) slab('wall', p, 9.5, 18.2);
  for (const p of r.pavilions) slab('wall', p.polygon, 9.5, 12.8);
  for (const end of r.ends) slab('wall', end.polygon, 9.5, 11.6);
  // Long central roof, raised ends and the lower ranges surrounding both actual courts.
  hip(3.5, -2.8, 58.4, 34.1, 18.2, 6.8);
  for (const x of [-44.5, 52.5]) {
    hip(x, -21.9, 27, 8, 9.5, 2.6);
    hip(x, 16.8, 27, 8, 9.5, 2.6);
  }
  for (const x of [-58.3, 66.5]) hip(x, -1, 7.1, 32, 9.5, 2.6);
  for (const p of r.pavilions) {
    const a = p.polygon.outline,
      xs = a.map((p) => p[0]),
      zs = a.map((p) => p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs);
    hip((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.3, z1 - z0 + 0.3, 12.8, 3.2);
  }
  for (const x of [-19.5, 26.5]) {
    hip(x, -2.8, 10.8, 30.7, 19, 6.4);
    B('stone', x, 25.35, -2.8, 2.7, 0.5, 3.3);
    B('roof', x, 25.85, -2.8, 1.7, 1.1, 2.3);
  }
  // Faceted end domes; closed lower rims and lantern caps keep every LOD watertight.
  const count = detail === 0 ? 8 : detail === 1 ? 12 : 20;
  for (const end of r.ends) {
    const [x, z] = end.center,
      profile = [
        [11.6, 7.7],
        [12.4, 7.9],
        [15.8, 6.7],
        [18.4, 4.1],
        [18.8, 2],
      ],
      rings = profile.map(([y, radius]) =>
        Array.from({ length: count }, (_, i) => {
          const a = (i * Math.PI * 2) / count;
          return [x + Math.cos(a) * radius, Y + y, z + Math.sin(a) * radius];
        }),
      );
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count,
          a = ((i + 0.5) * Math.PI * 2) / count;
        f(
          'roof',
          [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
          [Math.cos(a), 0.8, Math.sin(a)],
        );
      }
    for (const [ring, n] of [
      [rings[0], [0, -1, 0]],
      [rings.at(-1), [0, 1, 0]],
    ])
      for (let i = 1; i < count - 1; i++) f('roof', [ring[0], ring[i], ring[i + 1]], n);
    B('stone', x, 18.8, z, 2.8, 1.9, 2.8);
    hip(x, z, 3.6, 3.6, 20.7, 1.1);
    if (detail > 1)
      for (let i = 0; i < count; i += 2) {
        const a = (i * Math.PI * 2) / count,
          b = a + 0.018;
        for (let k = 0; k < profile.length - 1; k++) {
          const ps = [profile[k], profile[k + 1]].flatMap(([y, rad]) =>
            [a, b].map((t) => [
              x + Math.cos(t) * (rad + 0.025),
              Y + y,
              z + Math.sin(t) * (rad + 0.025),
            ]),
          );
          f('dark', [ps[0], ps[1], ps[3], ps[2]], [Math.cos(a), 0.5, Math.sin(a)]);
        }
      }
  }
  B('stone', 3.5, 24.8, -2.8, 1.8, 1.5, 1.8);
  hip(3.5, -2.8, 2.4, 2.4, 26.3, 1.3);
  B('roof', 3.5, 27.6, -2.8, 0.23, 2.5, 0.23);
  if (!detail) return;
  for (const p of r.floors)
    for (const e of edges(p)) {
      if (e.length < 3) continue;
      const n = Math.max(1, Math.round(e.length / (detail === 1 ? 5.2 : 4.2)));
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * e.length) / n,
          x = e.a[0] + e.t[0] * u,
          z = e.a[1] + e.t[1] * u,
          central = x > -25.3 && x < 32.3,
          lake = z < -18 && central,
          door = Math.hypot(x - r.entry.center[0], z - r.entry.center[1]) < 2.8;
        if (!door) window(e, u, 1.1, lake ? 3.3 : 2.7, lake);
        window(e, u, 6.3, 2.7);
        if (detail > 1) {
          const pu = u - e.length / n / 2 + 0.1,
            px = e.a[0] + e.t[0] * pu,
            pz = e.a[1] + e.t[1] * pu;
          if (Math.hypot(px - r.entry.center[0], pz - r.entry.center[1]) > 2)
            panel('stone', e, pu, 0.45, 0.15, 9.25, 0.08);
          panel('stone', e, u, e.length / n, 5.1, 0.24, 0.08);
        }
      }
      panel('stone', e, e.length / 2, e.length, 9.22, 0.28, 0.09);
    }
  for (const p of r.main)
    for (const e of edges(p)) {
      if (e.length < 8) continue;
      const count = Math.max(1, Math.round(e.length / (detail === 1 ? 5.2 : 4.2)));
      for (let i = 0; i < count; i++) {
        const u = ((i + 0.5) * e.length) / count;
        window(e, u, 12.2, 3.5);
        if (detail > 1) panel('stone', e, (i * e.length) / count + 0.1, 0.48, 9.5, 8.4, 0.085);
      }
      panel('stone', e, e.length / 2, e.length, 17.6, 0.6, 0.08);
    }
  for (const p of r.pavilions)
    for (const e of edges(p.polygon))
      if (e.length > 5) {
        const n = Math.max(1, Math.round(e.length / 4.2));
        for (let i = 0; i < n; i++) window(e, ((i + 0.5) * e.length) / n, 10.2, 1.7);
        panel('stone', e, e.length / 2, e.length, 12.5, 0.3, 0.08);
      }
  // The central lake-side opening is a genuine recess, not glass placed over a solid wall.
  const E = r.entry,
    at = (u, y, d) => [
      E.back[0] + E.tangent[0] * u + E.normal[0] * d,
      Y + y,
      E.back[1] + E.tangent[1] * u + E.normal[1] * d,
    ];
  f(
    'dark',
    [
      at(-E.width / 2, 0.03, 0.025),
      at(E.width / 2, 0.03, 0.025),
      at(E.width / 2, 3.8, 0.025),
      at(-E.width / 2, 3.8, 0.025),
    ],
    [E.normal[0], 0, E.normal[1]],
  );
  // Closed curved soffit and front spandrels give the rectangular cutout its arched mouth.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8,
      u0 = (Math.cos(a) * E.width) / 2,
      u1 = (Math.cos(b) * E.width) / 2,
      y0 = 2.1 + (Math.sin(a) * E.width) / 2,
      y1 = 2.1 + (Math.sin(b) * E.width) / 2;
    f(
      'wall',
      [at(u0, y0, E.depth), at(u1, y1, E.depth), at(u1, 3.8, E.depth), at(u0, 3.8, E.depth)],
      [E.normal[0], 0, E.normal[1]],
    );
    f(
      'stone',
      [at(u0, y0, 0.03), at(u1, y1, 0.03), at(u1, y1, E.depth), at(u0, y0, E.depth)],
      [
        -Math.cos((a + b) / 2) * E.tangent[0],
        -Math.sin((a + b) / 2),
        -Math.cos((a + b) / 2) * E.tangent[1],
      ],
    );
  }
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
  if (detail > 1) {
    for (const z of [-16.4, 10.8])
      for (const x of [-12, -4, 11, 19]) {
        B('stone', x, 20, z, 1.7, 1.8, 1.1);
        hip(x, z, 2.1, 1.5, 21.8, 0.7);
        B('dark', x, 20.2, z + (z < 0 ? -0.56 : 0.56), 0.8, 1.2, 0.035);
      }
    for (const x of [-14, -5, 12, 20]) B('dark', x, 24.5, -2.8, 0.7, 1.8, 1.1);
  }
}
