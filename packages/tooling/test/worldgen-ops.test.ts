import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { validateByKind } from '@bendyline/molen-schema';
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
// default. These tests use the repository's pack sources, as a project would through MOLEN_PACKS.
const CONTENT = resolve(__dirname, '../../../content');
const previousPacks = process.env.MOLEN_PACKS;

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-worldgen-ops-'));
  process.env.MOLEN_PACKS = [join(CONTENT, 'worldgen'), join(CONTENT, 'earth')].join(delimiter);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  if (previousPacks === undefined) delete process.env.MOLEN_PACKS;
  else process.env.MOLEN_PACKS = previousPacks;
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
    const { pack } = await loadStylePackFromDisk();
    expect(Object.keys(pack.archstyles).length).toBeGreaterThanOrEqual(8);
    const input = batchInputFromDoc(doc, pack, { styleId: 'molen.worldgen.fantasy.hall' });
    expect(input.buildings.every((b) => b.style === 'molen.worldgen.fantasy.hall')).toBe(true);
    expect(() => batchInputFromDoc(doc, pack, { styleId: 'nope' })).toThrow('not in the pack');
  });

  it('loads a style pack from a pack directory or a built pack, and names the fix without one', async () => {
    const fromDir = await loadStylePackFromDisk(join(CONTENT, 'worldgen'));
    expect(fromDir.pack.hash).toBe(
      'sha256:e60d6a93ec150d5173414413222ee4094e358aebc1a41f45287a59daa7fd0215',
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
  });

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
  });
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
