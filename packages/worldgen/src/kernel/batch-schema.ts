/**
 * `molen/worldgen-batch@1`: a serialized generation request without its pack. It doubles as a
 * test fixture, a preview or bake input, and the worker payload: labeled outlines plus optional
 * labeled polygons and exclusions over a synthetic flat or sloped ground.
 */

import {
  getSchema,
  type JsonValue,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import {
  buildingAppearanceSchema,
  modelPlacementSchema,
  storefrontSchema,
} from './identity-schema';
import { type StyleRule, styleRuleSchema } from './rules';
import { DOTTED_ID_RE } from './schema-common';
import type {
  BuildingRequest,
  HeightSampler,
  ModelPlacementRequest,
  ScatterRequest,
  Vec3,
} from './types';

export interface WorldgenBatchGround {
  kind: 'flat' | 'slope';
  /** Ground height at the origin, meters. */
  height: number;
  /** Rise per meter along +x and +z (slope only). */
  dx: number;
  dz: number;
}

export interface WorldgenBatchDoc {
  format: 'molen/worldgen-batch@1';
  name: string;
  ground: WorldgenBatchGround;
  buildings: BuildingRequest[];
  scatter?: ScatterRequest;
  props?: ModelPlacementRequest[];
  rules?: StyleRule[];
  fallbackStyle?: string;
  scatterId?: string;
  /** Detail tier to generate at (0 = full). */
  tier: number;
  interiors?: boolean;
}

const point = z.array(z.number().finite()).length(2).describe('[x, z] in local meters.');
const ring = z
  .array(point)
  .min(3)
  .describe('Open ring of [x, z] points (no repeated closing point).');

const buildingRequest = z.strictObject({
  identity: z
    .string()
    .min(1)
    .describe("Caller-owned stable identity, e.g. 'f:123' or 'room:hall-1'."),
  labels: z.array(z.string().min(1)).min(1).describe('Category labels, most specific first.'),
  context: z.string().min(1).describe('Surrounding label (e.g. land class).').optional(),
  appearance: buildingAppearanceSchema.optional(),
  storefronts: z.array(storefrontSchema).max(12).optional(),
  interiorLabels: z.array(z.string().min(1)).max(32).optional(),
  outline: ring,
  holes: z.array(ring).optional(),
  groundOutline: ring.describe('Shared ground-fitting footprint for related parts.').optional(),
  height: z
    .number()
    .finite()
    .nonnegative()
    .describe('Known total height above the base, including the roof and minimum height, meters.')
    .optional(),
  levels: z.number().finite().nonnegative().describe('Known floor count.').optional(),
  minHeight: z
    .number()
    .finite()
    .nonnegative()
    .describe('Lowest floor above the base, meters.')
    .optional(),
  clipped: z.boolean().describe('The outline is a cut piece: flat roof and seam walls.').optional(),
  seamEdges: z
    .array(z.int().min(0))
    .describe('Outline edge indices on the cut boundary.')
    .optional(),
  style: z
    .string()
    .regex(DOTTED_ID_RE)
    .describe('Explicit archstyle id (bypasses rules).')
    .optional(),
});

const scatterRequest = z.strictObject({
  polygons: z.array(
    z.strictObject({
      label: z.string().min(1).describe('Land label the scatter rules match against.'),
      ring,
      holes: z.array(ring).optional(),
      density: z.number().nonnegative().describe('Density multiplier (default 1).').optional(),
      seed: z
        .int()
        .min(0)
        .max(4294967295)
        .describe('Owner seed for acceptance and appearance on the shared placement grid.')
        .optional(),
    }),
  ),
  exclusions: z
    .array(
      z.strictObject({
        ring: ring.optional(),
        polyline: z.array(point).min(2).optional(),
        width: z.number().nonnegative().describe('Polyline width, meters.').optional(),
        radius: z.number().nonnegative().describe('Clearance around the shape, meters.'),
        kind: z.enum(['roads', 'buildings', 'water']).optional(),
      }),
    )
    .default([]),
  emitBounds: z
    .array(z.number().finite())
    .length(4)
    .describe('[minX, minZ, maxX, maxZ] local meters.'),
  frame: z.strictObject({
    originX: z.number().finite().default(0),
    originZ: z.number().finite().default(0),
    unitsPerMeter: z.number().positive().default(1),
  }),
  keep: z.number().gt(0).max(1).describe('Detail keep fraction in (0, 1].').default(1),
});

const batchSchema = z.strictObject({
  format: z
    .literal('molen/worldgen-batch@1')
    .describe("Format envelope; always 'molen/worldgen-batch@1'."),
  name: z.string().min(1).describe('Fixture name.'),
  ground: z
    .strictObject({
      kind: z.enum(['flat', 'slope']).describe('Flat plane or a plane rising by dx/dz per meter.'),
      height: z.number().finite().describe('Ground height at the origin, meters.').default(0),
      dx: z.number().finite().describe('Rise per meter along +x (slope only).').default(0),
      dz: z.number().finite().describe('Rise per meter along +z (slope only).').default(0),
    })
    .describe('Synthetic ground under the batch.'),
  buildings: z.array(buildingRequest).default([]),
  scatter: scatterRequest.optional(),
  props: z.array(modelPlacementSchema).optional(),
  rules: z
    .array(styleRuleSchema)
    .describe('Style rules for this batch (before pack defaults).')
    .optional(),
  fallbackStyle: z
    .string()
    .regex(DOTTED_ID_RE)
    .describe('Archstyle when nothing matches.')
    .optional(),
  scatterId: z.string().regex(DOTTED_ID_RE).describe('Scatter rule set to use.').optional(),
  tier: z.int().min(0).describe('Detail tier to generate at (0 = full).').default(0),
  interiors: z
    .boolean()
    .describe('Cut real ground-floor openings and emit lazy interior descriptors.')
    .optional(),
});

export function validateWorldgenBatch(data: unknown): ValidationIssue[] {
  const doc = data as WorldgenBatchDoc;
  const issues: ValidationIssue[] = [];
  const identities = new Set<string>();
  doc.buildings.forEach((request, index) => {
    if (identities.has(request.identity)) {
      issues.push({
        path: `/buildings/${index}/identity`,
        code: 'duplicate_identity',
        message: `duplicate building identity "${request.identity}"`,
      });
    }
    identities.add(request.identity);
    for (const edge of request.seamEdges ?? []) {
      if (edge >= request.outline.length) {
        issues.push({
          path: `/buildings/${index}/seamEdges`,
          code: 'seam_edge_range',
          message: `seam edge ${edge} exceeds the ${request.outline.length} outline edges`,
        });
        break;
      }
    }
  });
  if (doc.scatter !== undefined) {
    const [minX, minZ, maxX, maxZ] = doc.scatter.emitBounds;
    if (minX >= maxX || minZ >= maxZ) {
      issues.push({
        path: '/scatter/emitBounds',
        code: 'bounds_order',
        message: 'emitBounds must be [minX, minZ, maxX, maxZ] with positive extent',
      });
    }
    doc.scatter.exclusions.forEach((exclusion, index) => {
      if (exclusion.ring === undefined && exclusion.polyline === undefined) {
        issues.push({
          path: `/scatter/exclusions/${index}`,
          code: 'exclusion_shape',
          message: 'an exclusion needs a ring or a polyline',
        });
      }
    });
  }
  return issues;
}

/** Ground sampler for a batch document. */
export function groundSamplerForBatch(ground: WorldgenBatchGround): HeightSampler {
  if (ground.kind === 'flat') {
    return {
      sampleHeight: () => ground.height,
      slopeAt: () => 0,
      normalAt: (): Vec3 => [0, 1, 0],
    };
  }
  const gradient = Math.hypot(ground.dx, ground.dz);
  const slope = gradient / Math.sqrt(1 + gradient * gradient);
  const normal: Vec3 = [-ground.dx, 1, -ground.dz];
  const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const unitNormal: Vec3 = [normal[0] / length, normal[1] / length, normal[2] / length];
  return {
    sampleHeight: (x, z) => ground.height + ground.dx * x + ground.dz * z,
    slopeAt: () => slope,
    normalAt: () => unitNormal,
  };
}

export const WORLDGEN_BATCH_EXAMPLE: JsonValue = {
  format: 'molen/worldgen-batch@1',
  name: 'two houses',
  ground: { kind: 'flat', height: 0 },
  buildings: [
    {
      identity: 'room:hall-1',
      labels: ['hall'],
      outline: [
        [0, 0],
        [14, 0],
        [14, 8],
        [0, 8],
      ],
      levels: 2,
    },
    {
      identity: 'f:42',
      labels: ['house', 'building'],
      context: 'residential',
      outline: [
        [20, 0],
        [32, 0],
        [32, 6],
        [26, 6],
        [26, 12],
        [20, 12],
      ],
    },
  ],
  tier: 0,
};

export function registerWorldgenBatchSchema(): void {
  if (getSchema('worldgen-batch') !== undefined) return;
  registerSchema('worldgen-batch', batchSchema, {
    id: 'molen/worldgen-batch@1',
    title: 'Worldgen batch',
    description:
      'A serialized generation request: labeled building outlines, optional labeled polygons and exclusions for scatter, style rules, and a synthetic ground. Used as fixture, preview and bake input, and worker payload.',
    examples: [WORLDGEN_BATCH_EXAMPLE],
    docsRef: 'guide/worldgen.md',
    validate: validateWorldgenBatch,
  });
}
