/** 'stadion_wankdorf': Wankdorf's rectangular solar canopy, screened base and two-tier bowl. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export const wankdorfDivisions = [1, 3, 8, 16];
export const wankdorfCorners = [
  [-99.5, -80],
  [99.5, -80],
  [99.5, 89.5],
  [-99.5, 89.5],
];
export function wankdorfPoint(side, t, kind = 'outer') {
  const ring =
    kind === 'outer'
      ? wankdorfCorners
      : kind === 'roof'
        ? [
            [-68, -48],
            [68, -48],
            [68, 48],
            [-68, 48],
          ]
        : kind === 'lower'
          ? [
              [-58, -39],
              [58, -39],
              [58, 39],
              [-58, 39],
            ]
          : [
              [-92, -72],
              [92, -72],
              [92, 78],
              [-92, 78],
            ];
  return ring[side].map((v, k) => v * (1 - t) + ring[(side + 1) % 4][k] * t);
}
export function buildWankdorfStadium(face, detail, r) {
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
    sheet = (role, ps, n, back = false) => {
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          n,
        );
        if (back)
          f(
            role,
            ids.map((i) => ps[i]),
            n.map((v) => -v),
          );
      }
    },
    slab = (role, ps, thickness = 0.3) => {
      sheet(role, ps, [0, 1, 0]);
      if (detail)
        sheet(
          role,
          ps.map(([x, y, z]) => [x, y - thickness, z]),
          [0, -1, 0],
        );
      const sign = Math.sign(
        ps.reduce((s, p, i) => s + p[0] * ps[(i + 1) % 4][2] - p[2] * ps[(i + 1) % 4][0], 0),
      );
      for (let i = 0; i < 4; i++) {
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thickness, p[2]], [q[0], q[1] - thickness, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    at = (s, t, y, kind = 'outer') => {
      const p = wankdorfPoint(s, t, kind);
      return [p[0], y, p[1]];
    },
    blend = (s, t, u, y) => {
      const a = wankdorfPoint(s, t, 'lower'),
        b = wankdorfPoint(s, t, 'seat');
      return [a[0] * (1 - u) + b[0] * u, y, a[1] * (1 - u) + b[1] * u];
    },
    count = wankdorfDivisions[detail];
  // The foundation follows the owned map body, including the integrated south base.
  prism(f, 'wall', { outline: r.outer }, Math.min(r.minGround - F - 0.6, -0.6), 0.27);
  box(f, 'turf', 0, 0.27, 0, 110.8, 0.03, 74);
  for (let s = 0; s < 4; s++)
    for (let i = 0; i < count; i++) {
      const t = i / count,
        u = (i + 1) / count,
        mid = (t + u) / 2,
        N = [
          [0, 0, -1],
          [1, 0, 0],
          [0, 0, 1],
          [-1, 0, 0],
        ][s],
        A = at(s, t, 0),
        B = at(s, u, 0),
        ground = r.columnContacts[detail][s * count + i] - F,
        next = r.columnContacts[detail][(s * count + i + 1) % (count * 4)] - F;
      // Clear base frontage and a deeply recessed occupied backing behind the metal screen.
      sheet(
        'wall',
        [
          [A[0] * 0.965, Math.min(ground - 0.3, 0), A[2] * 0.965],
          [B[0] * 0.965, Math.min(next - 0.3, 0), B[2] * 0.965],
          [B[0] * 0.965, 6, B[2] * 0.965],
          [A[0] * 0.965, 6, A[2] * 0.965],
        ],
        N,
      );
      sheet(
        'glass',
        [
          at(s, t, 0.3).map((v, k) => (k === 1 ? v : v * 0.97)),
          at(s, u, 0.3).map((v, k) => (k === 1 ? v : v * 0.97)),
          at(s, u, 5.8).map((v, k) => (k === 1 ? v : v * 0.97)),
          at(s, t, 5.8).map((v, k) => (k === 1 ? v : v * 0.97)),
        ],
        N,
      );
      sheet(
        'wall',
        [
          at(s, t, 6).map((v, k) => (k === 1 ? v : v * 0.965)),
          at(s, u, 6).map((v, k) => (k === 1 ? v : v * 0.965)),
          at(s, u, 24).map((v, k) => (k === 1 ? v : v * 0.965)),
          at(s, t, 24).map((v, k) => (k === 1 ? v : v * 0.965)),
        ],
        N,
        true,
      );
      sheet(
        detail ? 'screen' : 'wall',
        [at(s, t, 6), at(s, u, 6), at(s, u, 25), at(s, t, 25)],
        N,
        !!detail,
      );
      if (detail) {
        bar('metal', at(s, t, 5.9), at(s, u, 5.9), 0.35, 0.7);
        bar('metal', at(s, t, 24.9), at(s, u, 24.9), 0.25);
        bar('metal', at(s, t, 6), at(s, t, 25), detail > 1 ? 0.18 : 0.3);
      }
      const rows = detail > 1 ? [1, 2, 3, 4, 5, 6, 7, 8] : [1];
      // Closed wing-shaped roof; transparent inner eight-metre strip has its own image-free material.
      const roof = (t, v, y) => {
          const a = wankdorfPoint(s, t, 'roof'),
            b = wankdorfPoint(s, t);
          return [a[0] * (1 - v) + b[0] * v, y, a[1] * (1 - v) + b[1] * v];
        },
        split = 0.25,
        top = (_v) => 30.4,
        bottom = (v) => 30.15 - 3.3 * Math.sin(Math.PI * v);
      for (const [lo, hi] of [
        [0, split],
        [split, 0.65],
        [0.65, 1],
      ]) {
        const ps = [
          roof(t, lo, top(lo)),
          roof(u, lo, top(lo)),
          roof(u, hi, top(hi)),
          roof(t, hi, top(hi)),
        ];
        if (hi === split) sheet(detail ? 'clearGlass' : 'glass', ps, [0, 1, 0]);
        else {
          sheet('roof', ps, [0, 1, 0]);
          if (detail)
            sheet(
              'roof',
              [
                roof(t, lo, bottom(lo)),
                roof(u, lo, bottom(lo)),
                roof(u, hi, bottom(hi)),
                roof(t, hi, bottom(hi)),
              ],
              [0, -1, 0],
            );
        }
      }
      sheet(
        'roof',
        [roof(t, 1, bottom(1)), roof(u, 1, bottom(1)), roof(u, 1, top(1)), roof(t, 1, top(1))],
        N,
      );
      sheet(
        'roof',
        [
          roof(t, split, bottom(split)),
          roof(u, split, bottom(split)),
          roof(u, split, top(split)),
          roof(t, split, top(split)),
        ],
        N.map((v) => -v),
      );
      // Flat blue-grey solar fields are partitioned across the opaque upper wing, never a photo atlas.
      if (detail)
        for (const j of rows) {
          const a = t + (u - t) * 0.03,
            b = u - (u - t) * 0.03,
            lo = 0.29 + ((j - 1) / rows.length) * 0.64,
            hi = 0.29 + (j / rows.length) * 0.64 - 0.008,
            y = (v) => top(v) + 0.055;
          sheet(
            'solar',
            [roof(a, lo, y(lo)), roof(b, lo, y(lo)), roof(b, hi, y(hi)), roof(a, hi, y(hi))],
            [0, 1, 0],
          );
        }
      if (!detail)
        sheet(
          'solar',
          [
            roof(t, 0.29, top(0.29) + 0.055),
            roof(u, 0.29, top(0.29) + 0.055),
            roof(u, 0.94, top(0.94) + 0.055),
            roof(t, 0.94, top(0.94) + 0.055),
          ],
          [0, 1, 0],
        );
      const upperSouth = s === 2,
        tiers = [
          { lo: 0, hi: 0.46, low: 1.5, high: 11.2 },
          { lo: upperSouth ? 0.72 : 0.58, hi: 0.97, low: upperSouth ? 22.3 : 15.2, high: 26 },
        ],
        nrows = detail === 3 ? [18, 18] : detail === 2 ? [8, 8] : [1, 1];
      for (let k = 0; k < 2; k++) {
        const tier = tiers[k];
        for (let j = 0; j < nrows[k]; j++) {
          const lo = tier.lo + ((tier.hi - tier.lo) * j) / nrows[k],
            hi = tier.lo + ((tier.hi - tier.lo) * (j + 1)) / nrows[k],
            y = tier.low + ((tier.high - tier.low) * (j + 1)) / nrows[k],
            front = detail > 1 ? y : tier.low,
            role = detail > 1 && i % 4 === 0 ? 'wall' : 'seat';
          slab(
            role,
            [
              blend(s, t, lo, front),
              blend(s, u, lo, front),
              blend(s, u, hi, y),
              blend(s, t, hi, y),
            ],
            detail > 1 ? (tier.high - tier.low) / nrows[k] + 0.12 : 0.4,
          );
          if (detail === 3 && j % 2 === 0) {
            const p = blend(s, mid, (lo + hi) / 2, y + 0.24),
              T = [B[0] - A[0], 0, B[2] - A[2]],
              L = Math.hypot(T[0], T[2]),
              d = [T[0] / L, 0, T[2] / L];
            bar(
              'seat',
              [p[0] - d[0] * (L * 0.37), p[1], p[2] - d[2] * (L * 0.37)],
              [p[0] + d[0] * (L * 0.37), p[1], p[2] + d[2] * (L * 0.37)],
              0.42,
              0.22,
            );
          }
        }
      }
      // Mid-bowl concourse belt and the distinctive glazed south hospitality projection.
      const belt = upperSouth ? 0.51 : 0.5,
        low = 11.2,
        high = upperSouth ? 21.9 : 15.2;
      sheet(
        upperSouth ? 'glass' : 'wall',
        [
          blend(s, t, belt, low),
          blend(s, u, belt, low),
          blend(s, u, belt, high),
          blend(s, t, belt, high),
        ],
        N.map((v) => -v),
      );
      slab(
        'wall',
        [
          blend(s, t, 0.46, 11.2),
          blend(s, u, 0.46, 11.2),
          blend(s, u, 0.6, 11.2),
          blend(s, t, 0.6, 11.2),
        ],
        0.35,
      );
      if (detail > 1 && i % 4 === 2) {
        const a = mid - 0.012,
          b = mid + 0.012;
        sheet(
          'accent',
          [
            blend(s, a, belt - 0.002, 11.3),
            blend(s, b, belt - 0.002, 11.3),
            blend(s, b, belt - 0.002, 13.3),
            blend(s, a, belt - 0.002, 13.3),
          ],
          N.map((v) => -v),
        );
      }
      if (upperSouth)
        slab(
          'wall',
          [
            blend(s, t, 0.5, 22),
            blend(s, u, 0.5, 22),
            blend(s, u, 0.78, 22),
            blend(s, t, 0.78, 22),
          ],
          0.5,
        );
      if (detail) {
        const support = at(s, t, 0).map((v, k) => (k === 1 ? v : v * 0.94)),
          foot = r.columnContacts[detail][s * count + i] - F;
        bar(
          'metal',
          [support[0], Math.min(foot - 0.4, 0), support[2]],
          [support[0], 30.4, support[2]],
          detail > 1 ? 0.65 : 0.9,
        );
        const inner = roof(t, 0, 30.4),
          back = [support[0], 27.1, support[2]];
        bar('metal', back, inner, 0.35);
        bar('metal', [support[0], 30.4, support[2]], inner, 0.25);
        if (detail > 1) {
          const ends = [back, inner],
            steps = detail === 3 ? 4 : 2;
          for (let j = 0; j < steps; j++) {
            const v = j / steps,
              w = (j + 1) / steps,
              lerp = (q) => ends[0].map((a, k) => a * (1 - q) + ends[1][k] * q),
              p = lerp(v),
              q = lerp(w);
            bar('metal', p, [q[0], 30.4, q[2]], 0.16);
          }
          bar('metal', roof(t, split, top(split)), roof(u, split, top(split)), 0.14);
          const light = roof(mid, 0, 30.1);
          box(
            f,
            'mark',
            light[0],
            light[1] - 0.35,
            light[2],
            s % 2 ? 1.1 : 3,
            0.3,
            s % 2 ? 3 : 1.1,
          );
        }
      }
    }
  // Simple volume of the small photographed service cabin above the south roof margin.
  if (detail) {
    box(f, 'wall', -43, 31, 74, 12, 3.7, 7);
    box(f, 'glass', -43, 32, 77.55, 9, 1.6, 0.12);
  }
  if (detail > 1) {
    for (const z of [-34, 34]) box(f, 'mark', 0, 0.305, z, 105, 0.018, 0.12);
    for (const x of [-52.5, 0, 52.5]) box(f, 'mark', x, 0.305, 0, 0.12, 0.018, 68);
    const circle = detail === 3 ? 32 : 16;
    for (let i = 0; i < circle; i++) {
      const a = (i * Math.PI * 2) / circle,
        b = ((i + 1) * Math.PI * 2) / circle;
      bar(
        'mark',
        [9.15 * Math.cos(a), 0.32, 9.15 * Math.sin(a)],
        [9.15 * Math.cos(b), 0.32, 9.15 * Math.sin(b)],
        0.09,
      );
    }
    for (const x of [-52.5, 52.5]) {
      const sign = Math.sign(x),
        z = 0;
      for (const dz of [-3.66, 3.66]) bar('mark', [x, 0.3, z + dz], [x, 2.74, z + dz], 0.11);
      bar('mark', [x, 2.74, z - 3.66], [x, 2.74, z + 3.66], 0.11);
      for (const dz of [-3.66, 3.66]) {
        bar('metal', [x, 0.3, z + dz], [x + sign * 1.7, 0.3, z + dz], 0.08);
        bar('metal', [x, 2.74, z + dz], [x + sign * 1.7, 0.3, z + dz], 0.06);
      }
    }
    for (const x of [-84, 84]) {
      box(f, 'display', x, 23.5, 0, 0.45, 4.3, 8);
      for (const z of [-3, 3]) bar('metal', [x, 27.8, z], [x, 30.4, z], 0.15);
    }
    for (const s of [0, 2]) {
      const z = s === 0 ? -78.4 : 87.8,
        sgn = s === 0 ? -1 : 1,
        width = 22,
        steps = detail === 3 ? 16 : 5;
      for (let j = 0; j < steps; j++)
        box(f, 'wall', 0, 0.27 + (j * 5.4) / steps, z - sgn * j * 0.45, width, 5.4 / steps, 1.1);
      for (const x of [-width / 2, width / 2])
        bar('metal', [x, 1.3, z], [x, 7, z - sgn * (steps - 1) * 0.45], 0.12);
    }
  }
}
