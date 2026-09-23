import {
  createLandmarkLibrary,
  type LandmarkDocs,
  type LandmarkLibrary,
} from '@bendyline/molen-worldgen/kernel';
import { type BusinessCatalog, createBusinessCatalog } from './business-catalog';

// The content that makes mapped places recognizable: landmark models (signs, street furniture)
// and the business catalog that maps real identities onto them. Loaded by the host and passed to
// generation, instead of being compiled into these packages.

/** Places content as loaded documents; plain data, so it can be posted to a Worker. */
export interface PlacesContentDocs {
  landmarks: LandmarkDocs;
  /** A molen/business-catalog@1 document. */
  businesses: unknown;
}

export interface PlacesContent {
  readonly landmarks: LandmarkLibrary;
  readonly businesses: BusinessCatalog;
}

/** Validate places documents and build the libraries generation reads. */
export function createPlacesContent(docs: PlacesContentDocs): PlacesContent {
  const landmarks = createLandmarkLibrary(docs.landmarks);
  return { landmarks, businesses: createBusinessCatalog(docs.businesses, landmarks) };
}
