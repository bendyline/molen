/** 'palace_of_fontainebleau': Fontainebleau's mapped palace ranges, slate roofscape and horseshoe stairs. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildFontainebleau(face, detail, r) {
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
            const d = Math.min(Math.min(...hits) / 2, 8 / 1.05),
              mid = [q[0] + inward[0] * d, q[1] + inward[1] * d];
            if (d > 0.02 && inRoof(mid, p)) add(mid);
          }
        }
      }
      const roofPoint = (q) => [q[0], Y + band.hi + Math.min(8, distance(q, rings) * 1.05), q[1]],
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
  const edges = (p) =>
    [p.outline, ...p.holes].flatMap((ring, ri) => {
      const sign =
        Math.sign(
          ring.reduce((s, a, i) => {
            const b = ring[(i + 1) % ring.length];
            return s + a[0] * b[1] - a[1] * b[0];
          }, 0),
        ) * (ri ? -1 : 1);
      return ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]),
          t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        return { a, b, t, n: [t[1] * sign, -t[0] * sign], length };
      });
    });
  const panel = (role, e, u, w, y, h, offset = 0.05) =>
    f(
      role,
      [
        [-w / 2, 0],
        [w / 2, 0],
        [w / 2, h],
        [-w / 2, h],
      ].map(([a, b]) => [
        e.a[0] + e.t[0] * (u + a) + e.n[0] * offset,
        Y + y + b,
        e.a[1] + e.t[1] * (u + a) + e.n[1] * offset,
      ]),
      [e.n[0], 0, e.n[1]],
    );
  const inRing = (q, ring) => {
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
    },
    contains = (q, ps) =>
      ps.some((p) => inRing(q, p.outline) && !p.holes.some((h) => inRing(q, h))),
    eaveAt = (q) => Math.max(...r.parts.filter((p) => contains(q, p.polygons)).map((p) => p.hi), 8);
  if (detail)
    for (const p of r.bodyFloors)
      for (const e of edges(p)) {
        if (e.length < 3) continue;
        const n = Math.max(1, Math.round(e.length / [0, 14, 7.2, 4.8][detail]));
        for (let i = 0; i < n; i++) {
          const u = ((i + 0.5) * e.length) / n,
            x = e.a[0] + e.t[0] * u,
            z = e.a[1] + e.t[1] * u,
            hi = eaveAt([x - e.n[0] * 0.15, z - e.n[1] * 0.15]),
            isDoor = Math.abs(x - 30) < 2.1 && Math.abs(z - 8) < 1.1,
            gallery = r.arcades.some((a) => Math.hypot(x - a.center[0], z - a.center[1]) < 2.1);
          for (const y of [1.0, 6.1, ...(hi > 15 ? [10.7] : [])]) {
            if (y + 2.6 > hi - 0.35 || isDoor || (gallery && y < 5)) continue;
            panel('glass', e, u, 1.55, y, 2.6);
            if (detail > 1) panel('stone', e, u, 1.9, y - 0.15, 0.18, 0.09);
            if (detail > 1) {
              panel('stone', e, u, 0.1, y, 2.6, 0.085);
              panel('stone', e, u, 1.55, y + 1.4, 0.1, 0.085);
            }
            if (detail > 2) {
              for (const du of [-0.88, 0.88]) panel('stone', e, u + du, 0.16, y, 2.7, 0.085);
              panel('stone', e, u, 1.9, y + 2.6, 0.17, 0.09);
            }
          }
          if (detail > 1) {
            panel('stone', e, u, e.length / n, 5.4, 0.22, 0.09);
            panel('stone', e, u, e.length / n, hi - 0.3, 0.3, 0.09);
          }
          // Keep dormers and stacks on long roof ranges; exact inventories are reconstructed.
          if (detail > 1 && e.length > 14 && i % (detail === 2 ? 4 : 2) === 0) {
            const dx = x - e.n[0] * 2.1,
              dz = z - e.n[1] * 2.1;
            B('stone', dx, hi + 1.15, dz, 1.8, 2.4, 1.5);
            B('roof', dx, hi + 3.55, dz, 2.05, 0.35, 1.8);
            const de = { ...e, a: [dx - e.t[0] * u, dz - e.t[1] * u] };
            panel('glass', de, u, 1.0, hi + 1.5, 1.65, 0.78);
            if (detail > 2)
              f(
                'stone',
                [
                  [dx - 1.0, Y + hi + 3.9, dz],
                  [dx + 1.0, Y + hi + 3.9, dz],
                  [dx, Y + hi + 4.5, dz],
                ],
                [0, 0, 1],
              );
          }
          if (detail > 1 && e.length > 18 && i % 5 === 1) {
            const dx = x - e.n[0] * 4.3,
              dz = z - e.n[1] * 4.3;
            B('brick', dx, hi, dz, 0.9, 8.3, 1.3);
            B('stone', dx, hi + 8.3, dz, 1.15, 0.22, 1.55);
          }
        }
      }
  const arch = (e, backRole = 'dark') => {
    const [x, z] = e.center,
      w = e.width,
      h = e.spring + e.rise,
      n = e.normal,
      t = e.tangent,
      at = (u, y, d) => [x + t[0] * u - n[0] * d, Y + y, z + t[1] * u - n[1] * d],
      count = detail === 1 ? 4 : 12;
    if (detail < 2) {
      const edge = { a: e.center, t, n, length: 0 };
      panel(backRole, edge, 0, w, 0, h, 0.04);
      return;
    }
    f(
      'stone',
      [
        at(-w / 2, 0, 0),
        at(-w / 2, 0, e.depth),
        at(-w / 2, e.spring, e.depth),
        at(-w / 2, e.spring, 0),
      ],
      [t[0], 0, t[1]],
    );
    f(
      'stone',
      [
        at(w / 2, 0, 0),
        at(w / 2, 0, e.depth),
        at(w / 2, e.spring, e.depth),
        at(w / 2, e.spring, 0),
      ],
      [-t[0], 0, -t[1]],
    );
    for (let i = 0; i < count; i++) {
      const a = Math.PI - (i * Math.PI) / count,
        b = Math.PI - ((i + 1) * Math.PI) / count,
        u0 = (Math.cos(a) * w) / 2,
        u1 = (Math.cos(b) * w) / 2,
        y0 = e.spring + Math.sin(a) * e.rise,
        y1 = e.spring + Math.sin(b) * e.rise;
      f('stone', [at(u0, y0, 0), at(u1, y1, 0), at(u1, h, 0), at(u0, h, 0)], [n[0], 0, n[1]]);
      f(
        'stone',
        [at(u0, y0, 0), at(u1, y1, 0), at(u1, y1, e.depth), at(u0, y0, e.depth)],
        [-n[0], -1, -n[1]],
      );
    }
    f(
      backRole,
      [
        at(-w / 2, 0, e.depth - 0.025),
        at(w / 2, 0, e.depth - 0.025),
        at(w / 2, h, e.depth - 0.025),
        at(-w / 2, h, e.depth - 0.025),
      ],
      [n[0], 0, n[1]],
    );
    f(
      'stone',
      [at(-w / 2, 0, 0), at(w / 2, 0, 0), at(w / 2, 0, e.depth), at(-w / 2, 0, e.depth)],
      [0, 1, 0],
    );
  };
  if (detail) {
    arch(r.entry);
    for (const a of r.arcades) arch(a, 'glass');
  }
  // Two mapped curved flights remain separate. Slice along their measured rise
  // direction into actual horizontal treads rather than a solid decorative block.
  const stepCount = [2, 8, 20, 28][detail];
  for (const s of r.steps) {
    const usedPosts = new Set();
    const polys = s.polygons.map((p) => [
        detail === 0 ? p.outline.filter((_, i) => i % 2 === 0) : p.outline,
        ...p.holes,
      ]),
      zs = s.polygons.flatMap((p) => p.outline.map((q) => q[1])),
      near = Math.min(...zs),
      far = Math.max(...zs),
      step = (far - near) / stepCount;
    for (let i = 0; i < stepCount; i++) {
      const z0 = near + i * step,
        z1 = near + (i + 1) * step,
        height = (r.entry.landing * (stepCount - i)) / stepCount,
        clip = [
          [-200, z0],
          [200, z0],
          [200, z1],
          [-200, z1],
        ];
      for (const q of pc.intersection(polys, [[clip]]))
        prism(
          f,
          'stone',
          { outline: q[0].slice(0, -1), holes: q.slice(1).map((h) => h.slice(0, -1)) },
          detail < 2 ? r.foundationY : Y,
          Y + height,
        );
    }
    if (detail > 1)
      for (const p of s.polygons)
        for (const e of edges(p)) {
          if (e.length < 1.2) continue;
          const h = ([_x, z]) =>
              r.entry.landing * Math.max(0, Math.min(1, (far - z) / (far - near))),
            n = Math.max(1, Math.round(e.length / 1.8));
          for (let j = 0; j <= n; j++) {
            const u = (e.length * j) / n,
              x = e.a[0] + e.t[0] * u,
              z = e.a[1] + e.t[1] * u;
            const key = `${Math.round(x * 1000)},${Math.round(z * 1000)}`;
            if (usedPosts.has(key)) continue;
            usedPosts.add(key);
            B('stone', x, h([x, z]) - 0.05, z, 0.22, 1.05, 0.22);
          }
          const a = e.a,
            b = e.b,
            w = 0.18,
            top = (q) => Y + h(q) + 1,
            A = [a[0], top(a), a[1]],
            C = [b[0], top(b), b[1]],
            offset = [e.n[0] * w, 0, e.n[1] * w];
          for (const y of [0, -0.16])
            f(
              'stone',
              [
                A.map((v, k) => v + offset[k]),
                C.map((v, k) => v + offset[k]),
                C.map((v, k) => v - offset[k]),
                A.map((v, k) => v - offset[k]),
              ].map((p) => [p[0], p[1] + y, p[2]]),
              [0, y ? -1 : 1, 0],
            );
          for (const sign of [-1, 1])
            f(
              'stone',
              [
                A.map((v, k) => v + offset[k] * sign),
                C.map((v, k) => v + offset[k] * sign),
                C.map((v, k) => v + offset[k] * sign - (k === 1 ? 0.16 : 0)),
                A.map((v, k) => v + offset[k] * sign - (k === 1 ? 0.16 : 0)),
              ],
              [e.n[0] * sign, 0, e.n[1] * sign],
            );
          for (const [point, sign] of [
            [A, -1],
            [C, 1],
          ])
            f(
              'stone',
              [
                point.map((v, k) => v + offset[k]),
                point.map((v, k) => v - offset[k]),
                point.map((v, k) => v - offset[k] - (k === 1 ? 0.16 : 0)),
                point.map((v, k) => v + offset[k] - (k === 1 ? 0.16 : 0)),
              ],
              [e.t[0] * sign, 0, e.t[1] * sign],
            );
        }
  }
  if (detail) {
    // Upper landing bridges the two flights above the separate arched lower gate.
    B('stone', 30, 4.7, r.entry.center[1] + 1, 5.0, 0.2, 2.4);
    const e = { a: r.entry.center, t: r.entry.tangent, n: r.entry.normal };
    panel('dark', e, 0, 2.0, 5.05, 3.2, 0.065);
    for (const u of [-1.2, 1.2]) panel('stone', e, u, 0.25, 4.9, 3.65, 0.09);
    panel('stone', e, 0, 2.65, 8.5, 0.28, 0.09);
    // Plain upper pavilion fields abstract the sculpted central pediment/coat of arms.
    for (const u of [-5, 0, 5]) {
      panel('glass', e, u, 1.6, 14.0, 3.1, 0.07);
      panel('stone', e, u, 2, 17.1, 0.2, 0.09);
    }
  }
}
