import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const muradiyeEdirneCase = 'edirne-muradiye-native-281702066-and-architectural-survey';
export const muradiyeEdirneModel = 'muradiye_mosque_edirne';
export const muradiyeSurvey = 'https://islamansiklopedisi.org.tr/muradiye-kulliyesi--edirne';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inspectMuradiyeEdirneFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readBound(record, expectedPath) {
    const bytes = readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || record.sha256 !== digest(bytes))
      throw new Error('Source evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const map = readBound(proof.nativeIdentity, 'native-map/muradiye-edirne-outline.json');
    const written = readBound(proof.primarySources, 'reference-rights/muradiye-edirne-facts.json');
    const excluded = readBound(
      proof.candidateExclusion,
      'reference-rights/qualla-image-screening.json',
    );
    const way = map.elements[0];
    const facts = written.sources.find(({ url }) => url === muradiyeSurvey)?.facts;
    const rejected = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    if (
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => rejected.has(path)) ||
      facts?.porchBays !== 5 ||
      facts.axialDomes !== 2 ||
      facts.sideDomes !== 2 ||
      facts.minaretBalconies !== 1
    )
      return fail('muradiye-written-scope-or-exclusions-unbound');
    const d = controls.dimensions;
    if (
      way.id !== 281702066 ||
      way.tags.wikidata !== 'Q19897831' ||
      way.nodes.length !== 11 ||
      !same(
        way.nodes.slice(0, -1),
        map.elements.slice(1).map(({ id }) => id),
      ) ||
      frame.sourceUrl !== 'https://www.openstreetmap.org/way/281702066' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !same(frame.geometry.outline, map.outline) ||
      !same(d.outline, map.outline) ||
      d.porchBays !== facts.porchBays ||
      d.axialRooms.length !== facts.axialDomes ||
      d.sideRooms.length !== facts.sideDomes ||
      d.minaretBalconies !== facts.minaretBalconies ||
      d.estimatedExterior !== true
    )
      return fail('muradiye-native-footprint-or-massing-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped mosque and written survey establish the four chambers, open five-bay porch, and northwest single-balcony minaret. Heights and architectural trim are estimated.',
    };
  } catch {
    return fail('muradiye-edirne-evidence-invalid');
  }
}
