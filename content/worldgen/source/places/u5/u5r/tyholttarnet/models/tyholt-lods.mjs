/** Four complete browser levels; the dense source/master remains untouched. */
import { readFileSync } from 'node:fs';
import {
  cross,
  beam as fullBeam,
  sphere as fullSphere,
  torus as fullTorus,
  loft,
  normalize,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box as fullBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const map = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
function components(level) {
  const district = level === 'district',
    close = level === 'closeup';
  function beam(out, slot, a, b, width, depth, color) {
    if (close) return fullBeam(out, slot, a, b, width, depth, color);
    const axis = normalize(b.map((v, i) => v - a[i])),
      across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
      other = cross(axis, across),
      ring = (center) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) =>
          center.map((n, i) => n + (across[i] * u * width + other[i] * v * depth) / 2),
        );
    loft(out, slot, [ring(a), ring(b)], color, { cap: false });
  }
  function box(out, slot, a, b, color) {
    if (district && slot === 'metal' && b[1] - a[1] < 0.3) return;
    if (district && slot === 'metal' && b[0] - a[0] < 0.8 && b[1] - a[1] > 0.8)
      face(
        out,
        slot,
        [
          [a[0], a[1], b[2]],
          [b[0], a[1], b[2]],
          [b[0], b[1], b[2]],
          [a[0], b[1], b[2]],
        ],
        color,
      );
    else fullBox(out, slot, a, b, color);
  }
  function sphere(out, slot, c, r, color, n = 12, lat = 6) {
    fullSphere(out, slot, c, r, color, Math.min(n, close ? 12 : 6), Math.min(lat, close ? 6 : 3));
  }
  function torus(out, slot, c, r, t, color) {
    fullTorus(
      out,
      slot,
      c,
      r,
      t,
      color,
      close ? (slot === 'concrete' ? 32 : 48) : district ? 12 : 24,
      close ? 4 : 3,
    );
  }
  const tau = Math.PI * 2;
  const concrete = [0.66, 0.65, 0.6],
    light = [0.76, 0.78, 0.76],
    dark = [0.19, 0.23, 0.245];
  const glass = [0.095, 0.145, 0.165],
    white = [0.79, 0.8, 0.75];
  const platforms = [29, 37.3, 45.6, 53.9, 62.2];
  function cylinder(out, slot, y0, y1, r, color, sides = 72, center = [0, 0]) {
    sides = Math.min(sides, close ? 48 : district ? 12 : 24);
    loft(
      out,
      slot,
      [radialRing(y0, r, r, sides, center), radialRing(y1, r, r, sides, center)],
      color,
    );
  }
  function radialBeam(out, a, y0, r0, y1, r1, size, color = dark) {
    beam(
      out,
      'metal',
      [Math.cos(a) * r0, y0, Math.sin(a) * r0],
      [Math.cos(a) * r1, y1, Math.sin(a) * r1],
      size,
      size,
      color,
    );
  }
  function ringRail(out, y, r, count = 48, color = light) {
    if (district && r < 2) return;
    count = Math.min(count, close ? 24 : district ? 6 : 12);
    for (let i = 0; i < count; i++)
      radialBeam(out, (i * tau) / count, y, r, y + 1.05, r, 0.035, color);
    for (const yy of district
      ? [y + 1.02]
      : close
        ? [y + 0.16, y + 0.54, y + 1.02]
        : [y + 0.16, y + 1.02])
      torus(out, 'metal', [0, yy, 0], r, 0.022, color);
  }

  function base(out) {
    const outline = map.geometry.outline;
    const ring = (y, scale = 1) =>
      [...outline].reverse().map(([x, z]) => [x * scale, y, z * scale]);
    loft(out, 'concrete', [ring(0), ring(6.5)], [0.45, 0.44, 0.4]);
    loft(out, 'metal', [ring(6.5, 1.025), ring(10.7, 0.48)], [0.69, 0.71, 0.69]);
    // The square roof is independent of the adjacent H-shaped office building.
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      for (let j = 0; !district && j <= 18; j += close ? 1 : 3) {
        const t = j / 18,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        beam(
          out,
          'metal',
          [x * 1.026, 6.52, z * 1.026],
          [x * 0.48, 10.72, z * 0.48],
          0.035,
          0.035,
          [0.45, 0.48, 0.47],
        );
      }
    }
    // Shallow sloping glazed roof strip visible in the owner's aerial views.
    face(
      out,
      'glass',
      [
        [-4.1, 7.25, 7.4],
        [3.9, 7.25, 7.4],
        [2.7, 9.2, 5.32],
        [-2.9, 9.2, 5.32],
      ],
      glass,
    );
    for (let i = 0; i <= 8; i += district ? 4 : 1)
      beam(out, 'metal', [-4.1 + i, 7.27, 7.42], [-2.9 + i * 0.7, 9.22, 5.34], 0.055, 0.055, dark);
  }
  function shaft(out) {
    cylinder(out, 'concrete', 7.5, 80.4, 3.6, concrete, 120);
    // Shared concrete carries formwork detail; closeup keeps actual lift joints.
    if (close)
      for (let y = 11.6; y < 68; y += 1.5)
        torus(out, 'concrete', [0, y, 0], 3.603, 0.014, [0.53, 0.53, 0.49]);
    // Representative radial maintenance doors, cable ladders and compact panels.
    for (let i = 0; i < 8; i++) {
      const o = transform(out, (i * tau) / 8);
      for (const y of platforms) {
        box(
          o,
          'metal',
          [-0.34, y + 0.31, 3.59],
          [0.34, y + 2.24, 3.66],
          i % 3 ? [0.39, 0.4, 0.36] : [0.4, 0.21, 0.2],
        );
        box(o, 'metal', [0.22, y + 1.17, 3.66], [0.25, y + 1.33, 3.73], light);
      }
      if (i % 2 === 0) {
        for (const x of [-0.2, 0.2])
          beam(o, 'metal', [x, 28, 3.76], [x, 66.8, 3.76], 0.045, 0.045, dark);
        for (let y = 28; !district && y < 66.8; y += close ? 0.36 : 1.08)
          beam(o, 'metal', [-0.2, y, 3.76], [0.2, y, 3.76], 0.025, 0.025, light);
      }
    }
  }
  function dish(out, angle, y, radius) {
    const o = transform(out, angle);
    if (district) {
      const p = [
        [-radius, y, 4.75],
        [0, y - radius, 4.75],
        [radius, y, 4.75],
        [0, y + radius, 4.75],
      ];
      face(o, 'metal', p, white);
      face(o, 'metal', [...p].reverse(), white);
      beam(o, 'metal', [0, y - 0.5, 3.65], [0, y - 0.5, 4.75], 0.09, 0.09, dark);
      return;
    }
    const segments = close ? 24 : 8;
    const z0 = 4.75,
      depth = radius * 0.2;
    // Shallow concave front and convex protective back, with an independent feed strut.
    const ring = (r, z) =>
      Array.from({ length: segments }, (_, i) => [
        Math.cos((-i * tau) / segments) * r,
        y + Math.sin((-i * tau) / segments) * r,
        z,
      ]);
    loft(
      o,
      'metal',
      [
        ring(0.025, z0 - depth),
        ring(radius * 0.4, z0 - depth * 0.84),
        ring(radius * 0.75, z0 - depth * 0.43),
        ring(radius, z0),
      ],
      white,
      { cap: false },
    );
    loft(
      o,
      'metal',
      [
        ring(radius, z0 - 0.045),
        ring(radius * 0.4, z0 - depth - 0.12),
        ring(0.025, z0 - depth - 0.17),
      ],
      [0.63, 0.65, 0.62],
    );
    if (close) {
      for (let i = 0; i < segments; i++) {
        const a = (i * tau) / segments,
          b = ((i + 1) * tau) / segments;
        beam(
          o,
          'metal',
          [Math.cos(a) * radius, y + Math.sin(a) * radius, z0],
          [Math.cos(b) * radius, y + Math.sin(b) * radius, z0],
          0.025,
          0.025,
          light,
        );
      }
    } else
      for (let i = 0; i < segments; i++) {
        const a = (i * tau) / segments,
          b = ((i + 1) * tau) / segments,
          p = (r, t) => [Math.cos(t) * r, y + Math.sin(t) * r, z0 + 0.002];
        face(
          o,
          'metal',
          [p(radius - 0.014, a), p(radius + 0.014, a), p(radius + 0.014, b), p(radius - 0.014, b)],
          light,
        );
      }
    beam(o, 'metal', [0, y - radius, 4.1], [0, y - radius, z0 + 0.4], 0.055, 0.055, dark);
    beam(o, 'metal', [0, y - radius, z0 + 0.4], [0, y, z0 + 0.48], 0.035, 0.035, light);
    if (close) sphere(o, 'metal', [0, y, z0 + 0.47], [0.09, 0.09, 0.16], dark, 12, 6);
    beam(o, 'metal', [0, y - 0.5, 3.65], [0, y - 0.5, 4.55], 0.09, 0.09, dark);
  }
  function servicePlatforms(out) {
    for (let level = 0; level < platforms.length; level++) {
      const y = platforms[level];
      cylinder(out, 'concrete', y, y + 0.23, 5.65, [0.52, 0.54, 0.52], 96);
      cylinder(out, 'metal', y - 0.1, y, 5.72, dark, 96);
      ringRail(out, y + 0.24, 5.5);
      for (let i = 0; i < (close ? 20 : district ? 4 : 8); i++)
        radialBeam(
          out,
          (i * tau) / (close ? 20 : district ? 4 : 8),
          y - 0.88,
          3.6,
          y - 0.08,
          5.45,
          0.075,
          dark,
        );
      const angles = level === 3 ? [0.2, 1.5, 2.8, 3.6, 4.9, 5.5] : [0.45, 1.7, 3.2, 4.5, 5.4];
      angles.forEach((a, i) => {
        dish(out, a + level * 0.15, y + 2.0 + (i % 3) * 0.68, 0.32 + ((level + i) % 4) * 0.29);
      });
      for (let i = 0; i < 10; i += district ? 2 : 1) {
        const o = transform(out, (i * tau) / 10 + level * 0.09);
        beam(o, 'metal', [0, y + 0.24, 4.04], [0, y + 5.6, 4.04], 0.05, 0.05, light);
        if (i % 2 === 0)
          box(o, 'metal', [-0.13, y + 3.2, 4.02], [0.13, y + 4.7, 4.2], [0.68, 0.7, 0.66]);
      }
    }
  }
  function restaurant(out) {
    cylinder(out, 'concrete', 66.7, 67.55, 5.76, [0.61, 0.61, 0.56], 96);
    const n = 12,
      offset = Math.PI / 12,
      y0 = 68.1,
      y1 = 77.2,
      r0 = 5.7,
      r1 = 8.7;
    loft(
      out,
      'metal',
      [radialRing(67.3, 5.76, 5.76, n, [0, 0], offset), radialRing(y0, r0, r0, n, [0, 0], offset)],
      dark,
    );
    loft(
      out,
      'glass',
      [radialRing(y0, r0, r0, n, [0, 0], offset), radialRing(y1, r1, r1, n, [0, 0], offset)],
      glass,
    );
    const point = (side, t, y, extra = 0) => {
      const a = offset - (side * tau) / n,
        b = offset - ((side + 1) * tau) / n,
        r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0) + extra;
      return [
        (Math.cos(a) * (1 - t) + Math.cos(b) * t) * r,
        y,
        (Math.sin(a) * (1 - t) + Math.sin(b) * t) * r,
      ];
    };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= 3; j += district ? 3 : 1)
        beam(
          out,
          'metal',
          point(i, j / 3, y0, 0.035),
          point(i, j / 3, y1, 0.035),
          j === 0 ? 0.13 : 0.055,
          j === 0 ? 0.13 : 0.055,
          light,
        );
      for (let j = 0; j <= 5; j += district ? 5 : 1) {
        const y = y0 + ((y1 - y0) * j) / 5;
        beam(
          out,
          'metal',
          point(i, 0, y, 0.04),
          point(i, 1, y, 0.04),
          j === 0 || j === 5 ? 0.12 : 0.05,
          j === 0 || j === 5 ? 0.12 : 0.05,
          light,
        );
      }
      radialBeam(out, offset - (i * tau) / n, 66.9, 3.63, 68.08, r0, 0.14, [0.41, 0.45, 0.44]);
    }
    loft(
      out,
      'metal',
      [
        radialRing(77.2, 8.78, 8.78, n, [0, 0], offset),
        radialRing(77.42, 8.78, 8.78, n, [0, 0], offset),
        radialRing(79.55, 5.2, 5.2, n, [0, 0], offset),
      ],
      white,
    );
    cylinder(out, 'metal', 79.55, 80.05, 5.18, white, 96);
    cylinder(out, 'concrete', 80.05, 82.0, 2.9, [0.64, 0.64, 0.57], 64);
    cylinder(out, 'metal', 82.0, 82.24, 3.05, light, 64);
    ringRail(out, 79.68, 4.7, 36, dark);
    // Roof seams and shallow rectangular roof lights.
    for (let i = 0; i < n; i += district ? 2 : 1)
      radialBeam(out, offset - (i * tau) / n, 77.43, 8.75, 79.57, 5.2, 0.045, [0.46, 0.49, 0.48]);
    for (let i = 0; i < 6; i++) {
      const o = transform(out, (i * tau) / 6);
      face(
        o,
        'glass',
        [
          [-0.45, 78.41, 7.12],
          [0.45, 78.41, 7.12],
          [0.39, 78.96, 6.17],
          [-0.39, 78.96, 6.17],
        ],
        glass,
      );
    }
  }
  function mast(out) {
    const levelHeights = district
      ? [82.15, 88, 94, 100, 106, 112, 118, 121]
      : [82.15, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112, 115, 118, 121];
    const r = (y) => (y < 94 ? 1.08 : y < 112 ? 1.08 - (y - 94) * 0.03 : 0.54 - (y - 112) * 0.04);
    for (let k = 1; k < levelHeights.length; k++) {
      const a = levelHeights[k - 1],
        b = levelHeights[k],
        r0 = r(a),
        r1 = r(b);
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + (i * tau) / 4,
          other = angle + tau / 4;
        const p = (ang, y, rr) => [Math.cos(ang) * rr, y, Math.sin(ang) * rr];
        beam(out, 'metal', p(angle, a, r0), p(angle, b, r1), 0.1, 0.1, dark);
        beam(out, 'metal', p(angle, a, r0), p(other, b, r1), 0.04, 0.04, [0.37, 0.4, 0.4]);
        if (!district)
          beam(out, 'metal', p(other, a, r0), p(angle, b, r1), 0.04, 0.04, [0.37, 0.4, 0.4]);
        beam(out, 'metal', p(angle, b, r1), p(other, b, r1), 0.055, 0.055, light);
      }
    }
    for (let y = 83; !district && y < 121; y += close ? 0.35 : 1.05)
      beam(out, 'metal', [-0.18, y, 0.72], [0.18, y, 0.72], 0.024, 0.024, light);
    for (const x of [-0.18, 0.18])
      beam(out, 'metal', [x, 82.2, 0.72], [x, 121, 0.72], 0.035, 0.035, dark);
    for (const [y, rr] of [
      [87, 1.55],
      [95.5, 1.4],
      [105, 1.1],
    ]) {
      cylinder(out, 'metal', y, y + 0.08, rr, dark, 32);
      ringRail(out, y + 0.09, rr * 0.9, 16);
      for (let i = 0; i < 3; i++) {
        const o = transform(out, (i * tau) / 3 + 0.1);
        beam(o, 'metal', [0, y, rr], [0, y + 4.7, rr], 0.055, 0.055, dark);
        box(o, 'metal', [-0.15, y + 1, rr], [0.15, y + 3.7, rr + 0.12], [0.51, 0.55, 0.55]);
      }
    }
    cylinder(out, 'metal', 120.8, 123.8, 0.1, light, 16);
    sphere(out, 'metal', [0, 123.85, 0], [0.14, 0.15, 0.14], [0.6, 0.1, 0.07], 16, 8);
  }
  function build(out) {
    base(out);
    shaft(out);
    servicePlatforms(out);
    restaurant(out);
    mast(out);
  }

  return { build };
}
export const tyholtDistrict = (out) => components('district').build(out);
export const tyholtStreet = (out) => components('street').build(out);
export const tyholtCloseup = (out) => components('closeup').build(out);
export function tyholtSkyline(out) {
  const o = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](slot, ref, p, n, uv, slot === 'glass' ? color : color.map((v) => v * 0.65)),
    ]),
  );
  const tau = Math.PI * 2,
    white = [0.79, 0.8, 0.75],
    light = [0.76, 0.78, 0.76],
    dark = [0.19, 0.23, 0.245],
    glass = [0.095, 0.145, 0.165],
    ring = (y, scale = 1) =>
      [...map.geometry.outline].reverse().map(([x, z]) => [x * scale, y, z * scale]),
    cyl = (slot, y0, y1, r, color, n = 8) =>
      loft(o, slot, [radialRing(y0, r, r, n), radialRing(y1, r, r, n)], color),
    line = (slot, a, b, w, color) => {
      const axis = normalize(b.map((v, i) => v - a[i])),
        u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
        v = cross(axis, u),
        r = (c) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([j, k]) => c.map((n, i) => n + ((u[i] * j + v[i] * k) * w) / 2));
      loft(o, slot, [r(a), r(b)], color, { cap: false });
    };
  loft(o, 'concrete', [ring(0), ring(6.5)], [0.45, 0.44, 0.4]);
  loft(o, 'metal', [ring(6.5, 1.025), ring(10.7, 0.48)], [0.69, 0.71, 0.69]);
  face(
    o,
    'glass',
    [
      [-4.1, 7.25, 7.4],
      [3.9, 7.25, 7.4],
      [2.7, 9.2, 5.32],
      [-2.9, 9.2, 5.32],
    ],
    glass,
  );
  cyl('concrete', 7.5, 80.4, 3.6, [0.66, 0.65, 0.6]);
  for (const [level, y] of [29, 37.3, 45.6, 53.9, 62.2].entries()) {
    cyl('concrete', y - 0.1, y + 0.23, 5.72, [0.52, 0.54, 0.52]);
    const angles = level === 3 ? [0.2, 1.5, 2.8, 3.6, 4.9, 5.5] : [0.45, 1.7, 3.2, 4.5, 5.4];
    for (const [i, a0] of angles.entries()) {
      const t = transform(o, a0 + level * 0.15),
        cy = y + 2 + (i % 3) * 0.68,
        r = 0.32 + ((level + i) % 4) * 0.29,
        p = [
          [-r, cy, 4.75],
          [0, cy - r, 4.75],
          [r, cy, 4.75],
          [0, cy + r, 4.75],
        ];
      face(t, 'metal', p, white);
      face(t, 'metal', [...p].reverse(), white);
    }
  }
  const offset = Math.PI / 12;
  loft(
    o,
    'metal',
    [
      radialRing(67.3, 5.76, 5.76, 12, [0, 0], offset),
      radialRing(68.1, 5.7, 5.7, 12, [0, 0], offset),
    ],
    dark,
  );
  loft(
    o,
    'glass',
    [
      radialRing(68.1, 5.7, 5.7, 12, [0, 0], offset),
      radialRing(77.2, 8.7, 8.7, 12, [0, 0], offset),
    ],
    glass,
  );
  for (let i = 0; i < 12; i++) {
    const a = offset - (i * tau) / 12;
    line(
      'metal',
      [Math.cos(a) * 5.735, 68.1, Math.sin(a) * 5.735],
      [Math.cos(a) * 8.735, 77.2, Math.sin(a) * 8.735],
      0.13,
      light,
    );
  }
  loft(
    o,
    'metal',
    [
      radialRing(77.2, 8.78, 8.78, 12, [0, 0], offset),
      radialRing(77.42, 8.78, 8.78, 12, [0, 0], offset),
      radialRing(79.55, 5.2, 5.2, 12, [0, 0], offset),
    ],
    white,
  );
  cyl('metal', 79.55, 80.05, 5.18, white);
  cyl('concrete', 80.05, 82, 2.9, [0.64, 0.64, 0.57]);
  cyl('metal', 82, 82.24, 3.05, light);
  for (let i = 0; i < 6; i++)
    face(
      transform(o, (i * tau) / 6),
      'glass',
      [
        [-0.45, 78.41, 7.12],
        [0.45, 78.41, 7.12],
        [0.39, 78.96, 6.17],
        [-0.39, 78.96, 6.17],
      ],
      glass,
    );
  const radius = (y) =>
      y < 94 ? 1.08 : y < 112 ? 1.08 - (y - 94) * 0.03 : 0.54 - (y - 112) * 0.04,
    p = (a, y) => [Math.cos(a) * radius(y), y, Math.sin(a) * radius(y)];
  for (let i = 0; i < 4; i++)
    for (const [a, b] of [
      [82.15, 94],
      [94, 112],
      [112, 121],
    ]) {
      const angle = Math.PI / 4 + (i * tau) / 4;
      line('metal', p(angle, a), p(angle, b), 0.1, dark);
    }
  for (const [a, b] of [
    [82.15, 94],
    [94, 103],
    [103, 112],
    [112, 121],
  ])
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * tau) / 4,
        next = angle + tau / 4;
      if (i % 2 === 0) line('metal', p(angle, a), p(next, b), 0.04, [0.37, 0.4, 0.4]);
      line('metal', p(angle, b), p(next, b), 0.055, light);
    }
  for (const [y, r] of [
    [87, 1.55],
    [95.5, 1.4],
    [105, 1.1],
  ])
    cyl('metal', y, y + 0.08, r, dark, 4);
  cyl('metal', 120.8, 123.8, 0.1, light, 4);
  fullBox(o, 'metal', [-0.1, 123.7, -0.1], [0.1, 124, 0.1], [0.6, 0.1, 0.07]);
}
