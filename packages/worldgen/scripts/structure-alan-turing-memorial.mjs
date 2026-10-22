/** Original photograph-directed static bronze memorial, including seated portrait and bench. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcw/alan_turing_memorial/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const bronze = rgb('665f4d'),
  raised = rgb('706754'),
  recess = rgb('595643');
const ref = 'palette:#ffffff';
const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.79, metallic: 0.52 },
};
function tri(o, ps, color = bronze, outward) {
  if (outward && normalFor(...ps).reduce((s, x, i) => s + x * outward[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    'bronze',
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[1]]),
    color,
  );
}
// Convex section rings follow the actual bent limb or cloth axis. Transport prevents twisted cuffs.
function tube(o, sections, sides, color = bronze) {
  let previous;
  const rings = sections.map(([p, rx, rz], i) => {
    const a = sections[Math.max(0, i - 1)][0],
      b = sections[Math.min(sections.length - 1, i + 1)][0];
    const axis = normalize(b.map((x, k) => x - a[k]));
    let u;
    if (previous) {
      const dot = previous.reduce((s, x, k) => s + x * axis[k], 0);
      u = normalize(previous.map((x, k) => x - dot * axis[k]));
    } else u = normalize(cross(axis, Math.abs(axis[1]) > 0.94 ? [1, 0, 0] : [0, 1, 0]));
    previous = u;
    const v = cross(axis, u);
    return Array.from({ length: sides }, (_, j) =>
      p.map(
        (x, k) =>
          x +
          Math.cos((j * 2 * Math.PI) / sides) * rx * u[k] +
          Math.sin((j * 2 * Math.PI) / sides) * rz * v[k],
      ),
    );
  });
  // Nonplanar curved sections need each triangle's actual normal.
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides;
      tri(o, [rings[j - 1][i], rings[j - 1][k], rings[j][k]], color);
      tri(o, [rings[j - 1][i], rings[j][k], rings[j][i]], color);
    }
  for (let i = 1; i < sides - 1; i++) {
    tri(o, [rings[0][0], rings[0][i + 1], rings[0][i]], color);
    tri(o, [rings.at(-1)[0], rings.at(-1)[i], rings.at(-1)[i + 1]], color);
  }
}
function line(o, points, radius, sides = 5, color = raised) {
  tube(
    o,
    points.map((p) => [p, radius, radius]),
    sides,
    color,
  );
}
function panel(o, points, thickness = 0.004, color = raised) {
  points = points.map((p) => [p[0], p[1], p[2] + 0.016]);
  // Thin solid cloth folds; front is +Z, not a photograph pasted on the body.
  const back = points.map((p) => [p[0], p[1], p[2] - thickness]);
  for (let j = 1; j < points.length - 1; j++) {
    tri(o, [points[0], points[j], points[j + 1]], color, [0, 0, 1]);
    tri(o, [back[0], back[j], back[j + 1]], color, [0, 0, -1]);
  }
  for (let i = 0; i < points.length; i++) {
    const k = (i + 1) % points.length;
    tri(o, [back[i], back[k], points[k]], color);
    tri(o, [back[i], points[k], points[i]], color);
  }
}
function sectionBody(o, profile, n, color = bronze) {
  loft(
    o,
    'bronze',
    profile.map(([y, rx, rz, cz = 0]) => radialRing(y, rx, rz, n, [0, cz])),
    color,
  );
}
function bench(o, d) {
  const b = plan.estimatedBench;
  // Five individually cast seat boards and three back boards have genuine open gaps at every LOD.
  for (let j = 0; j < 5; j++) {
    const z = -0.225 + j * 0.106;
    box(
      o,
      'bronze',
      [-b.width / 2, b.seatHeight - 0.045, z - 0.044],
      [b.width / 2, b.seatHeight, z + 0.044],
      bronze,
    );
  }
  for (const x of [-0.94, 0.94]) {
    for (const z of [-0.19, 0.19]) {
      beam(
        o,
        'bronze',
        [x + (z > 0 ? 0.035 : -0.035), -0.035, z + (z > 0 ? 0.035 : -0.035)],
        [x, 0.435, z],
        0.095,
        0.105,
        bronze,
      );
    }
    beam(o, 'bronze', [x, 0.39, -0.26], [x, 0.39, 0.26], 0.075, 0.07, bronze);
    beam(o, 'bronze', [x, 0.43, -0.205], [x, b.backTop + 0.005, -0.305], 0.065, 0.065, bronze);
  }
  for (let j = 0; j < 3; j++) {
    const y = 0.59 + j * 0.155,
      z = -0.225 - (y - 0.46) * Math.tan((10 * Math.PI) / 180);
    box(o, 'bronze', [-b.width / 2, y, z - 0.028], [b.width / 2, y + 0.1, z + 0.028], bronze);
  }
  if (d >= 2) {
    for (const x of [-0.94, 0.94])
      for (let j = 0; j < 3; j++) {
        const y = 0.64 + j * 0.155,
          z = -0.225 - (y - 0.46) * Math.tan((10 * Math.PI) / 180) + 0.03;
        sphere(o, 'bronze', [x, y, z], [0.008, 0.008, 0.003], raised, 6, 3);
      }
  }
}
function legs(o, d) {
  const n = [5, 8, 14, 22][d];
  for (const sign of [-1, 1]) {
    const x = sign * 0.2,
      front = sign < 0 ? 0 : 0.035;
    tube(
      o,
      [
        [[sign * 0.105, 0.55, -0.005], 0.11, 0.095],
        [[sign * 0.145, 0.535, 0.16], 0.115, 0.105],
        [[x, 0.49, 0.35 + front], 0.102, 0.102],
        [[x, 0.42, 0.43 + front], 0.086, 0.093],
        [[x, 0.3, 0.45 + front], 0.079, 0.087],
        [[sign * 0.21, 0.17, 0.49 + front], 0.068, 0.075],
        [[sign * 0.21, 0.095, 0.505 + front], 0.063, 0.068],
      ],
      n,
    );
    // Separate broad low shoes with a rounded toe, upper vamp and actual sole volume.
    const zz = 0.565 + front;
    loft(
      o,
      'bronze',
      [
        radialRing(0.012, 0.074, 0.166, n, [sign * 0.21, zz]),
        radialRing(0.036, 0.076, 0.168, n, [sign * 0.21, zz]),
        radialRing(0.073, 0.07, 0.155, n, [sign * 0.21, zz - 0.007]),
        radialRing(0.115, 0.053, 0.087, n, [sign * 0.21, zz - 0.047]),
      ],
      bronze,
    );
    if (d >= 2) {
      // Shallow modeled knee/shin cloth ridges, not contrasting painted stripes.
      for (const dx of [-0.043, 0.018])
        line(
          o,
          [
            [x + dx, 0.46, 0.446 + front],
            [x + dx * 0.7, 0.36, 0.522 + front],
            [sign * 0.21 + dx * 0.6, 0.23, 0.557 + front],
            [sign * 0.21 + dx * 0.8, 0.11, 0.564 + front],
          ],
          0.0045,
          d === 3 ? 6 : 4,
          bronze,
        );
      line(
        o,
        [
          [x - 0.062, 0.477, 0.37 + front],
          [x - 0.02, 0.508, 0.409 + front],
          [x + 0.05, 0.483, 0.411 + front],
        ],
        0.005,
        4,
        bronze,
      );
      line(
        o,
        [
          [sign * 0.21 - 0.056, 0.07, zz + 0.04],
          [sign * 0.21, 0.091, zz + 0.073],
          [sign * 0.21 + 0.056, 0.07, zz + 0.04],
        ],
        0.003,
        4,
        bronze,
      );
    }
  }
}
function torso(o, d) {
  const n = [6, 12, 22, 32][d];
  sectionBody(
    o,
    [
      [0.49, 0.16, 0.115, -0.015],
      [0.59, 0.19, 0.145, 0.0],
      [0.72, 0.175, 0.14, -0.01],
      [0.89, 0.19, 0.145, -0.018],
      [1.06, 0.225, 0.145, -0.022],
      [1.15, 0.23, 0.11, -0.03],
      [1.205, 0.145, 0.077, -0.027],
      [1.215, 0.075, 0.065, -0.02],
    ],
    n,
  );
  for (const sign of [-1, 1]) {
    // Coat skirts drape across the outer hips; the crotch and parted thighs remain legible.
    tube(
      o,
      [
        [[sign * 0.15, 0.74, -0.03], 0.065, 0.115],
        [[sign * 0.185, 0.62, 0.02], 0.073, 0.125],
        [[sign * 0.23, 0.535, 0.1], 0.04, 0.13],
        [[sign * 0.22, 0.505, 0.13], 0.019, 0.12],
      ],
      d === 0 ? 4 : d === 1 ? 6 : 12,
    );
  }
  if (d === 0) return;
  // Shirt/open collar and broad notched jacket lapels are actual shallow solids.
  panel(
    o,
    [
      [-0.068, 1.19, 0.049],
      [-0.06, 1.11, 0.103],
      [-0.052, 0.91, 0.137],
      [0, 0.75, 0.144],
      [0.052, 0.91, 0.137],
      [0.06, 1.11, 0.103],
      [0.068, 1.19, 0.049],
    ],
    0.006,
    bronze,
  );
  for (const s of [-1, 1]) {
    panel(
      o,
      [
        [s * 0.085, 1.205, 0.055],
        [s * 0.165, 1.132, 0.073],
        [s * 0.127, 1.04, 0.11],
        [s * 0.14, 1.025, 0.115],
        [s * 0.065, 0.82, 0.142],
        [s * 0.018, 0.745, 0.151],
        [s * 0.058, 0.995, 0.143],
      ],
      0.006,
    );
    panel(
      o,
      [
        [s * 0.055, 1.216, 0.056],
        [s * 0.025, 1.161, 0.101],
        [s * 0.065, 1.115, 0.108],
        [s * 0.082, 1.188, 0.074],
      ],
      0.006,
    );
  }
  line(
    o,
    [
      [0, 0.785, 0.149],
      [0.006, 0.96, 0.145],
      [0.006, 1.13, 0.107],
    ],
    0.003,
    d === 3 ? 6 : 4,
    bronze,
  );
  if (d >= 2) {
    panel(
      o,
      [
        [0.125, 0.985, 0.122],
        [0.194, 0.99, 0.079],
        [0.192, 0.975, 0.083],
        [0.124, 0.969, 0.125],
      ],
      0.004,
      bronze,
    );
    for (const s of [-1, 1]) {
      line(
        o,
        [
          [s * 0.09, 0.77, 0.135],
          [s * 0.13, 0.705, 0.122],
          [s * 0.19, 0.61, 0.13],
        ],
        0.004,
        5,
        bronze,
      );
      line(
        o,
        [
          [s * 0.11, 0.665, 0.15],
          [s * 0.16, 0.6, 0.19],
          [s * 0.23, 0.535, 0.205],
        ],
        0.004,
        5,
        bronze,
      );
    }
    for (const y of [0.89, 1.015])
      sphere(o, 'bronze', [0.006, y, 0.149], [0.005, 0.005, 0.003], raised, 6, 3);
    // Broad back centre seam and waist creases are restrained relief, not engraved text.
    line(
      o,
      [
        [0, 1.165, -0.14],
        [0, 0.97, -0.168],
        [0, 0.77, -0.152],
        [0, 0.55, -0.12],
      ],
      0.0028,
      4,
      bronze,
    );
  }
}
function armsAndHands(o, d) {
  const n = [5, 8, 16, 24][d];
  for (const s of [-1, 1]) {
    const hand = s < 0 ? plan.estimatedFigure.rightAppleHand : plan.estimatedFigure.leftThighHand;
    const wrist = [hand[0] + s * 0.01, hand[1] - 0.02, hand[2] - 0.085];
    // Sleeve starts inside the chest so its cap cannot read as a separate shoulder pad.
    tube(
      o,
      [
        [[s * 0.1, 1.09, -0.025], 0.08, 0.085],
        [[s * 0.255, 1.04, -0.012], 0.083, 0.094],
        [[s * 0.315, 0.86, 0.035], 0.076, 0.087],
        [[s * 0.32, 0.78, 0.12], 0.078, 0.083],
        [[s * 0.29, s < 0 ? 0.775 : 0.695, 0.22], 0.065, 0.072],
        [wrist, 0.049, 0.055],
      ],
      n,
    );
    if (d > 0) {
      tube(
        o,
        [
          [wrist.map((v, k) => v + (k === 2 ? -0.018 : 0)), 0.052, 0.056],
          [[wrist[0], wrist[1], wrist[2] + 0.009], 0.053, 0.057],
        ],
        n,
      );
      if (d >= 2)
        line(
          o,
          [
            [s * 0.345, 0.87, 0.07],
            [s * 0.365, 0.81, 0.12],
            [s * 0.323, 0.79, 0.23],
          ],
          0.005,
          5,
          bronze,
        );
    }
    // Natural compact palm and articulated fingers; cupped apple hand versus hand on thigh.
    const palm =
      s < 0
        ? [hand[0], hand[1] - 0.012, hand[2] - 0.012]
        : [hand[0], hand[1] - 0.003, hand[2] - 0.01];
    sphere(
      o,
      'bronze',
      palm,
      [0.039, 0.024, 0.06],
      bronze,
      d === 0 ? 5 : d === 1 ? 8 : 14,
      d >= 2 ? 7 : 3,
    );
    if (d > 0) {
      const count = d === 1 ? 2 : 4;
      for (let f = 0; f < count; f++) {
        const dx = -0.027 + (f * 0.054) / (count - 1),
          x = hand[0] + dx;
        const path =
          s < 0
            ? [
                [x, hand[1] - 0.011, hand[2] + 0.022],
                [x, hand[1] - 0.002, hand[2] + 0.055],
                [x, hand[1] + 0.026, hand[2] + 0.065],
                [x, hand[1] + 0.04, hand[2] + 0.047],
              ]
            : [
                [x, hand[1] + 0.005, hand[2] + 0.018],
                [x - 0.01, hand[1] - 0.012, hand[2] + 0.05],
                [x - 0.018, hand[1] - 0.036, hand[2] + 0.066],
                [x - 0.022, hand[1] - 0.05, hand[2] + 0.058],
              ];
        line(o, path, 0.008, d === 3 ? 7 : 5, bronze);
      }
      const thumb =
        s < 0
          ? [
              [hand[0] + 0.037, hand[1], hand[2] - 0.025],
              [hand[0] + 0.048, hand[1] + 0.02, hand[2] + 0.015],
              [hand[0] + 0.032, hand[1] + 0.042, hand[2] + 0.027],
            ]
          : [
              [hand[0] - 0.035, hand[1], hand[2] - 0.025],
              [hand[0] - 0.057, hand[1] - 0.015, hand[2] + 0.005],
              [hand[0] - 0.06, hand[1] - 0.035, hand[2] + 0.025],
            ];
      line(o, thumb, 0.011, d === 3 ? 8 : 5, bronze);
    }
  }
  const h = plan.estimatedFigure.rightAppleHand;
  const center = [h[0], h[1] + 0.052, h[2] + 0.024];
  const nApple = [5, 10, 18, 24][d],
    mApple = [3, 5, 8, 12][d];
  const rings = Array.from({ length: mApple + 1 }, (_, j) => {
    const a = -Math.PI / 2 + (j * Math.PI) / mApple;
    return Array.from({ length: nApple }, (_, i) => {
      const t = (-i * 2 * Math.PI) / nApple,
        r = 0.04 * Math.max(0.13, Math.cos(a)) * (1 + 0.045 * Math.cos(5 * t));
      return [
        center[0] + r * Math.cos(t),
        center[1] + 0.038 * Math.sin(a),
        center[2] + r * Math.sin(t),
      ];
    });
  });
  loft(o, 'bronze', rings, bronze);
  if (d >= 2)
    line(
      o,
      [
        [center[0], center[1] + 0.034, center[2]],
        [center[0] + 0.003, center[1] + 0.045, center[2] - 0.003],
      ],
      0.003,
      5,
      bronze,
    );
}
function head(o, d) {
  const n = [8, 18, 36, 56][d],
    m = [6, 12, 24, 38][d],
    yaw = -0.14;
  const P = ([x, y, z]) => [
    x * Math.cos(yaw) + z * Math.sin(yaw),
    y,
    -x * Math.sin(yaw) + z * Math.cos(yaw) - 0.018,
  ];
  sectionBody(
    o,
    [
      [1.18, 0.057, 0.055, -0.015],
      [1.25, 0.061, 0.06, -0.01],
      [1.3, 0.065, 0.062, -0.01],
    ],
    d === 0 ? 6 : 14,
  );
  const profile = [
    [1.265, 0.032, 0.04],
    [1.283, 0.052, 0.067],
    [1.305, 0.069, 0.079],
    [1.34, 0.079, 0.083],
    [1.385, 0.083, 0.084],
    [1.425, 0.084, 0.084],
    [1.465, 0.077, 0.075],
    [1.495, 0.055, 0.054],
    [1.512, 0.015, 0.018],
  ];
  const rings = [];
  for (let j = 0; j <= m; j++) {
    const y = profile[0][0] + ((profile.at(-1)[0] - profile[0][0]) * j) / m;
    let k = 0;
    while (k < profile.length - 2 && profile[k + 1][0] < y) k++;
    const t = (y - profile[k][0]) / (profile[k + 1][0] - profile[k][0]),
      rx = profile[k][1] * (1 - t) + profile[k + 1][1] * t,
      rz = profile[k][2] * (1 - t) + profile[k + 1][2] * t;
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          front = Math.max(0, Math.cos(a)),
          x = rx * Math.sin(a);
        const nose = 0.033 * Math.exp(-Math.pow((y - 1.365) / 0.026, 2)) * Math.pow(front, 38);
        const brow = 0.009 * Math.exp(-Math.pow((y - 1.41) / 0.012, 2)) * Math.pow(front, 6);
        const mouth = 0.006 * Math.exp(-Math.pow((y - 1.315) / 0.01, 2)) * Math.pow(front, 16);
        const eyes =
          0.01 *
          Math.exp(-Math.pow((y - 1.394) / 0.01, 2)) *
          (Math.exp(-Math.pow((x - 0.032) / 0.016, 2)) +
            Math.exp(-Math.pow((x + 0.032) / 0.016, 2))) *
          Math.pow(front, 6);
        const cheeks = 0.006 * Math.exp(-Math.pow((y - 1.352) / 0.018, 2)) * Math.pow(front, 4);
        return P([x, y, rz * Math.cos(a) + nose + brow + mouth + cheeks - eyes]);
      }),
    );
  }
  loft(o, 'bronze', rings, bronze);
  if (d === 0) return;
  for (const s of [-1, 1]) {
    sphere(
      o,
      'bronze',
      P([s * 0.083, 1.375, -0.004]),
      [0.016, 0.031, 0.018],
      bronze,
      d === 3 ? 14 : 8,
      d >= 2 ? 8 : 4,
    );
    if (d >= 2) {
      const helix = Array.from({ length: 13 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 12;
        return P([
          s * (0.091 + 0.003 * Math.cos(a)),
          1.376 + 0.024 * Math.sin(a),
          -0.002 + 0.012 * Math.cos(a),
        ]);
      });
      line(o, helix, 0.0035, d === 3 ? 5 : 4, bronze);
      // Sculpted eyelids/brows/lips remain bronze; no painted pupils or makeup.
      line(
        o,
        Array.from({ length: 7 }, (_, i) =>
          P([
            s * 0.032 - 0.017 + (i * 0.034) / 6,
            1.395 + 0.004 * Math.sin((i * Math.PI) / 6),
            0.078,
          ]),
        ),
        0.0023,
        4,
        bronze,
      );
      line(
        o,
        [P([s * 0.014, 1.413, 0.09]), P([s * 0.032, 1.418, 0.085]), P([s * 0.05, 1.411, 0.076])],
        0.003,
        4,
        bronze,
      );
    }
  }
  // Close-cropped side-parted hair shell follows the skull; low relief strands only at near distance.
  const hairRings = Array.from({ length: d === 1 ? 4 : 8 }, (_, j) => {
    const t = j / (d === 1 ? 3 : 7),
      y = 1.411 + t * 0.109;
    return Array.from({ length: n }, (_, i) => {
      const a = (-i * 2 * Math.PI) / n,
        front = Math.max(0, Math.sin(a)),
        r = Math.max(0.12, Math.sqrt(Math.max(0, 1 - Math.pow((y - 1.42) / 0.104, 2))));
      const edge = (1 - t) * (1 - t) * (0.027 * front + 0.008 * Math.cos(a));
      return P([0.086 * r * Math.cos(a), y + edge, 0.087 * r * Math.sin(a) - 0.004]);
    });
  });
  loft(o, 'bronze', hairRings, bronze);
  if (d >= 2) {
    line(
      o,
      [
        P([-0.03, 1.458, 0.073]),
        P([-0.027, 1.49, 0.052]),
        P([-0.022, 1.513, 0.012]),
        P([-0.02, 1.508, -0.035]),
      ],
      0.0023,
      4,
      bronze,
    );
    line(
      o,
      Array.from({ length: 9 }, (_, i) =>
        P([
          -0.027 + (i * 0.054) / 8,
          1.316 - 0.002 * Math.sin((i * Math.PI) / 4),
          0.081 + 0.003 * Math.sin((i * Math.PI) / 8),
        ]),
      ),
      0.0019,
      4,
      bronze,
    );
    if (d === 3)
      for (let j = 0; j < 7; j++) {
        const x = -0.016 + j * 0.011;
        line(
          o,
          [P([x, 1.466, 0.068]), P([x + 0.009, 1.492, 0.045]), P([x + 0.012, 1.505, 0.01])],
          0.0015,
          4,
          bronze,
        );
      }
  }
}
function build(o, _frame, d = 3) {
  bench(o, d);
  legs(o, d);
  torso(o, d);
  armsAndHands(o, d);
  head(o, d);
  const p = plan.estimatedPlaque;
  box(
    o,
    'bronze',
    [p.centre[0] - p.size[0] / 2, -0.006, p.centre[2] - p.size[1] / 2],
    [p.centre[0] + p.size[0] / 2, 0.018, p.centre[2] + p.size[1] / 2],
    bronze,
  );
  if (d > 0) box(o, 'bronze', [-0.224, 0.018, 0.776], [0.224, 0.022, 1.064], recess);
}
export const turingSkyline = (o, f) => build(o, f, 0),
  turingDistrict = (o, f) => build(o, f, 1),
  turingStreet = (o, f) => build(o, f, 2);
export const turingMemorialModel = {
  id: 'alan_turing_memorial',
  key: 'alan_turing_memorial',
  recipe: 'structure-alan-turing-memorial.mjs',
  cell: 'gc/gcw',
  title: 'Alan Turing Memorial',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete intrinsic life-size seated bronze Turing portrait on open3backboard/5seatboard cast-bronze bench: natural face/hair/ears, jacket/notchedlapels/open-collar shirt, trouser folds/low shoes, anatomicalright cuppedapplehand/viewerleft and lefthandonthigh; small low unlettered plaque. No wholepark/path/slab, otherbenches, people, text or temporary nailpaint.',
  camera: [3.0, 2.1, 3.8],
  lookAt: [0, 0.76, 0.15],
  portableGroundY: -0.17,
  mediumFiContext: {
    scale: 0.06,
    groundY: -0.17,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'natural-portrait-open-collar-and-right-apple-hand',
      position: [-0.8, 1.58, 1.32],
      lookAt: [-0.03, 1.12, 0.1],
    },
    {
      name: 'seated-pose-shoes-and-true-open-bench-slats',
      position: [2.1, 1.65, 2.6],
      lookAt: [0, 0.73, 0.15],
      reviewLod: 'skyline',
    },
    {
      name: 'rear-cast-bronze-bench-legs-and-jacket',
      position: [-2.5, 1.6, -2.8],
      lookAt: [0, 0.76, -0.03],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed pavedcontact[0,1.3] preceded acquisition of the untouched source terrain. Exact benchfoot/plaque and hostpark contact remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-alan-turing-memorial.mjs',
    level: 'skyline',
    export: 'turingSkyline',
    errorMeters: 0.065,
    surfaces,
    authoredLevels: {
      district: { export: 'turingDistrict', errorMeters: 0.035, surfaces },
      street: { export: 'turingStreet', errorMeters: 0.015, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exact two native already-published KGGucwa2008own-workPD-selforiginals control original sculptural geometry. Fullbody photo uses independently pinned primary creator grant because legacy Qualla category metadata omits PD; exact published bytes/nativeSHA1match. Opposite-side portrait has ordinary acceptedpublished metadata. No imported scan, copiedphototexture, generated bitmap, outside image source, pinknailpaint or lettering.',
    'Estimated2.35mbench/.46mseat/1.52mseatedheadtop, portrait/pelvis/limbs and slightheadturn derived from inspected photographs and natural adult seating proportions; no measured sculpture scan. Original sectionedclothing/anatomy, eyelids/nose/brow/closedmouth/ears/shortpartedhair and jointedfingers are bounded medium-fi interpretations. Concealedrear/finehair/fold census and exactportrait likeness are approximate.',
    'Three backboards/five seatboards/four feet and all primary slat gaps retained at everydistance. Rightapplehand is viewerleft/local-X; otherhandrestsonthigh. Shirt/notchedlapels, cuffs/coat tails, broad shoes/soles and smallunletteredgroundplaque included. Raised cloth/face detail reduces withdistance; uniformbrown/olivebronze uses sharedcast-bronzegraph, no paintedeyes/shadows.',
    'Native pointQ3736114 fixes identity/location; nearby circularfootway is contextonly and nevera solidroof/park slab. Provisional heading faces original pavedapproachcentre and2.5mestimatedenvelope is notanOSMsurvey. Raw60mproviderfield/fixedpavedcontact frozenbeforegeometry; exactfooting/plaque/hostgrade remainsunverified. FlatstageY-.17 shows sculpture independently, not surveyedparkcontact.',
  ],
};
