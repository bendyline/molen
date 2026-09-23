/** Shared, metric line construction for roads, tracks, fences and utility corridors. */
import * as THREE from 'three';
import { normalizeRing } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
} from './semantic-types';
import { clipTerrainSurfacePolygon, terrainSurfaceDraper } from './terrain-drape';

export interface TerrainLineBand {
  width: number;
  offset?: number;
  color: string;
  /** Distance above terrain, or absolute Y when elevationMode is absolute. */
  elevation?: number;
  elevationMode?: 'terrain' | 'absolute';
  /** Painted/repeated length and gap, in world units. */
  dash?: readonly [length: number, gap: number];
  phase?: number;
}

export interface TerrainLineRepeater {
  spacing: number;
  offset?: number;
  elevation?: number;
  /** Width across the line, height, length along the line. */
  size: readonly [number, number, number];
  color: string;
}

export interface TerrainLineProfile {
  bands: readonly TerrainLineBand[];
  repeaters?: readonly TerrainLineRepeater[];
  /** Upper bound on terrain sampling distance (world units, default 6). */
  sampleSpacing?: number;
  /** Per-object detail budget, default 20,000 band segments and repeaters. */
  maxElements?: number;
}

export interface TerrainLinePath {
  points: TerrainSemanticPoint[];
  distances: number[];
  length: number;
}

export interface TerrainLineSample {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

/** Convert normalized tile geometry once; collapse duplicate vertices. */
export function terrainLinePath(line: TerrainSemanticLine, tileSize: number): TerrainLinePath {
  const points: TerrainSemanticPoint[] = [];
  const distances: number[] = [];
  let length = 0;
  for (const point of line) {
    if (
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      !Number.isFinite(tileSize) ||
      tileSize <= 0
    )
      throw new Error('Line coordinates and tile size must be finite; size positive');
    const p: TerrainSemanticPoint = [point[0] * tileSize, point[1] * tileSize];
    const previous = points.at(-1);
    const distance = previous ? Math.hypot(p[0] - previous[0], p[1] - previous[1]) : 0;
    if (previous && distance < 0.0001) continue;
    length += distance;
    points.push(p);
    distances.push(length);
  }
  return { points, distances, length };
}

/** Join degree-two source fragments so profiles and dash phases continue through tile features. */
export function joinTerrainLines(lines: readonly TerrainSemanticLine[]): TerrainSemanticLine[] {
  const ends = new Map<string, number[]>();
  const key = (p: TerrainSemanticPoint): string =>
    `${Math.round(p[0] * 1e7)}/${Math.round(p[1] * 1e7)}`;
  lines.forEach((line, i) => {
    if (line.length < 2) return;
    for (const p of [line[0], line.at(-1)] as TerrainSemanticPoint[]) {
      const k = key(p),
        list = ends.get(k) ?? [];
      list.push(i);
      ends.set(k, list);
    }
  });
  const used = new Set<number>();
  const result: TerrainSemanticLine[] = [];
  lines.forEach((line, i) => {
    if (used.has(i) || line.length < 2) return;
    used.add(i);
    const points = [...line];
    for (const front of [false, true]) {
      for (;;) {
        const p = (front ? points[0] : points.at(-1)) as TerrainSemanticPoint;
        const adjacent = ends.get(key(p));
        if (adjacent?.length !== 2) break;
        const next = adjacent.find((j) => !used.has(j));
        if (next === undefined) break;
        used.add(next);
        const other = [...(lines[next] as TerrainSemanticLine)];
        if ((key(other[0] as TerrainSemanticPoint) === key(p)) === front) other.reverse();
        if (front) points.unshift(...other.slice(0, -1));
        else points.push(...other.slice(1));
      }
    }
    result.push(points);
  });
  return result;
}

const pathJoins = new WeakMap<TerrainLinePath, TerrainSemanticPoint[]>();
function lineJoins(path: TerrainLinePath): TerrainSemanticPoint[] {
  const cached = pathJoins.get(path);
  if (cached) return cached;
  const points = path.points;
  const last = points.length - 1;
  const closed =
    last > 1 &&
    Math.hypot(
      (points[0]?.[0] ?? 0) - (points[last]?.[0] ?? 0),
      (points[0]?.[1] ?? 0) - (points[last]?.[1] ?? 0),
    ) < 0.0001;
  const joins = points.map((p, i): TerrainSemanticPoint => {
    const previous = points[i - 1] ?? (closed ? points[last - 1] : undefined);
    const next = points[i + 1] ?? (closed ? points[1] : undefined);
    const direction = (a: TerrainSemanticPoint, b: TerrainSemanticPoint): TerrainSemanticPoint => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    };
    const incoming = previous ? direction(previous, p) : direction(p, next ?? p);
    const outgoing = next ? direction(p, next) : incoming;
    const divisor = Math.max(0.5, 1 + incoming[0] * outgoing[0] + incoming[1] * outgoing[1]);
    return [(-incoming[1] - outgoing[1]) / divisor, (incoming[0] + outgoing[0]) / divisor];
  });
  pathJoins.set(path, joins);
  return joins;
}

/** Sample a path by arc length; offset edges interpolate shared, bounded miter joins.
 * Closed paths use the same join at both ends, avoiding a wedge at the closure. */
export function sampleTerrainLine(
  path: TerrainLinePath,
  distance: number,
  offset = 0,
): TerrainLineSample {
  let low = 0;
  let high = path.distances.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if ((path.distances[middle] ?? 0) <= distance) low = middle;
    else high = middle;
  }
  const a = path.points[low] ?? [0, 0];
  const b = path.points[low + 1] ?? a;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  const t = Math.max(0, Math.min(1, (distance - (path.distances[low] ?? 0)) / length));
  const joins = lineJoins(path);
  const start = joins[low] ?? [-dz, dx];
  const finish = joins[low + 1] ?? start;
  const nx = start[0] + (finish[0] - start[0]) * t;
  const nz = start[1] + (finish[1] - start[1]) * t;
  return {
    x: a[0] + (b[0] - a[0]) * t + nx * offset,
    z: a[1] + (b[1] - a[1]) * t + nz * offset,
    dx,
    dz,
  };
}

const SURFACE_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  side: THREE.DoubleSide,
});

/** Batched, tile-clipped triangles sharing the rendered ground grid. */
export class TerrainSurfaceMeshBuilder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly normals: number[] = [];
  constructor(readonly context: TerrainPyramidTileLayerContext) {}

  polygon(
    points: readonly TerrainSemanticPoint[],
    color: THREE.Color,
    elevation: number,
    absolute = false,
  ): void {
    if (!absolute) {
      terrainSurfaceDraper(this.context).polygon(points, (a, b, c) => {
        for (const p of [a, b, c]) {
          this.positions.push(p[0], p[1] + elevation, p[2]);
          this.normals.push(p[3], p[4], p[5]);
          this.colors.push(color.r, color.g, color.b);
        }
      });
      return;
    }
    const clipped = clipTerrainSurfacePolygon(points, this.context.tileSize);
    for (let i = 1; i + 1 < clipped.length; i++) {
      for (const p of [clipped[0], clipped[i], clipped[i + 1]] as TerrainSemanticPoint[]) {
        this.positions.push(p[0], elevation, p[1]);
        this.normals.push(0, 1, 0);
        this.colors.push(color.r, color.g, color.b);
      }
    }
  }

  mesh(name: string, material: THREE.Material = SURFACE_MATERIAL): THREE.Mesh | undefined {
    if (this.positions.length === 0) return undefined;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.userData.terrainOwnedGeometry = true;
    return mesh;
  }
}

/** Triangulate semantic footprints with holes, then conform every triangle to the ground grid. */
export function appendTerrainSurfaceArea(
  builder: TerrainSurfaceMeshBuilder,
  polygon: TerrainSemanticPolygon,
  color: THREE.Color,
  elevation: number,
): void {
  const rings = [polygon.outer, ...(polygon.holes ?? [])].map((ring) =>
    normalizeRing(ring).map(
      (p) => new THREE.Vector2(p[0] * builder.context.tileSize, p[1] * builder.context.tileSize),
    ),
  );
  const outer = rings[0];
  if (!outer || outer.length < 3) return;
  const triangles = THREE.ShapeUtils.triangulateShape(outer, rings.slice(1));
  const points = rings.flat().map((p): TerrainSemanticPoint => [p.x, p.y]);
  for (const face of triangles) {
    builder.polygon(
      face.map((i) => points[i] as TerrainSemanticPoint),
      color,
      elevation,
    );
  }
}

export type TerrainLineBandFilter = (
  points: readonly TerrainSemanticPoint[],
  distance: number,
) => boolean;

/** Append one profile band, preserving source bends and arc-length dash spacing. */
export function appendTerrainLineBand(
  builder: TerrainSurfaceMeshBuilder,
  path: TerrainLinePath,
  band: TerrainLineBand,
  options: {
    spacing?: number;
    maxElements?: number;
    filter?: TerrainLineBandFilter;
    /** Subtract footprints before terrain sampling; returned pieces must be convex. */
    clip?: (points: readonly TerrainSemanticPoint[]) => readonly TerrainSemanticPoint[][];
    start?: number;
    end?: number;
  } = {},
): number {
  if (!Number.isFinite(band.width) || band.width <= 0 || path.length <= 0) return 0;
  const spacing = Math.max(0.25, options.spacing ?? 6);
  const dash = band.dash;
  if (dash && (!Number.isFinite(dash[0] + dash[1]) || dash[0] <= 0 || dash[1] < 0)) {
    throw new Error('Line dash length must be positive and gap nonnegative');
  }
  const period = dash ? dash[0] + dash[1] : 0;
  const color = new THREE.Color(band.color);
  let count = 0;
  let distance = Math.max(0, options.start ?? 0);
  const end = Math.min(path.length, options.end ?? path.length);
  let vertex = 1;
  while (distance < end - 0.0001 && count < (options.maxElements ?? 20_000)) {
    while ((path.distances[vertex] ?? Infinity) <= distance + 0.0001) vertex++;
    const phase = period ? (((distance + (band.phase ?? 0)) % period) + period) % period : 0;
    const painted = !dash || phase < dash[0] - 0.0001;
    const dashEnd = dash ? distance + (painted ? dash[0] - phase : period - phase) : Infinity;
    const next = Math.min(
      end,
      distance + spacing,
      path.distances[vertex] ?? end,
      Math.max(distance + 0.0001, dashEnd),
    );
    const edge = (d: number, side: number): TerrainSemanticPoint => {
      const p = sampleTerrainLine(path, d, (band.offset ?? 0) + (side * band.width) / 2);
      return [p.x, p.z];
    };
    const points: TerrainSemanticPoint[] = [
      edge(distance, 1),
      edge(next, 1),
      edge(next, -1),
      edge(distance, -1),
    ];
    if (painted && (!options.filter || options.filter(points, (distance + next) / 2))) {
      for (const piece of options.clip ? options.clip(points) : [points])
        builder.polygon(piece, color, band.elevation ?? 0.25, band.elevationMode === 'absolute');
    }
    count++;
    distance = next;
  }
  return count;
}

export interface TerrainBoxPlacement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  size: readonly [number, number, number];
  color: string;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const FIXTURE_MATERIAL = new THREE.MeshStandardMaterial({ roughness: 0.78 });

/** One draw for a collection of colored fixture parts; geometry/material are shared. */
export function createTerrainBoxInstances(
  placements: readonly TerrainBoxPlacement[],
  name: string,
): THREE.InstancedMesh | undefined {
  if (!placements.length) return undefined;
  const mesh = new THREE.InstancedMesh(BOX, FIXTURE_MATERIAL, placements.length);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i] as TerrainBoxPlacement;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
    matrix.compose(new THREE.Vector3(p.x, p.y, p.z), rotation, new THREE.Vector3(...p.size));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, new THREE.Color(p.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.terrainOwnedInstances = true;
  return mesh;
}

/** A reusable line renderer: tracks can combine ballast, rail bands and repeated sleepers;
 * utilities can combine elevated bands and repeated poles, without road semantics. */
export function createTerrainLinearObject(
  lines: readonly TerrainSemanticLine[],
  context: TerrainPyramidTileLayerContext,
  profile: TerrainLineProfile,
): THREE.Group {
  if (
    profile.sampleSpacing !== undefined &&
    (!Number.isFinite(profile.sampleSpacing) || profile.sampleSpacing <= 0)
  )
    throw new Error('Line sampleSpacing must be positive and finite');
  if (
    profile.maxElements !== undefined &&
    (!Number.isSafeInteger(profile.maxElements) || profile.maxElements < 0)
  )
    throw new Error('Line maxElements must be a nonnegative safe integer');
  for (const band of profile.bands)
    if (
      !Number.isFinite(band.width) ||
      band.width <= 0 ||
      !Number.isFinite(band.offset ?? 0) ||
      !Number.isFinite(band.elevation ?? 0) ||
      !Number.isFinite(band.phase ?? 0)
    )
      throw new Error('Line band dimensions must be finite; width positive');
  for (const repeater of profile.repeaters ?? [])
    if (
      repeater.size.some((n) => !Number.isFinite(n) || n <= 0) ||
      !Number.isFinite(repeater.offset ?? 0) ||
      !Number.isFinite(repeater.elevation ?? 0)
    )
      throw new Error('Line repeater dimensions must be finite; size positive');
  const group = new THREE.Group();
  group.name = 'terrain:linear-features';
  const builder = new TerrainSurfaceMeshBuilder(context);
  const parts: TerrainBoxPlacement[] = [];
  let remaining = Math.max(0, profile.maxElements ?? 20_000);
  for (const line of joinTerrainLines(lines)) {
    const path = terrainLinePath(line, context.tileSize);
    for (const band of profile.bands) {
      remaining -= appendTerrainLineBand(builder, path, band, {
        spacing: profile.sampleSpacing,
        maxElements: remaining,
      });
    }
    for (const repeater of profile.repeaters ?? []) {
      if (!Number.isFinite(repeater.spacing) || repeater.spacing <= 0) {
        throw new Error('Line repeater spacing must be positive and finite');
      }
      for (let d = repeater.spacing / 2; d < path.length && remaining > 0; d += repeater.spacing) {
        remaining--;
        const p = sampleTerrainLine(path, d, repeater.offset ?? 0);
        if (p.x < 0 || p.z < 0 || p.x >= context.tileSize || p.z >= context.tileSize) continue;
        parts.push({
          x: p.x,
          z: p.z,
          y:
            context.heightfield.sampleHeight(context.origin[0] + p.x, context.origin[1] + p.z) +
            (repeater.elevation ?? 0) +
            repeater.size[1] / 2,
          yaw: Math.atan2(p.dx, p.dz),
          size: repeater.size,
          color: repeater.color,
        });
      }
    }
  }
  const mesh = builder.mesh('linear:bands');
  if (mesh) group.add(mesh);
  const instances = createTerrainBoxInstances(parts, 'linear:repeaters');
  if (instances) group.add(instances);
  return group;
}
