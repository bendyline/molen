import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareGolden, screenshotScene } from '@bendyline/molen-tooling';
import { beforeAll, describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// From bake to render, closed: a scene box whose materialRef is a matgraph DOC — the client's
// MaterialResolver loads it through the capture server, CPU-bakes it, and uploads the texture.
let scenePath: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'molen-matgraph-render-'));
  const rock = {
    format: 'molen/matgraph@1',
    size: [96, 96],
    seed: 4242,
    nodes: [
      { id: 'n1', type: 'noise', params: { kind: 'simplex', octaves: 5, scale: 6 } },
      {
        id: 'n2',
        type: 'ramp',
        input: 'n1',
        params: {
          stops: [
            { t: 0, color: '#3a3f2e' },
            { t: 0.5, color: '#6e6a4a' },
            { t: 1, color: '#a8a282' },
          ],
        },
      },
    ],
    outputs: { baseColor: 'n2' },
  };
  await mkdir(join(dir, 'mats'), { recursive: true });
  await writeFile(join(dir, 'mats', 'rock.json'), JSON.stringify(rock, null, 2));

  scenePath = join(dir, 'scene.json');
  const scene = {
    format: 'molen/scene@3',
    name: 'matgraph-render',
    seed: 'm1',
    tickRate: 30,
    camera: { mode: 'fixed', position: [1.8, 1.4, 2.2], lookAt: [0, 0, 0] },
    entities: [
      {
        id: 'rock-box',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0.2588, 0, 0.9659] },
          renderable: { kind: 'primitive', ref: 'box', materialRef: 'matgraph:mats/rock.json' },
        },
      },
    ],
  };
  await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
});

describe('golden: matgraph material rendering', () => {
  it('renders a box textured by a baked material graph (no pre-baked PNG)', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'matgraph-render.png');
    const golden = join(GOLDENS, 'matgraph-render.png');
    const diff = join(OUT, 'matgraph-render.diff.png');

    const r = await screenshotScene({
      scenePath,
      ticks: 1,
      size: [320, 240],
      clearColor: '#101318',
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.renderStats?.entitiesRendered).toBe(1);

    const g = await compareGolden(candidate, golden, diff, { maxDiffRatio: 0.01 });
    expect(
      g.ok,
      `matgraph-render golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
    ).toBe(true);
  });
});
