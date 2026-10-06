/** Model-owned openings in rendered ground. Heights remain available for anchoring. */
import * as THREE from 'three';

type Point = readonly [number, number];
export type TerrainGroundOutline = readonly Point[];
const owners = new WeakMap<THREE.Object3D, TerrainGroundOutline>();
const ceilings = new WeakMap<THREE.Object3D, number>();
const surfaces = new WeakSet<THREE.Mesh>();
const ownerRefs = new Set<WeakRef<THREE.Object3D>>();
const surfaceRefs = new Set<WeakRef<THREE.Mesh>>();
interface CutState {
  source: THREE.BufferGeometry;
  rendered: THREE.BufferGeometry;
  key: string;
  release(): void;
}
const states = new WeakMap<THREE.Mesh, CutState>();

/** Mark a mesh that represents ground (bare elevation, draped land cover or paving). */
export function markTerrainGroundSurface(mesh: THREE.Mesh): void {
  if (!surfaces.has(mesh)) surfaceRefs.add(new WeakRef(mesh));
  surfaces.add(mesh);
}

/** A simple model-local X/Z polygon. Only a visible owner opens the ground.
 * `maxHeight` limits removal to ground below this model-local Y, preserving terrain above a bore.
 * Height-limited owners use translation and rotation about Y (no pitch/roll). */
export function setTerrainGroundCutout(
  object: THREE.Object3D,
  outline: TerrainGroundOutline,
  maxHeight?: number,
): void {
  if (maxHeight !== undefined && !Number.isFinite(maxHeight))
    throw new Error('Ground cutout ceiling must be finite');
  const points = outline.map(([x, z]) => [x, z] as Point);
  if (
    points.length > 3 &&
    points[0]?.[0] === points.at(-1)?.[0] &&
    points[0]?.[1] === points.at(-1)?.[1]
  )
    points.pop();
  if (points.length < 3 || points.length > 512 || points.some((p) => !p.every(Number.isFinite)))
    throw new Error('Ground cutout requires 3–512 finite X/Z vertices');
  if (!owners.has(object)) ownerRefs.add(new WeakRef(object));
  owners.set(object, points);
  if (maxHeight !== undefined) {
    ceilings.set(object, maxHeight);
  } else ceilings.delete(object);
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
): THREE.BufferGeometry {
  const names = ['position', ...Object.keys(source.attributes).filter((n) => n !== 'position')];
  const attrs = names.map((n) => source.getAttribute(n));
  const arrays = names.map(() => [] as number[]);
  const cutters = outlines.flatMap((outline, i) =>
    pieces(outline).map((points) => ({ points, bounds: bounds(points), maxHeight: maxHeights[i] })),
  );
  // A mapped bore has hundreds of short cutters. Index them so a fine DEM triangle
  // only visits nearby segments instead of scanning every opening on the tile.
  const cellSize = 64;
  const cells = new Map<string, number[]>();
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
          const key = `${x}/${z}`,
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
        for (const i of cells.get(`${x}/${z}`) ?? []) candidates.add(i);
    return [...candidates]
      .sort((a, b) => a - b)
      .map((i) => cutters[i] as (typeof cutters)[number])
      .filter((c) => overlaps(box, c.bounds));
  };
  const count = source.index?.count ?? source.getAttribute('position').count;
  const groups = source.groups.length ? source.groups : [{ start: 0, count, materialIndex: 0 }];
  const result = new THREE.BufferGeometry();
  for (const group of groups) {
    const start = (arrays[0] as number[]).length / 3;
    const end = Math.min(
      count,
      group.start + group.count,
      source.drawRange.start + source.drawRange.count,
    );
    for (let i = Math.max(group.start, source.drawRange.start); i + 2 < end; i += 3) {
      const vertices = [0, 1, 2].map((k) => (source.index ? source.index.getX(i + k) : i + k));
      const position = attrs[0] as THREE.BufferAttribute;
      const triangleBounds = bounds(vertices.map((v) => [position.getX(v), position.getZ(v)]));
      const nearby = nearbyCutters(triangleBounds);
      if (!nearby.length) {
        for (const v of vertices)
          attrs.forEach((a, k) => {
            for (let j = 0; j < a.itemSize; j++) (arrays[k] as number[]).push(a.getComponent(v, j));
          });
        continue;
      }
      let polygons = [
        vertices.map((v) =>
          attrs.flatMap((a) => Array.from({ length: a.itemSize }, (_, j) => a.getComponent(v, j))),
        ),
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
          for (const distance of planes) {
            if (remainder.length < 3) break;
            const fragment = clipByDistance(remainder, (p) => -distance(p));
            if (fragment.length >= 3) outside.push(fragment);
            remainder = clipByDistance(remainder, distance);
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
          for (const p of tri) {
            let offset = 0;
            attrs.forEach((attr, k) => {
              (arrays[k] as number[]).push(...p.slice(offset, offset + attr.itemSize));
              offset += attr.itemSize;
            });
          }
        }
    }
    const emitted = (arrays[0] as number[]).length / 3 - start;
    if (emitted) result.addGroup(start, emitted, group.materialIndex);
  }
  names.forEach((name, i) => {
    result.setAttribute(
      name,
      new THREE.Float32BufferAttribute(
        arrays[i] as number[],
        (attrs[i] as THREE.BufferAttribute).itemSize,
      ),
    );
  });
  if (result.getAttribute('normal')) result.normalizeNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/** Coordinates cutouts across tile and LOD boundaries. No material or source grid is mutated. */
export class TerrainGroundCutoutController {
  private readonly active = new Map<THREE.Mesh, CutState>();
  update(root: THREE.Object3D): boolean {
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
    }> = [];
    for (const ref of ownerRefs) {
      const object = ref.deref();
      if (!object) {
        ownerRefs.delete(ref);
        continue;
      }
      if (!visibleWithin(object)) continue;
      object.updateWorldMatrix(true, false);
      const points = (owners.get(object) ?? []).map(([x, z]) =>
        new THREE.Vector3(x, 0, z).applyMatrix4(object.matrixWorld),
      );
      const ceiling = ceilings.get(object);
      cutters.push({
        points,
        bounds: bounds(points.map((p) => [p.x, p.z])),
        ...(ceiling !== undefined
          ? { maxHeight: new THREE.Vector3(0, ceiling, 0).applyMatrix4(object.matrixWorld).y }
          : {}),
      });
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
          worldBox &&
          overlaps([worldBox.min.x, worldBox.min.z, worldBox.max.x, worldBox.max.z], c.bounds),
      );
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
      if (!outlines.length) continue;
      seen.add(mesh);
      const key = JSON.stringify([
        outlines,
        maxHeights,
        Object.values(source.attributes).map((a) =>
          a instanceof THREE.InterleavedBufferAttribute ? a.data.version : a.version,
        ),
      ]);
      if (this.active.get(mesh)?.key === key) continue;
      this.active.get(mesh)?.release();
      const rendered = subtractTerrainGroundGeometry(source, outlines, maxHeights);
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
      const state = { source, rendered, key, release };
      rendered.addEventListener('dispose', onDispose);
      states.set(mesh, state);
      this.active.set(mesh, state);
      mesh.geometry = rendered;
      changed = true;
    }
    for (const [mesh, state] of this.active)
      if (!seen.has(mesh)) {
        state.release();
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
