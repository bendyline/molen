import { describe, expect, it } from 'vitest';
import { PLACES } from './helpers/pack';

// Pins the business catalog identity. It is a renderer cache key, and the catalog decides which
// generic storefront a mapped business gets. It moved into the molen.earth pack unchanged.
// Generated geometry is pinned separately by the us-retail and sammamish fixture tests.
describe('earth content parity', () => {
  it('keeps the business catalog hash', () => {
    expect(PLACES.businesses.hash).toBe(
      'sha256:68e93df7a0e1b17030909c2b5d80cd91ea550639fc7cf81b89a8fe4e06d7a927',
    );
  });
});
