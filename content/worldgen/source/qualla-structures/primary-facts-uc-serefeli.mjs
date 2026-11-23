import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const ucSerefeliCase = 'uc-serefeli-edirne-two-native-outlines-and-tdv-dimensions';
export const ucSerefeliModel = 'uc_serefeli_mosque';
export const ucSerefeliSurvey = 'https://islamansiklopedisi.org.tr/uc-serefeli-cami-ve-kulliyesi';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inspectUcSerefeliFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readBound(record, expectedPath) {
    const bytes = readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || record.sha256 !== digest(bytes))
      throw new Error('Source evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const map = readBound(proof.nativeIdentity, 'native-map/uc-serefeli-outlines.json');
    const written = readBound(
      proof.primarySources,
      'reference-rights/uc-serefeli-architectural-facts.json',
    );
    const excluded = readBound(
      proof.candidateExclusion,
      'reference-rights/qualla-image-screening.json',
    );
    const facts = written.sources.find(({ url }) => url === ucSerefeliSurvey)?.facts;
    const rejected = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    const d = controls.dimensions;
    if (
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => rejected.has(path)) ||
      facts?.mainDomeDiameter !== 24.1 ||
      facts.sideDomeDiameter !== 10.5 ||
      facts.arcadeBays !== 22 ||
      facts.tallestMinaretIncludingCap !== 76
    )
      return fail('uc-serefeli-written-scope-or-exclusions-unbound');
    if (
      !same(
        map.ways.map(({ id }) => id),
        [211425199, 281703536],
      ) ||
      !map.ways.every(({ tags }) => tags.wikidata === 'Q3308631') ||
      !same(
        map.knownMinarets.map(({ id }) => id),
        [9202203880, 9202203881],
      ) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !same(frame.geometry.polygons, map.polygons) ||
      !same(d.polygons, map.polygons) ||
      d.mainDomeRadius !== facts.mainDomeDiameter / 2 ||
      d.sideDomeRadius !== facts.sideDomeDiameter / 2 ||
      d.arcadeBays.reduce((total, count) => total + count, 0) !== facts.arcadeBays ||
      !same(
        d.towers.map(({ balconies }) => balconies.length),
        [3, 2, 1, 1],
      ) ||
      d.towers[0].height !== facts.tallestMinaretIncludingCap
    )
      return fail('uc-serefeli-native-plan-or-architectural-controls-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The two mapped envelopes and written survey establish the dome sizes, courtyard bays, and four differently ornamented minarets. Secondary heights are estimated.',
    };
  } catch {
    return fail('uc-serefeli-evidence-invalid');
  }
}
