/** Inferred yard canopy from homes, independent of whether building meshes are requested. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  polygonArea,
  polygonBounds,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  analyzeFootprint,
  aspectSeed,
  type BuildingRequest,
  buildingMetrics,
  buildingSeedString,
  ringCentroid,
  type ScatterPolygon,
  selectStyle,
  unit01,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import polygonClipping, { type Polygon } from 'polygon-clipping';
import { identityFor } from './building-identity';
import { buildingLabels, contextLabelForPolygon, landcoverLabel } from './labels';
import { regionScatterId, regionStyleRules } from './region';
import type { SemanticAdapterOptions, TileGeometry } from './semantic-adapter';
import { PROTOMAPS_TILE_BUFFER } from './tile-edges';

const HOMES = new Set([
  'house',
  'detached',
  'semidetached',
  'residential',
  'bungalow',
  'cabin',
  'terrace',
  'townhouse',
  'townhouses',
  'farmhouse',
]);
// Everything else is authoritative: forest/park already have scatter; parking, pitches,
// farmland, sand, barren ground, etc. must never be converted into an inferred yard.
const YARD_COVER = new Set(['residential', 'urban_area', 'grass', 'grassland', 'meadow']);
const INFILL_LABEL = 'home_canopy';

export function residentialTreePolygons(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  options: SemanticAdapterOptions,
): ScatterPolygon[] {
  const { atlas, pack } = options;
  if (atlas === undefined || tile.buildingsGeneralized) return [];
  const toMeters = (ring: readonly Vec2[]): Vec2[] =>
    ring.map(([x, z]) => [x * geom.size, z * geom.size]);
  const protectedLand = tile.landcover
    .filter(
      (feature) =>
        !landcoverLabel(feature)
          .split(/\s+/)
          .every((label) => YARD_COVER.has(label)),
    )
    .flatMap((feature) =>
      feature.polygons.map((polygon) => {
        const outer = toMeters(polygon.outer);
        return {
          bounds: polygonBounds({ outer }),
          polygon: [outer, ...(polygon.holes ?? []).map(toMeters)] as Polygon,
        };
      }),
    );
  const patches: Array<{ identity: string; polygons: ScatterPolygon[] }> = [];
  const seen = new Set<string>();
  const buffer = options.buffer ?? PROTOMAPS_TILE_BUFFER;
  for (const feature of tile.buildings) {
    if (
      feature.class === 'building_part' ||
      (feature.minHeight ?? 0) > 0 ||
      (feature.levels ?? 0) > 3 ||
      (feature.height ?? 0) > 14
    )
      continue;
    const labels = buildingLabels(feature);
    const explicitHome = HOMES.has(labels[0] ?? '');
    if (!explicitHome && !labels.every((label) => label === 'building')) continue;
    for (const [index, polygon] of feature.polygons.entries()) {
      const area = polygonArea(polygon) * geom.size ** 2;
      if (area < 45 || area > 700) continue;
      // A source cut at its buffer has no trustworthy complete home footprint/seed anchor.
      if (
        polygon.outer.some(
          ([x, z]) =>
            x <= -buffer + 1 / 8192 ||
            x >= 1 + buffer - 1 / 8192 ||
            z <= -buffer + 1 / 8192 ||
            z >= 1 + buffer - 1 / 8192,
        )
      )
        continue;
      const center = ringCentroid(polygon.outer);
      const context = contextLabelForPolygon(polygon, center, tile.landcover);
      if (!explicitHome && context !== undefined && !YARD_COVER.has(context)) continue;
      const region = options.regions?.resolve(
        geom.originX + center[0] * geom.size,
        geom.originZ + center[1] * geom.size,
      );
      const fill = region?.bindings.treeFillFactor ?? atlas.default.treeFillFactor ?? 0;
      if (fill <= 0) continue;
      const scatterId = regionScatterId(atlas, region) ?? pack.root.defaults.scatter;
      const scatter = scatterId === undefined ? undefined : pack.scatters[scatterId];
      // A custom scatter pack opts into inferred canopy with this dedicated label.
      const rule = scatter?.rules.find((entry) => entry.classes.includes(INFILL_LABEL));
      if (rule === undefined) continue;
      const outline = toMeters(polygon.outer);
      const identity = identityFor(feature, index, outline, geom);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const request: BuildingRequest = {
        identity,
        labels,
        outline,
        ...(context !== undefined ? { context } : {}),
        ...(feature.height !== undefined ? { height: feature.height } : {}),
        ...(feature.levels !== undefined ? { levels: feature.levels } : {}),
      };
      const analysis = analyzeFootprint(outline, (polygon.holes ?? []).map(toMeters));
      const styleId = selectStyle(
        [...regionStyleRules(atlas, region), ...pack.root.defaults.rules],
        buildingMetrics(request, analysis),
        pack.root.defaults.style,
        identity,
      ).style;
      const style = pack.archstyles[styleId];
      if (style === undefined) continue;
      const seed = aspectSeed(buildingSeedString(pack.root, style, identity), 'yard-trees');
      const [minX, minZ, maxX, maxZ] = polygonBounds({ outer: outline });
      const cx = center[0] * geom.size,
        cz = center[1] * geom.size;
      // A bounded, irregular patch reaches roughly 18–26 m beyond the home, not its whole block.
      const reach = 18 + unit01(seed, 0) * 8;
      const rx = Math.min(40, (maxX - minX) / 2 + reach);
      const rz = Math.min(40, (maxZ - minZ) / 2 + reach);
      const ring = Array.from({ length: 16 }, (_, i): Vec2 => {
        const angle = (i * dmath.TAU) / 16;
        const r = 0.85 + unit01(seed, i + 2) * 0.15;
        return [cx + dmath.cos(angle) * rx * r, cz + dmath.sin(angle) * rz * r];
      });
      const cuts = protectedLand
        .filter(
          ({ bounds: b }) =>
            b[0] <= cx + rx && b[2] >= cx - rx && b[1] <= cz + rz && b[3] >= cz - rz,
        )
        .map((entry) => entry.polygon);
      try {
        const shapes = cuts.length === 0 ? [[ring]] : polygonClipping.difference([ring], ...cuts);
        patches.push({
          identity,
          polygons: shapes.map(
            (shape): ScatterPolygon => ({
              label: INFILL_LABEL,
              ring: shape[0] as Vec2[],
              holes: shape.slice(1),
              density: fill * (0.7 + 0.3 * unit01(seed, 1)),
              seed,
            }),
          ),
        });
      } catch {
        // Malformed source landcover should suppress inferred planting, not overwrite it.
      }
    }
  }
  // One owner per shared grid cell even when yards overlap, independent of source order.
  patches.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
  return patches.flatMap((patch) => patch.polygons);
}
