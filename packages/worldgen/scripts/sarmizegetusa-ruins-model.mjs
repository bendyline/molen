/** N0509: source-controlled surviving sanctuary and fortification forms. */
import earcut from 'earcut';
export const sarmizegetusaCandidateId = 'N0509';

function box(face, role, x, y, z, w, h, d) {
  const a = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([u, v]) => [x + u, y, z + v]),
    b = a.map(([u, v, t]) => [u, v + h, t]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  face(role, a, [0, -1, 0]);
  face(role, b, [0, 1, 0]);
}

function cylinder(face, role, x, z, ground, radius, height, sides, phase = 0) {
  const rings = [
    [-0.45, radius * 1.08],
    [height * 0.75, radius],
    [height, radius * 0.88],
  ].map(([y, r]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i * Math.PI * 2) / sides + phase;
      return [x + r * Math.cos(a), ground + y, z + r * Math.sin(a)];
    }),
  );
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides,
        a = ((i + 0.5) * Math.PI * 2) / sides + phase;
      face(
        role,
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  face(role, rings[0], [0, -1, 0]);
  face(role, rings.at(-1), [0, 1, 0]);
}

function annulus(face, role, cx, cz, radius, width, height, segments, sample) {
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments,
      b = ((i + 1) * Math.PI * 2) / segments;
    const p = (angle, r, y) => {
      const x = cx + r * Math.cos(angle),
        z = cz + r * Math.sin(angle);
      return [x, sample(x, z) + y, z];
    };
    const outer = [
        p(a, radius, -0.4),
        p(b, radius, -0.4),
        p(b, radius, height),
        p(a, radius, height),
      ],
      inner = [
        p(a, radius - width, -0.4),
        p(b, radius - width, -0.4),
        p(b, radius - width, height),
        p(a, radius - width, height),
      ];
    face(role, outer, [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
    face(role, inner, [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)]);
    face(role, [outer[3], outer[2], inner[2], inner[3]], [0, 1, 0]);
  }
}

function polygon(face, role, part, detail, sample) {
  for (const poly of part.polygons) {
    const rings = [poly.outline, ...poly.holes],
      points = rings.flat(),
      holes = [];
    let count = rings[0].length;
    for (const ring of rings.slice(1)) {
      holes.push(count);
      count += ring.length;
    }
    const indices = earcut(points.flat(), holes, 2),
      top = points.map(([x, z], i) => [
        x,
        sample(x, z) + part.estimatedHeight + (detail >= 2 ? Math.sin(i * 1.7) * 0.12 : 0),
        z,
      ]);
    // Far crests are subpixel in height. Keep their mapped footprint rather than
    // spending the skyline budget on buried sides and bottoms.
    for (let i = 0; i < indices.length; i += 3)
      face(
        role,
        indices.slice(i, i + 3).map((k) => top[k]),
        [0, 1, 0],
      );
    if (detail === 0) continue;
    let offset = 0;
    for (const ring of rings) {
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
      }
      const sign = (area > 0 ? 1 : -1) * (offset === 0 ? 1 : -1);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length,
          a = top[offset + i],
          b = top[offset + j],
          aa = [a[0], sample(a[0], a[2]) - 0.8, a[2]],
          bb = [b[0], sample(b[0], b[2]) - 0.8, b[2]];
        face(role, [aa, bb, b, a], [sign * (b[2] - a[2]), 0, sign * (a[0] - b[0])]);
      }
      offset += ring.length;
    }
  }
}

function rectangular(face, part, detail, sample) {
  const co = Math.cos(part.rotation),
    si = Math.sin(part.rotation),
    role = part.kind === 'andesite' ? 'andesite' : 'stone',
    at = (x, z) => [part.center[0] + x * co - z * si, part.center[1] + x * si + z * co],
    rotated = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => [
          part.center[0] + x * co - z * si,
          y,
          part.center[1] + x * si + z * co,
        ]),
        [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
      );
  if (detail === 0) {
    // Sparse perimeter retains the rectangular sanctuary identity at far distance.
    for (const side of [-1, 1])
      for (const axis of [0, 1]) {
        const w = part.width * 0.86,
          d = part.depth * 0.86;
        const corners =
          axis === 0
            ? [
                [-w / 2, (side * d) / 2 - 0.6],
                [w / 2, (side * d) / 2 - 0.6],
                [w / 2, (side * d) / 2 + 0.6],
                [-w / 2, (side * d) / 2 + 0.6],
              ]
            : [
                [(side * w) / 2 - 0.6, -d / 2],
                [(side * w) / 2 + 0.6, -d / 2],
                [(side * w) / 2 + 0.6, d / 2],
                [(side * w) / 2 - 0.6, d / 2],
              ];
        face(
          role,
          corners.map(([x, z]) => {
            const [u, v] = at(x, z);
            return [u, sample(u, v) + 0.5, v];
          }),
          [0, 1, 0],
        );
      }
    return;
  }
  const cols = part.cols,
    rows = part.rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = (i / (cols - 1) - 0.5) * part.width * 0.76,
        z = (j / (rows - 1) - 0.5) * part.depth * 0.78,
        [u, v] = at(x, z),
        h = sample(u, v),
        radius =
          part.kind === 'largeLimestone' ? 0.75 : part.kind === 'smallLimestone' ? 0.65 : 0.67;
      if (detail === 1) box(rotated, role, x, h - 0.45, z, radius * 2, 0.9, radius * 2);
      else
        cylinder(
          face,
          role,
          u,
          v,
          h,
          radius,
          0.45 + ((i + j) % 3) * 0.09,
          detail === 2 ? 6 : 10,
          i * 0.18,
        );
    }
  if (detail >= 2 && part.kind === 'andesite') {
    const count = detail === 2 ? 12 : 20;
    for (const side of [-1, 1])
      for (let i = 0; i < count; i++) {
        const x = (i / (count - 1) - 0.5) * part.width * 0.96,
          z = side * part.depth * 0.47,
          [u, v] = at(x, z);
        box(rotated, 'andesite', x, sample(u, v) - 0.35, z, 0.42, 0.95, 0.38);
      }
    for (const side of [-1, 1])
      for (let j = 1; j < count - 1; j++) {
        const x = side * part.width * 0.47,
          z = (j / (count - 1) - 0.5) * part.depth * 0.96,
          [u, v] = at(x, z);
        box(rotated, 'andesite', x, sample(u, v) - 0.35, z, 0.42, 0.95, 0.38);
      }
  }
}

function circular(face, part, detail, sample) {
  const [x, z] = part.center,
    r = part.radius,
    large = part.kind === 'largeCircle',
    segments = detail === 0 ? 12 : detail === 1 ? 24 : 60;
  if (detail < 2)
    annulus(face, 'andesite', x, z, r, large ? 0.65 : 0.45, large ? 0.38 : 0.48, segments, sample);
  else
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI * 2) / 60,
        u = x + (r - 0.3) * Math.cos(a),
        v = z + (r - 0.3) * Math.sin(a),
        h = sample(u, v),
        co = Math.cos(a),
        si = Math.sin(a),
        f = (role, ps, n) =>
          face(
            role,
            ps.map(([p, y, q]) => [u + p * co - q * si, y, v + p * si + q * co]),
            [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
          );
      box(f, 'andesite', 0, h - 0.35, 0, 0.68, 0.65 + (i % 4) * 0.05, 0.55);
    }
  if (!large) return;
  if (detail === 0) annulus(face, 'timber', x, z, r * 0.72, 0.4, 1.8, 12, sample);
  else {
    const count = detail === 1 ? 28 : 60;
    for (let i = 0; i < count; i++) {
      if (i === 0 || i === Math.floor(count / 2)) continue;
      const a = (i * Math.PI * 2) / count,
        u = x + r * 0.72 * Math.cos(a),
        v = z + r * 0.72 * Math.sin(a),
        h = sample(u, v),
        height = 1.65 + (i % 4) * 0.12;
      box(face, 'timber', u, h - 0.5, v, 0.35, height + 0.5, 0.36);
    }
  }
  const horseshoe = [];
  for (const side of [-1, 1])
    for (let i = 0; i < (detail === 0 ? 2 : 5); i++)
      horseshoe.push([side * 4, -6 + (i * 6) / (detail === 0 ? 1 : 4)]);
  for (let i = 1; i < (detail === 0 ? 5 : 13); i++) {
    const a = (i * Math.PI) / (detail === 0 ? 5 : 13);
    horseshoe.push([Math.cos(a) * 4, Math.sin(a) * 4]);
  }
  for (const [u, v] of horseshoe)
    box(face, 'timber', x + u, sample(x + u, z + v) - 0.5, z + v, 0.4, 4.2, 0.4);
}

function solarDisc(face, part, detail, sample) {
  const [x, z] = part.center,
    n = detail === 0 ? 12 : detail === 1 ? 20 : 40,
    radius = part.radius,
    centerGrade = sample(x, z),
    gx = (sample(x + radius, z) - sample(x - radius, z)) / (2 * radius),
    gz = (sample(x, z + radius) - sample(x, z - radius)) / (2 * radius),
    residuals = Array.from({ length: 81 }, (_, i) => {
      const dx = -radius + ((i % 9) * radius) / 4,
        dz = -radius + (Math.floor(i / 9) * radius) / 4;
      return sample(x + dx, z + dz) - centerGrade - gx * dx - gz * dz;
    }),
    ground = centerGrade + Math.max(...residuals),
    slabPoint = (px, pz, offset = 0.35) => [
      px,
      ground + gx * (px - x) + gz * (pz - z) + offset,
      pz,
    ];
  // A thin planar slab follows the approximate local grade; no tall pedestal.
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      p = slabPoint(x + radius * Math.cos(a), z + radius * Math.sin(a)),
      q = slabPoint(x + radius * Math.cos(b), z + radius * Math.sin(b));
    face('andesite', [[x, ground + 0.35, z], p, q], [0, 1, 0]);
    face(
      'andesite',
      [[p[0], p[1] - 0.8, p[2]], [q[0], q[1] - 0.8, q[2]], q, p],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
  const stem = [
    [12.226, -21.096],
    [12.644, -21.096],
    [13.688, -11.908],
    [12.644, -11.699],
  ];
  const p = { polygons: [{ outline: stem, holes: [] }], estimatedHeight: 0.22 };
  polygon(face, 'andesite', p, detail, sample);
  if (detail >= 2)
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10,
        u = Math.cos(a),
        v = Math.sin(a),
        across = [-v * 0.035, u * 0.035];
      face(
        'andesite',
        [
          slabPoint(x + u * 0.3 + across[0], z + v * 0.3 + across[1], 0.356),
          slabPoint(x + u * radius + across[0], z + v * radius + across[1], 0.356),
          slabPoint(x + u * radius - across[0], z + v * radius - across[1], 0.356),
          slabPoint(x + u * 0.3 - across[0], z + v * 0.3 - across[1], 0.356),
        ],
        [0, 1, 0],
      );
    }
}

export function buildSarmizegetusaRuins(face, detail, r, sample) {
  for (const part of r.parts) {
    if (part.kind.includes('Circle')) circular(face, part, detail, sample);
    else if (part.kind === 'solar') solarDisc(face, part, detail, sample);
    else rectangular(face, part, detail, sample);
  }
  for (const wall of r.walls)
    polygon(face, wall.kind === 'fortification' ? 'wall' : 'stone', wall, detail, sample);
}
