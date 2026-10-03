import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  diffImages,
  frameStats,
  importAsset,
  scaffoldExperience,
  screenshotAsset,
  screenshotScene,
} from '@bendyline/molen-tooling';
import { NodeIO } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCubeGlb } from '../fixtures/build-glb';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

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
  it('opt-in sky reflections illuminate imported metals in scene and turntable captures', async () => {
    const io = new NodeIO();
    const doc = await io.readBinary(await buildCubeGlb());
    doc
      .getRoot()
      .listMaterials()[0]
      ?.setBaseColorFactor([0.9, 0.9, 0.9, 1])
      .setMetallicFactor(1)
      .setRoughnessFactor(0.2);
    const source = join(projectDir, 'metal-src.glb');
    await writeFile(source, await io.writeBinary(doc));
    const imported = await importAsset({
      path: source,
      id: 'metal',
      projectPath: join(projectDir, 'project.json'),
    });
    expect(imported.ok, imported.error).toBe(true);
    const scene = JSON.parse(await readFile(scenePath, 'utf8'));
    scene.entities[0].components.renderable = { kind: 'gltf', ref: 'metal' };
    const images = [];
    for (const reflections of [false, true]) {
      const path = join(OUT, `metal-reflections-${reflections}.png`);
      const result = await screenshotScene({
        scene,
        projectPath: join(projectDir, 'project.json'),
        ticks: 0,
        size: [200, 200],
        clearColor: '#bbd4e7',
        reflections,
        outPath: path,
      });
      expect(result.ok, result.error).toBe(true);
      expect(result.renderStats?.triangles).toBeGreaterThanOrEqual(12);
      images.push(PNG.sync.read(await readFile(path)));
    }
    let delta = 0;
    for (let y = 80; y < 120; y++)
      for (let x = 80; x < 120; x++) {
        const i = (y * 200 + x) * 4;
        for (let c = 0; c < 3; c++)
          delta += (images[1]?.data[i + c] ?? 0) - (images[0]?.data[i + c] ?? 0);
      }
    expect(delta / (40 * 40 * 3)).toBeGreaterThan(15);
    const result = await screenshotAsset({
      ref: 'metal',
      projectPath: join(projectDir, 'project.json'),
      angles: 1,
      size: [200, 200],
      clearColor: '#bbd4e7',
      reflections: true,
      outDir: join(OUT, 'metal-turntable-reflections'),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.triangles).toBeGreaterThanOrEqual(12);
    const framePath = result.frames?.[0]?.path;
    if (!framePath) throw new Error('Missing metal turntable frame');
    const frame = PNG.sync.read(await readFile(framePath));
    const center = (100 * 200 + 100) * 4;
    const unreflected = await screenshotAsset({
      ref: 'metal',
      projectPath: join(projectDir, 'project.json'),
      angles: 1,
      size: [200, 200],
      clearColor: '#bbd4e7',
      reflections: false,
      outDir: join(OUT, 'metal-turntable-no-reflections'),
    });
    expect(unreflected.ok, unreflected.error).toBe(true);
    const unreflectedPath = unreflected.frames?.[0]?.path;
    if (!unreflectedPath) throw new Error('Missing unreflected metal frame');
    const baseline = PNG.sync.read(await readFile(unreflectedPath));
    expect((frame.data[center] ?? 0) - (baseline.data[center] ?? 0)).toBeGreaterThan(15);
  });

  it('preserves centimetre surface separation in a distant architectural capture', async () => {
    const scene = JSON.parse(await readFile(scenePath, 'utf8'));
    scene.entities = [
      {
        id: 'front',
        components: {
          transform: { pos: [0, 0, 0.01], scale: [500, 500, 0.05] },
          renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#00ff00' },
        },
      },
      {
        id: 'behind',
        components: {
          transform: { pos: [0, 0, 0], scale: [500, 500, 0.05] },
          renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#ff0000' },
        },
      },
    ];
    const path = join(OUT, 'distant-surface-depth.png');
    const result = await screenshotScene({
      scene,
      ticks: 0,
      camera: { position: [80, 40, 600], lookAt: [0, 0, 0] },
      size: [320, 240],
      outPath: path,
    });
    expect(result.ok, result.error).toBe(true);
    const png = PNG.sync.read(await readFile(path));
    let green = 0;
    for (let y = 70; y < 170; y++)
      for (let x = 110; x < 210; x++) {
        const i = (y * png.width + x) * 4;
        if (png.data[i + 1] > png.data[i] * 2 && png.data[i + 1] > 30) green++;
      }
    expect(green).toBeGreaterThan(9990);
  });

  it('keeps a large imported model visible beyond the normal camera clip distance', async () => {
    const scene = JSON.parse(await readFile(scenePath, 'utf8'));
    scene.entities[0].components.transform.scale = [6000, 1000, 1000];
    const path = join(OUT, 'gltf-large-crossing.png');
    const result = await screenshotScene({
      scene,
      projectPath: join(projectDir, 'project.json'),
      ticks: 0,
      camera: { position: [0, 2500, 8000], lookAt: [0, 500, 0] },
      clearColor: '#000000',
      size: [320, 240],
      outPath: path,
    });
    expect(result.ok, result.error).toBe(true);
    const image = PNG.sync.read(await readFile(path));
    let visible = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i] + image.data[i + 1] + image.data[i + 2] > 45) visible++;
    }
    // Triangle telemetry can count clipped draws; require actual illuminated pixels.
    expect(visible).toBeGreaterThan(1000);
  });

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
    const render = async (name: string, ticks: number): Promise<string> => {
      const outPath = join(OUT, `${name}.png`);
      const r = await screenshotScene({
        scenePath,
        ticks,
        size: [320, 240],
        clearColor: '#182028',
        outPath,
      });
      expect(r.ok, r.error).toBe(true);
      expect(r.renderStats?.entitiesRendered).toBe(1);
      expect(r.renderStats?.triangles ?? 0).toBeGreaterThanOrEqual(12);
      return outPath;
    };
    // The 1s spin clip turns the crate half a turn, so tick 15 at 30Hz is a quarter turn, which a
    // cube shares with its start pose; tick 8 is part-way and shows a corner. The pose comes from
    // the tick alone: the same tick renders the same frame, another tick another pose.
    const quarter = await render('gltf', 15);
    const again = await render('gltf-again', 15);
    const corner = await render('gltf-corner', 8);
    const same = await diffImages(quarter, again, join(OUT, 'gltf-again.diff.png'), 0);
    expect(same.match, `renders differ by ${same.diffRatio}`).toBe(true);
    const turned = await diffImages(quarter, corner, join(OUT, 'gltf-corner.diff.png'));
    expect(turned.match, `poses differ by only ${turned.diffRatio}`).toBe(false);
    // The crate fills about 7% of the frame.
    expect((await frameStats(quarter)).coverage).toBeGreaterThan(0.03);
  });
});
