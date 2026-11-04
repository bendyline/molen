import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readCurrentReferences } from './member-references.mjs';

test('independent member selection survives later parent reference preparation', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'structure-member-refs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'references/members'), { recursive: true });
  const entry = {
    modelIdentity: 'first_building',
    parentModelIdentity: 'whole_site',
    structureId: 'QS-123456789abc',
    referenceManifest: 'references/members/first_building.json',
  };
  const refs = { structureId: entry.structureId, inputHash: 'accepted-first-selection' };
  const record = {
    format: 'molen/structure-member-references@1',
    modelIdentity: entry.modelIdentity,
    parentModelIdentity: entry.parentModelIdentity,
    structureId: entry.structureId,
    referenceImages: refs,
  };
  const member = path.join(dir, entry.referenceManifest);
  fs.writeFileSync(member, JSON.stringify(record));
  fs.writeFileSync(
    path.join(dir, `references/${entry.structureId}.json`),
    JSON.stringify({ inputHash: 'new-second-building-selection' }),
  );
  assert.deepEqual(readCurrentReferences(dir, entry), refs);
  assert.equal(
    readCurrentReferences(dir, { structureId: entry.structureId }).inputHash,
    'new-second-building-selection',
  );
  assert.throws(() =>
    readCurrentReferences(dir, { ...entry, referenceManifest: '../escape.json' }),
  );
  fs.writeFileSync(member, JSON.stringify({ ...record, modelIdentity: 'other_building' }));
  assert.throws(() => readCurrentReferences(dir, entry));
  fs.writeFileSync(member, JSON.stringify({ ...record, structureId: 'QS-ffffffffffff' }));
  assert.throws(() => readCurrentReferences(dir, entry));
});
