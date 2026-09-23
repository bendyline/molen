import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import type { AssetSidecar } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { findProjectFile, loadProject } from '../project';
import { inspectAsset } from './asset-inspect';
import { hashFile } from './asset-pack';
import { guardOp } from './errors';

// Browser staging: copy every registered asset's RUNTIME files into an output directory (the
// same relative layout as the project, so the client's assets/<id>/model.glb convention keeps
// working) and emit assets.index.json (id -> URL relative to outDir) for the client's `index`
// option. With `variant`, the packed runtime GLB (see asset-pack.ts) replaces the design-time
// main file and the staged sidecar is rewritten to describe it, so the bundle is self-consistent
// (`molen asset inspect --verify` passes on the staged sidecar) and ships no design-time GLB.

export const ASSET_INDEX_FILE = 'assets.index.json';

export interface StageAssetsInput {
  projectPath?: string;
  cwd?: string;
  /** Output directory (created). */
  outDir: string;
  /** Prefer this packed variant (e.g. "ktx2"); assets without it stage their main file. */
  variant?: string;
  /** Require the variant on every asset instead of falling back to the main file. */
  requireVariant?: boolean;
  /** Remove a previous staging output first (only a directory holding assets.index.json). */
  clean?: boolean;
}

export interface StagedAsset {
  id: string;
  /** Staged model URL relative to outDir (also the index entry). */
  file: string;
  /** The variant that was staged, when one was. */
  variant?: string;
  bytes: number;
}

export interface StageAssetsOutput {
  ok: boolean;
  outDir?: string;
  indexPath?: string;
  index?: Record<string, string>;
  assets?: StagedAsset[];
  warnings?: string[];
  error?: string;
}

/** `extensionsUsed` from a GLB's JSON chunk (chunk 0 starts at byte 20). */
export function glbExtensionsUsed(glb: Uint8Array): string[] {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (glb.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error('not a GLB (bad magic)');
  }
  const jsonLength = view.getUint32(12, true);
  const json = new TextDecoder().decode(glb.subarray(20, 20 + jsonLength));
  const parsed = JSON.parse(json) as { extensionsUsed?: string[] };
  return parsed.extensionsUsed ?? [];
}

/** Stage registered assets (+ optional packed variant) into a browser-servable directory. */
export function stageAssets(input: StageAssetsInput): Promise<StageAssetsOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => stageAssetsImpl(input),
  );
}

async function stageAssetsImpl(input: StageAssetsInput): Promise<StageAssetsOutput> {
  const warnings: string[] = [];
  const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
  if (projectPath === undefined) return { ok: false, error: 'no project.json found' };
  const project = await loadProject(projectPath);
  const outDir = resolve(input.outDir);
  const indexPath = join(outDir, ASSET_INDEX_FILE);

  if (input.clean === true) {
    try {
      await stat(indexPath);
      await rm(outDir, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        await stat(outDir);
        return {
          ok: false,
          error: `${outDir} exists but holds no ${ASSET_INDEX_FILE}; refusing to clean a directory that is not a previous staging output`,
        };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
  }
  await mkdir(outDir, { recursive: true });

  const index: Record<string, string> = Object.create(null) as Record<string, string>;
  const assets: StagedAsset[] = [];
  for (const [id, rel] of Object.entries(project.manifest.assets)) {
    const sidecarPath = join(project.dir, rel);
    // verify: a stale sidecar (hash mismatch) must not ship.
    const inspected = await inspectAsset({ ref: sidecarPath, verify: true, projectPath });
    if (!inspected.ok || inspected.sidecar === undefined) {
      return {
        ok: false,
        error: `${id}: ${inspected.error ?? (inspected.verifyErrors ?? []).join('; ')}`,
        warnings,
      };
    }
    const sidecar = inspected.sidecar;
    const srcDir = dirname(sidecarPath);
    const relDir = posix.dirname(rel.replaceAll('\\', '/'));
    const dstDir = join(outDir, relDir);
    await mkdir(dstDir, { recursive: true });

    const variantFile =
      input.variant !== undefined ? sidecar.files.variants[input.variant] : undefined;
    if (input.variant !== undefined && variantFile === undefined) {
      const msg = `${id}: no "${input.variant}" variant (run molen asset pack); staged ${sidecar.files.main}`;
      if (input.requireVariant === true) return { ok: false, error: msg, warnings };
      warnings.push(msg);
    }
    const modelFile = variantFile ?? sidecar.files.main;
    const modelSrc = join(srcDir, modelFile);
    await copyFile(modelSrc, join(dstDir, modelFile));
    if (sidecar.files.collision !== undefined) {
      await copyFile(join(srcDir, sidecar.files.collision), join(dstDir, sidecar.files.collision));
    }

    let staged: AssetSidecar = sidecar;
    if (variantFile !== undefined) {
      const glb = new Uint8Array(await readFile(modelSrc));
      staged = {
        ...sidecar,
        files: {
          main: variantFile,
          ...(sidecar.files.collision !== undefined ? { collision: sidecar.files.collision } : {}),
          variants: {},
        },
        hash: await hashFile(modelSrc),
        stats: { ...sidecar.stats, sizeBytes: glb.byteLength },
        extensionsUsed: glbExtensionsUsed(glb),
      };
    }
    const checked = validate('asset', staged);
    if (!checked.ok)
      return { ok: false, error: `${id}: staged sidecar invalid:\n${checked.formatted}` };
    await writeFile(join(dstDir, 'asset.json'), `${JSON.stringify(checked.value, null, 2)}\n`);

    const file = posix.join(relDir, modelFile);
    index[id] = file;
    assets.push({
      id,
      file,
      ...(variantFile !== undefined ? { variant: input.variant as string } : {}),
      bytes: (await stat(modelSrc)).size,
    });
  }

  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return {
    ok: true,
    outDir,
    indexPath,
    index,
    assets,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
