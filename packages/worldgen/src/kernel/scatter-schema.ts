import {
  getSchema,
  type JsonValue,
  nearestWithDistance,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import { normalizeClass } from './classes';
import type { ScatterDoc } from './scatter-types';
import { BUILTIN_MODELS, COLOR_RE, DOTTED_ID_RE, MODEL_REF_RE } from './schema-common';

const unit = z.number().min(0).max(1);
const weight = z
  .number()
  .finite()
  .nonnegative()
  .max(1000)
  .describe('Relative weight among sibling entries; 0 disables the entry.');

const range = (what: string): z.ZodObject<{ min: z.ZodNumber; max: z.ZodNumber }> =>
  z.object({
    min: z.number().finite().describe(`Minimum ${what}.`),
    max: z.number().finite().describe(`Maximum ${what} (>= min).`),
  });

const altitude = z.strictObject({
  min: z.number().finite().describe('Lowest ground height in meters.').optional(),
  max: z.number().finite().describe('Highest ground height in meters.').optional(),
});

const avoid = z.strictObject({
  roads: z.number().nonnegative().describe('Clearance from road edges, meters.'),
  buildings: z.number().nonnegative().describe('Clearance from building outlines, meters.'),
  water: z.number().nonnegative().describe('Clearance from water, meters.'),
});

const lod = z.strictObject({
  keepByTier: z
    .array(unit)
    .min(1)
    .max(8)
    .describe('Keep fraction per detail tier (index 0 = full detail); must be non-increasing.'),
  maxInstancesPerBatch: z.int().positive().describe('Hard cap per batch for this rule.'),
});

const population = z.strictObject({
  model: z
    .string()
    .regex(MODEL_REF_RE, "must be 'builtin:<name>' or a namespaced asset id")
    .describe("Model: an asset id (e.g. 'molen.entities.tree.conifer.fir') or 'builtin:<name>'."),
  weight,
  variants: z
    .array(
      z.strictObject({
        model: z.string().regex(MODEL_REF_RE),
        weight: z.number().finite().positive().max(1000),
      }),
    )
    .min(1)
    .max(16)
    .describe(
      'Interchangeable model forms sampled independently of species. Unretained forms fall back to model under the model budget; all must share habitat and scale bounds.',
    )
    .optional(),
  scale: range('uniform scale'),
  widthScale: z
    .strictObject({
      min: z.number().positive(),
      max: z.number().positive(),
    })
    .describe('Independent X/Z scale multiplier for crown width/bushiness; omitted means 1.')
    .optional(),
  yaw: z
    .enum(['random', 'none', 'rows'])
    .describe('Random, fixed, or aligned with cultivation rows.')
    .default('random'),
  align: z
    .enum(['up', 'normal'])
    .describe('Upright, or tilted to the ground normal.')
    .default('up'),
  tint: z
    .strictObject({
      hue: z.number().min(0).max(0.5).describe('Hue jitter ± (0..0.5).').default(0),
      saturation: z.number().min(0).max(1).describe('Saturation jitter ± (0..1).').default(0),
      lightness: z.number().min(0).max(1).describe('Lightness jitter ± (0..1).').default(0),
    })
    .describe('Per-instance HSL jitter applied as instance color.')
    .optional(),
  slopeMax: unit.describe('Species-specific slope limit (0 = flat, 1 = vertical).').optional(),
  altitude: altitude.describe('Species-specific ground height limits.').optional(),
});

const rule = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_-]*$/, 'must be a lowercase identifier')
    .describe('Rule id; part of every placement seed.'),
  classes: z.array(z.string().min(1)).min(1).describe('Labels this rule applies to (word match).'),
  notClasses: z.array(z.string().min(1)).describe('Labels that exclude the rule.').optional(),
  densityPerHectare: z
    .number()
    .nonnegative()
    .max(20000)
    .describe('Target instances per hectare before clustering and polygon density.'),
  minSpacing: z.number().nonnegative().describe('Minimum spacing hint in meters.').default(2),
  rows: z
    .strictObject({
      headland: z.number().min(0).max(30).optional(),
      spacing: z.number().min(0.5).max(100).describe('Distance between cultivation rows, meters.'),
      interval: z
        .number()
        .min(0.5)
        .max(100)
        .describe('Distance between plants along a row, meters.'),
      angle: z
        .number()
        .min(0)
        .max(180)
        .describe('Grid rotation in degrees from world X.')
        .default(0),
      jitter: z
        .number()
        .min(0)
        .max(0.2)
        .describe('Fractional cell jitter; 0 gives exact rows.')
        .default(0.04),
    })
    .describe(
      'Optional world-anchored cultivation grid. Density may thin it, but cannot overfill it.',
    )
    .optional(),
  nearWater: z
    .strictObject({
      maxDistance: z
        .number()
        .positive()
        .max(500)
        .describe('Maximum horizontal distance from mapped water edges, meters.'),
      classes: z
        .array(z.string().min(1))
        .min(1)
        .describe('Optional water labels; omitted accepts any mapped water.')
        .optional(),
    })
    .describe(
      'Require mapped water nearby, at the exclusion raster resolution. Water itself remains excluded.',
    )
    .optional(),
  clustering: z
    .strictObject({
      scale: z.number().positive().describe('Noise wavelength in meters.'),
      threshold: unit.describe('Noise value below which density is zero.').default(0.35),
      contrast: z.number().positive().describe('Steepness of the density ramp.').default(1.4),
      seedOffset: z.int().describe('Decorrelates rules sharing a class.').default(0),
      sharedSeed: z
        .int()
        .describe('Shared density field across layers; does not change placement seeds.')
        .optional(),
      detailScale: z
        .number()
        .positive()
        .describe('Wavelength of smaller clumps inside density patches, meters.')
        .optional(),
    })
    .describe('Noise-modulated density for natural clumps and clearings.')
    .optional(),
  layer: z
    .enum(['canopy', 'understory', 'groundcover', 'agriculture'])
    .describe(
      'Budget pool: canopy uses the batch instance and model caps; understory (shrubs and thickets) and groundcover (low patches) have independent caps and never thin canopy trees.',
    )
    .default('canopy'),
  slopeMax: unit.describe('Slope limit for this rule (0 = flat, 1 = vertical).').optional(),
  altitude: altitude.optional(),
  avoid: z
    .strictObject({
      roads: z.number().nonnegative().optional(),
      buildings: z.number().nonnegative().optional(),
      water: z.number().nonnegative().optional(),
    })
    .describe('Overrides of the default clearances, meters.')
    .optional(),
  populations: z.array(population).min(1).describe('Weighted species.'),
  lod: z
    .strictObject({
      keepByTier: z.array(unit).min(1).max(8).optional(),
      maxInstancesPerBatch: z.int().positive().optional(),
    })
    .describe('Overrides of the default detail policy.')
    .optional(),
});

export const scatterSchema: z.ZodType<ScatterDoc> = z.strictObject({
  format: z.literal('molen/scatter@1').describe("Format envelope; always 'molen/scatter@1'."),
  id: z
    .string()
    .regex(DOTTED_ID_RE, 'must be a namespaced dotted id')
    .describe("Rule set id under the pack namespace, e.g. 'molen.worldgen.scatter.pnw'."),
  title: z.string().min(1).describe('Human title.'),
  doc: z.string().optional(),
  version: z.int().min(1).describe('Bump to re-roll every placement.').default(1),
  surface: z.strictObject({
    default: z
      .string()
      .regex(COLOR_RE, "must be '#rrggbb'")
      .describe('Surface color for unlisted labels.'),
    colors: z
      .record(z.string(), z.string().regex(COLOR_RE, "must be '#rrggbb'"))
      .describe("Label pattern to '#rrggbb' surface color (exact, then word match).")
      .default({}),
  }),
  defaults: z.strictObject({
    avoid,
    slopeMax: unit.describe('Default slope limit.').default(0.75),
    lod,
  }),
  rules: z.array(rule).describe('Placement rules, all matching rules apply.').default([]),
});

export function validateScatter(data: unknown): ValidationIssue[] {
  const doc = data as ScatterDoc;
  const issues: ValidationIssue[] = [];
  const checkKeep = (keep: readonly number[] | undefined, path: string): void => {
    if (keep === undefined) return;
    for (let index = 1; index < keep.length; index++) {
      if ((keep[index] as number) > (keep[index - 1] as number)) {
        issues.push({
          path: `${path}/${index}`,
          code: 'keep_not_monotonic',
          message: 'keepByTier must be non-increasing so coarser tiers show subsets of finer ones',
        });
        return;
      }
    }
  };
  checkKeep(doc.defaults.lod.keepByTier, '/defaults/lod/keepByTier');
  const ids = new Set<string>();
  doc.rules.forEach((rule, index) => {
    const path = `/rules/${index}`;
    if (
      rule.rows !== undefined &&
      Math.min(rule.rows.spacing, rule.rows.interval) * (1 - rule.rows.jitter) < rule.minSpacing
    ) {
      issues.push({
        path: `${path}/rows`,
        code: 'row_spacing',
        message: 'Row spacing after jitter must respect minSpacing',
      });
    }
    if (ids.has(rule.id)) {
      issues.push({
        path: `${path}/id`,
        code: 'duplicate_rule_id',
        message: `duplicate rule id "${rule.id}"`,
      });
    }
    ids.add(rule.id);
    const total = rule.populations.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    if (total <= 0) {
      issues.push({
        path: `${path}/populations`,
        code: 'weight_sum',
        message: 'population weights must sum to more than 0',
      });
    }
    if (rule.densityPerHectare === 0 || total <= 0) {
      issues.push({
        path,
        code: 'rule_without_effect',
        message: `rule "${rule.id}" never places anything`,
        severity: 'notice',
      });
    }
    const packing = (rule.densityPerHectare * Math.PI * (rule.minSpacing / 2) ** 2) / 10_000;
    if (packing > 0.9) {
      issues.push({
        path: `${path}/minSpacing`,
        code: 'spacing_infeasible',
        message: `density ${rule.densityPerHectare}/ha cannot keep ${rule.minSpacing} m spacing`,
        hint: 'lower densityPerHectare or minSpacing',
        severity: 'notice',
      });
    }
    checkKeep(rule.lod?.keepByTier, `${path}/lod/keepByTier`);
    rule.populations.forEach((entry, populationIndex) => {
      const entryPath = `${path}/populations/${populationIndex}`;
      if (entry.scale.min > entry.scale.max) {
        issues.push({
          path: `${entryPath}/scale`,
          code: 'range_order',
          message: 'scale min exceeds max',
        });
      }
      if (entry.widthScale !== undefined && entry.widthScale.min > entry.widthScale.max) {
        issues.push({
          path: `${entryPath}/widthScale`,
          code: 'range_order',
          message: 'widthScale min exceeds max',
        });
      }
      // Any other builtin may be a landmark from the loaded library; only a near miss of a
      // procedural builtin is certainly a typo.
      const near =
        entry.model.startsWith('builtin:') && !BUILTIN_MODELS.includes(entry.model)
          ? nearestWithDistance(entry.model, [...BUILTIN_MODELS])
          : undefined;
      if (near !== undefined && near.distance <= 2) {
        issues.push({
          path: `${entryPath}/model`,
          code: 'unknown_builtin_model',
          message: `unknown builtin model "${entry.model}"`,
          expected: `a landmark id or one of: ${BUILTIN_MODELS.join(' ')}`,
          hint: `did you mean "${near.candidate}"?`,
        });
      }
      const altitude = entry.altitude ?? rule.altitude;
      if (
        altitude?.min !== undefined &&
        altitude.max !== undefined &&
        altitude.min > altitude.max
      ) {
        issues.push({
          path: `${entryPath}/altitude`,
          code: 'range_order',
          message: 'altitude min exceeds max',
        });
      }
    });
  });
  const seen = new Map<string, string>();
  for (const key of Object.keys(doc.surface.colors)) {
    const normalized = normalizeClass(key);
    const previous = seen.get(normalized);
    if (previous !== undefined) {
      issues.push({
        path: `/surface/colors/${key}`,
        code: 'duplicate_surface_class',
        message: `"${key}" and "${previous}" name the same class`,
        severity: 'notice',
      });
    }
    seen.set(normalized, key);
  }
  return issues;
}

export const SCATTER_EXAMPLE: JsonValue = {
  format: 'molen/scatter@1',
  id: 'molen.worldgen.scatter.pnw',
  title: 'Pacific Northwest vegetation',
  version: 1,
  surface: {
    default: '#6f7d64',
    colors: {
      forest: '#3f6347',
      wood: '#3a5f43',
      grassland: '#7d9562',
      grass: '#79915e',
      farmland: '#999866',
      scrub: '#6e8060',
      park: '#64845c',
      residential: '#8a8b7f',
      commercial: '#8d8a84',
      industrial: '#827c72',
      urban_area: '#85857d',
      beach: '#c0ae7d',
      sand: '#b6a777',
      glacier: '#d7e3e5',
      barren: '#8a806c',
      wetland: '#6e8a72',
    },
  },
  defaults: {
    avoid: { roads: 5, buildings: 3, water: 1.5 },
    slopeMax: 0.75,
    lod: { keepByTier: [1, 0.45, 0.18, 0.06], maxInstancesPerBatch: 6000 },
  },
  rules: [
    {
      id: 'conifer-forest',
      classes: ['forest', 'wood'],
      densityPerHectare: 140,
      minSpacing: 3.2,
      clustering: { scale: 160, threshold: 0.35, contrast: 1.4, seedOffset: 0 },
      slopeMax: 0.8,
      altitude: { max: 1700 },
      populations: [
        {
          model: 'molen.entities.tree.conifer.fir',
          weight: 6,
          scale: { min: 0.85, max: 1.4 },
          yaw: 'random',
          align: 'up',
          tint: { hue: 0.02, saturation: 0.08, lightness: 0.08 },
        },
        {
          model: 'molen.entities.tree.conifer.pine',
          weight: 3,
          scale: { min: 0.8, max: 1.3 },
          yaw: 'random',
          align: 'up',
        },
      ],
    },
    {
      id: 'park-trees',
      classes: ['park', 'garden', 'cemetery', 'grass', 'meadow'],
      densityPerHectare: 18,
      minSpacing: 6,
      populations: [
        {
          model: 'molen.entities.tree.deciduous.oak',
          weight: 3,
          scale: { min: 0.8, max: 1.2 },
          yaw: 'random',
          align: 'up',
        },
      ],
    },
  ],
};

export function registerScatterSchema(): void {
  if (getSchema('scatter') !== undefined) return;
  registerSchema('scatter', scatterSchema, {
    id: 'molen/scatter@1',
    title: 'Scatter rules',
    description:
      'Label-keyed deterministic prop placement (density, clustering, slope and clearance limits, weighted species with jitter, detail tiers) plus per-label surface colors.',
    examples: [SCATTER_EXAMPLE],
    docsRef: 'guide/worldgen.md',
    validate: validateScatter,
  });
}
