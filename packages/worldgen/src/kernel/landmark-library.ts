import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import { landmarkCatalogSchema, landmarkSchema } from './landmark-docs';
import type {
  LandmarkCatalogDoc,
  LandmarkDefinitions,
  LandmarkDoc,
  SignDesign,
} from './landmark-types';

// Landmark models (signs, street furniture) as content: loaded from wherever the host keeps them
// and handed to the generators, instead of being compiled into this package. Construction is
// synchronous; reading the documents (resolveLandmarkCatalogDocuments, a pack) happens before.

/** Landmark documents as loaded: the catalog and its model documents by catalog key. */
export interface LandmarkDocs {
  catalog: unknown;
  models: Readonly<Record<string, unknown>>;
}

export interface LandmarkLibrary {
  /** Hash over the catalog and every model document; a cache key for generated models. */
  readonly hash: string;
  /** The catalog's version; model caches key on it. */
  readonly version: number;
  readonly catalog: LandmarkCatalogDoc;
  readonly definitions: LandmarkDefinitions;
  /** Sign designs by short name (`sign.grocery` is `grocery`). */
  readonly signDesigns: Readonly<Record<string, SignDesign>>;
  get(id: string): LandmarkDoc | undefined;
}

/** Validate landmark documents and derive what the generators read from them. */
export function createLandmarkLibrary(docs: LandmarkDocs): LandmarkLibrary {
  const catalog = landmarkCatalogSchema.parse(docs.catalog);
  for (const key of Object.keys(docs.models)) {
    if (!Object.hasOwn(catalog.models, key)) {
      throw new Error(`landmark model "${key}" is not listed in the landmark catalog`);
    }
  }
  const definitions: Record<string, LandmarkDoc> = {};
  for (const key of Object.keys(catalog.models)) {
    if (!Object.hasOwn(docs.models, key)) {
      throw new Error(`the landmark catalog lists "${key}" but no document was given for it`);
    }
    const raw = docs.models[key];
    const doc = landmarkSchema.parse(raw);
    if (doc.id !== key) throw new Error(`landmark catalog key ${key} does not match ${doc.id}`);
    if (doc.generator === 'sign' && !key.startsWith('sign.')) {
      throw new Error(`sign model id must start with sign.: ${key}`);
    }
  }
  // Keep the documents as given (validated above): parsing must not change what generators read.
  for (const [key, raw] of Object.entries(docs.models)) definitions[key] = raw as LandmarkDoc;
  const signDesigns = Object.fromEntries(
    Object.values(definitions)
      .filter((doc) => doc.generator === 'sign')
      .map((doc) => [doc.id.slice(5), (doc as Extract<LandmarkDoc, { generator: 'sign' }>).sign]),
  );
  return {
    hash: hashJson({ catalog: docs.catalog, models: docs.models } as unknown as JsonValue),
    version: catalog.version,
    catalog: docs.catalog as LandmarkCatalogDoc,
    definitions,
    signDesigns,
    get: (id) => (Object.hasOwn(definitions, id) ? definitions[id] : undefined),
  };
}
