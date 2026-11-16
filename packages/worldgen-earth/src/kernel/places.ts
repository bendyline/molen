import {
  createGlyphAtlasSet,
  createLandmarkLibrary,
  type LandmarkDocs,
  type LandmarkLibrary,
} from '@bendyline/molen-worldgen/kernel';
import { type BusinessCatalog, createBusinessCatalog } from './business-catalog';
import { createSignNamer, type SignNamer } from './sign-names';

// The content that makes mapped places recognizable: landmark models (signs, street furniture)
// and the business catalog that maps real identities onto them. Loaded by the host and passed to
// generation, instead of being compiled into these packages.

/** Places content as loaded documents; plain data, so it can be posted to a Worker. */
export interface PlacesContentDocs {
  landmarks: LandmarkDocs;
  /** A molen/business-catalog@1 document. */
  businesses: unknown;
  /** A molen/sign-looks@1 document: how mapped names are set on storefront signs. */
  signLooks?: unknown;
  /**
   * molen/glyph-atlas@1 documents, in fallback order: the metrics names are laid out with. The
   * page pixels stay with the renderer.
   */
  glyphs?: unknown[];
  /**
   * `real` (the default) shows mapped names on signs when `signLooks` and `glyphs` are present;
   * `generic` keeps every sign's descriptor text, as without them.
   */
  signNames?: 'real' | 'generic';
}

export interface PlacesContent {
  readonly landmarks: LandmarkLibrary;
  readonly businesses: BusinessCatalog;
  /** Present when signs show mapped names (see `PlacesContentDocs.signNames`). */
  readonly signs?: SignNamer;
}

/** Validate places documents and build the libraries generation reads. */
export function createPlacesContent(docs: PlacesContentDocs): PlacesContent {
  const landmarks = createLandmarkLibrary(docs.landmarks);
  const businesses = createBusinessCatalog(docs.businesses, landmarks);
  const named =
    docs.signNames !== 'generic' &&
    docs.signLooks !== undefined &&
    docs.glyphs !== undefined &&
    docs.glyphs.length > 0;
  return {
    landmarks,
    businesses,
    ...(named
      ? {
          signs: createSignNamer(
            docs.signLooks,
            createGlyphAtlasSet(docs.glyphs as unknown[]),
            businesses,
            landmarks.definitions,
          ),
        }
      : {}),
  };
}
