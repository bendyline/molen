import { installHierarchy, stateHash, World } from '@bendyline/molen-kernel';
import { installCharacterController } from '@bendyline/molen-kernel/character';
import { perTickHashes } from '@bendyline/molen-kernel/testing';
import { describe, expect, it } from 'vitest';
import { Figure, type FiguresHandle, installFigures } from '../src/kernel';

function build(clientStandIn: boolean): World {
  const w = new World({ tickRate: 60, seed: 'determinism' });
  installHierarchy(w);
  installCharacterController(w);
  const figures: FiguresHandle = installFigures(w);
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      figure: { preset: 'human.adult', seed: 'alice' },
      character: { speed: 1.6, jumpSpeed: 6, gravity: 20, vy: 0, grounded: true },
      moveIntent: { dir: [1, 0.3], jump: false },
    },
    'p',
  );
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      parent: { id: 'p' },
      figureAttachment: { socket: 'head.top' },
    },
    'hat',
  );
  w.spawnRaw(
    {
      transform: { pos: [4, 0, 0], rot: [0, 0, 0, 1] },
      figure: { preset: 'horse' },
      figureIntent: { lookAt: { entity: 'p' } },
    },
    'h',
  );
  w.spawnRaw(
    {
      transform: { pos: [4, 0, 0], rot: [0, 0, 0, 1] },
      parent: { id: 'h' },
      figureAttachment: { socket: 'saddle' },
    },
    'saddle-bag',
  );
  if (clientStandIn) {
    // A read-only consumer evaluating every figure's pose each tick (what the client does).
    w.addSystem(
      (world, ctx) => {
        for (const [id] of world.query(Figure)) figures.poseAt(id, ctx.tick + 0.5);
      },
      { phase: 'late', name: 'client-stand-in', priority: 200 },
    );
  }
  return w;
}

describe('figures determinism', () => {
  it('hashes identically across runs', () => {
    const run = (): string => {
      const w = build(false);
      w.stepN(180);
      return stateHash(w);
    };
    expect(run()).toBe(run());
  });

  it('is unaffected by a pose-evaluating client', () => {
    const plain = perTickHashes(() => build(false), [], 120);
    const withClient = perTickHashes(() => build(true), [], 120);
    expect(withClient).toEqual(plain);
  });
});
