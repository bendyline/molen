/** 'N0735': Maksimir's separate native stands, northern glazed offices and lattice floodlights. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';
export const maksimirSegments = [2, 4, 16, 32];
export function maksimirBankPoint(s, q, t, y) {
  const u = q * (s.sections.length - 1),
    i = Math.min(s.sections.length - 2, Math.floor(u)),
    v = u - i,
    A = s.sections[i],
    B = s.sections[i + 1],
    front = A.front * (1 - v) + B.front * v,
    back = A.back * (1 - v) + B.back * v,
    along = A.along * (1 - v) + B.along * v;
  if (s.kind === 'south') {
    const R = front + (back - front) * t;
    return [60 + R * Math.cos(along), y, R * Math.sin(along)];
  }
  const across = front + (back - front) * t;
  return s.kind === 'north' ? [across, y, along] : [along, y, across];
}
export function buildMaksimirStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, N) => face(role, ps.map(P), D(N)),
    adapter = {
      addQuad: (role, _ref, ps, N) => f(role, ps, N),
      addConvexPolygon: (role, _ref, ps, N) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], N);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    slab = (role, ps, thick = 0.3) => {
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          [0, 1, 0],
        );
        if (detail)
          f(
            role,
            ids.map((i) => [ps[i][0], ps[i][1] - thick, ps[i][2]]),
            [0, -1, 0],
          );
      }
      const sign = Math.sign(
        ps.reduce((s, p, i) => s + p[0] * ps[(i + 1) % 4][2] - p[2] * ps[(i + 1) % 4][0], 0),
      );
      for (let i = 0; i < 4; i++) {
        if (!detail && (i === 1 || i === 3)) continue;
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    n = maksimirSegments[detail];
  for (const p of r.apronPolygons) prism(f, 'apron', p, r.minGround - F - 0.7, 0.3);
  box(f, 'turf', 0, 0.3, 0, 108, 0.02, 70);
  for (const s of r.stands) {
    prism(f, 'wall', { outline: s.outline }, Math.min(s.minGround - F - 0.5, -0.5), 0.27);
    const rows =
        detail === 3
          ? s.banks.length === 2
            ? [20, 16]
            : [s.kind === 'south' ? 16 : 28]
          : detail === 2
            ? s.banks.length === 2
              ? [5, 4]
              : [s.kind === 'south' ? 5 : 6]
            : s.banks.map(() => 1),
      ns = s.kind === 'south' ? [4, 8, 24, 48][detail] : n;
    for (let i = 0; i < ns; i++) {
      const q = i / ns,
        v = (i + 1) / ns,
        N =
          s.kind === 'north'
            ? [1, 0, 0]
            : s.kind === 'west'
              ? [0, 0, -1]
              : s.kind === 'east'
                ? [0, 0, 1]
                : [-1, 0, 0];
      const A = maksimirBankPoint(s, q, 0, 0.3),
        B = maksimirBankPoint(s, v, 0, 0.3),
        toe = s.banks[0].y0;
      f('apron', [A, B, [B[0], toe, B[2]], [A[0], toe, A[2]]], N);
      for (const [k, t] of s.banks.entries())
        for (let j = 0; j < rows[k]; j++) {
          const lo = t.lo + ((t.hi - t.lo) * j) / rows[k],
            hi = t.lo + ((t.hi - t.lo) * (j + 1)) / rows[k],
            y = t.y0 + ((t.y1 - t.y0) * (j + 1)) / rows[k],
            role = detail > 1 && i % 5 === 1 ? 'aisle' : 'seat';
          slab(
            role,
            [
              maksimirBankPoint(s, q, lo, detail > 1 ? y : t.y0),
              maksimirBankPoint(s, v, lo, detail > 1 ? y : t.y0),
              maksimirBankPoint(s, v, hi, y),
              maksimirBankPoint(s, q, hi, y),
            ],
            detail > 1 ? (t.y1 - t.y0) / rows[k] + 0.12 : 0.4,
          );
        }
      if (s.banks.length === 2) {
        const t = s.banks[0],
          upper = s.banks[1];
        slab(
          'wall',
          [
            maksimirBankPoint(s, q, t.hi, upper.y0),
            maksimirBankPoint(s, v, t.hi, upper.y0),
            maksimirBankPoint(s, v, upper.lo, upper.y0),
            maksimirBankPoint(s, q, upper.lo, upper.y0),
          ],
          0.4,
        );
        f(
          'glass',
          [
            maksimirBankPoint(s, q, t.hi, t.y1),
            maksimirBankPoint(s, v, t.hi, t.y1),
            maksimirBankPoint(s, v, t.hi, upper.y0),
            maksimirBankPoint(s, q, t.hi, upper.y0),
          ],
          N,
        );
      }
      if (detail) {
        const rear = maksimirBankPoint(s, q, 1, s.banks.at(-1).y1 - 0.2),
          G = s.supports[detail][i] - F,
          foot = [rear[0], G - 0.3, rear[2]];
        bar('wall', foot, rear, 0.7);
        for (const [k, t] of s.banks.entries()) {
          const clearance = (detail > 1 ? (t.y1 - t.y0) / rows[k] + 0.12 : 0.4) + 0.5;
          bar(
            'wall',
            maksimirBankPoint(s, q, t.lo, t.y0 - clearance),
            maksimirBankPoint(s, q, t.hi, t.y1 - clearance),
            0.55,
          );
          if (s.banks.length === 2 && k === 0) {
            const top = maksimirBankPoint(s, q, t.hi, t.y1 - clearance + 0.52);
            bar('wall', [top[0], 0.27, top[2]], top, 0.55);
          }
        }
      }
    }
  }
  const west = r.stands.find((s) => s.kind === 'west'),
    wa = maksimirBankPoint(west, 0, 0, 6),
    wb = maksimirBankPoint(west, 1, 0, 6);
  slab('apron', [[wa[0], 0.31, wa[2] - 12], [wb[0], 0.31, wb[2] - 12], wb, wa], 0.35);
  // Native northern service wings and curved glazed entrance tower.
  for (const o of r.offices) {
    prism(
      f,
      o.kind === 'tower' ? 'glass' : 'facade',
      { outline: o.outline },
      Math.min(o.minGround - F - 0.3, -0.3),
      o.height,
    );
    if (detail) {
      const sign = Math.sign(
        o.outline.reduce(
          (sum, p, i) =>
            sum +
            p[0] * o.outline[(i + 1) % o.outline.length][1] -
            p[1] * o.outline[(i + 1) % o.outline.length][0],
          0,
        ),
      );
      for (let i = 0; i < o.outline.length; i++) {
        const a = o.outline[i],
          b = o.outline[(i + 1) % o.outline.length],
          N = [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign];
        if (o.kind !== 'tower' && i % 2 === 0)
          for (const y of [8, 17, 26])
            f(
              'glass',
              [
                [a[0] + N[0] * 0.0005, y, a[1] + N[2] * 0.0005],
                [b[0] + N[0] * 0.0005, y, b[1] + N[2] * 0.0005],
                [b[0] + N[0] * 0.0005, y + 5, b[1] + N[2] * 0.0005],
                [a[0] + N[0] * 0.0005, y + 5, a[1] + N[2] * 0.0005],
              ],
              N,
            );
        if (o.kind === 'tower')
          for (const y of [8, 14, 20, 26, 32]) bar('metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.16);
      }
    }
  }
  // The north street frontage sits behind the stepped seating, leaving the pitch side open.
  box(f, 'facade', -117, 0, -2, 9, 26, 115);
  slab(
    'facade',
    [
      [-121.5, 38, -59.5],
      [-112.5, 26, -59.5],
      [-112.5, 26, 55.5],
      [-121.5, 38, 55.5],
    ],
    0.35,
  );
  f(
    'facade',
    [
      [-121.5, 26, -59.5],
      [-121.5, 26, 55.5],
      [-121.5, 38, 55.5],
      [-121.5, 38, -59.5],
    ],
    [-1, 0, 0],
  );
  for (const z of [-59.5, 55.5])
    f(
      'facade',
      [
        [-121.5, 26, z],
        [-112.5, 26, z],
        [-121.5, 38, z],
      ],
      [0, 0, Math.sign(z)],
    );
  for (const t of r.accessTowers) {
    box(f, 'wall', t.x, t.groundY - F - 0.3, 100, 8, 27 - (t.groundY - F) + 0.3, 5);
    if (detail)
      f(
        'glass',
        [
          [t.x - 2, 6, 102.51],
          [t.x + 2, 6, 102.51],
          [t.x + 2, 25, 102.51],
          [t.x - 2, 25, 102.51],
        ],
        [0, 0, 1],
      );
  }
  if (detail) {
    f(
      'glass',
      [
        [-121.7, 2, -59.5],
        [-121.7, 2, 55.5],
        [-121.7, 34, 55.5],
        [-121.7, 34, -59.5],
      ],
      [-1, 0, 0],
    );
    for (let i = 0; i < 8; i++)
      bar('metal', [-121.8, 2 + i * 4, -59.5], [-121.8, 2 + i * 4, 55.5], 0.18);
  }
  // Two low pitch-side press boxes on the west, rather than a speculative stadium roof.
  for (const x of [-12, 12]) {
    box(f, 'glass', x, 4.2, 55, 22, 3.6, 5);
    box(f, 'roof', x, 7.8, 55, 24, 0.25, 6);
    if (detail)
      for (const z of [52.5, 57.5])
        for (const dx of [-10, 10])
          bar('wall', [x + dx, r.pressGround - F - 0.2, z], [x + dx, 4.2, z], 0.35);
  }
  // Four individual corner lattice towers with inward-facing pale lamp heads.
  for (const l of r.lights) {
    const [x, z] = l.center,
      G = l.groundY - F,
      H = 48;
    if (detail < 2) {
      box(f, 'metal', x, G - 0.3, z, 0.7, H - G + 0.3, 0.7);
    } else {
      const widths = [3, 1.7],
        panels = detail === 3 ? 8 : 4,
        leg = (j, a, b) => {
          const t = j / panels,
            w = widths[0] * (1 - t) + widths[1] * t;
          return [x + (a * w) / 2, G + (H - G) * t, z + (b * w) / 2];
        };
      for (const a of [-1, 1])
        for (const b of [-1, 1]) bar('metal', leg(0, a, b), leg(panels, a, b), 0.2);
      for (let j = 0; j < panels; j++)
        for (const a of [-1, 1]) {
          bar('metal', leg(j, a, -1), leg(j + 1, a, 1), 0.11);
          bar('metal', leg(j, -1, a), leg(j + 1, 1, a), 0.11);
        }
    }
    const len = Math.hypot(x, z),
      N = [-x / len, 0, -z / len],
      T = [-N[2], 0, N[0]],
      point = (u, y, d) => [x + T[0] * u + N[0] * d, y, z + T[2] * u + N[2] * d];
    f('light', [point(-4, 45, 0.5), point(4, 45, 0.5), point(4, 55, -0.5), point(-4, 55, -0.5)], N);
    if (detail) {
      f(
        'metal',
        [point(-4, 45, -0.1), point(4, 45, -0.1), point(4, 55, -1.1), point(-4, 55, -1.1)],
        N.map((v) => -v),
      );
      for (const side of [-1, 1])
        bar('metal', point(side * 4, 45, 0), point(side * 4, 55, -1), 0.18);
      if (detail === 3)
        for (let a = 0; a < 6; a++)
          for (let b = 0; b < 8; b++) {
            const p = point(-3.4 + a * 1.36, 45.7 + b * 1.23, 0.6 - (0.7 + b * 1.23) / 10);
            bar(
              'metal',
              p.map((v, k) => v + T[k] * 0.42),
              p.map((v, k) => v - T[k] * 0.42),
              0.32,
            );
          }
    }
  }
  // Neutral display above the curved southern stand.
  box(f, 'display', 122, 17, 0, 1.1, 7, 15);
  for (const z of [-5, 5]) bar('metal', [122, r.displayGround - F - 0.3, z], [122, 17, z], 0.5);
  if (detail > 1) {
    const paint = (x, z, w, d) =>
        f(
          'mark',
          [
            [x - w / 2, 0.35, z - d / 2],
            [x + w / 2, 0.35, z - d / 2],
            [x + w / 2, 0.35, z + d / 2],
            [x - w / 2, 0.35, z + d / 2],
          ],
          [0, 1, 0],
        ),
      L = r.fieldLength / 2,
      W = r.fieldWidth / 2;
    for (const z of [-W, W]) paint(0, z, 2 * L, 0.12);
    for (const x of [-L, 0, L]) paint(x, 0, 0.12, 2 * W);
    const seg = detail === 3 ? 48 : 20;
    for (let i = 0; i < seg; i++) {
      const a = (i * Math.PI * 2) / seg,
        b = ((i + 1) * Math.PI * 2) / seg;
      slab(
        'mark',
        [
          [9.15 * Math.cos(a), 0.35, 9.15 * Math.sin(a)],
          [9.15 * Math.cos(b), 0.35, 9.15 * Math.sin(b)],
          [9.27 * Math.cos(b), 0.35, 9.27 * Math.sin(b)],
          [9.27 * Math.cos(a), 0.35, 9.27 * Math.sin(a)],
        ],
        0.01,
      );
    }
    for (const sign of [-1, 1]) {
      for (const [depth, width] of [
        [16.5, 40.32],
        [5.5, 18.32],
      ]) {
        paint(sign * (L - depth), 0, 0.12, width);
        for (const z of [-width / 2, width / 2]) paint(sign * (L - depth / 2), z, depth, 0.12);
      }
      for (const z of [-3.66, 3.66]) bar('mark', [sign * L, 0.32, z], [sign * L, 2.76, z], 0.12);
      bar('mark', [sign * L, 2.76, -3.66], [sign * L, 2.76, 3.66], 0.12);
    }
  }
}
