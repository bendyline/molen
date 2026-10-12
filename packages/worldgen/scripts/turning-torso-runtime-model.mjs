/** Complete nine-unit Torso with glazed triangular wing, mapped entrance and visible service crown. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  glazedOutline,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0158_turning_torso',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  parts = partsEvidence(key);
const part = (_key, id) => parts.find((p) => p.id === id),
  edgeFrames = (p) =>
    p.map((a, i) => {
      const b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len };
    });
function turnedProfile(out, slot, profile, center, color, sides) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center)),
    color,
  );
}
export const torsoEntrance = [-18.57647418963883, -1.5060018821769878];
function entrance(out, level) {
  const p = torsoEntrance,
    n = [-0.99, 0, -0.1410673598],
    t = [-0.1410673598, 0, 0.99],
    at = (s, y, d = 0.18) => [p[0] + t[0] * s + n[0] * d, y, p[1] + t[2] * s + n[2] * d];
  face(
    out,
    'stone',
    [at(-1.9, 0.02, 0.1), at(1.9, 0.02, 0.1), at(1.9, 0.02, 4), at(-1.9, 0.02, 4)],
    [0.25, 0.27, 0.28],
  );
  if (level === 'skyline') return;
  for (const [a, b] of [
    [-1.25, -0.06],
    [0.06, 1.25],
  ])
    panel(
      out,
      [at(a, 0.3), at(b, 0.3), at(b, 3.35), at(a, 3.35)],
      [0.08, 0.14, 0.16],
      0.11,
      [0.67, 0.72, 0.73],
    );
  if (level === 'district') return;
  for (const s of [-0.14, 0.14])
    beam(out, 'metal', at(s, 1.1, 0.26), at(s, 1.8, 0.26), 0.035, 0.05, [0.72, 0.75, 0.75]);
}
function rotatePlan(plan, center, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return plan.map(([x, z]) => [
    center[0] + (x - center[0]) * c - (z - center[1]) * s,
    center[1] + (x - center[0]) * s + (z - center[1]) * c,
  ]);
}
function buildTorso(out, m, level) {
  const far = level === 'skyline',
    district = level === 'district',
    coarse = far || district,
    sides = far || district ? 4 : level === 'street' ? 6 : 16;
  const target = out;
  out = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    out[method] = (component, ref, points, normal, uv, color) =>
      target[method](
        component,
        ref,
        points.map((p) => [p[0], Math.min(190, p[1]), p[2]]),
        normal,
        uv,
        color,
      );
  const key = 'n0158_turning_torso',
    base = localOutline(m);
  const core = partPlan(m, part(key, 940786326));
  const center = core.reduce((s, p) => s.map((v, i) => v + p[i] / core.length), [0, 0]);
  const white = [0.86, 0.87, 0.84],
    darkGlass = [0.19, 0.28, 0.3];
  const at = (p, y) => {
    const q = rotatePlan([p], center, (Math.max(0, Math.min(1, (y - 4) / 186)) * Math.PI) / 2)[0];
    return [q[0], y, q[1]];
  };
  const planAt = (y) =>
    base.map((p) => {
      const q = at(p, y);
      return [q[0], q[2]];
    });
  mappedSolid(out, 'stone', base, 0, 0.25, [0.2, 0.21, 0.2]);
  if (coarse)
    for (const { a, b } of edgeFrames(base))
      face(
        out,
        'glass',
        [
          [a[0], 0.25, a[1]],
          [b[0], 0.25, b[1]],
          [b[0], 4, b[1]],
          [a[0], 4, a[1]],
        ],
        darkGlass,
      );
  else glazedOutline(out, base, 0.25, 4, 2.2, darkGlass, white, 0.1);
  loft(
    out,
    'concrete',
    [
      radialRing(0.25, 7.8, 7.8, coarse ? 12 : level === 'street' ? 24 : 64, center),
      radialRing(190, 5.7, 5.7, coarse ? 12 : level === 'street' ? 24 : 64, center),
    ],
    [0.78, 0.79, 0.76],
  );
  const tip = base.reduce((a, b) =>
    Math.hypot(a[0] - center[0], a[1] - center[1]) > Math.hypot(b[0] - center[0], b[1] - center[1])
      ? a
      : b,
  );
  const ti = base.indexOf(tip),
    left = base[(ti + base.length - 1) % base.length],
    right = base[(ti + 1) % base.length];
  const spinePoint = (y) => {
    const p = at(tip, y),
      v = [p[0] - center[0], p[2] - center[1]],
      l = Math.hypot(...v);
    return [p[0] + (v[0] * 2.4) / l, y, p[2] + (v[1] * 2.4) / l];
  };
  for (let unit = 0; unit < 9; unit++) {
    const cycle = 186 / 9,
      low = 4 + unit * cycle,
      high = low + cycle - 2;
    for (let floor = 0; floor < (far ? 1 : 5); floor++) {
      const y0 = low + (floor * (cycle - 2)) / 5,
        y1 = far ? high : y0 + (cycle - 2) / 5;
      for (const { a, b, len } of edgeFrames(base)) {
        const q = [at(a, y0), at(b, y0), at(b, y1), at(a, y1)],
          wing =
            (a === tip ||
              b === tip ||
              Math.hypot(a[0] - tip[0], a[1] - tip[1]) < 0.001 ||
              Math.hypot(b[0] - tip[0], b[1] - tip[1]) < 0.001) &&
            len > 15;
        if (far) {
          face(out, wing ? 'glass' : 'metal', q, wing ? darkGlass : white);
          continue;
        }
        if (wing) {
          // Twisted quads are not planar. Frame each pane with actual adjacent faces so its bars
          // cannot sink behind a broad triangulated glass underlay.
          const count = district
            ? 1
            : Math.max(1, Math.ceil(len / (level === 'street' ? 4.4 : 2.2)));
          for (let j = 0; j < count; j++) {
            const pa = lerp(a, b, j / count),
              pb = lerp(a, b, (j + 1) / count),
              pane = [at(pa, y0), at(pb, y0), at(pb, y1), at(pa, y1)];
            if (level === 'source' || level === 'closeup') panel(out, pane, darkGlass, 0.09, white);
            else {
              const w = 0.07 / (len / count),
                h = 0.09 / (y1 - y0),
                inner = [
                  lerp(pane[0], pane[1], w),
                  pane[1],
                  lerp(pane[2], pane[1], h),
                  lerp(lerp(pane[3], pane[2], w), lerp(pane[0], pane[1], w), h),
                ];
              face(out, 'glass', inner, darkGlass);
              face(out, 'metal', [pane[0], inner[0], inner[3], pane[3]], white);
              face(out, 'metal', [inner[3], inner[2], pane[2], pane[3]], white);
            }
          }
          continue;
        }
        if (district) {
          if (floor !== 0) continue;
          face(out, 'metal', [at(a, low), at(b, low), at(b, high), at(a, high)], white);
          const count = Math.max(1, Math.round(len / 2.7));
          for (let j = 0; j < count; j++) {
            const pa = lerp(a, b, (j + 0.17) / count),
              pb = lerp(a, b, (j + 0.83) / count);
            face(
              out,
              'glass',
              [at(pa, low + 0.7), at(pb, low + 0.7), at(pb, high - 0.7), at(pa, high - 0.7)],
              darkGlass,
            );
          }
          for (let f = 1; f < 5; f++) {
            const y = low + (f * (cycle - 2)) / 5;
            face(
              out,
              'metal',
              [at(a, y - 0.65), at(b, y - 0.65), at(b, y + 0.65), at(a, y + 0.65)],
              white,
            );
          }
          continue;
        }
        const count = Math.max(1, Math.round(len / (district ? 5.4 : 2.7)));
        for (let j = 0; j < count; j++) {
          const pa = lerp(a, b, j / count),
            pb = lerp(a, b, (j + 1) / count);
          // Substantial white aluminum surrounds each discrete flat window.
          const p = [at(pa, y0), at(pb, y0), at(pb, y1), at(pa, y1)];
          const inset = [
            lerp(p[0], p[1], 0.17),
            lerp(p[0], p[1], 0.83),
            lerp(p[3], p[2], 0.83),
            lerp(p[3], p[2], 0.17),
          ];
          const q = [
            lerp(inset[0], inset[3], 0.19),
            lerp(inset[1], inset[2], 0.19),
            lerp(inset[1], inset[2], 0.8),
            lerp(inset[0], inset[3], 0.8),
          ];
          if (district || level === 'street') face(out, 'glass', q, darkGlass);
          else panel(out, q, darkGlass, 0.07, [0.63, 0.69, 0.69]);
          for (let k = 0; k < 4; k++)
            face(out, 'metal', [p[k], p[(k + 1) % 4], q[(k + 1) % 4], q[k]], white);
          if (!coarse && level !== 'street')
            beam(out, 'metal', at(pa, y0), at(pa, y1), 0.025, 0.035, [0.62, 0.65, 0.64]);
        }
      }
      const sp = spinePoint(y1);
      if (!far && (!district || floor === 2 || floor === 4))
        for (const side of [left, right])
          tube(
            out,
            'metal',
            sp,
            at(lerp(tip, side, 0.82), y1),
            0.12,
            white,
            coarse || level === 'street' ? 4 : 10,
          );
    }
    mappedCap(out, 'metal', planAt(low), low, white, [], true);
    mappedCap(out, 'metal', planAt(high), high, white);
    // Recessed interstitial floor separates the nine five-storey cubes.
    const small = base.map((p) => lerp(p, center, 0.12));
    if (unit < 8)
      for (const { a, b } of edgeFrames(small))
        grid(
          out,
          [at(a, high), at(b, high), at(b, low + cycle), at(a, low + cycle)],
          darkGlass,
          coarse ? 50 : 2.2,
          2,
          far ? 0 : 0.06,
          white,
        );
    if (!coarse && level !== 'street')
      for (const y of [low, high]) bandPlan(out, planAt(y), y, 0.16, 0.2, white, 'metal');
    // Major diagonal struts terminate at the unit roof structural wall.
    for (const side of [left, right])
      tube(out, 'metal', spinePoint(low), at(lerp(tip, side, 0.94), high), 0.34, white, sides);
    const sections = coarse ? 1 : level === 'street' ? 5 : 10;
    for (let j = 0; j < sections; j++)
      tube(
        out,
        'metal',
        spinePoint(low + (j * cycle) / sections),
        spinePoint(low + ((j + 1) * cycle) / sections),
        0.63 - unit * 0.035,
        white,
        sides,
      );
  }
  // Main last-unit roof is188m; the mapped circular service crown reaches the published190m datum.
  mappedCap(out, 'metal', planAt(188), 188, white);
  const foot = spinePoint(4);
  tube(out, 'metal', [foot[0], 0.1, foot[2]], foot, 0.68, white, sides);
  turnedProfile(
    out,
    'concrete',
    [
      [0, 0.95],
      [0.2, 0.95],
    ],
    [foot[0], foot[2]],
    white,
    coarse ? 8 : 24,
  );
  if (!coarse) bandPlan(out, core, 189.85, 0.15, 0.18, white, 'metal');
  entrance(out, level);
}

export function buildTorsoReviewedMaster(out) {
  buildTorso(out, map, 'source');
}
export function buildTorsoCloseup(out) {
  buildTorso(out, map, 'closeup');
}
export function buildTorsoStreet(out) {
  buildTorso(out, map, 'street');
}
export function buildTorsoDistrict(out) {
  buildTorso(out, map, 'district');
}
export function buildTorsoSkyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = { stone: 'stone_granite', metal: 'metal_painted', concrete: 'concrete_plain' }[
          component
        ],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  buildTorso(wrapped, map, 'skyline');
}
