/** Keep rejected source identities in an audit trail; this script never mutates candidates. */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const catalog = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json'), 'utf8'),
);
const snapshot = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/wikidata-snapshot.json'), 'utf8'),
);
const details = JSON.parse(
  await readFile(resolve(root, 'content/earth/structures/evidence/wikidata-details.json'), 'utf8'),
);
// Explicit decisions: historical demolition statements by themselves are not a rejection
// because many functioning churches have destroyed predecessors on the same Wikidata item.
const decisions = [
  [
    'N0044',
    'historical',
    'The 2025 destruction statement means this original bridge cannot be presented as an intact present-day crossing.',
    'Q4797664',
  ],
  [
    'N0208',
    'collection',
    'Seven geographically separate skyscrapers cannot share one model anchor.',
    'Q875078',
  ],
  [
    'N0210',
    'historical',
    'Demolished in 1968; a historical reconstruction must not occupy the current building site.',
    'Q953610',
  ],
  [
    'N0216',
    'unbuilt',
    'The structured source identifies an unfinished tower; published full-tower dimensions are design values.',
    'Q1330847',
  ],
  [
    'N0594',
    'category',
    'A regional tower type requires a category rule rather than a fabricated unique landmark anchor.',
    'Q643592',
  ],
  [
    'N0607',
    'historical',
    'Demolished in 1934; present-day placement of an intact tower would be false.',
    'Q718126',
  ],
  [
    'N0618',
    'historical',
    'The Frankish Tower on the Acropolis was demolished; no intact contemporary tower should be drawn.',
    'Q1345155',
  ],
  ['N0629', 'historical', 'The former Stockholm telephone tower was removed in 1953.', 'Q15144539'],
  [
    'N0630',
    'historical',
    'The original Odinstarnet was destroyed in 1944; the later replica is a separate object.',
    'Q1568148',
  ],
  [
    'N0774',
    'subterranean',
    'An underground ossuary is not an above-ground museum building.',
    'Q2664428',
  ],
  [
    'N0816',
    'subterranean',
    'A funicular railway system requires route and station models, not a single conventional station at its midpoint.',
    'Q1394233',
  ],
  [
    'N0874',
    'unbuilt',
    'Grand Inga is a proposed complex; its design must not be rendered as an existing dam.',
    'Q278196',
  ],
  [
    'N0875',
    'natural-feature',
    'Usoi is a landslide dam, not an engineered concrete dam.',
    'Q281035',
  ],
  [
    'N0917',
    'historical',
    'The former Palace of Whitehall does not survive as a complete palace; surviving buildings have separate identities.',
    'Q564981',
  ],
  [
    'N0925',
    'subterranean',
    'The Basilica Cistern is underground and requires subterranean geometry and terrain integration.',
    'Q597051',
  ],
  [
    'N0936',
    'subterranean',
    'Domus Aurea is an archaeological underground complex, not an intact above-ground palace.',
    'Q911734',
  ],
  ['N0980', 'historical', 'Georgia Guidestones was destroyed and removed in 2022.', 'Q928541'],
  ['N0989', 'historical', 'The Arch of Reunification was demolished in January 2024.', 'Q931796'],
  [
    'N1016',
    'natural-feature',
    'Sanabria Lake is a lake, despite also having a monument classification.',
    'Q1890632',
  ],
  [
    'N1020',
    'landscape',
    'Forest of Remembrance is a planted memorial landscape, not a single monumental building.',
    'Q2288815',
  ],
];
const rows = new Map(
  Object.values(snapshot.groups)
    .flatMap((group) => group.rows)
    .map((row) => [row.id, row]),
);
const reviews = decisions.map(([candidateId, reasonCode, reason, replacementId]) => {
  const candidate = catalog.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) throw new Error(`${candidateId}: missing candidate`);
  const replacement = rows.get(replacementId);
  if (!replacement) throw new Error(`${replacementId}: missing replacement evidence`);
  const entity = details.entities[candidate.wikidataId];
  const point = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(replacement.coord);
  if (!point) throw new Error(`${replacementId}: no source coordinate`);
  return {
    candidateId,
    original: {
      wikidataId: candidate.wikidataId,
      title: candidate.title,
      category: candidate.category,
      source: candidate.source,
      description: entity?.description,
    },
    decision: 'replace-present-day-candidate',
    reasonCode,
    reason,
    suggestedReplacement: {
      wikidataId: replacementId,
      title: replacement.title,
      category: candidate.category,
      source: `https://www.wikidata.org/wiki/${replacementId}`,
      referenceCoordinate: { longitude: Number(point[1]), latitude: Number(point[2]) },
      sitelinks: replacement.links,
      description: details.entities[replacementId]?.description,
    },
    evidenceFile: 'evidence/wikidata-details.json',
  };
});
await writeFile(
  resolve(root, 'content/earth/structures/identity-review.json'),
  `${formatJson({ format: 'molen/structure-identity-review@1', sourceCapturedAt: details.capturedAt, policy: 'These identities remain recorded for future historical, underground, or landscape layers. Replacements are physical candidate identities, not a claim of completed geometry or surveyed placement.', reviews })}\n`,
);
console.log(
  `${reviews.length} explicit identity decisions with proposed same-category replacements`,
);
