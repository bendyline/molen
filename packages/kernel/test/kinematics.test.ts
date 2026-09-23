import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defineComponent, Transform } from '../src/component';
import { installKinematics, overlapCircle, raycast } from '../src/kinematics';
import { stateHash } from '../src/snapshot';
import { World } from '../src/world';

function world(): World {
  const w = new World({ tickRate: 10 });
  installKinematics(w);
  return w;
}

function spawnBody(
  w: World,
  id: string,
  pos: [number, number, number],
  vel: [number, number, number],
  slide = false,
): void {
  w.spawnRaw(
    {
      transform: { pos, rot: [0, 0, 0, 1] },
      collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
      kinematicBody: { vel, slide },
    },
    id,
  );
}

function spawnStatic(
  w: World,
  id: string,
  pos: [number, number, number],
  shape: 'circle' | 'aabb' = 'aabb',
): void {
  w.spawnRaw(
    {
      transform: { pos, rot: [0, 0, 0, 1] },
      collider:
        shape === 'aabb'
          ? { shape: 'aabb', halfExtents: [1, 1], layer: 1, mask: 1, isStatic: true }
          : { shape: 'circle', radius: 1, layer: 1, mask: 1, isStatic: true },
    },
    id,
  );
}

describe('kinematics', () => {
  it('rejects zero-sized colliders instead of entering an unbounded substep loop', () => {
    const w = new World({ tickRate: 60 });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0, layer: 1, mask: 1 },
        kinematicBody: { vel: [1, 0, 0], slide: true },
      },
      'bad',
    );
    installKinematics(w);
    expect(() => w.step()).toThrow(/radius must be finite and greater than 0/);
  });

  it('moves a free body by velocity * dt', () => {
    const w = world();
    spawnBody(w, 'p', [0, 0, 0], [10, 0, 0]);
    w.step();
    expect(w.get('p', Transform)?.pos[0]).toBeCloseTo(1); // 10 * 0.1
  });

  it('stops a body at a static wall', () => {
    const w = world();
    // wall AABB centered at x=3, halfExtents 1 -> face at x=2. Body r=0.5 stops near x=1.5.
    spawnStatic(w, 'wall', [3, 0, 0]);
    spawnBody(w, 'p', [0, 0, 0], [100, 0, 0]);
    w.stepN(5);
    const x = w.get('p', Transform)?.pos[0] ?? 0;
    expect(x).toBeLessThanOrEqual(1.6);
    expect(x).toBeGreaterThan(1.0);
  });

  it('pushes two overlapping circles apart', () => {
    const w = world();
    spawnBody(w, 'a', [0, 0, 0], [1, 0, 0]);
    spawnBody(w, 'b', [0.5, 0, 0], [-1, 0, 0]); // overlapping (centers 0.5 apart, r+r=1)
    w.step();
    const ax = w.get('a', Transform)?.pos[0] ?? 0;
    const bx = w.get('b', Transform)?.pos[0] ?? 0;
    expect(bx - ax).toBeGreaterThanOrEqual(0.9); // separated to ~1 apart
  });

  it('emits collision events', () => {
    const w = world();
    const events: unknown[] = [];
    w.on('collision', (e) => events.push(e.payload));
    spawnStatic(w, 'wall', [2, 0, 0]);
    spawnBody(w, 'p', [0, 0, 0], [100, 0, 0]);
    w.step();
    expect(events.length).toBeGreaterThan(0);
    expect((events[0] as { a: string; b: string }).a).toBe('p');
  });

  it('slide lets a body glide along a wall', () => {
    const w = world();
    // wall face at x=2; body moves diagonally into it. With slide, z-motion continues.
    spawnStatic(w, 'wall', [3, 0, 0]);
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
        kinematicBody: { vel: [50, 0, 20], slide: true },
      },
      'p',
    );
    w.stepN(5);
    const z = w.get('p', Transform)?.pos[2] ?? 0;
    expect(z).toBeGreaterThan(1); // slid along z despite the wall blocking x
  });

  it('is deterministic across runs', () => {
    const run = (): number[] => {
      const w = world();
      spawnStatic(w, 'wall', [4, 0, 0]);
      spawnBody(w, 'p', [0, 0, 0], [30, 0, 5]);
      spawnBody(w, 'q', [1, 0, 1], [10, 0, -3], true);
      w.stepN(20);
      const p = w.get('p', Transform)?.pos ?? [0, 0, 0];
      const q = w.get('q', Transform)?.pos ?? [0, 0, 0];
      return [...p, ...q];
    };
    expect(run()).toEqual(run());
  });
});

describe('queries', () => {
  it('raycast hits the nearest collider', () => {
    const w = world();
    spawnStatic(w, 'far', [10, 0, 0], 'circle');
    spawnStatic(w, 'near', [5, 0, 0], 'circle');
    const hit = raycast(w, [0, 0, 0], [1, 0, 0], 100);
    expect(hit?.id).toBe('near');
    expect(hit?.distance).toBeCloseTo(4, 1); // center 5, radius 1 -> hit at x=4
  });

  it('raycast misses when nothing is in the path', () => {
    const w = world();
    spawnStatic(w, 's', [0, 0, 10], 'circle');
    expect(raycast(w, [0, 0, 0], [1, 0, 0], 5)).toBeNull();
  });

  it('overlapCircle finds colliders within a radius', () => {
    const w = world();
    spawnStatic(w, 'a', [1, 0, 0], 'circle');
    spawnStatic(w, 'b', [20, 0, 0], 'circle');
    const hits = overlapCircle(w, [0, 0, 0], 2);
    expect(hits).toContain('a');
    expect(hits).not.toContain('b');
  });
});

describe('kinematics broad phase', () => {
  const Vel = defineComponent<{ vel: [number, number, number]; slide: boolean }>('kinematicBody');

  interface Body {
    x: number;
    z: number;
    r: number;
    vx: number;
    vz: number;
    slide: boolean;
  }
  interface Obstacle {
    x: number;
    z: number;
    shape: 'circle' | 'aabb';
    a: number;
    b: number;
    layer: number;
    mask: number;
    isStatic: boolean;
  }

  function worldFor(
    bodies: Body[],
    obstacles: Obstacle[],
    broadphase: 'grid' | 'brute',
  ): { w: World; events: string[] } {
    const w = new World({ tickRate: 10, seed: 'bp' });
    installKinematics(w, { broadphase });
    const events: string[] = [];
    w.on('collision', (e) => events.push(JSON.stringify(e.payload)));
    obstacles.forEach((o, i) => {
      w.spawnRaw(
        {
          transform: { pos: [o.x, 0, o.z], rot: [0, 0, 0, 1] },
          collider: {
            shape: o.shape,
            ...(o.shape === 'circle' ? { radius: o.a } : { halfExtents: [o.a, o.b] }),
            layer: o.layer,
            mask: o.mask,
            isStatic: o.isStatic,
          },
        },
        `o${i}`,
      );
    });
    bodies.forEach((b, i) => {
      w.spawnRaw(
        {
          transform: { pos: [b.x, 0, b.z], rot: [0, 0, 0, 1] },
          collider: { shape: 'circle', radius: b.r, layer: 1, mask: 3 },
          kinematicBody: { vel: [b.vx, 0, b.vz], slide: b.slide },
        },
        `b${i}`,
      );
    });
    return { w, events };
  }

  it('the grid reproduces the brute-force result bit for bit (property)', () => {
    const num = (min: number, max: number): fc.Arbitrary<number> =>
      fc.integer({ min: min * 100, max: max * 100 }).map((v) => v / 100);
    const bodyArb: fc.Arbitrary<Body> = fc.record({
      x: num(0, 60),
      z: num(0, 60),
      r: num(0.2, 3),
      vx: num(-40, 40),
      vz: num(-40, 40),
      slide: fc.boolean(),
    });
    const obstacleArb: fc.Arbitrary<Obstacle> = fc.record({
      x: num(0, 60),
      z: num(0, 60),
      shape: fc.constantFrom('circle', 'aabb') as fc.Arbitrary<'circle' | 'aabb'>,
      a: num(0.2, 3),
      b: num(0.2, 3),
      layer: fc.constantFrom(1, 2),
      mask: fc.constantFrom(1, 2, 3),
      isStatic: fc.boolean(),
    });
    fc.assert(
      fc.property(
        fc.array(bodyArb, { minLength: 1, maxLength: 40 }),
        fc.array(obstacleArb, { maxLength: 40 }),
        (bodies, obstacles) => {
          const grid = worldFor(bodies, obstacles, 'grid');
          const brute = worldFor(bodies, obstacles, 'brute');
          grid.w.stepN(10);
          brute.w.stepN(10);
          expect(stateHash(grid.w)).toBe(stateHash(brute.w));
          expect(grid.events).toEqual(brute.events);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('skips static bodies and bodies without a circle collider, with one diagnostic each', () => {
    const w = new World({ tickRate: 10 });
    installKinematics(w);
    const diags: string[] = [];
    w.on('kinematics-error', (e) => diags.push(JSON.stringify(e.payload)));
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1, isStatic: true },
        kinematicBody: { vel: [5, 0, 0], slide: false },
      },
      'static',
    );
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 5], rot: [0, 0, 0, 1] },
        collider: { shape: 'aabb', halfExtents: [1, 1], layer: 1, mask: 1 },
        kinematicBody: { vel: [5, 0, 0], slide: false },
      },
      'boxy',
    );
    w.stepN(3);
    expect(w.get('static', Transform)?.pos[0]).toBe(0);
    expect(w.get('boxy', Transform)?.pos[0]).toBe(0);
    expect(diags).toEqual([
      '{"entity":"static","code":"static-body"}',
      '{"entity":"boxy","code":"no-circle-collider"}',
    ]);
  });

  it('integrates vertical velocity (and clamps to a flat ground when asked)', () => {
    const free = new World({ tickRate: 10 });
    installKinematics(free);
    free.spawnRaw(
      {
        transform: { pos: [0, 5, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
        kinematicBody: { vel: [0, -20, 0], slide: false },
      },
      'b',
    );
    free.stepN(10);
    expect(free.get('b', Transform)?.pos[1]).toBeCloseTo(-15, 5);

    const flat = new World({ tickRate: 10 });
    installKinematics(flat, { ground: 'flat' });
    flat.spawnRaw(
      {
        transform: { pos: [0, 5, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
        kinematicBody: { vel: [0, -20, 0], slide: false },
      },
      'b',
    );
    flat.stepN(10);
    expect(flat.get('b', Transform)?.pos[1]).toBe(0);
    expect(flat.get('b', Vel)?.vel[1]).toBe(0);
  });

  it('raycast treats boxes as boxes (slab test), not as circles', () => {
    const w = new World({ tickRate: 10 });
    installKinematics(w);
    // A long thin wall along z at x = 10.
    w.spawnRaw(
      {
        transform: { pos: [10, 0, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'aabb', halfExtents: [0.5, 10], layer: 1, mask: 1, isStatic: true },
      },
      'wall',
    );
    // A ray passing beside the wall's end (z = 12) misses; the old radius-10 circle would hit.
    expect(raycast(w, [0, 0, 12], [1, 0, 0], 50)).toBeNull();
    // A ray straight at the face hits at exactly the near face.
    const hit = raycast(w, [0, 0, 0], [1, 0, 0], 50);
    expect(hit?.id).toBe('wall');
    expect(hit?.distance).toBeCloseTo(9.5, 6);
    // Axis-aligned ray with dx = 0 through the wall's span.
    const down = raycast(w, [10, 0, -20], [0, 0, 1], 50);
    expect(down?.distance).toBeCloseTo(10, 6);
  });
});
