import { type SceneManifest, validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { Transform } from '../src/component';
import { buildDataWorld } from '../src/data';
import { KinematicBody } from '../src/kinematics';
import { Mover, Path, RULE_ERROR, Rules, Vars } from '../src/play';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import type { World } from '../src/world';

function scene(doc: Record<string, unknown>): SceneManifest {
  const v = validate('scene', { format: 'molen/scene@3', name: 'play', ...doc });
  if (!v.ok) throw new Error(v.formatted);
  return v.value;
}

function events(world: World): { tick: number; type: string; payload: unknown }[] {
  const out: { tick: number; type: string; payload: unknown }[] = [];
  world.on('*', (e, ctx) => out.push({ tick: ctx.tick, type: e.type, payload: e.payload }));
  return out;
}

const at = (x: number, z: number): { pos: number[] } => ({ pos: [x, 0, z] });

/** A small coin game: a player body, two coins, a chaser, rules for pickup, hurt, win, lose. */
function coinGame(): SceneManifest {
  return scene({
    seed: 'coins',
    physics: { engine: 'kinematics' },
    commands: { move: { payload: { type: 'object' } } },
    entities: [
      { id: 'game', components: { vars: { score: 0, lives: 2, status: 'playing' } } },
      {
        id: 'player',
        components: {
          transform: at(0, 0),
          collider: { shape: 'circle', radius: 0.4, layer: 2, mask: 1 },
          kinematicBody: { vel: [0, 0, 0], slide: true },
          trigger: { radius: 0.4, layer: 1, mask: 6 },
          controller: { move: 'move', speed: 4 },
          tag: { name: 'player' },
        },
      },
      {
        id: 'c1',
        components: {
          transform: at(3, 0),
          trigger: { radius: 0.3, layer: 2, mask: 1 },
          tag: { name: 'coin' },
        },
      },
      {
        id: 'c2',
        components: {
          transform: at(6, 0),
          trigger: { radius: 0.3, layer: 2, mask: 1 },
          tag: { name: 'coin' },
        },
      },
      {
        id: 'dog',
        components: {
          transform: at(0, 8),
          trigger: { radius: 0.4, layer: 4, mask: 1 },
          mover: { mode: 'chase', target: '#player', speed: 1 },
          tag: { name: 'hazard' },
        },
      },
      {
        id: 'rules',
        components: {
          rules: {
            rules: [
              {
                id: 'pickup',
                when: { touch: ['#player', 'tag:coin'] },
                if: [{ select: '#game.vars.status', op: 'eq', value: 'playing' }],
                do: [
                  { destroy: '$b' },
                  { add: { target: '#game', component: 'vars', path: 'score', value: 1 } },
                ],
              },
              {
                id: 'hurt',
                when: { touch: ['#player', 'tag:hazard'] },
                if: [{ select: '#game.vars.status', op: 'eq', value: 'playing' }],
                do: [
                  { add: { target: '#game', component: 'vars', path: 'lives', value: -1 } },
                  { place: { target: '#player', at: [0, 0, 0] } },
                  { place: { target: '$b', at: [0, 0, 8] } },
                ],
              },
              {
                id: 'win',
                when: { becomes: { select: 'tag:coin', op: 'count', value: 0 } },
                once: true,
                do: [
                  { set: { target: '#game', component: 'vars', path: 'status', value: 'won' } },
                  { emit: { event: 'win' } },
                ],
              },
              {
                id: 'lose',
                when: { becomes: { select: '#game.vars.lives', op: 'lte', value: 0 } },
                once: true,
                do: [
                  { set: { target: '#game', component: 'vars', path: 'status', value: 'lost' } },
                  { emit: { event: 'lose' } },
                ],
              },
            ],
          },
        },
      },
    ],
  });
}

function send(world: World, seq: number, dir: [number, number]): void {
  const r = world.submitCommand({
    kind: 'command',
    seq,
    source: 'test',
    tick: world.tick,
    type: 'move',
    payload: { dir },
  });
  expect(r.accepted).toBe(true);
}

describe('rules of play as data', () => {
  it('collects coins by touch and wins once when none are left', () => {
    const w = buildDataWorld(coinGame());
    const log = events(w);
    send(w, 1, [1, 0]);
    w.stepN(60);
    expect(w.get('player', KinematicBody)?.vel[0]).toBe(4);
    expect(w.get('game', Vars)?.score).toBe(2);
    expect(w.exists('c1')).toBe(false);
    expect(w.get('game', Vars)?.status).toBe('won');
    expect(log.filter((e) => e.type === 'win')).toHaveLength(1);
    // the rule's own state is component data: fired and was are in the hash
    const win = w.get('rules', Rules)?.rules.find((r) => r.id === 'win');
    expect(win?.fired).toBe(true);
  });

  it('costs a life on touching a hazard, resets positions, and loses at zero lives', () => {
    const w = buildDataWorld(coinGame());
    const log = events(w);
    // stand still: the chaser walks in
    w.stepN(30 * 16);
    expect(w.get('game', Vars)?.lives).toBe(0);
    expect(w.get('game', Vars)?.status).toBe('lost');
    expect(log.filter((e) => e.type === 'lose')).toHaveLength(1);
    // a placed entity snaps once, then interpolates again
    const placedAt = log.find((e) => e.type === 'teleport-clear');
    expect(placedAt).toBeDefined();
    expect(w.get('player', Transform)?.teleport).toBeUndefined();
  });

  it('a failing rule emits rule-error, is disabled, and the world keeps stepping', () => {
    const w = buildDataWorld(
      scene({
        entities: [
          {
            id: 'r',
            components: {
              rules: {
                rules: [
                  // set without a path needs an object: this throws at runtime
                  { when: { every: 2 }, do: [{ set: { component: 'vars', value: 3 } }] },
                ],
              },
            },
          },
        ],
      }),
    );
    const log = events(w);
    w.stepN(20);
    expect(w.faulted).toBeUndefined();
    expect(w.tick).toBe(20);
    expect(log.filter((e) => e.type === RULE_ERROR)).toHaveLength(1);
    expect(w.get('r', Rules)?.rules[0]?.disabled).toBe('action-failed');
  });

  it('restores from a keyframe mid-game and continues bit for bit', () => {
    const manifest = coinGame();
    const straight = buildDataWorld(manifest);
    send(straight, 1, [1, 0.3]);
    straight.stepN(200);

    const first = buildDataWorld(manifest);
    send(first, 1, [1, 0.3]);
    first.stepN(77);
    const kf = takeKeyframe(first);
    const resumed = buildDataWorld(manifest);
    applyKeyframeTo(resumed, kf);
    resumed.stepN(200 - 77);
    expect(stateHash(resumed)).toBe(stateHash(straight));
  });

  it('refuses a manifest with scripts in the data-only entry', () => {
    const manifest = scene({ scripts: [{ id: 's', code: 'molen.on("tick", () => {})' }] });
    expect(() => buildDataWorld(manifest)).toThrow(/has scripts/);
  });
});

describe('cues, paths and movers', () => {
  it('runs cues at their tick, and again each loop', () => {
    const w = buildDataWorld(
      scene({
        entities: [
          { id: 'game', components: { vars: { n: 0 } } },
          {
            id: 'd',
            components: {
              cues: {
                loop: 10,
                cues: [
                  {
                    tick: 3,
                    do: [{ add: { target: '#game', component: 'vars', path: 'n', value: 1 } }],
                  },
                ],
              },
            },
          },
        ],
      }),
    );
    w.stepN(25);
    expect(w.get('game', Vars)?.n).toBe(3);
  });

  it('walks a path at a speed, then removes it and emits path-complete', () => {
    const w = buildDataWorld(
      scene({
        tickRate: 10,
        entities: [
          {
            id: 'ana',
            components: {
              transform: at(0, 0),
              path: {
                points: [
                  [2, 0, 0],
                  [2, 0, 2],
                ],
                speed: 2,
                id: 'walk',
              },
            },
          },
        ],
      }),
    );
    const log = events(w);
    w.stepN(5);
    expect(w.get('ana', Transform)?.pos[0]).toBeCloseTo(1, 10);
    w.stepN(15);
    expect(w.get('ana', Transform)?.pos).toEqual([2, 0, 2]);
    expect(w.has('ana', Path)).toBe(false);
    expect(log.filter((e) => e.type === 'path-complete')).toEqual([
      { tick: 19, type: 'path-complete', payload: { entity: 'ana', id: 'walk' } },
    ]);
  });

  it('waits out a delay, eases over a number of ticks, and pingpongs', () => {
    const w = buildDataWorld(
      scene({
        entities: [
          {
            id: 'p',
            components: {
              transform: at(0, 0),
              path: {
                points: [[4, 0, 0]],
                ticks: 10,
                easing: 'smooth',
                delay: 5,
                loop: 'pingpong',
              },
            },
          },
        ],
      }),
    );
    w.stepN(5);
    expect(w.get('p', Transform)?.pos[0]).toBe(0);
    w.stepN(5);
    expect(w.get('p', Transform)?.pos[0]).toBeCloseTo(2, 10);
    w.stepN(5);
    expect(w.get('p', Transform)?.pos[0]).toBe(4);
    w.stepN(10);
    expect(w.get('p', Transform)?.pos[0]).toBe(0);
  });

  it('delays a tween before it starts', () => {
    const w = buildDataWorld(
      scene({
        entities: [
          {
            id: 't',
            components: {
              transform: at(0, 0),
              tween: {
                tweens: [{ component: 'transform', path: 'pos[1]', to: 3, ticks: 3, delay: 4 }],
              },
            },
          },
        ],
      }),
    );
    w.stepN(4);
    expect(w.get('t', Transform)?.pos[1]).toBe(0);
    w.stepN(3);
    expect(w.get('t', Transform)?.pos[1]).toBe(3);
  });

  it('chases with a kinematic body and wanders reproducibly', () => {
    const make = (): World =>
      buildDataWorld(
        scene({
          seed: 'wander',
          physics: { engine: 'kinematics' },
          entities: [
            { id: 'target', components: { transform: at(10, 0) } },
            {
              id: 'chaser',
              components: {
                transform: at(0, 0),
                collider: { shape: 'circle', radius: 0.4, layer: 1, mask: 1 },
                kinematicBody: { vel: [0, 0, 0], slide: true },
                mover: { mode: 'chase', target: '#target', speed: 3 },
              },
            },
            {
              id: 'moth',
              components: {
                transform: at(0, 0),
                mover: { mode: 'wander', speed: 2, turnTicks: 15 },
              },
            },
          ],
        }),
      );
    const a = make();
    a.step();
    expect(a.get('chaser', KinematicBody)?.vel).toEqual([3, 0, 0]);
    a.stepN(120);
    const b = make();
    b.stepN(121);
    expect(a.get('moth', Transform)?.pos).toEqual(b.get('moth', Transform)?.pos);
    expect(a.get('moth', Mover)?.heading).toBeDefined();
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('touches boxes in the side-view plane and respects layer masks', () => {
    const w = buildDataWorld(
      scene({
        entities: [
          {
            id: 'runner',
            components: {
              transform: { pos: [0, 1, 0] },
              trigger: { shape: 'box', halfExtents: [0.4, 0.6], plane: 'xy', layer: 1, mask: 2 },
            },
          },
          {
            id: 'spike',
            components: {
              transform: { pos: [0.5, 0.4, 0] },
              trigger: { shape: 'box', halfExtents: [0.4, 0.2], plane: 'xy', layer: 2, mask: 1 },
            },
          },
          {
            id: 'decor',
            components: {
              transform: { pos: [0.5, 0.4, 0] },
              trigger: { shape: 'box', halfExtents: [0.4, 0.2], plane: 'xy', layer: 8, mask: 8 },
            },
          },
          { id: 'ground', components: { transform: { pos: [0, 1, 0] }, trigger: { radius: 2 } } },
        ],
      }),
    );
    const log = events(w);
    w.step();
    expect(log.filter((e) => e.type === 'touch').map((e) => e.payload)).toEqual([
      { a: 'runner', b: 'spike' },
    ]);
  });
});
