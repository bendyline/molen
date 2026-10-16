/** Budgeted Eddystone silhouettes preserve the PV apron, service cage and complete landing disc. */
import { beam } from './authored-structure-mesh.mjs';
import { buildEddystoneStreet } from './eddystone-detail-model.mjs';
import { ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

export { buildEddystoneStreet };

const TAU = Math.PI * 2,
  gray = [0.58, 0.55, 0.46],
  pale = [0.77, 0.76, 0.69],
  dark = [0.07, 0.085, 0.09],
  red = [0.55, 0.12, 0.075];
const means = {
  ashlar: [0.687437, 0.660738, 0.602857],
  metal: [0.908889, 0.908889, 0.908889],
  granite: [0.701109, 0.701109, 0.701109],
  wood: [0.825128, 0.825128, 0.825128],
};
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
export const eddystoneProfile = [
  [4.1, 5.52],
  [7, 5.15],
  [11, 4.62],
  [16, 4.05],
  [22, 3.62],
  [29, 3.26],
  [36, 3.1],
  [40.45, 3.18],
];
export const eddystoneHoles = [
  { angle: 0, y: 18.8, w: 1.12, h: 2.05 },
  { angle: 0, y: 25.2, w: 0.77, h: 1.3 },
  { angle: 0, y: 31.6, w: 0.72, h: 1.3 },
  { angle: 0, y: 37.4, w: 0.7, h: 1.15 },
  ...[22.4, 28.6, 34.9].map((y) => ({ angle: 1.2, y, w: 0.68, h: 1.15 })),
];
export function eddystoneRadius(y) {
  let j = 1;
  while (j < eddystoneProfile.length - 1 && eddystoneProfile[j][0] < y) j++;
  const [a, r] = eddystoneProfile[j - 1],
    [b, s] = eddystoneProfile[j];
  return r + ((s - r) * (y - a)) / (b - a);
}
function tint(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, c) =>
        out[k](
          slot,
          ref,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[slot]?.[i] ?? 1)),
        ),
    ]),
  );
}
function band(out, slot, y, r, h, c, n) {
  lathe(
    out,
    slot,
    [
      [y, r],
      [y + h, r],
    ],
    c,
    n,
  );
}
function build(out, district) {
  const n = district ? 16 : 8;
  lathe(
    out,
    'ashlar',
    [
      [0, 6.9],
      [3.8, 6.9],
      [4.1, 6.55],
    ],
    [0.34, 0.32, 0.25],
    n,
  );
  if (district)
    shell(out, {
      profile: eddystoneProfile,
      holes: eddystoneHoles.map((h) => ({ ...h, grid: h.h > 2 })),
      slot: 'ashlar',
      color: (y) => (y < 8 ? [0.35, 0.34, 0.26] : y < 12 ? [0.5, 0.48, 0.36] : gray),
      segments: n,
    });
  else {
    for (let j = 1; j < eddystoneProfile.length; j++) {
      const [a, r] = eddystoneProfile[j - 1],
        [b, s] = eddystoneProfile[j];
      lathe(
        out,
        'ashlar',
        [
          [a, r],
          [b, s],
        ],
        a < 8 ? [0.35, 0.34, 0.26] : a < 12 ? [0.5, 0.48, 0.36] : gray,
        n,
      );
    }
    for (const h of eddystoneHoles)
      panel(
        transformed(out, h.angle),
        'glass',
        -h.w / 2,
        h.w / 2,
        h.y,
        h.y + h.h,
        eddystoneRadius(h.y + h.h / 2) + 0.015,
        [0.07, 0.09, 0.085],
      );
  }
  lathe(
    out,
    'granite',
    [
      [40.35, 3.2],
      [40.75, 3.7],
      [41.28, 3.9],
    ],
    gray,
    n,
  );
  // Opaque solar apron is retained as a dark polygonal belt, with module divisions at district distance.
  lathe(
    out,
    'glass',
    [
      [41.45, 3.77],
      [43.14, 3.77],
    ],
    [0.055, 0.105, 0.17],
    district ? 16 : 8,
  );
  for (const y of [41.47, 43.16]) band(out, 'metal', y, 3.805, 0.045, pale, district ? 16 : 8);
  if (district) {
    band(out, 'metal', 42.3, 3.81, 0.035, pale, 16);
    for (let i = 0; i < 16; i++)
      beam(
        out,
        'metal',
        P(3.81, 41.45, (i * TAU) / 16),
        P(3.81, 43.18, (i * TAU) / 16),
        0.045,
        0.035,
        pale,
      );
  }
  lathe(
    out,
    'glass',
    [
      [43.16, 2.66],
      [45.5, 2.66],
    ],
    [0.27, 0.39, 0.42],
    district ? 16 : 8,
  );
  for (let i = 0; i < (district ? 16 : 8); i++) {
    const a = (i * TAU) / (district ? 16 : 8),
      o = transformed(out, a);
    quad(
      o,
      'metal',
      [
        [-0.045, 43.16, 2.72],
        [0.045, 43.16, 2.72],
        [0.045, 45.5, 2.72],
        [-0.045, 45.5, 2.72],
      ],
      [0, 0, 1],
      red,
    );
  }
  lathe(
    out,
    'metal',
    [
      [45.5, 3.155],
      [45.85, 2.611],
      [46.1, 1.034],
      [46.25, 0.065],
    ],
    red,
    n,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8;
    beam(out, 'metal', P(3.25, 43.2, a), P(4.15, 48.5, a), 0.15, 0.15, red);
    if (district || i % 2 === 0) {
      beam(out, 'metal', P(3.25, 43.2, a), P(4.15, 48.5, b), 0.085, 0.085, red);
      beam(out, 'metal', P(3.25, 43.2, b), P(4.15, 48.5, a), 0.085, 0.085, red);
    }
    beam(out, 'metal', P(4.15, 48.4, a), P(6.8, 48.77, a), 0.17, 0.24, dark);
  }
  lathe(
    out,
    'metal',
    [
      [48.55, 6.25],
      [48.8, 6.25],
    ],
    [0.24, 0.3, 0.26],
    n,
  );
  ring(out, 'metal', 48.8, 6.18, 6.3, 0.08, pale, n);
  if (district) ring(out, 'metal', 48.81, 4.2, 4.32, 0.012, [0.85, 0.78, 0.2], 24);
  else
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16,
        b = ((i + 1) * TAU) / 16;
      quad(
        out,
        'metal',
        [P(4.2, 48.81, a), P(4.32, 48.81, a), P(4.32, 48.81, b), P(4.2, 48.81, b)],
        [0, 1, 0],
        [0.85, 0.78, 0.2],
      );
    }
  for (const x of [-0.85, 0.85])
    box(out, 'metal', [x - 0.14, 48.81, -1.3], [x + 0.14, 48.825, 1.3], pale);
  box(out, 'metal', [-0.85, 48.81, -0.14], [0.85, 48.825, 0.14], pale);
  const net = district ? 16 : 8;
  for (let i = 0; i < net; i++) {
    const a = (i * TAU) / net,
      b = ((i + 1) * TAU) / net;
    if (district) tube(out, 'metal', P(6.3, 48.77, a), P(7.3, 49, a), 0.02, dark, 4);
    tube(out, 'metal', P(7.3, 49, a), P(7.3, 49, b), 0.025, dark, district ? 4 : 3);
  }
  if (district) {
    beam(out, 'metal', [0, 20.9, 3.9], [0, 22.1, 5.8], 0.1, 0.13, dark);
    tube(out, 'metal', [0, 22.1, 5.8], [0, 18.6, 5.8], 0.015, dark, 4);
    for (const x of [-0.29, 0.29])
      beam(out, 'metal', [x, 0.3, 6.95], [x, 4.2, 6.95], 0.045, 0.045, dark);
    for (let y = 0.45; y < 4.2; y += 0.58)
      beam(out, 'metal', [-0.29, y, 6.95], [0.29, y, 6.95], 0.04, 0.04, dark);
  }
}
export function buildEddystoneSkyline(out) {
  build(tint(out), false);
}
export function buildEddystoneDistrict(out) {
  build(out, true);
}
