import { readFileSync } from 'node:fs';
import type { AircraftData } from '@bendyline/molen-schema';
import { createTypeLibrary } from '../../src/type-library';

// Tests read the molen.entities type documents from the repository's content directory; no
// package ships them.
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

/** Resolved aircraft data for one of the molen.entities aircraft. */
export function molenAircraft(id: string): AircraftData {
  return types.component<AircraftData>(id, 'aircraft');
}
