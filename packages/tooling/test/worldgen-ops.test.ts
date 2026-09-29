import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { buildPack, listPackSource } from '@bendyline/molen-pack/node';
import { validateByKind } from '@bendyline/molen-schema';
import type { StylePackDoc } from '@bendyline/molen-worldgen/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bakeWorldgen,
  batchInputFromDoc,
  lineupBatchDoc,
  loadStylePackFromDisk,
  parseOutline,
  worldgenStats,
} from '../src/ops/index';

const SAMMAMISH = resolve(
  __dirname,
  '../../../examples/world-explorer/public/terrain/sammamish/terrain-package.json',
);

// The worldgen ops read their style pack and atlas from content packs; there is no built-in
// default. Preserve every shipped catalog document in a bounded pack fixture. These operations
// generate procedural meshes and placements; they do not render the multi-gigabyte landmark GLBs.
const CONTENT = resolve(__dirname, '../../../content');
const previousPacks = process.env.MOLEN_PACKS;
const previousCache = process.env.MOLEN_CACHE_DIR;

let dir: string;
let styleDir: string;
let builtStylePath: string;
let shippedStyle: StylePackDoc;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-worldgen-ops-'));
  if (!resolve(dir).startsWith(`${resolve(tmpdir())}${sep}`))
    throw new Error('Unexpected worldgen fixture directory');
  styleDir = join(dir, 'worldgen');
  const source = await listPackSource(join(CONTENT, 'worldgen'));
  const paths = source.paths.filter(
    (path) => path.endsWith('.json') || path === source.config.notice,
  );
  let fixtureBytes = 0;
  for (const path of paths) {
    const bytes = await readFile(join(source.dir, path));
    fixtureBytes += bytes.byteLength;
    await mkdir(dirname(join(styleDir, path)), { recursive: true });
    await writeFile(join(styleDir, path), bytes);
  }
  // This guard catches accidental binary inclusion without coupling the test to a catalog hash.
  expect(fixtureBytes).toBeLessThan(12 * 1024 * 1024);
  expect(paths.some((path) => /\.(glb|gltf|bin|png|ktx2)$/i.test(path))).toBe(false);
  await writeFile(
    join(styleDir, 'molen-pack.source.json'),
    JSON.stringify({ ...source.config, include: paths }),
  );
  shippedStyle = JSON.parse(
    await readFile(join(CONTENT, 'worldgen/stylepack.json'), 'utf8'),
  ) as StylePackDoc;
  builtStylePath = (await buildPack(styleDir, { outDir: join(dir, 'packs') })).path;
  process.env.MOLEN_PACKS = [styleDir, join(CONTENT, 'earth')].join(delimiter);
  process.env.MOLEN_CACHE_DIR = join(dir, 'cache');
});
afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  if (previousPacks === undefined) delete process.env.MOLEN_PACKS;
  else process.env.MOLEN_PACKS = previousPacks;
  if (previousCache === undefined) delete process.env.MOLEN_CACHE_DIR;
  else process.env.MOLEN_CACHE_DIR = previousCache;
});

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('worldgen pack helpers', () => {
  it('ships a valid lineup batch and loads the default pack', async () => {
    const doc = lineupBatchDoc();
    const parsed = validateByKind('worldgen-batch' as never, doc);
    expect(parsed.ok, parsed.ok ? '' : parsed.formatted).toBe(true);
    expect(doc.buildings).toHaveLength(10);
    const { pack, landmarks } = await loadStylePackFromDisk();
    expect(Object.keys(pack.archstyles).length).toBeGreaterThanOrEqual(8);
    expect(pack.root).toEqual(shippedStyle);
    expect(Object.keys(pack.archstyles).sort()).toEqual(Object.keys(shippedStyle.styles).sort());
    expect(Object.keys(pack.scatters).sort()).toEqual(Object.keys(shippedStyle.scatter).sort());
    expect(Object.keys(pack.materials).sort()).toEqual(Object.keys(shippedStyle.materials).sort());
    expect(pack.assets).toEqual(shippedStyle.assets);
    const shippedLandmarks = JSON.parse(
      await readFile(join(CONTENT, 'worldgen/landmarks/catalog.json'), 'utf8'),
    );
    expect(landmarks?.catalog).toEqual(shippedLandmarks);
    expect(Object.keys(landmarks?.models ?? {}).sort()).toEqual(
      Object.keys(shippedLandmarks.models).sort(),
    );
    const input = batchInputFromDoc(doc, pack, { styleId: 'molen.worldgen.fantasy.hall' });
    expect(input.buildings.every((b) => b.style === 'molen.worldgen.fantasy.hall')).toBe(true);
    expect(() => batchInputFromDoc(doc, pack, { styleId: 'nope' })).toThrow('not in the pack');
  });

  it('loads a style pack from a pack directory or a built pack, and names the fix without one', async () => {
    const fromDir = await loadStylePackFromDisk(styleDir);
    const fromBuilt = await loadStylePackFromDisk(builtStylePath);
    expect(fromBuilt.pack).toEqual(fromDir.pack);
    expect(fromBuilt.landmarks).toEqual(fromDir.landmarks);
    expect(fromDir.pack.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fromBuilt.dir).not.toBe(fromDir.dir);
    expect(await readFile(join(fromBuilt.dir, 'stylepack.json'), 'utf8')).toBe(
      await readFile(join(styleDir, 'stylepack.json'), 'utf8'),
    );
    const saved = process.env.MOLEN_PACKS;
    delete process.env.MOLEN_PACKS;
    try {
      await expect(loadStylePackFromDisk(undefined, { cwd: dir })).rejects.toThrow(
        /no style pack: pass --pack/,
      );
    } finally {
      process.env.MOLEN_PACKS = saved;
    }
  });

  it('parses outlines and rejects malformed ones', () => {
    expect(parseOutline('0,0; 10,0 ;10,8;0,8')).toEqual([
      [0, 0],
      [10, 0],
      [10, 8],
      [0, 8],
    ]);
    expect(() => parseOutline('0,0;1,1')).toThrow('three');
    expect(() => parseOutline('0,0;1;2,2')).toThrow('"x,z"');
  });
});

// These integration tests use all shipped procedural/catalog documents and the normal GLB
// importer. Landmark binary payloads are tested separately by asset and regional-pack tests.
describe('worldgen bake', () => {
  it('bakes the lineup to a glTF asset with a sidecar', async () => {
    const outDir = join(dir, 'assets');
    const r = await bakeWorldgen({
      batchPath: resolve(__dirname, '../../../content/worldgen/fixtures/lineup.batch.json'),
      outDir,
      id: 'lineup',
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.stats?.buildingsRendered).toBe(10);
    expect(r.sidecar?.stats.triangles).toBeGreaterThan(1000);
    expect(r.sidecar?.stats.primitives).toBeGreaterThanOrEqual(4);
    expect(r.placements?.some((set) => set.modelRef.startsWith('molen.worldgen.prop.'))).toBe(true);
    const glb = await readFile(join(outDir, 'lineup', 'model.glb'));
    expect(glb.subarray(0, 4).toString('ascii')).toBe('glTF');
    const sidecar = JSON.parse(await readFile(join(outDir, 'lineup', 'asset.json'), 'utf8'));
    expect(validateByKind('asset', sidecar).ok).toBe(true);
    const again = await bakeWorldgen({
      batchPath: resolve(__dirname, '../../../content/worldgen/fixtures/lineup.batch.json'),
      outDir,
      id: 'lineup',
      force: true,
    });
    expect(again.hash).toBe(r.hash);
  }, 60_000);

  it('bakes one outline with a forced style and reports errors', async () => {
    const r = await bakeWorldgen({
      outline: '0,0;18,0;18,9;10,9;10,14;0,14',
      styleId: 'molen.worldgen.fantasy.hall',
      outDir: join(dir, 'assets'),
      id: 'hall',
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.sidecar?.bounds.aabb.max[1]).toBeGreaterThan(4);
    const missing = await bakeWorldgen({ outline: '0,0;10,0;10,10', outDir: join(dir, 'x') });
    expect(missing.ok).toBe(false);
    expect(missing.error).toContain('--style');
    const bad = await bakeWorldgen({ outDir: join(dir, 'x') });
    expect(bad.ok).toBe(false);
  }, 60_000);
});

describe('worldgen stats', () => {
  it('generates a real Sammamish tile deterministically and dumps a valid batch', async () => {
    if (!(await exists(SAMMAMISH))) return;
    const dumpPath = join(dir, 'sammamish.batch.json');
    const r = await worldgenStats({ packagePath: SAMMAMISH, auto: true, dumpPath });
    expect(r.ok, r.error).toBe(true);
    expect(r.deterministic).toBe(true);
    expect(r.stats?.buildingsRendered).toBeGreaterThan(50);
    expect(r.region).toBe('us.pnw');
    const dumped = JSON.parse(await readFile(dumpPath, 'utf8'));
    expect(validateByKind('worldgen-batch' as never, dumped).ok).toBe(true);
    expect(dumped.buildings.length).toBe(r.stats?.buildingsIn);
    const fixed = await worldgenStats({
      packagePath: SAMMAMISH,
      tile: `${r.tile?.level}/${r.tile?.x}/${r.tile?.y}`,
      quality: 'economy',
    });
    expect(fixed.ok, fixed.error).toBe(true);
    expect(fixed.hash).not.toBe(r.hash);
    const missing = await worldgenStats({ packagePath: SAMMAMISH, tile: '3/1/1' });
    expect(missing.ok).toBe(false);
  }, 120_000);
});
