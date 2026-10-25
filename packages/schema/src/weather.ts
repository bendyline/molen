import { z } from 'zod';

const finite = z.number().finite();
const fraction = finite.min(0).max(1);
const vector = z.array(finite).length(3) as unknown as z.ZodType<[number, number, number]>;

/** Independent atmospheric, cloud and precipitation parameters, in SI units. */
export type WeatherData = {
  atmosphere?: {
    model?: 'standard' | 'isothermal';
    moistAir?: boolean;
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
  wind?: {
    referenceHeight?: number;
    shear?: number;
    turbulence?: number;
    gusts?: number;
    terrain?: number;
  };
  seed?: number;
};

/** Data-only weather shared by headless simulation, scripts and rendering. */
export const weatherSchema: z.ZodType<WeatherData> = z.strictObject({
  atmosphere: z
    .strictObject({
      model: z
        .enum(['standard', 'isothermal'])
        .optional()
        .describe(
          'Standard layered Earth lapse rates (default), or a uniform-temperature isothermal atmosphere.',
        ),
      moistAir: z
        .boolean()
        .optional()
        .describe(
          'Apply water-vapor ideal-gas density correction. Default false (dry reference air).',
        ),
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
  wind: z
    .strictObject({
      referenceHeight: finite
        .positive()
        .optional()
        .describe(
          'Height above ground in meters where atmosphere.windVelocity is measured; default 10.',
        ),
      shear: finite
        .min(0)
        .max(1)
        .optional()
        .describe(
          'Power-law exponent of mean wind speed with height above ground, up to 600 m; default 0 (uniform). About 0.14 over open country, 0.3 over cities.',
        ),
      turbulence: fraction
        .optional()
        .describe(
          'Turbulence intensity 0–1, default 0: about 0.15 light chop, 0.4 moderate, 0.8 severe. Grows with wind speed and fades above the 1 km boundary layer.',
        ),
      gusts: fraction
        .optional()
        .describe(
          'Gust factor 0–1, default 0: along-wind speed swings as a fraction of the mean wind, advected with it.',
        ),
      terrain: fraction
        .optional()
        .describe(
          'Strength 0–1 of wind deflected by terrain slopes: ridge lift upwind, sink in the lee. Default 0.',
        ),
    })
    .optional()
    .describe(
      'Spatial and temporal structure of the wind around the mean atmosphere.windVelocity. Deterministic from seed and simulation time; consumes no simulation RNG.',
    ),
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
  wind: Required<NonNullable<WeatherData['wind']>>;
  seed: number;
};

/** Expand validated weather data without changing or retaining its mutable nested values. */
export function resolveWeather(data: WeatherData = {}): ResolvedWeather {
  return {
    atmosphere: {
      temperatureK: 288.15,
      model: 'standard',
      moistAir: false,
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
    wind: { referenceHeight: 10, shear: 0, turbulence: 0, gusts: 0, terrain: 0, ...data.wind },
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
      wind: { shear: 0.14, turbulence: 0.2, gusts: 0.25, terrain: 0.6 },
    },
    'partly-cloudy': {
      atmosphere: {
        temperatureK: 291.15,
        pressurePa: 101500,
        relativeHumidity: 0.55,
        windVelocity: [5, 0, 2],
      },
      wind: { shear: 0.16, turbulence: 0.2, gusts: 0.3, terrain: 0.7 },
      clouds: { coverage: 0.42, density: 0.65 },
    },
    overcast: {
      atmosphere: {
        temperatureK: 286.15,
        pressurePa: 100900,
        relativeHumidity: 0.8,
        windVelocity: [6, 0, 2],
      },
      wind: { shear: 0.2, turbulence: 0.15, gusts: 0.3, terrain: 0.7 },
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
      wind: { shear: 0.22, turbulence: 0.35, gusts: 0.45, terrain: 0.8 },
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
      wind: { shear: 0.2, turbulence: 0.2, gusts: 0.35, terrain: 0.7 },
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
      wind: { shear: 0.3, turbulence: 0.03, gusts: 0.1, terrain: 0.3 },
      clouds: { coverage: 0.3 },
      visibility: 450,
    },
  };
  return profiles[profile];
}
