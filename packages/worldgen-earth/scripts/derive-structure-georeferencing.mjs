/** Reproducible geographic evidence, separate from the reviewed runtime placement catalog. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';
import {
  closedLine,
  featureIsObsolete,
  featureLines,
  fitMapFrame,
  lengthMeters,
  metricFrame,
} from './structure-map-geometry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const catalog = await readJson('content/worldgen/source/next-1000/candidates.json');
const details = await readJson('content/earth/structures/evidence/wikidata-details.json');
const osm = await readJson('content/earth/structures/evidence/osm-features.json');
const review = await readJson('content/earth/structures/identity-review.json').catch(() => ({
  reviews: [],
}));
const reviewed = new Map(review.reviews.map((entry) => [entry.original.wikidataId, entry]));
const byIdentity = new Map();
for (const feature of osm.elements)
  for (const id of (feature.tags?.wikidata ?? '').split(';')) {
    const bucket = byIdentity.get(id) ?? [];
    bucket.push(feature);
    byIdentity.set(id, bucket);
  }
const slug = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const rounded = (value, precision = 5) => Math.round(value * 10 ** precision) / 10 ** precision;
const quantity = (entity, property) => {
  const statements = (entity?.claims?.[property] ?? []).filter(
    (claim) => claim.rank !== 'deprecated',
  );
  const ranked = statements.some((claim) => claim.rank === 'preferred')
    ? statements.filter((claim) => claim.rank === 'preferred')
    : statements;
  return ranked.flatMap((claim) => {
    const value = claim.mainsnak?.datavalue?.value;
    const conversion = { Q11573: 1, Q828224: 1000, Q3710: 0.3048, Q174728: 0.01 }[
      value?.unit?.split('/').at(-1)
    ];
    const meters = Number(value?.amount) * conversion;
    return Number.isFinite(meters) && meters > 0
      ? [
          {
            meters,
            statement: claim.id,
            qualifiers: claim.qualifiers ?? {},
            referenceUrls: (claim.references ?? []).flatMap(
              (ref) => ref.snaks?.P854?.map((snak) => snak.datavalue?.value) ?? [],
            ),
          },
        ]
      : [];
  });
};
function rate(feature, category) {
  const tags = feature.tags ?? {};
  const polygon = featureLines(feature).some((line) => closedLine(line.coordinates));
  if (featureIsObsolete(feature)) return -1;
  if (category === 'bridge')
    return tags.man_made === 'bridge' && polygon
      ? 100
      : tags.bridge && (tags.highway || tags.railway)
        ? 80
        : -1;
  if (category === 'dam') return tags.waterway === 'dam' || tags.man_made === 'dam' ? 100 : -1;
  return polygon && tags.building && tags.building !== 'no'
    ? 100
    : polygon && tags['building:part']
      ? 80
      : polygon && (tags.man_made || tags.historic || tags.leisure === 'stadium')
        ? 60
        : -1;
}
const records = catalog.candidates.map((candidate) => {
  const entity = details.entities[candidate.wikidataId];
  const reference = [
    candidate.referenceCoordinate.longitude,
    candidate.referenceCoordinate.latitude,
  ];
  const features = (byIdentity.get(candidate.wikidataId) ?? []).filter(
    (feature) => rate(feature, candidate.category) > 0,
  );
  const ranked = features
    .map((feature) => ({
      feature,
      score: rate(feature, candidate.category),
      frame: fitMapFrame(
        featureLines(feature).flatMap((line) => line.coordinates),
        reference,
      ),
    }))
    .filter((item) => item.frame)
    .sort((a, b) => b.score - a.score || b.frame.area - a.frame.area);
  const selected = ranked[0];
  const rejection = reviewed.get(candidate.wikidataId);
  const record = {
    candidateId: candidate.id,
    wikidataId: candidate.wikidataId,
    title: candidate.title,
    asset:
      candidate.modelRef ??
      `molen.worldgen.structure.${candidate.id.toLowerCase()}_${slug(candidate.title)}`,
    category: candidate.category,
    description: entity?.description,
    referenceAnchor: reference,
    identitySource: candidate.source,
    disposition: rejection ? 'identity-rejected' : 'reference-only',
    orientationStatus: 'unresolved',
    reviewRequired: true,
    facts: {
      height: quantity(entity, 'P2048'),
      width: quantity(entity, 'P2049'),
      length: quantity(entity, 'P2043'),
      instanceOf: (entity?.claims?.P31 ?? [])
        .map((claim) => claim.mainsnak?.datavalue?.value?.id)
        .filter(Boolean),
      architecturalStyles: (entity?.claims?.P149 ?? [])
        .map((claim) => claim.mainsnak?.datavalue?.value?.id)
        .filter(Boolean),
    },
    ...(rejection
      ? { reason: rejection.reason }
      : {
          reason:
            'No unique physical footprint or centerline with exact Wikidata identity has been resolved.',
        }),
  };
  if (!selected || rejection) return record;
  const frame = selected.frame;
  const delta = metricFrame(reference).project(frame.anchor);
  if (Math.hypot(...delta) > Math.max(2000, frame.length) || frame.length > 15000)
    return {
      ...record,
      disposition: 'extent-review',
      reason:
        'Matched geometry is too distant or extensive for automatic single-model registration.',
    };
  const lines = featureLines(selected.feature);
  const outer = lines.filter((line) => line.role !== 'inner');
  const closed = outer.filter((line) => closedLine(line.coordinates));
  const tags = selected.feature.tags ?? {};
  const shape = (line) =>
    line.coordinates.map((point) => frame.toLocal(point).map((value) => rounded(value, 3)));
  return {
    ...record,
    disposition: 'map-axis',
    orientationStatus: 'axis-only',
    reason:
      'Exact mapped identity supplies footprint/centerline and an undirected plan axis. Facade facing, model origin, height datum and visual fit still require review.',
    anchor: frame.anchor.map((value) => rounded(value, 9)),
    heading: rounded(frame.heading, 12),
    plan: { length: rounded(frame.length, 3), width: rounded(frame.width, 3) },
    featureIds: [`${selected.feature.type}/${selected.feature.id}`],
    featureSources: [
      `https://www.openstreetmap.org/${selected.feature.type}/${selected.feature.id}`,
    ],
    mappedTags: tags,
    geometry: {
      axisMethod: 'minimum-area rectangle; +X longest axis; direction ambiguous by 180 degrees',
      outline: closed[0] ? shape(closed[0]) : null,
      outlines: closed.map(shape),
      holes: lines
        .filter((line) => line.role === 'inner' && closedLine(line.coordinates))
        .map(shape),
      centerlines: closed.length ? [] : outer.map(shape),
      height: lengthMeters(tags.height),
      minHeight: lengthMeters(tags.min_height),
    },
    geometryLicense: 'ODbL-1.0',
    geometryAttribution: '© OpenStreetMap contributors',
  };
});
const counts = Object.fromEntries(
  [...new Set(records.map((record) => record.disposition))].map((state) => [
    state,
    records.filter((record) => record.disposition === state).length,
  ]),
);
const output = {
  format: 'molen/structure-georeferencing@1',
  sourceSnapshot: {
    wikidata: details.capturedAt,
    openstreetmap: osm.capturedAt,
    candidatesHash: createHash('sha256')
      .update(JSON.stringify(catalog.candidates.map(({ id, wikidataId }) => ({ id, wikidataId }))))
      .digest('hex'),
  },
  warning:
    'Map-axis evidence is not surveyed facade direction. This authoring evidence is not automatically promoted into placements.json.',
  counts,
  candidates: records,
};
await writeFile(
  resolve(root, 'content/earth/structures/georeferencing.json'),
  `${formatJson(JSON.parse(JSON.stringify(output)))}\n`,
);
console.log(JSON.stringify(counts));
