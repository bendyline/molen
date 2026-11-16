// Bounds for render groups (see `Renderer.createRenderGroup`): a group whose owner states where
// its content is can be left out of a scene walk that cannot reach it.
//
// Three culls meshes one at a time, and only once it has walked to them: every frame it visits
// every object in the scene for its world matrix, again to choose what to draw, and again for
// each shadow map. A streamed world keeps most of its tiles outside the view, ready for a turn of
// the camera, and their thousands of objects were walked all the same: over Seattle at High
// about half of the tiles on show lay wholly outside the view of a low flight, and leaving them
// out took the main thread's time in a frame's render from 17-22 ms to 12-13 ms (switched off
// and on every two seconds within one flight, three flights), with the same draws.

import * as THREE from 'three';

/**
 * `userData` key of a render group's bounds: a `THREE.Box3` in the frame of the group's parent
 * that contains everything the group draws, now and as its parts move. A group without one is
 * never left out.
 */
export const RENDER_BOUNDS: 'renderBounds' = 'renderBounds';
/** `userData` flag asking a group's owner to work its bounds out again (see `markRenderBoundsChanged`). */
export const RENDER_BOUNDS_STALE: 'renderBoundsStale' = 'renderBoundsStale';
/**
 * `userData` flag an owner sets on its render group when it adds content to it: that content has
 * no world matrices until a walk reaches it, and the renderer may be leaving the group out of the
 * scene's walk. Before a shadow map draws a group it left out, the renderer brings a flagged
 * group's matrices up to date and clears the flag; an owner whose group skips walks while hidden
 * clears it in the walk it does make.
 */
export const RENDER_MATRICES_STALE: 'renderMatricesStale' = 'renderMatricesStale';

/**
 * Tell the render group above `object` that what it draws has changed size: call it after adding
 * or replacing geometry inside streamed content once that content is on show (a landmark's next
 * level of detail arriving, say). The group's owner works its bounds out again before the next
 * frame. Does nothing for an object outside any group with bounds.
 */
export function markRenderBoundsChanged(object: THREE.Object3D): void {
  for (let cursor: THREE.Object3D | null = object; cursor !== null; cursor = cursor.parent) {
    if (cursor.userData[RENDER_BOUNDS] === undefined) continue;
    cursor.userData[RENDER_BOUNDS_STALE] = true;
    return;
  }
}

/** A camera's view volume as the matrix from world to clip space, for `boxOutsideView`. */
export function viewProjection(camera: THREE.Camera, target: THREE.Matrix4): THREE.Matrix4 {
  return target.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

/** A camera's depth range, for `boxOutsideView`: its view matrix and the planes it draws between. */
export interface ViewDepth {
  view: THREE.Matrix4;
  near: number;
  far: number;
}

/**
 * Whether a world-space box lies wholly outside a camera's view: every corner beyond the same
 * side of it, or all of them behind a perspective camera. Without `depth` the near and far planes
 * are not tested (ground a camera's far plane cuts is still wanted, and the test then holds for
 * either depth convention). With it, a box wholly nearer than `near` or beyond `far` along the
 * camera's axis is outside too, read in view space: an orthographic shadow map is a box, and
 * ground far along the light's direction lines up with it without being in it. A box across a
 * corner of the view can read as inside when it is not, which only costs the walk it would have
 * saved.
 */
export function boxOutsideView(
  matrix: THREE.Matrix4,
  min: THREE.Vector3,
  max: THREE.Vector3,
  depth?: ViewDepth,
): boolean {
  const m = matrix.elements;
  let left = true,
    right = true,
    below = true,
    above = true,
    behind = true;
  if (depth !== undefined) {
    const v = depth.view.elements;
    let nearer = true,
      farther = true;
    for (let corner = 0; corner < 8 && (nearer || farther); corner++) {
      // The camera looks down its own -Z.
      const along = -(
        (v[2] as number) * (corner & 1 ? max.x : min.x) +
        (v[6] as number) * (corner & 2 ? max.y : min.y) +
        (v[10] as number) * (corner & 4 ? max.z : min.z) +
        (v[14] as number)
      );
      if (along >= depth.near) nearer = false;
      if (along <= depth.far) farther = false;
    }
    if (nearer || farther) return true;
  }
  for (let corner = 0; corner < 8; corner++) {
    const x = corner & 1 ? max.x : min.x,
      y = corner & 2 ? max.y : min.y,
      z = corner & 4 ? max.z : min.z;
    const cx =
        (m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number),
      cy = (m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number),
      cw = (m[3] as number) * x + (m[7] as number) * y + (m[11] as number) * z + (m[15] as number);
    if (cx >= -cw) left = false;
    if (cx <= cw) right = false;
    if (cy >= -cw) below = false;
    if (cy <= cw) above = false;
    if (cw > 0) behind = false;
    if (!(left || right || below || above || behind)) return false;
  }
  return true;
}

const corner = new THREE.Vector3();
const local = new THREE.Box3();
const IDENTITY = new THREE.Matrix4();

/**
 * Grow `bounds` (in `frame`'s own coordinates) to hold everything `object` draws: each mesh's
 * bounding box where it has one already (an instanced mesh's own, over its instances), and
 * otherwise the box round its bounding sphere, which three works out for its own culling anyway.
 * Nothing is measured from vertices that three would not measure too: a box computed here for
 * every building's geometry was a pass over a dense tile's half a million vertices, 5 ms of the
 * job that published it. An object marked `userData.dynamicTransform` may turn about its own
 * origin, so it and what is under it count as the sphere they can sweep there; one that travels
 * needs its owner to state bounds for the whole of its way. Local matrices are read as they stand
 * (static content has them frozen), so the object need not have been drawn or even attached.
 * `padding` is added round each part.
 */
export function expandRenderBounds(
  bounds: THREE.Box3,
  object: THREE.Object3D,
  frame: THREE.Object3D,
  padding = 0,
): THREE.Box3 {
  // The object's placement in `frame`: its ancestors' local matrices, then its own.
  const chain: THREE.Object3D[] = [];
  for (
    let cursor: THREE.Object3D | null = object;
    cursor !== null && cursor !== frame;
    cursor = cursor.parent
  )
    chain.push(cursor);
  const placement = new THREE.Matrix4();
  for (let i = chain.length - 1; i >= 0; i--) {
    const part = chain[i] as THREE.Object3D;
    if (part.matrixAutoUpdate) part.updateMatrix();
    placement.multiply(part.matrix);
  }
  expand(bounds, object, placement, padding, false, 0);
  return bounds;
}

/** One placement matrix per depth of the walk, reused: a tile's content is thousands of parts. */
const placements: THREE.Matrix4[] = [];

/** `placement` is the object's own, in the frame `bounds` is measured in. */
function expand(
  bounds: THREE.Box3,
  object: THREE.Object3D,
  placement: THREE.Matrix4,
  padding: number,
  swept: boolean,
  depth: number,
): void {
  if (!swept && object.userData.dynamicTransform === true) {
    const reach = new THREE.Box3();
    expand(reach, object, IDENTITY, 0, true, depth);
    if (reach.isEmpty()) return;
    let radius = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? reach.max.x : reach.min.x,
        i & 2 ? reach.max.y : reach.min.y,
        i & 4 ? reach.max.z : reach.min.z,
      );
      radius = Math.max(radius, corner.length());
    }
    radius = radius * placement.getMaxScaleOnAxis() + padding;
    corner.setFromMatrixPosition(placement);
    bounds.expandByPoint(local.min.copy(corner).addScalar(-radius));
    bounds.expandByPoint(local.max.copy(corner).addScalar(radius));
    return;
  }
  const mesh = object as THREE.Mesh;
  if (mesh.isMesh || (object as THREE.Line).isLine || (object as THREE.Points).isPoints) {
    // An instanced mesh's bounds are its own (over its instances); any other mesh's, its geometry's.
    const instanced = object as THREE.InstancedMesh;
    const source: {
      boundingBox: THREE.Box3 | null;
      boundingSphere: THREE.Sphere | null;
      computeBoundingSphere(): void;
    } = instanced.isInstancedMesh ? instanced : mesh.geometry;
    const box = source.boundingBox;
    if (box !== null) {
      if (!box.isEmpty()) {
        local.copy(box).applyMatrix4(placement);
        if (padding > 0) local.expandByScalar(padding);
        bounds.union(local);
      }
    } else {
      if (source.boundingSphere === null) source.computeBoundingSphere();
      const sphere = source.boundingSphere;
      if (sphere !== null && sphere.radius >= 0) {
        const radius = sphere.radius * placement.getMaxScaleOnAxis() + padding;
        corner.copy(sphere.center).applyMatrix4(placement);
        bounds.expandByPoint(local.min.copy(corner).addScalar(-radius));
        bounds.expandByPoint(local.max.copy(corner).addScalar(radius));
      }
    }
  }
  if (object.children.length === 0) return;
  let next = placements[depth];
  if (next === undefined) {
    next = new THREE.Matrix4();
    placements[depth] = next;
  }
  for (const child of object.children) {
    if (child.matrixAutoUpdate) child.updateMatrix();
    expand(
      bounds,
      child,
      next.multiplyMatrices(placement, child.matrix),
      padding,
      swept,
      depth + 1,
    );
  }
}
