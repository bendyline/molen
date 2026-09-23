// Public Molen operations: build once, then `node tools/import-assets.mjs`.

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importAsset, inspectAsset, reserveNamespace } from '@bendyline/molen-tooling';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectPath = resolve(root, 'project.json');
const catalog = JSON.parse(await readFile(resolve(root, 'asset-src/catalog.json'), 'utf8'));
const reservation = await reserveNamespace({
  projectPath,
  namespace: 'lantern',
  owner: 'molen.examples.lantern-dungeon',
  note: 'Original Lantern Vault dungeon art collection',
});
if (!reservation.ok) throw new Error(reservation.error);
const report = [];
for (const asset of catalog.assets) {
  const source = await readFile(resolve(root, asset.source));
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  const imported = await importAsset({
    path: resolve(root, asset.source),
    id: asset.id,
    projectPath,
    outDir: resolve(root, 'public/assets'),
    force: true,
  });
  if (!imported.ok) throw new Error(`${asset.id}: ${imported.error}`);
  const inspected = await inspectAsset({ ref: asset.id, projectPath, verify: true });
  if (!inspected.ok || !inspected.verified) throw new Error(JSON.stringify(inspected));
  const s = inspected.sidecar;
  const model = resolve(dirname(inspected.sidecarPath), s.files.main);
  report.push({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    description: asset.description,
    source: asset.source,
    sourceBytes: source.length,
    sourceSha256,
    generatedSourceSha256: asset.sourceSha256,
    sourceEdited: sourceSha256 !== asset.sourceSha256,
    clips: s.animations.map((clip) => clip.name),
    importedBytes: (await stat(model)).size,
    importedHash: s.hash,
    stats: s.stats,
    bounds: s.bounds,
    verified: true,
    warnings: imported.warnings ?? [],
    sidecar: relative(root, inspected.sidecarPath).replaceAll('\\', '/'),
  });
  console.log(`Verified ${asset.id}`);
}
await writeFile(
  resolve(root, 'asset-src/import-report.json'),
  `${JSON.stringify({ assets: report }, null, 2)}\n`,
);
console.log(
  `Imported and hash-verified ${report.length} assets; ${(report.reduce((n, a) => n + a.importedBytes, 0) / 1048576).toFixed(2)} MiB.`,
);
// The gallery uses normalized display sizes; game instances retain their authored meter scale.
const gallery = {
  format: 'molen/scene@3',
  name: 'lantern-asset-gallery',
  seed: 'lantern-art-1',
  tickRate: 30,
  camera: { mode: 'fixed', position: [10, 13, -24], lookAt: [0, 0, 0], fov: 48 },
  entities: [
    {
      id: 'environment',
      components: {
        environment: {
          background: '#20323d',
          ambient: { sky: '#d1e3e7', ground: '#69757c', intensity: 2 },
          sun: { direction: [-8, 20, -12], intensity: 3, color: '#ffe5bf', castShadow: true },
          shadows: 'medium',
          toneMapping: 'aces',
          exposure: 1.1,
        },
      },
    },
    {
      id: 'ground',
      components: {
        transform: { pos: [0, -0.2, 0], rot: [0, 0, 0, 1] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          primitive: { size: [27, 0.2, 23] },
          materialRef: 'palette:#394d5b',
          shadows: { cast: false, receive: true },
        },
      },
    },
  ],
};
for (const [i, a] of report.entries()) {
  const bounds = a.bounds.aabb;
  const scale = 2.15 / Math.max(...bounds.max.map((v, j) => v - bounds.min[j]));
  const x = ((i % 6) - 2.5) * 3.5;
  const z = (Math.floor(i / 6) - 2) * 3.5;
  gallery.entities.push({
    id: `plinth-${a.name}`,
    components: {
      transform: { pos: [x, -0.045, z], rot: [0, 0, 0, 1] },
      renderable: {
        kind: 'primitive',
        ref: 'box',
        primitive: { size: [2.8, 0.09, 2.8] },
        materialRef: 'palette:#6b7d83',
        shadows: { cast: true, receive: true },
      },
    },
  });
  gallery.entities.push({
    id: a.name,
    components: {
      transform: {
        pos: [x, -bounds.min[1] * scale, z],
        rot: [0, 0, 0, 1],
        scale: [scale, scale, scale],
      },
      renderable: {
        kind: 'gltf',
        ref: a.id,
        shadows: { cast: true, receive: true },
        ...(a.clips.includes('idle') ? { animation: { clip: 'idle', loop: 'repeat' } } : {}),
      },
    },
  });
}
await writeFile(resolve(root, 'asset-gallery.json'), `${JSON.stringify(gallery, null, 2)}\n`);
const project = JSON.parse(await readFile(projectPath, 'utf8'));
project.scenes.gallery = 'asset-gallery.json';
await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`);
