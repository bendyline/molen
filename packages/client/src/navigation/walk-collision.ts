import * as THREE from 'three';
import { CollisionTree } from './collision-tree';
import { forEachIndexedTriangle, triangleIndexFor } from './triangle-index';

const COLLISION_RADIUS = 24;
const REBUILD_DISTANCE = 6;

export interface WalkCollisionOptions {
  /** Skip car and aircraft geometry; the vehicle systems collide with those themselves. */
  ignoreVehicles?: boolean;
  /** Horizontal half-size of the neighborhood around the tracked point, meters (default 24). */
  radius?: number;
  /**
   * How far the tracked point moves from the neighborhood's center before the tree is rebuilt
   * around it (default 6). Queries reach at most `radius - rebuildDistance` from the point.
   */
  rebuildDistance?: number;
  /**
   * Vertical half-size of the neighborhood, meters, applied when `update` receives a `y`. Fast
   * or airborne subjects use it so ground far below (or roofs far above) never enters the tree;
   * leave it unset to include the whole column, which a walker's placement ray needs.
   */
  verticalRadius?: number;
  /**
   * Minimum time between scans of the visible scene for streaming changes while the tracked
   * point stays inside the neighborhood, ms (default 0: every `update` scans). A scan visits
   * every visible mesh under the root, so a per-frame host should pass something like 200;
   * `invalidate()` forces the next `update` to scan.
   */
  rescanIntervalMs?: number;
  /** Clock for the rescan interval, ms (default `performance.now`). */
  now?: () => number;
  /**
   * Collide with each instance of an instanced mesh as its bounding box, twelve triangles, instead
   * of its own triangles (default false). An aircraft's neighborhood over a forest held 100k
   * triangles of shrubs and crowns, about 110 ms to rebuild every 24 m; its probes and camera
   * rays need the trees' extent, not their leaves.
   */
  instanceBounds?: boolean;
}

interface CollisionMesh {
  mesh: THREE.Mesh;
  matrix: THREE.Matrix4;
  count: number;
  geometry: THREE.BufferGeometry;
  version: number;
}

function requireFinite(value: number, name: string, allowZero: boolean): number {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0))
    throw new RangeError(
      `${name} must be a finite ${allowZero ? 'nonnegative' : 'positive'} number`,
    );
  return value;
}

/**
 * A small collision neighborhood in metric coordinates, independent of floating-origin shifts.
 * Only visible, resident geometry under `root` participates; evicted tiles and hidden layers
 * disappear on the next scan, including meshes with all render layers disabled unless marked
 * `userData.walkCollisionOnly` (for example, a smooth staircase proxy). Instance
 * transforms are expanded only inside the neighborhood. Large geometries (terrain tiles,
 * building cells) are walked through a per-geometry
 * spatial index, so a rebuild costs the triangles near the subject rather than the whole tile.
 * Meshes opt out with `userData.walkIgnore`, and water materials (`userData.terrainWaterMaterial`)
 * are never solid. Land cover is a solid walking surface: its visible elevation can differ from
 * bare terrain, and full-tile land cover can replace the bare surface altogether.
 * A group whose contents lie within an X/Z rectangle of its own frame declares it as
 * `userData.walkFootprint` (`[minX, minZ, maxX, maxZ]`, like a terrain tile): a scan skips the
 * whole group when that rectangle is out of reach.
 */
export class WalkCollision {
  readonly origin: THREE.Vector3 = new THREE.Vector3();
  readonly octree: CollisionTree = new CollisionTree();
  private readonly ignoreVehicles: boolean;
  private readonly radius: number;
  private readonly rebuildDistance: number;
  private readonly verticalRadius: number | undefined;
  private readonly rescanIntervalMs: number;
  private readonly now: () => number;
  private readonly instanceBounds: boolean;
  private meshes: CollisionMesh[] = [];
  private initialized = false;
  /** Vertical center of the current neighborhood, or undefined when it spans the whole column. */
  private centerY: number | undefined;
  private scannedAt = Number.NEGATIVE_INFINITY;
  private stale = true;

  constructor(options: boolean | WalkCollisionOptions = false) {
    const resolved = typeof options === 'boolean' ? { ignoreVehicles: options } : options;
    this.ignoreVehicles = resolved.ignoreVehicles ?? false;
    this.radius = requireFinite(resolved.radius ?? COLLISION_RADIUS, 'radius', false);
    this.rebuildDistance = requireFinite(
      resolved.rebuildDistance ?? REBUILD_DISTANCE,
      'rebuildDistance',
      true,
    );
    if (this.rebuildDistance >= this.radius)
      throw new RangeError('rebuildDistance must be smaller than radius');
    this.verticalRadius =
      resolved.verticalRadius === undefined
        ? undefined
        : requireFinite(resolved.verticalRadius, 'verticalRadius', false);
    this.rescanIntervalMs = requireFinite(resolved.rescanIntervalMs ?? 0, 'rescanIntervalMs', true);
    this.now = resolved.now ?? (() => performance.now());
    this.instanceBounds = resolved.instanceBounds ?? false;
  }

  /**
   * Track the subject at (x, z). With a `verticalRadius`, `y` bounds the neighborhood vertically.
   * Scans the visible scene when the subject leaves the neighborhood, when the rescan interval
   * has passed, or after `invalidate()`; rebuilds the tree only when nearby geometry changed.
   */
  update(root: THREE.Object3D, x: number, z: number, y?: number): void {
    const band = this.verticalRadius !== undefined && y !== undefined ? y : undefined;
    const moved =
      !this.initialized ||
      (band === undefined) !== (this.centerY === undefined) ||
      Math.hypot(x - this.origin.x, z - this.origin.z) >= this.rebuildDistance ||
      (band !== undefined &&
        this.centerY !== undefined &&
        Math.abs(band - this.centerY) >= this.rebuildDistance);
    const now = this.now();
    if (!moved && !this.stale && now - this.scannedAt < this.rescanIntervalMs) return;
    // World matrices for the root's chain here, and for each object below as the scan reaches
    // it: only the neighborhood. Forcing every descendant recomposed each resident tile, hidden
    // ones too, and even the renderer's pass over the whole graph cost a jet, scanning many
    // times a second, more than its frame's own.
    root.updateWorldMatrix(true, false);
    const inverse = root.matrixWorld.clone().invert();
    const candidate = new THREE.Matrix4();
    const meshes: CollisionMesh[] = [];
    // Compare only the neighborhood represented by the current tree. Distant streaming and
    // LOD changes must not trigger a rebuild of every nearby triangle.
    const centerX = moved ? x : this.origin.x;
    const centerZ = moved ? z : this.origin.z;
    const centerY = moved ? band : this.centerY;
    // Include the rebuild margin so moving across a cell edge cannot miss a new obstacle.
    const reach = this.radius + this.rebuildDistance;
    const verticalReach = (this.verticalRadius ?? 0) + this.rebuildDistance;
    const bounds = new THREE.Box3();
    const sphere = new THREE.Sphere();
    const footprint = new THREE.Box3();
    const outOfReach = (min: THREE.Vector3, max: THREE.Vector3): boolean =>
      min.x > centerX + reach ||
      max.x < centerX - reach ||
      min.z > centerZ + reach ||
      max.z < centerZ - reach ||
      (centerY !== undefined &&
        (min.y > centerY + verticalReach || max.y < centerY - verticalReach));
    // A scan visited every visible object under the root; a fast aircraft scans many times a
    // second. Groups that declare their footprint are skipped whole when it is out of reach.
    const visit = (object: THREE.Object3D, inspect: (object: THREE.Object3D) => void): void => {
      if (!object.visible) return;
      if (object !== root) object.updateWorldMatrix(false, false);
      const area = object.userData.walkFootprint as
        | readonly [number, number, number, number]
        | undefined;
      if (area !== undefined) {
        footprint.min.set(area[0], 0, area[1]);
        footprint.max.set(area[2], 0, area[3]);
        footprint.applyMatrix4(candidate.multiplyMatrices(inverse, object.matrixWorld));
        if (
          footprint.min.x > centerX + reach ||
          footprint.max.x < centerX - reach ||
          footprint.min.z > centerZ + reach ||
          footprint.max.z < centerZ - reach
        )
          return;
      }
      inspect(object);
      for (const child of object.children) visit(child, inspect);
    };
    visit(root, (object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        object.userData.walkIgnore === true ||
        (object.layers.mask === 0 && object.userData.walkCollisionOnly !== true)
      )
        return;
      if (this.ignoreVehicles && (object.userData.vehicleIds || object.userData.vehicleGeometry))
        return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      // Water is a visual surface, not a solid floor.
      if (materials.every((material) => material.userData.terrainWaterMaterial === true)) return;
      const matrix = candidate.multiplyMatrices(inverse, object.matrixWorld);
      // Rendered meshes already carry the bounding sphere three's frustum culling computed. An
      // exact box is a pass over every vertex, a freshly streamed building cell's tens of
      // thousands, so a mesh its sphere already puts out of reach never computes one.
      const known =
        object instanceof THREE.InstancedMesh
          ? object.boundingSphere
          : object.geometry.boundingSphere;
      if (known !== null) {
        sphere.copy(known).applyMatrix4(matrix);
        bounds.min.setScalar(-sphere.radius).add(sphere.center);
        bounds.max.setScalar(sphere.radius).add(sphere.center);
        if (outOfReach(bounds.min, bounds.max)) return;
      }
      if (object instanceof THREE.InstancedMesh) {
        geometryBounds(object.geometry);
        if (object.boundingBox === null) object.computeBoundingBox();
        bounds.copy(object.boundingBox as THREE.Box3);
      } else {
        bounds.copy(geometryBounds(object.geometry));
      }
      bounds.applyMatrix4(matrix);
      if (outOfReach(bounds.min, bounds.max)) return;
      meshes.push({
        mesh: object,
        matrix: matrix.clone(),
        count: object instanceof THREE.InstancedMesh ? object.count : 1,
        geometry: object.geometry,
        // Both versions only increase, so their sum changes whenever either does (a merged
        // parked-car batch hides a car by rewriting positions in place).
        version:
          object instanceof THREE.InstancedMesh
            ? object.instanceMatrix.version
            : (object.geometry.index?.version ?? 0) +
              (object.geometry.getAttribute('position')?.version ?? 0),
      });
    });
    this.scannedAt = now;
    this.stale = false;
    const unchanged =
      meshes.length === this.meshes.length &&
      meshes.every((entry, index) => {
        const previous = this.meshes[index];
        return (
          previous?.mesh === entry.mesh &&
          previous.count === entry.count &&
          previous.geometry === entry.geometry &&
          previous.version === entry.version &&
          previous.matrix.equals(entry.matrix)
        );
      });
    if (this.initialized && unchanged && !moved) return;
    this.initialized = true;
    this.meshes = meshes;
    this.origin.set(x, 0, z);
    this.centerY = band;
    this.rebuild(meshes, x, z, band);
  }

  /**
   * Scan the scene on the next `update` regardless of the rescan interval: call it before a
   * query that must see geometry published this frame, such as placing a walker.
   */
  invalidate(): void {
    this.stale = true;
  }

  clear(): void {
    this.meshes = [];
    this.initialized = false;
    this.centerY = undefined;
    this.scannedAt = Number.NEGATIVE_INFINITY;
    this.stale = true;
    this.octree.clear();
  }

  private rebuild(
    meshes: readonly CollisionMesh[],
    x: number,
    z: number,
    centerY: number | undefined,
  ): void {
    this.octree.clear();
    const radius = this.radius;
    const minY =
      centerY === undefined ? Number.NEGATIVE_INFINITY : centerY - (this.verticalRadius as number);
    const maxY =
      centerY === undefined ? Number.POSITIVE_INFINITY : centerY + (this.verticalRadius as number);
    const offset = new THREE.Matrix4().makeTranslation(-x, 0, -z);
    const local = new THREE.Matrix4();
    const instance = new THREE.Matrix4();
    const transform = new THREE.Matrix4();
    const toLocal = new THREE.Matrix4();
    const bounds = new THREE.Box3();
    const query = new THREE.Box3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const inside = (): boolean =>
      bounds.min.x <= radius &&
      bounds.max.x >= -radius &&
      bounds.min.z <= radius &&
      bounds.max.z >= -radius &&
      bounds.min.y <= maxY &&
      bounds.max.y >= minY;
    for (const { mesh, matrix, count } of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute('position');
      if (position === undefined) continue;
      geometryBounds(geometry);
      local.multiplyMatrices(offset, matrix);
      // Reject whole distant batches before walking their (potentially thousands of) instances.
      if (mesh instanceof THREE.InstancedMesh && mesh.boundingBox === null)
        mesh.computeBoundingBox();
      bounds
        .copy(
          (mesh instanceof THREE.InstancedMesh
            ? mesh.boundingBox
            : geometry.boundingBox) as THREE.Box3,
        )
        .applyMatrix4(local);
      if (!inside()) continue;
      const index = geometry.index;
      const start = geometry.drawRange.start;
      const end = Math.min(index?.count ?? position.count, start + geometry.drawRange.count);
      const doubleSided = mesh.userData.walkDoubleSided === true;
      const boxes = this.instanceBounds && mesh instanceof THREE.InstancedMesh;
      const spatial = boxes ? undefined : triangleIndexFor(geometry);
      const visit = (vertex: number): void => {
        if (vertex < start || vertex + 2 >= end) return;
        a.fromBufferAttribute(position, index?.getX(vertex) ?? vertex).applyMatrix4(transform);
        b.fromBufferAttribute(position, index?.getX(vertex + 1) ?? vertex + 1).applyMatrix4(
          transform,
        );
        c.fromBufferAttribute(position, index?.getX(vertex + 2) ?? vertex + 2).applyMatrix4(
          transform,
        );
        // Hidden parked cars collapse to a point; they have no surface to collide with.
        if (a.equals(b) && b.equals(c)) return;
        if (
          Math.min(a.x, b.x, c.x) > radius ||
          Math.max(a.x, b.x, c.x) < -radius ||
          Math.min(a.z, b.z, c.z) > radius ||
          Math.max(a.z, b.z, c.z) < -radius ||
          Math.min(a.y, b.y, c.y) > maxY ||
          Math.max(a.y, b.y, c.y) < minY
        )
          return;
        this.octree.addTriangle(new THREE.Triangle(a.clone(), b.clone(), c.clone()));
        if (doubleSided)
          this.octree.addTriangle(new THREE.Triangle(c.clone(), b.clone(), a.clone()));
      };
      for (let i = 0; i < count; i++) {
        if (mesh instanceof THREE.InstancedMesh) {
          mesh.getMatrixAt(i, instance);
          transform.multiplyMatrices(local, instance);
        } else transform.copy(local);
        bounds.copy(geometry.boundingBox as THREE.Box3).applyMatrix4(transform);
        if (!inside()) continue;
        if (boxes) {
          addBox(this.octree, geometry.boundingBox as THREE.Box3, transform);
          continue;
        }
        if (spatial === undefined) {
          for (let vertex = start; vertex + 2 < end; vertex += 3) visit(vertex);
          continue;
        }
        // Map the neighborhood into the geometry's frame; the index lists only triangles whose
        // footprint can reach it. The vertical extent stays finite: this instance's own bounds.
        query.min.set(-radius, Math.max(minY, bounds.min.y), -radius);
        query.max.set(radius, Math.min(maxY, bounds.max.y), radius);
        query.applyMatrix4(toLocal.copy(transform).invert());
        forEachIndexedTriangle(spatial, query.min.x, query.max.x, query.min.z, query.max.z, (t) =>
          visit(t * 3),
        );
      }
    }
    this.octree.build();
  }
}

/**
 * The geometry's bounding box, computed once straight from a plain float position array: three's
 * per-vertex accessors made a freshly streamed building cell's box most of an aircraft's scan.
 */
function geometryBounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  const known = geometry.boundingBox;
  if (known !== null) return known;
  const position = geometry.getAttribute('position');
  if (
    !(position instanceof THREE.BufferAttribute) ||
    !(position.array instanceof Float32Array) ||
    position.normalized ||
    position.itemSize !== 3 ||
    geometry.morphAttributes.position !== undefined
  ) {
    geometry.computeBoundingBox();
    return geometry.boundingBox as THREE.Box3;
  }
  const array = position.array;
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    minZ = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY,
    maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0, end = position.count * 3; i < end; i += 3) {
    const x = array[i] as number,
      y = array[i + 1] as number,
      z = array[i + 2] as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ),
  );
  return geometry.boundingBox;
}

const BOX_FACES = [
  [0, 2, 6, 4],
  [1, 5, 7, 3],
  [0, 4, 5, 1],
  [2, 3, 7, 6],
  [0, 1, 3, 2],
  [4, 6, 7, 5],
] as const;
const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
const boxCenter = new THREE.Vector3();
const faceCenter = new THREE.Vector3();
const edge = new THREE.Vector3();
const across = new THREE.Vector3();

/**
 * Add `box`, placed by `transform`, as twelve outward-facing triangles: rays test front faces only.
 * A box collapsed to a point (a hidden instance) adds nothing.
 */
function addBox(tree: CollisionTree, box: THREE.Box3, transform: THREE.Matrix4): void {
  corners.forEach((corner, index) => {
    corner
      .set(
        index & 1 ? box.max.x : box.min.x,
        index & 2 ? box.max.y : box.min.y,
        index & 4 ? box.max.z : box.min.z,
      )
      .applyMatrix4(transform);
  });
  const [first] = corners as [THREE.Vector3];
  if (corners.every((corner) => corner.equals(first))) return;
  boxCenter.set(0, 0, 0);
  for (const corner of corners) boxCenter.add(corner);
  boxCenter.multiplyScalar(1 / 8);
  for (const face of BOX_FACES) {
    const [a, b, c, d] = face.map((index) => corners[index] as THREE.Vector3) as [
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
    ];
    faceCenter.copy(a).add(b).add(c).add(d).multiplyScalar(0.25).sub(boxCenter);
    // A mirroring transform reverses every face; wind each one to face away from the center.
    const outward = edge.subVectors(b, a).cross(across.subVectors(c, a)).dot(faceCenter) >= 0;
    const [p, q, r, t] = outward ? [a, b, c, d] : [a, d, c, b];
    tree.addTriangle(new THREE.Triangle(p.clone(), q.clone(), r.clone()));
    tree.addTriangle(new THREE.Triangle(p.clone(), r.clone(), t.clone()));
  }
}
