/** Cypress bark roofs and the raised timber state-ceremony hall. */
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const palette = Object.fromEntries(
  Object.entries({
    bark: '4f3b2d',
    ridge: '493f38',
    grayTile: '5d6466',
    tileRidge: '505858',
    front: '493528',
    wood: '563d30',
    woodEdge: '705140',
    deck: '825e45',
    recess: '3e342d',
    plaster: 'e2d9c4',
    older: 'caba9f',
    copper: '54796f',
    stone: '979386',
    grain: 'bd9d74',
  }).map(([id, value]) => [id, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;

export function palaceHipGable(
  out,
  { width, depth, eaves, ridge, ceramic = false, expressedSkirt = false },
  lod,
) {
  const divisions = [1, 3, 6, 10][lod];
  const height = ridge - eaves;
  const profile = expressedSkirt
    ? [
        [0, 1, 1, 0.053],
        [0.12, 0.93, 0.81, 0.03],
        [0.26, 0.845, 0.63, 0.019],
        [0.47, 0.764, 0.41, 0.009],
        [0.72, 0.744, 0.2, 0.008],
        [0.977, 0.719, 0.014, 0.01],
      ]
    : [
        [0, 1, 1, 0.065],
        [0.16, 0.9, 0.78, 0.028],
        [0.41, 0.78, 0.48, 0.014],
        [0.7, 0.74, 0.23, 0.007],
        [0.977, 0.712, 0.015, 0.008],
      ];
  const roof = ceramic ? 'tile' : 'bark';
  const tint = ceramic ? palette.grayTile : palette.bark;
  const r = profile.map(([fraction, u, v, lift]) => {
    const x = (width * u) / 2,
      z = (depth * v) / 2;
    const corners = [
      [-x, -z],
      [-x, z],
      [x, z],
      [x, -z],
    ];
    return corners.flatMap((p, i) => {
      const q = corners[(i + 1) % 4];
      return Array.from({ length: divisions }, (_, j) => {
        const t = j / divisions;
        const h = Math.abs(t * 2 - 1);
        return [
          mix(p[0], q[0], t),
          eaves + height * (fraction + lift * h * h * h * h),
          mix(p[1], q[1], t),
        ];
      });
    });
  });
  for (let i = 1; i < r.length; i++)
    for (let j = 0; j < r[i].length; j++) {
      const k = (j + 1) % r[i].length;
      const gable = i >= r.length - 2 && Math.floor(j / divisions) % 2 === 0;
      const slot = gable ? 'timber' : roof;
      const color = gable ? palette.wood : tint;
      triangle(out, slot, [r[i - 1][j], r[i - 1][k], r[i][k]], color);
      triangle(out, slot, [r[i - 1][j], r[i][k], r[i][j]], color);
    }
  const cap = r.at(-1);
  face(out, roof, [cap[0], cap[divisions], cap[2 * divisions], cap[3 * divisions]], tint);
  if (lod === 0) return;
  const crest = ceramic ? palette.tileRidge : palette.ridge;
  const span = width * 0.362;
  beamPath(
    out,
    roof,
    [
      [-span, ridge, 0],
      [-span * 0.95, ridge - height * 0.014, 0],
      [span * 0.95, ridge - height * 0.014, 0],
      [span, ridge, 0],
    ],
    ceramic ? 0.32 : 0.29,
    ceramic ? 0.23 : 0.22,
    crest,
  );
  beamPath(out, roof, r[0], 0.17, 0.26, crest, true);
  if (expressedSkirt) {
    const skirt = r[2].map(([x, y, z]) => [x * 1.003, y + 0.02, z * 1.004]);
    beamPath(out, roof, skirt, 0.12, 0.18, crest, true);
    if (lod > 1) {
      for (const side of [-1, 1]) {
        const x = (side * width) / 2;
        const trim = [
          r[0][side > 0 ? 2 * divisions : divisions],
          r[1][side > 0 ? 2 * divisions : divisions],
          r[2][side > 0 ? 2 * divisions : divisions],
          r[3][side > 0 ? 2 * divisions : divisions],
          r.at(-1)[side > 0 ? 2 * divisions : divisions],
        ];
        beamPath(out, 'timber', trim, 0.11, 0.13, palette.woodEdge);
        box(
          out,
          'metal',
          [x - 0.19, eaves + height * 0.043, -0.094],
          [x + 0.19, eaves + height * 0.057, 0.094],
          palette.copper,
        );
      }
    }
  }
}

function frontPanel(out, slot, x0, x1, y0, y1, z, tint) {
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

function distantVeranda(out, w, d, deck, eave, lod) {
  const halfW = w + 2.02,
    halfD = d + 2.44;
  box(
    out,
    'stone',
    [-halfW - 0.41, -0.83, -halfD - 0.38],
    [halfW + 0.41, 0.19, halfD + 0.38],
    palette.stone,
  );
  box(out, 'timber', [-w * 0.95, 0.2, -d * 0.95], [w * 0.95, deck, d * 0.95], palette.recess);
  box(out, 'timber', [-halfW, deck - 0.38, -halfD], [halfW, deck, halfD], palette.deck);
  box(out, 'timber', [-w, deck, -d], [w, eave + 0.05, d], palette.front);
  for (const [angle, x, z] of [
    [0, w, d],
    [Math.PI / 2, d, w],
    [Math.PI, w, d],
    [(3 * Math.PI) / 2, d, w],
  ]) {
    const edge = transform(out, angle);
    const n = lod === 0 ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const a = mix(-x, x, i / n) + 0.15,
        b = mix(-x, x, (i + 1) / n) - 0.15;
      frontPanel(edge, 'plaster', a, b, eave - 2.4, eave - 0.62, z + 0.025, palette.plaster);
      if (lod > 0)
        frontPanel(edge, 'timber', a, b, deck + 0.9, eave - 2.61, z + 0.03, palette.recess);
    }
  }
}

function veranda(out, w, d, deck, eave, lod) {
  if (lod < 2) {
    distantVeranda(out, w, d, deck, eave, lod);
    return;
  }
  const extendedW = w + 2.02,
    extendedD = d + 2.44;
  box(
    out,
    'stone',
    [-extendedW - 0.41, -0.83, -extendedD - 0.38],
    [extendedW + 0.41, 0.19, extendedD + 0.38],
    palette.stone,
  );
  box(
    out,
    'timber',
    [-extendedW, deck - 0.38, -extendedD],
    [extendedW, deck, extendedD],
    palette.deck,
  );
  box(out, 'timber', [-w, deck, -d], [w, eave - 0.45, d], palette.wood);
  const legs = [10, 7];
  for (const [direction, extent, far, tally] of [
    [0, w, d, legs[0]],
    [Math.PI / 2, d, w, legs[1]],
    [Math.PI, w, d, legs[0]],
    [(3 * Math.PI) / 2, d, w, legs[1]],
  ]) {
    const side = transform(out, direction);
    const railZ = far + (direction % Math.PI === 0 ? 2.44 : 2.02);
    const n = tally;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = mix(-extent + 0.13, extent - 0.13, t);
      if (i < n) {
        const x1 = mix(-extent + 0.13, extent - 0.13, (i + 1) / n);
        frontPanel(
          side,
          'plaster',
          x + 0.145,
          x1 - 0.145,
          eave - 2.37,
          eave - 0.61,
          far + 0.061,
          i % 4 === 2 ? palette.older : palette.plaster,
        );
        frontPanel(
          side,
          'timber',
          x + 0.154,
          x1 - 0.15,
          deck + 1.22,
          eave - 2.58,
          far + 0.064,
          palette.recess,
        );
        const bars = lod === 3 ? 7 : 3;
        for (let k = 1; k <= bars; k++) {
          const l = mix(x + 0.21, x1 - 0.21, k / (bars + 1));
          frontPanel(
            side,
            'timber',
            l - 0.023,
            l + 0.023,
            deck + 1.25,
            eave - 2.6,
            far + 0.084,
            palette.woodEdge,
          );
        }
      }
      box(
        side,
        'timber',
        [x - 0.18, deck - 0.08, far - 0.14],
        [x + 0.18, eave - 0.35, far + 0.2],
        palette.front,
      );
      box(
        side,
        'timber',
        [x - 0.2, 0.13, railZ - 0.32],
        [x + 0.2, deck + 0.05, railZ + 0.065],
        palette.front,
      );
      if (lod > 0) {
        box(
          side,
          'stone',
          [x - 0.26, 0.12, railZ - 0.39],
          [x + 0.26, 0.36, railZ + 0.13],
          palette.stone,
        );
        if (direction !== 0 || Math.abs(x) > 5.25)
          box(
            side,
            'timber',
            [x - 0.056, deck - 0.01, railZ - 0.16],
            [x + 0.056, deck + 0.9, railZ - 0.04],
            palette.woodEdge,
          );
      }
    }
    if (lod > 0) {
      const pieces =
        direction === 0
          ? [
              [-extent, -5.25],
              [5.25, extent],
            ]
          : [[-extent, extent]];
      for (const [a, b] of pieces) {
        box(
          side,
          'timber',
          [a, deck + 0.79, railZ - 0.19],
          [b, deck + 0.9, railZ - 0.02],
          palette.woodEdge,
        );
        box(
          side,
          'timber',
          [a, deck + 0.33, railZ - 0.16],
          [b, deck + 0.41, railZ - 0.02],
          palette.wood,
        );
      }
    }
    if (lod > 2)
      for (let x = -extent - 1.15; x < extent + 1.17; x += lod === 3 ? 0.495 : 1.14) {
        box(
          side,
          'timber',
          [x - 0.074, eave - 0.52, far - 0.14],
          [x + 0.074, eave - 0.32, railZ + 1.45],
          palette.front,
        );
        if (lod > 2)
          box(
            side,
            'plaster',
            [x - 0.043, eave - 0.48, railZ + 1.445],
            [x + 0.043, eave - 0.35, railZ + 1.49],
            palette.older,
          );
      }
  }
}

function stair(out, z, deck, full, lod, halfWidth = 4.57, run = 5.25) {
  const n = [4, 8, full, full][lod];

  for (let i = 0; i < n; i++) {
    const a = z + (run * i) / n,
      b = z + (run * (i + 1)) / n;
    const h = deck * (1 - i / n);
    box(
      out,
      'timber',
      [-halfWidth, -0.51, a - 0.026],
      [halfWidth, h, b + 0.015],
      i % 3 === 1 ? palette.woodEdge : palette.deck,
    );
    if (lod > 1)
      box(
        out,
        'timber',
        [-halfWidth - 0.07, h - 0.071, b - 0.11],
        [halfWidth + 0.07, h + 0.009, b + 0.048],
        palette.grain,
      );
  }
  if (lod === 0) return;
  for (const x of [-halfWidth - 0.08, halfWidth + 0.08]) {
    const rail = [
      [x, deck + 0.83, z - 0.17],
      [x, 0.86, z + run + 0.1],
    ];
    beamPath(out, 'timber', rail, 0.145, 0.15, palette.woodEdge);
    const supports = lod > 1 ? 7 : 4;
    for (let i = 0; i <= supports; i++) {
      const t = i / supports,
        d = z + run * t,
        y = deck * (1 - t);
      box(
        out,
        'timber',
        [x - 0.07, y - 0.025, d - 0.07],
        [x + 0.07, y + 0.85, d + 0.07],
        palette.wood,
      );
    }
  }
}

export function buildShishinden(out, controls, lod) {
  const hall = transform(out, controls.heading, [
    controls.center[0],
    controls.groundDatum,
    controls.center[1],
  ]);
  veranda(
    hall,
    controls.bodyWidth / 2,
    controls.bodyDepth / 2,
    controls.verandaHeight,
    controls.roofEavesHeight,
    lod,
  );
  palaceHipGable(
    hall,
    {
      width: controls.roofWidth,
      depth: controls.roofDepth,
      eaves: controls.roofEavesHeight,
      ridge: controls.roofRidgeHeight - 0.11,
      expressedSkirt: true,
    },
    lod,
  );
  stair(hall, controls.bodyDepth / 2 + 2.32, controls.verandaHeight, controls.mainStairTreads, lod);
  if (lod === 3)
    for (const side of [-1, 1]) {
      const frame = transform(hall, (side * Math.PI) / 2, [0, 0, 7.86]);
      stair(frame, controls.bodyWidth / 2 + 1.89, controls.verandaHeight, 9, lod, 1.49, 2.95);
    }
}
