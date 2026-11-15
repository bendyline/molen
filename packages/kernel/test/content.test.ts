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

describe('createTypeLibrary checks', () => {
  /** A copy of the demo document with one type's transform carrying a field no schema knows. */
  const withNewField = () => {
    const doc = structuredClone(typesDoc);
    Object.assign(doc.types['demo.vehicle'].components.transform, { wobble: 1 });
    return doc;
  };

  it('resolves the same library with structure checks, without changing the documents', () => {
    const doc = structuredClone(typesDoc);
    const structure = createTypeLibrary(doc, { checks: 'structure' });
    expect(doc).toEqual(typesDoc);
    const full = createTypeLibrary(typesDoc);
    expect(structure.ids()).toEqual(full.ids());
    expect(structure.types).toEqual(full.types);
    expect(structure.hash).toBe(full.hash);
    // Defaults the schema would add are filled in.
    const bare = { format: 'molen/types@1', namespace: 'demo', types: { 'demo.box': {} } };
    expect(createTypeLibrary(bare, { checks: 'structure' }).types).toEqual(
      createTypeLibrary(bare).types,
    );
  });

  it('keeps component data structure checks do not look into, which full checks reject', () => {
    expect(() => createTypeLibrary(withNewField())).toThrow(/wobble/);
    const lib = createTypeLibrary(withNewField(), { checks: 'structure' });
    expect(lib.component<Record<string, unknown>>('demo.vehicle.truck', 'transform').wobble).toBe(
      1,
    );
  });

  it('still refuses what resolving relies on, with structure checks', () => {
    const structure = (doc: unknown) => () => createTypeLibrary(doc, { checks: 'structure' });
    expect(structure({ ...typesDoc, format: 'molen/types@2' })).toThrow(/format/);
    expect(
      structure({ ...typesDoc, types: { ...typesDoc.types, 'other.rock': { components: {} } } }),
    ).toThrow(/outside this file's namespace/);
    expect(
      structure({
        ...typesDoc,
        types: { 'demo.a': { extends: 'demo.b' }, 'demo.b': { extends: 'demo.a' } },
      }),
    ).toThrow(/cycle/);
    expect(structure({ ...typesDoc, types: { 'demo.a': { components: [] } } })).toThrow(
      /components/,
    );
    expect(structure({ ...typesDoc, types: { 'demo.a': { scripts: [{ id: 's' }] } } })).toThrow(
      /exactly one of "code" or "path"/,
    );
  });

  it('leaves out a failing type and those that extend it, reporting each, with onSkip', () => {
    for (const checks of ['full', 'structure'] as const) {
      const skipped: string[] = [];
      const doc = structuredClone(typesDoc);
      Object.assign(doc.types['demo.vehicle'], { components: 'not a component map' });
      const lib = createTypeLibrary(doc, { checks, onSkip: (message) => skipped.push(message) });
      expect(lib.ids(), checks).toEqual(['demo.rock']);
      expect(skipped, checks).toHaveLength(2);
      expect(skipped[0], checks).toMatch(/entity type "demo\.vehicle" left out.*components/);
      expect(skipped[1], checks).toMatch(
        /entity type "demo\.vehicle\.truck" left out: .*"demo\.vehicle"/,
      );
    }
  });

  it('keeps the first of a repeated id and drops a document whose envelope fails, with onSkip', () => {
    const skipped: string[] = [];
    const repeat = {
      format: 'molen/types@1',
      namespace: 'demo',
      types: { 'demo.rock': { components: {} }, 'demo.pebble': { components: {} } },
    };
    const broken = { format: 'molen/types@1', types: { 'demo.stone': { components: {} } } };
    const lib = createTypeLibrary([typesDoc, repeat, broken], {
      checks: 'structure',
      onSkip: (message) => skipped.push(message),
    });
    expect(lib.ids()).toEqual(['demo.vehicle', 'demo.vehicle.truck', 'demo.rock', 'demo.pebble']);
    expect(lib.component('demo.rock', 'lifetime')).toEqual({ ticksLeft: 30 });
    expect(skipped).toHaveLength(2);
    expect(skipped[0]).toMatch(/types\[2\] left out: .*namespace/s);
    expect(skipped[1]).toMatch(/"demo\.rock".*the first is kept/);
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
