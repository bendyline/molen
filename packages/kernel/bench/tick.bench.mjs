// Kernel tick micro-benchmark (not a CI gate): 5000 entities with transform + velocity, one
// movement system, 300 ticks. Reports ms/tick for dev (freeze-on-write) and non-dev worlds.
// Run after `pnpm --filter @bendyline/molen-kernel build`:  node bench/tick.bench.mjs
import { cloneJson, deepFreeze, defineComponent, Transform, World } from '../dist/index.mjs';

const Velocity = defineComponent('velocity');
const ENTITIES = 5000;
const TICKS = 300;

function build(devFreeze) {
  const w = new World({ tickRate: 30, seed: 'bench', devFreeze });
  for (let i = 0; i < ENTITIES; i++) {
    w.spawnRaw({
      transform: { pos: [i % 100, 0, Math.floor(i / 100)], rot: [0, 0, 0, 1] },
      velocity: { v: [1, 0, 0.5] },
    });
  }
  w.addSystem(
    (world, ctx) => {
      for (const [id, t, v] of world.query(Transform, Velocity)) {
        world.patch(id, Transform, {
          pos: [t.pos[0] + v.v[0] * ctx.dt, t.pos[1] + v.v[1] * ctx.dt, t.pos[2] + v.v[2] * ctx.dt],
        });
      }
    },
    { name: 'move' },
  );
  return w;
}

function run(devFreeze, legacyReads = false) {
  const w = build(devFreeze);
  if (legacyReads) {
    // Emulate the pre-freeze-on-write read path: every read deep-cloned (and deep-froze in
    // dev) the stored component, so a movement system paid two clones + two freezes per row.
    const originalQuery = w.query.bind(w);
    w.query = (...comps) => {
      const q = originalQuery(...comps);
      return {
        ...q,
        *[Symbol.iterator]() {
          for (const row of q) {
            yield row.map((v, i) => {
              if (i === 0) return v;
              const copy = cloneJson(v);
              return devFreeze ? deepFreeze(copy) : copy;
            });
          }
        },
      };
    };
  }
  w.stepN(10); // warm up
  const start = process.hrtime.bigint();
  w.stepN(TICKS);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return ms / TICKS;
}

for (const devFreeze of [true, false]) {
  const before = run(devFreeze, true);
  const after = run(devFreeze);
  console.log(
    `devFreeze=${devFreeze}: ${after.toFixed(3)} ms/tick (emulated clone-per-read: ${before.toFixed(3)} ms/tick) — ${ENTITIES} entities, ${TICKS} ticks`,
  );
}
