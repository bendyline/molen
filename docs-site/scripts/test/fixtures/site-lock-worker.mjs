import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withSiteLock } from '../../site-lock.mjs';

const [siteDir, mode] = process.argv.slice(2);
const page = join(siteDir, 'client.md');
await withSiteLock(
  siteDir,
  async () => {
    if (mode === 'generate') {
      await rm(page);
      await writeFile(page, 'regenerated');
    }
    process.send('acquired');
    await new Promise((resolve) => process.once('message', resolve));
    if (mode === 'build') assert.equal(await readFile(page, 'utf8'), 'original');
  },
  { log: () => process.send('waiting') },
);
process.disconnect();
