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

/**
 * The molen.entities vehicles, in type-document order, as a host with the pack builds its
 * default list: region-only types (an `ambientRole.weight` of 0, such as the auto-rickshaw)
 * park only where a regional fleet weights them.
 */
export const PARKED_VEHICLES: readonly TerrainParkedVehicle[] = types
  .idsWith('vehicle')
  .filter(
    (id) => (types.components(id).ambientRole as { weight?: number } | undefined)?.weight !== 0,
  )
  .map((id) => ({ id, spec: types.component<VehicleData>(id, 'vehicle').spec }));
