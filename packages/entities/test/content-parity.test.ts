import { fileURLToPath } from 'node:url';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { openDirPack } from '@bendyline/molen-pack/node';
import { describe, expect, it } from 'vitest';
import {
  createMolenEntitiesAssetIndex,
  MOLEN_AIRCRAFT_ENTITY_IDS,
  MOLEN_AMBIENT_AIRCRAFT_ENTITY_IDS,
  MOLEN_CYCLE_ENTITY_IDS,
  MOLEN_ENTITY_IDS,
  MOLEN_RAIL_ENTITY_IDS,
  MOLEN_RV_ENTITY_IDS,
  MOLEN_TRANSIT_ENTITY_IDS,
  MOLEN_VEHICLE_ENTITY_IDS,
  molenAircraft,
  molenVehicle,
} from '../src/index';

// The molen.entities pack, read the way a host reads it (built in memory from its source).
const pack = await openDirPack(
  fileURLToPath(new URL('../../../content/entities', import.meta.url)),
);
const typeDocs = await Promise.all(
  (pack.manifest.provides.types ?? []).map((path) => pack.readJson(path)),
);
const types = createTypeLibrary(typeDocs);

describe('entity content parity', () => {
  it('builds the same library with structure checks, as hosts serving built packs do', () => {
    const skipped: string[] = [];
    const structure = createTypeLibrary(typeDocs, {
      checks: 'structure',
      onSkip: (message) => skipped.push(message),
    });
    expect(skipped).toEqual([]);
    expect(structure.ids()).toEqual(types.ids());
    expect(structure.hash).toBe(types.hash);
  });

  // Invariants, not pinned digests: content may change freely as long as every type still
  // resolves to a placeable model of its own id. Component shapes are validated against their
  // schemas by the tooling tests, which load this pack with every component registered.
  it('resolves every entity type to a placeable model of its own id', () => {
    for (const id of MOLEN_ENTITY_IDS) {
      const components = types.components(id) as Record<string, Record<string, unknown>>;
      expect(components.transform, id).toBeDefined();
      expect(components.renderable?.kind, id).toBe('gltf');
      expect(components.renderable?.ref, id).toBe(id);
    }
  });

  it('gives vehicles ambient roles and keeps RVs in the large road-vehicle category', () => {
    const roles = new Set(types.idsWith('ambientRole'));
    for (const id of [
      ...MOLEN_VEHICLE_ENTITY_IDS,
      ...MOLEN_AIRCRAFT_ENTITY_IDS,
      ...MOLEN_AMBIENT_AIRCRAFT_ENTITY_IDS,
      ...MOLEN_TRANSIT_ENTITY_IDS,
    ])
      expect(roles.has(id), id).toBe(true);
    for (const id of MOLEN_RV_ENTITY_IDS)
      expect(types.component(id, 'ambientRole')).toMatchObject({ role: 'bus' });
  });

  it('names exactly the pack’s models, at the pack’s paths', () => {
    expect(Object.keys(pack.manifest.ids).sort()).toEqual([...MOLEN_ENTITY_IDS].sort());
    const index = createMolenEntitiesAssetIndex('https://assets.example/');
    for (const id of MOLEN_ENTITY_IDS) {
      expect(index[id]).toBe(`https://assets.example/${pack.manifest.ids[id]}`);
    }
    expect(types.idsWith('aircraft')).toEqual([...MOLEN_AIRCRAFT_ENTITY_IDS]);
    expect(types.idsWith('vehicle')).toEqual([
      ...MOLEN_VEHICLE_ENTITY_IDS,
      ...MOLEN_CYCLE_ENTITY_IDS,
      ...MOLEN_RAIL_ENTITY_IDS,
    ]);
    expect(molenAircraft(types, 'molen.entities.aircraft.p51d').spec).toBeDefined();
    expect(molenVehicle(types, 'molen.entities.vehicle.van').spec).toBeDefined();
  });
});
