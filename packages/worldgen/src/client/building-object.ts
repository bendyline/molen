/** Convenience: one styled building as a three.js object, straight from an outline. */

import * as THREE from 'three';
import type { ArchStyleDoc } from '../kernel/archstyle-types';
import { generateBuilding } from '../kernel/building';
import { MeshBufferBuilder } from '../kernel/mesh-buffers';
import type { PackIdentity } from '../kernel/seed';
import {
  type BuildingRequest,
  FLAT_GROUND,
  type HeightSampler,
  PLACEMENT_STRIDE,
  type RGB,
} from '../kernel/types';
import { buildingBoxGeometry, createInstancedPlacements, unitBoxGeometry } from './instanced-box';
import { buffersToObject3D, type WorldgenMaterialSet } from './upload';

export interface BuildingObjectOptions {
  materials: WorldgenMaterialSet;
  ground?: HeightSampler;
  tier?: number;
}

/**
 * Returns a mesh, or beyond the last detail tier an instanced box (a group of walls and roof for
 * a pitched building), or undefined when skipped.
 */
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
    const box = result.box;
    const material = options.materials.materialFor('wall', 'palette:#ffffff');
    const instance = (modelRef: string, y: number, height: number, color: RGB, name: string) => {
      const data = new Float32Array(PLACEMENT_STRIDE);
      data.set([box.x, y, box.z, box.yaw, box.sx, height, box.sz, ...color]);
      return createInstancedPlacements(
        { setId: 'building', modelRef, count: 1, data },
        buildingBoxGeometry(modelRef) ?? unitBoxGeometry(),
        material,
        name,
      );
    };
    const walls = instance('builtin:box', box.y, box.sy, box.color, `worldgen:${request.identity}`);
    if (box.roof !== 'gable' || !((box.roofHeight ?? 0) > 0)) return walls;
    // A pitched stand-in: its box is the walls, and its roof stands on them.
    const group = new THREE.Group();
    group.name = walls.name;
    walls.name = `${group.name}:walls`;
    group.add(
      walls,
      instance(
        'builtin:roof.gable',
        box.y + box.sy,
        box.roofHeight as number,
        box.roofColor ?? box.color,
        `${group.name}:roof`,
      ),
    );
    return group;
  }
  return buffersToObject3D(out.finalize(), options.materials, `worldgen:${request.identity}`);
}
