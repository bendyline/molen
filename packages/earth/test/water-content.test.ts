import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { describe, expect, it } from 'vitest';
import { ambientContentFromTypes } from '../src/client/ambient';

describe('Earth water content', () => {
  it('selects ferry and channel models without treating them as road vehicles', () => {
    const types = createTypeLibrary([
      {
        format: 'molen/types@1',
        namespace: 'test',
        types: {
          'test.ferry': {
            components: {
              ambientRole: {
                role: 'ferry',
                length: 32,
                width: 9,
                height: 8,
                cruise: 8,
                visual: { paintMaterial: 'hull' },
              },
            },
          },
          'test.cargo': {
            components: {
              ambientRole: { role: 'boat', length: 150, width: 24, height: 25, cruise: 6 },
            },
          },
        },
      },
    ]);
    const content = ambientContentFromTypes(types, async () => undefined);
    expect(content.types.car).toBeUndefined();
    expect(content.types.boat?.map((v) => [v.id, v.waterway])).toEqual([
      ['test.ferry', 'ferry'],
      ['test.cargo', 'channel'],
    ]);
    expect(content.vehicle('test.ferry')?.visual.wheelNodes).toEqual([]);
    expect(content.vehicle('test.ferry')?.visual.paintMaterial).toBe('hull');
    expect(content.heights['test.cargo']).toBe(25);
  });
});
