import { z } from 'zod';
import { COLOR_RE, MODEL_REF_RE } from './schema-common';
import type { BuildingAppearance, ModelPlacementRequest, StorefrontRequest } from './types';

const point = z.tuple([z.number().finite(), z.number().finite()]);
export const buildingAppearanceSchema: z.ZodType<BuildingAppearance> = z.strictObject({
  wall: z.string().regex(COLOR_RE).optional(),
  trim: z.string().regex(COLOR_RE).optional(),
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
});
export const modelPlacementSchema: z.ZodType<ModelPlacementRequest> = z.strictObject({
  identity: z.string().min(1),
  model: z.string().regex(MODEL_REF_RE),
  at: point,
  yaw: z.number().finite().optional(),
  scale: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).optional(),
});
