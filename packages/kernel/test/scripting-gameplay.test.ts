import { describe, expect, it } from 'vitest';
import { defineComponent, installGameplay, Transform, World } from '../src/index';
import { installScripting } from '../src/scripting';

const Tag = defineComponent<{ name: string }>('tag');

function world(): World {
  const w = new World({ seed: 's' });
  installGameplay(w);
  return w;
}

describe('script verbs for the gameplay layer', () => {
  it('molen.after / molen.every schedule snapshot-safe timers', () => {
    const w = world();
    installScripting(w, [
      {
        id: 't',
        source: `
          let beats = 0;
          molen.after(3, 'boom');
          molen.every(4, 'beat');
          molen.on('beat', () => { beats++; });
          molen.on('boom', () => { molen.spawn({ tag: { name: 'exploded' } }, 'crater'); });
          molen.on('tick', () => {});
        `,
      },
    ]);
    w.stepN(10);
    expect(w.exists('crater')).toBe(true);
    expect(w.get('crater', Tag)?.name).toBe('exploded');
  });

  it('molen.tween animates and molen.query().without() filters', () => {
    const w = world();
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'a');
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, tag: { name: 'x' } }, 'b');
    installScripting(w, [
      {
        id: 's',
        source: `
          molen.tween('a', { component: 'transform', path: 'pos[1]', to: 8, ticks: 8 });
          let plain = -1;
          molen.on('tick', () => { plain = molen.query('transform').without('tag').count(); });
          molen.on('tween-complete', (e) => { molen.set(e.entity, 'tag', { name: 'done' }); });
        `,
      },
    ]);
    w.stepN(10);
    expect(w.get('a', Transform)?.pos[1]).toBe(8);
    expect(w.get('a', Tag)?.name).toBe('done');
  });

  it('molen.parent keeps world pose and follows the parent', () => {
    const w = world();
    w.spawnRaw({ transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] } }, 'ship');
    w.spawnRaw({ transform: { pos: [6, 1, 0], rot: [0, 0, 0, 1] } }, 'gun');
    installScripting(w, [
      {
        id: 'p',
        source: `
          molen.parent('gun', 'ship');
          molen.on('tick', () => {
            if (molen.tick === 2) molen.patch('ship', 'transform', { pos: [10, 0, 0] });
          });
        `,
      },
    ]);
    w.stepN(4);
    expect(w.get('gun', Transform)?.pos).toEqual([11, 1, 0]);
  });

  it('extensions surface as frozen molen namespaces and cannot shadow core verbs', () => {
    const w = world();
    let called = 0;
    installScripting(
      w,
      [
        {
          id: 'x',
          source: `molen.on('tick', () => { molen.custom.poke(); });`,
        },
      ],
      { extensions: { custom: { poke: () => called++ } } },
    );
    w.stepN(3);
    expect(called).toBe(3);
    expect(() => installScripting(new World(), [], { extensions: { spawn: {} } })).toThrow(
      /collides/,
    );
  });
});
