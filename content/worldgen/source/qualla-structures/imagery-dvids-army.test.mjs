import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectDvidsReference } from './imagery-inventory.mjs';

test('Army rendition requires bound original, official unit, named military staff and primary PD record', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-army-photo-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  const image = Buffer.from('exact published rendition');
  fs.writeFileSync(path.join(dir, 'photo.jpg'), image);
  const sourceUrl =
    'https://www.dvidshub.net/image/384432/snow-never-melts-push-through-salang-pass';
  const downloadUrl =
    'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1103/384432/1000w_q95.jpg';
  const html = `<meta property="og:url" content="${sourceUrl}">
<meta property="og:image" content="${downloadUrl}">
<meta property="og:description" content="Soldiers conducted a convoy through Salang Pass.">
<h3>Photo by <a href="/portfolio/1042392/michael-vanpool">Spc. Michael Vanpool</a></h3>
<h3 class="the_unit"><a href="/unit/101SB-101ABN">101st Division Sustainment Brigade Public Affairs</a></h3>
<td>Photo ID:</td><td>384432</td><td>VIRIN:</td><td>110329-A-3809V-006</td>
<h4 class="public-domain">PUBLIC DOMAIN</h4>`;
  const check = (change, fields = {}) => {
    const content = change ? change(html) : html;
    fs.writeFileSync(path.join(dir, 'primary.html'), content);
    return inspectDvidsReference(dir, {
      path: 'photo.jpg',
      sha256: hash(image),
      sourceUrl,
      downloadUrl,
      origin: 'dvids-usarmy-public-domain',
      artist: 'Spc. Michael Vanpool',
      license: 'Public domain',
      width: 1000,
      rightsEvidence: { path: 'primary.html', sha256: hash(content) },
      originalReview: {
        rendition: 'published-jpeg-rendition',
        creditFormat: 'army-unit-and-staff-byline',
      },
      ...fields,
    }).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    ['101SB-101ABN', 'unknown-unit'],
    ['Spc. Michael Vanpool', 'Civilian Michael Vanpool'],
    ['110329-A-', '110329-N-'],
    ['<td>384432</td>', '<td>384433</td>'],
    ['PUBLIC DOMAIN', 'COPYRIGHT'],
    ['Soldiers conducted', 'Courtesy photograph: soldiers conducted'],
  ])
    assert.equal(
      check((s) => s.replace(from, to)),
      false,
      from,
    );
  assert.equal(check(null, { artist: 'Different soldier' }), false);
  assert.equal(check(null, { sha256: '0'.repeat(64) }), false);
  assert.equal(check(null, { width: 2000 }), false);
  assert.equal(check(null, { originalReview: { rendition: 'native-original' } }), false);
});
