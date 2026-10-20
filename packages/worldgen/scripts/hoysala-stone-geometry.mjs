/** Original Hoysala stone vocabulary; current specific consumer 'N0542'. */
import { box, loft } from './khmer-structure-geometry.mjs';

export function hoysalaStar(x, z, radius, teeth = 16) {
  return Array.from({ length: teeth * 2 }, (_, i) => {
    const a = (i * Math.PI) / teeth,
      r = radius * (i % 2 ? 0.85 : 1);
    return [x + Math.cos(a) * r, z + Math.sin(a) * r];
  });
}
export function hoysalaRound(f, role, x, z, profile, sides = 8) {
  loft(f, role, x, z, profile, false, (w) =>
    Array.from({ length: sides }, (_, i) => [
      (Math.cos((i * Math.PI * 2) / sides) * w) / 2,
      (Math.sin((i * Math.PI * 2) / sides) * w) / 2,
    ]),
  );
}
/** Original shallow human-shaped relief; no copied iconography or narrative panel. */
export function hoysalaFigure(f, detail) {
  loft(
    f,
    'trim',
    0,
    0,
    [
      [0, 0.43],
      [0.15, 0.55],
      [0.65, 0.34],
      [0.9, 0.48],
    ],
    false,
    (w) => [
      [-w / 2, -0.09],
      [w / 2, -0.09],
      [w / 2, 0.13],
      [-w / 2, 0.13],
    ],
  );
  hoysalaRound(
    f,
    'trim',
    0,
    0.02,
    [
      [0.92, 0.15],
      [1.05, 0.3],
      [1.24, 0.18],
    ],
    detail >= 3 ? 8 : 6,
  );
  for (const sign of [-1, 1]) box(f, 'trim', sign * 0.29, 0.25, 0.03, 0.11, 0.55, 0.2);
  if (detail >= 3) {
    hoysalaRound(
      f,
      'trim',
      0,
      0.01,
      [
        [1.22, 0.3],
        [1.42, 0.12],
      ],
      6,
    );
    for (const sign of [-1, 1]) box(f, 'trim', sign * 0.13, -0.05, 0.07, 0.13, 0.28, 0.18);
  }
}
/** Original miniature shrine rhythm, with a recessed dark niche and receding cap. */
export function hoysalaAedicule(f, detail) {
  box(f, 'inset', 0, 0.07, -0.08, 0.48, 0.61, 0.035);
  for (const sign of [-1, 1]) box(f, 'trim', sign * 0.32, 0, -0.22, 0.12, 0.72, 0.7);
  box(f, 'trim', 0, 0, -0.22, 0.8, 0.1, 0.85);
  box(f, 'trim', 0, 0.7, -0.25, 0.87, 0.12, 0.95);
  loft(
    f,
    'trim',
    0,
    0.02,
    [
      [0.82, 0.85],
      [1.02, 0.42],
      [1.12, 0.2],
    ],
    false,
  );
  if (detail >= 3) {
    box(f, 'trim', 0, 0.48, 0.1, 0.12, 0.18, 0.14);
    hoysalaRound(
      f,
      'trim',
      0,
      0.02,
      [
        [1.12, 0.19],
        [1.25, 0.07],
      ],
      6,
    );
  }
}
/** Tiny original elephant-like animal silhouette, used as a repeating geometric frieze. */
export function hoysalaAnimal(f) {
  box(f, 'trim', 0, 0.09, 0, 0.46, 0.25, 0.19);
  box(f, 'trim', 0.27, 0.18, 0.01, 0.2, 0.2, 0.19);
  box(f, 'trim', 0.36, 0.01, 0.01, 0.09, 0.22, 0.1);
  for (const x of [-0.14, 0.14]) box(f, 'trim', x, -0.04, 0.02, 0.08, 0.16, 0.15);
}
