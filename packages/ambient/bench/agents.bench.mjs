// Ambient agents benchmark: ms per tick for a busy scene, and ms per tile registration.
// In the engine repository: pnpm --filter @bendyline/molen-ambient build && node packages/ambient/bench/agents.bench.mjs
import { performance } from 'node:perf_hooks';
import { World } from '@bendyline/molen-kernel/world';
import { installAmbient, TransportNetwork } from '../dist/kernel.mjs';

function grid(blocks, size) {
  const ways = [];
  const extent = blocks * size;
  for (let i = 0; i <= blocks; i++) {
    const c = i * size - extent / 2;
    const sub = i % 4 === 0 ? 'secondary' : 'residential';
    ways.push({
      class: 'road',
      subclass: sub,
      points: [
        [-extent / 2, c],
        [extent / 2, c],
      ],
    });
    ways.push({
      class: 'road',
      subclass: sub,
      points: [
        [c, -extent / 2],
        [c, extent / 2],
      ],
    });
  }
  ways.push({
    class: 'rail',
    points: [
      [-extent / 2, 50],
      [extent / 2, 50],
    ],
  });
  return { format: 'molen/transport-network@1', sidewalks: true, ways };
}

function run(devFreeze) {
  const world = new World({ tickRate: 60, seed: 'bench', devFreeze });
  const ambient = installAmbient(world, {
    classes: ['car', 'pedestrian', 'train', 'aircraft'],
    policy: {
      spawnBudget: 40,
      car: { near: 0, far: 700, keep: 900, perLaneKm: 40, max: 300 },
      pedestrian: { near: 0, far: 250, keep: 400, perLaneKm: 40, max: 60 },
      train: { near: 0, far: 1000, keep: 2000, perLaneKm: 5, max: 2 },
      aircraft: { near: 500, far: 4000, keep: 5000, max: 4 },
    },
  });
  const t0 = performance.now();
  ambient.addDocument(grid(20, 100));
  const build = performance.now() - t0;
  ambient.setObserver({ pos: [0, 0, 0] });
  world.stepN(600); // fill
  const counts = ambient.stats().agents;
  const start = performance.now();
  world.stepN(600);
  const perTick = (performance.now() - start) / 600;
  return { devFreeze, build, perTick, counts };
}

function tileBench() {
  // ~300 features in an 820 m tile: a dense street grid with footways and a rail line.
  const features = [];
  for (let i = 0; i < 40; i++) {
    const v = (i + 0.5) / 40;
    features.push({
      class: 'minor_road',
      subclass: 'residential',
      lines: [
        [
          [0, v],
          [1, v],
        ],
      ],
    });
    features.push({
      class: 'minor_road',
      subclass: 'residential',
      lines: [
        [
          [v, 0],
          [v, 1],
        ],
      ],
    });
  }
  for (let i = 0; i < 200; i++) {
    const u = (i % 20) / 20 + 0.01;
    const v = Math.floor(i / 20) / 10 + 0.02;
    features.push({
      class: 'path',
      subclass: 'footway',
      lines: [
        [
          [u, v],
          [u + 0.04, v + 0.03],
        ],
      ],
    });
  }
  features.push({
    class: 'rail',
    subclass: 'rail',
    lines: [
      [
        [0, 0.33],
        [1, 0.36],
      ],
    ],
  });
  const net = new TransportNetwork();
  const times = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    net.registerTile({
      key: `t${i}`,
      origin: [i * 820, 0],
      tileSize: 820,
      features,
      heightAt: () => 0,
    });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { features: features.length, medianMs: times[5], stats: net.stats() };
}

for (const devFreeze of [true, false]) {
  const r = run(devFreeze);
  console.log(
    `devFreeze=${r.devFreeze}: ${r.perTick.toFixed(2)} ms/tick with ${JSON.stringify(r.counts)} (network build ${r.build.toFixed(0)} ms)`,
  );
}
const tile = tileBench();
console.log(
  `registerTile: ${tile.medianMs.toFixed(1)} ms median for ${tile.features} features (${tile.stats.edges / 10} edges/tile)`,
);
