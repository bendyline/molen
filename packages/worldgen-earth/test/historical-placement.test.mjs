import { describe, expect, it } from 'vitest';
import {
  authoredHistoricalAppearance,
  hasHistoricalPlacementCapture,
  hasUsableStructurePlacement,
  historicalIdentityResolved,
} from '../scripts/historical-placement.mjs';

const spec = {
  id: 'N0607',
  geographicProposal: { status: 'historical-proposal' },
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '1930',
    validFrom: '1926-01-06',
    validUntil: '1934-04-01',
  },
};

describe('historical source registration', () => {
  it('resolves a historical identity rejection only through reviewed date-gated placement', () => {
    const placement = { status: 'historical', appearance: spec.appearance };
    expect(historicalIdentityResolved({ reasonCode: 'historical' }, placement, true)).toBe(true);
    for (const [reason, changed, reviewed] of [
      ['historical', placement, false],
      ['historical', { ...placement, status: 'preview' }, true],
      ['historical', { ...placement, appearance: undefined }, true],
      ['nonstructure', placement, true],
      ['umbrella', placement, true],
    ])
      expect(historicalIdentityResolved({ reasonCode: reason }, changed, reviewed)).toBe(false);
  });
  it('requires a dated geographic capture and resource eviction for historical readiness', () => {
    const placement = { id: 'archive.tower', status: 'historical', appearance: spec.appearance };
    const report = {
      viewingDate: '1930-01-01',
      placementHash: 'current',
      frames: [{ state: { mode: 'geographic-flat-terrain', placementId: placement.id } }],
      eviction: { disposed: true, liveModelGeometries: 0 },
    };
    expect(hasHistoricalPlacementCapture(placement, report, 'current')).toBe(true);
    for (const changed of [
      { viewingDate: undefined },
      { viewingDate: '1934-04-01' },
      { placementHash: 'old' },
      { frames: [{ state: { mode: 'asset-review' } }] },
      { eviction: { disposed: false } },
    ])
      expect(hasHistoricalPlacementCapture(placement, { ...report, ...changed }, 'current')).toBe(
        false,
      );
    expect(hasHistoricalPlacementCapture({ status: 'preview' }, undefined, 'current')).toBe(true);
  });
  it('registers only explicit supported intervals and keeps legacy undated geometry inactive', () => {
    const appearance = authoredHistoricalAppearance(spec);
    expect(appearance).toEqual(spec.appearance);
    expect(hasUsableStructurePlacement({ status: 'historical', appearance })).toBe(true);
    expect(hasUsableStructurePlacement({ status: 'historical' })).toBe(false);
    expect(hasUsableStructurePlacement({ status: 'draft', appearance })).toBe(false);
    expect(
      authoredHistoricalAppearance({
        ...spec,
        appearance: {
          mode: 'historical',
          observedYear: 2012,
          validUntil: '2025-11-02',
          currentWorldEligible: false,
        },
      }),
    ).toBeUndefined();
    expect(
      authoredHistoricalAppearance({ ...spec, geographicProposal: { status: 'preview-proposal' } }),
    ).toBeUndefined();
  });
  it('rejects invalid intervals and a historical proposal without explicit default exclusion', () => {
    for (const appearance of [
      { ...spec.appearance, currentWorldEligible: true },
      { ...spec.appearance, validFrom: '1926-02-30' },
      { ...spec.appearance, validFrom: '1934-04-01' },
      { ...spec.appearance, validUntil: '1926-01-01' },
    ])
      expect(() => authoredHistoricalAppearance({ ...spec, appearance })).toThrow('historical');
  });
});
