/** Conservative map-to-model matching. Geographic identity and reusable categories are separate. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  pointInPolygon,
  type TerrainBuildingFeature,
  type TerrainPoiFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  wgs84ToWorld,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import type { TileGeometry } from './semantic-adapter';
import type { StructureMapRule, StructurePlacement } from './structure-index';
import { analyzeTileEdge, PROTOMAPS_TILE_BUFFER } from './tile-edges';

type Feature = TerrainBuildingFeature | TerrainPoiFeature;
type Frame = { point: TerrainSemanticPoint; heading?: number; width?: number; depth?: number };

function normalized(value: string): string {
  return value.trim().toLowerCase();
}
function owned(point: TerrainSemanticPoint): boolean {
  return point[0] >= 0 && point[0] < 1 && point[1] >= 0 && point[1] < 1;
}

/** Canonical +X axis follows the longest edge; rotation sign matches Three's +Y convention. */
function frameFor(feature: Feature, size: number, lengthAxis: 'x' | 'z' = 'x'): Frame | undefined {
  if ('point' in feature) return { point: feature.point, heading: feature.heading };
  const polygon = [...feature.polygons].sort((a, b) => area(b.outer) - area(a.outer))[0];
  if (!polygon) return undefined;
  // Truncated geometry cannot establish the center or axis of a whole model. Keep the
  // existing procedural pieces until a tile supplies the complete owned footprint.
  if (analyzeTileEdge(polygon, PROTOMAPS_TILE_BUFFER).mode !== 'whole') return undefined;
  const points = polygon.outer;
  let longest = 0,
    heading: number | undefined;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = dx * dx + dz * dz;
    if (length <= longest) continue;
    longest = length;
    // Opposite edges describe the same undirected axis. Canonicalize for tile-order stability.
    heading = -dmath.atan2(dz, dx) + (lengthAxis === 'z' ? Math.PI / 2 : 0);
    heading = ((heading % Math.PI) + Math.PI) % Math.PI;
  }
  if (heading === undefined) return undefined;
  heading = feature.heading ?? heading;
  const c = dmath.cos(heading),
    s = dmath.sin(heading);
  const local = points.map(([x, z]) => [c * x - s * z, s * x + c * z]);
  const minX = Math.min(...local.map((p) => p[0] ?? 0)),
    maxX = Math.max(...local.map((p) => p[0] ?? 0));
  const minZ = Math.min(...local.map((p) => p[1] ?? 0)),
    maxZ = Math.max(...local.map((p) => p[1] ?? 0));
  const x = (minX + maxX) / 2,
    z = (minZ + maxZ) / 2;
  const point: TerrainSemanticPoint = [c * x + s * z, -s * x + c * z];
  // Never place a whole replacement in the void of a U-shaped building or courtyard.
  if (!pointInPolygon(point, polygon)) return undefined;
  return { point, heading, width: (maxX - minX) * size, depth: (maxZ - minZ) * size };
}

function area(points: TerrainSemanticPoint[]): number {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (a && b) result += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(result);
}

function anchorFor(point: TerrainSemanticPoint, geometry: TileGeometry): [number, number] {
  return worldToWgs84(
    geometry.metersPerUnit,
    geometry.originX + point[0] * geometry.size,
    geometry.originZ + point[1] * geometry.size,
  );
}

function matches(feature: Feature, rule: StructureMapRule): boolean {
  const { classes, subclasses, tags } = rule.match;
  if (classes && !classes.some((value) => normalized(value) === normalized(feature.class ?? '')))
    return false;
  if (
    subclasses &&
    !subclasses.some((value) => normalized(value) === normalized(feature.subclass ?? ''))
  )
    return false;
  return Object.entries(tags ?? {}).every(([key, values]) =>
    values.some((value) => normalized(value) === normalized(feature.tags?.[key] ?? '')),
  );
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

/** Resolve a named landmark only against its explicit identity, never category similarity. */
export function orientMappedStructure(
  entry: StructurePlacement,
  tile: TerrainSemanticTile,
  geometry: TileGeometry,
): StructurePlacement | undefined {
  if (entry.orientation !== 'mapped') return entry;
  const identity = entry.mapIdentity;
  if (!identity) return undefined;
  const [projectedX, z] = wgs84ToWorld(geometry.metersPerUnit, ...entry.anchor);
  const worldWidth = 2 * Math.PI * 6378137 * geometry.metersPerUnit;
  const x =
    projectedX +
    Math.round((geometry.originX + geometry.size / 2 - projectedX) / worldWidth) * worldWidth;
  const origin: TerrainSemanticPoint = [
    (x - geometry.originX) / geometry.size,
    (z - geometry.originZ) / geometry.size,
  ];
  const maxDistance = identity.maxDistance ?? 150;
  const exact = (feature: { wikidata?: string; name?: string }): boolean =>
    identity.wikidata !== undefined
      ? feature.wikidata === identity.wikidata
      : identity.names?.some((name) => normalized(name) === normalized(feature.name ?? '')) ===
        true;
  const candidates: Array<{ frame: Frame; distance: number; road?: boolean }> = [];
  for (const feature of [
    ...(tile.buildingsGeneralized ? [] : tile.buildings),
    ...(tile.pois ?? []),
  ]) {
    if (!exact(feature)) continue;
    const frame = frameFor(feature, geometry.size, entry.lengthAxis);
    if (!frame || frame.heading === undefined || !owned(frame.point)) continue;
    const distance =
      Math.hypot(frame.point[0] - origin[0], frame.point[1] - origin[1]) * geometry.size;
    if (distance <= maxDistance) candidates.push({ frame, distance });
  }
  for (const road of tile.transportation) {
    if (!road.bridge || road.tunnel || !exact(road)) continue;
    for (const line of road.lines)
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1],
          b = line[i];
        if (!a || !b) continue;
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          squared = dx * dx + dz * dz;
        if (squared === 0) continue;
        const t = Math.max(
          0,
          Math.min(1, ((origin[0] - a[0]) * dx + (origin[1] - a[1]) * dz) / squared),
        );
        const distance =
          Math.hypot(origin[0] - a[0] - dx * t, origin[1] - a[1] - dz * t) * geometry.size;
        if (distance <= maxDistance)
          candidates.push({
            distance,
            road: true,
            frame: {
              point: origin,
              heading: -dmath.atan2(dz, dx) + (entry.lengthAxis === 'z' ? Math.PI / 2 : 0),
            },
          });
      }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const match = candidates[0];
  if (!match) return undefined;
  if (
    !identity.wikidata &&
    candidates.some(
      (other) =>
        !other.road &&
        !match.road &&
        Math.hypot(
          other.frame.point[0] - match.frame.point[0],
          other.frame.point[1] - match.frame.point[1],
        ) *
          geometry.size >
          10,
    )
  )
    return undefined;
  return {
    ...entry,
    heading: match.frame.heading,
    ...(match.road ? {} : { anchor: anchorFor(match.frame.point, geometry) }),
  };
}

/** Emit at most 64 category structures per resident tile. Rule order defines preference. */
export function matchMapStructures(
  tile: TerrainSemanticTile,
  geometry: TileGeometry,
  rules: readonly StructureMapRule[],
  geographic: readonly StructurePlacement[] = [],
  maxPerTile = 64,
): StructurePlacement[] {
  const result: StructurePlacement[] = [];
  const counts = new Map<string, number>();
  const occupied = geographic.map((entry) => wgs84ToWorld(geometry.metersPerUnit, ...entry.anchor));
  const features: Feature[] = [
    ...(tile.buildingsGeneralized ? [] : tile.buildings),
    ...(tile.pois ?? []),
  ];
  for (const feature of features) {
    if (result.length >= Math.max(0, Math.min(64, maxPerTile))) break;
    for (const rule of rules) {
      if (
        geometry.level < (rule.minLevel ?? 14) ||
        (counts.get(rule.id) ?? 0) >= (rule.maxPerTile ?? 16) ||
        !matches(feature, rule)
      )
        continue;
      const frame = frameFor(feature, geometry.size, rule.lengthAxis);
      if (!frame || !owned(frame.point)) continue;
      const anchor = anchorFor(frame.point, geometry);
      const world = wgs84ToWorld(geometry.metersPerUnit, ...anchor);
      if (
        occupied.some(
          ([x, z]) =>
            Math.hypot(world[0] - x, world[1] - z) <
            Math.max(5, Math.min(rule.dimensions[0], rule.dimensions[2]) / 2),
        )
      )
        break;
      const heading = rule.orientation === 'north' ? Math.PI : (frame.heading ?? Math.PI);
      const scale: [number, number, number] = [1, 1, 1];
      if (rule.fit === 'footprint' && frame.width && frame.depth) {
        scale[0] = Math.max(0.2, Math.min(5, frame.width / rule.dimensions[0]));
        scale[2] = Math.max(0.2, Math.min(5, frame.depth / rule.dimensions[2]));
      }
      if (feature.height) {
        scale[1] = Math.max(0.2, Math.min(5, feature.height / rule.dimensions[1]));
        // Preserve rotor circles, arches and other authored proportions for native models.
        if (rule.fit !== 'footprint') scale[0] = scale[2] = scale[1];
      }
      const key =
        feature.id === undefined
          ? `${anchor[0].toFixed(7)},${anchor[1].toFixed(7)}`
          : `${'point' in feature ? 'poi' : 'building'}:${feature.id}`;
      result.push({
        id: `map.${rule.id}.${stableId(key)}`,
        title: feature.name ?? rule.title,
        asset: rule.asset,
        anchor,
        heading,
        scale,
        datum: 'terrain',
        status: 'preview',
        replaceFootprint: 'polygons' in feature || rule.replaceFootprint === true,
        minLevel: rule.minLevel ?? 14,
        source: rule.source,
      });
      occupied.push(world);
      counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1);
      break;
    }
  }
  return result;
}
