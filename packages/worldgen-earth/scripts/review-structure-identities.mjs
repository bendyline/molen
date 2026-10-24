/** Keep rejected source identities in an audit trail; this script never mutates candidates. */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const catalog = JSON.parse(
  await readFile(
    resolve(root, 'content/worldgen/source/structure-catalog/candidates.json'),
    'utf8',
  ),
);
const snapshot = JSON.parse(
  await readFile(
    resolve(root, 'content/worldgen/source/structure-catalog/wikidata-snapshot.json'),
    'utf8',
  ),
);
const details = JSON.parse(
  await readFile(resolve(root, 'content/earth/structures/evidence/wikidata-details.json'), 'utf8'),
);
// Explicit decisions: historical demolition statements by themselves are not a rejection
// because many functioning churches have destroyed predecessors on the same Wikidata item.
const decisions = [
  [
    'ava_bridge',
    'historical',
    'The 2025 destruction statement means this original bridge cannot be presented as an intact present-day crossing.',
    'Q4797664',
  ],
  [
    'seven_sisters',
    'collection',
    'Seven geographically separate skyscrapers cannot share one model anchor.',
    'Q875078',
  ],
  [
    'singer_building',
    'historical',
    'Demolished in 1968; a historical reconstruction must not occupy the current building site.',
    'Q953610',
  ],
  [
    '2_world_trade_center',
    'unbuilt',
    'The structured source identifies an unfinished tower; published full-tower dimensions are design values.',
    'Q1330847',
  ],
  [
    'svanetian_tower',
    'category',
    'A regional tower type requires a category rule rather than a fabricated unique landmark anchor.',
    'Q643592',
  ],
  [
    'sukharev_tower',
    'historical',
    'Demolished in 1934; present-day placement of an intact tower would be false.',
    'Q718126',
  ],
  [
    'frankish_tower',
    'historical',
    'The Frankish Tower on the Acropolis was demolished; no intact contemporary tower should be drawn.',
    'Q1345155',
  ],
  [
    'stockholm_telephone_tower',
    'historical',
    'The former Stockholm telephone tower was removed in 1953.',
    'Q15144539',
  ],
  [
    'odinstarnet',
    'historical',
    'The original Odinstarnet was destroyed in 1944; the later replica is a separate object.',
    'Q1568148',
  ],
  [
    'catacombs_of_paris',
    'subterranean',
    'An underground ossuary is not an above-ground museum building.',
    'Q2664428',
  ],
  [
    'tunel',
    'subterranean',
    'A funicular railway system requires route and station models, not a single conventional station at its midpoint.',
    'Q1394233',
  ],
  [
    'grand_inga_dam',
    'unbuilt',
    'Grand Inga is a proposed complex; its design must not be rendered as an existing dam.',
    'Q278196',
  ],
  [
    'usoi_dam',
    'natural-feature',
    'Usoi is a landslide dam, not an engineered concrete dam.',
    'Q281035',
  ],
  [
    'palace_of_whitehall',
    'historical',
    'The former Palace of Whitehall does not survive as a complete palace; surviving buildings have separate identities.',
    'Q564981',
  ],
  [
    'basilica_cistern',
    'subterranean',
    'The Basilica Cistern is underground and requires subterranean geometry and terrain integration.',
    'Q597051',
  ],
  [
    'domus_aurea',
    'subterranean',
    'Domus Aurea is an archaeological underground complex, not an intact above-ground palace.',
    'Q911734',
  ],
  [
    'georgia_guidestones',
    'historical',
    'Georgia Guidestones was destroyed and removed in 2022.',
    'Q928541',
  ],
  [
    'arch_of_reunification',
    'historical',
    'The Arch of Reunification was demolished in January 2024.',
    'Q931796',
  ],
  [
    'sanabria_lake',
    'natural-feature',
    'Sanabria Lake is a lake, despite also having a monument classification.',
    'Q1890632',
  ],
  [
    'forest_of_remembrance',
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
