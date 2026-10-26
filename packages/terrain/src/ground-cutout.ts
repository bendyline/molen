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
interface CutState {
  source: THREE.BufferGeometry;
  rendered: THREE.BufferGeometry;
  key: string;
  /** What the cut was made from (see TerrainGroundCutoutController.update), cheaply compared. */
  depends?: number[];
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
function clipByDistance(polygon: number[][], distance: (p: number[]) => number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i] as number[],
      q = polygon[(i + 1) % polygon.length] as number[],
      dp = distance(p),
      dq = distance(q);
    if (dp >= 0) result.push(p);
    if (dp >= 0 !== dq >= 0) {
      const t = dp / (dp - dq);
      result.push(p.map((v, k) => v + ((q[k] as number) - v) * t));
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
  const names = ['position', ...Object.keys(source.attributes).filter((n) => n !== 'position')];
  const attrs = names.map((n) => source.getAttribute(n));
  const cutters = outlines.flatMap((outline, i) =>
    pieces(outline).map((points) => ({
      points,
      bounds: bounds(points),
      maxHeight: maxHeights[i],
      minHeight: minHeights[i],
    })),
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
  const sizes = attrs.map((a) => a.itemSize);
  const sourceVertices = (attrs[0] as THREE.BufferAttribute).count;
  let capacity = sourceVertices + 64;
  let outputs = attrs.map((attribute, k) => {
    const size = sizes[k] as number;
    const output = new Float32Array(capacity * size);
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
    return output;
  });
  let written = sourceVertices;
  let indices = new Uint32Array(Math.max(3, count));
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
    if (written === capacity) {
      capacity *= 2;
      outputs = outputs.map((output, k) => {
        const grown = new Float32Array(capacity * (sizes[k] as number));
        grown.set(output);
        return grown;
      });
    }
    let offset = 0;
    for (let k = 0; k < attrs.length; k++) {
      const size = sizes[k] as number;
      const output = outputs[k] as Float32Array;
      for (let j = 0; j < size; j++) output[written * size + j] = values[offset + j] as number;
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
      const vertices = [v0, v1, v2];
      const triangleBounds = bounds(vertices.map((v) => [position.getX(v), position.getZ(v)]));
      const nearby = nearbyCutters(triangleBounds);
      const corners = vertices.map(
        (v) => [position.getX(v), position.getY(v), position.getZ(v)] as const,
      );
      if (nearby.every((cutter) => misses(cutter, corners))) {
        pushIndex(v0);
        pushIndex(v1);
        pushIndex(v2);
        continue;
      }
      let polygons = [
        vertices.map((v) => {
          const values: number[] = [];
          for (const a of attrs)
            for (let j = 0; j < a.itemSize; j++) values.push(a.getComponent(v, j));
          return values;
        }),
      ];
      for (const cutter of nearby) {
        polygons = polygons.flatMap((polygon) => {
          if (
            !overlaps(bounds(polygon.map((p) => [p[0] as number, p[2] as number])), cutter.bounds)
          )
            return [polygon];
          const outside: number[][][] = [];
          let remainder = polygon;
          const planes = cutter.points.map((a, j) => {
            const b = cutter.points[(j + 1) % cutter.points.length] as Point;
            return (p: number[]) =>
              (b[0] - a[0]) * ((p[2] as number) - a[1]) - (b[1] - a[1]) * ((p[0] as number) - a[0]);
          });
          // A bore removes only ground below its ceiling. The hill above it stays intact.
          if (cutter.maxHeight !== undefined) {
            const ceiling = cutter.maxHeight;
            planes.push((p) => ceiling - (p[1] as number));
          }
          // Bridges remove only obstructing high ground, retaining lower dry banks.
          if (cutter.minHeight !== undefined) {
            const floor = cutter.minHeight;
            planes.push((p) => (p[1] as number) - floor);
          }
          for (const distance of planes) {
            if (remainder.length < 3) break;
            const fragment = clipByDistance(remainder, (p) => -distance(p));
            if (fragment.length >= 3) outside.push(fragment);
            remainder = clipByDistance(remainder, distance);
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
          return outside;
        });
        if (!polygons.length) break;
      }
      for (const polygon of polygons)
        for (let j = 1; j + 1 < polygon.length; j++) {
          const tri = [polygon[0], polygon[j], polygon[j + 1]] as number[][];
          const a = new THREE.Vector3(...(tri[0]?.slice(0, 3) as [number, number, number])),
            b = new THREE.Vector3(...(tri[1]?.slice(0, 3) as [number, number, number])),
            c = new THREE.Vector3(...(tri[2]?.slice(0, 3) as [number, number, number]));
          if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-18) continue;
          for (const p of tri) writeVertex(p);
        }
    }
    const emitted = indexed - start;
    if (emitted) result.addGroup(start, emitted, group.materialIndex);
  }
  names.forEach((name, i) => {
    const size = sizes[i] as number;
    const output = outputs[i] as Float32Array;
    result.setAttribute(
      name,
      new THREE.BufferAttribute(
        output.length === written * size ? output : output.slice(0, written * size),
        size,
      ),
    );
  });
  result.setIndex(
    new THREE.BufferAttribute(
      written <= 65_536
        ? Uint16Array.from(indices.subarray(0, indexed))
        : indices.slice(0, indexed),
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

/** Coordinates cutouts across tile and LOD boundaries. No material or source grid is mutated. */
export class TerrainGroundCutoutController {
  private readonly active = new Map<THREE.Mesh, CutState>();
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
   * Bring every visible ground mesh's cut up to date. With `budgetMs`, cuts after the first stop
   * once that much time has passed: the rest keep their current state (or stay uncut a moment
   * longer) and `pending` asks for another update. Several tiles arriving together each needed
   * their own cut, and made in one pass they held a frame for 20-40 ms.
   */
  update(root: THREE.Object3D, budgetMs: number = Number.POSITIVE_INFINITY): boolean {
    this.changed.clear();
    this.deferred = false;
    const started = performance.now();
    let cuts = 0;
    // Weak registries avoid walking every building in regions with no ground openings.
    const visibleWithin = (object: THREE.Object3D): boolean => {
      for (let cursor: THREE.Object3D | null = object; cursor; cursor = cursor.parent) {
        if (!cursor.visible) return false;
        if (cursor === root) return true;
      }
      return false;
    };
    const cutters: Array<{
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
    }> = [];
    for (const ref of ownerRefs) {
      const object = ref.deref();
      if (!object) {
        ownerRefs.delete(ref);
        continue;
      }
      if (!visibleWithin(object)) continue;
      object.updateWorldMatrix(true, false);
      const ceiling = ceilings.get(object);
      const floor = floors.get(object);
      const openings = [
        ...(owners.get(object) ?? []).map((outline) => ({ outline, pavingOnly: false })),
        ...(pavementOpenings.get(object) ?? []).map((outline) => ({ outline, pavingOnly: true })),
      ];
      for (const [index, { outline, pavingOnly }] of openings.entries()) {
        const points = outline.map(([x, z]) =>
          new THREE.Vector3(x, 0, z).applyMatrix4(object.matrixWorld),
        );
        cutters.push({
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
                ).applyMatrix4(object.matrixWorld).y,
              }
            : {}),
          bounds: bounds(points.map((p) => [p.x, p.z])),
          ...(ceiling !== undefined
            ? { maxHeight: new THREE.Vector3(0, ceiling, 0).applyMatrix4(object.matrixWorld).y }
            : {}),
          ...(floor !== undefined
            ? { minHeight: new THREE.Vector3(0, floor, 0).applyMatrix4(object.matrixWorld).y }
            : {}),
        });
      }
    }
    if (!cutters.length && !this.active.size) return false;
    const targets: THREE.Mesh[] = [];
    if (cutters.length)
      for (const ref of surfaceRefs) {
        const mesh = ref.deref();
        if (!mesh) {
          surfaceRefs.delete(ref);
          continue;
        }
        if (visibleWithin(mesh)) targets.push(mesh);
      }
    const seen = new Set<THREE.Mesh>();
    let changed = false;

    for (const mesh of targets) {
      const source = terrainGroundSourceGeometry(mesh);
      if (!source.boundingBox) source.computeBoundingBox();
      const box = source.boundingBox;
      mesh.updateWorldMatrix(true, false);
      const inverse = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
      const worldBox = box?.clone().applyMatrix4(mesh.matrixWorld);
      const nearby = cutters.filter(
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
      if (!nearby.length) continue;
      // The exact key below transforms every opening's outline into the mesh's frame and
      // serializes it, for every ground mesh in each visibility pass. When nothing it is made
      // from changed (the mesh's placement and geometry, which openings and their placements),
      // the cut stands; at High detail the keys alone cost more than the cuts.
      const depends: number[] = [...mesh.matrixWorld.elements, identity(source)];
      for (const attribute of Object.values(source.attributes))
        depends.push(
          attribute instanceof THREE.InterleavedBufferAttribute
            ? attribute.data.version
            : attribute.version,
        );
      for (const c of nearby)
        depends.push(
          identity(c.outline),
          c.ceiling,
          c.minHeight ?? Number.NEGATIVE_INFINITY,
          c.minimumHeight ?? Number.NEGATIVE_INFINITY,
          ...c.owner.matrixWorld.elements,
        );
      const current = this.active.get(mesh);
      if (current?.depends !== undefined && sameNumbers(current.depends, depends)) {
        seen.add(mesh);
        continue;
      }
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
      if (!outlines.length) continue;
      seen.add(mesh);
      const key = JSON.stringify([
        outlines.map((outline) => outline.map(([x, z]) => [millimeters(x), millimeters(z)])),
        maxHeights.map((height) => (height === undefined ? undefined : millimeters(height))),
        minHeights.map((height) => (height === undefined ? undefined : millimeters(height))),
        Object.values(source.attributes).map((a) =>
          a instanceof THREE.InterleavedBufferAttribute ? a.data.version : a.version,
        ),
      ]);
      if (current?.key === key) {
        current.depends = depends;
        continue;
      }
      if (cuts > 0 && performance.now() - started > budgetMs) {
        this.deferred = true;
        continue;
      }
      cuts++;
      this.active.get(mesh)?.release();
      const rendered = subtractTerrainGroundGeometry(source, outlines, maxHeights, minHeights);
      let released = false;
      const release = (disposeRendered = true) => {
        if (released) return;
        released = true;
        rendered.removeEventListener('dispose', onDispose);
        mesh.geometry = source;
        states.delete(mesh);
        this.active.delete(mesh);
        if (disposeRendered) rendered.dispose();
      };
      // If an adapter disposes a derived mesh first, its retained source must also leave memory.
      const onDispose = () => {
        release(false);
        source.dispose();
      };
      const state: CutState = { source, rendered, key, depends, release };
      rendered.addEventListener('dispose', onDispose);
      states.set(mesh, state);
      this.active.set(mesh, state);
      mesh.geometry = rendered;
      this.changed.add(mesh);
      changed = true;
    }
    const shown = new Set(targets);
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
        if (cutters.length > 0 && !shown.has(mesh) && attached(mesh)) continue;
        state.release();
        this.changed.add(mesh);
        changed = true;
      }
    return changed;
  }
  /** Restore original grids before normal tile disposal. */
  restore(root: THREE.Object3D): void {
    root.traverse((object) => this.active.get(object as THREE.Mesh)?.release());
  }
  dispose(): void {
    for (const state of this.active.values()) state.release();
  }
}
