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
  /** Absolute along-path deck/approach samples, shared by painted surfaces and traffic graphs. */
  approachProfile?: readonly { point: TerrainSemanticPoint; elevation: number; flatness: number }[];
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
  // Keep the whole profile when a tile/traffic edge clips its rendered path. Otherwise
  // dropping the nearest sample outside the clip would change the boundary elevation.
  const samples = options.approachProfile ?? [];
  const points = samples.length ? samples.map((sample) => sample.point) : path.points;
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as TerrainSemanticPoint,
      b = points[i] as TerrainSemanticPoint;
    distances.push((distances[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  // A bent path's cross-sections must use its local segment, not its endpoint chord.
  const project = (x: number, z: number) => {
    let best = Infinity,
      station = 0,
      px = x,
      pz = z;
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1] as TerrainSemanticPoint;
      const q = points[i] as TerrainSemanticPoint;
      const vx = q[0] - p[0],
        vz = q[1] - p[1],
        length2 = vx * vx + vz * vz;
      const t = length2
        ? Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / length2))
        : 0;
      const cx = p[0] + vx * t,
        cz = p[1] + vz * t;
      const distance2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (distance2 < best) {
        best = distance2;
        station = (distances[i - 1] ?? 0) + Math.sqrt(length2) * t;
        px = cx;
        pz = cz;
      }
    }
    return { station, distance: Math.sqrt(best), point: [px, pz] as TerrainSemanticPoint };
  };
  const profile = samples.map((sample, i) => ({ ...sample, station: distances[i] ?? 0 }));
  return (x, z) => {
    const p = project(x, z);
    if (profile.length) {
      let low = 0,
        high = profile.length - 1;
      while (low + 1 < high) {
        const mid = (low + high) >>> 1;
        if ((profile[mid]?.station ?? 0) <= p.station) low = mid;
        else high = mid;
      }
      const a = profile[low] as (typeof profile)[number],
        b = profile[high] as (typeof profile)[number];
      if (a.flatness === 0 && b.flatness === 0) return groundAt(x, z) + options.approachLift;
      const t = Math.max(0, Math.min(1, (p.station - a.station) / (b.station - a.station || 1)));
      const flatness = a.flatness + (b.flatness - a.flatness) * t;
      return (
        a.elevation +
        (b.elevation - a.elevation) * t +
        (groundAt(x, z) - groundAt(...p.point)) * (1 - flatness)
      );
    }
    const t = p.station / (path.length || 1);
    // Keeps the slab above terrain at crests without sagging into the river/valley.
    const lift = Math.min(
      clearance,
      startClearance + t * path.length * 0.12,
      endClearance + (1 - t) * path.length * 0.12,
    );
    let height = options.groundApproach
      ? groundAt(x, z) + options.approachLift
      : Math.max(start + (end - start) * t, groundAt(...p.point) + lift);
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
            Math.hypot(p.point[0] - connection.point[0], p.point[1] - connection.point[1]) /
              connection.radius,
          )
        : (1 - blend * blend * (3 - 2 * blend)) *
          (atStart && options.connects[1]
            ? 1 - smooth(t)
            : !atStart && options.connects[0]
              ? smooth(t)
              : 1);
      if (options.groundApproach) {
        // Keep the bank's shape and fade only the height difference at the join.
        // Blending toward a constant deck height buries an uphill approach.
        const end = atStart ? a : b;
        const neighbor = (atStart ? path.points[1] : path.points.at(-2)) ?? end;
        const ex = neighbor[0] - end[0],
          ez = neighbor[1] - end[1],
          length = Math.hypot(ex, ez) || 1;
        const nx = -ez / length,
          nz = ex / length;
        const offset = (x - connection.point[0]) * nx + (z - connection.point[1]) * nz;
        const joinGround =
          groundAt(connection.point[0] + nx * offset, connection.point[1] + nz * offset) +
          options.approachLift;
        // Two distinct hints can overlap on a short approach. Retain each exact end.
        const endWeight = connections.length > 1 ? (atStart ? 1 - smooth(t) : smooth(t)) : 1;
        height += (connection.elevation - joinGround) * weight * endWeight;
      } else height += (connection.elevation - height) * weight;
    }
    return height;
  };
}
