/** Measured point objects precede inferred decoration; buffered points have one owning tile. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import type { TerrainPoiFeature, TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  hashString,
  type LandmarkLibrary,
  type ModelPlacementRequest,
  type ScatterExclusion,
  unit01,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import type { TileGeometry } from './semantic-adapter';

export function mappedPoiIdentity(poi: TerrainPoiFeature, geom: TileGeometry): string {
  return poi.id !== undefined
    ? `poi:${poi.id}`
    : 'poi:' +
        poi.class +
        ':' +
        Math.round(((geom.originX + poi.point[0] * geom.size) / geom.metersPerUnit) * 10) +
        ':' +
        Math.round(((geom.originZ + poi.point[1] * geom.size) / geom.metersPerUnit) * 10);
}
function heading(poi: TerrainPoiFeature, tile: TerrainSemanticTile): number {
  if (poi.heading !== undefined) return poi.heading;
  let best = Infinity,
    yaw = 0;
  for (const road of tile.transportation) {
    if (road.tunnel) continue;
    for (const line of road.lines)
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1] as Vec2,
          b = line[i] as Vec2,
          dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(
            1,
            ((poi.point[0] - a[0]) * dx + (poi.point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1),
          ),
        );
        const x = a[0] + t * dx - poi.point[0],
          z = a[1] + t * dz - poi.point[1],
          distance = Math.hypot(x, z);
        if (distance < best) {
          best = distance;
          yaw = dmath.atan2(x, z);
        }
      }
  }
  return yaw;
}
/**
 * Mapped trees (when `trees`) and street furniture. Furniture is placed only for landmark models
 * the `furniture` library holds; pass undefined for none.
 */
export function mappedPropRequests(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  trees: boolean,
  furniture: Pick<LandmarkLibrary, 'get'> | undefined,
): ModelPlacementRequest[] {
  if (geom.levelBelowMax !== 0) return [];
  const output: ModelPlacementRequest[] = [],
    seen = new Set<string>();
  for (const poi of tile.pois ?? []) {
    const [u, v] = poi.point;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const identity = mappedPoiIdentity(poi, geom);
    if (seen.has(identity)) continue;
    seen.add(identity);
    let model: string | undefined,
      scale: [number, number, number] = [1, 1, 1];
    let yaw = 0;
    if (poi.class === 'tree' && trees) {
      const needle = poi.leafType === 'needleleaved' || poi.subclass === 'conifer';
      model = needle ? 'builtin:tree.mapped.needleleaf' : 'builtin:tree.mapped.broadleaf';
      const h = Math.max(
        0.5,
        Math.min(
          80,
          poi.height ?? (needle ? 12 : 8) * (0.8 + unit01(hashString(identity), 0) * 0.4),
        ),
      );
      const diameter = Math.max(0.3, Math.min(40, poi.crownDiameter ?? h * (needle ? 0.45 : 0.65)));
      scale = [diameter, h, diameter];
      yaw = unit01(hashString(identity), 1) * dmath.TAU;
    } else if (furniture !== undefined) {
      model = (
        {
          street_lamp: 'builtin:street_lamp',
          bench: 'builtin:bench',
          bicycle_parking: 'builtin:bike_rack',
          charging_station: 'builtin:charger',
        } as Record<string, string>
      )[poi.class];
      if (!model) continue;
      if (
        poi.class === 'charging_station' &&
        /tesla|supercharger/i.test(poi.brand ?? poi.name ?? '')
      )
        model = 'builtin:charger.fast';
      if (furniture.get(model.slice('builtin:'.length)) === undefined) continue;
      if (poi.class === 'street_lamp' && poi.height !== undefined)
        scale = [1, Math.max(0.25, Math.min(4, poi.height / 7.2)), 1];
      if (poi.class === 'bicycle_parking' && poi.capacity !== undefined)
        scale = [Math.max(0.5, Math.min(3, poi.capacity / 6)), 1, 1];
      yaw = heading(poi, tile);
    }
    if (model) output.push({ identity, model, at: [u * geom.size, v * geom.size], yaw, scale });
  }
  return output;
}
/** Exclude around mapped crowns (including neighbors' buffered records) before scattering. */
export function mappedPropExclusions(tile: TerrainSemanticTile, size: number): ScatterExclusion[] {
  return (tile.pois ?? [])
    .filter((p) =>
      ['tree', 'street_lamp', 'bench', 'bicycle_parking', 'charging_station'].includes(p.class),
    )
    .map((p) => {
      const x = p.point[0] * size,
        z = p.point[1] * size;
      return {
        polyline: [
          [x - 0.01, z],
          [x + 0.01, z],
        ],
        width: p.class === 'tree' ? (p.crownDiameter ?? 4) + 1 : 2,
        radius: 0,
      };
    });
}
