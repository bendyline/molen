/** estadio_beira_rio: Beira-Rio's pale petal canopy, open steel ribs and two red bowl tiers. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'estadio_beira_rio',
  tau = Math.PI * 2;
export const beiraModules = [12, 24, 40, 65],
  beiraWidths = [1, 1, 2, 4];
export const beiraProfile = [
  { s: 0.9, y: 1.5, w: 0.38 },
  { s: 0.98, y: 11, w: 0.62 },
  { s: 1, y: 22, w: 0.86 },
  { s: 0.98, y: 30.5, w: 1 },
  { s: 0.88, y: 35.5, w: 1 },
  { s: null, y: 32, w: 1 },
];
export function beiraRadius(poly, a) {
  const d = [Math.cos(a), Math.sin(a)],
    cross = (u, v) => u[0] * v[1] - u[1] * v[0],
    hits = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      v = poly[(i + 1) % poly.length].map((x, k) => x - p[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(p, v) / den,
      u = cross(p, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error(`${candidateId}: missing native radial boundary`);
  return Math.min(...hits);
}
export function beiraFoundationOutline(r, d) {
  return Array.from({ length: beiraModules[d] }, (_, i) => {
    const a = (i * tau) / beiraModules[d],
      R = beiraRadius(r.outer, a) * 0.97;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function beiraPetalPoint(r, d, i, u, k) {
  const n = beiraModules[d],
    p = beiraProfile[k],
    spread = d === 0 ? 1 : p.w,
    a = ((i + 0.5 + (u - 0.5) * spread) * tau) / n,
    bulge = (1 - 4 * (u - 0.5) * (u - 0.5)) * (d === 0 ? 0 : [0, 0.5, 0.75, 0.65, 0.35, 0][k]),
    R = (p.s === null ? beiraRadius(r.inner, a) : beiraRadius(r.outer, a) * p.s) + bulge,
    y = k === 0 ? r.petalGround[d][i][Math.round(u * beiraWidths[d])] - r.floorY + 0.3 : p.y;
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export function beiraPetalNormal(r, d, i, u, k) {
  const a = ((i + 0.5 + (u - 0.5) * (d === 0 ? 1 : beiraProfile[k].w)) * tau) / beiraModules[d],
    at = (j) => {
      const p = beiraProfile[j],
        bow = (1 - 4 * (u - 0.5) * (u - 0.5)) * (d === 0 ? 0 : [0, 0.5, 0.75, 0.65, 0.35, 0][j]);
      return [
        (p.s === null ? beiraRadius(r.inner, a) : beiraRadius(r.outer, a) * p.s) + bow,
        j === 0 ? r.petalGround[d][i][Math.round(u * beiraWidths[d])] - r.floorY + 0.3 : p.y,
      ];
    },
    p = at(Math.max(0, k - 1)),
    q = at(Math.min(5, k + 1)),
    dr = q[0] - p[0],
    dy = q[1] - p[1],
    L = Math.hypot(dr, dy);
  return [(Math.cos(a) * dy) / L, -dr / L, (Math.sin(a) * dy) / L];
}
export function beiraBackPoint(r, d, i, u, k) {
  const p = beiraPetalPoint(r, d, i, u, k),
    N = beiraPetalNormal(r, d, i, u, k);
  return p.map((v, j) => v - N[j] * 0.22);
}
export function buildBeiraStadium(face, detail, r) {
  const n = beiraModules[detail],
    us = beiraWidths[detail],
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
      const R = beiraRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R =
        beiraRadius(r.bowlInner, a) * (detail === 0 ? 1.18 : 1) * (1 - t) +
        beiraRadius(r.outer, a) * 0.85 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    lower = Math.min(r.minGround - F - 0.5, -0.4),
    avg = (ps) => ps.reduce((s, p) => s.map((v, j) => v + p[j] / ps.length), [0, 0, 0]);
  prism(f, 'wall', { outline: beiraFoundationOutline(r, detail) }, lower, 0.27);
  box(f, 'turf', 0, 0.27, 0, 114, 0.03, 78);
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)];
    f(
      'service',
      [body(a, lower, 0.82), body(b, lower, 0.82), body(b, 28, 0.82), body(a, 28, 0.82)],
      N,
    );
    if (detail) {
      const contact = r.columnContacts[detail][i] - F;
      bar('wall', body(a, contact - 0.3, 0.86), body(a, 27, 0.86), 0.85);
      for (const y of [8, 17]) {
        const ps = [body(a, y, 0.8), body(b, y, 0.8), body(b, y, 0.91), body(a, y, 0.91)];
        f('wall', ps, [0, 1, 0]);
        f(
          'wall',
          ps.map((p) => [p[0], p[1] - 0.45, p[2]]),
          [0, -1, 0],
        );
        f(
          'wall',
          [body(a, y, 0.91), body(b, y, 0.91), body(b, y - 0.45, 0.91), body(a, y - 0.45, 0.91)],
          N,
        );
      }
      f(
        'glass',
        [
          body(a, contact + 0.2, 0.825),
          body(b, r.columnContacts[detail][(i + 1) % n] - F + 0.2, 0.825),
          body(b, 12.5, 0.825),
          body(a, 12.5, 0.825),
        ],
        N,
      );
      if (i % 5 === 0) {
        const p = body(m, 0, 0.835);
        box(f, 'entry', p[0], Math.max(contact, 1.5), p[2], 4.5, 4, 3.6);
      }
    }
    // Each curved petal is a closed skin; gaps below the shoulder reveal the separate steel/concourse structure.
    for (let k = 0; k < 5; k++)
      for (let j = 0; j < us; j++) {
        const u = j / us,
          v = (j + 1) / us,
          ps = [
            beiraPetalPoint(r, detail, i, u, k),
            beiraPetalPoint(r, detail, i, v, k),
            beiraPetalPoint(r, detail, i, v, k + 1),
            beiraPetalPoint(r, detail, i, u, k + 1),
          ],
          back = [
            beiraBackPoint(r, detail, i, u, k),
            beiraBackPoint(r, detail, i, v, k),
            beiraBackPoint(r, detail, i, v, k + 1),
            beiraBackPoint(r, detail, i, u, k + 1),
          ],
          Ns = avg([
            beiraPetalNormal(r, detail, i, u, k),
            beiraPetalNormal(r, detail, i, v, k),
            beiraPetalNormal(r, detail, i, v, k + 1),
            beiraPetalNormal(r, detail, i, u, k + 1),
          ]),
          role = i % 9 === 0 ? 'roofPale' : 'roof';
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          f(
            role,
            ids.map((k) => ps[k]),
            Ns,
          );
          f(
            role,
            ids.map((k) => back[k]),
            Ns.map((v) => -v),
          );
        }
        if (k === 0) f('roof', [ps[0], ps[1], back[1], back[0]], [0, -1, 0]);
        if (k === 4) f('metal', [ps[3], ps[2], back[2], back[3]], [-Math.cos(m), 0, -Math.sin(m)]);
        if (detail && k < 3 && j === 0)
          f('roof', [ps[0], ps[3], back[3], back[0]], [Math.sin(m), 0, -Math.cos(m)]);
        if (detail && k < 3 && j === us - 1)
          f('roof', [ps[1], ps[2], back[2], back[1]], [-Math.sin(m), 0, Math.cos(m)]);
      }
    if (detail) {
      // The center rafter follows the actual angular tessellation, including the coarser district panel.
      const sk = (k, depth) => {
          const j = Math.floor(us / 2),
            u = j / us,
            v = Math.min(1, (j + 1) / us),
            mix = (0.5 - u) / (v - u || 1),
            A = beiraPetalPoint(r, detail, i, u, k),
            B = beiraPetalPoint(r, detail, i, v, k),
            Na = beiraPetalNormal(r, detail, i, u, k),
            Nb = beiraPetalNormal(r, detail, i, v, k);
          return A.map((x, t) => x + (B[t] - x) * mix - (Na[t] + (Nb[t] - Na[t]) * mix) * depth);
        },
        ks = detail === 1 ? [0, 4, 5] : detail === 2 ? [0, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
      for (let j = 0; j < ks.length - 1; j++) {
        const k = ks[j],
          q = ks[j + 1],
          A = sk(k, 0.3),
          B = sk(q, 0.3);
        bar('metal', A, B, detail === 1 ? 0.55 : 0.28);
        if (detail > 1) {
          const C = sk(k, 2.6),
            E = sk(q, 2.6);
          bar('metal', C, E, 0.28);
          bar('metal', A, E, 0.2);
          bar('metal', A, C, 0.24);
          if (j === ks.length - 2) bar('metal', B, E, 0.24);
        }
      }
      if (detail > 1) {
        const C = sk(0, 0.3),
          ground = r.petalGround[detail][i][Math.floor(us / 2)] - F;
        bar('wall', [C[0], ground - 0.2, C[2]], C, 0.7);
      }
      const A = beiraBackPoint(r, detail, i, 0, 5),
        B = beiraBackPoint(r, detail, i, 1, 5),
        C = A.map((v, j) => (j === 1 ? v - 2.6 : v)),
        E = B.map((v, j) => (j === 1 ? v - 2.6 : v));
      bar(
        'metal',
        A.map((v, j) => (j === 1 ? v - 0.08 : v)),
        B.map((v, j) => (j === 1 ? v - 0.08 : v)),
        0.24,
      );
      bar('metal', C, E, 0.3);
      if (detail > 1) {
        bar('metal', A, E, 0.18);
        bar('metal', A, C, 0.2);
      }
      if (i % (detail === 3 ? 3 : 5) === 0) {
        const p = avg([C, E]);
        box(f, 'mark', p[0], p[1] - 0.6, p[2], 1.6, 0.45, 0.6);
        bar('metal', p, [p[0], p[1] - 0.35, p[2]], 0.14);
      }
    }
  }
  // The renovated red bowl has two principal tiers separated by one closed hospitality/circulation belt.
  const rows = detail === 3 ? [26, 28] : detail === 2 ? [7, 8] : [1, 1];
  for (const [ti, t] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          m = (a + b) / 2,
          t0 = t.t0 + ((t.t1 - t.t0) * row) / rows[ti],
          t1 = t.t0 + ((t.t1 - t.t0) * (row + 1)) / rows[ti],
          y0 = t.y0 + ((t.y1 - t.y0) * row) / rows[ti],
          y1 = t.y0 + ((t.y1 - t.y0) * (row + 1)) / rows[ti],
          aisle = detail > 1 && i % (detail === 3 ? 7 : 5) === 0,
          role = aisle ? 'wall' : (i + row * 3) % 19 === 0 ? 'seatPale' : 'seat';
        f(
          role,
          [
            at(t0, a, detail < 2 ? y0 : y1),
            at(t0, b, detail < 2 ? y0 : y1),
            at(t1, b, y1),
            at(t1, a, y1),
          ],
          [0, 1, 0],
        );
        if (detail > 1)
          f(
            role,
            [at(t0, a, y0), at(t0, b, y0), at(t0, b, y1), at(t0, a, y1)],
            [-Math.cos(m), 0, -Math.sin(m)],
          );
      }
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [-Math.cos(m), 0, -Math.sin(m)];
    f('seat', [at(0, a, 0.3), at(0, b, 0.3), at(0, b, 1.4), at(0, a, 1.4)], N);
    f('entry', [at(0.43, a, 13), at(0.43, b, 13), at(0.43, b, 16), at(0.43, a, 16)], N);
    f('wall', [at(0.43, a, 16), at(0.43, b, 16), at(0.49, b, 16), at(0.49, a, 16)], [0, 1, 0]);
    f('wall', [at(0.98, a, 16), at(0.98, b, 16), at(0.98, b, 29), at(0.98, a, 29)], N);
  }
  for (const sign of [-1, 1]) {
    const x = sign * (beiraRadius(r.inner, sign > 0 ? 0 : Math.PI) * 0.97),
      y = 32;
    box(f, 'screen', x, y - 7.5, 0, 0.7, 4, 10);
    const rim = Array.from({ length: n * us }, (_, j) => {
      const p = beiraPetalPoint(r, detail, Math.floor(j / us), (j % us) / us, 5);
      return [p[0], p[2]];
    });
    for (const z of [-3.5, 3.5]) {
      const a = Math.atan2(z, x),
        R = beiraRadius(rim, a);
      bar(
        'metal',
        [x, y - 3.8, z],
        [R * Math.cos(a), y - 0.1, R * Math.sin(a)],
        detail ? 0.2 : 0.5,
      );
    }
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
