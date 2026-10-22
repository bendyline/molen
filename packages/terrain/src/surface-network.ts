/** Spatially indexed road corridors and same-grade junctions, in tile-local world units. */
import {
  joinTerrainLines,
  sampleTerrainLine,
  type TerrainLinePath,
  terrainLinePath,
} from './linear-features';
import { polygonBounds, ringSignedArea } from './polygon';
import type {
  TerrainSemanticPoint,
  TerrainSemanticTile,
  TerrainTransportationFeature,
} from './semantic-types';
import type { TerrainSurfaceStyle } from './surface-styles';
import {
  groupTransportationFeatures,
  isPaintedTransport,
  isTransportLink,
  type TransportKind,
  transportKind,
  transportSurfaceLift,
  transportWidth,
} from './transport-features';

/**
 * Meters between the stacked paving of overlapping roads: far above the depth error between
 * coplanar triangles at street distances, far below a visible step. The deepest level still
 * clears the layer under it by 4 mm (a plaza, under a footway's shoulder).
 */
const STACK_STEP = 0.002;
/** Levels roads stack on; more overlapping neighbors than this share the least used. */
const STACK_LEVELS = 4;

export interface SurfaceRoad {
  feature: TerrainTransportationFeature;
  path: TerrainLinePath;
  width: number;
  kind: TransportKind;
  unpaved: boolean;
  elevation: number;
  /** Meters (zero or less) all of this road's paving sits under its nominal heights; see
   * `SurfaceNetwork.stackRoads`. */
  stack: number;
}
interface Segment {
  road: SurfaceRoad;
  a: TerrainSemanticPoint;
  b: TerrainSemanticPoint;
  start: number;
  length: number;
}
export interface SurfaceJunction {
  x: number;
  z: number;
  radius: number;
  layer: number;
  cores: { x: number; z: number; radius: number }[];
  arms: {
    road: SurfaceRoad;
    x: number;
    z: number;
    dx: number;
    dz: number;
    distance: number;
    width: number;
  }[];
}

/** An asphalt turning circle at a dead end, inside its mapped footway ring. */
export interface SurfaceTurningCircle {
  road: SurfaceRoad;
  center: TerrainSemanticPoint;
  radius: number;
  /** Convex outline, counterclockwise. */
  outline: TerrainSemanticPoint[];
}

export function isSurfaceLink(road: SurfaceRoad): boolean {
  return isTransportLink(road.feature);
}

/** Subtract a convex footprint, retaining convex pieces for the terrain draper. */
function subtractFootprint(
  subject: TerrainSemanticPoint[],
  cut: readonly TerrainSemanticPoint[],
): TerrainSemanticPoint[][] {
  const orientation = Math.sign(ringSignedArea(cut));
  if (!orientation) return [subject];
  const result: TerrainSemanticPoint[][] = [];
  let inside = subject;
  for (let i = 0; i < cut.length && inside.length >= 3; i++) {
    const a = cut[i] as TerrainSemanticPoint,
      b = cut[(i + 1) % cut.length] as TerrainSemanticPoint;
    const distance = (p: TerrainSemanticPoint): number =>
      orientation * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const split = (sign: number): TerrainSemanticPoint[] => {
      const points: TerrainSemanticPoint[] = [];
      for (let j = 0; j < inside.length; j++) {
        const p = inside[j] as TerrainSemanticPoint,
          q = inside[(j + 1) % inside.length] as TerrainSemanticPoint;
        const dp = distance(p) * sign,
          dq = distance(q) * sign;
        if (dp >= 0) points.push(p);
        if (dp >= 0 !== dq >= 0) {
          const t = dp / (dp - dq);
          points.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
      return points;
    };
    const outside = split(-1);
    if (outside.length >= 3 && Math.abs(ringSignedArea(outside)) > 1e-8) result.push(outside);
    inside = split(1);
  }
  return result;
}

export class SurfaceNetwork {
  readonly roads: SurfaceRoad[] = [];
  readonly junctions: SurfaceJunction[] = [];
  readonly turningCircles: SurfaceTurningCircle[] = [];
  private readonly cells = new Map<string, Segment[]>();
  private readonly cellSize = 32;
  private readonly footprints = new WeakMap<Segment, TerrainSemanticPoint[]>();
  private readonly tileSize: number;

  constructor(tile: TerrainSemanticTile, tileSize: number, style: TerrainSurfaceStyle) {
    this.tileSize = tileSize;
    for (const feature of groupTransportationFeatures(tile.transportation)) {
      if (!isPaintedTransport(feature, style)) continue;
      const kind = transportKind(feature);
      const paths = joinTerrainLines(feature.lines).flatMap((line) =>
        roadPieces(terrainLinePath(line, tileSize)),
      );
      for (const path of paths) {
        if (path.length <= 0) continue;
        const road: SurfaceRoad = {
          feature,
          path,
          width: transportWidth(feature, kind, style.roadWidthScale),
          kind,
          unpaved:
            style.unpavedRoads ||
            /dirt|ground|gravel|sand|unpaved|earth/.test(feature.surface ?? ''),
          // Parking sits at 0.30 and pedestrian polygons at 0.38–0.40. Keep mapped
          // paths (and their shoulders, 0.04 lower) clear of the parking sheet.
          elevation: transportSurfaceLift(kind, feature.bridge === true),
          stack: 0,
        };
        this.roads.push(road);
        for (let i = 1; i < path.points.length; i++) {
          const a = path.points[i - 1] as TerrainSemanticPoint;
          const b = path.points[i] as TerrainSemanticPoint;
          const segment: Segment = {
            road,
            a,
            b,
            start: path.distances[i - 1] ?? 0,
            length: (path.distances[i] ?? 0) - (path.distances[i - 1] ?? 0),
          };
          // Ignore remote buffered segments and cap indexing to the tile neighborhood.
          const pad = road.width / 2 + 4;
          const minX = Math.floor(Math.max(-pad, Math.min(a[0], b[0]) - pad) / this.cellSize);
          const maxX = Math.floor(
            Math.min(tileSize + pad, Math.max(a[0], b[0]) + pad) / this.cellSize,
          );
          const minZ = Math.floor(Math.max(-pad, Math.min(a[1], b[1]) - pad) / this.cellSize);
          const maxZ = Math.floor(
            Math.min(tileSize + pad, Math.max(a[1], b[1]) + pad) / this.cellSize,
          );
          // Keep only cells near the segment; buffered geometry is bounded above.
          for (let x = minX; x <= maxX; x++)
            for (let z = minZ; z <= maxZ; z++) {
              if (
                distanceToSegment((x + 0.5) * this.cellSize, (z + 0.5) * this.cellSize, segment) >
                this.cellSize * 0.72 + pad
              )
                continue;
              const key = `${x}/${z}`;
              const cell = this.cells.get(key) ?? [];
              cell.push(segment);
              this.cells.set(key, cell);
            }
        }
      }
    }
  }

  /** Whether a road's paving reaches within `padding` of a point; mapped paths only if `paths`. */
  occupied(x: number, z: number, padding = 0, except?: SurfaceRoad, paths = false): boolean {
    return (
      (
        this.cells.get(`${Math.floor(x / this.cellSize)}/${Math.floor(z / this.cellSize)}`) ?? []
      ).some(
        (s) =>
          s.road !== except &&
          (paths || s.road.kind !== 'path') &&
          s.road.kind !== 'rail' &&
          !s.road.feature.bridge &&
          distanceToSegment(x, z, s) < s.road.width / 2 + padding,
      ) ||
      this.turningCircles.some(
        (c) =>
          c.road !== except && Math.hypot(x - c.center[0], z - c.center[1]) < c.radius + padding,
      )
    );
  }

  /**
   * Sink each road whose paving overlaps another road's a step or more under it. Every road
   * draws its asphalt, shoulders, sidewalks, curbs and paint at the same heights over the one
   * draped ground, so where two overlapped (a junction, the corners of their sidewalks, a narrow
   * median between carriageways) their triangles were exactly coplanar, and which one drew on
   * top changed pixel by pixel as the camera moved: joints, wear and paint flickered. Widest
   * roads are placed first, each on the highest level no overlapping neighbor holds, so a through
   * road stays on top and a road that overlaps nothing keeps its nominal heights. `reach` is how
   * far a road's paving extends past its carriageway edge.
   */
  stackRoads(reach: (road: SurfaceRoad) => number): void {
    // Paths draw a separate set of heights from streets, rails and their sidewalks, and decks
    // follow their own profiles, so only roads in the same family can share a plane.
    const family = (road: SurfaceRoad): string =>
      `${road.kind === 'path'}/${road.feature.bridge === true}`;
    const cellSize = 16;
    const cells = new Map<string, { segment: Segment; extent: number }[]>();
    for (const road of this.roads) {
      road.stack = 0;
      const extent = road.width / 2 + reach(road);
      const points = road.path.points;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1] as TerrainSemanticPoint,
          b = points[i] as TerrainSemanticPoint;
        const minX = Math.max(-extent, Math.min(a[0], b[0]) - extent),
          maxX = Math.min(this.tileSize + extent, Math.max(a[0], b[0]) + extent),
          minZ = Math.max(-extent, Math.min(a[1], b[1]) - extent),
          maxZ = Math.min(this.tileSize + extent, Math.max(a[1], b[1]) + extent);
        if (minX > maxX || minZ > maxZ) continue;
        const segment: Segment = {
          road,
          a,
          b,
          start: road.path.distances[i - 1] ?? 0,
          length: (road.path.distances[i] ?? 0) - (road.path.distances[i - 1] ?? 0),
        };
        for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x++)
          for (let z = Math.floor(minZ / cellSize); z <= Math.floor(maxZ / cellSize); z++) {
            const key = `${x}/${z}`;
            const cell = cells.get(key) ?? [];
            cell.push({ segment, extent });
            cells.set(key, cell);
          }
      }
    }
    const neighbors = new Map<SurfaceRoad, Set<SurfaceRoad>>();
    for (const cell of cells.values())
      for (let i = 0; i < cell.length; i++) {
        const { segment: s, extent: e } = cell[i] as (typeof cell)[number];
        const near = neighbors.get(s.road) ?? new Set<SurfaceRoad>();
        neighbors.set(s.road, near);
        for (let j = i + 1; j < cell.length; j++) {
          const { segment: t, extent: f } = cell[j] as (typeof cell)[number];
          if (s.road === t.road || near.has(t.road) || family(s.road) !== family(t.road)) continue;
          if (segmentGap(s, t) >= e + f) continue;
          near.add(t.road);
          const other = neighbors.get(t.road) ?? new Set<SurfaceRoad>();
          other.add(s.road);
          neighbors.set(t.road, other);
        }
      }
    const levels = new Map<SurfaceRoad, number>();
    const order = this.roads.map((road, i) => ({ road, i }));
    order.sort((p, q) => q.road.width - p.road.width || p.i - q.i);
    for (const { road } of order) {
      // How many placed neighbors hold each level; a crowded crossing shares the emptiest.
      const held = new Array<number>(STACK_LEVELS).fill(0);
      for (const other of neighbors.get(road) ?? []) {
        const level = levels.get(other);
        if (level !== undefined) held[level] = (held[level] ?? 0) + 1;
      }
      const level = held.indexOf(Math.min(...held));
      levels.set(road, level);
      road.stack = -level * STACK_STEP;
    }
  }

  /**
   * Turning circles. Maps often end a cul-de-sac street at the bulb's near edge, or simply stop
   * it, and trace only the sidewalk wrapping round the end, which left the street stopping on a
   * ruled line before a notch of lawn and a concrete pad. Where a street dead-ends and a mapped
   * footway rings most of a circle about its end (all but the mouth the street enters by), the
   * circle inside that ring is asphalt: a bulb, or for a tight wrap a rounded end. A ring is
   * required, so a disc never spills past the footway onto lawns.
   */
  findTurningCircles(maximum = 64): void {
    this.turningCircles.length = 0;
    const near = (x: number, z: number, reach: number, test: (s: Segment) => boolean): boolean => {
      for (
        let cx = Math.floor((x - reach) / this.cellSize);
        cx <= Math.floor((x + reach) / this.cellSize);
        cx++
      )
        for (
          let cz = Math.floor((z - reach) / this.cellSize);
          cz <= Math.floor((z + reach) / this.cellSize);
          cz++
        )
          for (const s of this.cells.get(`${cx}/${cz}`) ?? [])
            if (test(s) && (reach <= 0 || distanceToSegment(x, z, s) < reach)) return true;
      return false;
    };
    for (const road of this.roads) {
      if (this.turningCircles.length >= maximum) break;
      if (road.kind !== 'street' || road.feature.bridge || road.unpaved) continue;
      const points = road.path.points;
      if (points.length < 2) continue;
      for (const [end, previous] of [
        [points[0], points[1]],
        [points.at(-1), points.at(-2)],
      ] as [TerrainSemanticPoint, TerrainSemanticPoint][]) {
        const [ex, ez] = end;
        const length = Math.hypot(ex - previous[0], ez - previous[1]) || 1;
        const dx = (ex - previous[0]) / length;
        const dz = (ez - previous[1]) / length;
        // A dead end: no other carriageway within a few meters of the end.
        if (
          near(
            ex,
            ez,
            3,
            (s) => s.road !== road && s.road.kind !== 'path' && s.road.kind !== 'rail',
          )
        )
          continue;
        // Rays from candidate centers beyond the end: each stops where it meets a footway's inner
        // edge. Most must hit, at similar distances (a ring, not a lone path), and the circle
        // ends at the nearest hit, so it never runs under the footway or past it.
        let found: { center: TerrainSemanticPoint; radius: number; spread: number } | undefined;
        for (let reach = -2; reach <= 12; reach++) {
          const center: TerrainSemanticPoint = [ex + dx * reach, ez + dz * reach];
          const hits: number[] = [];
          let rays = 0;
          for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            const ux = Math.cos(angle);
            const uz = Math.sin(angle);
            // The mouth, where the street comes in.
            if (ux * dx + uz * dz < -0.5) continue;
            rays++;
            for (let t = 1; t <= 16; t += 0.5)
              if (
                near(center[0] + ux * t, center[1] + uz * t, 0, (s) => {
                  // Footways that reach the street's end connect to it; they are not the ring.
                  if (s.road.kind !== 'path' || distanceToSegment(ex, ez, s) < road.width / 2 + 0.5)
                    return false;
                  const d = distanceToSegment(center[0] + ux * t, center[1] + uz * t, s);
                  return d < s.road.width / 2;
                })
              ) {
                hits.push(t);
                break;
              }
          }
          if (rays === 0 || hits.length / rays < 0.75) continue;
          const nearest = Math.min(...hits);
          const spread = Math.max(...hits) - nearest;
          if (spread > 4 || nearest < Math.max(1.6, road.width * 0.25)) continue;
          if (!found || spread < found.spread) found = { center, radius: nearest - 0.1, spread };
        }
        if (!found) continue;
        const outline = Array.from({ length: 20 }, (_, i): TerrainSemanticPoint => {
          const angle = (i * Math.PI) / 10;
          return [
            found.center[0] + Math.cos(angle) * found.radius,
            found.center[1] + Math.sin(angle) * found.radius,
          ];
        });
        this.turningCircles.push({ road, center: found.center, radius: found.radius, outline });
      }
    }
  }

  /** Mapped paths stop at the exact carriageway edge, including mitered curves.
   * Coplanar path/asphalt triangles otherwise fight even with a high-precision depth buffer. */
  clipPath(points: readonly TerrainSemanticPoint[], path: SurfaceRoad): TerrainSemanticPoint[][] {
    if (path.kind !== 'path') return [[...points]];
    let pieces: TerrainSemanticPoint[][] = [[...points]];
    const bounds = polygonBounds({ outer: [...points] });
    const candidates = new Set<Segment>();
    // Two extra cells include the bounded miter extensions beyond the centerline index.
    for (
      let x = Math.floor(bounds[0] / this.cellSize) - 2;
      x <= Math.floor(bounds[2] / this.cellSize) + 2;
      x++
    )
      for (
        let z = Math.floor(bounds[1] / this.cellSize) - 2;
        z <= Math.floor(bounds[3] / this.cellSize) + 2;
        z++
      )
        for (const segment of this.cells.get(`${x}/${z}`) ?? []) {
          const road = segment.road;
          if (
            road.kind !== 'path' &&
            road.kind !== 'rail' &&
            (road.feature.layer ?? 0) === (path.feature.layer ?? 0) &&
            !!road.feature.bridge === !!path.feature.bridge
          )
            candidates.add(segment);
        }
    for (const circle of this.turningCircles) {
      if (
        circle.center[0] - circle.radius >= bounds[2] ||
        circle.center[0] + circle.radius <= bounds[0] ||
        circle.center[1] - circle.radius >= bounds[3] ||
        circle.center[1] + circle.radius <= bounds[1]
      )
        continue;
      pieces = pieces.flatMap((piece) => subtractFootprint(piece, circle.outline));
      if (!pieces.length) return pieces;
    }
    for (const segment of candidates) {
      const road = segment.road;
      let footprint = this.footprints.get(segment);
      if (!footprint) {
        const edge = (distance: number, side: number): TerrainSemanticPoint => {
          const p = sampleTerrainLine(road.path, distance, (side * road.width) / 2);
          return [p.x, p.z];
        };
        footprint = [
          edge(segment.start, 1),
          edge(segment.start + segment.length, 1),
          edge(segment.start + segment.length, -1),
          edge(segment.start, -1),
        ];
        this.footprints.set(segment, footprint);
      }
      const other = polygonBounds({ outer: footprint });
      if (
        other[0] >= bounds[2] ||
        other[2] <= bounds[0] ||
        other[1] >= bounds[3] ||
        other[3] <= bounds[1]
      )
        continue;
      pieces = pieces.flatMap((piece) => subtractFootprint(piece, footprint));
      if (!pieces.length) break;
    }
    return pieces;
  }

  findJunctions(maximum = 256): void {
    this.junctions.length = 0;
    const visited = new Map<Segment, Set<Segment>>();
    type Node = {
      x: number;
      z: number;
      radius: number;
      layer: number;
      refs: Map<SurfaceRoad, number[]>;
    };
    const nodes = new Map<string, Node>();
    let comparisons = 0;
    search: for (const cell of this.cells.values())
      for (let i = 0; i < cell.length; i++) {
        const a = cell[i] as Segment;
        if (a.road.kind !== 'street' || isSurfaceLink(a.road)) continue;
        const seen = visited.get(a) ?? new Set<Segment>();
        visited.set(a, seen);
        for (let j = i + 1; j < cell.length; j++) {
          const b = cell[j] as Segment;
          if (a.road === b.road || b.road.kind !== 'street' || isSurfaceLink(b.road) || seen.has(b))
            continue;
          seen.add(b);
          if (++comparisons > 100_000) break search;
          if (
            a.road.feature.bridge ||
            b.road.feature.bridge ||
            (a.road.feature.layer ?? 0) !== (b.road.feature.layer ?? 0)
          )
            continue;
          const ax = a.b[0] - a.a[0],
            az = a.b[1] - a.a[1];
          const bx = b.b[0] - b.a[0],
            bz = b.b[1] - b.a[1];
          const cross = ax * bz - az * bx;
          if (Math.abs(cross) < a.length * b.length * 0.3) continue;
          const qx = b.a[0] - a.a[0],
            qz = b.a[1] - a.a[1];
          const t = (qx * bz - qz * bx) / cross;
          const u = (qx * az - qz * ax) / cross;
          if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) continue;
          const x = a.a[0] + ax * t,
            z = a.a[1] + az * t;
          const layer = a.road.feature.layer ?? 0;
          const key = `${Math.round(x * 2)}/${Math.round(z * 2)}/${layer}`;
          let node = nodes.get(key);
          if (!node) {
            if (nodes.size >= maximum * 4) continue;
            node = { x, z, layer, radius: 0, refs: new Map() };
            nodes.set(key, node);
          }
          node.radius = Math.max(node.radius, a.road.width / 2 + 1.5, b.road.width / 2 + 1.5);
          for (const [s, fraction] of [
            [a, t],
            [b, u],
          ] as const) {
            const distance = s.start + Math.max(0, Math.min(1, fraction)) * s.length;
            const distances = node.refs.get(s.road) ?? [];
            if (!distances.some((d) => Math.abs(d - distance) < 0.5)) distances.push(distance);
            node.refs.set(s.road, distances);
          }
        }
      }
    // A divided crossing has several centerline nodes but only one set of outside approaches.
    // Require shared topology and bound the whole cluster, so nearby independent streets stay separate.
    const clusters: Node[][] = [];
    for (const node of nodes.values()) {
      const cluster = clusters.find(
        (c) =>
          c.every((n) => n.layer === node.layer && Math.hypot(n.x - node.x, n.z - node.z) < 32) &&
          c.some(
            (n) =>
              Math.hypot(n.x - node.x, n.z - node.z) < Math.min(28, n.radius + node.radius + 5) &&
              [...node.refs.keys()].some((road) => n.refs.has(road)),
          ),
      );
      if (cluster) cluster.push(node);
      else clusters.push([node]);
    }
    for (const cluster of clusters) {
      if (this.junctions.length >= maximum) break;
      const x = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
      const z = cluster.reduce((s, n) => s + n.z, 0) / cluster.length;
      const junction: SurfaceJunction = {
        x,
        z,
        layer: cluster[0]?.layer ?? 0,
        radius: Math.max(...cluster.map((n) => Math.hypot(n.x - x, n.z - z) + n.radius)),
        cores: cluster.map((n) => ({ x: n.x, z: n.z, radius: n.radius })),
        arms: [],
      };
      const inside = (px: number, pz: number): boolean =>
        cluster.some((n) => Math.hypot(px - n.x, pz - n.z) < n.radius + 3);
      for (const node of cluster)
        for (const [road, distances] of node.refs) {
          for (const distance of distances)
            for (const sign of [-1, 1]) {
              let d = distance;
              let p = sampleTerrainLine(road.path, d);
              // Follow the actual centerline past the complete junction, not the tangent of a tiny connector.
              for (let step = 0; step < 80 && inside(p.x, p.z); step++) {
                d += sign;
                if (d < 0 || d > road.path.length) break;
                p = sampleTerrainLine(road.path, d);
              }
              if (d < 4 || d > road.path.length - 4 || inside(p.x, p.z)) continue;
              const beyond = sampleTerrainLine(road.path, d + sign * 4);
              if (inside(beyond.x, beyond.z)) continue;
              const length = Math.hypot(beyond.x - p.x, beyond.z - p.z);
              if (length < 1) continue;
              const dx = (beyond.x - p.x) / length,
                dz = (beyond.z - p.z) / length;
              // A short internal link can meet the same approach several times.
              if (
                junction.arms.some(
                  (arm) =>
                    arm.road === road &&
                    arm.dx * dx + arm.dz * dz > 0.95 &&
                    Math.hypot(arm.x - p.x, arm.z - p.z) < 8,
                )
              )
                continue;
              junction.arms.push({ road, x: p.x, z: p.z, dx, dz, distance: d, width: road.width });
            }
        }
      // Combine parallel carriageways into one crossing, including the median between them.
      for (let i = 0; i < junction.arms.length; i++) {
        const a = junction.arms[i] as SurfaceJunction['arms'][number];
        for (let j = junction.arms.length - 1; j > i; j--) {
          const b = junction.arms[j] as SurfaceJunction['arms'][number];
          const along = (b.x - a.x) * a.dx + (b.z - a.z) * a.dz;
          const across = -(b.x - a.x) * a.dz + (b.z - a.z) * a.dx;
          if (
            a.dx * b.dx + a.dz * b.dz < 0.985 ||
            Math.abs(along) > 10 ||
            Math.abs(across) > (a.width + b.width) / 2 + 8
          )
            continue;
          const low = Math.min(-a.width / 2, across - b.width / 2);
          const high = Math.max(a.width / 2, across + b.width / 2);
          a.x += a.dx * Math.max(0, along) - (a.dz * (low + high)) / 2;
          a.z += a.dz * Math.max(0, along) + (a.dx * (low + high)) / 2;
          a.width = high - low;
          junction.arms.splice(j, 1);
        }
      }
      if (junction.arms.length >= 3) this.junctions.push(junction);
    }
  }
}

/**
 * Cut a path where its bands would lie on each other, which as one road could not be stacked
 * apart (see `SurfaceNetwork.stackRoads`):
 * - where it doubles back more sharply than a band can miter (past 120°, where
 *   `sampleTerrainLine` caps the join): two one-way carriageways joined end to end where a
 *   divided road narrows put their median-side sidewalks in one plane;
 * - at the vertex its own end returns to: a cul-de-sac mapped as one way up the street, round a
 *   loop and back to its own middle laid the loop's last stretch, sidewalks and all, over the
 *   street's mouth. Cut there, the loop closes on itself and keeps a mitered join.
 */
function roadPieces(path: TerrainLinePath): TerrainLinePath[] {
  const { points, distances } = path;
  const cuts = new Set<number>();
  for (let i = 1; i + 1 < points.length; i++) {
    const [ax, az] = points[i - 1] as TerrainSemanticPoint,
      [bx, bz] = points[i] as TerrainSemanticPoint,
      [cx, cz] = points[i + 1] as TerrainSemanticPoint;
    const turn =
      ((bx - ax) * (cx - bx) + (bz - az) * (cz - bz)) /
      (Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz));
    if (turn < -0.5) cuts.add(i);
  }
  for (const [end, at] of [
    [points[0], 0],
    [points.at(-1), path.length],
  ] as [TerrainSemanticPoint, number][])
    for (let i = 1; i + 1 < points.length; i++) {
      const [x, z] = points[i] as TerrainSemanticPoint;
      if (Math.abs((distances[i] ?? 0) - at) > 10 && Math.hypot(x - end[0], z - end[1]) < 0.5) {
        cuts.add(i);
        break;
      }
    }
  if (cuts.size === 0) return [path];
  const pieces: TerrainLinePath[] = [];
  let start = 0;
  for (const end of [...[...cuts].sort((a, b) => a - b), points.length - 1]) {
    const from = distances[start] ?? 0;
    pieces.push({
      points: points.slice(start, end + 1),
      distances: distances.slice(start, end + 1).map((d) => d - from),
      length: (distances[end] ?? 0) - from,
    });
    start = end;
  }
  return pieces;
}

/** Least distance between two segments: zero where they cross. */
function segmentGap(s: Segment, t: Segment): number {
  const side = (a: TerrainSemanticPoint, b: TerrainSemanticPoint, p: TerrainSemanticPoint) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (
    side(s.a, s.b, t.a) * side(s.a, s.b, t.b) < 0 &&
    side(t.a, t.b, s.a) * side(t.a, t.b, s.b) < 0
  )
    return 0;
  return Math.min(
    distanceToSegment(t.a[0], t.a[1], s),
    distanceToSegment(t.b[0], t.b[1], s),
    distanceToSegment(s.a[0], s.a[1], t),
    distanceToSegment(s.b[0], s.b[1], t),
  );
}

function distanceToSegment(x: number, z: number, s: Segment): number {
  const dx = s.b[0] - s.a[0],
    dz = s.b[1] - s.a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (s.length * s.length || 1)),
  );
  return Math.hypot(x - s.a[0] - dx * t, z - s.a[1] - dz * t);
}
