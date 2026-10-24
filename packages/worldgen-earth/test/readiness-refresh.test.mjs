import { describe, expect, it } from 'vitest';
import { readinessRefresh } from '../scripts/readiness-refresh.mjs';

const candidates = [
  { id: 'stari_most', wikidataId: 'Q1', title: 'First' },
  { id: 'pont_de_normandie', wikidataId: 'Q2', title: 'Second' },
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
    const refresh = readinessRefresh(candidates, previous, [
      ' pont_de_normandie ',
      'pont_de_normandie',
    ]);
    expect([...refresh.selected]).toEqual(['pont_de_normandie']);
    expect(refresh.records.get('stari_most')).toBe(previous.candidates[0]);
    expect(refresh.records.get('stari_most').readiness).toBe('incomplete');
    expect(refresh.records.get('stari_most').blockers).toEqual([
      'visual-review-missing-or-unbound',
    ]);
    expect(previous.candidates.every((candidate) => candidate.readiness === 'incomplete')).toBe(
      true,
    );
  });

  it('rejects empty or unknown selections instead of silently doing no work', () => {
    for (const ids of [[], [''], ['stari_most', ''], ['gamla_bron']])
      expect(() => readinessRefresh(candidates, previous, ids)).toThrow();
  });

  it('requires a full refresh after catalog membership or identity changes', () => {
    expect(() => readinessRefresh(candidates, undefined, ['stari_most'])).toThrow(/full/);
    expect(() => readinessRefresh(candidates.slice(1), previous, ['pont_de_normandie'])).toThrow(
      /full/,
    );
    expect(() =>
      readinessRefresh(candidates, { ...previous, candidates: [previous.candidates[0]] }, [
        'stari_most',
      ]),
    ).toThrow(/full/);
    expect(() =>
      readinessRefresh(
        candidates,
        { ...previous, candidates: [previous.candidates[0], previous.candidates[0]] },
        ['stari_most'],
      ),
    ).toThrow(/full/);
    for (const changed of [{ title: 'Renamed' }, { wikidataId: 'Q99' }])
      expect(() =>
        readinessRefresh([candidates[0], { ...candidates[1], ...changed }], previous, [
          'stari_most',
        ]),
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
      readinessRefresh(candidates, collection, ['pont_de_normandie'], {
        collections: [{ id: 'stari_most' }],
        hash: 'new',
      }),
    ).toThrow(/collection membership/);
    expect(() =>
      readinessRefresh(candidates, previous, ['pont_de_normandie'], {
        collections: [{ id: 'stari_most' }],
        hash: 'new',
      }),
    ).toThrow(/collection membership/);
    expect(() =>
      readinessRefresh(candidates, collection, ['pont_de_normandie'], {
        collections: [],
        hash: 'old',
      }),
    ).toThrow(/collection membership/);
  });
});
