import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeMatGraph, type MatGraphDoc } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../src/kernel/building';
import {
  distantBuildingLook,
  glazingFraction,
  SHARED_MATERIAL_MEANS,
  standInTint,
  TEXTURED_SURFACE_MEAN,
} from '../../src/kernel/distant-look';
import { analyzeFootprint } from '../../src/kernel/footprint';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { resolveBuildingRecipe } from '../../src/kernel/recipe';
import { packIdentity, resolveStylePackDocuments } from '../../src/kernel/stylepack';
import { type BuildingRequest, FLAT_GROUND, type RGB, type Vec2 } from '../../src/kernel/types';
import '../../src/kernel';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../content/worldgen');
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(packDir, path), 'utf8'));
const pack = await resolveStylePackDocuments(await readJson('stylepack.json'), readJson);
const identity = packIdentity(pack);

function style(id: string) {
  const doc = pack.archstyles[id];
  if (doc === undefined) throw new Error(`default pack has no ${id}`);
  return doc;
}

const TOWER: BuildingRequest = {
  identity: 'f:distant-1',
  labels: ['office'],
  outline: [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ] as Vec2[],
  levels: 20,
};

const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (c: RGB): number =>
  0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);

describe('distant building looks', () => {
  it('holds a measured mean for every shared material graph, matching its bake', async () => {
    const files = (await readdir(resolve(packDir, 'materials'))).filter((name) =>
      name.endsWith('.matgraph.json'),
    );
    const ids = files.map((name) => name.replace('.matgraph.json', '')).sort();
    expect(Object.keys(SHARED_MATERIAL_MEANS).sort()).toEqual(ids);
    for (const id of ids) {
      const result = validateByKind(
        'matgraph' as never,
        await readJson(`materials/${id}.matgraph.json`),
      );
      if (!result.ok) throw new Error(result.formatted);
      // Rows are measured at the authored size; 32² keeps the suite fast. Fine joints (mortar,
      // tile grout) take a few more pixels at 32², which moved no graph by more than 0.08.
      const doc = { ...(result.value as MatGraphDoc), size: [32, 32] } as MatGraphDoc;
      const image = bakeMatGraph(doc).slots.baseColor;
      if (image === undefined) throw new Error(`${id} has no base color`);
      const sum = [0, 0, 0];
      for (let i = 0; i < image.data.length; i += 4)
        for (let c = 0; c < 3; c++) sum[c] += linear((image.data[i + c] as number) / 255);
      const pixels = image.data.length / 4;
      const row = SHARED_MATERIAL_MEANS[id] as readonly number[];
      for (let c = 0; c < 3; c++)
        expect(Math.abs((sum[c] as number) / pixels - (row[c] as number)), id).toBeLessThan(0.1);
    }
  });

  it('weights glass by how much of each facade the windows cover', () => {
    const covered = (id: string): number =>
      glazingFraction(
        resolveBuildingRecipe(style(id), identity, TOWER, analyzeFootprint(TOWER.outline), 0),
      );
    // Grid curtain walls are mostly glass; punched windows leave most of the wall.
    expect(covered('molen.worldgen.use.office_block')).toBeGreaterThan(0.7);
    expect(covered('molen.worldgen.use.apartment_tower')).toBeGreaterThan(0.15);
    expect(covered('molen.worldgen.use.apartment_tower')).toBeLessThan(0.45);
  });

  it('draws a glass office block blue-grey and darker than its pale concrete', () => {
    const office = style('molen.worldgen.use.office_block');
    const look = distantBuildingLook(office, identity, TOWER);
    const recipe = resolveBuildingRecipe(
      office,
      identity,
      TOWER,
      analyzeFootprint(TOWER.outline),
      0,
    );
    // The walls' palette is light concrete (#b5b8b8-#d0d0cb); at 0.65 of it that is still pale.
    expect(luminance(recipe.parts.wall.color) * TEXTURED_SURFACE_MEAN).toBeGreaterThan(0.3);
    expect(luminance(look.wall)).toBeLessThan(0.25);
    expect(look.wall[2]).toBeGreaterThan(look.wall[0] + 0.03);
    // A membrane roof is the darkest shared graph (0.40), so the roof reads mid-grey, not white.
    expect(luminance(look.roof)).toBeLessThan(0.1);
  });

  it('paints a box stand-in in the look its full building shows', () => {
    const office = style('molen.worldgen.use.office_block');
    const result = generateBuilding(
      { request: TOWER, style: office, pack: identity, ground: FLAT_GROUND, tier: 99 },
      new MeshBufferBuilder(),
    );
    const look = distantBuildingLook(office, identity, TOWER);
    expect(result.box?.color).toEqual(standInTint(look.wall));
    // Drawn on the flat material at the textured-surface mean, the box shows the look itself.
    const shown = (result.box?.color as RGB).map((c) => linear(c) * TEXTURED_SURFACE_MEAN);
    look.wall.forEach((c, i) => {
      expect(shown[i]).toBeCloseTo(linear(c), 5);
    });
    // Simplified generation collapses materials; its stand-in keeps the textured look.
    const simplified = generateBuilding(
      {
        request: TOWER,
        style: office,
        pack: identity,
        ground: FLAT_GROUND,
        tier: 99,
        simplified: true,
      },
      new MeshBufferBuilder(),
    );
    expect(simplified.box?.color).toEqual(result.box?.color);
  });
});
