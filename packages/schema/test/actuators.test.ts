import { expect, it } from 'vitest';
import {
  actuatorInputsSchema,
  actuatorPositionsSchema,
  actuatorSpecsSchema,
} from '../src/actuators';

it('validates fractional targets and rejects invalid cycles and nonfinite positions', () => {
  expect(
    actuatorSpecsSchema.safeParse({
      door: { seconds: 3 },
      light: { seconds: 0 },
      wipers: { seconds: 1.4, mode: 'cycle' },
    }).success,
  ).toBe(true);
  expect(actuatorSpecsSchema.safeParse({ wipers: { seconds: 0, mode: 'cycle' } }).success).toBe(
    false,
  );
  expect(actuatorSpecsSchema.safeParse({ door: { seconds: -1 } }).success).toBe(false);
  expect(actuatorInputsSchema.safeParse({ door: 0.3, light: true }).success).toBe(true);
  for (const value of [-0.1, 1.1, NaN, Infinity])
    expect(actuatorPositionsSchema.safeParse({ door: value }).success).toBe(false);
});
