import { getSchema, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';

const finite = z.number().finite();
const placement = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
    title: z.string().min(1),
    asset: z.string().regex(/^[a-z][a-z0-9_.-]*$/),
    anchor: z.tuple([finite.min(-180).max(180), finite.min(-90).max(90)]),
    heading: finite.optional(),
    scale: z.tuple([finite.positive(), finite.positive(), finite.positive()]).optional(),
    datum: z.enum(['terrain', 'sea-level']).optional(),
    elevation: finite.optional(),
    bounds: z
      .tuple([
        finite.min(-180).max(180),
        finite.min(-90).max(90),
        finite.min(-180).max(180),
        finite.min(-90).max(90),
      ])
      .refine((b) => b[0] < b[2] && b[1] < b[3], 'extent must be ordered west/south/east/north')
      .optional(),
    replaceRoads: z
      .strictObject({
        length: finite.positive(),
        width: finite.positive(),
        deckHeight: finite.optional(),
      })
      .optional(),
    replaceFootprint: z.boolean().optional(),
    mapIdentity: z
      .strictObject({
        wikidata: z
          .string()
          .regex(/^Q[1-9][0-9]*$/)
          .optional(),
        names: z.array(z.string().min(1)).min(1).optional(),
        maxDistance: finite.positive().max(10000).optional(),
      })
      .refine(
        (identity) => !!identity.wikidata || !!identity.names?.length,
        'map identity needs an id or exact names',
      )
      .optional(),
    orientation: z.enum(['fixed', 'mapped']).optional(),
    lengthAxis: z.enum(['x', 'z']).optional(),
    minLevel: z.int().min(0).max(26).optional(),
    status: z.enum(['preview', 'draft']),
    source: z.string().url(),
    note: z.string().optional(),
  })
  .refine(
    (entry) => !entry.bounds || entry.datum === 'sea-level',
    'extended structures require an absolute sea-level datum',
  )
  .refine(
    (entry) => !entry.replaceRoads || !!entry.bounds,
    'road replacement requires an indexed extent',
  )
  .refine(
    (entry) => entry.orientation !== 'mapped' || !!entry.mapIdentity,
    'mapped orientation requires a confirmed source identity',
  );

const mapRule = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
  title: z.string().min(1),
  asset: z.string().regex(/^[a-z][a-z0-9_.-]*$/),
  match: z
    .strictObject({
      classes: z.array(z.string().min(1)).min(1).optional(),
      subclasses: z.array(z.string().min(1)).min(1).optional(),
      tags: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)).optional(),
    })
    .refine(
      (match) =>
        !!match.classes?.length ||
        !!match.subclasses?.length ||
        !!Object.keys(match.tags ?? {}).length,
      'map rule needs a classification',
    ),
  dimensions: z.tuple([finite.positive(), finite.positive(), finite.positive()]),
  orientation: z.enum(['direction', 'longest-edge', 'north']).optional(),
  lengthAxis: z.enum(['x', 'z']).optional(),
  fit: z.enum(['native', 'footprint']).optional(),
  replaceFootprint: z.boolean().optional(),
  minLevel: z.int().min(0).max(26).optional(),
  maxPerTile: z.int().min(1).max(64).optional(),
  source: z.string().url(),
});

const catalog = z
  .strictObject({
    format: z.literal('molen/structure-placements@1'),
    title: z.string().min(1),
    entries: z.array(placement),
    rules: z.array(mapRule).optional(),
  })
  .superRefine((doc, context) => {
    const ids = new Set<string>();
    doc.entries.forEach((entry, index) => {
      if (ids.has(entry.id))
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'id'],
          message: `duplicate placement ${entry.id}`,
        });
      ids.add(entry.id);
    });
    doc.rules?.forEach((rule, index) => {
      if (ids.has(rule.id))
        context.addIssue({
          code: 'custom',
          path: ['rules', index, 'id'],
          message: `duplicate rule ${rule.id}`,
        });
      ids.add(rule.id);
    });
  });

export function registerStructurePlacementsSchema(): void {
  if (getSchema('structure-placements') !== undefined) return;
  registerSchema('structure-placements', catalog, {
    id: 'molen/structure-placements@1',
    title: 'Geographic structure placements',
    description: 'WGS84 anchors for authored models; draft entries are indexed but not rendered.',
    docsRef: 'guide/earth-view.md',
    examples: [
      {
        format: 'molen/structure-placements@1',
        title: 'Example structures',
        entries: [
          {
            id: 'sample.tower',
            title: 'Sample tower',
            asset: 'sample.structure.tower',
            anchor: [-122.3493, 47.62051],
            status: 'draft',
            source: 'https://example.com/tower',
          },
        ],
      },
    ],
  });
}
