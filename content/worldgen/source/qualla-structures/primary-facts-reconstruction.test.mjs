import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  inspectPrimaryFactsReconstruction,
  referenceInventoryHash,
} from './primary-facts-reconstruction.mjs';

const source = new URL('../places/r7/r7h/allan_cunningham_monument/', import.meta.url);
const digest = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-factual-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const n of [
    'primary-facts-reconstruction.json',
    'plan-controls.json',
    'map-frame.json',
    'native-map/monument-point.json',
    'reference-rights/primary-description-web-extract.txt',
  ]) {
    fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true });
    fs.copyFileSync(new URL(n, source), path.join(dir, n));
  }
  const proof = JSON.parse(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json')));
  const inventory = {
    candidates: [{ path: '_m/fixture.jpg', license: 'CC BY-SA 4.0' }],
    conflicts: [],
  };
  proof.quallaFirst.families = 1;
  proof.quallaFirst.inventoryHash = referenceInventoryHash(inventory);
  fs.writeFileSync(path.join(dir, 'primary-facts-reconstruction.json'), JSON.stringify(proof));
  const references = {
    method: 'primary-facts-only',
    references: [],
    externalReferences: [],
    inputHash: 'test-input',
  };
  return {
    dir,
    proof,
    inventory,
    references,
    currentReferences: { ...references },
    entry: { modelIdentity: 'allan_cunningham_monument', structureId: proof.structureId },
  };
}
function change(f, name, mutate) {
  const p = path.join(f.dir, name),
    j = JSON.parse(fs.readFileSync(p));
  mutate(j);
  fs.writeFileSync(p, JSON.stringify(j));
}
test('primary measured reconstruction approves no photographs and retains independent identity', (t) => {
  const f = fixture(t),
    result = inspectPrimaryFactsReconstruction(f);
  assert.equal(result.status, 'passed');
  assert.equal(result.imageryUsed, false);
});
test('the factual route cannot adopt even a purported CC0 photograph', (t) => {
  const f = fixture(t);
  f.references.references.push({ path: '_m/fixture.jpg', license: 'CC0' });
  assert.equal(inspectPrimaryFactsReconstruction(f).status, 'needs-review');
});
test('wrong numeric geometry, foreign identity and changed Qualla search are rejected', (t) => {
  for (const mutation of [
    (f) => change(f, 'plan-controls.json', (p) => (p.monument.height = 50)),
    (f) => change(f, 'map-frame.json', (p) => (p.mappedIdentity.wikidataId = 'Q1')),
    (f) => f.inventory.candidates.push({ path: '_m/new.jpg' }),
    (f) => (f.entry.modelIdentity = 'unrelated_obelisk'),
  ]) {
    const f = fixture(t);
    mutation(f);
    assert.equal(inspectPrimaryFactsReconstruction(f).status, 'needs-review');
  }
});
test('primary record must still contain the bound measured description', (t) => {
  const f = fixture(t),
    p = path.join(f.dir, f.proof.primarySource.path);
  fs.writeFileSync(p, 'An unrelated monument is five metres high.');
  f.proof.primarySource.sha256 = digest(fs.readFileSync(p));
  fs.writeFileSync(path.join(f.dir, 'primary-facts-reconstruction.json'), JSON.stringify(f.proof));
  assert.equal(inspectPrimaryFactsReconstruction(f).status, 'needs-review');
});
