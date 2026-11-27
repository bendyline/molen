import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
  TerrainTransportationFeature,
} from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarthMapScreen, EarthMovingMap, movingMapRoadKind } from '../src/client/moving-map';

const empty = (): TerrainSemanticTile => ({
  format: 'molen/terrain-semantics@1',
  landcover: [],
  water: [],
  transportation: [],
  buildings: [],
});
/** What the map reads of a tile's context: where it is and its level. */
const context = (origin: [number, number], tileSize: number, level = 15) =>
  ({
    address: { level, x: Math.floor(origin[0] / tileSize), z: Math.floor(origin[1] / tileSize) },
    origin,
    tileSize,
  }) as unknown as TerrainPyramidTileLayerContext;

const road = (feature: Partial<TerrainTransportationFeature>): TerrainTransportationFeature => ({
  class: 'minor_road',
  lines: [
    [
      [0, 0],
      [1, 1],
    ],
  ],
  ...feature,
});

/** A 1 km tile at the origin: Buena Road north–south at x = 500, Highland Drive east–west at z = 500. */
function crossroads(): TerrainSemanticTile {
  const tile = empty();
  tile.transportation = [
    road({
      class: 'major_road',
      subclass: 'primary',
      name: 'Buena Road',
      ref: 'WA 22',
      width: 10,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    }),
    road({
      subclass: 'residential',
      name: 'Highland Drive',
      width: 8,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    }),
    road({
      class: 'highway',
      subclass: 'motorway',
      ref: 'I 82;US 12',
      lines: [
        [
          [0.9, 0],
          [0.9, 1],
        ],
      ],
    }),
    road({ class: 'path', subclass: 'footway', name: 'Canal Trail' }),
  ];
  tile.water = [
    {
      class: 'lake',
      polygons: [
        {
          outer: [
            [0, 0],
            [0.2, 0],
            [0.2, 0.2],
          ],
        },
      ],
    },
  ];
  return tile;
}

/** Yaw of a vehicle going north (-Z), east (+X), south (+Z). */
const NORTH = Math.PI;
const EAST = Math.PI / 2;

describe('movingMapRoadKind', () => {
  it('draws drivable roads by kind and leaves out ways no car drives', () => {
    expect(movingMapRoadKind(road({ class: 'highway', subclass: 'motorway' }))).toBe(4);
    expect(movingMapRoadKind(road({ class: 'major_road', subclass: 'primary' }))).toBe(3);
    expect(movingMapRoadKind(road({ subclass: 'trunk_link' }))).toBe(3);
    expect(movingMapRoadKind(road({ subclass: 'residential' }))).toBe(2);
    expect(movingMapRoadKind(road({ subclass: 'service', service: 'driveway' }))).toBe(1);
    expect(movingMapRoadKind(road({ subclass: 'residential', tunnel: true }))).toBe(0);
    for (const feature of [
      road({ class: 'path', subclass: 'footway' }),
      road({ class: 'rail', subclass: 'light_rail' }),
      road({ class: 'ferry' }),
      road({ class: 'aeroway', subclass: 'taxiway' }),
    ])
      expect(movingMapRoadKind(feature)).toBeUndefined();
  });
});

describe('EarthMovingMap.streetAt', () => {
  it('names the road the car is on, preferring the one it drives along at a junction', () => {
    const map = new EarthMovingMap();
    map.observer.added(new THREE.Group(), crossroads(), context([0, 0], 1000));
    expect(map.streetAt(503, 300, NORTH)).toBe('Buena Road');
    expect(map.streetAt(500, 500, NORTH)).toBe('Buena Road');
    expect(map.streetAt(500, 500, EAST)).toBe('Highland Drive');
    // A road known by its number alone prints its first route.
    expect(map.streetAt(900, 200, NORTH)).toBe('I 82');
    // Paths never name the street, and nothing within reach names none.
    expect(map.streetAt(100, 100, NORTH)).toBe('');
  });

  it('reads the finest tile holding the place, and forgets an evicted tile', () => {
    const map = new EarthMovingMap();
    const coarse = empty();
    coarse.transportation = [
      road({
        name: 'Old Generalized Road',
        lines: [
          [
            [0.125, 0],
            [0.125, 1],
          ],
        ],
      }),
    ];
    map.observer.added(new THREE.Group(), coarse, context([0, 0], 4000, 13));
    expect(map.streetAt(500, 300, NORTH)).toBe('Old Generalized Road');
    const fine = new THREE.Group();
    map.observer.added(fine, crossroads(), context([0, 0], 1000));
    expect(map.streetAt(500, 300, NORTH)).toBe('Buena Road');
    map.observer.removed(fine);
    expect(map.streetAt(500, 300, NORTH)).toBe('Old Generalized Road');
  });
});

type Call = [string, unknown[]];

/** A 2D context that records every call and accepts every property. */
function recordingContext(canvas: FakeCanvas): Record<string, unknown> & { calls: Call[] } {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {
    canvas,
    calls,
    measureText: (text: string) => ({ width: text.length * 10 }),
  };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key as string];
      return (...args: unknown[]) => {
        calls.push([String(key), args]);
      };
    },
    set(object, key, value) {
      object[key as string] = value;
      return true;
    },
  }) as Record<string, unknown> & { calls: Call[] };
}

class FakeCanvas {
  static made: FakeCanvas[] = [];
  readonly context: Record<string, unknown> & { calls: Call[] };
  constructor(
    public width: number,
    public height: number,
  ) {
    this.context = recordingContext(this);
    FakeCanvas.made.push(this);
  }
  getContext(): unknown {
    return this.context;
  }
}

/**
 * What the view drew into its bases (every canvas but `screen`) since the last call: the tiles
 * (each pass clips to its tile's square) and the points traced.
 */
function drawn(screen: FakeCanvas): { tiles: number; points: number } {
  const squares = new Set<string>();
  let points = 0;
  for (const canvas of FakeCanvas.made) {
    if (canvas === screen) continue;
    for (const [name, args] of canvas.context.calls) {
      if (name === 'rect') squares.add(args.join());
      if (name === 'moveTo' || name === 'lineTo') points++;
    }
    canvas.context.calls.length = 0;
  }
  return { tiles: squares.size, points };
}

describe('EarthMovingMap.view', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeCanvas.made = [];
  });

  it('is undefined where the platform has no 2D canvas', () => {
    expect(new EarthMovingMap().view(512, 297)).toBeUndefined();
  });

  it('draws a share of points a frame, four shares until the screen has a base', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const map = new EarthMovingMap();
    // 200 m tiles over a square kilometre, each with its own crossroads and a winding lane of
    // 1000 points.
    const winding = (): TerrainSemanticTile => {
      const tile = crossroads();
      tile.transportation.push(
        road({
          subclass: 'residential',
          lines: [Array.from({ length: 1000 }, (_, i) => [i / 1000, 0.3 + 0.01 * (i % 2)])],
        }),
      );
      return tile;
    };
    for (let x = 0; x < 1000; x += 200)
      for (let z = 0; z < 1000; z += 200)
        map.observer.added(new THREE.Group(), winding(), context([x, z], 200, 17));
    const view = map.view(512, 297);
    if (view === undefined) throw new Error('no view');
    const screen = new FakeCanvas(512, 297);
    /** The base the screen showed: the canvas it drew from. */
    let shown: unknown;
    const draw = (
      pose: { x: number; z: number; yaw: number },
      time: number,
    ): { tiles: number; points: number } => {
      screen.context.calls.length = 0;
      view.draw(screen.context as unknown as CanvasRenderingContext2D, { ...pose, speed: 0 }, time);
      shown = screen.context.calls.find(([name]) => name === 'drawImage')?.[1][0];
      return drawn(screen);
    };
    const pose = { x: 503, z: 300, yaw: NORTH };
    // Standing still the screen spans 260 m: a base 1088 px, 553 m square, centred 33 m ahead
    // (x 224-776, z -9-544) overlaps three columns and three rows of tiles. On boarding the screen
    // shows bare ground until the first base is done, four shares of points a frame.
    let points = 0;
    let boarding = 0;
    for (let time = 0; shown === undefined && boarding < 50; time += 30, boarding++) {
      const frame = draw(pose, time);
      expect(frame.points).toBeLessThanOrEqual(4 * 600 + 1000);
      points += frame.points;
    }
    expect(boarding).toBeGreaterThan(1);
    expect(points).toBeGreaterThan(9 * 1000);
    const before = shown;
    expect(before).toBeDefined();
    expect(view.street).toBe('Buena Road');
    // Turned so the way the car goes is up: a turn of yaw - π, north up here.
    const turn = (): unknown => screen.context.calls.find(([name]) => name === 'rotate')?.[1][0];
    expect(turn()).toBeCloseTo(0, 9);
    // Driving on a little, and turning, redraws nothing.
    expect(draw({ ...pose, z: 280, yaw: EAST }, 30).points).toBe(0);
    expect(turn()).toBeCloseTo(EAST - Math.PI, 9);
    // A finer tile arrives: the base waits out the refresh, then redraws a share of points a
    // frame (600, and past it at most one 1000-point lane), the old base on show meanwhile.
    map.observer.added(new THREE.Group(), winding(), context([500, 300], 100, 18));
    expect(draw(pose, 500).points).toBe(0);
    const frames: number[] = [];
    let total = 0;
    for (let time = 1100; shown === before && frames.length < 50; time += 30) {
      const { points } = draw(pose, time);
      frames.push(points);
      total += points;
    }
    expect(shown).not.toBe(before);
    expect(total).toBeGreaterThan(10 * 1000);
    expect(Math.max(...frames)).toBeLessThanOrEqual(600 + 1000);
    expect(frames.length).toBeGreaterThanOrEqual(Math.ceil(total / 1600));
    // Done: nothing more to draw.
    expect(draw(pose, 2500).points).toBe(0);
    // Tiles coming and going far from the car (the stream's churn as it drives) redraw nothing.
    const far = new THREE.Group();
    map.observer.added(far, winding(), context([5000, 5000], 200, 17));
    map.observer.removed(far);
    expect(draw(pose, 4000).points).toBe(0);
    view.dispose();
  });

  it('leaves out a coarse tile where finer ones cover it', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const map = new EarthMovingMap();
    // A 400 m tile at (0, 0) (level 16, column 0, row 0) and its four 200 m children.
    const coarse = new THREE.Group();
    map.observer.added(coarse, crossroads(), context([0, 0], 400, 16));
    const children = [0, 200].flatMap((x) =>
      [0, 200].map((z) => {
        const child = new THREE.Group();
        map.observer.added(child, crossroads(), context([x, z], 200, 17));
        return child;
      }),
    );
    const view = map.view(512, 297);
    if (view === undefined) throw new Error('no view');
    const screen = new FakeCanvas(512, 297);
    const draw = (time: number): number => {
      view.draw(
        screen.context as unknown as CanvasRenderingContext2D,
        { x: 200, z: 200, yaw: NORTH, speed: 0 },
        time,
      );
      return drawn(screen).tiles;
    };
    // The base (about 553 m about the middle) reaches past the coarse tile, but only the coarse
    // tile is held there: its children are drawn and it is not.
    expect(draw(0)).toBe(4);
    // One child goes: the coarse tile shows through where it was.
    map.observer.removed(children[0] as THREE.Object3D);
    expect(draw(1000)).toBe(4);
    map.observer.removed(coarse);
    expect(draw(2000)).toBe(3);
    view.dispose();
  });

  it('draws the street name only where there is one', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const map = new EarthMovingMap();
    map.observer.added(new THREE.Group(), crossroads(), context([0, 0], 1000));
    const view = map.view(512, 297);
    if (view === undefined) throw new Error('no view');
    const screen = new FakeCanvas(512, 297);
    const texts = (): unknown[] =>
      screen.context.calls.filter(([name]) => name === 'fillText').map(([, args]) => args[0]);
    view.draw(
      screen.context as unknown as CanvasRenderingContext2D,
      { x: 500, z: 500, yaw: EAST, speed: 12 },
      0,
    );
    expect(texts()).toEqual(['Highland Drive']);
    screen.context.calls.length = 0;
    view.draw(
      screen.context as unknown as CanvasRenderingContext2D,
      { x: 100, z: 100, yaw: EAST, speed: 12 },
      600,
    );
    expect(texts()).toEqual([]);
  });
});

describe('EarthMovingMap air zoom', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeCanvas.made = [];
  });

  it('leaves side streets out once the map spans more than a few kilometres', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const map = new EarthMovingMap();
    // A street and a main road across a 2 km tile.
    const tile = empty();
    tile.transportation = [
      road({
        subclass: 'residential',
        lines: [
          [
            [0, 0.4],
            [1, 0.4],
          ],
        ],
      }),
      road({
        class: 'major_road',
        subclass: 'primary',
        lines: [
          [
            [0, 0.6],
            [1, 0.6],
          ],
        ],
      }),
    ];
    map.observer.added(new THREE.Group(), tile, context([-1000, -1000], 2000, 14));
    /** Strokes traced for a view at `speed`: 2 points each. */
    const traced = (speed: number): number => {
      FakeCanvas.made = [];
      const view = map.view(512, 297, { zoom: 'air', street: false });
      if (view === undefined) throw new Error('no view');
      const screen = new FakeCanvas(512, 297);
      for (let time = 0; time < 2000; time += 30)
        view.draw(
          screen.context as unknown as CanvasRenderingContext2D,
          { x: 0, z: 0, yaw: NORTH, speed },
          time,
        );
      const points = drawn(screen).points;
      view.dispose();
      return points;
    };
    // Taxiing, 800 m across: both roads, the main road cased (traced twice).
    expect(traced(0)).toBe(2 + 2 * 2);
    // At 250 m/s, 8.3 km across: the main road alone.
    expect(traced(250)).toBe(2 * 2);
  });
});

describe('EarthMapScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeCanvas.made = [];
  });

  it('fits once per model, paints from the seat at most 30 times a second, and comes off', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const map = new EarthMovingMap();
    map.observer.added(new THREE.Group(), crossroads(), context([0, 0], 1000));
    const screen = new EarthMapScreen(map);
    const model = new THREE.Group();
    let asked = 0;
    const find = (target: THREE.Object3D) => {
      asked++;
      return {
        center: [0, 1, 0.3] as [number, number, number],
        normal: [0, 0, -1] as [number, number, number],
        up: [0, 1, 0] as [number, number, number],
        width: 0.25,
        height: 0.145,
        relief: 0.007,
        parent: target,
      };
    };
    const pose = { x: 500, z: 500, yaw: EAST, speed: 10 };
    /** Paintings of the screen's own canvas: one compose each, which turns the map. */
    const paintings = (): number => {
      const canvas = FakeCanvas.made.find((c) => c.width === 512 && c.height === 297);
      const count = canvas?.context.calls.filter(([name]) => name === 'rotate').length ?? 0;
      if (canvas !== undefined) canvas.context.calls.length = 0;
      return count;
    };
    screen.update(model, find, pose, true);
    expect(asked).toBe(1);
    expect(model.getObjectByName('vehicle-screen')).toBeDefined();
    // The map turns once, the compass once.
    expect(paintings()).toBe(2);
    now = 20;
    screen.update(model, find, pose, true);
    expect(paintings()).toBe(0);
    now = 40;
    screen.update(model, find, pose, false);
    expect(paintings()).toBe(0);
    screen.update(model, find, pose, true);
    expect(paintings()).toBe(2);
    expect(asked).toBe(1);
    expect(screen.street).toBe('Highland Drive');
    // Off the vehicle, the printed screen shows again.
    screen.update(undefined, find, pose, true);
    expect(model.getObjectByName('vehicle-screen')).toBeUndefined();
    // A model with no screen paints nothing.
    const bare = new THREE.Group();
    screen.update(bare, () => undefined, pose, true);
    expect(bare.children).toHaveLength(0);
    screen.dispose();
  });
});
