import {
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const ref = 'palette:#ffffff';
const limestone = [0.59, 0.54, 0.45];
const stoneBase = [0.44, 0.41, 0.36];
const displayGray = [0.35, 0.375, 0.38];
const frame = [0.25, 0.27, 0.265];
const paper = [0.66, 0.65, 0.59];
const quad = (out, slot, points, color) =>
  out.addQuad(slot, ref, points, normalFor(...points), [], color);

// The restored Pillars Hall has a low left display, a reading plinth opposite, and
// square benches against the rock. The display composition represents the furniture.
export function pillarsHallFurnishings(out, detail) {
  if (detail.joinery) box(out, 'foundation', [-2.05, 0, -1.46], [-1.3, 0.23, 0.62], stoneBase);
  box(out, 'ashlar', [-1.94, detail.joinery ? 0.23 : 0, -1.35], [-1.43, 0.66, 0.49], limestone);
  box(out, 'iron', [-1.88, 0.72, -1.47], [-1.77, 2.24, 0.61], frame);
  quad(
    out,
    'plaster',
    [
      [-1.765, 0.78, 0.55],
      [-1.765, 0.78, -1.41],
      [-1.765, 2.18, -1.41],
      [-1.765, 2.18, 0.55],
    ],
    displayGray,
  );
  loft(
    out,
    'ashlar',
    [-1.07, 0.95].map((z) => [
      [1.061, 0, z],
      [1.619, 0, z],
      [1.619, 1.036, z],
      [1.061, 0.774, z],
    ]),
    limestone,
  );
  quad(
    out,
    'iron',
    [
      [1.04, 0.79, 0.97],
      [1.64, 1.065, 0.97],
      [1.64, 1.065, -1.09],
      [1.04, 0.79, -1.09],
    ],
    frame,
  );
  box(out, 'ashlar', [1.14, 0, 1.45], [1.89, 0.47, 2.37], limestone);
  box(out, 'rough', [-2.06, 0, 1.51], [-1.59, 2.64, 2.11], limestone);
  if (!detail.joinery) return;

  const sheet = (z0, z1) => [
    [1.18, 0.861, z1],
    [1.56, 1.035, z1],
    [1.56, 1.035, z0],
    [1.18, 0.861, z0],
  ];
  for (const z of [-0.96, -0.37, 0.28]) quad(out, 'plaster', sheet(z, z + 0.47), paper);
  if (!detail.boneFaces) return;

  // Close range retains the steel catches and the visual divisions between exhibit panels.
  for (const z of [-1.32, -0.9, -0.48, -0.06, 0.36]) {
    box(out, 'iron', [-1.77, 0.72, z], [-1.69, 0.77, z + 0.03], frame);
  }
  for (const z of [-1.34, -0.66, 0.02]) {
    quad(
      out,
      'plaster',
      [
        [-1.763, 0.92, z + 0.59],
        [-1.763, 0.92, z],
        [-1.763, 1.91, z],
        [-1.763, 1.91, z + 0.59],
      ],
      [0.46, 0.466, 0.457],
    );
  }
}

// The square supports meet the quarry ceiling on each side of the central aisle.
// Close range adds individual chamfered ashlar courses, as visible in the restored room.
export function ossuaryVestibuleFurnishings(out, detail) {
  const ceilingSeat = 2.74;
  const piers = [
    { x: -1.33, z: 0.43, w: 0.69, d: 0.67 },
    { x: 1.4, z: 0.02, w: 0.78, d: 0.73 },
  ];
  for (const { x, z, w, d } of piers) {
    if (!detail.boneFaces) {
      box(out, 'ashlar', [x - w / 2, 0, z - d / 2], [x + w / 2, ceilingSeat, z + d / 2], limestone);
      if (detail.joinery)
        for (const y of [0.27, 0.61, 0.95, 1.29, 1.63, 1.97, 2.31]) {
          quad(
            out,
            'rough',
            [
              [x + w / 2, y, z - d / 2 - 0.002],
              [x - w / 2, y, z - d / 2 - 0.002],
              [x - w / 2, y + 0.016, z - d / 2 - 0.002],
              [x + w / 2, y + 0.016, z - d / 2 - 0.002],
            ],
            stoneBase,
          );
        }
      continue;
    }
    for (let i = 0; i < 8; i++) {
      const y = i * 0.312;
      const lower = chamferedRectangle(x, y - 0.003, z, w * 0.985, d * 0.98, 0.027);
      const upper = chamferedRectangle(x, i === 7 ? ceilingSeat : y + 0.315, z, w, d, 0.034);
      const tint = limestone.map((channel) => channel * (0.9 + 0.022 * ((i * 5) % 7)));
      loft(out, 'ashlar', [lower, upper], tint);
    }
  }
  box(out, 'foundation', [-1.99, 0, 0.87], [-1.61, 0.17, 1.51], stoneBase);
  box(out, 'rough', [-1.99, 0.47, 0.82], [-1.88, 1.86, 1.72], limestone);
  if (detail.joinery)
    quad(
      out,
      'plaster',
      [
        [-1.875, 0.53, 1.67],
        [-1.875, 0.53, 0.88],
        [-1.875, 1.8, 0.88],
        [-1.875, 1.8, 1.67],
      ],
      paper,
    );
}
