import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { sampleTerrainLine, terrainLinePath } from '../src/line-path';
import {
  appendTerrainLineBand,
  TERRAIN_SURFACE_KIND,
  TerrainSurfaceMeshBuilder,
} from '../src/linear-features';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import { createTerrainSurfaceObject } from '../src/surface-client';

const SIZE = 400;

/** A flat finest-level tile, SIZE meters across. */
function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    tileSize: SIZE,
    origin: [0, 0],
    pyramid: {
      name: 'markings-test',
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
      origin: [0, 0],
      worldSize: [SIZE, SIZE],
      height: { min: 0, max: 20 },
    }),
    signal: new AbortController().signal,
  };
}

/** Normalized tile coordinates from meters. */
const at = (x: number, z: number): TerrainSemanticPoint => [x / SIZE, z / SIZE];

function road(
  subclass: string,
  points: TerrainSemanticPoint[],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature {
  return {
    class: /primary|secondary|tertiary|trunk/.test(subclass) ? 'major_road' : 'minor_road',
    subclass,
    lines: [points.map(([x, z]) => at(x, z))],
    ...extra,
  };
}

/** Rows of 10 m houses along both sides of the line z = `z` (meters), every 15 m. */
function houses(tile: TerrainSemanticTile, z: number, from = 0, to = SIZE): void {
  for (let x = from + 5; x < to - 5; x += 15)
    for (const side of [-1, 1]) {
      const near = z + side * 14;
      const far = z + side * 24;
      tile.buildings.push({
        polygons: [{ outer: [at(x, near), at(x + 10, near), at(x + 10, far), at(x, far)] }],
      });
    }
}

/** Mark the tile as open country: land data, and no buildings. */
function farmland(tile: TerrainSemanticTile): void {
  tile.landcover.push({
    class: 'farmland',
    polygons: [
      { outer: [at(-10, -10), at(SIZE + 10, -10), at(SIZE + 10, SIZE + 10), at(-10, SIZE + 10)] },
    ],
  });
}

interface Triangle {
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  color: THREE.Color;
  kind: number;
}

function triangles(object: THREE.Object3D, name: string): Triangle[] {
  const mesh = object.getObjectByName(name) as THREE.Mesh | undefined;
  if (!mesh) return [];
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  const detail = geometry.getAttribute('surfaceDetail');
  const result: Triangle[] = [];
  for (let i = 0; i + 2 < position.count; i += 3)
    result.push({
      points: [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(position, i + k)) as [
        THREE.Vector3,
        THREE.Vector3,
        THREE.Vector3,
      ],
      color: new THREE.Color().fromBufferAttribute(color, i),
      kind: detail ? Math.floor(detail.getZ(i) / 128 + 0.001) : -1,
    });
  return result;
}

function covers(triangle: Triangle, x: number, z: number): boolean {
  const [a, b, c] = triangle.points;
  const side = (p: THREE.Vector3, q: THREE.Vector3): number =>
    (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x);
  const d1 = side(a, b),
    d2 = side(b, c),
    d3 = side(c, a);
  return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9));
}

const yellow = (t: Triangle): boolean => t.color.r - t.color.b > 0.25;
const centroid = (t: Triangle): THREE.Vector3 =>
  t.points[0].clone().add(t.points[1]).add(t.points[2]).divideScalar(3);

/** Paint triangles whose centroid lies within `reach` of x = `x` along a road on z = 200. */
function paintNear(object: THREE.Object3D, x: number, reach: number): Triangle[] {
  return triangles(object, 'surface:markings').filter((t) => Math.abs(centroid(t).x - x) < reach);
}

/** Distinct lateral offsets (meters from z = 200, to 2 cm) of paint near x. */
function offsets(paint: readonly Triangle[]): number[] {
  return lines(paint.map((t) => centroid(t).z - 200));
}

/**
 * The lines among lateral positions: a triangle's centroid lies within a third of its line's
 * width of the line's middle, so positions closer than 6 cm are one line, reported (to 1 cm) at
 * the middle of their spread.
 */
function lines(positions: readonly number[]): number[] {
  const sorted = [...positions].sort((a, b) => a - b);
  const result: number[] = [];
  let first = sorted[0];
  for (let i = 0; i < sorted.length; i++) {
    const value = sorted[i] as number;
    const next = sorted[i + 1];
    if (next === undefined || next - value > 0.06) {
      result.push(Math.round((((first as number) + value) / 2) * 100) / 100 + 0);
      first = next;
    }
  }
  return result;
}

describe('road joins', () => {
  it('miters a road split into two features at a bend, leaving no wedge between them', () => {
    const tile = createEmptyTerrainSemanticTile();
    farmland(tile);
    const turn = (20 * Math.PI) / 180;
    tile.transportation.push(
      road(
        'primary',
        [
          [60, 200],
          [200, 200],
        ],
        { width: 16, name: 'Bridge approach' },
      ),
      road(
        'primary',
        [
          [200, 200],
          [200 + 140 * Math.cos(turn), 200 + 140 * Math.sin(turn)],
        ],
        { width: 16, name: 'Beyond the bridge' },
      ),
    );
    const asphalt = triangles(
      createTerrainSurfaceObject(tile, context()),
      'semantic:transportation',
    );
    // Every point within 7 m of the joint lies on one band or the other: square ends left a
    // wedge almost 3 m wide at the outside edge of a 20° bend.
    for (const radius of [3, 5, 7])
      for (let degrees = 0; degrees < 360; degrees += 10) {
        const x = 200 + radius * Math.cos((degrees * Math.PI) / 180);
        const z = 200 + radius * Math.sin((degrees * Math.PI) / 180);
        expect(
          asphalt.some((t) => covers(t, x, z)),
          `asphalt at ${radius} m, ${degrees}°`,
        ).toBe(true);
      }
  });

  it('gives both ends one miter whichever way each line runs', () => {
    const a = terrainLinePath(
      [
        [0, 0],
        [1, 0],
      ],
      100,
    );
    a.endJoin = [0, 1];
    a.startJoin = [0.2, 1];
    expect(sampleTerrainLine(a, 100, 2)).toMatchObject({ x: 100, z: 2 });
    expect(sampleTerrainLine(a, 0, 2).x).toBeCloseTo(0.4);
  });
});

describe('road markings', () => {
  it('keeps paint out of walking and driving collision', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      road(
        'primary',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 12, lanes: 4 },
      ),
    );
    const markings = createTerrainSurfaceObject(tile, context()).getObjectByName(
      'surface:markings',
    );
    expect(markings?.userData.walkIgnore).toBe(true);
  });

  it('charges the detail budget only for the paint it draws', () => {
    // The tile's detail budget counts quads. Dash gaps and filtered spans used to count as well,
    // so a broken line cost four times its paint and a dense tile ran out partway through.
    const builder = new TerrainSurfaceMeshBuilder(context());
    const path = terrainLinePath(
      [
        [0, 0.5],
        [0.3, 0.5],
      ],
      SIZE,
    );
    const white = { width: 0.11, color: '#ffffff' };
    expect(appendTerrainLineBand(builder, path, { ...white, dash: [3, 9] }, { spacing: 3 })).toBe(
      10,
    );
    expect(
      appendTerrainLineBand(builder, path, white, { spacing: 3, filter: (_, d) => d < 30 }),
    ).toBe(10);
  });

  it('paves over the ties where a track crosses a road, and leaves the rails', () => {
    const tile = createEmptyTerrainSemanticTile();
    houses(tile, 200);
    tile.transportation.push(
      road(
        'primary',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 12, lanes: 4 },
      ),
      { class: 'rail', subclass: 'rail', lines: [[at(200, 0), at(200, SIZE)]] },
    );
    const track = triangles(createTerrainSurfaceObject(tile, context()), 'surface:markings').filter(
      (t) => t.kind === TERRAIN_SURFACE_KIND.plain && Math.abs(centroid(t).x - 200) < 1.5,
    );
    // Ties are brown, rails gray.
    const across = (t: Triangle): number => Math.abs(centroid(t).z - 200);
    const ties = track.filter((t) => t.color.r - t.color.b > 0.04);
    const rails = track.filter((t) => Math.abs(t.color.r - t.color.b) < 0.04);
    expect(ties.some((t) => across(t) < 5)).toBe(false);
    expect(ties.some((t) => across(t) > 8 && across(t) < 30)).toBe(true);
    expect(rails.some((t) => across(t) < 5)).toBe(true);
  });

  it("carries a through road's lines past a side street joining from one side", () => {
    const tile = createEmptyTerrainSemanticTile();
    houses(tile, 200);
    tile.transportation.push(
      road(
        'primary',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 12, lanes: 4 },
      ),
      road(
        'residential',
        [
          [200, 200],
          [200, SIZE],
        ],
        { width: 8 },
      ),
    );
    const paint = paintNear(createTerrainSurfaceObject(tile, context()), 200, 3);
    // The double yellow runs on across the tee.
    expect(offsets(paint.filter(yellow))).toEqual([-0.11, 0.11]);
    // The edge line breaks across the side street's mouth and carries on along the far side.
    const white = offsets(paint.filter((t) => !yellow(t)));
    expect(white).toContain(-5.7);
    expect(white).not.toContain(5.7);
    // Where the side street crosses the road, the center line breaks as well.
    tile.transportation[1] = road(
      'residential',
      [
        [200, 0],
        [200, SIZE],
      ],
      { width: 8 },
    );
    expect(paintNear(createTerrainSurfaceObject(tile, context()), 200, 3).filter(yellow)).toEqual(
      [],
    );
  });

  it('paints no center line down a residential street, and a double yellow down a city arterial', () => {
    const tile = createEmptyTerrainSemanticTile();
    houses(tile, 200);
    tile.transportation.push(
      road(
        'residential',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 8 },
      ),
    );
    expect(paintNear(createTerrainSurfaceObject(tile, context()), 200, 60)).toEqual([]);
    tile.transportation = [
      road(
        'secondary',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 9, lanes: 2 },
      ),
    ];
    const paint = paintNear(createTerrainSurfaceObject(tile, context()), 200, 60).filter(yellow);
    expect(offsets(paint)).toEqual([-0.11, 0.11]);
    // Solid: the 120 m stretch is painted end to end.
    const left = paint.filter((t) => centroid(t).z < 200).map((t) => centroid(t).x);
    expect(Math.max(...left) - Math.min(...left)).toBeGreaterThan(110);
  });

  it('allows passing on a country road where it runs straight, and not round a curve', () => {
    const tile = createEmptyTerrainSemanticTile();
    farmland(tile);
    // Straight for 200 m, then a bend of radius 60 m.
    const points: TerrainSemanticPoint[] = [
      [-20, 200],
      [200, 200],
    ];
    for (let degrees = 1; degrees <= 90; degrees += 1) {
      const angle = (degrees * Math.PI) / 180;
      points.push([200 + 60 * Math.sin(angle), 260 - 60 * Math.cos(angle)]);
    }
    points.push([260, 420]);
    tile.transportation.push(road('tertiary', points, { width: 7 }));
    const object = createTerrainSurfaceObject(tile, context());
    const straight = paintNear(object, 80, 50).filter(
      (t) => yellow(t) && Math.abs(centroid(t).z - 200) < 1,
    );
    // One broken line on the crown of the straight: 3 m of paint in every 12 m.
    expect(offsets(straight)).toEqual([0]);
    const xs = straight.map((t) => centroid(t).x);
    const span = Math.max(...xs) - Math.min(...xs);
    const painted = new Set(xs.map((x) => Math.floor(x))).size;
    expect(painted).toBeLessThan(span * 0.45);
    // Round the bend, a double line.
    const bend = triangles(object, 'surface:markings').filter((t) => {
      const c = centroid(t);
      return (
        yellow(t) && Math.abs(Math.hypot(c.x - 200, c.z - 260) - 60) < 0.5 && c.x > 230 && c.z < 255
      );
    });
    expect(
      lines(bend.map((t) => Math.hypot(centroid(t).x - 200, centroid(t).z - 260) - 60)),
    ).toEqual([-0.11, 0.11]);
    // A country road keeps white edge lines and has no sidewalks.
    expect(paintNear(object, 80, 50).some((t) => !yellow(t))).toBe(true);
    expect(
      triangles(object, 'surface:edges').some((t) => t.kind === TERRAIN_SURFACE_KIND.sidewalk),
    ).toBe(false);
  });

  it('marks a two-way left-turn lane down a five-lane road', () => {
    const tile = createEmptyTerrainSemanticTile();
    houses(tile, 200);
    tile.transportation.push(
      road(
        'primary',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 17.5, lanes: 5 },
      ),
    );
    const paint = paintNear(createTerrainSurfaceObject(tile, context()), 200, 60);
    // The turn lane's edges at ±1.75 m, each a solid line outside a broken one.
    expect(offsets(paint.filter(yellow))).toEqual([-1.86, -1.64, 1.64, 1.86]);
    // The longest unpainted stretch along a line: none on a solid one, 9 m on a broken one.
    const gap = (offset: number): number => {
      const xs = paint
        .filter((t) => yellow(t) && Math.abs(centroid(t).z - 200 - offset) < 0.05)
        .map((t) => centroid(t).x)
        .sort((a, b) => a - b);
      return Math.max(...xs.slice(1).map((x, i) => x - (xs[i] as number)));
    };
    expect(gap(1.86)).toBeLessThan(3);
    expect(gap(1.64)).toBeGreaterThan(8);
    // White lane lines between the through lanes, at ±5.25 m.
    expect(offsets(paint.filter((t) => !yellow(t)))).toEqual(expect.arrayContaining([-5.25, 5.25]));
  });
});

describe('sidewalks', () => {
  it('lines built-up streets, not country lanes', () => {
    const tile = createEmptyTerrainSemanticTile();
    farmland(tile);
    tile.transportation.push(
      road(
        'residential',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 8 },
      ),
    );
    const sidewalk = (object: THREE.Object3D): Triangle[] =>
      triangles(object, 'surface:edges').filter((t) => t.kind === TERRAIN_SURFACE_KIND.sidewalk);
    expect(sidewalk(createTerrainSurfaceObject(tile, context()))).toEqual([]);
    houses(tile, 200, 100, 300);
    const built = sidewalk(createTerrainSurfaceObject(tile, context())).map((t) => centroid(t).x);
    expect(built.length).toBeGreaterThan(0);
    // Along the houses and a little past them, not out across the fields.
    expect(Math.min(...built)).toBeGreaterThan(30);
    expect(Math.max(...built)).toBeLessThan(370);
    expect(built.some((x) => x < 110) && built.some((x) => x > 290)).toBe(true);
  });

  it('gives way to a sidewalk mapped as its own footway', () => {
    const tile = createEmptyTerrainSemanticTile();
    houses(tile, 200);
    tile.transportation.push(
      road(
        'residential',
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width: 8 },
      ),
      { class: 'path', subclass: 'sidewalk', lines: [[at(0, 207.5), at(SIZE, 207.5)]] },
    );
    const sides = new Set(
      triangles(createTerrainSurfaceObject(tile, context()), 'surface:edges')
        .filter(
          (t) => t.kind === TERRAIN_SURFACE_KIND.sidewalk && Math.abs(centroid(t).x - 200) < 100,
        )
        .map((t) => Math.sign(centroid(t).z - 200)),
    );
    expect([...sides]).toEqual([-1]);
  });
});

describe('crosswalks', () => {
  const crossing = (
    subclass: string,
    width: number,
    signals: boolean,
  ): { object: THREE.Object3D; paint: Triangle[] } => {
    const tile = createEmptyTerrainSemanticTile();
    houses(tile, 200);
    houses(tile, 100);
    houses(tile, 300);
    tile.transportation.push(
      road(
        subclass,
        [
          [0, 200],
          [SIZE, 200],
        ],
        { width, name: 'East-west' },
      ),
      road(
        subclass,
        [
          [200, 0],
          [200, SIZE],
        ],
        { width, name: 'North-south' },
      ),
    );
    if (signals) tile.pois = [{ class: 'traffic_signals', point: at(200, 200) }];
    const object = createTerrainSurfaceObject(tile, context());
    // Paint near the junction, short of the lane lines (which resume past the stop lines).
    const paint = triangles(object, 'surface:markings').filter(
      (t) => Math.hypot(centroid(t).x - 200, centroid(t).z - 200) < width / 2 + 7,
    );
    return { object, paint };
  };

  // Square meters of paint, in plan.
  const area = (paint: readonly Triangle[]): number =>
    paint.reduce((sum, t) => {
      const [a, b, c] = t.points;
      return sum + Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
    }, 0);

  it('leaves the corner of two quiet streets unmarked but for stop lines', () => {
    // Four stop lines about 3.3 m by 0.45 m; four crosswalks would add some 30 m² more.
    expect(area(crossing('residential', 8, false).paint)).toBeLessThan(8);
  });

  it('marks every arm of a signal with a ladder crosswalk and a stop line', () => {
    const { paint } = crossing('primary', 14, true);
    expect(area(paint)).toBeGreaterThan(40);
    // Crosswalk paint on all four arms.
    const arms = new Set(
      paint.map((t) => {
        const c = centroid(t);
        return (Math.round(Math.atan2(c.z - 200, c.x - 200) / (Math.PI / 2)) + 4) % 4;
      }),
    );
    expect(arms.size).toBe(4);
  });

  it("runs each arm's lines up to its stop line", () => {
    // Arms leave the 14 m roads' junction 11.5 m out; the stop line stands 2.8 m beyond. Lines
    // used to stop 8 m past the junction core whatever was there.
    const { object } = crossing('primary', 14, true);
    for (const direction of [-1, 1]) {
      const center = triangles(object, 'surface:markings')
        .filter((t) => yellow(t) && Math.abs(centroid(t).z - 200) < 0.3)
        .map((t) => (centroid(t).x - 200) * direction)
        .filter((out) => out > 0);
      expect(Math.min(...center)).toBeGreaterThan(14.5);
      expect(Math.min(...center)).toBeLessThan(18.5);
    }
  });
});
