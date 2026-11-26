// Time-of-day presets for the `environment` component. A preset fills sky light, sun, ambient
// light, background and exposure with values that keep a frame readable; any field the scene
// sets itself wins. Values were tuned on rendered films (a black "evening" was the most common
// failure when models aimed a sun by hand).

export type EnvironmentPresetName = 'morning' | 'noon' | 'evening' | 'night' | 'overcast';

export interface EnvironmentPresetValues {
  ambient: { sky: string; ground: string; intensity: number };
  sun: { direction: [number, number, number]; color: string; intensity: number };
  background: string;
  exposure: number;
}

export const ENVIRONMENT_PRESET_NAMES: readonly EnvironmentPresetName[] = [
  'morning',
  'noon',
  'evening',
  'night',
  'overcast',
];

export const ENVIRONMENT_PRESETS: Readonly<Record<EnvironmentPresetName, EnvironmentPresetValues>> =
  {
    morning: {
      ambient: { sky: '#dfe8f5', ground: '#6b6355', intensity: 1.25 },
      sun: { direction: [10, 6, 4], color: '#ffe2b8', intensity: 1.7 },
      background: '#bcd6ee',
      exposure: 1,
    },
    noon: {
      ambient: { sky: '#ffffff', ground: '#555560', intensity: 1.15 },
      sun: { direction: [2, 12, 3], color: '#ffffff', intensity: 1.8 },
      background: '#9cc9e8',
      exposure: 1,
    },
    evening: {
      ambient: { sky: '#f3c9a8', ground: '#5a4c5c', intensity: 1.15 },
      sun: { direction: [-10, 4, 3], color: '#ffb37a', intensity: 1.6 },
      background: '#e8a47c',
      exposure: 1.1,
    },
    night: {
      ambient: { sky: '#6a7bb0', ground: '#2a3040', intensity: 1 },
      sun: { direction: [3, 8, -4], color: '#9fb4ff', intensity: 0.6 },
      background: '#1b2440',
      exposure: 1.35,
    },
    overcast: {
      ambient: { sky: '#e0e4e8', ground: '#80848a', intensity: 1.6 },
      sun: { direction: [1, 10, 2], color: '#e8eef2', intensity: 0.7 },
      background: '#c3cad1',
      exposure: 1,
    },
  };

interface PresetCarrier {
  preset?: string;
  ambient?: { sky?: string; ground?: string; intensity?: number };
  sun?: {
    direction?: [number, number, number] | number[];
    color?: string;
    intensity?: number;
    castShadow?: boolean;
  };
  background?: string;
  exposure?: number;
}

/**
 * Fold `environment.preset` into explicit fields: the preset is the base, fields the scene set
 * win (ambient and sun merge field by field). Returns the input unchanged without a preset; an
 * unknown preset is ignored (validation reports it).
 */
export function resolveEnvironmentPreset<T extends PresetCarrier>(env: T): T {
  const name = env.preset;
  if (name === undefined) return env;
  const preset = ENVIRONMENT_PRESETS[name as EnvironmentPresetName];
  const { preset: _preset, ...rest } = env;
  if (preset === undefined) return rest as T;
  return {
    ...rest,
    ambient: { ...preset.ambient, ...(env.ambient ?? {}) },
    sun: { ...preset.sun, ...(env.sun ?? {}) },
    background: env.background ?? preset.background,
    exposure: env.exposure ?? preset.exposure,
  } as T;
}
