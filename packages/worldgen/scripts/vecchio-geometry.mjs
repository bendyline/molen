/** 'palazzo_vecchio': Palazzo Vecchio's mapped courtyard palace and open Torre di Arnolfo. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildVecchio(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    levels = r.profiles[detail === 0 ? 'skyline' : detail === 1 ? 'district' : 'full'];
  const cap = (role, p, y, n = [0, 1, 0]) => {
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
        ix.slice(i, i + 3).map((j) => [flat[j][0], Y + y, flat[j][1]]),
        n,
      );
  };
  if (detail > 1) for (const p of r.floors) prism(f, 'stone', p, r.foundationY, Y);
  else for (const p of levels[0].polygons) cap('stone', p, r.foundationY - Y, [0, -1, 0]);
  // Emit the exterior union only: no internal caps or overlapping stacked bodies.
  const walls = new Map();
  for (const band of levels) {
    for (const p of band.polygons)
      prism(
        (role, ps, n) => {
          if (Math.abs(n[1]) >= 0.5) return;
          const lo = band.lo === 0 && detail < 2 ? r.foundationY : Y + band.lo,
            key = JSON.stringify([ps[0][0], ps[0][2], ps[1][0], ps[1][2]]),
            spans = walls.get(key) ?? [],
            previous = spans.at(-1);
          if (previous && Math.abs(previous.hi - lo) < 1e-6) previous.hi = Y + band.hi;
          else
            spans.push({
              a: [ps[0][0], ps[0][2]],
              b: [ps[1][0], ps[1][2]],
              lo,
              hi: Y + band.hi,
              n,
              role,
            });
          walls.set(key, spans);
        },
        'wall',
        p,
        Y + band.lo,
        Y + band.hi,
        false,
      );

    if (band.lo > 0) for (const p of band.bottoms) cap('stone', p, band.lo, [0, -1, 0]);
  }
  for (const spans of walls.values())
    for (const w of spans)
      f(
        w.role,
        [
          [w.a[0], w.lo, w.a[1]],
          [w.b[0], w.lo, w.b[1]],
          [w.b[0], w.hi, w.b[1]],
          [w.a[0], w.hi, w.a[1]],
        ],
        w.n,
      );
  const distance = (p, rings) =>
    Math.min(
      ...rings.flatMap((ring) =>
        ring.map((a, i) => {
          const b = ring[(i + 1) % ring.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            l = dx * dx + dz * dz,
            t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
          return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
        }),
      ),
    );
  // Medial samples keep continuous steep ridges on long narrow ranges. A
  // deterministic Delaunay mesh is clipped back to the actual eave polygons.
  const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0],
    sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
    inRoof = (q, p) => {
      const ringHit = (ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i],
            b = ring[j];
          if (
            a[1] > q[1] !== b[1] > q[1] &&
            q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
          )
            inside = !inside;
        }
        return inside;
      };
      return ringHit(p.outline) && !p.holes.some(ringHit);
    },
    delaunay = (points) => {
      const n = points.length,
        xs = points.map((p) => p[0]),
        zs = points.map((p) => p[1]),
        d = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1),
        cx = (Math.max(...xs) + Math.min(...xs)) / 2,
        cz = (Math.max(...zs) + Math.min(...zs)) / 2,
        ps = points.concat([
          [cx - 20 * d, cz - d],
          [cx + 20 * d, cz - d],
          [cx, cz + 20 * d],
        ]);
      let triangles = [[n, n + 1, n + 2]];
      for (let k = 0; k < n; k++) {
        const q = ps[k],
          bad = [],
          edges = new Map();
        for (let i = 0; i < triangles.length; i++) {
          const t = triangles[i],
            [a, b, c] = t.map((j) => sub(ps[j], q)),
            det =
              (a[0] * a[0] + a[1] * a[1]) * cross2(b, c) -
              (b[0] * b[0] + b[1] * b[1]) * cross2(a, c) +
              (c[0] * c[0] + c[1] * c[1]) * cross2(a, b);
          if (det <= 1e-8) continue;
          bad.push(i);
          for (let j = 0; j < 3; j++) {
            const u = t[j],
              v = t[(j + 1) % 3],
              key = u < v ? `${u},${v}` : `${v},${u}`,
              row = edges.get(key);
            if (row) row.count++;
            else edges.set(key, { u, v, count: 1 });
          }
        }
        const remove = new Set(bad);
        triangles = triangles.filter((_, i) => !remove.has(i));
        for (const e of edges.values())
          if (e.count === 1) {
            const A = sub(ps[e.v], ps[e.u]),
              B = sub(q, ps[e.u]);
            if (Math.abs(cross2(A, B)) < 1e-9) continue;
            triangles.push(cross2(A, B) > 0 ? [e.u, e.v, k] : [e.v, e.u, k]);
          }
      }
      return triangles.filter((t) => t.every((i) => i < n)).map((t) => t.map((i) => ps[i]));
    };
  for (const band of levels)
    for (const p of band.tops) {
      cap('wall', p, band.hi, [0, -1, 0]);
      const rings = [p.outline, ...p.holes],
        points = new Map(),
        add = (q) => {
          q = q.map((v) => Math.round(v * 1e6) / 1e6);
          points.set(q.join(','), q);
        };
      rings.flat().forEach(add);
      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri],
          sign =
            Math.sign(ring.reduce((s, a, i) => s + cross2(a, ring[(i + 1) % ring.length]), 0)) *
            (ri ? -1 : 1);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            v = sub(b, a),
            length = Math.hypot(...v);
          if (length < [4, 2, 1.5, 1][detail]) continue;
          const inward = [(-v[1] * sign) / length, (v[0] * sign) / length],
            n = Math.max(1, Math.ceil(length / [40, 14, 8, 4.5][detail]));
          for (let j = 0; j < n; j++) {
            const q = [a[0] + (v[0] * (j + 0.5)) / n, a[1] + (v[1] * (j + 0.5)) / n],
              hits = [];
            for (const r of rings)
              for (let k = 0; k < r.length; k++) {
                const u = r[k],
                  w = sub(r[(k + 1) % r.length], u),
                  delta = sub(u, q),
                  den = cross2(inward, w);
                if (Math.abs(den) < 1e-9) continue;
                const t = cross2(delta, w) / den,
                  s = cross2(delta, inward) / den;
                if (t > 1e-4 && s >= -1e-7 && s <= 1 + 1e-7) hits.push(t);
              }
            if (!hits.length) continue;
            const d = Math.min(Math.min(...hits) / 2, 6 / 0.35),
              mid = [q[0] + inward[0] * d, q[1] + inward[1] * d];
            if (d > 0.02 && inRoof(mid, p)) add(mid);
          }
        }
      }
      const roofPoint = (q) => [q[0], Y + band.hi + Math.min(6, distance(q, rings) * 0.35), q[1]],
        ps = [...points.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const t of delaunay(ps))
        for (const poly of pc.intersection([rings], [[t]])) {
          const flat = poly.flat(),
            holes = [];
          let off = poly[0].length;
          for (const h of poly.slice(1)) {
            holes.push(off);
            off += h.length;
          }
          const ix = earcut(flat.flat(), holes);
          for (let i = 0; i < ix.length; i += 3)
            f(
              'roof',
              ix.slice(i, i + 3).map((j) => roofPoint(flat[j])),
              [0, 1, 0],
            );
        }
    }
  const inRing = (q, ring) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (
        a[1] > q[1] !== b[1] > q[1] &&
        q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
    return hit;
  };
  const contains = (q, ps) =>
      ps.some((p) => inRing(q, p.outline) && !p.holes.some((h) => inRing(q, h))),
    heightAt = (q) =>
      Math.max(23, ...r.parts.filter((p) => contains(q, p.polygons)).map((p) => p.hi));
  const edges = (p) =>
    [p.outline, ...p.holes].flatMap((ring, ri) => {
      const sign =
        Math.sign(
          ring.reduce(
            (s, a, i) =>
              s + a[0] * ring[(i + 1) % ring.length][1] - a[1] * ring[(i + 1) % ring.length][0],
            0,
          ),
        ) * (ri ? -1 : 1);
      return ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length],
          length = Math.hypot(...b.map((v, k) => v - a[k])),
          t = b.map((v, k) => (v - a[k]) / length);
        return { a, b, length, t, n: [t[1] * sign, -t[0] * sign] };
      });
    });
  const at = (e, u, y, d = 0.04) => [
      e.a[0] + e.t[0] * u + e.n[0] * d,
      Y + y,
      e.a[1] + e.t[1] * u + e.n[1] * d,
    ],
    panel = (role, e, u, w, y, h, d = 0.04) =>
      f(
        role,
        [
          at(e, u - w / 2, y, d),
          at(e, u + w / 2, y, d),
          at(e, u + w / 2, y + h, d),
          at(e, u - w / 2, y + h, d),
        ],
        [e.n[0], 0, e.n[1]],
      );
  const edgeBox = (role, e, u, y, w, h, depth, offset = 0) => {
    const p = {
      outline: [
        at(e, u - w / 2, 0, offset - depth / 2),
        at(e, u + w / 2, 0, offset - depth / 2),
        at(e, u + w / 2, 0, offset + depth / 2),
        at(e, u - w / 2, 0, offset + depth / 2),
      ].map((q) => [q[0], q[2]]),
      holes: [],
    };
    prism(f, role, p, Y + y, Y + y + h);
  };
  const archPane = (role, e, u, w, y, h, d = 0.06) => {
    const spring = h - w * 0.45,
      count = detail < 2 ? 4 : detail === 2 ? 6 : 10,
      ps = [at(e, u - w / 2, y, d), at(e, u + w / 2, y, d)];
    for (let i = 0; i <= count; i++) {
      const a = (i * Math.PI) / count;
      ps.push(at(e, u + (Math.cos(a) * w) / 2, y + spring + Math.sin(a) * w * 0.45, d));
    }
    f(role, ps, [e.n[0], 0, e.n[1]]);
  };
  if (detail)
    for (const p of r.bodyFloors)
      for (const e of edges(p)) {
        if (e.length < 3) continue;
        const count = Math.max(1, Math.round(e.length / [0, 16, 7.5, 5][detail]));
        for (let i = 0; i < count; i++) {
          const u = ((i + 0.5) * e.length) / count,
            x = e.a[0] + e.t[0] * u,
            z = e.a[1] + e.t[1] * u,
            hi = heightAt([x - e.n[0] * 0.2, z - e.n[1] * 0.2]),
            old = contains([x - e.n[0] * 0.2, z - e.n[1] * 0.2], [r.mainFootprint]);
          if (old) {
            for (const y of [9, 20]) {
              if (y + 3.6 > hi) continue;
              archPane('stone', e, u, 2.5, y, 3.6, 0.07);
              if (detail === 1) archPane('glass', e, u, 1.9, y + 0.18, 3.15, 0.09);
              else {
                for (const du of [-0.53, 0.53])
                  archPane('glass', e, u + du, 0.86, y + 0.18, 2.8, 0.1);
                panel('stone', e, u, 0.18, y + 0.1, 2.9, 0.14);
                panel('stone', e, u, 2.8, y - 0.18, 0.2, 0.16);
              }
            }
            if (detail > 1) panel('dark', e, u, 0.65, 16, 0.65, 0.07);
          } else
            for (const y of [2.5, 10, 17]) {
              if (y + 3 > hi - 0.8) continue;
              panel('glass', e, u, 1.6, y, 2.9, 0.06);
              if (detail > 1) {
                panel('stone', e, u, 1.9, y - 0.13, 0.18, 0.13);
                panel('stone', e, u, 0.1, y, 2.9, 0.12);
              }
            }
          if (
            detail > 1 &&
            !(Math.abs(x - r.entry.center[0]) < 2.5 && Math.abs(z - r.mainFacadeZ) < 1.5)
          )
            panel('dark', e, u, old ? 0.8 : 1.2, 1.5, old ? 1.8 : 2.1, 0.07);
        }
      }
  // Continuous projecting gallery, supported corbels and crenels around the
  // old block. The gallery arches are closed dark exterior proxies.
  for (const e of edges(r.mainFootprint)) {
    edgeBox('wall', e, e.length / 2, 31, e.length + 1.2, 3, 1.5, 0.55);
    edgeBox('wall', e, e.length / 2, 30, e.length + 1.2, 0.55, 2, 0.4);
    const count = Math.max(3, Math.round(e.length / [15, 7, 3.2, 2.4][detail]));
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * e.length) / count,
        w = Math.min(1.5, (e.length / count) * 0.55);
      edgeBox('wall', e, u, 34, w, 2, 1.5, 0.55);
      if (detail) {
        archPane('dark', e, u, Math.min(1.1, (e.length / count) * 0.45), 31.4, 1.8, 1.32);
        if (detail > 1) edgeBox('wall', e, u, 28.8, 0.6, 1.3, 1.5, 0.3);
      }
    }
  }
  // The tower's mapped shaft footprint is preserved separately from the
  // lower palace. It stops below the genuinely open upper belfry.
  prism(f, 'wall', r.towerFootprint, Y + 30, Y + 67);
  const terrace =
    detail === 0
      ? [
          [67, 12],
          [70, 12],
          [70.6, 13.2],
          [74, 13.2],
        ]
      : [
          [67, 10.7],
          [68, 11.3],
          [69.5, 13.1],
          [70.6, 13.1],
          [74, 13.1],
        ];
  const towerRect = (w) => [
    [-w / 2, -w * 0.39],
    [w / 2, -w * 0.39],
    [w / 2, w * 0.39],
    [-w / 2, w * 0.39],
  ];
  const loftTower = (profile) => {
    const rings = profile.map(([y, w]) => towerRect(w).map(([x, z]) => [x, Y + y, z]));
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          a = rings[k][i],
          b = rings[k][j];
        f('wall', [a, b, rings[k + 1][j], rings[k + 1][i]], [b[2] - a[2], 0.02, a[0] - b[0]]);
      }
    for (const [ring, n] of [
      [rings[0], [0, -1, 0]],
      [rings.at(-1), [0, 1, 0]],
    ])
      f('wall', ring, n);
  };
  loftTower(terrace);
  const forkedMerlon = (e, u, y, w, h, depth, offset = 0) => {
    if (!detail) {
      edgeBox('wall', e, u, y, w, h, depth, offset);
      return;
    }
    const ps = [
        [-w / 2, y],
        [w / 2, y],
        [w / 2, y + h],
        [0, y + h - 0.65],
        [-w / 2, y + h],
      ],
      Q = (p, d) => at(e, u + p[0], p[1], offset + d);
    for (const side of [-1, 1])
      f(
        'wall',
        ps.map((p) => Q(p, (side * depth) / 2)),
        [e.n[0] * side, 0, e.n[1] * side],
      );
    for (let i = 0; i < ps.length; i++) {
      const j = (i + 1) % ps.length,
        dx = ps[j][0] - ps[i][0],
        dy = ps[j][1] - ps[i][1];
      f(
        'wall',
        [Q(ps[i], -depth / 2), Q(ps[j], -depth / 2), Q(ps[j], depth / 2), Q(ps[i], depth / 2)],
        [e.t[0] * dy, -dx, e.t[1] * dy],
      );
    }
  };
  const deck = { outline: towerRect(13.1), holes: [] };
  for (const e of edges(deck)) {
    const count = detail === 0 ? 1 : detail === 1 ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * e.length) / count;
      forkedMerlon(e, u, 74, detail === 0 ? 2 : 1.25, 2, 1.05, -0.1);
      if (detail > 1) {
        edgeBox('wall', e, u, 67.3, 0.55, 2.4, 1.5, -0.4);
        panel('dark', e, u, 0.55, 71, 0.95, 0.025);
      }
    }
  }
  const nx = 4,
    nz = 3.1;
  for (const x of [-nx, nx]) for (const z of [-nz, nz]) B('wall', x, 76, z, 1.3, 9.2, 1.3);
  // Four closed arch shells span the corner piers, with no solid back wall.
  const archShell = (e, width) => {
    const count = detail === 0 ? 3 : detail === 1 ? 4 : detail === 2 ? 6 : 10,
      half = width / 2,
      spring = 81.3,
      rise = 3.0;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI) / count,
        b = ((i + 1) * Math.PI) / count,
        A = [Math.cos(a) * half, spring + Math.sin(a) * rise],
        Bv = [Math.cos(b) * half, spring + Math.sin(b) * rise],
        C = [Math.cos(b) * (half + 0.95), spring + Math.sin(b) * (rise + 0.95)],
        D = [Math.cos(a) * (half + 0.95), spring + Math.sin(a) * (rise + 0.95)],
        Q = (p, d) => at(e, p[0], p[1], d);
      for (const side of [-1, 1])
        f(
          'wall',
          [Q(A, side * 0.65), Q(Bv, side * 0.65), Q(C, side * 0.65), Q(D, side * 0.65)],
          [e.n[0] * side, 0, e.n[1] * side],
        );
      for (const [p, q, down] of [
        [A, Bv, true],
        [D, C, false],
      ])
        f('wall', [Q(p, -0.65), Q(q, -0.65), Q(q, 0.65), Q(p, 0.65)], [0, down ? -1 : 1, 0]);
    }
  };
  for (const side of [-1, 1]) {
    archShell({ a: [0, side * nz], t: [1, 0], n: [0, side] }, 6.7);
    archShell({ a: [side * nx, 0], t: [0, 1], n: [side, 0] }, 4.9);
  }
  B('wall', 0, 85.2, 0, 10.2, 1.8, 8.4);
  B('wall', 0, 87, 0, 10.8, 0.65, 9);
  const crown = {
    outline: [
      [-5.1, -4.2],
      [5.1, -4.2],
      [5.1, 4.2],
      [-5.1, 4.2],
    ],
    holes: [],
  };
  for (const e of edges(crown)) {
    const count = detail === 0 ? 1 : detail === 1 ? 2 : 4;
    for (let i = 0; i < count; i++)
      forkedMerlon(e, ((i + 0.5) * e.length) / count, 87.65, 1.15, 2.6, 1.15);
  }
  B('gold', 0, 90.9, 0, detail === 0 ? 0.45 : 0.22, 3.1, detail === 0 ? 0.45 : 0.22);
  if (detail)
    f(
      'gold',
      [
        [-0.9, Y + 93, 0],
        [1, Y + 93.35, 0],
        [0.4, Y + 93.8, 0],
      ],
      [0, 0, 1],
    );
  if (detail) {
    const clock = { a: [0, 3.6], t: [1, 0], n: [0, 1] },
      disc = (role, radius, depth) => {
        const n = detail === 1 ? 12 : detail === 2 ? 18 : 24,
          ps = [];
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n;
          ps.push(at(clock, Math.cos(a) * radius, 44.5 + Math.sin(a) * radius, depth));
        }
        f(role, ps, [0, 0, 1]);
      };
    disc('dark', 2.9, 0.04);
    disc('stone', 2.68, 0.06);
    const hand = (angle, length, width) => {
      const dx = Math.cos(angle),
        dy = Math.sin(angle),
        ps = [
          [(-dy * width) / 2, (dx * width) / 2],
          [(dy * width) / 2, (-dx * width) / 2],
          [dx * length + (dy * width) / 2, dy * length - (dx * width) / 2],
          [dx * length - (dy * width) / 2, dy * length + (dx * width) / 2],
        ];
      f(
        'dark',
        ps.map(([x, y]) => at(clock, x, 44.5 + y, 0.08)),
        [0, 0, 1],
      );
    };
    hand(Math.PI * 0.7, 1.8, 0.13);
    hand(Math.PI * 0.13, 2.2, 0.1);
    if (detail > 1)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          x = Math.cos(a) * 2.35,
          y = 44.5 + Math.sin(a) * 2.35;
        panel('dark', clock, x, 0.12, y - 0.12, 0.24, 0.08);
      }
    for (const e of edges(r.towerFootprint))
      for (const y of [53, 62]) panel('dark', e, e.length / 2, 0.5, y, 1.3, 0.06);
    if (detail > 1) {
      const n = 12,
        profile = [
          [79.4, 0.9],
          [79.6, 1.1],
          [80.7, 0.65],
          [81.2, 0.35],
        ],
        rings = profile.map(([y, rad]) =>
          Array.from({ length: n }, (_, i) => [
            Math.cos((i * Math.PI * 2) / n) * rad,
            Y + y,
            Math.sin((i * Math.PI * 2) / n) * rad,
          ]),
        );
      for (let k = 0; k < rings.length - 1; k++)
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          f(
            'dark',
            [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
            [Math.cos(((i + 0.5) * Math.PI * 2) / n), 0, Math.sin(((i + 0.5) * Math.PI * 2) / n)],
          );
        }
      for (const [ring, norm] of [
        [rings[0], [0, -1, 0]],
        [rings.at(-1), [0, 1, 0]],
      ])
        for (let i = 1; i < ring.length - 1; i++) f('dark', [ring[0], ring[i], ring[i + 1]], norm);
      B('dark', 0, 81.2, 0, 0.15, 2.5, 0.15);
    }
  }
  // A single front entrance, with a real arched recess/soffit/threshold.
  for (const e of r.portals) {
    const n = e.normal,
      t = e.tangent,
      Q = (u, y, d) => [
        e.center[0] + t[0] * u - n[0] * d,
        Y + e.base + y,
        e.center[1] + t[1] * u - n[1] * d,
      ];
    if (detail > 1) {
      const floor = {
        outline: [
          Q(-e.width / 2, -e.base, 0),
          Q(e.width / 2, -e.base, 0),
          Q(e.width / 2, -e.base, e.depth),
          Q(-e.width / 2, -e.base, e.depth),
        ].map((p) => [p[0], p[2]]),
        holes: [],
      };
      prism(f, 'stone', floor, Y, Y + e.base);
      for (const sign of [-1, 1])
        f(
          'stone',
          [
            Q((sign * e.width) / 2, 0, 0),
            Q((sign * e.width) / 2, 0, e.depth),
            Q((sign * e.width) / 2, e.spring, e.depth),
            Q((sign * e.width) / 2, e.spring, 0),
          ],
          [-t[0] * sign, 0, -t[1] * sign],
        );
      const count = detail === 2 ? 8 : 12,
        h = e.spring + e.rise;
      for (let i = 0; i < count; i++) {
        const a = Math.PI - (i * Math.PI) / count,
          b = Math.PI - ((i + 1) * Math.PI) / count,
          u0 = (Math.cos(a) * e.width) / 2,
          u1 = (Math.cos(b) * e.width) / 2,
          y0 = e.spring + Math.sin(a) * e.rise,
          y1 = e.spring + Math.sin(b) * e.rise;
        f('wall', [Q(u0, y0, 0), Q(u1, y1, 0), Q(u1, h, 0), Q(u0, h, 0)], [n[0], 0, n[1]]);
        f(
          'stone',
          [Q(u0, y0, 0), Q(u1, y1, 0), Q(u1, y1, e.depth), Q(u0, y0, e.depth)],
          [-n[0], -1, -n[1]],
        );
      }
      f(
        'dark',
        [
          Q(-e.width / 2, 0, e.depth - 0.025),
          Q(e.width / 2, 0, e.depth - 0.025),
          Q(e.width / 2, h, e.depth - 0.025),
          Q(-e.width / 2, h, e.depth - 0.025),
        ],
        [n[0], 0, n[1]],
      );
    } else if (detail)
      panel('dark', { a: e.center, n, t }, 0, e.width, e.base, e.spring + e.rise, 0.04);
    if (detail)
      for (let i = 0, count = detail === 1 ? 1 : 3; i < count; i++) {
        const d = (count - i) * 0.25,
          p = {
            outline: [
              Q(-e.width / 2 - 0.2, -e.base, -d),
              Q(e.width / 2 + 0.2, -e.base, -d),
              Q(e.width / 2 + 0.2, -e.base, 0.02),
              Q(-e.width / 2 - 0.2, -e.base, 0.02),
            ].map((p) => [p[0], p[2]]),
            holes: [],
          };
        prism(f, 'stone', p, r.foundationY, Y + (e.base * (i + 1)) / count);
      }
  }
}
