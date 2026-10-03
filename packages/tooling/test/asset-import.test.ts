import { mkdir, mkdtemp, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeCollisionTrimesh, validate } from '@bendyline/molen-schema';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  importAsset,
  inspectAsset,
  listAssets,
  scaffoldExperience,
  stageAssets,
} from '../src/ops/index';
import { buildCubeGlb } from './fixtures/build-glb';

let dir: string;
let glbPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-asset-'));
  glbPath = join(dir, 'crate.glb');
  await writeFile(glbPath, await buildCubeGlb());
});

describe('asset import (glTF -> asset@1 sidecar)', () => {
  it('keeps stable IDs in custom bundle directories through reimport, inspection and staging', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-asset-layout-'));
    const project = await scaffoldExperience({ name: 'layout', dir: parent });
    const projectDir = project.dir as string;
    const projectPath = join(projectDir, 'project.json');
    const relativeDir = 'assets/places/c2/c23/landmark';
    const first = await importAsset({
      path: glbPath,
      id: 'landmark.tower',
      projectPath,
      cwd: projectDir,
      assetDir: relativeDir,
      trimesh: true,
    });
    expect(first.ok, first.error).toBe(true);
    expect(first.dir).toBe(join(projectDir, relativeDir));
    const original = await readFile(first.sidecarPath as string);
    const ordinary = await importAsset({ path: glbPath, id: 'landmark.tower', projectPath });
    expect(ordinary.ok).toBe(false);
    expect(ordinary.error).toContain('already exists');
    const reimported = await importAsset({
      path: glbPath,
      id: 'landmark.tower',
      projectPath,
      force: true,
      trimesh: true,
    });
    expect(reimported.ok, reimported.error).toBe(true);
    expect(reimported.dir).toBe(first.dir);
    expect(await readFile(reimported.sidecarPath as string)).toEqual(original);
    const manifest = JSON.parse(await readFile(projectPath, 'utf8'));
    expect(manifest.assets['landmark.tower']).toBe(`${relativeDir}/asset.json`);
    await expect(stat(join(projectDir, 'assets/landmark/tower'))).rejects.toThrow();
    expect((await inspectAsset({ ref: 'landmark.tower', projectPath, verify: true })).ok).toBe(
      true,
    );
    const staged = await stageAssets({ projectPath, outDir: join(parent, 'served') });
    expect(staged.ok, staged.error).toBe(true);
    expect(staged.index?.['landmark.tower']).toBe(`${relativeDir}/model.glb`);
    expect(await readFile(join(parent, 'served', relativeDir, 'collision.bin'))).toEqual(
      await readFile(join(first.dir as string, 'collision.bin')),
    );
  });

  it('keeps explicit outDir root-plus-ID behavior for an already registered asset', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-asset-override-'));
    const project = await scaffoldExperience({ name: 'override', dir: parent });
    const projectPath = join(project.dir as string, 'project.json');
    const original = await importAsset({
      path: glbPath,
      id: 'landmark.tower',
      projectPath,
      assetDir: join(project.dir as string, 'assets/places/c2/tower'),
    });
    expect(original.ok, original.error).toBe(true);
    const root = join(project.dir as string, 'alternate-assets');
    const override = await importAsset({
      path: glbPath,
      id: 'landmark.tower',
      projectPath,
      outDir: root,
    });
    expect(override.ok, override.error).toBe(true);
    expect(override.dir).toBe(join(root, 'landmark/tower'));
    expect(override.sidecar?.hash).toBe(original.sidecar?.hash);
    const manifest = JSON.parse(await readFile(projectPath, 'utf8'));
    expect(manifest.assets['landmark.tower']).toBe('alternate-assets/landmark/tower/asset.json');
    expect((await inspectAsset({ ref: original.sidecarPath as string, verify: true })).ok).toBe(
      true,
    );
  });

  it('preserves a registered sidecar filename and protects its bundle from another ID', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-asset-sidecar-name-'));
    const project = await scaffoldExperience({ name: 'named-sidecar', dir: parent });
    const projectDir = project.dir as string;
    const projectPath = join(projectDir, 'project.json');
    const assetDir = join(projectDir, 'assets/places/c2/c23/tower');
    const first = await importAsset({ path: glbPath, id: 'landmark.tower', assetDir, projectPath });
    expect(first.ok, first.error).toBe(true);
    const sidecarPath = join(assetDir, 'tower.sidecar.json');
    await rename(first.sidecarPath as string, sidecarPath);
    const manifest = JSON.parse(await readFile(projectPath, 'utf8'));
    manifest.assets['landmark.tower'] = 'assets/places/c2/c23/tower/tower.sidecar.json';
    await writeFile(projectPath, JSON.stringify(manifest));

    const reimported = await importAsset({
      path: glbPath,
      id: 'landmark.tower',
      projectPath,
      force: true,
    });
    expect(reimported.ok, reimported.error).toBe(true);
    expect(reimported.sidecarPath).toBe(sidecarPath);
    expect(reimported.dir).toBe(assetDir);
    expect(reimported.sidecar?.hash).toBe(first.sidecar?.hash);
    await expect(stat(join(assetDir, 'asset.json'))).rejects.toThrow();
    expect((await inspectAsset({ ref: 'landmark.tower', projectPath, verify: true })).ok).toBe(
      true,
    );
    const staged = await stageAssets({ projectPath, outDir: join(parent, 'served') });
    expect(staged.ok, staged.error).toBe(true);
    expect(staged.index?.['landmark.tower']).toBe('assets/places/c2/c23/tower/model.glb');

    const manifestBefore = await readFile(projectPath);
    const modelBefore = await readFile(join(assetDir, 'model.glb'));
    const sidecarBefore = await readFile(sidecarPath);
    const conflicting = await importAsset({
      path: join(dir, 'absent.glb'),
      id: 'another.tower',
      assetDir,
      projectPath,
      force: true,
    });
    expect(conflicting.ok).toBe(false);
    expect(conflicting.error).toContain('belongs to asset "landmark.tower"');
    expect(await readFile(projectPath)).toEqual(manifestBefore);
    expect(await readFile(join(assetDir, 'model.glb'))).toEqual(modelBefore);
    expect(await readFile(sidecarPath)).toEqual(sidecarBefore);
  });

  it('rejects conflicting destination options before reading or writing asset files', async () => {
    const result = await importAsset({
      path: join(dir, 'absent.glb'),
      assetDir: join(dir, 'exact-destination'),
      outDir: join(dir, 'asset-root'),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('mutually exclusive');
    await expect(stat(join(dir, 'exact-destination'))).rejects.toThrow();
    await expect(stat(join(dir, 'asset-root'))).rejects.toThrow();
    const empty = await importAsset({ path: glbPath, assetDir: '  ' });
    expect(empty.error).toContain('must not be empty');
    const invalid = await importAsset({ path: glbPath, assetDir: 'invalid\0directory' });
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toContain('must not contain a null byte');
  });

  it('rejects a file destination even with force and leaves that file untouched', async () => {
    const assetDir = join(dir, 'not-a-directory');
    const contents = 'do not replace this file';
    await writeFile(assetDir, contents);
    const result = await importAsset({
      path: join(dir, 'absent.glb'),
      assetDir,
      force: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('is not a directory');
    expect(await readFile(assetDir, 'utf8')).toBe(contents);
  });

  it('does not overwrite another asset ID at an explicit destination, even with force', async () => {
    const assetDir = join(dir, 'protected-bundle');
    const first = await importAsset({ path: glbPath, id: 'one', assetDir });
    expect(first.ok, first.error).toBe(true);
    const sidecar = await readFile(first.sidecarPath as string);
    const model = await readFile(join(assetDir, 'model.glb'));
    const second = await importAsset({ path: glbPath, id: 'two', assetDir, force: true });
    expect(second.ok).toBe(false);
    expect(second.error).toContain('belongs to asset "one"');
    expect(await readFile(first.sidecarPath as string)).toEqual(sidecar);
    expect(await readFile(join(assetDir, 'model.glb'))).toEqual(model);
  });

  it('imports a GLB: bounds, stats, hulls, animation summary — and the sidecar validates', async () => {
    const r = await importAsset({ path: glbPath, outDir: join(dir, 'assets'), trimesh: true });
    expect(r.ok, r.error).toBe(true);
    const s = r.sidecar as NonNullable<typeof r.sidecar>;

    expect(s.id).toBe('crate');
    expect(s.stats.triangles).toBe(12);
    expect(s.stats.meshes).toBe(1);
    expect(s.bounds.aabb.min).toEqual([-0.5, 0, -0.5]);
    expect(s.bounds.aabb.max).toEqual([0.5, 1, 0.5]);
    expect(s.bounds.sphere.radius).toBeGreaterThan(0.8);
    expect(s.nodes).toEqual([{ name: 'Crate', triangles: 12 }]);
    expect(s.animations).toEqual([{ name: 'spin', durationSec: 1, channels: 1 }]);
    expect(s.materials[0]?.name).toBe('wood');

    // Hull: a cube's hull is its 8 corners — and the VALUES must be world-space (dequantized),
    // exactly spanning the AABB (this catches raw normalized-int accessor reads).
    expect(s.collision.hulls).toHaveLength(1);
    const hull = s.collision.hulls[0] as { node: string; points: number[] };
    expect(hull.node).toBe('Crate');
    expect(hull.points.length).toBe(8 * 3);
    const xs = hull.points.filter((_, i) => i % 3 === 0);
    const ys = hull.points.filter((_, i) => i % 3 === 1);
    expect(Math.min(...xs)).toBeCloseTo(-0.5, 2);
    expect(Math.max(...xs)).toBeCloseTo(0.5, 2);
    expect(Math.min(...ys)).toBeCloseTo(0, 2);
    expect(Math.max(...ys)).toBeCloseTo(1, 2);

    // Trimesh round-trip through the schema decoder.
    const trimesh = s.collision.trimesh as NonNullable<typeof s.collision.trimesh>;
    const bin = new Uint8Array(await readFile(join(r.dir as string, trimesh.bin)));
    const decoded = decodeCollisionTrimesh(trimesh, bin);
    expect(decoded.positions.length).toBe(trimesh.positions.count * 3);
    expect(decoded.indices.length).toBe(trimesh.indices.count);
    expect(trimesh.positions.count).toBe(8);
    expect(trimesh.indices.count).toBe(36);

    // Sidecar file itself validates as kind "asset".
    const onDisk = JSON.parse(await readFile(r.sidecarPath as string, 'utf8'));
    expect(validate('asset', onDisk).ok).toBe(true);
  });

  it('re-import is byte-deterministic (same canonical hash)', async () => {
    const a = await importAsset({ path: glbPath, outDir: join(dir, 'assets-a') });
    const b = await importAsset({ path: glbPath, outDir: join(dir, 'assets-b') });
    expect(a.ok && b.ok).toBe(true);
    expect(a.sidecar?.hash).toBe(b.sidecar?.hash);
  });

  it('refuses to overwrite an existing asset unless force is explicit', async () => {
    const outDir = join(dir, 'assets-no-overwrite');
    expect((await importAsset({ path: glbPath, outDir })).ok).toBe(true);
    const refused = await importAsset({ path: glbPath, outDir });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain('already exists');
    expect((await importAsset({ path: glbPath, outDir, force: true })).ok).toBe(true);
  });

  it('inspect --verify passes on a fresh import and fails after tampering', async () => {
    const r = await importAsset({ path: glbPath, outDir: join(dir, 'assets-v') });
    expect(r.ok).toBe(true);
    const good = await inspectAsset({ ref: r.sidecarPath as string, verify: true });
    expect(good.ok, JSON.stringify(good.verifyErrors)).toBe(true);

    await writeFile(join(r.dir as string, 'model.glb'), Buffer.from('tampered'));
    const bad = await inspectAsset({ ref: r.sidecarPath as string, verify: true });
    expect(bad.ok).toBe(false);
    expect(bad.verifyErrors?.[0]).toContain('hash mismatch');
  });

  // Under `molen mcp` stdout IS the JSON-RPC transport: gltf-transform's default logger narrates
  // each normalize pass through console.info/console.debug (stdout in Node) and corrupts a frame.
  it('writes nothing to stdout while normalizing (MCP stdio safety)', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      const r = await importAsset({ path: glbPath, outDir: join(dir, 'assets-quiet') });
      expect(r.ok, r.error).toBe(true);
      expect(log).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      expect(debug).not.toHaveBeenCalled();
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
      log.mockRestore();
      info.mockRestore();
      debug.mockRestore();
    }
  });

  it('registers into a project manifest and resolves by asset id', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-asset-proj-'));
    const s = await scaffoldExperience({ name: 'demo', dir: parent });
    expect(s.ok).toBe(true);
    const projectPath = join(s.dir as string, 'project.json');

    const r = await importAsset({ path: glbPath, projectPath });
    expect(r.ok, r.error).toBe(true);
    expect(r.registered).toBe(true);

    const list = await listAssets({ projectPath });
    expect(list.assets?.map((a) => a.id)).toContain('crate');

    const byId = await inspectAsset({ ref: 'crate', projectPath });
    expect(byId.ok, byId.error).toBe(true);
    expect(byId.sidecar?.stats.triangles).toBe(12);
  });
  // The project you are STANDING IN wins. Resolving from the source file's directory silently
  // wrote the asset into (and edited the manifest of) whatever project the model happened to
  // live under — a different project than the one the user was working in.
  it('registers into the current project, not the project around the source file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'molen-asset-cwd-'));
    const here = await scaffoldExperience({ name: 'here', dir: root });
    const other = await scaffoldExperience({ name: 'other', dir: root });
    expect(here.ok && other.ok).toBe(true);
    const hereProject = join(here.dir as string, 'project.json');
    const otherProject = join(other.dir as string, 'project.json');

    // The model lives inside the OTHER project's tree.
    const sourcePath = join(other.dir as string, 'models', 'brass key.glb');
    await mkdir(join(other.dir as string, 'models'), { recursive: true });
    await writeFile(sourcePath, await buildCubeGlb());

    // Two projects in play and no explicit choice: refuse rather than guess.
    const ambiguous = await importAsset({ path: sourcePath, id: 'probe.key', cwd: here.dir });
    expect(ambiguous.ok).toBe(false);
    expect(ambiguous.error).toContain('ambiguous project');
    expect(ambiguous.error).toContain(otherProject);
    expect(ambiguous.error).toContain(hereProject);

    // --project settles it, and the answer is reported back.
    const chosen = await importAsset({
      path: sourcePath,
      id: 'probe.key',
      cwd: here.dir,
      projectPath: hereProject,
    });
    expect(chosen.ok, chosen.error).toBe(true);
    expect(chosen.registered).toBe(true);
    expect(chosen.projectPath).toBe(hereProject);
    expect(chosen.dir?.startsWith(here.dir as string)).toBe(true);

    // The other project's manifest was never touched.
    const otherManifest = JSON.parse(await readFile(otherProject, 'utf8'));
    expect(Object.keys(otherManifest.assets ?? {})).not.toContain('probe.key');
    const hereManifest = JSON.parse(await readFile(hereProject, 'utf8'));
    expect(Object.keys(hereManifest.assets ?? {})).toContain('probe.key');
  });

  it('uses the surrounding project when the source file is outside any project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'molen-asset-only-'));
    const proj = await scaffoldExperience({ name: 'solo', dir: root });
    const projectPath = join(proj.dir as string, 'project.json');
    const loose = join(root, 'loose.glb');
    await writeFile(loose, await buildCubeGlb());

    const r = await importAsset({ path: loose, id: 'loose', cwd: proj.dir });
    expect(r.ok, r.error).toBe(true);
    expect(r.projectPath).toBe(projectPath);
    expect(r.registered).toBe(true);
  });
});
