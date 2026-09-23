import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import catalog from '../asset-src/catalog.json';
import report from '../asset-src/import-report.json';
import project from '../project.json';
import { verifyAssets } from '../tools/verify-assets.mjs';

const fixtures: string[] = [];
afterEach(async () => {
  for (const root of fixtures.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture(): Promise<{ root: string; source: string; runtime: string }> {
  await mkdir(resolve('.tmp'), { recursive: true });
  const root = await mkdtemp(join(resolve('.tmp'), 'molen-asset-files-'));
  fixtures.push(root);
  const asset = catalog.assets[0];
  if (!asset) throw new Error('No fixture asset');
  const entry = report.assets.find((item) => item.id === asset.id);
  if (!entry) throw new Error('Missing fixture import');
  const sidecar = entry.sidecar;
  const runtime = sidecar.replace('asset.json', 'model.glb');
  for (const path of [asset.source, sidecar, runtime]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await cp(resolve(path), join(root, path));
  }
  await writeFile(join(root, 'asset-src/catalog.json'), JSON.stringify({ assets: [asset] }));
  await writeFile(join(root, 'asset-src/import-report.json'), JSON.stringify({ assets: [entry] }));
  await writeFile(
    join(root, 'project.json'),
    JSON.stringify({ ...project, assets: { [asset.id]: sidecar } }),
  );
  return { root, source: asset.source, runtime };
}

it('verifies an editing master and its matching published copy with Node alone', async () => {
  const { root } = await fixture();
  expect(await verifyAssets({ root })).toMatchObject({ ok: true, count: 1, errors: [] });
});
it('reports an edited master that has not been reimported', async () => {
  const { root, source } = await fixture();
  const path = join(root, source);
  await writeFile(path, Buffer.concat([await readFile(path), Buffer.from('edited')]));
  expect((await verifyAssets({ root })).errors.join('\n')).toContain('editing master changed');
});
it('rejects a missing published GLB', async () => {
  const { root, runtime } = await fixture();
  await rm(join(root, runtime));
  expect((await verifyAssets({ root })).ok).toBe(false);
});
it('compares built assets against the repo copies to catch stale deployments', async () => {
  const { root, runtime } = await fixture();
  const built = join(root, 'dist', runtime.replace('public/', ''));
  await mkdir(dirname(built), { recursive: true });
  await cp(join(root, runtime), built);
  expect((await verifyAssets({ root, builtDir: 'dist' })).ok).toBe(true);
  await writeFile(built, 'stale');
  expect((await verifyAssets({ root, builtDir: 'dist' })).errors.join('\n')).toContain(
    'built model differs',
  );
});

it('imports a hand-edited master while retaining the generator baseline', async () => {
  const { root, source } = await fixture();
  const original = await readFile(join(root, source));
  const jsonLength = original.readUInt32LE(12);
  const gltf = JSON.parse(original.subarray(20, 20 + jsonLength).toString('utf8'));
  gltf.asset.extras = { authoringNote: 'Edited in a 3D editor' };
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const rest = original.subarray(20 + jsonLength);
  const header = Buffer.from(original.subarray(0, 20));
  header.writeUInt32LE(20 + padded.length + rest.length, 8);
  header.writeUInt32LE(padded.length, 12);
  await writeFile(join(root, source), Buffer.concat([header, padded, rest]));
  await mkdir(join(root, 'tools'));
  await cp(resolve('tools/import-assets.mjs'), join(root, 'tools/import-assets.mjs'));
  await promisify(execFile)(process.execPath, [join(root, 'tools/import-assets.mjs')]);
  const imported = JSON.parse(await readFile(join(root, 'asset-src/import-report.json'), 'utf8'))
    .assets[0];
  expect(imported.sourceEdited).toBe(true);
  expect(imported.sourceSha256).not.toBe(imported.generatedSourceSha256);
  expect(await verifyAssets({ root })).toMatchObject({ ok: true, errors: [] });
});
