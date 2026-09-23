import type { EntityId, Keyframe } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { InterpTransform } from '../src/interpolation';
import { type LightData, type Renderable, type SceneBackend, SceneMirror } from '../src/sync';

class MockBackend implements SceneBackend {
  lights = new Map<EntityId, LightData>();
  lightUpdates = 0;
  environments: (Record<string, unknown> | undefined)[] = [];
  create(_id: EntityId, _r: Renderable): void {}
  updateRenderable(_id: EntityId, _r: Renderable): void {}
  destroy(_id: EntityId): void {}
  setTransform(_id: EntityId, _t: InterpTransform): void {}
  createLight(id: EntityId, light: LightData): void {
    this.lights.set(id, light);
  }
  updateLight(id: EntityId, light: LightData): void {
    this.lights.set(id, light);
    this.lightUpdates++;
  }
  destroyLight(id: EntityId): void {
    this.lights.delete(id);
  }
  setEnvironment(env: Record<string, unknown> | undefined): void {
    this.environments.push(env);
  }
}

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

describe('light + environment reconciliation', () => {
  it('binds light components, updates on change, destroys with the entity', () => {
    const mirror = new SceneMirror();
    const backend = new MockBackend();
    mirror.applyKeyframe(
      keyframe({
        lamp: {
          transform: { pos: [0, 3, 0], rot: [0, 0, 0, 1] },
          light: { type: 'point', intensity: 2 },
        },
      }),
    );
    mirror.reconcile(backend);
    expect(backend.lights.get('lamp')?.type).toBe('point');

    mirror.applyDelta({
      kind: 'delta',
      v: 1,
      tick: 1,
      baseTick: 0,
      spawned: {},
      destroyed: [],
      changed: { lamp: { light: { type: 'point', intensity: 5 } } },
      removedComponents: {},
      events: [],
    });
    mirror.reconcile(backend);
    expect(backend.lightUpdates).toBe(1);
    expect(backend.lights.get('lamp')?.intensity).toBe(5);

    mirror.applyDelta({
      kind: 'delta',
      v: 1,
      tick: 2,
      baseTick: 1,
      spawned: {},
      destroyed: ['lamp'],
      changed: {},
      removedComponents: {},
      events: [],
    });
    mirror.reconcile(backend);
    expect(backend.lights.has('lamp')).toBe(false);
  });

  it('routes the singleton environment component (and its removal) to the backend', () => {
    const mirror = new SceneMirror();
    const backend = new MockBackend();
    mirror.applyKeyframe(
      keyframe({ env: { environment: { shadows: 'medium', background: '#101010' } } }),
    );
    mirror.reconcile(backend);
    mirror.reconcile(backend); // unchanged -> no re-apply
    expect(backend.environments).toHaveLength(1);
    expect(backend.environments[0]?.shadows).toBe('medium');

    mirror.applyKeyframe(keyframe({}));
    mirror.reconcile(backend);
    expect(backend.environments).toHaveLength(2);
    expect(backend.environments[1]).toBeUndefined();
  });
});
