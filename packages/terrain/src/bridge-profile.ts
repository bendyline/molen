/** Three-free bridge deck height profile shared by the surface painter and transport graphs. */
import type { TerrainLinePath } from './line-path';
import type { TerrainSemanticPoint } from './semantic-types';

export interface BridgeDeckOptions {
  /** Surveyed absolute deck height; when present the deck is flat at this Y. */
  deckElevation?: number;
  /** Clearance above terrain at an unconnected (clipped or free) end, in metres (6 roads, 3 paths). */
  clearance: number;
  /** Lift above terrain at an end that meets a grade road (the road's surface lift). */
  approachLift: number;
  /** Whether each end meets a grade road: `[start, end]`. */
  connects: readonly [boolean, boolean];
  /** A connected ground approach follows terrain, with only a local endpoint correction. */
  groundApproach?: boolean;
  /** Authored deck endpoints in the path's frame, blended in over `radius`. */
  connections?: readonly { point: TerrainSemanticPoint; elevation: number; radius: number }[];
}

/**
 * A tile fragment cannot establish the elevation of an entire bridge. Use a bank-to-bank
 * profile for complete spans and deterministic terrain clearance at clipped ends. `groundAt`
 * samples terrain in the same frame as `path`.
 */
export function bridgeDeckHeightFn(
  path: TerrainLinePath,
  groundAt: (x: number, z: number) => number,
  options: BridgeDeckOptions,
): (x: number, z: number) => number {
  const surveyed = options.deckElevation;
  if (surveyed !== undefined) return () => surveyed;
  const a = path.points[0] as TerrainSemanticPoint,
    b = path.points.at(-1) as TerrainSemanticPoint;
  const clearance = options.clearance;
  const startClearance = options.connects[0] ? options.approachLift : clearance;
  const endClearance = options.connects[1] ? options.approachLift : clearance;
  const start = groundAt(...a) + startClearance,
    end = groundAt(...b) + endClearance;
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length2 = dx * dx + dz * dz || 1;
  const candidates = options.connections ?? [];
  // Each clipped fragment must use its own nearest deck endpoint. Short landmarks can
  // have overlapping hint radii; applying both in sequence would overwrite the west join
  // with the east height. A full span can still select a distinct hint at each end.
  const nearest = (point: TerrainSemanticPoint) =>
    candidates.reduce<(typeof candidates)[number] | undefined>(
      (best, item) =>
        !best ||
        Math.hypot(point[0] - item.point[0], point[1] - item.point[1]) <
          Math.hypot(point[0] - best.point[0], point[1] - best.point[1])
          ? item
          : best,
      undefined,
    );
  const connections = [
    ...new Set(
      [nearest(a), nearest(b)].filter(
        (item): item is (typeof candidates)[number] => item !== undefined,
      ),
    ),
  ];
  const smooth = (v: number) => {
    const t = Math.max(0, Math.min(1, v));
    return t * t * (3 - 2 * t);
  };
  return (x, z) => {
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2));
    // Keeps the slab above terrain at crests without sagging into the river/valley.
    const lift = Math.min(
      clearance,
      startClearance + t * path.length * 0.12,
      endClearance + (1 - t) * path.length * 0.12,
    );
    let height = options.groundApproach
      ? groundAt(x, z) + options.approachLift
      : Math.max(start + (end - start) * t, groundAt(a[0] + dx * t, a[1] + dz * t) + lift);
    for (const connection of connections) {
      // A deck endpoint covers its entire width, then fades into the inferred approach.
      const distance = Math.hypot(x - connection.point[0], z - connection.point[1]);
      const flatRadius = Math.min(32, connection.radius * 0.5);
      const blend = Math.max(
        0,
        Math.min(1, (distance - flatRadius) / (connection.radius - flatRadius)),
      );
      const atStart =
        Math.hypot(a[0] - connection.point[0], a[1] - connection.point[1]) <=
        Math.hypot(b[0] - connection.point[0], b[1] - connection.point[1]);
      const weight = options.groundApproach
        ? 1 -
          smooth(
            Math.hypot(a[0] + dx * t - connection.point[0], a[1] + dz * t - connection.point[1]) /
              connection.radius,
          )
        : (1 - blend * blend * (3 - 2 * blend)) *
          (atStart && options.connects[1]
            ? 1 - smooth(t)
            : !atStart && options.connects[0]
              ? smooth(t)
              : 1);
      height += (connection.elevation - height) * weight;
    }
    return height;
  };
}
