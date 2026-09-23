import {
  createRng,
  defineComponent,
  World as KernelWorld,
  type System,
  Transform,
  type World,
} from '@bendyline/molen-kernel';
import { installKinematics } from '@bendyline/molen-kernel/kinematics';
import { describe, expect, it } from 'vitest';
import { computeFlowField, Grid } from '../src/index';

// Integration: many units follow one flow field around an obstacle to a shared goal, with
// kinematic collision between them. The RTS movement pattern — one field, N agents.

const Unit = defineComponent<{ speed: number }>('unit');

function dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

describe('RTS flow-field movement', () => {
  it('routes a squad around a wall to the goal', () => {
    const grid = new Grid({ cols: 20, rows: 20, cellSize: 1, origin: [0, 0] });
    // A wall across the middle with a gap on the right.
    for (let cx = 0; cx < 16; cx++) grid.setBlocked(cx, 10);
    const goal: [number, number] = grid.cellToWorld(2, 18) as [number, number]; // bottom-left
    const field = computeFlowField(grid, goal);

    const w: World = new KernelWorld({ tickRate: 30, seed: 'rts' });
    installKinematics(w);

    // 12 units spawned in the top-left, above the wall.
    const rng = createRng('squad');
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const x = 2 + rng.range(0, 6);
      const z = 2 + rng.range(0, 4);
      ids.push(
        w.spawnRaw(
          {
            transform: { pos: [x, 0, z], rot: [0, 0, 0, 1] },
            collider: { shape: 'circle', radius: 0.35, layer: 1, mask: 1 },
            kinematicBody: { vel: [0, 0, 0], slide: true },
            unit: { speed: 6 },
          },
          `u${i}`,
        ),
      );
    }

    // Steering system: set each unit's velocity from the flow field at its position.
    const steer: System = (world) => {
      for (const [id, t, u] of world.query(Transform, Unit)) {
        const [dx, dz] = field.directionAt(t.pos[0], t.pos[2]);
        world.patch(id, defineComponent('kinematicBody'), {
          vel: [dx * u.speed, 0, dz * u.speed],
          slide: true,
        });
      }
    };
    w.addSystem(steer, { phase: 'update', name: 'steer' });

    const goal3: [number, number, number] = [goal[0], 0, goal[1]];
    const avgDist = (): number =>
      ids.reduce(
        (s, id) => s + dist(w.get(id, Transform)?.pos as [number, number, number], goal3),
        0,
      ) / ids.length;
    const before = avgDist();
    w.stepN(480); // 16s
    const after = avgDist();

    // Every unit crossed past the wall row via the gap (the routing-around-obstacle claim).
    for (const id of ids) {
      expect(w.get(id, Transform)?.pos[2] ?? 0).toBeGreaterThan(9);
    }
    // And the squad made clear progress toward the goal along the way.
    expect(after).toBeLessThan(before * 0.7);
  });

  it('is deterministic for the whole squad', () => {
    const run = (): number[] => {
      const grid = new Grid({ cols: 12, rows: 12, cellSize: 1 });
      grid.setBlocked(6, 6);
      const field = computeFlowField(grid, grid.cellToWorld(11, 11) as [number, number]);
      const w = new KernelWorld({ tickRate: 30, seed: 'det' });
      installKinematics(w);
      for (let i = 0; i < 6; i++) {
        w.spawnRaw(
          {
            transform: { pos: [1 + i * 0.5, 0, 1], rot: [0, 0, 0, 1] },
            collider: { shape: 'circle', radius: 0.3, layer: 1, mask: 1 },
            kinematicBody: { vel: [0, 0, 0], slide: true },
            unit: { speed: 5 },
          },
          `u${i}`,
        );
      }
      const kb = defineComponent('kinematicBody');
      w.addSystem(
        (world) => {
          for (const [id, t, u] of world.query(Transform, Unit)) {
            const [dx, dz] = field.directionAt(t.pos[0], t.pos[2]);
            world.patch(id, kb, { vel: [dx * u.speed, 0, dz * u.speed], slide: true });
          }
        },
        { name: 'steer' },
      );
      w.stepN(120);
      const out: number[] = [];
      for (let i = 0; i < 6; i++) out.push(...((w.get(`u${i}`, Transform)?.pos as number[]) ?? []));
      return out;
    };
    expect(run()).toEqual(run());
  });
});
