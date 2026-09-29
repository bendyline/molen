import { describe, expect, it } from 'vitest';
import {
  resolvePlaceSourceLocation,
  structureSourceCandidateId,
} from '../scripts/index-structure-sources.mjs';
import { encodeSourceGeohash } from '../scripts/structure-source-paths.mjs';

const key = 'n0999_new_landmark';
const seattle = [-122.3318, 47.60209];
const paris = [2.2945, 48.8584];
const london = [-0.1246, 51.5007];
const reference = ([longitude, latitude]) => ({ longitude, latitude });
const pathFor = (anchor) => {
  const cell = encodeSourceGeohash(...anchor);
  return `content/worldgen/source/places/${cell.slice(0, 2)}/${cell}/${key}`;
};
const unlocated = `content/worldgen/source/places/unlocated/${key}`;

describe('new structure source registration', () => {
  it('selects the first supporting anchor inside the actual authored cell', () => {
    const nearby = [seattle[0] + 0.001, seattle[1]];
    const result = resolvePlaceSourceLocation({
      key,
      actualPath: pathFor(seattle),
      frameAnchor: paris,
      placementAnchor: seattle,
      placementStatus: 'preview',
      specReference: reference(nearby),
      catalogReference: reference(nearby),
    });
    expect(result).toEqual({
      sourcePath: pathFor(seattle),
      anchor: seattle,
      anchorBasis: 'placement:preview',
      geohash2: encodeSourceGeohash(...seattle, 2),
      geohash3: encodeSourceGeohash(...seattle),
    });
    expect(
      resolvePlaceSourceLocation({
        key,
        actualPath: pathFor(seattle),
        frameAnchor: nearby,
        placementAnchor: seattle,
      }).anchor,
    ).toEqual(nearby);
  });

  it('retains catalog-reference fallback when a more precise spec reference moved across a cell', () => {
    const result = resolvePlaceSourceLocation({
      key,
      actualPath: pathFor(seattle),
      frameAnchor: paris,
      placementAnchor: london,
      placementStatus: 'preview',
      specReference: reference(paris),
      catalogReference: reference(seattle),
    });
    expect(result.sourcePath).toBe(pathFor(seattle));
    expect(result.anchor).toEqual(seattle);
    expect(result.anchorBasis).toBe('research-reference');
    expect(
      resolvePlaceSourceLocation({
        key,
        actualPath: pathFor(seattle),
        specReference: reference(seattle),
      }).anchor,
    ).toEqual(seattle);
  });

  it('keeps both new and registered unlocated sources unlocated after coordinates are researched', () => {
    for (const previous of [undefined, { sourcePath: unlocated }]) {
      const result = resolvePlaceSourceLocation({
        key,
        actualPath: unlocated,
        previous,
        frameAnchor: seattle,
        placementAnchor: paris,
        specReference: reference(london),
        catalogReference: reference(seattle),
      });
      expect(result).toEqual({
        sourcePath: unlocated,
        anchor: undefined,
        anchorBasis: undefined,
        geohash2: undefined,
        geohash3: undefined,
      });
    }
  });

  it('pins a registered organizational anchor across changes in geographic evidence', () => {
    const previous = {
      sourcePath: pathFor(seattle),
      anchor: seattle,
      anchorBasis: 'research-reference',
    };
    const inputs = {
      key,
      previous,
      frameAnchor: paris,
      placementAnchor: london,
      specReference: reference(paris),
    };
    expect(resolvePlaceSourceLocation({ ...inputs, actualPath: pathFor(seattle) }).anchor).toBe(
      seattle,
    );
    expect(() => resolvePlaceSourceLocation({ ...inputs, actualPath: pathFor(paris) })).toThrow(
      'deliberately to relocate',
    );
    expect(() =>
      resolvePlaceSourceLocation({
        key,
        previous: { sourcePath: pathFor(seattle) },
        actualPath: pathFor(seattle),
        frameAnchor: seattle,
      }),
    ).toThrow('no supporting');
  });

  it('rejects malformed cells, incorrect prefixes and a path naming another source key', () => {
    for (const actualPath of [
      pathFor(seattle).replace('/c2/', '/u0/'),
      pathFor(seattle).replace('/c23/', '/ca3/'),
      pathFor(seattle).replace('/c23/', '/C23/'),
      pathFor(seattle).replace(key, 'different_key'),
      `content/worldgen/source/places/c23/${key}`,
      `${unlocated}/extra`,
    ])
      expect(() => resolvePlaceSourceLocation({ key, actualPath, frameAnchor: seattle })).toThrow(
        'invalid canonical',
      );
  });

  it('rejects a located folder without evidence supporting its cell', () => {
    for (const frameAnchor of [undefined, paris])
      expect(() =>
        resolvePlaceSourceLocation({ key, actualPath: pathFor(seattle), frameAnchor }),
      ).toThrow('no supporting organizational anchor');
    for (const frameAnchor of [
      [...seattle, 6],
      [181, 0],
    ])
      expect(() =>
        resolvePlaceSourceLocation({ key, actualPath: pathFor(seattle), frameAnchor }),
      ).toThrow();
  });

  it('preserves legacy migration routing from the best available coordinate', () => {
    const result = resolvePlaceSourceLocation({
      key,
      actualPath: `content/worldgen/source/next-1000/models/${key}`,
      frameAnchor: paris,
      catalogReference: reference(seattle),
      includeLegacy: true,
    });
    expect(result.sourcePath).toBe(pathFor(paris));
    expect(result.anchor).toEqual(paris);
    expect(result.anchorBasis).toBe('source-map-frame');
  });
});

describe('source candidate identities', () => {
  it('uses member IDs while preserving initial-catalog plan IDs and reference exceptions', () => {
    expect(structureSourceCandidateId('n0208_msu', { id: 'N0208_MSU', planId: 'N0208' })).toBe(
      'N0208_MSU',
    );
    expect(
      structureSourceCandidateId('n0001_stari_most', { id: 'N0001', planId: 'old-plan' }),
    ).toBe('N0001');
    expect(
      structureSourceCandidateId('a02_smith_tower', {
        id: 'molen.worldgen.structure.a02_smith_tower',
        planId: 'A02',
      }),
    ).toBe('A02');
    expect(
      structureSourceCandidateId('space-needle', { id: 'molen.worldgen.structure.space_needle' }),
    ).toBe('A01');
    expect(structureSourceCandidateId(key, undefined, { candidateId: 'N0999' })).toBe('N0999');
  });
});
