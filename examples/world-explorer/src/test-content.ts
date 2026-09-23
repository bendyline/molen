/// <reference types="vite/client" />
/** Tests only: the repository's content read straight from disk, as the packs would carry it. */
import { createTypeLibrary, type TypeLibrary } from '@bendyline/molen-kernel/content';
import { createPlacesContent, type PlacesContent } from '@bendyline/molen-worldgen-earth/kernel';
import businessesRaw from '../../../content/earth/businesses/catalog.json?raw';
import aircraftRaw from '../../../content/entities/types/aircraft.types.json?raw';
import entitiesRaw from '../../../content/entities/types/entities.types.json?raw';
import vehicleRaw from '../../../content/entities/types/vehicle.types.json?raw';
import landmarkCatalogRaw from '../../../content/worldgen/landmarks/catalog.json?raw';

const landmarkFiles = import.meta.glob<string>('../../../content/worldgen/landmarks/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The molen.entities type documents as a type library. */
export const ENTITY_TYPES: TypeLibrary = createTypeLibrary(
  [entitiesRaw, aircraftRaw, vehicleRaw].map((raw) => JSON.parse(raw)),
);

/** The default landmarks and the Earth business catalog. */
export function placesContent(): PlacesContent {
  const catalog = JSON.parse(landmarkCatalogRaw) as { models: Record<string, string> };
  const models = Object.fromEntries(
    Object.entries(catalog.models).map(([id, path]) => {
      const raw = landmarkFiles[`../../../content/worldgen/landmarks/${path}`];
      if (raw === undefined) throw new Error(`landmark ${id}: ${path} is missing`);
      return [id, JSON.parse(raw)];
    }),
  );
  return createPlacesContent({
    landmarks: { catalog, models },
    businesses: JSON.parse(businessesRaw),
  });
}
