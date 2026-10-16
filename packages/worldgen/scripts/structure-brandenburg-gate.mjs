/** Original medium-fi Brandenburg Gate exterior. Map controls plan; Qualla photos control forms. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, c } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const cx = 0.43,
  cz = -1.3,
  axes = [-15.1, -9.25, -3.5, 3.5, 9.25, 15.1];
function column(o, x, z, y, h, r, small = false) {
  const count = small ? 16 : 40;
  const ring = (yy, rr) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2,
        rad = rr * (i % 2 ? 0.94 : 1);
      return [x + Math.cos(a) * rad, yy, z + Math.sin(a) * rad];
    });
  loft(
    o,
    'concrete',
    [
      ring(-2.5, r),
      ring(y, r),
      ring(y + 0.25, r),
      ring(y + h - 0.55, r * 0.82),
      radialRing(y + h - 0.27, r * 1.13, r * 1.13, count, [x, z]),
    ],
    c.sand,
  );
  B(o, 'concrete', x, y + h - 0.27, z, r * 2.55, 0.27, r * 2.55, 'sand');
}
function triangle(o, slot, p, color) {
  o.addConvexPolygon(slot, 'palette:#ffffff', p, normalFor(...p), (q) => [q[0], q[1]], c[color]);
  const back = p.toReversed();
  o.addConvexPolygon(
    slot,
    'palette:#ffffff',
    back,
    normalFor(...back),
    (q) => [q[0], q[1]],
    c[color],
  );
}
function pavilion(o, x, detail) {
  const z = 13.65;
  B(o, 'concrete', x, -2.5, z, 8.25, 11.5, 13.55, 'sand');
  B(o, 'concrete', x, 9, z, 12.4, 0.65, 17.8, 'sand');
  B(o, 'concrete', x, 9.65, z, 12.8, 0.32, 18.2, 'cream');
  // Copper gable and its shallow triangular front/back pediments.
  for (const sign of [-1, 1]) {
    const pts = [
      [x + sign * 6.4, 10, 4.3],
      [x + sign * 6.4, 10, 22.5],
      [x, 12.2, 22.5],
      [x, 12.2, 4.3],
    ];
    if (sign > 0) pts.reverse();
    quad(o, 'metal', pts, normalFor(...pts), c.bronze);
  }
  for (const zz of [4.3, 22.5]) {
    const p = [
      [x - 6.4, 10, zz],
      [x + 6.4, 10, zz],
      [x, 12.2, zz],
    ];
    triangle(o, 'concrete', p, 'sand');
    for (const [a, b] of [
      [p[0], p[2]],
      [p[2], p[1]],
    ])
      beam(o, 'concrete', a, b, 0.21, 0.26, c.cream);
    B(o, 'concrete', x, 9.93, zz, 13, 0.2, 0.35, 'cream');
  }
  for (const dx of [-5.2, -1.73, 1.73, 5.2])
    for (const zz of [4.6, 22.2]) {
      if (detail) column(o, x + dx, zz, 0.1, 8.9, 0.55, true);
      else B(o, 'concrete', x + dx, -2.5, zz, 1.05, 11.5, 1.05, 'sand');
    }
  if (detail) {
    for (const sign of [-1, 1])
      for (const zz of [7.7, 11.7, 15.7, 19.7]) column(o, x + sign * 5.2, zz, 0.1, 8.9, 0.55, true);
    for (const zz of [20.47, 6.83]) {
      B(o, 'metal', x, 0.15, zz, 2.2, 3.7, 0.08, 'dark');
      B(o, 'concrete', x, 3.85, zz, 2.9, 0.22, 0.5, 'cream');
      B(o, 'glass', x, 5.7, zz, 1.65, 1.65, 0.06, 'glass');
    }
  }
  // Rear side colonnade joins the main gate without blocking the lateral passage.
  B(o, 'concrete', x, 9.8, -1.1, 15.75, 0.7, 10.7, 'sand');
  for (const sign of [-1, 1]) {
    const pts = [
      [x - 7.95, 10.5, -1.1 + sign * 5.425],
      [x + 7.95, 10.5, -1.1 + sign * 5.425],
      [x + 7.95, 11.9, -1.1],
      [x - 7.95, 11.9, -1.1],
    ];
    if (sign < 0) pts.reverse();
    quad(o, 'metal', pts, normalFor(...pts), c.bronze);
  }
  for (const xx of [x - 7.95, x + 7.95])
    triangle(
      o,
      'concrete',
      [
        [xx, 10.5, -6.525],
        [xx, 10.5, 4.325],
        [xx, 11.9, -1.1],
      ],
      'sand',
    );
  for (const dx of detail ? [-6.7, 0, 6.7] : [-6.7, 6.7])
    for (const zz of detail ? [-5.6, 3.4] : [-5.6]) {
      if (detail) column(o, x + dx, zz, 0.1, 9.7, 0.55, true);
      else B(o, 'concrete', x + dx, -2.5, zz, 1.05, 12.3, 1.05, 'sand');
    }
}
function horse(o, x, index) {
  const z = cz + 0.4;
  sphere(o, 'metal', [x, 22.0, z], [0.52, 0.67, 1.15], c.bronze, 12, 8);
  loft(
    o,
    'metal',
    [
      radialRing(22.15, 0.4, 0.55, 12, [x, z + 0.75]),
      radialRing(23, 0.28, 0.43, 12, [x, z + 1.12]),
      radialRing(23.6, 0.27, 0.32, 12, [x, z + 1.32]),
    ],
    c.bronze,
  );
  sphere(o, 'metal', [x, 23.62, z + 1.56], [0.29, 0.39, 0.53], c.bronze, 10, 6);
  sphere(o, 'metal', [x, 23.43, z + 1.98], [0.24, 0.22, 0.26], c.bronze, 10, 5);
  for (const dx of [-0.32, 0.32])
    for (const dz of [-0.65, 0.65]) {
      const raised = dz > 0 && ((index % 2 === 0 && dx < 0) || (index % 2 !== 0 && dx > 0));
      const knee = [x + dx, raised ? 21.65 : 21.2, z + dz + (raised ? 0.55 : 0.12)],
        hoof = [x + dx, raised ? 21.1 : 20.05, z + dz + (raised ? 0.45 : 0)];
      beam(o, 'metal', [x + dx, 21.8, z + dz], knee, 0.16, 0.2, c.bronze);
      beam(o, 'metal', knee, hoof, 0.12, 0.14, c.bronze);
      B(o, 'metal', hoof[0], hoof[1] - 0.07, hoof[2] + 0.05, 0.19, 0.14, 0.27, 'bronze');
    }
  for (const dx of [-0.17, 0.17])
    beam(o, 'metal', [x + dx, 23.9, z + 1.4], [x + dx, 24.2, z + 1.35], 0.11, 0.1, c.bronze);
  beam(o, 'metal', [x, 22.2, z - 1.05], [x, 21, z - 1.6], 0.15, 0.18, c.bronze);
  beam(o, 'metal', [x, 23, z + 1.4], [cx, 22.5, cz - 1.6], 0.035, 0.04, c.bronze);
}
function sculpture(o, detail) {
  if (!detail) {
    for (const dx of [-2.1, -0.7, 0.7, 2.1]) {
      B(o, 'metal', cx + dx, 20, cz + 0.5, 0.75, 2.6, 2.2, 'bronze');
      B(o, 'metal', cx + dx, 22.6, cz + 1.3, 0.55, 1.2, 0.75, 'bronze');
    }
    B(o, 'metal', cx, 20, cz - 1.8, 2.5, 3.9, 2, 'bronze');
    B(o, 'metal', cx - 0.5, 23.9, cz - 1.4, 0.12, 2.1, 0.12, 'bronze');
    return;
  }
  [-2.1, -0.7, 0.7, 2.1].forEach((dx, i) => {
    horse(o, cx + dx, i);
  });
  // Two spoked wheels and the curved front of the chariot.
  for (const x of [cx - 1.5, cx + 1.5]) {
    const p = Array.from({ length: 16 }, (_, i) => [
      x,
      20.8 + Math.sin((i / 16) * Math.PI * 2) * 0.72,
      cz - 1.5 + Math.cos((i / 16) * Math.PI * 2) * 0.72,
    ]);
    for (let i = 0; i < 16; i++) {
      beam(o, 'metal', p[i], p[(i + 1) % 16], 0.09, 0.09, c.bronze);
      if (i % 2 === 0) beam(o, 'metal', [x, 20.8, cz - 1.5], p[i], 0.045, 0.045, c.bronze);
    }
  }
  B(o, 'metal', cx, 20.1, cz - 1.5, 2.8, 0.25, 2.5, 'bronze');
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI,
      b = -Math.PI / 2 + ((i + 1) / 10) * Math.PI;
    quad(
      o,
      'metal',
      [
        [cx + Math.sin(a) * 1.35, 20.3, cz - 1.8 + Math.cos(a) * 1.3],
        [cx + Math.sin(b) * 1.35, 20.3, cz - 1.8 + Math.cos(b) * 1.3],
        [cx + Math.sin(b) * 1.35, 22.5, cz - 1.8 + Math.cos(b) * 1.3],
        [cx + Math.sin(a) * 1.35, 22.5, cz - 1.8 + Math.cos(a) * 1.3],
      ],
      [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
      c.bronze,
    );
  }
  loft(
    o,
    'metal',
    [
      radialRing(21.5, 0.55, 0.4, 12, [cx, cz - 1.65]),
      radialRing(23.6, 0.27, 0.25, 12, [cx, cz - 1.65]),
    ],
    c.bronze,
  );
  sphere(o, 'metal', [cx, 23.93, cz - 1.65], [0.27, 0.34, 0.26], c.bronze, 12, 8);
  beam(o, 'metal', [cx - 0.2, 23.2, cz - 1.6], [cx - 0.65, 24, cz - 1.5], 0.15, 0.19, c.bronze);
  beam(o, 'metal', [cx + 0.25, 23.2, cz - 1.6], [cx + 0.7, 22.6, cz - 0.7], 0.15, 0.19, c.bronze);
  for (const sign of [-1, 1])
    triangle(
      o,
      'metal',
      [
        [cx + sign * 0.2, 22, cz - 1.85],
        [cx + sign * 1.05, 24.1, cz - 1.85],
        [cx + sign * 0.65, 22, cz - 2.1],
      ],
      'bronze',
    );
  beam(o, 'metal', [cx - 0.65, 22.4, cz - 1.5], [cx - 0.65, 25.7, cz - 1.5], 0.07, 0.07, c.bronze);
  const x = cx - 0.65,
    y = 25.05,
    z = cz - 1.5;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      b = ((i + 1) / 16) * Math.PI * 2;
    beam(
      o,
      'metal',
      [x + Math.cos(a) * 0.34, y + Math.sin(a) * 0.4, z],
      [x + Math.cos(b) * 0.34, y + Math.sin(b) * 0.4, z],
      0.07,
      0.07,
      c.bronze,
    );
  }
  B(o, 'metal', x, y - 0.3, z, 0.11, 0.6, 0.1, 'bronze');
  B(o, 'metal', x, y - 0.06, z, 0.54, 0.12, 0.1, 'bronze');
  sphere(o, 'metal', [x, 25.65, z], [0.13, 0.23, 0.16], c.bronze, 8, 6);
  for (const sign of [-1, 1])
    triangle(
      o,
      'metal',
      [
        [x, 25.5, z],
        [x + sign * 0.7, 26.1, z],
        [x + sign * 0.48, 25.48, z],
      ],
      'bronze',
    );
}
function gate(o, detail) {
  for (const dx of axes) {
    const x = cx + dx;
    B(o, 'concrete', x, -2.5, cz, 1.65, 16, 8.8, 'sand');
    for (const z of [cz - 5, cz + 5]) {
      if (detail) column(o, x, z, 0, 13.4, 1);
      else B(o, 'concrete', x, -2.5, z, 1.8, 15.9, 1.8, 'sand');
    }
  }
  for (const [y, w, h, d] of [
    [13.4, 34.5, 0.95, 12.4],
    [14.35, 35, 1.35, 12.8],
    [15.7, 35.8, 0.45, 13.3],
    [16.15, 36.3, 0.22, 13.8],
    [16.37, 34.9, 2.7, 12.1],
    [19.07, 35.5, 0.28, 12.7],
    [19.35, 10.8, 0.35, 12.8],
    [19.7, 9.4, 0.3, 7],
  ])
    B(o, 'concrete', cx, y, cz, w, h, d, 'sand');
  if (detail) {
    for (const sign of [-1, 1]) {
      const z = cz + sign * 6.45;
      for (let i = 0; i < 25; i++) {
        const x = cx - 16.3 + i * 1.36;
        for (const dd of [-0.12, 0, 0.12])
          B(o, 'concrete', x + dd, 14.55, z, 0.055, 0.95, 0.2, 'cream');
      }
      B(o, 'concrete', cx, 16.78, z, 9.65, 1.9, 0.18, 'cream');
      // Low relief figures suggest the carved panel at this scale; no borrowed image texture.
      for (let i = 0; i < 11; i++) {
        const x = cx - 4.3 + i * 0.86;
        B(o, 'concrete', x, 17, z + sign * 0.14, 0.26, 1.05, 0.12, 'sand');
        sphere(o, 'concrete', [x, 18.2, z + sign * 0.2], [0.14, 0.17, 0.1], c.sand, 6, 4);
        beam(
          o,
          'concrete',
          [x, 17.75, z + sign * 0.2],
          [x + (i % 2 ? 0.36 : -0.36), 18.05, z + sign * 0.2],
          0.1,
          0.12,
          c.sand,
        );
      }
      for (const side of [-1, 1])
        for (let k = 0; k < 5; k++)
          B(
            o,
            'concrete',
            cx + side * (10.8 + k * 0.55),
            16.55 + k * 0.34,
            z - sign * 0.18,
            11.2 - k * 2.0,
            0.1,
            0.25,
            'cream',
          );
      for (let i = 0; i < 25; i++)
        B(o, 'concrete', cx - 16.4 + i * 1.36, 18.85, z, 0.3, 0.27, 0.42, 'cream');
    }
  }
  pavilion(o, -25.65, detail);
  pavilion(o, 25.55, detail);
  sculpture(o, detail);
}
export function brandenburg(o) {
  gate(o, true);
}
export function brandenburgSkyline(o) {
  gate(o, false);
}
export const brandenburgModel = {
  id: 'brandenburg_gate',
  recipe: 'structure-brandenburg-gate.mjs',
  key: 'brandenburg_gate',
  cell: 'u3/u33',
  title: 'Brandenburg Gate',
  brief:
    'Five open passages and paired fluted Doric columns, level sandstone attic with central relief panel, projecting pedimented guardhouses, copper roofs and east-facing four-horse quadriga.',
  camera: [65, 35, 93],
  build: brandenburg,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Central east passage reference [0.43,5.3] on independent host-terrain samples; individual piers and guardhouses extend to -2.5 m across the coarse source relief without a slab blocking the passages.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-brandenburg-gate.mjs',
    level: 'skyline',
    export: 'brandenburgSkyline',
    errorMeters: 0.6,
    caps: {
      district: { triangles: 4000, errorMeters: 0.3, prune: true },
      street: { triangles: 16000, errorMeters: 0.16, prune: true },
    },
  },
  limitations: [
    'Original medium-fi exterior; dimensions follow generalized Protomaps controls and photographic estimates, not a measured architectural survey.',
    'Doric fluting, triglyph rhythm, shallow relief figures, chariot, four horses, wings and eagle/wreath emblem are simplified original geometry. Fine carved figures, reins and facial anatomy are not exact replicas.',
    'Guardhouse cores, projecting porticoes and connecting colonnades are included; interiors, adjacent city blocks and freestanding street furniture are omitted.',
    'Warm smooth shared mineral material represents cut sandstone without false small masonry courses across the carved columns.',
    'Local Qualla references are inspected but not embedded or redistributed. Terrain/contact evidence is coarse host data, not surveyed ground levels.',
  ],
};
