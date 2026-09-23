import { readFileSync } from 'node:fs';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import type { VehicleData } from '@bendyline/molen-schema';
import type { TerrainParkedVehicle } from '../../src/surface-styles';

// Tests read the repository's content directly; the package itself ships none.
const types = createTypeLibrary(
  ['entities', 'aircraft', 'vehicle'].map((name) =>
    JSON.parse(
      readFileSync(
        new URL(`../../../../content/entities/types/${name}.types.json`, import.meta.url),
        'utf8',
      ),
    ),
  ),
);

/** The molen.entities vehicles, in type-document order, as a host with the pack builds them. */
export const PARKED_VEHICLES: readonly TerrainParkedVehicle[] = types
  .idsWith('vehicle')
  .map((id) => ({ id, spec: types.component<VehicleData>(id, 'vehicle').spec }));
