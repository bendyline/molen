import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import {
  appendTerrainLineBand,
  TERRAIN_SURFACE_KIND,
  TerrainSurfaceMeshBuilder,
  terrainLinePath,
} from '../src/linear-features';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';

function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 2, z: 4 },
    pyramid: {
      name: 'test',
      origin: [0, 0],
      rootSize: 800,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 9,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {
      format: 'molen/terrain@2',
      name: 'tile',
      origin: [200, 400],
      chunkSize: 100,
      tileResolution: 9,
      gridSize: [1, 1],
      height: { min: 0, max: 20 },
      tiles: { heightUrl: '' },
      layers: [],
      lod: { levels: 1, distanceBands: [], skirts: false },
      streaming: { loadRadius: 1, unloadRadius: 2, maxConcurrentLoads: 1, maxResidentTiles: 4 },
      collision: { enabled: false },
    },
    heightfield: new Heightfield(new Float32Array(81).fill(0.5), 9, 9, {
      origin: [200, 400],
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    }),
    origin: [200, 400],
    tileSize: 100,
    signal: new AbortController().signal,
  };
}

describe('pavement surface detail', () => {
  it('writes band coordinates, kind, width and lane width for the pavement material', () => {
    const builder = new TerrainSurfaceMeshBuilder(context());
    builder.ensureAttribute('surfaceDetail', 4);
    const path = terrainLinePath(
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      100,
    );
    appendTerrainLineBand(builder, path, {
      width: 7,
      color: '#404040',
      surface: TERRAIN_SURFACE_KIND.road,
      lanes: 2,
    });
    const mesh = builder.mesh('road');
    if (!mesh) throw new Error('expected a road mesh');
    const detail = mesh.geometry.getAttribute('surfaceDetail');
    expect(detail.count).toBe(mesh.geometry.getAttribute('position').count);
    for (let i = 0; i < detail.count; i++) {
      expect(detail.getX(i)).toBeGreaterThanOrEqual(-1e-4);
      expect(detail.getX(i)).toBeLessThanOrEqual(80 + 1e-4);
      expect(detail.getY(i)).toBeGreaterThanOrEqual(-1e-4);
      expect(detail.getY(i)).toBeLessThanOrEqual(7 + 1e-4);
      expect(detail.getZ(i)).toBe(TERRAIN_SURFACE_KIND.road * 128 + 7);
      expect(detail.getW(i)).toBeCloseTo(3.5, 6);
    }
    // Along runs the full band; across spans both edges.
    const along = Array.from({ length: detail.count }, (_, i) => detail.getX(i));
    const across = Array.from({ length: detail.count }, (_, i) => detail.getY(i));
    expect(Math.max(...along)).toBeCloseTo(80, 3);
    expect(Math.min(...across)).toBeCloseTo(0, 3);
    expect(Math.max(...across)).toBeCloseTo(7, 3);
    mesh.geometry.dispose();
  });

  it('marks the edges that fray into the ground, outer or inner by the band offset', () => {
    const path = terrainLinePath(
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      100,
    );
    const fray = (offset: number, edge: 'outer' | 'inner' | 'both'): number => {
      const builder = new TerrainSurfaceMeshBuilder(context());
      appendTerrainLineBand(builder, path, {
        width: 2,
        offset,
        color: '#c0c0c0',
        surface: TERRAIN_SURFACE_KIND.sidewalk,
        fray: edge,
      });
      const mesh = builder.mesh('sidewalk');
      const detail = mesh?.geometry.getAttribute('surfaceDetail');
      if (!mesh || !detail) throw new Error('expected a sidewalk mesh');
      const w = detail.getW(0);
      for (let i = 0; i < detail.count; i++) expect(detail.getW(i)).toBe(w);
      mesh.geometry.dispose();
      return w;
    };
    // Across runs from the band's edge on the line's negative side to its positive side.
    expect(fray(5, 'outer')).toBe(2);
    expect(fray(-5, 'outer')).toBe(1);
    expect(fray(5, 'inner')).toBe(1);
    expect(fray(-5, 'both')).toBe(3);
    expect(fray(0, 'outer')).toBe(3);
    // Roads keep w for their lane width.
    const builder = new TerrainSurfaceMeshBuilder(context());
    appendTerrainLineBand(builder, path, {
      width: 6,
      color: '#404040',
      surface: TERRAIN_SURFACE_KIND.road,
      lanes: 2,
      fray: 'both',
    });
    const road = builder.mesh('road');
    expect(road?.geometry.getAttribute('surfaceDetail').getW(0)).toBeCloseTo(3, 6);
    road?.geometry.dispose();
  });

  it('stops fraying where a band edge lies over other paving', () => {
    const path = terrainLinePath(
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      100,
    );
    const builder = new TerrainSurfaceMeshBuilder(context());
    appendTerrainLineBand(builder, path, {
      width: 2,
      offset: -5,
      color: '#c0c0c0',
      surface: TERRAIN_SURFACE_KIND.sidewalk,
      fray: 'outer',
    });
    // A driveway crosses the band's middle third.
    builder.unfraySince(0, (x) => x < 35 || x > 65);
    const detail = builder.mesh('sidewalk')?.geometry.getAttribute('surfaceDetail');
    const position = builder.mesh('sidewalk')?.geometry.getAttribute('position');
    if (!detail || !position) throw new Error('expected a sidewalk mesh');
    let kept = 0,
      cleared = 0;
    for (let t = 0; t < detail.count; t += 3) {
      const flags = [t, t + 1, t + 2].map((i) => detail.getW(i));
      const xs = [t, t + 1, t + 2].map((i) => position.getX(i));
      // Each triangle keeps one flag, so interpolation never blends two.
      expect(new Set(flags).size).toBe(1);
      if (xs.some((x) => x >= 35 && x <= 65)) {
        expect(flags[0]).toBe(0);
        cleared++;
      } else {
        expect(flags[0]).toBe(1);
        kept++;
      }
    }
    expect(kept).toBeGreaterThan(0);
    expect(cleared).toBeGreaterThan(0);
  });

  it('drops a curb face from the inner band edge to the road, facing the line', () => {
    const path = terrainLinePath(
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      100,
    );
    for (const offset of [4, -4]) {
      const builder = new TerrainSurfaceMeshBuilder(context());
      appendTerrainLineBand(builder, path, {
        width: 0.22,
        offset,
        color: '#ddd8cc',
        elevation: 0.3,
        surface: TERRAIN_SURFACE_KIND.curb,
        riser: 0.15,
      });
      const mesh = builder.mesh('curb');
      if (!mesh) throw new Error('expected a curb mesh');
      const position = mesh.geometry.getAttribute('position');
      const normal = mesh.geometry.getAttribute('normal');
      const ground = builder.groundHeight(50, 50);
      let faces = 0;
      for (let i = 0; i < position.count; i++) {
        if (Math.abs(normal.getY(i)) > 0.5) {
          expect(position.getY(i)).toBeCloseTo(ground + 0.3, 4);
          continue;
        }
        faces++;
        // On the inner edge, between the road surface and the curb top, facing the line.
        expect(Math.abs(Math.abs(position.getZ(i) - 50) - (Math.abs(offset) - 0.11))).toBeLessThan(
          1e-3,
        );
        expect(position.getY(i)).toBeGreaterThanOrEqual(ground + 0.15 - 1e-4);
        expect(position.getY(i)).toBeLessThanOrEqual(ground + 0.3 + 1e-4);
        expect(normal.getZ(i) * Math.sign(50 - position.getZ(i))).toBeGreaterThan(0.99);
      }
      expect(faces).toBeGreaterThan(0);
      mesh.geometry.dispose();
    }
  });

  it('carries band coordinates continuously through a bend', () => {
    // A curving sidewalk: every point two quads share gets one along and one across.
    const arc: [number, number][] = Array.from({ length: 13 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 0.6;
      return [0.5 + Math.cos(angle) * 0.35, 0.15 + Math.sin(angle) * 0.35];
    });
    const builder = new TerrainSurfaceMeshBuilder(context());
    appendTerrainLineBand(builder, terrainLinePath(arc, 100), {
      width: 2,
      offset: 4,
      color: '#c6c4b9',
      surface: TERRAIN_SURFACE_KIND.sidewalk,
      fray: 'outer',
    });
    const mesh = builder.mesh('sidewalk');
    if (!mesh) throw new Error('expected a sidewalk mesh');
    const position = mesh.geometry.getAttribute('position');
    const detail = mesh.geometry.getAttribute('surfaceDetail');
    const seen = new Map<string, [number, number]>();
    let shared = 0;
    for (let i = 0; i < position.count; i++) {
      const key = `${position.getX(i).toFixed(3)},${position.getZ(i).toFixed(3)}`;
      const value: [number, number] = [detail.getX(i), detail.getY(i)];
      const first = seen.get(key);
      if (first === undefined) seen.set(key, value);
      else {
        shared++;
        expect(value[0]).toBeCloseTo(first[0], 3);
        expect(value[1]).toBeCloseTo(first[1], 3);
      }
      expect(value[1]).toBeGreaterThanOrEqual(-1e-3);
      expect(value[1]).toBeLessThanOrEqual(2 + 1e-3);
    }
    expect(shared).toBeGreaterThan(10);
    mesh.geometry.dispose();
  });

  it('pads untagged geometry with plain zeros', () => {
    const builder = new TerrainSurfaceMeshBuilder(context());
    builder.ensureAttribute('surfaceDetail', 4);
    appendTerrainLineBand(
      builder,
      terrainLinePath(
        [
          [0.2, 0.2],
          [0.2, 0.8],
        ],
        100,
      ),
      { width: 2, color: '#ffffff' },
    );
    const mesh = builder.mesh('plain');
    const detail = mesh?.geometry.getAttribute('surfaceDetail');
    expect(detail).toBeDefined();
    expect([...(detail?.array ?? [])].every((v) => v === 0)).toBe(true);
    mesh?.geometry.dispose();
  });
});
