/** 'N0761': Nymphenburg's mapped palace ranges, red hip roofs, four courts and raised galleries. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

export function buildNymphenburg(face, detail, r) {
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
  const contains = (q, ps) =>
    ps.some((p) => inRing(q, p.outline) && !p.holes.some((h) => inRing(q, h)));
  const heightAt = (q) => {
    const ps = r.parts.filter((p) => contains(q, p.polygons)),
      gallery = r.bridges.find((b) => {
        const xs = b.polygons.flatMap((p) => p.outline.map((p) => p[0]));
        return q[0] >= Math.min(...xs) - 0.05 && q[0] <= Math.max(...xs) + 0.05;
      });
    return {
      hi: gallery?.hi ?? Math.max(8, ...ps.map((p) => p.hi)),
      lo:
        gallery?.lo ??
        r.bridgeVoids.find((v) => contains(q, [v]))?.ceiling ??
        Math.min(...ps.map((p) => p.lo), 8),
    };
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
  ];
  const panel = (role, e, u, w, y, h, d = 0.04) =>
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
  const archedGlass = (e, u, w, y, h) => {
    const spring = h - w * 0.35,
      count = detail === 1 ? 4 : detail === 2 ? 6 : 10,
      ps = [at(e, u - w / 2, y), at(e, u + w / 2, y)];
    for (let k = 0; k <= count; k++) {
      const a = (k * Math.PI) / count;
      ps.push(at(e, u + (Math.cos(a) * w) / 2, y + spring + Math.sin(a) * w * 0.35));
    }
    f('glass', ps, [e.n[0], 0, e.n[1]]);
  };
  if (detail)
    for (const p of r.bodyFloors)
      for (const e of edges(p)) {
        if (e.length < 3.5) continue;
        const mainFace =
          Math.abs(e.n[1]) > 0.9 &&
          e.length > 30 &&
          e.length < 39 &&
          Math.abs((e.a[0] + e.b[0]) / 2) < 4 &&
          Math.abs((e.a[1] + e.b[1]) / 2) < 22;
        const n = Math.max(1, Math.round(e.length / (mainFace ? 5 : [0, 20, 8, 5][detail])));
        for (let i = 0; i < n; i++) {
          const u = ((i + 0.5) * e.length) / n,
            x = e.a[0] + e.t[0] * u,
            z = e.a[1] + e.t[1] * u,
            { hi, lo } = heightAt([x - e.n[0] * 0.12, z - e.n[1] * 0.12]),
            door = Math.hypot(x - r.entry.center[0], z - r.entry.center[1]) < 2.2,
            tall = mainFace && Math.abs(x) < 7.7;
          const ys = mainFace
            ? [0.9, 4.7, 9.1, 13.4]
            : [lo + 0.9, lo + 4.7, ...(hi > 12 ? [lo + 8.7] : [])];
          for (const y of ys) {
            const h = mainFace && y === 13.4 ? 1.6 : lo > 0 ? Math.min(2.65, hi - lo - 1.5) : 2.65,
              w = mainFace ? 1.75 : 1.45;
            if (y + h > hi - 0.5 || (door && y < 5.1) || (tall && y === 9.1)) continue;
            if (tall && y === 4.7) archedGlass(e, u, 2.1, y, 6.0);
            else panel('glass', e, u, w, y, h);
            if (detail > 1) {
              panel('stone', e, u, w + 0.35, y - 0.14, 0.17, 0.1);
              panel('stone', e, u, 0.09, y, tall && y === 4.7 ? 5.5 : h, 0.085);
              panel('stone', e, u, w, y + 1.35, 0.09, 0.085);
              if (tall && y === 4.7) {
                panel('stone', e, u, 2.1, y + 3.1, 0.11, 0.085);
                panel('stone', e, u, 2.1, y + 4.7, 0.11, 0.085);
              }
            }
            if (detail > 2) {
              if (!(tall && y === 4.7)) {
                for (const du of [-w / 2 - 0.1, w / 2 + 0.1])
                  panel('stone', e, u + du, 0.16, y, h + 0.15, 0.09);
                panel('stone', e, u, w + 0.35, y + h, 0.18, 0.1);
              }
              if (mainFace && y === 4.7 && !tall) {
                f(
                  'stone',
                  [
                    at(e, u - w * 0.7, y + h + 0.25, 0.14),
                    at(e, u + w * 0.7, y + h + 0.25, 0.14),
                    at(e, u, y + h + 1, 0.14),
                  ],
                  [e.n[0], 0, e.n[1]],
                );
                panel('gold', e, u, 0.5, y + h + 0.4, 0.14, 0.16);
              }
            }
          }
          if (detail > 1) {
            panel('stone', e, u, e.length / n, hi - 0.25, 0.28, 0.1);
            if (hi > 9 && !door && lo === 0) panel('stone', e, u, e.length / n, 4.1, 0.19, 0.1);
            if (mainFace) {
              panel('stone', e, u + e.length / n / 2, 0.45, 4.25, hi - 4.8, 0.13);
              panel('gold', e, u + e.length / n / 2, 0.8, hi - 1, 0.42, 0.18);
              if (tall) {
                const center = 12.1,
                  count = detail === 2 ? 8 : 12,
                  pts = Array.from({ length: count }, (_, k) =>
                    at(
                      e,
                      u + Math.cos((k * Math.PI * 2) / count) * 0.65,
                      center + Math.sin((k * Math.PI * 2) / count) * 0.85,
                      0.11,
                    ),
                  );
                f('stone', pts, [e.n[0], 0, e.n[1]]);
                panel('gold', e, u, 1.4, hi - 1.7, 0.28, 0.12);
              }
            }
          }
          if (detail > 1 && e.length > 22 && i % (detail === 2 ? 4 : 2) === 0) {
            const dx = x - e.n[0] * 2.1,
              dz = z - e.n[1] * 2.1;
            if (contains([dx, dz], r.bodyFloors)) {
              const de = { ...e, a: [dx - e.t[0] * u, dz - e.t[1] * u] },
                w = 1.35,
                base = hi + 0.7,
                top = hi + 2.8;
              const poly = {
                outline: [
                  [-w / 2, -0.1],
                  [w / 2, -0.1],
                  [w / 2, -1.4],
                  [-w / 2, -1.4],
                ].map(([a, b]) => [dx + e.t[0] * a + e.n[0] * b, dz + e.t[1] * a + e.n[1] * b]),
                holes: [],
              };
              prism(f, 'wall', poly, Y + base, Y + top);
              panel('glass', de, u, 0.9, base + 0.25, 1.3, 0.045);
              const roof = [
                at(de, u - w / 2 - 0.12, top, 0.18),
                at(de, u + w / 2 + 0.12, top, 0.18),
                at(de, u, top + 0.65, 0.18),
              ];
              f('stone', roof, [e.n[0], 0, e.n[1]]);
              for (const sign of [-1, 1])
                f(
                  'roof',
                  [
                    at(de, u, top + 0.65, 0.18),
                    at(de, u + sign * (w / 2 + 0.12), top, 0.18),
                    at(de, u + sign * (w / 2 + 0.12), top, -1.55),
                    at(de, u, top + 0.65, -1.55),
                  ],
                  [e.n[0] * 0.1, 1, e.n[1] * 0.1],
                );
            }
          }
          if (detail > 1 && e.length > 24 && i % 7 === 3) {
            const q = [x - e.n[0] * 3, z - e.n[1] * 3];
            if (contains(q, r.bodyFloors)) {
              B('stone', q[0], hi + 1.0, q[1], 0.7, 4.8, 1);
              B('stone', q[0], hi + 5.8, q[1], 1, 0.2, 1.3);
            }
          }
        }
        if (detail > 2 && mainFace) {
          const count = Math.floor(e.length / 0.8);
          for (let i = 0; i < count; i++)
            panel('stone', e, ((i + 0.5) * e.length) / count, 0.3, 16.3, 0.35, 0.28);
        }
      }
  // The terrace and its closed railing are architectural elements, not a terrain patch.
  prism(f, 'stone', r.terrace, detail < 2 ? r.foundationY : Y, Y + 0.5);
  if (detail > 1) {
    for (const x of [-12, 12]) B('stone', x, 0.5, r.westFacade - 1.7, 0.25, 0.95, 3.7);
    const z = r.westFacade - 3.4;
    for (const sign of [-1, 1]) {
      B('stone', sign * 7.1, 1.4, z, 9.8, 0.18, 0.38);
      for (let i = 0; i <= 11; i++)
        B('stone', sign * (2.2 + (9.8 * i) / 11), 0.5, z, 0.2, 0.9, 0.22);
    }
  }
  // Actual east entrance recess: opaque back, curved soffit, jambs and raised threshold.
  const E = r.entry,
    norm = E.normal,
    tan = E.tangent,
    A = (u, y, d) => [
      E.center[0] + tan[0] * u - norm[0] * d,
      Y + E.base + y,
      E.center[1] + tan[1] * u - norm[1] * d,
    ];
  if (detail > 1) {
    for (const sign of [-1, 1])
      f(
        'stone',
        [
          A((sign * E.width) / 2, 0, 0),
          A((sign * E.width) / 2, 0, E.depth),
          A((sign * E.width) / 2, E.spring, E.depth),
          A((sign * E.width) / 2, E.spring, 0),
        ],
        [-tan[0] * sign, 0, -tan[1] * sign],
      );
    const floor = {
      outline: [
        A(-E.width / 2, -E.base, 0),
        A(E.width / 2, -E.base, 0),
        A(E.width / 2, -E.base, E.depth),
        A(-E.width / 2, -E.base, E.depth),
      ].map((p) => [p[0], p[2]]),
      holes: [],
    };
    prism(f, 'stone', floor, Y, Y + E.base);
    const count = detail === 2 ? 6 : 12,
      h = E.spring + E.rise;
    for (let i = 0; i < count; i++) {
      const a = Math.PI - (i * Math.PI) / count,
        b = Math.PI - ((i + 1) * Math.PI) / count,
        u0 = (Math.cos(a) * E.width) / 2,
        u1 = (Math.cos(b) * E.width) / 2,
        y0 = E.spring + Math.sin(a) * E.rise,
        y1 = E.spring + Math.sin(b) * E.rise;
      f('stone', [A(u0, y0, 0), A(u1, y1, 0), A(u1, h, 0), A(u0, h, 0)], [norm[0], 0, norm[1]]);
      f(
        'stone',
        [A(u0, y0, 0), A(u1, y1, 0), A(u1, y1, E.depth), A(u0, y0, E.depth)],
        [-norm[0], -1, -norm[1]],
      );
    }
    f(
      'dark',
      [
        A(-E.width / 2, 0, E.depth - 0.025),
        A(E.width / 2, 0, E.depth - 0.025),
        A(E.width / 2, h, E.depth - 0.025),
        A(-E.width / 2, h, E.depth - 0.025),
      ],
      [norm[0], 0, norm[1]],
    );
    f(
      'stone',
      [
        A(-E.width / 2, 0, 0),
        A(E.width / 2, 0, 0),
        A(E.width / 2, 0, E.depth),
        A(-E.width / 2, 0, E.depth),
      ],
      [0, 1, 0],
    );
  } else if (detail) {
    const e = { a: E.center, t: tan, n: norm };
    panel('dark', e, 0, E.width, E.base, E.spring + E.rise, 0.04);
  }
  if (detail) {
    const count = detail === 1 ? 1 : 5;
    for (let i = 0; i < count; i++) {
      const d = (count - i) * 0.28,
        ps = [
          A(-E.width / 2 - 0.4, -E.base, -d),
          A(E.width / 2 + 0.4, -E.base, -d),
          A(E.width / 2 + 0.4, -E.base, 0.1),
          A(-E.width / 2 - 0.4, -E.base, 0.1),
        ];
      prism(
        f,
        'stone',
        { outline: ps.map((p) => [p[0], p[2]]), holes: [] },
        Y,
        Y + (E.base * (i + 1)) / count,
      );
    }
  }
}
