/** N0713: one western canopy, green arch girder and four rounded baobab ramp cores. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0713';
export function mokabaRadius(poly, angle) {
  const d = [Math.cos(angle), Math.sin(angle)],
    cross = (a, b) => a[0] * b[1] - a[1] * b[0],
    hits = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      v = poly[(i + 1) % poly.length].map((n, k) => n - a[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(a, v) / den,
      u = cross(a, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error(`${candidateId}: missing mapped radial boundary`);
  return Math.min(...hits);
}
export function mokabaFoundationOutline(r, detail) {
  const n = [12, 32, 48, 64][detail];
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      R = mokabaRadius(r.outer, a) * 0.985;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function mokabaRoofPoint(r, x, t) {
  const hits = [];
  for (let i = 0; i < r.outer.length; i++) {
    const p = r.outer[i],
      q = r.outer[(i + 1) % r.outer.length];
    if (((p[0] <= x && q[0] >= x) || (q[0] <= x && p[0] >= x)) && Math.abs(q[0] - p[0]) > 1e-8)
      hits.push(p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]));
  }
  const back = Math.min(...hits) * 0.97,
    front = -55 + 3 * Math.pow(x / r.canopyHalf, 2),
    y = 37 + 3 * Math.cos(((x / r.canopyHalf) * Math.PI) / 2) + t * 1.4;
  return [x, y, back * (1 - t) + front * t];
}
export function buildMokabaStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    tau = Math.PI * 2,
    count = [12, 32, 48, 64][detail],
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => {
      if (Math.hypot(...a.map((v, k) => v - b[k])) > 0.01)
        beam(adapter, role, a, b, w, d, [1, 1, 1]);
    },
    radial = (poly, a, y, s = 1) => {
      const R = mokabaRadius(poly, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = mokabaRadius(r.inner, a) * (1 - t) + mokabaRadius(r.outer, a) * 0.77 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    };
  prism(f, 'wall', { outline: mokabaFoundationOutline(r, detail) }, r.minGround - F - 0.4, 0.27);
  const turf = Array.from({ length: count }, (_, i) => {
    const a = (i * tau) / count,
      p = radial(r.inner, a, 0);
    return [p[0], p[2]];
  });
  prism(f, 'turf', { outline: turf }, 0.27, 0.3);
  const rows = detail === 3 ? [16, 20] : detail === 2 ? [6, 8] : [1, 1];
  for (const [ti, tier] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < count; i++) {
        const a = (i * tau) / count,
          b = ((i + 1) * tau) / count,
          m = (a + b) / 2,
          t0 = tier.t0 + ((tier.t1 - tier.t0) * row) / rows[ti],
          t1 = tier.t0 + ((tier.t1 - tier.t0) * (row + 1)) / rows[ti],
          y1 = tier.y0 + ((tier.y1 - tier.y0) * (row + 1)) / rows[ti],
          y0 = detail < 2 ? tier.y0 + ((tier.y1 - tier.y0) * row) / rows[ti] : y1,
          base =
            row === 0
              ? ti === 0
                ? 0.27
                : 12.8
              : tier.y0 + ((tier.y1 - tier.y0) * row) / rows[ti] - 0.05,
          lo = [at(t0, a, y0), at(t0, b, y0)],
          hi = [at(t1, a, y1), at(t1, b, y1)],
          ps = [lo[0], lo[1], hi[1], hi[0]],
          seat = i % 7 < 2 ? 'seatDark' : i % 5 < 2 ? 'seatSand' : 'seat';
        if (detail > 1 && i % 2 === 0) {
          const p = ps[0].map((v, k) => v + (ps[1][k] - v) * 0.1),
            q = ps[3].map((v, k) => v + (ps[2][k] - v) * 0.1);
          f('wall', [ps[0], p, q, ps[3]], [0, 1, 0]);
          f(seat, [p, ps[1], ps[2], q], [0, 1, 0]);
        } else f(seat, ps, [0, 1, 0]);
        f(
          'wall',
          [lo[0], lo[1], [lo[1][0], base, lo[1][2]], [lo[0][0], base, lo[0][2]]],
          [-Math.cos(m), 0, -Math.sin(m)],
        );
        if (row === rows[ti] - 1)
          f(
            'wall',
            [hi[0], hi[1], [hi[1][0], tier.y0 - 1, hi[1][2]], [hi[0][0], tier.y0 - 1, hi[0][2]]],
            [Math.cos(m), 0, Math.sin(m)],
          );
      }
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count,
      b = ((i + 1) * tau) / count,
      m = (a + b) / 2,
      n = [Math.cos(m), 0, Math.sin(m)],
      pa = radial(r.outer, a, 0, 0.975),
      pb = radial(r.outer, b, 0, 0.975),
      baseMap = (u, y, depth = 0) => [
        pa[0] + (pb[0] - pa[0]) * u + n[0] * depth,
        y,
        pa[2] + (pb[2] - pa[2]) * u + n[2] * depth,
      ],
      portal = detail && i % 4 === 0;
    f(
      'wall',
      [at(0.39, a, 12.6), at(0.39, b, 12.6), at(0.48, b, 12.6), at(0.48, a, 12.6)],
      [0, 1, 0],
    );
    f(
      'glass',
      [at(0.455, a, 12.8), at(0.455, b, 12.8), at(0.455, b, 15.3), at(0.455, a, 15.3)],
      n.map((v) => -v),
    );
    // The rounded circulation cores replace their own facade sectors, rather than
    // leaving a straight service wall across the open ramp bays.
    let spans = [[0, 1]];
    const dx = pb[0] - pa[0],
      dz = pb[2] - pa[2],
      A = dx * dx + dz * dz;
    for (const core of r.cores) {
      const x = pa[0] - core.center[0],
        z = pa[2] - core.center[1],
        B = 2 * (x * dx + z * dz),
        C = x * x + z * z - 15.1 * 15.1,
        disc = B * B - 4 * A * C;
      if (disc <= 0) continue;
      const lo = (-B - Math.sqrt(disc)) / (2 * A),
        hi = (-B + Math.sqrt(disc)) / (2 * A);
      spans = spans.flatMap(([a, b]) =>
        hi <= a || lo >= b
          ? [[a, b]]
          : [
              [a, Math.max(a, lo)],
              [Math.min(b, hi), b],
            ].filter(([a, b]) => b - a > 0.0001),
      );
    }
    for (const [lo, hi] of spans) {
      const map = (u, y, d = 0) => baseMap(lo + (hi - lo) * u, y, d);
      if (detail === 0) f('wall', [map(0, 0.27), map(1, 0.27), map(1, 19.5), map(0, 19.5)], n);
      else {
        for (const [lo, hi] of [
          [0.3, 3.8],
          [7, 7.6],
          [14, 14.6],
          [20.7, 21.3],
        ])
          f('wall', [map(0, lo), map(1, lo), map(1, hi), map(0, hi)], n);
        for (const u of [0, 0.92])
          f('wall', [map(u, 3.8), map(u + 0.08, 3.8), map(u + 0.08, 21.3), map(u, 21.3)], n);
        // Quiet closed service backs leave the column bays visually recessed.
        f(
          Math.sin(m) < -0.6 ? 'glass' : 'service',
          [
            map(0.08, 3.8, -0.7),
            map(0.92, 3.8, -0.7),
            map(0.92, 20.7, -0.7),
            map(0.08, 20.7, -0.7),
          ],
          n,
        );
        if (portal)
          f(
            'glass',
            [map(0.3, 0.35, 0.03), map(0.7, 0.35, 0.03), map(0.7, 3.6, 0.03), map(0.3, 3.6, 0.03)],
            n,
          );
      }
    }
  }
  // Four concrete circulation trunks: open helical ramp ribbons wrap a closed upper core.
  for (const core of r.cores) {
    const [cx, cz] = core.center,
      base = core.groundY - F + 0.08,
      N = [6, 8, 16, 24][detail],
      ring = (R, y) =>
        Array.from({ length: N }, (_, i) => [
          cx + R * Math.cos((i * tau) / N),
          y,
          cz + R * Math.sin((i * tau) / N),
        ]),
      poly = (R) => ({ outline: ring(R, 0).map((p) => [p[0], p[2]]) });
    prism(f, 'wall', poly(14.6), base - 0.5, base + 0.3);
    if (detail === 0) {
      const profile = [
        [base + 0.3, 14.1],
        [18.5, 14.1],
        [22.3, 8],
        [31.4, 8],
      ];
      for (let j = 0; j < profile.length - 1; j++)
        for (let i = 0; i < N; i++) {
          const a = ring(profile[j][1], profile[j][0]),
            b = ring(profile[j + 1][1], profile[j + 1][0]),
            k = (i + 1) % N;
          f(
            'wall',
            [a[i], a[k], b[k], b[i]],
            [Math.cos(((i + 0.5) * tau) / N), 0, Math.sin(((i + 0.5) * tau) / N)],
          );
        }
      f('wall', ring(8, 31.4), [0, 1, 0]);
    } else {
      prism(f, 'wall', poly(7.8), base + 0.3, 31.4);
      const turns = detail === 1 ? 2 : detail === 2 ? 3 : 4,
        steps = (detail === 1 ? 8 : detail === 2 ? 16 : 28) * turns,
        end = 22.3;
      for (let j = 0; j < steps; j++) {
        const a = (j * tau * turns) / steps,
          b = ((j + 1) * tau * turns) / steps,
          ya = base + 0.3 + ((end - base - 0.3) * j) / steps,
          yb = base + 0.3 + ((end - base - 0.3) * (j + 1)) / steps,
          p = (R, a, y) => [cx + R * Math.cos(a), y, cz + R * Math.sin(a)],
          ps = [p(8.8, a, ya), p(8.8, b, yb), p(14.2, b, yb), p(14.2, a, ya)],
          low = ps.map(([x, y, z]) => [x, y - 0.32, z]);
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          f(
            'wall',
            ids.map((k) => ps[k]),
            [0, 1, 0],
          );
          f(
            'wall',
            ids.map((k) => low[k]),
            [0, -1, 0],
          );
        }
        f(
          'wall',
          [ps[2], ps[3], low[3], low[2]],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
        f(
          'wall',
          [ps[0], low[0], low[1], ps[1]],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
        f(
          'wall',
          [ps[2], ps[3], p(14.2, a, ya + 0.85), p(14.2, b, yb + 0.85)],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
        f(
          'wall',
          [
            p(13.95, a, ya + 0.85),
            p(13.95, b, yb + 0.85),
            p(14.2, b, yb + 0.85),
            p(14.2, a, ya + 0.85),
          ],
          [0, 1, 0],
        );
        f(
          'wall',
          [p(13.95, a, ya), p(13.95, b, yb), p(13.95, b, yb + 0.85), p(13.95, a, ya + 0.85)],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
        if (j === 0) {
          f('wall', [ps[0], ps[3], low[3], low[0]], [-Math.sin(a), 0, Math.cos(a)]);
          f(
            'wall',
            [p(13.95, a, ya), p(14.2, a, ya), p(14.2, a, ya + 0.85), p(13.95, a, ya + 0.85)],
            [-Math.sin(a), 0, Math.cos(a)],
          );
        }
        if (j === steps - 1) {
          f('wall', [ps[1], ps[2], low[2], low[1]], [Math.sin(b), 0, -Math.cos(b)]);
          f(
            'wall',
            [p(13.95, b, yb), p(14.2, b, yb), p(14.2, b, yb + 0.85), p(13.95, b, yb + 0.85)],
            [Math.sin(b), 0, -Math.cos(b)],
          );
        }
      }
      for (let i = 0; i < N; i++) {
        const a = (i * tau) / N,
          x = cx + 12.8 * Math.cos(a),
          z = cz + 12.8 * Math.sin(a);
        bar('wall', [x, base + 0.3, z], [x, 21.8, z], 0.7);
      }
    }
    // White branches meet only the actual western canopy; eastern cores remain roofless.
    if (cz < 0)
      for (const t of [0, 1]) {
        const roof = mokabaRoofPoint(r, Math.sign(cx) * r.canopyHalf, t);
        bar('metal', [cx, 30.9, cz], [roof[0], roof[1] - 0.3, roof[2]], detail ? 0.65 : 1.15);
        if (detail > 1)
          bar(
            'metal',
            [cx + Math.sign(cx) * 3, 28.8, cz],
            [roof[0] - Math.sign(cx) * 8, roof[1] - 0.5, roof[2]],
            0.42,
          );
      }
  }
  // One western canopy, closed matching skins; the three other stands stay open to the sky.
  const roofSteps = [4, 8, 24, 40][detail],
    lanes = detail ? 3 : 1;
  for (let i = 0; i < roofSteps; i++)
    for (let j = 0; j < lanes; j++) {
      const xa = -r.canopyHalf + (2 * r.canopyHalf * i) / roofSteps,
        xb = -r.canopyHalf + (2 * r.canopyHalf * (i + 1)) / roofSteps,
        t0 = j / lanes,
        t1 = (j + 1) / lanes,
        ps = [
          mokabaRoofPoint(r, xa, t0),
          mokabaRoofPoint(r, xb, t0),
          mokabaRoofPoint(r, xb, t1),
          mokabaRoofPoint(r, xa, t1),
        ],
        low = ps.map(([x, y, z]) => [x, y - 0.32, z]);
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          'roof',
          ids.map((k) => ps[k]),
          [0, 1, 0],
        );
        f(
          'roof',
          ids.map((k) => low[k]),
          [0, -1, 0],
        );
      }
      for (const [a, b, n, keep] of [
        [0, 1, [0, 0, -1], j === 0],
        [2, 3, [0, 0, 1], j === lanes - 1],
        [0, 3, [-1, 0, 0], i === 0],
        [1, 2, [1, 0, 0], i === roofSteps - 1],
      ])
        if (keep) f('metal', [ps[a], ps[b], low[b], low[a]], n);
    }
  const archSteps = [4, 8, 20, 32][detail],
    arch = (x, top) => {
      const p = mokabaRoofPoint(r, x, 1);
      return [
        x,
        p[1] + 0.1 + (top ? 1 + 10 * Math.cos(((x / r.canopyHalf) * Math.PI) / 2) : 0),
        p[2],
      ];
    };
  for (let i = 0; i < archSteps; i++) {
    const a = -r.canopyHalf + (2 * r.canopyHalf * i) / archSteps,
      b = -r.canopyHalf + (2 * r.canopyHalf * (i + 1)) / archSteps;
    bar('green', arch(a, false), arch(b, false), detail ? 0.55 : 1.1);
    bar('green', arch(a, true), arch(b, true), detail ? 0.55 : 1.1);
    if (detail) bar('green', arch(a, false), arch(b, true), 0.36);
    if (detail > 1) bar('green', arch(a, true), arch(b, false), 0.3);
    if (detail) bar('green', arch(a, false), arch(a, true), 0.3);
  }
  if (detail)
    for (let i = 0; i <= roofSteps; i++) {
      const x = -r.canopyHalf + (2 * r.canopyHalf * i) / roofSteps,
        a = mokabaRoofPoint(r, x, 0),
        b = mokabaRoofPoint(r, x, 1);
      bar(
        'metal',
        a.map((v, k) => (k === 1 ? v - 0.85 : v)),
        b.map((v, k) => (k === 1 ? v - 0.85 : v)),
        0.45,
        0.7,
      );
      if (detail > 1)
        for (const t of [0.33, 0.66]) {
          const p = mokabaRoofPoint(r, x, t),
            q = mokabaRoofPoint(r, Math.min(r.canopyHalf, x + (2 * r.canopyHalf) / roofSteps), t);
          bar(
            'metal',
            p.map((v, k) => (k === 1 ? v - 0.75 : v)),
            q.map((v, k) => (k === 1 ? v - 0.75 : v)),
            0.24,
          );
        }
    }
  // End screens and lighting frames stand on the uncovered bowl, with no invented roof hangers.
  for (const sign of [-1, 1]) {
    const R = mokabaRadius(r.outer, sign > 0 ? 0 : Math.PI) * 0.74,
      x = sign * R;
    box(f, 'screen', x, 27, 0, 0.7, 6, 14);
    for (const z of [-5, 5]) bar('metal', [x, 23, z], [x, 33, z], detail ? 0.45 : 1);
  }
  if (detail > 1)
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.1 + (i * Math.PI * 1.2) / 9;
      if (Math.sin(a) < -0.3) continue;
      const p = at(0.96, a, 27.5),
        q = [p[0], 32, p[2]];
      bar('metal', p, q, 0.3);
      box(f, 'mark', q[0], 31.6, q[2], 2.4, 1.4, 0.45);
    }
  if (detail) {
    const paint = (x, z, w, d) =>
      f(
        'mark',
        [
          [x - w / 2, 0.315, z - d / 2],
          [x + w / 2, 0.315, z - d / 2],
          [x + w / 2, 0.315, z + d / 2],
          [x - w / 2, 0.315, z + d / 2],
        ],
        [0, 1, 0],
      );
    for (const z of [-34, 34]) paint(0, z, 105, 0.14);
    for (const x of [-52.5, 0, 52.5]) paint(x, 0, 0.14, 68);
    for (const sign of [-1, 1]) {
      for (const [d, w] of [
        [16.5, 40.32],
        [5.5, 18.32],
      ]) {
        paint(sign * (52.5 - d), 0, 0.14, w);
        for (const z of [-w / 2, w / 2]) paint(sign * (52.5 - d / 2), z, d, 0.14);
      }
      for (const z of [-3.66, 3.66])
        bar('mark', [sign * 52.5, 0.32, z], [sign * 52.5, 2.76, z], 0.1);
      bar('mark', [sign * 52.5, 2.76, -3.66], [sign * 52.5, 2.76, 3.66], 0.1);
    }
    const n = detail === 1 ? 12 : 32;
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n;
      f(
        'mark',
        [
          [9.08 * Math.cos(a), 0.315, 9.08 * Math.sin(a)],
          [9.08 * Math.cos(b), 0.315, 9.08 * Math.sin(b)],
          [9.22 * Math.cos(b), 0.315, 9.22 * Math.sin(b)],
          [9.22 * Math.cos(a), 0.315, 9.22 * Math.sin(a)],
        ],
        [0, 1, 0],
      );
    }
  }
}
