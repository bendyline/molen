import { z } from 'zod';

const finite = z.number().finite();
const fraction = finite.min(0).max(1);
const vector = z.array(finite).length(3) as unknown as z.ZodType<[number, number, number]>;

/** Independent atmospheric, cloud and precipitation parameters, in SI units. */
export type WeatherData = {
  atmosphere?: {
    temperatureK?: number;
    pressurePa?: number;
    relativeHumidity?: number;
    windVelocity?: [number, number, number];
    referenceAltitude?: number;
    gasConstant?: number;
  };
  visibility?: number;
  clouds?: {
    coverage?: number;
    density?: number;
    baseAltitude?: number;
    thickness?: number;
    scale?: number;
  };
  precipitation?: { kind?: 'none' | 'rain' | 'snow'; intensity?: number };
  seed?: number;
};

/** Data-only weather shared by headless simulation, scripts and rendering. */
export const weatherSchema: z.ZodType<WeatherData> = z.strictObject({
  atmosphere: z
    .strictObject({
      temperatureK: finite
        .positive()
        .optional()
        .describe('Temperature at referenceAltitude in kelvin; default 288.15 (15 °C).'),
      pressurePa: finite
        .nonnegative()
        .optional()
        .describe(
          'Absolute barometric pressure at referenceAltitude in pascals; default 101325. Zero permits vacuum.',
        ),
      relativeHumidity: fraction
        .optional()
        .describe(
          'Relative humidity 0–1, default 0.5. Stored independently; does not select precipitation.',
        ),
      windVelocity: vector
        .optional()
        .describe(
          'Air velocity [x,y,z] in world meters/second; default [0,0,0]. This is a velocity, not a meteorological FROM bearing.',
        ),
      referenceAltitude: finite
        .optional()
        .describe('World Y in meters where temperature and pressure apply; default 0.'),
      gasConstant: finite
        .positive()
        .optional()
        .describe(
          'Specific gas constant in J/(kg·K); default 287.05 for dry Earth air. Supports other atmospheres.',
        ),
    })
    .optional()
    .describe('Physical atmospheric state; independent of the visual weather profile.'),
  visibility: finite
    .positive()
    .optional()
    .describe(
      'Visual distance in meters; default 50000. Independent of clouds and precipitation. Renderer also respects a nearer authored fog limit.',
    ),
  clouds: z
    .strictObject({
      coverage: fraction
        .optional()
        .describe('Sky coverage 0–1, default 0; controls breaks in the procedural layer.'),
      density: fraction
        .optional()
        .describe('Cloud optical density 0–1, default 0.65; independent of coverage.'),
      baseAltitude: finite
        .optional()
        .describe('Cloud base at absolute world Y in meters, default 1800.'),
      thickness: finite
        .positive()
        .optional()
        .describe('Vertical layer thickness in meters, default 600.'),
      scale: finite
        .positive()
        .optional()
        .describe('Horizontal cloud-pattern repeat size in meters, default 16000.'),
    })
    .optional()
    .describe('World-anchored, wind-advected cloud layer. Does not imply precipitation.'),
  precipitation: z
    .strictObject({
      kind: z
        .enum(['none', 'rain', 'snow'])
        .optional()
        .describe(
          'Explicit precipitation phase, default none. Temperature never silently overrides it.',
        ),
      intensity: fraction
        .optional()
        .describe('Visual precipitation intensity 0–1, default 0. Not a calibrated rainfall rate.'),
    })
    .optional()
    .describe('Precipitation independent of cloud coverage and visibility.'),
  seed: finite
    .int()
    .min(0)
    .max(4294967295)
    .optional()
    .describe('Stable visual pattern seed, default 1. Does not consume simulation RNG.'),
});

export type ResolvedWeather = {
  atmosphere: Required<NonNullable<WeatherData['atmosphere']>>;
  visibility: number;
  clouds: Required<NonNullable<WeatherData['clouds']>>;
  precipitation: Required<NonNullable<WeatherData['precipitation']>>;
  seed: number;
};

/** Expand validated weather data without changing or retaining its mutable nested values. */
export function resolveWeather(data: WeatherData = {}): ResolvedWeather {
  return {
    atmosphere: {
      temperatureK: 288.15,
      pressurePa: 101325,
      relativeHumidity: 0.5,
      referenceAltitude: 0,
      gasConstant: 287.05,
      ...data.atmosphere,
      windVelocity: [...(data.atmosphere?.windVelocity ?? [0, 0, 0])],
    },
    visibility: data.visibility ?? 50000,
    clouds: {
      coverage: 0,
      density: 0.65,
      baseAltitude: 1800,
      thickness: 600,
      scale: 16000,
      ...data.clouds,
    },
    precipitation: { kind: 'none', intensity: 0, ...data.precipitation },
    seed: data.seed ?? 1,
  };
}

export type WeatherProfile = 'sunny' | 'partly-cloudy' | 'overcast' | 'rain' | 'snow' | 'fog';

/** Presets are starting points, not a mutually exclusive weather model. Returns fresh data. */
export function weatherProfile(profile: WeatherProfile): WeatherData {
  const profiles: Record<WeatherProfile, WeatherData> = {
    sunny: {
      atmosphere: {
        temperatureK: 295.15,
        pressurePa: 102000,
        relativeHumidity: 0.4,
        windVelocity: [2, 0, 1],
      },
    },
    'partly-cloudy': {
      atmosphere: {
        temperatureK: 291.15,
        pressurePa: 101500,
        relativeHumidity: 0.55,
        windVelocity: [5, 0, 2],
      },
      clouds: { coverage: 0.42, density: 0.65 },
    },
    overcast: {
      atmosphere: {
        temperatureK: 286.15,
        pressurePa: 100900,
        relativeHumidity: 0.8,
        windVelocity: [6, 0, 2],
      },
      clouds: { coverage: 1, density: 0.85, baseAltitude: 1600, thickness: 900 },
      visibility: 12000,
    },
    rain: {
      atmosphere: {
        temperatureK: 282.15,
        pressurePa: 100200,
        relativeHumidity: 0.95,
        windVelocity: [7, 0, 3],
      },
      clouds: { coverage: 0.98, density: 0.95, baseAltitude: 1600, thickness: 1200 },
      precipitation: { kind: 'rain', intensity: 0.7 },
      visibility: 4500,
    },
    snow: {
      atmosphere: {
        temperatureK: 270.15,
        pressurePa: 100700,
        relativeHumidity: 0.9,
        windVelocity: [2, 0, 1],
      },
      clouds: { coverage: 0.94, density: 0.8, baseAltitude: 1600, thickness: 1000 },
      precipitation: { kind: 'snow', intensity: 0.65 },
      visibility: 2500,
    },
    fog: {
      atmosphere: {
        temperatureK: 280.15,
        pressurePa: 101400,
        relativeHumidity: 1,
        windVelocity: [0.3, 0, 0.2],
      },
      clouds: { coverage: 0.3 },
      visibility: 450,
    },
  };
  return profiles[profile];
}
