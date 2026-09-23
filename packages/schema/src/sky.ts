import { z } from 'zod';

const number = z.number().finite();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Fixed-length arrays emit minItems/maxItems for strict JSON Schema consumers (unlike tuples).
const vector = z.array(number).length(3) as unknown as z.ZodType<[number, number, number]>;
const direction = vector.describe(
  'Nonzero direction toward the body; +X east, +Y up, -Z north. Normalized by the renderer.',
);
const body = z.strictObject({
  direction,
  angularDiameterDeg: number
    .positive()
    .max(90)
    .optional()
    .describe('Apparent diameter in degrees; default 0.53.'),
});

const common = {
  palette: z
    .strictObject({
      dayZenith: color.optional().describe('Daytime overhead color, default #2374c5.'),
      dayHorizon: color
        .optional()
        .describe('Daytime horizon and ambient light color, default #b8d7eb.'),
      twilight: color.optional().describe('Twilight glow and low Sun color, default #f78753.'),
      nightZenith: color.optional().describe('Nighttime overhead color, default #020510.'),
      nightHorizon: color
        .optional()
        .describe('Nighttime horizon and ambient light color, default #121c32.'),
      ground: color
        .optional()
        .describe('Below-horizon dome and ground ambient color, default #18212c.'),
      sun: color.optional().describe('Sun disk and high-altitude sunlight color, default #fff4dc.'),
      moon: color.optional().describe('Moon surface and moonlight color, default #dae5f5.'),
    })
    .optional()
    .describe(
      'Art-directed clear-sky colors. These control the sky dome, not distance fog or weather.',
    ),
  lighting: z
    .strictObject({
      sunIntensity: number
        .nonnegative()
        .optional()
        .describe('Peak directional sunlight, default 3.'),
      moonIntensity: number
        .nonnegative()
        .optional()
        .describe('Full-moon directional light, default 0.12; scaled by phase and altitude.'),
      dayAmbient: number
        .nonnegative()
        .optional()
        .describe('Daytime hemisphere intensity, default 0.6.'),
      nightAmbient: number
        .nonnegative()
        .optional()
        .describe('Nighttime hemisphere intensity, default 0.025.'),
      castShadow: z
        .boolean()
        .optional()
        .describe('Sun shadows; also requires environment.shadows. Default true.'),
    })
    .optional()
    .describe(
      'Sky-managed lights replace environment.ambient and environment.sun when sky is enabled.',
    ),
  stars: z
    .strictObject({
      enabled: z.boolean().optional().describe('Show the star catalog, default true.'),
      magnitudeLimit: number
        .min(-2)
        .max(6.5)
        .optional()
        .describe('Faintest catalog magnitude rendered, default 6.'),
      intensity: number
        .nonnegative()
        .optional()
        .describe('Star brightness multiplier, default 1; fades with daylight and moonlight.'),
      size: number
        .positive()
        .max(10)
        .optional()
        .describe('Visual angular-size multiplier, default 1.'),
    })
    .optional()
    .describe('Star catalog visibility, brightness and size.'),
  sun: z
    .strictObject({
      visible: z
        .boolean()
        .optional()
        .describe('Show the Sun disk; lighting is independent. Default true.'),
      size: number
        .positive()
        .max(100)
        .optional()
        .describe('Visual diameter multiplier, default 1. Does not affect astronomy or lighting.'),
    })
    .optional()
    .describe('Sun disk appearance.'),
  moon: z
    .strictObject({
      visible: z
        .boolean()
        .optional()
        .describe('Show the Moon disk; lighting is independent. Default true.'),
      size: number
        .positive()
        .max(100)
        .optional()
        .describe('Visual diameter multiplier, default 1.'),
      earthshine: number.min(0).max(1).optional().describe('Dark-side visibility, default 0.025.'),
    })
    .optional()
    .describe('Moon disk appearance.'),
};

/** Data-only configuration for an Earth ephemeris or an authored fantasy sky. */
export const skySchema: z.ZodType<SkyData> = z.discriminatedUnion('mode', [
  z.strictObject({
    ...common,
    mode: z.literal('earth').describe('Compute positions from an Earth observer and UTC clock.'),
    observer: z
      .strictObject({
        latitude: number.min(-90).max(90).describe('Geodetic degrees north.'),
        longitude: number.min(-180).max(180).describe('Degrees east; west is negative.'),
        elevation: number
          .min(-500)
          .max(100000)
          .optional()
          .describe('Meters above sea level, default 0; used for lunar parallax.'),
        northOffsetDeg: number
          .optional()
          .describe('Rotate geographic north clockwise toward +X, default 0 (-Z north).'),
      })
      .describe('Geographic observing position and world orientation.'),
    time: z
      .strictObject({
        epochMs: number
          .min(-2208988800000)
          .max(4133980799999)
          .describe(
            'UTC Unix milliseconds at simulation second zero (1900–2100). Explicit: never reads the host clock.',
          ),
        scale: number
          .optional()
          .describe(
            'Sky seconds per simulation second, default 1. Zero freezes, negative rewinds.',
          ),
      })
      .describe('UTC epoch and rate relative to simulation time.'),
  }),
  z.strictObject({
    ...common,
    mode: z.literal('custom').describe('Use authored body positions without an Earth clock.'),
    sunBody: body.describe('Authored sun position and apparent diameter.'),
    moonBody: body
      .optional()
      .describe('Moon lit from sunBody.direction; omit for a moonless world.'),
    starRotationDeg: vector
      .optional()
      .describe('XYZ Euler rotation in degrees of the catalog sphere; default [0,0,0].'),
  }),
]);

export interface SkyPalette {
  dayZenith?: string;
  dayHorizon?: string;
  twilight?: string;
  nightZenith?: string;
  nightHorizon?: string;
  ground?: string;
  sun?: string;
  moon?: string;
}

export interface SkyAppearance {
  palette?: SkyPalette;
  lighting?: {
    sunIntensity?: number;
    moonIntensity?: number;
    dayAmbient?: number;
    nightAmbient?: number;
    castShadow?: boolean;
  };
  stars?: { enabled?: boolean; magnitudeLimit?: number; intensity?: number; size?: number };
  sun?: { visible?: boolean; size?: number };
  moon?: { visible?: boolean; size?: number; earthshine?: number };
}

export interface EarthObserver {
  latitude: number;
  longitude: number;
  elevation?: number;
  northOffsetDeg?: number;
}

export interface SkyTime {
  /** UTC Unix milliseconds at simulation second zero. */
  epochMs: number;
  /** Sky seconds per simulation second, default 1. */
  scale?: number;
}

export interface EarthSkyData extends SkyAppearance {
  mode: 'earth';
  observer: EarthObserver;
  time: SkyTime;
}

export interface SkyBodyData {
  direction: [number, number, number];
  angularDiameterDeg?: number;
}

export interface CustomSkyData extends SkyAppearance {
  mode: 'custom';
  sunBody: SkyBodyData;
  moonBody?: SkyBodyData;
  starRotationDeg?: [number, number, number];
}

export type SkyData = EarthSkyData | CustomSkyData;
