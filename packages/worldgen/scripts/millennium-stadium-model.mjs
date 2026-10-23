/** Mapped Millennium Stadium with an open roof, tapered masts and lower north stand. */
import earcut from 'earcut';
import { beam, cross, normalize } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0711';

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
function clip(poly, axis, bound, sign) {
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
export function millenniumFoundationOutline(r, detail) {
  return quietOutline(r.body, [2.5, 1.4, 0.6, 0.1][detail]).map((p) => p.map((v) => v * 0.99));
}
export function millenniumRadius(poly, center, angle) {
  const d = [Math.cos(angle), Math.sin(angle)],
    hits = [],
    cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i].map((v, k) => v - center[k]),
      q = poly[(i + 1) % poly.length].map((v, k) => v - center[k]),
      v = q.map((n, k) => n - p[k]),
      den = cross2(d, v);
    if (Math.abs(den) < 1e-9) continue;
    const t = cross2(p, v) / den,
      u = cross2(p, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error(`${candidateId}: non-radial stadium outline`);
  return Math.min(...hits);
}
export function millenniumRoofHeight(r, x, z) {
  const a = Math.atan2(z - r.fieldCenter[1], x - r.fieldCenter[0]),
    lo = millenniumRadius(r.roofHole, r.fieldCenter, a),
    hi = millenniumRadius(r.roofPolygons[0].outline, r.fieldCenter, a),
    R = Math.hypot(x - r.fieldCenter[0], z - r.fieldCenter[1]);
  return (
    r.roofInnerY - (r.roofInnerY - r.roofOuterY) * Math.max(0, Math.min(1, (R - lo) / (hi - lo)))
  );
}
export function buildMillenniumStadium(face, detail, r, terrain) {
  const F = r.floorY,
    C = r.fieldCenter,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    adapter = {
      addQuad: (role, _ref, p, n) => f(role, p, n),
      addConvexPolygon: (role, _ref, p, n) => {
        for (let i = 1; i < p.length - 1; i++) f(role, [p[0], p[i], p[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    count = [12, 24, 40, 64][detail],
    tolerance = [2.5, 1.4, 0.6, 0.1][detail],
    roofHeight = (x, z) => millenniumRoofHeight(r, x, z),
    grade = (p) => {
      const q = P([p[0], 0, p[1]]);
      return terrain(q[0], q[2]) - F;
    },
    outer = (a, y, scale = 0.98) => {
      const R = millenniumRadius(r.body, C, a) * scale;
      return [C[0] + R * Math.cos(a), y, C[1] + R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const lo =
          1 /
          Math.pow(
            Math.pow(Math.abs(Math.cos(a)) / 68, 6) + Math.pow(Math.abs(Math.sin(a)) / 44, 6),
            1 / 6,
          ),
        hi = millenniumRadius(r.body, C, a) * 0.98,
        R = lo + (hi - lo) * t;
      return [C[0] + R * Math.cos(a), y, C[1] + R * Math.sin(a)];
    },
    tube = (
      role,
      a,
      b,
      r0,
      r1 = r0,
      sides = detail === 0 ? 4 : detail === 1 ? 4 : detail === 2 ? 6 : 8,
    ) => {
      const axis = normalize(b.map((v, k) => v - a[k])),
        u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
        v = cross(axis, u),
        ring = (p, R) =>
          Array.from({ length: sides }, (_, i) =>
            p.map(
              (n, k) =>
                n +
                R *
                  (u[k] * Math.cos((i * Math.PI * 2) / sides) +
                    v[k] * Math.sin((i * Math.PI * 2) / sides)),
            ),
          ),
        lo = ring(a, r0),
        hi = ring(b, r1);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides,
          n = u.map(
            (n, k) =>
              n * Math.cos(((i + 0.5) * Math.PI * 2) / sides) +
              v[k] * Math.sin(((i + 0.5) * Math.PI * 2) / sides),
          );
        f(role, [lo[i], lo[j], hi[j], hi[i]], n);
      }
      f(
        role,
        lo,
        axis.map((v) => -v),
      );
      f(role, hi, axis);
    },
    band = (role, t0, t1, y0, y1, northGap = false, depth = 0.45) => {
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count,
          m = (a + b) / 2;
        if (northGap && Math.cos(m) < -0.82) continue;
        const p = [at(t0, a, y0), at(t0, b, y0), at(t1, b, y1), at(t1, a, y1)],
          below = p.map(([x, y, z]) => [x, y - depth, z]);
        if (detail > 1 && role === 'seat' && i % 2 === 0) {
          const q = p[0].map((v, k) => v + (p[1][k] - v) * 0.1),
            s = p[3].map((v, k) => v + (p[2][k] - v) * 0.1);
          f('wall', [p[0], q, s, p[3]], [0, 1, 0]);
          f(role, [q, p[1], p[2], s], [0, 1, 0]);
        } else f(role, p, [0, 1, 0]);
        if (detail > 1) {
          f('wall', below, [0, -1, 0]);
          f(role, [p[0], below[0], below[1], p[1]], [-Math.cos(m), 0, -Math.sin(m)]);
          f('wall', [p[3], p[2], below[2], below[3]], [Math.cos(m), 0, Math.sin(m)]);
          if (northGap && Math.cos(((i - 0.5) * Math.PI * 2) / count) < -0.82)
            f('wall', [p[0], p[3], below[3], below[0]], [Math.sin(a), 0, -Math.cos(a)]);
          if (northGap && Math.cos(((i + 1.5) * Math.PI * 2) / count) < -0.82)
            f('wall', [p[1], p[2], below[2], below[1]], [-Math.sin(b), 0, Math.cos(b)]);
        }
      }
    };

  // A closed occupied stadium volume covers the model-owned terrain opening.
  prism(
    f,
    'wall',
    { outline: millenniumFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.6, -0.8),
    0.05,
  );
  box(f, 'turf', C[0], 0.05, C[1], 132, 0.25, 82);
  for (const [ti, t] of r.tiers.entries()) {
    const rows = detail === 3 ? [8, 7, 9][ti] : detail === 2 ? [3, 3, 4][ti] : 1;
    for (let j = 0; j < rows; j++)
      band(
        'seat',
        t.t0 + ((t.t1 - t.t0) * j) / rows,
        t.t0 + ((t.t1 - t.t0) * (j + 1)) / rows,
        detail < 2 ? t.y0 : t.y0 + ((t.y1 - t.y0) * (j + 1)) / rows,
        t.y0 + ((t.y1 - t.y0) * (j + 1)) / rows,
        ti === 2,
        detail > 1 ? (t.y1 - t.y0) / rows + 0.1 : 0.45,
      );
    if (detail > 1 || ti === 0)
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count,
          m = (a + b) / 2;
        if (ti === 2 && Math.cos(m) < -0.82) continue;
        const lo = ti === 0 ? 0.05 : r.tiers[ti - 1].y1;
        f(
          'wall',
          [at(t.t0, a, lo), at(t.t0, b, lo), at(t.t0, b, t.y0), at(t.t0, a, t.y0)],
          [-Math.cos(m), 0, -Math.sin(m)],
        );
      }
    if (detail && ti < 2) {
      const q = r.tiers[ti + 1];
      band('glass', t.t1 + 0.015, q.t0 - 0.01, t.y1 + 0.3, q.y0 - 0.5);
      band('wall', t.t1, q.t0, t.y1, t.y1);
    }
  }
  // The lower Arms Park-facing north stand remains visibly different from the sides.
  box(f, 'wall', -106, 23, -0.2, 1.2, 15, 58);
  if (detail) {
    box(f, 'glass', -105.39, 25.1, -0.2, 0.06, 10.8, 55);
    for (let z = -27; z <= 27; z += detail === 1 ? 18 : 9) {
      bar('metal', [-105, 24, z], [-105, 39, z], 0.22);
      if (detail > 1 && z < 27) bar('metal', [-105, 25, z], [-105, 38, z + 9], 0.14);
    }
  }

  // Use common grid vertices and identical triangle diagonals on both roof skins.
  const skin = (poly) => {
    const rings = [
        quietOutline(poly.outline, tolerance),
        ...poly.holes.map((p) => quietOutline(p, tolerance)),
      ],
      flat = rings.flat(),
      holes = [];
    let k = rings[0].length;
    for (const p of rings.slice(1)) {
      holes.push(k);
      k += p.length;
    }
    const ix = earcut(flat.flat(), holes),
      step = [140, 55, 28, 16][detail],
      isPanel = (x, z) => Math.abs(x - C[0]) > 60 && Math.abs(z - C[1]) < 39;
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
            p = clip(p, a, b, s);
          if (p.length < 3) continue;
          const top = p.map(([x, z]) => [x, roofHeight(x, z), z]),
            bottom = top.map(([x, y, z]) => [x, y - 0.4, z]),
            role = isPanel(
              p.reduce((s, p) => s + p[0], 0) / p.length,
              p.reduce((s, p) => s + p[1], 0) / p.length,
            )
              ? 'panel'
              : 'roof';
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
            (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
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
          const point = (t) => {
              const q = a.map((v, k) => v + (b[k] - v) * t);
              return [q[0], roofHeight(...q), q[1]];
            },
            pa = point(ts[k]),
            pb = point(ts[k + 1]),
            role = isPanel((pa[0] + pb[0]) / 2, (pa[2] + pb[2]) / 2) ? 'panel' : 'roof';
          f(role, [pa, pb, [pb[0], pb[1] - 0.4, pb[2]], [pa[0], pa[1] - 0.4, pa[2]]], n);
        }
      }
    }
  };
  r.roofPolygons.forEach(skin);

  // Dark side roofs sit over blue/red glazed frontage and genuinely open upper bays.
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count,
      m = (a + b) / 2,
      p = outer(a, 0),
      q = outer(b, 0),
      n = [Math.cos(m), 0, Math.sin(m)],
      map = (t, y, depth = 0) => [
        p[0] + (q[0] - p[0]) * t + n[0] * depth,
        y,
        p[2] + (q[2] - p[2]) * t + n[2] * depth,
      ],
      entry = detail && i % Math.max(3, Math.round(count / 6)) === 1;
    const facade = (role, y0, y1) => {
      f(role, [map(0, y0), map(1, y0), map(1, y1), map(0, y1)], n);
    };
    if (entry) {
      for (const [lo, hi] of [
        [0, 0.16],
        [0.84, 1],
      ])
        f('front', [map(lo, 0), map(hi, 0), map(hi, 6.8), map(lo, 6.8)], n);
      f('front', [map(0.16, 4.8), map(0.84, 4.8), map(0.84, 6.8), map(0.16, 6.8)], n);
      f(
        'glass',
        [map(0.16, 0.25, -0.8), map(0.84, 0.25, -0.8), map(0.84, 4.8, -0.8), map(0.16, 4.8, -0.8)],
        n,
      );
      for (const t of [0.16, 0.84])
        f(
          'wall',
          [map(t, 0.25), map(t, 4.8), map(t, 4.8, -0.8), map(t, 0.25, -0.8)],
          t < 0.5 ? [q[0] - p[0], 0, q[2] - p[2]] : [p[0] - q[0], 0, p[2] - q[2]],
        );
      f(
        'wall',
        [map(0.16, 4.8), map(0.84, 4.8), map(0.84, 4.8, -0.8), map(0.16, 4.8, -0.8)],
        [0, -1, 0],
      );
      f(
        'wall',
        [map(0.16, 0.25), map(0.84, 0.25), map(0.84, 0.25, -0.8), map(0.16, 0.25, -0.8)],
        [0, 1, 0],
      );
    } else facade('front', 0, 6.8);
    for (const [role, lo, hi] of [
      ['glass', 6.8, 9.6],
      ['front', 9.6, 13.3],
      ['trim', 13.3, 15],
      ['glass', 15, 21.2],
      ['trim', 21.2, 23],
    ])
      facade(detail ? role : 'front', lo, hi);
    f(
      'wall',
      [map(0, 0, -1), map(1, 0, -1), map(1, 23, -1), map(0, 23, -1)],
      n.map((v) => -v),
    );
    const pRoof = roofHeight(p[0], p[2]),
      qRoof = roofHeight(q[0], q[2]);
    f(
      'front',
      [
        [p[0], pRoof - 1.5, p[2]],
        [q[0], qRoof - 1.5, q[2]],
        [q[0], qRoof, q[2]],
        [p[0], pRoof, p[2]],
      ],
      n,
    );
    if (detail) {
      bar(
        'metal',
        [p[0], Math.min(grade([p[0], p[2]]) - 0.5, 0), p[2]],
        [p[0], pRoof - 0.4, p[2]],
        0.42,
      );
      const holeR = millenniumRadius(r.roofHole, C, a),
        end = [C[0] + holeR * Math.cos(a), 49.4, C[1] + holeR * Math.sin(a)];
      bar('metal', [p[0], pRoof - 0.6, p[2]], end, 0.35, 0.6);
      if (detail > 1 && i % 2 === 0) bar('metal', [p[0], 23, p[2]], [q[0], 39, q[2]], 0.16);
    }
  }

  // Each mapped triangular roof-support projection supplies its own mast/stay frame.
  for (const mast of r.masts) {
    const u = normalize([mast.outer[0] - mast.inner[0], 0, mast.outer[1] - mast.inner[1]]),
      v = [-u[2], 0, u[0]],
      n = detail === 0 ? 2 : 4,
      point = (base, y, across, along) => [
        base[0] + v[0] * across + u[0] * along,
        y,
        base[1] + v[2] * across + u[2] * along,
      ],
      base = ([s, t]) => {
        const p = point(mast.base, 0, s * 3.2, t * 3.8);
        p[1] = Math.min(grade([p[0], p[2]]) - 0.7, 0);
        return p;
      },
      head = ([s, t]) => point(mast.head, 89, s * 0.35, t * 1.25),
      corners =
        detail === 0
          ? [
              [-1, -1],
              [1, 1],
            ]
          : [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ];
    for (const c of corners) tube('metal', base(c), head(c), detail === 0 ? 1.2 : 0.8, 0.28);
    for (const t of [-1, 1])
      tube(
        'metal',
        point(mast.head, 88.9, 0, t * 1.25),
        point(mast.head, r.mastTop, 0, t * 1.25),
        0.48,
        0.02,
      );
    const top = point(mast.head, 88, 0, 0),
      inner = [mast.inner[0], 49.6, mast.inner[1]],
      rear = [mast.outer[0], grade(mast.outer) - 0.35, mast.outer[1]];
    bar('metal', top, inner, detail === 0 ? 1.15 : 0.75);
    bar('metal', top, rear, detail === 0 ? 1.15 : 0.6);
    if (detail) {
      const sections = [0, 1, 5, 9][detail],
        along = (c, t) => base(c).map((v, k) => v + (head(c)[k] - v) * t);
      for (let j = 0; j < sections; j++)
        for (let i = 0; i < n; i++) {
          const a = corners[i],
            b = corners[(i + 1) % n],
            t0 = j / sections,
            t1 = (j + 1) / sections;
          bar('metal', along(a, t0), along(b, t0), 0.17);
          bar('metal', along(a, t0), along(b, t1), 0.14);
          if (detail === 3) bar('metal', along(b, t0), along(a, t1), 0.14);
        }
      for (const dy of [0.55, 1.1])
        bar('metal', [inner[0], 50, inner[2]], [top[0], 86 - dy, top[2]], 0.1);
    }
  }
  if (detail) {
    const x0 = Math.min(...r.roofHole.map((p) => p[0])),
      x1 = Math.max(...r.roofHole.map((p) => p[0])),
      z0 = Math.min(...r.roofHole.map((p) => p[1])),
      z1 = Math.max(...r.roofHole.map((p) => p[1])),
      sections = [0, 2, 8, 18][detail];
    // Two deep triangular longitudinal girders and two end cross-girders frame the opening.
    const girder = (a, b) => {
      const dir = normalize(b.map((v, k) => v - a[k])),
        across = [-dir[2], 0, dir[0]],
        point = (t, y, w = 0) =>
          a.map((v, k) => v + (b[k] - v) * t + (k === 1 ? y : across[k] * w));
      bar('metal', point(0, 6), point(1, 6), 0.4);
      for (const w of [-1.4, 1.4]) bar('metal', point(0, 0, w), point(1, 0, w), 0.4);
      for (let j = 0; j < sections; j++) {
        const t = j / sections,
          q = (j + 1) / sections;
        for (const w of [-1.4, 1.4]) {
          bar('metal', point(t, 0, w), point(q, 6), 0.18);
          bar('metal', point(t, 6), point(q, 0, w), 0.18);
        }
        bar('metal', point(t, 0, -1.4), point(t, 0, 1.4), 0.18);
      }
    };
    for (const z of [z0, z1]) girder([x0, 49.4, z], [x1, 49.4, z]);
    for (const x of [x0, x1]) girder([x, 49.4, z0], [x, 49.4, z1]);
    // The parked panels have readable top lattice and an actual supporting end roof.
    if (detail > 1)
      for (const sign of [-1, 1])
        for (let j = 0; j < 5; j++) {
          const x = sign < 0 ? x0 - 5 - j * 6 : x1 + 5 + j * 6;
          for (let k = 0; k < 8; k++) {
            const z = z0 + ((z1 - z0) * k) / 8,
              w = z0 + ((z1 - z0) * (k + 1)) / 8;
            bar('metal', [x, roofHeight(x, z) + 0.06, z], [x, roofHeight(x, w) + 0.06, w], 0.18);
          }
        }
    // Rounded stair/service cores remain attached within the mapped body.
    for (const x of [-73, 73])
      for (const z of [-77, 77]) {
        const lo = Math.min(grade([x, z]) - 0.4, 0),
          sides = detail === 1 ? 6 : detail === 2 ? 8 : 12,
          outline = Array.from({ length: sides }, (_, i) => [
            x + 3.8 * Math.cos((i * Math.PI * 2) / sides),
            z + 3.8 * Math.sin((i * Math.PI * 2) / sides),
          ]);
        prism(f, 'wall', { outline }, lo, 36);
        if (detail > 1)
          for (const y of detail === 2 ? [18, 35] : [9, 18, 27, 35])
            for (let i = 0; i < sides; i++) {
              const a = outline[i],
                b = outline[(i + 1) % sides];
              bar('metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.12);
            }
      }
    // Neutral fixed end displays, with visible suspension to their end girder.
    for (const [x, girderX] of [
      [x0 + 1.7, x0],
      [x1 - 1.7, x1],
    ]) {
      box(f, 'screen', x, 37, C[1], 0.8, 6, 12);
      for (const z of [C[1] - 4, C[1] + 4]) {
        bar('metal', [x, 43, z], [x, 49.6, z], 0.14);
        bar('metal', [x, 49.5, z], [girderX, 49.5, z], 0.14);
      }
    }
    const line = (x, z, w, d) =>
      f(
        'mark',
        [
          [x - w / 2, 0.325, z - d / 2],
          [x + w / 2, 0.325, z - d / 2],
          [x + w / 2, 0.325, z + d / 2],
          [x - w / 2, 0.325, z + d / 2],
        ],
        [0, 1, 0],
      );
    for (const z of [-35, 35]) line(C[0], C[1] + z, 120, 0.15);
    for (const x of [-60, -50, -28, 0, 28, 50, 60]) line(C[0] + x, C[1], 0.15, 70);
    for (const sign of [-1, 1]) {
      for (const z of [-2.8, 2.8])
        tube('mark', [C[0] + sign * 50, 0.3, C[1] + z], [C[0] + sign * 50, 10.3, C[1] + z], 0.07);
      bar('mark', [C[0] + sign * 50, 3.3, C[1] - 2.8], [C[0] + sign * 50, 3.3, C[1] + 2.8], 0.12);
    }
    // Bounded approach stairs bridge the coarse outer grade to selected entry thresholds.
    for (const sign of [-1, 1]) {
      const z = sign * 104,
        y = grade([0, z]),
        steps = detail === 3 ? 8 : detail === 2 ? 4 : 2;
      for (let i = 0; i < steps; i++) {
        const dz = (i + 0.5) * 0.7,
          t = (i + 1) / steps,
          top = y * (1 - t) + 0.25 * t,
          base = Math.min(y, top) - 0.35;
        box(f, 'wall', C[0], base, z - sign * dz, 14, top - base, 0.75);
      }
    }
  }
}
