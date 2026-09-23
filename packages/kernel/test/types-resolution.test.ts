import type { SceneManifest } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { buildWorld, defineComponent, defineExperience, type ResolvedTypes } from '../src/index';

const Mat = defineComponent<{ color: string; shine?: number }>('mat');
const Tag = defineComponent<{ name: string }>('tag');

const types: ResolvedTypes = new Map([
  [
    'train.car',
    {
      components: { mat: { color: 'brown', shine: 1 }, tag: { name: 'car' } },
      scripts: [
        {
          id: 'identity',
          code: "molen.on('tick', () => molen.patch('a', 'tag', { name: config.type }));",
          config: {},
        },
      ],
    },
  ],
]);

function scene(over: Partial<SceneManifest>): SceneManifest {
  return {
    format: 'molen/scene@3',
    name: 't',
    seed: 's',
    tickRate: 30,
    lateCommands: 'rewrite',
    keyframeInterval: 60,
    prefabs: {},
    entities: [],
    scripts: [],
    ...over,
  };
}

describe('registry types in scene resolution', () => {
  it('precedence: type < prefab < components', () => {
    const w = buildWorld(
      scene({
        prefabs: { fancy: { type: 'train.car', components: { mat: { color: 'red' } } } },
        entities: [
          {
            id: 'a',
            prefab: 'fancy',
            components: { mat: { color: 'blue' } },
          },
          { id: 'b', type: 'train.car' },
        ],
      }),
      undefined,
      { types },
    );
    // Deep-merge keeps type-level fields that upper layers don't touch.
    expect(w.get('a', Mat)).toEqual({ color: 'blue', shine: 1 });
    expect(w.get('a', Tag)?.name).toBe('car');
    expect(w.get('b', Mat)?.color).toBe('brown');
  });

  it('unknown type ids fail with a pointed error', () => {
    expect(() =>
      buildWorld(scene({ entities: [{ id: 'x', type: 'train.ghost' }] }), undefined, { types }),
    ).toThrow(/unknown type "train.ghost".*project/);
  });

  it('installs external type scripts once with the concrete type id in config', () => {
    const w = buildWorld(scene({ entities: [{ id: 'a', type: 'train.car' }] }), undefined, {
      types,
    });
    w.step();
    expect(w.get('a', Tag)?.name).toBe('train.car');
  });

  it('defineExperience registers commands and systems through one WorldSetup', () => {
    const exp = defineExperience({
      commands: { poke: (w) => w.spawnRaw({ tag: { name: 'poked' } }) },
      systems: [{ fn: (w) => w.patch('hero', Tag, { name: 'ticked' }), name: 'tick-tag' }],
      setup: (w) => w.spawnRaw({ tag: { name: 'hero' } }, 'hero'),
    });
    const w = buildWorld(scene({}), exp.setup);
    expect(w.get('hero', Tag)?.name).toBe('hero');
    w.submitCommand({
      kind: 'command',
      seq: 0,
      source: 'local',
      tick: 0,
      type: 'poke',
      payload: {},
    });
    w.stepN(2);
    expect(w.get('hero', Tag)?.name).toBe('ticked');
    expect(w.query(Tag).count()).toBe(2);
  });
});
