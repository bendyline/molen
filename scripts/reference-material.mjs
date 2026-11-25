import { execFileSync } from 'node:child_process';

// Research references and raw source downloads: reference photos and scans, plans, scanned books,
// terrain source tiles, and the verbatim text of a document. No generator reads them (the asset
// build's dependency records show it), so they are not build inputs. They are scratch: Git ignores
// them, nothing keeps or publishes them, and no check needs them. What stays in Git is the record of
// them: where each came from, when it was read, what was taken from it and what its license said
// (content/ASSET-PACKS.md).
//
// Keep this in step with the reference block at the top of .gitignore. Both are case-sensitive,
// as Git's ignore rules are on Linux.
const DIRECTORIES = new Set([
  'references',
  'reference-images',
  'reference-originals',
  'terrain-sources',
]);
const ANYWHERE = /\.(?:pdf|tiff?)$/;
const TEXT = /\.(?:json|md|txt|py|mjs|js|csv|html?|xml|tfw|prj|asc|ya?ml|geojson|svg)$/;
// The verbatim text of a report, paper or specification is a copy of it, like its PDF: the facts read
// from it stay in Git with its URL and hash, the copy does not. A name that starts with a year is a
// transcribed title page or credit of an old printed work, which is rights evidence and stays.
const VERBATIM = /^original-(?![12]\d{3}-)[\w.-]*\.txt$/;

/** Whether a repository path is reference material that lives outside Git. */
export function isReferenceMaterial(path) {
  if (typeof path !== 'string' || !path.startsWith('content/')) return false;
  if (ANYWHERE.test(path)) return true;
  const parts = path.split('/');
  const name = parts.at(-1);
  if (parts.at(-2) === 'reference-rights' && VERBATIM.test(name)) return true;
  return (
    parts.slice(1, -1).some((part) => DIRECTORIES.has(part)) &&
    name.includes('.') &&
    !TEXT.test(name)
  );
}

/** Tracked reference material that is still on disk: deleting it is how it leaves Git. */
export function trackedReferenceMaterial(root) {
  const list = (...options) =>
    execFileSync('git', ['ls-files', '-z', ...options, '--', 'content'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 ** 2,
    })
      .split('\0')
      .filter(isReferenceMaterial);
  const deleted = new Set(list('--deleted'));
  return list('--cached').filter((path) => !deleted.has(path));
}

export function checkTrackedReferenceMaterial({ root, log = console.log }) {
  const tracked = trackedReferenceMaterial(root);
  if (tracked.length)
    throw new Error(
      `Reference material must stay out of Git (${tracked.length} tracked):\n${tracked.slice(0, 20).join('\n')}${tracked.length > 20 ? `\n… ${tracked.length - 20} more` : ''}\nRecord its URL, date, license and the facts taken from it, then remove the copy from Git (git rm --cached). See content/ASSET-PACKS.md.`,
    );
  log('Verified that no reference material is tracked in Git.');
}
