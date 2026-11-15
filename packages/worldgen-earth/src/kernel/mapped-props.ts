/** Measured point objects precede inferred decoration; buffered points have one owning tile. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  isAeroway,
  type TerrainPoiFeature,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  transportKind,
} from '@bendyline/molen-terrain/kernel';
import {
  hashString,
  type LandmarkLibrary,
  type ModelPlacementRequest,
  type PlantPreset,
  type ScatterExclusion,
  unit01,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import {
  isMapOverrideFeature,
  MAP_OVERRIDE_COLOR_TAG,
  MAP_OVERRIDE_MODEL_TAG,
  MAP_OVERRIDE_PROP_CLASS,
  MAP_OVERRIDE_SCALE_TAG,
} from './map-override-tags';
import type { RegionalEnvironment } from './regional-environment';
import type { TileGeometry } from './semantic-adapter';

/** Mapped identity outranks habitat: planted and introduced trees remain where the source puts them. */
function mappedPlant(
  poi: TerrainPoiFeature,
  identity: string,
  x: number,
  z: number,
  environment?: RegionalEnvironment,
): PlantPreset | undefined {
  if (environment === undefined) return undefined;
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const name of [poi.species, poi.genus, poi.species?.split(' ')[0]]) {
    if (!name) continue;
    const exact = environment.library.taxa.get(normalize(name));
    if (exact !== undefined) return exact;
  }
  const scatter = environment.scatterAt(x, z);
  const rule = scatter?.rules.find((entry) => entry.classes.includes('park'));
  const candidates = (rule?.populations ?? [])
    .flatMap((population) => {
      if (!population.variants) return [population];
      const total = population.variants.reduce((sum, v) => sum + v.weight, 0);
      return population.variants.map((v) => ({
        ...population,
        model: v.model,
        weight: (population.weight * v.weight) / total,
      }));
    })
    .flatMap((population) => {
      const plant = environment.library.plants[population.model];
      if (
        plant === undefined ||
        plant.height < 2 ||
        !['broadleaf', 'conifer', 'palm'].includes(plant.family)
      )
        return [];
      const leafType =
        plant.leafType ?? (plant.family === 'conifer' ? 'needleleaved' : 'broadleaved');
      if (
        (poi.leafType === 'needleleaved' || poi.subclass === 'conifer') &&
        leafType !== 'needleleaved'
      )
        return [];
      if (poi.leafType === 'broadleaved' && leafType !== 'broadleaved') return [];
      return [{ plant, weight: population.weight }];
    })
    .sort((a, b) => (a.plant.id < b.plant.id ? -1 : a.plant.id > b.plant.id ? 1 : 0));
  let target =
    unit01(hashString(`mapped-tree|${identity}`), 0) *
    candidates.reduce((sum, item) => sum + item.weight, 0);
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target < 0) return candidate.plant;
  }
  return undefined;
}

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
/** The nearest line of an accepted road: its feature, the yaw facing it, and the distance (tile units). */
function nearestRoad(
  poi: TerrainPoiFeature,
  tile: TerrainSemanticTile,
  accept: (road: TerrainTransportationFeature) => boolean = () => true,
): { road: TerrainTransportationFeature; yaw: number; distance: number } | undefined {
  let best = Infinity,
    yaw = 0,
    nearest: TerrainTransportationFeature | undefined;
  for (const road of tile.transportation) {
    if (road.tunnel || !accept(road)) continue;
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
          nearest = road;
        }
      }
  }
  return nearest === undefined ? undefined : { road: nearest, yaw, distance: best };
}
function heading(poi: TerrainPoiFeature, tile: TerrainSemanticTile): number {
  return poi.heading ?? nearestRoad(poi, tile)?.yaw ?? 0;
}

/** A road cars use: not a footway, sidewalk, rail line, platform or airside pavement. */
function carriageway(road: TerrainTransportationFeature): boolean {
  const kind = transportKind(road);
  return (
    (kind === 'street' || kind === 'service' || kind === 'motorway') &&
    !isAeroway(road) &&
    !/platform|bus_stop|ferry|aerialway|pier/.test(`${road.class} ${road.subclass ?? ''}`)
  );
}
/** A wide or major road, which keeps the mast-arm lamp reaching over its traffic. */
function arterial(road: TerrainTransportationFeature): boolean {
  const kind = transportKind(road);
  if (kind === 'motorway') return true;
  return (
    kind === 'street' &&
    (/^(trunk|primary)/.test(road.subclass ?? road.class) || (road.lanes ?? 0) >= 4)
  );
}
/** How far (meters) from a street's centre line a lamp still lights that street. */
const LAMP_REACH = 18;
/** Heights of the two lamp models (the arm's pole, the post's lantern cap), which a mapped `height` scales. */
const ARM_LAMP_HEIGHT = 7.2;
const POST_LAMP_HEIGHT = 4.8;

/**
 * Where a mapped lamp faces and whether it is an arterial's mast arm. The arm reaches over the
 * nearest street in reach, even where a sidewalk mapped as its own line runs closer: a lamp in
 * the planting strip has that sidewalk behind it. With no street in reach (a park, a plaza) it
 * faces the nearest path.
 */
function lampSite(
  poi: TerrainPoiFeature,
  tile: TerrainSemanticTile,
  geom: TileGeometry,
): { yaw: number; arterial: boolean } {
  const street = nearestRoad(poi, tile, carriageway);
  const served =
    street !== undefined && street.distance * geom.size * geom.metersPerUnit <= LAMP_REACH
      ? street
      : undefined;
  return {
    yaw: poi.heading ?? served?.yaw ?? heading(poi, tile),
    arterial: served !== undefined && arterial(served.road),
  };
}
/** How far below the finest level a map override's props are still placed. */
const OVERRIDE_PROP_LEVELS = 1;

/**
 * Mapped trees (when `trees`) and street furniture. Furniture is placed only for landmark models
 * the `furniture` library holds; pass undefined for none. Mapped objects are placed on the finest
 * level only; a host's (map overrides) one level coarser too, as a place built on purpose should
 * not lose its trees and lamps the moment its tile coarsens.
 */
export function mappedPropRequests(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  trees: boolean,
  furniture: Pick<LandmarkLibrary, 'get'> | undefined,
  environment?: RegionalEnvironment,
): ModelPlacementRequest[] {
  if (geom.levelBelowMax > OVERRIDE_PROP_LEVELS) return [];
  const output: ModelPlacementRequest[] = [],
    seen = new Set<string>();
  for (const poi of tile.pois ?? []) {
    if (geom.levelBelowMax !== 0 && !isMapOverrideFeature(poi)) continue;
    const [u, v] = poi.point;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const identity = mappedPoiIdentity(poi, geom);
    if (seen.has(identity)) continue;
    seen.add(identity);
    let model: string | undefined,
      scale: [number, number, number] = [1, 1, 1];
    let yaw = 0;
    if (poi.class === 'tree' && trees) {
      const plant = mappedPlant(
        poi,
        identity,
        geom.originX + u * geom.size,
        geom.originZ + v * geom.size,
        environment,
      );
      const needle = poi.leafType === 'needleleaved' || poi.subclass === 'conifer';
      model =
        plant === undefined
          ? needle
            ? 'builtin:tree.mapped.needleleaf'
            : 'builtin:tree.mapped.broadleaf'
          : (environment?.modelAt(
              plant.id,
              geom.originX + u * geom.size,
              geom.originZ + v * geom.size,
            ) ?? plant.id);
      const h = Math.max(
        0.5,
        Math.min(
          80,
          poi.height ??
            (plant?.height ?? (needle ? 12 : 8)) * (0.8 + unit01(hashString(identity), 0) * 0.4),
        ),
      );
      const diameter = Math.max(
        0.3,
        Math.min(
          40,
          poi.crownDiameter ?? h * (plant ? plant.width / plant.height : needle ? 0.45 : 0.65),
        ),
      );
      scale = plant
        ? [diameter / plant.width, h / plant.height, diameter / plant.width]
        : [diameter, h, diameter];
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
      // Arterials keep the mast arm; other streets, paths and plazas get a post-top lamp (where
      // the library holds one).
      const lamp = poi.class === 'street_lamp' ? lampSite(poi, tile, geom) : undefined;
      if (lamp && !lamp.arterial && furniture.get('street_lamp.post') !== undefined)
        model = 'builtin:street_lamp.post';
      if (furniture.get(model.slice('builtin:'.length)) === undefined) continue;
      if (lamp && poi.height !== undefined) {
        const natural = model === 'builtin:street_lamp.post' ? POST_LAMP_HEIGHT : ARM_LAMP_HEIGHT;
        scale = [1, Math.max(0.25, Math.min(4, poi.height / natural)), 1];
      }
      if (poi.class === 'bicycle_parking' && poi.capacity !== undefined)
        scale = [Math.max(0.5, Math.min(3, poi.capacity / 6)), 1, 1];
      yaw = lamp?.yaw ?? heading(poi, tile);
    }
    if (model) output.push({ identity, model, at: [u * geom.size, v * geom.size], yaw, scale });
  }
  return output;
}

function scaleTag(value: string | undefined): [number, number, number] {
  const parts = value?.split(',').map(Number) ?? [];
  return parts.length === 3 && parts.every((part) => Number.isFinite(part) && part > 0)
    ? (parts as [number, number, number])
    : [1, 1, 1];
}

/** `#rrggbb` as sRGB-encoded components in 0..1, as an instance tint takes it. */
function colorTag(value: string | undefined): [number, number, number] | undefined {
  if (value === undefined || !/^#[0-9a-fA-F]{6}$/.test(value)) return undefined;
  const rgb = Number.parseInt(value.slice(1), 16);
  return [((rgb >> 16) & 0xff) / 255, ((rgb >> 8) & 0xff) / 255, (rgb & 0xff) / 255];
}

/**
 * The models a map override places by ref: its `MAP_OVERRIDE_PROP_CLASS` POIs, with the model,
 * scale and tint their tags carry. Each tile the point reaches holds the POI, and the one whose
 * unit square holds it places it, on the same levels as a host's other props.
 */
export function overridePropRequests(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
): ModelPlacementRequest[] {
  if (geom.levelBelowMax > OVERRIDE_PROP_LEVELS) return [];
  const output: ModelPlacementRequest[] = [],
    seen = new Set<string>();
  for (const poi of tile.pois ?? []) {
    if (poi.class !== MAP_OVERRIDE_PROP_CLASS) continue;
    const model = poi.tags?.[MAP_OVERRIDE_MODEL_TAG];
    const [u, v] = poi.point;
    if (!model || u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const identity = mappedPoiIdentity(poi, geom);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const color = colorTag(poi.tags?.[MAP_OVERRIDE_COLOR_TAG]);
    output.push({
      identity,
      model,
      at: [u * geom.size, v * geom.size],
      yaw: poi.heading ?? 0,
      scale: scaleTag(poi.tags?.[MAP_OVERRIDE_SCALE_TAG]),
      ...(color !== undefined ? { color } : {}),
    });
  }
  return output;
}

/**
 * Exclude around mapped crowns (including neighbors' buffered records) before scattering. With
 * `hostOnly`, around a host's (map overrides) alone: the ones a coarser tile still places.
 */
export function mappedPropExclusions(
  tile: TerrainSemanticTile,
  size: number,
  hostOnly = false,
): ScatterExclusion[] {
  return (tile.pois ?? [])
    .filter(
      (p) =>
        [
          'tree',
          'street_lamp',
          'bench',
          'bicycle_parking',
          'charging_station',
          MAP_OVERRIDE_PROP_CLASS,
        ].includes(p.class) &&
        (!hostOnly || isMapOverrideFeature(p)),
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
