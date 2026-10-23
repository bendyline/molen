import { z } from 'zod';
import type { JsonObject } from './json';
import {
  checkModelSignalNames,
  type ModelSignalExpression,
  modelSignalDerivedSchema,
} from './model-signal-expressions';

/**
 * Numeric simulation state mapped to an existing model's local transform channels. A binding is
 * calibrated either linearly (`scale`, `offset`) or by a keyframed curve (`keys`), which can hold a
 * part still over part of the signal's range: a landing-gear door opens, waits while the leg
 * swings, then closes, all driven by one gear position.
 */
export interface ModelSignalBinding extends JsonObject {
  node: string;
  source: string;
  property: 'rotation' | 'position' | 'visible';
  /** Required for transforms; omit for visibility (calibrated value > 0 means visible). */
  axis?: 'x' | 'y' | 'z';
  /** Linear calibration: the displacement is `signal * scale + offset`. Omit with `keys`. */
  scale?: number;
  offset?: number;
  /**
   * Keyframed calibration: `[signal, displacement]` pairs with strictly ascending signals. The
   * displacement holds the first or last key's value outside their range.
   */
  keys?: [number, number][];
  /** Between keys: `linear` (default), or `smooth` to ease out of and into every key. */
  ease?: 'linear' | 'smooth';
  min?: number;
  max?: number;
  /** Positive output period; rotation only. Filtering follows the shortest arc. */
  period?: number;
  /** First-order response time constant in simulation seconds; zero/default is immediate. */
  responseSeconds?: number;
  /** Missing/nonfinite readings hold the last pose (default) or restore the authored pose. */
  missing?: 'hold' | 'rest' | 'hide';
}

export interface ModelSignalSource extends JsonObject {
  component: string;
  /** Explicit segments; component and property names may contain dots. */
  path: (string | number)[];
}

export interface ModelSignalSpec extends JsonObject {
  /** Same-entity component reads. Scripts can publish custom components here. */
  sources?: Record<string, ModelSignalSource>;
  derived?: Record<string, ModelSignalExpression>;
  bindings: ModelSignalBinding[];
}

export const modelSignalSourcesSchema: z.ZodType<Record<string, ModelSignalSource>> = z
  .record(
    z.string().min(1),
    z.strictObject({
      component: z.string().min(1).describe('Component on this same entity.'),
      path: z
        .array(z.union([z.string().min(1), z.number().int().nonnegative()]))
        .min(1)
        .describe('Explicit property names or array indices leading to a number or boolean.'),
    }),
  )
  .describe('Named signals read from same-entity component fields.');

export const modelSignalBindingsSchema: z.ZodType<ModelSignalBinding[]> = z
  .array(
    z
      .strictObject({
        node: z.string().min(1).describe('Exact loaded GLB node name.'),
        source: z.string().min(1).describe('Named simulation signal.'),
        property: z
          .enum(['rotation', 'position', 'visible'])
          .describe('Local transform or visibility channel.'),
        axis: z
          .enum(['x', 'y', 'z'])
          .optional()
          .describe('Required for transforms; omit for visible.'),
        scale: z
          .number()
          .finite()
          .optional()
          .describe('Multiply the signal by this value. Supply this or keys.'),
        offset: z.number().finite().optional().describe('Offset after scaling; default zero.'),
        keys: z
          .array(z.tuple([z.number().finite(), z.number().finite()]))
          .min(2)
          .optional()
          .describe(
            'Keyframed curve of [signal, displacement] pairs, signals strictly ascending; holds the end values outside them. Supply this or scale.',
          ),
        ease: z
          .enum(['linear', 'smooth'])
          .optional()
          .describe(
            'Interpolation between keys: linear (default), or smooth to ease out of and into every key.',
          ),
        min: z.number().finite().optional().describe('Minimum displacement from authored pose.'),
        max: z.number().finite().optional().describe('Maximum displacement from authored pose.'),
        period: z
          .number()
          .finite()
          .positive()
          .optional()
          .describe(
            'Rotation output wraps to [0, period); smoothing follows the shortest arc. Cannot combine with min/max.',
          ),
        responseSeconds: z
          .number()
          .finite()
          .nonnegative()
          .optional()
          .describe(
            'First-order response time constant in simulation seconds; default zero. Requires a timestamp from the host.',
          ),
        missing: z
          .enum(['hold', 'rest', 'hide'])
          .optional()
          .describe(
            'Missing reading: hold last pose (default), restore authored pose, or hide a visible channel.',
          ),
      })
      .superRefine((value, ctx) => {
        if (value.missing === 'hide' && value.property !== 'visible')
          ctx.addIssue({
            code: 'custom',
            path: ['missing'],
            message: 'hide requires a visible channel',
          });
        if ((value.property === 'visible') !== (value.axis === undefined))
          ctx.addIssue({
            code: 'custom',
            path: ['axis'],
            message: 'Transform channels require an axis; visible must omit it',
          });
        if (
          value.period !== undefined &&
          (value.property !== 'rotation' || value.min !== undefined || value.max !== undefined)
        )
          ctx.addIssue({
            code: 'custom',
            path: ['period'],
            message: 'period requires an unlimited rotation channel',
          });
        if (value.property === 'visible' && value.responseSeconds !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['responseSeconds'],
            message: 'Visibility changes immediately; smooth a transform instead',
          });
        if (value.min !== undefined && value.max !== undefined && value.min > value.max)
          ctx.addIssue({ code: 'custom', path: ['max'], message: 'max must be at least min' });
        if ((value.scale === undefined) === (value.keys === undefined))
          ctx.addIssue({
            code: 'custom',
            path: ['scale'],
            message: 'Supply exactly one of scale or keys',
          });
        if (value.keys !== undefined && value.offset !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['offset'],
            message: 'offset calibrates scale; put it in the keys instead',
          });
        if (value.keys === undefined && value.ease !== undefined)
          ctx.addIssue({ code: 'custom', path: ['ease'], message: 'ease requires keys' });
        value.keys?.forEach((key, index) => {
          const previous = value.keys?.[index - 1];
          if (previous !== undefined && key[0] <= previous[0])
            ctx.addIssue({
              code: 'custom',
              path: ['keys', index, 0],
              message: 'Key signals must be strictly ascending',
            });
        });
      }),
  )
  .superRefine((bindings, ctx) => {
    const channels = new Set<string>();
    bindings.forEach((entry, index) => {
      const key = JSON.stringify([entry.node, entry.property, entry.axis]);
      if (channels.has(key))
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: 'Duplicate node transform channel',
        });
      channels.add(key);
    });
  })
  .describe('Per-model node channels and their signal calibration.');

/** Bindings plus optional same-entity sources, as a vehicle visual's `animation` block. */
export const modelSignalSpecSchema: z.ZodType<ModelSignalSpec> = z
  .strictObject({
    sources: modelSignalSourcesSchema
      .optional()
      .describe('Optional component fields overriding or extending host telemetry.'),
    bindings: modelSignalBindingsSchema,
    derived: modelSignalDerivedSchema.optional(),
  })
  .superRefine((value, ctx) => checkModelSignalNames(value, ctx));

/** Automatic ECS bridge requires all sources; the direct API can supply values itself. */
export const modelSignalsSchema: z.ZodType<ModelSignalSpec> = z
  .strictObject({
    sources: modelSignalSourcesSchema,
    bindings: modelSignalBindingsSchema,
    derived: modelSignalDerivedSchema.optional(),
  })
  .superRefine((value, ctx) => checkModelSignalNames(value, ctx, true));
