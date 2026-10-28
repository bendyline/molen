import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { inspectQuallaPrimaryRights } from './imagery-primary-rights.mjs';

const source = new URL('../places/ez/ezm/abbey_of_santo_domingo_de_silos/', import.meta.url),
  reference = JSON.parse(fs.readFileSync(new URL('reference-images.json', source))).references[0],
  native = JSON.parse(
    fs.readFileSync(new URL('reference-rights/pedrero-1892-native.json', source)),
  ),
  original = fs.readFileSync(new URL(reference.localCopy, source)),
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-pedrero-rights-')),
  file = path.join(root, reference.publicDomainEvidence.path),
  sha = (b) => createHash('sha256').update(b).digest('hex');
fs.mkdirSync(path.dirname(file), { recursive: true });
beforeEach(() => fs.writeFileSync(file, JSON.stringify(native)));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const check = (changeReference = () => {}, changeNative = () => {}, bytes = original) => {
  const r = structuredClone(reference),
    n = structuredClone(native);
  changeNative(Object.values(n.query.pages).find((p) => p.title.includes('Pedrero')));
  fs.writeFileSync(file, JSON.stringify(n));
  r.publicDomainEvidence.sha256 = sha(fs.readFileSync(file));
  changeReference(r);
  return inspectQuallaPrimaryRights(r, bytes, root);
};
test('binds the exact signed1892drawing and named1927creator without asserting1892publication', () => {
  assert.equal(check().eligible, true);
  assert.equal(reference.publicDomainEvidence.publicationYear, undefined);
});
test('rejects altered original bytes even with a caller-supplied new reference hash', () =>
  assert.equal(
    check(
      (r) => (r.sha256 = sha('replacement')),
      () => {},
      Buffer.from('replacement'),
    ).eligible,
    false,
  ));
test('rejects an attribution-only or missing native release', () => {
  for (const replacement of ['', '{{CC-by-sa-4.0}}'])
    assert.equal(
      check(
        () => {},
        (p) => {
          p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace(
            '{{PD-Scan|1=PD-old-auto-expired|deathyear=1927}}',
            replacement,
          );
        },
      ).eligible,
      false,
    );
});
test('rejects another artist, lifespan, date or collection', () => {
  for (const [from, to] of [
    ['Mariano Pedrero (1865-1927)', 'Unknown'],
    ['1892-09-24', '1992-09-24'],
    ['collection of Marceliano Pedrero', 'unrecorded collection'],
  ])
    assert.equal(
      check(
        () => {},
        (p) => {
          p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace(from, to);
        },
      ).eligible,
      false,
    );
  assert.equal(check((r) => (r.publicDomainEvidence.creatorDied = 2020)).eligible, false);
});
test('rejects a different native original or revision', () => {
  assert.equal(
    check(
      () => {},
      (p) => p.revisions[0].revid++,
    ).eligible,
    false,
  );
  assert.equal(
    check(
      () => {},
      (p) => (p.imageinfo[0].sha1 = '0'.repeat(40)),
    ).eligible,
    false,
  );
});
test('rejects reuse of the exact drawing exception for another item or record class', () => {
  assert.equal(
    check((r) => (r.sourceUrl = 'https://commons.wikimedia.org/wiki/File:Other.jpg')).eligible,
    false,
  );
  assert.equal(
    check((r) => (r.publicDomainEvidence.recordClass = 'named-old-map')).eligible,
    false,
  );
});
test('rejects an unbound snapshot or escaped rights path', () => {
  assert.equal(check((r) => (r.publicDomainEvidence.sha256 = '0'.repeat(64))).eligible, false);
  assert.equal(check((r) => (r.publicDomainEvidence.path = '../outside.json')).eligible, false);
});
