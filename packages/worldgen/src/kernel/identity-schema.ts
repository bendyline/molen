import { z } from 'zod';
import { COLOR_RE, MODEL_REF_RE } from './schema-common';
import type {
  BuildingAppearance,
  ModelPlacementRequest,
  StorefrontRequest,
  StorefrontSign,
} from './types';

const point = z.tuple([z.number().finite(), z.number().finite()]);
export const buildingAppearanceSchema: z.ZodType<BuildingAppearance> = z.strictObject({
  wall: z.string().regex(COLOR_RE).optional(),
  trim: z.string().regex(COLOR_RE).optional(),
});
const storefrontSignSchema: z.ZodType<StorefrontSign> = z.strictObject({
  text: z.string().min(1).max(64).describe('The name as shown; it may break over two lines.'),
  plate: z.string().regex(COLOR_RE),
  ink: z.string().regex(COLOR_RE),
  stripe: z.string().regex(COLOR_RE).optional(),
  font: z.string().min(1).max(100).optional().describe('Glyph atlas role or face id.'),
  letterSpacing: z.number().min(-0.1).max(0.5).optional(),
});
export const storefrontSchema: z.ZodType<StorefrontRequest> = z.strictObject({
  identity: z.string().min(1),
  at: point.describe(
    'Desired frontage anchor in local meters; projected to a non-seam exterior edge.',
  ),
  signModel: z.string().regex(MODEL_REF_RE),
  signSize: z.tuple([z.number().positive(), z.number().positive()]).optional(),
  accent: z.string().regex(COLOR_RE),
  width: z.number().positive().max(100).optional(),
  sign: storefrontSignSchema
    .optional()
    .describe(
      'A name set from the batch glyph atlas in place of the sign model text; without an atlas holding every character the sign model shows.',
    ),
});
export const modelPlacementSchema: z.ZodType<ModelPlacementRequest> = z.strictObject({
  identity: z.string().min(1),
  model: z.string().regex(MODEL_REF_RE),
  at: point,
  yaw: z.number().finite().optional(),
  scale: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).optional(),
  color: z
    .tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])
    .optional()
    .describe('Instance tint, sRGB-encoded red, green and blue in 0..1; default white.'),
});
