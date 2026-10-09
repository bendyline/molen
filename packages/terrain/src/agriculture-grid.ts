/** Download-sized agricultural observations, independent of any rendering recipe. Sparse RLE
 * grids describe coarse classified areas, not parcel ownership. Mapped crop tags win; elsewhere
 * these observations either enrich mapped farmland or supply missing agricultural land cover. */
import { polygonArea, polygonBounds } from './polygon';
import type { TerrainPyramidTileAddress } from './pyramid-types';
import { clipTerrainSemanticRing } from './semantic-overzoom';
import type { TerrainLandcoverFeature, TerrainSemanticTile } from './semantic-types';

export interface TerrainAgricultureSource {
  /** Versioned XYZ JSON URL; includes {z}, {x}, {y}. Relative to the terrain package. */
  urlTemplate: string;
  level: number;
  source: string;
  year: number;
  /** Maximum uncompressed response size; defaults to 128 KiB, at most 1 MiB. */
  maxTileBytes?: number;
}
export interface TerrainAgricultureGrid {
  format: 'molen/agriculture-grid@1';
  level: number;
  x: number;
  z: number;
  resolution: number;
  source: string;
  year: number;
  /** Zero is unknown/non-crop. Other entries are conservative majority observations. */
  palette: Array<{
    crop?: string;
    confidence?: number;
    irrigated?: boolean;
    sowingMonth?: number;
    harvestMonth?: number;
  }>;
  /** [run length, palette index, ...], row-major north to south. */
  runs: number[];
}

export function decodeAgricultureGrid(grid: TerrainAgricultureGrid): Uint8Array {
  if (
    grid.format !== 'molen/agriculture-grid@1' ||
    !Number.isInteger(grid.resolution) ||
    grid.resolution < 1 ||
    grid.resolution > 128 ||
    !Number.isInteger(grid.level) ||
    grid.level < 0 ||
    grid.level > 20 ||
    !Number.isInteger(grid.x) ||
    !Number.isInteger(grid.z) ||
    grid.x < 0 ||
    grid.z < 0 ||
    grid.x >= 2 ** grid.level ||
    grid.z >= 2 ** grid.level ||
    typeof grid.source !== 'string' ||
    !grid.source.length ||
    !Number.isInteger(grid.year) ||
    grid.year < 1900 ||
    grid.year > 2200 ||
    !Array.isArray(grid.palette) ||
    grid.palette.length < 1 ||
    grid.palette.length > 32 ||
    !Array.isArray(grid.runs) ||
    grid.runs.length % 2 !== 0 ||
    grid.runs.length > 32768
  )
    throw new Error('Invalid agricultural grid');
  for (const entry of grid.palette) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('Invalid grid palette entry');
    if (
      entry.crop !== undefined &&
      (typeof entry.crop !== 'string' || !entry.crop.length || entry.crop.length > 80)
    )
      throw new Error('Invalid grid crop');
    if (
      entry.confidence !== undefined &&
      (!Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1)
    )
      throw new Error('Invalid grid confidence');
    if (entry.irrigated !== undefined && typeof entry.irrigated !== 'boolean')
      throw new Error('Invalid grid irrigation');
    for (const month of [entry.sowingMonth, entry.harvestMonth])
      if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12))
        throw new Error('Invalid crop calendar');
  }
  const cells = new Uint8Array(grid.resolution * grid.resolution);
  let offset = 0;
  for (let i = 0; i < grid.runs.length; i += 2) {
    const count = grid.runs[i]!,
      code = grid.runs[i + 1]!;
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      !Number.isInteger(code) ||
      code < 0 ||
      code >= grid.palette.length ||
      offset + count > cells.length
    )
      throw new Error('Invalid agricultural RLE');
    cells.fill(code, offset, offset + count);
    offset += count;
  }
  if (offset !== cells.length) throw new Error('Incomplete agricultural RLE');
  return cells;
}

export function applyAgricultureGrid(
  tile: TerrainSemanticTile,
  address: TerrainPyramidTileAddress,
  grid: TerrainAgricultureGrid,
): TerrainSemanticTile {
  const cells = decodeAgricultureGrid(grid);
  const factor = 2 ** (address.level - grid.level);
  if (
    factor < 1 ||
    Math.floor(address.x / factor) !== grid.x ||
    Math.floor(address.z / factor) !== grid.z
  )
    return tile;
  const n = grid.resolution,
    dx = address.x - grid.x * factor,
    dz = address.z - grid.z * factor;
  const x0 = Math.floor((dx * n) / factor),
    z0 = Math.floor((dz * n) / factor);
  const x1 = Math.ceil(((dx + 1) * n) / factor),
    z1 = Math.ceil(((dz + 1) * n) / factor);
  const additions: TerrainLandcoverFeature[] = [];
  const candidates: Array<{
    box: [number, number, number, number];
    code: number;
    x: number;
    z: number;
  }> = [];
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      const code = cells[z * n + x] ?? 0;
      const entry = grid.palette[code];
      const left = Math.max(0, (x / n) * factor - dx),
        top = Math.max(0, (z / n) * factor - dz);
      const right = Math.min(1, ((x + 1) / n) * factor - dx),
        bottom = Math.min(1, ((z + 1) / n) * factor - dz);
      candidates.push({ box: [left, top, right, bottom], code, x, z });
      if (!code || !entry || (entry.confidence !== undefined && entry.confidence < 0.65)) continue;
      // At coarse views a 128² raster must not turn into 16,384 draped polygons.
      if ((x1 - x0) * (z1 - z0) > 256) continue;
      const longitude = ((grid.x + (x + 0.5) / n) / 2 ** grid.level) * 360 - 180;
      const latitude =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * (grid.z + (z + 0.5) / n)) / 2 ** grid.level))) *
          180) /
        Math.PI;
      additions.push({
        class: 'farmland',
        ...(entry.crop ? { crop: entry.crop } : {}),
        ...(entry.irrigated !== undefined ? { irrigated: entry.irrigated } : {}),
        agriculture: {
          fieldId: `${grid.source}:${grid.level}:${grid.x}:${grid.z}:${x}:${z}`,
          source: grid.source,
          year: grid.year,
          anchor: [longitude, latitude],
          ...(entry.confidence !== undefined ? { confidence: entry.confidence } : {}),
          ...(entry.sowingMonth ? { sowingMonth: entry.sowingMonth } : {}),
          ...(entry.harvestMonth ? { harvestMonth: entry.harvestMonth } : {}),
        },
        polygons: [
          {
            outer: [
              [left, top],
              [right, top],
              [right, bottom],
              [left, bottom],
            ],
          },
        ],
      });
    }
  const landcover = tile.landcover.map((feature): TerrainLandcoverFeature => {
    if (
      feature.crop ||
      feature.trees ||
      feature.agriculture ||
      !['farmland', 'crop', 'cropland'].includes(feature.subclass ?? feature.class)
    )
      return feature;
    const votes = new Map<number, number>();
    let total = 0;
    let anchorCell: (typeof candidates)[number] | undefined;
    let anchorArea = 0;
    const polygons = feature.polygons.map((polygon) => ({
      polygon,
      bounds: polygonBounds(polygon),
    }));
    for (const cell of candidates) {
      // Weight intersected area, including holes: a small field inside one coarse cell still
      // receives its observation, even when the cell's center is outside the requested tile.
      let area = 0;
      for (const { polygon, bounds } of polygons) {
        if (
          bounds[0] >= cell.box[2] ||
          bounds[2] <= cell.box[0] ||
          bounds[1] >= cell.box[3] ||
          bounds[3] <= cell.box[1]
        )
          continue;
        area += polygonArea({
          outer: clipTerrainSemanticRing(polygon.outer, cell.box),
          holes: (polygon.holes ?? []).map((hole) => clipTerrainSemanticRing(hole, cell.box)),
        });
      }
      if (area <= 0) continue;
      total += area;
      votes.set(cell.code, (votes.get(cell.code) ?? 0) + area);
      if (area > anchorArea) {
        anchorCell = cell;
        anchorArea = area;
      }
    }
    const best = [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    const entry =
      best && best[0] > 0 && best[1] / total >= 0.65 ? grid.palette[best[0]] : undefined;
    if (!entry?.crop || (entry.confidence !== undefined && entry.confidence < 0.65)) return feature;
    return {
      ...feature,
      crop: entry.crop,
      ...(entry.irrigated !== undefined ? { irrigated: entry.irrigated } : {}),
      agriculture: {
        fieldId:
          feature.id !== undefined
            ? `map:${feature.id}`
            : `${grid.source}:${grid.level}:${grid.x}:${grid.z}:${anchorCell?.x}:${anchorCell?.z}:${best?.[0]}`,
        source: grid.source,
        year: grid.year,
        ...(entry.confidence !== undefined ? { confidence: entry.confidence } : {}),
        ...(entry.sowingMonth ? { sowingMonth: entry.sowingMonth } : {}),
        ...(entry.harvestMonth ? { harvestMonth: entry.harvestMonth } : {}),
      },
    };
  });
  // Existing mapped physical surfaces take precedence over remotely classified grid cells.
  return { ...tile, landcover: [...additions, ...landcover] };
}
