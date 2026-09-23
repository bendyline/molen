import type { Delta, EntityId, Keyframe, ModelSignalSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { InterpTransform } from '../src/interpolation';
import type { ModelSignals } from '../src/model-signals';
import { type Renderable, type SceneBackend, SceneMirror } from '../src/sync';

/** Records backend calls so reconciliation can be asserted without three.js. */
class MockBackend implements SceneBackend {
  created: EntityId[] = [];
  updated: EntityId[] = [];
  destroyed: EntityId[] = [];
  transforms = new Map<EntityId, InterpTransform>();
  create(id: EntityId): void {
    this.created.push(id);
  }
  updateRenderable(id: EntityId): void {
    this.updated.push(id);
  }
  destroy(id: EntityId): void {
    this.destroyed.push(id);
  }
  setTransform(id: EntityId, t: InterpTransform): void {
    this.transforms.set(id, t);
  }
}

const box = (color: string): Renderable => ({
  kind: 'primitive',
  ref: 'box',
  materialRef: `palette:${color}`,
});

function keyframe(entities: Keyframe['entities']): Keyframe {
  return {
    kind: 'keyframe',
    v: 1,
    engine: '0.0.1',
    tick: 0,
    tickRate: 30,
    seed: 's',
    nextEntitySeq: 0,
    rng: { algo: 'sfc32', state: [1, 2, 3, 4] },
    entities,
    plugins: {},
  };
}

function delta(over: Partial<Delta>): Delta {
  return {
    kind: 'delta',
    v: 1,
    tick: 1,
    baseTick: 0,
    spawned: {},
    destroyed: [],
    changed: {},
    removedComponents: {},
    events: [],
    ...over,
  };
}

it('bridges custom script component telemetry through deltas, removal and keyframe restoration', () => {
  const mirror = new SceneMirror();
  const backend = new MockBackend() as MockBackend & SceneBackend;
  const received: Array<{ spec: ModelSignalSpec | undefined; signals: ModelSignals }> = [];
  backend.setModelSignals = (_id, spec, signals) => {
    received.push({ spec, signals });
  };
  const spec = {
    sources: { rpm: { component: 'my.avionics', path: ['engine', 'rpm'] } },
    bindings: [{ node: 'tach', source: 'rpm', property: 'rotation', axis: 'z', scale: 1 }],
  };
  const initial = keyframe({
    panel: {
      renderable: { kind: 'gltf', ref: 'panel' },
      'model.signals': spec,
      'my.avionics': { engine: { rpm: 0.2 } },
    },
  });
  mirror.applyKeyframe(initial);
  mirror.reconcile(backend);
  expect(received.at(-1)?.signals).toEqual({ rpm: 0.2 });
  mirror.applyDelta(delta({ changed: { panel: { 'my.avionics': { engine: { rpm: 0.9 } } } } }));
  mirror.reconcile(backend);
  expect(received.at(-1)?.signals).toEqual({ rpm: 0.9 });
  expect(backend.updated).toEqual([]);
  mirror.applyDelta(
    delta({ baseTick: 1, tick: 2, removedComponents: { panel: ['model.signals'] } }),
  );
  mirror.reconcile(backend);
  expect(received.at(-1)?.spec).toBeUndefined();
  mirror.applyKeyframe(initial);
  mirror.reconcile(backend);
  expect(received.at(-1)?.signals).toEqual({ rpm: 0.2 });
});

describe('SceneMirror reconcile', () => {
  it('creates backend objects for entities with a renderable', () => {
    const m = new SceneMirror();
    const backend = new MockBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#ff0000') },
        b: { transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] } }, // no renderable -> not created
      }),
    );
    m.reconcile(backend);
    expect(backend.created).toEqual(['a']);
  });

  it('creates on spawn delta and destroys on destroy delta', () => {
    const m = new SceneMirror();
    const backend = new MockBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
      }),
    );
    m.reconcile(backend);
    expect(backend.created).toEqual(['a']);

    m.applyDelta(
      delta({
        spawned: {
          c: { transform: { pos: [2, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#0f0') },
        },
      }),
    );
    m.reconcile(backend);
    expect(backend.created).toContain('c');

    m.applyDelta(delta({ tick: 2, baseTick: 1, destroyed: ['a'] }));
    m.reconcile(backend);
    expect(backend.destroyed).toContain('a');
  });

  it('updates the binding when the renderable changes', () => {
    const m = new SceneMirror();
    const backend = new MockBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
      }),
    );
    m.reconcile(backend);
    // change material -> renderable key changes -> updateRenderable
    m.applyDelta(delta({ changed: { a: { renderable: box('#000') } } }));
    m.reconcile(backend);
    expect(backend.updated).toEqual(['a']);
  });

  it('does not re-create or update when nothing relevant changed', () => {
    const m = new SceneMirror();
    const backend = new MockBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
      }),
    );
    m.reconcile(backend);
    // only the transform moves; renderable is unchanged
    m.applyDelta(delta({ changed: { a: { transform: { pos: [9, 0, 0], rot: [0, 0, 0, 1] } } } }));
    m.reconcile(backend);
    expect(backend.created).toEqual(['a']);
    expect(backend.updated).toEqual([]);
  });

  it('destroys the binding when the renderable component is removed', () => {
    const m = new SceneMirror();
    const backend = new MockBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
      }),
    );
    m.reconcile(backend);
    m.applyDelta(delta({ removedComponents: { a: ['renderable'] } }));
    m.reconcile(backend);
    expect(backend.destroyed).toEqual(['a']);
  });

  it('extracts transforms for the interpolation buffer', () => {
    const m = new SceneMirror();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [1, 2, 3], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
        b: { health: { hp: 5 } }, // no transform -> excluded
      }),
    );
    const transforms = m.transforms();
    expect(transforms.get('a')?.pos).toEqual([1, 2, 3]);
    expect(transforms.has('b')).toBe(false);
  });

  it('rejects a delta whose base tick does not match the mirrored state', () => {
    const m = new SceneMirror();
    m.applyKeyframe(keyframe({ a: { health: { hp: 10 } } }));
    expect(
      m.applyDelta(delta({ tick: 4, baseTick: 3, changed: { a: { health: { hp: 0 } } } })),
    ).toBe(false);
    expect(m.tick).toBe(0);
    expect(m.has('a')).toBe(true);
  });

  it('visits only the entities a delta touched', () => {
    const m = new SceneMirror();
    const backend = new MockBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
        b: { transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#000') },
        c: { transform: { pos: [2, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#f00') },
      }),
    );
    m.reconcile(backend);
    expect(m.lastReconcileVisited).toBe(3);
    expect(backend.created).toEqual(['a', 'b', 'c']);

    m.applyDelta(delta({ changed: { a: { transform: { pos: [9, 0, 0], rot: [0, 0, 0, 1] } } } }));
    m.reconcile(backend);
    expect(m.lastReconcileVisited).toBe(1);
    expect(backend.created).toEqual(['a', 'b', 'c']);
    expect(backend.updated).toEqual([]);
    expect(backend.destroyed).toEqual([]);

    // A destroyed id is dirty too, so its binding still reaches destroy.
    m.applyDelta(delta({ tick: 2, baseTick: 1, destroyed: ['b'] }));
    m.reconcile(backend);
    expect(m.lastReconcileVisited).toBe(1);
    expect(backend.destroyed).toEqual(['b']);
    expect(m.boundIds()).toEqual(['a', 'c']);
  });

  it('re-evaluates the environment when a dirty entity carries it', () => {
    class EnvBackend extends MockBackend {
      environments: (Record<string, unknown> | undefined)[] = [];
      setEnvironment(env: Record<string, unknown> | undefined): void {
        this.environments.push(env);
      }
    }
    const m = new SceneMirror();
    const backend = new EnvBackend();
    m.applyKeyframe(
      keyframe({
        a: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, renderable: box('#fff') },
        sky: { environment: { sky: 'day' } },
      }),
    );
    m.reconcile(backend);
    expect(backend.environments).toEqual([{ sky: 'day' }]);

    // Unrelated delta: the environment is not re-serialized.
    m.applyDelta(delta({ changed: { a: { transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] } } } }));
    m.reconcile(backend);
    expect(backend.environments).toHaveLength(1);

    m.applyDelta(
      delta({ tick: 2, baseTick: 1, changed: { sky: { environment: { sky: 'dusk' } } } }),
    );
    m.reconcile(backend);
    expect(backend.environments).toEqual([{ sky: 'day' }, { sky: 'dusk' }]);

    // Destroying the owner restores the default (undefined).
    m.applyDelta(delta({ tick: 3, baseTick: 2, destroyed: ['sky'] }));
    m.reconcile(backend);
    expect(backend.environments).toEqual([{ sky: 'day' }, { sky: 'dusk' }, undefined]);
  });

  it('synchronizes physical weather changes, owner removal and weather-free keyframes', () => {
    class WeatherBackend extends MockBackend {
      weather: (Record<string, unknown> | undefined)[] = [];
      setWeather(value: Record<string, unknown> | undefined): void {
        this.weather.push(value);
      }
    }
    const mirror = new SceneMirror(),
      backend = new WeatherBackend();
    mirror.applyKeyframe(
      keyframe({ a: { weather: { visibility: 500 } }, b: { weather: { visibility: 2000 } } }),
    );
    mirror.reconcile(backend);
    expect(backend.weather).toEqual([{ visibility: 500 }]);
    mirror.applyDelta(delta({ removedComponents: { a: ['weather'] } }));
    mirror.reconcile(backend);
    expect(backend.weather.at(-1)).toEqual({ visibility: 2000 });
    mirror.applyDelta(
      delta({ tick: 2, baseTick: 1, changed: { b: { weather: { visibility: 1200 } } } }),
    );
    mirror.reconcile(backend);
    expect(backend.weather.at(-1)).toEqual({ visibility: 1200 });
    mirror.applyKeyframe(keyframe({}));
    mirror.reconcile(backend);
    expect(backend.weather.at(-1)).toBeUndefined();
    expect(backend.weather).toHaveLength(4);
  });

  it('defaults missing rotations and includes light-only entity transforms', () => {
    const m = new SceneMirror();
    m.applyKeyframe(
      keyframe({ lamp: { transform: { pos: [1, 2, 3] }, light: { type: 'point' } } }),
    );
    expect(m.transforms().get('lamp')).toEqual({ pos: [1, 2, 3], rot: [0, 0, 0, 1] });
  });
});
