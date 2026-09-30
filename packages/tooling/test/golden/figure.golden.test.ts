import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffImages, frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { beforeAll, describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// Figures end to end: a scene of procedural figures (a human walking under the character
// controller with a hat on its head socket, a horse) rendered by `shot` mid-stride, so the
// golden locks the rig, the gait curves, the body generator, and the attachment path together.
let scenePath: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'molen-figure-golden-'));
  scenePath = join(dir, 'figure.scene.json');
  const scene = {
    format: 'molen/scene@3',
    name: 'figure-golden',
    seed: 'f1',
    tickRate: 60,
    physics: { engine: 'kinematics', character: true },
    camera: { mode: 'fixed', position: [1.2, 1.7, 5.2], lookAt: [0.6, 0.85, 0] },
    entities: [
      {
        id: 'ground',
        components: {
          transform: { pos: [0, -0.05, 0], rot: [0, 0, 0, 1] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#6b7f5a',
            primitive: { size: [12, 0.1, 12] },
          },
        },
      },
      {
        id: 'walker',
        components: {
          transform: { pos: [-0.4, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'figure', ref: 'procedural' },
          figure: { preset: 'human.adult', palette: { top: '#3b6ea5' } },
          character: { speed: 1.4, jumpSpeed: 6, gravity: 20, vy: 0, grounded: true },
          moveIntent: { dir: [0, -1], jump: false },
          collider: { shape: 'circle', radius: 0.35, layer: 1, mask: 1 },
          kinematicBody: { vel: [0, 0, 0], slide: true },
        },
      },
      {
        id: 'hat',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: {
            kind: 'primitive',
            ref: 'cylinder',
            materialRef: 'palette:#39747d',
            primitive: { size: [0.32, 0.12, 0.32] },
          },
          parent: { id: 'walker' },
          figureAttachment: { socket: 'head.top', offset: { pos: [0, 0.06, 0] } },
        },
      },
      {
        id: 'horse',
        components: {
          transform: { pos: [1.9, 0, -0.6], rot: [0, 0, 0, 1] },
          renderable: { kind: 'figure', ref: 'procedural' },
          figure: { preset: 'horse' },
        },
      },
    ],
  };
  await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
});

describe('golden: figures', () => {
  it('renders a walking human with a hat on its head socket and a horse', async () => {
    await mkdir(OUT, { recursive: true });
    const render = async (name: string): Promise<string> => {
      const outPath = join(OUT, `${name}.png`);
      // Tick 45 at 60 Hz: the walker has turned toward -z and is mid-stride.
      const r = await screenshotScene({
        scenePath,
        ticks: 45,
        size: [400, 300],
        clearColor: '#1b2130',
        outPath,
      });
      expect(r.ok, r.error).toBe(true);
      expect(r.renderStats?.entitiesRendered).toBe(4);
      expect(r.renderStats?.triangles ?? 0).toBeGreaterThan(1500);
      return outPath;
    };
    const first = await render('figure');
    const second = await render('figure-again');
    const same = await diffImages(first, second, join(OUT, 'figure-again.diff.png'), 0);
    expect(same.match, `renders differ by ${same.diffRatio}`).toBe(true);
    // The ground, the figures and their shading: about half the frame, in 160-odd shades.
    const stats = await frameStats(first);
    expect(stats.coverage).toBeGreaterThan(0.3);
    expect(stats.colors).toBeGreaterThanOrEqual(60);
  });
});
