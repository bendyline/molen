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
    slots: z.record(
      name,
      z.strictObject({ materials: z.array(name).min(1), node: name.optional() }),
    ),
    anchors: z
      .record(
        name,
        z.strictObject({
          slot: name,
          position: vec3,
          size: z.tuple([positive, positive, positive]),
          rotation: vec3,
        }),
      )
      .optional(),
    variants: z
      .array(
        z.strictObject({
          id: name,
          label: z.string().min(1).max(256),
          provenance: z.strictObject({
            kind: z.enum(['photo', 'inspired', 'original']),
            note: z.string().min(1),
            references: z.array(
              z.strictObject({ title: z.string().min(1), url: z.url({ protocol: /^https?$/ }) }),
            ),
          }),
          paints: z.record(
            name,
            z.strictObject({
              color,
              roughness: fraction.optional(),
              metalness: fraction.optional(),
              camouflage: z
                .strictObject({
                  colors: z.array(color).min(2).max(4),
                  scale: z.number().positive().max(100),
                  seed: z.number().int().min(0).max(4294967295),
                })
                .optional(),
            }),
          ),
          markings: z
            .array(
              z.strictObject({
                anchor: name,
                graphic: z.strictObject({
                  label: z.string().max(256).optional(),
                  shapes: z
                    .array(
                      z.strictObject({
                        color,
                        points: z
                          .array(z.tuple([fraction, fraction]))
                          .min(3)
                          .max(512),
                      }),
                    )
                    .min(1)
                    .max(4096),
                }),
              }),
            )
            .max(32)
            .optional(),
        }),
      )
      .min(1)
      .max(64),
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
