import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { landmarkCatalogSchema, landmarkSchema } from './landmark-docs';

// Documentation examples only; the landmarks themselves are content loaded by the host.
const SIGN_EXAMPLE = {
  format: 'molen/landmark@1',
  id: 'sign.grocery',
  version: 1,
  title: 'GROCERY',
  generator: 'sign',
  sign: {
    text: 'GROCERY',
    background: '#315949',
    foreground: '#f5f0df',
    mark: '#d7ac59',
    symbol: 'letters',
    letters: 'G',
  },
  appearance: { wall: '#ccc4b4', accent: '#315949' },
  storefront: { width: 18, sharedWidth: 9 },
} satisfies JsonValue;

const CATALOG_EXAMPLE = {
  format: 'molen/landmark-catalog@1',
  version: 3,
  models: {
    'sign.grocery': 'grocery.landmark.json',
    bench: 'bench.landmark.json',
    street_lamp: 'street_lamp.landmark.json',
  },
} satisfies JsonValue;

export function registerLandmarkSchemas(): void {
  if (!getSchema('landmark'))
    registerSchema('landmark', landmarkSchema, {
      id: 'molen/landmark@1',
      title: 'Landmark model',
      description:
        'Reusable sign or furniture geometry recipe, with colors, facade appearance and detail levels.',
      examples: [SIGN_EXAMPLE],
      docsRef: 'guide/recognizable-places.md',
    });
  if (!getSchema('landmark-catalog'))
    registerSchema('landmark-catalog', landmarkCatalogSchema, {
      id: 'molen/landmark-catalog@1',
      title: 'Landmark catalog',
      description: 'An index of reusable external landmark model manifests.',
      examples: [CATALOG_EXAMPLE],
      docsRef: 'guide/recognizable-places.md',
    });
}
