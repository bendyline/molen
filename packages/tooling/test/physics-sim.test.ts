import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { importAsset, runSimulation, scaffoldExperience } from '../src/ops/index';
import { buildCubeGlb } from './fixtures/build-glb';

// The V2 physics promise, end to end through the tools: import a GLB (mesh-accurate hulls in
// the sidecar) -> a scene declares physics.engine "rapier" and a collider3d asset shape ->
// `sim run` resolves the hull from the sidecar and the crate lands on the floor.
let projectDir: string;
let scenePath: string;

beforeAll(async () => {
  const parent = await mkdtemp(join(tmpdir(), 'molen-physics-sim-'));
  const s = await scaffoldExperience({ name: 'physdemo', dir: parent });
  expect(s.ok).toBe(true);
  projectDir = s.dir as string;

  const glbPath = join(projectDir, 'crate-src.glb');
  await writeFile(glbPath, await buildCubeGlb());
  const imported = await importAsset({
    path: glbPath,
    id: 'crate',
    projectPath: join(projectDir, 'project.json'),
  });
  expect(imported.ok, imported.error).toBe(true);
  expect(imported.sidecar?.collision.hulls.length).toBeGreaterThan(0);

  scenePath = join(projectDir, 'scenes', 'physics.scene.json');
  const scene = {
    format: 'molen/scene@3',
    name: 'physics-demo',
    seed: 'p1',
    tickRate: 60,
    physics: { engine: 'rapier', gravity: [0, -9.81, 0] },
    entities: [
      {
        id: 'floor',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          collider3d: { shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } },
        },
      },
      {
        id: 'crate-1',
        components: {
          transform: { pos: [0, 4, 0], rot: [0, 0, 0, 1] },
          rigidbody: { body: 'dynamic' },
          collider3d: { shape: { type: 'asset', assetId: 'crate' } },
        },
      },
    ],
  };
  await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
});

describe('rapier scenes through the headless loop', () => {
  it('sim run resolves sidecar hulls and the crate settles on the floor', async () => {
    const r = await runSimulation({
      scenePath,
      ticks: 240,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: '#crate-1 .transform.pos[1]', op: 'approx', value: 0.5, tol: 0.15 },
          { select: 'has:rigidbody', op: 'count', value: 1 },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.physics).toBe('rapier');
    expect(r.ok, r.assertionsFormatted).toBe(true);
  });

  it('is deterministic run-to-run through the tools', async () => {
    const a = await runSimulation({ scenePath, ticks: 120 });
    const b = await runSimulation({ scenePath, ticks: 120 });
    expect(a.stateHash).toBe(b.stateHash);
  });
});
