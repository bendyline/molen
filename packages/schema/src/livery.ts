import { z } from 'zod';
import type { JsonObject } from './json';

/** Model-owned binding. Names, never mesh indices or texture UV coordinates. */
export interface LiverySlot extends JsonObject {
  materials: string[];
  /** Optional named subtree restriction. */
  node?: string;
}

/** A projector in the rest-pose bounds of a paint slot (or its named subtree). */
export interface LiveryAnchor extends JsonObject {
  slot: string;
  /** Fractions of the bound's extent, from its minimum corner. */
  position: [number, number, number];
  /** Projector width, height and depth as fractions of the longest bound dimension. */
  size: [number, number, number];
  /** XYZ Euler radians; the projector's +Z points out of the painted surface. */
  rotation: [number, number, number];
}

/** Original flat artwork, including font outlines; coordinates are 0..1, Y up. */
export interface LiveryGraphic extends JsonObject {
  label?: string;
  shapes: { color: string; points: [number, number][] }[];
}

export interface LiveryPaint extends JsonObject {
  color: string;
  roughness?: number;
  metalness?: number;
  /** Deterministic, model-space camouflage, independent of authored UVs. */
  camouflage?: { colors: string[]; scale: number; seed: number };
}

export interface LiveryVariant extends JsonObject {
  id: string;
  label: string;
  /** Be explicit about approximation; a reference URL alone is not verification. */
  provenance: {
    kind: 'photo' | 'inspired' | 'original';
    note: string;
    references: { title: string; url: string }[];
  };
  paints: Record<string, LiveryPaint>;
  markings?: { anchor: string; graphic: LiveryGraphic }[];
}

/** Shared by vehicles, aircraft, boats and ordinary glTF props. No simulation behavior. */
export interface LiveryData extends JsonObject {
  selected: string;
  slots: Record<string, LiverySlot>;
  anchors?: Record<string, LiveryAnchor>;
  variants: LiveryVariant[];
}

const name = z.string().min(1).max(128);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const fraction = z.number().min(0).max(1);
const positive = z.number().positive().max(4);
export const liverySchema: z.ZodType<LiveryData> = z
  .strictObject({
    selected: name.describe('Selected variant id; patch only this field to change the livery.'),
    slots: z
      .record(
        name,
        z.strictObject({
          materials: z
            .array(name)
            .min(1)
            .describe('Exact glTF material names belonging to this paint region.'),
          node: name.optional().describe('Optional named glTF subtree restricting this region.'),
        }),
      )
      .describe('Stable paint regions bound to named model materials.'),
    anchors: z
      .record(
        name,
        z.strictObject({
          slot: name.describe('Paint region receiving the projected marking.'),
          position: vec3.describe(
            'Projector center as fractions of the region bounds, measured from their minimum corner.',
          ),
          size: z
            .tuple([positive, positive, positive])
            .describe(
              'Projector width, height and depth as fractions of the longest region dimension.',
            ),
          rotation: vec3.describe(
            'XYZ Euler rotation in radians; local positive Z points out of the surface.',
          ),
        }),
      )
      .optional()
      .describe('Reusable marking projectors attached to model paint regions.'),
    variants: z
      .array(
        z.strictObject({
          id: name.describe('Stable identifier used by selected.'),
          label: z.string().min(1).max(256).describe('Display name for this livery.'),
          provenance: z
            .strictObject({
              kind: z
                .enum(['photo', 'inspired', 'original'])
                .describe(
                  'Whether the appearance is photograph verified, reference inspired or an original design.',
                ),
              note: z
                .string()
                .min(1)
                .describe('Attribution, verification scope and any deliberate approximations.'),
              references: z
                .array(
                  z.strictObject({
                    title: z.string().min(1).describe('Human-readable reference title.'),
                    url: z
                      .string()
                      .regex(/^https?:\/\/[^\s]+$/)
                      .describe('HTTP or HTTPS source URL.'),
                  }),
                )
                .describe(
                  'Public references supporting the appearance; required for photo and inspired designs.',
                ),
            })
            .describe('Evidence and authorship for the appearance.'),
          paints: z
            .record(
              name,
              z.strictObject({
                color: color.describe('Base paint color as an sRGB hex triplet.'),
                roughness: fraction.optional().describe('Optional material roughness override.'),
                metalness: fraction.optional().describe('Optional material metalness override.'),
                camouflage: z
                  .strictObject({
                    colors: z
                      .array(color)
                      .min(2)
                      .max(4)
                      .describe('Two to four colors for deterministic camouflage patches.'),
                    scale: z
                      .number()
                      .positive()
                      .max(100)
                      .describe('Pattern repetitions across the longest paint-region dimension.'),
                    seed: z
                      .number()
                      .int()
                      .min(0)
                      .max(4294967295)
                      .describe('Unsigned deterministic pattern seed.'),
                  })
                  .optional()
                  .describe(
                    'Optional camouflage projected in model space without changing authored UVs.',
                  ),
              }),
            )
            .describe(
              'Paint overrides keyed by stable paint-region name; omitted regions retain their authored appearance.',
            ),
          markings: z
            .array(
              z.strictObject({
                anchor: name.describe('Reusable model marking anchor.'),
                graphic: z
                  .strictObject({
                    label: z
                      .string()
                      .max(256)
                      .optional()
                      .describe(
                        'Optional descriptive label; rendered lettering belongs in the polygon artwork.',
                      ),
                    shapes: z
                      .array(
                        z.strictObject({
                          color: color.describe('Flat polygon color as an sRGB hex triplet.'),
                          points: z
                            .array(z.tuple([fraction, fraction]))
                            .min(3)
                            .max(512)
                            .describe(
                              'Polygon vertices in normalized 0–1 coordinates with positive Y upward.',
                            ),
                        }),
                      )
                      .min(1)
                      .max(4096)
                      .describe('Original flat artwork polygons, painted in order.'),
                  })
                  .describe('Resolution-independent artwork rasterized for the surface projector.'),
              }),
            )
            .max(32)
            .optional()
            .describe('Surface markings to project for this variant.'),
        }),
      )
      .min(1)
      .max(64)
      .describe('Available livery recipes for this model.'),
  })
  .superRefine((data, ctx) => {
    const issue = (path: (string | number)[], message: string): void =>
      ctx.addIssue({ code: 'custom', path, message });
    const ids = new Set<string>();
    for (const [index, variant] of data.variants.entries()) {
      if (ids.has(variant.id)) issue(['variants', index, 'id'], 'Duplicate livery id');
      ids.add(variant.id);
      for (const slot of Object.keys(variant.paints))
        if (!Object.hasOwn(data.slots, slot))
          issue(['variants', index, 'paints', slot], 'Unknown paint slot');
      for (const [i, marking] of (variant.markings ?? []).entries())
        if (!Object.hasOwn(data.anchors ?? {}, marking.anchor))
          issue(['variants', index, 'markings', i, 'anchor'], 'Unknown marking anchor');
      if (variant.provenance.kind !== 'original' && variant.provenance.references.length === 0)
        issue(
          ['variants', index, 'provenance', 'references'],
          'Photo and inspired liveries need references',
        );
    }
    if (!ids.has(data.selected)) issue(['selected'], 'Unknown livery id');
    for (const [key, anchor] of Object.entries(data.anchors ?? {}))
      if (!Object.hasOwn(data.slots, anchor.slot))
        issue(['anchors', key, 'slot'], 'Unknown paint slot');
  });
