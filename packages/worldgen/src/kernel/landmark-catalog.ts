/** The shipped snapshot is bundled from external, individually versioned model manifests. */
import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import catalog from '../../packs/default/landmarks/catalog.json';
import { rawLandmarkDocuments } from './landmark-manifests';
import type { LandmarkCatalogDoc, LandmarkDefinitions } from './landmark-types';

export const LANDMARK_CATALOG: LandmarkCatalogDoc = catalog as LandmarkCatalogDoc;
// The pack build validates every source manifest and catalog reference.
export const LANDMARK_DEFINITIONS: LandmarkDefinitions =
  rawLandmarkDocuments as LandmarkDefinitions;
export const LANDMARK_CATALOG_HASH: string = hashJson({
  catalog,
  models: rawLandmarkDocuments,
} as unknown as JsonValue);
