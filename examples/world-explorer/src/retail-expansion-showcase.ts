/** Supplemental review blocks keep the original eight-store/interior walkthrough coordinates stable. */
import type { TerrainSemanticPoint, TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import { LANDMARK_DEFINITIONS } from '@bendyline/molen-worldgen/kernel';
import { BUSINESS_CATALOG, BUSINESS_PROFILES } from '@bendyline/molen-worldgen-earth/kernel';

export function appendRetailExpansion(
  tile: TerrainSemanticTile,
  point: (x: number, z: number) => TerrainSemanticPoint,
): void {
  tile.pois ??= [];
  BUSINESS_PROFILES.slice(8).forEach((profile, index) => {
    const visual = LANDMARK_DEFINITIONS[`sign.${profile.sign}`];
    if (visual?.generator !== 'sign') return;
    const style = visual.storefront.style?.split('.').at(-1);
    const [width, depth, height] =
      style === 'warehouse'
        ? [60, 38, 10]
        : style === 'department_store'
          ? [46, 30, 10]
          : style === 'big_box'
            ? [46, 30, 8]
            : style === 'restaurant'
              ? [24, 16, 4.6]
              : [30, 22, 5.2];
    const x = ((index % 6) - 2.5) * 70,
      z = 150 + Math.floor(index / 6) * 58;
    const id = `showcase:${profile.id}`;
    tile.buildings.push({
      id,
      class: 'building',
      height,
      ...(style === 'department_store' ? { levels: 2 } : {}),
      polygons: [
        {
          outer: [
            point(x - width / 2, z - depth / 2),
            point(x + width / 2, z - depth / 2),
            point(x + width / 2, z + depth / 2),
            point(x - width / 2, z + depth / 2),
          ],
        },
      ],
    });
    tile.pois?.push({
      id,
      class: profile.categories[0] ?? 'retail',
      name: profile.aliases[0],
      brandId: profile.brandIds[0],
      point: point(x, z + depth / 2 - 2),
    });
  });
  for (const [index, kind] of ['mall', 'department_store', 'outlet_mall', 'strip_mall'].entries()) {
    const x = index % 2 === 0 ? -292 : 292,
      z = index < 2 ? 15 : 170;
    const id = `showcase:${kind}`;
    const outer =
      kind === 'outlet_mall'
        ? [
            point(x - 42, z - 32),
            point(x + 42, z - 32),
            point(x + 42, z - 8),
            point(x - 12, z - 8),
            point(x - 12, z + 32),
            point(x - 42, z + 32),
          ]
        : [
            point(x - 42, z - 24),
            point(x + 42, z - 24),
            point(x + 42, z + 24),
            point(x - 42, z + 24),
          ];
    tile.buildings.push({
      id,
      class: kind,
      height: index < 2 ? 10 : 5.5,
      levels: index < 2 ? 2 : 1,
      polygons: [
        {
          outer,
          ...(kind === 'mall'
            ? {
                holes: [
                  [
                    point(x - 15, z - 10),
                    point(x - 15, z + 10),
                    point(x + 15, z + 10),
                    point(x + 15, z - 10),
                  ],
                ],
              }
            : {}),
        },
      ],
    });
    tile.pois.push({ id, class: kind, point: point(x - 25, z + 12) });
    // A real mixed-tenant test: preserve independent brands without recoloring the center.
    if (kind === 'mall' || kind === 'strip_mall') {
      for (const [i, name] of ['best_buy', 'panera', 'petco'].entries()) {
        const profile = BUSINESS_PROFILES.find((p) => p.id === name);
        if (profile)
          tile.pois.push({
            id: `${id}:tenant:${name}`,
            class: profile.categories[0] ?? 'retail',
            name: profile.aliases[0],
            point: point(x - 28 + i * 28, z + 21),
          });
      }
    }
    if (!BUSINESS_CATALOG.categories.some((c) => c.id === kind))
      throw new Error(`Missing retail category ${kind}`);
  }
  for (let row = 0; row < 6; row++)
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'service',
      width: 6,
      lines: [[point(-210, 175 + row * 58), point(210, 175 + row * 58)]],
    });
  tile.landcover.push({
    class: 'commercial',
    polygons: [{ outer: [point(-340, -25), point(340, -25), point(340, 480), point(-340, 480)] }],
  });
}
