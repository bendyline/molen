/** Sõrve: retain the 53m taper, paint split, flared gallery and double cage at skyline distance. */
import { beam } from './authored-structure-mesh.mjs';
import { ring, shell } from './lighthouse-expansion-models.mjs';
import { lantern, lathe, railRing, transformed } from './lighthouse-models.mjs';
import { tube } from './structure-mesh.mjs';

export const sorveRuntimeAssetId = 'molen.worldgen.structure.n0648_sorve_lighthouse';
const profile = [
  [0, 4.12],
  [0.5, 4.08],
  [9, 3.5],
  [17.4, 3.04],
  [30, 2.65],
  [45.9, 2.27],
];
const pale = [0.77, 0.76, 0.69],
  dark = [0.07, 0.085, 0.09];
export const sorveOpenings = [
  { angle: 0, y: 0.65, w: 0.64, h: 1.5, trimSlot: 'concrete', trimColor: pale },
  { angle: 0, y: 11.4, w: 0.68, h: 1.25, trimSlot: 'concrete', trimColor: pale },
  { angle: 0, y: 21, w: 0.62, h: 1.25, trimSlot: 'concrete', trimColor: dark },
  { angle: 0, y: 30.9, w: 0.59, h: 1.25, trimSlot: 'concrete', trimColor: dark },
  { angle: 0, y: 40.1, w: 0.58, h: 1.25, trimSlot: 'concrete', trimColor: dark },
  { angle: Math.PI, y: 0.4, w: 1.12, h: 2.45, trimSlot: 'concrete', trimColor: pale },
];
function common(out, segments) {
  shell(out, {
    profile: profile.slice(0, 4),
    holes: sorveOpenings.filter((h) => h.y < 17.4),
    slot: 'concrete',
    color: [0.83, 0.84, 0.81],
    segments,
  });
  shell(out, {
    profile: profile.slice(3),
    holes: sorveOpenings.filter((h) => h.y > 17.4),
    slot: 'concrete',
    color: [0.055, 0.065, 0.067],
    segments,
  });
  lathe(
    out,
    'concrete',
    [
      [45.85, 2.27],
      [46.2, 2.52],
      [46.72, 3.37],
      [46.9, 3.53],
      [47.2, 3.53],
    ],
    dark,
    segments,
  );
  shell(out, {
    profile: [
      [47.19, 2.27],
      [48.65, 2.27],
    ],
    holes: [{ angle: 0, y: 47.24, w: 0.7, h: 1.36, trimSlot: 'metal', trimColor: dark }],
    slot: 'metal',
    color: dark,
    segments,
  });
  tube(out, 'metal', [0, 52.3, 0], [0, 53, 0], 0.025, dark, 4);
}
/** Selected casting rings and real openings survive; subpixel joint/cage density is reduced. */
export function buildSorveStreet(out) {
  common(out, 24);
  for (let y = 1.1; y < 45.7; y += 1.1) {
    if (sorveOpenings.some((h) => y >= h.y - 0.1 && y <= h.y + h.h + 0.1)) continue;
    const i = profile.findIndex((p) => p[0] >= y),
      a = profile[i - 1],
      b = profile[i],
      r = a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
    ring(
      out,
      'concrete',
      y,
      r - 0.015,
      r + 0.012,
      0.018,
      y < 17.4 ? [0.71, 0.72, 0.69] : [0.075, 0.085, 0.087],
      24,
    );
  }
  railRing(out, 47.22, 3.43, 0.98, dark, 16);
  lantern(out, {
    bottom: 48.6,
    radius: 2.21,
    height: 2.22,
    color: dark,
    segments: 16,
    roofHeight: 1.2,
  });
  railRing(out, 48.7, 2.6, 2.5, dark, 16);
  const ladder = transformed(out, 2.4);
  for (const x of [-0.29, 0.29])
    tube(ladder, 'metal', [x, 47.23, 2.32], [x, 49.1, 2.32], 0.025, dark, 4);
  for (let y = 47.38; y < 49.1; y += 0.29)
    tube(ladder, 'metal', [-0.29, y, 2.32], [0.29, y, 2.32], 0.025, dark, 4);
}
/** Same tower/entrance proportions; casting seams and maintenance ladder defer to street. */
export function buildSorveDistrict(out) {
  common(out, 16);
  lathe(
    out,
    'metal',
    [
      [48.6, 2.4089],
      [48.76, 2.4089],
      [48.83, 2.21],
    ],
    dark,
    16,
  );
  lathe(
    out,
    'glass',
    [
      [48.83, 2.1658],
      [50.82, 2.1658],
    ],
    [0.27, 0.39, 0.42],
    16,
  );
  lathe(
    out,
    'metal',
    [
      [50.82, 2.5636],
      [50.96, 2.5636],
      [51.17, 2.1216],
      [51.78, 0.8398],
      [52.02, 0.065],
    ],
    dark,
    16,
  );
  lathe(
    out,
    'metal',
    [
      [52.02, 0.01],
      [52.18, 0.13],
      [52.34, 0.01],
    ],
    dark,
    12,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      p = (y) => [Math.sin(a) * 2.21, y, Math.cos(a) * 2.21];
    beam(out, 'metal', p(48.6), p(50.82), 0.05, 0.05, dark);
  }
  for (const y of [48.6, 49.71, 50.82]) ring(out, 'metal', y, 2.185, 2.235, 0.05, dark, 16);
  for (const [y, r, h] of [
    [47.22, 3.43, 0.98],
    [48.7, 2.6, 2.5],
  ]) {
    for (const yy of [y + h * 0.48, y + h])
      ring(out, 'metal', yy, r - 0.025, r + 0.025, 0.05, dark, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        p = (yy) => [Math.sin(a) * r, yy, Math.cos(a) * r];
      beam(out, 'metal', p(y), p(y + h), 0.058, 0.058, dark);
    }
  }
}
// Linear means of the canonical 256-square graphs, measured with the material baker.
const concreteMean = [0.710816, 0.710816, 0.681928];
const metalMean = [0.908889, 0.908889, 0.908889];
export function buildSorveSkyline(out) {
  const tint = (c, mean) => c.map((v, i) => v * mean[i]);
  const pale = tint([0.83, 0.84, 0.81], concreteMean);
  const shaft = tint([0.055, 0.065, 0.067], concreteMean);
  const dark = tint([0.07, 0.085, 0.09], metalMean);
  const form = (p, c, sides = 12) => lathe(out, 'wall', p, c, sides);
  form(
    [
      [0, 4.12],
      [0.5, 4.08],
      [9, 3.5],
      [17.4, 3.04],
    ],
    pale,
  );
  form(
    [
      [17.4, 3.04],
      [30, 2.65],
      [45.9, 2.27],
    ],
    shaft,
  );
  form(
    [
      [45.85, 2.27],
      [46.2, 2.52],
      [46.72, 3.37],
      [46.9, 3.53],
      [47.2, 3.53],
    ],
    dark,
  );
  form(
    [
      [47.19, 2.27],
      [48.65, 2.27],
    ],
    dark,
  );
  form(
    [
      [48.6, 2.4089],
      [48.76, 2.4089],
      [48.83, 2.21],
    ],
    dark,
  );
  form(
    [
      [48.83, 2.1658],
      [50.82, 2.1658],
    ],
    [0.27, 0.39, 0.42],
  );
  form(
    [
      [50.82, 2.5636],
      [50.96, 2.5636],
      [51.17, 2.1216],
      [51.78, 0.8398],
      [52.02, 0.065],
    ],
    dark,
  );
  form(
    [
      [52.02, 0.01],
      [52.18, 0.13],
      [52.34, 0.01],
    ],
    dark,
  );
  form(
    [
      [52.3, 0.025],
      [53, 0.025],
    ],
    dark,
    4,
  );
  // Each cage keeps its top hoop and four visible posts. Thin casting seams and windows drop out.
  for (const [y, r, h] of [
    [47.22, 3.43, 0.98],
    [48.7, 2.6, 2.5],
  ]) {
    ring(out, 'wall', y + h, r - 0.025, r + 0.025, 0.05, dark, 12);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      beam(
        out,
        'wall',
        [Math.cos(a) * r, y, Math.sin(a) * r],
        [Math.cos(a) * r, y + h, Math.sin(a) * r],
        0.058,
        0.058,
        dark,
      );
    }
  }
}
