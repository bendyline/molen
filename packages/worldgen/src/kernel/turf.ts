/**
 * Turf cover: where grass grows over one request, as a mask a host stands tufts on round its
 * camera (`TurfCover`, drawn by `createTurf` in the client half).
 *
 * Scatter rules place plants by the hectare, a few thousand a batch. Grass is a tuft or two a
 * square meter, wherever the ground is a lawn, a meadow or a verge: a few hundred thousand a
 * batch, of which a camera can see the few thousand within some tens of meters. So nothing is
 * placed here. The ground's own polygons are painted into a raster in the order the ground paints
 * them, each with the sward it grows; paving, buildings and water are cleared from it, each with
 * its margin; and the rows are stored as runs, since grass comes in fields.
 */

import { RasterGrid, rasterizePolygon, rasterizePolyline } from './raster';
import type { ScatterExclusion, ScatterRequest, TurfCover } from './types';

/** Finest cell, meters: a road's edge is drawn to about this. */
const MIN_CELL = 1;

/**
 * Share of a cell's ground that must be open (not paved over as built-up ground) for grass to
 * grow there: see `open` below.
 */
const OPEN_SHARE = 0.75;

/**
 * The turf cover of `request`, or undefined when it asks for none, `maxCells` leaves no room, or
 * no grass grows in its bounds. `open` is the share of the ground a host leaves unpaved at a
 * point of a sward's label (as `ScatterGroundCrowns.open`); omitted, all of it.
 */
export function sampleTurfCover(
  request: ScatterRequest,
  maxCells: number,
  open?: (x: number, z: number, label: string) => number,
): TurfCover | undefined {
  const turf = request.turf;
  if (turf === undefined || turf.swards.length === 0 || !(maxCells >= 1)) return undefined;
  if (turf.swards.length > 255) throw new Error('a turf request holds at most 255 swards');
  const bounds = request.emitBounds;
  const extent = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (!(extent > 0)) return undefined;
  const side = Math.min(65_535, Math.max(1, Math.floor(Math.sqrt(maxCells))));
  const raster = new RasterGrid(bounds, Math.max(MIN_CELL, extent / side));
  let any = false;
  for (const polygon of turf.ground) {
    const sward = polygon.sward;
    const grows = sward !== undefined && sward >= 0 && sward < turf.swards.length;
    // Ground that grows nothing still covers what lies under it.
    if (!grows && !any) continue;
    rasterizePolygon(raster, polygon.ring, polygon.holes ?? [], grows ? sward + 1 : 0);
    any ||= grows;
  }
  if (!any) return undefined;
  for (const exclusion of turf.clear) clear(raster, exclusion);
  const { cols, rows, data } = raster;
  if (open !== undefined)
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const value = data[index] as number;
        if (value === 0) continue;
        const [x, z] = raster.centreOf(col, row);
        const label = turf.swards[value - 1]?.label ?? '';
        if (open(x, z, label) < OPEN_SHARE) data[index] = 0;
      }
  const rowStart = new Uint32Array(rows + 1);
  const swards: number[] = [];
  const ends: number[] = [];
  let grown = 0;
  for (let row = 0; row < rows; row++) {
    // A run ends where the next cell differs, and at the row's end.
    let start = 0;
    for (let col = 1; col <= cols; col++) {
      const current = data[row * cols + start] as number;
      if (col < cols && (data[row * cols + col] as number) === current) continue;
      swards.push(current);
      ends.push(col);
      if (current !== 0) grown += col - start;
      start = col;
    }
    rowStart[row + 1] = swards.length;
  }
  if (grown === 0) return undefined;
  return {
    swards: turf.swards.map((sward) => ({ ...sward })),
    cell: raster.cell,
    originX: raster.originX,
    originZ: raster.originZ,
    columns: cols,
    rows,
    rowStart,
    runSward: Uint8Array.from(swards),
    runEnd: Uint16Array.from(ends),
  };
}

/** Clear an exclusion, with its radius round it, from the raster. */
function clear(raster: RasterGrid, exclusion: ScatterExclusion): void {
  const radius = exclusion.radius;
  if (exclusion.ring !== undefined) {
    rasterizePolygon(raster, exclusion.ring, exclusion.holes ?? [], 0);
    if (radius > 0)
      for (const ring of [exclusion.ring, ...(exclusion.holes ?? [])]) {
        const first = ring[0];
        if (first !== undefined) rasterizePolyline(raster, [...ring, first], radius, 0);
      }
  } else if (exclusion.polyline !== undefined) {
    rasterizePolyline(raster, exclusion.polyline, (exclusion.width ?? 0) / 2 + radius, 0);
  }
}

/**
 * The swards of row `row` of a cover from column `from` up to (not including) `to`, written to
 * `out` from its start: 0 for no grass, else 1 + an index into `cover.swards`. Columns and rows
 * outside the cover read as no grass.
 */
export function readTurfRow(
  cover: TurfCover,
  row: number,
  from: number,
  to: number,
  out: Uint8Array,
): void {
  const count = Math.max(0, to - from);
  out.fill(0, 0, count);
  if (row < 0 || row >= cover.rows || count === 0) return;
  const first = cover.rowStart[row] as number,
    last = cover.rowStart[row + 1] as number;
  // The first run that ends past `from`: a row holds few runs, and a caller reads short spans.
  let low = first,
    high = last;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((cover.runEnd[middle] as number) <= from) low = middle + 1;
    else high = middle;
  }
  let column = Math.max(0, from);
  for (let run = low; run < last && column < to; run++) {
    const end = Math.min(to, cover.runEnd[run] as number);
    const sward = cover.runSward[run] as number;
    if (sward !== 0 && end > column) out.fill(sward, column - from, end - from);
    column = Math.max(column, end);
  }
}

/** Square meters of a cover that grow grass. */
export function turfCoverArea(cover: TurfCover): number {
  let cells = 0;
  for (let row = 0; row < cover.rows; row++) {
    let column = 0;
    for (
      let run = cover.rowStart[row] as number;
      run < (cover.rowStart[row + 1] as number);
      run++
    ) {
      const end = cover.runEnd[run] as number;
      if ((cover.runSward[run] as number) !== 0) cells += end - column;
      column = end;
    }
  }
  return cells * cover.cell * cover.cell;
}
