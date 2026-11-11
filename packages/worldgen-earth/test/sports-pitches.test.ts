/**
 * Mapped sports pitches: the game read from the outline's size and shape, its ground and line
 * markings, and what two tiles draw when the source cut a pitch between them.
 */
import {
  createEmptyTerrainSemanticTile,
  pointInPolygon,
  polygonArea,
  type TerrainLandcoverFeature,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { LAND_SITE_COLORS, prepareLandSites } from '../src/kernel/land-sites';
import type { TileGeometry } from '../src/kernel/semantic-adapter';

const SIZE = 1000;
const BUFFER = 1 / 64;
/** A frame on the equator, where a meter of ground is a unit of the frame. */
function geometry(x = 0, z = 0, overrides: Partial<TileGeometry> = {}): TileGeometry {
  return {
    level: 15,
    x,
    z,
    originX: 4_000_000 + x * SIZE,
    originZ: z * SIZE,
    size: SIZE,
    metersPerUnit: 1,
    levelBelowMax: 0,
    ...overrides,
  };
}
type Point = [number, number];
/** A tile holding pitches given as outlines in meters from its corner. */
function pitches(...outlines: Point[][]): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  outlines.forEach((outline, id) => {
    tile.landcover.push({
      id,
      class: 'pitch',
      polygons: [{ outer: outline.map(([x, z]): Point => [x / SIZE, z / SIZE]) }],
    });
  });
  return tile;
}
/** A rectangle of a given length and width around a point, turned by an angle in degrees. */
function field(cx: number, cz: number, long: number, short: number, turn = 0): Point[] {
  const cos = Math.cos((turn * Math.PI) / 180),
    sin = Math.sin((turn * Math.PI) / 180);
  return (
    [
      [-long / 2, -short / 2],
      [long / 2, -short / 2],
      [long / 2, short / 2],
      [-long / 2, short / 2],
    ] as Point[]
  ).map(([s, t]): Point => [cx + s * cos - t * sin, cz + s * sin + t * cos]);
}
/** A quarter circle with home plate at a corner, its foul lines along +x and +z. */
function fan(hx: number, hz: number, radius: number, backstop = 0): Point[] {
  const arc: Point[] = [];
  for (let k = 0; k <= 8; k++) {
    const angle = (k / 8) * (Math.PI / 2);
    arc.push([hx + Math.cos(angle) * radius, hz + Math.sin(angle) * radius]);
  }
  // A backstop cuts the corner at home plate off.
  return backstop > 0 ? [[hx + backstop, hz], ...arc, [hx, hz + backstop]] : [[hx, hz], ...arc];
}
const added = (tile: TerrainSemanticTile): TerrainLandcoverFeature[] =>
  tile.landcover.filter((feature) => String(feature.id).startsWith('site:pitch'));
const summary = (tile: TerrainSemanticTile): string[] =>
  added(tile).map((feature) => `${feature.class}:${feature.polygons.length}`);
const area = (feature: TerrainLandcoverFeature | undefined): number =>
  (feature?.polygons ?? []).reduce((sum, polygon) => sum + polygonArea(polygon), 0) * SIZE * SIZE;
/** The added class drawn at a point: the smallest feature there, as the ground paints them. */
function classAt(tile: TerrainSemanticTile, x: number, z: number): string | undefined {
  const here = added(tile)
    .filter((feature) =>
      feature.polygons.some((polygon) => pointInPolygon([x / SIZE, z / SIZE], polygon)),
    )
    .sort((a, b) => area(a) - area(b));
  return here[0]?.class;
}

describe('sports pitches', () => {
  it('reads the game from the size and shape of the outline', () => {
    const tile = prepareLandSites(
      pitches(
        field(200, 200, 105, 68),
        field(200, 400, 110, 50),
        field(500, 200, 36, 18),
        field(500, 300, 28, 15),
        field(500, 400, 16, 8),
        field(700, 200, 60, 35),
        fan(600, 600, 100),
        field(300, 800, 200, 150),
        field(800, 800, 6, 4),
      ),
      geometry(),
    );
    expect(summary(tile)).toEqual([
      // Soccer: touchlines, halfway line, center circle, two penalty and two goal areas.
      'sports_turf:1',
      'sports_line:18',
      // Football: the boundary and a yard line every ten yards.
      'sports_turf:1',
      'sports_line:15',
      // Tennis: doubles court, singles sidelines, service lines, center line and net.
      'sports_court:1',
      'sports_line:10',
      // Basketball: boundary, center line and circle, two keys and two three-point arcs.
      'sports_blacktop:1',
      'sports_line:14',
      // Too small to tell: a court and its boundary.
      'sports_court:1',
      'sports_line:4',
      // A small-sided soccer field keeps the full set of markings.
      'sports_turf:1',
      'sports_line:18',
      // A ball diamond: skinned infield, its grass square and mound, two foul lines.
      'sports_turf:1',
      'sports_dirt:1',
      'sports_turf:1',
      'sports_dirt:1',
      'sports_line:2',
      // Field-sized with no known shape: turf alone. Smaller than any court: left as mapped.
      'sports_turf:1',
    ]);
    for (const feature of added(tile))
      expect(LAND_SITE_COLORS[feature.class]).toMatch(/^#[0-9a-f]{6}$/);
    // The mapped pitches themselves are untouched, under what was added.
    expect(tile.landcover.slice(0, 9).map((feature) => feature.class)).toEqual(
      Array.from({ length: 9 }, () => 'pitch'),
    );
  });

  it('keeps every marking on its pitch, turned with it', () => {
    for (const turn of [0, 30, 90, 137]) {
      const outlines = [
        field(250, 250, 105, 68, turn),
        field(250, 600, 110, 50, turn),
        field(600, 250, 36, 18, turn),
        field(600, 500, 28, 15, turn),
      ];
      const tile = prepareLandSites(pitches(...outlines), geometry());
      const lines = added(tile).filter((feature) => feature.class === 'sports_line');
      expect(lines).toHaveLength(4);
      lines.forEach((feature, index) => {
        // A line may overhang the outline by half its own width, no more.
        const [cx, cz] = [
          [250, 250],
          [250, 600],
          [600, 250],
          [600, 500],
        ][index] as Point;
        const [long, short] = [
          [105, 68],
          [110, 50],
          [36, 18],
          [28, 15],
        ][index] as Point;
        const around = {
          outer: field(cx, cz, long + 0.5, short + 0.5, turn).map(
            ([x, z]): Point => [x / SIZE, z / SIZE],
          ),
        };
        for (const polygon of feature.polygons)
          for (const point of polygon.outer) expect(pointInPolygon(point, around)).toBe(true);
      });
      // The halfway line crosses the middle of the soccer field whichever way it faces.
      expect(classAt(tile, 250, 250 + 0.01)).toBe('sports_line');
    }
  });

  it('lays a diamond out from home plate, behind a backstop or not', () => {
    for (const backstop of [0, 6]) {
      const tile = prepareLandSites(pitches(fan(300, 300, 100, backstop)), geometry());
      const [turf, skin, grass, mound, lines] = added(tile);
      expect(added(tile).map((feature) => feature.class)).toEqual([
        'sports_turf',
        'sports_dirt',
        'sports_turf',
        'sports_dirt',
        'sports_line',
      ]);
      // Each patch is smaller than the one it lies on, the order the ground paints them in.
      // Observed: 7,804 m² of field, 1,584 of skinned infield, 342 of grass, 21 of mound.
      expect(area(turf)).toBeGreaterThan(area(skin));
      expect(area(skin)).toBeGreaterThan(area(grass) * 3);
      expect(area(grass)).toBeGreaterThan(area(mound) * 10);
      expect(area(lines)).toBeLessThan(area(grass));
      expect(area(skin)).toBeGreaterThan(1400);
      expect(area(skin)).toBeLessThan(1700);
      // Dirt at home plate and round the bases, grass inside them, the mound in its middle.
      expect(classAt(tile, 302, 302)).toBe('sports_dirt');
      expect(classAt(tile, 335, 303)).toBe('sports_dirt');
      expect(classAt(tile, 320, 308)).toBe('sports_turf');
      expect(classAt(tile, 313, 313)).toBe('sports_dirt');
      expect(classAt(tile, 360, 360)).toBe('sports_turf');
      // The foul lines run out along the fan's two straight sides.
      expect(classAt(tile, 380, 300)).toBe('sports_line');
      expect(classAt(tile, 300, 380)).toBe('sports_line');
    }
    // A small field is all skin: no grass square, no mound.
    const small = prepareLandSites(pitches(fan(300, 300, 55)), geometry());
    expect(summary(small)).toEqual(['sports_turf:1', 'sports_dirt:1', 'sports_line:2']);
  });

  it('does not depend on where the source starts a ring or which way round it runs', () => {
    const outlines = [
      field(250, 250, 105, 68, 20),
      field(600, 250, 28, 15, 70),
      fan(300, 600, 90, 5),
    ];
    const reference = prepareLandSites(pitches(...outlines), geometry());
    const respun = outlines.map((outline) => {
      const turned = [...outline.slice(3), ...outline.slice(0, 3)].reverse();
      return [...turned, turned[0] as Point];
    });
    const again = prepareLandSites(pitches(...respun), geometry());
    expect(summary(again)).toEqual(summary(reference));
    for (let x = 150; x < 700; x += 3.7)
      for (let z = 150; z < 700; z += 3.7)
        expect(classAt(again, x, z)).toBe(classAt(reference, x, z));
  });

  it('draws a pitch in the buffer two tiles share the same in both', () => {
    // Twelve meters wide on the edge between two tiles: whole in each one's sixteen-meter buffer.
    const court = field(1000, 400, 24, 11, 90);
    const west = prepareLandSites(pitches(court), geometry(0, 0));
    const east = prepareLandSites(
      pitches(court.map(([x, z]): Point => [x - SIZE, z])),
      geometry(1, 0),
    );
    expect(summary(west)).toEqual(['sports_court:1', 'sports_line:10']);
    expect(summary(east)).toEqual(summary(west));
    let marked = 0;
    for (let x = -7; x <= 7; x += 0.25)
      for (let z = 385; z <= 415; z += 0.25) {
        const drawn = classAt(west, 1000 + x, z);
        expect(classAt(east, x, z)).toBe(drawn);
        if (drawn === 'sports_line') marked++;
      }
    expect(marked).toBeGreaterThan(100);
  });

  it('turfs both pieces of a pitch a tile edge cuts, with the infield where home plate is', () => {
    const clip = (outline: Point[], shift: number): Point[] => {
      // What the source hands each tile: the outline cut at the tile's buffer.
      const lo = -BUFFER * SIZE,
        hi = SIZE + BUFFER * SIZE;
      const moved = outline.map(([x, z]): Point => [x - shift, z]);
      const kept: Point[] = [];
      moved.forEach((a, k) => {
        const b = moved[(k + 1) % moved.length] as Point;
        const inside = (p: Point) => p[0] >= lo && p[0] <= hi;
        if (inside(a)) kept.push(a);
        if (inside(a) !== inside(b)) {
          const edge = a[0] < lo || b[0] < lo ? lo : hi;
          kept.push([edge, a[1] + ((b[1] - a[1]) * (edge - a[0])) / (b[0] - a[0])]);
        }
      });
      return kept;
    };
    // Home plate 60 m inside the western tile; the outfield runs 40 m into the eastern one.
    const diamond = fan(940, 300, 100, 5);
    const west = prepareLandSites(pitches(clip(diamond, 0)), geometry(0, 0));
    const east = prepareLandSites(pitches(clip(diamond, SIZE)), geometry(1, 0));
    // The western piece shows 75 m of the cut foul line: a full infield, sized to that.
    expect(summary(west)).toEqual([
      'sports_turf:1',
      'sports_dirt:1',
      'sports_turf:1',
      'sports_dirt:1',
      'sports_line:2',
    ]);
    expect(summary(east)).toEqual(['sports_turf:1']);
    // The infield is whole and inside the tile that drew it.
    const skin = added(west).find((feature) => feature.class === 'sports_dirt');
    for (const polygon of skin?.polygons ?? [])
      for (const [u, v] of polygon.outer) {
        expect(u).toBeLessThan(1);
        expect(u).toBeGreaterThan(0);
        expect(v).toBeGreaterThan(0);
      }
    expect(classAt(west, 942, 302)).toBe('sports_dirt');
    expect(classAt(west, 968, 303)).toBe('sports_dirt');
    expect(classAt(west, 990, 340)).toBe('sports_turf');
    expect(classAt(east, 20, 340)).toBe('sports_turf');
    // Home plate too close to the edge for its infield to fit: turf only, in both.
    const close = fan(985, 300, 100, 5);
    expect(summary(prepareLandSites(pitches(clip(close, 0)), geometry(0, 0)))).toEqual([
      'sports_turf:1',
    ]);
    // A cut rectangle shows square corners and no arc: turf, and no infield in its corner.
    const cut = field(1000, 700, 105, 68);
    expect(summary(prepareLandSites(pitches(clip(cut, 0)), geometry(0, 0)))).toEqual([
      'sports_turf:1',
    ]);
    expect(summary(prepareLandSites(pitches(clip(cut, SIZE)), geometry(1, 0)))).toEqual([
      'sports_turf:1',
    ]);
  });

  it('drops the lines one level out and everything beyond', () => {
    const source = pitches(field(250, 250, 105, 68), fan(600, 600, 100));
    expect(summary(prepareLandSites(source, geometry(0, 0, { levelBelowMax: 1 })))).toEqual([
      'sports_turf:1',
      'sports_turf:1',
      'sports_dirt:1',
      'sports_turf:1',
      'sports_dirt:1',
    ]);
    expect(prepareLandSites(source, geometry(0, 0, { levelBelowMax: 2 }))).toBe(source);
    expect(prepareLandSites(source, geometry(), false)).toBe(source);
  });
});
