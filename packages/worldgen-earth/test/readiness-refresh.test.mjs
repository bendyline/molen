import { describe, expect, it } from 'vitest';
import { readinessRefresh } from '../scripts/readiness-refresh.mjs';

const candidates = [
  { id: 'N0001', wikidataId: 'Q1', title: 'First' },
  { id: 'N0002', wikidataId: 'Q2', title: 'Second' },
];
const previous = {
  format: 'molen/structure-readiness@1',
  candidates: candidates.map((candidate) => ({
    candidateId: candidate.id,
    wikidataId: candidate.wikidataId,
    title: candidate.title,
    readiness: 'incomplete',
    blockers: ['visual-review-missing-or-unbound'],
  })),
};

describe('selected readiness refresh', () => {
  it('selects requested candidates while retaining previous records and their blockers', () => {
    const refresh = readinessRefresh(candidates, previous, [' n0002 ', 'N0002']);
    expect([...refresh.selected]).toEqual(['N0002']);
    expect(refresh.records.get('N0001')).toBe(previous.candidates[0]);
    expect(refresh.records.get('N0001').readiness).toBe('incomplete');
    expect(refresh.records.get('N0001').blockers).toEqual(['visual-review-missing-or-unbound']);
    expect(previous.candidates.every((candidate) => candidate.readiness === 'incomplete')).toBe(
      true,
    );
  });

  it('rejects empty or unknown selections instead of silently doing no work', () => {
    for (const ids of [[], [''], ['N0001', ''], ['N0003']])
      expect(() => readinessRefresh(candidates, previous, ids)).toThrow();
  });

  it('requires a full refresh after catalog membership or identity changes', () => {
    expect(() => readinessRefresh(candidates, undefined, ['N0001'])).toThrow(/full/);
    expect(() => readinessRefresh(candidates.slice(1), previous, ['N0002'])).toThrow(/full/);
    expect(() =>
      readinessRefresh(candidates, { ...previous, candidates: [previous.candidates[0]] }, [
        'N0001',
      ]),
    ).toThrow(/full/);
    expect(() =>
      readinessRefresh(
        candidates,
        { ...previous, candidates: [previous.candidates[0], previous.candidates[0]] },
        ['N0001'],
      ),
    ).toThrow(/full/);
    for (const changed of [{ title: 'Renamed' }, { wikidataId: 'Q99' }])
      expect(() =>
        readinessRefresh([candidates[0], { ...candidates[1], ...changed }], previous, ['N0001']),
      ).toThrow(/identity changed/);
  });

  it('rejects cached collection topology after membership changes', () => {
    const collection = {
      ...previous,
      candidates: [
        { ...previous.candidates[0], collection: { manifest: { hash: 'old' } } },
        previous.candidates[1],
      ],
    };
    expect(() =>
      readinessRefresh(candidates, collection, ['N0002'], {
        collections: [{ id: 'N0001' }],
        hash: 'new',
      }),
    ).toThrow(/collection membership/);
    expect(() =>
      readinessRefresh(candidates, previous, ['N0002'], {
        collections: [{ id: 'N0001' }],
        hash: 'new',
      }),
    ).toThrow(/collection membership/);
    expect(() =>
      readinessRefresh(candidates, collection, ['N0002'], { collections: [], hash: 'old' }),
    ).toThrow(/collection membership/);
  });
});
