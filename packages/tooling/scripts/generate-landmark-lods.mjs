import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModelLandmarkLods as buildLandmarkLods } from './authored-landmark-lods.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const one = process.argv.find((arg) => arg.startsWith('--one='))?.slice(6);
if (one) {
  const record = await buildLandmarkLods(resolve(root, one), {
    force: process.argv.includes('--force'),
  });
  console.log(JSON.stringify(record));
} else {
  const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'), 'utf8'));
  const ids = process.argv
    .find((arg) => arg.startsWith('--ids='))
    ?.slice(6)
    .toLowerCase()
    .split(',');
  const concurrency = Number(
    process.argv.find((arg) => arg.startsWith('--concurrency='))?.slice(14) ?? 3,
  );
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new Error('concurrency must be 1–8');
  const entries = Object.entries(pack.assets)
    .filter(
      ([id]) =>
        id.startsWith('molen.worldgen.structure.') &&
        (!ids || ids.some((part) => id.includes(part))),
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const directory = resolve(root, '.artifacts/landmark-lods');
  await mkdir(directory, { recursive: true });
  let cursor = 0,
    finished = 0;
  const failures = [];
  const outputs = [];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < entries.length) {
        const [id, path] = entries[cursor++];
        const args = [fileURLToPath(import.meta.url), `--one=content/worldgen/${path}`];
        if (process.argv.includes('--force')) args.push('--force');
        const result = await new Promise((accept) => {
          const child = spawn(process.execPath, args, {
            cwd: root,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '',
            stderr = '';
          child.stdout.on('data', (chunk) => {
            stdout += chunk;
          });
          child.stderr.on('data', (chunk) => {
            stderr += chunk;
          });
          child.on('error', (error) => accept({ code: 1, stderr: String(error), stdout }));
          child.on('close', (code) => accept({ code, stdout, stderr }));
        });
        if (result.code !== 0) {
          failures.push({ id, error: result.stderr || result.stdout });
          console.error(`${id}: FAILED ${result.stderr.slice(-500)}`);
        } else {
          const record = JSON.parse(result.stdout);
          outputs.push({ id, ...record });
          console.log(
            `${++finished}/${entries.length} ${id}: ${record.levels.map((level) => `${level.name} ${(level.bytes / 1000).toFixed(0)} KB`).join(', ')}`,
          );
        }
      }
    }),
  );
  await writeFile(
    resolve(directory, ids ? 'selected-build.json' : 'build.json'),
    `${JSON.stringify({ models: entries.length, completed: finished, seconds: (Date.now() - started) / 1000, failures, outputs }, null, 2)}\n`,
  );
  if (failures.length)
    throw new Error(`${failures.length} landmark LOD builds failed; see ${directory}`);
}
