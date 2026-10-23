/** 'N0769': Galleria Borghese villa, open arcade, terrace, tiled wings and rear towers. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);
export function buildBorgheseGallery(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    multi = (ps) => ps.map((p) => [p.outline, ...p.holes]),
    clean = (p) => ({ outline: p[0].slice(0, -1), holes: p.slice(1).map((h) => h.slice(0, -1)) });
  const cap = (role, p, y, normal = [0, 1, 0]) => {
    const rings = [p.outline, ...p.holes],
      flat = rings.flat(),
      holes = [];
    let off = rings[0].length;
    for (const h of rings.slice(1)) {
      holes.push(off);
      off += h.length;
    }
    const ix = earcut(flat.flat(), holes);
    for (let i = 0; i < ix.length; i += 3)
      f(
        role,
        ix.slice(i, i + 3).map((k) => [flat[k][0], y, flat[k][1]]),
        normal,
      );
  };
  // Closed mapped foundation and layered shell leave the arcade and terrace physically recessed.
  for (const p of r.floors) prism(f, 'trim', p, r.foundationY, Y);
  for (let i = 0; i < r.bodyLayers.length; i++) {
    const band = r.bodyLayers[i],
      above = r.bodyLayers[i + 1]?.polygons ?? [],
      below = r.bodyLayers[i - 1]?.polygons ?? [];
    for (const p of band.polygons)
      prism(
        (role, ps, n) => {
          if (Math.abs(n[1]) < 0.5) f(role, ps, n);
        },
        'wall',
        p,
        Y + band.lo,
        Y + band.hi,
        false,
      );
    for (const p of above.length
      ? pc.difference(multi(band.polygons), multi(above)).map(clean)
      : band.polygons)
      cap('trim', p, Y + band.hi);
    if (i)
      for (const p of pc.difference(multi(band.polygons), multi(below)).map(clean))
        cap('trim', p, Y + band.lo, [0, -1, 0]);
  }
  const extrude = (role, outline, z0, z1) => {
    const ix = earcut(outline.flat());
    for (const z of [z0, z1])
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((k) => [outline[k][0], Y + outline[k][1], z]),
          [0, 0, z === z0 ? -1 : 1],
        );
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      f(
        role,
        [
          [a[0], Y + a[1], z0],
          [b[0], Y + b[1], z0],
          [b[0], Y + b[1], z1],
          [a[0], Y + a[1], z1],
        ],
        [b[1] - a[1], a[0] - b[0], 0],
      );
    }
  };
  const segments = [4, 6, 10, 16][detail],
    radius = 1.8,
    spring = 4.8;
  // Piers and curved spandrels close the soffits without filling the five arch openings.
  const ends = [-11.8, ...r.archXs.flatMap((x) => [x - radius, x + radius]), 11.8];
  for (let i = 0; i < ends.length - 1; i += 2)
    B('trim', (ends[i] + ends[i + 1]) / 2, 0, -0.42, ends[i + 1] - ends[i], 7, 0.84);
  for (const x of r.archXs) {
    for (let i = 0; i < segments; i++) {
      const a = Math.PI - (i * Math.PI) / segments,
        b = Math.PI - ((i + 1) * Math.PI) / segments,
        xa = x + Math.cos(a) * radius,
        xb = x + Math.cos(b) * radius,
        ya = spring + Math.sin(a) * radius,
        yb = spring + Math.sin(b) * radius;
      extrude(
        'trim',
        [
          [xa, ya],
          [xb, yb],
          [xb, 7],
          [xa, 7],
        ],
        -0.84,
        0,
      );
    }
    if (detail) {
      const curve = Array.from({ length: segments + 1 }, (_, i) => {
          const a = (i * Math.PI) / segments;
          return [x + Math.cos(a) * radius, spring + Math.sin(a) * radius];
        }),
        gate = [[x - radius, 0.06], [x + radius, 0.06], ...curve];
      extrude('metal', gate, -2.17, -2.13);
      if (detail > 1)
        for (let i = -4; i <= 4; i++) B('metal', x + i * 0.33, 0.1, -2.08, 0.055, 5.7, 0.06);
    }
  }
  // The raised terrace has a solid lower parapet and, nearby, individually separated balusters.
  B('trim', 0, 7.85, -0.25, 23.7, 0.35, 0.7);
  B('trim', 0, 8.95, -0.25, 23.9, 0.24, 0.85);
  if (detail)
    for (let i = 0; i < 35; i++) B('trim', -11.5 + (i * 23) / 34, 8.15, -0.25, 0.2, 0.8, 0.25);
  else B('trim', 0, 8.15, -0.25, 23.7, 0.8, 0.35);
  // A taller central block is recessed behind the terrace. Both rear towers rise from mapped rear range.
  B('wall', 0, 15, -15.8, 23.6, 5.4, 24.6);
  for (const x of [-20.6, 20.6]) B('wall', x, 15, -28.8, 8.2, 12, 9.2);
  const hip = (x, z, w, d, base, rise) => {
    const e = 0.55,
      low = [
        [-w / 2 - e, -d / 2 - e],
        [w / 2 + e, -d / 2 - e],
        [w / 2 + e, d / 2 + e],
        [-w / 2 - e, d / 2 + e],
      ].map(([u, v]) => [x + u, Y + base, z + v]),
      ridge = Math.max(0.1, (d - w) / 2),
      high = [
        [x, Y + base + rise, z - ridge],
        [x, Y + base + rise, z + ridge],
      ];
    if (d > w) {
      f('roof', [low[0], low[1], high[0]], [0, rise, -1]);
      f('roof', [low[1], low[2], high[1], high[0]], [1, rise, 0]);
      f('roof', [low[2], low[3], high[1]], [0, rise, 1]);
      f('roof', [low[3], low[0], high[0], high[1]], [-1, rise, 0]);
    } else {
      const q = (w - d) / 2,
        a = [x - q, Y + base + rise, z],
        b = [x + q, Y + base + rise, z];
      f('roof', [low[0], low[1], b, a], [0, rise, -1]);
      f('roof', [low[1], low[2], b], [1, rise, 0]);
      f('roof', [low[2], low[3], a, b], [0, rise, 1]);
      f('roof', [low[3], low[0], a], [-1, rise, 0]);
    }
    B('trim', x, base - 0.3, z, w + 0.8, 0.3, d + 0.8);
  };
  for (const x of [-17.15, 17.15]) hip(x, -10.95, 10.7, 21.9, 15, 2.4);
  hip(0, -28.8, 56.7, 13.1, 15, 3.1);
  hip(0, -15.8, 23.6, 24.6, 20.4, 3.3);
  for (const x of [-20.6, 20.6]) hip(x, -28.8, 8.2, 9.2, 27, 1.9);
  for (const s of r.stairs) {
    if (!detail && s.i % 2) continue;
    const next = !detail ? r.stairs.find((t) => t.sign === s.sign && t.i === s.i + 1) : s,
      outline = !detail
        ? {
            outline: [
              [
                Math.min(...s.outline.map((p) => p[0]), ...next.outline.map((p) => p[0])),
                Math.min(...s.outline.map((p) => p[1]), ...next.outline.map((p) => p[1])),
              ],
              [
                Math.max(...s.outline.map((p) => p[0]), ...next.outline.map((p) => p[0])),
                Math.min(...s.outline.map((p) => p[1]), ...next.outline.map((p) => p[1])),
              ],
              [
                Math.max(...s.outline.map((p) => p[0]), ...next.outline.map((p) => p[0])),
                Math.max(...s.outline.map((p) => p[1]), ...next.outline.map((p) => p[1])),
              ],
              [
                Math.min(...s.outline.map((p) => p[0]), ...next.outline.map((p) => p[0])),
                Math.max(...s.outline.map((p) => p[1]), ...next.outline.map((p) => p[1])),
              ],
            ],
            holes: [],
          }
        : { outline: s.outline, holes: [] };
    prism(f, 'trim', outline, Math.min(s.base, next.base), s.top);
  }
  B('trim', 0, -0.08, 0.55, 5.7, 0.08, 1.1);
  // Chimneys are part of the recognizable front roof silhouette.
  for (const x of [-17.2, 17.2]) {
    B('trim', x, 16.6, -7.7, 0.85, 3.6, 0.85);
    B('trim', x, 20.2, -7.7, 1.35, 0.35, 1.25);
  }
  if (!detail) return;
  const pane = (role, x, y, z, w, h, t = [1, 0], normal = [0, 1]) =>
    f(
      role,
      [
        [x - (t[0] * w) / 2, Y + y, z - (t[1] * w) / 2],
        [x + (t[0] * w) / 2, Y + y, z + (t[1] * w) / 2],
        [x + (t[0] * w) / 2, Y + y + h, z + (t[1] * w) / 2],
        [x - (t[0] * w) / 2, Y + y + h, z - (t[1] * w) / 2],
      ],
      [normal[0], 0, normal[1]],
    );
  const win = (x, y, z, w, h, t = [1, 0], normal = [0, 1]) => {
    pane('trim', x, y - 0.15, z, w + 0.38, h + 0.3, t, normal);
    pane('glass', x, y, z + normal[1] * 0.018, w, h, t, normal);
    if (detail > 1) {
      for (const u of [-w / 2, 0, w / 2]) {
        const c = [x + t[0] * u + normal[0] * 0.035, z + t[1] * u + normal[1] * 0.035];
        pane('wood', c[0], y, c[1], 0.09, h, t, normal);
      }
      pane('wood', x, y + h * 0.55, z + normal[1] * 0.04, w, 0.09, t, normal);
    }
  };
  for (const x of [-19.9, -14.7, 14.7, 19.9]) {
    win(x, 1.25, 0.035, 1.65, 3.2);
    win(x, 9.25, 0.035, 1.55, 3.2);
  }
  for (const x of [-8, 0, 8]) win(x, 9.1, -3.465, 1.65, 3.7);
  for (const x of [-9.3, -4.65, 0, 4.65, 9.3]) win(x, 16.1, -3.465, 1.25, 2.7);
  // Side/rear bays follow the mapped perimeter; count/ornament remain picture-led approximations.
  for (const p of r.floors)
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        d = b.map((v, k) => v - a[k]),
        L = Math.hypot(...d);
      if (Math.abs((a[1] + b[1]) / 2) < 0.3 || L < 8) continue;
      const t = d.map((v) => v / L),
        mid = a.map((v, k) => (v + b[k]) / 2),
        n = [-t[1], t[0]],
        count = Math.max(1, Math.round(L / 5.5));
      for (let j = 0; j < count; j++) {
        const q = a.map((v, k) => v + (d[k] * (j + 0.5)) / count + n[k] * 0.045);
        for (const y of [1.4, 9.3]) win(q[0], y, q[1], 1.45, 2.9, t, n);
      }
      pane('trim', mid[0] + n[0] * 0.03, 7.2, mid[1] + n[1] * 0.03, L, 0.45, t, n);
    }
  for (const x of [-20.6, 20.6])
    for (const z of [-33.425, -24.175])
      for (const y of [17.6, 22.4]) win(x, y, z, 1.1, 2.4, [1, 0], [0, z < -28 ? -1 : 1]);
  for (const x of [-17.15, 17.15]) B('trim', x, 7.2, -0.05, 10.8, 0.45, 0.55);
  if (detail === 1) return;
  // Simplified original ornament: oval medallions, broad window hoods, statue-like niche masses.
  const oval = (x, y, z, w, h) => {
    const n = detail === 3 ? 16 : 10,
      ring = Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return [x + (Math.cos(a) * w) / 2, Y + y + (Math.sin(a) * h) / 2, z];
      });
    f('trim', ring, [0, 0, 1]);
  };
  for (const x of [-19.9, -14.7, 14.7, 19.9]) oval(x, 13.8, 0.07, 0.95, 1.25);
  for (const x of [-9.3, -4.65, 0, 4.65, 9.3]) {
    oval(x, 19.25, -3.39, 1.15, 1.6);
    B('trim', x, 18.7, -3.1, 0.15, 0.65, 0.3);
  }
  for (const x of [-6.98, -2.33, 2.33, 6.98]) {
    pane('roof', x, 16, -3.43, 0.8, 2.55);
    B('trim', x, 15.95, -3.1, 0.6, 0.3, 0.5);
    B('trim', x, 16.25, -3.08, 0.36, 1.4, 0.35);
    oval(x, 17.9, -2.86, 0.38, 0.45);
    B('trim', x, 18.2, -3.04, 0.8, 0.25, 0.55);
  }
  for (const x of [-8, 0, 8]) {
    B('trim', x, 12.95, -3.12, 3.4, 0.2, 1);
    extrude(
      'trim',
      [
        [x - 1.7, 13.15],
        [x + 1.7, 13.15],
        [x, 14],
      ],
      -3.8,
      -2.65,
    );
  }
  for (const x of [-11.8, 11.8]) {
    B('trim', x, 0, -0.05, 0.6, 8.2, 0.45);
    B('trim', x, 8.15, -0.05, 0.9, 1.2, 0.9);
  }
  for (const x of [-17.15, 17.15])
    for (const dx of [-5.1, 5.1])
      for (let i = 0; i < 12; i++) B('trim', x + dx, i * 0.58, -0.05, 0.48, 0.18, 0.35);
  for (const sign of [-1, 1])
    for (const s of r.stairs.filter((t) => t.sign === sign)) {
      B('trim', s.x, s.top - Y, s.z + 1, 0.16, 0.85, 0.18);
    }

  for (const sign of [-1, 1]) {
    const flight = r.stairs.filter((s) => s.sign === sign),
      a = flight[0],
      b = flight.at(-1),
      A = [a.x - sign * 0.35, a.top + 0.92, a.z + 1],
      C = [b.x + sign * 0.35, b.top + 0.92, b.z + 1],
      q = [A, C].map((p) => [
        [p[0], p[1] - 0.08, p[2] - 0.17],
        [p[0], p[1] - 0.08, p[2] + 0.17],
        [p[0], p[1] + 0.08, p[2] + 0.17],
        [p[0], p[1] + 0.08, p[2] - 0.17],
      ]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        'trim',
        [q[0][i], q[1][i], q[1][j], q[0][j]],
        [
          [0, -1, 0],
          [0, 0, 1],
          [0, 1, 0],
          [0, 0, -1],
        ][i],
      );
    }
    f('trim', q[0], [-sign, 0, 0]);
    f('trim', q[1], [sign, 0, 0]);
  }

  if (detail === 3) {
    for (const x of [-17.15, 17.15])
      for (let i = 0; i < 20; i++) B('trim', x - 5 + (i * 10) / 19, 14.55, 0.08, 0.2, 0.25, 0.45);
    for (let i = 0; i < 40; i++) B('trim', -11.6 + (i * 23.2) / 39, 20.05, -3.15, 0.22, 0.25, 0.55);
  }
}
