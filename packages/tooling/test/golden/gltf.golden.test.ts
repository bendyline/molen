import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compareGolden,
  importAsset,
  scaffoldExperience,
  screenshotScene,
} from '@bendyline/molen-tooling';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCubeGlb } from '../fixtures/build-glb';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// The V2 content loop, end to end: import a GLB -> reference it from a scene by asset id ->
// `shot` renders it headlessly with a deterministic clip pose derived from the tick.
let projectDir: string;
let scenePath: string;

beforeAll(async () => {
  const parent = await mkdtemp(join(tmpdir(), 'molen-gltf-golden-'));
  const s = await scaffoldExperience({ name: 'gltfdemo', dir: parent });
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

  scenePath = join(projectDir, 'scenes', 'gltf.scene.json');
  const scene = {
    format: 'molen/scene@3',
    name: 'gltf-golden',
    seed: 'g1',
    tickRate: 30,
    camera: { mode: 'fixed', position: [2.2, 1.6, 2.6], lookAt: [0, 0.5, 0] },
    entities: [
      {
        id: 'crate-1',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: {
            kind: 'gltf',
            ref: 'crate',
            animation: { clip: 'spin', loop: 'repeat' },
          },
        },
      },
    ],
  };
  await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
});

describe('golden: gltf asset rendering', () => {
  it('renders project assets when the scene is supplied inline', async () => {
    const scene = JSON.parse(await readFile(scenePath, 'utf8'));
    const result = await screenshotScene({
      scene,
      projectPath: join(projectDir, 'project.json'),
      ticks: 15,
      size: [320, 240],
      outPath: join(OUT, 'gltf-inline.png'),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.renderStats?.triangles ?? 0).toBeGreaterThanOrEqual(12);
  });

  it('renders an imported GLB by asset id with a tick-derived clip pose', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'gltf.png');
    const golden = join(GOLDENS, 'gltf.png');
    const diff = join(OUT, 'gltf.diff.png');

    // tick 15 at 30Hz = 0.5s into the 1s spin clip -> a quarter-turned crate.
    const r = await screenshotScene({
      scenePath,
      ticks: 15,
      size: [320, 240],
      clearColor: '#182028',
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.renderStats?.entitiesRendered).toBe(1);
    expect(r.renderStats?.triangles ?? 0).toBeGreaterThanOrEqual(12);

    const g = await compareGolden(candidate, golden, diff, { maxDiffRatio: 0.01 });
    expect(
      g.ok,
      `gltf golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
    ).toBe(true);
  });
});
