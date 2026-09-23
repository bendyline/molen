import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate } from '@bendyline/molen-schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAssetIO } from '../src/ops/asset-import';
import { packedTextureSize, readKtx2Header } from '../src/ops/asset-pack';
import { glbExtensionsUsed } from '../src/ops/asset-stage';
import {
  assetFileIndex,
  importAsset,
  inspectAsset,
  packAsset,
  scaffoldExperience,
  stageAssets,
} from '../src/ops/index';
import { loadProject } from '../src/project';
import { buildTexturedQuadGlb } from './fixtures/build-textured-glb';

// The design-time GLB (PNG textures) stays canonical; `pack` derives the runtime GLB (KTX2 +
// mips) as a sidecar variant, capture ops pick it via assetFileIndex, and `stage` ships it.

let dir: string;
let projectPath: string;
let sidecarPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-pack-'));
  const scaffold = await scaffoldExperience({ name: 'packdemo', dir });
  expect(scaffold.ok, scaffold.error).toBe(true);
  projectPath = join(scaffold.dir as string, 'project.json');
  const glbPath = join(dir, 'quad.glb');
  await writeFile(glbPath, await buildTexturedQuadGlb());
  const imported = await importAsset({ path: glbPath, id: 'props.quad', projectPath });
  expect(imported.ok, imported.error).toBe(true);
  sidecarPath = imported.sidecarPath as string;
}, 60_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('packedTextureSize', () => {
  it('snaps to the nearest power of two under the cap', () => {
    expect(packedTextureSize(20, 12, { maxSize: 2048, powerOfTwo: true })).toEqual([16, 16]);
    expect(packedTextureSize(1000, 500, { maxSize: 2048, powerOfTwo: true })).toEqual([1024, 512]);
    expect(packedTextureSize(4096, 4096, { maxSize: 2048, powerOfTwo: true })).toEqual([
      2048, 2048,
    ]);
    expect(packedTextureSize(4096, 1024, { maxSize: 1024, powerOfTwo: true })).toEqual([1024, 256]);
  });
  it('keeps multiples of four otherwise', () => {
    expect(packedTextureSize(30, 13, { maxSize: 2048, powerOfTwo: false })).toEqual([28, 12]);
  });
});

describe('asset pack (canonical GLB -> KTX2 runtime variant)', () => {
  it('encodes textures per slot, generates mips, records the variant, and the GLB parses', async () => {
    const r = await packAsset({ ref: 'props.quad', projectPath });
    expect(r.ok, r.error).toBe(true);
    const packed = (r.assets ?? [])[0] as NonNullable<typeof r.assets>[number];
    expect(packed.id).toBe('props.quad');
    expect(packed.variant).toBe('ktx2');
    expect(packed.path.endsWith('model.ktx2.glb')).toBe(true);
    expect((await stat(packed.path)).isFile()).toBe(true);

    // Slot-driven codec choice: sRGB baseColor -> ETC1S; normal map -> UASTC linear.
    const byName = Object.fromEntries(packed.textures.map((t) => [t.name, t]));
    expect(byName.albedo?.mode).toBe('etc1s');
    expect(byName.albedo?.colorSpace).toBe('srgb');
    expect(byName.albedo?.slots).toEqual(['baseColorTexture']);
    expect(byName.normal?.mode).toBe('uastc');
    expect(byName.normal?.colorSpace).toBe('linear');
    // 20x12 source -> 16x16 power of two with a full chain (16,8,4,2,1).
    for (const t of packed.textures) {
      expect(t.source).toMatchObject({ width: 20, height: 12, mimeType: 'image/png' });
      expect(t.packed).toMatchObject({ width: 16, height: 16, levels: 5 });
    }
    expect(packed.gpuBytesEstimate.compressed).toBeLessThan(packed.gpuBytesEstimate.rgba8);

    // The sidecar now lists the variant, main is untouched, and --verify still passes.
    const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
    expect(validate('asset', sidecar).ok).toBe(true);
    expect(sidecar.files.variants).toEqual({ ktx2: 'model.ktx2.glb' });
    const verified = await inspectAsset({ ref: sidecarPath, verify: true });
    expect(verified.ok, (verified.verifyErrors ?? []).join('\n')).toBe(true);

    // The variant GLB is a valid glTF with KHR_texture_basisu + KTX2 images (mips inside).
    const glb = new Uint8Array(await readFile(packed.path));
    expect(glbExtensionsUsed(glb)).toContain('KHR_texture_basisu');
    const io = await createAssetIO();
    const doc = await io.readBinary(glb);
    const textures = doc.getRoot().listTextures();
    expect(textures).toHaveLength(2);
    for (const texture of textures) {
      expect(texture.getMimeType()).toBe('image/ktx2');
      const header = readKtx2Header(texture.getImage() as Uint8Array);
      expect(header).toEqual({ width: 16, height: 16, levels: 5 });
    }
  }, 60_000);

  it('feeds capture ops through assetFileIndex only when the variant is requested', async () => {
    const project = await loadProject(projectPath);
    const plain = await assetFileIndex(project);
    const runtime = await assetFileIndex(project, { variant: 'ktx2' });
    expect(plain['props.quad']).toBe('assets/props/quad/model.glb');
    expect(runtime['props.quad']).toBe('assets/props/quad/model.ktx2.glb');
    // Unknown variants fall back to main rather than failing.
    expect((await assetFileIndex(project, { variant: 'nope' }))['props.quad']).toBe(
      'assets/props/quad/model.glb',
    );
  });

  it('rejects a bad ref and a non-file-safe variant name', async () => {
    expect((await packAsset({ ref: 'missing.asset', projectPath })).ok).toBe(false);
    const bad = await packAsset({ ref: 'props.quad', projectPath, variant: 'KTX 2' });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('lower_snake');
  });

  it('--all packs every registered asset', async () => {
    const r = await packAsset({ all: true, projectPath, variant: 'mobile', maxSize: 8 });
    expect(r.ok, r.error).toBe(true);
    expect(r.assets?.map((a) => a.id)).toEqual(['props.quad']);
    // 20x12 capped at 8 keeps the aspect: 8x5 -> power of two 8x4, chain 8,4,2,1.
    expect(r.assets?.[0]?.textures[0]?.packed).toMatchObject({ width: 8, height: 4, levels: 4 });
    const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
    expect(Object.keys(sidecar.files.variants).sort()).toEqual(['ktx2', 'mobile']);
  }, 60_000);
});

describe('asset stage (runtime bundle for the browser)', () => {
  it('stages the packed variant with a rewritten, verifiable sidecar and an id -> URL index', async () => {
    const outDir = join(dir, 'dist-assets');
    const r = await stageAssets({ projectPath, outDir, variant: 'ktx2' });
    expect(r.ok, r.error).toBe(true);
    expect(r.index).toEqual({ 'props.quad': 'assets/props/quad/model.ktx2.glb' });
    expect(r.assets?.[0]).toMatchObject({ id: 'props.quad', variant: 'ktx2' });
    const index = JSON.parse(await readFile(join(outDir, 'assets.index.json'), 'utf8'));
    expect(index).toEqual(r.index);

    // No design-time GLB ships; the staged sidecar describes the packed file and verifies.
    await expect(stat(join(outDir, 'assets/props/quad/model.glb'))).rejects.toThrow();
    const stagedSidecarPath = join(outDir, 'assets/props/quad/asset.json');
    const staged = JSON.parse(await readFile(stagedSidecarPath, 'utf8'));
    expect(staged.files).toEqual({ main: 'model.ktx2.glb', variants: {} });
    expect(staged.extensionsUsed).toContain('KHR_texture_basisu');
    const verified = await inspectAsset({ ref: stagedSidecarPath, verify: true });
    expect(verified.ok, (verified.verifyErrors ?? []).join('\n')).toBe(true);
  });

  it('falls back to the main GLB (with a warning) or fails when the variant is required', async () => {
    const outDir = join(dir, 'dist-plain');
    const r = await stageAssets({ projectPath, outDir, variant: 'desktop' });
    expect(r.ok, r.error).toBe(true);
    expect(r.index).toEqual({ 'props.quad': 'assets/props/quad/model.glb' });
    expect(r.warnings?.[0]).toContain('no "desktop" variant');
    const strict = await stageAssets({
      projectPath,
      outDir: join(dir, 'dist-strict'),
      variant: 'desktop',
      requireVariant: true,
    });
    expect(strict.ok).toBe(false);
  });

  it('refuses to clean a directory that is not a previous staging output', async () => {
    const outDir = join(dir, 'not-ours');
    await writeFile(join(dir, 'not-ours-marker'), '');
    await stageAssets({ projectPath, outDir });
    await rm(join(outDir, 'assets.index.json'));
    const r = await stageAssets({ projectPath, outDir, clean: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('refusing to clean');
  });
});
