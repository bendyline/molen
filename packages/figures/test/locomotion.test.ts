import { installHierarchy, Transform, World } from '@bendyline/molen-kernel';
import {
  Character,
  installCharacterController,
  MoveIntent,
} from '@bendyline/molen-kernel/character';
import { yawOf } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  Figure,
  type FigureData,
  FigureIntent,
  FigureState,
  type FiguresHandle,
  installFigures,
} from '../src/kernel';

function figureWorld(): { w: World; figures: FiguresHandle } {
  const w = new World({ tickRate: 60, seed: 'figures' });
  installHierarchy(w);
  installCharacterController(w);
  const figures = installFigures(w);
  return { w, figures };
}

function spawnHuman(w: World, id: string, figure: Partial<FigureData> = {}): void {
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      figure: { preset: 'human.adult', ...figure },
      character: { speed: 1.4, jumpSpeed: 6, gravity: 20, vy: 0, grounded: true },
      moveIntent: { dir: [0, 0], jump: false },
    },
    id,
  );
}

/** Count how many times a component object changed identity over N ticks. */
function countWrites(w: World, id: string, ticks: number): number {
  let writes = 0;
  let last = w.get(id, FigureState);
  for (let i = 0; i < ticks; i++) {
    w.step();
    const now = w.get(id, FigureState);
    if (now !== last) writes++;
    last = now;
  }
  return writes;
}

describe('figure locomotion', () => {
  it('creates an idle state and leaves it alone while standing', () => {
    const { w } = figureWorld();
    spawnHuman(w, 'p');
    w.step();
    expect(w.get('p', FigureState)).toMatchObject({ mode: 'idle', speed: 0, strideRate: 0 });
    expect(countWrites(w, 'p', 120)).toBe(0);
  });

  it('walks with a steady stride and writes state only on change', () => {
    const { w } = figureWorld();
    spawnHuman(w, 'p');
    w.step();
    w.set('p', MoveIntent, { dir: [1, 0], jump: false });
    // Turning toward +x changes `travel` for a few ticks, then the state settles.
    w.stepN(30);
    const state = w.get('p', FigureState);
    expect(state?.mode).toBe('walk');
    expect(state?.speed).toBeCloseTo(1.4, 6);
    expect(state?.strideRate).toBeGreaterThan(0.9);
    expect(state?.strideRate).toBeLessThan(1.4);
    expect(state?.travel).toBeUndefined();
    expect(countWrites(w, 'p', 300)).toBe(0);
    expect(w.get('p', FigureState)).toBe(state);
  });

  it('turns toward its velocity and stops writing rotation once aligned', () => {
    const { w } = figureWorld();
    spawnHuman(w, 'p');
    w.set('p', MoveIntent, { dir: [1, 0], jump: false });
    w.stepN(40);
    expect(yawOf(w.get('p', Transform)?.rot ?? [0, 0, 0, 1])).toBeCloseTo(Math.PI / 2, 3);
    const rot = w.get('p', Transform)?.rot;
    w.stepN(10);
    expect(w.get('p', Transform)?.rot).toEqual(rot);
    const manual = figureWorld();
    spawnHuman(manual.w, 'p', { facing: 'manual' });
    manual.w.set('p', MoveIntent, { dir: [1, 0], jump: false });
    manual.w.stepN(40);
    expect(manual.w.get('p', Transform)?.rot).toEqual([0, 0, 0, 1]);
    expect(manual.w.get('p', FigureState)?.travel).toBeCloseTo(Math.PI / 2, 6);
  });

  it('runs above the Froude threshold and re-anchors the phase continuously', () => {
    const { w } = figureWorld();
    spawnHuman(w, 'p');
    w.step();
    w.set('p', MoveIntent, { dir: [0, 1], jump: false });
    w.stepN(20);
    const walk = w.get('p', FigureState);
    expect(walk?.mode).toBe('walk');
    w.patch('p', Character, { speed: 4 });
    w.step();
    const run = w.get('p', FigureState);
    expect(run?.mode).toBe('run');
    expect(run?.prevMode).toBe('walk');
    expect(run?.phaseAtTick).toBe(w.tick - 1);
    expect(run?.strideRate).toBeGreaterThan(walk?.strideRate ?? 0);
  });

  it('follows jump, fall and landing', () => {
    const { w } = figureWorld();
    spawnHuman(w, 'p');
    w.stepN(2);
    w.set('p', MoveIntent, { dir: [0, 0], jump: true });
    w.step();
    w.set('p', MoveIntent, { dir: [0, 0], jump: false });
    expect(w.get('p', FigureState)?.mode).toBe('jump');
    w.stepN(25);
    expect(w.get('p', FigureState)?.mode).toBe('fall');
    w.stepN(60);
    expect(w.get('p', FigureState)?.mode).toBe('idle');
  });

  it('honours an authored mode and look target', () => {
    const { w } = figureWorld();
    spawnHuman(w, 'p');
    w.set('p', FigureIntent, { mode: 'sit', lookAt: { pos: [3, 1, 3] } });
    w.stepN(3);
    const state = w.get('p', FigureState);
    expect(state?.mode).toBe('sit');
    expect(state?.lookAtTick).toBe(0);
  });

  it('derives speed from transform deltas when nothing else moves the entity', () => {
    const { w, figures } = figureWorld();
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        figure: { preset: 'horse' },
      },
      'h',
    );
    w.addSystem(
      (world, ctx) => {
        const t = world.get('h', Transform);
        if (t !== undefined)
          world.patch('h', Transform, { pos: [t.pos[0], 0, t.pos[2] + 1.2 * ctx.dt] });
      },
      { phase: 'update', name: 'mover' },
    );
    w.stepN(10);
    expect(w.get('h', FigureState)).toMatchObject({ mode: 'walk', gait: 'walk' });
    expect(w.get('h', FigureState)?.speed).toBeCloseTo(1.2, 6);
    expect(figures.rigOf('h')?.archetype).toBe('quadruped');
    w.removeSystem('mover');
    w.addSystem(
      (world, ctx) => {
        const t = world.get('h', Transform);
        if (t !== undefined)
          world.patch('h', Transform, { pos: [t.pos[0], 0, t.pos[2] + 9 * ctx.dt] });
      },
      { phase: 'update', name: 'gallop' },
    );
    w.stepN(10);
    expect(w.get('h', FigureState)).toMatchObject({ mode: 'run', gait: 'gallop' });
  });

  it('reports invalid descriptors once', () => {
    const { w } = figureWorld();
    const errors: unknown[] = [];
    w.on('figures-error', (e) => errors.push(e.payload));
    w.spawnRaw(
      { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, figure: { preset: 'dragon' } },
      'x',
    );
    w.stepN(5);
    expect(errors).toEqual([{ entity: 'x', code: 'invalid-descriptor' }]);
    expect(w.get('x', FigureState)).toBeUndefined();
    expect(w.has('x', Figure)).toBe(true);
  });
});
