/** Convenience: one styled building as a three.js object, straight from an outline. */

import type * as THREE from 'three';
import type { ArchStyleDoc } from '../kernel/archstyle-types';
import { generateBuilding } from '../kernel/building';
import { MeshBufferBuilder } from '../kernel/mesh-buffers';
import type { PackIdentity } from '../kernel/seed';
import {
  type BuildingRequest,
  FLAT_GROUND,
  type HeightSampler,
  PLACEMENT_STRIDE,
} from '../kernel/types';
import { createInstancedPlacements, unitBoxGeometry } from './instanced-box';
import { buffersToObject3D, type WorldgenMaterialSet } from './upload';

export interface BuildingObjectOptions {
  materials: WorldgenMaterialSet;
  ground?: HeightSampler;
  tier?: number;
}

/** Returns a mesh (or an instanced box beyond the last detail tier), or undefined when skipped. */
export function createBuildingObject(
  request: BuildingRequest,
  style: ArchStyleDoc,
  pack: PackIdentity,
  options: BuildingObjectOptions,
): THREE.Object3D | undefined {
  const out = new MeshBufferBuilder();
  const result = generateBuilding(
    { request, style, pack, ground: options.ground ?? FLAT_GROUND, tier: options.tier ?? 0 },
    out,
  );
  if (result.skipped !== undefined) return undefined;
  if (result.box !== undefined) {
    const data = new Float32Array(PLACEMENT_STRIDE);
    data.set([
      result.box.x,
      result.box.y,
      result.box.z,
      result.box.yaw,
      result.box.sx,
      result.box.sy,
      result.box.sz,
      ...result.box.color,
    ]);
    return createInstancedPlacements(
      { setId: 'building', modelRef: 'builtin:box', count: 1, data },
      unitBoxGeometry(),
      options.materials.materialFor('wall', 'palette:#ffffff'),
      `worldgen:${request.identity}`,
    );
  }
  return buffersToObject3D(out.finalize(), options.materials, `worldgen:${request.identity}`);
}
