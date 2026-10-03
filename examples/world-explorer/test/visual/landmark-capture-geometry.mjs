/** Count the actual default-scene mesh instances, not just unique mesh resources.
 * Asset sidecar stats describe the stored meshes; multiple nodes may reuse one mesh.
 */
export function landmarkSceneTriangles(gltf, { expandGpuInstances = true } = {}) {
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  if (!scene) throw new Error('Landmark GLB needs a default scene');
  const active = new Set();
  function visit(index) {
    const node = gltf.nodes?.[index];
    if (!node || active.has(index)) throw new Error('Invalid or cyclic landmark scene graph');
    active.add(index);
    let triangles = 0;
    if (node.mesh !== undefined) {
      const mesh = gltf.meshes?.[node.mesh];
      if (!mesh) throw new Error('Missing landmark mesh');
      for (const primitive of mesh.primitives) {
        const accessor = gltf.accessors?.[primitive.indices ?? primitive.attributes?.POSITION];
        if (!accessor || !Number.isInteger(accessor.count) || accessor.count < 0)
          throw new Error('Missing landmark geometry accessor');
        const mode = primitive.mode ?? 4;
        triangles +=
          mode === 4
            ? Math.floor(accessor.count / 3)
            : mode === 5 || mode === 6
              ? Math.max(0, accessor.count - 2)
              : 0;
      }
      const instances = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
      if (instances) {
        const counts = Object.values(instances).map((i) => gltf.accessors?.[i]?.count);
        if (!counts.length || counts.some((n) => !Number.isInteger(n) || n < 0 || n !== counts[0]))
          throw new Error('Invalid landmark GPU instances');
        if (expandGpuInstances) triangles *= counts[0];
      }
    }
    for (const child of node.children ?? []) triangles += visit(child);
    active.delete(index);
    return triangles;
  }
  return (scene.nodes ?? []).reduce((sum, index) => sum + visit(index), 0);
}
