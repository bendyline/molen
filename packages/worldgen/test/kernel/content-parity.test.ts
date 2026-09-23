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
      'sha256:9736a490e9a85edbe0b41ba8198ea62321eb6ae9bdced3642a4f03087d5f638c',
    );
  });

  it('keeps the landmark definitions, sign designs and interior catalog', () => {
    expect(Object.keys(LANDMARKS.definitions)).toHaveLength(58);
    expect(Object.keys(LANDMARKS.signDesigns)).toHaveLength(53);
    expect({
      definitions: digest(LANDMARKS.definitions),
      signs: digest(LANDMARKS.signDesigns),
      interiors: digest(validateInteriorCatalog(INTERIORS)),
    }).toEqual({
      definitions: 'a26a3fee4cff25bb',
      signs: '9798f722883bfda5',
      interiors: '995f0f16478baf2f',
    });
  });
});
