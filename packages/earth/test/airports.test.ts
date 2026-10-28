import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTerrainSemanticPyramidLayer,
  type TerrainPyramidTileLayerContext,
  withTerrainTunnels,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  webMercatorScaleAtLatitude,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it, vi } from 'vitest';
import {
  createEarthAirports,
  type EarthAirportIndex,
  withEarthAirports,
} from '../src/client/airports';

const root = fileURLToPath(new URL('../../../content/earth/', import.meta.url));
const read = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(join(root, path), 'utf8')) as T;
const context = (
  longitude = -122.32,
  latitude = 47.55,
  size = 6000,
): TerrainPyramidTileLayerContext => {
  const scale = webMercatorScaleAtLatitude(latitude);
  const origin = wgs84ToWebMercator(longitude, latitude).map((v) => v * scale) as [number, number];
  return {
    origin,
    tileSize: size,
    pyramid: { metersPerUnit: scale },
    signal: new AbortController().signal,
  } as TerrainPyramidTileLayerContext;
};

describe('shipped airport geometry', () => {
  it('renders Boeing Field when the Seattle basemap has no tile south of 47.55 degrees', async () => {
    const airports = await createEarthAirports(
      await read<EarthAirportIndex>('airports/index.json'),
      read,
    );
    const render = vi.fn((_tile: ReturnType<typeof createEmptyTerrainSemanticTile>) => undefined);
    const source = { load: async () => undefined };
    const renderer = withTerrainTunnels(
      withEarthAirports({ createTile: render }, airports),
      source,
      source,
      14,
    );
    const layer = createTerrainSemanticPyramidLayer({
      id: 'airport-test',
      category: 'human-feature',
      source,
      renderer,
    });
    await layer.createTile(context());
    expect(render).toHaveBeenCalledOnce();
    const tile = render.mock.calls[0]?.[0] as unknown as ReturnType<
      typeof createEmptyTerrainSemanticTile
    >;
    expect(tile.transportation.some((f) => f.id === 'airport:KBFI:14R/32L')).toBe(true);
    expect(tile.landcover[0]).toMatchObject({ class: 'open_ground', density: 0 });
    render.mockClear();
    await layer.createTile(context(-140, 30, 1000));
    expect(render).not.toHaveBeenCalled();
  });
  it('adds both Boeing Field runways with measured dimensions, mapped aprons, taxiways and hangars', async () => {
    const airports = await createEarthAirports(
      await read<EarthAirportIndex>('airports/index.json'),
      read,
    );
    const source = createEmptyTerrainSemanticTile();
    const tile = await airports.augment(source, context());
    const strips = tile.transportation.filter((f) => String(f.id).startsWith('airport:KBFI:'));
    expect(strips.map((r) => r.ref)).toEqual(['14L/32R', '14R/32L']);
    expect(strips.map((r) => r.width)).toEqual([30.48, 60.96]);
    const major = strips[1]?.lines[0];
    expect(major).toBeDefined();
    if (!major?.[0] || !major[1]) throw new Error('Missing runway');
    const length = Math.hypot(major[1][0] - major[0][0], major[1][1] - major[0][1]) * 6000;
    expect(length).toBeGreaterThan(3000);
    expect(length).toBeLessThan(3100);
    expect(tile.landcover.filter((f) => f.class === 'apron')).toHaveLength(12);
    expect(tile.transportation.filter((f) => f.subclass === 'taxiway').length).toBeGreaterThan(50);
    expect(tile.buildings.filter((f) => f.class === 'hangar').length).toBeGreaterThan(8);
    expect(source.transportation).toHaveLength(0);
  });

  it('keeps full runway endpoints on adjacent tiles and deduplicates mapped runway fragments', async () => {
    const airports = await createEarthAirports(
      await read<EarthAirportIndex>('airports/index.json'),
      read,
    );
    const a = context(-122.311, 47.541, 1200);
    const first = await airports.augment(createEmptyTerrainSemanticTile(), a);
    const runway = first.transportation.find((f) => f.id === 'airport:KBFI:14R/32L');
    expect(runway?.lines[0]?.[1]?.[1]).toBeGreaterThan(1);
    const duplicate = createEmptyTerrainSemanticTile();
    if (!runway) throw new Error('Missing runway');
    duplicate.transportation.push({ ...runway, id: 'basemap' });
    const again = await airports.augment(duplicate, a);
    expect(again.transportation.some((f) => f.id === 'basemap')).toBe(false);
    const b = { ...a, origin: [a.origin[0], a.origin[1] + 1200] as [number, number] };
    const next = await airports.augment(createEmptyTerrainSemanticTile(), b);
    const other = next.transportation.find((f) => f.id === runway.id);
    expect(other?.lines[0]?.[0]?.[1]).toBeCloseTo((runway.lines[0]?.[0]?.[1] ?? 0) - 1, 8);
  });

  it('loads nearby cells once, keeps unrelated places intact and skips planetary views', async () => {
    const paths: string[] = [];
    const airports = await createEarthAirports(
      await read<EarthAirportIndex>('airports/index.json'),
      async <T>(path: string) => {
        paths.push(path);
        return read<T>(path);
      },
    );
    const tile = createEmptyTerrainSemanticTile();
    const ocean = context(-140, 30, 1000);
    expect(await airports.augment(tile, ocean)).toBe(tile);
    await airports.augment(tile, ocean);
    expect(new Set(paths).size).toBe(paths.length);
    const before = paths.length;
    expect(await airports.augment(tile, context(-122, 48, 200_000))).toBe(tile);
    expect(paths).toHaveLength(before);
  });
});
