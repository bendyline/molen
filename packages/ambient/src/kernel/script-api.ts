/**
 * `molen.ambient.*`: the script-facing namespace over an ambient handle. Reads come from the
 * network and world; writes go through components (observer, policy) so they are replayed and
 * hashed. Tile registration is host-only.
 */

import type { EntityId } from '@bendyline/molen-schema';
import type { AmbientKind } from './components';
import type { AmbientPolyline } from './graph/network';
import type { TransportClass } from './graph/types';
import type { AmbientHandle } from './install';
import type { AmbientPolicy, DeepPartial } from './spawn/policy';

/** The script-api namespace for ambient life (`molen.ambient.*`); pass via `buildWorld` capabilities. */
export function ambientScriptApi(handle: AmbientHandle): object {
  return {
    stats: () => handle.stats(),
    setObserver: (
      target: EntityId | { pos: [number, number, number]; forward?: [number, number] } | null,
    ): void => handle.setObserver(typeof target === 'string' ? { entity: target } : target),
    setPolicy: (policy: DeepPartial<AmbientPolicy>): void => handle.setPolicy(policy),
    laneAt: (x: number, z: number, opts?: { class?: TransportClass; radius?: number }) =>
      handle.laneAt(x, z, opts),
    laneSample: (lane: string, s: number) => {
      const sample = handle.laneSample(lane, s);
      return sample === undefined
        ? undefined
        : { pos: [sample.x, sample.y, sample.z], dir: [sample.dx, sample.dz], grade: sample.grade };
    },
    agentsNear: (x: number, z: number, radius: number, kind?: AmbientKind): EntityId[] =>
      handle.agentsNear(x, z, radius, kind),
    addRoad: (
      points: ([number, number] | [number, number, number])[],
      opts: Omit<AmbientPolyline, 'points' | 'class'> = {},
    ): void => handle.addPolyline({ ...opts, class: 'road', points }),
    addPolyline: (line: AmbientPolyline): void => handle.addPolyline(line),
    despawnAll: (kind?: AmbientKind): void => handle.despawnAll(kind),
  };
}
