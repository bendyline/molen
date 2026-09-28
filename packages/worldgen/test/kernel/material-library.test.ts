import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeMatGraph, type MatGraphDoc, type RGBAImage } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';

const materialDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../content/worldgen/materials',
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
  it('ships 65 shared 256-square materials with independently usable surface response', async () => {
    const files = (await readdir(materialDir)).filter((name) => name.endsWith('.matgraph.json'));
    expect(files.length).toBe(65);
    const style = JSON.parse(await readFile(resolve(materialDir, '../stylepack.json'), 'utf8'));
    expect(Object.values(style.materials).sort()).toEqual(
      files.map((name) => `materials/${name}`).sort(),
    );
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
    const stainless = bakeMatGraph(await material('metal_stainless'));
    expect(value(stainless.slots.metalness as RGBAImage, 0.5, 0.5)).toBe(255);
    expect(value(stainless.slots.roughness as RGBAImage, 0.5, 0.5)).toBeLessThan(100);
    const film = bakeMatGraph(await material('etfe_film'));
    expect(value(film.slots.metalness as RGBAImage, 0.5, 0.5)).toBe(0);
    expect(value(film.slots.roughness as RGBAImage, 0.5, 0.5)).toBeLessThan(75);
  });

  it('joins both texture borders for directional timber and layered earth grain', async () => {
    for (const id of [
      'wood_vertical',
      'wood_board_batten',
      'earth_rammed',
      'thatch',
      'stone_marble',
      'stone_limestone_raw',
      'stone_limestone_weathered',
      'stone_sandstone_raw',
      'stone_basalt_raw',
    ]) {
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
  }, 30_000); // Bakes four full material graphs at 256².
  it('keeps square metal cutouts transparent and cast bronze free of panel courses', async () => {
    const perforated = bakeMatGraph(await material('metal_perforated_square', 256));
    const image = perforated.slots.baseColor;
    if (!image) throw new Error('missing perforated map');
    const alpha = (x: number, y: number) => image.data[(y * 256 + x) * 4 + 3];
    expect(perforated.meta.alphaTest).toBe(0.3);
    expect(alpha(128, 128)).toBe(0);
    expect(alpha(3, 128)).toBe(255);
    const open = Array.from({ length: 256 }, (_, x) => alpha(x, 128)).filter((a) => a === 0).length;
    expect(Math.abs((open / 256) * 85 - 65.5)).toBeLessThan(0.5);
    const round = bakeMatGraph(await material('metal_perforated_round', 256));
    const roundImage = round.slots.baseColor;
    if (!roundImage) throw new Error('missing round aperture map');
    const roundAlpha = (x: number, y: number) => roundImage.data[(y * 256 + x) * 4 + 3];
    expect(round.meta.alphaTest).toBe(0.3);
    expect(roundAlpha(128, 128)).toBe(0);
    expect(roundAlpha(94, 94)).toBe(255); // corners outside a circle, unlike a square aperture
    const diameter = Array.from({ length: 256 }, (_, x) => roundAlpha(x, 128)).filter(
      (a) => a === 0,
    ).length;
    expect(Math.abs((diameter / 256) * 12 - 4)).toBeLessThan(0.15);
    const openRound = bakeMatGraph(await material('metal_perforated_round_open', 256));
    const openImage = openRound.slots.baseColor;
    if (!openImage) throw new Error('missing high-open round aperture map');
    expect(openRound.meta.alphaTest).toBe(0.3);
    let openPixels = 0;
    for (let i = 3; i < openImage.data.length; i += 4)
      if ((openImage.data[i] ?? 255) < 77) openPixels++;
    expect(openPixels / (256 * 256)).toBeGreaterThan(0.43);
    expect(openPixels / (256 * 256)).toBeLessThan(0.45);
    expect(openImage.data[(128 * 256 + 128) * 4 + 3]).toBe(0);
    expect(openImage.data[(20 * 256 + 20) * 4 + 3]).toBe(255);
    const expanded = bakeMatGraph(await material('metal_expanded_diamond', 256));
    const expandedImage = expanded.slots.baseColor;
    if (!expandedImage) throw new Error('missing diamond aperture map');
    expect(expanded.meta.alphaTest).toBe(0.3);
    const expandedAlpha = (x: number, y: number) =>
      expandedImage.data[(y * 256 + x) * 4 + 3] ?? 255;
    let diamondOpenPixels = 0;
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) if (expandedAlpha(x, y) < 77) diamondOpenPixels++;
    expect(diamondOpenPixels / 65536).toBeGreaterThan(0.55);
    expect(diamondOpenPixels / 65536).toBeLessThan(0.57);
    expect(expandedAlpha(128, 128)).toBe(0);
    expect(expandedAlpha(0, 0)).toBe(0); // staggered corner aperture
    expect(expandedAlpha(0, 128)).toBe(255); // connecting bond
    expect(expandedAlpha(64, 64)).toBe(255); // diagonal web
    const bronzeDoc = await material('metal_bronze_cast');
    expect(
      bronzeDoc.nodes.some((node) => ['bricks', 'checker', 'gradient'].includes(node.type)),
    ).toBe(false);
    const bronze = bakeMatGraph(bronzeDoc);
    expect(value(bronze.slots.roughness as RGBAImage, 0.5, 0.5)).toBeGreaterThan(140);
    expect(value(bronze.slots.metalness as RGBAImage, 0.5, 0.5)).toBeGreaterThan(130);
  });
});
