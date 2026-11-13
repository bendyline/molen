// What the "Replace building" controls put where a mapped building stood: map overrides, each
// built for a rectangle of the world. They are data, laid out in the override's own frame: meters
// from the rectangle's center, +x east and +z south, turned by the rectangle's heading.

import type { EarthOverride } from '@bendyline/molen-earth/client';

type SceneLoader = NonNullable<EarthOverride['scene']>['load'];

/**
 * The ref of the sample's own model, which no content pack carries: the view is given an asset
 * provider that answers it (see override-model.ts).
 */
export const HOST_MODEL_REF = 'explorer.kiosk';

/** Where a sample goes. */
export interface OverrideSamplePlace {
  /** `[longitude, latitude]` of the rectangle's center. */
  center: [longitude: number, latitude: number];
  /** `[width, depth]` in meters to clear; grown to the sample's own extent. */
  size?: [width: number, depth: number];
  /** Compass heading the rectangle's -z side faces, radians (default 0, north up). */
  heading?: number;
}

export interface OverrideSample {
  /** Its name in the picker's value and in `?override=`. */
  key: string;
  title: string;
  /** `[width, depth]` in meters of the ground the sample itself needs. */
  extent: [width: number, depth: number];
  /** The override for a place, under an id. */
  build(id: string, place: OverrideSamplePlace): EarthOverride;
}

/** A catalog landmark of the style pack: Seattle's Museum of Pop Culture, about 97 m by 38 m. */
export const LANDMARK_ASSET = 'molen.worldgen.structure.a05_museum_of_pop_culture_seattle';

function sample(
  key: string,
  title: string,
  extent: [number, number],
  contents: (size: [number, number]) => Omit<EarthOverride, 'id' | 'area'>,
): OverrideSample {
  return {
    key,
    title,
    extent,
    build(id, place) {
      const size: [number, number] = [
        Math.min(2000, Math.max(extent[0], place.size?.[0] ?? 0)),
        Math.min(2000, Math.max(extent[1], place.size?.[1] ?? 0)),
      ];
      return {
        id,
        area: {
          center: place.center,
          size,
          ...(place.heading !== undefined ? { heading: place.heading } : {}),
        },
        ...contents(size),
      };
    },
  };
}

/** Trees on a ring a little inside the rectangle's edge. */
function treeLine(
  size: [number, number],
  count: number,
  prefix: string,
): NonNullable<EarthOverride['props']> {
  const [rx, rz] = [size[0] / 2 - 4, size[1] / 2 - 4];
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + 0.35;
    return {
      id: `${prefix}-${i}`,
      kind: 'tree' as const,
      position: [
        Math.round(Math.cos(angle) * rx * 10) / 10,
        Math.round(Math.sin(angle) * rz * 10) / 10,
      ] as [number, number],
      height: 7 + (i % 3) * 2,
      crownDiameter: 5 + (i % 2) * 2,
      leafType: i % 4 === 0 ? ('needleleaved' as const) : ('broadleaved' as const),
    };
  });
}

/**
 * The sample sets, in picker order. `loadScene` loads a diorama by name for the one that brings
 * a scripted scene: it is only called when a viewer comes near.
 */
export function createOverrideSamples(options: {
  loadScene: (name: string, signal: AbortSignal) => ReturnType<SceneLoader>;
}): OverrideSample[] {
  return [
    sample('box', 'Box', [24, 24], () => ({
      buildings: [
        {
          id: 'box',
          rect: { size: [16, 16] },
          height: 12,
          style: 'molen.worldgen.generic.box',
          wall: '#c9c4b8',
          name: 'Box',
        },
      ],
    })),
    sample('warehouse', 'Warehouse', [64, 46], () => ({
      surface: 'paved',
      buildings: [
        {
          id: 'shed',
          rect: { center: [0, -5], size: [48, 28] },
          height: 9,
          use: 'warehouse',
          wall: '#b9b4a8',
          trim: '#5d6b73',
          name: 'Warehouse',
        },
      ],
      props: [
        { id: 'lamp-west', kind: 'street_lamp', position: [-28, 19] },
        { id: 'lamp-east', kind: 'street_lamp', position: [28, 19] },
        { id: 'bench', kind: 'bench', position: [-8, 12.5], heading: Math.PI },
        { id: 'rack', kind: 'bike_rack', position: [8, 12.5] },
        { id: 'boulder', model: 'builtin:rock', position: [-29, -20], scale: 1.6 },
      ],
      vehicles: [
        {
          id: 'truck',
          type: 'molen.entities.vehicle.box_truck',
          position: [14, 17],
          heading: Math.PI / 2,
        },
        {
          id: 'car',
          type: 'molen.entities.vehicle.sedan',
          position: [-18, 17],
          heading: Math.PI / 2,
          color: '#2f5d8a',
        },
      ],
    })),
    sample('school', 'School campus', [140, 110], () => ({
      surface: 'plaza',
      buildings: [
        {
          id: 'main',
          rect: { center: [-15, -31], size: [60, 18] },
          levels: 2,
          use: 'school',
          name: 'Main building',
        },
        { id: 'wing', rect: { center: [22, -20], size: [14, 40] }, levels: 1, use: 'school' },
        {
          id: 'gym',
          rect: { center: [-30, 4], size: [30, 24] },
          height: 9,
          use: 'school',
          name: 'Gymnasium',
        },
        { id: 'cafeteria', rect: { center: [3, 0], size: [22, 16] }, levels: 1, use: 'school' },
        {
          id: 'library',
          rect: { center: [45, 17], size: [18, 18] },
          levels: 1,
          use: 'school',
          name: 'Library',
        },
        {
          id: 'portable',
          rect: { center: [40.5, -36.5], size: [9, 7] },
          levels: 1,
          use: 'school',
        },
      ],
      props: [
        { id: 'tree-nw', kind: 'tree', position: [-60, -48], height: 11, crownDiameter: 7 },
        { id: 'tree-n1', kind: 'tree', position: [-36, -48], height: 9, crownDiameter: 6 },
        { id: 'tree-n2', kind: 'tree', position: [2, -48], height: 10, crownDiameter: 7 },
        { id: 'tree-ne', kind: 'tree', position: [58, -48], height: 12, leafType: 'needleleaved' },
        { id: 'tree-e1', kind: 'tree', position: [62, -6], height: 9, crownDiameter: 6 },
        { id: 'tree-yard', kind: 'tree', position: [20, 20], height: 8, crownDiameter: 6 },
        { id: 'bench-a', kind: 'bench', position: [0, 12], heading: Math.PI },
        { id: 'bench-b', kind: 'bench', position: [6, 12], heading: Math.PI },
        { id: 'bench-c', kind: 'bench', position: [-20, 22], heading: Math.PI },
        { id: 'rack', kind: 'bike_rack', position: [20, 6] },
        { id: 'lamp-a', kind: 'street_lamp', position: [-10, 32] },
        { id: 'lamp-b', kind: 'street_lamp', position: [30, 32] },
      ],
      vehicles: [
        {
          id: 'bus',
          type: 'molen.entities.transit.bus',
          position: [4, 44],
          heading: Math.PI / 2,
        },
        {
          id: 'car',
          type: 'molen.entities.vehicle.sedan',
          position: [44, 44],
          heading: Math.PI / 2,
        },
      ],
      actors: [
        {
          id: 'teacher',
          figure: { preset: 'human.adult' },
          position: [-10, -18],
          heading: Math.PI,
          interactable: true,
        },
        {
          id: 'pupil-a',
          figure: { preset: 'human.child' },
          position: [-6, -16],
          behaviour: { kind: 'wander', radius: 12 },
        },
        {
          id: 'pupil-b',
          figure: { preset: 'human.child', seed: 'b' },
          position: [2, 14],
          behaviour: { kind: 'wander', radius: 10 },
        },
      ],
    })),
    sample('landmark', 'Landmark (catalog model)', [116, 60], () => ({
      surface: 'plaza',
      models: [{ id: 'landmark', asset: LANDMARK_ASSET, position: [0, 0] }],
    })),
    sample('model', 'Custom model', [30, 30], () => ({
      surface: 'paved',
      models: [{ id: 'kiosk', asset: HOST_MODEL_REF, position: [0, 0] }],
      props: [
        { id: 'bench-a', kind: 'bench', position: [-5, 7], heading: Math.PI },
        { id: 'bench-b', kind: 'bench', position: [5, 7], heading: Math.PI },
        { id: 'lamp', kind: 'street_lamp', position: [-9, 9] },
      ],
    })),
    sample('market', 'Market square (scene)', [70, 56], (size) => ({
      surface: 'plaza',
      props: [
        { id: 'lamp-nw', kind: 'street_lamp', position: [-size[0] / 2 + 3, -size[1] / 2 + 3] },
        { id: 'lamp-ne', kind: 'street_lamp', position: [size[0] / 2 - 3, -size[1] / 2 + 3] },
        { id: 'lamp-sw', kind: 'street_lamp', position: [-size[0] / 2 + 3, size[1] / 2 - 3] },
        { id: 'lamp-se', kind: 'street_lamp', position: [size[0] / 2 - 3, size[1] / 2 - 3] },
      ],
      scene: { load: (signal) => options.loadScene('market', signal) },
    })),
    sample('park', 'Pocket park (roads cleared)', [90, 90], (size) => ({
      clear: { roads: true },
      surface: 'grass',
      buildings: [
        {
          id: 'pavilion',
          rect: { size: [10, 10] },
          height: 4,
          use: 'pavilion',
          wall: '#d8cdb4',
          trim: '#5b4a3a',
          name: 'Pavilion',
        },
      ],
      props: [
        ...treeLine(size, 12, 'tree'),
        { id: 'bench-n', kind: 'bench', position: [0, -9], heading: 0 },
        { id: 'bench-s', kind: 'bench', position: [0, 9], heading: Math.PI },
        { id: 'lamp', kind: 'street_lamp', position: [8, 8] },
      ],
      actors: [
        { id: 'walker', figure: { preset: 'human.adult' }, position: [12, 4] },
        { id: 'dog', figure: { preset: 'dog' }, position: [13, 5] },
      ],
    })),
    sample('empty', 'Empty lot', [40, 40], () => ({})),
  ];
}
