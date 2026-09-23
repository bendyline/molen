import { readFile } from 'node:fs/promises';
import { validateByKind } from '@bendyline/molen-schema';
import {
  FLAT_GROUND,
  generateWorldgenBatch,
  type Vec2,
  type WorldgenBatchDoc,
} from '@bendyline/molen-worldgen/kernel';
import { expect, it } from 'vitest';
import { loadDefaultPack } from './helpers/pack';

it('renders the complete retail fixture at two scales, rotated, and at near/distant detail', async () => {
  const source = JSON.parse(
    await readFile(new URL('./fixtures/us-retail-library.batch.json', import.meta.url), 'utf8'),
  );
  const parsed = validateByKind('worldgen-batch', source);
  expect(parsed.ok).toBe(true);
  const doc = source as WorldgenBatchDoc;
  expect(doc.buildings).toHaveLength(41);
  const pack = await loadDefaultPack();
  const signCount = doc.buildings.reduce((sum, b) => sum + (b.storefronts?.length ?? 0), 0);
  for (const scale of [0.65, 1.3])
    for (const tier of [0, 1, 2]) {
      // 90-degree rotation and translation exercise facade orientation independently of authoring.
      const transform = ([x, z]: Vec2): Vec2 => [1000 - z * scale, x * scale - 200];
      const buildings = doc.buildings.map((b) => ({
        ...b,
        outline: b.outline.map(transform),
        holes: b.holes?.map((r) => r.map(transform)),
        storefronts: b.storefronts?.map((s) => ({
          ...s,
          at: transform(s.at),
          width: (s.width ?? 10) * scale,
        })),
      }));
      const input = { buildings, pack, tier, ground: FLAT_GROUND };
      const output = generateWorldgenBatch(input);
      expect(output.records).toHaveLength(41);
      expect(output.stats.buildingsSkipped).toBe(0);
      if (tier < 2) expect(output.buildings?.positions.every(Number.isFinite)).toBe(true);
      else {
        expect(output.stats.buildingsBoxed).toBe(41);
        expect(output.placements.find((s) => s.modelRef === 'builtin:box')?.count).toBe(41);
      }
      expect(
        output.placements
          .filter((s) => s.modelRef.startsWith('builtin:sign.'))
          .reduce((n, s) => n + s.count, 0),
      ).toBe(tier < 2 ? signCount : 0);
      expect(generateWorldgenBatch(input).hash).toBe(output.hash);
    }
});
