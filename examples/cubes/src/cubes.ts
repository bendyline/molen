import {
  createRng,
  defineComponent,
  dmath,
  type JsonObject,
  type Rng,
  type System,
  Transform,
  type World,
  type WorldSetup,
} from '@bendyline/molen-kernel';

// Components specific to the cubes demo. All pure JSON.
interface Spin extends JsonObject {
  axis: [number, number, number];
  radPerTick: number;
  angle: number;
}
interface Drift extends JsonObject {
  vel: [number, number, number];
  range: number;
}

const SpinC = defineComponent<Spin>('spin');
const DriftC = defineComponent<Drift>('drift');

const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6'];

/** Quaternion from axis (assumed normalized) + angle, via the engine's deterministic math. */
function quatFromAxisAngle(
  axis: [number, number, number],
  angle: number,
): [number, number, number, number] {
  const half = angle / 2;
  const s = dmath.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, dmath.cos(half)];
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const len = dmath.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function makeCube(rng: Rng): Record<string, JsonObject> {
  const axis = normalize3([rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)]);
  const color = PALETTE[rng.int(PALETTE.length)] as string;
  return {
    transform: {
      pos: [rng.range(-8, 8), rng.range(-5, 5), rng.range(-8, 8)],
      rot: [0, 0, 0, 1],
    },
    spin: { axis, radPerTick: rng.range(0.01, 0.08), angle: 0 },
    drift: { vel: [rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)], range: 10 },
    renderable: { kind: 'primitive', ref: 'box', materialRef: `palette:${color}` },
  };
}

/** Registers the cubes systems + spawn command and seeds ~50 initial cubes. */
export const setup: WorldSetup = (world: World, manifest): void => {
  const initRng = createRng(`${manifest.seed}:init`);
  for (let i = 0; i < 50; i++) world.spawnRaw(makeCube(initRng));

  const spinSystem: System = (w) => {
    for (const [id, spin] of w.query(SpinC)) {
      const angle = spin.angle + spin.radPerTick;
      w.patch(id, SpinC, { angle });
      w.patch(id, Transform, { rot: quatFromAxisAngle(spin.axis, angle) });
    }
  };

  const driftSystem: System = (w, ctx) => {
    for (const [id, t, drift] of w.query(Transform, DriftC)) {
      const pos: [number, number, number] = [
        t.pos[0] + drift.vel[0] * ctx.dt,
        t.pos[1] + drift.vel[1] * ctx.dt,
        t.pos[2] + drift.vel[2] * ctx.dt,
      ];
      const vel: [number, number, number] = [...drift.vel];
      // Bounce at the bounds so cubes stay on-screen.
      for (let a = 0; a < 3; a++) {
        if (dmath.abs(pos[a] as number) > drift.range) {
          vel[a] = -(vel[a] as number);
          pos[a] = dmath.sign(pos[a] as number) * drift.range;
        }
      }
      w.patch(id, Transform, { pos });
      w.patch(id, DriftC, { vel });
    }
  };

  world.addSystem(spinSystem, { name: 'spin' });
  world.addSystem(driftSystem, { name: 'drift' });

  // Space in the browser sends this; the kernel adjudicates and spawns deterministically.
  world.registerCommand('spawn_cube', (w, _cmd, ctx) => {
    w.spawnRaw(makeCube(ctx.rng));
  });
};

export default setup;
