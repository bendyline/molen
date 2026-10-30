import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectMaputoPrimaryFacts } from './primary-facts-maputo.mjs';

const source = new URL('../places/ke/ker/maputo_katembe_bridge/', import.meta.url);
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maputo-factual-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of [
    'primary-facts-reconstruction.json',
    'reference-rights/mofcom-primary-facts.txt',
    'reference-rights/engineering-abstract-facts.txt',
    'native-map/bridge-and-approach-roads.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.copyFileSync(new URL(name, source), path.join(dir, name));
  }
  return {
    dir,
    proof: JSON.parse(fs.readFileSync(new URL('primary-facts-reconstruction.json', source))),
    controls: JSON.parse(fs.readFileSync(new URL('plan-controls.json', source))),
    frame: JSON.parse(fs.readFileSync(new URL('map-frame.json', source))),
  };
}
test('whole bridge binds primary dimensions and every original approach road control', (t) => {
  const result = inspectMaputoPrimaryFacts(fixture(t));
  assert.equal(result.status, 'passed');
  assert.equal(result.imageryUsed, false);
});
test('a short main-span proxy cannot replace the complete crossing', (t) => {
  const f = fixture(t),
    p = path.join(f.dir, f.proof.nativeIdentity.path);
  const native = JSON.parse(fs.readFileSync(p));
  native.elements = native.elements.filter((e) => e.type !== 'way' || e.id === 378386159);
  fs.writeFileSync(p, JSON.stringify(native));
  f.proof.nativeIdentity.sha256 = hash(fs.readFileSync(p));
  assert.equal(inspectMaputoPrimaryFacts(f).status, 'needs-review');
});
test('incorrect deck/tower dimensions and changed source-frame controls fail', (t) => {
  for (const change of [
    (f) => (f.controls.bridge.deckWidth = 50),
    (f) => (f.controls.bridge.towerHeight = 200),
    (f) => (f.frame.features[0].points[0][0] += 50),
  ]) {
    const f = fixture(t);
    change(f);
    assert.equal(inspectMaputoPrimaryFacts(f).status, 'needs-review');
  }
});
test('an unrelated engineering extract cannot authorize the metrics', (t) => {
  const f = fixture(t),
    s = f.proof.primarySources.find((s) => s.key === 'engineering');
  const p = path.join(f.dir, s.path);
  fs.writeFileSync(p, 'Generic steel bridge.');
  s.sha256 = hash(fs.readFileSync(p));
  assert.equal(inspectMaputoPrimaryFacts(f).status, 'needs-review');
});
