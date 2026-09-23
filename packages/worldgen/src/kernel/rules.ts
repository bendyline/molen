/**
 * The selection rule language shared by archstyles, packs, and world bindings. A `when` clause is
 * an AND of the conditions present; list conditions are ORs of label words. There are no
 * expressions: every knob is a bound, so rules stay legible and did-you-mean friendly.
 */

import type { ValidationIssue } from '@bendyline/molen-schema';
import { z } from 'zod';
import { anyClassMatches, classMatches, normalizeClass } from './classes';
import { DOTTED_ID_RE } from './schema-common';
import { hashString, pickWeighted, unit01 } from './seed';

export interface SelectionWhen {
  /** Match when any label equals or contains one of these words. */
  class?: string[];
  notClass?: string[];
  /** Match the surrounding label; the word `none` matches an absent context. */
  contextClass?: string[];
  notContextClass?: string[];
  /** Footprint area bounds in m². */
  areaMin?: number;
  areaMax?: number;
  /** Known-height bounds in meters; a rule with height bounds never matches an unknown height. */
  heightMin?: number;
  heightMax?: number;
  /** Require (true) or forbid (false) a known height. */
  hasHeight?: boolean;
  levelsMin?: number;
  levelsMax?: number;
  /** Long/short axis ratio of the oriented bounding box, >= 1. */
  elongationMin?: number;
  elongationMax?: number;
  /** area / (width * depth), 0..1. */
  rectangularityMin?: number;
  rectangularityMax?: number;
  verticesMax?: number;
  holes?: boolean;
  /** Roof wing count after decomposition (archstyle rules only). */
  wingsMin?: number;
  wingsMax?: number;
}

/** What rules evaluate against. */
export interface BuildingMetrics {
  labels: string[];
  context?: string;
  areaM2: number;
  perimeterM: number;
  vertexCount: number;
  hasHoles: boolean;
  elongation: number;
  rectangularity: number;
  height?: number;
  levels?: number;
  wings?: number;
}

export interface StyleRule {
  when?: SelectionWhen;
  /** Archstyle id to use when the rule matches. */
  style: string;
  /** Stable identity selects one weighted regional variant; style is the identity-free fallback. */
  variants?: Array<{ style: string; weight: number }>;
}

const labelList = z.array(z.string().min(1)).min(1);
const nonnegative = z.number().finite().nonnegative();

export const whenSchema: z.ZodType<SelectionWhen> = z.strictObject({
  class: labelList
    .describe(
      'Match when any label equals or contains one of these words; "house" matches "semidetached_house" but not "warehouse".',
    )
    .optional(),
  notClass: labelList.describe('Reject when any label matches one of these words.').optional(),
  contextClass: labelList
    .describe(
      "Match the surrounding label (e.g. the land class); 'none' matches an absent context.",
    )
    .optional(),
  notContextClass: labelList.describe('Reject when the surrounding label matches.').optional(),
  areaMin: nonnegative.describe('Minimum footprint area in m².').optional(),
  areaMax: nonnegative.describe('Maximum footprint area in m².').optional(),
  heightMin: nonnegative
    .describe('Minimum known height in meters; never matches an unknown height.')
    .optional(),
  heightMax: nonnegative
    .describe('Maximum known height in meters; never matches an unknown height.')
    .optional(),
  hasHeight: z
    .boolean()
    .describe('Require (true) or forbid (false) a known source height.')
    .optional(),
  levelsMin: nonnegative
    .describe('Minimum floor count; roof choices also use resolved estimates.')
    .optional(),
  levelsMax: nonnegative
    .describe('Maximum floor count; roof choices also use resolved estimates.')
    .optional(),
  elongationMin: z
    .number()
    .finite()
    .min(1)
    .describe('Minimum long/short axis ratio of the oriented bounding box (>= 1).')
    .optional(),
  elongationMax: z
    .number()
    .finite()
    .min(1)
    .describe('Maximum long/short axis ratio of the oriented bounding box (>= 1).')
    .optional(),
  rectangularityMin: z
    .number()
    .min(0)
    .max(1)
    .describe('Minimum area / (width * depth), 0..1.')
    .optional(),
  rectangularityMax: z
    .number()
    .min(0)
    .max(1)
    .describe('Maximum area / (width * depth), 0..1.')
    .optional(),
  verticesMax: z.int().min(3).describe('Maximum outline vertex count after cleaning.').optional(),
  holes: z.boolean().describe('Require (true) or forbid (false) holes (courtyards).').optional(),
  wingsMin: z.int().min(0).describe('Minimum roof wing count (archstyle rules only).').optional(),
  wingsMax: z.int().min(0).describe('Maximum roof wing count (archstyle rules only).').optional(),
});

export const styleRuleSchema: z.ZodType<StyleRule> = z.strictObject({
  when: whenSchema.describe('Conditions; omit for a catch-all rule.').optional(),
  style: z
    .string()
    .regex(DOTTED_ID_RE, 'must be a namespaced archstyle id')
    .describe("Archstyle id to apply, e.g. 'molen.worldgen.pnw.house'."),
  variants: z
    .array(
      z.strictObject({
        style: z.string().regex(DOTTED_ID_RE, 'must be a namespaced archstyle id'),
        weight: z.number().finite().positive(),
      }),
    )
    .min(1)
    .max(120)
    .describe(
      'Optional weighted styles sampled from stable building identity. Without identity, use style.',
    )
    .optional(),
});

function wantsNone(candidates: readonly string[]): boolean {
  return candidates.some((candidate) => normalizeClass(candidate) === 'none');
}

export function matchesWhen(when: SelectionWhen | undefined, m: BuildingMetrics): boolean {
  if (when === undefined) return true;
  if (when.class !== undefined && !anyClassMatches(m.labels, when.class)) return false;
  if (when.notClass !== undefined && anyClassMatches(m.labels, when.notClass)) return false;
  if (when.contextClass !== undefined) {
    if (m.context === undefined) {
      if (!wantsNone(when.contextClass)) return false;
    } else if (!classMatches(m.context, when.contextClass)) {
      return false;
    }
  }
  if (
    when.notContextClass !== undefined &&
    m.context !== undefined &&
    classMatches(m.context, when.notContextClass)
  ) {
    return false;
  }
  if (when.areaMin !== undefined && m.areaM2 < when.areaMin) return false;
  if (when.areaMax !== undefined && m.areaM2 > when.areaMax) return false;
  if (when.heightMin !== undefined || when.heightMax !== undefined) {
    if (m.height === undefined) return false;
    if (when.heightMin !== undefined && m.height < when.heightMin) return false;
    if (when.heightMax !== undefined && m.height > when.heightMax) return false;
  }
  if (when.hasHeight !== undefined && (m.height !== undefined) !== when.hasHeight) return false;
  if (when.levelsMin !== undefined || when.levelsMax !== undefined) {
    if (m.levels === undefined) return false;
    if (when.levelsMin !== undefined && m.levels < when.levelsMin) return false;
    if (when.levelsMax !== undefined && m.levels > when.levelsMax) return false;
  }
  if (when.elongationMin !== undefined && m.elongation < when.elongationMin) return false;
  if (when.elongationMax !== undefined && m.elongation > when.elongationMax) return false;
  if (when.rectangularityMin !== undefined && m.rectangularity < when.rectangularityMin) {
    return false;
  }
  if (when.rectangularityMax !== undefined && m.rectangularity > when.rectangularityMax) {
    return false;
  }
  if (when.verticesMax !== undefined && m.vertexCount > when.verticesMax) return false;
  if (when.holes !== undefined && m.hasHoles !== when.holes) return false;
  const wings = m.wings ?? 0;
  if (when.wingsMin !== undefined && wings < when.wingsMin) return false;
  if (when.wingsMax !== undefined && wings > when.wingsMax) return false;
  return true;
}

export interface StyleSelection {
  style: string;
  /** Index of the matching rule, or -1 when the fallback was used. */
  ruleIndex: number;
}

/** First matching rule wins; `fallback` closes the chain. */
export function selectStyle(
  rules: readonly StyleRule[],
  metrics: BuildingMetrics,
  fallback: string,
  identity?: string,
): StyleSelection {
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index] as StyleRule;
    if (matchesWhen(rule.when, metrics)) {
      const variants = rule.variants;
      if (identity !== undefined && variants !== undefined && variants.length > 0) {
        const choice = pickWeighted(
          unit01(hashString(`wg1|style|${rule.style}|${identity}`), 0),
          variants.map((entry) => entry.weight),
        );
        return { style: variants[choice]?.style ?? rule.style, ruleIndex: index };
      }
      return { style: rule.style, ruleIndex: index };
    }
  }
  return { style: fallback, ruleIndex: -1 };
}

const RANGE_PAIRS: Array<[keyof SelectionWhen, keyof SelectionWhen]> = [
  ['areaMin', 'areaMax'],
  ['heightMin', 'heightMax'],
  ['levelsMin', 'levelsMax'],
  ['elongationMin', 'elongationMax'],
  ['rectangularityMin', 'rectangularityMax'],
  ['wingsMin', 'wingsMax'],
];

/** Cross-field checks for one `when` clause (Zod cannot compare two fields). */
export function whenIssues(
  when: SelectionWhen | undefined,
  path: string,
  options: { wingsSupported: boolean } = { wingsSupported: true },
): ValidationIssue[] {
  if (when === undefined) return [];
  const issues: ValidationIssue[] = [];
  for (const [minKey, maxKey] of RANGE_PAIRS) {
    const min = when[minKey];
    const max = when[maxKey];
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      issues.push({
        path: `${path}/${minKey}`,
        code: 'range_order',
        message: `${minKey} (${min}) must not exceed ${maxKey} (${max})`,
      });
    }
  }
  if (!options.wingsSupported && (when.wingsMin !== undefined || when.wingsMax !== undefined)) {
    issues.push({
      path: `${path}/wingsMin`,
      code: 'unsupported_condition',
      message: 'wing counts are unknown when this rule runs; the condition is ignored',
      severity: 'notice',
    });
  }
  return issues;
}

/** Rules after a catch-all can never run. */
export function unreachableRuleIssues(
  rules: readonly { when?: SelectionWhen }[],
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catchAll = rules.findIndex((rule) => rule.when === undefined);
  if (catchAll >= 0 && catchAll < rules.length - 1) {
    issues.push({
      path: `${path}/${catchAll + 1}`,
      code: 'unreachable_rule',
      message: `rule ${catchAll} has no "when" and matches everything; later rules never run`,
      severity: 'notice',
    });
  }
  return issues;
}
