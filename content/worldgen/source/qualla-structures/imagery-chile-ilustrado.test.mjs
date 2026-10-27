import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { inspectChileIlustradoReference } from './imagery-chile-ilustrado.mjs';

const source = new URL('../places/66/66j/municipal_theatre_of_santiago/', import.meta.url),
  read = (p) => JSON.parse(fs.readFileSync(new URL(p, source))),
  reference = read('reference-images.json').externalReferences[0],
  native = read(reference.rightsEvidence.path),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-chile-ilustrado-'));
fs.mkdirSync(path.join(dir, 'references'));
fs.mkdirSync(path.join(dir, 'reference-rights'));
fs.copyFileSync(new URL(reference.path, source), path.join(dir, reference.path));
const putNative = (n) =>
    fs.writeFileSync(
      path.join(dir, reference.rightsEvidence.path),
      `${JSON.stringify(n, null, 2)}\n`,
    ),
  hash = (b) => createHash('sha256').update(b).digest('hex');
beforeEach(() => putNative(native));
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const check = (mutate) => {
  const r = structuredClone(reference);
  mutate(r);
  return inspectChileIlustradoReference(dir, r);
};
const changedNative = (mutate) => {
  const n = structuredClone(native);
  mutate(n);
  putNative(n);
  return check(
    (r) => (r.rightsEvidence.sha256 = hash(fs.readFileSync(path.join(dir, r.rightsEvidence.path)))),
  );
};
test('accepts the exact original1872volume and separately reviewed old-theatre phase', () =>
  assert.equal(inspectChileIlustradoReference(dir, reference).eligible, true));
test('rejects changed PDF bytes even when a caller supplies a new hash', () => {
  const p = path.join(dir, reference.path),
    original = fs.readFileSync(p),
    changed = Buffer.from(original);
  changed[changed.length - 1] ^= 1;
  fs.writeFileSync(p, changed);
  try {
    assert.equal(check((r) => (r.sha256 = hash(changed))).eligible, false);
  } finally {
    fs.writeFileSync(p, original);
  }
});
test('rejects another book or a later edition URL', () =>
  assert.equal(
    check((r) => (r.downloadUrl = r.downloadUrl.replace('1872', '1873'))).eligible,
    false,
  ));
test('rejects a snapshot with an attribution-only grant', () =>
  assert.equal(
    changedNative(
      (n) =>
        (Object.values(n.query.pages).find(
          (p) => p.title === 'File:Chile Ilustrado (1872).pdf',
        ).imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-SA 4.0'),
    ).eligible,
    false,
  ));
test('rejects a missing native public-domain release', () =>
  assert.equal(
    changedNative((n) => {
      const p = Object.values(n.query.pages).find(
        (p) => p.title === 'File:Chile Ilustrado (1872).pdf',
      );
      p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace('{{PD-old-100}}', '');
    }).eligible,
    false,
  ));
test('does not turn a book-author credit into an identified engraving artist', () =>
  assert.equal(check((r) => (r.artist = 'Recaredo Santos Tornero, engraver')).eligible, false));
test('requires inspection of the original plate and distinction from proposed new-plan measurements', () => {
  assert.equal(check((r) => (r.originalReview.pagesInspected = [3])).eligible, false);
  assert.equal(
    check((r) => (r.originalReview.newPlanDimensionsExcludedFromOldPhase = false)).eligible,
    false,
  );
});
test('rejects an escaped source path', () =>
  assert.equal(check((r) => (r.path = '../outside.pdf')).eligible, false));
