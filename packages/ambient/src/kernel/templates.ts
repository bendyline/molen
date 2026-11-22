/**
 * What agents are: vehicle types per class (dimensions, speeds, colours, spawn weights) and the
 * component templates a spawned agent receives beyond `ambientAgent` + `transform`. Hosts supply
 * types from their content packs (`ambientRole` on entity types); without them agents use proxy
 * dimensions and render as instanced boxes.
 */

import {
  type FigureDescriptor,
  figureFromLook,
  figureLookPool,
} from '@bendyline/molen-figures/look';
import type { ComponentMap } from '@bendyline/molen-schema';
import type { AmbientKind } from './components';
import { unit01 } from './ids';

export interface AmbientVehicleType {
  /** Content type id, or a proxy name. */
  id: string;
  /** Relative spawn weight within the class (default 1). */
  weight?: number;
  length: number;
  width: number;
  height?: number;
  /** Preferred cruise speed in m/s (default: the lane's design speed). */
  cruise?: number;
  /** Top speed in m/s. */
  max?: number;
  /** Body colours to pick from (default: a realistic car palette). */
  colors?: string[];
  /** Rail: cars per consist (every car this type), unless `consist` makes the train up. */
  cars?: number;
  /**
   * Rail: the tracks it runs on. `light` keeps to tram and light-rail lines, `heavy` to the
   * rest; absent runs anywhere.
   */
  track?: 'light' | 'heavy';
  /** Rail: a mixed train led by this type (its units, then cars drawn from a pool). */
  consist?: AmbientConsist;
  /** Vessels: ferry service or general navigation channel. */
  waterway?: 'ferry' | 'channel';
}

/** A car a {@link AmbientConsist} draws from. */
export interface AmbientConsistCar {
  /** Content type id. */
  id: string;
  length: number;
  width: number;
  height?: number;
  /** Relative draw weight (default 1). */
  weight?: number;
  colors?: string[];
}

/**
 * How a train led by a rail type makes up: `units` copies of the lead type (multiple-unit
 * locomotives), then `length` cars drawn in blocks of `block` alike from `cars`.
 */
export interface AmbientConsist {
  /** Lead units, inclusive range (default [1, 1]). */
  units?: [number, number];
  /** Cars after the units, inclusive range. */
  length: [number, number];
  /** Cars of one type in a row, inclusive range (default [1, 1]). */
  block?: [number, number];
  cars: AmbientConsistCar[];
}

export interface AmbientPedestrianType {
  preset: 'human.adult' | 'human.elder' | 'human.child';
  weight?: number;
}

export interface AmbientTypes {
  car: AmbientVehicleType[];
  train: AmbientVehicleType[];
  aircraft: AmbientVehicleType[];
  boat: AmbientVehicleType[];
  pedestrian: AmbientPedestrianType[];
}

/** Common real-world car body colours, weighted by repetition. */
export const CAR_COLORS: readonly string[] = [
  '#f2f2f0',
  '#f2f2f0',
  '#f2f2f0',
  '#1c1d21',
  '#1c1d21',
  '#1c1d21',
  '#8d9196',
  '#8d9196',
  '#b9bcbf',
  '#b9bcbf',
  '#2f4f86',
  '#8c1f1f',
  '#3f5a3c',
  '#6b4a2e',
  '#c9b48a',
];

export const DEFAULT_TYPES: AmbientTypes = {
  car: [
    { id: 'proxy.sedan', length: 4.6, width: 1.8, height: 1.45, weight: 3 },
    { id: 'proxy.suv', length: 4.8, width: 1.9, height: 1.75, weight: 2 },
    { id: 'proxy.compact', length: 4.0, width: 1.75, height: 1.45, weight: 2 },
    { id: 'proxy.van', length: 5.2, width: 2.0, height: 2.1, weight: 1 },
  ],
  train: [{ id: 'proxy.rail', length: 27, width: 2.65, height: 3.6, cars: 2, colors: ['#e8e6de'] }],
  aircraft: [{ id: 'proxy.airliner', length: 38, width: 36, height: 12, cruise: 110 }],
  boat: [
    { id: 'proxy.boat', length: 12, width: 4, height: 4, cruise: 5, waterway: 'channel' },
    { id: 'proxy.ferry', length: 32, width: 9, height: 8, cruise: 8, waterway: 'ferry' },
  ],
  pedestrian: [
    { preset: 'human.adult', weight: 7 },
    { preset: 'human.elder', weight: 1.5 },
    { preset: 'human.child', weight: 1.5 },
  ],
};

/** Weighted pick from a list using a stateless draw. */
export function pickWeighted<T extends { weight?: number }>(
  list: readonly T[],
  u: number,
): T | undefined {
  let total = 0;
  for (const item of list) total += item.weight ?? 1;
  if (total <= 0) return list[0];
  let target = u * total;
  for (const item of list) {
    target -= item.weight ?? 1;
    if (target < 0) return item;
  }
  return list[list.length - 1];
}

/** The details a template sees when an agent spawns. */
export interface AmbientSpawnInfo {
  id: string;
  kind: AmbientKind;
  type: string;
  seed: number;
  color?: string;
}

/** Extra components for a spawned agent (beyond `ambientAgent` and `transform`). */
export type AmbientTemplate = (agent: AmbientSpawnInfo) => ComponentMap;

/**
 * Who walks the streets: fixed pools of people from the figure-look catalogue (one per age), so
 * walkers share bodies (and generated geometry) while a street still looks varied. The catalogue
 * draws skin tone, face, hair style, hair colour and texture independently of each other and of
 * presentation; the pools cycle masculine, feminine and unspecified presentations, which steer
 * only body shape, facial hair and clothes.
 */
const POOL_SIZES: Readonly<Record<AmbientPedestrianType['preset'], number>> = {
  'human.adult': 24,
  'human.elder': 9,
  'human.child': 6,
};
const POOL_AGES: Readonly<Record<AmbientPedestrianType['preset'], 'adult' | 'elder' | 'child'>> = {
  'human.adult': 'adult',
  'human.elder': 'elder',
  'human.child': 'child',
};
const pools = new Map<string, FigureDescriptor[]>();

function poolFor(preset: string): FigureDescriptor[] {
  const key = preset in POOL_SIZES ? (preset as AmbientPedestrianType['preset']) : 'human.adult';
  let pool = pools.get(key);
  if (pool === undefined) {
    pool = figureLookPool(`molen-ambient-${key}`, {
      count: POOL_SIZES[key],
      age: POOL_AGES[key],
    }).map((look) => figureFromLook(look));
    pools.set(key, pool);
  }
  return pool;
}

function personFor(preset: string, seed: number): FigureDescriptor {
  const pool = poolFor(preset);
  return pool[Math.floor(unit01(seed, 40) * pool.length)] as FigureDescriptor;
}

/** Built-in templates: vehicles render through `ambient-vehicle`, pedestrians as figures. */
export const DEFAULT_TEMPLATES: Readonly<Record<AmbientKind, AmbientTemplate>> = {
  boat: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  car: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  train: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  aircraft: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  pedestrian: (agent) => ({
    figure: { ...personFor(agent.type, agent.seed), facing: 'manual', speedSource: 'transform' },
    renderable: { kind: 'figure', ref: 'procedural' },
  }),
};
