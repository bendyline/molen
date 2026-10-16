/** Compact country limits for supported mammals. These are range priors, never observations. */
import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { projectWgs84 } from './projection';

export interface WildlifeRangesDoc {
  format: 'molen/wildlife-ranges@1';
  id: string;
  version: number;
  title: string;
  cellDegrees: number;
  countries: Array<{ code: string; name: string }>;
  /** North-to-south rows of [run length, country index + 1] pairs; 0 is uncovered. */
  rows: number[][];
  taxa: Array<{ id: string; sourceId: string; name: string; countries: string[] }>;
  sources: Array<{
    title: string;
    url: string;
    license: string;
    sha256: string;
    interpretation: string;
  }>;
}

export const wildlifeRangesSchema: z.ZodType<WildlifeRangesDoc> = z.strictObject({
  format: z.literal('molen/wildlife-ranges@1'),
  id: z.string().min(1),
  version: z.int().positive(),
  title: z.string().min(1),
  cellDegrees: z.number().min(0.05).max(10),
  countries: z
    .array(z.strictObject({ code: z.string().min(2).max(3), name: z.string().min(1) }))
    .max(65534),
  rows: z.array(z.array(z.int().nonnegative())),
  taxa: z.array(
    z.strictObject({
      id: z.string().min(1),
      sourceId: z.string().min(1),
      name: z.string().min(1),
      countries: z.array(z.string().min(2).max(3)),
    }),
  ),
  sources: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        url: z.string().url(),
        license: z.string().min(1),
        sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
        interpretation: z.string().min(1),
      }),
    )
    .min(1),
});

export interface WildlifeRangeResolver {
  countryAt(longitude: number, latitude: number): string | undefined;
  country(x: number, z: number): string | undefined;
  includes(taxon: string, x: number, z: number): boolean;
}

export function createWildlifeRangeResolver(
  doc: WildlifeRangesDoc,
  metersPerUnit = 1,
): WildlifeRangeResolver {
  wildlifeRangesSchema.parse(doc);
  const width = 360 / doc.cellDegrees,
    height = 180 / doc.cellDegrees;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    doc.rows.length !== height ||
    !Number.isFinite(metersPerUnit) ||
    metersPerUnit <= 0
  )
    throw new Error('Invalid wildlife range grid dimensions');
  const codes = new Set(doc.countries.map((country) => country.code));
  if (codes.size !== doc.countries.length) throw new Error('Duplicate wildlife range country');
  const taxa = new Map<string, Set<string>>();
  for (const taxon of doc.taxa) {
    if (taxa.has(taxon.id) || taxon.countries.some((code) => !codes.has(code)))
      throw new Error(`Invalid wildlife range taxon: ${taxon.id}`);
    taxa.set(taxon.id, new Set(taxon.countries));
  }
  const endpoints = doc.rows.map((row) => {
    if (row.length === 0 || row.length % 2 !== 0)
      throw new Error('Invalid wildlife range row pairs');
    const ends = new Uint16Array(row.length / 2);
    let total = 0;
    for (let i = 0; i < row.length; i += 2) {
      const count = row[i] as number,
        index = row[i + 1] as number;
      if (count < 1 || index > doc.countries.length) throw new Error('Invalid wildlife range run');
      total += count;
      ends[i / 2] = total;
    }
    if (total !== width) throw new Error('Wildlife range row does not cover the globe');
    return ends;
  });
  const northings = Array.from(
    { length: height + 1 },
    (_, row) => projectWgs84(0, 90 - row * doc.cellDegrees)[1] * metersPerUnit,
  );
  const half = projectWgs84(180, 0)[0] * metersPerUnit;
  const columnAt = (longitude: number): number =>
    Math.min(width - 1, Math.floor(((((longitude + 180) % 360) + 360) % 360) / doc.cellDegrees));
  const lookup = (column: number, row: number): string | undefined => {
    const ends = endpoints[row];
    if (ends === undefined) return undefined;
    let low = 0,
      high = ends.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((ends[mid] as number) <= column) low = mid + 1;
      else high = mid;
    }
    return doc.countries[((doc.rows[row] as number[])[low * 2 + 1] as number) - 1]?.code;
  };
  const country = (x: number, z: number): string | undefined => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      z < (northings[0] as number) ||
      z > (northings[height] as number)
    )
      return undefined;
    let low = 0,
      high = height;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((northings[mid + 1] as number) <= z) low = mid + 1;
      else high = mid;
    }
    return lookup(columnAt((x / half) * 180), Math.min(height - 1, low));
  };
  return {
    country,
    countryAt(longitude, latitude) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 90)
        return undefined;
      return lookup(
        columnAt(longitude),
        Math.min(height - 1, Math.floor((90 - latitude) / doc.cellDegrees)),
      );
    },
    includes: (taxon, x, z) => {
      const code = country(x, z);
      return code !== undefined && (taxa.get(taxon)?.has(code) ?? false);
    },
  };
}

export function registerWildlifeRangesSchema(): void {
  if (getSchema('wildlife-ranges') !== undefined) return;
  registerSchema('wildlife-ranges', wildlifeRangesSchema, {
    id: 'molen/wildlife-ranges@1',
    title: 'Wildlife country range limits',
    docsRef: 'guide/regional-world.md',
    description:
      'Attributed coarse country membership for supported taxa. Combine with ecology and mapped habitat; not occurrence data.',
    examples: [
      {
        format: 'molen/wildlife-ranges@1',
        id: 'example.ranges',
        version: 1,
        title: 'Range example',
        cellDegrees: 10,
        countries: [],
        rows: Array.from({ length: 18 }, () => [36, 0]),
        taxa: [],
        sources: [
          {
            title: 'Example source',
            url: 'https://example.com',
            license: 'CC0-1.0',
            sha256: `sha256:${'0'.repeat(64)}`,
            interpretation: 'Example only.',
          },
        ],
      } as JsonValue,
    ],
  });
}
