import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { TransportNetwork } from '@bendyline/molen-ambient/kernel';
import { validateByKind } from '@bendyline/molen-schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bakeNetwork } from '../src/ops/index';

const SAMMAMISH = resolve(
  __dirname,
  '../../../examples/world-explorer/public/terrain/sammamish/terrain-package.json',
);
// Central Sammamish at the features sidecar's finest level.
const TILE = '15/5276/11442';

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-network-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('network bake', () => {
  it('bakes a real tile into a valid, repeatable transport network', async () => {
    if (!(await exists(SAMMAMISH))) return;
    const first = join(dir, 'a.json');
    const second = join(dir, 'b.json');
    const r = await bakeNetwork({ packagePath: SAMMAMISH, tile: TILE, outPath: first });
    expect(r.ok, r.error).toBe(true);
    expect(r.tiles).toBe(1);
    expect(r.ways).toBeGreaterThan(100);
    expect(r.classes?.road).toBeGreaterThan(50);
    expect(r.origin?.latitude).toBeCloseTo(47.62, 1);
    const doc = JSON.parse(await readFile(first, 'utf8'));
    const valid = validateByKind('transport-network' as never, doc);
    expect(valid.ok, JSON.stringify(valid)).toBe(true);
    // The baked document rebuilds into a connected lane graph.
    const net = new TransportNetwork();
    net.addDocument(doc);
    expect(net.stats().lanes).toBeGreaterThan(r.ways ?? 0);
    expect(net.stats().junctions).toBeGreaterThan(20);
    // Byte-identical on repeat.
    const again = await bakeNetwork({ packagePath: SAMMAMISH, tile: TILE, outPath: second });
    expect(again.ok, again.error).toBe(true);
    expect(await readFile(second, 'utf8')).toBe(await readFile(first, 'utf8'));
  }, 120_000);

  it('keeps only the requested classes and rejects bad requests', async () => {
    if (!(await exists(SAMMAMISH))) return;
    const out = join(dir, 'roads.json');
    const r = await bakeNetwork({
      packagePath: SAMMAMISH,
      tile: TILE,
      classes: ['road'],
      outPath: out,
    });
    expect(r.ok, r.error).toBe(true);
    expect(Object.keys(r.classes ?? {})).toEqual(['road']);
    const noArea = await bakeNetwork({ packagePath: SAMMAMISH, outPath: out });
    expect(noArea.ok).toBe(false);
    expect(noArea.error).toMatch(/tile|bbox/);
    const tooMany = await bakeNetwork({
      packagePath: SAMMAMISH,
      tile: TILE,
      radius: 8,
      outPath: out,
    });
    expect(tooMany.ok).toBe(false);
  }, 120_000);
});
