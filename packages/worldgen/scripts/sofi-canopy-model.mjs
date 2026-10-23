/** SoFi's connected swept canopy, sunken bowl, suspended oval and theater exterior. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0710';

export const sofiRoofHeight = (x, z) =>
  Math.max(14, 55 - 0.0004 * (x - 25) ** 2 - 0.0008 * (z + 5) ** 2);

function quietOutline(input, tolerance) {
  const points = input.map((p, index) => ({ p, index }));
  let changed = true;
  while (changed && points.length > 8) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length],
        next = points[(i + 1) % points.length],
        a = previous.p,
        c = next.p,
        dx = c[0] - a[0],
        dz = c[1] - a[1];
      let within = true;
      // Retest the whole retained source arc; local vertex removals must not
      // accumulate into a larger silhouette error around the excavation rim.
      for (
        let j = (previous.index + 1) % input.length;
        j !== next.index;
        j = (j + 1) % input.length
      ) {
        const b = input[j],
          t = Math.max(
            0,
            Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz)),
          );
        if (Math.hypot(b[0] - a[0] - dx * t, b[1] - a[1] - dz * t) >= tolerance) {
          within = false;
          break;
        }
      }
      if (within) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return points.map(({ p }) => p);
}

function clipHalfPlane(poly, axis, bound, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ia = sign * (a[axis] - bound) >= -1e-9,
      ib = sign * (b[axis] - bound) >= -1e-9;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}

export function buildSofiCanopy(face, detail, r, ground) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    count = [12, 16, 36, 64][detail],
    tolerance = [5.5, 2, 0.8, 0.12][detail],
    body = quietOutline(r.body, tolerance),
    outer = quietOutline(r.roofOuter, tolerance),
    inner = quietOutline(r.roofInner, tolerance),
    grade = ([x, z]) => {
      const p = P([x, 0, z]);
      return ground(p[0], p[2]) - F;
    },
    ellipse = (a, rx, rz, y) => [rx * Math.cos(a), y, rz * Math.sin(a)],
    radius = (poly, a) => {
      const u = [Math.cos(a), Math.sin(a)],
        hits = [],
        cross = (a, b) => a[0] * b[1] - a[1] * b[0];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i],
          q = poly[(i + 1) % poly.length],
          v = q.map((n, k) => n - p[k]),
          den = cross(u, v);
        if (Math.abs(den) < 1e-9) continue;
        const t = cross(p, v) / den,
          s = cross(p, u) / den;
        if (t > 0 && s >= -1e-8 && s <= 1 + 1e-8) hits.push(t);
      }
      if (!hits.length) throw Error(`${candidateId}: SoFi bowl outline is not radial`);
      return Math.min(...hits);
    },
    at = (t, a, y) => {
      const near = 1 / Math.sqrt((Math.cos(a) / 75) ** 2 + (Math.sin(a) / 38) ** 2),
        far = radius(r.body, a) * 0.99,
        R = near + (far - near) * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    ring = (role, t0, t1, y0, y1, aisles = false) => {
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count,
          m = (a + b) / 2,
          ps = [at(t0, a, y0), at(t0, b, y0), at(t1, b, y1), at(t1, a, y1)],
          below = ps.map(([x, y, z]) => [x, y - 0.5, z]);
        if (aisles && i % 2 === 0) {
          const p = ps[0].map((n, k) => n + (ps[1][k] - n) * 0.1),
            q = ps[3].map((n, k) => n + (ps[2][k] - n) * 0.1);
          f('wall', [ps[0], p, q, ps[3]], [0, 1, 0]);
          f(role, [p, ps[1], ps[2], q], [0, 1, 0]);
        } else f(role, ps, [0, 1, 0]);
        if (detail > 1) {
          f('wall', below, [0, -1, 0]);
          f(role, [ps[0], below[0], below[1], ps[1]], [-Math.cos(m), 0, -Math.sin(m)]);
          f('wall', [ps[3], ps[2], below[2], below[3]], [Math.cos(m), 0, Math.sin(m)]);
        }
      }
    };

  // Closed floor and retaining ring fully enclose the model-owned excavation.
  const pit = body.map((p) => p.map((v) => v * 0.95)),
    footLo = Math.min(r.fieldY - 1, ...pit.map(grade)) - 1;
  prism(f, 'wall', { outline: pit }, footLo, r.fieldY - 0.2);
  prism(
    f,
    'wall',
    { outline: pit, holes: [pit.map((p) => p.map((v) => v * 0.985))] },
    r.fieldY - 0.2,
    r.concourseY,
  );
  const playing = Array.from({ length: count }, (_, i) =>
    ellipse((i * Math.PI * 2) / count, 75, 38, r.fieldY),
  ).map((p) => [p[0], p[2]]);
  prism(f, 'turf', { outline: playing }, r.fieldY - 0.2, r.fieldY);
  for (const [ti, t] of r.tiers.entries()) {
    const rows = detail === 3 ? [10, 5, 4, 7][ti] : detail === 2 ? [3, 2, 2, 2][ti] : 1;
    for (let j = 0; j < rows; j++)
      ring(
        'seat',
        t.t0 + ((t.t1 - t.t0) * j) / rows,
        t.t0 + ((t.t1 - t.t0) * (j + 1)) / rows,
        detail < 2 ? t.y0 : t.y0 + ((t.y1 - t.y0) * (j + 1)) / rows,
        t.y0 + ((t.y1 - t.y0) * (j + 1)) / rows,
        detail > 1,
      );
    if (detail) ring('wall', t.t1, t.t1 + 0.025, t.y1 - 0.2, t.y1 - 0.2);
    if (detail && ti < 3) {
      const next = r.tiers[ti + 1];
      ring('glass', t.t1 + 0.015, next.t0 - 0.01, t.y1 + 0.5, next.y0 - 0.6);
      ring('wall', t.t1, next.t0, t.y1, t.y1);
    }
  }

  // Closed curved roof skins. Clipping existing earcut triangles to a common grid
  // puts every shared grid/boundary vertex on the same deterministic height surface.
  const skin = (role, outline, holes = []) => {
    const rings = [outline, ...holes],
      flat = rings.flat(),
      hs = [];
    let k = outline.length;
    for (const h of holes) {
      hs.push(k);
      k += h.length;
    }
    const ix = earcut(flat.flat(), hs),
      step = [180, 85, 40, 24][detail];
    for (let i = 0; i < ix.length; i += 3) {
      const tri = ix.slice(i, i + 3).map((k) => flat[k]),
        lo = [0, 1].map((k) => Math.floor(Math.min(...tri.map((p) => p[k])) / step) * step),
        hi = [0, 1].map((k) => Math.max(...tri.map((p) => p[k])));
      for (let x = lo[0]; x < hi[0]; x += step)
        for (let z = lo[1]; z < hi[1]; z += step) {
          let p = tri;
          for (const [a, b, s] of [
            [0, x, 1],
            [0, x + step, -1],
            [1, z, 1],
            [1, z + step, -1],
          ])
            p = clipHalfPlane(p, a, b, s);
          if (p.length < 3) continue;
          const top = p.map(([x, z]) => [x, sofiRoofHeight(x, z), z]),
            bottom = top.map(([x, y, z]) => [x, y - 0.32, z]);
          // Use identical diagonals on both skins of these non-planar panels.
          // Reversing a whole polygon before fan triangulation can otherwise
          // push its lower skin through its upper skin at coarse detail levels.
          for (let j = 1; j < top.length - 1; j++) {
            f(role, [top[0], top[j], top[j + 1]], [0, 1, 0]);
            f(role, [bottom[0], bottom[j], bottom[j + 1]], [0, -1, 0]);
          }
        }
    }
    for (const [j, p] of rings.entries()) {
      const sign =
        Math.sign(
          p.reduce(
            (s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - q[1] * p[(i + 1) % p.length][0],
            0,
          ),
        ) * (j ? -1 : 1);
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          n = [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
          ts = [0, 1];
        for (let axis = 0; axis < 2; axis++)
          for (
            let v = Math.ceil(Math.min(a[axis], b[axis]) / step) * step;
            v < Math.max(a[axis], b[axis]);
            v += step
          ) {
            const t = (v - a[axis]) / (b[axis] - a[axis]);
            if (t > 1e-8 && t < 1 - 1e-8) ts.push(t);
          }
        ts.sort((a, b) => a - b);
        for (let k = 0; k < ts.length - 1; k++) {
          const h = (t) => {
              const q = a.map((v, j) => v + (b[j] - v) * t);
              return [q[0], sofiRoofHeight(...q), q[1]];
            },
            pa = h(ts[k]),
            pb = h(ts[k + 1]);
          f(role, [pa, pb, [pb[0], pb[1] - 0.32, pb[2]], [pa[0], pa[1] - 0.32, pa[2]]], n);
        }
      }
    }
  };
  skin('roof', outer, [inner]);
  skin('panel', inner);

  // Curved fascia, independent ground-contact columns and branched roof bearings.
  const supportCount = [6, 10, 22, 30][detail];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      n = [m[0] - 80, 0, m[1] + 20];
    f(
      'roof',
      [
        [a[0], sofiRoofHeight(...a) - 2, a[1]],
        [b[0], sofiRoofHeight(...b) - 2, b[1]],
        [b[0], sofiRoofHeight(...b), b[1]],
        [a[0], sofiRoofHeight(...a), a[1]],
      ],
      n,
    );
  }
  const perimeter = outer.map((p, i) => ({
      p,
      q: outer[(i + 1) % outer.length],
      length: Math.hypot(
        p[0] - outer[(i + 1) % outer.length][0],
        p[1] - outer[(i + 1) % outer.length][1],
      ),
    })),
    total = perimeter.reduce((s, e) => s + e.length, 0);
  for (let i = 0; i < supportCount; i++) {
    let distance = (total * (i + 0.35)) / supportCount,
      e = perimeter[0];
    for (const p of perimeter) {
      e = p;
      if (distance <= p.length) break;
      distance -= p.length;
    }
    const t = distance / e.length,
      p = e.p.map((n, k) => n + (e.q[k] - n) * t),
      q = p.map((n, k) => n * 0.965 + [80, -20][k] * 0.035),
      y = grade(q) - 0.6,
      head = sofiRoofHeight(...q) - 3.5;
    box(f, 'wall', q[0], y, q[1], detail ? 2.6 : 3.6, head - y, detail ? 2.6 : 3.6);
    if (detail) {
      bar('metal', [q[0], head, q[1]], [p[0], sofiRoofHeight(...p) - 0.32, p[1]], 1.1);
      const inward = q.map((n, k) => n * 0.93 + [80, -20][k] * 0.07);
      bar(
        'metal',
        [q[0], head, q[1]],
        [inward[0], sofiRoofHeight(...inward) - 0.32, inward[1]],
        0.75,
      );
    }
  }
  if (detail) {
    const spacing = [0, 85, 42, 24][detail],
      segment = detail === 3 ? 24 : 42;
    for (let axis = 0; axis < 2; axis++) {
      const lo = Math.ceil(Math.min(...inner.map((p) => p[axis])) / spacing) * spacing,
        hi = Math.max(...inner.map((p) => p[axis]));
      for (let v = lo; v < hi; v += spacing) {
        const hits = [];
        for (let i = 0; i < inner.length; i++) {
          const a = inner[i],
            b = inner[(i + 1) % inner.length];
          if ((a[axis] <= v && b[axis] > v) || (b[axis] <= v && a[axis] > v))
            hits.push(
              a[1 - axis] + ((b[1 - axis] - a[1 - axis]) * (v - a[axis])) / (b[axis] - a[axis]),
            );
        }
        hits.sort((a, b) => a - b);
        for (let i = 0; i + 1 < hits.length; i += 2)
          for (let u = hits[i]; u < hits[i + 1] - 0.001; u += segment) {
            const end = Math.min(u + segment, hits[i + 1]),
              p = axis === 0 ? [v, u] : [u, v],
              q = axis === 0 ? [v, end] : [end, v];
            bar(
              'metal',
              [p[0], sofiRoofHeight(...p) - 0.65, p[1]],
              [q[0], sofiRoofHeight(...q) - 0.65, q[1]],
              detail === 1 ? 0.6 : 0.28,
              0.7,
            );
          }
      }
    }
  }

  // Hollow, double-sided oval board with a bevelled lower edge and actual roof hangers.
  const screenCount = [12, 20, 32, 48][detail];
  for (let i = 0; i < screenCount; i++) {
    const a = (i * Math.PI * 2) / screenCount,
      b = ((i + 1) * Math.PI * 2) / screenCount,
      m = (a + b) / 2,
      oa = ellipse(a, 60, 32, 24),
      ob = ellipse(b, 60, 32, 24),
      ia = ellipse(a, 56, 28, 20),
      ib = ellipse(b, 56, 28, 20),
      up = (p) => [p[0], 35, p[2]];
    f('screen', [oa, ob, up(ob), up(oa)], [Math.cos(m), 0, Math.sin(m)]);
    f('screen', [ia, ib, up(ib), up(ia)], [-Math.cos(m), 0, -Math.sin(m)]);
    f('metal', [up(oa), up(ob), up(ib), up(ia)], [0, 1, 0]);
    f('screen', [oa, ob, ib, ia], [0, -1, 0]);
  }
  if (detail)
    for (let i = 0; i < (detail === 1 ? 4 : 8); i++) {
      const p = ellipse((i * Math.PI * 2) / (detail === 1 ? 4 : 8), 58, 30, 35);
      bar('metal', p, [p[0], sofiRoofHeight(p[0], p[2]) - 0.32, p[2]], 0.16);
    }

  // Native theater exterior under the southern continuation of the same canopy.
  const theater = quietOutline(r.theater, tolerance),
    theaterLo = Math.min(...theater.map(grade)) - 0.6;
  prism(f, 'wall', { outline: theater }, theaterLo, 11);
  const theaterSign = Math.sign(
    theater.reduce(
      (s, p, i) =>
        s +
        p[0] * theater[(i + 1) % theater.length][1] -
        p[1] * theater[(i + 1) % theater.length][0],
      0,
    ),
  );
  if (detail)
    for (let i = 0; i < theater.length; i++) {
      const a = theater[i],
        b = theater[(i + 1) % theater.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz),
        n = [(dz / length) * theaterSign, 0, (-dx / length) * theaterSign],
        point = (t, y, off = 0.04) => [a[0] + dx * t + n[0] * off, y, a[1] + dz * t + n[2] * off];
      f('glass', [point(0.08, 1), point(0.92, 1), point(0.92, 7.5), point(0.08, 7.5)], n);
      if (detail > 1)
        for (let j = 0; j < Math.ceil(length / 4); j++) {
          const t = (j + 0.5) / Math.ceil(length / 4);
          bar('metal', point(t, 0, 0.16), point(t, 10.8, 0.16), 0.2);
        }
    }
  box(f, 'wall', 171, 5.9, -56, 66, 0.6, 38);
  if (detail)
    for (const x of [145, 194])
      for (const z of [-71, -41]) bar('wall', [x, grade([x, z]) - 0.4, z], [x, 5.9, z], 1.2);
  if (detail)
    for (const sign of [-1, 1]) {
      const z = sign * 109,
        steps = detail === 3 ? 10 : detail === 2 ? 6 : 2;
      for (let i = 0; i < steps; i++) {
        const x = -28 + i * 2.2,
          y = (r.concourseY * (i + 1)) / steps;
        box(f, 'wall', x, grade([x, z]) - 0.4, z, 2.25, Math.max(0.2, y - grade([x, z]) + 0.4), 8);
      }
      bar('metal', [-29, 0.5, z - 4.5], [-6, r.concourseY + 0.8, z - 4.5], 0.3);
      bar('metal', [-29, 0.5, z + 4.5], [-6, r.concourseY + 0.8, z + 4.5], 0.3);
    }
  if (detail)
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        b = ((i + 1) * Math.PI * 2) / count,
        p = at(1, a, r.concourseY),
        q = at(1, b, r.concourseY);
      if (detail > 1 || i % 2 === 0)
        bar('wall', [p[0], Math.min(grade([p[0], p[2]]) - 0.5, 0), p[2]], [p[0], 27, p[2]], 0.9);
      for (const y of detail === 1 ? [r.concourseY, 27] : [r.concourseY, 15, 27])
        bar('wall', [p[0], y, p[2]], [q[0], y, q[2]], 1.8, 0.7);
      if (detail > 1 && i % 3 === 0)
        bar('metal', [p[0], r.concourseY, p[2]], [q[0], 26, q[2]], 0.22);
    }
  if (detail) {
    const line = (x, z, w, d) =>
      f(
        'mark',
        [
          [x - w / 2, r.fieldY + 0.025, z - d / 2],
          [x + w / 2, r.fieldY + 0.025, z - d / 2],
          [x + w / 2, r.fieldY + 0.025, z + d / 2],
          [x - w / 2, r.fieldY + 0.025, z + d / 2],
        ],
        [0, 1, 0],
      );
    for (const z of [-24.384, 24.384]) line(0, z, 109.728, 0.16);
    for (let x = -54.864; x <= 54.865; x += 9.144) line(x, 0, 0.16, 48.768);
    if (detail > 1)
      for (let x = -45.72; x < 46; x += 0.9144) for (const z of [-10.5, 10.5]) line(x, z, 0.1, 0.5);
    for (const sign of [-1, 1]) {
      bar('goal', [sign * 59, r.fieldY, 0], [sign * 59, r.fieldY + 3.05, 0], 0.16);
      bar('goal', [sign * 59, r.fieldY + 3.05, 0], [sign * 54.864, r.fieldY + 3.05, 0], 0.16);
      bar(
        'goal',
        [sign * 54.864, r.fieldY + 3.05, -2.82],
        [sign * 54.864, r.fieldY + 3.05, 2.82],
        0.12,
      );
      for (const z of [-2.82, 2.82])
        bar('goal', [sign * 54.864, r.fieldY + 3.05, z], [sign * 54.864, r.fieldY + 8, z], 0.1);
    }
  }
}
