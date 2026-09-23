import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeMatGraph, type MatGraphDoc, type RGBAImage } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';

const materialDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../packs/default/materials',
);

async function material(id: string, size = 64): Promise<MatGraphDoc> {
  const input: unknown = JSON.parse(
    await readFile(resolve(materialDir, `${id}.matgraph.json`), 'utf8'),
  );
  const result = validateByKind('matgraph' as never, input);
  if (!result.ok) throw new Error(result.formatted);
  const doc = result.value as MatGraphDoc;
  expect(doc.size).toEqual([256, 256]);
  return { ...doc, size: [size, size] };
}

function value(image: RGBAImage, u: number, v: number): number {
  const x = Math.min(image.width - 1, Math.floor(u * image.width));
  const y = Math.min(image.height - 1, Math.floor(v * image.height));
  return image.data[(y * image.width + x) * 4] ?? 0;
}

describe('canonical construction material library', () => {
  it('ships 45 shared 256-square materials with independently usable surface response', async () => {
    const files = (await readdir(materialDir)).filter((name) => name.endsWith('.matgraph.json'));
    expect(files.length).toBe(45);
    for (const file of files) {
      const id = file.replace('.matgraph.json', '');
      const baked = bakeMatGraph(await material(id, 32));
      expect(baked.slots.baseColor, id).toBeDefined();
      const roughness = baked.slots.roughness;
      expect(roughness, id).toBeDefined();
      if (roughness !== undefined) {
        expect(value(roughness, 0.5, 0.5), id).toBeGreaterThanOrEqual(50);
        expect(value(roughness, 0.5, 0.5), id).toBeLessThanOrEqual(253);
      }
    }
  });

  it('repeats every lap board and barrel rib instead of clamping a scaled coordinate', async () => {
    const lap = bakeMatGraph(await material('siding_lap', 256)).slots.baseColor;
    const ceramic = bakeMatGraph(await material('tile_ceramic', 256)).slots.baseColor;
    if (lap === undefined || ceramic === undefined) throw new Error('missing surface');
    for (let course = 0; course < 8; course++) {
      expect(
        value(lap, 0.37, (course + 0.5) / 8) - value(lap, 0.37, (course + 0.01) / 8),
      ).toBeGreaterThan(30);
      expect(
        value(ceramic, (course + 0.5) / 8, 0.06) - value(ceramic, (course + 0.1) / 8, 0.06),
      ).toBeGreaterThan(20);
    }
  });

  it('distinguishes matte masonry, glaze and metal in the actual baked PBR channels', async () => {
    const brick = bakeMatGraph(await material('brick_stack'));
    const glaze = bakeMatGraph(await material('brick_glazed'));
    const metal = bakeMatGraph(await material('metal_standing_seam'));
    expect(value(brick.slots.roughness as RGBAImage, 0.5, 0.5)).toBeGreaterThan(200);
    expect(value(glaze.slots.roughness as RGBAImage, 0.5, 0.5)).toBeLessThan(90);
    expect(value(metal.slots.metalness as RGBAImage, 0.5, 0.5)).toBeGreaterThan(100);
    expect(brick.slots.normal).toBeDefined();
    expect(glaze.slots.normal).toBeDefined();
    expect(metal.slots.normal).toBeDefined();
  });

  it('joins both texture borders for directional timber and layered earth grain', async () => {
    for (const id of ['wood_vertical', 'wood_board_batten', 'earth_rammed', 'thatch']) {
      const image = bakeMatGraph(await material(id, 256)).slots.baseColor;
      if (image === undefined) throw new Error(`missing ${id}`);
      let seamDifference = 0;
      for (let sample = 0; sample < 256; sample++) {
        const t = (sample + 0.5) / 256;
        seamDifference += Math.abs(value(image, 0, t) - value(image, 1, t));
        seamDifference += Math.abs(value(image, t, 0) - value(image, t, 1));
      }
      expect(seamDifference / 512, id).toBeLessThan(8);
    }
  });
});
