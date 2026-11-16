import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  surfaces as courtSurfaces,
  face,
  frame,
  gold,
  granite,
  indigo,
  levels,
  marble,
  rectangle,
  red,
  roofs,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['bronze-court', 'revolving-archive']);
export const surfaces = {
  ...courtSurfaces,
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.52, metallic: 0.68 },
};
const patina = [0.241, 0.248, 0.204];
const brightBronze = [0.351, 0.323, 0.229];
const darkBronze = [0.149, 0.155, 0.137];

function podium(
  out,
  { center, width, depth, angle, grade, toe, capped = true, painted = false },
  detail,
) {
  const local = frame(out, center, grade, angle);
  box(local, 'stone', [-width / 2, toe - grade, -depth / 2], [width / 2, 0, depth / 2], granite);
  if (capped) {
    box(
      local,
      'marble',
      [-width / 2 - 0.082, -0.18, -depth / 2 - 0.082],
      [width / 2 + 0.082, 0.03, depth / 2 + 0.082],
      marble,
    );
  }
  if (painted && detail >= 2) {
    const h = width / 2,
      d = depth / 2;
    const low = Math.max(toe - grade, -1.24);
    box(local, 'plaster', [-h - 0.026, low, -d + 0.018], [-h + 0.013, -0.18, d - 0.012], red);
    box(local, 'plaster', [h - 0.013, low, -d + 0.018], [h + 0.026, -0.18, d - 0.012], red);
    box(local, 'plaster', [-h + 0.015, low, d - 0.018], [-2.04, -0.18, d + 0.028], red);
    box(local, 'plaster', [2.04, low, d - 0.018], [h - 0.015, -0.18, d + 0.028], red);
  }
}

function rail(out, a, b, detail, material = 'marble') {
  const [x, y, z] = a,
    [u, v, w] = b;
  const length = Math.hypot(u - x, w - z);
  const count = Math.max(1, Math.round(length / (detail < 2 ? 3.68 : 1.22)));
  const point = (i, rise) => [
    x + ((u - x) * i) / count,
    y + ((v - y) * i) / count + rise,
    z + ((w - z) * i) / count,
  ];
  const tint = material === 'marble' ? marble : turquoise;
  if (detail > 0) {
    beam(out, material, point(0, 0.13), point(count, 0.13), 0.13, 0.13, tint);
    for (let i = 0; i <= count; i++) {
      beam(out, material, point(i, 0), point(i, 0.96), 0.19, 0.2, tint);
      if (detail >= 3 && material === 'marble')
        sphere(out, material, point(i, 0.99), [0.106, 0.14, 0.102], tint, 7, 4);
      if (detail >= 2 && i < count)
        beam(out, material, point(i + 0.5, 0.19), point(i + 0.5, 0.67), 0.115, 0.11, tint);
    }
  }
  beam(out, material, point(0, 0.74), point(count, 0.74), 0.15, 0.18, tint);
}

function stairs(out, { from, to, width, sideRail, toe }, detail) {
  const [x, y, z] = from,
    [a, b, c] = to;
  const dx = a - x,
    dz = c - z;
  const length = Math.hypot(dx, dz),
    rise = b - y;
  const local = frame(out, [x, z], y, Math.atan2(-dx, dz));
  const half = width / 2;
  if (detail === 0)
    face(
      local,
      'stone',
      [
        [-half, 0, 0],
        [half, 0, 0],
        [half, rise, length],
        [-half, rise, length],
      ],
      marble,
      up,
    );
  else {
    const count = Math.max(2, Math.ceil(Math.abs(rise) / 0.181));
    for (let i = 0; i < count; i++) {
      const t0 = i / count,
        t1 = (i + 1) / count;
      const high = rise * (rise > 0 ? t1 : t0);
      const t = (t0 + t1) * 0.5;
      const floor = Math.min(high - 0.27, toe[0] * (1 - t) + toe[1] * t - y);
      box(local, 'stone', [-half, floor, length * t0], [half, high, length * t1], marble);
    }
  }
  if (sideRail && detail > 0)
    for (const sign of [-1, 1])
      rail(local, [sign * (half - 0.08), 0, 0], [sign * (half - 0.08), rise, length], detail);
}

// The copper hall has a square corner-ridged roof with a shallow bowed edge.
function bronzeRoof(out, width, depth, y, rise, detail) {
  const ts = detail === 0 ? [0, 1] : [0, 0.24, 0.57, 0.81, 1];
  const x = width * 0.5,
    z = depth * 0.5;
  const roofRing = (t) => {
    const width = x * (1 - 0.49 * t),
      depth = z * (1 - 0.978 * t);
    const base = y + rise * t * (0.68 + 0.32 * t);
    const flare = 0.28 * (1 - t);
    return rectangle(width * 2, depth * 2)
      .toReversed()
      .flatMap(([a, b], i, ring) => {
        const [c, d] = ring[(i + 1) % ring.length];
        return [
          [a, base + flare, b],
          [(a + c) / 2, base, (b + d) / 2],
        ];
      });
  };
  const rows = ts.map(roofRing);
  loft(out, 'bronze', rows, patina, { cap: false });
  const eave = rows[0];
  for (const [i, a] of eave.entries()) {
    const b = eave[(i + 1) % eave.length];
    face(out, 'bronze', [a, b, [b[0], b[1] - 0.17, b[2]], [a[0], a[1] - 0.17, a[2]]], darkBronze, [
      a[0] + b[0],
      0,
      a[2] + b[2],
    ]);
    face(
      out,
      'bronze',
      [
        [a[0], a[1] - 0.17, a[2]],
        [b[0], b[1] - 0.17, b[2]],
        [0, y - 0.17, 0],
      ],
      darkBronze,
      [0, -1, 0],
    );
    if (detail >= 2 && i % 2 === 0)
      for (let j = 1; j < rows.length; j++)
        beam(out, 'bronze', rows[j - 1][i], rows[j][i], 0.1, 0.12, brightBronze);
  }
  beam(
    out,
    'bronze',
    [-x * 0.523, y + rise, 0],
    [x * 0.523, y + rise, 0],
    0.15,
    0.16,
    brightBronze,
  );
  if (detail < 2) return;
  for (const sign of [-1, 1]) {
    const count = detail >= 3 ? Math.round(width / 0.22) : 12;
    for (let i = 1; i < count; i++) {
      const u = ((2 * i) / count - 1) * x,
        curl = 0.28 * Math.abs(u / x);
      beam(
        out,
        'bronze',
        [u, y + curl, sign * (z + 0.031)],
        [u * 0.976, y + curl + 0.038, sign * z * 0.936],
        0.084,
        0.096,
        patina,
      );
    }
    beam(
      out,
      'bronze',
      [sign * x * 0.474, y + rise, 0],
      [sign * x * 0.545, y + rise + 0.245, 0],
      0.11,
      0.151,
      brightBronze,
    );
  }
}

function bronzePanel(out, width, bottom, height, z, sign, detail) {
  const half = width / 2,
    edge = z + sign * 0.044;
  box(out, 'bronze', [-half, bottom, z - 0.043], [half, bottom + height, z + 0.043], darkBronze);
  if (detail < 2) return;
  for (const x of [-half, 0, half])
    beam(out, 'bronze', [x, bottom, edge], [x, bottom + height, edge], 0.062, 0.083, brightBronze);
  for (const y of [bottom, bottom + height * 0.24, bottom + height])
    beam(out, 'bronze', [-half, y, edge], [half, y, edge], 0.061, 0.081, brightBronze);
  const count = detail >= 3 ? 8 : 5;
  for (let i = 1; i < count; i++) {
    const x = (i / count - 0.5) * width;
    beam(
      out,
      'bronze',
      [x, bottom + height * 0.27, edge],
      [x, bottom + height * 0.96, edge],
      0.026,
      0.035,
      patina,
    );
  }
  for (let i = 1; i <= count; i++) {
    const y = bottom + height * (0.27 + (0.67 * i) / (count + 1));
    beam(out, 'bronze', [-half * 0.95, y, edge], [half * 0.95, y, edge], 0.027, 0.035, patina);
  }
}

function bronzeHall(out, room, detail) {
  const body = frame(out, room.frame.center, room.floor, room.frame.angle);
  const w = room.frame.width,
    d = room.frame.depth;
  for (const [scale, y, h, roofHeight] of [
    [1, 0, 3.13, 1.17],
    [0.76, 4.14, 1.73, 1.356],
  ]) {
    const width = w * scale,
      depth = d * scale;
    const upper = y + h;
    if (detail === 0) {
      box(
        body,
        'bronze',
        [-width * 0.395, y, -depth * 0.395],
        [width * 0.395, upper, depth * 0.395],
        patina,
      );
      bronzeRoof(body, width * 1.135, depth * 1.14, upper, roofHeight, detail);
      continue;
    }
    for (const turn of [0, Math.PI / 2]) {
      const faceFrame = frame(body, [0, 0], y, turn);
      const span = (turn === 0 ? width : depth) * 0.79;
      const reach = (turn === 0 ? depth : width) * 0.395;
      for (const sign of [-1, 1]) {
        const z = sign * reach;
        for (let i = 0; i < 3; i++) {
          const x = span * ((i + 0.5) / 3 - 0.5);
          bronzePanel(
            frame(faceFrame, [x, 0], 0, 0),
            span / 3 - 0.21,
            0.19,
            h - 0.46,
            z,
            sign,
            detail,
          );
        }
        beam(
          faceFrame,
          'bronze',
          [-span * 0.53, h - 0.1, z],
          [span * 0.53, h - 0.1, z],
          0.19,
          0.24,
          patina,
        );
        for (let i = 0; i <= 3; i++) {
          const x = span * (i / 3 - 0.5);
          beam(faceFrame, 'bronze', [x, 0, z], [x, h, z], 0.205, 0.219, patina);
          if (detail >= 2)
            for (const [dy, w] of [
              [-0.17, 0.31],
              [-0.031, 0.4],
              [0.106, 0.5],
            ])
              beam(
                faceFrame,
                'bronze',
                [x, h + dy, z - 0.15],
                [x, h + dy, z + 0.15],
                w,
                0.13,
                brightBronze,
              );
        }
      }
    }
    bronzeRoof(body, width * 1.135, depth * 1.14, upper, roofHeight, detail);
  }
  if (detail >= 1) {
    box(body, 'bronze', [-0.91, 2.63, d * 0.405], [0.91, 2.99, d * 0.444], brightBronze);
    box(body, 'bronze', [-0.82, 2.686, d * 0.441], [0.82, 2.92, d * 0.451], darkBronze);
    box(body, 'bronze', [-0.35, 5.11, d * 0.304], [0.35, 5.65, d * 0.341], brightBronze);
  }
  if (detail >= 3)
    for (const [x, z] of [
      [0, d * 0.449],
      [-w * 0.44, 0.32],
      [w * 0.44, 0.32],
    ]) {
      for (const dy of [2.73, 2.84])
        for (let i = 0; i < 7; i++) {
          const u = x + 0.24 * (i - 3);
          face(
            body,
            'bronze',
            [
              [u - 0.043, dy, z],
              [u, dy - 0.032, z],
              [u + 0.043, dy, z],
              [u, dy + 0.032, z],
            ],
            brightBronze,
            [0, 0, 1],
          );
        }
    }
}

function walkwayBay(out, room, detail) {
  const { center, width: w, depth: d, angle, grade } = room;
  const local = frame(out, center, grade, angle);
  const h = room.height;
  const gabled = room.enclosed;
  if (gabled) box(local, 'plaster', [-w * 0.43, -0.08, -d * 0.42], [w * 0.43, h, d * 0.13], red);
  if (detail === 0) {
    if (!gabled)
      for (const x of [-w * 0.42, w * 0.42])
        for (const z of [-d * 0.37, d * 0.37])
          beam(local, 'timber', [x, 0, z], [x, h, z], 0.26, 0.25, red);
    const half = w * 0.52,
      run = d * 0.545;
    for (const side of [-1, 1])
      face(
        local,
        'tile',
        [
          [-half, h, side * run],
          [half, h, side * run],
          [half * 0.8, h + room.rise, 0],
          [-half * 0.8, h + room.rise, 0],
        ],
        roofs.green,
        up,
      );
    for (const side of [-1, 1])
      face(
        local,
        'tile',
        [
          [side * half, h, -run],
          [side * half, h, run],
          [side * half * 0.8, h + room.rise, 0],
        ],
        roofs.green,
        [side, 1, 0],
      );
    return;
  }
  if (detail > 0 || !gabled)
    courtBay(local, w, d, 0, h, room.bays, detail, { frontScreen: gabled, wall: false });
  courtRoof(
    local,
    w * 1.04,
    d * 1.09,
    h + 0.25,
    room.rise,
    roofs.green,
    detail,
    gabled,
    Math.min(0.34, room.rise * 0.187),
  );
}

function roofedWheel(out, room, detail) {
  const { center, width, depth, angle } = room.frame,
    y = room.floor;
  const body = frame(out, center, y, angle);
  const radiusX = width * 0.47,
    radiusZ = depth * 0.47;
  const ring = (h, scale, phase) =>
    radialRing(h, radiusX * scale, radiusZ * scale, 8, [0, 0], phase);
  const phase = Math.PI / 8;
  const bottom = ring(0, 1, phase);
  const upper = ring(2.95, 1, phase);
  loft(body, 'stone', [ring(room.toe - y, 0.99, phase), bottom], granite);
  loft(body, 'stone', [ring(2.73, 1.04, phase), ring(2.93, 1.08, phase)], marble);
  for (const [level, posts] of [
    [0, bottom],
    [2.95, upper],
  ]) {
    for (const [i, p] of posts.entries()) {
      if (detail === 0 && i % 2) continue;
      const next = posts[(i + 1) % 8];
      const [x, , z] = p;
      beam(body, 'timber', p, [x, level + 2.42, z], 0.21, 0.22, red);
      if (level > 0 && detail > 0) rail(body, p, next, detail >= 3 ? 2 : 0, 'timber');
      if (detail >= 2)
        beam(
          body,
          'timber',
          [x, level + 2.3, z],
          [x * 0.97, level + 2.49, z * 0.97],
          0.38,
          0.33,
          turquoise,
        );
    }
  }
  for (const [base, rise, scale] of [
    [2.52, 0.58, 0.96],
    [5.48, 2.08, 1.12],
  ]) {
    if (detail === 0 && base < 3) continue;
    const rows =
      detail === 0
        ? [
            [0, scale],
            [rise, 0.06],
          ]
        : [
            [0, scale],
            [rise * 0.25, scale * 0.73],
            [rise * 0.61, scale * 0.29],
            [rise, 0.053],
          ];
    loft(
      body,
      'tile',
      rows.map(([y, r]) => ring(base + y, r, phase)),
      roofs.green,
    );
    if (detail >= 2)
      for (const [i, k] of ring(base, scale, phase).entries())
        beam(
          body,
          'tile',
          k,
          ring(base + rise * 0.28, scale * 0.71, phase)[i],
          0.105,
          0.13,
          roofs.green,
        );
  }
  if (detail >= 1) {
    const tint = detail >= 3 ? indigo : red;
    loft(
      body,
      'enamel',
      [
        [7.45, 0.15],
        [7.64, 0.19],
        [7.84, 0.12],
        [7.94, 0.07],
      ].map(([y, r]) => radialRing(y, r, r, 8)),
      tint,
    );
  }
  if (detail >= 2) {
    const n = detail >= 3 ? 12 : 8;
    for (const [i, height] of [0.55, 1.68, 2.89, 4.0].entries()) {
      const r = Math.min(radiusX, radiusZ) * (0.41 - i * 0.059);
      loft(
        body,
        'timber',
        [
          [height, r],
          [height + 0.76, r],
          [height + 0.91, r * 0.85],
        ].map(([y, r]) => radialRing(y, r, r, n)),
        red,
      );
      if (detail >= 3)
        for (let j = 0; j < n; j++) {
          const t = (2 * Math.PI * j) / n;
          const [x, z] = [r * Math.cos(t), r * Math.sin(t)];
          beam(body, 'enamel', [x, height + 0.11, z], [x, height + 0.68, z], 0.036, 0.055, gold);
        }
    }
  }
}

function archiveHall(out, room, detail) {
  const { width: w, depth: d, center, angle } = room.frame;
  const y = room.floor;
  solid(out, 'stone', room.outline, room.toe, y, granite);
  const body = frame(out, center, y, angle);
  courtBay(body, w, d, 0, 4.15, 5, detail, { wall: true, frontScreen: true, plaque: true });
  if (detail >= 2) {
    const spacing = (w * 0.86) / 5,
      fore = d * 0.297;
    for (let i = 0; i < 5; i++) {
      const x = spacing * (i - 2),
        half = spacing * 0.36;
      box(body, 'timber', [x - half, 1.26, fore - 0.047], [x + half, 3.0, fore + 0.033], indigo);
      const z = fore + 0.055;
      for (const band of [1.24, 1.83, 2.41, 3.04])
        beam(body, 'timber', [x - half, band, z], [x + half, band, z], 0.075, 0.086, turquoise);
      const columns = detail >= 3 ? 9 : 5;
      for (let k = 0; k <= columns; k++) {
        const u = x + ((2 * k) / columns - 1) * half;
        beam(body, 'timber', [u, 1.22, z], [u, 3.04, z], 0.052, 0.06, turquoise);
      }
      if (detail >= 3)
        for (const side of [-1, 1]) {
          const u = x + side * half * 0.66;
          beam(
            body,
            'timber',
            [u, 1.52, z + 0.01],
            [x + side * half * 0.22, 1.94, z + 0.01],
            0.035,
            0.044,
            gold,
          );
          beam(
            body,
            'timber',
            [u, 2.27, z + 0.01],
            [x + side * half * 0.22, 2.68, z + 0.01],
            0.035,
            0.044,
            gold,
          );
        }
    }
    const eave = d * 0.447;
    rail(body, [-w * 0.475, 0.07, eave], [2.4, 0.07, eave], detail, 'timber');
    rail(body, [6.61, 0.07, eave], [w * 0.475, 0.07, eave], detail, 'timber');
  }
  courtRoof(body, w * 1.13, d * 1.26, 4.52, 1.39, roofs.green, detail, true, 0.264);
  const uw = w * 0.8,
    ud = d * 0.7;
  box(body, 'plaster', [-uw * 0.43, 4.9, -ud * 0.42], [uw * 0.43, 6.73, ud * 0.42], red);
  if (detail >= 1)
    for (const sign of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const x = uw * 0.84 * ((i + 0.5) / 7 - 0.5),
          z = sign * ud * 0.428;
        box(body, 'timber', [x - 0.57, 5.25, z - 0.077], [x + 0.57, 6.02, z + 0.077], indigo);
        if (detail >= 2)
          for (let j = 1; j < 5; j++) {
            const u = x + (j - 2.5) * 0.2;
            beam(
              body,
              'timber',
              [u, 5.3, z + sign * 0.087],
              [u, 5.99, z + sign * 0.087],
              0.04,
              0.052,
              turquoise,
            );
          }
      }
  courtRoof(body, uw * 1.2, ud * 1.2, 7.0, 2.11, roofs.green, detail, true, 0.405);
  for (const [x, h] of [
    [-uw * 0.25, 0.46],
    [0, 0.59],
    [uw * 0.25, 0.51],
  ]) {
    if (detail > 0) box(body, 'tile', [x - 0.16, 9.03, -0.14], [x + 0.16, 9.19, 0.14], roofs.green);
    if (detail >= 2)
      loft(
        body,
        'enamel',
        [
          [9.13, 0.144],
          [9.24, 0.12],
          [9.19 + h, 0.076],
        ].map(([y, r]) => radialRing(y, r, r, 6, [x, 0])),
        gold,
      );
  }
  if (detail >= 2) {
    box(body, 'enamel', [-0.52, 5.85, d * 0.37], [0.52, 7.2, d * 0.395], gold);
    box(body, 'timber', [-0.436, 5.93, d * 0.39], [0.436, 7.11, d * 0.412], indigo);
  }
}

function stele(out, { center, angle, grade }, detail) {
  const body = frame(out, center, grade, angle);
  for (const [w, d, y, h] of [
    [2.2, 1.86, -0.17, 0.14],
    [1.86, 1.56, 0.14, 0.53],
    [1.58, 1.31, 0.53, 0.75],
  ])
    box(body, 'marble', [-w / 2, y, -d / 2], [w / 2, h, d / 2], marble);
  box(body, 'marble', [-0.527, 0.75, -0.37], [0.527, 4.76, 0.37], marble);
  loft(
    body,
    'marble',
    [
      [4.76, 0.53, 0.43],
      [4.91, 0.73, 0.51],
      [5.21, 0.79, 0.56],
      [5.43, 0.5, 0.36],
      [5.77, 0.115, 0.108],
    ].map(([y, w, d]) => radialRing(y, w, d, detail >= 2 ? 8 : 4)),
    marble,
  );
  if (detail >= 2)
    for (const side of [-1, 1]) {
      const z = side * 0.388;
      for (const x of [-0.29, 0, 0.29])
        for (let i = 0; i < 9; i++) {
          const y = 1.19 + 0.335 * i;
          face(
            body,
            'marble',
            [
              [x - 0.061, y, z],
              [x, y - 0.068, z],
              [x + 0.058, y, z],
              [x, y + 0.07, z],
            ],
            granite,
            [0, 0, side],
          );
        }
    }
  if (detail >= 3)
    for (const x of [-0.47, 0.47])
      sphere(body, 'marble', [x, 5.33, 0], [0.23, 0.26, 0.24], marble, 9, 6);
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  const { platforms, stairs: steps, rails, bays, monument } = layout.hillCourt;
  for (const platform of platforms) podium(out, platform, detail);
  for (const step of steps) stairs(out, step, detail);
  if (detail > 0) for (const { a, b } of rails) rail(out, a, b, detail);
  for (const bay of bays) walkwayBay(out, bay, detail);
  if (layout.form === 'bronze-court') bronzeHall(out, layout.sites[0], detail);
  else {
    archiveHall(out, layout.sites[0], detail);
    for (const s of layout.sites.slice(1)) roofedWheel(out, s, detail);
    stele(out, monument, detail);
  }
}
