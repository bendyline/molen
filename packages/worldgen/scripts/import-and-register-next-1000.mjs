/** Serialize shared index mutations across concurrent structure-authoring lanes. */
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { structureImportArgs } from './structure-collections.mjs';
import { root } from './structure-model-files.mjs';

const args = structureImportArgs(process.argv.slice(2));
const path = resolve(root, '.artifacts/structure-model-registration.lock');
await mkdir(resolve(root, '.artifacts'), { recursive: true });
let lock;
const started = Date.now();
while (!lock) {
  try {
    lock = await open(path, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (Date.now() - started > 120000) {
      const owner = await readFile(path, 'utf8').catch(() => '(unreadable owner)');
      throw new Error(
        `Registration lock still held: ${owner}. Inspect that process before clearing a stale lock.`,
      );
    }
    if (Date.now() - started < 1000)
      console.log('Waiting for the other structure registration to finish.');
    await delay(500);
  }
}
async function run(script) {
  const child = spawn(
    process.execPath,
    ['--max-old-space-size=8192', resolve(root, script), ...args],
    {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  if (exitCode !== 0)
    throw new Error(`${script} exited ${exitCode}; registration sequence stopped.`);
}
try {
  await lock.writeFile(
    JSON.stringify({ pid: process.pid, ids: args[0].slice(6), started: new Date().toISOString() }),
  );
  await run('packages/worldgen/scripts/import-next-1000-models.mjs');
  await run('packages/worldgen-earth/scripts/register-landmark-previews.mjs');
} finally {
  await lock.close();
  await unlink(path);
}
