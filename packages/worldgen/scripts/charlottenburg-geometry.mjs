/** 'N0762': Charlottenburg's mapped palace ranges and distinctive copper cupola. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { normalize, cross as vectorCross } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildCharlottenburg(face, detail, r) {
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
      if (Math.abs(band.hi - 15.5) < 1e-6) {
        cap('stone', p, band.hi);
        continue;
      }
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
            const d = Math.min(Math.min(...hits) / 2, 10 / 0.65),
              mid = [q[0] + inward[0] * d, q[1] + inward[1] * d];
            if (d > 0.02 && inRoof(mid, p)) add(mid);
          }
        }
      }
      const roofPoint = (q) => [q[0], Y + band.hi + Math.min(10, distance(q, rings) * 0.65), q[1]],
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
    heightAt = (q) => {
      const a = r.parts.filter((p) => contains(q, p.polygons));
      return a.length ? Math.max(...a.map((p) => p.hi)) : 9.5;
    };
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
  const archPane = (e, u, w, y, h) => {
    const spring = h - w * 0.35,
      count = detail === 1 ? 4 : detail === 2 ? 6 : 10,
      ps = [at(e, u - w / 2, y), at(e, u + w / 2, y)];
    for (let i = 0; i <= count; i++) {
      const a = (i * Math.PI) / count;
      ps.push(at(e, u + (Math.cos(a) * w) / 2, y + spring + Math.sin(a) * w * 0.35));
    }
    f('glass', ps, [e.n[0], 0, e.n[1]]);
  };
  if (detail)
    for (const p of r.bodyFloors)
      for (const e of edges(p)) {
        if (e.length < 3.5) continue;
        const count = Math.max(1, Math.round(e.length / [0, 19, 8, 4.8][detail]));
        for (let i = 0; i < count; i++) {
          const u = ((i + 0.5) * e.length) / count,
            x = e.a[0] + e.t[0] * u,
            z = e.a[1] + e.t[1] * u,
            hi = heightAt([x - e.n[0] * 0.15, z - e.n[1] * 0.15]),
            central =
              (Math.abs(x) < 9 && Math.abs(z - r.mainFacadeZ) < 2) ||
              r.frontBays.some((b) => Math.hypot(x - b.center[0], z - b.center[1]) < 2.1),
            orangery = x < -65 && hi < 9;
          if (!central)
            for (const y of orangery ? [1] : [0.8, 4.6]) {
              const h = orangery ? 4.6 : 2.6;
              if (y + h > hi - 0.45) continue;
              if (orangery) archPane(e, u, 1.75, y, h);
              else panel('glass', e, u, 1.45, y, h);
              if (detail > 1) {
                panel('stone', e, u, 1.8, y - 0.14, 0.17, 0.1);
                panel('stone', e, u, 0.09, y, h, 0.085);
                panel('stone', e, u, 1.45, y + 1.45, 0.1, 0.085);
              }
              if (detail > 2) {
                for (const du of [-0.82, 0.82]) panel('stone', e, u + du, 0.14, y, h + 0.12, 0.09);
                if (!orangery) panel('stone', e, u, 1.8, y + h, 0.2, 0.1);
              }
            }
          if (detail > 1 && !central) {
            panel('stone', e, u, e.length / count, hi - 0.24, 0.28, 0.1);
            if (hi > 9) panel('stone', e, u, e.length / count, 4.0, 0.2, 0.1);
          }
          if (detail > 1 && e.length > 22 && i % (detail === 2 ? 4 : 2) === 1) {
            const x2 = x - e.n[0] * 2.1,
              z2 = z - e.n[1] * 2.1;
            if (contains([x2, z2], r.floors)) {
              B('wall', x2, hi + 0.7, z2, 1.5, 1.7, 1.5);
              B('roof', x2, hi + 2.4, z2, 1.7, 0.25, 1.75);
              const de = { ...e, a: [x2 - e.t[0] * u, z2 - e.t[1] * u] };
              panel('glass', de, u, 0.9, hi + 1, 1.05, 0.78);
            }
          }
          if (detail > 1 && e.length > 22 && i % 7 === 3) {
            const x2 = x - e.n[0] * 3,
              z2 = z - e.n[1] * 3;
            if (contains([x2, z2], r.floors)) {
              B('stone', x2, hi + 1, z2, 0.7, 4.6, 0.9);
              B('stone', x2, hi + 5.6, z2, 1, 0.2, 1.2);
            }
          }
        }
      }
  const E = r.entry,
    front = { a: E.center, t: E.tangent, n: E.normal };
  if (detail) {
    for (const p of r.portals) {
      const edge = { ...front, a: p.center };
      archPane(edge, 0, 2.8, 4.6, 4.5);
      if (detail > 1) {
        panel('stone', edge, 0, 0.11, 4.6, 3.8, 0.08);
        panel('stone', edge, 0, 2.8, 6.7, 0.12, 0.08);
      }
    }
    for (const b of r.frontBays) {
      const e = { a: b.center, t: b.tangent, n: b.normal };
      for (const y of [0.8, 5]) {
        panel('glass', e, 0, 1.7, y, 2.8);
        if (detail > 1) {
          panel('stone', e, 0, 2.0, y - 0.1, 0.16, 0.09);
          panel('stone', e, 0, 0.1, y, 2.8, 0.08);
          panel('stone', e, 0, 1.7, y + 1.4, 0.1, 0.08);
          for (const u of [-0.95, 0.95]) panel('stone', e, u, 0.14, y, 2.95, 0.09);
          panel('stone', e, 0, 2, y + 2.8, 0.2, 0.09);
        }
      }
    }
  }
  // Closed metric lofts for the octagonal drum, bell and open lantern.
  const angle = Math.atan2(E.normal[1], E.normal[0]) - Math.PI / 8;
  const cylinder = (role, x, z, profile, count) => {
    const rings = profile.map(([y, rad]) =>
      Array.from({ length: count }, (_, i) => {
        const a = angle + (i * Math.PI * 2) / count;
        return [x + Math.cos(a) * rad, Y + y, z + Math.sin(a) * rad];
      }),
    );
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count,
          a = angle + ((i + 0.5) * Math.PI * 2) / count;
        f(
          role,
          [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
          [Math.cos(a), 0.01, Math.sin(a)],
        );
      }
    for (const [ring, n] of [
      [rings[0], [0, -1, 0]],
      [rings.at(-1), [0, 1, 0]],
    ])
      for (let i = 1; i < count - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], n);
  };
  if (detail)
    for (const x of [-7.9, -2.6, 2.6, 7.9]) {
      const q = at(front, x, 0, 0.55);
      B('stone', q[0], r.foundationY - Y, q[2], 1, Y + 0.35 - r.foundationY, 1);
      cylinder(
        'stone',
        q[0],
        q[2],
        [
          [0.35, 0.37],
          [10.7, 0.31],
        ],
        detail === 1 ? 4 : detail === 2 ? 8 : 12,
      );
      B('stone', q[0], 10.7, q[2], 0.95, 0.35, 0.95);
    }
  const A = (x, y, d) => at(front, x, y, d),
    gable = (d) => [A(-10, 11.1, d), A(10, 11.1, d), A(0, 14.1, d)],
    a = gable(0.9),
    b = gable(-1.8);
  f('stone', a, [E.normal[0], 0, E.normal[1]]);
  f('stone', b, [-E.normal[0], 0, -E.normal[1]]);
  for (const [i, j] of [
    [0, 1],
    [1, 2],
    [2, 0],
  ])
    f(i === 0 ? 'stone' : 'roof', [a[i], a[j], b[j], b[i]], i === 0 ? [0, -1, 0] : [0, 1, 0]);
  if (detail)
    f(
      'wall',
      [A(-8.7, 11.5, 0.92), A(8.7, 11.5, 0.92), A(0, 13.65, 0.92)],
      [E.normal[0], 0, E.normal[1]],
    );
  cylinder(
    'stone',
    0,
    0,
    [
      [15.5, 6.95],
      [16.0, 6.95],
    ],
    8,
  );
  cylinder(
    'wall',
    0,
    0,
    [
      [16, 6.7],
      [25.5, 6.7],
    ],
    8,
  );
  cylinder(
    'stone',
    0,
    0,
    [
      [25.5, 7.25],
      [26.2, 7.25],
    ],
    8,
  );
  if (detail)
    for (let i = 0; i < 8; i++) {
      const a = angle + ((i + 0.5) * Math.PI) / 4,
        n = [Math.cos(a), Math.sin(a)],
        q = n.map((v) => v * (6.7 * Math.cos(Math.PI / 8) + 0.04)),
        e = { a: q, n, t: [n[1], -n[0]] };
      archPane(e, 0, 2.7, 17.0, 6.9);
      if (detail > 1) {
        panel('stone', e, 0, 0.12, 17, 6.2, 0.08);
        panel('stone', e, 0, 2.7, 20, 0.12, 0.08);
        panel('stone', e, 0, 2.7, 22.5, 0.12, 0.08);
      }
      const aa = angle + (i * Math.PI) / 4;
      B('stone', Math.cos(aa) * 6.7, 16, Math.sin(aa) * 6.7, 0.48, 9.5, 0.48);
    }
  const bell =
      detail === 0
        ? [
            [26.2, 7.2],
            [29, 7.0],
            [33, 4.8],
            [35.5, 2.5],
          ]
        : [
            [26.2, 7.2],
            [26.8, 7.4],
            [27.8, 6.9],
            [30.5, 6.3],
            [32.8, 4.8],
            [34.8, 3],
            [35.5, 2.5],
          ],
    segments = [8, 12, 24, 32][detail];
  cylinder('copper', 0, 0, bell, segments);
  const beam = (role, A, B, width) => {
    const axis = normalize(B.map((v, k) => v - A[k])),
      across = normalize(vectorCross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
      other = vectorCross(axis, across),
      ring = (C) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) => C.map((a, k) => a + (across[k] * u + other[k] * v) * width)),
      a = ring(A),
      b = ring(B);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        role,
        [a[i], a[j], b[j], b[i]],
        a[i].map((v, k) => (v + a[j][k]) / 2 - A[k]),
      );
    }
    f(
      role,
      a,
      axis.map((v) => -v),
    );
    f(role, b, axis);
  };
  if (detail > 1)
    for (let i = 0; i < 8; i++) {
      const a = angle + (i * Math.PI) / 4;
      for (let k = 0; k < bell.length - 1; k++)
        beam(
          'copper',
          ...[bell[k], bell[k + 1]].map(([y, rad]) => [
            Math.cos(a) * (rad + 0.11),
            Y + y,
            Math.sin(a) * (rad + 0.11),
          ]),
          0.055,
        );
    }
  if (detail)
    for (let i = 0; i < 8; i++) {
      const a = angle + ((i + 0.5) * Math.PI) / 4,
        n = [Math.cos(a), Math.sin(a)],
        t = [n[1], -n[0]],
        count = detail === 1 ? 6 : 12;
      const pts = Array.from({ length: count }, (_, j) => {
        const b = (j * Math.PI * 2) / count,
          u = Math.cos(b) * 0.7,
          y = 29.6 + Math.sin(b) * 1.0,
          rad = 6.9 - ((y - 27.8) * 0.6) / 2.7 + 0.08;
        return [n[0] * rad + t[0] * u, Y + y, n[1] * rad + t[1] * u];
      });
      f('dark', pts, [n[0], 0, n[1]]);
    }
  if (detail) {
    const n = E.normal,
      t = E.tangent,
      e = { a: n.map((v) => v * (6.7 * Math.cos(Math.PI / 8) + 0.08)), n, t },
      count = detail === 1 ? 8 : 16,
      pts = Array.from({ length: count }, (_, i) =>
        at(
          e,
          Math.cos((i * Math.PI * 2) / count) * 0.95,
          24.2 + Math.sin((i * Math.PI * 2) / count) * 0.95,
          0.02,
        ),
      );
    f('stone', pts, [n[0], 0, n[1]]);
    if (detail > 1) {
      panel('gold', e, 0, 0.075, 24.15, 0.78, 0.04);
      panel('gold', e, 0.27, 0.59, 24.16, 0.075, 0.04);
    }
  }
  cylinder(
    'copper',
    0,
    0,
    [
      [35.5, 2.7],
      [36.1, 2.7],
    ],
    8,
  );
  if (detail)
    for (let i = 0; i < 8; i++) {
      const a = angle + (i * Math.PI) / 4;
      cylinder(
        'copper',
        Math.cos(a) * 2.25,
        Math.sin(a) * 2.25,
        [
          [36.1, 0.17],
          [40.2, 0.17],
        ],
        detail === 1 ? 4 : 6,
      );
    }
  else
    cylinder(
      'copper',
      0,
      0,
      [
        [36.1, 2.25],
        [40.2, 2.25],
      ],
      6,
    );
  cylinder(
    'copper',
    0,
    0,
    [
      [40.2, 2.7],
      [40.7, 2.7],
      [41.5, 1.6],
      [42.2, 0.3],
    ],
    detail === 0 ? 6 : 12,
  );
  cylinder(
    'gold',
    0,
    0,
    [
      [42.2, 0.3],
      [42.5, 0.65],
      [42.9, 0.3],
    ],
    detail === 0 ? 4 : 8,
  );
  if (detail === 0) B('gold', 0, 42.9, 0, 0.3, 5.1, 0.3);
  else {
    B('gold', -0.22, 42.9, 0, 0.22, 1.1, 0.26);
    B('gold', 0.22, 42.9, 0, 0.22, 1.1, 0.26);
    cylinder(
      'gold',
      0,
      0,
      [
        [43.7, 0.62],
        [44.8, 0.38],
        [45.6, 0.48],
        [46.2, 0.22],
      ],
      detail === 1 ? 4 : 8,
    );
    cylinder(
      'gold',
      0,
      0,
      [
        [46.2, 0.12],
        [46.35, 0.3],
        [46.75, 0.3],
        [46.9, 0.12],
      ],
      detail === 1 ? 4 : 8,
    );
    beam('gold', [0.25, Y + 45.2, 0], [1, Y + 46.3, 0], 0.1);
    beam('gold', [-0.25, Y + 45.3, 0], [-1, Y + 45.0, 0.25], 0.1);
    B('gold', 1.1, 44.9, 0, 0.07, 3.1, 0.07);
    f(
      'gold',
      [
        [1.1, Y + 47.9, 0],
        [1.1, Y + 47.0, 0],
        [-0.45, Y + 47.6, 0.25],
      ],
      [0, 0, 1],
    );
  }
  // Three genuinely recessed portals and their closed arched soffits.
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
      const count = detail === 2 ? 6 : 12,
        h = e.spring + e.rise;
      for (let i = 0; i < count; i++) {
        const a = Math.PI - (i * Math.PI) / count,
          b = Math.PI - ((i + 1) * Math.PI) / count,
          u0 = (Math.cos(a) * e.width) / 2,
          u1 = (Math.cos(b) * e.width) / 2,
          y0 = e.spring + Math.sin(a) * e.rise,
          y1 = e.spring + Math.sin(b) * e.rise;
        f('stone', [Q(u0, y0, 0), Q(u1, y1, 0), Q(u1, h, 0), Q(u0, h, 0)], [n[0], 0, n[1]]);
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
      for (let i = 0, count = detail === 1 ? 1 : 4; i < count; i++) {
        const d = (count - i) * 0.25,
          poly = {
            outline: [
              Q(-e.width / 2 - 0.25, -e.base, -d),
              Q(e.width / 2 + 0.25, -e.base, -d),
              Q(e.width / 2 + 0.25, -e.base, 0.02),
              Q(-e.width / 2 - 0.25, -e.base, 0.02),
            ].map((p) => [p[0], p[2]]),
            holes: [],
          };
        prism(f, 'stone', poly, r.foundationY, Y + (e.base * (i + 1)) / count);
      }
  }
}
