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
import { roadWidth } from './semantic-widths';
import type { TerrainSurfaceStyle } from './surface-styles';

export interface SurfaceRoad {
  feature: TerrainTransportationFeature;
  path: TerrainLinePath;
  width: number;
  kind: 'street' | 'service' | 'path' | 'rail' | 'motorway';
  unpaved: boolean;
  elevation: number;
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

export function isSurfaceLink(road: SurfaceRoad): boolean {
  return road.feature.link === true || /(?:_link|ramp)$/.test(road.feature.subclass ?? '');
}

function roadKind(feature: TerrainTransportationFeature): SurfaceRoad['kind'] {
  const tag = `${feature.class} ${feature.subclass ?? ''} ${feature.service ?? ''}`.toLowerCase();
  if (/rail|tram|train/.test(tag)) return 'rail';
  if (/path|foot|cycle|pedestrian|steps|trail|bridle/.test(tag)) return 'path';
  if (/service|parking|driveway|alley/.test(tag)) return 'service';
  if (/motorway|freeway|highway/.test(tag)) return 'motorway';
  return 'street';
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
  private readonly cells = new Map<string, Segment[]>();
  private readonly cellSize = 32;
  private readonly footprints = new WeakMap<Segment, TerrainSemanticPoint[]>();

  constructor(tile: TerrainSemanticTile, tileSize: number, style: TerrainSurfaceStyle) {
    const groups = new Map<string, TerrainTransportationFeature>();
    for (const feature of tile.transportation) {
      const { id: _id, lines, ...properties } = feature;
      const key = JSON.stringify(properties);
      const group = groups.get(key);
      if (group) group.lines.push(...lines);
      else groups.set(key, { ...feature, lines: [...lines] });
    }
    for (const feature of groups.values()) {
      if (
        feature.tunnel ||
        (feature.subclass === 'sidewalk' && !style.sidewalks) ||
        feature.subclass === 'crossing'
      )
        continue;
      const kind = roadKind(feature);
      for (const line of joinTerrainLines(feature.lines)) {
        const path = terrainLinePath(line, tileSize);
        if (path.length <= 0) continue;
        const width =
          feature.width ??
          (kind === 'path'
            ? 2.4
            : kind === 'service'
              ? 4.5
              : feature.lanes
                ? Math.min(12, feature.lanes) * 3.2
                : roadWidth(feature.subclass ?? feature.class)) * style.roadWidthScale;
        const road: SurfaceRoad = {
          feature,
          path,
          width: Math.min(80, width),
          kind,
          unpaved:
            style.unpavedRoads ||
            /dirt|ground|gravel|sand|unpaved|earth/.test(feature.surface ?? ''),
          // Parking sits at 0.30 and pedestrian polygons at 0.38–0.40. Keep mapped
          // paths (and their shoulders, 0.04 lower) clear of the parking sheet.
          elevation: (kind === 'path' ? 0.43 : 0.32) + (feature.bridge ? 4 : 0),
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

  occupied(x: number, z: number, padding = 0, except?: SurfaceRoad): boolean {
    return (
      this.cells.get(`${Math.floor(x / this.cellSize)}/${Math.floor(z / this.cellSize)}`) ?? []
    ).some(
      (s) =>
        s.road !== except &&
        s.road.kind !== 'path' &&
        s.road.kind !== 'rail' &&
        !s.road.feature.bridge &&
        distanceToSegment(x, z, s) < s.road.width / 2 + padding,
    );
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

function distanceToSegment(x: number, z: number, s: Segment): number {
  const dx = s.b[0] - s.a[0],
    dz = s.b[1] - s.a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (s.length * s.length || 1)),
  );
  return Math.hypot(x - s.a[0] - dx * t, z - s.a[1] - dz * t);
}
