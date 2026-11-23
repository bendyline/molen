import { describe, expect, it } from 'vitest';
import { gradeTransportSeparations } from '../src/grade-separation';
import { Heightfield } from '../src/heightfield';
import {
  type TerrainPyramidDescriptor,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '../src/pyramid-types';
import { roadProfileHeight } from '../src/road-earthworks';
import {
  gradeRoadSeparationRequest,
  gradeRoadSeparationSteps,
  ROAD_SEPARATION_CELL,
  ROAD_SEPARATION_END_TOLERANCE,
  ROAD_SEPARATION_REACH,
  ROAD_SEPARATION_SPACING,
  ROAD_SEPARATION_WAY_STRIDE,
  RoadSeparationPacker,
  type RoadSeparationResult,
  roadSeparationCell,
  roadSeparationCellRange,
  roadSeparationProfile,
  roadSeparationRequestTransfer,
  roadSeparationSignature,
  roadSeparationTransfer,
} from '../src/road-separation';
import type {
  TerrainBridgeProfileSample,
  TerrainSemanticPoint,
  TerrainTransportationFeature,
} from '../src/semantic-types';

type Feature = TerrainTransportationFeature;
const way = (line: TerrainSemanticPoint[], extra: Partial<Feature> = {}): Feature => ({
  class: 'major_road',
  subclass: 'secondary',
  width: 10,
  lines: [line],
  ...extra,
});

const RANGE = { min: -50, max: 250 };
const pyramid: TerrainPyramidDescriptor = {
  name: 'road-separation-test',
  origin: [0, 0],
  rootSize: 3200,
  minLevel: 0,
  maxLevel: 3,
  tileResolution: 65,
  height: RANGE,
  layers: [],
  skirts: false,
};
const address = { level: 3, x: 3, z: 3 };
const SIZE = terrainPyramidTileSize(pyramid, 3);
const ORIGIN = terrainPyramidTileOrigin(pyramid, address);
/** A slope with a dip under the interchange, in world meters. */
const hillside = (x: number, z: number): number =>
  20 + z * 0.01 - 6 * Math.exp(-(((x - 1400) / 60) ** 2));

// An interchange in one tile: a street over a motorway and a railway, a ramp that leaves the
// street's deck and comes down beside the motorway, a footbridge, and what the grading must
// leave alone. The tile east of it holds the far ends, as the roads around.
const own: Feature[] = [
  way([
    [0.05, 0.5],
    [0.3, 0.5],
  ]),
  way(
    [
      [0.3, 0.5],
      [0.7, 0.5],
    ],
    { bridge: true, lanes: 4 },
  ),
  way([
    [0.7, 0.5],
    [1, 0.5],
  ]),
  way(
    [
      [0.5, 0],
      [0.5, 1],
    ],
    { class: 'highway', subclass: 'motorway', oneway: true, layer: 0 },
  ),
  way(
    [
      [0.42, 0],
      [0.42, 1],
    ],
    { class: 'rail', subclass: 'rail', width: 3 },
  ),
  way(
    [
      [0.6, 0.5],
      [0.62, 0.6],
      [0.56, 0.8],
    ],
    { class: 'highway', subclass: 'motorway_link', link: true, bridge: true, layer: 1 },
  ),
  way(
    [
      [0.56, 0.8],
      [0.54, 0.98],
    ],
    { class: 'highway', subclass: 'motorway_link', link: true },
  ),
  way(
    [
      [0.2, 0.2],
      [0.8, 0.25],
    ],
    { class: 'path', subclass: 'footway', width: 3, bridge: true },
  ),
  way(
    [
      [0.1, 0.9],
      [0.9, 0.9],
    ],
    { class: 'minor_road', subclass: 'service', service: 'alley', width: undefined },
  ),
  // Not graded: a tunnel, a ferry, airside pavement, and decks whose heights are given.
  way(
    [
      [0.1, 0.1],
      [0.9, 0.1],
    ],
    { tunnel: true },
  ),
  way(
    [
      [0, 0.3],
      [1, 0.3],
    ],
    { class: 'ferry' },
  ),
  way(
    [
      [0, 0.7],
      [1, 0.7],
    ],
    { class: 'minor_road', subclass: 'service', tags: { aeroway: 'taxiway' } },
  ),
  way(
    [
      [0.1, 0.6],
      [0.9, 0.6],
    ],
    { bridge: true, deckElevation: 40 },
  ),
];
const around: Feature[] = [
  way([
    [1, 0.5],
    [1.4, 0.5],
  ]),
  way(
    [
      [1.1, 0.3],
      [1.1, 0.7],
    ],
    { bridge: true },
  ),
  {
    class: 'major_road',
    subclass: 'tertiary',
    lines: [
      [
        [1.05, 0.2],
        [1.3, 0.2],
      ],
      [
        [1.3, 0.2],
        [1.3, 0.9],
      ],
    ],
  },
];

function packed(): { packer: RoadSeparationPacker; sent: number[] } {
  const packer = new RoadSeparationPacker();
  const sent: number[] = [];
  own.forEach((feature, i) => {
    if (packer.add(feature, feature.lines[0] as TerrainSemanticPoint[])) sent.push(i);
  });
  packer.endOwn();
  for (const feature of around) for (const line of feature.lines) packer.add(feature, line);
  return { packer, sent };
}
const request = (packer: RoadSeparationPacker) =>
  packer.request({ address, extend: 12, referenceLevel: 1, reach: 500 });
const finish = <T>(steps: Generator<undefined, T, undefined>): T => {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
};

describe('road separation requests', () => {
  it('packs the ways that take part, each with what the grading reads of it', () => {
    const { packer, sent } = packed();
    // The tunnel, the ferry, the taxiway and the surveyed deck stay behind.
    expect(sent).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(packer.bridges).toBe(true);
    const made = request(packer);
    expect(made.own).toBe(9);
    // Four ways around: the two-line feature is two ways of one kind.
    expect(made.wayKinds).toHaveLength(13);
    expect(made.wayKinds[11]).toBe(made.wayKinds[12]);
    expect(made.kinds).toHaveLength(12);
    expect(made.kinds[1]).toEqual({
      class: 'major_road',
      subclass: 'secondary',
      width: 10,
      lanes: 4,
      bridge: true,
    });
    expect(made.kinds[3]).toEqual({
      class: 'highway',
      subclass: 'motorway',
      width: 10,
      oneway: true,
      layer: 0,
    });
    expect(made.kinds[5]).toMatchObject({ link: true, layer: 1, bridge: true });
    expect(made.kinds[8]).toEqual({ class: 'minor_road', subclass: 'service', service: 'alley' });
    // Points as they were given, way after way.
    expect([...made.points.subarray(0, 4)]).toEqual([0.05, 0.5, 0.3, 0.5]);
    expect([...made.wayEnds.subarray(4, 7)]).toEqual([10, 13, 15]);
    expect(roadSeparationRequestTransfer(made)).toHaveLength(3);
    // Without a bridge that takes part there is nothing to grade.
    const plain = new RoadSeparationPacker();
    expect(
      plain.add(own[0] as Feature, (own[0] as Feature).lines[0] as TerrainSemanticPoint[]),
    ).toBe(true);
    expect(
      plain.add(own[12] as Feature, (own[12] as Feature).lines[0] as TerrainSemanticPoint[]),
    ).toBe(false);
    expect(plain.bridges).toBe(false);
    expect(plain.ways).toBe(1);
  });

  it('comes to what the grading itself makes of the same roads, to the last bit', () => {
    // The grading as a caller with the features in hand runs it.
    const pieces = own.filter((feature) => !feature.tunnel);
    const ways: { signature: string; data: Float64Array }[] = [];
    const cells = new Map<number, number[]>();
    const graded = gradeTransportSeparations(
      pieces,
      SIZE,
      (x, z, dx, dz) => roadProfileHeight(hillside, ORIGIN[0] + x, ORIGIN[1] + z, dx, dz),
      {
        context: around,
        endTolerance: ROAD_SEPARATION_END_TOLERANCE,
        spacing: ROAD_SEPARATION_SPACING,
        anchored: true,
        extend: 12,
        profiled(feature, _line, samples) {
          if (samples.length < 2) return;
          const data = new Float64Array(samples.length * ROAD_SEPARATION_WAY_STRIDE);
          samples.forEach((sample, i) => {
            data.set(
              [
                ORIGIN[0] + sample.point[0] * SIZE,
                ORIGIN[1] + sample.point[1] * SIZE,
                sample.elevation,
                sample.flatness,
                sample.anchor ?? 0,
                sample.ground ?? 0,
              ],
              i * ROAD_SEPARATION_WAY_STRIDE,
            );
          });
          const index = ways.length;
          ways.push({ signature: roadSeparationSignature(feature), data });
          for (let i = 0; i + 1 < samples.length; i++) {
            const [ax, az, bx, bz] = [
              0,
              1,
              ROAD_SEPARATION_WAY_STRIDE,
              ROAD_SEPARATION_WAY_STRIDE + 1,
            ].map((offset) => data[i * ROAD_SEPARATION_WAY_STRIDE + offset] as number) as [
              number,
              number,
              number,
              number,
            ];
            for (
              let cx = Math.floor(
                (Math.min(ax, bx) - ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL,
              );
              cx <= Math.floor((Math.max(ax, bx) + ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL);
              cx++
            )
              for (
                let cz = Math.floor(
                  (Math.min(az, bz) - ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL,
                );
                cz <= Math.floor((Math.max(az, bz) + ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL);
                cz++
              ) {
                const key = roadSeparationCell(cx, cz);
                cells.set(key, [...(cells.get(key) ?? []), index, i]);
              }
          }
        },
      },
    );
    const expected = new Map<number, TerrainBridgeProfileSample[]>();
    graded.forEach((feature, i) => {
      if (feature.bridgeApproachProfile?.length && feature !== pieces[i])
        expected.set(own.indexOf(pieces[i] as Feature), feature.bridgeApproachProfile);
    });
    // The interchange is graded: both decks, the ramp, the footbridge and the roads that climb.
    expect(expected.size).toBeGreaterThanOrEqual(5);
    expect(ways.length).toBeGreaterThan(expected.size);

    const { packer, sent } = packed();
    const result = finish(gradeRoadSeparationSteps(request(packer), ORIGIN, SIZE, hillside));
    const profiles = new Map<number, TerrainBridgeProfileSample[]>();
    result.profiled.forEach((way, k) => {
      profiles.set(sent[way] as number, roadSeparationProfile(result, k));
    });
    expect([...profiles.keys()]).toEqual([...expected.keys()]);
    for (const [piece, samples] of expected) expect(profiles.get(piece)).toStrictEqual(samples);
    // Every graded way, the roads around among them, station for station.
    expect(result.signatures).toEqual(ways.map((graded) => graded.signature));
    ways.forEach((graded, index) => {
      const from = index === 0 ? 0 : (result.wayEnds[index - 1] as number);
      expect(
        result.ways.subarray(
          from * ROAD_SEPARATION_WAY_STRIDE,
          (result.wayEnds[index] as number) * ROAD_SEPARATION_WAY_STRIDE,
        ),
      ).toEqual(graded.data);
    });
    // And the same segments in each cell, in the order they were met.
    expect([...result.cellKeys]).toEqual([...cells.keys()].sort((a, b) => a - b));
    for (const [key, list] of cells) {
      const cx = Math.floor(key / 0x400000) - 0x200000,
        cz = (key % 0x400000) - 0x200000;
      const [from, to] = roadSeparationCellRange(
        result,
        (cx + 0.5) * ROAD_SEPARATION_CELL,
        (cz + 0.5) * ROAD_SEPARATION_CELL,
      );
      expect([...result.cells.subarray(from, to)]).toEqual(list);
    }
    expect(roadSeparationCellRange(result, -1e6, -1e6)).toEqual([0, 0]);
    expect(roadSeparationTransfer(result)).toHaveLength(8);
    expect(new Set(roadSeparationTransfer(result)).size).toBe(8);
  });

  it('grades nothing without a bridge that takes part, and says so with empty arrays', () => {
    const packer = new RoadSeparationPacker();
    for (const index of [0, 2, 3])
      packer.add(own[index] as Feature, (own[index] as Feature).lines[0] as TerrainSemanticPoint[]);
    const result = finish(gradeRoadSeparationSteps(request(packer), ORIGIN, SIZE, hillside));
    expect(result.profiled).toHaveLength(0);
    expect(result.signatures).toEqual([]);
    expect(result.ways).toHaveLength(0);
    expect(result.cellKeys).toHaveLength(0);
  });

  it('reads the reference ground where it is graded, pauses for other work, and stops when told', async () => {
    const loads: string[] = [];
    const side = pyramid.tileResolution;
    const load = async (at: { level: number; x: number; z: number }): Promise<Heightfield> => {
      loads.push(`${at.level}/${at.x}/${at.z}`);
      const size = terrainPyramidTileSize(pyramid, at.level);
      const origin = terrainPyramidTileOrigin(pyramid, at);
      const grid = new Float32Array(side * side);
      for (let row = 0; row < side; row++)
        for (let column = 0; column < side; column++)
          grid[row * side + column] =
            (hillside(
              origin[0] + (column / (side - 1)) * size,
              origin[1] + (row / (side - 1)) * size,
            ) -
              RANGE.min) /
            (RANGE.max - RANGE.min);
      return new Heightfield(grid, side, side, { origin, worldSize: [size, size], height: RANGE });
    };
    let pauses = 0;
    let worked = -1;
    const result = (await gradeRoadSeparationRequest(pyramid, load, request(packed().packer), {
      sliceMs: 0,
      pause: async () => {
        pauses++;
        return true;
      },
      onWork: (milliseconds) => {
        worked = milliseconds;
      },
    })) as RoadSeparationResult;
    // One elevation level for the tile and its reach, whichever tile asks.
    expect(loads.length).toBeGreaterThan(0);
    expect(loads.every((key) => key.startsWith('1/'))).toBe(true);
    expect(result.profiled.length).toBeGreaterThanOrEqual(5);
    expect(pauses).toBeGreaterThan(0);
    expect(worked).toBeGreaterThanOrEqual(0);
    // The same grading in one go, without pauses.
    const whole = await gradeRoadSeparationRequest(pyramid, load, request(packed().packer));
    expect(whole).toEqual(result);
    // Told to stop at the first pause: no result. No ground to grade over: null.
    expect(
      await gradeRoadSeparationRequest(pyramid, load, request(packed().packer), {
        sliceMs: 0,
        pause: async () => false,
      }),
    ).toBeUndefined();
    expect(
      await gradeRoadSeparationRequest(pyramid, async () => undefined, request(packed().packer)),
    ).toBeNull();
  });
});
