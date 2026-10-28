/** Photo-led faceted sculpture ensembles. Poses and robes are modeled, not billboarded. */
import {
  beam,
  beamPath,
  cross,
  loft,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

function limbPath(o, slot, points, width, color, detail) {
  const sides = detail >= 3 ? 12 : detail >= 2 ? 8 : 6;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      axis = normalize(b.map((v, j) => v - a[j]));
    const across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
      other = cross(axis, across);
    const ring = (p, r) =>
      Array.from({ length: sides }, (_, j) => {
        const t = (j * Math.PI * 2) / sides;
        return p.map((v, k) => v + r * (Math.cos(t) * across[k] + Math.sin(t) * other[k]));
      });
    loft(o, slot, [ring(a, width / 2), ring(b, width * 0.44)], color);
  }
}
function robe(o, center, height, width, color, detail) {
  const [x, y, z] = center,
    sides = detail >= 3 ? 16 : detail === 2 ? 10 : 6;
  const profiles =
    detail >= 2
      ? [
          [0, 1],
          [0.1, 0.94],
          [0.38, 0.77],
          [0.67, 0.65],
          [0.87, 0.86],
          [1, 0.66],
        ]
      : [
          [0, 1],
          [0.6, 0.65],
          [1, 0.7],
        ];
  const rings = profiles.map(([t, r], j) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i * Math.PI * 2) / sides,
        fold = 1 + (detail >= 2 ? 0.09 : 0) * Math.cos(a * 6 + t * 2);
      return [
        x + Math.cos(a) * width * r * fold,
        y + t * height,
        z + Math.sin(a) * width * r * 0.62 * fold + (j === 0 ? 0.08 : 0),
      ];
    }),
  );
  loft(o, 'sculpture', rings, color);
}
function oval(o, center, radius, color, detail) {
  sphere(
    o,
    'sculpture',
    center,
    radius,
    color,
    detail >= 3 ? 16 : detail === 2 ? 10 : 6,
    detail >= 3 ? 10 : detail === 2 ? 6 : 4,
  );
}
function hand(o, p, color, detail, raised = false) {
  oval(o, p, [0.06, 0.095, 0.045], color, detail);
  if (detail >= 3)
    for (let i = 0; i < 4; i++) {
      const x = p[0] - 0.034 + i * 0.022;
      beam(
        o,
        'sculpture',
        [x, p[1] + 0.025, p[2] - 0.008],
        [x, p[1] + (raised ? 0.16 : 0.095), p[2] - 0.018],
        0.018,
        0.022,
        color,
      );
    }
}
function head(o, p, color, detail, { veil = false, hat = false, tilt = 0 } = {}) {
  oval(o, p, [0.145, 0.19, 0.13], color, detail);
  if (detail >= 2) {
    const [x, y, z] = p;
    // A shallow face plane, projecting nose, lips and brows remain legible nearby.
    oval(o, [x, y + 0.01, z + 0.116], [0.105, 0.12, 0.028], color, detail === 3 ? 2 : 1);
    oval(o, [x + tilt, y - 0.005, z + 0.157], [0.03, 0.058, 0.055], color, 1);
    for (const sign of [-1, 1])
      beam(
        o,
        'sculpture',
        [x + sign * 0.025, y + 0.062, z + 0.139],
        [x + sign * 0.095, y + 0.05, z + 0.132],
        0.018,
        0.018,
        color,
      );
    beam(
      o,
      'sculpture',
      [x - 0.043, y - 0.084, z + 0.143],
      [x + 0.043, y - 0.087, z + 0.143],
      0.013,
      0.018,
      color,
    );
    if (detail >= 3)
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        oval(
          o,
          [x + Math.cos(a) * 0.132, y + 0.04 + Math.sin(a) * 0.118, z - 0.026],
          [0.045, 0.06, 0.065],
          color,
          1,
        );
      }
  }
  if (veil) {
    const sides = detail >= 2 ? 10 : 6;
    const rings = [
      [-0.37, 0.23, 0.15],
      [0.02, 0.18, 0.16],
      [0.2, 0.1, 0.09],
    ].map(([dy, rx, rz]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (-i * Math.PI * 2) / sides;
        return [p[0] + Math.cos(a) * rx, p[1] + dy, p[2] - 0.1 + Math.sin(a) * rz];
      }),
    );
    loft(o, 'sculpture', rings, color);
  }
  if (hat) {
    box(
      o,
      'sculpture',
      [p[0] - 0.15, p[1] + 0.11, p[2] - 0.14],
      [p[0] + 0.15, p[1] + 0.27, p[2] + 0.13],
      color,
    );
    if (detail >= 2)
      for (const sign of [-1, 1])
        beam(
          o,
          'sculpture',
          [p[0] + sign * 0.13, p[1] + 0.22, p[2] - 0.13],
          [p[0] + sign * 0.13, p[1] + 0.32, p[2] + 0.09],
          0.055,
          0.035,
          color,
        );
  }
}
function figure(o, p, height, color, detail, pose = {}) {
  const [x, y, z] = p,
    s = height / 1.8;
  const wrap = {};
  // Local sculpting dimensions use a common adult scale; children retain their own proportions.
  for (const key of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrap[key] = (slot, ref, points, n, uv, tint) =>
      o[key](
        slot,
        ref,
        points.map((q) => [x + q[0] * s, y + q[1] * s, z + q[2] * s]),
        n,
        uv,
        tint,
      );
  const q = wrap;
  robe(q, [0, 0, 0], 1.42, 0.32, color, detail);
  oval(q, [0, 1.35, 0], [0.34, 0.2, 0.18], color, detail);
  oval(q, [0, 1.53, 0], [0.085, 0.12, 0.085], color, detail);
  head(q, [pose.headX ?? 0, 1.69, pose.headZ ?? 0.02], color, detail, pose);
  for (const sign of [-1, 1]) {
    const end = sign < 0 ? (pose.left ?? [-0.19, 1.13, 0.25]) : (pose.right ?? [0.22, 1.12, 0.25]);
    const shoulder = [sign * 0.27, 1.36, 0],
      elbow = [sign * 0.38, (end[1] + 1.36) * 0.5, 0.12];
    limbPath(q, 'sculpture', [shoulder, elbow, end], 0.2, color, detail);
    oval(q, elbow, [0.09, 0.09, 0.085], color, detail);
    hand(q, end, color, detail, end[1] > 1.6);
  }
  for (const sign of [-1, 1])
    oval(q, [sign * 0.15, 0.035, 0.13], [0.11, 0.055, 0.2], color, detail);
  if (detail >= 2) {
    if (pose.hat) robe(q, [0, 0.78, -0.025], 0.62, 0.36, color, detail);
    beamPath(
      q,
      'sculpture',
      [
        [-0.3, 1.28, 0.15],
        [-0.18, 1.16, 0.24],
        [0, 1.12, 0.27],
        [0.18, 1.21, 0.22],
        [0.3, 1.3, 0.15],
      ],
      0.05,
      0.045,
      color,
    );
  }
}
function transformed(o, center, facing) {
  const [x, y, z] = center;
  return Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, color) => {
        const points = p.map(([u, v, w]) => [x + u * facing, y + v, z + w * facing]);
        const normal = n ? [n[0] * facing, n[1], n[2] * facing] : n;
        o[k](slot, ref, points, normal, uv, color);
      },
    ]),
  );
}
function kneelingFigure(o, p, color, detail) {
  const q = transformed(o, p, 1);
  robe(q, [0, 0, 0], 0.8, 0.32, color, detail);
  oval(q, [0, 0.77, 0.02], [0.3, 0.17, 0.17], color, detail);
  head(q, [0.025, 1.05, 0.06], color, detail, { veil: true });
  for (const sign of [-1, 1]) {
    oval(q, [sign * 0.2, 0.08, 0.2], [0.15, 0.08, 0.19], color, detail);
    const end = [sign * 0.065, 0.99, 0.27];
    limbPath(
      q,
      'sculpture',
      [[sign * 0.25, 0.78, 0.02], [sign * 0.29, 0.9, 0.18], end],
      0.17,
      color,
      detail,
    );
    hand(q, end, color, detail);
  }
}
function pedestal(o, width, depth, top, color, detail) {
  box(o, 'sculpture', [-width / 2, 0, -depth / 2], [width / 2, 0.16, depth / 2], color);
  box(
    o,
    'sculpture',
    [-width * 0.44, 0.16, -depth * 0.44],
    [width * 0.44, top - 0.14, depth * 0.44],
    color,
  );
  box(
    o,
    'sculpture',
    [-width * 0.49, top - 0.14, -depth * 0.49],
    [width * 0.49, top, depth * 0.49],
    color,
  );
  if (detail >= 2)
    box(
      o,
      'sculpture',
      [-width * 0.33, 0.3, depth * 0.441],
      [width * 0.33, top - 0.3, depth * 0.441 + 0.035],
      color,
    );
}
function angel(o, p, color, detail, sign) {
  figure(o, p, 0.8, color, detail, { left: [-0.28, 1.55, 0.05], right: [0.28, 1.45, 0.14] });
  for (const side of [-1, 1]) {
    const points = [
      [p[0] + side * 0.1, p[1] + 0.3, p[2] - 0.08],
      [p[0] + side * 0.45, p[1] + 0.68, p[2] - 0.2],
      [p[0] + side * 0.36, p[1] + 0.25, p[2] - 0.15],
    ];
    const area = points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p[0] * next[1] - next[0] * p[1];
    }, 0);
    if (area < 0) points.reverse();
    loft(
      o,
      'sculpture',
      [points.map(([x, y, z]) => [x, y, z - 0.025]), points.map(([x, y, z]) => [x, y, z + 0.025])],
      color,
    );
  }
  if (sign)
    beam(
      o,
      'sculpture',
      [p[0], p[1] + 0.25, p[2]],
      [p[0] + sign * 0.3, p[1] + 0.05, p[2] + 0.1],
      0.12,
      0.12,
      color,
    );
}
export function buildPisekStatue(o, type, center, facing, detail, color, metal, gold) {
  const q = transformed(o, center, facing),
    base = 1.1;
  if (detail < 0) {
    const w = type === 'calvary' ? 3.2 : type === 'nepomuk' ? 3 : 1.5;
    box(q, 'sculpture', [-w / 2, 0, -0.6], [w / 2, 0.7, 0.6], color);
    const marker = (x, h, w) =>
      loft(
        q,
        'sculpture',
        [
          [
            [x - w, 0.7, -0.12],
            [x - w, 0.7, 0.12],
            [x + w, 0.7, 0.12],
            [x + w, 0.7, -0.12],
          ],
          [
            [x - w * 0.5, 0.7 + h, -0.1],
            [x - w * 0.5, 0.7 + h, 0.1],
            [x + w * 0.5, 0.7 + h, 0.1],
            [x + w * 0.5, 0.7 + h, -0.1],
          ],
        ],
        color,
      );
    if (type === 'calvary') {
      beam(q, 'metal', [0, 0.7, 0], [0, 4.75, 0], 0.12, 0.12, metal);
      beam(q, 'metal', [-0.85, 4.08, 0], [0.85, 4.08, 0], 0.12, 0.12, metal);
      marker(-1, 1.9, 0.2);
      marker(1, 1.9, 0.2);
    } else {
      marker(0, 2.4, 0.28);
      if (type === 'anne') marker(0.55, 1.4, 0.15);
    }
    return;
  }
  pedestal(
    q,
    type === 'calvary' ? 3.2 : type === 'nepomuk' ? 1.1 : 1.5,
    type === 'calvary' ? 1.65 : 1.25,
    base,
    color,
    detail,
  );
  if (type === 'nepomuk') {
    // Angels flank a narrower central pedestal; a full-width tall block would
    // bury their lower bodies. Only the common low plinth spans the ensemble.
    box(q, 'sculpture', [-1.5, 0, -0.625], [1.5, 0.35, 0.625], color);
    for (const side of [-1, 1])
      box(q, 'sculpture', [side * 1.03 - 0.3, 0.35, -0.3], [side * 1.03 + 0.3, 0.62, 0.4], color);
  }
  if (detail === 0) {
    // Honest distance silhouettes retain distinct ensemble widths and the Calvary cross.
    if (type === 'calvary') {
      beam(q, 'metal', [0, base, 0], [0, base + 3.5, 0], 0.1, 0.1, metal);
      beam(q, 'metal', [-0.82, base + 2.85, 0], [0.82, base + 2.85, 0], 0.1, 0.1, metal);
      for (const x of [-0.95, 0.8]) robe(q, [x, base, 0], 1.65, 0.26, color, 0);
    } else {
      robe(q, [0, base, 0], 1.75, 0.3, color, 0);
      if (type === 'nepomuk')
        for (const x of [-0.95, 0.95]) robe(q, [x, 0.5, 0], 0.7, 0.19, color, 0);
      if (type === 'anne') robe(q, [0.43, base, 0], 1.02, 0.2, color, 0);
    }
    return;
  }
  if (type === 'calvary') {
    const crossColor = [0.14, 0.2, 0.17];
    beam(q, 'metal', [0, base - 0.1, -0.22], [0, base + 3.65, -0.22], 0.12, 0.12, crossColor);
    beam(
      q,
      'metal',
      [-0.85, base + 2.98, -0.22],
      [0.85, base + 2.98, -0.22],
      0.12,
      0.12,
      crossColor,
    );
    const bronze = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (_slot, ref, p, n, uv, c) => q[k]('metal', ref, p, n, uv, c),
      ]),
    );
    // Crucified figure: bent legs, draped hips, outstretched arms and lowered head.
    oval(bronze, [0, base + 2.51, -0.13], [0.17, 0.32, 0.09], metal, detail);
    head(bronze, [-0.06, base + 2.87, -0.07], metal, detail, { tilt: -0.02 });
    for (const side of [-1, 1]) {
      limbPath(
        bronze,
        'metal',
        [
          [side * 0.14, base + 2.7, -0.13],
          [side * 0.47, base + 2.89, -0.14],
          [side * 0.78, base + 2.99, -0.16],
        ],
        0.085,
        metal,
        detail,
      );
      limbPath(
        bronze,
        'metal',
        [
          [side * 0.08, base + 2.23, -0.13],
          [side * 0.1, base + 1.87, 0.02],
          [side * 0.02, base + 1.52, -0.09],
        ],
        0.09,
        metal,
        detail,
      );
    }
    robe(bronze, [0, base + 2.1, -0.12], 0.22, 0.22, metal, detail);
    for (const x of [-0.85, 0.85])
      box(q, 'metal', [x - 0.035, base + 2.9, -0.295], [x + 0.035, base + 3.06, -0.145], gold);
    box(q, 'metal', [-0.08, base + 3.57, -0.295], [0.08, base + 3.67, -0.145], gold);
    figure(q, [-1.04, base, 0], 1.72, color, detail, {
      veil: true,
      left: [-0.18, 1.25, 0.28],
      right: [0.13, 1.23, 0.31],
      headX: 0.035,
    });
    figure(q, [0.97, base, 0], 1.78, color, detail, {
      left: [-0.16, 1.21, 0.3],
      right: [0.17, 1.24, 0.31],
      headX: -0.035,
    });
    kneelingFigure(q, [0.12, base, -0.02], color, detail);
  } else if (type === 'nepomuk') {
    figure(q, [0, base, 0], 1.95, color, detail, {
      hat: true,
      left: [-0.55, 1.69, 0.11],
      right: [0.26, 1.38, 0.25],
    });
    for (const side of [-1, 1]) angel(q, [side * 1.03, 0.62, 0.08], color, detail, side);
    if (detail >= 2) {
      const center = [0, base + 1.97, -0.1],
        radius = 0.29,
        points = Array.from({ length: 20 }, (_, i) => [
          center[0] + Math.cos((i * Math.PI * 2) / 20) * radius,
          center[1] + Math.sin((i * Math.PI * 2) / 20) * radius,
          center[2],
        ]);
      beamPath(q, 'metal', points, 0.014, 0.014, gold, true);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + (i * Math.PI * 2) / 5,
          x = center[0] + Math.cos(a) * radius,
          y = center[1] + Math.sin(a) * radius;
        beam(q, 'metal', [x - 0.045, y, -0.1], [x + 0.045, y, -0.1], 0.017, 0.017, gold);
        beam(q, 'metal', [x, y - 0.045, -0.1], [x, y + 0.045, -0.1], 0.017, 0.017, gold);
      }
    }
  } else if (type === 'anne') {
    figure(q, [0.2, base, 0], 1.8, color, detail, {
      veil: true,
      left: [-0.4, 1.12, 0.32],
      right: [0.35, 1.5, 0.05],
      headX: -0.04,
    });
    figure(q, [-0.49, base, 0.12], 1.1, color, detail, {
      veil: true,
      left: [-0.2, 1.2, 0.3],
      right: [0.13, 1.21, 0.31],
      headX: 0.035,
    });
    figure(q, [0.55, base + 1.25, 0.1], 0.66, color, detail, {
      left: [-0.25, 1.35, 0.1],
      right: [0.27, 1.4, 0.1],
    });
  } else if (type === 'anthony') {
    figure(q, [0, base, 0], 1.85, color, detail, {
      left: [-0.35, 1.15, 0.32],
      right: [0.33, 1.48, 0.15],
      headX: 0.025,
    });
    figure(q, [0.4, base + 1.02, 0.16], 0.62, color, detail, {
      left: [-0.28, 1.45, 0.04],
      right: [0.27, 1.42, 0.15],
    });
    beamPath(
      q,
      'sculpture',
      [
        [-0.35, base + 0.8, 0.3],
        [-0.4, base + 1.5, 0.28],
        [-0.48, base + 1.82, 0.25],
      ],
      0.027,
      0.027,
      color,
    );
    if (detail >= 2)
      for (const side of [-1, 1])
        oval(q, [-0.48 + side * 0.04, base + 1.81, 0.26], [0.07, 0.035, 0.03], color, 1);
  } else throw new Error('Unknown Pisek statue ensemble');
}
