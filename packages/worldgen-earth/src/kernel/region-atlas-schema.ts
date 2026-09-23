import {
  getSchema,
  type JsonValue,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import {
  DOTTED_ID_RE,
  styleRuleSchema,
  unreachableRuleIssues,
  whenIssues,
} from '@bendyline/molen-worldgen/kernel';
import { z } from 'zod';
import type { AtlasRegion, RegionAtlasDoc } from './region-atlas-types';

const dottedId = z.string().regex(DOTTED_ID_RE, 'must be a namespaced dotted id');
const lonLat = z
  .array(z.number().finite())
  .length(2)
  .describe('[longitude, latitude] in degrees (WGS84).');

const region = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_.-]*$/, 'must be a lowercase region id')
    .describe("Region id, e.g. 'us.pnw'."),
  title: z.string().optional(),
  priority: z
    .int()
    .min(-1000)
    .max(1000)
    .describe('Higher priority wins where regions overlap.')
    .default(0),
  bbox: z
    .array(z.number().finite())
    .length(4)
    .describe(
      '[minLon, minLat, maxLon, maxLat] in degrees; the sole geometry when polygons are absent.',
    )
    .optional(),
  polygons: z
    .array(z.array(lonLat).min(3))
    .describe('WGS84 outer rings (union). No holes; must not cross the antimeridian.')
    .optional(),
  bindings: z.strictObject({
    buildings: z
      .array(styleRuleSchema)
      .describe('Ordered style rules for buildings inside the region; first match wins.')
      .default([]),
    default: dottedId
      .describe('Archstyle when no region rule matches (before pack rules).')
      .optional(),
    scatter: dottedId.describe('Scatter rule set for the region.').optional(),
    treeFillFactor: z
      .number()
      .min(0)
      .max(1)
      .describe('Synthetic tree fill around homes, 0..1; 0 disables it. Inherits atlas default.')
      .optional(),
  }),
});

const regionAtlasSchema = z.strictObject({
  format: z
    .literal('molen/region-atlas@1')
    .describe("Format envelope; always 'molen/region-atlas@1'."),
  id: dottedId.describe("Atlas id, e.g. 'molen.worldgen.atlas.world'."),
  title: z.string().min(1),
  doc: z.string().optional(),
  version: z.int().min(1).describe('Bump when bindings change on purpose.').default(1),
  regions: z
    .array(region)
    .describe('Regions in document order (ties resolve to the first).')
    .default([]),
  default: z.strictObject({
    buildings: z.array(styleRuleSchema).describe('Worldwide style rules.').default([]),
    style: dottedId
      .describe('Worldwide archstyle when no rule matches (else the pack default).')
      .optional(),
    scatter: dottedId.describe('Worldwide scatter rule set (else the pack default).').optional(),
    treeFillFactor: z
      .number()
      .min(0)
      .max(1)
      .describe(
        'Synthetic tree fill around homes, 0..1. Omitted disables infill outside configured regions.',
      )
      .optional(),
  }),
});

function bboxIssues(bbox: readonly number[], path: string, issues: ValidationIssue[]): void {
  const [minLon, minLat, maxLon, maxLat] = bbox as [number, number, number, number];
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
    issues.push({
      path,
      code: 'lonlat_range',
      message: 'bbox must stay within longitude ±180 and latitude ±90',
    });
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    issues.push({
      path,
      code: 'bbox_order',
      message: 'bbox must be [minLon, minLat, maxLon, maxLat] with positive extent',
    });
  }
}

function boxesOverlap(a: readonly number[], b: readonly number[]): boolean {
  return (
    (a[0] as number) < (b[2] as number) &&
    (b[0] as number) < (a[2] as number) &&
    (a[1] as number) < (b[3] as number) &&
    (b[1] as number) < (a[3] as number)
  );
}

function regionExtent(entry: AtlasRegion): [number, number, number, number] | undefined {
  if (entry.bbox !== undefined) return entry.bbox;
  if (entry.polygons === undefined) return undefined;
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const ring of entry.polygons) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function validateRegionAtlas(data: unknown): ValidationIssue[] {
  const doc = data as RegionAtlasDoc;
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  doc.regions.forEach((entry, index) => {
    const path = `/regions/${index}`;
    if (ids.has(entry.id)) {
      issues.push({
        path: `${path}/id`,
        code: 'duplicate_region_id',
        message: `duplicate region id "${entry.id}"`,
      });
    }
    ids.add(entry.id);
    if (entry.bbox === undefined && entry.polygons === undefined) {
      issues.push({
        path,
        code: 'region_geometry_missing',
        message: 'a region needs a bbox or polygons',
      });
    }
    if (entry.bbox !== undefined) bboxIssues(entry.bbox, `${path}/bbox`, issues);
    entry.polygons?.forEach((ring, ringIndex) => {
      let minLon = Number.POSITIVE_INFINITY;
      let maxLon = Number.NEGATIVE_INFINITY;
      ring.forEach(([lon, lat], pointIndex) => {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          issues.push({
            path: `${path}/polygons/${ringIndex}/${pointIndex}`,
            code: 'lonlat_range',
            message: 'coordinates must stay within longitude ±180 and latitude ±90',
          });
        }
        if (
          entry.bbox !== undefined &&
          (lon < entry.bbox[0] || lon > entry.bbox[2] || lat < entry.bbox[1] || lat > entry.bbox[3])
        ) {
          issues.push({
            path: `${path}/polygons/${ringIndex}/${pointIndex}`,
            code: 'polygon_outside_bbox',
            message: 'polygon vertex lies outside the region bbox',
          });
        }
      });
      if (maxLon - minLon > 180) {
        issues.push({
          path: `${path}/polygons/${ringIndex}`,
          code: 'polygon_antimeridian',
          message: 'ring spans more than 180° of longitude; antimeridian crossings are unsupported',
          severity: 'notice',
        });
      }
    });
    entry.bindings.buildings.forEach((rule, ruleIndex) => {
      issues.push(
        ...whenIssues(rule.when, `${path}/bindings/buildings/${ruleIndex}/when`, {
          wingsSupported: false,
        }),
      );
    });
    issues.push(...unreachableRuleIssues(entry.bindings.buildings, `${path}/bindings/buildings`));
  });
  for (let a = 0; a < doc.regions.length; a++) {
    for (let b = a + 1; b < doc.regions.length; b++) {
      const first = doc.regions[a] as AtlasRegion;
      const second = doc.regions[b] as AtlasRegion;
      if (first.priority !== second.priority) continue;
      const extentA = regionExtent(first);
      const extentB = regionExtent(second);
      if (extentA !== undefined && extentB !== undefined && boxesOverlap(extentA, extentB)) {
        issues.push({
          path: `/regions/${b}/priority`,
          code: 'region_overlap_same_priority',
          message: `regions "${first.id}" and "${second.id}" overlap with equal priority; resolution is document order`,
          hint: 'give one region a higher priority',
          severity: 'notice',
        });
      }
    }
  }
  doc.default.buildings.forEach((rule, index) => {
    issues.push(
      ...whenIssues(rule.when, `/default/buildings/${index}/when`, { wingsSupported: false }),
    );
  });
  issues.push(...unreachableRuleIssues(doc.default.buildings, '/default/buildings'));
  return issues;
}

export const REGION_ATLAS_EXAMPLE: JsonValue = {
  format: 'molen/region-atlas@1',
  id: 'molen.worldgen.atlas.world',
  title: 'World style atlas',
  version: 1,
  regions: [
    {
      id: 'us.pnw',
      title: 'Pacific Northwest',
      priority: 10,
      bbox: [-125.5, 41.9, -116.4, 51.6],
      bindings: {
        buildings: [
          {
            when: {
              class: ['house', 'detached', 'semidetached', 'residential', 'bungalow', 'cabin'],
            },
            style: 'molen.worldgen.pnw.house',
          },
          {
            when: {
              class: ['yes', 'building'],
              contextClass: ['residential', 'none'],
              areaMax: 400,
            },
            style: 'molen.worldgen.pnw.house',
          },
        ],
        scatter: 'molen.worldgen.scatter.pnw',
      },
    },
    {
      id: 'jp',
      title: 'Japan',
      priority: 10,
      bbox: [122.9, 24, 146.2, 45.8],
      polygons: [
        [
          [129, 30.9],
          [131.6, 30.6],
          [142.4, 34.4],
          [146.2, 43.4],
          [141.2, 45.8],
          [139.4, 41.4],
          [136, 38.2],
          [130.8, 35.2],
          [129, 32.4],
        ],
      ],
      bindings: {
        buildings: [
          {
            when: { class: ['house', 'detached', 'residential'], areaMax: 250 },
            style: 'molen.worldgen.japan.house',
          },
        ],
        scatter: 'molen.worldgen.scatter.japan',
      },
    },
  ],
  default: {
    buildings: [
      {
        when: { class: ['mall', 'supermarket', 'warehouse'], areaMin: 1500 },
        style: 'molen.worldgen.generic.mall',
      },
    ],
    scatter: 'molen.worldgen.scatter.global',
  },
};

export function registerRegionAtlasSchema(): void {
  if (getSchema('region-atlas') !== undefined) return;
  registerSchema('region-atlas', regionAtlasSchema, {
    id: 'molen/region-atlas@1',
    title: 'Region style atlas',
    description:
      'Binds archstyles and scatter rule sets to places on Earth: prioritized lon/lat regions with ordered style rules, plus a worldwide default chain evaluated before the pack defaults.',
    examples: [REGION_ATLAS_EXAMPLE],
    docsRef: 'guide/worldgen.md',
    validate: validateRegionAtlas,
  });
}
