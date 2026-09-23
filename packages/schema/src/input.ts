import { z } from 'zod';

/** Browser controller selector. Omit to accept any detected device; combine to disambiguate twins. */
export interface InputDevice {
  id?: string;
  index?: number;
}

/** Any raw axis index, including non-standard flight sticks, pedals and throttles. */
export interface GamepadAxisBinding {
  action: string;
  axis: number;
  device?: InputDevice;
  /** signed: -1..1; positive/negative: one half of a stick; unit: full travel mapped to 0..1. */
  mode?: 'signed' | 'positive' | 'negative' | 'unit';
  invert?: boolean;
  /** Rescaled dead zone in [0, 1). Defaults to 0.12, or 0 for unit axes. */
  deadZone?: number;
  /** Response exponent > 0 (default 1). */
  curve?: number;
  /** Raw endpoints and center (defaults -1, 0, 1); min < center < max. */
  min?: number;
  center?: number;
  max?: number;
}

export interface GamepadButtonBinding {
  action: string;
  button: number;
  device?: InputDevice;
  /** Press threshold for analog buttons (default 0.5). */
  threshold?: number;
}

/** Serializable, complete set of physical bindings for one use case. */
export interface InputProfile {
  /** KeyboardEvent.code or Mouse<button> -> named action. */
  bindings: Record<string, string>;
  axes?: GamepadAxisBinding[];
  buttons?: GamepadButtonBinding[];
}

const device = z.strictObject({
  id: z.string().min(1).describe('Exact browser Gamepad.id; omit to match any ID.').optional(),
  index: z
    .int()
    .nonnegative()
    .describe('Browser Gamepad.index; may change on reconnect.')
    .optional(),
});

/** Structural profile validator; calibration ordering is checked by inputProfileIssues. */
export const inputProfileShape: {
  bindings: z.ZodType<Record<string, string>>;
  axes: z.ZodType<GamepadAxisBinding[] | undefined>;
  buttons: z.ZodType<GamepadButtonBinding[] | undefined>;
} = {
  bindings: z
    .record(z.string().min(1), z.string().min(1))
    .describe('KeyboardEvent.code or Mouse<button> to action name.'),
  axes: z
    .array(
      z.strictObject({
        action: z.string().min(1).describe('Named action receiving the numeric axis value.'),
        axis: z
          .int()
          .nonnegative()
          .describe('Raw zero-based axis index; no standard mapping required.'),
        device: device.optional(),
        mode: z
          .enum(['signed', 'positive', 'negative', 'unit'])
          .describe(
            'signed -1..1 (default), positive/negative half axis 0..1, or unit full travel 0..1.',
          )
          .optional(),
        invert: z
          .boolean()
          .describe('Reverse calibrated travel before applying the mode.')
          .optional(),
        deadZone: z
          .number()
          .min(0)
          .lt(1)
          .describe('Rescaled dead zone; default 0.12 (unit: 0).')
          .optional(),
        curve: z.number().positive().describe('Response exponent; default 1 (linear).').optional(),
        min: z.number().describe('Raw minimum; default -1. Must be below center.').optional(),
        center: z
          .number()
          .describe('Raw center; default 0. Must lie between min and max.')
          .optional(),
        max: z.number().describe('Raw maximum; default 1. Must be above center.').optional(),
      }),
    )
    .describe('Mappings for arbitrary browser-exposed joystick axes.')
    .optional(),
  buttons: z
    .array(
      z.strictObject({
        action: z.string().min(1).describe('Named action receiving button presses and releases.'),
        button: z.int().nonnegative().describe('Raw zero-based button index.'),
        device: device.optional(),
        threshold: z
          .number()
          .positive()
          .max(1)
          .describe('Analog button press threshold; default 0.5.')
          .optional(),
      }),
    )
    .describe('Mappings for arbitrary browser-exposed controller buttons.')
    .optional(),
};

export const inputProfileSchema: z.ZodType<InputProfile> = z.strictObject(inputProfileShape);

/** Semantic constraints shared by scene validation and runtime remapping. */
export function inputProfileIssues(profile: InputProfile): { axis: number; message: string }[] {
  return (profile.axes ?? []).flatMap((binding, axis) =>
    (binding.min ?? -1) < (binding.center ?? 0) && (binding.center ?? 0) < (binding.max ?? 1)
      ? []
      : [{ axis, message: 'Axis calibration requires min < center < max.' }],
  );
}
