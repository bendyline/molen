import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeCollisionTrimesh, validate } from '@bendyline/molen-schema';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { importAsset, inspectAsset, listAssets, scaffoldExperience } from '../src/ops/index';
import { buildCubeGlb } from './fixtures/build-glb';

let dir: string;
let glbPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-asset-'));
  glbPath = join(dir, 'crate.glb');
  await writeFile(glbPath, await buildCubeGlb());
});

describe('asset import (glTF -> asset@1 sidecar)', () => {
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
