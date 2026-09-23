import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildWorld, componentHandle } from '@bendyline/molen-kernel';
import { inspectAsset } from '@bendyline/molen-tooling';
import { expect, it } from 'vitest';
import catalog from '../asset-src/catalog.json';
import report from '../asset-src/import-report.json';
import project from '../project.json';
import { scene } from '../src/scene';
import { verifyAssets } from '../tools/verify-assets.mjs';

it('ships 28 used, self-contained models with matching source and imported hashes', async () => {
  const verification = await verifyAssets();
  expect(verification.errors).toEqual([]);
  const world = buildWorld(scene());
  const refs = new Set<string>();
  for (const [, r] of world.query(componentHandle('renderable'))) {
    if (r.kind === 'gltf') refs.add(String(r.ref));
  }
  expect([...refs].sort()).toEqual(catalog.assets.map((a) => a.id).sort());
  expect(Object.keys(project.assets)).toHaveLength(28);
  let bytes = 0;
  for (const a of catalog.assets) {
    const result = await inspectAsset({
      ref: a.id,
      projectPath: resolve('project.json'),
      verify: true,
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.verified).toBe(true);
    const sidecar = result.sidecar;
    if (!sidecar || !result.sidecarPath) throw new Error(`No sidecar for ${a.id}`);
    const source = await readFile(resolve(a.source));
    const hash = createHash('sha256').update(source).digest('hex');
    expect(hash).toBe(report.assets.find((entry) => entry.id === a.id)?.sourceSha256);
    expect(sidecar.sourceHash).toBe(`sha256:${hash}`);
    const model = await readFile(resolve(dirname(result.sidecarPath), sidecar.files.main));
    bytes += model.length;
    const gltf = JSON.parse(model.subarray(20, 20 + model.readUInt32LE(12)).toString('utf8'));
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.buffers.every((b: { uri?: string }) => b.uri === undefined)).toBe(true);
    expect(
      (gltf.images ?? []).every((i: { bufferView?: number }) => i.bufferView !== undefined),
    ).toBe(true);
    expect(sidecar.stats.triangles).toBeGreaterThan(0);
    expect(sidecar.stats.triangles).toBeLessThan(6500);
    if (a.category === 'mob') expect(sidecar.animations.some((c) => c.name === 'idle')).toBe(true);
  }
  expect(bytes).toBeLessThan(6 * 1024 * 1024);
});
