/** 'science_museum': Science Museum columned front, connected brick galleries and western modern wing. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildScienceMuseum(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    multi = (ps) => ps.map((p) => [p.outline, ...p.holes]),
    clean = (p) => ({ outline: p[0].slice(0, -1), holes: p.slice(1).map((h) => h.slice(0, -1)) });
  const cap = (role, poly, y, normal = [0, 1, 0]) => {
    const rings = [poly.outline, ...poly.holes],
      flat = rings.flat(),
      holes = [];
    let off = rings[0].length;
    for (const ring of rings.slice(1)) {
      holes.push(off);
      off += ring.length;
    }
    const ix = earcut(flat.flat(), holes);
    for (let i = 0; i < ix.length; i += 3)
      f(
        role,
        ix.slice(i, i + 3).map((j) => [flat[j][0], y, flat[j][1]]),
        normal,
      );
  };
  const walls = new Map();
  for (let i = 0; i < r.bodyLayers.length; i++) {
    const band = r.bodyLayers[i],
      above = r.bodyLayers[i + 1]?.polygons ?? [],
      below = r.bodyLayers[i - 1]?.polygons ?? [];
    for (const p of band.polygons)
      prism(
        (_role, ps, n) => {
          if (Math.abs(n[1]) > 0.5) return;
          const key = JSON.stringify([ps[0][0], ps[0][2], ps[1][0], ps[1][2]]),
            spans = walls.get(key) ?? [],
            last = spans.at(-1),
            lo = i === 0 ? r.foundationY : Y + band.lo;
          if (last && Math.abs(last.hi - lo) < 1e-6) last.hi = Y + band.hi;
          else spans.push({ a: ps[0], b: ps[1], lo, hi: Y + band.hi, n });
          walls.set(key, spans);
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
      cap(band.hi >= 19 ? 'roof' : 'trim', p, Y + band.hi);
    if (i > 0)
      for (const p of pc.difference(multi(band.polygons), multi(below)).map(clean))
        cap('trim', p, Y + band.lo, [0, -1, 0]);
  }
  for (const spans of walls.values())
    for (const w of spans)
      f(
        (w.a[2] + w.b[2]) / 2 > -65 ? 'wall' : (w.a[2] + w.b[2]) / 2 < -225 ? 'frame' : 'brick',
        [
          [w.a[0], w.lo, w.a[2]],
          [w.b[0], w.lo, w.b[2]],
          [w.b[0], w.hi, w.b[2]],
          [w.a[0], w.hi, w.a[2]],
        ],
        w.n,
      );
  for (const p of r.floors) cap('trim', p, r.foundationY, [0, -1, 0]);
  for (const p of r.floors) prism(f, 'trim', p, r.foundationY, Y, false);
  for (const s of r.stairs)
    for (let i = 0; i < s.count; i++) {
      const top = Y + 0.03 - i * 0.18;
      B('trim', s.x, s.baseY - Y, 0.3 + i * 0.6, 4, top - s.baseY, 0.6);
    }
  const n = [6, 8, 12, 20][detail],
    ring = (x, z, y, radius, count = n) =>
      Array.from({ length: count }, (_, i) => {
        const a = (i * Math.PI * 2) / count;
        return [x + Math.cos(a) * radius, Y + y, z + Math.sin(a) * radius];
      });
  const loft = (role, rings) => {
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < rings[j].length; i++) {
        const k = (i + 1) % rings[j].length,
          a = rings[j - 1][i],
          b = rings[j - 1][k],
          center = rings[j].reduce(
            (s, p) => s.map((v, k) => v + p[k] / rings[j].length),
            [0, 0, 0],
          );
        f(
          role,
          [a, b, rings[j][k], rings[j][i]],
          [(a[0] + b[0]) / 2 - center[0], 0, (a[2] + b[2]) / 2 - center[2]],
        );
      }
    f(role, rings[0], [0, -1, 0]);
    f(role, rings.at(-1), [0, 1, 0]);
  };
  for (const x of r.columns) {
    loft(
      'trim',
      detail
        ? [
            ring(x, -0.7, 8.1, 0.75),
            ring(x, -0.7, 8.6, 0.66),
            ring(x, -0.7, 22.6, 0.54),
            ring(x, -0.7, 23.2, 0.76),
          ]
        : [ring(x, -0.7, 8.1, 0.7), ring(x, -0.7, 23.2, 0.6)],
    );
    if (detail) {
      B('trim', x, 8.1, -0.7, 1.75, 0.4, 1.6);
      B('trim', x, 22.9, -0.7, 1.7, 0.3, 1.55);
    }
    if (detail > 1)
      for (const dx of [-0.53, 0.53]) {
        const count = detail === 3 ? 12 : 8,
          rs = [-0.98, -0.42].map((z) =>
            Array.from({ length: count }, (_, i) => {
              const a = (i * Math.PI * 2) / count;
              return [x + dx + 0.3 * Math.cos(a), Y + 22.82 + 0.3 * Math.sin(a), z];
            }),
          );
        for (let i = 0; i < count; i++) {
          const j = (i + 1) % count;
          f(
            'trim',
            [rs[0][i], rs[0][j], rs[1][j], rs[1][i]],
            [Math.cos((i * Math.PI * 2) / count), Math.sin((i * Math.PI * 2) / count), 0],
          );
        }
        f('trim', rs[0], [0, 0, -1]);
        f('trim', rs[1], [0, 0, 1]);
      }
  }
  // The main cornice and parapet continue across the real giant-column screen.
  for (const [y, w, h, d] of [
    [7.7, 68.3, 0.55, 1.2],
    [23.2, 68.4, 0.8, 1.2],
    [24.2, 68.8, 0.45, 1.4],
    [25.4, 69.2, 0.6, 1.7],
    [26, 68.4, 1.1, 1.1],
  ])
    B('trim', 0, y, -0.4, w, h, d);
  if (detail > 1) {
    for (let i = 0; i < 58; i++) B('trim', -32.5 + (i * 65) / 57, 25.05, 0.05, 0.35, 0.35, 0.5);
    for (const x of [-25, -15, -5, 5, 15, 25]) {
      B('trim', x, 26.25, -0.3, 7.6, 0.45, 1.3);
    }
  }
  // Low front clerestory/service ranges and western modern roof equipment follow the picture-led envelope.
  B('frame', 0, 26, -35, 34, 3.4, 12);
  B('roof', 0, 29.4, -35, 35, 0.35, 13);
  B('frame', 0, 26, -54, 38, 1.4, 12);
  B('roof', 0, 27.4, -54, 39, 0.3, 13);
  B('frame', 9, 25, -258, 29, 3.2, 27);
  B('roof', 9, 28.2, -258, 30, 0.3, 28);
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
  const frontPane = (x, y, w, h) => {
    pane('glass', x, y, -2.37, w, h);
    if (detail > 1) {
      for (const dx of [-w / 2, w / 2]) B('frame', x + dx, y, -2.3, 0.09, h, 0.1);
      B('trim', x, y - 0.12, -2.27, w + 0.25, 0.18, 0.25);
      B('trim', x, y + h, -2.3, w + 0.25, 0.18, 0.2);
      pane('frame', x, y, -2.2, 0.08, h);
      for (let k = 1; k < 4; k++) pane('frame', x, y + (h * k) / 4, -2.2, w, 0.075);
    }
  };
  for (let i = 0; i < r.columns.length - 1; i++) {
    const x = (r.columns[i] + r.columns[i + 1]) / 2;
    frontPane(x, 8.7, 2.9, 5.8);
    frontPane(x, 15.7, 2.9, 6.5);
    if (detail > 1) B('trim', x, 14.7, -2.05, 3.2, 0.55, 0.5);
  }
  for (const x of [-29, -24, -12, -6, 6, 12, 24, 29]) {
    pane('glass', x, 1.1, 0.04, 2.4, 4.3);
    if (detail > 1) {
      for (const dx of [-1.3, 1.3]) B('trim', x + dx, 1, 0.1, 0.28, 4.6, 0.35);
      B('trim', x, 5.6, 0.1, 3.1, 0.32, 0.45);
      pane('frame', x, 1.1, 0.14, 0.08, 4.3);
    }
  }
  for (const x of r.entryXs) {
    pane('wood', x, 0.04, -1.17, 3.36, 4.52);
    if (detail > 1) {
      B('trim', x, 4.6, 0.04, 4.1, 0.5, 0.6);
      B('frame', x, 0.04, -1.12, 0.08, 4.5, 0.06);
      for (const dx of [-0.85, 0.85])
        for (const y of [0.5, 2.25]) {
          B('trim', x + dx, y, -1.1, 1.15, 0.08, 0.08);
          B('trim', x + dx, y + 1.2, -1.1, 1.15, 0.08, 0.08);
        }
    }
  }
  for (const b of r.facade) {
    const [x, z] = b.center,
      t = b.tangent,
      normal = b.normal,
      w = Math.min(2.9, b.spacing - 1.15),
      g = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, d]) => [x + u * t[0] + d * normal[0], y, z + u * t[1] + d * normal[1]]),
          [n[0] * t[0] + n[2] * normal[0], n[1], n[0] * t[1] + n[2] * normal[1]],
        ),
      rows = b.height === 19 ? [1.3, 5.7, 10.1, 14.5] : [1.6, 7.5, 13.4, 19.3];
    for (const y of rows) {
      const h = b.height === 19 ? 2.7 : 3.4;
      pane('glass', x + normal[0] * 0.04, y, z + normal[1] * 0.04, w, h, t, normal);
      if (detail === 2) {
        for (const dx of [-w / 2, w / 2])
          pane(
            'trim',
            x + dx * t[0] + normal[0] * 0.08,
            y,
            z + dx * t[1] + normal[1] * 0.08,
            0.14,
            h,
            t,
            normal,
          );
        pane('trim', x + normal[0] * 0.08, y + h, z + normal[1] * 0.08, w + 0.3, 0.18, t, normal);
        pane('frame', x + normal[0] * 0.12, y, z + normal[1] * 0.12, 0.075, h, t, normal);
      }
      if (detail === 3) {
        for (const dx of [-w / 2, w / 2]) box(g, 'trim', dx, Y + y, 0.08, 0.15, h, 0.2);
        box(g, 'trim', 0, Y + y - 0.13, 0.1, w + 0.3, 0.18, 0.27);
        box(g, 'trim', 0, Y + y + h, 0.1, w + 0.35, 0.2, 0.3);
        pane('frame', x + normal[0] * 0.18, y, z + normal[1] * 0.18, 0.08, h, t, normal);
        pane('frame', x + normal[0] * 0.18, y + h * 0.6, z + normal[1] * 0.18, w, 0.075, t, normal);
      }
    }
    if (detail > 1)
      for (const y of [b.height - 1.2, b.height - 0.5]) {
        if (detail === 3) box(g, 'trim', 0, Y + y, 0.13, b.spacing, 0.28, 0.4);
        else pane('trim', x + normal[0] * 0.1, y, z + normal[1] * 0.1, b.spacing, 0.28, t, normal);
      }
  }
  // The western block has a broad modern exterior glass screen, with economical merged framing.
  pane('glass', 10, 3.4, -287.57, 35, 18, [1, 0], [0, -1]);
  for (let i = 0; i < 8; i++) B('frame', -7.5 + i * 5, 3.3, -287.64, 0.22, 18.2, 0.28);
  for (let i = 0; i < 5; i++) B('frame', 10, 3.4 + i * 4.5, -287.65, 35.4, 0.22, 0.3);
  if (detail > 1) {
    for (let i = 0; i < 11; i++) {
      const z = -80 - i * 12.4;
      B('frame', 18, 19, z, 12, 0.4, 4.5);
      B('glass', 18, 19.4, z, 11.5, 0.15, 4);
    }
    for (let i = 0; i < 7; i++) {
      const x = -12 + i * 4;
      pane('glass', x, 26.5, -28.97, 2.8, 2.1);
      pane('glass', x, 26.5, -41.03, 2.8, 2.1, [1, 0], [0, -1]);
    }
    for (const z of [-48, -22])
      for (const x of [-23, 23]) {
        B('frame', x, 26, z, 5, 1.6, 5);
        B('roof', x, 27.6, z, 5.3, 0.25, 5.3);
      }
  }
}
