/**
 * Deterministic synthetic semantic tiles for the `?synthetic=1` path: a road with hashed
 * footprints of every shape class, land-use bands with density, and (with `lineup`) one of each
 * shape class in a row so goldens cover every footprint kind without real data.
 */

import {
  createEmptyTerrainSemanticTile,
  type TerrainPyramidTileAddress,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  WEB_MERCATOR_HALF_WORLD_METERS,
} from '@bendyline/molen-terrain/kernel';
import type { PlacesContent } from '@bendyline/molen-worldgen-earth/kernel';
import { businessShowcaseTile } from './business-showcase';
import { houseShowcaseTile } from './house-showcase';
import { parkingShowcaseTile } from './parking-showcase';

export type SyntheticShapeClass =
  | 'rect'
  | 'rotated-rect'
  | 'L'
  | 'U'
  | 'H'
  | 'T'
  | 'Z'
  | 'plus'
  | 'courtyard'
  | 'irregular';

export const SYNTHETIC_SHAPE_CLASSES: readonly SyntheticShapeClass[] = [
  'rect',
  'rotated-rect',
  'L',
  'U',
  'H',
  'T',
  'Z',
  'plus',
  'courtyard',
  'irregular',
];

/** Building labels used for the lineup, one per shape class. */
const LINEUP_CLASSES: Readonly<Record<SyntheticShapeClass, { kind: string; detail?: string }>> = {
  rect: { kind: 'building', detail: 'house' },
  'rotated-rect': { kind: 'building', detail: 'house' },
  L: { kind: 'building', detail: 'house' },
  U: { kind: 'building', detail: 'house' },
  H: { kind: 'building', detail: 'school' },
  T: { kind: 'building', detail: 'house' },
  Z: { kind: 'building', detail: 'house' },
  plus: { kind: 'building', detail: 'church' },
  courtyard: { kind: 'building', detail: 'apartments' },
  irregular: { kind: 'building', detail: 'commercial' },
};

/** Lineup row layout in meters (shared with the visual scenario that frames it). */
export const LINEUP_SPACING_METERS: number = 40;
export const LINEUP_OFFSET_METERS: number = 120;

export interface SyntheticFootprintParams {
  centerU: number;
  centerV: number;
  /** Half extents in tile units. */
  sizeU: number;
  sizeV: number;
  /** Rotation in radians. */
  angle: number;
  /** Wing thickness as a fraction of the size (default 0.4). */
  wing?: number;
}

function random01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

/** Unit shapes in [-1, 1]², positive orientation. */
function unitShape(shape: SyntheticShapeClass, wing: number): TerrainSemanticPoint[][] {
  const w = wing;
  switch (shape) {
    case 'rect':
    case 'rotated-rect':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ],
      ];
    case 'L':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, -1 + 2 * w],
          [-1 + 2 * w, -1 + 2 * w],
          [-1 + 2 * w, 1],
          [-1, 1],
        ],
      ];
    case 'U':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [1 - 2 * w, 1],
          [1 - 2 * w, -1 + 2 * w],
          [-1 + 2 * w, -1 + 2 * w],
          [-1 + 2 * w, 1],
          [-1, 1],
        ],
      ];
    case 'H':
      return [
        [
          [-1, -1],
          [-1 + 2 * w, -1],
          [-1 + 2 * w, -w],
          [1 - 2 * w, -w],
          [1 - 2 * w, -1],
          [1, -1],
          [1, 1],
          [1 - 2 * w, 1],
          [1 - 2 * w, w],
          [-1 + 2 * w, w],
          [-1 + 2 * w, 1],
          [-1, 1],
        ],
      ];
    case 'T':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, -1 + 2 * w],
          [w, -1 + 2 * w],
          [w, 1],
          [-w, 1],
          [-w, -1 + 2 * w],
          [-1, -1 + 2 * w],
        ],
      ];
    case 'Z':
      return [
        [
          [-1, -1],
          [2 * w - 0.2, -1],
          [2 * w - 0.2, -w],
          [1, -w],
          [1, 1],
          [-2 * w + 0.2, 1],
          [-2 * w + 0.2, w],
          [-1, w],
        ],
      ];
    case 'plus':
      return [
        [
          [-w, -1],
          [w, -1],
          [w, -w],
          [1, -w],
          [1, w],
          [w, w],
          [w, 1],
          [-w, 1],
          [-w, w],
          [-1, w],
          [-1, -w],
          [-w, -w],
        ],
      ];
    case 'courtyard':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ],
        [
          [-1 + 2 * w, -1 + 2 * w],
          [-1 + 2 * w, 1 - 2 * w],
          [1 - 2 * w, 1 - 2 * w],
          [1 - 2 * w, -1 + 2 * w],
        ],
      ];
    default:
      return [
        [
          [-1, -0.6],
          [-0.2, -1],
          [1, -0.7],
          [0.8, 0.6],
          [0.1, 1],
          [-0.7, 0.8],
        ],
      ];
  }
}

/** One footprint (outer ring plus holes) in tile units. */
export function syntheticFootprint(
  shape: SyntheticShapeClass,
  params: SyntheticFootprintParams,
): { outer: TerrainSemanticPoint[]; holes?: TerrainSemanticPoint[][] } {
  const cosine = Math.cos(params.angle);
  const sine = Math.sin(params.angle);
  const rings = unitShape(shape, params.wing ?? 0.4).map((ring) =>
    ring.map(([x, z]): TerrainSemanticPoint => {
      const sx = x * params.sizeU;
      const sz = z * params.sizeV;
      return [params.centerU + sx * cosine - sz * sine, params.centerV + sx * sine + sz * cosine];
    }),
  );
  const [outer, ...holes] = rings;
  return { outer: outer as TerrainSemanticPoint[], ...(holes.length > 0 ? { holes } : {}) };
}

function roadLocalV(address: TerrainPyramidTileAddress, u: number): number {
  const phase = (address.x + u) * 1.35 + address.z * 0.41;
  return 0.5 + Math.sin(phase) * 0.1 + Math.sin(phase * 0.37) * 0.045;
}

function tileWorldSize(address: TerrainPyramidTileAddress): number {
  return (WEB_MERCATOR_HALF_WORLD_METERS * 2) / 2 ** address.level;
}

export interface SyntheticFeatureTileOptions {
  /** Lay out the store review block from this business catalog and its landmark signs. */
  stores?: PlacesContent;
  houses?: boolean;
  parking?: boolean;
  /** Lay one building of each shape class along the road instead of the hashed spread. */
  lineup?: boolean;
}

/** Road plus buildings; every third row of tiles carries the spread, the lineup always renders. */
export function syntheticFeatureTile(
  address: TerrainPyramidTileAddress,
  options: SyntheticFeatureTileOptions = {},
): TerrainSemanticTile {
  if (options.parking) return parkingShowcaseTile(tileWorldSize(address));
  if (options.houses) return houseShowcaseTile(tileWorldSize(address));
  if (options.stores) return businessShowcaseTile(tileWorldSize(address), options.stores);
  const tile = createEmptyTerrainSemanticTile();
  const lineup = options.lineup === true;
  if (!lineup && ((address.z % 3) + 3) % 3 !== 0) return tile;
  const worldSize = tileWorldSize(address);
  const road: TerrainSemanticPoint[] = [];
  for (let index = 0; index <= 32; index++) {
    const u = index / 32;
    road.push([u, lineup ? 0.5 : roadLocalV(address, u)]);
  }
  tile.transportation.push({
    id: `${address.level}/${address.x}/${address.z}:road`,
    class: 'secondary',
    width: 13,
    lines: [road],
  });
  tile.landcover.push({
    id: `${address.level}/${address.x}/${address.z}:residential`,
    class: 'residential',
    polygons: [
      {
        outer: [
          [0, 0.3],
          [1, 0.3],
          [1, 0.7],
          [0, 0.7],
        ],
      },
    ],
  });
  if (lineup) {
    // One building of each shape class in a compact row 120 m north of the road, so a camera
    // south of the road looking north (yaw -pi/2) frames all of them.
    const spacing = LINEUP_SPACING_METERS / worldSize;
    SYNTHETIC_SHAPE_CLASSES.forEach((shape, index) => {
      const u = 0.5 + (index - (SYNTHETIC_SHAPE_CLASSES.length - 1) / 2) * spacing;
      const half =
        (shape === 'courtyard' || shape === 'H' || shape === 'irregular' ? 15 : 10) / worldSize;
      const labels = LINEUP_CLASSES[shape];
      tile.buildings.push({
        id: `${address.level}/${address.x}/${address.z}:lineup:${index}`,
        class: labels.kind,
        ...(labels.detail !== undefined ? { subclass: labels.detail } : {}),
        polygons: [
          syntheticFootprint(shape, {
            centerU: u,
            centerV: 0.5 - LINEUP_OFFSET_METERS / worldSize,
            sizeU: half,
            sizeV: half * (shape === 'rect' ? 0.7 : 1),
            angle: shape === 'rotated-rect' ? 0.6 : 0,
          }),
        ],
        ...(shape === 'irregular' ? { height: 14 } : {}),
      });
    });
    return tile;
  }
  for (let index = 0; index < 24; index++) {
    const seed = (address.x * 91_273) ^ (address.z * 130_363) ^ (index * 17_389);
    const u = 0.06 + random01(seed) * 0.88;
    const side = random01(seed ^ 0x27d4eb2d) > 0.5 ? 1 : -1;
    const v = roadLocalV(address, u) + (side * (34 + random01(seed ^ 0x165667b1) * 75)) / worldSize;
    if (v < 0.02 || v > 0.98) continue;
    const half = (12 + random01(seed ^ 0xd3a2646c) * 22) / worldSize;
    const nextV = roadLocalV(address, Math.min(1, u + 0.01));
    const angle = Math.atan2(nextV - roadLocalV(address, u), 0.01);
    const shape = SYNTHETIC_SHAPE_CLASSES[
      Math.floor(random01(seed ^ 0x9e3779b9) * SYNTHETIC_SHAPE_CLASSES.length)
    ] as SyntheticShapeClass;
    const big = random01(seed ^ 0xfd7046c5) > 0.8;
    tile.buildings.push({
      id: `${address.level}/${address.x}/${address.z}:building:${index}`,
      class: 'building',
      subclass: big ? 'commercial' : 'house',
      polygons: [
        syntheticFootprint(shape, {
          centerU: u,
          centerV: v,
          sizeU: half * (big ? 2.2 : 1),
          sizeV: half * (big ? 1.6 : 0.8),
          angle,
        }),
      ],
      ...(big ? { height: 12 + random01(seed ^ 0x632be59b) * 30 } : {}),
    });
  }
  return tile;
}

/** Land-use bands with density so scatter rules and surface colors have something to work with. */
export function syntheticLandcoverTile(address: TerrainPyramidTileAddress): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  // Narrow bands keep synthetic scatter counts modest at the demo's coarse tile size.
  const bands: Array<[className: string, subclass: string | undefined, v0: number, v1: number]> = [
    ['forest', 'temperate', 0.4, 0.44],
    ['residential', undefined, 0.44, 0.56],
    ['grass', 'meadow', 0.56, 0.6],
    ['scrub', undefined, 0.6, 0.62],
  ];
  bands.forEach(([className, subclass, v0, v1], index) => {
    tile.landcover.push({
      id: `${address.level}/${address.x}/${address.z}:${className}:${index}`,
      class: className,
      ...(subclass !== undefined ? { subclass } : {}),
      density: 1,
      polygons: [
        {
          outer: [
            [0, v0],
            [1, v0],
            [1, v1],
            [0, v1],
          ],
        },
      ],
    });
  });
  return tile;
}
