/** CPU height morph between rendered grids. Uses the same NW/SW/NE triangle split as meshing. */
export interface SurfaceMorphSource {
  positions: Float32Array;
  resolution: number;
  size: number;
  offsetX: number;
  offsetZ: number;
}
export interface SurfaceHeightMorph {
  target: Float32Array;
  start: Float32Array;
}
export function prepareSurfaceHeightMorph(
  positions: Float32Array,
  source: SurfaceMorphSource,
): SurfaceHeightMorph | undefined {
  const start = new Float32Array(positions.length / 3);
  const target = new Float32Array(start.length);
  const cells = source.resolution - 1;
  let changed = false;
  for (let vertex = 0; vertex < start.length; vertex++) {
    const at = vertex * 3;
    const x = Math.max(
      0,
      Math.min(cells, (((positions[at] as number) + source.offsetX) / source.size) * cells),
    );
    const z = Math.max(
      0,
      Math.min(cells, (((positions[at + 2] as number) + source.offsetZ) / source.size) * cells),
    );
    const col = Math.min(cells - 1, Math.floor(x)),
      row = Math.min(cells - 1, Math.floor(z));
    const u = x - col,
      v = z - row;
    const height = (dx: number, dz: number): number =>
      source.positions[((row + dz) * source.resolution + col + dx) * 3 + 1] as number;
    const y =
      u + v <= 1
        ? height(0, 0) * (1 - u - v) + height(1, 0) * u + height(0, 1) * v
        : height(1, 1) * (u + v - 1) + height(1, 0) * (1 - v) + height(0, 1) * (1 - u);
    target[vertex] = positions[at + 1] as number;
    start[vertex] = y;
    changed ||= Math.abs(y - (target[vertex] as number)) > 0.001;
  }
  return changed ? { start, target } : undefined;
}
export function applySurfaceHeightMorph(
  positions: Float32Array,
  morph: SurfaceHeightMorph,
  progress: number,
): void {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = t * t * (3 - 2 * t);
  for (let vertex = 0; vertex < morph.target.length; vertex++)
    positions[vertex * 3 + 1] =
      (morph.start[vertex] as number) +
      ((morph.target[vertex] as number) - (morph.start[vertex] as number)) * smooth;
}
