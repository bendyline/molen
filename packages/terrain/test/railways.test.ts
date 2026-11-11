import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { terrainLinePath } from '../src/line-path';
import { TERRAIN_SURFACE_KIND } from '../src/linear-features';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  findTerrainRailCrossings,
  findTerrainRailTurnouts,
  placeTerrainRailSignals,
  placeTerrainRailSigns,
  TERRAIN_RAILWAY_GROUND,
  type TerrainRailLine,
  terrainRailElectrified,
  terrainRailMastStations,
  terrainRailTrack,
  terrainRailVariant,
} from '../src/rail-features';
import { createTerrainSemanticObject, disposeTerrainSemanticObject } from '../src/semantic-client';
import {
  createEmptyTerrainSemanticTile,
  type TerrainPoiFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import {
  createTerrainSurfaceObject,
  createTerrainSurfaceRenderer,
  disposeTerrainSurfaceObject,
} from '../src/surface-client';
import { TERRAIN_RAIL_MESHES, type TerrainRailLamp } from '../src/surface-rail';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';
import {
  createTerrainSurfaceWorkerBridge,
  installTerrainSurfaceWorker,
  type TerrainSurfaceWorker,
} from '../src/surface-worker';

const SIZE = 400;

/** A flat finest-level tile, SIZE meters across, at `origin`. */
function context(origin: [number, number] = [0, 0]): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    tileSize: SIZE,
    origin,
    pyramid: {
      name: 'railways-test',
      origin: [0, 0],
      rootSize: SIZE * 8,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 9,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(81), 9, 9, {
      origin,
      worldSize: [SIZE, SIZE],
      height: { min: 0, max: 20 },
    }),
    signal: new AbortController().signal,
    admission: { run: async (task) => task() },
  };
}

const at = (x: number, z: number): TerrainSemanticPoint => [x / SIZE, z / SIZE];

function rail(
  points: [number, number][],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature {
  return {
    class: 'rail',
    subclass: 'rail',
    lines: [points.map(([x, z]) => at(x, z))],
    ...extra,
  };
}

function line(
  points: [number, number][],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainRailLine {
  const feature = rail(points, extra);
  return { feature, path: terrainLinePath(feature.lines[0] ?? [], SIZE), width: 6 };
}

function poi(kind: string, x: number, z: number): TerrainPoiFeature {
  return { class: kind, point: at(x, z) };
}

/**
 * An east-west main line at z = 200 with a siding branching off it at x = 150 to run 4.5 m
 * south; a street crossing both at x = 300; a signal beside the main line short of the
 * turnout; a light rail line further south; and a disused spur to the north.
 */
function fixture(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    rail([
      [-20, 200],
      [420, 200],
    ]),
    rail(
      [
        [150, 200],
        [190, 204.5],
        [420, 204.5],
      ],
      { service: 'siding' },
    ),
    {
      class: 'minor_road',
      subclass: 'residential',
      lines: [[at(300, -20), at(300, 420)]],
    },
    rail(
      [
        [-20, 330],
        [420, 330],
      ],
      { subclass: 'light_rail' },
    ),
    rail(
      [
        [-20, 80],
        [420, 80],
      ],
      { subclass: 'disused' },
    ),
  );
  tile.pois = [poi('signal', 110, 202.6), poi('level_crossing', 300, 200), poi('switch', 150, 200)];
  return tile;
}

function mesh(object: THREE.Object3D, name: string): THREE.Mesh | undefined {
  return object.getObjectByName(name) as THREE.Mesh | undefined;
}

describe('railway classification', () => {
  it('reads mode, service, gauge and sleepers from the source tags', () => {
    const main = terrainRailTrack({ class: 'rail', subclass: 'rail' });
    expect(main).toMatchObject({ mode: 'heavy', service: 'main', gauge: 1.435, concrete: true });
    const yard = terrainRailTrack({ class: 'rail', subclass: 'rail', service: 'yard' });
    expect(yard).toMatchObject({ service: 'yard', concrete: false, prism: false });
    expect((yard?.bed ?? 0) < (main?.bed ?? 0)).toBe(true);
    expect(terrainRailTrack({ class: 'rail', subclass: 'light_rail' })?.mode).toBe('light');
    expect(terrainRailTrack({ class: 'rail', subclass: 'tram' })?.mode).toBe('tram');
    expect(terrainRailTrack({ class: 'rail', subclass: 'disused' })?.disused).toBe(true);
    expect(terrainRailTrack({ class: 'rail', subclass: 'abandoned' })).toBeUndefined();
    expect(terrainRailTrack({ class: 'rail', subclass: 'rail' }, 1.067)?.gauge).toBe(1.067);
    expect(
      terrainRailTrack({ class: 'rail', subclass: 'rail', name: '東海道新幹線' }, 1.067)?.gauge,
    ).toBe(1.435);
    expect(terrainRailTrack({ class: 'rail', subclass: 'subway' }, 1.676)?.gauge).toBe(1.435);
    expect(terrainRailTrack({ class: 'rail', subclass: 'rail' }, 1.676)?.gauge).toBe(1.676);
  });

  it('electrifies light rail by default, heavy rail only when a region opts in', () => {
    const heavy = terrainRailTrack({ class: 'rail', subclass: 'rail' });
    const light = terrainRailTrack({ class: 'rail', subclass: 'light_rail' });
    const disused = terrainRailTrack({ class: 'rail', subclass: 'disused' });
    if (!heavy || !light || !disused) throw new Error('unclassified');
    expect(terrainRailElectrified(heavy)).toBe(false);
    expect(terrainRailElectrified(heavy, 'all')).toBe(true);
    expect(terrainRailElectrified(light)).toBe(true);
    expect(terrainRailElectrified(light, 'none')).toBe(false);
    expect(terrainRailElectrified(disused, 'all')).toBe(false);
  });

  it('packs gauge and sleepers above the fray bits for the pavement material', () => {
    const main = terrainRailTrack({ class: 'rail', subclass: 'rail' });
    const narrow = terrainRailTrack({ class: 'rail', subclass: 'rail', service: 'yard' }, 1.067);
    if (!main || !narrow) throw new Error('unclassified');
    expect(terrainRailVariant(main)).toBe(4);
    expect(terrainRailVariant(narrow)).toBe(1 + 8);
  });

  it('validates the electrification option', () => {
    expect(
      resolveTerrainSurfaceStyle('modern', { railElectrification: 'all' }).railElectrification,
    ).toBe('all');
    expect(() =>
      resolveTerrainSurfaceStyle('modern', {
        railElectrification: 'some' as unknown as 'all',
      }),
    ).toThrow(/railElectrification/);
    expect(resolveTerrainSurfaceStyle('minimal').railEquipment).toBe(false);
  });
});

describe('railway topology', () => {
  it('groups tracks a road crosses at grade into one crossing, and skips bridges and layers', () => {
    const rails = [
      line([
        [0, 200],
        [400, 200],
      ]),
      line([
        [0, 204.5],
        [400, 204.5],
      ]),
      line(
        [
          [0, 260],
          [400, 260],
        ],
        { bridge: true },
      ),
      line(
        [
          [0, 300],
          [400, 300],
        ],
        { layer: 1 },
      ),
    ];
    const street = line([
      [300, 0],
      [300, 400],
    ]);
    street.feature = { ...street.feature, class: 'minor_road', subclass: 'residential' };
    const crossings = findTerrainRailCrossings(
      rails,
      [street],
      [poi('level_crossing', 300, 201)],
      SIZE,
    );
    expect(crossings).toHaveLength(1);
    expect(crossings[0]?.tracks.map((t) => t.line)).toEqual([0, 1]);
    expect(crossings[0]?.mapped).toBe(true);
    expect(crossings[0]?.x).toBeCloseTo(300, 5);
    expect(crossings[0]?.z).toBeCloseTo(202.25, 5);
  });

  it('finds a turnout where a track leaves another, with its side and facing direction', () => {
    const rails = [
      line([
        [0, 200],
        [400, 200],
      ]),
      line([
        [150, 200],
        [190, 204.5],
        [400, 204.5],
      ]),
    ];
    const [turnout, ...rest] = findTerrainRailTurnouts(rails, [poi('switch', 150.5, 200.2)], SIZE);
    expect(rest).toHaveLength(0);
    expect(turnout).toMatchObject({ line: 0, diverging: 1, side: 1, mapped: true });
    expect(turnout?.dx).toBeCloseTo(1, 5);
    expect(turnout?.x).toBeCloseTo(150, 5);
  });

  it('finds a turnout where three track ends meet, and stands in for a lone mapped switch', () => {
    const rails = [
      line([
        [0, 200],
        [200, 200],
      ]),
      line([
        [200, 200],
        [400, 200],
      ]),
      line([
        [200, 200],
        [240, 196],
        [400, 196],
      ]),
      line([
        [0, 100],
        [400, 100],
      ]),
    ];
    const turnouts = findTerrainRailTurnouts(rails, [poi('switch', 80, 100)], SIZE);
    const junction = turnouts.find((t) => Math.abs(t.x - 200) < 1);
    expect(junction).toMatchObject({ line: 1, diverging: 2, side: -1, mapped: false });
    expect(junction?.dx).toBeCloseTo(1, 5);
    const lone = turnouts.find((t) => Math.abs(t.z - 100) < 1);
    expect(lone).toMatchObject({ line: 3, side: 0, mapped: true });
  });

  it('faces a signal toward the junction it protects, mast on the side traffic keeps to', () => {
    const rails = [
      line([
        [0, 200],
        [400, 200],
      ]),
      line([
        [150, 200],
        [190, 204.5],
        [400, 204.5],
      ]),
    ];
    const tracks = rails.map((r) => terrainRailTrack(r.feature));
    const turnouts = findTerrainRailTurnouts(rails, [], SIZE);
    const options = { tileSize: SIZE, origin: [0, 0] as const };
    const [signal] = placeTerrainRailSignals(rails, tracks, [poi('signal', 110, 200)], turnouts, {
      ...options,
      drivingSide: 'right',
    });
    // Trains heading east toward the turnout read it; its mast stands to their right (south).
    expect(signal?.dx).toBeCloseTo(1, 5);
    expect(signal?.offset).toBeGreaterThan(2);
    expect(signal?.dwarf).toBe(false);
    const [left] = placeTerrainRailSignals(rails, tracks, [poi('signal', 110, 200)], turnouts, {
      ...options,
      drivingSide: 'left',
    });
    expect(left?.dx).toBeCloseTo(1, 5);
    expect(left?.offset).toBeLessThan(-2);
    // Mapped beside the track, a signal keeps its side and governs the trains it stands right of.
    const [beside] = placeTerrainRailSignals(rails, tracks, [poi('signal', 110, 197)], turnouts, {
      ...options,
      drivingSide: 'right',
    });
    expect(beside?.dx).toBeCloseTo(-1, 5);
    expect(beside?.offset).toBeGreaterThan(2);
  });

  it('places whistle posts ahead of an active crossing on a main line', () => {
    const rails = [
      line([
        [-600, 200],
        [1000, 200],
      ]),
    ];
    const tracks = rails.map((r) => terrainRailTrack(r.feature));
    const street = line([
      [300, 0],
      [300, 400],
    ]);
    street.feature = { ...street.feature, class: 'minor_road', subclass: 'residential' };
    const crossings = findTerrainRailCrossings(rails, [street], [], SIZE);
    const signs = placeTerrainRailSigns(rails, tracks, crossings, [], {
      tileSize: 1000,
      origin: [0, 0],
    }).filter((s) => s.kind === 'whistle');
    // 400 m east of the crossing for westbound trains, on their right (north) and facing them;
    // the eastbound post 400 m west falls outside this tile, so its own tile places it.
    expect(signs).toHaveLength(1);
    expect(signs[0]?.x).toBeCloseTo(300 + 400, 0);
    expect(signs[0]?.z).toBeLessThan(198);
    expect(signs[0]?.dx).toBeCloseTo(1, 5);
  });

  it('fixes mileposts and mast stations in the world, so neighboring tiles agree', () => {
    const world: [number, number][] = [
      [1000, 3200],
      [6000, 3300],
    ];
    const shifted = (origin: [number, number]) => {
      const points = world.map(([x, z]) => [x - origin[0], z - origin[1]] as [number, number]);
      return line(points);
    };
    const a: [number, number] = [1500, 3000],
      b: [number, number] = [1900, 3000];
    const mile = (origin: [number, number]) => {
      const rails = [shifted(origin)];
      return placeTerrainRailSigns(
        rails,
        rails.map((r) => terrainRailTrack(r.feature)),
        [],
        [],
        {
          tileSize: 4000,
          origin,
        },
      )
        .filter((s) => s.kind === 'milepost')
        .map((s) => `${(s.x + origin[0]).toFixed(3)}/${(s.z + origin[1]).toFixed(3)}/${s.text}`);
    };
    expect(mile(a).length).toBeGreaterThan(0);
    expect(mile(a)).toEqual(mile(b));
    const masts = (origin: [number, number]) =>
      terrainRailMastStations(shifted(origin).path, origin, 55).map((s) =>
        Math.round(s.x + origin[0]),
      );
    const common = (list: number[]) => list.filter((x) => x > 2500 && x < 5500);
    expect(common(masts(a))).toEqual(common(masts(b)));
    expect(common(masts(a)).length).toBeGreaterThan(40);
  });
});

describe('railway surfaces', () => {
  it('draws track beds, rails in 3D, crossing gear, a signal and light-rail catenary', () => {
    const object = createTerrainSurfaceObject(fixture(), context());
    const stats = object.userData.surfaceStats;
    // The street crosses the main line and siding together, the light rail and the disused spur.
    expect(stats).toMatchObject({
      railTracks: 4,
      railCrossings: 3,
      railSwitches: 1,
      railSignals: 1,
    });
    // The bed carries the track kind (with the variant's sleepers) for the pavement material.
    const bed = mesh(object, TERRAIN_RAIL_MESHES.bed);
    const detail = bed?.geometry.getAttribute('surfaceDetail');
    const kinds = new Set<number>();
    for (let i = 0; i < (detail?.count ?? 0); i++)
      kinds.add(Math.floor((detail?.getZ(i) ?? 0) / 128 + 0.001));
    expect(kinds.has(TERRAIN_SURFACE_KIND.track)).toBe(true);
    const rails = mesh(object, TERRAIN_RAIL_MESHES.rails);
    expect(rails?.userData.walkIgnore).toBe(true);
    // Rails are the pavement material's rail kind, polished on the heads' tops only.
    const railDetail = rails?.geometry.getAttribute('surfaceDetail');
    let polished = 0;
    for (let i = 0; i < (railDetail?.count ?? 0); i++) {
      expect(Math.floor((railDetail?.getZ(i) ?? 0) / 128)).toBe(TERRAIN_SURFACE_KIND.rail);
      if ((railDetail?.getW(i) ?? 0) === 4) polished++;
    }
    expect(polished).toBeGreaterThan(0);
    expect(polished).toBeLessThan(railDetail?.count ?? 0);
    // Crossbucks and advance warnings are sign faces; the signal's lit aspect is a lamp.
    expect(mesh(object, 'surface:road-signs')).toBeDefined();
    const lamps = object.userData.railLamps as TerrainRailLamp[];
    expect(lamps).toHaveLength(1);
    expect(mesh(object, TERRAIN_RAIL_MESHES.lamps)).toBeDefined();
    // Only the light rail line is wired by default.
    const wires = mesh(object, TERRAIN_RAIL_MESHES.wires) as THREE.InstancedMesh | undefined;
    expect(wires?.count).toBeGreaterThan(0);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (let i = 0; i < (wires?.count ?? 0); i++) {
      wires?.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(Math.abs(position.z - 330)).toBeLessThan(5);
    }
    disposeTerrainSurfaceObject(object);
  });

  it('wires main lines only where electrification is all, and none with none or a minimal style', () => {
    const count = (options: Parameters<typeof createTerrainSurfaceObject>[2]): number => {
      const object = createTerrainSurfaceObject(fixture(), context(), options);
      const wires = mesh(object, TERRAIN_RAIL_MESHES.wires) as THREE.InstancedMesh | undefined;
      disposeTerrainSurfaceObject(object);
      return wires?.count ?? 0;
    };
    const light = count({});
    expect(count({ details: { railElectrification: 'all' } })).toBeGreaterThan(light);
    expect(
      count({
        style: { ...resolveTerrainSurfaceStyle('modern'), railElectrification: 'all' },
      }),
    ).toBeGreaterThan(light);
    expect(count({ details: { railElectrification: 'none' } })).toBe(0);
    expect(count({ style: 'minimal' })).toBe(0);
  });

  it('hides rails and wires by distance counting the camera height, not other detail', () => {
    const renderer = createTerrainSurfaceRenderer({});
    const root = renderer.createTile(fixture(), context());
    root.updateMatrixWorld(true);
    const object = root.children[0] as THREE.Object3D;
    const visible = (name: string): boolean | undefined => mesh(object, name)?.visible;
    renderer.updateDetail(new THREE.Vector3(200, 2, 200));
    expect(visible(TERRAIN_RAIL_MESHES.rails)).toBe(true);
    expect(visible(TERRAIN_RAIL_MESHES.wires)).toBe(true);
    // From a plane 400 m up, the rails and wires go; signs and fixtures stay.
    renderer.updateDetail(new THREE.Vector3(200, 400, 200));
    expect(visible(TERRAIN_RAIL_MESHES.rails)).toBe(false);
    expect(visible(TERRAIN_RAIL_MESHES.wires)).toBe(false);
    expect(visible('surface:street-fixtures')).toBe(true);
    renderer.dispose();
  });

  it('places the same railway the same way on every build', () => {
    const a = createTerrainSurfaceObject(fixture(), context());
    const b = createTerrainSurfaceObject(fixture(), context());
    expect(a.userData.railLamps).toEqual(b.userData.railLamps);
    const fixtures = (o: THREE.Object3D) =>
      Array.from(
        (mesh(o, 'surface:street-fixtures') as THREE.InstancedMesh).instanceMatrix
          .array as Float32Array,
      );
    expect(fixtures(a)).toEqual(fixtures(b));
    disposeTerrainSurfaceObject(a);
    disposeTerrainSurfaceObject(b);
  });

  it('builds the same rails, lamps and wires through the surface worker', async () => {
    const listeners = new Map<string, (event: { data?: unknown }) => void>();
    let handler: ((event: { data?: unknown }) => void) | undefined;
    const requests: unknown[] = [];
    const replies: unknown[] = [];
    installTerrainSurfaceWorker({
      addEventListener: (_type, listener) => {
        handler = listener;
      },
      postMessage: (message, transfer) => {
        replies.push(structuredClone(message, { transfer: transfer as ArrayBuffer[] }));
      },
    });
    const thread: TerrainSurfaceWorker = {
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type) => {
        listeners.delete(type);
      },
      postMessage: (message, transfer) => {
        requests.push(structuredClone(message, { transfer: transfer as ArrayBuffer[] }));
      },
      terminate() {},
    };
    const bridge = createTerrainSurfaceWorkerBridge(thread);
    const renderer = createTerrainSurfaceRenderer({}, bridge);
    const pending = renderer.createTileAsync(fixture(), context());
    handler?.({ data: requests.shift() });
    listeners.get('message')?.({ data: replies.shift() });
    const root = await pending;
    const actual = root?.children[0];
    if (!actual) throw new Error('Missing surface result');
    const direct = createTerrainSurfaceObject(fixture(), context());
    expect(actual.userData.railLamps).toEqual(direct.userData.railLamps);
    expect(mesh(actual, TERRAIN_RAIL_MESHES.lamps)).toBeDefined();
    const rails = mesh(actual, TERRAIN_RAIL_MESHES.rails);
    expect(rails?.userData.walkIgnore).toBe(true);
    expect((rails?.material as THREE.MeshStandardMaterial).metalness).toBeGreaterThan(0);
    expect(rails?.geometry.getAttribute('position').array).toEqual(
      mesh(direct, TERRAIN_RAIL_MESHES.rails)?.geometry.getAttribute('position').array,
    );
    expect(rails?.geometry.getAttribute('surfaceDetail').array).toEqual(
      mesh(direct, TERRAIN_RAIL_MESHES.rails)?.geometry.getAttribute('surfaceDetail').array,
    );
    expect((mesh(actual, TERRAIN_RAIL_MESHES.wires) as THREE.InstancedMesh).count).toBe(
      (mesh(direct, TERRAIN_RAIL_MESHES.wires) as THREE.InstancedMesh).count,
    );
    expect(renderer.stats().railSignals).toBe(1);
    renderer.dispose();
    disposeTerrainSurfaceObject(direct);
  });
});

describe('railway land', () => {
  it('paints mapped railway land ballast grey, even where a host palette does not name it', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover.push({
      class: 'railway',
      polygons: [{ outer: [at(0, 0), at(SIZE, 0), at(SIZE, SIZE), at(0, SIZE)] }],
    });
    const expected = new THREE.Color(TERRAIN_RAILWAY_GROUND);
    for (const options of [{}, { landcoverColors: { grass: '#5d8a4c', industrial: '#9d978b' } }]) {
      const object = createTerrainSemanticObject(tile, context(), options);
      const landcover = object.getObjectByName('semantic:landcover') as THREE.Mesh;
      const color = landcover.geometry.getAttribute('color');
      expect(color.count).toBeGreaterThan(0);
      for (let i = 0; i < color.count; i++) {
        expect(color.getX(i)).toBeCloseTo(expected.r, 2);
        expect(color.getZ(i)).toBeCloseTo(expected.b, 2);
      }
      disposeTerrainSemanticObject(object);
    }
  });
});
