/** MetLife's mapped open bowl, three stepped tiers, silver louvers and corner boards. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildMetlifeStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    count = [16, 32, 48, 64][detail],
    cross = (a, b) => a[0] * b[1] - a[1] * b[0],
    radius = (poly, angle) => {
      const d = [Math.cos(angle), Math.sin(angle)],
        hits = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length],
          v = b.map((x, k) => x - a[k]),
          den = cross(d, v);
        if (Math.abs(den) < 1e-8) continue;
        const t = cross(a, v) / den,
          u = cross(a, d) / den;
        if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
      }
      if (!hits.length) throw Error(`MetLife outline is not radial at ${angle}`);
      return Math.min(...hits);
    },
    at = (t, angle, y = 0) => {
      const a = radius(r.inner, angle),
        b = radius(r.outer, angle),
        distance = a + (b - a) * t;
      return [distance * Math.cos(angle), y, distance * Math.sin(angle)];
    },
    outline = Array.from({ length: count }, (_, i) =>
      at(1, (i * Math.PI * 2) / count).filter((_, k) => k !== 1),
    ),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    band = (role, t0, t1, y0, y1, thick = 0.45, aisles = false) => {
      for (let i = 0; i < count; i++) {
        if (detail && role === 'metal' && t0 > 0.98 && y1 < 18) {
          const angle = ((i + 0.5) * Math.PI * 2) / count,
            portal = Math.round(angle / (Math.PI / 2)),
            centre = (portal * Math.PI) / 2,
            delta = Math.abs(Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre))),
            half = portal % 2 ? 22 : 16;
          if (delta < half / radius(r.outer, centre)) continue;
        }
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count,
          lo = [at(t0, a, y0), at(t0, b, y0)],
          hi = [at(t1, a, y1), at(t1, b, y1)],
          top = [lo[0], lo[1], hi[1], hi[0]],
          bottom = top.map(([x, y, z]) => [x, y - thick, z]);
        if (aisles && i % 2 === 0) {
          const split = top[0].map((v, k) => v + (top[1][k] - v) * 0.12),
            splitOuter = top[3].map((v, k) => v + (top[2][k] - v) * 0.12);
          f('wall', [top[0], split, splitOuter, top[3]], [0, 1, 0]);
          f(role, [split, top[1], top[2], splitOuter], [0, 1, 0]);
        } else f(role, top, [0, 1, 0]);
        if (detail > 1) f('wall', bottom, [0, -1, 0]);
        f(
          role,
          [lo[0], bottom[0], bottom[1], lo[1]],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
        if (detail > 1)
          f(
            'wall',
            [hi[0], hi[1], bottom[2], bottom[3]],
            [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
          );
      }
    };
  // The footprint wall remains closed at every level; only nearby levels resolve its layers.
  prism(
    f,
    'wall',
    { outline, holes: [outline.map(([x, z]) => [x * 0.977, z * 0.977])] },
    r.minGround - F - 0.4,
    detail === 0 ? 54 : 3,
  );
  if (detail) {
    prism(
      f,
      'back',
      { outline, holes: [outline.map(([x, z]) => [x * 0.985, z * 0.985])] },
      3,
      detail === 1 ? 54 : r.shellTop,
    );
    for (let i = 0; i < count; i++) {
      const a = outline[i],
        b = outline[(i + 1) % count],
        angle = ((i + 0.5) * Math.PI * 2) / count;
      f(
        'glass',
        [
          [a[0] * 1.001, 3.1, a[1] * 1.001],
          [b[0] * 1.001, 3.1, b[1] * 1.001],
          [b[0] * 1.001, 8, b[1] * 1.001],
          [a[0] * 1.001, 8, a[1] * 1.001],
        ],
        [Math.cos(angle), 0, Math.sin(angle)],
      );
    }
    if (detail > 1)
      prism(
        f,
        'wall',
        {
          outline: outline.map(([x, z]) => [x * 0.99, z * 0.99]),
          holes: [outline.map(([x, z]) => [x * 0.98, z * 0.98])],
        },
        r.shellTop,
        54,
      );
  }
  const rows = detail === 3 ? [24, 12, 24] : detail === 2 ? [5, 4, 6] : [1, 1, 1];
  for (const [index, tier] of r.tiers.entries()) {
    for (let j = 0; j < rows[index]; j++) {
      const a = j / rows[index],
        b = (j + 1) / rows[index],
        t0 = tier.t0 + (tier.t1 - tier.t0) * a,
        t1 = tier.t0 + (tier.t1 - tier.t0) * b;
      if (detail < 2) band('seat', t0, t1, tier.y0, tier.y1, 0.7, false);
      else {
        const y = tier.y0 + (tier.y1 - tier.y0) * b;
        band('seat', t0, t1, y, y, (tier.y1 - tier.y0) / rows[index] + 0.18, true);
      }
    }
  }
  for (const [t0, t1, y0, y1] of [
    [0.4, 0.46, 19, 24],
    [0.63, 0.68, 33, 38],
  ]) {
    band('wall', t0, t1, y0, y0, 0.8);
    if (detail)
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count;
        f(
          'glass',
          [at(t1, a, y0 + 0.5), at(t1, b, y0 + 0.5), at(t1, b, y1 - 0.2), at(t1, a, y1 - 0.2)],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
      }
  }
  band('wall', 0.94, 0.985, 54, 54, 0.8);
  // Wide horizontal slats merge into six district bands and separate progressively near the shell.
  if (detail) {
    const slats = [0, 6, 10, 28][detail];
    for (let j = 0; j < slats; j++) {
      const y = 9 + (j * (r.shellTop - 9)) / slats;
      band('metal', 0.988, 1.006, y + (detail === 1 ? 1.2 : 0.6), y, detail === 1 ? 0.7 : 0.28);
    }
  }
  // Open lighting truss follows the actual footprint; no shelter is invented over the seats or field.
  if (detail === 0) band('metal', 0.962, 0.98, r.rimTop, r.rimTop, 0.5);
  else
    for (const y of [55.1, r.rimTop])
      for (let i = 0; i < count; i++) {
        const a = at(0.97, (i * Math.PI * 2) / count, y),
          b = at(0.97, ((i + 1) * Math.PI * 2) / count, y);
        if (detail === 1) {
          f(
            'metal',
            [
              [a[0], y - 0.3, a[2]],
              [b[0], y - 0.3, b[2]],
              [b[0], y + 0.3, b[2]],
              [a[0], y + 0.3, a[2]],
            ],
            [
              Math.cos(((i + 0.5) * Math.PI * 2) / count),
              0,
              Math.sin(((i + 0.5) * Math.PI * 2) / count),
            ],
          );
        } else bar('metal', a, b, 0.38);
      }
  if (detail) {
    const posts = detail === 1 ? 16 : 24;
    for (let i = 0; i < posts; i++) {
      const a = (i * Math.PI * 2) / posts;
      bar('metal', at(0.97, a, 53.4), at(0.97, a, r.rimTop), 0.34);
      if (detail > 2)
        bar('metal', at(0.97, a, 55.1), at(0.97, a + (Math.PI * 2) / posts, r.rimTop), 0.19);
    }
  }
  // Each corner screen has two visible supports and a closed back; screen pixels remain neutral.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const angle = Math.atan2(sz * 0.7, sx),
        c = at(0.68, angle, 0),
        n = [Math.cos(angle), 0, Math.sin(angle)],
        u = [-n[2], 0, n[0]],
        map = ([s, y, d]) => [c[0] + s * u[0] + d * n[0], y, c[2] + s * u[2] + d * n[2]],
        local = (role, ps, normal) =>
          f(role, ps.map(map), [
            normal[0] * u[0] + normal[2] * n[0],
            normal[1],
            normal[0] * u[2] + normal[2] * n[2],
          ]);
      box(local, 'back', 0, 35, 0, 27, 11.5, 1.6);
      local(
        'screen',
        [
          [-12.5, 35.6, -0.82],
          [12.5, 35.6, -0.82],
          [12.5, 45.8, -0.82],
          [-12.5, 45.8, -0.82],
        ],
        [0, 0, -1],
      );
      if (detail)
        for (const s of [-9, 9]) bar('metal', map([s, 30, 0.65]), map([s, 47.1, 0.65]), 0.55);
    }
  // Bounded entrance boxes remain attached to the parent shell; surrounding parking stays native.
  if (detail)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2,
        c = at(1, a),
        n = [Math.cos(a), 0, Math.sin(a)],
        u = [-n[2], 0, n[0]],
        width = k % 2 ? 40 : 28,
        point = (s, y, d) => [c[0] + u[0] * s + n[0] * d, y, c[2] + u[2] * s + n[2] * d];
      f(
        'glass',
        [
          point(-width / 2, 2, 0.3),
          point(width / 2, 2, 0.3),
          point(width / 2, 17, 0.3),
          point(-width / 2, 17, 0.3),
        ],
        n,
      );
      for (const s of [-width / 2, width / 2])
        bar('wall', point(s, 0.3, 0.5), point(s, 18, 0.5), 1.8);
      bar('metal', point(-width / 2 - 2, 18, 1), point(width / 2 + 2, 18, 1), 1.2, 2.3);
      const local = (role, ps, normal) =>
        f(
          role,
          ps.map(([s, y, d]) => point(s, y, d)),
          [u[0] * normal[0] + n[0] * normal[2], normal[1], u[2] * normal[0] + n[2] * normal[2]],
        );
      for (const side of [-1, 1]) {
        const s = side * (width / 2 + 5);
        box(local, 'back', s, 1, 1, 4, 20, 1.5);
        local(
          'screen',
          [
            [s - 1.8, 2, 1.77],
            [s + 1.8, 2, 1.77],
            [s + 1.8, 20, 1.77],
            [s - 1.8, 20, 1.77],
          ],
          [0, 0, 1],
        );
      }
      if (detail > 1)
        for (let j = 1; j < 8; j++)
          bar(
            'metal',
            point(-width / 2 + (width * j) / 8, 2, 0.42),
            point(-width / 2 + (width * j) / 8, 8, 0.42),
            0.12,
          );
    }
  prism(
    f,
    'turf',
    {
      outline:
        detail < 2
          ? Array.from({ length: count }, (_, i) => {
              const p = at(0, (i * Math.PI * 2) / count);
              return [p[0], p[2]];
            })
          : r.inner,
    },
    r.minGround - F - 0.5,
    0.3,
  );
  band('wall', 0, 0.015, 2.8, 2.8, 2.6);
  if (detail) {
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
    for (const z of [-r.fieldWidth / 2, r.fieldWidth / 2]) line(0, z, r.fieldLength, 0.18);
    for (let i = 0; i <= 12; i++) line(-r.fieldLength / 2 + i * 9.144, 0, 0.15, r.fieldWidth);
    if (detail > 1)
      for (let i = -9; i <= 9; i++) for (const z of [-2.8, 2.8]) line(i * 4.572, z, 0.13, 0.65);
    for (const sign of [-1, 1]) {
      const x = sign * (r.fieldLength / 2 + 2.5);
      bar('goal', [x, 0.3, 0], [x, 3.35, 0], 0.16);
      bar('goal', [x, 3.35, -2.82], [x, 3.35, 2.82], 0.13);
      for (const z of [-2.82, 2.82]) bar('goal', [x, 3.35, z], [x, 11.6, z], 0.11);
    }
  }
}
