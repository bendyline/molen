import { describe, expect, it } from 'vitest';
// Not part of the public surface: the timers system's own parking spot.
import { TIMERS_SINGLETON } from '../src/gameplay';
import {
  cancelTimer,
  defineComponent,
  installGameplay,
  Lifetime,
  Parent,
  scheduleTimer,
  setParent,
  startTween,
  Transform,
  World,
} from '../src/index';
import { runHeadless } from '../src/testing';

const Fsm = defineComponent<{
  state: string;
  transitions: { from: string; event: string; to: string }[];
}>('fsm');

function gameWorld(): World {
  const w = new World({ seed: 'g' });
  installGameplay(w);
  return w;
}

describe('gameplay layer', () => {
  it('lifetime counts down, emits, and despawns', () => {
    const w = gameWorld();
    const events: string[] = [];
    w.on('lifetime-expired', (e) => events.push((e.payload as { entity: string }).entity));
    w.spawnRaw({ lifetime: { ticksLeft: 3 } }, 'bomb');
    w.stepN(2);
    expect(w.exists('bomb')).toBe(true);
    expect(w.get('bomb', Lifetime)?.ticksLeft).toBe(1);
    w.step();
    expect(w.exists('bomb')).toBe(false);
    expect(events).toEqual(['bomb']);
  });

  it('timers fire at the exact tick, repeat, and die with their entity', () => {
    const w = gameWorld();
    const fired: number[] = [];
    w.on('ping', () => fired.push(w.tick));
    scheduleTimer(w, null, { ticks: 3, event: 'ping', repeatEvery: 2 });
    w.stepN(8);
    expect(fired).toEqual([2, 4, 6]); // fires DURING ticks 3,5,7 (handler sees pre-increment tick)
    expect(w.exists(TIMERS_SINGLETON)).toBe(true);
    // entity-scoped timers vanish with the entity
    w.spawnRaw({ tag: { name: 'x' } }, 'mortal');
    scheduleTimer(w, 'mortal', { ticks: 10, event: 'never-fires' });
    w.destroy('mortal');
    const before = fired.length;
    w.stepN(12);
    expect(fired.length).toBeGreaterThan(before); // singleton repeats continue
  });

  it('does not reuse generated timer ids after cancellation in the same tick', () => {
    const w = gameWorld();
    const first = scheduleTimer(w, null, { ticks: 10, event: 'first' });
    cancelTimer(w, null, first);
    const second = scheduleTimer(w, null, { ticks: 10, event: 'second' });
    expect(second).not.toBe(first);
  });

  it('tweens lerp values with easing and emit completion', () => {
    const w = gameWorld();
    const done: string[] = [];
    w.on('tween-complete', (e) => done.push((e.payload as { entity: string }).entity));
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'lift');
    startTween(w, 'lift', { component: 'transform', path: 'pos[1]', to: 10, ticks: 10 });
    w.stepN(5);
    const mid = w.get('lift', Transform)?.pos[1] ?? 0;
    expect(mid).toBeGreaterThan(3);
    expect(mid).toBeLessThan(7);
    w.stepN(5);
    expect(w.get('lift', Transform)?.pos[1]).toBe(10);
    expect(done).toEqual(['lift']);
  });

  it('fsm transitions on events targeting the entity (and wildcards)', () => {
    const w = gameWorld();
    w.spawnRaw(
      {
        fsm: {
          state: 'idle',
          transitions: [
            { from: 'idle', event: 'player_seen', to: 'aggro' },
            { from: '*', event: 'calm', to: 'idle' },
          ],
        },
      },
      'goblin',
    );
    w.emit('player_seen', { entity: 'goblin' });
    expect(w.get('goblin', Fsm)?.state).toBe('aggro');
    w.emit('calm', { entity: 'goblin' });
    expect(w.get('goblin', Fsm)?.state).toBe('idle');
    w.emit('player_seen', { entity: 'someone-else' });
    expect(w.get('goblin', Fsm)?.state).toBe('idle'); // targeted event, other entity
  });

  it('emits one diagnostic and stops when FSM transitions exceed the cascade limit', () => {
    const w = gameWorld();
    const transitions = [{ from: 's0', event: 'go', to: 's1' }];
    for (let i = 1; i < 24; i++) {
      transitions.push({ from: `s${i}`, event: 'fsm-transition', to: `s${i + 1}` });
    }
    w.spawnRaw({ fsm: { state: 's0', transitions } }, 'loop');
    let errors = 0;
    w.on('fsm-error', () => errors++);

    expect(() => w.emit('go', { entity: 'loop' })).not.toThrow();
    expect(errors).toBe(1);
    expect(w.get('loop', Fsm)?.state).toBe('s16');
  });

  it('hierarchy composes parent×local, cascades destroys, honors detach', () => {
    const w = gameWorld();
    w.spawnRaw({ transform: { pos: [10, 0, 0], rot: [0, 0, 0, 1] } }, 'base');
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        parent: { id: 'base' },
        localTransform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
      },
      'turret',
    );
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        parent: { id: 'base', onParentDestroyed: 'detach' },
        localTransform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] },
      },
      'antenna',
    );
    w.step();
    expect(w.get('turret', Transform)?.pos).toEqual([10, 2, 0]);
    expect(w.get('antenna', Transform)?.pos).toEqual([11, 0, 0]);

    w.destroy('base');
    w.stepN(2);
    expect(w.exists('turret')).toBe(false); // cascade
    expect(w.exists('antenna')).toBe(true); // detached, keeps last world pose
    expect(w.has('antenna', Parent)).toBe(false);
  });

  it('setParent keeps the child world pose (keep-world reparenting)', () => {
    const w = gameWorld();
    w.spawnRaw({ transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] } }, 'carrier');
    w.spawnRaw({ transform: { pos: [7, 1, 0], rot: [0, 0, 0, 1] } }, 'cargo');
    setParent(w, 'cargo', 'carrier');
    w.step();
    expect(w.get('cargo', Transform)?.pos).toEqual([7, 1, 0]); // unchanged world pose
    w.patch('carrier', Transform, { pos: [6, 0, 0] });
    w.step();
    expect(w.get('cargo', Transform)?.pos).toEqual([8, 1, 0]); // follows the parent
  });

  it('the whole layer is deterministic (hash-identical runs)', () => {
    const build = (): World => {
      const w = gameWorld();
      w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'a');
      w.spawnRaw(
        {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          parent: { id: 'a' },
          localTransform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] },
          lifetime: { ticksLeft: 50 },
        },
        'b',
      );
      startTween(w, 'a', {
        component: 'transform',
        path: 'pos[0]',
        to: 5,
        ticks: 40,
        easing: 'quadInOut',
      });
      scheduleTimer(w, null, { ticks: 7, event: 'beat', repeatEvery: 7 });
      return w;
    };
    const r1 = runHeadless(build, { ticks: 60 });
    const r2 = runHeadless(build, { ticks: 60 });
    expect(r1.finalHash).toBe(r2.finalHash);
    expect(r1.events.length).toBe(r2.events.length);
  });
});
