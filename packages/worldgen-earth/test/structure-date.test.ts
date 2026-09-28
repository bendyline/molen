import { getSchema } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  type HistoricalStructureAppearance,
  isStructureViewingDate,
} from '../src/kernel/structure-date';
import { createStructureIndex, type StructurePlacement } from '../src/kernel/structure-index';
import { registerStructurePlacementsSchema } from '../src/kernel/structure-index-schema';

const appearance: HistoricalStructureAppearance = {
  kind: 'historical',
  currentWorldEligible: false,
  representedDate: '1930',
  validFrom: '1926-01-01',
  validUntil: '1934-01-01',
};
const historical: StructurePlacement = {
  id: 'archive.tower',
  title: 'Archival tower',
  asset: 'archive.tower',
  anchor: [37.6, 55.7],
  status: 'historical',
  appearance,
  source: 'https://example.com/historic-plan',
};
const bounds = [37.5, 55.6, 37.7, 55.8] as const;
const catalog = (entry = historical) => ({
  format: 'molen/structure-placements@1' as const,
  title: 'Historical test',
  entries: [entry],
});

describe('explicit historical structure dates', () => {
  it('keeps default queries current, gates historical dates, and retains geographic filtering', () => {
    const index = createStructureIndex(catalog());
    expect(index.entries).toHaveLength(1);
    expect(index.query(bounds)).toEqual([]);
    expect(index.query(bounds, true)).toEqual([historical]);
    for (const viewingDate of ['1926-01-01', '1930-07-04', '1933-12-31'])
      expect(index.query(bounds, { viewingDate })).toEqual([historical]);
    for (const viewingDate of ['1925-12-31', '1934-01-01', '2026-09-28'])
      expect(index.query(bounds, { viewingDate })).toEqual([]);
    expect(index.query([-123, 47, -122, 48], { viewingDate: '1930-01-01' })).toEqual([]);
    expect(
      createStructureIndex(catalog({ ...historical, status: 'draft' })).query(bounds, {
        viewingDate: '1930-01-01',
      }),
    ).toEqual([]);
    const { appearance: _appearance, ...current } = historical;
    expect(
      createStructureIndex(catalog({ ...current, status: 'preview' })).query(bounds),
    ).toHaveLength(1);
  });

  it('validates real calendar days and rejects implicit or malformed dates', () => {
    for (const date of ['2000-02-29', '1928-02-29', '0001-01-01', '9999-12-31'])
      expect(isStructureViewingDate(date)).toBe(true);
    const index = createStructureIndex(catalog());
    for (const date of [
      '1900-02-29',
      '1930-02-29',
      '1930-04-31',
      '0000-01-01',
      '1930',
      '1930-1-01',
      '1930-01-01T00:00:00Z',
      'now',
      '',
    ]) {
      expect(isStructureViewingDate(date)).toBe(false);
      expect(() => index.query(bounds, { viewingDate: date })).toThrow('viewingDate');
    }
  });

  it('enforces the historical-only interval in both schema and direct index creation', () => {
    registerStructurePlacementsSchema();
    const schema = getSchema('structure-placements')?.zod;
    expect(schema?.safeParse(catalog()).success).toBe(true);
    for (const entry of [
      { ...historical, appearance: undefined },
      { ...historical, status: 'preview' },
      { ...historical, appearance: { ...appearance, currentWorldEligible: true } },
      { ...historical, appearance: { ...appearance, validUntil: appearance.validFrom } },
      { ...historical, appearance: { ...appearance, validFrom: '1930-02-30' } },
    ]) {
      const document = catalog(entry as StructurePlacement);
      expect(schema?.safeParse(document).success).toBe(false);
      expect(() => createStructureIndex(document)).toThrow('historical');
    }
  });
});
