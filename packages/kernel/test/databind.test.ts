import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/component';
import { spawnFromData } from '../src/scene';
import { World } from '../src/world';

const Bar = defineComponent<{ value: number; label: string }>('bar');

describe('spawnFromData', () => {
  it('spawns one entity per data item via the template', () => {
    const w = new World();
    const data = [
      { label: 'a', v: 3 },
      { label: 'b', v: 7 },
      { label: 'c', v: 5 },
    ];
    const ids = spawnFromData(
      w,
      data,
      (item, i) => ({
        transform: { pos: [i * 2, 0, 0], rot: [0, 0, 0, 1] },
        bar: { value: item.v, label: item.label },
      }),
      { idPrefix: 'bar-' },
    );
    expect(ids).toEqual(['bar-0', 'bar-1', 'bar-2']);
    expect(w.query(Bar).count()).toBe(3);
    expect(w.get('bar-1', Bar)?.value).toBe(7);
  });

  it('allocates runtime ids when no prefix is given', () => {
    const w = new World();
    const ids = spawnFromData(w, [1, 2], (v) => ({ bar: { value: v, label: '' } }));
    expect(ids).toEqual(['e0', 'e1']);
  });
});
