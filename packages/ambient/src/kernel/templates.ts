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
  /** Vessels: ferry service or general navigation channel. */
  waterway?: 'ferry' | 'channel';
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

interface Outfit {
  height: number;
  build: number;
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  /** Figure features: body form, hair style, facial hair, sleeves, legwear. */
  look: Record<string, string>;
  shoes?: string;
}

const outfit = (
  height: number,
  build: number,
  skin: string,
  hair: string,
  top: string,
  bottom: string,
  look: Record<string, string>,
  shoes?: string,
): Outfit => ({ height, build, skin, hair, top, bottom, look, ...(shoes ? { shoes } : {}) });

// Skin tones from light to deep, hair colours, and a few common clothing colours.
const [SKIN0, SKIN1, SKIN2, SKIN3, SKIN4, SKIN5, SKIN6] = [
  '#f1d3bd',
  '#e0b597',
  '#d3a080',
  '#c68b62',
  '#9b6645',
  '#6c4430',
  '#4a2e21',
] as const;
const BLACK = '#1f1a17',
  DARK = '#3b2a20',
  BROWN = '#6b4a2e',
  AUBURN = '#7a3b22',
  LIGHT = '#a8793f',
  BLOND = '#d8c29a';
const NAVY = '#2f3b52',
  INK = '#1f1f24',
  WHITE = '#e8e6de',
  GREY = '#8a8f96',
  KHAKI = '#c9b48a',
  RED = '#6b2f2f',
  GREEN = '#2f5a3b',
  BLUE = '#3b6ea5',
  RUST = '#b0553a',
  PLUM = '#5a3b6b',
  MUSTARD = '#c9a227';

// A fixed wardrobe per age: walkers share bodies (and generated geometry) instead of each
// needing its own, while a street still looks varied: body forms, hair styles, facial hair,
// sleeves, trousers, shorts and skirts across the range of skin tones.
const ADULTS: readonly Outfit[] = [
  outfit(1.78, 0.2, SKIN3, BLACK, WHITE, NAVY, { form: 'masculine', hair: 'cap' }),
  outfit(1.64, -0.2, SKIN0, DARK, NAVY, INK, { form: 'feminine', hair: 'long' }),
  outfit(1.7, 0, SKIN5, BLACK, RED, GREY, {
    form: 'masculine',
    hair: 'buzz',
    facialHair: 'stubble',
    sleeves: 'short',
  }),
  outfit(1.84, 0.4, SKIN1, LIGHT, GREEN, KHAKI, {
    form: 'masculine',
    hair: 'crop',
    facialHair: 'beard',
  }),
  outfit(1.6, -0.3, SKIN4, BLACK, BLUE, INK, {
    form: 'feminine',
    hair: 'ponytail',
    legs: 'skirt',
  }),
  outfit(1.68, 0, SKIN0, BLOND, INK, NAVY, { form: 'feminine', hair: 'bob' }, WHITE),
  outfit(1.75, 0.1, SKIN6, BLACK, RUST, INK, { form: 'masculine', hair: 'afro' }),
  outfit(1.8, -0.1, SKIN1, BROWN, GREY, INK, {
    form: 'masculine',
    hair: 'cap',
    facialHair: 'mustache',
  }),
  outfit(1.66, -0.1, SKIN3, DARK, PLUM, GREY, { form: 'feminine', hair: 'bun', legs: 'skirt' }),
  outfit(1.72, 0, SKIN0, AUBURN, WHITE, BLUE, { hair: 'crop', sleeves: 'short' }, INK),
  outfit(1.65, 0.2, SKIN5, BLACK, MUSTARD, NAVY, {
    form: 'feminine',
    hair: 'afro',
    legs: 'skirt',
    sleeves: 'short',
  }),
  outfit(1.76, 0.5, SKIN0, '#9a9a9a', NAVY, KHAKI, {
    form: 'masculine',
    hair: 'balding',
    facialHair: 'beard',
  }),
  outfit(1.7, -0.2, SKIN2, LIGHT, WHITE, GREEN, { form: 'feminine', hair: 'long' }),
  outfit(1.82, 0.3, SKIN4, BLACK, INK, NAVY, {
    form: 'masculine',
    hair: 'buzz',
    sleeves: 'short',
  }),
  outfit(
    1.62,
    0,
    SKIN0,
    BROWN,
    RUST,
    KHAKI,
    {
      form: 'feminine',
      hair: 'ponytail',
      legs: 'shorts',
      sleeves: 'short',
    },
    WHITE,
  ),
  outfit(1.74, 0.1, SKIN3, DARK, BLUE, INK, {
    form: 'masculine',
    hair: 'cap',
    facialHair: 'stubble',
  }),
  outfit(1.58, 0.1, SKIN4, BLACK, WHITE, RED, { form: 'feminine', hair: 'bob', legs: 'skirt' }),
  outfit(1.69, -0.3, SKIN2, DARK, PLUM, GREY, { hair: 'crop' }),
  outfit(1.72, -0.3, SKIN6, BLACK, GREEN, INK, { form: 'feminine', hair: 'bun' }),
  outfit(1.8, 0, SKIN1, BROWN, INK, NAVY, {
    form: 'masculine',
    hair: 'ponytail',
    facialHair: 'beard',
  }),
];
const ELDERS: readonly Outfit[] = [
  outfit(1.72, 0.3, SKIN0, '#c8c8c4', GREY, NAVY, {
    form: 'masculine',
    hair: 'balding',
    facialHair: 'mustache',
  }),
  outfit(1.6, 0.2, SKIN3, '#e6e6e2', BROWN, INK, {
    form: 'feminine',
    hair: 'bob',
    legs: 'skirt',
  }),
  outfit(1.7, 0, SKIN5, '#b8b8b4', PLUM, GREY, { form: 'masculine', hair: 'cap' }),
  outfit(1.58, 0.1, SKIN0, '#d8d8d4', BLUE, NAVY, { form: 'feminine', hair: 'bun' }),
  outfit(1.68, 0.2, SKIN4, '#e6e6e2', GREEN, KHAKI, {
    form: 'masculine',
    hair: 'balding',
    facialHair: 'beard',
  }),
  outfit(1.62, -0.1, SKIN1, '#bdbdb8', RUST, INK, { form: 'feminine', hair: 'crop' }),
];
const CHILDREN: readonly Outfit[] = [
  outfit(1.2, 0, SKIN0, LIGHT, RUST, NAVY, { hair: 'cap' }),
  outfit(1.35, -0.2, SKIN4, BLACK, BLUE, INK, { hair: 'ponytail', legs: 'skirt' }),
  outfit(1.28, 0.1, SKIN1, DARK, GREEN, KHAKI, { hair: 'crop', legs: 'long', sleeves: 'long' }),
  outfit(1.15, 0, SKIN5, BLACK, MUSTARD, NAVY, { hair: 'afro' }),
  outfit(1.3, 0, SKIN0, BLOND, PLUM, GREY, { hair: 'bob', legs: 'skirt' }, WHITE),
];

function outfitFor(preset: string, seed: number): Outfit {
  const list = preset === 'human.child' ? CHILDREN : preset === 'human.elder' ? ELDERS : ADULTS;
  return list[Math.floor(unit01(seed, 40) * list.length)] as Outfit;
}

/** Built-in templates: vehicles render through `ambient-vehicle`, pedestrians as figures. */
export const DEFAULT_TEMPLATES: Readonly<Record<AmbientKind, AmbientTemplate>> = {
  boat: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  car: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  train: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  aircraft: (agent) => ({ renderable: { kind: 'ambient-vehicle', ref: agent.type } }),
  pedestrian: (agent) => {
    const dress = outfitFor(agent.type, agent.seed);
    return {
      figure: {
        preset: agent.type as AmbientPedestrianType['preset'],
        height: dress.height,
        build: dress.build,
        palette: {
          skin: dress.skin,
          hair: dress.hair,
          top: dress.top,
          bottom: dress.bottom,
          ...(dress.shoes ? { shoes: dress.shoes } : {}),
        },
        features: { ...dress.look },
        facing: 'manual',
        speedSource: 'transform',
      },
      renderable: { kind: 'figure', ref: 'procedural' },
    };
  },
};
