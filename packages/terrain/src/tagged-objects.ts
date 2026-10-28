import type * as THREE from 'three';

const tagged = new Map<string, Set<WeakRef<THREE.Object3D>>>();

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
