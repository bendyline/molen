import type { TerrainPyramidStreamOptions } from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  type TerrainPackageDescriptor,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import {
  isStructureViewingDateInRange,
  isStructureViewingDateRange,
} from '@bendyline/molen-worldgen-earth/kernel';

type Grading = NonNullable<TerrainPyramidStreamOptions['transformHeightfield']>;
export type EarthSiteGrades = readonly {
  anchor: [number, number];
  heading: number;
  bounds: [number, number, number, number];
  elevation: number;
  /** Optional station/elevation controls along the site's local +Z axis in metres. */
  elevationProfile?: [station: number, elevation: number][];
  /** Regular absolute elevation samples over bounds, ordered by increasing local Z then X. */
  elevationGrid?: number[][];
  blend: number;
  repairBelow?: number;
  validFrom?: string;
  validUntil?: string;
}[];

export function readEarthSiteGrades(value: unknown): EarthSiteGrades {
  const document = value as { format?: unknown; sites?: unknown } | null;
  if (document?.format !== 'molen/earth-site-grades@1' || !Array.isArray(document.sites))
    throw new Error('Invalid Earth site grades document');
  return document.sites.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid Earth site grade');
    const {
      anchor,
      bounds,
      heading,
      elevation,
      elevationProfile,
      elevationGrid,
      blend,
      repairBelow,
      validFrom,
      validUntil,
    } = value as Record<string, unknown>;
    if (
      !Array.isArray(anchor) ||
      anchor.length !== 2 ||
      !anchor.every(finite) ||
      !Array.isArray(bounds) ||
      bounds.length !== 4 ||
      !bounds.every(finite) ||
      !finite(heading) ||
      !finite(elevation) ||
      (elevationProfile !== undefined && !validElevationProfile(elevationProfile)) ||
      (elevationGrid !== undefined &&
        (elevationProfile !== undefined || !validElevationGrid(elevationGrid))) ||
      !finite(blend) ||
      blend <= 0 ||
      ((validFrom !== undefined || validUntil !== undefined) &&
        !isStructureViewingDateRange(validFrom, validUntil)) ||
      (repairBelow !== undefined &&
        (!finite(repairBelow) ||
          repairBelow > elevation ||
          elevationProfile?.some(([, height]) => height < repairBelow) ||
          elevationGrid?.some((row) => row.some((height) => height < repairBelow))))
    )
      throw new Error('Invalid Earth site grade');
    const center = anchor as [number, number];
    const extent = bounds as [number, number, number, number];
    if (
      Math.abs(center[0]) > 180 ||
      Math.abs(center[1]) > 85 ||
      extent[0] >= extent[2] ||
      extent[1] >= extent[3]
    )
      throw new Error('Invalid Earth site bounds');
    return {
      anchor: center,
      bounds: extent,
      heading,
      elevation,
      ...(elevationProfile !== undefined ? { elevationProfile } : {}),
      ...(elevationGrid !== undefined ? { elevationGrid } : {}),
      blend,
      ...(repairBelow === undefined ? {} : { repairBelow }),
      ...(typeof validFrom === 'string' && typeof validUntil === 'string'
        ? { validFrom, validUntil }
        : {}),
    };
  });
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function validElevationGrid(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 129) return false;
  const cols = Array.isArray(value[0]) ? value[0].length : 0;
  return (
    cols >= 2 &&
    cols <= 129 &&
    value.every((row) => {
      if (!Array.isArray(row) || row.length !== cols) return false;
      for (const height of row) if (!finite(height)) return false;
      return true;
    })
  );
}

function validElevationProfile(value: unknown): value is [number, number][] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 32 &&
    value.every(
      (point, i) =>
        Array.isArray(point) &&
        point.length === 2 &&
        finite(point[0]) &&
        finite(point[1]) &&
        (i === 0 || point[0] > (value[i - 1]?.[0] ?? Infinity)),
    )
  );
}

function profileElevation(
  profile: readonly [number, number][],
  station: number,
  fallback: number,
): number {
  const upper = profile.findIndex(([z]) => station < z);
  const next = profile[upper];
  if (!next) return profile.at(-1)?.[1] ?? fallback;
  const previous = profile[upper - 1];
  if (!previous) return next[1];
  const [start, low] = previous;
  const [end, high] = next;
  return low + ((station - start) / (end - start)) * (high - low);
}

/** Grade a small, mapped site with a smooth tie to its provider's terrain. */
export function createEarthSiteGrading(
  grades: EarthSiteGrades | undefined,
  terrain: TerrainPackageDescriptor,
  viewingDate?: string,
): Grading | undefined {
  const activeGrades = grades?.filter(
    ({ validFrom, validUntil }) =>
      (validFrom === undefined && validUntil === undefined) ||
      isStructureViewingDateInRange(viewingDate, validFrom, validUntil),
  );
  if (
    terrain.coordinateSpace.kind !== 'geospatial' ||
    terrain.features?.profile !== 'protomaps-basemap@1' ||
    !activeGrades?.length
  )
    return undefined;
  const prepared = activeGrades.map((site) => {
    if (!site.elevationGrid) return { site };
    const [west, north, east, south] = site.bounds;
    const heights = site.elevationGrid.flat();
    const min = Math.min(...heights);
    const max = Math.max(Math.max(...heights), min + 1);
    const field = new Heightfield(
      Float32Array.from(heights, (y) => (y - min) / (max - min)),
      heights.length / site.elevationGrid.length,
      site.elevationGrid.length,
      { origin: [west, north], worldSize: [east - west, south - north], height: { min, max } },
    );
    return { site, field };
  });
  return ({ heightfield, pyramid, origin, tileSize, signal }) => {
    if (signal.aborted) return heightfield;
    const scale = pyramid.metersPerUnit ?? 1;
    const sites = prepared.flatMap(({ site, field }) => {
      const factor = scale / Math.cos((site.anchor[1] * Math.PI) / 180);
      const blend = site.blend * factor;
      // A coarse grid can spread one corrected sample beyond the site's shoulder.
      if (Math.max(...heightfield.cellSize) > blend / 2) return [];
      const [ax, az] = wgs84ToWorld(scale, ...site.anchor);
      const [west, north, east, south] = site.bounds.map((v) => v * factor) as [
        number,
        number,
        number,
        number,
      ];
      const radius =
        Math.hypot(
          Math.max(Math.abs(west), Math.abs(east)),
          Math.max(Math.abs(north), Math.abs(south)),
        ) + blend;
      if (
        ax + radius < origin[0] ||
        ax - radius > origin[0] + tileSize ||
        az + radius < origin[1] ||
        az - radius > origin[1] + tileSize
      )
        return [];
      return [
        {
          ax,
          az,
          co: Math.cos(site.heading),
          si: Math.sin(site.heading),
          west,
          north,
          east,
          south,
          blend,
          field,
          factor,
          elevation: site.elevation,
          elevationProfile: site.elevationProfile?.map(([z, y]): [number, number] => [
            z * factor,
            y,
          ]),
          repairBelow: site.repairBelow,
        },
      ];
    });
    if (!sites.length) return heightfield;
    const { min, max } = heightfield.heightRange;
    let grid: Float32Array | undefined;
    for (let row = 0; row < heightfield.rows; row++) {
      const z = origin[1] + row * heightfield.cellSize[1];
      for (let col = 0; col < heightfield.cols; col++) {
        const x = origin[0] + col * heightfield.cellSize[0];
        let weight = 0;
        let elevation = 0;
        for (const site of sites) {
          const dx = x - site.ax;
          const dz = z - site.az;
          const u = site.co * dx - site.si * dz;
          const v = site.si * dx + site.co * dz;
          const distance = Math.hypot(
            Math.max(0, site.west - u, u - site.east),
            Math.max(0, site.north - v, v - site.south),
          );
          const t = Math.min(1, distance / site.blend);
          const influence = 1 - t * t * (3 - 2 * t);
          // Repairs target void pixels in a retained field and preserve neighboring slopes.
          if (
            site.repairBelow !== undefined &&
            influence > weight &&
            heightfield.sampleHeight(x, z) >= site.repairBelow
          )
            continue;
          if (influence > weight) {
            weight = influence;
            elevation = site.field
              ? site.field.sampleHeight(u / site.factor, v / site.factor)
              : site.elevationProfile
                ? profileElevation(site.elevationProfile, v, site.elevation)
                : site.elevation;
          }
        }
        if (weight === 0) continue;
        grid ??= heightfield.copySamples();
        const i = row * heightfield.cols + col;
        grid[i] = (grid[i] as number) * (1 - weight) + ((elevation - min) / (max - min)) * weight;
      }
    }
    return grid
      ? new Heightfield(grid, heightfield.cols, heightfield.rows, {
          origin: heightfield.origin,
          worldSize: heightfield.worldSize,
          height: heightfield.heightRange,
          validated: true,
        })
      : heightfield;
  };
}
