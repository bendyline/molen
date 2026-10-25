/** 'royal_bafokeng_stadium': Royal Bafokeng's single west cantilever, uncovered bowl and athletics track. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const bafokengSegments = [12, 24, 40, 80];
export function bafokengRadius(poly, a) {
  const d = [Math.cos(a), Math.sin(a)],
    hits = [],
    cross = (p, q) => p[0] * q[1] - p[1] * q[0];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      v = poly[(i + 1) % poly.length].map((x, k) => x - p[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(p, v) / den,
      u = cross(p, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error('royal_bafokeng_stadium: nonradial native boundary');
  return Math.min(...hits);
}
export function bafokengFoundationOutline(r, d) {
  return Array.from({ length: bafokengSegments[d] }, (_, i) => {
    const a = (i * tau) / bafokengSegments[d],
      R = bafokengRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function bafokengRoofPoint(r, u, t) {
  const a = r.westStart + (r.westEnd - r.westStart) * u,
    R = bafokengRadius(r.outer, a) * 0.98 * (1 - t) + bafokengRadius(r.inner, a) * 1.035 * t;
  return [R * Math.cos(a), 37.5 + 1.8 * Math.sin(Math.PI * u) + 0.8 * t, R * Math.sin(a)];
}
export function bafokengCapsule(radius, steps) {
  return [0, 1].flatMap((end) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = -Math.PI / 2 + end * Math.PI + (i * Math.PI) / steps;
      return [(end ? -42 : 42) + radius * Math.cos(a), radius * Math.sin(a)];
    }),
  );
}
export function buildBafokengStadium(face, detail, r) {
  const n = bafokengSegments[detail],
    F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, no) => face(role, ps.map(P), D(no)),
    adapter = {
      addQuad: (role, _ref, ps, no) => f(role, ps, no),
      addConvexPolygon: (role, _ref, ps, no) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], no);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    body = (a, y, s = 1) => {
      const R = bafokengRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = bafokengRadius(r.inner, a) * (1 - t) + bafokengRadius(r.outer, a) * 0.94 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    slab = (role, ps, thick = 0.3) => {
      const sideSign = Math.sign(
        ps.reduce(
          (sum, p, i) =>
            sum + p[0] * ps[(i + 1) % ps.length][2] - p[2] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
      // Matching triangles retain the same diagonal on both sides of a sloping quad.
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          [0, 1, 0],
        );
        f(
          role,
          ids.map((i) => [ps[i][0], ps[i][1] - thick, ps[i][2]]),
          [0, -1, 0],
        );
      }
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          p = ps[i],
          q = ps[j];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sideSign, 0, (p[0] - q[0]) * sideSign],
        );
      }
    },
    west = (a) => a >= r.westStart && a <= r.westEnd,
    rows = detail === 3 ? 20 : detail === 2 ? 5 : 1;
  prism(f, 'wall', { outline: bafokengFoundationOutline(r, detail) }, r.minGround - F - 0.5, 0.27);
  prism(f, 'turf', { outline: bafokengCapsule(39, [4, 12, 20, 40][detail]) }, 0.27, 0.3);
  prism(
    f,
    'track',
    {
      outline: bafokengCapsule(49, [4, 12, 20, 40][detail]),
      holes: [bafokengCapsule(39, [4, 12, 20, 40][detail])],
    },
    0.27,
    0.305,
  );
  // The general two-tier bowl remains uncovered. Only the west has the third tier.
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      W = west(m),
      normal = [Math.cos(m), 0, Math.sin(m)],
      tiers = [
        { t0: 0, t1: 0.32, y0: 1.4, y1: 9, role: 'seatGold' },
        { t0: 0.4, t1: W ? 0.61 : 0.86, y0: 12, y1: W ? 18 : 21, role: 'seatBlue' },
        ...(W ? [{ t0: 0.72, t1: 0.98, y0: 22, y1: 31, role: 'seatGreen' }] : []),
      ];
    for (const t of tiers)
      for (let j = 0; j < rows; j++) {
        const u = j / rows,
          v = (j + 1) / rows,
          t0 = t.t0 + (t.t1 - t.t0) * u,
          t1 = t.t0 + (t.t1 - t.t0) * v,
          y = t.y0 + (t.y1 - t.y0) * v,
          ps = [
            at(t0, a, detail < 2 ? t.y0 : y),
            at(t0, b, detail < 2 ? t.y0 : y),
            at(t1, b, detail < 2 ? t.y1 : y),
            at(t1, a, detail < 2 ? t.y1 : y),
          ],
          role = detail > 1 && i % 5 === 0 ? 'wall' : t.role;
        slab(role, ps, detail > 1 ? (t.y1 - t.y0) / rows + 0.1 : 0.4);
      }
    for (const [t0, t1, lo, hi] of [[0.32, 0.4, 9, 12], ...(W ? [[0.61, 0.72, 18, 22]] : [])]) {
      const ps = [at(t0, a, hi), at(t0, b, hi), at(t1, b, hi), at(t1, a, hi)];
      slab('wall', ps, 0.45);
      f(
        W && lo === 18 ? 'glass' : 'wall',
        [at(t0, a, lo), at(t0, b, lo), at(t0, b, hi), at(t0, a, hi)],
        normal.map((v) => -v),
      );
    }
    const y = W ? 31 : 21,
      contact = r.columnContacts[detail][i] - F;
    f(
      'service',
      [
        body(a, Math.min(contact - 0.3, 0), 0.86),
        body(b, Math.min(r.columnContacts[detail][(i + 1) % n] - F - 0.3, 0), 0.86),
        body(b, detail ? 7 : 9, 0.86),
        body(a, detail ? 7 : 9, 0.86),
      ],
      normal,
    );
    if (detail)
      for (const height of [6, 12, ...(W ? [20] : [])])
        slab(
          'wall',
          [
            body(a, height, 0.86),
            body(b, height, 0.86),
            body(b, height, 0.97),
            body(a, height, 0.97),
          ],
          0.5,
        );
    if (detail || i % 4 === 0)
      bar('wall', body(a, contact - 0.3, 0.98), body(a, y, 0.98), detail ? 0.9 : 1.6);
    if (detail > 1) bar('metal', body(a, Math.max(contact, 7), 0.86), body(a, y + 0.5, 0.99), 0.38);
    if (detail && i % 4 === 0) {
      const p = body(m, Math.max(0, contact), 0.865);
      box(f, 'entry', p[0], p[1] + 0.1, p[2], 5, 4, 3);
    }
  }
  // Taller west hospitality fascia and real supported concrete access cores.
  for (const [ci, c] of r.cores.entries()) {
    if (!detail && ci % 2) continue;
    box(f, 'wall', c.center[0], c.groundY - F - 0.3, c.center[1], 7, 24 - (c.groundY - F), 7);
    if (detail > 1) box(f, 'glass', c.center[0], 10, c.center[1] + 3.52, 3.5, 11, 0.1);
  }
  const count = [4, 8, 16, 32][detail],
    rings = detail < 2 ? [0, 1] : [0, 0.45, 0.85, 1];
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count;
    for (let j = 0; j < rings.length - 1; j++) {
      const t = rings[j],
        u = rings[j + 1],
        ps = [
          bafokengRoofPoint(r, a, t),
          bafokengRoofPoint(r, b, t),
          bafokengRoofPoint(r, b, u),
          bafokengRoofPoint(r, a, u),
        ];
      // Glazed leading strip is a shared opaque approximation, not optical glass.
      slab(t >= 0.85 ? 'roofGlass' : 'roof', ps, 0.35);
    }
    const A = bafokengRoofPoint(r, a, 0),
      B = bafokengRoofPoint(r, a, 1),
      C = bafokengRoofPoint(r, b, 0),
      tip = [A[0], A[1] + 7, A[2]],
      a0 = r.westStart + (r.westEnd - r.westStart) * a;
    if (detail) {
      bar('metal', [A[0], A[1] - 0.45, A[2]], [B[0], B[1] - 0.45, B[2]], 0.4);
      bar('metal', [A[0], A[1] - 0.6, A[2]], [A[0], A[1] + 7, A[2]], 0.28);
      bar('metal', tip, B, 0.14);
      bar('metal', tip, C, 0.14);
      bar(
        'wall',
        body(a0, r.roofSupportContacts[detail][i] - F - 0.3, 0.86),
        [A[0], A[1] - 0.6, A[2]],
        0.8,
      );
      if (detail > 1)
        for (const t of [0.1, 0.45, 0.85, 1]) {
          const p = bafokengRoofPoint(r, a, t),
            q = bafokengRoofPoint(r, b, t);
          p[1] -= 0.4;
          q[1] -= 0.4;
          bar('metal', p, q, 0.18);
        }
    } else bar('metal', A, tip, 0.6);
  }
  // A supported end display and separate floodlight columns; no suspended loose boxes.
  const sx = 109;
  box(f, 'screen', sx, 25, 0, 1.5, 5.5, 10);
  for (const z of [-3.5, 3.5])
    bar('wall', [sx, r.displayGround[z < 0 ? 0 : 1] - F - 0.3, z], [sx, 25, z], 0.9);
  for (const l of r.lights) {
    const [x, z] = l.center;
    bar('metal', [x, l.groundY - F - 0.3, z], [x, 44, z], detail ? 0.75 : 1.3);
    if (detail) box(f, 'metal', x, 42.5, z, 6, 3.5, 1.2);
    else {
      const ps = [
        [x - 3, 42.5, z],
        [x + 3, 42.5, z],
        [x + 3, 46, z],
        [x - 3, 46, z],
      ];
      f('metal', ps, [0, 0, 1]);
      f('metal', ps, [0, 0, -1]);
    }
    if (detail > 1)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 4; k++)
          box(f, 'mark', x - 2.3 + k * 1.5, 42.8 + j, z + 0.67, 0.85, 0.65, 0.16);
  }
  if (detail) {
    // Neutral track lane marks, football markings and goal posts share painted material.
    const steps = detail === 3 ? 40 : detail === 2 ? 20 : 8;
    for (let lane = 1; lane < 8; lane++) {
      const out = bafokengCapsule(39 + lane * 1.25, steps),
        inside = bafokengCapsule(38.9 + lane * 1.25, steps);
      for (let i = 0; i < out.length; i++) {
        const j = (i + 1) % out.length;
        f(
          'mark',
          [
            [...out[i].slice(0, 1), 0.32, out[i][1]],
            [out[j][0], 0.32, out[j][1]],
            [inside[j][0], 0.32, inside[j][1]],
            [inside[i][0], 0.32, inside[i][1]],
          ],
          [0, 1, 0],
        );
      }
    }
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
        bar('mark', [sign * 52.5, 0.3, z], [sign * 52.5, 2.74, z], 0.1);
      bar('mark', [sign * 52.5, 2.74, -3.66], [sign * 52.5, 2.74, 3.66], 0.1);
    }
    for (let i = 0; i < 32; i++) {
      const a = (i * tau) / 32,
        b = ((i + 1) * tau) / 32;
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
