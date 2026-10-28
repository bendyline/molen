import type { AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';

/** Visual ownership stays with the aircraft, including after pieces leave the airframe. */
export interface AircraftDamageVisual {
  update(state: AircraftStateData): void;
  reset(): void;
}

export function createAircraftDamageVisual(
  model: THREE.Object3D,
  spec: AircraftSpec,
): AircraftDamageVisual {
  model.updateWorldMatrix(true, true);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const sections = (spec.collisionParts ?? []).map((part) => {
    const nodes: THREE.Object3D[] = [];
    model.traverse((node) => {
      if (part.nodes.includes(node.userData.name ?? node.name)) nodes.push(node);
    });
    // A named group owns its children; never clone a control twice.
    const roots = nodes.filter((node) => {
      for (let parent = node.parent; parent && parent !== model; parent = parent.parent)
        if (nodes.includes(parent)) return false;
      return true;
    });
    return { part, nodes: roots };
  });
  // Small shared meshes (markings, lamps, rivets) can straddle both wings. Partition their
  // triangles once, so they travel with the wing instead of floating beside the fuselage.
  const shared: THREE.Mesh[] = [];
  const fragments: Array<{ source: THREE.Mesh; fragment: THREE.Mesh }> = [];
  model.traverse((node) => {
    if (
      node instanceof THREE.Mesh &&
      sections.some(({ part }) => part.fragments?.nodes.includes(node.userData.name ?? node.name))
    )
      shared.push(node);
  });
  const vertex = new THREE.Vector3(),
    centroid = new THREE.Vector3();
  for (const mesh of shared) {
    const matching = sections.filter(({ part }) =>
      part.fragments?.nodes.includes(mesh.userData.name ?? mesh.name),
    );
    const matrix = new THREE.Matrix4().multiplyMatrices(modelInverse, mesh.matrixWorld);
    const source = mesh.geometry,
      positions = source.getAttribute('position');
    const count = source.index?.count ?? positions.count;
    const buckets = new Map<
      string,
      { indices: number[]; groups: Array<{ start: number; count: number; materialIndex: number }> }
    >();
    for (let i = 0; i < count; i += 3) {
      centroid.set(0, 0, 0);
      const indices = [0, 1, 2].map((j) => source.index?.getX(i + j) ?? i + j);
      for (const index of indices) centroid.add(vertex.fromBufferAttribute(positions, index));
      centroid.multiplyScalar(1 / 3).applyMatrix4(matrix);
      const owner = matching.find(({ part }) => {
        const bounds = part.fragments;
        return (
          bounds &&
          centroid.x >= bounds.min[0] &&
          centroid.x <= bounds.max[0] &&
          centroid.y >= bounds.min[1] &&
          centroid.y <= bounds.max[1] &&
          centroid.z >= bounds.min[2] &&
          centroid.z <= bounds.max[2]
        );
      });
      const key = owner?.part.id ?? '';
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { indices: [], groups: [] };
        buckets.set(key, bucket);
      }
      const materialIndex =
        source.groups.find((group) => i >= group.start && i < group.start + group.count)
          ?.materialIndex ?? 0;
      const last = bucket.groups.at(-1);
      if (last?.materialIndex === materialIndex) last.count += 3;
      else bucket.groups.push({ start: bucket.indices.length, count: 3, materialIndex });
      bucket.indices.push(...indices);
    }
    for (const [key, bucket] of buckets) {
      const fragment = mesh.clone(false);
      fragment.name = `section:${key || 'body'}:${mesh.name}`;
      fragment.geometry = source.clone();
      fragment.geometry.setIndex(bucket.indices);
      fragment.geometry.clearGroups();
      for (const group of bucket.groups)
        fragment.geometry.addGroup(group.start, group.count, group.materialIndex);
      mesh.parent?.add(fragment);
      fragments.push({ source: mesh, fragment });
      sections.find(({ part }) => part.id === key)?.nodes.push(fragment);
    }
    mesh.visible = false;
  }
  const hidden = new Map<THREE.Object3D, boolean>();
  const pieces = new Map<string, THREE.Group>();
  const inverse = new THREE.Matrix4();
  const pose = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const reset = (): void => {
    for (const [node, visible] of hidden) node.visible = visible;
    hidden.clear();
    for (const { source, fragment } of fragments) fragment.material = source.material;
    // Clones share the originals' geometry/materials, disposed with the complete model.
    for (const piece of pieces.values()) piece.removeFromParent();
    pieces.clear();
  };
  return {
    reset,
    update(state) {
      if (!state.damage && hidden.size === 0 && pieces.size === 0) return;
      for (const [node, visible] of hidden) {
        if (
          !sections.some(
            ({ part, nodes }) => state.damage?.[part.id]?.detached && nodes.includes(node),
          )
        ) {
          node.visible = visible;
          hidden.delete(node);
        }
      }
      model.updateWorldMatrix(true, true);
      model.updateMatrix();
      inverse.copy(model.matrix).invert();
      for (const { part, nodes } of sections) {
        const detached = state.damage?.[part.id]?.detached;
        const debris = detached ? state.debris?.find((piece) => piece.part === part.id) : undefined;
        let group = pieces.get(part.id);
        if (!debris && group) {
          group.removeFromParent();
          pieces.delete(part.id);
          group = undefined;
        }
        if (debris && !group) {
          group = new THREE.Group();
          group.name = `debris:${part.id}`;
          const local = new THREE.Matrix4().copy(model.matrixWorld).invert();
          const offset = new THREE.Matrix4().makeTranslation(
            -part.center[0],
            -part.center[1],
            -part.center[2],
          );
          for (const node of nodes) {
            const clone = node.clone(true);
            clone.matrixAutoUpdate = false;
            clone.matrix.copy(offset).multiply(local).multiply(node.matrixWorld);
            clone.visible = hidden.get(node) ?? node.visible;
            group.add(clone);
          }
          model.add(group);
          pieces.set(part.id, group);
        }
        if (debris && group) {
          group.matrixAutoUpdate = false;
          pose.compose(position.fromArray(debris.pos), rotation.fromArray(debris.rot), unit);
          group.matrix.copy(inverse).multiply(pose);
          group.matrixWorldNeedsUpdate = true;
        }
        for (const node of nodes) {
          if (detached) {
            if (!hidden.has(node)) hidden.set(node, node.visible);
            // Applied after gear/control animation, so another binding cannot resurrect a wing.
            node.visible = false;
          }
        }
      }
    },
  };
}
