import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { openDirPack } from '@bendyline/molen-pack/node';
import { describe, expect, it } from 'vitest';
import {
  createMolenEntitiesAssetIndex,
  MOLEN_AIRCRAFT_ENTITY_IDS,
  MOLEN_ENTITY_IDS,
  MOLEN_VEHICLE_ENTITY_IDS,
  molenAircraft,
  molenVehicle,
} from '../src/index';

// The molen.entities pack, read the way a host reads it (built in memory from its source).
const pack = await openDirPack(
  fileURLToPath(new URL('../../../content/entities', import.meta.url)),
);
const types = createTypeLibrary(
  await Promise.all((pack.manifest.provides.types ?? []).map((path) => pack.readJson(path))),
);

// Pins the resolved components of every entity type. They moved out of this package into the
// content pack with the same digests: aircraft and vehicle numbers are spawned into world state
// and so reach the state hash.
function digest(value: unknown): string {
  const stable = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(stable).join(',')}]`
      : v !== null && typeof v === 'object'
        ? `{${Object.keys(v)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
            .join(',')}}`
        : JSON.stringify(v);
  return createHash('sha256').update(stable(value)).digest('hex').slice(0, 16);
}

const EXPECTED: Record<string, string> = {
  'molen.entities.tree.conifer.pine': '1fc8cb1c29fb4551',
  'molen.entities.tree.conifer.fir': '3980ea8ee4564a7c',
  'molen.entities.tree.deciduous.oak': 'ea65177aeaa3769b',
  'molen.entities.tree.deciduous.birch': 'f7c7fe60979b33a9',
  'molen.entities.vegetation.shrub': 'cf7b14bc177a1179',
  'molen.entities.nature.boulder': 'd5024b7e67235a24',
  'molen.entities.aircraft.p51d': '763c02ab57af3a70',
  // Re-pinned when the OH-6 was renamed from `h500md`: only its own id and script path changed.
  'molen.entities.aircraft.oh6': '7739baef99209b0b',
  'molen.entities.vehicle.compact': 'bb880d241b7b9fe6',
  'molen.entities.vehicle.sedan': 'da38b9c7f244b008',
  'molen.entities.vehicle.suv': 'e6911853a1adfc0f',
  'molen.entities.vehicle.pickup': 'c921e8481fcc853f',
  'molen.entities.vehicle.van': 'f5f95b1ec7c8bb4f',
};

describe('entity content parity', () => {
  it('resolves every entity type in the pack to its pinned components', () => {
    const actual = Object.fromEntries(
      MOLEN_ENTITY_IDS.map((id) => [id, digest(types.components(id))]),
    );
    expect(actual).toEqual(EXPECTED);
  });

  it('names exactly the pack’s models, at the pack’s paths', () => {
    expect(Object.keys(pack.manifest.ids).sort()).toEqual([...MOLEN_ENTITY_IDS].sort());
    const index = createMolenEntitiesAssetIndex('https://assets.example/');
    for (const id of MOLEN_ENTITY_IDS) {
      expect(index[id]).toBe(`https://assets.example/${pack.manifest.ids[id]}`);
    }
    expect(types.idsWith('aircraft')).toEqual([...MOLEN_AIRCRAFT_ENTITY_IDS]);
    expect(types.idsWith('vehicle')).toEqual([...MOLEN_VEHICLE_ENTITY_IDS]);
    expect(molenAircraft(types, 'molen.entities.aircraft.p51d').spec).toBeDefined();
    expect(molenVehicle(types, 'molen.entities.vehicle.van').spec).toBeDefined();
  });
});
