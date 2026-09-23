import type { SceneManifest } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { contentDrift, keyframeContent } from '../src/content';
import { loadProject } from '../src/project';
import { buildWorld } from '../src/scene';
import { applyKeyframeTo, stateHash, takeKeyframe, worldFromKeyframe } from '../src/snapshot';
import { createTypeLibrary } from '../src/type-library';

const typesDoc = {
  format: 'molen/types@1',
  namespace: 'demo',
  owner: 'tests',
  types: {
    'demo.vehicle': {
      components: { transform: { pos: [0, 1, 0], rot: [0, 0, 0, 1] }, health: { hp: 100 } },
    },
    'demo.vehicle.truck': { extends: 'demo.vehicle', components: { health: { hp: 300 } } },
    'demo.rock': { components: { lifetime: { ticksLeft: 30 } } },
  },
};

const scene: SceneManifest = {
  format: 'molen/scene@3',
  name: 'content-demo',
  seed: 'content',
  tickRate: 30,
  lateCommands: 'rewrite',
  keyframeInterval: 60,
  prefabs: {},
  entities: [{ id: 'a', components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } } }],
  scripts: [],
  commands: {},
  components: {},
};

describe('createTypeLibrary', () => {
  it('resolves inheritance and answers lookups with copies', () => {
    const lib = createTypeLibrary(typesDoc);
    expect(lib.ids()).toEqual(['demo.vehicle', 'demo.vehicle.truck', 'demo.rock']);
    expect(lib.component('demo.vehicle.truck', 'health')).toEqual({ hp: 300 });
    expect(lib.component('demo.vehicle.truck', 'transform')).toEqual({
      pos: [0, 1, 0],
      rot: [0, 0, 0, 1],
    });
    expect(lib.idsWith('health')).toEqual(['demo.vehicle', 'demo.vehicle.truck']);
    const copy = lib.components('demo.rock') as { lifetime: { ticksLeft: number } };
    copy.lifetime.ticksLeft = 1;
    expect(lib.component('demo.rock', 'lifetime')).toEqual({ ticksLeft: 30 });
    expect(() => lib.component('demo.rock', 'health')).toThrow(/has no "health" component/);
    expect(() => lib.components('demo.nope')).toThrow(/unknown entity type "demo.nope"/);
  });

  it('hashes content, not document order', () => {
    const reordered = {
      ...typesDoc,
      types: Object.fromEntries(Object.entries(typesDoc.types).reverse()),
    };
    expect(createTypeLibrary(reordered).hash).toBe(createTypeLibrary(typesDoc).hash);
    const changed = structuredClone(typesDoc);
    changed.types['demo.rock'].components.lifetime.ticksLeft = 31;
    expect(createTypeLibrary(changed).hash).not.toBe(createTypeLibrary(typesDoc).hash);
  });

  it('resolves the same registry loadProject does', () => {
    const lib = createTypeLibrary(typesDoc);
    const loaded = loadProject({ scene, types: typesDoc });
    expect(lib.types).toEqual(loaded.types);
  });
});

describe('content identity', () => {
  const content = { types: { hash: 'sha256:aaa', packs: ['demo.types@1'] } };

  it('records content in keyframes without changing the state hash', () => {
    const plain = buildWorld(scene);
    const tagged = buildWorld(scene, undefined, { content });
    expect(tagged.content).toEqual(content);
    expect(Object.isFrozen(tagged.content)).toBe(true);
    expect(stateHash(tagged)).toBe(stateHash(plain));
    expect(keyframeContent(takeKeyframe(tagged))).toEqual(content);
    expect(keyframeContent(takeKeyframe(plain))).toBeUndefined();
  });

  it('refuses a keyframe saved with different content, by name', () => {
    const saved = takeKeyframe(buildWorld(scene, undefined, { content }));
    const other = buildWorld(scene, undefined, {
      content: { types: { hash: 'sha256:bbb', packs: ['demo.types@2'] } },
    });
    expect(() => applyKeyframeTo(other, saved)).toThrow(
      /content "types" was sha256:aaa \(demo\.types@1\) but the loaded content is sha256:bbb \(demo\.types@2\)/,
    );
    expect(() => applyKeyframeTo(other, saved, { allowContentDrift: true })).not.toThrow();
    // A world without declared content, or with only other domains, is not a mismatch.
    expect(() => applyKeyframeTo(buildWorld(scene), saved)).not.toThrow();
  });

  it('restores the recorded identity with worldFromKeyframe', () => {
    const saved = takeKeyframe(buildWorld(scene, undefined, { content }));
    expect(worldFromKeyframe(saved).content).toEqual(content);
  });

  it('compares only the domains both sides have', () => {
    expect(contentDrift({ a: { hash: '1' } }, { b: { hash: '2' } })).toEqual([]);
    expect(contentDrift({ a: { hash: '1' } }, { a: { hash: '1' } })).toEqual([]);
    expect(contentDrift({ a: { hash: '1' } }, { a: { hash: '2' } })).toHaveLength(1);
  });
});
