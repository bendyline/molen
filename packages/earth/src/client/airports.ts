/** Optional, host-supplied airport data. Geometry joins the normal tile/worker lifecycle. */
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  pointInPolygon,
  type TerrainPackageAttribution,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  webMercatorToWgs84,
  wgs84ToWebMercator,
  wgs84ToWebMercatorTile,
} from '@bendyline/molen-terrain/kernel';

export interface EarthAirport {
  id: string;
  name: string;
  type?: 'small_airport' | 'medium_airport' | 'large_airport';
  scheduledService?: boolean;
  runways: {
    id: string;
    ends: [TerrainSemanticPoint, TerrainSemanticPoint];
    width: number;
    surface: string;
    lighted: boolean;
  }[];
}

/** Layout coordinates are WGS84 [longitude, latitude], using the semantic collections. */
export interface EarthAirportLayout {
  id: string;
  /** Local operations override; e.g. a manufacturing/business field with long runways. */
  profile?: 'general-aviation' | 'regional' | 'airline' | 'mixed';
  /** Authored ground activities, kept clear of automatically parked aircraft. WGS84 centres. */
  activityZones?: { center: TerrainSemanticPoint; radius: number }[];
  bounds: [number, number, number, number];
  tile: TerrainSemanticTile;
}

export interface EarthAirportIndex {
  format: 'molen/airports@1';
  level: number;
  cells: Record<string, string>;
  layouts: string[];
  attribution?: TerrainPackageAttribution[];
}

export interface EarthAirports {
  readonly attribution: readonly TerrainPackageAttribution[];
  readonly layouts: readonly EarthAirportLayout[];
  /** Catalog records in the geographic cell containing this point. */
  at(latitude: number, longitude: number): Promise<readonly EarthAirport[]>;
  /** Catalog records in cells touching WGS84 [west, south, east, north]; bounded to four cells. */
  inBounds(bounds: readonly [number, number, number, number]): Promise<readonly EarthAirport[]>;
  augment(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): Promise<TerrainSemanticTile>;
}

/** Keep airport content outside npm packages; the pack supplies the reader and documents. */
export async function createEarthAirports(
  index: EarthAirportIndex,
  read: <T>(path: string) => Promise<T>,
): Promise<EarthAirports> {
  if (
    index.format !== 'molen/airports@1' ||
    !Number.isInteger(index.level) ||
    index.level < 0 ||
    index.level > 8
  )
    throw new Error('Invalid airport index');
  const layouts = await Promise.all(index.layouts.map((path) => read<EarthAirportLayout>(path)));
  const cache = new Map<string, Promise<EarthAirport[]>>();
  const load = (path: string): Promise<EarthAirport[]> => {
    const found = cache.get(path);
    if (found) return found;
    const pending = read<EarthAirport[]>(path).catch((error: unknown) => {
      cache.delete(path);
      throw error;
    });
    cache.set(path, pending);
    if (cache.size > 24) cache.delete(cache.keys().next().value as string);
    return pending;
  };
  const inBounds: EarthAirports['inBounds'] = async ([west, south, east, north]) => {
    const min = wgs84ToWebMercatorTile(west, north, index.level);
    const max = wgs84ToWebMercatorTile(east, south, index.level);
    if ((max.x - min.x + 1) * (max.y - min.y + 1) > 4) return [];
    const paths = new Set<string>();
    for (let x = min.x; x <= max.x; x++)
      for (let y = min.y; y <= max.y; y++) {
        const path = index.cells[`${x}-${y}`];
        if (path) paths.add(path);
      }
    return [
      ...new Map(
        (await Promise.all([...paths].map(load)))
          .flat()
          .map((a) => [`${a.id}:${a.runways[0]?.ends.flat().join(',')}`, a]),
      ).values(),
    ];
  };
  return {
    attribution: index.attribution ?? [],
    layouts,
    inBounds,
    async at(latitude, longitude) {
      const cell = wgs84ToWebMercatorTile(longitude, latitude, index.level);
      const path = index.cells[`${cell.x}-${cell.y}`];
      return path ? load(path) : [];
    },
    async augment(tile, context) {
      const scale = context.pyramid.metersPerUnit ?? 1;
      const geo = (x: number, z: number): TerrainSemanticPoint =>
        webMercatorToWgs84(x / scale, z / scale);
      const nw = geo(...context.origin),
        se = geo(context.origin[0] + context.tileSize, context.origin[1] + context.tileSize);
      // A planetary overview needs no airport geometry or global catalog download.
      if (context.tileSize > 100_000) return tile;
      const airports = await inBounds([nw[0], se[1], se[0], nw[1]]);
      if (context.signal.aborted) return tile;
      const local = (p: TerrainSemanticPoint): TerrainSemanticPoint => {
        const [x, z] = wgs84ToWebMercator(...p);
        return [
          (x * scale - context.origin[0]) / context.tileSize,
          (z * scale - context.origin[1]) / context.tileSize,
        ];
      };
      const overlaps = (points: TerrainSemanticPoint[], margin = 0): boolean =>
        Math.min(...points.map((p) => p[0])) <= 1 + margin &&
        Math.max(...points.map((p) => p[0])) >= -margin &&
        Math.min(...points.map((p) => p[1])) <= 1 + margin &&
        Math.max(...points.map((p) => p[1])) >= -margin;
      const strips = airports.flatMap((a) =>
        a.runways.flatMap((r) => {
          const line = r.ends.map(local);
          if (!overlaps(line, r.width / context.tileSize)) return [];
          return [
            {
              id: `airport:${a.id}:${r.id}`,
              name: a.name,
              class: 'aeroway',
              subclass: 'runway',
              ref: r.id,
              width: r.width,
              surface: r.surface,
              lines: [line],
            },
          ];
        }),
      );
      const relevant = layouts.filter(
        (l) =>
          l.bounds[0] <= se[0] &&
          l.bounds[2] >= nw[0] &&
          l.bounds[1] <= nw[1] &&
          l.bounds[3] >= se[1],
      );
      if (!strips.length && !relevant.length) return tile;
      const polygons = (ps: TerrainSemanticTile['buildings'][number]['polygons']) =>
        ps
          .map((p) => ({
            outer: p.outer.map(local),
            ...(p.holes ? { holes: p.holes.map((h) => h.map(local)) } : {}),
          }))
          .filter((p) => overlaps(p.outer));
      const extra: TerrainSemanticTile = {
        format: 'molen/terrain-semantics@1',
        landcover: [],
        water: [],
        transportation: [],
        buildings: [],
        pois: [],
      };
      for (const layout of relevant) {
        for (const f of layout.tile.landcover) {
          const ps = polygons(f.polygons);
          if (ps.length) extra.landcover.push({ ...f, polygons: ps });
        }
        for (const f of layout.tile.buildings) {
          const ps = polygons(f.polygons);
          if (ps.length) extra.buildings.push({ ...f, polygons: ps });
        }
        for (const f of layout.tile.transportation) {
          const lines = f.lines
            .map((l) => l.map(local))
            .filter((l) => overlaps(l, (f.width ?? 25) / context.tileSize));
          if (lines.length) extra.transportation.push({ ...f, lines });
        }
      }
      // Source ids replace their generalized basemap copy. Runways match spatially as map IDs differ.
      const ids = new Set(extra.buildings.map((b) => String(b.id)));
      const airportGround = extra.landcover
        .filter((f) => f.class === 'aerodrome')
        .flatMap((f) => f.polygons);
      const insideAirport = (ps: TerrainSemanticTile['buildings'][number]['polygons']): boolean =>
        ps.some((p) => {
          const center = p.outer.reduce<TerrainSemanticPoint>(
            (a, v) => [a[0] + v[0] / p.outer.length, a[1] + v[1] / p.outer.length],
            [0, 0],
          );
          return airportGround.some((ground) => pointInPolygon(center, ground));
        });
      const isDuplicateRunway = (f: TerrainSemanticTile['transportation'][number]): boolean => {
        if (!/runway/.test(`${f.class} ${f.subclass ?? ''}`)) return false;
        return f.lines.some((l) =>
          l.some((p) =>
            strips.some((r) => {
              const a = r.lines[0]?.[0],
                b = r.lines[0]?.[1];
              if (!a || !b) return false;
              const dx = b[0] - a[0],
                dz = b[1] - a[1],
                len = dx * dx + dz * dz;
              const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len));
              return (
                Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) * context.tileSize < r.width
              );
            }),
          ),
        );
      };
      return {
        ...tile,
        landcover: [
          ...tile.landcover.filter(
            (f) => !/parking|aerodrome|apron/.test(f.class) || !insideAirport(f.polygons),
          ),
          ...extra.landcover,
        ],
        buildings: [
          ...tile.buildings.filter((b) => !ids.has(String(b.id)) && !insideAirport(b.polygons)),
          ...extra.buildings,
        ],
        transportation: [
          ...tile.transportation.filter(
            (f) =>
              !isDuplicateRunway(f) &&
              !extra.transportation.some((e) => String(e.id) === String(f.id)),
          ),
          ...extra.transportation,
          ...strips,
        ],
        pois: [
          ...(tile.pois ?? []),
          ...strips.map((r) => ({
            id: r.id,
            class: 'aerodrome',
            name: r.name,
            point: r.lines[0]?.[0] as TerrainSemanticPoint,
          })),
        ],
      };
    },
  };
}

/** Wrap outside observers, so traffic and rendering consume the same airport geometry. */
export function withEarthAirports(
  renderer: TerrainSemanticTileRenderer,
  airports?: EarthAirports,
): TerrainSemanticTileRenderer {
  if (!airports) return renderer;
  return {
    async createEmptyTile(context) {
      const empty = createEmptyTerrainSemanticTile();
      const tile = await airports.augment(empty, context);
      if (tile === empty) return undefined;
      // Missing basemap coverage is not evidence of a forest around the airport. Suppress
      // default open-ground scatter while the observed airport polygons keep their own cover.
      tile.landcover.unshift({
        class: 'open_ground',
        density: 0,
        polygons: [
          {
            outer: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      });
      return renderer.createTile(tile, context);
    },
    async createTile(tile, context) {
      return renderer.createTile(await airports.augment(tile, context), context);
    },
    disposeTile: (object) => renderer.disposeTile?.(object),
  };
}
