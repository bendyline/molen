/** 'ahmad_bin_ali_stadium': own Ahmad bin Ali envelope, flying roof truss, rosette screen and mapped ancillary forms. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export const rayyanSegments = [12, 20, 32, 72];
export const rayyanCanopyLift = 3.5;
export function rayyanRadius(poly, a) {
  const d = [Math.cos(a), Math.sin(a)],
    cross = (p, q) => p[0] * q[1] - p[1] * q[0],
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
  if (!hits.length) throw Error('ahmad_bin_ali_stadium: missing own radial boundary');
  return Math.min(...hits);
}
export function rayyanFoundationOutline(r, d) {
  return Array.from({ length: rayyanSegments[d] }, (_, i) => {
    const a = (i * Math.PI * 2) / rayyanSegments[d],
      R = rayyanRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function rayyanRoofPoint(r, a, t) {
  const R = rayyanRadius(r.inner, a) * (1 - t) + rayyanRadius(r.outer, a) * 0.99 * t;
  return [
    R * Math.cos(a),
    35 * (1 - t) + 31 * t - 2 * Math.sin(Math.PI * t) + rayyanCanopyLift,
    R * Math.sin(a),
  ];
}

export function rayyanDuneAngles(d, detail) {
  const center = Math.atan2(d.center[1], d.center[0]),
    relative = d.outline.map(([x, z]) =>
      Math.atan2(Math.sin(Math.atan2(z, x) - center), Math.cos(Math.atan2(z, x) - center)),
    ),
    lo = Math.min(...relative),
    hi = Math.max(...relative),
    count = [3, 6, 10, 16][detail],
    values =
      detail === 2
        ? relative
        : [
            ...Array.from({ length: count + 1 }, (_, i) => lo + ((hi - lo) * i) / count),
            ...(detail > 1 ? relative : []),
          ];
  return [...new Set(values.map((v) => Math.round(v * 1e10) / 1e10))]
    .sort((a, b) => a - b)
    .map((v) => v + center);
}
export function rayyanDunePoint(d, a, t, floorY) {
  const direction = [Math.cos(a), Math.sin(a)],
    cross = (p, q) => p[0] * q[1] - p[1] * q[0],
    hits = [];
  for (let i = 0; i < d.outline.length; i++) {
    const p = d.outline[i],
      v = d.outline[(i + 1) % d.outline.length].map((x, k) => x - p[k]),
      den = cross(direction, v);
    if (Math.abs(den) < 1e-8) continue;
    const R = cross(p, v) / den,
      u = cross(p, direction) / den;
    if (R > 0 && u >= -1e-7 && u <= 1 + 1e-7) hits.push(R);
  }
  if (!hits.length) throw Error('ahmad_bin_ali_stadium: missing crescent roof boundary');
  const R = Math.min(...hits) * (1 - t) + Math.max(...hits) * t;
  return [
    R * direction[0],
    d.groundY - floorY + 1.3 + 5.5 * Math.sin(Math.PI * t),
    R * direction[1],
  ];
}

export function buildRayyanStadium(face, detail, r) {
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
    n = rayyanSegments[detail],
    tau = Math.PI * 2,
    body = (a, y, scale = 1) => {
      const R = rayyanRadius(r.outer, a) * scale;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R =
        rayyanRadius(r.bowlInner, a) * (detail === 0 ? 1.06 : 1) * (1 - t) +
        rayyanRadius(r.outer, a) * 0.91 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
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
      const s = Math.sign(
        ps.reduce((v, p, i) => v + p[0] * ps[(i + 1) % 4][2] - p[2] * ps[(i + 1) % 4][0], 0),
      );
      for (let i = 0; i < 4; i++) {
        // Adjacent angular cells share this cross-section; cap only the exposed ring edges.
        if (i === 1 || i === 3) continue;
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * s, 0, (p[0] - q[0]) * s],
        );
      }
    };
  prism(
    f,
    'wall',
    { outline: rayyanFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.5, -0.4),
    0.27,
  );
  box(f, 'turf', 0, 0.27, 0, 112, 0.03, 74);
  const rings = detail < 2 ? [0, 1] : [0, 0.33, 0.67, 1];
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      G = r.columnContacts[detail][i] - F,
      H = r.columnContacts[detail][(i + 1) % n] - F,
      hem = (a, g) => Math.max(g + 0.4, 3 + 1.3 * Math.cos(a * 4)),
      outer = (a, y) => body(a, y, 0.99);
    f(
      'screen',
      [
        outer(a, hem(a, G)),
        outer(b, hem(b, H)),
        outer(b, 31 + rayyanCanopyLift),
        outer(a, 31 + rayyanCanopyLift),
      ],
      N,
    );
    if (detail) {
      // A reversed thin screen is visible through the real alpha apertures from either side.
      f(
        'screen',
        [
          outer(a, hem(a, G)),
          outer(b, hem(b, H)),
          outer(b, 31 + rayyanCanopyLift),
          outer(a, 31 + rayyanCanopyLift),
        ],
        N.map((v) => -v),
      );
      if (detail > 1 || i % 2 === 0)
        bar('metal', outer(a, hem(a, G)), outer(a, 31 + rayyanCanopyLift), 0.23);
      f('glass', [body(a, 7, 0.88), body(b, 7, 0.88), body(b, 26, 0.88), body(a, 26, 0.88)], N);
      for (const y of detail > 1 ? [7, 16, 26] : [7, 26])
        slab(
          'wall',
          [body(a, y, 0.78), body(b, y, 0.78), body(b, y, 0.92), body(a, y, 0.92)],
          0.45,
        );
      if (detail > 1 || i % 2 === 0)
        bar(
          'wall',
          body(a, Math.min(G - 0.3, -0.4), 0.94),
          body(a, 31 + rayyanCanopyLift, 0.94),
          0.8,
        );
    }
    for (let j = 0; j < rings.length - 1; j++)
      slab(
        'roof',
        [
          rayyanRoofPoint(r, a, rings[j]),
          rayyanRoofPoint(r, b, rings[j]),
          rayyanRoofPoint(r, b, rings[j + 1]),
          rayyanRoofPoint(r, a, rings[j + 1]),
        ],
        0.25,
      );
    const A = rayyanRoofPoint(r, a, 0),
      B = rayyanRoofPoint(r, b, 0),
      O = rayyanRoofPoint(r, a, 1),
      top = [A[0], 45 + rayyanCanopyLift, A[2]],
      next = [B[0], 45 + rayyanCanopyLift, B[2]],
      rear = [O[0], 36 + rayyanCanopyLift, O[2]];
    bar('metal', top, next, detail ? 0.45 : 1.1);
    if (detail) {
      if (detail > 1 || i % 2 === 0) {
        bar('metal', A, top, 0.3);
        bar('metal', A, next, 0.19);
        bar('metal', O, rear, 0.3);
        bar('metal', rear, top, 0.28);
      }
      if (detail > 1) bar('metal', A, B, 0.4);
      if (detail > 1) {
        bar('metal', top, rayyanRoofPoint(r, a, 0.6), 0.14);
        bar('metal', rear, rayyanRoofPoint(r, a, 0.5), 0.14);
        bar('metal', [A[0], A[1] - 0.5, A[2]], [O[0], O[1] - 0.5, O[2]], 0.35);
      }
    } else if (i % 2 === 0) bar('metal', A, top, 0.6);
    const tiers = [
        { t0: 0, t1: 0.4, y0: 1.4, y1: 13 },
        { t0: 0.5, t1: 0.97, y0: 18, y1: 28 },
      ],
      rows = detail === 3 ? [24, 22] : detail === 2 ? [6, 6] : [1, 1];
    for (const [ti, t] of tiers.entries())
      for (let j = 0; j < rows[ti]; j++) {
        const u = j / rows[ti],
          v = (j + 1) / rows[ti],
          lo = t.t0 + (t.t1 - t.t0) * u,
          hi = t.t0 + (t.t1 - t.t0) * v,
          y = t.y0 + (t.y1 - t.y0) * v;
        slab(
          detail > 1 && i % 5 === 0 ? 'wall' : i % 7 === 0 ? 'seatDark' : 'seatRed',
          [
            at(lo, a, detail < 2 ? t.y0 : y),
            at(lo, b, detail < 2 ? t.y0 : y),
            at(hi, b, detail < 2 ? t.y1 : y),
            at(hi, a, detail < 2 ? t.y1 : y),
          ],
          detail > 1 ? (t.y1 - t.y0) / rows[ti] + 0.1 : 0.4,
        );
      }
    f(
      'glass',
      [at(0.4, a, 13), at(0.4, b, 13), at(0.4, b, 18), at(0.4, a, 18)],
      N.map((v) => -v),
    );
    slab('wall', [at(0.4, a, 18), at(0.4, b, 18), at(0.5, b, 18), at(0.5, a, 18)], 0.4);
  }
  for (const c of r.cores) {
    const G = c.minGround - F,
      ps = c.outline,
      [x, z] = c.center;
    prism(f, 'wall', { outline: ps }, G - 0.3, 31.2 + rayyanCanopyLift);
    if (detail > 1) {
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i],
          q = ps[(i + 1) % ps.length],
          N = [(p[0] + q[0]) * 0.5 - x, 0, (p[1] + q[1]) * 0.5 - z];
        f(
          'wall',
          [
            [p[0], 31.2 + rayyanCanopyLift, p[1]],
            [q[0], 31.2 + rayyanCanopyLift, q[1]],
            [q[0], 32.5 + rayyanCanopyLift, q[1]],
            [p[0], 32.5 + rayyanCanopyLift, p[1]],
          ],
          N,
        );
      }
      box(f, 'service', x, 31.2 + rayyanCanopyLift, z, 6, 0.9, 6);
      const a = Math.atan2(z, x),
        inner = body(a, 16, 0.88);
      bar('wall', inner, [x, 16, z], 1.5, 3);
    }
  }
  for (const d of r.dunes) {
    const G = d.groundY - F,
      angles = rayyanDuneAngles(d, detail),
      pt = (a, t) => rayyanDunePoint(d, a, t, F);
    if (detail > 1) prism(f, 'wall', { outline: d.outline }, d.minGround - F - 0.3, G + 0.1);
    for (let i = 0; i < angles.length - 1; i++) {
      const a = angles[i],
        b = angles[i + 1];
      for (const [lo, hi] of detail
        ? [
            [0, 0.5],
            [0.5, 1],
          ]
        : [[0, 1]])
        slab('roof', [pt(a, lo), pt(b, lo), pt(b, hi), pt(a, hi)], 0.2);
      for (const t of [0, 1]) {
        const A = pt(a, t),
          B = pt(b, t),
          m = (a + b) * 0.5,
          N = [Math.cos(m) * (t ? 1 : -1), 0, Math.sin(m) * (t ? 1 : -1)];
        f(
          'wall',
          [A, [A[0], d.minGround - F - 0.3, A[2]], [B[0], d.minGround - F - 0.3, B[2]], B],
          N,
        );
        if (detail > 1 && i % 3 === 0) bar('metal', [A[0], d.minGround - F - 0.3, A[2]], A, 0.18);
      }
    }
  }

  if (detail) {
    for (const sign of [-1, 1]) {
      const R = rayyanRadius(r.inner, sign > 0 ? 0 : Math.PI),
        x = sign * R;
      box(f, 'display', x, 29, 0, 0.6, 5, 10);
      for (const z of [-3, 3]) bar('metal', [x, 35 + rayyanCanopyLift, z], [x, 29, z], 0.25);
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
      const x = 52.5 * sign;
      for (const z of [-3.66, 3.66]) bar('mark', [x, 0.3, z], [x, 2.74, z], 0.1);
      bar('mark', [x, 2.74, -3.66], [x, 2.74, 3.66], 0.1);
      for (const z of [-20.16, 20.16]) line(sign * 44.25, z, 16.5, 0.12);
      line(sign * 36, 0, 0.12, 40.32);
    }
    for (let i = 0; i < (detail > 1 ? 40 : 16); i++) {
      const a = (i * tau) / (detail > 1 ? 40 : 16),
        b = ((i + 1) * tau) / (detail > 1 ? 40 : 16);
      bar(
        'mark',
        [9.15 * Math.cos(a), 0.315, 9.15 * Math.sin(a)],
        [9.15 * Math.cos(b), 0.315, 9.15 * Math.sin(b)],
        0.1,
        0.02,
      );
    }
  }
}
