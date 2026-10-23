import { dmath } from '@bendyline/molen-kernel/determinism';
import { pointInPolygon, type TerrainSemanticPolygon } from '@bendyline/molen-terrain/kernel';
import type { Vec2 } from '@bendyline/molen-worldgen/kernel';
export type Bounds = [number, number, number, number];
export class InfillBins<T> {
  private readonly cells = new Map<string, T[]>();
  constructor(private readonly extent: number) {}
  add(value: T, bounds: Bounds): void {
    this.visit(bounds, (key) => {
      const cell = this.cells.get(key) ?? [];
      cell.push(value);
      this.cells.set(key, cell);
    });
  }
  query(bounds: Bounds): T[] {
    const values = new Set<T>();
    this.visit(bounds, (key) => {
      for (const value of this.cells.get(key) ?? []) values.add(value);
    });
    return [...values];
  }
  private visit(bounds: Bounds, fn: (key: string) => void): void {
    for (
      let x = Math.floor(Math.max(-300, bounds[0]) / 100);
      x <= Math.floor(Math.min(this.extent + 300, bounds[2]) / 100);
      x++
    )
      for (
        let z = Math.floor(Math.max(-300, bounds[1]) / 100);
        z <= Math.floor(Math.min(this.extent + 300, bounds[3]) / 100);
        z++
      )
        fn(`${x}:${z}`);
  }
}
export function around(x: number, z: number, r: number): Bounds {
  return [x - r, z - r, x + r, z + r];
}
export function distance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return dmath.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function cross(a: Vec2, b: Vec2, p: Vec2): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
export function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b));
}
export function lineNearPolygon(
  a: Vec2,
  b: Vec2,
  polygon: TerrainSemanticPolygon,
  padding: number,
): boolean {
  if (pointInPolygon(a, polygon) || pointInPolygon(b, polygon)) return true;
  return [polygon.outer, ...(polygon.holes ?? [])].some((r) =>
    r.some((p, i) => segmentDistance(a, b, p, r[(i + 1) % r.length] as Vec2) <= padding),
  );
}
export function polygonsNear(
  a: TerrainSemanticPolygon,
  b: TerrainSemanticPolygon,
  padding = 0,
): boolean {
  if (a.outer.some((p) => pointInPolygon(p, b)) || b.outer.some((p) => pointInPolygon(p, a)))
    return true;
  return [a.outer, ...(a.holes ?? [])].some((r) =>
    r.some((p, i) => lineNearPolygon(p, r[(i + 1) % r.length] as Vec2, b, padding)),
  );
}
export function corridor(a: Vec2, b: Vec2, width: number): TerrainSemanticPolygon {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = dmath.hypot(dx, dz) || 1,
    nx = ((-dz / length) * width) / 2,
    nz = ((dx / length) * width) / 2;
  return {
    outer: [
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
      [a[0] - nx, a[1] - nz],
    ],
  };
}
