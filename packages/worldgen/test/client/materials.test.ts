import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type AssetProvider, MaterialResolver } from '@bendyline/molen-client';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createResolvedMaterialSet } from '../../src/client/materials';
import { resolveStylePackDocuments, stylePackMaterialRefs } from '../../src/kernel/stylepack';
import '../../src/kernel';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../../../content/worldgen');

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
  it('keeps alpha-tested coverage maps linear without mipmaps while opaque maps use mipmaps', async () => {
    const mask = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255]),
      2,
      1,
    );
    mask.magFilter = THREE.LinearFilter;
    const opaque = mask.clone();
    const cutout = new THREE.MeshStandardMaterial({ map: mask, alphaTest: 0.3 });
    const solid = new THREE.MeshStandardMaterial({ map: opaque });
    const resolver = {
      acquire: vi.fn(async (ref: string) => (ref === 'matgraph:cutout' ? cutout : solid)),
      release: vi.fn(),
    };
    const set = createResolvedMaterialSet(resolver as unknown as MaterialResolver);
    await set.prepare(['matgraph:cutout', 'matgraph:opaque']);
    const result = set.materialFor('wall', 'matgraph:cutout') as THREE.MeshStandardMaterial;
    expect(result.alphaTest).toBe(0.3);
    expect(result.map).toBe(mask);
    expect(mask.generateMipmaps).toBe(false);
    expect(mask.minFilter).toBe(THREE.LinearFilter);
    expect(opaque.generateMipmaps).toBe(true);
    expect(opaque.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    set.dispose();
    mask.dispose();
    opaque.dispose();
    cutout.dispose();
    solid.dispose();
  });

  it('upgrades visible progressive materials in place without rebuilding geometry', async () => {
    let finish: ((material: THREE.MeshStandardMaterial) => void) | undefined;
    const resolver = {
      acquire: vi.fn(
        () =>
          new Promise<THREE.MeshStandardMaterial>((resolve) => {
            finish = resolve;
          }),
      ),
      release: vi.fn(),
    };
    const set = createResolvedMaterialSet(resolver as unknown as MaterialResolver, {
      progressive: true,
    });
    const ref = 'matgraph:brick';
    const material = set.materialFor('wall', ref) as THREE.MeshStandardMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const preparation = set.prepare([ref]);
    expect(material.map).toBeNull();
    expect(material.vertexColors).toBe(true);
    expect(set.materialFor('roof', ref)).toBe(material);
    const source = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughness: 0.4 });
    finish?.(source);
    await preparation;
    expect(mesh.material).toBe(material);
    expect(material.map).toBe(source.map);
    expect(material.roughness).toBe(0.4);
    expect(material.vertexColors).toBe(true);
    expect(material.map?.wrapS).toBe(THREE.RepeatWrapping);
    await set.prepare([ref]);
    expect(resolver.acquire).toHaveBeenCalledTimes(1);
    set.dispose();
    expect(resolver.release).toHaveBeenCalledExactlyOnceWith(source);
    mesh.geometry.dispose();
  });

  it('releases a bake that completes after the viewer is disposed', async () => {
    let finish: ((material: THREE.MeshStandardMaterial) => void) | undefined;
    const resolver = {
      acquire: () =>
        new Promise<THREE.MeshStandardMaterial>((resolve) => {
          finish = resolve;
        }),
      release: vi.fn(),
    };
    const set = createResolvedMaterialSet(resolver as unknown as MaterialResolver, {
      progressive: true,
    });
    const preparation = set.prepare(['matgraph:brick']);
    const placeholder = set.materialFor('wall', 'matgraph:brick') as THREE.MeshStandardMaterial;
    set.dispose();
    const source = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    finish?.(source);
    await preparation;
    expect(placeholder.map).toBeNull();
    expect(resolver.release).toHaveBeenCalledExactlyOnceWith(source);
  });

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
    expect(window.roughnessMap).toBeNull();
    expect(window.roughness).toBe(77 / 255);
    const flat = set.materialFor('trim', 'palette:#ffffff') as THREE.MeshStandardMaterial;
    expect(flat.map).toBeNull();
    expect(flat.vertexColors).toBe(true);
    expect(set.materialFor('trim', 'palette:#ffffff')).toBe(flat);
    const unprepared = set.materialFor('wall', 'matgraph:not.prepared');
    expect(unprepared).toBe(set.materialFor('wall', 'palette:#ffffff'));
    set.dispose();
    expect(wall.map?.image).toBeDefined();
  }, 60_000); // Prepare the shared procedural material library, including normal/PBR maps.

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
