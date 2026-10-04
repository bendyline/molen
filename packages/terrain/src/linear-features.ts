/** Shared, metric line construction for roads, tracks, fences and utility corridors. */
import * as THREE from 'three';
import { markTerrainGroundSurface } from './ground-cutout';
import {
  joinTerrainLines,
  sampleTerrainLine,
  type TerrainLinePath,
  terrainLinePath,
} from './line-path';
import { normalizeRing } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
} from './semantic-types';
import { clipTerrainSurfacePolygon, terrainSurfaceDraper } from './terrain-drape';

export {
  joinTerrainLines,
  lineSegmentIndex,
  pathBounds,
  sampleTerrainLine,
  type TerrainLinePath,
  type TerrainLineSample,
  terrainLinePath,
} from './line-path';

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

  /** Clip a convex 3D face to this tile, interpolating heights at its boundaries. */
  face(points: readonly (readonly [number, number, number])[], color: THREE.Color): void {
    let clipped = points.map((p) => [...p] as [number, number, number]);
    for (const [axis, limit, sign] of [
      [0, 0, 1],
      [0, this.context.tileSize, -1],
      [2, 0, 1],
      [2, this.context.tileSize, -1],
    ] as const) {
      const input = clipped;
      clipped = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i] as [number, number, number];
        const b = input[(i + 1) % input.length] as [number, number, number];
        const da = (a[axis] - limit) * sign;
        const db = (b[axis] - limit) * sign;
        if (da >= 0) clipped.push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db);
          const cut: [number, number, number] = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ];
          cut[axis] = limit;
          clipped.push(cut);
        }
      }
    }
    for (let i = 1; i + 1 < clipped.length; i++) {
      const a = clipped[0] as [number, number, number],
        b = clipped[i] as [number, number, number],
        c = clipped[i + 1] as [number, number, number];
      const normal = new THREE.Vector3()
        .subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
        .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)))
        .normalize();
      for (const p of [a, b, c]) {
        this.positions.push(...p);
        this.normals.push(normal.x, normal.y, normal.z);
        this.colors.push(color.r, color.g, color.b);
      }
    }
  }

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

  mesh(
    name: string,
    material: THREE.Material = SURFACE_MATERIAL,
    groundSurface = true,
  ): THREE.Mesh | undefined {
    if (this.positions.length === 0) return undefined;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.userData.terrainOwnedGeometry = true;
    if (groundSurface) markTerrainGroundSurface(mesh);
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
    /** Absolute deck profile; evaluated before clipping so neighboring pieces meet. */
    heightAt?: (x: number, z: number) => number;
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
      for (const piece of options.clip ? options.clip(points) : [points]) {
        const heightAt = options.heightAt;
        if (heightAt)
          builder.face(
            piece.map(([x, z]) => [x, heightAt(x, z) + (band.elevation ?? 0), z]),
            color,
          );
        else
          builder.polygon(piece, color, band.elevation ?? 0.25, band.elevationMode === 'absolute');
      }
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
