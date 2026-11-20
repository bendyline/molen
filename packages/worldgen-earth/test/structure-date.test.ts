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
    for (const date of [
      '2000-02-29',
      '1928-02-29',
      '0000-01-01',
      '0001-01-01',
      '9999-12-31',
      '-000400-02-29',
      '+010000-01-01',
    ])
      expect(isStructureViewingDate(date)).toBe(true);
    const index = createStructureIndex(catalog());
    for (const date of [
      '1900-02-29',
      '1930-02-29',
      '1930-04-31',
      '-000100-02-29',
      '-000000-01-01',
      '-0574-01-01',
      '1930',
      '1930-1-01',
      '1930-01-01T00:00:00Z',
      '1930-01-01\n',
      'now',
      '',
    ]) {
      expect(isStructureViewingDate(date)).toBe(false);
      expect(() => index.query(bounds, { viewingDate: date })).toThrow('viewingDate');
    }
  });

  it('hides a competing modern placement only during its explicit exclusion', () => {
    const { appearance: _dates, ...withoutAppearance } = historical;
    const current: StructurePlacement = {
      ...withoutAppearance,
      id: 'modern.tower',
      status: 'preview',
      hiddenDuring: { validFrom: appearance.validFrom, validUntil: appearance.validUntil },
    };
    const document = { ...catalog(), entries: [current, historical] };
    const index = createStructureIndex(document);
    registerStructurePlacementsSchema();
    const schema = getSchema('structure-placements')?.zod;
    expect(schema?.safeParse(document).success).toBe(true);
    expect(index.query(bounds)).toEqual([current]);
    expect(index.query(bounds, { viewingDate: '1926-01-01' })).toEqual([historical]);
    expect(index.query(bounds, { viewingDate: '1934-01-01' })).toEqual([current]);
    expect(index.query(bounds, { viewingDate: '1930-01-01', includeDraft: true })).toHaveLength(2);
    const invalid = catalog({
      ...current,
      hiddenDuring: { validFrom: '1934-01-01', validUntil: '1926-01-01' },
    });
    expect(schema?.safeParse(invalid).success).toBe(false);
    expect(() => createStructureIndex(invalid)).toThrow('date exclusion');
  });

  it('orders BCE dates chronologically within and across years', () => {
    const ancient = {
      ...historical,
      appearance: { ...appearance, validFrom: '-000580-12-31', validUntil: '-000560-01-01' },
    };
    const index = createStructureIndex(catalog(ancient));
    expect(index.query(bounds)).toEqual([]);
    for (const viewingDate of ['-000580-12-31', '-000574-01-01', '-000561-12-31'])
      expect(index.query(bounds, { viewingDate })).toEqual([ancient]);
    for (const viewingDate of ['-000580-12-30', '-000581-12-31', '-000560-01-01', '0001-01-01'])
      expect(index.query(bounds, { viewingDate })).toEqual([]);

    const acrossEras = {
      ...historical,
      appearance: { ...appearance, validFrom: '-000001-12-31', validUntil: '0001-01-01' },
    };
    expect(
      createStructureIndex(catalog(acrossEras)).query(bounds, { viewingDate: '0000-01-01' }),
    ).toEqual([acrossEras]);
    registerStructurePlacementsSchema();
    const schema = getSchema('structure-placements')?.zod;
    expect(schema?.safeParse(catalog(ancient)).success).toBe(true);
    const reversed = catalog({
      ...ancient,
      appearance: {
        ...ancient.appearance,
        validFrom: ancient.appearance.validUntil,
        validUntil: ancient.appearance.validFrom,
      },
    });
    expect(schema?.safeParse(reversed).success).toBe(false);
    expect(() => createStructureIndex(reversed)).toThrow('historical');
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

describe('explicit proposal placements', () => {
  it('selects one proposal, hides its dated and current counterparts, and preserves drafts', () => {
    const { appearance: _dates, ...base } = historical;
    const proposal: StructurePlacement = { ...base, id: 'future.tower', status: 'proposal' };
    const other: StructurePlacement = { ...proposal, id: 'future.other' };
    const present: StructurePlacement = {
      ...base,
      id: 'present.tower',
      status: 'preview',
      hiddenByProposal: proposal.id,
      hiddenDuring: { validFrom: appearance.validFrom, validUntil: appearance.validUntil },
    };
    const past: StructurePlacement = { ...historical, hiddenByProposal: proposal.id };
    const draft: StructurePlacement = { ...base, id: 'draft.tower', status: 'draft' };
    const entries = [present, past, proposal, other, draft];
    const doc = { ...catalog(), entries };
    registerStructurePlacementsSchema();
    const schema = getSchema('structure-placements')?.zod;
    expect(schema?.safeParse(doc).success).toBe(true);
    const index = createStructureIndex(doc);
    expect(index.query(bounds)).toEqual([present]);
    expect(index.query(bounds, { viewingDate: '1930-01-01' })).toEqual([past]);
    expect(index.query(bounds, { viewingDate: '2035-01-01' })).toEqual([present]);
    expect(index.query(bounds, { proposalId: proposal.id })).toEqual([proposal]);
    expect(index.query(bounds, { proposalId: proposal.id, viewingDate: '1930-01-01' })).toEqual([
      proposal,
    ]);
    expect(index.query(bounds, { proposalId: other.id })).toEqual([present, other]);
    expect(index.query(bounds, { proposalId: draft.id })).toEqual([present]);
    expect(index.query([-123, 47, -122, 48], { proposalId: proposal.id })).toEqual([]);
    expect(index.query(bounds, { proposalId: proposal.id, includeDraft: true })).toEqual(entries);
    for (const entry of [
      { ...proposal, appearance },
      { ...proposal, hiddenByProposal: other.id },
      { ...present, hiddenByProposal: present.id },
    ]) {
      expect(schema?.safeParse(catalog(entry)).success).toBe(false);
      expect(() => createStructureIndex(catalog(entry))).toThrow(/historical|proposal/);
    }
  });
});
