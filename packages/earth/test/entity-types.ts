// Tests only: the molen.entities type documents read straight from the repository's content.
import { readFileSync } from 'node:fs';
import { createTypeLibrary, type TypeLibrary } from '@bendyline/molen-kernel/content';

const read = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../content/entities/types/${name}`, import.meta.url), 'utf8'),
  );

export const ENTITY_TYPES: TypeLibrary = createTypeLibrary(
  ['entities.types.json', 'aircraft.types.json', 'vehicle.types.json'].map(read),
);
