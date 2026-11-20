import { describe, expect, it } from 'vitest';
import { bridgeDeckHeightFn } from '../src/bridge-profile';
import { gradeTransportSeparations, TERRAIN_GRADE_SEPARATION } from '../src/grade-separation';
import { gradeHighwayBridges } from '../src/highway-grading';
import { terrainLinePath } from '../src/line-path';
import { roadProfileHeight } from '../src/road-earthworks';
import type { TerrainSemanticPoint, TerrainTransportationFeature } from '../src/semantic-types';

const SIZE = 400;
type Feature = TerrainTransportationFeature;
const way = (line: TerrainSemanticPoint[], extra: Partial<Feature> = {}): Feature => ({
  class: 'major_road',
  subclass: 'secondary',
  width: 10,
  lines: [line],
  ...extra,
});
const motorway = (line: TerrainSemanticPoint[], extra: Partial<Feature> = {}): Feature =>
  way(line, { class: 'highway', subclass: 'motorway', ...extra });
const footway = (line: TerrainSemanticPoint[], extra: Partial<Feature> = {}): Feature =>
  way(line, { class: 'path', subclass: 'footway', width: 3, ...extra });
const rail = (line: TerrainSemanticPoint[], extra: Partial<Feature> = {}): Feature =>
  way(line, { class: 'rail', subclass: 'rail', width: 3, ...extra });
const profile = (f: Feature | undefined) => f?.bridgeApproachProfile ?? [];
const flat = (): number => 0;

/** Surface height of a graded way at a point (meters), as the painter and traffic read it. */
function heightAt(feature: Feature, x: number, z: number, ground = flat): number {
  const lift = feature.class === 'path' ? 0.43 : 0.32;
  if (!feature.bridgeApproachProfile?.length) return ground(x, z) + lift;
  const path = terrainLinePath(feature.lines[0] as TerrainSemanticPoint[], SIZE);
  return bridgeDeckHeightFn(path, ground, {
    clearance: 6,
    approachLift: lift,
    groundApproach: !feature.bridge,
    connects: [true, true],
    approachProfile: feature.bridgeApproachProfile.map((sample) => ({
      ...sample,
      point: [sample.point[0] * SIZE, sample.point[1] * SIZE],
    })),
  })(x, z);
}
/** Steepest grade between consecutive samples of a profile. */
function steepest(feature: Feature): number {
  const samples = profile(feature);
  let grade = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] as (typeof samples)[number],
      b = samples[i] as (typeof samples)[number];
    const distance = Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]) * SIZE;
    if (distance > 0.5) grade = Math.max(grade, Math.abs(a.elevation - b.elevation) / distance);
  }
  return grade;
}

describe('grade separation', () => {
  it('lifts an overpass a truck and a deck clear of the road beneath, across its whole width', () => {
    const source = [
      way([
        [0, 0.5],
        [0.45, 0.5],
      ]),
      way(
        [
          [0.45, 0.5],
          [0.55, 0.5],
        ],
        { bridge: true },
      ),
      way([
        [0.55, 0.5],
        [1, 0.5],
      ]),
      motorway([
        [0.5, 0],
        [0.5, 1],
      ]), // beneath, no mapped connection
    ];
    const before = JSON.stringify(source);
    const result = gradeTransportSeparations(source, SIZE, flat);
    expect(JSON.stringify(source)).toBe(before);
    const [west, deck, east, under] = result as [Feature, Feature, Feature, Feature];
    expect(under.bridgeApproachProfile).toBeUndefined();
    // Over the whole carriageway beneath: the lower surface plus 6.5 m.
    for (const x of [195, 197.5, 200, 202.5, 205])
      expect(heightAt(deck, x, 200)).toBeGreaterThanOrEqual(0.32 + TERRAIN_GRADE_SEPARATION.road);
    expect(Math.max(...profile(deck).map((p) => p.elevation))).toBeLessThan(7.2);
    // The roads at its ends carry the climb, within a secondary road's grade, from the ground.
    expect(profile(west)[0]?.elevation).toBeCloseTo(0.32);
    expect(profile(east).at(-1)?.elevation).toBeCloseTo(0.32);
    expect(profile(west).at(-1)?.elevation).toBeCloseTo(profile(deck)[0]?.elevation as number, 5);
    expect(profile(east)[0]?.elevation).toBeCloseTo(profile(deck).at(-1)?.elevation as number, 5);
    for (const f of [west, deck, east]) expect(steepest(f)).toBeLessThanOrEqual(0.0705);
    // Raised road is flat across; where it lies on the ground it keeps the ground's crossfall.
    expect(profile(west).at(-1)?.flatness).toBe(1);
    expect(profile(west)[0]?.flatness).toBe(0);
  });

  it('gives a railway more room than a road, and a footpath less', () => {
    const deck = (lower: Feature): number => {
      const result = gradeTransportSeparations(
        [
          motorway(
            [
              [0, 0.5],
              [1, 0.5],
            ],
            { bridge: true },
          ),
          lower,
        ],
        SIZE,
        flat,
      );
      return heightAt(result[0] as Feature, 200, 200);
    };
    const across: TerrainSemanticPoint[] = [
      [0.5, 0],
      [0.5, 1],
    ];
    expect(deck(rail(across))).toBeGreaterThanOrEqual(0.32 + TERRAIN_GRADE_SEPARATION.rail);
    expect(deck(way(across))).toBeGreaterThanOrEqual(0.32 + TERRAIN_GRADE_SEPARATION.road);
    expect(deck(footway(across))).toBeGreaterThanOrEqual(0.43 + TERRAIN_GRADE_SEPARATION.path);
    expect(TERRAIN_GRADE_SEPARATION.road).toBeGreaterThanOrEqual(4.3 + 1.4); // 14 ft and a deck
  });

  it('stacks crossing decks with no mapped layer, the one deeper into its structure on top', () => {
    const result = gradeTransportSeparations(
      [
        // A long flyover, crossed near its middle by a short bridge, over a ground road.
        motorway(
          [
            [0, 0.5],
            [1, 0.5],
          ],
          { bridge: true, link: true },
        ),
        way([
          [0.4, 0.3],
          [0.48, 0.42],
        ]),
        way(
          [
            [0.48, 0.42],
            [0.52, 0.58],
          ],
          { bridge: true },
        ),
        way([
          [0.52, 0.58],
          [0.6, 0.7],
        ]),
        way([
          [0.3, 0],
          [0.3, 1],
        ]),
      ],
      SIZE,
      flat,
    );
    const [flyover, , short] = result as [Feature, Feature, Feature];
    const lower = heightAt(short, 200, 200),
      upper = heightAt(flyover, 200, 200);
    expect(upper - lower).toBeGreaterThanOrEqual(TERRAIN_GRADE_SEPARATION.road - 1e-6);
    // Both still clear the ground road they cross.
    expect(heightAt(flyover, 120, 200)).toBeGreaterThanOrEqual(
      0.32 + TERRAIN_GRADE_SEPARATION.road,
    );
    // No deck wanders off into the sky.
    expect(Math.max(...profile(flyover).map((p) => p.elevation))).toBeLessThan(15);
  });

  it('lets a mapped layer overrule the inference', () => {
    const result = gradeTransportSeparations(
      [
        motorway(
          [
            [0, 0.5],
            [1, 0.5],
          ],
          { bridge: true, layer: 1 },
        ),
        way([
          [0.46, 0.38],
          [0.48, 0.44],
        ]),
        way(
          [
            [0.48, 0.44],
            [0.52, 0.56],
          ],
          { bridge: true, layer: 2 },
        ),
        way([
          [0.52, 0.56],
          [0.54, 0.62],
        ]),
      ],
      SIZE,
      flat,
    );
    const [long, , short] = result as [Feature, Feature, Feature];
    expect(heightAt(short, 200, 200) - heightAt(long, 200, 200)).toBeGreaterThanOrEqual(
      TERRAIN_GRADE_SEPARATION.road - 1e-6,
    );
  });

  it('spans from bank to bank where the ground already carries the deck clear', () => {
    // Embankments 8 m high either side of a cutting 40 m wide along x = 200.
    const ground = (x: number): number => (Math.abs(x - 200) < 20 ? 0 : 8);
    const result = gradeTransportSeparations(
      [
        way([
          [0, 0.5],
          [0.45, 0.5],
        ]),
        way(
          [
            [0.45, 0.5],
            [0.55, 0.5],
          ],
          { bridge: true },
        ),
        way([
          [0.55, 0.5],
          [1, 0.5],
        ]),
        motorway([
          [0.5, 0],
          [0.5, 1],
        ]),
      ],
      SIZE,
      ground,
    );
    const [west, deck, east] = result as [Feature, Feature, Feature];
    for (const sample of profile(deck)) expect(sample.elevation).toBeCloseTo(8.32, 5);
    // Nothing had to climb: the roads at its ends stay as the ground has them.
    expect(west.bridgeApproachProfile).toBeUndefined();
    expect(east.bridgeApproachProfile).toBeUndefined();
  });

  it('holds a deck over water it has no crossing to measure against', () => {
    const result = gradeTransportSeparations(
      [
        way([
          [0, 0.5],
          [0.2, 0.5],
        ]),
        way(
          [
            [0.2, 0.5],
            [0.8, 0.5],
          ],
          { bridge: true },
        ),
        way([
          [0.8, 0.5],
          [1, 0.5],
        ]),
      ],
      SIZE,
      flat,
    );
    const deck = result[1] as Feature;
    expect(profile(deck)[0]?.elevation).toBeCloseTo(0.32);
    expect(heightAt(deck, 200, 200)).toBeCloseTo(6, 1);
    expect(result[0]?.bridgeApproachProfile).toBeUndefined();
  });

  it('does not take a shared vertex for a flyover, or tie the road beneath to the deck', () => {
    const result = gradeTransportSeparations(
      [
        motorway(
          [
            [0, 0.5],
            [0.5, 0.5],
            [1, 0.5],
          ],
          { bridge: true },
        ),
        motorway([
          [0, 0.2],
          [0.5, 0.5],
          [1, 0.8],
        ]),
      ],
      SIZE,
      flat,
    );
    expect(result[1]?.bridgeApproachProfile).toBeUndefined();
    for (const sample of profile(result[0])) expect(sample.elevation).toBeCloseTo(6, 5);
  });

  it('joins a ramp to the deck it merges into where the tile dropped the shared vertex', () => {
    const result = gradeTransportSeparations(
      [
        motorway(
          [
            [0, 0.5],
            [1, 0.5],
          ],
          { bridge: true },
        ),
        // Ends a few decimeters past the centerline of the deck, which has no vertex there.
        motorway(
          [
            [0.3, 0.7],
            [0.5005, 0.4995],
          ],
          { bridge: true, link: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [deck, ramp] = result as [Feature, Feature];
    expect(profile(ramp).at(-1)?.elevation).toBeCloseTo(heightAt(deck, 200, 200), 1);
    expect(Math.max(...profile(deck).map((p) => p.elevation))).toBeLessThan(7);
  });

  it('brings a footbridge down to the street instead of lifting the street to it', () => {
    const result = gradeTransportSeparations(
      [
        footway(
          [
            [0.45, 0.5],
            [0.55, 0.5],
          ],
          { bridge: true },
        ),
        // Its west end joins a path that meets the street it crosses, 30 m away.
        footway([
          [0.45, 0.5],
          [0.45, 0.575],
          [0.5, 0.575],
        ]),
        way([
          [0.5, 0],
          [0.5, 0.575],
          [0.5, 1],
        ]),
      ],
      SIZE,
      flat,
    );
    const [bridge, path, street] = result as [Feature, Feature, Feature];
    expect(street.bridgeApproachProfile).toBeUndefined();
    expect(heightAt(bridge, 200, 200)).toBeGreaterThanOrEqual(0.32 + TERRAIN_GRADE_SEPARATION.road);
    expect(Math.max(...profile(bridge).map((p) => p.elevation))).toBeLessThan(8);
    // The path climbs from the street to the deck.
    expect(profile(path)[0]?.elevation).toBeCloseTo(profile(bridge)[0]?.elevation as number, 5);
    expect(profile(path).at(-1)?.elevation).toBeCloseTo(0.43, 5);
  });

  it('never lets an approach lift the road its own bridge has to clear', () => {
    const result = gradeTransportSeparations(
      [
        way(
          [
            [0.45, 0.5],
            [0.55, 0.5],
          ],
          { bridge: true },
        ),
        // The road at its west end turns and passes under it: a frontage road.
        way([
          [0.45, 0.5],
          [0.4, 0.5],
          [0.4, 0.6],
          [0.5, 0.6],
          [0.5, 0.4],
        ]),
      ],
      SIZE,
      flat,
    );
    const [bridge, frontage] = result as [Feature, Feature];
    expect(heightAt(frontage, 200, 200)).toBeCloseTo(0.32, 2);
    expect(heightAt(bridge, 200, 200)).toBeGreaterThanOrEqual(0.32 + TERRAIN_GRADE_SEPARATION.road);
    expect(Math.max(...profile(bridge).map((p) => p.elevation))).toBeLessThan(7.5);
    expect(profile(frontage)[0]?.elevation).toBeCloseTo(profile(bridge)[0]?.elevation as number, 5);
  });

  it('brings a road climbing to one structure down to pass beneath another', () => {
    const result = gradeTransportSeparations(
      [
        // An overpass at x = 200 whose east approach climbs along z = 200...
        way(
          [
            [0.45, 0.5],
            [0.55, 0.5],
          ],
          { bridge: true },
        ),
        way([
          [0.55, 0.5],
          [1, 0.5],
        ]),
        way([
          [0, 0.5],
          [0.45, 0.5],
        ]),
        motorway([
          [0.5, 0],
          [0.5, 1],
        ]),
        // ...and 40 m along it a second, unrelated bridge crosses over that approach.
        motorway(
          [
            [0.65, 0.2],
            [0.65, 0.8],
          ],
          { bridge: true, link: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [first, approach, , , second] = result as [Feature, Feature, Feature, Feature, Feature];
    // The approach leaves its own bridge at the deck's height, well off the ground...
    expect(profile(approach)[0]?.elevation).toBeCloseTo(
      profile(first).at(-1)?.elevation as number,
      5,
    );
    expect(profile(approach)[0]?.elevation).toBeGreaterThan(4);
    // ...and is down beneath the second, which stands where it would over a road on the ground:
    // cleared where it stood, the road lifted the deck, and a deck's ends lift more roads.
    const beneath = heightAt(approach, 260, 200);
    expect(heightAt(second, 260, 200) - beneath).toBeGreaterThanOrEqual(
      TERRAIN_GRADE_SEPARATION.road - 0.05,
    );
    expect(Math.max(...profile(second).map((p) => p.elevation))).toBeLessThan(7.5);
    // A steep ramp, not a step.
    expect(steepest(approach)).toBeLessThan(0.3);
  });

  it('keeps decks side by side level with each other', () => {
    const result = gradeTransportSeparations(
      [
        motorway(
          [
            [0, 0.5],
            [1, 0.5],
          ],
          { bridge: true, oneway: true },
        ),
        motorway(
          [
            [0, 0.53],
            [1, 0.53],
          ],
          { bridge: true, oneway: true },
        ),
        // Passes under the first carriageway and stops short of the second.
        way([
          [0.5, 0],
          [0.5, 0.51],
        ]),
      ],
      SIZE,
      flat,
    );
    const [north, south] = result as [Feature, Feature];
    expect(heightAt(north, 200, 200)).toBeGreaterThanOrEqual(0.32 + TERRAIN_GRADE_SEPARATION.road);
    expect(heightAt(south, 200, 212)).toBeCloseTo(heightAt(north, 200, 200), 1);
  });

  it('makes one surface of carriageways whose paving overlaps, however far apart they would stand', () => {
    const result = gradeTransportSeparations(
      [
        // Two carriageways 6 m apart and 10 m wide: mapped closer than they are drawn.
        motorway(
          [
            [0, 0.5],
            [1, 0.5],
          ],
          { bridge: true, oneway: true, layer: 2 },
        ),
        motorway(
          [
            [0, 0.515],
            [1, 0.515],
          ],
          { bridge: true, oneway: true, layer: 2 },
        ),
        // A lower deck that the first crosses and that stops short of the second: on its own
        // the first stands a story over the second, its edge barrier in the second's lanes.
        way(
          [
            [0.5, 0.3],
            [0.5, 0.5025],
          ],
          { bridge: true, layer: 1 },
        ),
      ],
      SIZE,
      flat,
    );
    const [north, south, lower] = result as [Feature, Feature, Feature];
    const top = heightAt(north, 200, 200);
    expect(top - heightAt(lower, 200, 200)).toBeGreaterThanOrEqual(
      TERRAIN_GRADE_SEPARATION.road - 0.05,
    );
    expect(top).toBeGreaterThan(12);
    for (const x of [140, 200, 260])
      expect(Math.abs(heightAt(south, x, 206) - heightAt(north, x, 200))).toBeLessThan(0.35);
  });

  it('leaves a bridge of another kind under a viaduct where it stands', () => {
    // A valley 14 m deep between two banks.
    const valley = (x: number): number => (x < 60 || x > 340 ? 14 : 0);
    const result = gradeTransportSeparations(
      [
        // A viaduct from bank to bank, and a railway bridge along the valley floor beneath it.
        way([
          [0, 0.5],
          [0.1, 0.5],
        ]),
        motorway(
          [
            [0.1, 0.5],
            [0.9, 0.5],
          ],
          { bridge: true, oneway: true },
        ),
        way([
          [0.9, 0.5],
          [1, 0.5],
        ]),
        rail(
          [
            [0.25, 0.505],
            [0.75, 0.505],
          ],
          { bridge: true },
        ),
      ],
      SIZE,
      valley,
    );
    const [, viaduct, , railway] = result as [Feature, Feature, Feature, Feature];
    expect(heightAt(viaduct, 200, 200, valley)).toBeGreaterThan(13);
    // Its paving lies under the viaduct's, and it is no part of the viaduct.
    expect(Math.max(...profile(railway).map((p) => p.elevation))).toBeLessThan(7.5);
  });

  it('holds a ramp level with the road it merges into for as long as their paving overlaps', () => {
    const result = gradeTransportSeparations(
      [
        // A street's deck between two banks, low near them...
        way([
          [0, 0.5],
          [0.15, 0.5],
        ]),
        way(
          [
            [0.15, 0.5],
            [0.5, 0.5],
            [0.85, 0.5],
          ],
          { bridge: true },
        ),
        way([
          [0.85, 0.5],
          [1, 0.5],
        ]),
        // ...and a freeway's ramp that comes in at a few degrees, over a road the street's deck
        // does not cross, and joins it in the middle.
        motorway(
          [
            [0.25, 0.4775],
            [0.5, 0.5],
          ],
          { bridge: true, link: true, oneway: true },
        ),
        way([
          [0.275, 0.3],
          [0.275, 0.49],
        ]),
      ],
      SIZE,
      flat,
    );
    const [, street, , ramp] = result as [Feature, Feature, Feature, Feature];
    // Over the road, the ramp is a story up...
    expect(heightAt(ramp, 110, 191.9)).toBeGreaterThanOrEqual(
      0.32 + TERRAIN_GRADE_SEPARATION.road - 0.05,
    );
    // ...and the street's deck beside it there is with it, not a wall's height below.
    for (const x of [110, 140, 170])
      expect(
        Math.abs(heightAt(street, x, 200) - heightAt(ramp, x, 191 + (x - 100) * 0.09)),
      ).toBeLessThan(0.6);
  });

  it('takes a ramp over both carriageways of a road, or under both', () => {
    const result = gradeTransportSeparations(
      [
        motorway(
          [
            [0, 0.5],
            [1, 0.5],
          ],
          { bridge: true, oneway: true },
        ),
        motorway(
          [
            [0, 0.53],
            [1, 0.53],
          ],
          { bridge: true, oneway: true },
        ),
        // A ramp that leaves the ground 35 m before the first carriageway and 47 m before the
        // second. So near its landing, the first's span stands just far enough over the ramp's
        // to be taken for the upper; the second's does not, and what each carries decides.
        way([
          [0.5, 0.3],
          [0.5, 0.4125],
        ]),
        motorway(
          [
            [0.5, 0.4125],
            [0.5, 0.65],
          ],
          { bridge: true, link: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [north, south, , ramp] = result as [Feature, Feature, Feature, Feature];
    const overNorth = heightAt(ramp, 200, 200) - heightAt(north, 200, 200),
      overSouth = heightAt(ramp, 200, 212) - heightAt(south, 200, 212);
    expect(Math.sign(overNorth)).toBe(Math.sign(overSouth));
    expect(Math.abs(overNorth)).toBeGreaterThanOrEqual(TERRAIN_GRADE_SEPARATION.road - 0.05);
    expect(Math.abs(overSouth)).toBeGreaterThanOrEqual(TERRAIN_GRADE_SEPARATION.road - 0.05);
  });

  it('lets decks joined too near to stand a story apart cross on the level', () => {
    // Two tracks on one bridge and a scissors crossover between them.
    const result = gradeTransportSeparations(
      [
        rail(
          [
            [0, 0.5],
            [0.45, 0.5],
            [0.55, 0.5],
            [1, 0.5],
          ],
          { bridge: true },
        ),
        rail(
          [
            [0, 0.51],
            [0.45, 0.51],
            [0.55, 0.51],
            [1, 0.51],
          ],
          { bridge: true },
        ),
        rail(
          [
            [0.45, 0.5],
            [0.55, 0.51],
          ],
          { bridge: true },
        ),
        rail(
          [
            [0.45, 0.51],
            [0.55, 0.5],
          ],
          { bridge: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [, , one, other] = result as [Feature, Feature, Feature, Feature];
    expect(Math.abs(heightAt(one, 200, 202) - heightAt(other, 200, 202))).toBeLessThan(0.3);
    for (const feature of result)
      expect(Math.max(...profile(feature).map((p) => p.elevation))).toBeLessThan(8);
  });

  it('gives decks that chase each other upward another arrangement', () => {
    const result = gradeTransportSeparations(
      [
        // A freeway's deck, a ramp that leaves it...
        motorway(
          [
            [0, 0.5],
            [0.5, 0.5],
            [1, 0.5],
          ],
          { bridge: true, oneway: true },
        ),
        motorway(
          [
            [0.5, 0.5],
            [0.75, 0.25],
          ],
          { bridge: true, link: true, oneway: true },
        ),
        // ...and a second freeway that crosses both, 25 m and 35 m from where they part. Running
        // north and south it is taken to pass over the first, and the ramp over it: the ramp
        // would climb two stories in the 35 m since it left the deck beneath them both.
        motorway(
          [
            [0.5625, 0.2],
            [0.5625, 0.8],
          ],
          { bridge: true, oneway: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [first, ramp, second] = result as [Feature, Feature, Feature];
    // Nothing ran up to the limit of what a deck may rise...
    for (const feature of result)
      expect(Math.max(...profile(feature).map((p) => p.elevation))).toBeLessThan(20);
    // ...and each crossing still clears, whichever way up it was left.
    expect(Math.abs(heightAt(first, 225, 200) - heightAt(second, 225, 200))).toBeGreaterThanOrEqual(
      TERRAIN_GRADE_SEPARATION.road - 0.05,
    );
    expect(Math.abs(heightAt(ramp, 225, 175) - heightAt(second, 225, 175))).toBeGreaterThanOrEqual(
      TERRAIN_GRADE_SEPARATION.road - 0.05,
    );
  });

  it('brings two climbing roads to a merge at one height, with no spike in either', () => {
    const result = gradeTransportSeparations(
      [
        // Two ramps' decks end 4 m apart, one a story above the other (it has a road to clear)...
        motorway(
          [
            [0.2, 0.5],
            [0.5, 0.5],
          ],
          { bridge: true, link: true, oneway: true },
        ),
        motorway(
          [
            [0.2, 0.62],
            [0.35, 0.56],
            [0.5, 0.51],
          ],
          { bridge: true, link: true, oneway: true },
        ),
        way([
          [0.3, 0.35],
          [0.3, 0.54],
        ]),
        // ...and the roads that carry them on merge 24 m later.
        motorway(
          [
            [0.5, 0.5],
            [0.56, 0.5],
            [0.95, 0.5],
          ],
          { link: true, oneway: true },
        ),
        motorway(
          [
            [0.5, 0.51],
            [0.56, 0.5],
          ],
          { link: true, oneway: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [, , , through, joining] = result as [Feature, Feature, Feature, Feature, Feature];
    expect(profile(joining).at(-1)?.elevation).toBeCloseTo(heightAt(through, 224, 200), 1);
    for (const feature of [through, joining]) {
      const samples = profile(feature);
      for (let i = 1; i + 1 < samples.length; i++)
        expect(
          Math.abs(
            (samples[i]?.elevation as number) -
              ((samples[i - 1]?.elevation as number) + (samples[i + 1]?.elevation as number)) / 2,
          ),
        ).toBeLessThan(0.6);
    }
  });

  it('leaves surveyed and authored roads untouched', () => {
    const source = [
      motorway(
        [
          [0, 0],
          [1, 0],
        ],
        { bridge: true, deckElevation: 23 },
      ),
      motorway(
        [
          [0, 0.2],
          [1, 0.2],
        ],
        { bridgeConnections: [{ point: [0, 0.2], elevation: 15, radius: 80 }] },
      ),
      motorway(
        [
          [0, 0.4],
          [1, 0.4],
        ],
        { bridge: true },
      ),
      motorway(
        [
          [0, 0.6],
          [1, 0.6],
        ],
        { bridge: true, tunnel: true },
      ),
    ];
    const result = gradeTransportSeparations(source, SIZE, flat);
    expect(result[0]).toBe(source[0]);
    expect(result[1]).toBe(source[1]);
    expect(result[3]).toBe(source[3]);
    expect(profile(result[2]).length).toBeGreaterThan(0);
    // Without a bridge to place, nothing is copied at all.
    const ground = [source[1] as Feature];
    expect(gradeTransportSeparations(ground, SIZE, flat)).toBe(ground);
  });

  it('reads neighboring tiles for what crosses and joins without returning them', () => {
    const deck = motorway(
      [
        [0.8, 0.5],
        [1, 0.5],
      ],
      { bridge: true },
    );
    const west = motorway([
      [0, 0.5],
      [0.8, 0.5],
    ]);
    // The same bridge carries on in the tile to the east, cut a few decimeters away, over a road.
    const context = [
      motorway(
        [
          [1.0006, 0.5004],
          [1.2, 0.5],
        ],
        { bridge: true },
      ),
      motorway([
        [1.2, 0.5],
        [2, 0.5],
      ]),
      way([
        [1.1, 0],
        [1.1, 1],
      ]),
    ];
    const alone = gradeTransportSeparations([west, deck], SIZE, flat);
    const joined = gradeTransportSeparations([west, deck], SIZE, flat, {
      context,
      endTolerance: 1.5,
    });
    expect(joined).toHaveLength(2);
    // Alone, the cut end can only assume a free clearance; joined, it knows what it crosses.
    expect(profile(alone[1]).at(-1)?.elevation).toBeCloseTo(6, 5);
    const end = profile(joined[1]).at(-1)?.elevation as number;
    expect(end).toBeGreaterThan(4.5);
    expect(end).toBeLessThan(0.32 + TERRAIN_GRADE_SEPARATION.road);
    // From the neighbor's side the same join gives the same height at the cut.
    const mirrored = gradeTransportSeparations(context, SIZE, flat, {
      context: [west, deck],
      endTolerance: 1.5,
    });
    expect(profile(mirrored[0])[0]?.elevation).toBeCloseTo(end, 5);
  });

  it('keeps a bridge over a road in a cutting out of the cutting when it is moved onto drawn ground', () => {
    // A cutting 8 m deep and 40 m wide, its road along the bottom, and a bridge 60 m long
    // from lip to lip. The grading reads the ground leveled along each way, as a tile's does.
    const cutting = (x: number): number => (Math.abs(x - 200) < 20 ? -8 : 0);
    const result = gradeTransportSeparations(
      [
        way([
          [0.2, 0.5],
          [0.425, 0.5],
        ]),
        way(
          [
            [0.425, 0.5],
            [0.575, 0.5],
          ],
          { bridge: true },
        ),
        way([
          [0.575, 0.5],
          [0.8, 0.5],
        ]),
        motorway([
          [0.5, 0],
          [0.5, 1],
        ]),
      ],
      SIZE,
      (x, z, dx, dz) => roadProfileHeight(cutting, x, z, dx, dz),
      { anchored: true },
    );
    const [, bridge] = result as [Feature, Feature];
    const path = terrainLinePath(bridge.lines[0] as TerrainSemanticPoint[], SIZE);
    // As a tile draws it: on the ground as it is, not as the grading read it.
    const drawn = bridgeDeckHeightFn(path, cutting, {
      clearance: 6,
      approachLift: 0.32,
      connects: [true, true],
      approachProfile: profile(bridge).map((sample) => ({
        ...sample,
        point: [sample.point[0] * SIZE, sample.point[1] * SIZE] as TerrainSemanticPoint,
      })),
    });
    // It lands on the road at the lip...
    expect(drawn(170, 200)).toBeCloseTo(0.32, 1);
    // ...and over the road in the cutting it stands where it was graded, a truck's height
    // clear: the ground under it there has not sunk since.
    for (const x of [192, 200, 208])
      expect(drawn(x, 200) - (cutting(x) + 0.32)).toBeGreaterThanOrEqual(
        TERRAIN_GRADE_SEPARATION.road - 0.3,
      );
  });

  it('clears a road where it climbs from a landing, not where it would lie on the ground', () => {
    const result = gradeTransportSeparations(
      [
        // A deck that clears a street 4 m before it lands on a road...
        way(
          [
            [0.3, 0.5],
            [0.5, 0.5],
          ],
          { bridge: true },
        ),
        way([
          [0.49, 0.3],
          [0.49, 0.7],
        ]),
        way([
          [0.5, 0.5],
          [0.8, 0.5],
        ]),
        // ...and another structure that crosses that road 10 m from the landing.
        way(
          [
            [0.525, 0.2],
            [0.525, 0.8],
          ],
          { bridge: true },
        ),
      ],
      SIZE,
      flat,
    );
    const [, , road, over] = result as [Feature, Feature, Feature, Feature];
    // The road comes down from the landing as a steep ramp might, not as a wall...
    expect(profile(road)[0]?.elevation).toBeGreaterThan(5);
    expect(steepest(road)).toBeLessThan(0.3);
    // ...and the other structure clears it where it stands.
    expect(heightAt(over, 210, 200) - heightAt(road, 210, 200)).toBeGreaterThanOrEqual(
      TERRAIN_GRADE_SEPARATION.road - 0.05,
    );
  });

  it('passes the direction of travel to callers that level roads along it', () => {
    const directions: [number, number][] = [];
    gradeTransportSeparations(
      [
        way(
          [
            [0.2, 0.5],
            [0.8, 0.5],
          ],
          { bridge: true },
        ),
      ],
      SIZE,
      (_x, _z, dx, dz) => {
        directions.push([dx, dz]);
        return 0;
      },
    );
    expect(directions.length).toBeGreaterThan(0);
    for (const [dx, dz] of directions) {
      expect(dx).toBeCloseTo(1);
      expect(dz).toBeCloseTo(0);
    }
  });

  it('is still reachable under its original name', () => {
    const source = [
      motorway(
        [
          [0, 0.5],
          [1, 0.5],
        ],
        { bridge: true },
      ),
    ];
    expect(gradeHighwayBridges(source, SIZE, flat)).toEqual(
      gradeTransportSeparations(source, SIZE, flat),
    );
  });
});
