/**
 * Region resolution in projected world meters. Atlas geometry is projected once (the only place
 * geospatial math runs); every lookup afterwards is a comparison, so per-building resolution in
 * a straddling tile costs nothing noticeable.
 *
 * The projection comes from `./projection` (dmath), not from the terrain package: the region a
 * building lands in picks its style, and that must not depend on how one engine rounds `tan`.
 */

import { pointInRing, type StyleRule, type Vec2 } from '@bendyline/molen-worldgen/kernel';
import { projectWgs84 } from './projection';
import type { AtlasRegion, RegionAtlasDoc } from './region-atlas-types';

export type WorldBounds = [minX: number, minZ: number, maxX: number, maxZ: number];

export interface ProjectedRegion {
  region: AtlasRegion;
  bounds: WorldBounds;
  polygons: Vec2[][];
  polygonBounds: WorldBounds[];
}

export interface RegionResolver {
  readonly atlas: RegionAtlasDoc;
  /** Highest-priority region containing a world point (document order breaks ties). */
  resolve(x: number, z: number): AtlasRegion | undefined;
  /** Regions whose extent intersects a world rectangle. */
  intersecting(bounds: WorldBounds): AtlasRegion[];
}

export interface RegionResolverOptions {
  /** cos(center latitude) factor the terrain package applies to Mercator meters. */
  metersPerUnit: number;
}

function project(lon: number, lat: number, metersPerUnit: number): Vec2 {
  const [x, z] = projectWgs84(lon, lat);
  return [x * metersPerUnit, z * metersPerUnit];
}

function projectRegion(region: AtlasRegion, metersPerUnit: number): ProjectedRegion {
  const polygons = (region.polygons ?? []).map((ring) =>
    ring.map(([lon, lat]) => project(lon, lat, metersPerUnit)),
  );
  let bounds: WorldBounds;
  if (region.bbox !== undefined) {
    const [minLon, minLat, maxLon, maxLat] = region.bbox;
    const west = project(minLon, maxLat, metersPerUnit);
    const east = project(maxLon, minLat, metersPerUnit);
    bounds = [west[0], west[1], east[0], east[1]];
  } else {
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const ring of polygons) {
      for (const [x, z] of ring) {
        minX = Math.min(minX, x);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxZ = Math.max(maxZ, z);
      }
    }
    bounds = [minX, minZ, maxX, maxZ];
  }
  const polygonBounds = polygons.map((ring): WorldBounds => {
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (const [x, z] of ring) {
      minX = Math.min(minX, x);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxZ = Math.max(maxZ, z);
    }
    return [minX, minZ, maxX, maxZ];
  });
  return { region, bounds, polygons, polygonBounds };
}

function inBounds(bounds: WorldBounds, x: number, z: number, pad = 0): boolean {
  return (
    x >= bounds[0] - pad && x <= bounds[2] + pad && z >= bounds[1] - pad && z <= bounds[3] + pad
  );
}

function boundsOverlap(a: WorldBounds, b: WorldBounds, pad = 0): boolean {
  return a[0] - pad <= b[2] && b[0] <= a[2] + pad && a[1] - pad <= b[3] && b[1] <= a[3] + pad;
}

function distanceSquared(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const length = dx * dx + dz * dz;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length));
  return (x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2;
}

export function createRegionResolver(
  atlas: RegionAtlasDoc,
  options: RegionResolverOptions,
): RegionResolver {
  const projected = atlas.regions.map((region) => projectRegion(region, options.metersPerUnit));
  const fallback = atlas.fallbackDistanceMeters ?? 0;
  return {
    atlas,
    resolve(x, z) {
      let best: ProjectedRegion | undefined;
      for (const entry of projected) {
        if (!inBounds(entry.bounds, x, z)) continue;
        if (
          entry.polygons.length > 0 &&
          !entry.polygons.some(
            (ring, i) =>
              inBounds(entry.polygonBounds[i] as WorldBounds, x, z) && pointInRing([x, z], ring),
          )
        ) {
          continue;
        }
        if (best === undefined || entry.region.priority > best.region.priority) best = entry;
      }
      // Exact containment always wins. Only fill small unclassified gaps left by coarse coasts.
      if (best === undefined && fallback > 0) {
        let nearest = fallback * fallback;
        for (const entry of projected) {
          if (!inBounds(entry.bounds, x, z, fallback)) continue;
          for (let index = 0; index < entry.polygons.length; index++) {
            if (!inBounds(entry.polygonBounds[index] as WorldBounds, x, z, fallback)) continue;
            const ring = entry.polygons[index] as Vec2[];
            for (let i = 0; i < ring.length; i++) {
              const distance = distanceSquared(
                x,
                z,
                ring[i] as Vec2,
                ring[(i + 1) % ring.length] as Vec2,
              );
              if (
                distance < nearest - 1e-6 ||
                (distance <= nearest + 1e-6 &&
                  (best === undefined || entry.region.priority > best.region.priority))
              ) {
                nearest = distance;
                best = entry;
              }
            }
          }
        }
      }
      return best?.region;
    },
    intersecting(bounds) {
      return projected
        .filter(
          (entry) =>
            boundsOverlap(entry.bounds, bounds, fallback) &&
            (entry.polygons.length === 0 ||
              entry.polygonBounds.some((ringBounds) =>
                boundsOverlap(ringBounds, bounds, fallback),
              )),
        )
        .map((entry) => entry.region);
    },
  };
}

/** The ordered rule chain for a region: region rules, region default, atlas rules, atlas default. */
export function regionStyleRules(
  atlas: RegionAtlasDoc,
  region: AtlasRegion | undefined,
): StyleRule[] {
  const rules: StyleRule[] = [];
  if (region !== undefined) {
    rules.push(...region.bindings.buildings);
    if (region.bindings.default !== undefined) rules.push({ style: region.bindings.default });
  }
  rules.push(...atlas.default.buildings);
  if (atlas.default.style !== undefined) rules.push({ style: atlas.default.style });
  return rules;
}

/** Scatter rule set id for a region, falling back to the atlas default (may be undefined). */
export function regionScatterId(
  atlas: RegionAtlasDoc,
  region: AtlasRegion | undefined,
): string | undefined {
  return region?.bindings.scatter ?? atlas.default.scatter;
}
