/** Airside pavement and paint, batched and draped on the same grid as ordinary surfaces. */
import { buildTextMesh } from '@bendyline/molen-materials/text';
import * as THREE from 'three';
import { sampleTerrainLine } from './line-path';
import {
  appendTerrainLineBand,
  appendTerrainSurfaceArea,
  TERRAIN_PAVEMENT,
  TERRAIN_SURFACE_KIND,
  type TerrainLinePath,
  TerrainSurfaceMeshBuilder,
  terrainLinePath,
} from './linear-features';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import type { TerrainSemanticTile } from './semantic-types';
import { resolveTerrainSurfaceStyle, type TerrainSurfaceOptions } from './surface-styles';
import { taggedTerrainObjects, tagTerrainObject, terrainRootOffset } from './tagged-objects';
import { isAeroway } from './transport-features';

/** Name of each surface tile's airside pavement mesh (aprons, taxiways, runways). */
export const AIRPORT_PAVEMENT_MESH = 'surfaces:airport-pavement';
// Pavement is draped 0.48-0.55 m above the terrain grid; a car's support ray starts as high.
const PAVEMENT_REACH = 0.65;
const PAVEMENT_CELLS = 32;

/** A mesh built here or reassembled from a surface worker, for {@link sampleAirportPavement}. */
export function tagAirportPavement(mesh: THREE.Mesh): void {
  tagTerrainObject(AIRPORT_PAVEMENT_MESH, mesh);
}

interface PavementGrid {
  version: number;
  minX: number;
  minZ: number;
  cell: number;
  /** Each cell's triangles: `triangles[starts[cell]]` up to `triangles[starts[cell + 1]]`. */
  starts: Uint32Array;
  triangles: Uint32Array;
}
const grids = new WeakMap<THREE.BufferGeometry, PavementGrid>();

/** Vertex numbers of a triangle list, indexed (ground cutouts) or not (as built). */
function corners(geometry: THREE.BufferGeometry): ArrayLike<number> | undefined {
  return geometry.index?.array;
}

// Bucket the triangles by plan cell once per geometry: a query then tests a handful rather than
// the whole airport tile, each frame for every parked aircraft.
function pavementGrid(geometry: THREE.BufferGeometry, box: THREE.Box3): PavementGrid {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const known = grids.get(geometry);
  if (known !== undefined && known.version === position.version) return known;
  const p = position.array;
  const index = corners(geometry);
  const count = Math.floor((index?.length ?? position.count) / 3);
  const cell = Math.max(1, box.max.x - box.min.x, box.max.z - box.min.z) / PAVEMENT_CELLS;
  const at = (value: number, from: number): number =>
    Math.max(0, Math.min(PAVEMENT_CELLS - 1, Math.floor((value - from) / cell)));
  const cells = (t: number, each: (cell: number) => void): void => {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = (index?.[t * 3 + k] ?? t * 3 + k) * 3;
      minX = Math.min(minX, p[v] as number);
      maxX = Math.max(maxX, p[v] as number);
      minZ = Math.min(minZ, p[v + 2] as number);
      maxZ = Math.max(maxZ, p[v + 2] as number);
    }
    for (let z = at(minZ, box.min.z); z <= at(maxZ, box.min.z); z++)
      for (let x = at(minX, box.min.x); x <= at(maxX, box.min.x); x++) each(z * PAVEMENT_CELLS + x);
  };
  const starts = new Uint32Array(PAVEMENT_CELLS * PAVEMENT_CELLS + 1);
  for (let t = 0; t < count; t++)
    cells(t, (c) => {
      starts[c + 1] = (starts[c + 1] as number) + 1;
    });
  for (let c = 1; c < starts.length; c++)
    starts[c] = (starts[c] as number) + (starts[c - 1] as number);
  const triangles = new Uint32Array(starts[starts.length - 1] as number);
  const next = starts.slice(0, -1);
  for (let t = 0; t < count; t++)
    cells(t, (c) => {
      triangles[next[c] as number] = t;
      next[c] = (next[c] as number) + 1;
    });
  const grid = {
    version: position.version,
    minX: box.min.x,
    minZ: box.min.z,
    cell,
    starts,
    triangles,
  };
  grids.set(geometry, grid);
  return grid;
}

/**
 * Height of the visible airport pavement at (x, z) in `root`'s frame (the terrain stream's
 * object) where it is drawn just above `ground`, otherwise undefined. Aprons, taxiways and runways
 * are draped about half a metre above the terrain, so whatever stands on them, such as a parked
 * aircraft, rests at this height rather than the terrain's.
 */
export function sampleAirportPavement(
  root: THREE.Object3D,
  x: number,
  z: number,
  ground: number,
): number | undefined {
  let top: number | undefined;
  for (const object of taggedTerrainObjects(AIRPORT_PAVEMENT_MESH)) {
    const mesh = object as THREE.Mesh;
    // Tile layers sit at a fixed translation under the stream, as for tunnel queries.
    const offset = terrainRootOffset(mesh, root);
    if (offset === null) continue;
    const lx = x - offset.x,
      lz = z - offset.z;
    const geometry = mesh.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;
    if (lx < box.min.x || lx > box.max.x || lz < box.min.z || lz > box.max.z) continue;
    // An evicted tile keeps its cached offset: it must still be attached, and shown.
    let shown = false;
    for (let p: THREE.Object3D | null = mesh; p; p = p.parent) {
      if (!p.visible) break;
      if (p === root) {
        shown = true;
        break;
      }
    }
    if (!shown) continue;
    const grid = pavementGrid(geometry, box);
    const cell =
      Math.min(PAVEMENT_CELLS - 1, Math.floor((lz - grid.minZ) / grid.cell)) * PAVEMENT_CELLS +
      Math.min(PAVEMENT_CELLS - 1, Math.floor((lx - grid.minX) / grid.cell));
    const p = geometry.getAttribute('position').array;
    const index = corners(geometry);
    for (let i = grid.starts[cell] as number; i < (grid.starts[cell + 1] as number); i++) {
      const t = grid.triangles[i] as number;
      const a = (index?.[t * 3] ?? t * 3) * 3,
        b = (index?.[t * 3 + 1] ?? t * 3 + 1) * 3,
        c = (index?.[t * 3 + 2] ?? t * 3 + 2) * 3;
      const ax = p[a] as number,
        az = p[a + 2] as number,
        bx = p[b] as number,
        bz = p[b + 2] as number,
        cx = p[c] as number,
        cz = p[c + 2] as number;
      // Barycentric weights of the plan point; walls and skirts are degenerate in plan.
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const u = ((bz - cz) * (lx - cx) + (cx - bx) * (lz - cz)) / d;
      const v = ((cz - az) * (lx - cx) + (ax - cx) * (lz - cz)) / d;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y =
        offset.y +
        u * (p[a + 1] as number) +
        v * (p[b + 1] as number) +
        (1 - u - v) * (p[c + 1] as number);
      if (y > ground && y <= ground + PAVEMENT_REACH && (top === undefined || y > top)) top = y;
    }
  }
  return top;
}

/** No road wheel tracks, gutters, curbs, street lamps or car bays on airport pavement. */
export function appendAirportSurfaces(
  group: THREE.Group,
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  options: TerrainSurfaceOptions,
  material?: THREE.Material,
): void {
  const pavement = new TerrainSurfaceMeshBuilder(context),
    paint = new TerrainSurfaceMeshBuilder(context);
  pavement.ensureAttribute('surfaceDetail', 4);
  paint.ensureAttribute('surfaceDetail', 4);
  const white = '#eee9d4',
    yellow = '#e8bd57';
  const markings = resolveTerrainSurfaceStyle(options.style, options.details).markings;
  for (const feature of tile.landcover) {
    if (!/^(apron|taxiway|runway)$/.test(feature.subclass ?? feature.class)) continue;
    for (const polygon of feature.polygons) {
      const start = pavement.vertexCount;
      appendTerrainSurfaceArea(
        pavement,
        polygon,
        new THREE.Color(feature.class === 'apron' ? '#aaa79e' : '#686b69'),
        0.48,
      );
      pavement.surfaceSince(start, TERRAIN_SURFACE_KIND.plain);
    }
  }
  const rect = (
    path: TerrainLinePath,
    distance: number,
    across: number,
    width: number,
    length: number,
  ): void => {
    const a = sampleTerrainLine(path, distance - length / 2, across - width / 2),
      b = sampleTerrainLine(path, distance + length / 2, across - width / 2);
    const c = sampleTerrainLine(path, distance + length / 2, across + width / 2),
      d = sampleTerrainLine(path, distance - length / 2, across + width / 2);
    const start = paint.vertexCount;
    paint.polygon(
      [
        [a.x, a.z],
        [b.x, b.z],
        [c.x, c.z],
        [d.x, d.z],
      ],
      new THREE.Color(white),
      0.565,
    );
    paint.surfaceSince(start, TERRAIN_SURFACE_KIND.paint, undefined, width);
  };
  for (const f of tile.transportation) {
    if (!isAeroway(f)) continue;
    const kind = f.subclass ?? f.tags?.aeroway ?? f.class;
    if (!['runway', 'taxiway', 'taxilane', 'parking_position'].includes(kind)) continue;
    for (const line of f.lines) {
      const path = terrainLinePath(line, context.tileSize);
      if (path.length < 1) continue;
      const runway = kind === 'runway',
        stand = kind === 'parking_position';
      const width = Math.max(2, Math.min(150, f.width ?? (runway ? 30 : 18)));
      const unpaved = /^(GRS|TURF|GRE|GRAVEL|DIRT)|grass|gravel|ground|turf|sand/i.test(
        f.surface ?? '',
      );
      const concrete = /^(CON)|concrete/i.test(f.surface ?? '');
      if (!stand)
        appendTerrainLineBand(
          pavement,
          path,
          {
            width,
            elevation: runway ? 0.55 : 0.51,
            color: unpaved ? '#8b9570' : concrete ? '#aaa79e' : '#646766',
            surface: TERRAIN_SURFACE_KIND.plain,
          },
          { spacing: 24, maxElements: 2500 },
        );
      if (!markings || unpaved) continue;
      if (!runway) {
        appendTerrainLineBand(
          paint,
          path,
          { width: 0.24, color: yellow, elevation: 0.535, surface: TERRAIN_SURFACE_KIND.paint },
          { spacing: 12, maxElements: 1500 },
        );
        continue;
      }
      for (const sign of [-1, 1])
        appendTerrainLineBand(
          paint,
          path,
          {
            width: 0.45,
            offset: sign * (width / 2 - 0.6),
            color: white,
            elevation: 0.565,
            surface: TERRAIN_SURFACE_KIND.paint,
          },
          { spacing: 24, maxElements: 2500 },
        );
      appendTerrainLineBand(
        paint,
        path,
        {
          width: Math.min(0.9, width / 40),
          color: white,
          elevation: 0.565,
          surface: TERRAIN_SURFACE_KIND.paint,
          dash: [30, 30],
          phase: 0,
        },
        { spacing: 30, maxElements: 1500 },
      );
      // Only a complete surveyed runway has end labels: clipped map fragments aren't thresholds.
      if (!String(f.id).startsWith('airport:')) continue;
      for (const end of [0, 1]) {
        const fromEnd = (d: number): number => (end ? path.length - d : d);
        const stripes = Math.min(8, Math.floor((width - 4) / 5));
        for (let i = 0; i < stripes; i++)
          rect(path, fromEnd(22), (i - (stripes - 1) / 2) * 4.5, 1.8, 30);
        if (path.length > 1200)
          for (const side of [-1, 1])
            rect(path, fromEnd(300), side * width * 0.27, width * 0.12, 40);
        const label = f.ref?.split('/')[end];
        if (!label || !options.fonts) continue;
        const text = buildTextMesh(label, options.fonts, {
          font: options.fonts.roles?.highway ?? options.fonts.defaultFont,
          align: 'center',
          verticalAlign: 'center',
          size: 20,
          maxWidth: width * 0.64,
          maxHeight: 20,
          maxCharacters: 6,
        });
        const origin = sampleTerrainLine(path, fromEnd(75));
        const toward = sampleTerrainLine(path, fromEnd(76));
        const dx = toward.x - origin.x,
          dz = toward.z - origin.z;
        for (let i = 0; i < text.indices.length; i += 3) {
          const points = [0, 1, 2].map((j): [number, number] => {
            const k = (text.indices[i + j] as number) * 3;
            const x = text.positions[k] as number,
              y = text.positions[k + 1] as number;
            return [origin.x - dz * x + dx * y, origin.z + dx * x + dz * y];
          });
          const start = paint.vertexCount;
          paint.polygon(points, new THREE.Color(white), 0.565);
          // Stroke width drives the pavement shader's distance fade, just as for painted bands.
          paint.surfaceSince(start, TERRAIN_SURFACE_KIND.paint, undefined, 2);
        }
      }
    }
  }
  for (const [builder, name] of [
    [pavement, AIRPORT_PAVEMENT_MESH],
    [paint, 'surfaces:airport-markings'],
  ] as const) {
    const mesh = builder.mesh(name, material);
    if (mesh) {
      mesh.userData[TERRAIN_PAVEMENT] = true;
      if (name === AIRPORT_PAVEMENT_MESH) tagAirportPavement(mesh);
      group.add(mesh);
    }
  }
}
