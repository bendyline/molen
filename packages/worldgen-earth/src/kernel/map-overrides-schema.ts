import { getSchema, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { MAP_OVERRIDE_LIMITS, type MapOverride, resolveMapOverride } from './map-overrides';

/** Map overrides kept as a document: what a host passes a view, as data. */
export interface MapOverridesDoc {
  format: 'molen/map-overrides@1';
  title?: string;
  overrides: MapOverride[];
}

const finite = z.number().finite();
const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/)
  .describe('Lowercase letters, digits, ".", "_" and "-"; at most 64 characters.');
const point = z
  .tuple([finite, finite])
  .describe('[x, z] in meters from the area center: +x east, +z south before the area heading.');
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .describe('A #rrggbb color.');
const heading = finite.describe('Compass sense, radians clockwise seen from above; default 0.');
const factor = finite.min(0.01).max(100);
const scale = z
  .union([factor, z.tuple([factor, factor, factor])])
  .describe('One factor or [x, y, z], each 0.01 to 100; default 1.');
const longitude = finite.min(-180).max(180);
const latitude = finite.min(-85).max(85);
const side = finite.min(MAP_OVERRIDE_LIMITS.areaSide[0]).max(MAP_OVERRIDE_LIMITS.areaSide[1]);
const level = z.int().min(0).max(26);
const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$/);
// A host's own bundles ride on an override; this document only keeps their ids apart.
const bundle = z
  .array(z.looseObject({ id }))
  .max(256)
  .describe('Kept for the host view (see the Earth view guide); not read by the map edit.');

const area = z.union([
  z.strictObject({
    center: z
      .tuple([longitude, latitude])
      .describe('[longitude, latitude] of the rectangle center, the origin of the override frame.'),
    size: z.tuple([side, side]).describe('[width, depth] in meters, each 1 to 2000.'),
    heading: heading
      .describe('Compass heading the frame -z side faces, radians; default 0.')
      .optional(),
  }),
  z.strictObject({
    bounds: z
      .tuple([longitude, latitude, longitude, latitude])
      .refine(([west, south, east, north]) => west < east && south < north, 'ordered bounds')
      .describe('WGS84 [west, south, east, north], at most 2000 m a side; the frame is north up.'),
  }),
]);

const clear = z.strictObject({
  buildings: z
    .union([z.boolean(), z.literal('clip')])
    .describe(
      'Mapped footprints at least half inside the rectangle (default true); "clip" trims every footprint at its edge instead.',
    )
    .optional(),
  landmarks: z
    .boolean()
    .describe('Catalogued landmark models anchored in the rectangle; default true.')
    .optional(),
  vegetation: z
    .boolean()
    .describe('Land cover, scattered plants and mapped trees; default true.')
    .optional(),
  props: z.boolean().describe('Mapped street furniture; default true.').optional(),
  parking: z
    .boolean()
    .describe('Parking lots, their aisles and driveways, and the cars on them; default true.')
    .optional(),
  roads: z
    .boolean()
    .describe(
      'Roads and paths whose center line is in the rectangle; default false. Bridges, tunnels, railways and runways stay, and the ground keeps its grading.',
    )
    .optional(),
});

const building = z.strictObject({
  id,
  outline: z
    .array(point)
    .min(3)
    .max(MAP_OVERRIDE_LIMITS.outlinePoints)
    .describe('Footprint ring that does not cross itself. Give this or rect.')
    .optional(),
  rect: z
    .strictObject({
      center: point.optional(),
      size: z
        .tuple([
          finite.min(1).max(MAP_OVERRIDE_LIMITS.buildingSide),
          finite.min(1).max(MAP_OVERRIDE_LIMITS.buildingSide),
        ])
        .describe('[width, depth] in meters.'),
      heading: heading.optional(),
    })
    .describe('A rectangular footprint instead of outline.')
    .optional(),
  height: finite.gt(0).max(1000).describe('Meters above its base.').optional(),
  levels: z.int().min(1).max(200).describe('Floors; default 1 when there is no height.').optional(),
  minHeight: finite.min(0).max(500).describe('Meters its base stands above the ground.').optional(),
  use: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .describe(
      'What it is, as map data names buildings (warehouse, school, house); picks a default look.',
    )
    .optional(),
  style: z
    .string()
    .regex(/^[a-z][a-z0-9_.-]*$/)
    .describe(
      'An architecture style id of the style pack; ignored when the pack has none by that id.',
    )
    .optional(),
  wall: color.optional(),
  trim: color.optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

const model = z.strictObject({
  id,
  asset: ref.describe('A structure asset id of the style pack, or a ref the host view loads.'),
  position: point,
  heading: heading.optional(),
  scale: scale.optional(),
  elevation: finite.min(-100).max(1000).describe('Meters above the ground at position.').optional(),
  minLevel: level.describe('Coarsest tile level it is drawn at.').optional(),
});

const prop = z.union([
  z.strictObject({
    id,
    position: point,
    heading: heading.optional(),
    kind: z.enum(['tree', 'street_lamp', 'bench', 'bike_rack', 'charger']),
    height: finite.gt(0).max(80).describe('Meters; trees and street lamps.').optional(),
    crownDiameter: finite.gt(0).max(40).describe('Meters; trees.').optional(),
    leafType: z.enum(['broadleaved', 'needleleaved']).optional(),
    species: z.string().trim().min(1).optional(),
  }),
  z.strictObject({
    id,
    position: point,
    heading: heading.optional(),
    model: ref.describe(
      'A prop model ref: a builtin: model, a regional plant, or a ref the view loads.',
    ),
    scale: scale.optional(),
    color: color.optional(),
  }),
]);

const override = z
  .strictObject({
    id: id.describe('Stable id; names the features the override generates.'),
    area,
    clear: clear.optional(),
    surface: z
      .enum(['ground', 'grass', 'paved', 'plaza', 'gravel', 'bare', 'sand'])
      .describe('Ground of the cleared rectangle; default ground.')
      .optional(),
    buildings: z.array(building).max(MAP_OVERRIDE_LIMITS.buildings).optional(),
    models: z.array(model).max(MAP_OVERRIDE_LIMITS.models).optional(),
    props: z.array(prop).max(MAP_OVERRIDE_LIMITS.props).optional(),
    minLevel: level
      .describe(
        'Coarsest tile level the map is edited at; default 11. Landmarks hide at every level.',
      )
      .optional(),
    actors: bundle.optional(),
    vehicles: bundle.optional(),
  })
  .superRefine((value, context) => {
    // The one validator a view runs when an override is set: whatever it rejects, this does.
    try {
      resolveMapOverride(value as unknown as MapOverride);
    } catch (error) {
      context.addIssue({ code: 'custom', message: (error as Error).message });
    }
  });

const MAP_OVERRIDES_EXAMPLE = {
  format: 'molen/map-overrides@1',
  title: 'A warehouse where a landmark stood',
  overrides: [
    {
      id: 'sample-warehouse',
      area: { center: [-122.3493, 47.62051], size: [80, 60] },
      surface: 'paved',
      buildings: [
        { id: 'shed', rect: { size: [48, 30] }, height: 9, use: 'warehouse', wall: '#b9b4a8' },
      ],
      props: [{ id: 'lamp', kind: 'street_lamp', position: [28, 18] }],
    },
  ],
} satisfies MapOverridesDoc;

/** Register the `molen/map-overrides@1` document with the schema registry (idempotent). */
export function registerMapOverridesSchema(): void {
  if (getSchema('map-overrides') !== undefined) return;
  registerSchema(
    'map-overrides',
    z
      .strictObject({
        format: z.literal('molen/map-overrides@1'),
        title: z.string().min(1).optional(),
        overrides: z.array(override).max(256),
      })
      .superRefine((doc, context) => {
        const ids = new Set<string>();
        doc.overrides.forEach((entry, index) => {
          if (ids.has(entry.id))
            context.addIssue({
              code: 'custom',
              path: ['overrides', index, 'id'],
              message: `duplicate override ${entry.id}`,
            });
          ids.add(entry.id);
        });
      }),
    {
      id: 'molen/map-overrides@1',
      title: 'Map overrides',
      description:
        'Rectangles of the mapped world to clear, with the buildings, models and props a host places there instead.',
      docsRef: 'guide/earth-view.md',
      examples: [MAP_OVERRIDES_EXAMPLE],
    },
  );
}
