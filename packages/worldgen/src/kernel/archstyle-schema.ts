import {
  getSchema,
  type JsonValue,
  nearest,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import {
  ARCH_LOD_FEATURES,
  ARCH_ROOF_TYPES,
  type ArchStyleDoc,
  type NumberRange,
} from './archstyle-types';
import { unreachableRuleIssues, whenIssues, whenSchema } from './rules';
import {
  COLOR_RE,
  DOTTED_ID_RE,
  MATERIAL_REF_RE,
  MODEL_REF_RE,
  parseMaterialRef,
} from './schema-common';

// Every field carries a `.describe()` so the emitted JSON Schema documents units: meters, degrees,
// unit fractions 0..1, and weights (relative, 0 disables).

function range(what: string): z.ZodObject<{ min: z.ZodNumber; max: z.ZodNumber }> {
  return z.object({
    min: z.number().finite().describe(`Minimum ${what}.`),
    max: z.number().finite().describe(`Maximum ${what} (>= min).`),
  });
}

const weight = z
  .number()
  .finite()
  .nonnegative()
  .max(1000)
  .describe('Relative weight among sibling entries; 0 disables the entry.');
const unit = z.number().min(0).max(1);
const roofType = z.enum([...ARCH_ROOF_TYPES]);

const heightRule = z.strictObject({
  when: whenSchema.describe('Conditions; omit on the last (catch-all) rule.').optional(),
  levels: range('floor count').describe('Floor count range to sample from.').optional(),
  height: range('height in meters').describe('Height range in meters to sample from.').optional(),
});

const massing = z.strictObject({
  floorHeight: range('floor height in meters').describe('Sampled once per building.'),
  groundFloorHeight: range('ground floor height in meters')
    .describe('Ground floor height; defaults to floorHeight.')
    .optional(),
  heightFallback: z
    .array(heightRule)
    .min(1)
    .describe(
      'Used only when a request has neither height nor levels; ordered, first match wins, the last rule must have no "when".',
    ),
  groundFit: z
    .enum(['platform-average', 'platform-max', 'platform-min'])
    .describe('How the platform height follows the terrain under the outline.')
    .default('platform-average'),
  foundation: z.strictObject({
    height: range('exposed foundation height in meters'),
    exposeOnSlope: z
      .boolean()
      .describe('Emit a foundation skirt where the ground falls below the platform.')
      .default(true),
  }),
  wings: z.strictObject({
    split: z
      .enum(['none', 'rectangles'])
      .describe("'rectangles' decomposes L/T/U/... outlines into roof wings.")
      .default('rectangles'),
    maxWingSpan: z
      .number()
      .positive()
      .describe('Widest wing (meters) that still gets a pitched roof; wider wings go flat.')
      .default(14),
    minWingArea: z
      .number()
      .nonnegative()
      .describe('Wings smaller than this (m²) are dropped from the roof.')
      .default(12),
    secondaryHeightScale: range('secondary wing height scale, 0..1').describe(
      'Height of non-dominant wings relative to the main wing.',
    ),
  }),
  setbacks: z
    .array(
      z.strictObject({
        aboveHeight: z
          .number()
          .nonnegative()
          .describe('Height in meters above which the setback applies.'),
        inset: z.number().nonnegative().describe('Inset in meters.'),
      }),
    )
    .describe('Stepped insets for tall buildings, lowest first.')
    .default([]),
  respectMinHeight: z
    .boolean()
    .describe('Honor a request minHeight (raised parts) instead of grounding everything.')
    .default(true),
});

const roofChoice = z.strictObject({
  type: roofType.describe('Roof form.'),
  weight,
  when: whenSchema.describe('Eligibility, e.g. elongationMin for gables.').optional(),
  pitchDeg: range('roof pitch in degrees (5..75)')
    .describe('Required for every type except flat.')
    .optional(),
  lowerPitchDeg: range('lower slope pitch in degrees (mansard, gambrel)').optional(),
  overhang: range('eave overhang in meters').describe('Overrides roof.overhang.').optional(),
  ridge: z
    .enum(['long-axis', 'short-axis'])
    .describe('Ridge orientation relative to the wing.')
    .optional(),
  parapet: z
    .strictObject({
      height: range('parapet height in meters'),
      thickness: z.number().positive().describe('Parapet thickness in meters.').default(0.3),
    })
    .describe('Flat roofs only.')
    .optional(),
  shedDirection: z
    .enum(['downhill', 'random', 'long-axis'])
    .describe('Which way a shed roof rises.')
    .optional(),
});

const roof = z.strictObject({
  perWing: z
    .boolean()
    .describe('One roof per wing (true) or one over the main wing.')
    .default(true),
  ridge: z
    .enum(['long-axis', 'short-axis'])
    .describe('Default ridge orientation.')
    .default('long-axis'),
  overhang: range('default eave overhang in meters'),
  complexFootprint: z
    .enum(['flat', 'wings'])
    .describe(
      'Roof for outlines that cannot be decomposed: flat, or roofs over whatever wings exist.',
    )
    .default('wings'),
  choices: z
    .array(roofChoice)
    .min(1)
    .describe('Weighted roof forms; eligible ones are drawn by weight.'),
  fallback: z.literal('flat').describe('Always constructible fallback.').default('flat'),
  features: z
    .strictObject({
      dormers: z
        .strictObject({
          probability: unit.describe('Chance a qualifying building gets dormers.'),
          perRidgeMeters: z.number().positive().describe('One dormer per this many ridge meters.'),
          style: z.enum(['gable', 'shed']).describe('Dormer roof form.'),
          when: whenSchema.optional(),
        })
        .optional(),
    })
    .optional(),
});

const facade = z.strictObject({
  details: z
    .strictObject({
      shutters: z.boolean().describe('Paired louvered shutters beside punched windows.').optional(),
      balconies: z
        .strictObject({
          depth: z.number().min(0.25).max(2).describe('Balcony projection in meters.').default(0.7),
          railing: z
            .enum(['open', 'solid'])
            .describe('Slender rails or a solid parapet.')
            .default('open'),
          every: z
            .int()
            .min(1)
            .max(8)
            .describe('One balcony per this many upper-floor window bays.')
            .default(1),
        })
        .optional(),
      framing: z
        .strictObject({
          style: z
            .enum(['timber', 'pilasters'])
            .describe('Exposed half-timber framing or classical pilasters.'),
          width: z
            .number()
            .min(0.08)
            .max(0.5)
            .describe('Member width in meters; fitted to available wall.')
            .default(0.16),
        })
        .optional(),
      awnings: z
        .strictObject({
          depth: z
            .number()
            .min(0.25)
            .max(2)
            .describe('Sloping canopy projection above windows, meters.')
            .default(0.9),
        })
        .optional(),
      veranda: z
        .strictObject({
          depth: z
            .number()
            .min(0.5)
            .max(3)
            .describe('Ground veranda canopy projection, meters.')
            .default(1.4),
          columns: z.boolean().describe('Support the canopy with slender posts.').default(true),
        })
        .optional(),
    })
    .describe(
      'Optional near-detail geometry fitted to the live outline and openings; follows facade-bands LOD.',
    )
    .optional(),
  bays: z.strictObject({
    width: range('window bay width in meters'),
    cornerMargin: z
      .number()
      .nonnegative()
      .describe('Blank wall at each corner, meters.')
      .default(0.5),
  }),
  windows: z.strictObject({
    style: z
      .enum(['punched', 'ribbon', 'grid', 'none'])
      .describe(
        'Window rhythm; none omits upper windows but still allows ground-floor storefronts.',
      )
      .default('punched'),
    width: range('window width in meters; also controls storefront pane spacing'),
    height: range('window height in meters; caps storefront glazing below the solid wall above'),
    sill: range('sill height above the floor in meters'),
    probabilityPerBay: unit.describe('Chance each bay carries a window.').default(0.8),
    groundFloor: z
      .enum(['same', 'storefront', 'none'])
      .describe('Ground floor treatment.')
      .default('same'),
  }),
  bands: z.strictObject({
    base: z.strictObject({ height: range('base band height in meters') }),
    floorLines: z.boolean().describe('Emit a trim line at each floor.').default(false),
    cornice: z
      .strictObject({ height: z.number().positive().describe('Cornice height in meters.') })
      .optional(),
  }),
});

const materialSpec = z.strictObject({
  choices: z
    .array(
      z.strictObject({
        ref: z
          .string()
          .regex(MATERIAL_REF_RE, "must be 'palette:#rrggbb', 'matgraph:<id>', or 'pixelgrid:<id>'")
          .describe(
            "materialRef: 'palette:#rrggbb', 'matgraph:<pack material id or path>', or 'pixelgrid:<id or path>'.",
          ),
        weight,
      }),
    )
    .min(1)
    .describe('Weighted materials; one is picked per building.'),
  palette: z.string().min(1).describe('Key of `palettes` used to tint this part.').optional(),
  tint: z
    .enum(['multiply', 'none'])
    .describe(
      "'multiply' = vertex color times texture (author textures light); 'none' = texture as is.",
    )
    .default('multiply'),
  uv: z
    .enum(['meters', 'cell'])
    .describe("'meters': world-metric UVs; 'cell': one repeat per (bay, floor) facade cell.")
    .default('meters'),
  uvScale: z
    .array(z.number().positive())
    .length(2)
    .describe('Meters per texture repeat [u, v] when uv is meters.')
    .optional(),
  uvOffset: z
    .enum(['cell', 'meters', 'none'])
    .describe('Seeded per-building UV shift so neighbours never align.')
    .default('meters'),
  uvMirror: z.boolean().describe('Allow a seeded horizontal flip.').default(false),
});

const palette = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        color: z.string().regex(COLOR_RE, "must be '#rrggbb'").describe("'#rrggbb' color."),
        weight,
        name: z.string().optional(),
      }),
    )
    .min(1),
  jitter: z.strictObject({
    hue: z
      .number()
      .min(0)
      .max(0.5)
      .describe('Hue jitter, ± fraction of the wheel (0..0.5).')
      .default(0),
    saturation: z.number().min(0).max(1).describe('Saturation jitter, ± (0..1).').default(0),
    lightness: z.number().min(0).max(1).describe('Lightness jitter, ± (0..1).').default(0),
  }),
});

const prop = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_-]*$/)
    .describe('Prop id, unique within the style.'),
  model: z
    .string()
    .regex(MODEL_REF_RE, "must be 'builtin:<name>' or a namespaced asset id")
    .describe("Model: an asset id (e.g. 'molen.worldgen.prop.chimney.brick') or 'builtin:<name>'."),
  anchor: z
    .enum(['roof-ridge', 'roof-flat', 'roof-edge', 'wall-any', 'ground-any'])
    .describe('Where instances attach.'),
  probability: unit.describe('Chance the building gets this prop at all.').default(1),
  count: range('instance count'),
  perAreaM2: z
    .number()
    .positive()
    .describe('When set, count = clamp(round(area / perAreaM2), count.min, count.max).')
    .optional(),
  when: whenSchema.optional(),
  roof: z.array(roofType).describe('Only on these roof forms.').optional(),
  spacing: z
    .number()
    .nonnegative()
    .describe('Minimum spacing between instances, meters.')
    .default(2),
  margin: z.number().nonnegative().describe('Distance from edges, meters.').default(0.5),
  scale: range('uniform scale'),
  yaw: z
    .enum(['align-wall', 'random', 'fixed'])
    .describe('Orientation policy.')
    .default('align-wall'),
  tintPalette: z.string().describe('Palette key for instance tint.').optional(),
  lodTier: z.int().min(0).describe('Highest detail tier that still shows this prop.').default(0),
});

const lod = z.strictObject({
  tiers: z
    .array(
      z.strictObject({
        minTier: z.int().min(0).describe('Detail tier this entry applies from (0 = full detail).'),
        keep: z.array(z.enum([...ARCH_LOD_FEATURES])).describe('Features kept at this tier.'),
      }),
    )
    .min(1)
    .describe('Ordered by minTier; beyond the last tier the building is a tinted box.'),
});

const archStyleSchema = z.strictObject({
  format: z.literal('molen/archstyle@1').describe("Format envelope; always 'molen/archstyle@1'."),
  id: z
    .string()
    .regex(DOTTED_ID_RE, 'must be a namespaced dotted id')
    .describe("Style id under the pack namespace, e.g. 'molen.worldgen.pnw.house'."),
  title: z.string().min(1).describe('Human title.'),
  doc: z.string().describe('What the style looks like and where it applies.').optional(),
  version: z.int().min(1).describe('Bump to re-roll every building using this style.').default(1),
  applicability: z.strictObject({
    classes: z.array(z.string().min(1)).min(1).describe('Labels this style is meant for.'),
    contextClasses: z.array(z.string().min(1)).describe('Surrounding labels it suits.').optional(),
    areaMin: z.number().nonnegative().describe('Smallest suitable footprint, m².').optional(),
    areaMax: z.number().nonnegative().describe('Largest suitable footprint, m².').optional(),
    notes: z.string().optional(),
  }),
  massing,
  roof,
  facade,
  materials: z.strictObject({
    wall: materialSpec,
    roof: materialSpec,
    trim: materialSpec,
    foundation: materialSpec,
    window: materialSpec.optional(),
  }),
  palettes: z
    .record(z.string(), palette)
    .describe('Named color palettes referenced by parts and props.')
    .default({}),
  props: z.array(prop).describe('Attached props (chimneys, rooftop units, ...).').default([]),
  lod,
});

function rangeIssues(
  range: NumberRange | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if (range !== undefined && range.min > range.max) {
    issues.push({
      path,
      code: 'range_order',
      message: `min (${range.min}) exceeds max (${range.max})`,
    });
  }
}

function weightSum(entries: readonly { weight: number }[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
}

/** Cross-field checks: ranges, pitches, weights, catch-alls, palette refs, UV scales, tiers. */
export function validateArchStyle(data: unknown): ValidationIssue[] {
  const doc = data as ArchStyleDoc;
  const issues: ValidationIssue[] = [];
  const paletteNames = Object.keys(doc.palettes ?? {});
  rangeIssues(doc.massing.floorHeight, '/massing/floorHeight', issues);
  rangeIssues(doc.massing.groundFloorHeight, '/massing/groundFloorHeight', issues);
  rangeIssues(doc.massing.foundation.height, '/massing/foundation/height', issues);
  rangeIssues(
    doc.massing.wings.secondaryHeightScale,
    '/massing/wings/secondaryHeightScale',
    issues,
  );
  if (doc.massing.wings.secondaryHeightScale.max > 1) {
    issues.push({
      path: '/massing/wings/secondaryHeightScale/max',
      code: 'secondary_height_scale',
      message: 'secondary wings cannot be taller than the main wing (max must be <= 1)',
    });
  }
  doc.massing.heightFallback.forEach((rule, index) => {
    const path = `/massing/heightFallback/${index}`;
    const hasLevels = rule.levels !== undefined;
    const hasHeight = rule.height !== undefined;
    if (hasLevels === hasHeight) {
      issues.push({
        path,
        code: 'height_rule_shape',
        message: 'a height rule needs exactly one of "levels" or "height"',
      });
    }
    rangeIssues(rule.levels, `${path}/levels`, issues);
    rangeIssues(rule.height, `${path}/height`, issues);
    issues.push(...whenIssues(rule.when, `${path}/when`, { wingsSupported: false }));
  });
  const last = doc.massing.heightFallback.at(-1);
  if (last !== undefined && last.when !== undefined) {
    issues.push({
      path: `/massing/heightFallback/${doc.massing.heightFallback.length - 1}`,
      code: 'height_fallback_catch_all',
      message: 'the last height fallback rule must have no "when" so every building gets a height',
    });
  }
  issues.push(...unreachableRuleIssues(doc.massing.heightFallback, '/massing/heightFallback'));
  rangeIssues(doc.roof.overhang, '/roof/overhang', issues);
  if (weightSum(doc.roof.choices) <= 0) {
    issues.push({
      path: '/roof/choices',
      code: 'weight_sum',
      message: 'roof choice weights must sum to more than 0',
    });
  }
  doc.roof.choices.forEach((choice, index) => {
    const path = `/roof/choices/${index}`;
    if (choice.type !== 'flat' && choice.pitchDeg === undefined) {
      issues.push({
        path: `${path}/pitchDeg`,
        code: 'pitch_required',
        message: `${choice.type} roofs need a pitchDeg range`,
      });
    }
    for (const [key, pitch] of [
      ['pitchDeg', choice.pitchDeg],
      ['lowerPitchDeg', choice.lowerPitchDeg],
    ] as const) {
      if (pitch === undefined) continue;
      rangeIssues(pitch, `${path}/${key}`, issues);
      if (pitch.min < 5 || pitch.max > 75) {
        issues.push({
          path: `${path}/${key}`,
          code: 'pitch_range',
          message: 'pitches must stay within 5..75 degrees',
        });
      }
    }
    rangeIssues(choice.overhang, `${path}/overhang`, issues);
    rangeIssues(choice.parapet?.height, `${path}/parapet/height`, issues);
    if (choice.type === 'flat' && choice.pitchDeg !== undefined) {
      issues.push({
        path: `${path}/pitchDeg`,
        code: 'pitch_unexpected',
        message: 'flat roofs ignore pitchDeg',
        severity: 'notice',
      });
    }
    issues.push(...whenIssues(choice.when, `${path}/when`));
  });
  issues.push(...whenIssues(doc.roof.features?.dormers?.when, '/roof/features/dormers/when'));
  rangeIssues(doc.facade.bays.width, '/facade/bays/width', issues);
  rangeIssues(doc.facade.windows.width, '/facade/windows/width', issues);
  rangeIssues(doc.facade.windows.height, '/facade/windows/height', issues);
  rangeIssues(doc.facade.windows.sill, '/facade/windows/sill', issues);
  rangeIssues(doc.facade.bands.base.height, '/facade/bands/base/height', issues);
  for (const [part, spec] of Object.entries(doc.materials)) {
    if (spec === undefined) continue;
    const path = `/materials/${part}`;
    if (weightSum(spec.choices) <= 0) {
      issues.push({
        path: `${path}/choices`,
        code: 'weight_sum',
        message: 'material choice weights must sum to more than 0',
      });
    }
    if (spec.palette !== undefined && !paletteNames.includes(spec.palette)) {
      const near = nearest(spec.palette, paletteNames);
      issues.push({
        path: `${path}/palette`,
        code: 'unknown_palette',
        message: `palette "${spec.palette}" is not defined`,
        expected:
          paletteNames.length > 0 ? `one of: ${paletteNames.join(' ')}` : 'a key of palettes',
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
      });
    }
    if (spec.uv === 'meters' && spec.uvScale === undefined) {
      const textured = spec.choices.some(
        (choice) => parseMaterialRef(choice.ref)?.kind !== 'palette',
      );
      if (textured) {
        issues.push({
          path: `${path}/uvScale`,
          code: 'uv_scale_required',
          message: 'textured materials with metric UVs need uvScale (meters per repeat)',
        });
      }
    }
  }
  for (const [name, entry] of Object.entries(doc.palettes)) {
    if (weightSum(entry.entries) <= 0) {
      issues.push({
        path: `/palettes/${name}/entries`,
        code: 'weight_sum',
        message: 'palette entry weights must sum to more than 0',
      });
    }
  }
  const roofTypes = new Set(doc.roof.choices.map((choice) => choice.type));
  const propIds = new Set<string>();
  doc.props.forEach((entry, index) => {
    const path = `/props/${index}`;
    if (propIds.has(entry.id)) {
      issues.push({
        path: `${path}/id`,
        code: 'duplicate_prop_id',
        message: `duplicate prop id "${entry.id}"`,
      });
    }
    propIds.add(entry.id);
    rangeIssues(entry.count, `${path}/count`, issues);
    rangeIssues(entry.scale, `${path}/scale`, issues);
    issues.push(...whenIssues(entry.when, `${path}/when`));
    if (entry.tintPalette !== undefined && !paletteNames.includes(entry.tintPalette)) {
      const near = nearest(entry.tintPalette, paletteNames);
      issues.push({
        path: `${path}/tintPalette`,
        code: 'unknown_palette',
        message: `palette "${entry.tintPalette}" is not defined`,
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
      });
    }
    for (const type of entry.roof ?? []) {
      if (!roofTypes.has(type)) {
        issues.push({
          path: `${path}/roof`,
          code: 'roof_type_unavailable',
          message: `prop "${entry.id}" targets roof "${type}" which this style never builds`,
          severity: 'notice',
        });
      }
    }
    if (entry.lodTier >= doc.lod.tiers.length) {
      issues.push({
        path: `${path}/lodTier`,
        code: 'lod_tier_unknown',
        message: `lodTier ${entry.lodTier} exceeds the ${doc.lod.tiers.length} declared tiers`,
      });
    }
  });
  doc.lod.tiers.forEach((tier, index) => {
    if (index === 0 && tier.minTier !== 0) {
      issues.push({
        path: '/lod/tiers/0/minTier',
        code: 'lod_tier_order',
        message: 'the first tier must start at 0',
      });
    }
    const previous = doc.lod.tiers[index - 1];
    if (previous !== undefined && tier.minTier <= previous.minTier) {
      issues.push({
        path: `/lod/tiers/${index}/minTier`,
        code: 'lod_tier_order',
        message: 'tiers must have strictly increasing minTier',
      });
    }
  });
  return issues;
}

export const ARCHSTYLE_EXAMPLE: JsonValue = {
  format: 'molen/archstyle@1',
  id: 'molen.worldgen.pnw.house',
  title: 'Pacific Northwest house',
  doc: 'Wood-sided single-family homes: steep gable and hip roofs, deep eaves, muted sage, slate, and cedar palettes, exposed foundations on slopes.',
  version: 1,
  applicability: {
    classes: ['house', 'detached', 'semidetached', 'residential', 'bungalow', 'yes', 'building'],
    contextClasses: ['residential', 'none'],
    areaMax: 400,
  },
  massing: {
    floorHeight: { min: 2.7, max: 3.1 },
    heightFallback: [
      { when: { areaMax: 90 }, levels: { min: 1, max: 1 } },
      { when: { areaMax: 220 }, levels: { min: 1, max: 2 } },
      { levels: { min: 2, max: 2 } },
    ],
    groundFit: 'platform-max',
    foundation: { height: { min: 0.4, max: 0.9 }, exposeOnSlope: true },
    wings: {
      split: 'rectangles',
      maxWingSpan: 12,
      minWingArea: 18,
      secondaryHeightScale: { min: 0.6, max: 0.95 },
    },
    setbacks: [],
    respectMinHeight: true,
  },
  roof: {
    perWing: true,
    ridge: 'long-axis',
    overhang: { min: 0.45, max: 0.75 },
    complexFootprint: 'wings',
    choices: [
      { type: 'gable', weight: 6, pitchDeg: { min: 30, max: 42 }, when: { elongationMin: 1.15 } },
      { type: 'hip', weight: 3, pitchDeg: { min: 25, max: 35 } },
      {
        type: 'pyramid',
        weight: 1,
        pitchDeg: { min: 25, max: 32 },
        when: { elongationMax: 1.15, areaMax: 90 },
      },
    ],
    fallback: 'flat',
    features: {
      dormers: { probability: 0.35, perRidgeMeters: 5, style: 'gable', when: { areaMin: 110 } },
    },
  },
  facade: {
    bays: { width: { min: 2.6, max: 3.6 }, cornerMargin: 0.6 },
    windows: {
      style: 'punched',
      width: { min: 1, max: 1.5 },
      height: { min: 1.2, max: 1.5 },
      sill: { min: 0.8, max: 1 },
      probabilityPerBay: 0.8,
      groundFloor: 'same',
    },
    bands: {
      base: { height: { min: 0.3, max: 0.5 } },
      floorLines: false,
      cornice: { height: 0.18 },
    },
  },
  materials: {
    wall: {
      choices: [
        { ref: 'matgraph:molen.worldgen.material.siding_lap', weight: 4 },
        { ref: 'matgraph:molen.worldgen.material.siding_shingle', weight: 1 },
      ],
      palette: 'siding',
      tint: 'multiply',
      uv: 'meters',
      uvScale: [3, 2.9],
      uvOffset: 'meters',
      uvMirror: true,
    },
    roof: {
      choices: [{ ref: 'matgraph:molen.worldgen.material.shingle_asphalt', weight: 1 }],
      palette: 'roof',
      tint: 'multiply',
      uv: 'meters',
      uvScale: [2, 2],
      uvOffset: 'meters',
      uvMirror: false,
    },
    trim: {
      choices: [{ ref: 'palette:#f2efe6', weight: 1 }],
      palette: 'trim',
      tint: 'multiply',
      uv: 'meters',
      uvOffset: 'none',
      uvMirror: false,
    },
    foundation: {
      choices: [{ ref: 'matgraph:molen.worldgen.material.concrete_plain', weight: 1 }],
      tint: 'none',
      uv: 'meters',
      uvScale: [2, 2],
      uvOffset: 'meters',
      uvMirror: false,
    },
  },
  palettes: {
    siding: {
      entries: [
        { color: '#8b9a7a', weight: 3, name: 'sage' },
        { color: '#5e6b7a', weight: 3, name: 'slate' },
        { color: '#a89f8e', weight: 2, name: 'warm grey' },
        { color: '#7a5a45', weight: 2, name: 'cedar' },
        { color: '#ece7dc', weight: 1, name: 'cream' },
      ],
      jitter: { hue: 0.015, saturation: 0.06, lightness: 0.06 },
    },
    roof: {
      entries: [
        { color: '#3f4245', weight: 5 },
        { color: '#5a4a3c', weight: 2 },
        { color: '#2f3a34', weight: 2 },
      ],
      jitter: { hue: 0.01, saturation: 0.04, lightness: 0.05 },
    },
    trim: {
      entries: [
        { color: '#f4f1ea', weight: 4 },
        { color: '#d9d4c7', weight: 1 },
      ],
      jitter: { hue: 0, saturation: 0.02, lightness: 0.03 },
    },
  },
  props: [
    {
      id: 'chimney',
      model: 'molen.worldgen.prop.chimney.brick',
      anchor: 'roof-ridge',
      probability: 0.55,
      count: { min: 1, max: 1 },
      roof: ['gable', 'hip'],
      spacing: 4,
      margin: 1.2,
      scale: { min: 0.9, max: 1.1 },
      yaw: 'align-wall',
      lodTier: 0,
    },
  ],
  lod: {
    tiers: [
      {
        minTier: 0,
        keep: ['roof-shape', 'roof-features', 'facade-texture', 'facade-bands', 'props'],
      },
      { minTier: 1, keep: ['roof-shape', 'facade-texture'] },
      { minTier: 2, keep: ['roof-shape'] },
    ],
  },
};

export function registerArchStyleSchema(): void {
  if (getSchema('archstyle') !== undefined) return;
  registerSchema('archstyle', archStyleSchema, {
    id: 'molen/archstyle@1',
    title: 'Architectural style',
    description:
      'How to turn any outline into a styled building: massing, roof grammar, facade rhythm, materials, palettes, props, and detail tiers. World-agnostic; bound to places by a pack or a region atlas.',
    examples: [ARCHSTYLE_EXAMPLE],
    docsRef: 'guide/worldgen.md',
    validate: validateArchStyle,
  });
}
