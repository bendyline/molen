import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const grandEgyptianMuseumCase = 'grand-egyptian-museum-built-folded-galleries';
export const grandEgyptianMuseumModel = 'grand_egyptian_museum';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function evidence(dir, record, file) {
  if (record?.path !== file) throw Error('Unexpected evidence path');
  const bytes = fs.readFileSync(path.join(dir, file));
  if (hash(bytes) !== record.sha256) throw Error('Evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectGrandEgyptianMuseumFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = evidence(
      dir,
      proof.primarySources,
      'reference-rights/grand-egyptian-museum-facts.json',
    );
    const exclusions = evidence(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = evidence(dir, proof.nativeIdentity, 'native-map/footprint.json');
    const architect = archive.sources.find(
      (source) => source.url === 'https://www.hparc.com/work/the-grand-egyptian-museum',
    );
    const contractor = archive.sources.find(
      (source) => source.url === 'https://www.besix.com/en/projects/grand-egyptian-museum',
    );
    const rejected = new Map(
      exclusions.candidates.map((candidate) => [candidate.sourceUrl, candidate.reason]),
    );
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      architect?.facts.galleryBands !== 5 ||
      architect.facts.sixthBandGrandStair !== true ||
      architect.facts.siteLevelDifferenceMeters !== 50 ||
      contractor?.facts.coverSlabSquareMeters !== 33000 ||
      contractor.facts.cantileverMeters !== 20 ||
      contractor.facts.ceilingsMeters !== 25 ||
      contractor.facts.cableSupportedDoubleGlazing !== true ||
      exclusions.selectedImages !== 0 ||
      !inventory.candidates.every(({ sourceUrl }) => rejected.get(sourceUrl)?.trim())
    )
      return fail('grand-egyptian-museum-written-design-or-exclusions-unbound');

    const relation = native.elements.find(
      (row) => row.type === 'relation' && row.id === proof.nativeIdentity.relation,
    );
    if (
      relation?.id !== 16783121 ||
      relation.tags.wikidata !== 'Q2583681' ||
      relation.tags.height !== '46' ||
      frame.mappedIdentity.wikidataId !== relation.tags.wikidata ||
      controls.model !== grandEgyptianMuseumModel ||
      controls.dimensions.mappedMaximumHeight !== 46 ||
      controls.dimensions.galleryBands !== 5
    )
      return fail('grand-egyptian-museum-identity-or-height-unbound');
    const nodes = new Map(
      native.elements.filter((row) => row.type === 'node').map((row) => [row.id, row]),
    );
    const meter = (Math.PI / 180) * 6378137;
    const [lon, lat] = frame.anchor;
    const scaleX = meter * Math.cos((lat * Math.PI) / 180);
    const matches = (role, points) => {
      const member = relation.members.find(
        (member) => member.role === role && member.type === 'way',
      );
      const way = native.elements.find((row) => row.id === member?.ref && row.type === 'way');
      return (
        points?.length === way?.nodes.length - 1 &&
        points.every(([x, z], i) => {
          const point = nodes.get(way.nodes[i]);
          return Math.hypot((point.lon - lon) * scaleX - x, (lat - point.lat) * meter - z) < 0.001;
        })
      );
    };
    if (
      !matches('outer', frame.geometry.outline) ||
      !matches('inner', frame.geometry.courtyards?.[0])
    )
      return fail('grand-egyptian-museum-mapped-envelope-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The architect and contractor document the folded gallery bands, grand stair, cantilever and glazed facade. Native footprints place the building and one roof opening. Surface subdivision and precise elevations are estimated.',
    };
  } catch {
    return fail('grand-egyptian-museum-evidence-invalid');
  }
}
