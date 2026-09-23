import {
  applyKeyframeTo,
  stateHash,
  Transform,
  takeDelta,
  takeKeyframe,
  World,
} from '@bendyline/molen-kernel';
import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  Collider3D,
  Force,
  Impulse,
  initRapier,
  installRapier,
  Joint,
  type RapierHandle,
  Rigidbody,
  SetVelocity,
  Velocity,
} from '../src/index';

beforeAll(async () => {
  await initRapier();
});

function arena(): { w: World; h: RapierHandle } {
  const w = new World({ tickRate: 60, seed: 'phys' });
  const h = installRapier(w, { gravity: [0, -9.81, 0] });
  // A fixed floor (top surface at y=0.5; no rigidbody -> implicit fixed) and a dropped ball.
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      collider3d: { shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } },
    },
    'floor',
  );
  w.spawnRaw(
    {
      transform: { pos: [0, 5, 0], rot: [0, 0, 0, 1] },
      rigidbody: { body: 'dynamic' },
      collider3d: { shape: { type: 'ball', radius: 0.5 }, restitution: 0.1 },
    },
    'ball',
  );
  return { w, h };
}

function ballY(w: World): number {
  return w.get('ball', Transform)?.pos[1] ?? Number.NaN;
}

describe('rapier physics (collider3d + rigidbody)', () => {
  it('a dynamic ball falls onto a body-less static collider', () => {
    const { w } = arena();
    expect(ballY(w)).toBeCloseTo(5);
    w.stepN(180); // 3s
    expect(ballY(w)).toBeCloseTo(1.0, 1); // floor top 0.5 + radius 0.5
  });

  it('impulses, continuous forces, and setVelocity drive bodies', () => {
    const { w } = arena();
    w.stepN(180); // settle
    const x0 = w.get('ball', Transform)?.pos[0] ?? 0;
    w.set('ball', Impulse, { v: [20, 0, 0] });
    w.stepN(20);
    const x1 = w.get('ball', Transform)?.pos[0] ?? 0;
    expect(x1).toBeGreaterThan(x0 + 0.5);

    // Continuous force counteracting gravity holds the ball aloft.
    w.set('ball', SetVelocity, { linear: [0, 5, 0] });
    w.set('ball', Force, { linear: [0, 9.81, 0] }); // mass ~ ball; enough to slow the fall
    w.stepN(30);
    expect(ballY(w)).toBeGreaterThan(1.5);
  });

  it('mirrors velocity into the opt-in velocity component', () => {
    const { w } = arena();
    w.set('ball', Velocity, { linear: [0, 0, 0], angular: [0, 0, 0] });
    w.stepN(10);
    const v = w.get('ball', Velocity);
    expect(v?.linear[1] ?? 0).toBeLessThan(-0.5); // falling
  });

  it('a settled body stops churning its transform and mirrors again when it wakes', () => {
    const { w } = arena();
    w.stepN(600); // drop, bounce, and fall asleep on the floor
    const settled = w.get('ball', Transform);
    expect(settled?.pos[1] ?? 0).toBeCloseTo(1.0, 1);
    takeDelta(w, w.tick); // start from a clean dirty-tracking boundary

    w.stepN(120);
    // Same STORED reference: the mirror wrote nothing at all, so no delta clones it either.
    expect(w.get('ball', Transform)).toBe(settled);
    const quiet = takeDelta(w, w.tick);
    expect(quiet.changed.ball).toBeUndefined();

    // Waking up mirrors immediately, on the very tick the body moves.
    w.set('ball', Impulse, { v: [0, 6, 0] });
    w.stepN(1);
    const woken = w.get('ball', Transform);
    expect(woken).not.toBe(settled);
    expect(woken?.pos[1] ?? 0).toBeGreaterThan(settled?.pos[1] ?? 0);
    expect(takeDelta(w, w.tick).changed.ball?.transform).toBeDefined();
  });

  it('the velocity mirror also stops writing once a body is at rest', () => {
    const { w } = arena();
    w.set('ball', Velocity, { linear: [0, 0, 0], angular: [0, 0, 0] });
    w.stepN(600);
    const settled = w.get('ball', Velocity);
    expect(settled?.linear[1] ?? 1).toBe(0);
    w.stepN(60);
    expect(w.get('ball', Velocity)).toBe(settled);
  });

  it('is deterministic run-to-run (same build, same platform)', () => {
    const a = arena().w;
    a.stepN(120);
    const b = arena().w;
    b.stepN(120);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('snapshot resume is bit-exact and keyframes carry no handle leakage', () => {
    const { w } = arena();
    w.stepN(30);
    const kf = takeKeyframe(w);
    expect(kf.plugins.rapier).toBeDefined();
    // No _handle in component data — handles live in the plugin blob.
    expect(JSON.stringify(kf.entities)).not.toContain('_handle');
    w.stepN(30);
    const continuous = ballY(w);

    const { w: w2 } = arena();
    applyKeyframeTo(w2, kf);
    w2.stepN(30);
    expect(ballY(w2)).toBeCloseTo(continuous, 5);
  });

  it('reconciles collider removal and authored collider changes', () => {
    const w = new World({ tickRate: 60 });
    const h = installRapier(w, { gravity: [0, 0, 0] });
    w.spawnRaw(
      {
        transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'fixed' },
        collider3d: { shape: { type: 'ball', radius: 1 } },
      },
      'target',
    );
    w.step();
    expect(h.raycast([0, 0, 0], [1, 0, 0], 10)?.distance).toBeCloseTo(4);

    w.patch('target', Collider3D, { shape: { type: 'ball', radius: 2 } });
    w.step();
    expect(h.raycast([0, 0, 0], [1, 0, 0], 10)?.distance).toBeCloseTo(3);

    w.remove('target', Collider3D);
    w.step();
    expect(h.raycast([0, 0, 0], [1, 0, 0], 10)).toBeNull();
    expect(w.has('target', Rigidbody)).toBe(true);
  });

  it('normalizes ray directions so hit distance remains world-space distance', () => {
    const w = new World();
    const h = installRapier(w, { gravity: [0, 0, 0] });
    w.spawnRaw(
      {
        transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'ball', radius: 1 } },
      },
      'target',
    );
    w.step();
    expect(h.raycast([0, 0, 0], [10, 0, 0], 10)?.distance).toBeCloseTo(4);
    expect(() => h.raycast([0, 0, 0], [0, 0, 0], 10)).toThrow(/direction/);
  });

  it('sensors emit collision/collisionEnd events without physical response', () => {
    const { w } = arena();
    w.spawnRaw(
      {
        transform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'cuboid', hx: 2, hy: 0.5, hz: 2 }, sensor: true },
      },
      'tripwire',
    );
    const events: { type: string; a: string; b: string; sensor: boolean }[] = [];
    w.on('collision', (e) => events.push({ type: 'start', ...(e.payload as object) } as never));
    w.on('collisionEnd', (e) => events.push({ type: 'end', ...(e.payload as object) } as never));
    w.stepN(180); // ball falls THROUGH the sensor onto the floor
    expect(ballY(w)).toBeCloseTo(1.0, 1); // sensor didn't block it
    const involved = events.filter(
      (e) => [e.a, e.b].includes('tripwire') && [e.a, e.b].includes('ball'),
    );
    expect(involved.length).toBeGreaterThanOrEqual(2); // enter + exit
    expect(involved[0]?.sensor).toBe(true);
  });

  it('joints: a revolute-hinged box swings with its anchor body', () => {
    const w = new World({ tickRate: 60, seed: 'joint' });
    installRapier(w);
    w.spawnRaw(
      {
        transform: { pos: [0, 5, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'fixed' },
        collider3d: { shape: { type: 'ball', radius: 0.1 } },
      },
      'pivot',
    );
    w.spawnRaw(
      {
        transform: { pos: [2, 5, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'cuboid', hx: 0.5, hy: 0.2, hz: 0.2 } },
        joint: {
          type: 'revolute',
          other: 'pivot',
          anchor1: [0, 0, 0],
          anchor2: [-2, 0, 0],
          axis: [0, 0, 1],
        },
      },
      'arm',
    );
    w.stepN(120);
    const pos = w.get('arm', Transform)?.pos ?? [0, 0, 0];
    // Swung down around the pivot: below the start height but still ~2 units from the pivot.
    expect(pos[1]).toBeLessThan(4.8);
    const dist = Math.hypot(pos[0] - 0, pos[1] - 5, pos[2] - 0);
    expect(dist).toBeGreaterThan(1.5);
    expect(dist).toBeLessThan(2.5);
  });

  it('restores joint handle mappings without duplicating joints on the next step', () => {
    const build = (): { w: World; h: RapierHandle } => {
      const w = new World({ tickRate: 60, seed: 'joint-snapshot' });
      const h = installRapier(w);
      w.spawnRaw(
        {
          transform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
          rigidbody: { body: 'fixed' },
          collider3d: { shape: { type: 'ball', radius: 0.1 } },
        },
        'pivot',
      );
      w.spawnRaw(
        {
          transform: { pos: [1, 2, 0], rot: [0, 0, 0, 1] },
          rigidbody: { body: 'dynamic' },
          collider3d: { shape: { type: 'ball', radius: 0.2 } },
          joint: {
            type: 'revolute',
            other: 'pivot',
            anchor1: [0, 0, 0],
            anchor2: [-1, 0, 0],
            axis: [0, 0, 1],
          },
        },
        'arm',
      );
      return { w, h };
    };
    const first = build();
    first.w.step();
    expect(first.h.world.impulseJoints.len()).toBe(1);
    const keyframe = takeKeyframe(first.w);

    const restored = build();
    applyKeyframeTo(restored.w, keyframe);
    restored.w.step();
    expect(restored.h.world.impulseJoints.len()).toBe(1);
    expect(restored.w.has('arm', Joint)).toBe(true);
  });

  it('rejects incompatible snapshot versions before replacing the live world', () => {
    const { w } = arena();
    w.step();
    const keyframe = takeKeyframe(w);
    (keyframe.plugins.rapier as { version: string }).version = 'future-version';
    expect(() => applyKeyframeTo(w, keyframe)).toThrow(/incompatible/);
  });

  it('disposes Rapier resources idempotently and stops the installed system', () => {
    const { w, h } = arena();
    h.dispose();
    h.dispose();
    expect(() => w.step()).not.toThrow();
  });

  it('asset-shape colliders resolve through ShapeResolvers (sidecar hull contract)', () => {
    const w = new World({ tickRate: 60, seed: 'asset' });
    // A unit-cube hull, as `molen asset import` writes into the sidecar (flat xyz points).
    const cube = [
      -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, -0.5, 0.5, 1, -0.5, 0.5, 1,
      0.5, -0.5, 1, 0.5,
    ];
    installRapier(w, {
      resolvers: {
        asset: (assetId, kind) =>
          assetId === 'crate' && kind === 'hull' ? { points: new Float32Array(cube) } : undefined,
      },
    });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } },
      },
      'floor',
    );
    w.spawnRaw(
      {
        transform: { pos: [0, 4, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'asset', assetId: 'crate' } },
      },
      'crate-1',
    );
    w.stepN(240);
    // Crate bottom rests on the floor top (y=0.5) — hull origin is the cube's base.
    expect(w.get('crate-1', Transform)?.pos[1] ?? 0).toBeCloseTo(0.5, 1);
  });

  it('character controller walks 3D geometry from character + moveIntent', () => {
    const w = new World({ tickRate: 60, seed: 'char' });
    installRapier(w, {
      character: { autostep: { maxHeight: 0.5, minWidth: 0.1 }, snapToGround: 0.3 },
    });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } },
      },
      'ground',
    );
    // A step the controller must climb over is a wall for plain kinematics.
    w.spawnRaw(
      {
        transform: { pos: [2, 0.7, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'cuboid', hx: 0.5, hy: 0.2, hz: 10 } },
      },
      'step',
    );
    const hero = {
      transform: { pos: [0, 1.5, 0], rot: [0, 0, 0, 1] },
      rigidbody: { body: 'kinematicPosition' },
      collider3d: { shape: { type: 'capsule', halfHeight: 0.4, radius: 0.3 } },
      character: { speed: 4, jumpSpeed: 6, gravity: 15, vy: 0, grounded: false },
      moveIntent: { dir: [1, 0], jump: false },
    };
    w.spawnRaw(hero as never, 'hero');
    w.stepN(90); // 1.5s walking +x (stays within the 10-unit floor)
    const pos = w.get('hero', Transform)?.pos ?? [0, 0, 0];
    expect(pos[0]).toBeGreaterThan(3); // auto-stepped over the ledge and kept going
    expect(pos[1]).toBeGreaterThan(0.5); // standing on geometry, not fallen through
  });

  it('removing force stops applying it (no latched force)', () => {
    const w = new World({ tickRate: 60, seed: 'force' });
    const h = installRapier(w, { gravity: [0, 0, 0] });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'ball', radius: 0.5 } },
      },
      'ball',
    );
    const vx = (): number => h.velocityOf('ball')?.linear[0] ?? Number.NaN;
    w.set('ball', Force, { linear: [10, 0, 0] });
    w.stepN(10);
    const v1 = vx();
    w.stepN(10);
    const v2 = vx();
    expect(v1).toBeGreaterThan(0);
    expect(v2 - v1).toBeGreaterThan(0); // still accelerating while the force is present

    w.remove('ball', Force);
    w.stepN(10);
    const v3 = vx();
    w.stepN(10);
    const v4 = vx();
    expect(v3).toBeCloseTo(v2, 6); // no latched force: velocity stops increasing
    expect(v4 - v3).toBeCloseTo(0, 6);
  });

  it('in-place rigidbody edits keep the body and its velocity', () => {
    const w = new World({ tickRate: 60, seed: 'inplace' });
    const h = installRapier(w, { gravity: [0, 0, 0] });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'ball', radius: 0.5 } },
      },
      'ball',
    );
    w.set('ball', SetVelocity, { linear: [4, 0, 0] });
    w.step();
    const handles = (): number[] => h.world.bodies.getAll().map((b) => b.handle);
    const before = handles();
    const vBefore = h.velocityOf('ball')?.linear[0] ?? 0;
    expect(vBefore).toBeCloseTo(4);

    w.patch('ball', Rigidbody, { linearDamping: 0.5 });
    w.step();
    const vAfter = h.velocityOf('ball')?.linear[0] ?? 0;
    expect(vAfter).toBeGreaterThan(3.5); // continuous, merely damped — never reset to 0
    expect(vAfter).toBeLessThan(vBefore);
    expect(handles()).toEqual(before); // same Rapier body (a rebuild would reissue handles)

    // Changing the body KIND still rebuilds.
    w.patch('ball', Rigidbody, { body: 'fixed' });
    w.step();
    expect(h.velocityOf('ball')?.linear[0]).toBe(0);
  });

  it('keyframes after dispose carry no rapier plugin and queries throw', () => {
    const { w, h } = arena();
    w.step();
    h.dispose();
    const kf = takeKeyframe(w);
    expect(kf.plugins.rapier).toBeUndefined();
    expect(() => h.raycast([0, 0, 0], [1, 0, 0], 10)).toThrow(/disposed/);
    expect(() => h.overlapSphere([0, 0, 0], 1)).toThrow(/disposed/);
    expect(() => h.velocityOf('ball')).toThrow(/disposed/);
    expect(() => w.step()).not.toThrow();
    expect(w.describeSystems().some((s) => s.name === 'rapier')).toBe(false);
  });

  it('restores two joints on one body pair without duplicating either', () => {
    const build = (): { w: World; h: RapierHandle } => {
      const w = new World({ tickRate: 60, seed: 'two-joints' });
      const h = installRapier(w);
      w.spawnRaw(
        {
          transform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
          rigidbody: { body: 'fixed' },
          collider3d: { shape: { type: 'ball', radius: 0.1 } },
          // pivot -> arm (spherical); this entity is body 2 of the joint.
          joint: { type: 'spherical', other: 'arm', anchor1: [-1, 0, 0], anchor2: [0, 0, 0] },
        },
        'pivot',
      );
      w.spawnRaw(
        {
          transform: { pos: [1, 2, 0], rot: [0, 0, 0, 1] },
          rigidbody: { body: 'dynamic' },
          collider3d: { shape: { type: 'ball', radius: 0.2 } },
          joint: {
            type: 'revolute',
            other: 'pivot',
            anchor1: [0, 0, 0],
            anchor2: [-1, 0, 0],
            axis: [0, 0, 1],
          },
        },
        'arm',
      );
      return { w, h };
    };
    const first = build();
    first.w.step();
    expect(first.h.world.impulseJoints.len()).toBe(2);
    const jointTypes = (h: RapierHandle): number[] =>
      h.world.impulseJoints
        .getAll()
        .map((j) => j.type())
        .sort((a, b) => a - b);
    // rapier 0.19 reports JointData.spherical as Generic; the oracle is the pre-snapshot world.
    const originalTypes = jointTypes(first.h);
    expect(originalTypes).toContain(RAPIER.JointType.Revolute);
    expect(new Set(originalTypes).size).toBe(2);
    const keyframe = takeKeyframe(first.w);

    // Complete plugin maps.
    const restored = build();
    applyKeyframeTo(restored.w, keyframe);
    restored.w.step();
    expect(restored.h.world.impulseJoints.len()).toBe(2);

    // Older/incomplete plugin maps: handles are recovered by body pair + joint type.
    delete (keyframe.plugins.rapier as { joints?: unknown }).joints;
    const recovered = build();
    applyKeyframeTo(recovered.w, keyframe);
    recovered.w.step();
    expect(recovered.h.world.impulseJoints.len()).toBe(2);
    expect(jointTypes(recovered.h)).toEqual(originalTypes);
  });

  it('raycast/overlap filter by mask and exclude, and report hit normals', () => {
    const w = new World({ tickRate: 60 });
    const h = installRapier(w, { gravity: [0, 0, 0] });
    w.spawnRaw(
      {
        transform: { pos: [3, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'ball', radius: 0.5 }, layer: 2 },
      },
      'near',
    );
    w.spawnRaw(
      {
        transform: { pos: [6, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'ball', radius: 1 } },
      },
      'far',
    );
    w.step();
    // Unfiltered: the nearest (layer 2) ball, with the -x facing normal.
    const hit = h.raycast([0, 0, 0], [1, 0, 0], 10);
    expect(hit?.id).toBe('near');
    expect(hit?.distance).toBeCloseTo(2.5);
    expect(hit?.normal[0]).toBeCloseTo(-1);
    expect(hit?.normal[1]).toBeCloseTo(0);
    expect(hit?.normal[2]).toBeCloseTo(0);
    // Mask 1 skips the layer-2 ball and reaches the default-layer one behind it.
    expect(h.raycast([0, 0, 0], [1, 0, 0], 10, { mask: 1 })?.id).toBe('far');
    expect(h.raycast([0, 0, 0], [1, 0, 0], 10, { mask: 3 })?.id).toBe('near');
    expect(h.raycast([0, 0, 0], [1, 0, 0], 10, { mask: 4 })).toBeNull();
    // Exclude by id.
    const excluded = h.raycast([0, 0, 0], [1, 0, 0], 10, { exclude: ['near'] });
    expect(excluded?.id).toBe('far');
    expect(excluded?.distance).toBeCloseTo(5);
    // The boolean form keeps its `solid` meaning.
    expect(h.raycast([3, 0, 0], [1, 0, 0], 10, true)?.distance).toBeCloseTo(0);
    expect(h.raycast([3, 0, 0], [1, 0, 0], 10, false)?.distance).toBeCloseTo(0.5);
    // Overlap filters share the predicate.
    expect(h.overlapSphere([4.5, 0, 0], 2).sort()).toEqual(['far', 'near']);
    expect(h.overlapSphere([4.5, 0, 0], 2, { mask: 1 })).toEqual(['far']);
    expect(h.overlapSphere([4.5, 0, 0], 2, { exclude: ['far'] })).toEqual(['near']);
  });

  it('solid collision events carry the contact normal and point', () => {
    const w = new World({ tickRate: 60, seed: 'contact' });
    installRapier(w, { gravity: [0, -9.81, 0] });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } },
      },
      'floor',
    );
    w.spawnRaw(
      {
        transform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'ball', radius: 0.5 }, events: true },
      },
      'ball',
    );
    const events: { a: string; b: string; sensor: boolean; normal?: number[]; point?: number[] }[] =
      [];
    w.on('collision', (e) => events.push(e.payload as never));
    w.stepN(120);
    const contact = events.find((e) => [e.a, e.b].includes('ball') && [e.a, e.b].includes('floor'));
    expect(contact).toBeDefined();
    expect(contact?.sensor).toBe(false);
    expect(contact?.normal).toBeDefined();
    expect(Math.abs(contact?.normal?.[1] ?? 0)).toBeCloseTo(1, 3);
    expect(contact?.point).toBeDefined();
    expect(contact?.point?.[1] ?? 0).toBeCloseTo(0.5, 1); // the floor's top surface
  });

  it('heightfield ramp via resolvers.heightfield (columns run along +x)', () => {
    // Rapier heightfield: heights is an nrows x ncols matrix (column-major); column j sits at
    // x = (-0.5 + j/(ncols-1)) * scale.x, row i at z = (-0.5 + i/(nrows-1)) * scale.z.
    // A ramp rising along +x therefore varies per COLUMN and is constant down each column.
    const nrows = 3;
    const ncols = 5;
    const columnHeights = [0, 0, 1, 2, 2]; // flat shelf, slope, flat shelf
    const heights = new Float32Array(nrows * ncols);
    for (let j = 0; j < ncols; j++) {
      for (let i = 0; i < nrows; i++) heights[j * nrows + i] = columnHeights[j] as number;
    }
    const w = new World({ tickRate: 60, seed: 'ramp' });
    const h = installRapier(w, {
      resolvers: {
        heightfield: (ref) =>
          ref === 'ramp'
            ? { nrows, ncols, heights, scale: [8, 1, 8], center: [0, 1, 0] }
            : undefined,
      },
    });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider3d: { shape: { type: 'heightfield', ref: 'ramp' } },
      },
      'terrain',
    );
    w.spawnRaw(
      {
        transform: { pos: [-3, 3, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'ball', radius: 0.5 } },
      },
      'low',
    );
    w.spawnRaw(
      {
        transform: { pos: [3, 5, 0], rot: [0, 0, 0, 1] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'ball', radius: 0.5 } },
      },
      'high',
    );
    w.step();
    // Exact surface oracle (center lifts every sample by +1): shelf 1, mid-slope 2, shelf 3.
    // The balls are excluded so the rays reach the terrain beneath them.
    const surface = (x: number, z: number): number | undefined =>
      h.raycast([x, 10, z], [0, -1, 0], 20, { exclude: ['low', 'high'] })?.point[1];
    expect(surface(-3, 0)).toBeCloseTo(1, 4);
    expect(surface(0, 0)).toBeCloseTo(2, 4);
    expect(surface(3, 0)).toBeCloseTo(3, 4);
    // Orientation oracle: along z the surface must NOT vary.
    expect(surface(-3, 2)).toBeCloseTo(1, 4);
    expect(surface(3, -2)).toBeCloseTo(3, 4);
    w.stepN(240);
    expect(w.get('low', Transform)?.pos[1] ?? 0).toBeCloseTo(1.5, 1);
    expect(w.get('high', Transform)?.pos[1] ?? 0).toBeCloseTo(3.5, 1);
  });
});

describe('review F04/F14: physics continuation and visual scale', () => {
  it('scales collision geometry and local offsets, rebuilds scale edits, and preserves body velocity', () => {
    const w = new World();
    const h = installRapier(w, { gravity: [0, 0, 0] });
    w.spawn(
      {
        transform: { pos: [0, 0, 0], scale: [10, 10, 10] },
        rigidbody: { body: 'dynamic' },
        collider3d: { shape: { type: 'ball', radius: 1 } },
      },
      { id: 'ball' },
    );
    w.step();
    expect(h.raycast([-20, 0, 0], [1, 0, 0], 40)?.distance).toBeCloseTo(10);
    const before = stateHash(w);
    const body = h.world.bodies.getAll()[0];
    if (body === undefined) throw new Error('expected a physics body');
    body.setLinvel({ x: 2, y: 0, z: 0 }, true);
    expect(stateHash(w)).not.toBe(before);
    w.patch('ball', Transform, { scale: [2, 2, 2] });
    w.step();
    expect(h.velocityOf('ball')?.linear[0]).toBeCloseTo(2);
    expect(h.world.colliders.getAll()[0]?.radius()).toBeCloseTo(2);
    h.dispose();
    const offset = new World();
    const p = installRapier(offset, { gravity: [0, 0, 0] });
    offset.spawn({
      transform: { pos: [0, 0, 0], scale: [2, 2, 2] },
      collider3d: { shape: { type: 'cuboid', hx: 1, hy: 1, hz: 1 }, offset: [2, 0, 0] },
    });
    offset.step();
    expect(p.raycast([0, 0, 0], [1, 0, 0], 10)?.distance).toBeCloseTo(2);
    p.dispose();
  });
  it.each([
    [1, 2, 1],
    [-1, -1, -1],
    [0, 0, 0],
  ])('rejects unsupported physical scale %j with an actionable diagnostic', (...scale) => {
    const w = new World();
    const h = installRapier(w);
    w.spawnRaw({
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1], scale },
      collider3d: { shape: { type: 'ball', radius: 1 } },
    });
    expect(() => w.step()).toThrow('positive uniform');
    h.dispose();
  });
});
