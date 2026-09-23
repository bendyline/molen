// Run with Node only. Playing the examples never needs Python or an asset-generation service.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectAsset } from '@bendyline/molen-tooling';

const exampleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function verifyAssets({ root = exampleRoot, builtDir } = {}) {
  const errors = [];
  let count = 0;
  let runtimeBytes = 0;
  try {
    const catalog = JSON.parse(await readFile(resolve(root, 'asset-src/catalog.json'), 'utf8'));
    const report = JSON.parse(
      await readFile(resolve(root, 'asset-src/import-report.json'), 'utf8'),
    );
    const project = JSON.parse(await readFile(resolve(root, 'project.json'), 'utf8'));
    const ids = catalog.assets.map((asset) => asset.id).sort();
    if (new Set(ids).size !== ids.length) errors.push('Duplicate source asset IDs.');
    for (const [name, actual] of [
      ['project', Object.keys(project.assets)],
      ['import report', report.assets.map((asset) => asset.id)],
    ]) {
      if (JSON.stringify(actual.sort()) !== JSON.stringify(ids))
        errors.push(`${name} IDs differ from the source catalog.`);
    }
    for (const asset of catalog.assets) {
      try {
        const imported = report.assets.find((entry) => entry.id === asset.id);
        if (!imported) throw new Error('Missing import report entry.');
        const result = await inspectAsset({
          ref: asset.id,
          projectPath: resolve(root, 'project.json'),
          verify: true,
        });
        if (!result.ok || !result.verified)
          throw new Error(
            result.error ?? result.verifyErrors?.join('; ') ?? 'Runtime hash verification failed.',
          );
        const sidecar = result.sidecar;
        const source = await readFile(resolve(root, asset.source));
        const sourceHash = sha256(source);
        if (
          sidecar.sourceHash !== `sha256:${sourceHash}` ||
          imported.sourceSha256 !== sourceHash ||
          imported.sourceBytes !== source.length
        ) {
          errors.push(`${asset.id}: editing master changed; run pnpm assets:import.`);
        }
        if (imported.importedHash !== sidecar.hash)
          errors.push(`${asset.id}: import report is stale; run pnpm assets:import.`);
        const modelPath = resolve(dirname(result.sidecarPath), sidecar.files.main);
        const publicPath = relative(resolve(root, 'public'), modelPath);
        const expectedPath = `assets/${asset.id.replaceAll('.', '/')}/model.glb`;
        if (publicPath.split(sep).join('/') !== expectedPath)
          errors.push(
            `${asset.id}: runtime model is not at its default browser URL (${expectedPath}).`,
          );
        const model = await readFile(modelPath);
        runtimeBytes += model.length;
        if (builtDir !== undefined) {
          const served = await readFile(resolve(root, builtDir, expectedPath));
          if (`sha256:${sha256(served)}` !== sidecar.hash)
            errors.push(`${asset.id}: built model differs from public/assets; rebuild the game.`);
        }
        count++;
      } catch (error) {
        errors.push(`${asset.id}: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { ok: errors.length === 0, count, runtimeBytes, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--built')) {
    console.error('Usage: node tools/verify-assets.mjs [--built dist]');
    process.exitCode = 1;
  } else {
    const result = await verifyAssets({ builtDir: args[1] });
    if (result.ok)
      console.log(
        `Verified ${result.count} editing masters and runtime models${args[1] ? ' including the built app' : ''} (${result.runtimeBytes} bytes).`,
      );
    else {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
    }
  }
}
