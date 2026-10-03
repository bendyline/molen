import { createHash } from 'node:crypto';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const lf = (bytes) => bytes.toString('utf8').replaceAll('\r\n', '\n');

/** Only for UTF-8 evidence files. GLBs and rendered images must retain exact-byte hashes. */
export const hashEvidenceText = (bytes) => hash(lf(bytes));

/** Retain earlier raw-text reviews across Git's LF/CRLF checkout conversion.
 * Other whitespace, formatting and content changes still invalidate the review.
 */
export function matchesEvidenceText(bytes, expected) {
  if (!bytes || typeof expected !== 'string') return false;
  const normalized = lf(bytes);
  return [hash(bytes), hash(normalized), hash(normalized.replaceAll('\n', '\r\n'))].includes(
    expected,
  );
}
