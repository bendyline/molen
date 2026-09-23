import { z } from 'zod';
import type { JsonObject } from './json';

/** Numeric simulation state mapped to an existing model's local transform channels. */
export interface ModelSignalBinding extends JsonObject {
  node: string;
  source: string;
  property: 'rotation' | 'position';
  axis: 'x' | 'y' | 'z';
  scale: number;
  offset?: number;
  min?: number;
  max?: number;
}

export interface ModelSignalSource extends JsonObject {
  component: string;
  /** Explicit segments; component and property names may contain dots. */
  path: (string | number)[];
}

export interface ModelSignalSpec extends JsonObject {
  /** Same-entity component reads. Scripts can publish custom components here. */
  sources?: Record<string, ModelSignalSource>;
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
        property: z.enum(['rotation', 'position']).describe('Local transform channel.'),
        axis: z.enum(['x', 'y', 'z']).describe('Local transform axis.'),
        scale: z.number().finite().describe('Multiply the signal by this value.'),
        offset: z.number().finite().optional().describe('Offset after scaling; default zero.'),
        min: z.number().finite().optional().describe('Minimum displacement from authored pose.'),
        max: z.number().finite().optional().describe('Maximum displacement from authored pose.'),
      })
      .superRefine((value, ctx) => {
        if (value.min !== undefined && value.max !== undefined && value.min > value.max)
          ctx.addIssue({ code: 'custom', path: ['max'], message: 'max must be at least min' });
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

/** Automatic ECS bridge requires all sources; the direct API can supply values itself. */
export const modelSignalsSchema: z.ZodType<ModelSignalSpec> = z
  .strictObject({
    sources: modelSignalSourcesSchema,
    bindings: modelSignalBindingsSchema,
  })
  .superRefine((value, ctx) => {
    value.bindings.forEach((binding, index) => {
      if (!Object.hasOwn(value.sources, binding.source))
        ctx.addIssue({
          code: 'custom',
          path: ['bindings', index, 'source'],
          message: 'Unknown signal source',
        });
    });
  });
