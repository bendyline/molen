import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectExcavationPlanReference } from './imagery-excavation-plan.mjs';

const hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
test('expired excavation plan binds all named contributors, exact original edition, native PDF and inspected plan scope', (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-excavation-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const pdf = Buffer.from('%PDF-1.5 original excavator plan'),
    id = 'original1907',
    m = {
      identifier: id,
      title: 'Original excavation',
      date: '1907',
      creator: ['Excavator, 1838-1915', 'Artist, 1874-1939', 'Scholar, 1869-1949'],
      publisher: 'London: original publisher',
      contributor: 'University library',
      'possible-copyright-status': 'NOT_IN_COPYRIGHT',
    },
    record = {
      metadata: m,
      files: [{ name: id + '.pdf', size: String(pdf.length), sha1: hash(pdf, 'sha1') }],
    },
    r = {
      origin: 'archive-expired-excavation-plan',
      license: 'Public domain',
      path: 'original.pdf',
      sha256: hash(pdf),
      archiveIdentifier: id,
      title: m.title,
      artist: m.creator.join('; '),
      catalogCreators: [...m.creator],
      sourceUrl: 'https://archive.org/details/' + id,
      downloadUrl: 'https://archive.org/download/' + id + '/' + id + '.pdf',
      rightsEvidence: { path: 'catalog.json', sourceUrl: 'https://archive.org/metadata/' + id },
      visuallyReviewedForThisPolicy: true,
      originalReview: {
        status: 'inspected',
        rendition: 'native-original-pdf',
        scope: 'original-excavation-plan-and-section-only',
        publicationYear: 1907,
        titlePdfPage: 11,
        planPdfPage: 36,
        pagesInspected: [11, 18, 36],
        planCaption: 'Plan and sectional elevation',
        planCreditBasis:
          'Original plan in the title-page credited original volume; no later reproduction.',
      },
    };
  fs.writeFileSync(path.join(d, 'original.pdf'), pdf);
  const save = () => {
    const s = JSON.stringify(record);
    fs.writeFileSync(path.join(d, 'catalog.json'), s);
    r.rightsEvidence.sha256 = hash(s);
  };
  save();
  assert(inspectExcavationPlanReference(d, r).eligible);
  for (const patch of [
    { date: '2000' },
    { creator: ['Unknown'] },
    { creator: ['Excavator, 1838-1915', 'Artist, 1874-1960'] },
    { 'possible-copyright-status': 'Copyrighted' },
    { 'access-restricted-item': 'true' },
  ]) {
    record.metadata = { ...m, ...patch };
    save();
    assert(!inspectExcavationPlanReference(d, r).eligible);
  }
  record.metadata = m;
  save();
  for (const patch of [
    { catalogCreators: ['Excavator, 1838-1915'] },
    { artist: 'Excavator only' },
    { sha256: hash('other') },
    { originalReview: { ...r.originalReview, pagesInspected: [11] } },
    { originalReview: { ...r.originalReview, scope: 'unrelated photograph' } },
    { downloadUrl: r.downloadUrl + '?reprint' },
  ])
    assert(!inspectExcavationPlanReference(d, { ...r, ...patch }).eligible);
  record.files[0].sha1 = hash('different', 'sha1');
  save();
  assert(!inspectExcavationPlanReference(d, r).eligible);
});
