import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const versionFile = new URL('../.node-version', import.meta.url);
const major = (version) => version.replace(/^v/, '').split('.')[0];

// CI and Release install the exact version in .node-version; locally any release of the same
// major is accepted, since a Node major stays on one V8 line and the hash drift is between majors.
export function checkNodeVersion(
  actual = process.versions.node,
  expected = readFileSync(versionFile, 'utf8').trim(),
) {
  if (major(actual) !== major(expected)) {
    throw new Error(
      `Repository checks require Node ${major(expected)}.x; found ${actual}. ` +
        `Use the version in ${fileURLToPath(versionFile)} (${expected}) before building or testing. ` +
        'Pinned simulation hashes include native math and can differ between Node/V8 versions. ' +
        'Published packages still support Node >=22.13; CI checks Node 22 in the packed-install job.',
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    checkNodeVersion();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
