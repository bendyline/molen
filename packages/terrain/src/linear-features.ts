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
import { renderedGroundSampler } from './rendered-ground';
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

/**
 * Surface kinds for draped bands and areas, read by the pavement material through the
 * `surfaceDetail` attribute (x: meters along the band, y: meters across it from its edge,
 * z: `kind * 128 + width`, w: a road's lane width, otherwise its fraying edges; see
 * `TerrainLineBand.fray`).
 */
export const TERRAIN_SURFACE_KIND: {
  readonly plain: 0;
  readonly road: 1;
  readonly sidewalk: 2;
  readonly curb: 3;
  readonly paint: 4;
  readonly parking: 5;
  readonly plaza: 6;
  readonly dirt: 7;
  readonly shoulder: 8;
  readonly ballast: 9;
} = {
  plain: 0,
  road: 1,
  sidewalk: 2,
  curb: 3,
  paint: 4,
  parking: 5,
  plaza: 6,
  dirt: 7,
  shoulder: 8,
  ballast: 9,
};
export type TerrainSurfaceKind = (typeof TERRAIN_SURFACE_KIND)[keyof typeof TERRAIN_SURFACE_KIND];

/** `userData` flag on draped pavement meshes that a host pavement material may replace. */
export const TERRAIN_PAVEMENT: 'terrainPavement' = 'terrainPavement';

export interface TerrainLineBand {
  width: number;
  offset?: number;
  color: string;
  /** Write `surfaceDetail` for the pavement material: the kind, and a road's lane count. */
  surface?: TerrainSurfaceKind;
  lanes?: number;
  /**
   * Edges the pavement material frays into the ground beneath, for a band that meets bare
   * ground: the one away from the line (`outer`), toward it (`inner`) or both. Not for roads.
   */
  fray?: 'outer' | 'inner' | 'both';
  /**
   * Height of a vertical face dropping from the band's inner edge (the one toward the line), as
   * a curb's face drops to the road beside it. Draped bands only; 0 or absent for none.
   */
  riser?: number;
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
  private readonly attributes = new Map<string, { size: number; values: number[] }>();
  private groundAt?: (x: number, z: number) => number;
  get vertexCount(): number {
    return this.positions.length / 3;
  }

  /** Emit `name` on the finished mesh even if nothing wrote it (zeros). */
  ensureAttribute(name: string, size: number): void {
    if (!this.attributes.has(name)) this.attributes.set(name, { size, values: [] });
  }

  /**
   * Tag everything appended since `start` with a surface kind and band coordinates. `fray` marks
   * the band edges that fray into the ground: 1 at across 0, 2 at the full width, 3 both.
   */
  surfaceSince(
    start: number,
    kind: TerrainSurfaceKind,
    sample: (x: number, z: number) => readonly [along: number, across: number] = () => [0, 0],
    width = 0,
    laneWidth = 0,
    fray = 0,
  ): void {
    if (this.vertexCount <= start) return;
    const code = kind * 128 + Math.min(127, Math.max(0, width));
    const w = kind === TERRAIN_SURFACE_KIND.road ? laneWidth : fray;
    const entry = this.attributes.get('surfaceDetail') ?? { size: 4, values: [] };
    while (entry.values.length < start * 4) entry.values.push(0);
    for (let i = start; i < this.vertexCount; i++) {
      const [along, across] = sample(this.positions[i * 3] ?? 0, this.positions[i * 3 + 2] ?? 0);
      entry.values.push(along, across, code, w);
    }
    this.attributes.set('surfaceDetail', entry);
  }

  /**
   * Stop everything appended since `start` fraying wherever `ground` rejects a vertex: there the
   * band's edge lies over other paving, not bare ground, and a ragged margin would show a seam.
   * Whole triangles at a time: the fray flag is interpolated, and a triangle blending two flags
   * would decode a third (2 and 0 pass through 1, the other edge) and cut holes in the band.
   */
  unfraySince(start: number, ground: (x: number, z: number) => boolean): void {
    const entry = this.attributes.get('surfaceDetail');
    if (entry === undefined) return;
    for (let t = start; t + 2 < this.vertexCount; t += 3) {
      let paved = false;
      for (let i = t; i < t + 3 && !paved; i++)
        paved = !ground(this.positions[i * 3] ?? 0, this.positions[i * 3 + 2] ?? 0);
      if (paved) for (let i = t; i < t + 3; i++) entry.values[i * 4 + 3] = 0;
    }
  }

  /** Decorate a just-appended feature without coupling the draper to its semantic meaning. */
  attributeSince(
    name: string,
    size: number,
    start: number,
    sample: (x: number, z: number) => number[],
  ): void {
    const entry = this.attributes.get(name) ?? { size, values: [] };
    while (entry.values.length < start * size) entry.values.push(0);
    for (let i = start; i < this.vertexCount; i++) {
      const x = this.positions[i * 3],
        z = this.positions[i * 3 + 2];
      if (x === undefined || z === undefined) throw new Error('Missing terrain surface vertex');
      const values = sample(x, z);
      for (let k = 0; k < values.length; k++) entry.values.push(values[k] as number);
    }
    this.attributes.set(name, entry);
  }
  constructor(readonly context: TerrainPyramidTileLayerContext) {}

  /** Height of the rendered ground (the grid draped bands follow) at a tile-local point. */
  groundHeight(x: number, z: number): number {
    const { heightfield, origin, tileSize, surfaceResolution } = this.context;
    this.groundAt ??= renderedGroundSampler(heightfield, origin, tileSize, surfaceResolution);
    return this.groundAt(origin[0] + x, origin[1] + z);
  }

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
    color: THREE.Color | ((x: number, z: number) => THREE.Color),
    elevation: number,
    absolute = false,
  ): void {
    if (!absolute) {
      terrainSurfaceDraper(this.context).polygon(points, (a, b, c) => {
        for (const p of [a, b, c]) {
          this.positions.push(p[0], p[1] + elevation, p[2]);
          this.normals.push(p[3], p[4], p[5]);
          const tint = typeof color === 'function' ? color(p[0], p[2]) : color;
          this.colors.push(tint.r, tint.g, tint.b);
        }
      });
      return;
    }
    const clipped = clipTerrainSurfacePolygon(points, this.context.tileSize);
    for (let i = 1; i + 1 < clipped.length; i++) {
      for (const p of [clipped[0], clipped[i], clipped[i + 1]] as TerrainSemanticPoint[]) {
        this.positions.push(p[0], elevation, p[1]);
        this.normals.push(0, 1, 0);
        const tint = typeof color === 'function' ? color(p[0], p[1]) : color;
        this.colors.push(tint.r, tint.g, tint.b);
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
    for (const [name, entry] of this.attributes) {
      while (entry.values.length < this.vertexCount * entry.size) entry.values.push(0);
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(entry.values, entry.size));
    }
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
  color: THREE.Color | ((x: number, z: number) => THREE.Color),
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

/**
 * A vertical face along `offset` from `from` to `to` on the path, from `top` above the rendered
 * ground down by `height`, facing the side `toward` (+1: increasing offset). Split every few
 * meters, finer than the ground grid it rests on, so its edges follow the draped ground within
 * millimeters; tagged like the band above it, so a curb face carries the curb's slab joints.
 */
function appendRiser(
  builder: TerrainSurfaceMeshBuilder,
  path: TerrainLinePath,
  from: number,
  to: number,
  offset: number,
  face: { top: number; height: number; toward: number; color: THREE.Color },
): void {
  const pieces = Math.max(1, Math.ceil((to - from) / 3));
  for (let i = 0; i < pieces; i++) {
    const d0 = from + ((to - from) * i) / pieces,
      d1 = from + ((to - from) * (i + 1)) / pieces;
    const a = sampleTerrainLine(path, d0, offset),
      b = sampleTerrainLine(path, d1, offset);
    const ya = builder.groundHeight(a.x, a.z) + face.top,
      yb = builder.groundHeight(b.x, b.z) + face.top;
    const quad: [number, number, number][] = [
      [a.x, ya - face.height, a.z],
      [b.x, yb - face.height, b.z],
      [b.x, yb, b.z],
      [a.x, ya, a.z],
    ];
    // Wind it to face `toward`: as listed, its normal is (b - a) x up.
    const side = sampleTerrainLine(path, d0, offset + 1);
    const nx = side.x - a.x,
      nz = side.z - a.z;
    const rightX = -(b.z - a.z),
      rightZ = b.x - a.x;
    if ((rightX * nx + rightZ * nz) * face.toward < 0) quad.reverse();
    builder.face(quad, face.color);
  }
}

/** Distance from the line through `a` and `b`, positive toward the middle of `quad`. */
function insideDistance(
  a: TerrainSemanticPoint,
  b: TerrainSemanticPoint,
  quad: readonly TerrainSemanticPoint[],
): (x: number, z: number) => number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const length = Math.hypot(dx, dz) || 1;
  let cx = 0,
    cz = 0;
  for (const point of quad) {
    cx += point[0] / quad.length;
    cz += point[1] / quad.length;
  }
  const sign = Math.sign((cx - a[0]) * dz - (cz - a[1]) * dx) || 1;
  return (x, z) => (sign * ((x - a[0]) * dz - (z - a[1]) * dx)) / length;
}

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
  // Across runs from the band's edge on the line's negative side (0) to its positive side.
  const offset = band.offset ?? 0;
  const outerEnd = offset > 0;
  const innerSide = outerEnd ? -1 : 1;
  const riser =
    offset !== 0 &&
    band.riser !== undefined &&
    band.riser > 0 &&
    !options.heightAt &&
    band.elevationMode !== 'absolute'
      ? band.riser
      : 0;
  const fray =
    band.fray === undefined
      ? 0
      : band.fray === 'both' || offset === 0
        ? 3
        : (band.fray === 'outer') === outerEnd
          ? 2
          : 1;
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
      const start = builder.vertexCount;
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
      if (riser > 0 && builder.vertexCount > start)
        appendRiser(builder, path, distance, next, offset + innerSide * (band.width / 2), {
          top: band.elevation ?? 0.25,
          height: riser,
          toward: innerSide,
          color,
        });
      if (band.surface !== undefined && builder.vertexCount > start) {
        // Band coordinates from the quad's own corners: across is the share of the way from its
        // negative-side edge to its positive-side edge, along the share from its start rung to
        // its end rung. Both are exact on the quad's sides, which its neighbors share, so the
        // coordinates (and the joints and frayed edges drawn from them) run on through a bend
        // instead of stepping at every quad.
        const [plus0, plus1, minus1, minus0] = points as [
          TerrainSemanticPoint,
          TerrainSemanticPoint,
          TerrainSemanticPoint,
          TerrainSemanticPoint,
        ];
        const fromMinus = insideDistance(minus0, minus1, points),
          fromPlus = insideDistance(plus0, plus1, points),
          fromStart = insideDistance(minus0, plus0, points),
          fromEnd = insideDistance(minus1, plus1, points);
        builder.surfaceSince(
          start,
          band.surface,
          (x, z) => {
            const a = fromMinus(x, z),
              b = fromPlus(x, z),
              s = fromStart(x, z),
              e = fromEnd(x, z);
            return [
              distance + ((next - distance) * s) / Math.max(1e-9, s + e),
              (band.width * a) / Math.max(1e-9, a + b),
            ];
          },
          band.width,
          band.lanes !== undefined && band.lanes > 0 ? band.width / band.lanes : 0,
          fray,
        );
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
