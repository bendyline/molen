import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const militaryMuseumCase = 'johannesburg-military-museum-bellman-ranges';
export const militaryMuseumModel = 'south_african_national_museum_of_military_history';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const museumReport =
  'https://ditsong.org.za/en/wp-content/uploads/2025/11/DMSA-ANNUAL-REPORT-2024-2025.pdf';

export function inspectMilitaryMuseumFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, name) {
    const bytes = fs.readFileSync(path.join(dir, name));
    if (record.path !== name || record.sha256 !== hash(bytes)) throw Error('Evidence mismatch');
    return JSON.parse(bytes);
  }
  try {
    const sources = read(proof.primarySources, 'reference-rights/museum-facts.json');
    const exclusions = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const boundary = read(proof.nativeIdentity, 'native-map/site-way.json');
    const roofs = read(proof.roofEvidence, 'native-map/hangar-footprints.json');
    const way = boundary.elements.find(({ type }) => type === 'way');
    const verified = new Set(
      exclusions.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    if (
      sources.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => verified.has(path)) ||
      !sources.sources.some(
        ({ url, facts }) => url === museumReport && facts.originalBellmanHangars === 2,
      ) ||
      way?.id !== 23370080 ||
      way.tags.wikidata !== 'Q7565751' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      controls.mapEvidenceHash !== proof.roofEvidence.sha256 ||
      controls.dimensions.hangars.length !== 2 ||
      controls.dimensions.hangars.some(
        ({ basis, span, length, ridge, eave }) =>
          !roofs.features.some(({ role }) => role === basis) ||
          span < 15 ||
          length < 35 ||
          ridge <= eave,
      )
    )
      return fail('museum-footprints-or-architectural-sources-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The museum sources identify the two Bellman hangars. Published footprint geometry fixes the main site layout. Assignment of individual halls, roof divisions and visible finishes are estimates.',
    };
  } catch {
    return fail('military-museum-evidence-invalid');
  }
}
