/** Compact, independently versioned ecological geography. No network or renderer dependencies. */
import { projectWgs84 } from './projection';

export interface Ecoregion {
  /** Stable identifier in the source dataset; never an array offset. */
  id: number;
  name: string;
  /** RESOLVE terrestrial biome number (1..14); 0 means rock/ice or unclassified. */
  biome: number;
  realm: string;
}

export interface EcologyAtlasDoc {
  format: 'molen/ecology-atlas@1';
  id: string;
  version: number;
  title: string;
  /** Equal-angle global grid. North-to-south rows, west-to-east columns. */
  cellDegrees: number;
  regions: Ecoregion[];
  /** Each row alternates run length and region index + 1; zero means no source coverage. */
  rows: number[][];
  source: {
    title: string;
    url: string;
    license: string;
    citation: string;
    sha256: string;
    /** The source's habitat extent, not a claim of present-day vegetation or animal presence. */
    interpretation: string;
  };
}

export interface EcologyCell {
  column: number;
  row: number;
  /** [west, south, east, north], WGS84 degrees. */
  bounds: [number, number, number, number];
  region: Ecoregion | undefined;
}

export interface EcologyArea {
  /** Projected world rectangle; cells of the same region are merged along a row. */
  bounds: [number, number, number, number];
  region: Ecoregion | undefined;
}

export interface EcologyResolver {
  readonly atlas: EcologyAtlasDoc;
  /** Geographic lookup. Longitude wraps; invalid latitude or non-finite coordinates return nothing. */
  at(longitude: number, latitude: number): Ecoregion | undefined;
  cellAt(longitude: number, latitude: number): EcologyCell | undefined;
  /** Projected world-meter lookup in the same frame as terrain and the architectural atlas. */
  resolve(x: number, z: number): Ecoregion | undefined;
  /** Distinct cells' regions in a projected rectangle; includes undefined for uncovered ground. */
  intersecting(bounds: [number, number, number, number]): Array<Ecoregion | undefined>;
  /** Bounded palette geometry. Undefined when a very coarse request exceeds maxAreas. */
  areas(bounds: [number, number, number, number], maxAreas?: number): EcologyArea[] | undefined;
}

/** Check structural bounds before indexing or allocating any lookup tables. */
export function checkEcologyAtlas(doc: EcologyAtlasDoc): void {
  const step = doc.cellDegrees;
  const width = 360 / step;
  const height = 180 / step;
  if (
    doc.format !== 'molen/ecology-atlas@1' ||
    !Number.isFinite(step) ||
    step < 0.05 ||
    step > 10 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    doc.rows.length !== height ||
    doc.regions.length > 65534
  )
    throw new Error('Invalid ecology atlas grid dimensions');
  const ids = new Set<number>();
  for (const region of doc.regions) {
    if (
      !Number.isSafeInteger(region.id) ||
      region.id < 0 ||
      ids.has(region.id) ||
      !Number.isInteger(region.biome) ||
      region.biome < 0 ||
      region.biome > 14 ||
      !region.name ||
      !region.realm
    )
      throw new Error('Invalid or duplicate ecology region');
    ids.add(region.id);
  }
  for (const row of doc.rows) {
    if (row.length === 0 || row.length % 2 !== 0) throw new Error('Invalid ecology row pairs');
    let sum = 0;
    for (let i = 0; i < row.length; i += 2) {
      const count = row[i] as number;
      const index = row[i + 1] as number;
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        !Number.isInteger(index) ||
        index < 0 ||
        index > doc.regions.length
      )
        throw new Error('Invalid ecology row run');
      sum += count;
    }
    if (sum !== width) throw new Error('Ecology row does not cover the globe');
  }
}

/**
 * Retains compressed rows and indexes run endpoints. A global grid never expands into millions
 * of JS numbers. Mercator latitude boundaries are projected once, not once per plant.
 */
export function createEcologyResolver(atlas: EcologyAtlasDoc, metersPerUnit = 1): EcologyResolver {
  checkEcologyAtlas(atlas);
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0)
    throw new Error('Ecology metersPerUnit must be positive and finite');
  const step = atlas.cellDegrees;
  const width = 360 / step;
  const height = atlas.rows.length;
  const endpoints = atlas.rows.map((runs) => {
    const ends = new Uint16Array(runs.length / 2);
    let total = 0;
    for (let i = 0; i < ends.length; i++) {
      total += runs[i * 2] as number;
      ends[i] = total;
    }
    return ends;
  });
  const northings = Array.from(
    { length: height + 1 },
    (_, row) => projectWgs84(0, 90 - row * step)[1] * metersPerUnit,
  );
  const halfWorld = projectWgs84(180, 0)[0] * metersPerUnit;
  const regionAt = (column: number, row: number): Ecoregion | undefined => {
    const ends = endpoints[row];
    if (ends === undefined) return undefined;
    let low = 0,
      high = ends.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((ends[middle] as number) <= column) low = middle + 1;
      else high = middle;
    }
    return atlas.regions[((atlas.rows[row] as number[])[low * 2 + 1] as number) - 1];
  };
  const columnAt = (longitude: number): number =>
    Math.min(width - 1, Math.floor(((((longitude + 180) % 360) + 360) % 360) / step));
  const rowAt = (z: number): number => {
    let low = 0,
      high = height;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((northings[middle + 1] as number) <= z) low = middle + 1;
      else high = middle;
    }
    return Math.min(height - 1, low);
  };
  const cellAt = (longitude: number, latitude: number): EcologyCell | undefined => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 90)
      return undefined;
    const column = columnAt(longitude);
    const row = Math.min(height - 1, Math.floor((90 - latitude) / step));
    return {
      column,
      row,
      bounds: [
        -180 + column * step,
        90 - (row + 1) * step,
        -180 + (column + 1) * step,
        90 - row * step,
      ],
      region: regionAt(column, row),
    };
  };
  return {
    atlas,
    at: (longitude, latitude) => cellAt(longitude, latitude)?.region,
    cellAt,
    resolve(x, z) {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(z) ||
        z < (northings[0] as number) ||
        z > (northings[height] as number)
      )
        return undefined;
      return regionAt(columnAt((x / halfWorld) * 180), rowAt(z));
    },
    intersecting(bounds) {
      if (!bounds.every(Number.isFinite) || bounds[0] > bounds[2] || bounds[1] > bounds[3])
        return [];
      const found = new Map<number, Ecoregion | undefined>();
      if (bounds[1] < (northings[0] as number) || bounds[3] > (northings[height] as number))
        found.set(-1, undefined);
      if (bounds[3] < (northings[0] as number) || bounds[1] > (northings[height] as number))
        return [undefined];
      const first = columnAt((bounds[0] / halfWorld) * 180);
      const last = columnAt((bounds[2] / halfWorld) * 180);
      const ranges: Array<[number, number]> =
        bounds[2] - bounds[0] >= halfWorld * 2
          ? [[0, width - 1]]
          : first <= last
            ? [[first, last]]
            : [
                [first, width - 1],
                [0, last],
              ];
      for (let row = rowAt(bounds[1]); row <= rowAt(bounds[3]); row++) {
        const ends = endpoints[row] as Uint16Array;
        const runs = atlas.rows[row] as number[];
        let start = 0;
        for (let i = 0; i < ends.length; i++) {
          const end = ends[i] as number;
          if (ranges.some(([lo, hi]) => start <= hi && end > lo)) {
            const index = (runs[i * 2 + 1] as number) - 1;
            found.set(index, atlas.regions[index]);
          }
          start = end;
        }
      }
      return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, region]) => region);
    },
    areas(bounds, maxAreas = 4096) {
      if (!Number.isSafeInteger(maxAreas) || maxAreas < 1)
        throw new Error('Invalid ecology area limit');
      if (!bounds.every(Number.isFinite) || bounds[0] > bounds[2] || bounds[1] > bounds[3])
        return [];
      const firstCopy = Math.floor((bounds[0] + halfWorld) / (halfWorld * 2));
      const lastCopy = Math.floor((bounds[2] + halfWorld) / (halfWorld * 2));
      if (lastCopy - firstCopy > 1) return undefined;
      const result: EcologyArea[] = [];
      for (let copy = firstCopy; copy <= lastCopy; copy++) {
        const offset = copy * halfWorld * 2;
        for (let row = rowAt(bounds[1]); row <= rowAt(bounds[3]); row++) {
          const ends = endpoints[row] as Uint16Array;
          const runs = atlas.rows[row] as number[];
          let start = 0;
          for (let i = 0; i < ends.length; i++) {
            const end = ends[i] as number;
            const x0 = -halfWorld + (start / width) * halfWorld * 2 + offset;
            const x1 = -halfWorld + (end / width) * halfWorld * 2 + offset;
            if (x0 <= bounds[2] && x1 > bounds[0]) {
              if (result.length >= maxAreas) return undefined;
              result.push({
                bounds: [x0, northings[row] as number, x1, northings[row + 1] as number],
                region: atlas.regions[(runs[i * 2 + 1] as number) - 1],
              });
            }
            start = end;
          }
        }
      }
      return result;
    },
  };
}
