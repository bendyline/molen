import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const versionFile = new URL('../.node-version', import.meta.url);
const major = (version) => version.replace(/^v/, '').split('.')[0];

// Only the major matters: a Node release line keeps one V8 line, and V8 is what decides the bits
// of native transcendentals (dmath re-exports them) that pinned simulation hashes depend on.
export function checkNodeVersion(
  actual = process.versions.node,
  expected = readFileSync(versionFile, 'utf8').trim(),
) {
  if (major(actual) !== major(expected)) {
    throw new Error(
      `Repository tests expect Node ${major(expected)}.x; found ${actual}. ` +
        `Use the major version in ${fileURLToPath(versionFile)} before testing. ` +
        'Pinned simulation hashes include native math, which can differ between Node/V8 major versions. ' +
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
