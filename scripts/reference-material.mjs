import { execFileSync } from 'node:child_process';

// Research references and raw source downloads: reference photos and scans, plans, scanned books,
// terrain source tiles. No generator reads them (the asset build's dependency records show it), so
// they are not build inputs and stay out of Git. reference-lock.json pins their bytes and
// `pnpm references:fetch` restores them (scripts/reference-packs.mjs, content/ASSET-PACKS.md).
// The text records beside them (rights notes, provenance JSON, scripts) stay in Git.
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

/** Whether a repository path is reference material that lives outside Git. */
export function isReferenceMaterial(path) {
  if (typeof path !== 'string' || !path.startsWith('content/')) return false;
  if (ANYWHERE.test(path)) return true;
  const parts = path.split('/');
  const name = parts.at(-1);
  return (
    parts.slice(1, -1).some((part) => DIRECTORIES.has(part)) &&
    name.includes('.') &&
    !TEXT.test(name)
  );
}

/** Tracked reference material, which must leave Git (git rm --cached) once it is pinned. */
export function trackedReferenceMaterial(root) {
  const paths = execFileSync('git', ['ls-files', '--cached', '-z', '--', 'content'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 ** 2,
  });
  return paths.split('\0').filter(isReferenceMaterial);
}

export function checkTrackedReferenceMaterial({ root, log = console.log }) {
  const tracked = trackedReferenceMaterial(root);
  if (tracked.length)
    throw new Error(
      `Reference material must stay out of Git (${tracked.length} tracked):\n${tracked.slice(0, 20).join('\n')}${tracked.length > 20 ? `\n… ${tracked.length - 20} more` : ''}\nPin it with pnpm references:pack, then untrack it: pnpm references:untrack prints the command. See content/ASSET-PACKS.md.`,
    );
  log('Verified that no reference material is tracked in Git.');
}
