/**
 * Worldgen as a kernel-side service: an index of generated buildings and props registered on a
 * world through a WeakMap side channel (never part of world state or its hash, like terrain's
 * ground field), plus the script-API namespace that exposes it to scene scripts.
 */

import type { World } from '@bendyline/molen-kernel';
import type { BuildingHit, PropHit, WorldgenIndex } from './index-query';
import type { BuildingRecord } from './types';

export interface WorldgenHandle {
  readonly index: WorldgenIndex;
  buildingAt(x: number, z: number): BuildingRecord | undefined;
  buildingsNear(x: number, z: number, radius: number): BuildingHit[];
  propsNear(x: number, z: number, radius: number): PropHit[];
}

const indices = new WeakMap<World, WorldgenIndex>();

/** The worldgen index registered on a world (by installWorldgen), if any. */
export function worldgenIndexOf(world: World): WorldgenIndex | undefined {
  return indices.get(world);
}

/**
 * Register a worldgen index on a world and get the query handle. Generated geometry never
 * enters world state; scripts and systems query the index through the handle.
 */
export function installWorldgen(world: World, index: WorldgenIndex): WorldgenHandle {
  indices.set(world, index);
  return {
    index,
    buildingAt: (x, z) => index.buildingAt(x, z),
    buildingsNear: (x, z, radius) => index.buildingsNear(x, z, radius),
    propsNear: (x, z, radius) => index.propsNear(x, z, radius),
  };
}

/** Script-facing namespace: `molen.worldgen.buildingAt(x, z)` and friends. */
export function worldgenScriptApi(handle: WorldgenHandle): object {
  return {
    buildingAt: (x: number, z: number): BuildingRecord | undefined => handle.buildingAt(x, z),
    buildingsNear: (x: number, z: number, radius: number): BuildingHit[] =>
      handle.buildingsNear(x, z, radius),
    propsNear: (x: number, z: number, radius: number): PropHit[] => handle.propsNear(x, z, radius),
    buildingCount: (): number => handle.index.buildingCount,
    propCount: (): number => handle.index.propCount,
  };
}
