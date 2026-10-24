/** castelao: mapped Castelão membrane ring, exterior lattice fins and two pale seating tiers. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'castelao';
export function castelaoRadius(poly, angle) {
  const d = [Math.cos(angle), Math.sin(angle)],
    cross = (a, b) => a[0] * b[1] - a[1] * b[0],
    hits = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      v = b.map((n, k) => n - a[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(a, v) / den,
      u = cross(a, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error(`${candidateId}: outline is not radial at ${angle}`);
  return Math.min(...hits);
}
export function castelaoFoundationOutline(r, detail) {
  return Array.from({ length: [16, 32, 48, 64][detail] }, (_, i) => {
    const a = (i * Math.PI * 2) / [16, 32, 48, 64][detail],
      R = castelaoRadius(r.outer, a) * 0.985;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function buildCastelaoStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    count = [16, 32, 48, 64][detail],
    tau = Math.PI * 2,
    point = (R, a, y) => [R * Math.cos(a), y, R * Math.sin(a)],
    outside = (a, y, scale = 1) => point(castelaoRadius(r.outer, a) * scale, a, y),
    opening = (a, y) => point(castelaoRadius(r.roofInner, a), a, y),
    at = (t, a, y) =>
      point(castelaoRadius(r.inner, a) * (1 - t) + castelaoRadius(r.outer, a) * 0.94 * t, a, y),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]);
  const floor = castelaoFoundationOutline(r, detail);
  prism(f, 'wall', { outline: floor }, r.minGround - F - 0.4, 0.27);
  const turf = Array.from({ length: count }, (_, i) => {
    const a = (i * tau) / count,
      R = castelaoRadius(r.inner, a);
    return [R * Math.cos(a), R * Math.sin(a)];
  });
  prism(f, 'turf', { outline: turf }, 0.27, 0.3);
  // Continuous concrete risers, tier fronts and closed concourse belts.
  const rows = detail === 3 ? [14, 18] : detail === 2 ? [6, 8] : [1, 1];
  for (const [ti, t] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++) {
      const t0 = t.t0 + ((t.t1 - t.t0) * row) / rows[ti],
        t1 = t.t0 + ((t.t1 - t.t0) * (row + 1)) / rows[ti],
        y0 =
          detail < 2
            ? t.y0 + ((t.y1 - t.y0) * row) / rows[ti]
            : t.y0 + ((t.y1 - t.y0) * (row + 1)) / rows[ti],
        y1 = t.y0 + ((t.y1 - t.y0) * (row + 1)) / rows[ti],
        base =
          row === 0 ? (ti === 0 ? 0.27 : 11.5) : t.y0 + ((t.y1 - t.y0) * row) / rows[ti] - 0.06;
      for (let i = 0; i < count; i++) {
        const a = (i * tau) / count,
          b = ((i + 1) * tau) / count,
          m = (a + b) / 2,
          lo = [at(t0, a, y0), at(t0, b, y0)],
          hi = [at(t1, a, y1), at(t1, b, y1)],
          ps = [lo[0], lo[1], hi[1], hi[0]],
          seat = ti === 0 && Math.abs(Math.sin(m)) > 0.65 ? 'seatGreen' : 'seat';
        if (detail > 1 && i % 2 === 0) {
          const p = ps[0].map((v, k) => v + (ps[1][k] - v) * 0.09),
            q = ps[3].map((v, k) => v + (ps[2][k] - v) * 0.09);
          f('wall', [ps[0], p, q, ps[3]], [0, 1, 0]);
          f(seat, [p, ps[1], ps[2], q], [0, 1, 0]);
        } else f(seat, ps, [0, 1, 0]);
        f(
          'wall',
          [
            lo[0],
            lo[1],
            lo[1].map((v, k) => (k === 1 ? base : v)),
            lo[0].map((v, k) => (k === 1 ? base : v)),
          ],
          [-Math.cos(m), 0, -Math.sin(m)],
        );
        if (detail > 1 && row === rows[ti] - 1)
          f(
            'wall',
            [
              hi[0],
              hi[1],
              hi[1].map((v, k) => (k === 1 ? t.y0 - 1 : v)),
              hi[0].map((v, k) => (k === 1 ? t.y0 - 1 : v)),
            ],
            [Math.cos(m), 0, Math.sin(m)],
          );
      }
    }
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count,
      b = ((i + 1) * tau) / count,
      m = (a + b) / 2,
      n = [Math.cos(m), 0, Math.sin(m)];
    f(
      'wall',
      [at(0.39, a, 11.5), at(0.39, b, 11.5), at(0.48, b, 11.5), at(0.48, a, 11.5)],
      [0, 1, 0],
    );
    f(
      'glass',
      [at(0.455, a, 11.65), at(0.455, b, 11.65), at(0.455, b, 14.35), at(0.455, a, 14.35)],
      n.map((v) => -v),
    );
    // Curved exterior mesh skin, with a glazed western hospitality sector.
    const glass = Math.sin(m) < -0.65;
    for (const [lo, hi] of [
      [8, 16],
      [16.35, 26],
    ])
      f(
        glass ? 'glass' : 'mesh',
        [
          outside(a, lo, 0.982),
          outside(b, lo, 0.982),
          outside(b, hi, 0.982),
          outside(a, hi, 0.982),
        ],
        n,
      );
    for (const y of detail ? [7.7, 16, 26] : []) {
      const ps = [
        outside(a, y, 0.982),
        outside(b, y, 0.982),
        outside(b, y + 0.3, 0.982),
        outside(a, y + 0.3, 0.982),
      ];
      f('metal', ps, n);
    }
    if (detail > 1)
      for (const y of [10.5, 13.2, 18.6, 21.1, 23.5])
        f(
          'metal',
          [
            outside(a, y, 0.984),
            outside(b, y, 0.984),
            outside(b, y + 0.16, 0.984),
            outside(a, y + 0.16, 0.984),
          ],
          n,
        );
    // Roof has matching explicit triangle diagonals on both skins, including its translucent inner band.
    const roofPoint = (t, a) => {
      const lo = opening(a, 0),
        hi = outside(a, 0),
        p = lo.map((v, k) => v + (hi[k] - v) * t);
      p[1] = r.roofInnerY * (1 - t) + r.roofOuterY * t + Math.sin(t * Math.PI) * 1.2;
      return p;
    };
    for (const [t0, t1, role] of [
      [0, 0.23, 'translucent'],
      [0.23, 0.62, 'roof'],
      [0.62, 1, 'roof'],
    ]) {
      const ps = [roofPoint(t0, a), roofPoint(t0, b), roofPoint(t1, b), roofPoint(t1, a)],
        below = ps.map(([x, y, z]) => [x, y - 0.32, z]);
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((k) => ps[k]),
          [0, 1, 0],
        );
        f(
          role,
          ids.map((k) => below[k]),
          [0, -1, 0],
        );
      }
      for (const [j, k, dir] of [
        [0, 1, -1],
        [2, 3, 1],
      ])
        if ((t0 === 0 && dir < 0) || (t1 === 1 && dir > 0))
          f(
            'metal',
            [ps[j], ps[k], below[k], below[j]],
            n.map((v) => v * dir),
          );
    }
    if (detail) {
      bar('metal', outside(a, 26.2, 0.98), opening(a, 27.4), detail === 1 ? 0.5 : 0.32, 0.55);
      bar('metal', opening(a, 27.85), opening(b, 27.85), 0.35, 0.5);
    }
  }
  // Exterior radial triangular lattice fins rise above the membrane, bow out at mid-height and land on the native podium.
  const fins = [8, 12, 30, 60][detail];
  for (let i = 0; i < fins; i++) {
    const a = (i * tau) / fins,
      R = castelaoRadius(r.outer, a),
      n = [Math.cos(a), Math.sin(a)],
      t = [-n[1], n[0]],
      q = (rad, y, side = 0) => [R * rad * n[0] + t[0] * side, y, R * rad * n[1] + t[1] * side],
      base = q(1.035, 7.7),
      apex = q(0.995, 40.5),
      bend = q(1.075, 19),
      rear = q(0.99, 8.2);
    bar('metal', base, apex, detail ? 0.4 : 0.85);
    bar('metal', base, bend, detail ? 0.45 : 0.85);
    bar('metal', bend, apex, detail ? 0.4 : 0.85);
    if (detail) {
      bar('metal', rear, apex, 0.34);
      bar('metal', rear, base, 0.4);
      const stages = detail === 1 ? 1 : detail === 2 ? 3 : 5;
      for (let j = 0; j < stages; j++) {
        const u = j / stages,
          v = (j + 1) / stages,
          mix = (p, q, u) => p.map((v, k) => v + (q[k] - v) * u),
          l = mix(base, apex, u),
          h = mix(base, apex, v),
          w = mix(bend, apex, u),
          z = mix(bend, apex, v);
        bar('metal', l, w, 0.18);
        bar('metal', l, z, 0.16);
        if (detail === 3) bar('metal', w, h, 0.16);
      }
      if (detail > 1) bar('metal', apex, opening(a, 28.5), 0.13);
      bar('metal', q(0.995, 27), q(0.98, 26.9), 0.5);
    }
  }
  // Closed lower apron wall and selected genuinely recessed entrance portals.
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count,
      b = ((i + 1) * tau) / count,
      m = (a + b) / 2,
      n = [Math.cos(m), 0, Math.sin(m)],
      pa = outside(a, 0, 0.975),
      pb = outside(b, 0, 0.975),
      map = (u, y, depth = 0) => [
        pa[0] + (pb[0] - pa[0]) * u + n[0] * depth,
        y,
        pa[2] + (pb[2] - pa[2]) * u + n[2] * depth,
      ],
      portal = detail && i % 4 === 0;
    if (portal) {
      f('wall', [map(0, 0.27), map(0.25, 0.27), map(0.25, 8), map(0, 8)], n);
      f('wall', [map(0.75, 0.27), map(1, 0.27), map(1, 8), map(0.75, 8)], n);
      f('wall', [map(0.25, 5.7), map(0.75, 5.7), map(0.75, 8), map(0.25, 8)], n);
      const left = map(0.25, 0),
        right = map(0.75, 0),
        width = Math.hypot(right[0] - left[0], right[2] - left[2]);
      f(
        'glass',
        [map(0.25, 0.3, -0.8), map(0.75, 0.3, -0.8), map(0.75, 5.7, -0.8), map(0.25, 5.7, -0.8)],
        n,
      );
      f(
        'wall',
        [map(0.25, 0.3), map(0.75, 0.3), map(0.75, 0.3, -0.8), map(0.25, 0.3, -0.8)],
        [0, 1, 0],
      );
      f(
        'wall',
        [map(0.25, 5.7), map(0.75, 5.7), map(0.75, 5.7, -0.8), map(0.25, 5.7, -0.8)],
        [0, -1, 0],
      );
      for (const u of [0.25, 0.75])
        f(
          'wall',
          [map(u, 0.3), map(u, 0.3, -0.8), map(u, 5.7, -0.8), map(u, 5.7)],
          [-n[2], 0, n[0]],
        );
      if (width < 0.5) throw Error(`${candidateId}: entrance collapsed`);
    } else f('wall', [map(0, 0.27), map(1, 0.27), map(1, 8), map(0, 8)], n);
  }
  // Neutral football layout, supported goals and two roof-hung end boards.
  const [cx, cz] = r.fieldCenter;
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
    for (const z of [-34, 34]) paint(cx, cz + z, 105, 0.14);
    for (const x of [-52.5, 0, 52.5]) paint(cx + x, cz, 0.14, 68);
    for (const s of [-1, 1]) {
      for (const [d, w] of [
        [16.5, 40.32],
        [5.5, 18.32],
      ]) {
        paint(cx + s * (52.5 - d), cz, 0.14, w);
        for (const z of [-w / 2, w / 2]) paint(cx + s * (52.5 - d / 2), cz + z, d, 0.14);
      }
      for (const z of [-3.66, 3.66]) {
        bar('mark', [cx + s * 52.5, 0.32, cz + z], [cx + s * 52.5, 2.76, cz + z], 0.1);
        bar('mark', [cx + s * 52.5, 2.76, cz + z], [cx + s * 54, 2.6, cz + z], 0.08);
        bar('mark', [cx + s * 54, 0.32, cz + z], [cx + s * 54, 2.6, cz + z], 0.08);
      }
      bar('mark', [cx + s * 52.5, 2.76, cz - 3.66], [cx + s * 52.5, 2.76, cz + 3.66], 0.1);
    }
    const circle = detail === 1 ? 12 : 32;
    for (let i = 0; i < circle; i++) {
      const a = (i * tau) / circle,
        b = ((i + 1) * tau) / circle;
      f(
        'mark',
        [
          [cx + 9.08 * Math.cos(a), 0.315, cz + 9.08 * Math.sin(a)],
          [cx + 9.08 * Math.cos(b), 0.315, cz + 9.08 * Math.sin(b)],
          [cx + 9.22 * Math.cos(b), 0.315, cz + 9.22 * Math.sin(b)],
          [cx + 9.22 * Math.cos(a), 0.315, cz + 9.22 * Math.sin(a)],
        ],
        [0, 1, 0],
      );
    }
  }
  for (const s of [-1, 1]) {
    const p = opening(s > 0 ? 0 : Math.PI, 0),
      x = p[0],
      z = p[2];
    box(f, 'screen', x, 19, z, 0.8, 4.5, 12);
    if (detail)
      for (const dz of [-4.5, 4.5]) bar('metal', [x, 23.4, z + dz], [x, 28.25, z + dz], 0.22);
  }
}
