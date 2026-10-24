/** 'tottenham_hotspur_stadium': Tottenham's silver shell, single South Stand and branching south atrium. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export const tottenhamSegments = [12, 20, 32, 64];
const tau = Math.PI * 2;
export function tottenhamRadius(poly, a) {
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
  if (!hits.length) throw Error('tottenham_hotspur_stadium: missing native radial boundary');
  return Math.min(...hits);
}
export function tottenhamSouth(a) {
  return Math.cos(a) > 0.78;
}
export function tottenhamFoundationOutline(r, detail) {
  return Array.from({ length: tottenhamSegments[detail] }, (_, i) => {
    const a = (i * tau) / tottenhamSegments[detail],
      R = tottenhamRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function tottenhamRoofPoint(r, a, t) {
  const R = tottenhamRadius(r.roofInner, a) * (1 - t) + tottenhamRadius(r.outer, a) * 0.985 * t;
  return [R * Math.cos(a), 45.5 + 0.5 * t - 1.5 * Math.sin(Math.PI * t), R * Math.sin(a)];
}
export function buildTottenhamStadium(face, detail, r) {
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
    n = tottenhamSegments[detail],
    step = tau / n,
    body = (a, y, s = 1) => {
      const R = tottenhamRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = tottenhamRadius(r.bowlInner, a) * (1 - t) + tottenhamRadius(r.outer, a) * 0.89 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    facade = (a, y, extra = 0) =>
      body(a, y, 0.96 + 0.04 * Math.min(1, Math.max(0, (y - 4) / 24)) + extra),
    portal = (a) => {
      const d = Math.atan2(Math.sin(a - 0.95), Math.cos(a - 0.95)) / 0.24;
      return 12 + 8 * Math.max(0, 1 - d * d);
    },
    sheet = (role, ps, N, back = false) => {
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const tri = ids.map((i) => ps[i]);
        f(role, tri, N);
        if (back)
          f(
            role,
            tri,
            N.map((v) => -v),
          );
      }
    },
    slab = (role, ps, thick = 0.3, capA = false, capB = false) => {
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
        if ((i === 1 && !capB) || (i === 3 && !capA)) continue;
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    crown = (a, v) => body(a, 40 + 6 * v, 0.985 + 0.015 * Math.cos((v * Math.PI) / 2));
  prism(
    f,
    'wall',
    { outline: tottenhamFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.6, -0.5),
    0.27,
  );
  box(f, 'turf', 0, 0.27, 0, 112, 0.03, 74);
  for (let i = 0; i < n; i++) {
    const a = i * step,
      b = (i + 1) * step,
      m = (a + b) * 0.5,
      N = [Math.cos(m), 0, Math.sin(m)],
      south = tottenhamSouth(m),
      capA = south !== tottenhamSouth(m - step),
      capB = south !== tottenhamSouth(m + step),
      G = r.columnContacts[detail][i] - F,
      H = r.columnContacts[detail][(i + 1) % n] - F;
    f(
      'wall',
      [
        body(a, Math.min(G - 0.3, 0), 0.94),
        body(b, Math.min(H - 0.3, 0), 0.94),
        body(b, 4, 0.94),
        body(a, 4, 0.94),
      ],
      N,
    );
    slab('wall', [body(a, 4, 0.9), body(b, 4, 0.9), facade(b, 4), facade(a, 4)], 0.3);
    if (south) {
      // Local image-free PBR glass remains transparent in portable and shared-surface viewers.
      sheet(
        detail ? 'clearGlass' : 'glass',
        [facade(a, 4), facade(b, 4), facade(b, 40), facade(a, 40)],
        N,
      );
      if (detail)
        slab('wall', [body(a, 3, 0.82), body(b, 3, 0.82), body(b, 3, 0.99), body(a, 3, 0.99)], 3.2);
    } else {
      const A = portal(a),
        B = portal(b);
      sheet('glass', [facade(a, 4), facade(b, 4), facade(b, B), facade(a, A)], N, !!detail);
      const rows = detail > 1 ? [12, 20, 28, 36, 40] : [12, 40];
      for (let j = 0; j < rows.length - 1; j++) {
        const loA = Math.max(rows[j], A),
          loB = Math.max(rows[j], B),
          hi = rows[j + 1];
        if (Math.min(loA, loB) >= hi) continue;
        sheet(
          (i + j) % 3 === 0 ? 'panelLight' : 'panel',
          [
            facade(a, Math.min(loA, hi)),
            facade(b, Math.min(loB, hi)),
            facade(b, hi),
            facade(a, hi),
          ],
          N,
        );
        if (detail)
          sheet(
            'wall',
            [
              facade(a, Math.min(loA, hi), -0.002),
              facade(b, Math.min(loB, hi), -0.002),
              facade(b, hi, -0.002),
              facade(a, hi, -0.002),
            ],
            N.map((v) => -v),
          );
        if (detail > 1 && (i + j * 2) % 3 === 0 && hi - loA > 3 && hi - loB > 3) {
          // Sparse staggered projecting silver panels, rather than a unique facade bitmap.
          const u = a + step * 0.3,
            v = a + step * 0.6,
            lo = Math.max(loA, loB) + 0.4,
            top = hi - 0.6,
            ps = [
              facade(u, lo, 0.006),
              facade(v, lo, 0.006),
              facade(v, top, 0.006),
              facade(u, top, 0.006),
            ],
            back = ps.map((_p, k) => facade(k === 0 || k === 3 ? u : v, k < 2 ? lo : top, -0.001));
          sheet('panelLight', ps, N);
          for (let k = 0; k < 4; k++)
            f(
              'panel',
              [ps[k], back[k], back[(k + 1) % 4], ps[(k + 1) % 4]],
              k % 2 ? [Math.cos(m), 0.2, Math.sin(m)] : [0, k === 0 ? -1 : 1, 0],
            );
        }
      }
    }
    const cr = detail > 1 ? [0, 0.33, 0.67, 1] : [0, 1];
    for (let j = 0; j < cr.length - 1; j++)
      sheet(
        i % 3 === 0 ? 'panelLight' : 'panel',
        [crown(a, cr[j]), crown(b, cr[j]), crown(b, cr[j + 1]), crown(a, cr[j + 1])],
        [N[0], 0.5, N[2]],
        !!detail,
      );
    const bands = detail < 2 ? [0, 0.45, 1] : [0, 0.22, 0.45, 0.72, 1];
    for (let j = 0; j < bands.length - 1; j++) {
      const ps = [
        tottenhamRoofPoint(r, a, bands[j]),
        tottenhamRoofPoint(r, b, bands[j]),
        tottenhamRoofPoint(r, b, bands[j + 1]),
        tottenhamRoofPoint(r, a, bands[j + 1]),
      ];
      if (bands[j + 1] <= 0.45) sheet(detail ? 'clearGlass' : 'glass', ps, [0, 1, 0]);
      else slab('roof', ps, 0.24);
    }
    const I = tottenhamRoofPoint(r, a, 0),
      J = tottenhamRoofPoint(r, b, 0),
      O = tottenhamRoofPoint(r, a, 1),
      L = [I[0], I[1] - 2.2, I[2]],
      M = [J[0], J[1] - 2.2, J[2]];
    if (detail) bar('metal', [I[0], I[1] - 0.3, I[2]], [J[0], J[1] - 0.3, J[2]], 0.35);
    else
      sheet(
        'metal',
        [[I[0], I[1] - 1.5, I[2]], [J[0], J[1] - 1.5, J[2]], J, I],
        N.map((v) => -v),
      );
    if (detail) {
      bar('metal', L, M, 0.28);
      if (detail > 1 || i % 2 === 0) {
        bar('metal', L, [O[0], O[1] - 0.6, O[2]], 0.45);
        bar('metal', body(a, 36, 0.94), [O[0], O[1] - 0.6, O[2]], 0.5);
        bar('metal', [O[0], O[1] - 0.6, O[2]], O, 0.22);
        bar('metal', L, I, 0.22);
        bar('metal', L, [J[0], J[1] - 0.3, J[2]], 0.17);
      }
      if (detail > 1) {
        let prev = O;
        for (let j = 1; j <= 4; j++) {
          const t = 1 - j / 4,
            p = tottenhamRoofPoint(r, a, t);
          p[1] -= 3 * Math.sin(Math.PI * t);
          bar('metal', prev, p, 0.12);
          prev = p;
        }
        for (const v of [0.22, 0.45]) {
          const p = tottenhamRoofPoint(r, a, v),
            q = tottenhamRoofPoint(r, b, v);
          bar('metal', p, q, 0.17);
          const carrierY = L[1] * (1 - v) + (O[1] - 0.6) * v;
          if (Math.abs(p[1] - carrierY) > 0.07) bar('metal', [p[0], carrierY, p[2]], p, 0.12);
        }
        bar('metal', facade(a, 4), facade(a, 40), 0.18);
        if (south) for (const y of [12, 20, 28, 36]) bar('metal', facade(a, y), facade(b, y), 0.16);
      }
    }
    const tiers = south
        ? [{ lo: 0, hi: 0.99, y0: 1.4, y1: 36 }]
        : [
            { lo: 0, hi: 0.27, y0: 1.4, y1: 10 },
            { lo: 0.33, hi: 0.5, y0: 14, y1: 21 },
            { lo: 0.56, hi: 0.65, y0: 25, y1: 28 },
            { lo: 0.71, hi: 0.99, y0: 32, y1: 38 },
          ],
      rows = south
        ? [detail === 3 ? 56 : detail === 2 ? 12 : 1]
        : detail === 3
          ? [16, 12, 8, 12]
          : detail === 2
            ? [4, 3, 2, 4]
            : [1, 1, 1, 1];
    for (const [ti, t] of tiers.entries())
      for (let j = 0; j < rows[ti]; j++) {
        const u = j / rows[ti],
          v = (j + 1) / rows[ti],
          lo = t.lo + (t.hi - t.lo) * u,
          hi = t.lo + (t.hi - t.lo) * v,
          y = t.y0 + (t.y1 - t.y0) * v;
        slab(
          detail > 1 && i % 6 === 0 ? 'wall' : i % 9 === 0 ? 'seatPale' : 'seatNavy',
          [
            at(lo, a, detail < 2 ? t.y0 : y),
            at(lo, b, detail < 2 ? t.y0 : y),
            at(hi, b, detail < 2 ? t.y1 : y),
            at(hi, a, detail < 2 ? t.y1 : y),
          ],
          detail > 1 ? (t.y1 - t.y0) / rows[ti] + 0.1 : 0.4,
          capA,
          capB,
        );
      }
    if (!south)
      for (const [t0, t1, y0, y1] of [
        [0.27, 0.33, 10, 14],
        [0.5, 0.56, 21, 25],
        [0.65, 0.71, 28, 32],
      ]) {
        sheet(
          'glass',
          [at(t0, a, y0), at(t0, b, y0), at(t0, b, y1), at(t0, a, y1)],
          N.map((v) => -v),
        );
        const deck = [at(t0, a, y1), at(t0, b, y1), at(t1, b, y1), at(t1, a, y1)];
        if (detail) slab('wall', deck, 0.4, capA, capB);
        else sheet('wall', deck, [0, 1, 0]);
      }
  }
  // Two branching white trees behind the actual south atrium glazing.
  for (const sign of [-1, 1]) {
    const a = sign * 0.25,
      p = body(a, 0, 0.93),
      foot = [p[0], 2.8, p[2]],
      fork = [p[0], 17, p[2]];
    bar('metal', foot, fork, 2.1, 1.8);
    for (const dz of detail < 2 ? [-14, 0, 14] : [-14, -7, 0, 7, 14])
      bar(
        'metal',
        fork,
        [p[0] + 3, 33 - Math.abs(dz) * 0.12, p[2] + dz],
        detail < 2 ? 1.4 : 1.15,
        0.9,
      );
    if (detail)
      box(
        f,
        'wall',
        p[0],
        r.treeContacts[sign > 0 ? 1 : 0] - F - 0.3,
        p[2],
        3.2,
        3.6 - (r.treeContacts[sign > 0 ? 1 : 0] - F),
        3.2,
      );
  }
  if (detail) {
    for (const a of [0.58, -0.58, Math.PI - 0.58, Math.PI + 0.58]) {
      const p = tottenhamRoofPoint(r, a, 0),
        T = [-Math.sin(a), 0, Math.cos(a)],
        N = [-Math.cos(a), 0, -Math.sin(a)],
        center = [p[0], 36.5, p[2]],
        q = (w, y, d = 0) => center.map((x, k) => x + T[k] * w + (k === 1 ? y : 0) + N[k] * d),
        ps = [q(-7.5, -3.75), q(7.5, -3.75), q(7.5, 3.75), q(-7.5, 3.75)],
        back = ps.map((v) => v.map((x, k) => x - N[k] * 0.4));
      sheet('display', ps, N);
      sheet(
        'metal',
        back,
        N.map((v) => -v),
      );
      for (let i = 0; i < 4; i++)
        f(
          'metal',
          [ps[i], back[i], back[(i + 1) % 4], ps[(i + 1) % 4]],
          i % 2 ? T.map((v) => v * (i === 1 ? 1 : -1)) : [0, i === 0 ? -1 : 1, 0],
        );
      for (const w of [-4.5, 4.5]) {
        const lo = q(w, 3.75),
          ang = Math.atan2(lo[2], lo[0]),
          roof = tottenhamRoofPoint(r, ang, 0.08);
        bar('metal', [roof[0], roof[1] - 0.04, roof[2]], lo, 0.25);
      }
    }
    const line = (x, z, w, d) =>
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
    for (const z of [-34, 34]) line(0, z, 105, 0.12);
    for (const x of [-52.5, 0, 52.5]) line(x, 0, 0.12, 68);
    for (const sign of [-1, 1]) {
      const x = sign * 52.5;
      for (const z of [-3.66, 3.66]) bar('mark', [x, 0.3, z], [x, 2.74, z], 0.1);
      bar('mark', [x, 2.74, -3.66], [x, 2.74, 3.66], 0.1);
      for (const z of [-20.16, 20.16]) line(sign * 44.25, z, 16.5, 0.12);
      line(sign * 36, 0, 0.12, 40.32);
    }
    const count = detail > 1 ? 32 : 12;
    for (let i = 0; i < count; i++)
      bar(
        'mark',
        [9.15 * Math.cos((i * tau) / count), 0.315, 9.15 * Math.sin((i * tau) / count)],
        [9.15 * Math.cos(((i + 1) * tau) / count), 0.315, 9.15 * Math.sin(((i + 1) * tau) / count)],
        0.1,
        0.02,
      );
  }
  // Small original low-poly cockerel/ball silhouette, without copied club artwork.
  if (detail > 1) {
    const p = body(0, 46.3, 0.985),
      profile = [
        [-0.2, 0],
        [-0.7, 0.8],
        [-1.1, 1.5],
        [-0.8, 2.1],
        [-1.7, 2.8],
        [-2, 2.5],
        [-1.5, 3.2],
        [-0.5, 3.4],
        [0.4, 4.1],
        [0.7, 3.9],
        [0.3, 3.2],
        [0.9, 2.8],
        [1.3, 2.7],
        [1.1, 2.1],
        [0.2, 1.7],
        [0.7, 1],
        [0.4, 0.6],
        [0.3, 0],
      ],
      sides = detail === 3 ? 12 : 8,
      ball = (a, t) => [
        p[0] + 0.75 * Math.cos(t) * Math.cos(a),
        p[1] + 0.85 + 0.75 * Math.sin(t),
        p[2] + 0.75 * Math.cos(t) * Math.sin(a),
      ];
    box(f, 'metal', p[0], p[1] - 0.3, p[2], 2.3, 0.4, 2.3);
    for (let i = 0; i < sides; i++)
      for (const [lo, hi] of [
        [-Math.PI / 2, 0],
        [0, Math.PI / 2],
      ]) {
        const a = ((i + 0.5) * tau) / sides,
          t = (lo + hi) / 2;
        sheet(
          'gold',
          [
            ball((i * tau) / sides, lo),
            ball(((i + 1) * tau) / sides, lo),
            ball(((i + 1) * tau) / sides, hi),
            ball((i * tau) / sides, hi),
          ],
          [Math.cos(a) * Math.cos(t), Math.sin(t), Math.sin(a) * Math.cos(t)],
        );
      }
    // The concave bird profile is triangulated in its own plane by the shared prism helper.
    prism(
      (role, ps, N) =>
        f(
          role,
          ps.map(([x, y, z]) => [p[0] + y, p[1] + 1.6 + z, p[2] + x]),
          [N[1], N[2], N[0]],
        ),
      'gold',
      { outline: profile },
      -0.18,
      0.18,
    );
  }
}
