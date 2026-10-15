import { z } from 'zod';
import type { JsonObject } from './json';
import type { VehicleVisualSpec } from './vehicles';

/** One travelling swell. Direction is radians about +Y, zero towards +Z. */
export interface WaterWave extends JsonObject {
  amplitude: number;
  wavelength: number;
  direction: number;
  speed: number;
}
/** Authored water conditions, in metric world coordinates and simulation seconds. */
export interface WaterSettings extends JsonObject {
  waves?: WaterWave[];
  /** Current velocity [east, south] in m/s. */
  current?: [number, number];
}
/** Hull tuning; the model origin is the waterline. */
export interface BoatSpec extends JsonObject {
  label: string;
  length: number;
  width: number;
  height: number;
  draft: number;
  mass: number;
  thrust: number;
  maxSpeed: number;
  reverseSpeed: number;
  /** Maximum turn rate at cruise, rad/s. */
  turnRate: number;
  /** Time to build or lose yaw rate, seconds. */
  turnResponse: number;
  /** Lateral resistance per second. */
  lateralDrag: number;
  /** Buoyancy spring frequency in Hz. */
  buoyancyFrequency: number;
  driverEye: [number, number, number];
}
export interface BoatData extends JsonObject {
  kind: string;
  spec: BoatSpec;
  visual: VehicleVisualSpec;
  color?: string;
}
export interface BoatInputData extends JsonObject {
  throttle: number;
  steering: number;
  /** Drops anchor only at low speed; release before applying thrust. */
  anchor: boolean;
}
export interface BoatStateData extends JsonObject {
  speed: number;
  lateralSpeed: number;
  /** World velocity [east, south], including current. */
  velocity: [number, number];
  yaw: number;
  yawRate: number;
  steer: number;
  pitch: number;
  roll: number;
  vy: number;
  anchored: boolean;
  grounded: boolean;
  waitingForWater: boolean;
}
const num = z.number().finite();
export const waterSettingsSchema: z.ZodType<WaterSettings> = z.strictObject({
  waves: z
    .array(
      z.strictObject({
        amplitude: num.min(0).max(10).describe('Swell amplitude in meters.'),
        wavelength: num.min(1).describe('Wavelength in meters.'),
        direction: num.describe('Travel direction in radians; zero is +Z.'),
        speed: num.min(0).describe('Wave propagation speed in m/s.'),
      }),
    )
    .max(8)
    .optional()
    .describe('Up to eight travelling swells added to the water surface.'),
  current: z.tuple([num, num]).optional().describe('Current [east, south] in m/s.'),
});
export const boatSpecSchema: z.ZodType<BoatSpec> = z.strictObject({
  label: z.string().min(1).describe('Human-readable vessel name.'),
  length: num.positive().describe('Hull length along Z in meters.'),
  width: num.positive().describe('Hull width along X in meters.'),
  height: num.positive().describe('Vessel height in meters.'),
  draft: num.positive().describe('Minimum water depth in meters.'),
  mass: num.positive().describe('Mass in kg.'),
  thrust: num.positive().describe('Forward propeller thrust in newtons.'),
  maxSpeed: num.positive().describe('Maximum forward speed through water in m/s.'),
  reverseSpeed: num.positive().describe('Maximum reverse speed through water in m/s.'),
  turnRate: num.positive().describe('Maximum cruise yaw rate in radians per second.'),
  turnResponse: num.positive().describe('Time to build or lose yaw rate in seconds.'),
  lateralDrag: num.positive().describe('Lateral water resistance per second.'),
  buoyancyFrequency: num.positive().max(4).describe('Buoyancy spring frequency in hertz.'),
  driverEye: z.tuple([num, num, num]).describe('Helm eye position in local meters.'),
});
export const boatInputSchema: z.ZodType<BoatInputData> = z.strictObject({
  throttle: num.min(-1).max(1).describe('Signed propeller power; negative reverses thrust.'),
  steering: num.min(-1).max(1).describe('Signed helm input; positive turns right.'),
  anchor: z.boolean().describe('Request the low-speed anchor; release to apply thrust.'),
});
export const boatStateSchema: z.ZodType<BoatStateData> = z.strictObject({
  speed: num.describe('Forward speed through water in m/s.'),
  lateralSpeed: num.describe('Lateral speed through water in m/s.'),
  velocity: z.tuple([num, num]).describe('World velocity [east, south] including current in m/s.'),
  yaw: num.describe('Heading about +Y in radians.'),
  yawRate: num.describe('Yaw rate in radians per second.'),
  steer: num.describe('Smoothed helm input in [-1, 1].'),
  pitch: num.describe('Hull pitch in radians.'),
  roll: num.describe('Hull roll in radians.'),
  vy: num.describe('Vertical buoyancy velocity in m/s.'),
  anchored: z.boolean().describe('Whether the low-speed anchor is engaged.'),
  grounded: z.boolean().describe('Whether the hull is stopped by insufficient depth.'),
  waitingForWater: z.boolean().describe('Whether motion is paused for unavailable water data.'),
});
