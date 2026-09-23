import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  encodePng16,
  generateHeightmapPng,
  heightfieldFromPng,
} from '@bendyline/molen-terrain/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { runSimulation, scaffoldExperience, validateAsset } from '../src/ops/index';

// Terrain as a game service, end to end through the tools: a scene references its terrain
// (descriptor + heightmap), `sim run` decodes the heightmap in Node and registers it as the
// world's ground, and a character / a kinematic body / a rapier ball all come to rest ON it.
let projectDir: string;
let kinematicScene: string;
let rapierScene: string;
let expectedGround: number;

const descriptor = {
  format: 'molen/terrain@2',
  name: 'island',
  origin: [0, 0],
  chunkSize: 64,
  tileResolution: 33,
  gridSize: [1, 1],
  height: { min: 0, max: 40 },
  tiles: { heightUrl: 'height.png' },
  collision: { enabled: true },
};

beforeAll(async () => {
  const parent = await mkdtemp(join(tmpdir(), 'molen-terrain-sim-'));
  const s = await scaffoldExperience({ name: 'terraindemo', dir: parent });
  expect(s.ok).toBe(true);
  projectDir = s.dir as string;

  const png = generateHeightmapPng({ size: 33, seed: 7, octaves: 4, island: true });
  await writeFile(join(projectDir, 'scenes', 'height.png'), png);
  await writeFile(
    join(projectDir, 'scenes', 'island.terrain.json'),
    `${JSON.stringify(descriptor, null, 2)}\n`,
  );
  const dv = await validateAsset({ path: join(projectDir, 'scenes', 'island.terrain.json') });
  expect(dv.ok, dv.formatted).toBe(true);
  const hf = heightfieldFromPng(dv.value as never, png);
  expectedGround = hf.sampleHeight(32, 32);
  expect(expectedGround).toBeGreaterThan(0); // an island peaks in the middle

  kinematicScene = join(projectDir, 'scenes', 'kinematic.scene.json');
  await writeFile(
    kinematicScene,
    JSON.stringify({
      format: 'molen/scene@3',
      name: 'terrain-kinematic',
      seed: 't1',
      tickRate: 30,
      terrain: { descriptor: 'island.terrain.json', heightmap: 'height.png' },
      physics: { engine: 'kinematics', ground: 'terrain', character: true },
      entities: [
        {
          id: 'player',
          components: {
            transform: { pos: [32, 200, 32], rot: [0, 0, 0, 1] },
            character: { speed: 0, jumpSpeed: 0, gravity: 30, vy: 0, grounded: false },
            moveIntent: { dir: [0, 0], jump: false },
          },
        },
        {
          id: 'crate',
          components: {
            transform: { pos: [32, 200, 32], rot: [0, 0, 0, 1] },
            collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
            kinematicBody: { vel: [0, -50, 0], slide: false },
          },
        },
      ],
      scripts: [
        {
          id: 'probe',
          code: "molen.on('tick', () => molen.set('crate', 'probe', { h: molen.terrain.heightAt(32, 32) }));",
        },
      ],
      components: { probe: { description: 'terrain probe', examples: [{ h: 0 }] } },
    }),
  );

  // A flat plateau at half height (20 m) for the rigid-body case: a ball dropped on the island
  // peak would roll downhill and off the edge, which is correct physics but a poor oracle.
  const flat = new Float32Array(33 * 33).fill(0.5);
  await writeFile(
    join(projectDir, 'scenes', 'flat.png'),
    encodePng16({ width: 33, height: 33, data: flat }),
  );
  await writeFile(
    join(projectDir, 'scenes', 'flat.terrain.json'),
    `${JSON.stringify({ ...descriptor, name: 'plateau' }, null, 2)}\n`,
  );
  rapierScene = join(projectDir, 'scenes', 'rapier.scene.json');
  await writeFile(
    rapierScene,
    JSON.stringify({
      format: 'molen/scene@3',
      name: 'terrain-rapier',
      seed: 't2',
      tickRate: 60,
      terrain: { descriptor: 'flat.terrain.json', heightmap: 'flat.png' },
      physics: { engine: 'rapier', gravity: [0, -9.81, 0] },
      entities: [
        {
          id: 'ground',
          components: {
            transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            collider3d: { shape: { type: 'heightfield', ref: 'scene' } },
          },
        },
        {
          id: 'ball',
          components: {
            // A short drop with CCD on: a heightfield is a thin surface, and a fast ball can
            // tunnel through it in one 60 Hz step.
            transform: { pos: [32, 26, 32], rot: [0, 0, 0, 1] },
            rigidbody: { body: 'dynamic', ccd: true },
            collider3d: { shape: { type: 'ball', radius: 0.5 } },
          },
        },
      ],
    }),
  );
});

describe('terrain through the headless loop', () => {
  it('character and kinematic body rest on the heightfield; scripts can query it', async () => {
    const r = await runSimulation({
      scenePath: kinematicScene,
      ticks: 200,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: '#player .transform.pos[1]', op: 'approx', value: expectedGround, tol: 0.01 },
          { select: '#player .character.grounded', op: 'eq', value: true },
          { select: '#crate .transform.pos[1]', op: 'approx', value: expectedGround, tol: 0.01 },
          { select: '#crate .probe.h', op: 'approx', value: expectedGround, tol: 0.0001 },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
  });

  it('a rapier ball settles on the heightfield collider', async () => {
    const r = await runSimulation({
      scenePath: rapierScene,
      ticks: 480,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          // Resting on the plateau: ball radius above the 20 m surface.
          { select: '#ball .transform.pos[1]', op: 'approx', value: 20.5, tol: 0.05 },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.physics).toBe('rapier');
    expect(r.ok, r.assertionsFormatted).toBe(true);
  });

  it('is deterministic run-to-run with terrain in the loop', async () => {
    const a = await runSimulation({ scenePath: kinematicScene, ticks: 100 });
    const b = await runSimulation({ scenePath: kinematicScene, ticks: 100 });
    expect(a.stateHash).toBe(b.stateHash);
  });
});
