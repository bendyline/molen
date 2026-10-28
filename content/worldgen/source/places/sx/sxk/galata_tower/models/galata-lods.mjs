/** Component-derived browser models; the detailed builder retains its original defaults. */
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { createGalataBuilder, galataDetailedConfig } from './galata-tower-model.mjs';

function derived(out, options) {
  const remap = { ashlar_round: 'ashlar', wood: 'metal', plaster: 'ashlar', gold: 'metal' };
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ...args) => out[name](remap[slot] ?? slot, ...args),
    ]),
  );
  createGalataBuilder({ ...galataDetailedConfig, ...options })(mapped);
}

export function galataSkyline(out) {
  const rings = (slot, profile, color) =>
    loft(
      out,
      slot,
      profile.map(([y, r]) => radialRing(y, r, r, 12)),
      color,
    );
  rings(
    'stone',
    [
      [0, 8.225],
      [0.65, 8.1],
      [43.65, 8.1],
      [44.55, 8.78],
      [44.72, 8.3],
      [50.55, 8.3],
      [51.65, 9.08],
      [51.75, 7.09],
      [54.83, 7.09],
      [55.18, 7.96],
    ],
    [0.81, 0.77, 0.65],
  );
  for (const y of [13.2, 17.17])
    rings(
      'brick',
      [
        [y, 8.12],
        [y + 0.25, 8.12],
      ],
      [0.6, 0.35, 0.25],
    );
  rings(
    'lead',
    [
      [55.18, 7.97],
      [62.59, 0.05],
    ],
    [0.49, 0.53, 0.55],
  );
  rings(
    'metal',
    [
      [62.5, 0.14],
      [63.67, 0.22],
      [64.38, 0.15],
      [66.9, 0.012],
    ],
    [0.77, 0.59, 0.23],
  );
  rings(
    'glass',
    [
      [51.8, 7.11],
      [54.2, 7.11],
    ],
    [0.16, 0.21, 0.24],
  );
  box(out, 'ashlar', [-1.75, 0, 8], [1.75, 2.5, 10.12], [0.89, 0.85, 0.74]);
  for (const side of [-1, 1])
    box(
      out,
      'ashlar',
      [side < 0 ? -5.81 : 1.75, 0, 8.4],
      [side < 0 ? -1.75 : 5.81, 1.25, 10.1],
      [0.89, 0.85, 0.74],
    );
}
export function galataDistrict(out) {
  derived(out, {
    sides: 16,
    wallSides: 16,
    arch: 4,
    trimArch: 0,
    bars: false,
    tubeSides: 4,
    railSides: 16,
    railPosts: 7,
    railRings: [1.13],
    finials: false,
    largeWindowsOnly: true,
    chainCount: 0,
    corbelCount: 0,
    roofSides: 20,
    roofSeams: 0,
    roofRings: 0,
    finialSides: 6,
    ballSides: 6,
    ballRings: 0,
    stairSteps: 4,
    stairRails: false,
  });
}
export function galataStreet(out) {
  derived(out, {
    sides: 32,
    wallSides: 32,
    arch: 4,
    trimArch: 3,
    bars: false,
    tubeSides: 4,
    railSides: 56,
    railPosts: 42,
    railRings: [0.44, 1.13],
    finials: false,
    chainCount: 0,
    corbelCount: 28,
    roofSides: 56,
    roofSeams: 14,
    roofRings: 0,
    finialSides: 8,
    ballSides: 8,
    ballRings: 6,
    stairSteps: 7,
    stairRails: true,
  });
}
export function galataCloseup(out) {
  derived(out, {
    sides: 64,
    wallSides: 64,
    arch: 8,
    trimArch: 6,
    bars: true,
    tubeSides: 4,
    railSides: 84,
    railPosts: 84,
    railRings: [0.09, 0.44, 0.96, 1.13],
    finials: true,
    chainCount: 88,
    corbelCount: 56,
    roofSides: 84,
    roofSeams: 28,
    roofRings: 6,
    roofRingSides: 64,
    roofRingTubeSides: 4,
    finialSides: 12,
    ballSides: 12,
    ballRings: 8,
    stairSteps: 14,
    stairRails: true,
  });
}
