import { createDiorama } from '@bendyline/molen-dioramas/kernel';
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import {
  applyKeyframeTo,
  buildWorld,
  stateHash,
  Transform,
  takeKeyframe,
} from '@bendyline/molen-kernel';
import { describe, expect, it } from 'vitest';
import { loadDiorama } from '../src/load-diorama';

const cases = [
  ['flight-school', 'service-cart', 'crew-0'],
  ['airport-cargo', 'service-cart', 'crew-0'],
  ['airport', 'tug', 'cart-0'],
  ['little-league', 'runner', 'fielder-0'],
  ['fireworks', 'rocket-0', 'spark-0-0'],
  ['fair', 'gondola-0', 'carousel-seat-0'],
  ['market', 'shopper-0', 'handcart'],
] as const;

describe.each(cases)('%s content', (name, actor, companion) => {
  it('runs bounded choreography for 72 seconds without leaking entities, and restores exactly', async () => {
    const definition = await loadDiorama(name);
    const makeWorld = () =>
      buildWorld(definition.scene, undefined, {
        capabilities: [(world) => ({ figures: figuresScriptApi(installFigures(world)) })],
      });
    // Test the authored paths before the director's confinement guard can mask a bad path.
    const world = makeWorld();
    const initial = takeKeyframe(world);
    const count = world.entityCount;
    expect(count).toBeLessThanOrEqual(512);
    expect(count).toBeGreaterThan(50);
    const figures = Object.values(initial.entities).filter((entity) => entity.figure);
    expect(figures.length).toBeGreaterThan(0);
    expect(figures.every((entity) => entity.renderable?.kind === 'figure')).toBe(true);
    for (let tick = 0; tick < 2160; tick++) {
      world.step();
      if (tick % 30 !== 0) continue;
      expect(world.entityCount).toBe(count);
      for (const [id, transform] of world.query(Transform)) {
        for (let axis = 0; axis < 3; axis++) {
          const value = transform.pos[axis] as number;
          expect(Number.isFinite(value), id).toBe(true);
          expect(value, `${id} axis ${axis}`).toBeGreaterThanOrEqual(
            definition.bounds.min[axis] as number,
          );
          expect(value, `${id} axis ${axis}`).toBeLessThanOrEqual(
            definition.bounds.max[axis] as number,
          );
        }
      }
      if (tick === 210) {
        const snapshot = takeKeyframe(world);
        expect(snapshot.entities[actor]?.transform).not.toEqual(initial.entities[actor]?.transform);
        expect(snapshot.entities[companion]?.transform).not.toEqual(
          initial.entities[companion]?.transform,
        );
      }
    }
    if (name === 'airport') {
      const snapshot = takeKeyframe(world);
      const tugY = (snapshot.entities.tug?.transform?.pos as number[])[1] as number;
      const cabY = (snapshot.entities['tug-cab']?.transform?.pos as number[])[1] as number;
      expect(cabY - tugY).toBeCloseTo(1.55);
    }
    const restored = makeWorld();
    applyKeyframeTo(restored, takeKeyframe(world));
    for (let tick = 0; tick < 90; tick++) {
      world.step();
      restored.step();
    }
    expect(stateHash(restored)).toBe(stateHash(world));
    const restart = createDiorama(definition);
    expect(restart.keyframe().entities).toEqual(initial.entities);
    restart.dispose();
  }, 30_000);
});

it('rejects unknown content and respects an aborted load', async () => {
  await expect(loadDiorama('missing')).rejects.toThrow('Unknown diorama');
  const controller = new AbortController();
  controller.abort();
  await expect(loadDiorama('airport', controller.signal)).rejects.toThrow();
});
