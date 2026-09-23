import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type AssetProvider, MaterialResolver } from '@bendyline/molen-client';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createResolvedMaterialSet } from '../../src/client/materials';
import { resolveStylePackDocuments, stylePackMaterialRefs } from '../../src/kernel/stylepack';
import '../../src/kernel';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../packs/default');

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(packDir, path), 'utf8'));
}

const pack = await resolveStylePackDocuments(await readJson('stylepack.json'), readJson);

/** File-backed provider: material ids resolve through the pack's material map. */
const provider: AssetProvider = {
  async load(ref: string): Promise<ArrayBuffer> {
    const bytes = await readFile(resolve(packDir, ref));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  },
  async loadText(ref: string): Promise<string> {
    const path = pack.root.materials[ref];
    if (path === undefined) throw new Error(`unknown material ${ref}`);
    return readFile(resolve(packDir, path), 'utf8');
  },
};

describe('resolved material set', () => {
  it('bakes every pack material once with vertex colors and repeat wrapping', async () => {
    const resolver = new MaterialResolver(provider);
    const set = createResolvedMaterialSet(resolver);
    const refs = stylePackMaterialRefs(pack);
    await Promise.all([set.prepare(refs), set.prepare(refs)]);
    expect(set.failures.size).toBe(0);
    const wall = set.materialFor(
      'wall',
      'matgraph:molen.worldgen.material.siding_lap',
    ) as THREE.MeshStandardMaterial;
    expect(wall.vertexColors).toBe(true);
    expect(wall.map).not.toBeNull();
    expect(wall.map?.wrapS).toBe(THREE.RepeatWrapping);
    expect(wall.map?.wrapT).toBe(THREE.RepeatWrapping);
    expect(wall.map?.generateMipmaps).toBe(true);
    expect(wall.map?.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(set.materialFor('roof', 'matgraph:molen.worldgen.material.siding_lap')).toBe(wall);
    const window = set.materialFor(
      'window',
      'matgraph:molen.worldgen.material.window_punched',
    ) as THREE.MeshStandardMaterial;
    expect(window.roughnessMap).not.toBeNull();
    const flat = set.materialFor('trim', 'palette:#ffffff') as THREE.MeshStandardMaterial;
    expect(flat.map).toBeNull();
    expect(flat.vertexColors).toBe(true);
    expect(set.materialFor('trim', 'palette:#ffffff')).toBe(flat);
    const unprepared = set.materialFor('wall', 'matgraph:not.prepared');
    expect(unprepared).toBe(set.materialFor('wall', 'palette:#ffffff'));
    set.dispose();
    expect(wall.map?.image).toBeDefined();
  }, 60_000); // Prepare the full shared 45-material library, including normal/PBR maps.

  it('records failures instead of throwing and keeps rendering flat', async () => {
    const resolver = new MaterialResolver(undefined);
    const set = createResolvedMaterialSet(resolver);
    await set.prepare(['matgraph:molen.worldgen.material.stucco', 'palette:#ff0000']);
    expect(set.failures.size).toBe(0);
    const material = set.materialFor(
      'wall',
      'matgraph:molen.worldgen.material.stucco',
    ) as THREE.MeshStandardMaterial;
    expect(material.map).toBeNull();
    set.dispose();
  });
});
