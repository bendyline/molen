/** 'temple_of_romulus': Romulus's standing rotunda, layered roof, bronze portal and curved wings. */
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingShape, prepareOpening } from './authored-wall-openings.mjs';
import { buildCorinthianColumn } from './corinthian-column-geometry.mjs';
import { box, loft, prism } from './khmer-structure-geometry.mjs';

export function buildRomulusRotunda(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    F = r.floorY,
    grade = (x, z) => sample(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    n = [12, 20, 32, 48][detail],
    center = r.body.center,
    ring = (radius, count = n, offset = 0) =>
      Array.from({ length: count }, (_, i) => {
        const a = (i * Math.PI * 2) / count + offset;
        return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius];
      });
  const cut = (holes) => {
    const out = openingBuilder(
      { addTriangle: (role, _ref, ps, normal) => f(role, ps, normal) },
      holes.map((h) => prepareOpening(h, 0, detail)),
    );
    return (role, ps, normal) => {
      for (let i = 1; i < ps.length - 1; i++) {
        const tri = [ps[0], ps[i], ps[i + 1]];
        if (Math.hypot(...normalFor(...tri)) > 0.5)
          out.addTriangle(role, 'palette:#ffffff', tri, normal, [], []);
      }
    };
  };
  function lathe(role, profile, count = n, cap = true, x = center[0], z = center[1]) {
    const rings = profile.map(([y, radius]) =>
      Array.from({ length: count }, (_, i) => [
        x + Math.cos((i * Math.PI * 2) / count) * radius,
        F + y,
        z + Math.sin((i * Math.PI * 2) / count) * radius,
      ]),
    );
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count,
          a = ((i + 0.5) * Math.PI * 2) / count;
        f(
          role,
          [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
          [Math.cos(a), profile[k][1] - profile[k + 1][1], Math.sin(a)],
        );
      }
    if (cap) f(role, rings.at(-1), [0, 1, 0]);
  }
  const entry = {
      center: [0, 6.7],
      axis: [1, 0],
      width: r.portal.width,
      shape: 'rect',
      bottom: F + 0.08,
      height: r.portal.height,
      depth: 5.6,
    },
    body = cut([entry]);
  prism(f, 'wall', { outline: ring(7.25) }, r.baseY, F);
  prism(
    body,
    'wall',
    { outline: ring(r.body.radius), holes: [ring(r.body.radius - 0.65)] },
    F,
    F + r.body.height,
  );
  // Brick opening reveals remain recessed behind the separately modeled closed bronze leaves.
  for (const sign of [-1, 1]) box(f, 'wall', sign * 1.75, F, 6.45, 0.65, 5.8, 3.3);
  box(f, 'wall', 0, F + 4.88, 6.5, 4.15, 0.92, 3.3);
  if (detail > 0)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n,
        mid = (a + b) / 2;
      if (!((mid > 0.1 && mid < 1.38) || (mid > 1.67 && mid < 3.65) || (mid > 5.4 && mid < 6.2)))
        continue;
      const low = 0.9 + (i % 7) * 0.11,
        hi = 9.6 + ((i * 5) % 7) * 0.11,
        p = (a, y) => [
          center[0] + Math.cos(a) * (r.body.radius + 0.018),
          F + y,
          center[1] + Math.sin(a) * (r.body.radius + 0.018),
        ];
      f(
        'plaster',
        [p(a, low), p(b, low + 0.11), p(b, hi), p(a, hi - 0.18)],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  // Concentric tiled roof profile, not a restored hemispherical ancient roof.
  lathe(
    'roof',
    [
      [11.4, 7.65],
      [11.55, 7.68],
      [12.15, 6.85],
      [12.28, 6.86],
      [12.8, 5.95],
      [12.94, 5.98],
      [14.6, 1.82],
    ],
    n,
    false,
  );
  if (detail > 0)
    for (const [y, rad] of [
      [11.38, 7.72],
      [12.13, 6.91],
    ])
      lathe(
        'plaster',
        [
          [y, rad],
          [y + 0.15, rad],
          [y + 0.22, rad - 0.16],
        ],
        n,
        false,
      );
  const L = r.lantern,
    lr = ring(L.radius, 8, Math.PI / 8),
    windows = [];
  for (let i = 0; i < 8; i++) {
    const A = lr[i],
      B = lr[(i + 1) % 8],
      len = Math.hypot(B[0] - A[0], B[1] - A[1]),
      axis = [(B[0] - A[0]) / len, (B[1] - A[1]) / len],
      normal = [axis[1], -axis[0]],
      h = {
        center: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2],
        axis,
        normal,
        width: 0.89,
        shape: 'round',
        bottom: F + L.windowBottom,
        spring: L.windowSpring - L.windowBottom,
        height: L.windowTop - L.windowBottom,
        depth: 1.15,
      };
    windows.push(h);
  }
  prism(
    detail === 0 ? f : cut(windows),
    'wall',
    { outline: lr, holes: detail === 0 ? [] : [ring(1.48, 8, Math.PI / 8)] },
    F + L.bottom,
    F + L.top,
  );
  for (const h of windows) {
    const p = prepareOpening(h, 0, detail),
      offset = detail === 0 ? -0.012 : 0.29,
      shape = openingShape(h, detail);
    f(
      'inset',
      shape.map(([u, y]) => p.point(u, y, offset)),
      [h.normal[0], 0, h.normal[1]],
    );
    if (detail > 0)
      for (let i = 0; i < shape.length; i++) {
        const j = (i + 1) % shape.length;
        f(
          'wall',
          [
            p.point(...shape[i], 0),
            p.point(...shape[j], 0),
            p.point(...shape[j], offset),
            p.point(...shape[i], offset),
          ],
          [
            (shape[j][1] - shape[i][1]) * h.axis[0],
            shape[i][0] - shape[j][0],
            (shape[j][1] - shape[i][1]) * h.axis[1],
          ],
        );
      }
    if (detail >= 2) {
      const outer = openingShape(
        {
          ...h,
          width: h.width + 0.18,
          height: h.height + 0.1,
          bottom: h.bottom - 0.06,
          spring: h.spring + 0.06,
        },
        detail,
      );
      for (let i = 0; i < shape.length; i++) {
        const j = (i + 1) % shape.length;
        f(
          'trim',
          [
            p.point(...outer[i], -0.014),
            p.point(...outer[j], -0.014),
            p.point(...shape[j], -0.014),
            p.point(...shape[i], -0.014),
          ],
          [h.normal[0], 0, h.normal[1]],
        );
      }
    }
  }
  const domeRings = detail === 0 ? 4 : detail === 1 ? 5 : 8;
  const dome = Array.from({ length: domeRings }, (_, i) => {
    const angle = (i * Math.PI) / 2 / (domeRings - 1);
    return [17.1 + Math.sin(angle) * 1.65, Math.cos(angle) * 1.96];
  });
  lathe('metal', dome, detail === 0 ? 8 : detail === 1 ? 12 : 24, false);
  box(f, 'metal', 0, F + 18.73, -1.9, 0.1, 0.27, 0.1);
  if (detail >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      for (let j = 0; j < dome.length - 1; j++) {
        const A = dome[j],
          B = dome[j + 1],
          p = (q, d) => [
            Math.cos(a + d) * (q[1] + 0.018),
            F + q[0],
            -1.9 + Math.sin(a + d) * (q[1] + 0.018),
          ];
        f(
          'metal',
          [p(A, -0.005), p(A, 0.005), p(B, 0.005), p(B, -0.005)],
          [Math.cos(a), 0.1, Math.sin(a)],
        );
      }
    }
  // Curved lower facade is built along the mapped outer edge, with shallow blind niches.
  for (let i = 0; i < r.wingPath.length - 1; i++) {
    const A = r.wingPath[i],
      B = r.wingPath[i + 1],
      dx = B[0] - A[0],
      dz = B[1] - A[1],
      len = Math.hypot(dx, dz);
    if (len < 0.2) continue;
    const axis = [dx / len, dz / len],
      normal = [-axis[1], axis[0]],
      mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2],
      central = Math.abs(mid[0]) < 4,
      top = F + (central ? 5.75 : 3.5 + (i % 2) * 0.2),
      base = Math.min(grade(...A), grade(...B)) - 0.6,
      shape = {
        outline: [
          A,
          B,
          [B[0] - normal[0] * 0.65, B[1] - normal[1] * 0.65],
          [A[0] - normal[0] * 0.65, A[1] - normal[1] * 0.65],
        ],
      },
      holes = [entry];
    if (detail > 0 && len > 1.7 && Math.abs(mid[0]) > 3.7 && Math.abs(mid[0]) < 7.5)
      holes.push({
        center: [mid[0] - normal[0] * 0.17, mid[1] - normal[1] * 0.17],
        axis,
        width: Math.min(1.05, len - 0.35),
        shape: 'round',
        bottom: F + 0.55,
        spring: 1.15,
        height: 1.85,
        depth: 0.45,
      });
    prism(cut(holes), 'wall', shape, base, top);
    for (const h of holes.slice(1)) {
      const p = prepareOpening(h, 0, detail),
        shape = p.ring;
      f(
        'wall',
        shape.map(([u, y]) => p.point(u, y, -0.225)),
        [normal[0], 0, normal[1]],
      );
      for (let j = 0; j < shape.length; j++) {
        const k = (j + 1) % shape.length;
        f(
          'wall',
          [
            p.point(...shape[j], 0.17),
            p.point(...shape[k], 0.17),
            p.point(...shape[k], -0.225),
            p.point(...shape[j], -0.225),
          ],
          [
            (shape[k][1] - shape[j][1]) * axis[0],
            shape[j][0] - shape[k][0],
            (shape[k][1] - shape[j][1]) * axis[1],
          ],
        );
      }
    }
  }
  const B = (role, x, y, z, w, h, d) => box(f, role, x, F + y, z, w, h, d);
  B('trim', 0, -0.16, 7.93, 3.3, 0.16, 0.54);
  const portalZ = r.portal.center[1],
    opening = r.portal.width / 2;
  // Pale nested stone frame and entablature around a genuine brick aperture.
  for (let i = 0; i < (detail === 0 ? 1 : 3); i++) {
    const t = detail === 0 ? 0.28 : 0.12,
      x = opening + 0.15 + i * 0.14,
      depth = portalZ + 0.02 + i * 0.025;
    for (const sign of [-1, 1]) B('trim', sign * x, 0.03, depth, t, 4.94 + i * 0.13, 0.25);
    B('trim', 0, 4.85 + i * 0.14, depth, 2 * x + t, 0.13, 0.26);
  }
  for (const [y, w, h, d] of [
    [5.2, 4.9, 0.18, 0.78],
    [5.38, 5.04, 0.43, 0.86],
    [5.81, 5.3, 0.16, 1.02],
    [5.97, 5.42, 0.16, 1.15],
  ])
    B('trim', 0, y, portalZ - 0.05, w, h, d);
  if (detail >= 2) {
    for (let i = 0; i < 24; i++)
      B('trim', -2.42 + (i * 4.84) / 23, 5.7, portalZ + 0.42, 0.09, 0.15, 0.12);
    for (const sign of [-1, 1])
      for (let i = 0; i < 26; i++)
        B('trim', sign * 1.68, 0.14 + i * 0.175, portalZ + 0.2, 0.065, 0.065, 0.06);
  }
  // Closed leaves are a static exterior state, with modeled recesses, panels and studs.
  const doorZ = portalZ + r.portal.doorDepth;
  for (const sign of [-1, 1]) {
    B('bronze', sign * (opening / 2 + 0.012), 0.08, doorZ, opening - 0.024, 4.73, 0.12);
    if (detail > 0)
      for (const [y, h] of [
        [0.27, 2.42],
        [2.9, 1.53],
      ]) {
        const x = sign * (opening / 2 + 0.012),
          w = opening - 0.28;
        for (const d of [-1, 1]) B('bronze', x + (d * w) / 2, y, doorZ + 0.085, 0.065, h, 0.06);
        for (const dy of [0, h]) B('bronze', x, y + dy, doorZ + 0.085, w + 0.06, 0.065, 0.06);
      }
    if (detail >= 2)
      for (let i = 0; i < 16; i++)
        for (const side of [-1, 1])
          B(
            'bronze',
            sign * (opening / 2 + 0.012) + side * (opening / 2 - 0.07),
            0.16 + i * 0.29,
            doorZ + 0.09,
            0.055,
            0.055,
            0.05,
          );
  }
  if (detail >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6,
        p = (a, rad, depth) => [
          -0.17 + Math.cos(a) * rad,
          F + 1.4 + Math.sin(a) * rad,
          doorZ + depth,
        ];
      f(
        'bronze',
        [p(a, 0.14, 0.18), p(b, 0.14, 0.18), p(b, 0.1, 0.18), p(a, 0.1, 0.18)],
        [0, 0, 1],
      );
      f(
        'bronze',
        [p(a, 0.14, 0.11), p(b, 0.14, 0.11), p(b, 0.14, 0.18), p(a, 0.14, 0.18)],
        [Math.cos(a), Math.sin(a), 0],
      );
      f(
        'bronze',
        [p(a, 0.1, 0.18), p(b, 0.1, 0.18), p(b, 0.1, 0.11), p(a, 0.1, 0.11)],
        [-Math.cos(a), -Math.sin(a), 0],
      );
    }
  function column(x, z, y, height, shaftRole = 'trim', capital = true) {
    if (detail >= 2 && capital) {
      const sx = (height / 15.2) * 0.79,
        sy = height / 15.2;
      buildCorinthianColumn(
        (role, ps, normal) => {
          if (role === 'shaft') return;
          f(
            'trim',
            ps.map(([u, v, w]) => [x + u * sx, y + v * sy, z + w * sx]),
            [normal[0] / sx, normal[1] / sy, normal[2] / sx],
          );
        },
        0,
        0,
        detail,
        0,
      );
      const sides = detail === 2 ? 16 : 24;
      loft(
        f,
        shaftRole,
        x,
        z,
        [
          [0.74, 0.785],
          [3.5, 0.8],
          [7, 0.77],
          [10.8, 0.71],
          [13.2, 0.66],
        ].map(([h, radius]) => [y + h * sy, radius * sx * 2]),
        false,
        (w) =>
          Array.from({ length: sides }, (_, i) => [
            (Math.cos((i * Math.PI * 2) / sides) * w) / 2,
            (Math.sin((i * Math.PI * 2) / sides) * w) / 2,
          ]),
      );
      return;
    }
    const sides = detail === 0 ? 6 : 8,
      rad = height > 6 ? 0.42 : height > 3 ? 0.25 : 0.45;
    loft(
      f,
      shaftRole,
      x,
      z,
      [
        [y, rad * 2],
        [y + height - (capital ? 0.3 : 0), rad * 1.75],
      ],
      false,
      (w) =>
        Array.from({ length: sides }, (_, i) => [
          (Math.cos((i * Math.PI * 2) / sides) * w) / 2,
          (Math.sin((i * Math.PI * 2) / sides) * w) / 2,
        ]),
    );
    if (detail > 0) box(f, 'trim', x, y - 0.08, z, rad * 2.55, 0.16, rad * 2.55);
    if (capital) box(f, 'trim', x, y + height - 0.3, z, rad * 2.9, 0.3, rad * 2.9);
  }
  for (const sign of [-1, 1]) column(sign * 2.08, portalZ + 0.32, F + 0.16, 5.1, 'porphyry');
  for (const part of r.externalColumns) {
    const [x, z] = part.center,
      y = grade(x, z) + 0.07;
    box(f, 'trim', x, y - 0.65, z, 1.3, 0.73, 1.3);
    column(x, z, y + 0.08, part.height, 'trim', part.capital);
  }
  const steps = detail === 0 ? 3 : 5,
    front = 12.1,
    back = 8.2,
    bottom = grade(0, front) + 0.02;
  for (let i = 0; i < steps; i++) {
    const z = front - ((i + 0.5) * (front - back)) / steps,
      top = bottom + ((F - bottom) * (i + 1)) / steps,
      low = Math.min(grade(0, z) - 0.4, bottom - 0.3);
    box(f, 'wall', 0, low, z, 3.3, top - low, (front - back) / steps + 0.005);
  }
}
