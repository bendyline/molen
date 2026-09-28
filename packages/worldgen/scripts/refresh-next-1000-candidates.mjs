/** Refresh the next 1,000 named structure candidates from Wikidata's CC0 data.
 * This is a planning catalog, not a set of build-ready placement records.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const output = resolve(root, 'content/worldgen/source/next-1000/candidates.json');
const input = resolve(root, 'content/worldgen/source/next-1000/wikidata-snapshot.json');
const plan = await readFile(
  resolve(root, 'examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md'),
  'utf8',
);
const existingNames = [...plan.matchAll(/^\| [A-E]\d{2} \| ([^|]+) \|/gm)].map((m) => m[1]);

const groups = [
  ['bridge', 'Q12280', 135],
  ['skyscraper', 'Q11303', 100],
  ['castle', 'Q23413', 90],
  ['cathedral', 'Q2977', 85],
  ['mosque', 'Q32815', 75],
  ['temple', 'Q44539', 75],
  ['tower', 'Q12518', 75],
  ['lighthouse', 'Q39715', 45],
  ['stadium', 'Q483110', 55],
  ['museum', 'Q33506', 55],
  ['railway_station', 'Q55488', 50],
  ['dam', 'Q12323', 50],
  ['palace', 'Q16560', 55],
  ['monument', 'Q4989906', 55],
];

const canonical = (name) =>
  name
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
const existing = new Set(
  existingNames.flatMap((name) => {
    const base = name.split(',')[0];
    return [canonical(name), canonical(base)];
  }),
);
// High-visibility results that are routes, natural sites, institutions rather than a
// particular structure, demolished landmarks, or memorial sites that should not be
// auto-promoted into a stylized model queue. More editorial review is still required.
const excludedTitles = new Set(
  [
    'Auschwitz',
    'Bastille',
    'Buchenwald concentration camp',
    'Cave of Altamira',
    'Dubai Creek Tower',
    'Heliopolis',
    'Herculaneum',
    'Hollywood Walk of Fame',
    'Koutammakou',
    'Las Médulas',
    'Lighthouse of Alexandria',
    'Mausoleum at Halicarnassus',
    'Smithsonian Institution',
    'Temple in Jerusalem',
    'Temple Mount',
    'The Crystal Palace',
    'The Temple Institute',
    'Tuileries Palace',
    'Warsaw radio mast',
    'Way of Saint James',
  ].map(canonical),
);
const seen = new Set();
const candidates = [];
const snapshot = JSON.parse(await readFile(input, 'utf8'));
const previous = await readFile(output, 'utf8')
  .then(JSON.parse)
  .catch(() => undefined);
const previousByQid = new Map(
  previous?.candidates?.map((entry) => [entry.wikidataId, entry]) ?? [],
);
let nextId = Math.max(
  0,
  ...(previous?.candidates?.map((entry) => Number(entry.id.slice(1))) ?? []),
);

for (const [category, classId, quota] of groups) {
  const result = snapshot.groups[category];
  if (result?.classId !== classId || !Array.isArray(result.rows))
    throw new Error(`${category}: missing snapshot rows for ${classId}`);
  let added = 0;
  for (const row of result.rows) {
    const wikidataId = row.id;
    const title = row.title;
    const point = /^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(row.coord ?? '');
    if (!/^Q\d+$/.test(wikidataId) || !title || /^Q\d+$/.test(title) || !point) continue;
    if (
      seen.has(wikidataId) ||
      existing.has(canonical(title)) ||
      excludedTitles.has(canonical(title))
    )
      continue;
    const longitude = Number(point[1]);
    const latitude = Number(point[2]);
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    seen.add(wikidataId);
    const retained = previousByQid.get(wikidataId);
    candidates.push({
      id: retained?.id ?? `N${String(++nextId).padStart(4, '0')}`,
      title,
      category,
      wikidataId,
      source: `https://www.wikidata.org/wiki/${wikidataId}`,
      referenceCoordinate: { latitude, longitude },
      sitelinks: Number(row.links),
      status: retained?.status ?? 'candidate',
      modelRef: retained?.modelRef ?? null,
      placementVerified: retained?.placementVerified ?? false,
    });
    added++;
    if (added === quota) break;
  }
  if (added !== quota) throw new Error(`${category}: ${added}/${quota} after de-duplication`);
  console.log(`${category}: ${added} candidates`);
}

if (candidates.length !== 1000) throw new Error(`Expected 1000, got ${candidates.length}`);
const catalog = {
  format: 'molen/model-candidate-catalog@1',
  generatedAt: new Date().toISOString().slice(0, 10),
  source:
    'Wikidata CC0 via SPARQL; candidate selection by instance class, coordinates and sitelinks',
  sourceLicense: 'CC0-1.0',
  existingPlanNameCount: existingNames.length,
  prescreenedNameCount: excludedTitles.size,
  warning:
    'Coordinates are source reference points, not surveyed model anchors. Titles, feature identity, geometry, and rights require review before placement.',
  quotas: Object.fromEntries(groups.map(([category, , quota]) => [category, quota])),
  candidates,
};
await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${output}`);
