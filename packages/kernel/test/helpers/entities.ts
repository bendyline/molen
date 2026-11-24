import { readFileSync } from 'node:fs';
import type { AircraftData, AircraftSpec, VehicleData } from '@bendyline/molen-schema';
import { createTypeLibrary } from '../../src/type-library';

// Tests read the molen.entities type documents from the repository's content directory; no
// package ships them.
const types = createTypeLibrary(
  ['entities', 'aircraft', 'vehicle', 'cycle'].map((name) =>
    JSON.parse(
      readFileSync(
        new URL(`../../../../content/entities/types/${name}.types.json`, import.meta.url),
        'utf8',
      ),
    ),
  ),
);

/** Resolved aircraft data for one of the molen.entities aircraft. */
export function molenAircraft(id: string): AircraftData {
  return types.component<AircraftData>(id, 'aircraft');
}

/**
 * A helicopter on the assisted model: its spec without the rotor block. The shipped helicopters
 * fly on their rotors (helicopter-rotor.test.ts); the assisted model is what a helicopter
 * without one flies on, and the tests that pin it take their specs through this.
 */
export function assistedHelicopter(spec: AircraftSpec): AircraftSpec {
  if (!spec.helicopter?.rotor) return spec;
  const { rotor: _rotor, ...helicopter } = spec.helicopter;
  return { ...spec, helicopter };
}

/** Resolved vehicle data for one of the molen.entities cars. */
export function molenVehicle(id: string): VehicleData {
  return types.component<VehicleData>(id, 'vehicle');
}
