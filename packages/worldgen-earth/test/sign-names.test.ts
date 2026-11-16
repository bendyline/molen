import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  type TerrainPoiFeature,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { generateWorldgenBatch } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { cleanBusinessName, normalizeBusinessName } from '../src/kernel/business-names';
import { createPlacesContent } from '../src/kernel/places';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack, loadDefaultPlacesDocs, loadNamedPlacesDocs } from './helpers/pack';

const pack = await loadDefaultPack();
const docs = await loadNamedPlacesDocs();
const named = createPlacesContent(docs);
const namer = named.signs;
if (namer === undefined) throw new Error('expected a sign namer');

const geom: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 100,
  metersPerUnit: 1,
  levelBelowMax: 0,
};

function resolve(poi: Pick<TerrainPoiFeature, 'class' | 'name'>) {
  const business = named.businesses.resolve(poi);
  if (business === undefined) throw new Error(`not a business: ${poi.name}`);
  return business;
}

/** One low store by a road, holding the given places. */
function tile(pois: TerrainPoiFeature[]): TerrainSemanticTile {
  const t = createEmptyTerrainSemanticTile();
  t.buildings = [
    {
      id: 900,
      class: 'building',
      height: 6,
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.8, 0.1],
            [0.8, 0.5],
            [0.1, 0.5],
          ],
        },
      ],
    },
  ];
  t.transportation = [
    {
      class: 'minor_road',
      lines: [
        [
          [0, 0.6],
          [1, 0.6],
        ],
      ],
    },
  ];
  t.pois = pois;
  return t;
}

describe('business names on signs', () => {
  it('cleans mapped names the way a storefront shows them', () => {
    expect(cleanBusinessName('  Joe’s   Diner #1234 ')).toBe('Joe’s Diner');
    expect(cleanBusinessName('cafe RanZan（阪急嵐山駅前）')).toBe('cafe RanZan');
    expect(cleanBusinessName('ローソン 京都駅前店')).toBe('ローソン');
    expect(cleanBusinessName('☆Star Bar♪')).toBe('Star Bar');
    // Full-width letters fold; nothing letter-like left is no name at all.
    expect(cleanBusinessName('ＡＢＣ　Ｍａｒｔ')).toBe('ABC Mart');
    expect(cleanBusinessName('★ ♪')).toBeUndefined();
    // Too long to set: the place keeps its category sign.
    expect(cleanBusinessName('A'.repeat(41))).toBeUndefined();
    // A trim that would leave a single character is not made.
    expect(cleanBusinessName('7 #12')).toBe('7 #12');
    expect(normalizeBusinessName('Trader Joe’s')).toBe(normalizeBusinessName('TRADER JOES'));
  });

  it('shows a chain under one name, in its descriptor palette, never its emblem', () => {
    const sign = namer.sign(
      { name: 'Mc Donalds' },
      resolve({ class: 'fast_food', name: 'Mc Donalds' }),
    );
    // Every branch reads the catalog's display name, whatever spelling the map used.
    expect(sign).toEqual({
      text: "McDonald's",
      plate: '#bc2529',
      ink: '#ffffff',
      stripe: '#ffc629',
      font: 'bold',
    });
    // A branch matched by a name in another script shows that name, if the faces hold it; the
    // Latin atlas alone does not, so it shows the display name.
    expect(
      namer.sign({ name: 'マクドナルド' }, resolve({ class: 'fast_food', name: 'マクドナルド' }))
        ?.text,
    ).toBe("McDonald's");
    // The looks document overrides a chain's palette: Safeway is white on red.
    expect(
      namer.sign({ name: 'Safeway' }, resolve({ class: 'supermarket', name: 'Safeway' })),
    ).toMatchObject({ text: 'Safeway', plate: '#bc2530', ink: '#ffffff' });
  });

  it('gives a local place its own name in one look for all of its branches', () => {
    const first = namer.sign(
      { name: 'Pho Bac' },
      resolve({ class: 'restaurant', name: 'Pho Bac' }),
    );
    const second = namer.sign(
      { name: 'PHO BAC #2' },
      resolve({ class: 'restaurant', name: 'PHO BAC #2' }),
    );
    expect(first?.text.toLowerCase()).toBe('pho bac');
    expect(second?.plate).toBe(first?.plate);
    expect(second?.ink).toBe(first?.ink);
    // Names spread over the family rather than all taking one look.
    const looks = new Set(
      ['Rosa', 'Il Bistro', 'The Pink Door', 'Tilikum Place', 'Bakery Nouveau', 'Marination'].map(
        (name) => namer.sign({ name }, resolve({ class: 'restaurant', name }))?.plate,
      ),
    );
    expect(looks.size).toBeGreaterThan(2);
  });

  it('falls back to the English name, then to the category sign', () => {
    const business = resolve({ class: 'restaurant', name: '嵐山よしむら' });
    expect(
      namer.sign({ name: '嵐山よしむら', nameLatin: 'Arashiyama Yoshimura' }, business)?.text,
    ).toMatch(/Arashiyama Yoshimura/i);
    expect(namer.sign({ name: '嵐山よしむら' }, business)).toBeUndefined();
    expect(namer.sign({}, business)).toBeUndefined();
  });

  it('puts names on storefronts only when asked, and builds a sign mesh with them', () => {
    const pois: TerrainPoiFeature[] = [
      { id: 1, class: 'supermarket', name: 'Safeway', point: [0.3, 0.3] },
      { id: 2, class: 'restaurant', name: 'Pho Bac', point: [0.6, 0.3] },
      { id: 3, class: 'cafe', point: [0.45, 0.3] },
    ];
    const generic = createPlacesContent({ ...docs, signNames: 'generic' });
    expect(generic.signs).toBeUndefined();
    const legacy = semanticTileToBatch(tile(pois), geom, {
      pack,
      places: createPlacesContent({ ...docs, signLooks: undefined, glyphs: undefined }),
    });
    const plain = semanticTileToBatch(tile(pois), geom, { pack, places: generic });
    expect(plain).toEqual(legacy);
    expect(plain.glyphs).toBeUndefined();
    expect(plain.buildings[0]?.storefronts?.every((s) => s.sign === undefined)).toBe(true);

    const batch = semanticTileToBatch(tile(pois), geom, { pack, places: named });
    const fronts = batch.buildings[0]?.storefronts ?? [];
    expect(fronts.map((s) => s.sign?.text)).toEqual([
      'Safeway',
      expect.stringMatching(/pho bac/i),
      undefined,
    ]);
    const output = generateWorldgenBatch(batch);
    expect(output.signs?.count).toBe(2);
    // The unnamed cafe keeps its descriptor model; the named ones are no longer models.
    const models = output.placements.map((set) => set.modelRef);
    expect(models).toContain('builtin:sign.cafe');
    expect(models).not.toContain('builtin:sign.grocery_market');
    expect(output.signs?.plateIndexCount).toBeGreaterThan(0);
    expect(output.signs?.indices.length).toBeGreaterThan(output.signs?.plateIndexCount ?? 0);
    // Deterministic bytes.
    expect(
      generateWorldgenBatch(semanticTileToBatch(tile(pois), geom, { pack, places: named })).hash,
    ).toBe(output.hash);
  });

  it('names every recognized storefront in a mapped tile, within the shared instance cap', async () => {
    const source = JSON.parse(
      await readFile(
        new URL('./fixtures/sammamish-businesses.semantic.json', import.meta.url),
        'utf8',
      ),
    ) as TerrainSemanticTile;
    const sized = { ...geom, size: 824 };
    const batch = semanticTileToBatch(source, sized, { pack, places: named });
    const fronts = batch.buildings.flatMap((b) => b.storefronts ?? []);
    const signed = fronts.filter((s) => s.sign !== undefined);
    expect(signed.length).toBeGreaterThan(5);
    const output = generateWorldgenBatch(batch);
    // Every named storefront reached the mesh, whichever pass built its building (a busy one
    // takes the collapsed-materials pass); no named one fell back to its model.
    expect(output.signs?.count).toBe(signed.length);
    const models = output.placements
      .filter((p) => p.modelRef.startsWith('builtin:sign.'))
      .reduce((n, p) => n + p.count, 0);
    expect(models).toBe(fronts.length - signed.length);
    // Named signs come out of the instance budget first, as sign models do: the rest of the
    // tile admits exactly what it would with generic signs.
    const generic = generateWorldgenBatch(
      semanticTileToBatch(source, sized, {
        pack,
        places: createPlacesContent({ ...docs, signNames: 'generic' }),
      }),
    );
    const count = (o: typeof output): number => o.placements.reduce((n, p) => n + p.count, 0);
    expect(count(output) + (output.signs?.count ?? 0)).toBe(count(generic));
    const capped = generateWorldgenBatch({
      ...batch,
      budgets: { maxInstances: 2, maxGroundCoverInstances: 0 },
    });
    expect(capped.signs?.count).toBe(2);
    expect(capped.placements.filter((p) => p.modelRef !== 'builtin:box')).toEqual([]);
  });

  it('leaves the shipped places documents generic, as before', async () => {
    expect(createPlacesContent(await loadDefaultPlacesDocs()).signs).toBeUndefined();
  });
});
