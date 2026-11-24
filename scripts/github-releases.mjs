// Release lookups shared by the publish scripts. `gh` is each script's runner: it takes the
// arguments of one GitHub CLI call and returns its standard output.

/**
 * Every release of a repository as {id, tag_name, draft}, drafts included when the credentials can
 * see them. GitHub lists a release with all its attachments, about 1.7 KB each, so the whole
 * listing grows by hundreds of kilobytes per asset bundle and overflows a child process buffer
 * (`spawnSync gh ENOBUFS`). gh applies the filter before printing: one line per release.
 */
export function listReleases(gh, repository) {
  return gh([
    'api',
    '--paginate',
    '--jq',
    '.[] | {id, tag_name, draft} | tojson',
    `repos/${repository}/releases?per_page=100`,
  ])
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}
