import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashEvidenceText, matchesEvidenceText } from '../scripts/evidence-text-hash.mjs';

const rawHash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const unix = Buffer.from('{\n  "heading": 0.17,\n  "title": "Kõpu"\n}\n');
const windows = Buffer.from(unix.toString().replaceAll('\n', '\r\n'));

describe('text review evidence across checkouts', () => {
  it('preserves existing LF and CRLF review hashes in either checkout', () => {
    expect(hashEvidenceText(unix)).toBe(hashEvidenceText(windows));
    for (const bytes of [unix, windows])
      for (const legacy of [rawHash(unix), rawHash(windows)])
        expect(matchesEvidenceText(bytes, legacy)).toBe(true);
  });

  it('rejects changed geometry evidence, text, formatting and missing hashes', () => {
    for (const changed of [
      unix.toString().replace('0.17', '0.18'),
      unix.toString().replace('Kõpu', 'Kopu'),
      unix.toString().replace('  ', '    '),
      unix.toString().trimEnd(),
    ])
      expect(matchesEvidenceText(Buffer.from(changed), rawHash(unix))).toBe(false);
    expect(matchesEvidenceText(undefined, rawHash(unix))).toBe(false);
    expect(matchesEvidenceText(unix, undefined)).toBe(false);
  });
});
