import { expect, it } from 'vitest';
import { componentIssues } from '../src/components';
import { type LiveryData, liverySchema } from '../src/livery';

const valid: LiveryData = {
  selected: 'red',
  slots: { body: { materials: ['paint'] } },
  variants: [
    {
      id: 'red',
      label: 'Red',
      paints: { body: { color: '#b34433' } },
      provenance: { kind: 'original', note: 'Study', references: [] },
    },
  ],
};
it('validates selections, paint slots, anchors, provenance and bounded artwork', () => {
  expect(componentIssues('livery', valid, '/livery')).toEqual([]);
  for (const value of [
    { ...valid, selected: 'missing' },
    { ...valid, variants: [...valid.variants, ...valid.variants] },
    { ...valid, variants: [{ ...valid.variants[0], paints: { typo: { color: '#aabbcc' } } }] },
    {
      ...valid,
      anchors: {
        tail: { slot: 'typo', position: [0, 0, 0], rotation: [0, 0, 0], size: [1, 1, 1] },
      },
    },
    {
      ...valid,
      variants: [
        { ...valid.variants[0], markings: [{ anchor: 'missing', graphic: { shapes: [] } }] },
      ],
    },
    {
      ...valid,
      variants: [
        {
          ...valid.variants[0],
          provenance: { kind: 'photo', note: 'No evidence', references: [] },
        },
      ],
    },
    {
      ...valid,
      variants: [
        {
          ...valid.variants[0],
          paints: {
            body: {
              color: '#ffffff',
              camouflage: { colors: ['#111111', '#eeeeee'], scale: 0, seed: 1 },
            },
          },
        },
      ],
    },
  ])
    expect(liverySchema.safeParse(value).success).toBe(false);
});
