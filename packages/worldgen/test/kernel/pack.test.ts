import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeMatGraph, type MatGraphDoc } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { generateWorldgenBatch } from '../../src/kernel/batch';
import { parseMaterialRef } from '../../src/kernel/schema-common';
import {
  type ResolvedStylePack,
  resolveStylePackDocuments,
  stylePackAssetIndex,
  stylePackMaterialRefs,
} from '../../src/kernel/stylepack';
import type { Vec2 } from '../../src/kernel/types';
import '../../src/kernel';
import { SHAPES } from '../helpers/shapes';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../packs/default');

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(packDir, path), 'utf8'));
}

const pack: ResolvedStylePack = await resolveStylePackDocuments(
  await readJson('stylepack.json'),
  readJson,
);

function meanLuminance(doc: MatGraphDoc): number {
  const image = bakeMatGraph(doc).slots.baseColor;
  if (image === undefined) return 0;
  let sum = 0;
  const pixels = image.width * image.height;
  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    sum +=
      (0.2126 * (image.data[offset] as number) +
        0.7152 * (image.data[offset + 1] as number) +
        0.0722 * (image.data[offset + 2] as number)) /
      255;
  }
  return sum / pixels;
}

describe('default pack', () => {
  it('references generated materials and prop models that resolve', () => {
    expect(Object.keys(pack.materials).length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(pack.assets)).toEqual(
      expect.arrayContaining([
        'molen.worldgen.prop.chimney.brick',
        'molen.worldgen.prop.rooftop.hvac',
        'molen.worldgen.prop.canale',
      ]),
    );
    const refs = stylePackMaterialRefs(pack);
    expect(refs.length).toBeGreaterThanOrEqual(10);
    for (const ref of refs) {
      const parsed = parseMaterialRef(ref);
      expect(parsed?.kind).toBe('matgraph');
      expect(pack.materials[parsed?.ref ?? '']).toBe('matgraph');
    }
    const index = stylePackAssetIndex(pack, 'https://example.test/pack/');
    expect(index['molen.worldgen.prop.canale']).toBe(
      'https://example.test/pack/assets/prop/canale/model.glb',
    );
    expect(index['molen.worldgen.material.stucco']).toBe(
      'https://example.test/pack/materials/stucco.matgraph.json',
    );
  });

  it('authors multiply-tinted materials light enough for palettes to carry the color', async () => {
    const tinted = new Set<string>();
    for (const doc of Object.values(pack.archstyles)) {
      for (const spec of Object.values(doc.materials)) {
        if (spec === undefined || spec.tint !== 'multiply') continue;
        for (const choice of spec.choices) {
          const parsed = parseMaterialRef(choice.ref);
          if (parsed !== undefined && parsed.kind === 'matgraph') tinted.add(parsed.ref);
        }
      }
    }
    expect(tinted.size).toBeGreaterThanOrEqual(8);
    for (const id of tinted) {
      const path = pack.root.materials[id] as string;
      const parsed = validateByKind('matgraph' as never, await readJson(path));
      if (!parsed.ok) throw new Error(parsed.formatted);
      expect(meanLuminance(parsed.value as MatGraphDoc), id).toBeGreaterThanOrEqual(0.55);
    }
  }, 60_000); // Full-resolution validation covers all 45 materials and their PBR channels.

  it('generates textured buildings with props from every house style', () => {
    const outline = SHAPES.L as Vec2[];
    const seen = new Set<string>();
    for (const [styleId, doc] of Object.entries(pack.archstyles)) {
      const output = generateWorldgenBatch({
        buildings: [0, 1, 2, 3].map((index) => ({
          identity: `f:${styleId}:${index}`,
          labels: doc.applicability.classes.slice(0, 1),
          outline,
          style: styleId,
        })),
        pack,
      });
      expect(output.stats.buildingsRendered, styleId).toBe(4);
      for (const set of output.placements) seen.add(set.modelRef);
      if (styleId !== 'molen.worldgen.generic.box') {
        expect(
          output.buildings?.groups.some((group) => group.materialRef.startsWith('matgraph:')),
          styleId,
        ).toBe(true);
      }
    }
    expect(seen.has('molen.worldgen.prop.chimney.brick')).toBe(true);
  });
});

it('draws one continuous storey in the commercial glass texture', async () => {
  // Bake takes a validated document: the schema is what fills in each node's optional params.
  const parsed = validateByKind('matgraph', await readJson('materials/window_grid.matgraph.json'));
  if (!parsed.ok) throw new Error(parsed.formatted);
  const image = bakeMatGraph(parsed.value as MatGraphDoc).slots.baseColor;
  if (!image) throw new Error('missing glass texture');
  for (const x of [0.25, 0.75])
    for (const y of [0.25, 0.5, 0.75]) {
      const offset = (Math.floor(y * image.height) * image.width + Math.floor(x * image.width)) * 4;
      expect((image.data[offset + 2] as number) - (image.data[offset] as number)).toBeGreaterThan(
        20,
      );
    }
});

it('defaults untyped large blocks to low-rise and preserves explicit office and height evidence', () => {
  const outline: Vec2[] = [
    [0, 0],
    [90, 0],
    [90, 45],
    [0, 45],
  ];
  const requests = [
    ...Array.from({ length: 12 }, (_, i) => ({
      identity: `unknown:${i}`,
      labels: ['building'],
      outline,
    })),
    { identity: 'office', labels: ['office'], outline },
    { identity: 'known', labels: ['building'], outline, height: 32, levels: 8 },
    { identity: 'levels', labels: ['building'], outline, levels: 7 },
    { identity: 'mall', labels: ['supermarket'], outline },
  ];
  const output = generateWorldgenBatch({
    pack,
    buildings: requests,
    budgets: { detailedCount: 100 },
  });
  for (const r of output.records.filter((r) => r.identity.startsWith('unknown:')))
    expect(r.height).toBeLessThan(10);
  expect(output.records.find((r) => r.identity === 'office')?.height).toBeGreaterThan(10);
  expect(output.records.find((r) => r.identity === 'known')?.height).toBe(32);
  expect(output.records.find((r) => r.identity === 'levels')?.height).toBeGreaterThan(20);
  expect(output.records.find((r) => r.identity === 'mall')?.height).toBeLessThanOrEqual(7);
});
