/** Dated dark exterior: preserve the bowed map perimeter and recessed ends at skyline distance. */
import { readFileSync } from 'node:fs';
import { beam } from './authored-structure-mesh.mjs';
import { glazedOutline, localOutline, mappedSolid } from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export const montparnasseRuntimeAssetId = 'molen.worldgen.structure.n0151_montparnasse_tower';
const frame = JSON.parse(
  readFileSync(structureSourcePath('n0151_montparnasse_tower', 'map-frame.json'), 'utf8'),
);
export function buildMontparnasseSkyline(out) {
  const plan = localOutline(frame);
  mappedSolid(out, 'wall', plan, 0, 0.5, [0.24, 0.245, 0.24]);
  mappedSolid(out, 'wall', plan, 0.5, 196, [0.115, 0.14, 0.16]);
  mappedSolid(out, 'wall', plan, 196, 206.5, [0.17, 0.205, 0.23]);
  // The continuous parapet envelope reserves small rail/roof fittings for nearer levels.
  mappedSolid(
    out,
    'wall',
    plan.map(([x, z]) => [x * 0.97, z * 0.97]),
    206.5,
    210,
    [0.25, 0.29, 0.31],
  );
  box(out, 'wall', [-12, 206.53, -5], [10, 209.6, 5], [0.105, 0.11, 0.115]);
}

export function buildMontparnasseDistrict(out) {
  const plan = localOutline(frame),
    dark = [0.105, 0.11, 0.115];
  mappedSolid(out, 'stone', plan, 0, 0.5, [0.24, 0.245, 0.24]);
  // Coarser horizontal bands; retain every mapped bowed facet and recessed end.
  glazedOutline(out, plan, 0.5, 196, 13.8, [0.115, 0.14, 0.16], dark, 0.105);
  glazedOutline(out, plan, 196, 206.5, 3.5, [0.17, 0.205, 0.23], dark, 0.13);
  mappedSolid(out, 'metal', plan, 206.48, 206.5, [0.28, 0.3, 0.3]);
  const outer = plan.map(([x, z]) => [x * 0.97, z * 0.97]);
  const inner = plan.map(([x, z]) => [x * 0.965, z * 0.965]);
  mappedSolid(out, 'glass', outer, 206.5, 208.65, [0.25, 0.29, 0.31], [inner]);
  // Keep an open terrace and its upper rail, omitting the small individual posts.
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    beam(out, 'metal', [a[0], 209.97, a[1]], [b[0], 209.97, b[1]], 0.055, 0.055, dark);
    if (i % 4 === 0)
      beam(out, 'metal', [a[0], 208.65, a[1]], [a[0], 209.97, a[1]], 0.055, 0.055, dark);
  }
  box(out, 'metal', [-12, 206.53, -5], [10, 209.6, 5], dark);
  for (const z of [-19.4, 19.4])
    for (let x = -17; x <= 17; x += 3.4)
      beam(out, 'metal', [x, 0.5, z], [x, 7, z], 0.27, 0.28, dark);
}
