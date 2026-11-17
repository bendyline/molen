/** Written heritage description and the native footprint of Hung Lau in Tuen Mun. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const read = (directory, name) => fs.readFileSync(path.join(directory, name));
const sources = [
  {
    key: 'appraisal',
    url: 'https://www.aab.gov.hk/filemanager/aab/common/20170228meeting/20170228-annex-b-en.pdf',
    file: 'primary-sources/heritage-appraisal-annex-b',
    facts: [
      'two-storey pitched-roof building',
      'two units by cross walls',
      'two-storey verandah extension at the front',
      'kitchen and storeroom annexe at the rear',
      'metal windows in hooded openings',
      'pierced screen blocks',
      'faded pink finish',
      'roof and floor construction is of timber',
    ],
  },
  {
    key: 'board',
    url: 'https://www.aab.gov.hk/filemanager/aab/common/20170228meeting/20170228-annex-cover-en.pdf',
    file: 'primary-sources/aab-2017-hung-lau-paper',
    facts: ['28 february 2017', 'its main building remained intact'],
  },
];

export const hungLauCase = 'hung-lau-aab-two-storey-verandah-rear-annex-2017';

export function inspectHungLauPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });

  for (const { key, url, file, facts } of sources) {
    const record = proof.primarySources?.find((source) => source.key === key);
    const pdf = read(dir, `${file}.pdf`);
    const text = read(dir, `${file}.txt`);
    const normalized = text.toString().replace(/\s+/g, ' ').toLowerCase();
    if (
      record?.url !== url ||
      record?.use !== 'factual-text-only' ||
      record?.path !== `${file}.pdf` ||
      record?.textPath !== `${file}.txt` ||
      record?.sha256 !== hash(pdf) ||
      record?.textHash !== hash(text) ||
      !facts.every((phrase) => normalized.includes(phrase))
    )
      return fail('hung-lau-primary-architecture-sources-changed');
  }

  const nativePath = 'native-map/hung-lau-controls.json';
  const native = read(dir, nativePath);
  const building = JSON.parse(native).building;
  const identity = proof.nativeIdentity;
  const ring = frame.geometry?.polygons?.[0];
  const feature = frame.features?.[0];
  if (
    identity?.path !== nativePath ||
    identity.sha256 !== hash(native) ||
    building.id !== 'way/257723413' ||
    building.tags['building:levels'] !== '2' ||
    building.tags.wikidata !== 'Q5942584' ||
    frame.mappedIdentity?.wikidataId !== 'Q5942584' ||
    frame.sourceUrl !== 'https://www.openstreetmap.org/way/257723413' ||
    feature?.id !== building.id ||
    ring?.length !== 12 ||
    building.coordinates.length !== ring.length ||
    JSON.stringify(feature.points) !== JSON.stringify(ring) ||
    JSON.stringify(controls.section?.mappedFootprint) !== JSON.stringify(ring)
  )
    return fail('hung-lau-native-footprint-or-identity-changed');

  const [lon, lat] = frame.anchor;
  const metersLongitude = 111320 * Math.cos((lat * Math.PI) / 180);
  const c = Math.cos(frame.heading);
  const s = Math.sin(frame.heading);
  for (const [i, [x, z]] of ring.entries()) {
    const [lng, latitude] = building.coordinates[i];
    const east = (lng - lon) * metersLongitude;
    const south = (lat - latitude) * 111320;
    if (Math.hypot(x - (c * east - s * south), z - (s * east + c * south)) > 0.000008)
      return fail('hung-lau-footprint-registration-changed');
  }

  const { mainVolume, frontVerandah, rearAnnex } = controls.section;
  if (
    controls.representedDate !== '2017-02-28' ||
    mainVolume?.storeys !== 2 ||
    frontVerandah?.storeys !== 2 ||
    rearAnnex?.storeys !== 2 ||
    frontVerandah.balustrade !== 'pierced masonry screen blocks' ||
    mainVolume.finish !== 'faded pink plaster over brick' ||
    frontVerandah.limitsXZ[1] <= 0 ||
    rearAnnex.limitsXZ[3] >= 0 ||
    mainVolume.ridgeY <= mainVolume.eavesY
  )
    return fail('hung-lau-section-no-longer-matches-the-appraisal');

  const exclusionPath = 'primary-sources/imagery-inventory-review.json';
  const exclusion = read(dir, exclusionPath);
  if (
    proof.candidateExclusion?.path !== exclusionPath ||
    proof.candidateExclusion?.sha256 !== hash(exclusion) ||
    JSON.parse(exclusion).selectedImagery.length !== 0
  )
    return fail('hung-lau-imagery-exclusion-review-changed');

  return {
    status: 'passed',
    method: 'primary-facts-only',
    imageryUsed: false,
    evidenceHash: hash(read(dir, 'primary-facts-reconstruction.json')),
    notes:
      'The 2017 heritage assessment and named native outline support the pitched two-storey house, southeast verandah with pierced masonry, and two-storey service annex. Section heights, the opening grid and local thresholds are estimates.',
  };
}
