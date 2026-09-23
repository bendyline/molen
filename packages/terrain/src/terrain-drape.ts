/** Clip ground overlays to the rendered terrain grid, including its cell diagonals.
 * Boundary-only draping spans valleys; independently sampled meshes can intersect each other. */
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type { TerrainSemanticPoint } from './semantic-types';

type Vertex = readonly [x: number, y: number, z: number, nx: number, ny: number, nz: number];
type Emit = (a: Vertex, b: Vertex, c: Vertex) => void;

function clip(
  points: readonly TerrainSemanticPoint[],
  distance: (point: TerrainSemanticPoint) => number,
): TerrainSemanticPoint[] {
  const result: TerrainSemanticPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as TerrainSemanticPoint;
    const b = points[(i + 1) % points.length] as TerrainSemanticPoint;
    const da = distance(a),
      db = distance(b);
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

export function clipTerrainSurfacePolygon(
  points: readonly TerrainSemanticPoint[],
  size: number,
): TerrainSemanticPoint[] {
  let result = clip(points, (p) => p[0]);
  result = clip(result, (p) => size - p[0]);
  result = clip(result, (p) => p[1]);
  return clip(result, (p) => size - p[1]);
}

const cache = new WeakMap<TerrainPyramidTileLayerContext, TerrainSurfaceDraper>();
export function terrainSurfaceDraper(
  context: TerrainPyramidTileLayerContext,
): TerrainSurfaceDraper {
  let draper = cache.get(context);
  if (!draper) {
    draper = new TerrainSurfaceDraper(context);
    cache.set(context, draper);
  }
  return draper;
}

class TerrainSurfaceDraper {
  private readonly cells: number;
  private readonly spacing: number;
  private readonly vertices = new Map<number, Vertex>();

  constructor(private readonly context: TerrainPyramidTileLayerContext) {
    this.cells = Math.max(1, (context.surfaceResolution ?? context.heightfield.cols) - 1);
    this.spacing = context.tileSize / this.cells;
  }

  private vertex(x: number, z: number): Vertex {
    const key = z * (this.cells + 1) + x;
    let vertex = this.vertices.get(key);
    if (!vertex) {
      const localX = x * this.spacing,
        localZ = z * this.spacing;
      const wx = this.context.origin[0] + localX,
        wz = this.context.origin[1] + localZ;
      const normal = this.context.heightfield.normalAt(wx, wz);
      vertex = [localX, this.context.heightfield.sampleHeight(wx, wz), localZ, ...normal];
      this.vertices.set(key, vertex);
    }
    return vertex;
  }

  /** Input is convex, tile-local X/Z. Work visits only intersected grid rows and columns. */
  polygon(points: readonly TerrainSemanticPoint[], emit: Emit): void {
    const bounded = clipTerrainSurfacePolygon(points, this.context.tileSize);
    if (bounded.length < 3) return;
    const grid = bounded.map(
      (p): TerrainSemanticPoint => [p[0] / this.spacing, p[1] / this.spacing],
    );
    const minZ = Math.max(0, Math.floor(Math.min(...grid.map((p) => p[1]))));
    const maxZ = Math.min(this.cells - 1, Math.floor(Math.max(...grid.map((p) => p[1]))));
    for (let z = minZ; z <= maxZ; z++) {
      const row = clip(
        clip(grid, (p) => p[1] - z),
        (p) => z + 1 - p[1],
      );
      if (row.length < 3) continue;
      const minX = Math.max(0, Math.floor(Math.min(...row.map((p) => p[0]))));
      const maxX = Math.min(this.cells - 1, Math.floor(Math.max(...row.map((p) => p[0]))));
      for (let x = minX; x <= maxX; x++) {
        const cell = clip(
          clip(row, (p) => p[0] - x),
          (p) => x + 1 - p[0],
        );
        if (cell.length < 3) continue;
        // buildChunkGeometry uses (NW, SW, NE) and (NE, SW, SE).
        const nw = this.vertex(x, z),
          ne = this.vertex(x + 1, z);
        const sw = this.vertex(x, z + 1),
          se = this.vertex(x + 1, z + 1);
        for (const upper of [true, false]) {
          const face = clip(cell, (p) => (upper ? 1 : -1) * (x + z + 1 - p[0] - p[1]));
          const mapped = face.map((p): Vertex => {
            const u = p[0] - x,
              v = p[1] - z;
            const a = upper ? nw : se,
              b = ne,
              c = sw;
            const wa = upper ? 1 - u - v : u + v - 1;
            const wb = upper ? u : 1 - v,
              wc = upper ? v : 1 - u;
            const value = (i: 1 | 3 | 4 | 5): number => a[i] * wa + b[i] * wb + c[i] * wc;
            return [
              p[0] * this.spacing,
              value(1),
              p[1] * this.spacing,
              value(3),
              value(4),
              value(5),
            ];
          });
          for (let i = 1; i + 1 < mapped.length; i++) {
            const a = mapped[0] as Vertex,
              b = mapped[i] as Vertex,
              c = mapped[i + 1] as Vertex;
            const area = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
            if (Math.abs(area) < 1e-10) continue;
            if (area < 0) emit(a, b, c);
            else emit(a, c, b);
          }
        }
      }
    }
  }
}
