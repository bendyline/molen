/** Decode public Arc/Info ASCII grids without silently dropping no-data or axis metadata. */
export function parseArcGrid(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = {};
  const fields = new Set([
    'ncols',
    'nrows',
    'xllcorner',
    'yllcorner',
    'xllcenter',
    'yllcenter',
    'cellsize',
    'dx',
    'dy',
    'nodata_value',
  ]);
  let offset = 0;
  for (const line of lines) {
    const [name, raw, extra] = line.trim().split(/\s+/);
    const key = name.toLowerCase();
    if (!fields.has(key)) break;
    if (extra || !Number.isFinite(Number(raw)) || key in header)
      throw new Error(`Invalid ASCII grid header ${key}`);
    header[key] = Number(raw);
    offset++;
  }
  const width = header.ncols,
    height = header.nrows;
  const dx = header.dx ?? header.cellsize,
    dy = header.dy ?? header.cellsize;
  const west = header.xllcenter ?? header.xllcorner + dx / 2;
  const south = header.yllcenter ?? header.yllcorner + dy / 2;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 2 ||
    height < 2 ||
    !(dx > 0) ||
    !(dy > 0) ||
    !Number.isFinite(west) ||
    !Number.isFinite(south)
  )
    throw new Error('Invalid ASCII grid extent');
  const values = lines.slice(offset).join(' ').trim().split(/\s+/).map(Number);
  if (values.length !== width * height || values.some((value) => !Number.isFinite(value)))
    throw new Error('Invalid ASCII grid data');
  return {
    width,
    height,
    dx,
    dy,
    west,
    north: south + (height - 1) * dy,
    header,
    values: values.map((value) => (value === header.nodata_value ? null : value)),
  };
}

/** Bilinear samples use returned pixel centers. Missing/outside cells stay unresolved. */
export function sampleArcGrid(grid, x, y) {
  const u = (x - grid.west) / grid.dx,
    v = (grid.north - y) / grid.dy;
  if (u < -1e-8 || v < -1e-8 || u > grid.width - 1 + 1e-8 || v > grid.height - 1 + 1e-8)
    return null;
  const boundedU = Math.max(0, Math.min(grid.width - 1, u));
  const boundedV = Math.max(0, Math.min(grid.height - 1, v));
  const ix = Math.min(grid.width - 2, Math.floor(boundedU));
  const iy = Math.min(grid.height - 2, Math.floor(boundedV));
  const fx = boundedU - ix,
    fy = boundedV - iy;
  let height = 0;
  for (const [dx, dy, weight] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ]) {
    if (weight <= 1e-12) continue;
    const value = grid.values[(iy + dy) * grid.width + ix + dx];
    if (value === null) return null;
    height += value * weight;
  }
  return height;
}
