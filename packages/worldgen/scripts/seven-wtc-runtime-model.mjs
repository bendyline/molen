/** Current 2006 tower: signed mapped body and roof parts, with an explicit district scrim cadence. */
import { readFileSync } from 'node:fs';
import {
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
} from './signature-tower-expansion-models.mjs';
import { skylineNext } from './signature-tower-next-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export const sevenWtcRuntimeAssetId = 'molen.worldgen.structure.n0153_7_world_trade_center';
const frame = JSON.parse(
  readFileSync(structureSourcePath('n0153_7_world_trade_center', 'map-frame.json'), 'utf8'),
);
const parts = partsEvidence('n0153_7_world_trade_center');
const plan = (id) =>
  partPlan(
    frame,
    parts.find((p) => p.id === id),
  );
export function buildSevenWtcSkyline(out) {
  const body = plan(1530740418);
  for (const [lo, hi, color] of [
    [0, 0.3, [0.49, 0.51, 0.51]],
    [0.3, 8, [0.24, 0.36, 0.41]],
    [8, 24.3, [0.58, 0.64, 0.68]],
    [24.3, 221.2, [0.34, 0.46, 0.52]],
    [221.2, 223, [0.23, 0.33, 0.37]],
  ])
    mappedSolid(out, 'wall', body, lo, hi, color);
  mappedCap(out, 'wall', body, 223, [0.63, 0.65, 0.64]);
  mappedSolid(out, 'wall', plan(1530740417), 223, 226.03, [0.42, 0.47, 0.49]);
}
export function buildSevenWtcCurrent(out, mapped = frame) {
  skylineNext.find((s) => s.id === 'N0153').build(out, mapped);
  // The original roof service volume starts0.85m above the roof; add its continuous support curb.
  mappedSolid(out, 'concrete', plan(1530740417), 223, 223.85, [0.63, 0.65, 0.64]);
}
export function buildSevenWtcDistrict(out) {
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (component, ref, points, normal, uv, color) => {
        const ys = points.map((p) => p[1]),
          lo = Math.min(...ys),
          hi = Math.max(...ys);
        // These two explicitly colored strip faces are the original lower scrim prisms.
        const scrim =
          component === 'metal' &&
          lo >= 8.04 &&
          hi <= 24.3 &&
          hi - lo < 0.14 &&
          ([0.53, 0.61, 0.68].every((v, i) => Math.abs(v - color[i]) < 1e-7) ||
            [0.7, 0.75, 0.78].every((v, i) => Math.abs(v - color[i]) < 1e-7));
        if (scrim && Math.round((lo - 8.05) / 0.18) % 3 !== 0) return;
        out[method](component, ref, points, normal, uv, color);
      },
    ]),
  );
  buildSevenWtcCurrent(mapped, frame);
}
