import { z } from 'zod';
import type { JsonObject } from './json';

/** Model-owned mechanisms. Positions and cycle phases are normalized to 0..1. */
export interface ActuatorSpec extends JsonObject {
  /** Seconds for full travel, or one complete out-and-back cycle. Zero switches immediately. */
  seconds: number;
  initial?: number;
  /** Cycles finish at the parked phase when switched off. Latches cannot be reversed. */
  mode?: 'position' | 'cycle' | 'latch';
}
export type ActuatorSpecs = Record<string, ActuatorSpec>;
export type ActuatorInputs = Record<string, number | boolean>;
export type ActuatorPositions = Record<string, number>;

const name = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9]*$/)
  .max(64);
const unit = z.number().finite().min(0).max(1);
export const actuatorSpecsSchema: z.ZodType<ActuatorSpecs> = z.record(
  name,
  z
    .strictObject({
      seconds: z
        .number()
        .finite()
        .nonnegative()
        .describe('Seconds for full travel or a full cycle.'),
      initial: unit.optional().describe('Rest position or phase; defaults to zero.'),
      mode: z
        .enum(['position', 'cycle', 'latch'])
        .optional()
        .describe('Position by default. Cycles park when off; latches cannot reverse.'),
    })
    .refine(
      (value) => value.mode !== 'cycle' || value.seconds > 0,
      'Cycles require positive seconds.',
    ),
);
export const actuatorInputsSchema: z.ZodType<ActuatorInputs> = z.record(
  name,
  z.union([unit, z.boolean()]),
);
export const actuatorPositionsSchema: z.ZodType<ActuatorPositions> = z.record(name, unit);
