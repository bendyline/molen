import type { EventDispatcher, Object3D } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

// Three r184–r186 internals: the renderer's `RenderObjects` factory and `RenderObject`.
type DisposeTarget = EventDispatcher<{ dispose: object }>;
interface RenderObject {
  object: Object3D;
  material: DisposeTarget;
  geometry: DisposeTarget;
  onMaterialDispose: () => void;
  onGeometryDispose: () => void;
  onDispose: (() => void) | null;
  dispose(): void;
  getAttributes(): unknown[];
}
interface RenderObjects {
  createRenderObject(...args: unknown[]): RenderObject;
}
/** What `Geometries.initGeometry` reads from its render object, now and at geometry disposal. */
type GeometryOwner = Pick<RenderObject, 'geometry' | 'getAttributes'>;
interface Geometries {
  initGeometry(renderObject: GeometryOwner): void;
}
/** Instanced and batched meshes: node state keyed by the object, released by `dispose()`. */
type PerObjectMesh = Object3D & { isInstancedMesh?: boolean; isBatchedMesh?: boolean };

const guarded = new WeakSet<object>();

/**
 * Release WebGPU render state together with the objects it draws. Three r184 has gaps that keep
 * meshes it has drawn reachable, and through `parent` their whole streamed tiles:
 *
 * - Each render object subscribes to its material's and geometry's `dispose` events with a
 *   closure that references it. Shared materials never fire, so their listener lists retain a
 *   render object (and its mesh) per mesh drawn. Those listeners are replaced here with ones that
 *   hold the render object weakly; three still owns it for as long as the mesh is alive.
 * - Instanced and batched meshes build node state of their own (keyed by uuid), and the node
 *   cache references the mesh until the render object is disposed. WebGLRenderer honours the
 *   mesh's `dispose()` event; release its WebGPU render objects on the same event.
 * - The geometry cache keeps, until the geometry is disposed, a closure over the first render
 *   object that drew it. For shared model geometry that pins one early tile per model forever;
 *   the closure only needs the attribute list, so it is handed that instead.
 */
export function installWebGpuRenderObjectRelease(renderer: WebGPURenderer): void {
  const objects = (renderer as unknown as { _objects?: RenderObjects | null })._objects;
  if (objects == null || guarded.has(objects)) return;
  guarded.add(objects);
  const owned = new WeakMap<Object3D, Set<RenderObject>>();
  const unsubscribe = new FinalizationRegistry<() => void>((detach) => detach());
  const release = (event: { target: DisposeTarget }): void => {
    event.target.removeEventListener('dispose', release);
    const mesh = event.target as unknown as Object3D;
    const renderObjects = owned.get(mesh);
    owned.delete(mesh);
    for (const renderObject of [...(renderObjects ?? [])]) renderObject.dispose();
  };
  const geometries = (renderer as unknown as { _geometries?: Geometries | null })._geometries;
  if (geometries != null) {
    const initGeometry = geometries.initGeometry;
    geometries.initGeometry = (renderObject) =>
      initGeometry.call(geometries, geometryOwner(renderObject as RenderObject));
  }
  const create = objects.createRenderObject;
  objects.createRenderObject = (...args) => {
    const renderObject = create.apply(objects, args);
    const { material, geometry } = renderObject;
    material.removeEventListener('dispose', renderObject.onMaterialDispose);
    geometry.removeEventListener('dispose', renderObject.onGeometryDispose);
    const detach = listenWeakly(new WeakRef(renderObject), material, geometry);
    unsubscribe.register(renderObject, detach, renderObject);

    let tracked: Set<RenderObject> | undefined;
    const mesh: PerObjectMesh = renderObject.object;
    if (mesh.isInstancedMesh === true || mesh.isBatchedMesh === true) {
      tracked = owned.get(mesh);
      if (tracked === undefined) {
        tracked = new Set();
        owned.set(mesh, tracked);
        (mesh as unknown as DisposeTarget).addEventListener('dispose', release);
      }
      tracked.add(renderObject);
    }
    const onDispose = renderObject.onDispose;
    renderObject.onDispose = () => {
      unsubscribe.unregister(renderObject);
      detach();
      tracked?.delete(renderObject);
      onDispose?.();
    };
    return renderObject;
  };
}

/** A stand-in that reads the live render object while it exists and its last attributes after. */
function geometryOwner(renderObject: RenderObject): GeometryOwner {
  const ref = new WeakRef(renderObject);
  const attributes = renderObject.getAttributes();
  return {
    geometry: renderObject.geometry,
    getAttributes: () => ref.deref()?.getAttributes() ?? attributes,
  };
}

/**
 * Subscribe on the render object's behalf and return the unsubscribe function. A separate scope
 * on purpose: closures share their creating scope's context, and a listener created beside
 * anything that captures the render object would retain it through that context.
 */
function listenWeakly(
  ref: WeakRef<RenderObject>,
  material: DisposeTarget,
  geometry: DisposeTarget,
): () => void {
  const onMaterial = (): void => ref.deref()?.dispose();
  const onGeometry = (): void => ref.deref()?.onGeometryDispose();
  material.addEventListener('dispose', onMaterial);
  geometry.addEventListener('dispose', onGeometry);
  return () => {
    material.removeEventListener('dispose', onMaterial);
    geometry.removeEventListener('dispose', onGeometry);
  };
}
