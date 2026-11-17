import type { TerrainPyramidStreamOptions } from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  type TerrainPackageDescriptor,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';

type Grading = NonNullable<TerrainPyramidStreamOptions['transformHeightfield']>;
export type EarthSiteGrades = readonly {
  anchor: [number, number];
  heading: number;
  bounds: [number, number, number, number];
  elevation: number;
  blend: number;
  repairBelow?: number;
}[];

export function readEarthSiteGrades(value: unknown): EarthSiteGrades {
  const document = value as { format?: unknown; sites?: unknown } | null;
  if (document?.format !== 'molen/earth-site-grades@1' || !Array.isArray(document.sites))
    throw new Error('Invalid Earth site grades document');
  return document.sites.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid Earth site grade');
    const { anchor, bounds, heading, elevation, blend, repairBelow } = value as Record<
      string,
      unknown
    >;
    if (
      !Array.isArray(anchor) ||
      anchor.length !== 2 ||
      !anchor.every(finite) ||
      !Array.isArray(bounds) ||
      bounds.length !== 4 ||
      !bounds.every(finite) ||
      !finite(heading) ||
      !finite(elevation) ||
      !finite(blend) ||
      blend <= 0 ||
      (repairBelow !== undefined && (!finite(repairBelow) || repairBelow > elevation))
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
      blend,
      ...(repairBelow === undefined ? {} : { repairBelow }),
    };
  });
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Grade a small, mapped site to a shared elevation, with a smooth tie to its provider's terrain. */
export function createEarthSiteGrading(
  grades: EarthSiteGrades | undefined,
  terrain: TerrainPackageDescriptor,
): Grading | undefined {
  if (
    terrain.coordinateSpace.kind !== 'geospatial' ||
    terrain.features?.profile !== 'protomaps-basemap@1' ||
    !grades?.length
  )
    return undefined;
  return ({ heightfield, pyramid, origin, tileSize, signal }) => {
    if (signal.aborted) return heightfield;
    const scale = pyramid.metersPerUnit ?? 1;
    const sites = grades.flatMap((site) => {
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
          elevation: site.elevation,
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
            elevation = site.elevation;
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
