/** The Operations and Carme pavilions at Barcelona's Modernista hospital. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, profile } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const {
  geometry: {
    polygons: [operationOutline, carmeOutline],
  },
} = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.89, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.8, metallic: 0 },
  ceramic: { slot: 'trim', graph: 'tile_glazed', roughness: 0.71, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62, metallic: 0.08 },
};
const color = Object.fromEntries(
  Object.entries({
    brick: 'a46a51',
    shade: '98614f',
    darkBrick: '8d5640',
    orange: 'b9774c',
    stone: 'cbb798',
    inset: 'aa977a',
    basement: 'b0a08c',
    terracotta: 'a96c4d',
    yellow: 'cbaa62',
    cream: 'd7c390',
    greenTile: '5d7864',
    darkBlue: '5c829f',
    skyBlue: '83afc4',
    paleBlue: 'adc4cd',
    glass: '354848',
    coolGlass: '4e7477',
    green: '568071',
    door: '496d61',
  }).map(([n, hex]) => [n, rgb(hex)]),
);

function panel(out, slot, x0, x1, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function window(
  out,
  x,
  z,
  base,
  width,
  height,
  lod,
  { round = false, tint = color.glass, surround = true } = {},
) {
  const r = width * 0.5;
  if (!round || !lod) {
    if (surround)
      panel(
        out,
        'stone',
        x - r - 0.12,
        x + r + 0.12,
        base - 0.12,
        base + height + 0.12,
        z,
        color.stone,
      );
    panel(out, 'glass', x - r, x + r, base, base + height, z + 0.025, tint);
  } else {
    const spring = base + height - r * 0.73;
    if (surround)
      panel(out, 'stone', x - r - 0.12, x + r + 0.12, base - 0.13, spring, z, color.stone);
    panel(out, 'glass', x - r, x + r, base, spring, z + 0.028, tint);
    const curve = (angle, extra, depth) => [
      x + Math.cos(angle) * (r + extra),
      spring + Math.sin(angle) * (r * 0.73 + extra),
      depth,
    ];
    const steps = [0, 4, 7, 11][lod];
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI) / steps,
        b = ((i + 1) * Math.PI) / steps;
      triangle(
        out,
        'glass',
        [[x, spring, z + 0.028], curve(a, 0, z + 0.028), curve(b, 0, z + 0.028)],
        tint,
      );
      if (surround)
        face(
          out,
          'stone',
          [
            curve(a, 0, z + 0.015),
            curve(a, 0.14, z + 0.015),
            curve(b, 0.14, z + 0.015),
            curve(b, 0, z + 0.015),
          ],
          color.stone,
        );
    }
  }
  if (lod) {
    panel(out, 'glass', x - 0.035, x + 0.035, base, base + height, z + 0.043, color.green);
    if (lod > 1)
      panel(
        out,
        'glass',
        x - r,
        x + r,
        base + height * 0.42,
        base + height * 0.42 + 0.046,
        z + 0.043,
        color.green,
      );
  }
}

function solid(out, footprint, lower, top, tint = color.brick, floor = lower + 1) {
  const [left, right, north, south] = footprint;
  box(out, 'stone', [left, lower, north], [right, floor, south], color.basement);
  box(out, 'brick', [left, floor, north], [right, top, south], tint);
}

function roof(out, x0, x1, z0, z1, eave, top, lod, ridgeEastWest = false) {
  const [a, b, c, d] = [
    [x0, eave, z0],
    [x1, eave, z0],
    [x1, eave, z1],
    [x0, eave, z1],
  ];
  const [r, s] = ridgeEastWest
    ? [
        [x0, top, (z0 + z1) / 2],
        [x1, top, (z0 + z1) / 2],
      ]
    : [
        [(x0 + x1) / 2, top, z0],
        [(x0 + x1) / 2, top, z1],
      ];
  const planes = ridgeEastWest
    ? [
        [a, b, s, r],
        [c, d, r, s],
      ]
    : [
        [b, c, s, r],
        [d, a, r, s],
      ];
  for (const [start, end, upperEnd, upperStart] of planes) {
    const sample = (u, v) =>
      start.map(
        (n, k) =>
          (n + (end[k] - n) * u) * (1 - v) +
          (upperStart[k] + (upperEnd[k] - upperStart[k]) * u) * v +
          (k === 1 ? 0.028 : 0),
      );
    face(out, 'roof', [end, start, upperStart, upperEnd], color.terracotta);
    for (const [low, high, tint] of lod
      ? [
          [0, 0.08, color.greenTile],
          [0.85, 0.92, color.yellow],
          [0.92, 1, color.greenTile],
        ]
      : [[0.89, 1, color.greenTile]]) {
      face(out, 'roof', [sample(1, low), sample(0, low), sample(0, high), sample(1, high)], tint);
    }
    if (lod > 1) {
      const count = Math.max(4, Math.ceil(Math.hypot(end[0] - start[0], end[2] - start[2]) * 1.3));
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count,
          half = 0.34 / count;
        const at = (x, y) => sample(x, y).map((n, k) => n + (k === 1 ? 0.028 : 0));
        face(
          out,
          'roof',
          [at(u + half, 0.77), at(u, 0.67), at(u - half, 0.77), at(u, 0.86)],
          i % 3 === 1 ? color.greenTile : color.yellow,
        );
      }
    }
  }
  const gables = ridgeEastWest
    ? [
        [a, d, r],
        [c, b, s],
      ]
    : [
        [b, a, r],
        [d, c, s],
      ];
  for (const ends of gables) triangle(out, 'brick', ends, color.brick);
}

function roundMass(out, x, z, shape, sides) {
  profile(out, shape, sides, [x, z]);
}

function gallery(out, x, half, front, base, height, lod) {
  const spring = base + height * 0.62,
    r = half,
    depth = 0.3;
  const steps = [3, 6, 10, 14][lod];
  const archPoint = (angle, extra, z) => [
    x + Math.cos(angle) * (r + extra),
    spring + Math.sin(angle) * (height * 0.38 + extra),
    z,
  ];
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / steps,
      b = ((i + 1) * Math.PI) / steps;
    face(
      out,
      'brick',
      [
        archPoint(b, 0, front),
        archPoint(a, 0, front),
        archPoint(a, 0.21, front),
        archPoint(b, 0.21, front),
      ],
      color.darkBrick,
    );
    face(
      out,
      'stone',
      [
        archPoint(b, 0.21, front + 0.03),
        archPoint(a, 0.21, front + 0.03),
        archPoint(a, 0.34, front + 0.03),
        archPoint(b, 0.34, front + 0.03),
      ],
      color.stone,
    );
    face(
      out,
      'stone',
      [
        archPoint(b, 0, front - depth),
        archPoint(a, 0, front - depth),
        archPoint(a, 0, front),
        archPoint(b, 0, front),
      ],
      color.inset,
    );
  }
}

function pin(out, x, z, base, height, lod, wings = false) {
  const top = base + height;
  if (lod < 2) {
    box(out, 'stone', [x - 0.13, base, z - 0.13], [x + 0.13, top, z + 0.13], color.stone);
    return;
  }
  roundMass(
    out,
    x,
    z,
    [
      [base, 0.25, 0.25],
      [base + height * 0.23, 0.19, 0.19, 'stone', color.stone],
      [base + height * 0.8, 0.12, 0.11, 'stone', color.stone],
      [top, 0.075, 0.075, 'stone', color.stone],
    ],
    6,
  );
  if (wings)
    for (const dir of [-1, 1]) {
      triangle(
        out,
        'stone',
        [
          [x, top - 0.44, z + 0.05],
          [x + dir * 0.74, top + 0.09, z + 0.1],
          [x + dir * 0.29, top - 0.53, z + 0.15],
        ],
        color.stone,
      );
      triangle(
        out,
        'stone',
        [
          [x + dir * 0.29, top - 0.53, z + 0.04],
          [x + dir * 0.74, top + 0.09, z - 0.02],
          [x, top - 0.44, z - 0.05],
        ],
        color.inset,
      );
    }
}

function operations(out, lod) {
  const {
    facade: [x, z],
    entryY,
    roofY,
  } = plan.dimensions.operations;
  const facade = transform(out, 0, [x, entryY, z]);
  solid(facade, [-7.1, 7.4, -19.8, 0], -1.9, 13.2, color.brick, 0.45);
  roof(facade, -7.28, 7.56, -20, 0.17, 13.2, roofY, lod);
  for (const [left, right] of [
    [-14.1, -6.9],
    [7.2, 14.4],
  ]) {
    solid(facade, [left, right, -11.3, -4.58], -1.7, 9.28, color.shade, 0.38);
    roof(facade, left - 0.14, right + 0.14, -11.45, -4.44, 9.28, 11.25, lod, true);
    for (const x of [left + 1.3, (left + right) / 2, right - 1.3]) {
      window(facade, x, -4.55, 5.56, 1.12, 2.65, lod, { round: true });
      if (lod) window(facade, x, -4.55, 0.95, 0.95, 2.68, lod, { round: true });
    }
  }
  if (lod)
    for (const [lo, hi] of [
      [-9.2, -7],
      [7.2, 9.65],
    ]) {
      solid(facade, [lo, hi, -17.7, -10.6], -1.4, 10.5, color.brick, 0.33);
      roof(facade, lo - 0.12, hi + 0.12, -17.84, -10.49, 10.5, 11.72, lod);
    }

  const north = transform(facade, Math.PI, [0, 0, -20]);
  const sides = [5, 9, 14, 20][lod];
  roundMass(
    north,
    0,
    0.9,
    [
      [-1.65, 4.75, 5.17],
      [0.62, 4.75, 5.17, 'stone', color.basement],
      [4.04, 4.75, 5.17, 'brick', color.shade],
      [9.52, 4.75, 5.17, 'glass', color.coolGlass],
      [11.64, 4.8, 5.2, 'brick', color.brick],
      [12.18, 4.22, 4.68, 'roof', color.greenTile],
    ],
    sides,
  );
  for (let i = 0; i < (lod > 1 ? 10 : 0); i++) {
    const a = ((i + 0.5) * Math.PI) / (lod ? 10 : 4),
      x = Math.cos(a) * 4.75,
      z = Math.sin(a) * 5.17 + 0.9;
    box(north, 'brick', [x - 0.1, 3.9, z - 0.1], [x + 0.1, 9.65, z + 0.1], color.darkBrick);
  }
  if (lod)
    for (const mirror of [-1, 1]) {
      const side = transform(facade, (mirror * Math.PI) / 2, [mirror * 7.42, 0, -10]);
      for (const x of lod ? [-7.2, -5, -2.8, -0.65, 1.5, 3.7, 5.9, 8] : [-6.7, -1.8, 3.1, 7.8]) {
        window(side, x, 0.024, 9.91, 0.96, 2.62, lod, { round: true });
      }
    }

  for (const [base, top] of lod
    ? [
        [0.25, 0.5],
        [4.43, 4.74],
        [9.21, 9.51],
        [12.99, 13.24],
      ]
    : [[9.21, 9.51]]) {
    box(facade, 'stone', [-7.25, base, -0.19], [7.58, top, 0.19], color.stone);
  }
  if (lod) {
    triangle(
      facade,
      'ceramic',
      [
        [-6.78, 13.3, 0.209],
        [0.18, 13.3, 0.209],
        [0.18, 17.42, 0.209],
      ],
      color.darkBlue,
    );
    triangle(
      facade,
      'ceramic',
      [
        [0.18, 13.3, 0.209],
        [6.99, 13.3, 0.209],
        [0.18, 17.42, 0.209],
      ],
      color.darkBlue,
    );
    panel(facade, 'stone', -2.13, 2.48, 13.25, 14.26, 0.23, color.stone);
    triangle(
      facade,
      'stone',
      [
        [-2.4, 14.26, 0.26],
        [2.66, 14.26, 0.26],
        [0.18, 16.1, 0.26],
      ],
      color.stone,
    );
    for (const side of [-1, 1]) {
      beam(
        facade,
        'stone',
        [0.18, 17.62, 0.24],
        [0.18 + side * 7.42, 13.23, 0.24],
        0.22,
        0.27,
        color.stone,
      );
      if (lod > 1)
        for (let j = 1; j < 8; j++) {
          const x = side * j * 0.69,
            y = 13.6 + (7 - j) * 0.31;
          triangle(
            facade,
            'ceramic',
            [
              [x - 0.14, y, 0.248],
              [x + 0.14, y, 0.248],
              [x, y + 0.32, 0.248],
            ],
            j % 2 ? color.cream : color.paleBlue,
          );
        }
    }
  }
  const bays = lod ? [-5.84, -4.27, -2.7, -1.23, 1.57, 3.04, 4.61, 6.18] : [-5.1, -2.92, 3.22, 5.5];
  for (const x of bays) {
    panel(facade, 'ceramic', x - 0.64, x + 0.64, 9.51, 12.33, 0.227, color.darkBlue);
    if (lod) {
      panel(facade, 'ceramic', x - 0.5, x + 0.5, 9.61, 11.83, 0.245, color.skyBlue);
      pin(facade, x + 0.67, 0.38, 9.45, 3.29, lod);
      if (lod > 1) {
        beam(
          facade,
          'ceramic',
          [x - 0.35, 9.8, 0.267],
          [x, 10.76, 0.267],
          0.082,
          0.026,
          color.cream,
        );
        beam(
          facade,
          'ceramic',
          [x, 10.76, 0.267],
          [x + 0.35, 9.8, 0.267],
          0.082,
          0.026,
          color.cream,
        );
      }
    }
  }
  window(facade, 0.17, 0.275, 9.48, 1.5, 4.24, lod, { round: true, tint: color.door });
  for (const x of [-5.2, 5.56]) {
    window(facade, x, 0.062, 0.91, 1.5, 2.8, lod, { round: true });
    window(facade, x, 0.064, 5.48, 1.52, 2.58, lod, { round: true });
  }
  for (const [base, deck, front] of [
    [0.3, 4.69, 2.96],
    [4.77, 9.47, 2.59],
  ]) {
    box(facade, 'stone', [-2.85, deck - 0.28, 0.18], [3.23, deck, front + 0.19], color.stone);
    for (const x of [-2.65, 0.17, 2.98]) {
      box(
        facade,
        x === 0.17 ? 'brick' : 'stone',
        [x - 0.19, base, front - 0.22],
        [x + 0.19, deck - 0.12, front + 0.025],
        x === 0.17 ? color.darkBrick : color.stone,
      );
      if (lod)
        box(
          facade,
          'stone',
          [x - 0.28, base, front - 0.28],
          [x + 0.28, base + 0.37, front + 0.13],
          color.stone,
        );
    }
    for (const x of [-1.24, 1.57])
      gallery(facade, x, 1.22, front, base + 0.72, deck - base - 1.06, lod);
    if (lod) {
      box(
        facade,
        'stone',
        [-2.83, deck + 0.56, front - 0.15],
        [3.18, deck + 0.67, front + 0.11],
        color.stone,
      );
      for (let i = 0; i < (lod > 1 ? 17 : 8); i++) {
        const x = -2.71 + i * (lod > 1 ? 0.36 : 0.82);
        box(
          facade,
          'stone',
          [x - 0.033, deck, front - 0.095],
          [x + 0.033, deck + 0.57, front + 0.015],
          color.stone,
        );
      }
    }
  }
  window(facade, 0.17, 0.073, 0.39, 2.06, 3.23, lod, { round: true, tint: color.door });
  window(facade, 0.17, 0.075, 5.25, 2.07, 3.23, lod, { round: true });
  for (const [x, y, h, wing] of [
    [-6.8, 13, 1.1, false],
    [-3.57, 15.53, 1.34, false],
    [0.18, 17.85, 1.63, true],
    [3.99, 15.38, 1.33, true],
    [7.2, 13, 1.02, false],
  ]) {
    if (lod || wing) pin(facade, x, 0.28, y, h, lod, wing);
  }
}

function carme(out, lod) {
  const {
    eastFront: [x, z],
    entryY,
  } = plan.dimensions.carme;
  const east = transform(out, Math.PI / 2, [x, entryY, z]);
  solid(east, [-7.15, 9.05, -10.75, 0.1], -2.28, 9.27, color.brick, 0.28);
  solid(east, [-8.92, 5.4, -23.9, -10.55], -1.76, 8.03, color.brick, 1.4);
  roof(east, -9.03, 5.53, -24.05, -10.44, 8.03, 10.36, lod);
  if (lod)
    for (const [angle, edge] of [
      [-Math.PI / 2, -8.94],
      [Math.PI / 2, 5.42],
    ]) {
      const side = transform(east, angle, [edge, 0, -17.32]);
      for (const bay of [-4.1, -1.35, 1.35, 4.1]) {
        window(side, bay, 0, 2.36, 1.33, 3.52, lod, { round: true });
      }
    }
  // The west ward floor steps up with the surrounding ground.
  for (const wing of [
    { x0: -6.5, x1: 4.78, z0: -32.2, z1: -23.76, grade: 2.11 },
    { x0: -6.72, x1: 7.21, z0: -49.91, z1: -32.09, grade: 3.14 },
  ]) {
    const { x0, x1, z0, z1, grade } = wing;
    solid(east, [x0, x1, z0, z1], grade - 1.7, grade + 4.77, color.shade, grade + 0.35);
    roof(east, x0 - 0.11, x1 + 0.11, z0 - 0.15, z1 + 0.13, grade + 4.77, grade + 7.24, lod);
    for (const mirror of [-1, 1]) {
      const side = transform(east, (mirror * Math.PI) / 2, [
        mirror > 0 ? x1 + 0.02 : x0 - 0.02,
        0,
        (z0 + z1) / 2,
      ]);
      const count = Math.max(2, Math.ceil((z1 - z0) / (lod ? 2.55 : 4.2)));
      if (lod)
        for (let i = 0; i < count; i++) {
          const x = ((i + 0.5 - count / 2) * (z1 - z0)) / count;
          window(side, x, 0, grade + 1.08, 1.39, 2.8, lod, { round: true });
        }
    }
  }
  const rear = transform(east, Math.PI, [0.25, 0, -49.94]);
  for (const x of [-4.55, -1.62, 1.52, 4.52])
    window(rear, x, 0, 4.59, 1.27, 2.38, lod, { round: true });

  const rx = -5.48,
    rz = -0.6,
    sides = [6, 9, 12, 16][lod];
  roundMass(
    east,
    rx,
    rz,
    [
      [-2.23, 4.55, 4.39],
      [0.01, 4.55, 4.39, 'stone', color.basement],
      [2.12, 4.49, 4.35, 'brick', color.brick],
      [2.31, 4.57, 4.44, 'stone', color.stone],
      [5.47, 4.41, 4.33, 'brick', color.brick],
      [5.68, 4.53, 4.45, 'ceramic', color.darkBlue],
      [8.82, 4.41, 4.34, 'brick', color.brick],
      [9.07, 4.59, 4.51, 'stone', color.stone],
      [9.97, 3.68, 3.67, 'roof', color.yellow],
      [10.85, 2.58, 2.51, 'roof', color.yellow],
      [11.42, 1.32, 1.25, 'roof', color.yellow],
      [11.57, 0.35, 0.35, 'roof', color.terracotta],
      [11.69, 0.28, 0.28, 'stone', color.inset],
    ],
    sides,
  );
  for (let i = 0; i < (lod ? 6 : 3); i++) {
    const count = lod ? 6 : 3;
    const a = -Math.PI * 0.46 + (Math.PI * 1.16 * (i + 0.5)) / count;
    const bay = transform(east, a, [rx + Math.sin(a) * 4.28, 0, rz + Math.cos(a) * 4.26]);
    window(bay, 0, 0.19, 2.48, 1.49, 2.57, lod, { round: true, tint: color.door });
    window(bay, 0, 0.19, 6.12, 1.03, 2.43, lod, { round: true, tint: color.coolGlass });
    if (lod) {
      box(bay, 'brick', [0.86, 2.3, 0.04], [1.13, 8.9, 0.46], color.orange);
      box(bay, 'stone', [0.78, 2.13, 0.06], [1.21, 2.37, 0.47], color.stone);
      box(bay, 'stone', [0.78, 8.75, 0.06], [1.21, 9.02, 0.47], color.stone);
      pin(bay, 0.95, 0.29, 9.05, 0.49, lod);
      if (lod > 1) {
        const topAt = [rx + Math.sin(a) * 0.5, 11.63, rz + Math.cos(a) * 0.5];
        const ridgeAt = [rx + Math.sin(a) * 2.6, 10.92, rz + Math.cos(a) * 2.54];
        const eaveAt = [rx + Math.sin(a) * 4.53, 9.17, rz + Math.cos(a) * 4.46];
        beam(east, 'roof', topAt, ridgeAt, 0.22, 0.1, color.cream);
        beam(east, 'roof', ridgeAt, eaveAt, 0.22, 0.1, color.cream);
      }
    }
  }
  window(east, 1.62, 0.19, 0.43, 2.34, 3.66, lod, { tint: color.door });
  window(east, 1.62, 0.2, 5.55, 2.08, 1.29, lod, { round: true, tint: color.glass });
  if (lod)
    for (const x of [0.12, 3.14]) {
      box(east, 'stone', [x - 0.22, 0.24, 0.1], [x + 0.22, 7.22, 0.55], color.stone);
      pin(east, x, 0.47, 6.08, 1.98, lod);
    }
  gallery(east, 1.62, 1.53, 0.5, 5.28, 2.09, lod);
  panel(east, 'stone', 0.92, 2.28, 7.26, 9.38, 0.513, color.inset);
  triangle(
    east,
    'stone',
    [
      [0.54, 9.08, 0.55],
      [2.66, 9.08, 0.55],
      [1.63, 10.49, 0.55],
    ],
    color.stone,
  );
  pin(east, 1.62, 0.68, 7.59, 1.66, lod);
  if (lod) {
    for (const x of [4.32, 5.25, 6.18, 7.11, 8.04]) {
      panel(east, 'stone', x - 0.33, x + 0.33, 6.94, 7.63, 0.18, color.stone);
      panel(east, 'brick', x - 0.14, x + 0.14, 7.09, 7.44, 0.204, color.darkBrick);
    }
    window(east, 6.12, 0.18, 2.11, 1.17, 3.08, lod, { round: true });
  }

  const tx = 8.22,
    tz = 1.13,
    count = [4, 7, 10, 14][lod];
  roundMass(
    east,
    tx,
    tz,
    [
      [-1.81, 1.08, 1.08],
      [0.24, 1.1, 1.09, 'stone', color.basement],
      [7.12, 1.11, 1.1, 'brick', color.brick],
      [7.37, 1.2, 1.19, 'stone', color.stone],
      [7.89, 1.22, 1.21, 'ceramic', color.darkBlue],
      [8.15, 1.12, 1.12, 'stone', color.stone],
    ],
    count,
  );
  window(east, tx, tz + 1.13, 2.78, 0.53, 1.43, lod, { round: true });
  for (let i = 0; i < (lod ? 6 : 4); i++) {
    const a = (i * Math.PI * 2) / (lod ? 6 : 4),
      x = tx + 0.91 * Math.cos(a),
      z = tz + 0.91 * Math.sin(a);
    box(east, 'stone', [x - 0.15, 8.13, z - 0.15], [x + 0.15, 12.02, z + 0.15], color.stone);
  }
  roundMass(
    east,
    tx,
    tz,
    [
      [11.91, 1.05, 1.05],
      [12.25, 1.2, 1.2, 'stone', color.stone],
      [13.41, 1.27, 1.27, 'ceramic', color.skyBlue],
      [13.71, 1.32, 1.32, 'stone', color.stone],
      [14.11, 1.22, 1.22, 'stone', color.inset],
      [14.32, 1.15, 1.15, 'ceramic', color.cream],
      [16.95, 0.64, 0.64, 'roof', color.terracotta],
      [17.28, 0.59, 0.59, 'ceramic', color.darkBlue],
      [17.56, 0.48, 0.48, 'ceramic', color.yellow],
      [18.27, 0.43, 0.43, 'stone', color.inset],
      [18.57, 0.53, 0.53, 'stone', color.stone],
    ],
    count,
  );
  if (lod) {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const inset = transform(east, a, [tx + Math.sin(a) * 1.195, 0, tz + Math.cos(a) * 1.195]);
      panel(inset, 'ceramic', -0.24, 0.24, 12.43, 12.97, 0.091, color.yellow);
    }
  }
  if (lod)
    for (let i = 0; i < 5; i++) {
      const n = 5;
      box(
        east,
        'stone',
        [-0.01, -0.14, 0.52 + i * 0.37],
        [3.21, 0.42 * (1 - i / n), 0.9 + i * 0.37],
        color.stone,
      );
    }
}

function build(out, lod) {
  operations(out, lod);
  carme(out, lod);
}

export const pavilionSkyline = (out) => build(out, 0);
export const pavilionDistrict = (out) => build(out, 1);
export const pavilionStreet = (out) => build(out, 2);
export const pavilionCloseup = (out) => build(out, 3);

const recipe = 'hospital-de-sant-pau-model.mjs';
const camera = [37, 50, 103];
const lookAt = [-17, 7, -7];
export const pavilionModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: pavilionCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Two pavilions at Barcelona’s Hospital de Sant Pau with red-brick façades, carved limestone, multicolored tiles and green glazing. The Operations Pavilion has a sculpted gable and arcaded entrance. The Carme Pavilion has a domed rotunda and an open-sided tiled water tower.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [47, 53, 22],
  portableGroundY: -2.22,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: operationOutline,
    outlines: [operationOutline, carmeOutline],
    minimumCoverage: 0.88,
    basis:
      'Separate mapped outlines for the Operations and Carme pavilions, leaving the remaining precinct intact.',
  },
  embeddedCanonicalGraphs: ['brick', 'stone_limestone', 'tile_ceramic', 'tile_glazed'],
  qaCameras: [
    { name: 'operations-ceramic-gable-and-arcade', position: [26, 10, 25], lookAt: [12, 8, -5] },
    { name: 'carme-rotunda-portal-and-water-tower', position: [13, 10, 9], lookAt: [-19, 8.4, 8] },
    { name: 'operating-room-apse-and-ward-roofs', position: [-31, 32, -57], lookAt: [-13, 7, -11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sant-pau-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'pavilionSkyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'pavilionDistrict', 0.29],
        ['street', 'pavilionStreet', 0.12],
        ['closeup', 'pavilionCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap footprints under ODbL. Both Qualla source photographs were dedicated to CC0 by their photographers.',
};
