import type * as THREE from 'three';

/** What a frame is made of, by the kinds whose cost has moved most: see `sceneComposition`. */
export interface SceneComposition {
  /** Every visible mesh. */
  meshes: number;
  triangles: number;
  /** Land cover: draped meshes and the one-texture tiles drawn in their place far away. */
  landcover: { meshes: number; textured: number; triangles: number; bytes: number };
  /** Instanced plants and props placed by the generator. */
  scatter: { batches: number; instances: number; triangles: number };
}

/**
 * Count what is visible under `root`, for the performance scoreboard
 * (`test/performance/run-scoreboard.mjs`). It walks every visible object: for a settled view or the
 * end of a flight, not for every frame. Bytes are a mesh's own attribute, index and texture
 * arrays; arrays shared between meshes count once.
 */
export function sceneComposition(root: THREE.Object3D): SceneComposition {
  const result: SceneComposition = {
    meshes: 0,
    triangles: 0,
    landcover: { meshes: 0, textured: 0, triangles: 0, bytes: 0 },
    scatter: { batches: 0, instances: 0, triangles: 0 },
  };
  const counted = new Set<ArrayBufferLike>();
  const bytesOf = (view: { buffer: ArrayBufferLike } | undefined | null): number => {
    if (view === undefined || view === null || counted.has(view.buffer)) return 0;
    counted.add(view.buffer);
    return view.buffer.byteLength;
  };
  root.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    // A material switched off (night windows by day) is skipped by the renderer too.
    if (material === undefined || !material.visible) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    if (position === undefined) return;
    const range = geometry.drawRange;
    let count = geometry.index?.count ?? position.count;
    if (Number.isFinite(range.count))
      count = Math.max(0, Math.min(count - range.start, range.count));
    const instanced = mesh as THREE.InstancedMesh;
    const instances = instanced.isInstancedMesh ? instanced.count : 1;
    const triangles = (count / 3) * instances;
    result.meshes++;
    result.triangles += triangles;
    if (mesh.name === 'semantic:landcover') {
      const cover = result.landcover;
      cover.meshes++;
      cover.triangles += triangles;
      if (mesh.userData.terrainLandcoverRaster === true) cover.textured++;
      for (const attribute of Object.values(geometry.attributes)) {
        const data = (attribute as THREE.InterleavedBufferAttribute).data;
        cover.bytes += bytesOf(
          data !== undefined ? data.array : (attribute as THREE.BufferAttribute).array,
        );
      }
      // The index of a textured tile is the terrain's shared topology: counted once, like any.
      cover.bytes += bytesOf(geometry.index?.array);
      const map = (material as THREE.MeshStandardMaterial).map as THREE.DataTexture | null;
      cover.bytes += bytesOf(map?.image?.data as Uint8Array | undefined);
      return;
    }
    if (!instanced.isInstancedMesh) return;
    for (
      let parent = mesh.parent, depth = 0;
      parent !== null && depth < 4;
      parent = parent.parent, depth++
    )
      if (parent.name.startsWith('worldgen-scatter')) {
        result.scatter.batches++;
        result.scatter.instances += instances;
        result.scatter.triangles += triangles;
        break;
      }
  });
  return result;
}
