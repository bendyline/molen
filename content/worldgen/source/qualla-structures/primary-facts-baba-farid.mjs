import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const babaFaridCase = 'pakpattan-baba-farid-surveyed-tomb';
export const babaFaridModel = 'shrine_of_baba_farid';
export const babaFaridRegister = 'https://doam.gov.pk/public/sites/9694';
export const babaFaridSurvey =
  'https://era.ed.ac.uk/server/api/core/bitstreams/c94133ce-2289-41db-bcec-469ef56bb820/content';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readPinnedEvidence(dir, pin, filename) {
  assert.equal(pin.path, filename);
  const bytes = readFileSync(join(dir, filename));
  assert.equal(hash(bytes), pin.sha256);
  return JSON.parse(bytes);
}

export function inspectBabaFaridFacts({ dir, proof, controls, frame }) {
  try {
    const locator = readPinnedEvidence(dir, proof.nativeIdentity, 'native-map/tomb-location.json');
    const facts = readPinnedEvidence(
      dir,
      proof.primarySources,
      'reference-rights/architectural-survey-facts.json',
    );
    assert.equal(locator.record.url, babaFaridRegister);
    assert.equal(locator.precinct.id, 174504957);
    assert.deepEqual(frame.anchor, locator.record.anchor);
    assert.equal(frame.sourceUrl, babaFaridRegister);
    assert.equal(frame.heading, 0);
    assert.equal(facts.mode, 'factual-text-only');
    assert.equal(facts.imageryUsed, false);
    assert(facts.sources.some(({ url }) => url === babaFaridSurvey));

    const side = facts.architecture.chamberSideMeters;
    assert.equal(side, 5.2);
    assert.equal(facts.architecture.roof, 'cusped dome on pendentives with a long pinnacle');
    assert.deepEqual(facts.architecture.gates, { east: 'Nuri Darwaza', south: 'Bahishti Darwaza' });
    const half = side / 2;
    assert.deepEqual(frame.geometry.outline, [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ]);
    const { plinth, eave, domeTip, pinnacleTop } = controls.dimensions;
    assert(Math.abs(eave - plinth - side) < 1e-9 && domeTip > eave && pinnacleTop > domeTip);

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The archaeology record anchors the surveyed chamber and door bearings. The dome section, door dimensions and foundation height are estimates.',
    };
  } catch {
    return { status: 'needs-review', reason: 'baba-farid-survey-controls-unbound' };
  }
}
