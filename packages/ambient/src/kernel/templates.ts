/**
 * What agents are: vehicle types per class (dimensions, speeds, colours, spawn weights) and the
 * component templates a spawned agent receives beyond `ambientAgent` + `transform`. Hosts supply
 * types from their content packs (`ambientRole` on entity types); without them agents use proxy
 * dimensions and render as instanced boxes.
 */

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
  /** Rail: cars per consist. */
  cars?: number;
}

export interface AmbientPedestrianType {
  preset: 'human.adult' | 'human.elder' | 'human.child';
  weight?: number;
}

export interface AmbientTypes {
  car: AmbientVehicleType[];
  train: AmbientVehicleType[];
  aircraft: AmbientVehicleType[];
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

interface Outfit {
  height: number;
  build: number;
  skin: string;
  hair: string;
  top: string;
  bottom: string;
}

// A fixed wardrobe per age: walkers share bodies (and generated geometry) instead of each
// needing its own, while a street still looks varied.
const ADULTS: readonly Outfit[] = [
  {
    height: 1.62,
    build: -0.2,
    skin: '#f1d3bd',
    hair: '#3b2a20',
    top: '#2f3b52',
    bottom: '#1f1f24',
  },
  { height: 1.78, build: 0.2, skin: '#c68b62', hair: '#1f1a17', top: '#e8e6de', bottom: '#2f3b52' },
  { height: 1.7, build: 0, skin: '#6c4430', hair: '#1f1a17', top: '#6b2f2f', bottom: '#8a8f96' },
  { height: 1.84, build: 0.4, skin: '#e0b597', hair: '#a8793f', top: '#2f5a3b', bottom: '#c9b48a' },
  {
    height: 1.58,
    build: -0.4,
    skin: '#9b6645',
    hair: '#1f1a17',
    top: '#3b6ea5',
    bottom: '#1f1f24',
  },
  { height: 1.74, build: 0.1, skin: '#f1d3bd', hair: '#d8c29a', top: '#1f1f24', bottom: '#2f3b52' },
  { height: 1.66, build: 0.3, skin: '#4a2e21', hair: '#1f1a17', top: '#b0553a', bottom: '#1f1f24' },
  { height: 1.8, build: -0.1, skin: '#e0b597', hair: '#6b4a2e', top: '#8a8f96', bottom: '#1f1f24' },
  { height: 1.68, build: 0, skin: '#c68b62', hair: '#3b2a20', top: '#5a3b6b', bottom: '#8a8f96' },
  { height: 1.76, build: 0.5, skin: '#f1d3bd', hair: '#9a9a9a', top: '#2f3b52', bottom: '#c9b48a' },
  { height: 1.6, build: 0.2, skin: '#9b6645', hair: '#3b2a20', top: '#e8e6de', bottom: '#3b6ea5' },
  {
    height: 1.72,
    build: -0.3,
    skin: '#6c4430',
    hair: '#1f1a17',
    top: '#2f5a3b',
    bottom: '#1f1f24',
  },
];
const ELDERS: readonly Outfit[] = [
  { height: 1.64, build: 0.2, skin: '#f1d3bd', hair: '#c8c8c4', top: '#8a8f96', bottom: '#2f3b52' },
  { height: 1.72, build: 0.3, skin: '#c68b62', hair: '#e6e6e2', top: '#6b4a2e', bottom: '#1f1f24' },
  { height: 1.58, build: 0, skin: '#6c4430', hair: '#b8b8b4', top: '#5a3b6b', bottom: '#8a8f96' },
];
const CHILDREN: readonly Outfit[] = [
  { height: 1.2, build: 0, skin: '#f1d3bd', hair: '#a8793f', top: '#b0553a', bottom: '#2f3b52' },
  {
    height: 1.35,
    build: -0.2,
    skin: '#9b6645',
    hair: '#1f1a17',
    top: '#3b6ea5',
    bottom: '#1f1f24',
  },
  { height: 1.28, build: 0.1, skin: '#e0b597', hair: '#3b2a20', top: '#2f5a3b', bottom: '#c9b48a' },
];

function outfitFor(preset: string, seed: number): Outfit {
  const list = preset === 'human.child' ? CHILDREN : preset === 'human.elder' ? ELDERS : ADULTS;
  return list[Math.floor(unit01(seed, 40) * list.length)] as Outfit;
}

/** Built-in templates: vehicles render through `ambient-vehicle`, pedestrians as figures. */
export const DEFAULT_TEMPLATES: Readonly<Record<AmbientKind, AmbientTemplate>> = {
  car: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  train: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  aircraft: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  pedestrian: (agent) => {
    const outfit = outfitFor(agent.type, agent.seed);
    return {
      figure: {
        preset: agent.type as AmbientPedestrianType['preset'],
        height: outfit.height,
        build: outfit.build,
        palette: { skin: outfit.skin, hair: outfit.hair, top: outfit.top, bottom: outfit.bottom },
        facing: 'manual',
        speedSource: 'transform',
      },
      renderable: { kind: 'figure', ref: 'procedural' },
    };
  },
};
