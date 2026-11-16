import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateInteriorCatalog } from '../../src/kernel/interior-catalog';
import { INTERIORS, LANDMARKS } from '../helpers/content';

// Pins the landmark, sign and interior content, which moved out of this package into the
// molen.worldgen.default pack with these same values: the landmark hash is a renderer cache key,
// and the definitions feed storefront generation.
function digest(value: unknown): string {
  const stable = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(stable).join(',')}]`
      : v !== null && typeof v === 'object'
        ? `{${Object.keys(v)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
            .join(',')}}`
        : JSON.stringify(v);
  return createHash('sha256').update(stable(value)).digest('hex').slice(0, 16);
}

describe('worldgen content parity', () => {
  it('keeps the landmark catalog hash', () => {
    expect(LANDMARKS.hash).toBe(
      'sha256:eaeabd3e27f061ea4a09ecd5d0342306b3018d97c5d1387637f275e6e0d92e5e',
    );
  });

  it('keeps the landmark definitions, sign designs and interior catalog', () => {
    expect(Object.keys(LANDMARKS.definitions)).toHaveLength(59);
    expect(Object.keys(LANDMARKS.signDesigns)).toHaveLength(53);
    expect({
      definitions: digest(LANDMARKS.definitions),
      signs: digest(LANDMARKS.signDesigns),
      interiors: digest(validateInteriorCatalog(INTERIORS)),
    }).toEqual({
      definitions: 'a0fa1d2791341f4c',
      signs: '9798f722883bfda5',
      interiors: '34ea2d69750909d9',
    });
  });
});
