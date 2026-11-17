/** Wenchang gate fort, the Bronze Ox and the Tingli Guan opera court. */
import {
  beam,
  beamPath,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  surfaces as courtSurfaces,
  face,
  frame,
  gold,
  granite,
  hall,
  indigo,
  levels,
  marble,
  red,
  roofs,
  solid,
  turquoise,
} from './summer-palace-model.mjs';

export const forms = new Set(['wenchang', 'purple-gate', 'bronze-ox', 'orioles']);
export const surfaces = {
  ...courtSurfaces,
  brick: { slot: 'wall', graph: 'brick_stack' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.5, metallic: 0.6 },
};
const greyBrick = [0.477, 0.445, 0.385];
const bronze = [0.149, 0.182, 0.15];
const patina = [0.126, 0.159, 0.135];

function gateArch(out, gate, detail) {
  const {
    west,
    east,
    depth,
    center,
    halfWidth,
    grade,
    toe,
    parapet: top = 5.6,
    innerSpring: spring = 2.48,
    innerRise: rise = 1.77,
    decoratedCrenels = false,
  } = gate;
  const steps = [7, 12, 16, 24, 32][detail];
  const rim = (i, trim = 0) => [
    center - (halfWidth + trim) * Math.cos((Math.PI * i) / steps),
    spring + (rise + trim) * Math.sin((Math.PI * i) / steps),
  ];
  box(out, 'brick', [west, toe - grade, -depth], [center - halfWidth, top, depth], greyBrick);
  box(out, 'brick', [center + halfWidth, toe - grade, -depth], [east, top, depth], greyBrick);
  for (let i = 0; i < steps; i++) {
    const [x, y] = rim(i);
    const [u, v] = rim(i + 1);
    face(
      out,
      'stone',
      [
        [x, y, depth],
        [x, y, -depth],
        [u, v, -depth],
        [u, v, depth],
      ],
      granite,
      [0, -1, 0],
    );
    for (const side of [-1, 1]) {
      const z = side * depth;
      face(
        out,
        'brick',
        [
          [x, y, z],
          [u, v, z],
          [u, top, z],
          [x, top, z],
        ],
        greyBrick,
        [0, 0, side],
      );
      if (detail >= 2) {
        const border = z + side * 0.025;
        const [px, py] = rim(i, 0.24);
        const [pu, pv] = rim(i + 1, 0.24);
        face(
          out,
          'stone',
          [
            [x, y, border],
            [u, v, border],
            [pu, pv, border],
            [px, py, border],
          ],
          granite,
          [0, 0, side],
        );
      }
    }
  }
  box(
    out,
    'stone',
    [west - 0.16, top - 0.06, -depth - 0.14],
    [east + 0.16, top + 0.33, depth + 0.14],
    greyBrick,
  );
  for (const sign of [-1, 1]) {
    const z = sign * (depth - 0.12);
    box(out, 'stone', [west, top + 0.33, z - 0.19], [east, top + 0.67, z + 0.19], greyBrick);
    const spacing = [3.1, 1.62, 0.86, 0.86, 0.86][detail];
    for (let x = west + 0.28; x <= east; x += spacing) {
      box(
        out,
        'stone',
        [x - 0.17, top + 0.67, z - 0.19],
        [x + 0.17, top + 1.04, z + 0.19],
        greyBrick,
      );
      if (decoratedCrenels && detail >= 2) {
        const front = z + sign * 0.196;
        beam(out, 'marble', [x, top + 0.68, front], [x, top + 0.95, front], 0.11, 0.06, marble);
        beam(
          out,
          'marble',
          [x - 0.31, top + 0.56, front],
          [x, top + 0.72, front],
          0.075,
          0.049,
          marble,
        );
        beam(
          out,
          'marble',
          [x, top + 0.72, front],
          [x + 0.31, top + 0.56, front],
          0.075,
          0.049,
          marble,
        );
      }
    }
    if (detail >= 2) {
      const p = sign * (depth + 0.039);
      const plaque = decoratedCrenels ? top - 0.66 : 4.71;
      face(
        out,
        'marble',
        [
          [center - 1, plaque, p],
          [center + 1, plaque, p],
          [center + 1, plaque + 0.4, p],
          [center - 1, plaque + 0.4, p],
        ],
        marble,
        [0, 0, sign],
      );
    }
  }
}

function purpleCloudGate(out, { gate }, detail) {
  const base = frame(out, [0, 0], gate.grade, 0);
  gateArch(base, gate, detail);
  const pavilion = frame(base, [gate.pavilionOffset, 0], gate.parapet + 0.33, 0);
  const w = gate.pavilionWidth;
  const d = gate.pavilionDepth;
  courtBay(pavilion, w, d, 0, 2.32, 3, detail, { postTint: turquoise });
  const wallW = w * 0.315;
  const wallD = d * 0.265;
  box(pavilion, 'plaster', [-wallW, 0, -wallD], [wallW, 2.21, wallD], red);
  if (detail >= 2)
    for (const side of [-1, 1])
      for (const x of [-w * 0.194, 0, w * 0.194]) {
        const z = side * wallD;
        box(
          pavilion,
          'timber',
          [x - w * 0.085, 0.98, z - 0.065],
          [x + w * 0.085, 1.99, z + 0.065],
          indigo,
        );
        for (const offset of [-0.36, -0.18, 0, 0.18, 0.36])
          beam(
            pavilion,
            'timber',
            [x + offset, 1.01, z + side * 0.076],
            [x + offset, 1.96, z + side * 0.076],
            0.042,
            0.045,
            turquoise,
          );
        for (const y of [1.24, 1.48, 1.72])
          beam(
            pavilion,
            'timber',
            [x - w * 0.084, y, z + side * 0.081],
            [x + w * 0.084, y, z + side * 0.081],
            0.041,
            0.045,
            turquoise,
          );
      }
  courtRoof(pavilion, w * 1.15, d * 1.17, 2.48, 1.27, roofs.grey, detail, true, 0.25);
  box(pavilion, 'timber', [-w * 0.34, 3.31, -d * 0.27], [w * 0.34, 4.16, d * 0.27], red);
  courtRoof(pavilion, w * 0.94, d * 0.87, 4.23, 1.66, roofs.grey, detail, true, 0.32);
}

function wenchang(out, { gate }, detail) {
  const local = frame(out, [0, 0], gate.grade, 0);
  gateArch(local, gate, detail);
  const tower = frame(local, [0.52, 0], 6, gate.roofAngle);
  const w = gate.pavilionWidth;
  const d = gate.pavilionDepth;
  courtBay(tower, w, d, 0, 2.74, 5, detail, { wall: true, frontScreen: true });
  courtRoof(tower, w * 1.08, d * 1.03, 2.97, 1.05, roofs.green, detail, true, 0.19);
  const top = [w * 0.81, d * 0.79];
  box(tower, 'timber', [-top[0] / 2, 3.53, -top[1] / 2], [top[0] / 2, 3.8, top[1] / 2], red);
  courtBay(tower, ...top, 3.81, 2.65, 3, detail, { wall: true, frontScreen: true });
  courtRoof(tower, w * 0.96, d * 0.88, 6.68, 2.6, roofs.green, detail, true, 0.49);
  for (const s of [-1, 1]) {
    const wing = frame(tower, [s * w * 0.47, -1.4], 0.07, s * 0.11);
    courtBay(wing, 3.9, 4.4, 0, 2.65, 2, detail, { wall: true });
    courtRoof(wing, 4.65, 5.2, 2.85, 1.5, roofs.green, detail, false, 0.28);
  }
}

function oxProfile(out, rows, colors, segments) {
  const rings = rows.map(([z, x, y, rx, ry]) =>
    Array.from({ length: segments }, (_, i) => {
      const t = (i / segments) * Math.PI * 2;
      return [x + rx * Math.cos(t), y + ry * Math.sin(t), z];
    }),
  );
  loft(out, 'bronze', rings, colors);
}

function marbleEnclosure(out, detail) {
  for (const [w, d, low, high] of [
    [2.78, 3.43, -0.48, 0.15],
    [2.67, 3.32, 0.15, 0.24],
    [2.55, 3.24, 0.24, 0.51],
    [2.69, 3.38, 0.51, 0.61],
    [2.53, 3.21, 0.61, 0.74],
  ])
    box(out, 'marble', [-w / 2, low, -d / 2], [w / 2, high, d / 2], marble);
  const relief = [0.51, 0.475, 0.41];
  const height = 0.99;
  for (const side of [-1, 1]) {
    const x = side * 1.12;
    for (const z of [-1.48, -0.74, 0, 0.74, 1.48]) {
      box(out, 'marble', [x - 0.074, 0.7, z - 0.073], [x + 0.074, 1.14, z + 0.073], marble);
      if (detail >= 2) sphere(out, 'marble', [x, 1.165, z], [0.074, 0.082, 0.074], marble, 7, 4);
      if (z === 1.48) continue;
      box(out, 'marble', [x - 0.049, 0.73, z + 0.056], [x + 0.049, height, z + 0.694], marble);
      if (detail >= 3)
        for (const dz of [0.22, 0.38, 0.54])
          face(
            out,
            'marble',
            [
              [x + side * 0.05, 0.915, z + dz - 0.047],
              [x + side * 0.05, 0.956, z + dz],
              [x + side * 0.05, 0.915, z + dz + 0.047],
              [x + side * 0.05, 0.875, z + dz],
            ],
            relief,
            [side, 0, 0],
          );
    }
    const z = side * 1.48;
    for (const x of [-0.37, 0.37]) {
      box(out, 'marble', [x - 0.075, 0.72, z - 0.073], [x + 0.075, 1.13, z + 0.073], marble);
      if (detail >= 2) sphere(out, 'marble', [x, 1.15, z], [0.076, 0.077, 0.072], marble, 7, 4);
    }
    box(out, 'marble', [-1.11, 0.73, z - 0.047], [1.11, height, z + 0.047], marble);
  }
}

function ox(out, detail) {
  marbleEnclosure(out, detail);
  const body = frame(out, [0, -0.04], 0.74, 0);
  const n = [6, 10, 14, 18, 24][detail];
  oxProfile(
    body,
    [
      [-1, 0.0, 0.375, 0.13, 0.2],
      [-0.83, -0.01, 0.393, 0.368, 0.378],
      [-0.46, -0.035, 0.416, 0.445, 0.402],
      [0.0, -0.015, 0.39, 0.366, 0.361],
      [0.35, 0.021, 0.455, 0.318, 0.401],
      [0.52, 0.019, 0.556, 0.273, 0.489],
      [0.65, -0.002, 0.659, 0.226, 0.49],
      [0.78, -0.034, 0.815, 0.182, 0.35],
      [0.9, -0.065, 0.963, 0.142, 0.195],
      [1.03, -0.091, 0.988, 0.127, 0.126],
      [1.147, -0.118, 0.944, 0.106, 0.083],
    ],
    bronze,
    n,
  );
  const head = frame(body, [-0.04, 0.79], 0.97, 0.22);
  for (const side of [-1, 1]) {
    const s = side;
    const horn = [
      [s * 0.103, 0.177, -0.104, 0.069],
      [s * 0.195, 0.238, -0.187, 0.055],
      [s * 0.249, 0.36, -0.231, 0.036],
      [s * 0.24, 0.46, -0.234, 0.02],
      [s * 0.207, 0.568, -0.21, 0.004],
    ];
    const rings = horn.map(([x, y, z, r]) => radialRing(y, r, r * 0.92, Math.min(n, 10), [x, z]));
    loft(head, 'bronze', rings, bronze);
    sphere(
      head,
      'bronze',
      [s * 0.185, 0.122, -0.083],
      [0.107, 0.044, 0.064],
      patina,
      n,
      detail === 0 ? 3 : 4,
    );
    sphere(
      body,
      'bronze',
      [s * 0.267, 0.169, 0.53],
      [0.128, 0.103, 0.244],
      bronze,
      n,
      detail === 0 ? 4 : 6,
    );
    sphere(
      body,
      'bronze',
      [s * 0.26, 0.13, -0.57],
      [0.17, 0.118, 0.27],
      bronze,
      n,
      detail === 0 ? 4 : 6,
    );
    if (detail >= 2) {
      sphere(
        head,
        'bronze',
        [s * 0.137, 0.115, 0.122],
        [0.033, 0.026, 0.034],
        [0.079, 0.101, 0.077],
        n,
        5,
      );
      sphere(head, 'bronze', [s * 0.083, -0.006, 0.342], [0.028, 0.016, 0.022], patina, n, 4);
    }
  }
  tubePath(
    body,
    'bronze',
    [
      [-0.02, 0.44, -0.974],
      [0.098, 0.26, -1.052],
      [0.159, 0.108, -1.01],
      [0.235, 0.074, -0.877],
      [0.294, 0.089, -0.69],
    ],
    0.034,
    patina,
    Math.min(n, 10),
  );
  if (detail >= 3)
    for (let row = 0; row < 5; row++) {
      const z = -0.5 + row * 0.119;
      for (let col = 0; col < 6; col++) {
        const x = 0.088 + col * 0.035;
        const y = 0.416 + 0.402 * Math.sqrt(1 - (x / 0.47) * (x / 0.47)) - row * 0.003;
        beam(body, 'bronze', [x, y, z], [x + 0.008, y - 0.004, z + 0.042], 0.009, 0.006, patina);
      }
    }
}

function terraceSteps(out, width, { start, height, treads, going }, detail) {
  const step = height / treads;
  for (let i = 0; i < treads; i++) {
    const z = start + i * going;
    box(
      out,
      'stone',
      [-width / 2, -height - 0.24, z],
      [width / 2, -step * (i + 1), z + going],
      granite,
    );
  }
  if (detail >= 2)
    for (const sign of [-1, 1]) {
      const x = sign * (width / 2 + 0.13);
      beam(
        out,
        'marble',
        [x, 0.32, start],
        [x, 0.32 - height, start + treads * going],
        0.23,
        0.24,
        marble,
      );
    }
}

function operaCourt(out, { sites, galleries }, detail) {
  for (const site of sites) {
    const { width, depth, center, angle } = site.frame;
    if (site.role === 'side') {
      hall(out, site, detail);
      continue;
    }
    const stage = site.role === 'stage';
    const plinth = stage ? 0.83 : 1.45;
    solid(out, 'stone', site.outline, site.toe, site.grade + plinth, granite);
    const local = frame(out, center, site.grade + plinth, angle);
    const bays = stage ? 3 : 7;
    const floor = stage ? 3.35 : 4.08;
    courtBay(local, width, depth, 0, floor, bays, detail, {
      wall: true,
      frontScreen: !stage,
      postTint: stage ? turquoise : red,
    });
    courtRoof(
      local,
      width * 1.078,
      depth * 1.06,
      floor + 0.2,
      stage ? 2.28 : 2.54,
      roofs.grey,
      detail,
      true,
      0.43,
    );
    if (detail > 0) terraceSteps(local, width * (stage ? 0.47 : 0.42), site.stairs, detail);
    if (!stage) continue;
    const upper = [width * 0.56, depth * 0.53];
    const raised = floor + 1.66;
    const ux = upper[0] * 0.455,
      uz = upper[1] * 0.47;
    box(local, 'timber', [-ux, raised - 0.23, -uz], [ux, raised, uz], red);
    if (detail >= 1)
      beam(local, 'timber', [-ux, raised + 0.45, uz], [ux, raised + 0.45, uz], 0.102, 0.12, red);
    courtBay(local, ...upper, raised, 2.3, 3, detail, { wall: true, postTint: turquoise });
    courtRoof(
      local,
      width * 0.68,
      depth * 0.65,
      raised + 2.45,
      2.34,
      roofs.grey,
      detail,
      true,
      0.44,
    );
    const z = depth * 0.335;
    box(local, 'timber', [-1.48, 0.75, z - 0.12], [1.48, 3.07, z], red);
    if (detail >= 2) {
      const rail = [
        [0, 0],
        [-0.57, 0],
        [-0.57, 0.38],
        [0.33, 0.38],
        [0.33, 0.69],
        [-0.38, 0.69],
        [-0.38, 0.98],
        [0.42, 0.98],
      ];
      const ink = (p) => [p[0], 1.37 + p[1] * 1.1, z + 0.007];
      beamPath(local, 'enamel', rail.map(ink), 0.081, 0.028, gold);
      beam(local, 'enamel', ink([0, -0.15]), ink([0, 1.11]), 0.076, 0.023, gold);
      for (const y of [0.12, 0.57, 0.9])
        beam(local, 'enamel', ink([-0.46, y]), ink([0.47, y]), 0.069, 0.024, gold);
      beam(
        local,
        'timber',
        [-1.06, floor - 0.25, z + 0.25],
        [1.06, floor - 0.25, z + 0.25],
        0.36,
        0.14,
        indigo,
      );
    }
  }
  if (detail === 0) return;
  for (const { center, grade, width, depth, angle, toe } of galleries) {
    const local = frame(out, center, grade, angle);
    box(local, 'stone', [-width / 2, toe, -depth / 2], [width / 2, 0, depth / 2], granite);
    courtBay(local, width, depth, 0, 2.67, Math.round(width / 2.2), detail);
    courtRoof(local, width * 1.035, depth * 1.18, 2.85, 0.93, roofs.grey, detail, true, 0.18);
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  if (layout.form === 'wenchang') wenchang(out, layout, detail);
  else if (layout.form === 'purple-gate') purpleCloudGate(out, layout, detail);
  else if (layout.form === 'bronze-ox') ox(frame(out, [0, 0], layout.monument.grade, 0), detail);
  else if (layout.form === 'orioles') operaCourt(out, layout, detail);
  else throw new Error(`No Summer Palace court or monument recipe for ${layout.form}`);
}
