/** Model-owned openings in rendered ground. Heights remain available for anchoring. */
import * as THREE from 'three';

type Point = readonly [number, number];
export type TerrainGroundOutline = readonly Point[];
const owners = new WeakMap<THREE.Object3D, readonly TerrainGroundOutline[]>();
const ceilings = new WeakMap<THREE.Object3D, number>();
const floors = new WeakMap<THREE.Object3D, number>();
const pavementOpenings = new WeakMap<THREE.Object3D, readonly TerrainGroundOutline[]>();
const surfaces = new WeakSet<THREE.Mesh>();
const waterSurfaces = new WeakSet<THREE.Mesh>();
const waterOwners = new WeakSet<THREE.Object3D>();
const shorelineOwners = new WeakSet<THREE.Object3D>();
const shorelineSurfaces = new WeakSet<THREE.Mesh>();
const pavementSurfaces = new WeakSet<THREE.Mesh>();
const preservePavementOwners = new WeakSet<THREE.Object3D>();
const shorelineLevels = new WeakMap<THREE.Object3D, readonly number[]>();
const ownerRefs = new Set<WeakRef<THREE.Object3D>>();
const surfaceRefs = new Set<WeakRef<THREE.Mesh>>();
const cutScopes = new WeakSet<THREE.Object3D>();
const scopedOwners = new WeakSet<THREE.Object3D>();
const outlineCeilings = new WeakMap<THREE.Object3D, readonly number[]>();
interface CutState {
  source: THREE.BufferGeometry;
  rendered: THREE.BufferGeometry;
  key: string;
  /** What the cut was made from (see TerrainGroundCutoutController.update), cheaply compared. */
  depends?: number[];
  /** The source normals' version the rendered copy carries (see copyCutNormals). */
  normals?: number;
  release(): void;
}

const identities = new WeakMap<object, number>();
let nextIdentity = 1;
function identity(value: object): number {
  let id = identities.get(value);
  if (id === undefined) {
    id = nextIdentity++;
    identities.set(value, id);
  }
  return id;
}

/**
 * Openings mapped into a ground mesh's frame are rounded for its cut's key: a floating-origin
 * rebase moves both through world space, and the round trip changed the last digits, so the same
 * cut was made again, tens of milliseconds for each tile near a fast flight's path.
 */
function millimeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const states = new WeakMap<THREE.Mesh, CutState>();

/** Mark ground for model openings. Native shorelines clear elevation/landcover, not paving. */
export function markTerrainGroundSurface(mesh: THREE.Mesh, shoreline = true): void {
  if (!surfaces.has(mesh)) surfaceRefs.add(new WeakRef(mesh));
  surfaces.add(mesh);
  waterSurfaces.delete(mesh);
  pavementSurfaces.delete(mesh);
  if (shoreline) shorelineSurfaces.add(mesh);
  else shorelineSurfaces.delete(mesh);
}

/**
 * Confine native shoreline openings to the ground within this object (a streamed tile): a tile's
 * water then cuts only its own ground and land cover, which it covers exactly. Unscoped, every
 * water triangle cut every overlapping ground mesh, so each level change of a neighboring tile's
 * water re-cut the ground around it: panning over Seattle's lakes and Sound held frames for
 * 70-600 ms, many times a second. Model-owned openings still cut across scopes.
 */
export function markTerrainGroundCutScope(object: THREE.Object3D): void {
  cutScopes.add(object);
}

/** Mark native water that can be replaced by an explicit model-owned water opening. */
export function markTerrainWaterSurface(mesh: THREE.Mesh): void {
  markTerrainGroundSurface(mesh, false);
  waterSurfaces.add(mesh);
}

/** Mark native road/sidewalk surfaces that a terrain-only bridge opening may retain. */
export function markTerrainPavementSurface(mesh: THREE.Mesh): void {
  markTerrainGroundSurface(mesh, false);
  pavementSurfaces.add(mesh);
}

/** A simple model-local X/Z polygon. Only a visible owner opens the ground.
 * `maxHeight` limits removal to ground below this model-local Y, preserving terrain above a bore.
 * `minHeight` retains lower banks and caps removed high ground at that model-local Y.
 * Height-limited owners use translation and rotation about Y (no pitch/roll). */
export function setTerrainGroundCutout(
  object: THREE.Object3D,
  outline: TerrainGroundOutline,
  maxHeight?: number,
  options?: {
    preservePaving?: boolean;
    minHeight?: number;
    pavingOutlines?: readonly TerrainGroundOutline[];
    /**
     * The outlines lie within the owner's cut scope (its tile, see markTerrainGroundCutScope):
     * they cut only that scope's ground, as shorelines do. A city's tunnel bores are thousands
     * of owners; checked against every ground mesh, they made each pass cost 10 ms and more.
     */
    withinScope?: boolean;
    /** A ceiling per outline (model-local Y), in place of `maxHeight` for each. */
    ceilings?: readonly number[];
  },
): void {
  setTerrainGroundCutouts(object, [outline], maxHeight, options);
}

/** Separate model-local openings preserve ground between river channels, stairs and basements.
 * Replaces this owner's previous openings. The optional ceiling applies to every outline. */
export function setTerrainGroundCutouts(
  object: THREE.Object3D,
  outlines: readonly TerrainGroundOutline[],
  maxHeight?: number,
  options?: {
    preservePaving?: boolean;
    minHeight?: number;
    pavingOutlines?: readonly TerrainGroundOutline[];
    /**
     * The outlines lie within the owner's cut scope (its tile, see markTerrainGroundCutScope):
     * they cut only that scope's ground, as shorelines do. A city's tunnel bores are thousands
     * of owners; checked against every ground mesh, they made each pass cost 10 ms and more.
     */
    withinScope?: boolean;
    /** A ceiling per outline (model-local Y), in place of `maxHeight` for each. */
    ceilings?: readonly number[];
  },
): void {
  if (maxHeight !== undefined && !Number.isFinite(maxHeight))
    throw new Error('Ground cutout ceiling must be finite');
  if (options?.minHeight !== undefined && !Number.isFinite(options.minHeight))
    throw new Error('Ground cutout floor must be finite');
  if (options?.minHeight !== undefined && maxHeight !== undefined && options.minHeight > maxHeight)
    throw new Error('Ground cutout floor must not exceed its ceiling');
  if (!outlines.length || outlines.length > 64)
    throw new Error('Ground cutouts require 1–64 outlines');
  const polygons = outlines.map((outline) => {
    const points = outline.map(([x, z]) => [x, z] as Point);
    if (
      points.length > 3 &&
      points[0]?.[0] === points.at(-1)?.[0] &&
      points[0]?.[1] === points.at(-1)?.[1]
    )
      points.pop();
    if (points.length < 3 || points.length > 512 || points.some((p) => !p.every(Number.isFinite)))
      throw new Error('Ground cutout requires 3–512 finite X/Z vertices');
    return points;
  });
  const paving = options?.pavingOutlines?.map((outline) => {
    if (
      outline.length < 3 ||
      outline.length > 512 ||
      outline.some((p) => !p.every(Number.isFinite))
    )
      throw new Error('Paving cutout requires 3–512 finite X/Z vertices');
    return outline.map(([x, z]) => [x, z] as Point);
  });
  if ((paving?.length ?? 0) > 64) throw new Error('Paving cutouts require at most64 outlines');
  if (!owners.has(object)) ownerRefs.add(new WeakRef(object));
  owners.set(object, polygons);
  if (paving?.length) pavementOpenings.set(object, paving);
  else pavementOpenings.delete(object);
  waterOwners.delete(object);
  shorelineOwners.delete(object);
  if (options?.withinScope) scopedOwners.add(object);
  else scopedOwners.delete(object);
  const perOutline = options?.ceilings;
  if (perOutline !== undefined) {
    if (perOutline.length !== outlines.length || !perOutline.every(Number.isFinite))
      throw new Error('Ground cutout ceilings need one finite height per outline');
    outlineCeilings.set(object, [...perOutline]);
  } else outlineCeilings.delete(object);
  if (options?.preservePaving) preservePavementOwners.add(object);
  else preservePavementOwners.delete(object);
  if (options?.minHeight !== undefined) floors.set(object, options.minHeight);
  else floors.delete(object);
  if (maxHeight !== undefined) {
    ceilings.set(object, maxHeight);
  } else ceilings.delete(object);
}

/** Internal: triangles from the rendered native water, already triangulated around islands.
 * Tile residency owns these openings; loading a landmark is not required to expose a lake. */
export function setTerrainShorelineCutouts(
  object: THREE.Object3D,
  outlines: readonly TerrainGroundOutline[],
  levels: readonly number[],
): void {
  if (!outlines.length) return;
  if (!owners.has(object)) ownerRefs.add(new WeakRef(object));
  owners.set(object, outlines);
  pavementOpenings.delete(object);
  ceilings.delete(object);
  floors.delete(object);
  waterOwners.delete(object);
  shorelineOwners.add(object);
  preservePavementOwners.delete(object);
  shorelineLevels.set(object, levels);
}

/** Replace only native water within this visible owner's footprint. Ground remains intact. */
export function setTerrainWaterCutout(object: THREE.Object3D, outline: TerrainGroundOutline): void {
  setTerrainGroundCutout(object, outline);
  waterOwners.add(object);
}

/** Original regular grid, used by terrain height morphs and normal-apron updates. */
export function terrainGroundSourceGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  return states.get(mesh)?.source ?? mesh.geometry;
}

function signedArea(points: readonly Point[]): number {
  return (
    points.reduce((a, p, i) => {
      const q = points[(i + 1) % points.length] as Point;
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2
  );
}
function bounds(points: readonly Point[]): [number, number, number, number] {
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
function overlaps(a: readonly number[], b: readonly number[]): boolean {
  return (
    (a[0] as number) < (b[2] as number) &&
    (a[2] as number) > (b[0] as number) &&
    (a[1] as number) < (b[3] as number) &&
    (a[3] as number) > (b[1] as number)
  );
}
function pieces(outline: TerrainGroundOutline): Point[][] {
  let points = outline.slice();
  if (
    points.length > 3 &&
    points[0]?.[0] === points.at(-1)?.[0] &&
    points[0]?.[1] === points.at(-1)?.[1]
  )
    points.pop();
  if (signedArea(points) < 0) points = points.reverse();
  // Most stadium footprints are convex: retain one cutter instead of a fan of triangles.
  const convex = points.every((p, i) => {
    const q = points[(i + 1) % points.length] as Point,
      r = points[(i + 2) % points.length] as Point;
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) >= -1e-8;
  });
  if (convex) return [points];
  return THREE.ShapeUtils.triangulateShape(
    points.map((p) => new THREE.Vector2(...p)),
    [],
  ).map((t) => t.map((i) => points[i] as Point));
}
/**
 * One side of a cutter: an outline edge from (ax, az) along (ex, ez), positive to its left; or
 * a ceiling (positive below `h`) or floor (positive above it). Made once per cut, not per clipped
 * triangle: closures per triangle and cutter were most of a streaming flight's garbage.
 */
interface ClipPlane {
  kind: 0 | 1 | 2;
  ax: number;
  az: number;
  ex: number;
  ez: number;
  h: number;
}

function planeDistance(plane: ClipPlane, p: readonly number[]): number {
  if (plane.kind === 0)
    return plane.ex * ((p[2] as number) - plane.az) - plane.ez * ((p[0] as number) - plane.ax);
  return plane.kind === 1 ? plane.h - (p[1] as number) : (p[1] as number) - plane.h;
}

/** The part of `polygon` on the plane's positive side (`sign` 1) or negative side (-1). */
function clipByPlane(polygon: number[][], plane: ClipPlane, sign: 1 | -1): number[][] {
  // The same walk and arithmetic as the closure version it replaced, so cuts are unchanged.
  const result: number[][] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i] as number[],
      q = polygon[(i + 1) % n] as number[],
      dp = sign * planeDistance(plane, p),
      dq = sign * planeDistance(plane, q);
    if (dp >= 0) result.push(p);
    if (dp >= 0 !== dq >= 0) {
      const t = dp / (dp - dq);
      const point = new Array<number>(p.length);
      for (let k = 0; k < p.length; k++)
        point[k] = (p[k] as number) + ((q[k] as number) - (p[k] as number)) * t;
      result.push(point);
    }
  }
  return result;
}

/** Subtract exact polygon boundaries, interpolating Y and all vertex attributes at new edges.
 * Handles indexed grids, coarse triangles covering the entire opening, and concave outlines.
 * It never drops a whole grid cell just because one corner lies within an opening. */
export function subtractTerrainGroundGeometry(
  source: THREE.BufferGeometry,
  outlines: readonly TerrainGroundOutline[],
  maxHeights: readonly (number | undefined)[] = [],
  minHeights: readonly (number | undefined)[] = [],
): THREE.BufferGeometry {
  const steps = terrainGroundCutSteps(source, outlines, maxHeights, minHeights);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/** A sliced cut pauses once a slice has run SLICE_MS, checking the clock every SLICE_CHECK work
 * units: a triangle copied whole counts 1, one near an opening 5, and a clipped one CLIP_WORK
 * more for each opening it is clipped against (one under many water triangles can take a
 * millisecond on its own, and a flat count let a harbor's slices run past 10 ms). */
const SLICE_MS = 1;
const SLICE_CHECK = 256;
const CLIP_WORK = 24;

/**
 * subtractTerrainGroundGeometry in slices: it pauses after about SLICE_MS of work and returns the
 * geometry when done. A coarse tile under Puget Sound took 300 ms to cut in one go.
 */
function* terrainGroundCutSteps(
  source: THREE.BufferGeometry,
  outlines: readonly TerrainGroundOutline[],
  maxHeights: readonly (number | undefined)[],
  minHeights: readonly (number | undefined)[],
): Generator<void, THREE.BufferGeometry> {
  let work = 0;
  let slice = performance.now();
  const names = ['position', ...Object.keys(source.attributes).filter((n) => n !== 'position')];
  const attrs = names.map((n) => source.getAttribute(n));
  const cutters = outlines.flatMap((outline, i) =>
    pieces(outline).map((points) => {
      const maxHeight = maxHeights[i];
      const minHeight = minHeights[i];
      const planes: ClipPlane[] = points.map((a, j) => {
        const b = points[(j + 1) % points.length] as Point;
        return { kind: 0, ax: a[0], az: a[1], ex: b[0] - a[0], ez: b[1] - a[1], h: 0 };
      });
      // A bore removes only ground below its ceiling. The hill above it stays intact.
      if (maxHeight !== undefined)
        planes.push({ kind: 1, ax: 0, az: 0, ex: 0, ez: 0, h: maxHeight });
      // Bridges remove only obstructing high ground, retaining lower dry banks.
      if (minHeight !== undefined)
        planes.push({ kind: 2, ax: 0, az: 0, ex: 0, ez: 0, h: minHeight });
      return { points, bounds: bounds(points), maxHeight, minHeight, planes };
    }),
  );
  // A mapped bore has hundreds of short cutters. Index them so a fine DEM triangle
  // only visits nearby segments instead of scanning every opening on the tile.
  const cellSize = 64;
  // Numeric cell keys: tile-local cells are well within ±32768 of the origin.
  const cellKey = (x: number, z: number): number => (x + 32768) * 65536 + (z + 32768);
  const cells = new Map<number, number[]>();
  const broad: number[] = [];
  const cellBounds = (box: readonly number[]): [number, number, number, number] => [
    Math.floor((box[0] as number) / cellSize),
    Math.floor((box[1] as number) / cellSize),
    Math.floor((box[2] as number) / cellSize),
    Math.floor((box[3] as number) / cellSize),
  ];
  if (cutters.length > 16)
    cutters.forEach((cutter, i) => {
      const [x0, z0, x1, z1] = cellBounds(cutter.bounds);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 256) {
        broad.push(i);
        return;
      }
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const key = cellKey(x, z),
            values = cells.get(key) ?? [];
          values.push(i);
          cells.set(key, values);
        }
    });
  const nearbyCutters = (box: readonly number[]): typeof cutters => {
    const [x0, z0, x1, z1] = cellBounds(box);
    if (cutters.length <= 16 || (x1 - x0 + 1) * (z1 - z0 + 1) > 256)
      return cutters.filter((c) => overlaps(box, c.bounds));
    const candidates = new Set(broad);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (const i of cells.get(cellKey(x, z)) ?? []) candidates.add(i);
    return [...candidates]
      .sort((a, b) => a - b)
      .map((i) => cutters[i] as (typeof cutters)[number])
      .filter((c) => overlaps(box, c.bounds));
  };
  // The union of every cutter's bounds, which most of a tile's triangles lie outside.
  const reach = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { bounds: b } of cutters) {
    reach[0] = Math.min(reach[0] as number, b[0]);
    reach[1] = Math.min(reach[1] as number, b[1]);
    reach[2] = Math.max(reach[2] as number, b[2]);
    reach[3] = Math.max(reach[3] as number, b[3]);
  }
  const [reachMinX, reachMinZ, reachMaxX, reachMaxZ] = reach as [number, number, number, number];
  // A city tile's thousands of openings, planed and indexed, are a slice of their own.
  if (performance.now() - slice > SLICE_MS) {
    yield;
    slice = performance.now();
  }
  // Whether any cutter's bounds overlap a box: nearbyCutters without building the list. Most of a
  // tile's triangles lie away from every opening and take the plain copy below.
  const touchesCutter = (minX: number, minZ: number, maxX: number, maxZ: number): boolean => {
    if (minX >= reachMaxX || maxX <= reachMinX || minZ >= reachMaxZ || maxZ <= reachMinZ)
      return false;
    const hits = (i: number): boolean => {
      const b = (cutters[i] as (typeof cutters)[number]).bounds;
      return minX < b[2] && maxX > b[0] && minZ < b[3] && maxZ > b[1];
    };
    const x0 = Math.floor(minX / cellSize),
      z0 = Math.floor(minZ / cellSize),
      x1 = Math.floor(maxX / cellSize),
      z1 = Math.floor(maxZ / cellSize);
    if (cutters.length <= 16 || (x1 - x0 + 1) * (z1 - z0 + 1) > 256) {
      for (let i = 0; i < cutters.length; i++) if (hits(i)) return true;
      return false;
    }
    for (const i of broad) if (hits(i)) return true;
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (const i of cells.get(cellKey(x, z)) ?? []) if (hits(i)) return true;
    return false;
  };
  const index = source.index;
  const count = index?.count ?? source.getAttribute('position').count;
  const groups = source.groups.length ? source.groups : [{ start: 0, count, materialIndex: 0 }];
  const result = new THREE.BufferGeometry();
  // Indexed output over a copy of every source vertex: triangles away from all openings keep their
  // own indices, and only clipped pieces add vertices. A tile with one small opening is then a
  // bulk copy and an index pass; de-indexing every triangle took tens of milliseconds a tile.
  // Clipped pieces' vertices gather apart, and each attribute is allocated once at its final size:
  // growing and trimming whole copies of a tile's attributes was most of a flight's garbage.
  const sizes = attrs.map((a) => a.itemSize);
  const sourceVertices = (attrs[0] as THREE.BufferAttribute).count;
  let capacity = 256;
  let added = attrs.map((_, k) => new Float32Array(capacity * (sizes[k] as number)));
  let written = sourceVertices;
  // Room for every source triangle and a few hundred clipped pieces, so most cuts never grow it.
  let indices = new Uint32Array(Math.max(3, count + 768));
  let indexed = 0;
  const pushIndex = (value: number): void => {
    if (indexed === indices.length) {
      const grown = new Uint32Array(indices.length * 2);
      grown.set(indices);
      indices = grown;
    }
    indices[indexed++] = value;
  };
  const writeVertex = (values: readonly number[]): void => {
    const slot = written - sourceVertices;
    if (slot === capacity) {
      capacity *= 2;
      added = added.map((output, k) => {
        const grown = new Float32Array(capacity * (sizes[k] as number));
        grown.set(output);
        return grown;
      });
    }
    let offset = 0;
    for (let k = 0; k < attrs.length; k++) {
      const size = sizes[k] as number;
      const output = added[k] as Float32Array;
      for (let j = 0; j < size; j++) output[slot * size + j] = values[offset + j] as number;
      offset += size;
    }
    pushIndex(written++);
  };
  // Each source vertex's sides outside the union of the openings' bounds (left, right, near, far),
  // as touchesCutter tests them: a triangle whose corners share a side misses every opening.
  const sides = new Uint8Array(sourceVertices);
  {
    const position = attrs[0] as THREE.BufferAttribute;
    for (let v = 0; v < sourceVertices; v++) {
      const x = position.getX(v),
        z = position.getZ(v);
      sides[v] =
        (x <= reachMinX ? 1 : 0) |
        (x >= reachMaxX ? 2 : 0) |
        (z <= reachMinZ ? 4 : 0) |
        (z >= reachMaxZ ? 8 : 0);
    }
  }
  // Whether a convex opening misses a triangle: all three corners strictly outside one of its
  // edges, or strictly above its ceiling. Bounds alone let a long diagonal canal send a fifth of
  // a tile through clipping that only copied each triangle back out, as new vertices.
  const misses = (
    cutter: (typeof cutters)[number],
    corners: readonly (readonly [number, number, number])[],
  ): boolean => {
    const ceiling = cutter.maxHeight;
    if (ceiling !== undefined && corners.every((c) => c[1] > ceiling)) return true;
    const floor = cutter.minHeight;
    if (floor !== undefined && corners.every((c) => c[1] < floor)) return true;
    const points = cutter.points;
    for (let j = 0; j < points.length; j++) {
      const a = points[j] as Point,
        b = points[(j + 1) % points.length] as Point;
      const ex = b[0] - a[0],
        ez = b[1] - a[1];
      if (corners.every((c) => ex * (c[2] - a[1]) - ez * (c[0] - a[0]) < 0)) return true;
    }
    return false;
  };
  for (const group of groups) {
    const start = indexed;
    const end = Math.min(
      count,
      group.start + group.count,
      source.drawRange.start + source.drawRange.count,
    );
    const position = attrs[0] as THREE.BufferAttribute;
    // Read plain float positions and the index straight from their arrays: the accessors cost a
    // tile with a single opening most of its cut.
    const xyz =
      position instanceof THREE.BufferAttribute &&
      !position.normalized &&
      position.array instanceof Float32Array
        ? position.array
        : undefined;
    const stride = position.itemSize;
    const order = index?.array;
    for (let i = Math.max(group.start, source.drawRange.start); i + 2 < end; i += 3) {
      if (++work >= SLICE_CHECK) {
        work = 0;
        if (performance.now() - slice > SLICE_MS) {
          yield;
          slice = performance.now();
        }
      }
      const v0 = order ? (order[i] as number) : i,
        v1 = order ? (order[i + 1] as number) : i + 1,
        v2 = order ? (order[i + 2] as number) : i + 2;
      // All three corners on one outer side of every opening: the plain copy, from one byte each.
      if (((sides[v0] as number) & (sides[v1] as number) & (sides[v2] as number)) !== 0) {
        pushIndex(v0);
        pushIndex(v1);
        pushIndex(v2);
        continue;
      }
      const ax = xyz ? (xyz[v0 * stride] as number) : position.getX(v0),
        bx = xyz ? (xyz[v1 * stride] as number) : position.getX(v1),
        cx = xyz ? (xyz[v2 * stride] as number) : position.getX(v2),
        az = xyz ? (xyz[v0 * stride + 2] as number) : position.getZ(v0),
        bz = xyz ? (xyz[v1 * stride + 2] as number) : position.getZ(v1),
        cz = xyz ? (xyz[v2 * stride + 2] as number) : position.getZ(v2);
      if (
        !touchesCutter(
          Math.min(ax, bx, cx),
          Math.min(az, bz, cz),
          Math.max(ax, bx, cx),
          Math.max(az, bz, cz),
        )
      ) {
        pushIndex(v0);
        pushIndex(v1);
        pushIndex(v2);
        continue;
      }
      work += 4;
      const vertices = [v0, v1, v2];
      const triangleBounds = bounds(vertices.map((v) => [position.getX(v), position.getZ(v)]));
      const nearby = nearbyCutters(triangleBounds);
      work += nearby.length;
      const corners = vertices.map(
        (v) => [position.getX(v), position.getY(v), position.getZ(v)] as const,
      );
      if (nearby.every((cutter) => misses(cutter, corners))) {
        pushIndex(v0);
        pushIndex(v1);
        pushIndex(v2);
        continue;
      }
      work += CLIP_WORK * nearby.length;
      let polygons = [
        vertices.map((v) => {
          const values: number[] = [];
          for (const a of attrs)
            for (let j = 0; j < a.itemSize; j++) values.push(a.getComponent(v, j));
          return values;
        }),
      ];
      for (const cutter of nearby) {
        const next: number[][][] = [];
        for (const polygon of polygons) {
          let minX = Infinity,
            minZ = Infinity,
            maxX = -Infinity,
            maxZ = -Infinity;
          for (const p of polygon) {
            minX = Math.min(minX, p[0] as number);
            maxX = Math.max(maxX, p[0] as number);
            minZ = Math.min(minZ, p[2] as number);
            maxZ = Math.max(maxZ, p[2] as number);
          }
          if (!overlaps([minX, minZ, maxX, maxZ], cutter.bounds)) {
            next.push(polygon);
            continue;
          }
          const outside = next;
          let remainder = polygon;
          for (const plane of cutter.planes) {
            if (remainder.length < 3) break;
            const fragment = clipByPlane(remainder, plane, -1);
            if (fragment.length >= 3) outside.push(fragment);
            remainder = clipByPlane(remainder, plane, 1);
          }
          if (cutter.minHeight !== undefined && remainder.length >= 3) {
            const floor = cutter.minHeight;
            const normalIndex = names.indexOf('normal');
            const normalOffset = attrs.slice(0, normalIndex).reduce((n, a) => n + a.itemSize, 0);
            outside.push(
              remainder.map((p) => {
                const cap = p.slice();
                cap[1] = floor;
                if (normalIndex >= 0) cap.splice(normalOffset, 3, 0, 1, 0);
                return cap;
              }),
            );
          }
        }
        polygons = next;
        if (!polygons.length) break;
      }
      for (const polygon of polygons)
        for (let j = 1; j + 1 < polygon.length; j++) {
          const a = polygon[0] as number[],
            b = polygon[j] as number[],
            c = polygon[j + 1] as number[];
          // Skip slivers: |(b - a) x (c - a)|^2, without vectors.
          const ux = (b[0] as number) - (a[0] as number),
            uy = (b[1] as number) - (a[1] as number),
            uz = (b[2] as number) - (a[2] as number),
            vx = (c[0] as number) - (a[0] as number),
            vy = (c[1] as number) - (a[1] as number),
            vz = (c[2] as number) - (a[2] as number);
          const cx = uy * vz - uz * vy,
            cy = uz * vx - ux * vz,
            cz = ux * vy - uy * vx;
          if (cx * cx + cy * cy + cz * cz < 1e-18) continue;
          writeVertex(a);
          writeVertex(b);
          writeVertex(c);
        }
    }
    const emitted = indexed - start;
    if (emitted) result.addGroup(start, emitted, group.materialIndex);
  }
  // Copying a large tile's attributes out is a slice of its own.
  if (performance.now() - slice > SLICE_MS) yield;
  names.forEach((name, k) => {
    const size = sizes[k] as number;
    const attribute = attrs[k] as THREE.BufferAttribute;
    const output = new Float32Array(written * size);
    const plain =
      attribute instanceof THREE.BufferAttribute &&
      !attribute.normalized &&
      attribute.array instanceof Float32Array
        ? attribute.array
        : undefined;
    if (plain !== undefined) output.set(plain.subarray(0, sourceVertices * size));
    else
      for (let v = 0; v < sourceVertices; v++)
        for (let j = 0; j < size; j++) output[v * size + j] = attribute.getComponent(v, j);
    output.set(
      (added[k] as Float32Array).subarray(0, (written - sourceVertices) * size),
      sourceVertices * size,
    );
    result.setAttribute(name, new THREE.BufferAttribute(output, size));
  });
  // A view of the room left over, not a trimmed copy: openings remove only a few triangles.
  result.setIndex(
    new THREE.BufferAttribute(
      written <= 65_536
        ? Uint16Array.from(indices.subarray(0, indexed))
        : indices.subarray(0, indexed),
      1,
    ),
  );
  // Only vertices made on clipped edges carry interpolated normals; copied ones keep theirs.
  const normal = result.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (normal !== undefined && normal.itemSize === 3) {
    const n = normal.array as Float32Array;
    for (let i = sourceVertices * 3; i < written * 3; i += 3) {
      const length = Math.hypot(n[i] as number, n[i + 1] as number, n[i + 2] as number);
      if (length > 0) {
        n[i] = (n[i] as number) / length;
        n[i + 1] = (n[i + 1] as number) / length;
        n[i + 2] = (n[i + 2] as number) / length;
      }
    }
  }
  // A cut only removes ground, so the source's bounds still bound it: measuring every vertex
  // again cost a High-detail flight more than the cut itself.
  if (!source.boundingBox) source.computeBoundingBox();
  if (!source.boundingSphere) source.computeBoundingSphere();
  result.boundingBox = (source.boundingBox as THREE.Box3).clone();
  result.boundingSphere = (source.boundingSphere as THREE.Sphere).clone();
  // A bridge floor can add a cap below the original grid, extending its bounds downward.
  for (const floor of minHeights) {
    if (floor !== undefined && floor < result.boundingBox.min.y) {
      result.boundingBox.min.y = floor;
      result.boundingBox.getBoundingSphere(result.boundingSphere);
    }
  }
  return result;
}

interface Cutter {
  points: THREE.Vector3[];
  bounds: [number, number, number, number];
  maxHeight?: number;
  minHeight?: number;
  water: boolean;
  owner: THREE.Object3D;
  outline: object;
  ceiling: number;
  shoreline: boolean;
  preservePaving: boolean;
  pavingOnly: boolean;
  minimumHeight?: number;
}

/**
 * An owner's openings in world space, kept while what they are made from stays the same: its
 * placement, the registered outline lists (replaced, never mutated) and its options.
 */
interface OwnerCutters {
  matrix: Float64Array;
  openings: object | undefined;
  paving: object | undefined;
  ceiling: number | undefined;
  floor: number | undefined;
  levels: object | undefined;
  ceilingList: object | undefined;
  flags: number;
  cutters: Cutter[];
  /** The union of the cutters' bounds, in the root's frame. */
  bounds: [number, number, number, number];
}

function unionBounds(cutters: readonly Cutter[]): [number, number, number, number] {
  const all: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { bounds: b } of cutters) {
    all[0] = Math.min(all[0], b[0]);
    all[1] = Math.min(all[1], b[1]);
    all[2] = Math.max(all[2], b[2]);
    all[3] = Math.max(all[3], b[3]);
  }
  return all;
}
const ownerCutters = new WeakMap<THREE.Object3D, OwnerCutters>();

/**
 * An object's placement in `root`'s frame: the product of the local matrices between them.
 * Hosts move the world under a moving camera (a floating origin) every frame, and world matrices
 * moved with it: each pass of a flight rebuilt every opening and re-checked every cut. Cuts depend
 * only on placements relative to one another, which the world's motion leaves alone.
 */
function placementIn(
  root: THREE.Object3D,
  object: THREE.Object3D,
  target: THREE.Matrix4,
  parents: Map<THREE.Object3D, THREE.Matrix4>,
): THREE.Matrix4 {
  // Local matrices only: refreshing whole world-matrix chains for every opening and ground mesh
  // was a millisecond and more of each pass. Parents' placements are shared within a pass (a
  // tunnel's segments, a tile's meshes).
  if (object.matrixAutoUpdate) object.updateMatrix();
  target.copy(object.matrix);
  const parent = object.parent;
  if (parent && parent !== root) {
    let above = parents.get(parent);
    if (above === undefined) {
      above = placementIn(root, parent, new THREE.Matrix4(), parents);
      parents.set(parent, above);
    }
    target.premultiply(above);
  }
  return target;
}

function ownerFlags(object: THREE.Object3D): number {
  return (
    (waterOwners.has(object) ? 1 : 0) |
    (shorelineOwners.has(object) ? 2 : 0) |
    (preservePavementOwners.has(object) ? 4 : 0)
  );
}

/** Compared in place: a stamp array per owner per pass was much of a Sydney pass's time. */
function ownerCurrent(
  cached: OwnerCutters,
  object: THREE.Object3D,
  placement: THREE.Matrix4,
): boolean {
  const elements = placement.elements;
  for (let i = 0; i < 16; i++) if (cached.matrix[i] !== elements[i]) return false;
  return (
    cached.openings === owners.get(object) &&
    cached.paving === pavementOpenings.get(object) &&
    cached.ceiling === ceilings.get(object) &&
    cached.floor === floors.get(object) &&
    cached.levels === shorelineLevels.get(object) &&
    cached.ceilingList === outlineCeilings.get(object) &&
    cached.flags === ownerFlags(object)
  );
}

function buildOwnerCutters(object: THREE.Object3D, placement: THREE.Matrix4): Cutter[] {
  const floor = floors.get(object);
  const perOutline = outlineCeilings.get(object);
  const openings = [
    ...(owners.get(object) ?? []).map((outline) => ({ outline, pavingOnly: false })),
    ...(pavementOpenings.get(object) ?? []).map((outline) => ({ outline, pavingOnly: true })),
  ];
  return openings.map(({ outline, pavingOnly }, index) => {
    const points = outline.map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(placement));
    const ceiling = (pavingOnly ? undefined : perOutline?.[index]) ?? ceilings.get(object);
    return {
      points,
      owner: object,
      outline,
      ceiling: ceiling ?? Number.NEGATIVE_INFINITY,
      water: waterOwners.has(object),
      shoreline: shorelineOwners.has(object),
      preservePaving: preservePavementOwners.has(object),
      pavingOnly,
      ...(shorelineOwners.has(object)
        ? {
            minimumHeight: new THREE.Vector3(
              0,
              shorelineLevels.get(object)?.[index] ?? 0,
              0,
            ).applyMatrix4(placement).y,
          }
        : {}),
      bounds: bounds(points.map((p) => [p.x, p.z])),
      ...(ceiling !== undefined
        ? { maxHeight: new THREE.Vector3(0, ceiling, 0).applyMatrix4(placement).y }
        : {}),
      ...(floor !== undefined
        ? { minHeight: new THREE.Vector3(0, floor, 0).applyMatrix4(placement).y }
        : {}),
    };
  });
}

function attributeVersion(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number {
  return attribute instanceof THREE.InterleavedBufferAttribute
    ? attribute.data.version
    : attribute.version;
}

/**
 * Versions a cut is made from: every attribute but the normals. Neighbors loading refresh a
 * tile's border normals, and re-cutting for that held frames; the rendered copy takes the new
 * normals instead (see copyCutNormals).
 */
function cutVersions(source: THREE.BufferGeometry): number[] {
  const versions: number[] = [];
  for (const [name, attribute] of Object.entries(source.attributes))
    if (name !== 'normal') versions.push(attributeVersion(attribute));
  return versions;
}

/** Copy the source's normals onto the cut's copies of its vertices, which come first. */
function copyCutNormals(state: CutState): void {
  const from = state.source.getAttribute('normal');
  const to = state.rendered.getAttribute('normal');
  if (from === undefined || to === undefined || to.itemSize !== 3) return;
  const version = attributeVersion(from);
  if (state.normals === version) return;
  state.normals = version;
  const target = to.array as Float32Array;
  const count = Math.min(from.count, to.count);
  if (
    from instanceof THREE.BufferAttribute &&
    from.array instanceof Float32Array &&
    !from.normalized
  )
    target.set(from.array.subarray(0, count * 3));
  else
    for (let v = 0; v < count; v++) {
      target[v * 3] = from.getX(v);
      target[v * 3 + 1] = from.getY(v);
      target[v * 3 + 2] = from.getZ(v);
    }
  (to as THREE.BufferAttribute).needsUpdate = true;
}

/** A cut in progress, advanced a slice at a time (see terrainGroundCutSteps). */
interface CutJob {
  /** The mesh's pass inputs when the job last checked its openings (see `settled`). */
  inputs: number[];
  key: string;
  depends: number[];
  source: THREE.BufferGeometry;
  steps: Generator<void, THREE.BufferGeometry>;
}

/** Coordinates cutouts across tile and LOD boundaries. No material or source grid is mutated. */
export class TerrainGroundCutoutController {
  private readonly active = new Map<THREE.Mesh, CutState>();
  private readonly jobs = new Map<THREE.Mesh, CutJob>();
  /**
   * Each ground mesh's last settled pass: what it was made from (placement, geometry, which
   * owners' openings could reach it) and whether it was cut. Unchanged, the mesh is skipped:
   * filtering a harbor's thousands of shoreline openings for every mesh in every pass, while
   * one sliced cut was pending, cost Sydney's frames 10-20 ms.
   */
  private readonly settled = new WeakMap<THREE.Mesh, { inputs: number[]; cut: boolean }>();
  private readonly changed = new Set<THREE.Mesh>();
  /** Meshes whose rendered geometry the last `update` replaced or restored. */
  get changedMeshes(): ReadonlySet<THREE.Mesh> {
    return this.changed;
  }
  /** Whether the last `update` left cuts for a later one, its time budget spent. */
  get pending(): boolean {
    return this.deferred;
  }
  private deferred = false;
  /**
   * Bring every visible ground mesh's cut up to date. With `budgetMs`, cutting stops once that
   * much time has passed: a cut in progress resumes in the next update, its ground keeping the
   * current state (or staying uncut a moment longer) until it is done, and `pending` asks for
   * that update. Each update advances at least one cut a slice. Several tiles arriving together
   * each needed their own cut, and made in one pass they held a frame for 20-40 ms; a coarse
   * tile under open water took 300 ms on its own.
   */
  update(root: THREE.Object3D, budgetMs: number = Number.POSITIVE_INFINITY): boolean {
    this.changed.clear();
    this.deferred = false;
    let started = performance.now();
    let stepped = false;
    // Weak registries avoid walking every building in regions with no ground openings.
    const visibleWithin = (object: THREE.Object3D): boolean => {
      for (let cursor: THREE.Object3D | null = object; cursor; cursor = cursor.parent) {
        if (!cursor.visible) return false;
        if (cursor === root) return true;
      }
      return false;
    };
    const scopeOf = (object: THREE.Object3D): THREE.Object3D | undefined => {
      for (let cursor: THREE.Object3D | null = object; cursor; cursor = cursor.parent) {
        if (cutScopes.has(cursor)) return cursor;
        if (cursor === root) return undefined;
      }
      return undefined;
    };
    let cutterCount = 0;
    // Shoreline openings within a cut scope reach only that scope's ground (see
    // markTerrainGroundCutScope); every other opening may reach any ground mesh.
    const unscoped: Cutter[] = [];
    const scoped = new Map<THREE.Object3D, Cutter[]>();
    // The owners each scope (undefined: unscoped) brings, as identities of their cutter sets.
    const reachers = new Map<THREE.Object3D | undefined, number[]>();
    // Unscoped owners (landmarks, bores) with their bounds: a ground mesh's memo names only
    // those that reach it, so a landmark toggling as the view turns leaves the rest settled.
    const unscopedOwners: { id: number; bounds: [number, number, number, number] }[] = [];
    const ownerPlacement = new THREE.Matrix4();
    const parentPlacements = new Map<THREE.Object3D, THREE.Matrix4>();
    for (const ref of ownerRefs) {
      const object = ref.deref();
      if (!object) {
        ownerRefs.delete(ref);
        continue;
      }
      if (!visibleWithin(object)) continue;
      // A water mesh's hundreds of triangles were placed into world space again on every pass.
      const placement = placementIn(root, object, ownerPlacement, parentPlacements);
      let cached = ownerCutters.get(object);
      if (cached === undefined || !ownerCurrent(cached, object, placement)) {
        cached = {
          matrix: Float64Array.from(placement.elements),
          openings: owners.get(object),
          paving: pavementOpenings.get(object),
          ceiling: ceilings.get(object),
          floor: floors.get(object),
          levels: shorelineLevels.get(object),
          ceilingList: outlineCeilings.get(object),
          flags: ownerFlags(object),
          cutters: [],
          bounds: [Infinity, Infinity, -Infinity, -Infinity],
        };
        cached.cutters = buildOwnerCutters(object, placement);
        cached.bounds = unionBounds(cached.cutters);
        ownerCutters.set(object, cached);
      }
      const scope =
        shorelineOwners.has(object) || scopedOwners.has(object) ? scopeOf(object) : undefined;
      let list = unscoped;
      if (scope !== undefined) {
        list = scoped.get(scope) ?? [];
        scoped.set(scope, list);
      }
      for (const cutter of cached.cutters) list.push(cutter);
      if (scope === undefined) unscopedOwners.push({ id: identity(cached), bounds: cached.bounds });
      else {
        const ids = reachers.get(scope) ?? [];
        ids.push(identity(cached));
        reachers.set(scope, ids);
      }
      cutterCount += cached.cutters.length;
    }
    if (!cutterCount && !this.active.size && !this.jobs.size) return false;
    const targets: THREE.Mesh[] = [];
    if (cutterCount)
      for (const ref of surfaceRefs) {
        const mesh = ref.deref();
        if (!mesh) {
          surfaceRefs.delete(ref);
          continue;
        }
        // Ground a covering layer hides (render layers off) is cut once it shows again.
        if (mesh.layers.mask !== 0 && visibleWithin(mesh)) targets.push(mesh);
      }
    // The budget is for cutting: the pass's fixed work (gathering openings) does not spend it.
    started = performance.now();
    const seen = new Set<THREE.Mesh>();
    let changed = false;

    for (const mesh of targets) {
      const source = terrainGroundSourceGeometry(mesh);
      const placement = placementIn(root, mesh, new THREE.Matrix4(), parentPlacements);
      const scope = scopeOf(mesh);
      const versions = cutVersions(source);
      if (!source.boundingBox) source.computeBoundingBox();
      // Bounds in the root's frame, like the openings' (see placementIn).
      const worldBox = source.boundingBox?.clone().applyMatrix4(placement);
      const near = worldBox
        ? [worldBox.min.x, worldBox.min.z, worldBox.max.x, worldBox.max.z]
        : [-Infinity, -Infinity, Infinity, Infinity];
      const inputs: number[] = [
        ...placement.elements,
        identity(source),
        ...versions,
        (waterSurfaces.has(mesh) ? 1 : 0) |
          (pavementSurfaces.has(mesh) ? 2 : 0) |
          (shorelineSurfaces.has(mesh) ? 4 : 0),
        -1,
        ...unscopedOwners.filter((owner) => overlaps(near, owner.bounds)).map((owner) => owner.id),
        -2,
        ...(scope === undefined ? [] : (reachers.get(scope) ?? [])),
      ];
      const memo = this.settled.get(mesh);
      if (memo !== undefined && sameNumbers(memo.inputs, inputs)) {
        if (!memo.cut) continue;
        const standing = this.active.get(mesh);
        if (standing !== undefined) {
          seen.add(mesh);
          copyCutNormals(standing);
          continue;
        }
      }
      this.settled.delete(mesh);
      const settle = (cut: boolean): void => {
        this.settled.set(mesh, { inputs, cut });
      };
      const spent = (): boolean => stepped && performance.now() - started > budgetMs;
      let job = this.jobs.get(mesh);
      // A cut in progress from unchanged inputs resumes at once: refiltering a harbor's openings
      // for every pending cut, every pass, was most of a flight's cutout time.
      const quick = job !== undefined && job.source === source && sameNumbers(job.inputs, inputs);
      if (!quick && spent()) {
        // Out of time before the openings' filter: decided in a later pass, current cut kept.
        seen.add(mesh);
        this.deferred = true;
        continue;
      }
      if (!quick) {
        const inverse = placement.clone().invert();
        const reachable =
          scope === undefined ? unscoped : [...unscoped, ...(scoped.get(scope) ?? [])];
        const nearby = reachable.filter(
          (c) =>
            c.water === waterSurfaces.has(mesh) &&
            (!c.pavingOnly || pavementSurfaces.has(mesh)) &&
            !(c.preservePaving && !c.pavingOnly && pavementSurfaces.has(mesh)) &&
            (!c.shoreline || shorelineSurfaces.has(mesh)) &&
            worldBox &&
            (c.minHeight === undefined || worldBox.max.y > c.minHeight) &&
            (c.minimumHeight === undefined || worldBox.max.y > c.minimumHeight) &&
            overlaps([worldBox.min.x, worldBox.min.z, worldBox.max.x, worldBox.max.z], c.bounds),
        );
        if (!nearby.length) {
          settle(false);
          continue;
        }
        // The exact key below transforms every opening's outline into the mesh's frame and
        // serializes it, for every ground mesh in each visibility pass. When nothing it is made
        // from changed (the mesh's placement and geometry, which openings and their placements),
        // the cut stands; at High detail the keys alone cost more than the cuts.
        const depends: number[] = [...placement.elements, identity(source), ...versions];
        // A water mesh brings hundreds of triangles from one owner: its placement once per run.
        let previous: THREE.Object3D | undefined;
        for (const c of nearby) {
          depends.push(
            identity(c.outline),
            c.ceiling,
            c.minHeight ?? Number.NEGATIVE_INFINITY,
            c.minimumHeight ?? Number.NEGATIVE_INFINITY,
          );
          if (c.owner !== previous)
            depends.push(identity(c.owner), ...(ownerCutters.get(c.owner)?.matrix ?? []));
          previous = c.owner;
        }
        const current = this.active.get(mesh);
        if (current?.depends !== undefined && sameNumbers(current.depends, depends)) {
          seen.add(mesh);
          copyCutNormals(current);
          settle(true);
          continue;
        }
        // A cut in progress from the same openings resumes without rebuilding its key, a long string.
        const resuming =
          job !== undefined && job.source === source && sameNumbers(job.depends, depends);
        if (!resuming && spent()) {
          // Out of time: whether this ground needs a new cut is decided in a later pass.
          seen.add(mesh);
          this.deferred = true;
          continue;
        }
        if (!resuming || job === undefined) {
          const outlines = nearby.flatMap((c) => {
            if (
              !worldBox ||
              !overlaps([worldBox.min.x, worldBox.min.z, worldBox.max.x, worldBox.max.z], c.bounds)
            )
              return [];
            return [
              c.points.map((point) => {
                const p = point.clone().applyMatrix4(inverse);
                return [p.x, p.z] as Point;
              }),
            ];
          });
          const maxHeights = nearby.map((c) =>
            c.maxHeight === undefined
              ? undefined
              : new THREE.Vector3(0, c.maxHeight, 0).applyMatrix4(inverse).y,
          );
          const minHeights = nearby.map((c) =>
            c.minHeight === undefined
              ? undefined
              : new THREE.Vector3(0, c.minHeight, 0).applyMatrix4(inverse).y,
          );
          if (!outlines.length) {
            settle(false);
            continue;
          }
          seen.add(mesh);
          const key = JSON.stringify([
            outlines.map((outline) => outline.map(([x, z]) => [millimeters(x), millimeters(z)])),
            maxHeights.map((height) => (height === undefined ? undefined : millimeters(height))),
            minHeights.map((height) => (height === undefined ? undefined : millimeters(height))),
            versions,
          ]);
          if (current?.key === key) {
            current.depends = depends;
            copyCutNormals(current);
            settle(true);
            continue;
          }
          if (job === undefined || job.key !== key || job.source !== source) {
            job = {
              inputs,
              key,
              depends,
              source,
              steps: terrainGroundCutSteps(source, outlines, maxHeights, minHeights),
            };
            this.jobs.set(mesh, job);
          } else job.depends = depends;
        }
        job.inputs = inputs;
      }
      if (job === undefined) continue;
      seen.add(mesh);
      let rendered: THREE.BufferGeometry | undefined;
      // Every cut works in slices, the first in a pass too; at least one slice per update.
      while (!spent()) {
        stepped = true;
        const step = job.steps.next();
        if (step.done) {
          rendered = step.value;
          break;
        }
      }
      if (rendered === undefined) {
        this.deferred = true;
        continue;
      }
      this.jobs.delete(mesh);
      this.active.get(mesh)?.release();
      const cut = rendered;
      let released = false;
      const release = (disposeRendered = true) => {
        if (released) return;
        released = true;
        cut.removeEventListener('dispose', onDispose);
        mesh.geometry = source;
        states.delete(mesh);
        this.active.delete(mesh);
        if (disposeRendered) cut.dispose();
      };
      // If an adapter disposes a derived mesh first, its retained source must also leave memory.
      const onDispose = () => {
        release(false);
        source.dispose();
      };
      const state: CutState = {
        source,
        rendered: cut,
        key: job.key,
        depends: job.depends,
        release,
      };
      // The source's normals may have been refreshed while the cut was in progress.
      copyCutNormals(state);
      cut.addEventListener('dispose', onDispose);
      states.set(mesh, state);
      this.active.set(mesh, state);
      mesh.geometry = cut;
      this.changed.add(mesh);
      changed = true;
      settle(true);
    }
    const shown = new Set(targets);
    // A cut whose ground left the view (or the scene) is dropped; it starts over if needed.
    for (const mesh of [...this.jobs.keys()]) if (!seen.has(mesh)) this.jobs.delete(mesh);
    const attached = (object: THREE.Object3D): boolean => {
      for (let cursor: THREE.Object3D | null = object; cursor; cursor = cursor.parent)
        if (cursor === root) return true;
      return false;
    };
    for (const [mesh, state] of this.active)
      if (!seen.has(mesh)) {
        // Hidden ground keeps its cut while openings remain: tiles hide and show again as the
        // camera's cut changes, and cutting each one again when it came back stalled a fast
        // flight for tens of milliseconds at a time. Shown again, it is checked like the rest.
        if (cutterCount > 0 && !shown.has(mesh) && attached(mesh)) continue;
        state.release();
        this.changed.add(mesh);
        changed = true;
      }
    return changed;
  }
  /** Restore original grids before normal tile disposal. */
  restore(root: THREE.Object3D): void {
    root.traverse((object) => {
      this.jobs.delete(object as THREE.Mesh);
      this.active.get(object as THREE.Mesh)?.release();
    });
  }
  dispose(): void {
    this.jobs.clear();
    for (const state of this.active.values()) state.release();
  }
}
