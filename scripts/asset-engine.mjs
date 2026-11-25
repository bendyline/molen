#!/usr/bin/env node
// Generators that carve engine code into their models. Most engine code a generator calls (mesh
// builders, glTF encoding, material baking) is not an asset input: `inputs.version` in
// asset-build.json rebuilds everything when such a change should show. A job whose `engine` lists
// package entry points depends on that code's shapes instead: six landmarks carve their statues
// from packages/figures. For those,
//
//   - the sources behind each entry point are asset inputs, so a change names a new bundle, and
//   - the job's record is dropped once the compiled code it ran differs, so the job runs again.
//
// Without both, a build that happens to rerun the job changes its models under an unchanged name,
// and any other build keeps models of older code. The record follows the compiled code because
// that is what the generator ran; packages/*/dist cannot be an input, since Git does not hold it.
// Imports of other packages are not followed.
//
// `pnpm assets:build` runs this first (its `preassets:build` hook).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ENGINE_ENTRY, engineEntries, importClosure } from './asset-inputs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JOBS = '.artifacts/asset-build/jobs';

/** A digest of the compiled code a job's entry points run as, or undefined before a compile. */
export function engineDigest(root, job) {
  const hash = createHash('sha256');
  for (const entry of engineEntries(job)) {
    const [, name, path] = entry.match(ENGINE_ENTRY);
    const compiled = `packages/${name}/dist/${path}.mjs`;
    if (!existsSync(join(root, compiled))) return undefined;
    for (const file of importClosure(root, compiled, (base) => [base]))
      hash
        .update(`${file}\0`)
        .update(readFileSync(join(root, file)))
        .update('\0');
  }
  return hash.digest('hex');
}

/** Drop the records of jobs that ran other engine code than is compiled now; returns their ids. */
export async function expireEngineJobs(root = ROOT, { log = console.log } = {}) {
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  const expired = [];
  for (const job of [...plan.generators, ...(plan.afterImport ?? [])]) {
    if (!engineEntries(job).length) continue;
    const digest = engineDigest(root, job);
    const record = join(root, JOBS, `${job.id}.json`);
    const noted = join(root, JOBS, `${job.id}.engine.json`);
    let ran;
    try {
      ran = JSON.parse(await readFile(noted, 'utf8')).digest;
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    if (digest !== undefined && ran === digest) continue;
    if (existsSync(record)) {
      await rm(record);
      expired.push(job.id);
      log(`${job.id} runs again: the engine code it uses (${job.engine.join(', ')}) changed.`);
    }
    // The record the next run of the job leaves was made by this code, whenever that is.
    await mkdir(dirname(noted), { recursive: true });
    if (digest === undefined) await rm(noted, { force: true });
    else await writeFile(noted, `${JSON.stringify({ digest })}\n`);
  }
  return expired;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  expireEngineJobs().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
