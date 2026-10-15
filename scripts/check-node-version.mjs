import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const versionFile = new URL('../.node-version', import.meta.url);

export function checkNodeVersion(
  actual = process.versions.node,
  expected = readFileSync(versionFile, 'utf8').trim(),
) {
  if (actual !== expected) {
    throw new Error(
      `Repository checks require Node ${expected}; found ${actual}. ` +
        `Use the version in ${fileURLToPath(versionFile)} before building or testing. ` +
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
