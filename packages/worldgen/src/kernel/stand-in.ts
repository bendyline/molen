/**
 * A building reduced to its stand-in without being generated.
 *
 * A batch turns a building into an instanced box when its mesh no longer fits the vertex budget,
 * but only after analysing its footprint, choosing its style and resolving its recipe: about
 * 150 kB of allocation a building, for one colored box. A host that knows a building will be a
 * stand-in (the small footprints of a dense batch seen from a distance) can make the box
 * itself from the outline and a look (`distantBuildingLook`, or a host's cached sample of one)
 * and pass it as `WorldgenBatchInput.standIns`.
 *
 * The box is the outline's bounding rectangle along its longest edge, which is what a full
 * analysis gives a plain rectangle and close to it for the L and T shapes of houses. A pitched
 * look keeps a gabled stand-in, ridge along the longer side, in its roof's color, as
 * `generateBuilding` draws its own.
 *
 * Related files: building.ts (`boxPlacement`, the stand-in a generated building gets),
 * distant-look.ts (looks), batch.ts (`standIns`).
 */
import { dmath } from '@bendyline/molen-kernel/determinism';
import { type BoxPlacement, GABLE_BOX_EAVE } from './building';
import { type DistantLook, standInTint } from './distant-look';
import type { HeightSampler, Vec2 } from './types';

export interface StandInOptions {
  /**
   * Height of the building in metres, from the ground or, for a raised part, from its underside:
   * the map's, or the look's where the map has none.
   */
  height: number;
  /** Whether `height` is the map's (ground to ridge); a guessed height is to the eave. */
  measured?: boolean;
  /** Height of the part's underside above ground (a building part), default 0. */
  minHeight?: number;
  /** A piece cut at the batch's edge: it keeps a flat top, like a generated piece. */
  clipped?: boolean;
  /** How far the box reaches below the lowest ground it stands on (default 0.6 m). */
  foundationDepth?: number;
}

/**
 * The stand-in for `outline` (metres, in the batch's frame), or undefined for an outline with no
 * extent.
 */
export function standInPlacement(
  outline: readonly Vec2[],
  ground: HeightSampler,
  look: DistantLook,
  options: StandInOptions,
): BoxPlacement | undefined {
  if (outline.length < 3 || !(options.height > 0)) return undefined;
  // The frame of the longest edge.
  let c = 1,
    s = 0,
    longest = 0;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index] as Vec2;
    const b = outline[(index + 1) % outline.length] as Vec2;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = dmath.hypot(dx, dz);
    if (length > longest) {
      longest = length;
      c = dx / length;
      s = dz / length;
    }
  }
  if (!(longest > 0.2)) return undefined;
  // One frame for an edge and its opposite: a rectangle's two long sides differ by rounding.
  if (c < 0 || (c === 0 && s < 0)) {
    c = -c;
    s = -s;
  }
  let u0 = Number.POSITIVE_INFINITY,
    u1 = Number.NEGATIVE_INFINITY,
    v0 = Number.POSITIVE_INFINITY,
    v1 = Number.NEGATIVE_INFINITY;
  for (const point of outline) {
    const u = c * point[0] + s * point[1];
    const v = -s * point[0] + c * point[1];
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  const world = (u: number, v: number): Vec2 => [c * u - s * v, s * u + c * v];
  const centre = world((u0 + u1) / 2, (v0 + v1) / 2);
  const minHeight = options.minHeight ?? 0;
  let low = Number.POSITIVE_INFINITY,
    high = Number.NEGATIVE_INFINITY;
  for (const [u, v] of [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ] as const) {
    const at = world(u, v);
    const height = ground.sampleHeight(at[0], at[1]);
    if (!Number.isFinite(height)) continue;
    if (height < low) low = height;
    if (height > high) high = height;
  }
  if (!Number.isFinite(low)) {
    low = 0;
    high = 0;
  }
  // Walls start level with the highest ground under the box and reach below the lowest.
  const bottom = minHeight > 0 ? high + minHeight : low - (options.foundationDepth ?? 0.6);
  const box: BoxPlacement = {
    x: centre[0],
    y: bottom,
    z: centre[1],
    yaw: -dmath.atan2(s, c),
    sx: Math.max(0.5, u1 - u0),
    sy: Math.max(0.5, high + minHeight + options.height - bottom),
    sz: Math.max(0.5, v1 - v0),
    color: standInTint(look.wall),
  };
  if (look.pitched === true && options.clipped !== true && minHeight === 0) {
    box.roof = 'gable';
    box.color = standInTint(look.roof);
    if (box.sz > box.sx) {
      [box.sx, box.sz] = [box.sz, box.sx];
      box.yaw += Math.PI / 2;
    }
    if (options.measured !== true) box.sy /= GABLE_BOX_EAVE;
  }
  return box;
}
