import { readFileSync } from 'node:fs';
import type { InteriorCatalogDoc } from '../../src/kernel/interior-types';
import {
  createLandmarkLibrary,
  type LandmarkDocs,
  type LandmarkLibrary,
} from '../../src/kernel/landmark-library';
import type { LandmarkDefinitions } from '../../src/kernel/landmark-types';

// Tests read the default content from the repository's content/worldgen directory, as a host
// reads it from the molen.worldgen.default pack; the package itself ships none.

/** Parse a file under content/worldgen. */
export function contentJson<T = unknown>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../../../content/worldgen/${path}`, import.meta.url), 'utf8'),
  ) as T;
}

/** The landmark catalog and its model documents, keyed as the catalog keys them. */
export const LANDMARK_DOCS: LandmarkDocs = (() => {
  const catalog = contentJson<{ models: Record<string, string> }>('landmarks/catalog.json');
  const models = Object.fromEntries(
    Object.entries(catalog.models).map(([id, path]) => [id, contentJson(`landmarks/${path}`)]),
  );
  return { catalog, models };
})();

export const LANDMARKS: LandmarkLibrary = createLandmarkLibrary(LANDMARK_DOCS);
export const LANDMARK_DEFINITIONS: LandmarkDefinitions = LANDMARKS.definitions;

/** The default interior catalog. */
export const INTERIORS: InteriorCatalogDoc = contentJson('interiors/catalog.json');
