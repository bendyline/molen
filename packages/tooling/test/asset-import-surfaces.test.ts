import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructureModelLibrary } from '../../worldgen/src/client/structure-models';
import { encodeGlb, type GlbSharedSurface } from '../../worldgen/src/kernel/glb';
import { MeshBufferBuilder } from '../../worldgen/src/kernel/mesh-buffers';
import { createAssetIO, importAsset } from '../src/ops/asset-import';
import { buildTexturedQuadGlb } from './fixtures/build-textured-glb';

const temps: string[] = [];
afterEach(async () => {
  for (const path of temps.splice(0)) await rm(path, { recursive: true, force: true });
});

describe('asset import shared-surface contract', () => {
  it.each([
    true,
    false,
  ])('preserves opt-in metadata and repeat UVs through import (optimize=%s)', async (optimize) => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-surface-import-'));
    temps.push(dir);
    const surface: GlbSharedSurface = {
      ref: 'matgraph:molen.worldgen.material.wood_planks',
      slot: 'wall',
      uv: 'repeats',
    };
    const builder = new MeshBufferBuilder();
    builder.addTriangle(
      'wall',
      'palette:#ffffff',
      [
        [0, 0, 0],
        [4, 0, 0],
        [0, 2, 0],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [4, 0],
        [0, 2],
      ],
      [0.8, 0.6, 0.4],
    );
    const path = join(dir, 'surface.glb');
    await writeFile(
      path,
      encodeGlb(builder.finalize(), [{ name: 'shared wood', sharedSurface: surface }]),
    );
    const imported = await importAsset({ path, outDir: join(dir, 'assets'), cwd: dir, optimize });
    expect(imported.ok, imported.error).toBe(true);
    expect(
      imported.warnings?.some((warning) =>
        warning.includes(`external runtime dependencies: ${surface.ref}`),
      ),
    ).toBe(true);
    const bytes = await readFile(join(imported.dir as string, 'model.glb'));
    const scene = (await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '')).scene;
    let sourceMesh: THREE.Mesh | undefined;
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) sourceMesh ??= object as THREE.Mesh;
    });
    if (!sourceMesh) throw new Error('imported fixture lost its mesh');
    const material = sourceMesh.material as THREE.MeshStandardMaterial;
    expect(material.userData.molenSurface).toEqual(surface);
    const uv = sourceMesh.geometry.getAttribute('uv');
    const coordinates = Array.from({ length: uv.count }, (_, index) => [
      uv.getX(index),
      uv.getY(index),
    ]);
    expect(Math.max(...coordinates.map((point) => point[0] as number))).toBeCloseTo(4, 3);
    expect(Math.max(...coordinates.map((point) => point[1] as number))).toBeCloseTo(2, 3);
    const sharedTexture = new THREE.Texture();
    const shared = new THREE.MeshStandardMaterial({ map: sharedTexture, vertexColors: true });
    const resolveSurface = vi.fn(() => shared);
    const library = new StructureModelLibrary(async () => scene, { resolveSurface });
    await library.acquire('imported');
    expect(resolveSurface).toHaveBeenCalledExactlyOnceWith(surface);
    expect(sourceMesh.material).toBe(shared);
    expect((sourceMesh.material as THREE.MeshStandardMaterial).map).toBe(sharedTexture);
    library.dispose();
    sharedTexture.dispose();
    shared.dispose();
  });

  it('still prunes unused UVs on unbound and invalid-metadata primitives in the same model', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-surface-import-'));
    temps.push(dir);
    const io = await createAssetIO();
    const doc = await io.readBinary(await buildTexturedQuadGlb());
    const mesh = doc.getRoot().listMeshes()[0];
    const original = mesh?.listPrimitives()[0];
    if (!mesh || !original) throw new Error('fixture missing mesh');
    const surfaces = [
      { ref: 'matgraph:valid', slot: 'wall', uv: 'repeats' },
      undefined,
      { ref: 'matgraph:invalid', slot: ['wall'], uv: 'repeats' },
    ];
    for (const [index, surface] of surfaces.entries()) {
      const material = doc.createMaterial(`material-${index}`);
      if (surface) material.setExtras({ molenSurface: surface });
      const primitive = original.clone().setMaterial(material);
      mesh.addPrimitive(primitive);
    }
    mesh.removePrimitive(original);
    original.dispose();
    const path = join(dir, 'mixed.glb');
    await writeFile(path, await io.writeBinary(doc));
    const imported = await importAsset({ path, outDir: join(dir, 'assets'), cwd: dir });
    expect(imported.ok, imported.error).toBe(true);
    const result = await io.read(join(imported.dir as string, 'model.glb'));
    const primitives = result
      .getRoot()
      .listMeshes()
      .flatMap((entry) => entry.listPrimitives());
    expect(primitives).toHaveLength(3);
    for (const primitive of primitives) {
      const metadata = primitive.getMaterial()?.getExtras().molenSurface as
        | { ref?: string }
        | undefined;
      expect(primitive.getAttribute('TEXCOORD_0') !== null).toBe(
        metadata?.ref === 'matgraph:valid',
      );
      expect(primitive.listSemantics().some((name) => name.startsWith('_MOLEN_SHARED_UV0'))).toBe(
        false,
      );
    }
    expect(imported.warnings?.find((warning) => warning.includes('shared surfaces'))).not.toContain(
      'matgraph:invalid',
    );
  });

  it.each([
    true,
    false,
  ])('retains unique fallback texture coordinates while reserving repeat UV0 (source UV0=%s)', async (withRepeatUvs) => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-surface-import-'));
    temps.push(dir);
    const io = await createAssetIO();
    const doc = await io.readBinary(await buildTexturedQuadGlb());
    const primitive = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
    const material = primitive?.getMaterial();
    const uv = primitive?.getAttribute('TEXCOORD_0');
    if (!primitive || !material || !uv) throw new Error('fixture missing material/UVs');
    primitive.setAttribute('TEXCOORD_1', uv);
    material.getBaseColorTextureInfo()?.setTexCoord(1);
    material.getNormalTextureInfo()?.setTexCoord(1);
    const repeat = uv.clone().setArray(new Float32Array([0, 0, 4, 0, 4, 2, 0, 2]));
    primitive.setAttribute('TEXCOORD_0', withRepeatUvs ? repeat : null);
    material.setExtras({ molenSurface: { ref: 'matgraph:wood', slot: 'wall', uv: 'repeats' } });
    const path = join(dir, 'texture-coordinates.glb');
    await writeFile(path, await io.writeBinary(doc));
    const imported = await importAsset({ path, outDir: join(dir, 'assets'), cwd: dir });
    expect(imported.ok, imported.error).toBe(true);
    const result = await io.read(join(imported.dir as string, 'model.glb'));
    const actual = result.getRoot().listMeshes()[0]?.listPrimitives()[0];
    if (!actual) throw new Error('imported fixture missing primitive');
    expect(actual.getAttribute('TEXCOORD_0') !== null).toBe(withRepeatUvs);
    expect(actual.getMaterial()?.getBaseColorTextureInfo()?.getTexCoord()).toBe(1);
    expect(actual.getMaterial()?.getNormalTextureInfo()?.getTexCoord()).toBe(1);
    expect(actual.getMaterial()?.getBaseColorTexture()?.getImage()).toBeDefined();
    const fallback = actual.getAttribute('TEXCOORD_1');
    expect(fallback).not.toBeNull();
    expect(fallback?.getMaxNormalized([0, 0])).toEqual([1, 1]);
    if (withRepeatUvs)
      expect(actual.getAttribute('TEXCOORD_0')?.getMaxNormalized([0, 0])).toEqual([4, 2]);
    expect(actual.listSemantics().some((name) => name.startsWith('_MOLEN_SHARED_UV0'))).toBe(false);
  });
});
