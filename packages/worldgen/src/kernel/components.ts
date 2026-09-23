/**
 * The `worldgenBuilding` component: a building generated at runtime from an outline in the
 * entity's local frame, for scenes that are not maps (a dungeon hall, a village on a plane).
 * Registered in the shared component vocabulary so `molen validate` checks scenes that use it;
 * the client entity layer renders it, the kernel never sees geometry.
 */

import { type JsonValue, registerComponent } from '@bendyline/molen-schema';
import { z } from 'zod';
import { buildingAppearanceSchema, storefrontSchema } from './identity-schema';
import { DOTTED_ID_RE } from './schema-common';
import type { BuildingAppearance, StorefrontRequest, Vec2 } from './types';

export const WORLDGEN_BUILDING_COMPONENT: string = 'worldgenBuilding';

export interface WorldgenBuildingData {
  /** Style id in the loaded pack, e.g. 'molen.worldgen.fantasy.hall'. */
  style: string;
  /** Outline in entity-local meters (+x right, +z toward the viewer), no closing point. */
  outline: Vec2[];
  holes?: Vec2[][];
  appearance?: BuildingAppearance;
  storefronts?: StorefrontRequest[];
  height?: number;
  levels?: number;
  /** Labels the style's rules and props may look at (default: ['building']). */
  labels?: string[];
  /** Stable identity for the seed (default: the entity id). */
  seed?: string;
  /** Detail tier (default 0). */
  tier?: number;
}

/** Bare component handle (structurally a kernel `ComponentType`) without pulling the kernel. */
export const WorldgenBuilding: { readonly name: string; readonly __type?: WorldgenBuildingData } = {
  name: WORLDGEN_BUILDING_COMPONENT,
};

const point = z.array(z.number().finite()).length(2).describe('[x, z] in entity-local meters.');
const ring = z.array(point).min(3).describe('Open ring of [x, z] points.');

const worldgenBuildingSchema = z.looseObject({
  style: z
    .string()
    .regex(DOTTED_ID_RE, 'must be a namespaced dotted style id')
    .describe("Style id in the loaded pack, e.g. 'molen.worldgen.fantasy.hall'."),
  appearance: buildingAppearanceSchema.optional(),
  storefronts: z.array(storefrontSchema).max(12).optional(),
  outline: ring,
  holes: z.array(ring).describe('Inner rings (courtyards).').optional(),
  height: z.number().positive().describe('Wall height in meters (overrides levels).').optional(),
  levels: z.number().positive().describe('Floor count.').optional(),
  labels: z
    .array(z.string().min(1))
    .describe("Labels the style rules and props see (default ['building']).")
    .optional(),
  seed: z.string().min(1).describe('Stable identity for the seed (default: entity id).').optional(),
  tier: z.int().min(0).describe('Detail tier, 0 = full (default 0).').optional(),
});

export const WORLDGEN_BUILDING_EXAMPLE: JsonValue = {
  style: 'molen.worldgen.fantasy.hall',
  outline: [
    [-12, -5],
    [12, -5],
    [12, 5],
    [-12, 5],
  ],
  levels: 2,
  labels: ['hall'],
};

let registered = false;

/** Register the worldgen components in the shared vocabulary (idempotent). */
export function registerWorldgenComponents(): void {
  if (registered) return;
  registered = true;
  registerComponent(
    WORLDGEN_BUILDING_COMPONENT,
    worldgenBuildingSchema,
    {
      description:
        'A building generated at runtime from an outline in the entity frame, styled by a molen/archstyle@1 in the loaded pack; rendered by the worldgen client entity layer.',
      owner: 'worldgen',
      examples: [WORLDGEN_BUILDING_EXAMPLE],
      docsRef: 'guide/worldgen.md',
    },
    { override: true },
  );
}
