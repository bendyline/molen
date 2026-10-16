/** Compact agricultural recipes are independent of ecological scatter and building style.
 * Source crop observations select recipes before the regional mixture is consulted. Mixtures
 * describe plausible visual defaults, never a crop survey or a claim about annual rotation. */
import { z } from 'zod';

export interface AgricultureCrop {
  id: string;
  aliases: string[];
  model: string;
  variants?: string[];
  kind: 'annual' | 'orchard' | 'vineyard' | 'pasture' | 'fallow';
  /** Row spacing and along-row patch interval in meters. */
  spacing: number;
  interval: number;
  color: string;
  soil: string;
  ripe: string;
  /** Sowing month in the northern hemisphere; shifted six months in the south. */
  sowingMonth: number;
  growingMonths: number;
}

export interface AgricultureProfile {
  /** One crop is selected per field, not independently for each plant. */
  crops: Array<{ crop: string; weight: number }>;
  /** Optional mixture for explicitly mapped permanent plantings. */
  orchards?: Array<{ crop: string; weight: number }>;
  /** Near-equatorial cultivation remains mature without an explicit source calendar. */
  tropical?: boolean;
}

const id = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const mixture = z.array(z.strictObject({ crop: id, weight: z.number().positive() })).min(1);
export const agricultureProfileSchema: z.ZodType<AgricultureProfile> = z.strictObject({
  crops: mixture,
  orchards: mixture.optional(),
  tropical: z.boolean().optional(),
});
export const agricultureCropSchema: z.ZodType<AgricultureCrop> = z.strictObject({
  id,
  aliases: z.array(z.string().min(1)).min(1),
  model: id,
  variants: z.array(id).min(1).optional(),
  kind: z.enum(['annual', 'orchard', 'vineyard', 'pasture', 'fallow']),
  spacing: z.number().min(0.25).max(30),
  interval: z.number().min(0.25).max(30),
  color,
  soil: color,
  ripe: color,
  sowingMonth: z.int().min(1).max(12),
  growingMonths: z.int().min(2).max(11),
});
