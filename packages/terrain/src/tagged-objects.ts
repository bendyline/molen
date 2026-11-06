import * as THREE from 'three';

const tagged = new Map<string, Set<WeakRef<THREE.Object3D>>>();
const versions = new Map<string, number>();

/**
 * Remember a terrain object a host looks for by kind (`'water'` surfaces, `'parked-vehicles'`
 * surface groups), so it can visit those instead of walking the whole scene: a view's graph is
 * thousands of objects, and a vehicle host walked it twice, five times a second, to find a few
 * dozen. Held weakly; disposed objects drop out.
 */
export function tagTerrainObject(tag: string, object: THREE.Object3D): void {
  let set = tagged.get(tag);
  if (set === undefined) {
    set = new Set();
    tagged.set(tag, set);
  }
  set.add(new WeakRef(object));
  versions.set(tag, (versions.get(tag) ?? 0) + 1);
}

/**
 * Changes whenever an object is tagged `tag`, so a host can keep what it gathered from
 * {@link taggedTerrainObjects} until then. Objects collected since still drop out of the live set.
 */
export function taggedTerrainObjectsVersion(tag: string): number {
  return versions.get(tag) ?? 0;
}

/**
 * The live objects tagged `tag`, in tagging order. A host still checks that each is attached and
 * visible under its own root: a tile evicted or hidden keeps its tag until it is collected.
 */
export function* taggedTerrainObjects(tag: string): Generator<THREE.Object3D> {
  const set = tagged.get(tag);
  if (set === undefined) return;
  for (const ref of set) {
    const object = ref.deref();
    if (object === undefined) set.delete(ref);
    else yield object;
  }
}

const offsets = new WeakMap<
  THREE.Object3D,
  { root: THREE.Object3D; offset: THREE.Vector3 | null }
>();
const scratchMatrix = new THREE.Matrix4();
const IDENTITY_LINEAR = [0, 1, 2, 4, 5, 6, 8, 9, 10] as const;

/** {@link terrainRootOffset}'s answer when it was already found for `root`, without finding it. */
export function knownTerrainRootOffset(
  object: THREE.Object3D,
  root: THREE.Object3D,
): THREE.Vector3 | null | undefined {
  const known = offsets.get(object);
  return known !== undefined && known.root === root ? known.offset : undefined;
}

/**
 * `object`'s origin in `root`'s frame when only translations lie between them (tile layers under a
 * terrain stream), or null. Their local transforms do not change once placed, so it is kept.
 */
export function terrainRootOffset(
  object: THREE.Object3D,
  root: THREE.Object3D,
): THREE.Vector3 | null {
  const known = offsets.get(object);
  if (known !== undefined && known.root === root) return known.offset;
  let offset: THREE.Vector3 | null = new THREE.Vector3();
  for (let cursor: THREE.Object3D | null = object; cursor !== root; cursor = cursor.parent) {
    if (cursor === null) return null;
    if (cursor.matrixAutoUpdate) cursor.updateMatrix();
    const e = scratchMatrix.copy(cursor.matrix).elements;
    if (
      IDENTITY_LINEAR.some((i, k) => Math.abs((e[i] as number) - (k % 4 === 0 ? 1 : 0)) > 1e-12)
    ) {
      offset = null;
      break;
    }
    offset.x += e[12] as number;
    offset.y += e[13] as number;
    offset.z += e[14] as number;
  }
  offsets.set(object, { root, offset });
  return offset;
}
