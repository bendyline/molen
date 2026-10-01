/** Spatial building batches retain structural faces and windows at every detail level. */
import * as THREE from 'three';
import { type PreparedBuildingCell, prepareBuildingCells } from '../kernel/building-cells';
import type { MeshBuffers } from '../kernel/types';
import { packedColorAttribute, packedNormalAttribute } from './color-attribute';
import { bindMaterialGroups } from './material-groups';
import { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './screen-space-lod';
import type { WorldgenMaterialSet } from './upload';

/** Three detail levels share compact cell-local attributes and full-detail indices. */
export function createBuildingDetailLod(
  buffers: MeshBuffers,
  materials: WorldgenMaterialSet,
  flatMaterial: THREE.Material,
  policy: ScreenSpaceLodPolicy,
  name = 'worldgen:buildings',
  cellSize = 512,
  prepared?: readonly PreparedBuildingCell[],
): THREE.Group {
  if (!Number.isFinite(cellSize) || cellSize <= 0)
    throw new RangeError('Building cell size must be finite and positive');
  const root = new THREE.Group();
  root.name = name;
  for (const cell of prepared ?? prepareBuildingCells(buffers, cellSize)) {
    root.add(createBuildingCellLod(cell, materials, flatMaterial, policy, name));
  }
  return root;
}

/** Small admission unit: no triangle partition, remapping, or LOD-index construction here. */
export function createBuildingCellLod(
  cell: PreparedBuildingCell,
  materials: WorldgenMaterialSet,
  flatMaterial: THREE.Material,
  policy: ScreenSpaceLodPolicy,
  name = 'worldgen:buildings',
): ScreenSpaceLod {
  const bounds = new THREE.Box3(
    new THREE.Vector3(...cell.bounds.slice(0, 3)),
    new THREE.Vector3(...cell.bounds.slice(3)),
  );
  const center = new THREE.Vector3(...cell.center);
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  // Quantized cell space: offsets from the center in units of the cell's uniform scale.
  const scale = cell.positionScale;
  // One unit of slack: rounding can put a vertex half a unit past its exact offset.
  const localBounds = new THREE.Box3(
    bounds.min.clone().sub(center).divideScalar(scale),
    bounds.max.clone().sub(center).divideScalar(scale),
  ).expandByScalar(1);
  const attributes = {
    position: new THREE.BufferAttribute(cell.positions, 3),
    normal: packedNormalAttribute(cell.normals),
    uv: new THREE.BufferAttribute(cell.uvs, 2),
    color: packedColorAttribute(cell.colors),
  };
  const fullIndex = new THREE.BufferAttribute(cell.indices, 1);
  const lod = new ScreenSpaceLod(policy, radius);
  lod.name = `${name}:${cell.key}`;
  lod.position.copy(center);
  lod.updateMatrix();
  lod.matrixAutoUpdate = false;
  for (let detail = 0; detail < 3; detail++) {
    const geometry = new THREE.BufferGeometry();
    for (const [key, value] of Object.entries(attributes)) geometry.setAttribute(key, value);
    geometry.setIndex(
      detail === 2 ? new THREE.BufferAttribute(cell.structuralIndices, 1) : fullIndex,
    );
    const list = detail === 0 ? bindMaterialGroups(geometry, cell.groups, materials) : flatMaterial;
    geometry.boundingBox = localBounds.clone();
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius / scale + 1);
    const mesh = new THREE.Mesh(geometry, list);
    mesh.name = `${lod.name}:lod${detail}`;
    mesh.scale.setScalar(scale);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    // The middle level is the same geometry; its shadows keep a street from flattening out.
    mesh.castShadow = detail <= 1;
    mesh.userData.worldgenOwnedGeometry = true;
    lod.addDetail(mesh, [0, 0.35, 0.9][detail] as number);
  }
  return lod;
}
