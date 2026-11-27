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

it('accepts zones, holes, flips and shared graphics, and rejects unknown graphic references', () => {
  const square: [number, number][] = [
    [0.1, 0.1],
    [0.9, 0.1],
    [0.9, 0.9],
    [0.1, 0.9],
  ];
  const rich: LiveryData = {
    ...valid,
    anchors: {
      tail: { slot: 'body', position: [0.5, 0.5, 1], size: [0.2, 0.2, 0.1], rotation: [0, 0, 0] },
    },
    graphics: {
      roundel: {
        shapes: [
          {
            color: '#ffffff',
            points: square,
            holes: [square.map(([x, y]) => [x * 0.5 + 0.25, y * 0.5 + 0.25] as [number, number])],
          },
        ],
      },
    },
    variants: [
      {
        ...(valid.variants[0] as LiveryData['variants'][number]),
        paints: {
          body: {
            color: '#dddddd',
            camouflage: { colors: ['#556644', '#aa9977'], scale: 2, seed: 1, style: 'splinter' },
            zones: [{ color: '#333333', planes: [{ normal: [0, -1, 0], offset: -0.3 }] }],
          },
        },
        markings: [
          { anchor: 'tail', graphic: 'roundel' },
          { anchor: 'tail', graphic: 'roundel', flip: true },
        ],
      },
    ],
  };
  expect(componentIssues('livery', rich, '/livery')).toEqual([]);
  const broken = structuredClone(rich);
  (broken.variants[0] as LiveryData['variants'][number]).markings = [
    { anchor: 'tail', graphic: 'missing' },
  ];
  expect(liverySchema.safeParse(broken).success).toBe(false);
});
