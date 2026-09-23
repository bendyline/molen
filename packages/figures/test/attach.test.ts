import {
  installHierarchy,
  LocalTransform,
  Parent,
  Transform,
  World,
} from '@bendyline/molen-kernel';
import { installCharacterController, MoveIntent } from '@bendyline/molen-kernel/character';
import { Mounted } from '@bendyline/molen-kernel/vehicles';
import { describe, expect, it } from 'vitest';
import { FigureAttachment, FigureState, type FiguresHandle, installFigures } from '../src/kernel';

function figureWorld(): { w: World; figures: FiguresHandle; errors: unknown[] } {
  const w = new World({ tickRate: 60, seed: 'attach' });
  installHierarchy(w);
  installCharacterController(w);
  const figures = installFigures(w);
  const errors: unknown[] = [];
  w.on('figures-error', (e) => errors.push(e.payload));
  w.spawnRaw(
    {
      transform: { pos: [1, 0, 2], rot: [0, 0, 0, 1] },
      figure: { preset: 'human.adult' },
      character: { speed: 1.4, jumpSpeed: 6, gravity: 20, vy: 0, grounded: true },
      moveIntent: { dir: [0, 0], jump: false },
    },
    'p',
  );
  return { w, figures, errors };
}

function expectClose(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
  tolerance = 0.006,
): void {
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  for (let i = 0; i < (a?.length ?? 0); i++) {
    expect(Math.abs((a?.[i] as number) - (b?.[i] as number))).toBeLessThanOrEqual(tolerance);
  }
}

describe('figure attachments', () => {
  it('places a hat on the head socket through the hierarchy', () => {
    const { w, figures } = figureWorld();
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'primitive', ref: 'box' },
        parent: { id: 'p' },
        figureAttachment: { socket: 'head.top' },
      },
      'hat',
    );
    w.stepN(2);
    const socket = figures.socket('p', 'head.top');
    expectClose(w.get('hat', Transform)?.pos, socket?.pos);
    expect(w.get('hat', Transform)?.pos[1]).toBeGreaterThan(1.6);
    // Walking: the hat keeps following the animated head.
    w.set('p', MoveIntent, { dir: [1, 0], jump: false });
    w.stepN(45);
    expect(w.get('p', FigureState)?.mode).toBe('walk');
    const later = figures.socket('p', 'head.top');
    expectClose(w.get('hat', Transform)?.pos, later?.pos, 0.02);
    expect(w.get('hat', Transform)?.pos[0]).toBeGreaterThan(1.5);
  });

  it('applies the authored offset and keeps localTransform quiet while idle', () => {
    const { w } = figureWorld();
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        parent: { id: 'p' },
        figureAttachment: { socket: 'hand.r', offset: { pos: [0, 0.1, 0] } },
      },
      'sword',
    );
    w.stepN(2);
    const local = w.get('sword', LocalTransform);
    expect(local).toBeDefined();
    let writes = 0;
    let last = local;
    for (let i = 0; i < 120; i++) {
      w.step();
      const now = w.get('sword', LocalTransform);
      if (now !== last) writes++;
      last = now;
    }
    expect(writes).toBeLessThan(20);
  });

  it('reports an unknown socket or a non-figure parent once', () => {
    const { w, errors } = figureWorld();
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'rock');
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        parent: { id: 'p' },
        figureAttachment: { socket: 'antenna' },
      },
      'a',
    );
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        parent: { id: 'rock' },
        figureAttachment: { socket: 'head.top' },
      },
      'b',
    );
    w.stepN(5);
    expect(errors).toEqual([
      { entity: 'a', code: 'unknown-socket' },
      { entity: 'b', code: 'parent-not-figure' },
    ]);
  });

  it('cascades destruction from the figure to its attachments', () => {
    const { w } = figureWorld();
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        parent: { id: 'p' },
        figureAttachment: { socket: 'back' },
      },
      'pack',
    );
    w.stepN(2);
    w.destroy('p');
    w.stepN(2);
    expect(w.exists('pack')).toBe(false);
  });

  it('attaches and detaches through the handle without popping', () => {
    const { w, figures } = figureWorld();
    w.spawnRaw({ transform: { pos: [9, 9, 9], rot: [0, 0, 0, 1] } }, 'staff');
    w.step();
    expect(figures.attach('staff', 'p', 'hand.l', { rot: [0, 1, 0, 0] })).toBe(true);
    expect(figures.attach('staff', 'p', 'nowhere')).toBe(false);
    expect(w.get('staff', Parent)?.id).toBe('p');
    expect(w.get('staff', FigureAttachment)?.socket).toBe('hand.l');
    expectClose(w.get('staff', Transform)?.pos, figures.socket('p', 'hand.l')?.pos);
    w.stepN(3);
    const before = w.get('staff', Transform);
    expect(figures.detach('staff')).toBe(true);
    expect(w.has('staff', Parent)).toBe(false);
    w.stepN(3);
    expect(w.get('staff', Transform)).toEqual(before);
  });

  it('seats a rider on a figure mount and follows the animated saddle', () => {
    const { w, figures } = figureWorld();
    w.spawnRaw(
      { transform: { pos: [1.5, 0, 2], rot: [0, 0, 0, 1] }, figure: { preset: 'horse' } },
      'h',
    );
    w.step();
    expect(figures.mount('p', 'h')).toBe(true);
    expect(w.get('p', Mounted)).toEqual({ vehicle: 'h', seat: 'saddle' });
    w.stepN(2);
    expect(w.get('p', FigureState)?.mode).toBe('sit');
    expectClose(w.get('p', Transform)?.pos, figures.socket('h', 'saddle')?.pos);
    expect(figures.dismount('p')).toBe(true);
    expect(w.has('p', Mounted)).toBe(false);
  });
});
