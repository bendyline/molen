import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AssetSidecar } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { findProjectFile, loadProject } from '../project';
import { parseJson } from './build';

export interface InspectAssetInput {
  /** Sidecar path, or a project asset id. */
  ref: string;
  /** Re-hash files.main / collision.bin and compare against the sidecar. */
  verify?: boolean;
  projectPath?: string;
  cwd?: string;
}

export interface InspectAssetOutput {
  ok: boolean;
  sidecarPath?: string;
  sidecar?: AssetSidecar;
  verified?: boolean;
  verifyErrors?: string[];
  error?: string;
}

function sha256(data: Uint8Array): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

/** Read + validate a sidecar (by path or project asset id); optionally verify file hashes. */
export async function inspectAsset(input: InspectAssetInput): Promise<InspectAssetOutput> {
  try {
    let sidecarPath = input.ref;
    if (!sidecarPath.endsWith('.json')) {
      const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
      if (projectPath === undefined) {
        return {
          ok: false,
          error: `"${input.ref}" is not a sidecar path and no project.json was found`,
        };
      }
      const project = await loadProject(projectPath);
      const rel = project.manifest.assets[input.ref];
      if (rel === undefined) {
        return {
          ok: false,
          error: `asset "${input.ref}" is not registered (known: ${Object.keys(project.manifest.assets).join(', ') || 'none'})`,
        };
      }
      sidecarPath = join(project.dir, rel);
    }
    const raw = parseJson(await readFile(sidecarPath, 'utf8'));
    const parsed = validate('asset', raw);
    if (!parsed.ok) return { ok: false, sidecarPath, error: parsed.formatted };
    const sidecar = parsed.value;

    if (input.verify !== true) return { ok: true, sidecarPath, sidecar };

    const dir = dirname(sidecarPath);
    const verifyErrors: string[] = [];
    try {
      const mainHash = sha256(new Uint8Array(await readFile(join(dir, sidecar.files.main))));
      if (mainHash !== sidecar.hash) {
        verifyErrors.push(
          `${sidecar.files.main}: hash mismatch (expected ${sidecar.hash}, got ${mainHash})`,
        );
      }
    } catch (e) {
      verifyErrors.push(`${sidecar.files.main}: ${(e as Error).message}`);
    }
    const trimesh = sidecar.collision.trimesh;
    if (trimesh !== undefined) {
      try {
        const binHash = sha256(new Uint8Array(await readFile(join(dir, trimesh.bin))));
        if (binHash !== trimesh.hash) {
          verifyErrors.push(
            `${trimesh.bin}: hash mismatch (expected ${trimesh.hash}, got ${binHash})`,
          );
        }
      } catch (e) {
        verifyErrors.push(`${trimesh.bin}: ${(e as Error).message}`);
      }
    }
    // Variants carry no hash (they are derived from main); they must at least exist.
    for (const [name, file] of Object.entries(sidecar.files.variants)) {
      try {
        await readFile(join(dir, file));
      } catch (e) {
        verifyErrors.push(`variant "${name}" (${file}): ${(e as Error).message}`);
      }
    }
    return {
      ok: verifyErrors.length === 0,
      sidecarPath,
      sidecar,
      verified: verifyErrors.length === 0,
      ...(verifyErrors.length > 0 ? { verifyErrors } : {}),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ListAssetsOutput {
  ok: boolean;
  assets?: { id: string; sidecar: string; kind?: string; triangles?: number }[];
  error?: string;
}

/** List the assets registered in the surrounding project. */
export async function listAssets(input: {
  projectPath?: string;
  cwd?: string;
}): Promise<ListAssetsOutput> {
  try {
    const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
    if (projectPath === undefined) return { ok: false, error: 'no project.json found' };
    const project = await loadProject(projectPath);
    const assets: { id: string; sidecar: string; kind?: string; triangles?: number }[] = [];
    for (const [id, rel] of Object.entries(project.manifest.assets)) {
      const entry: { id: string; sidecar: string; kind?: string; triangles?: number } = {
        id,
        sidecar: rel,
      };
      try {
        const parsed = validate('asset', parseJson(await readFile(join(project.dir, rel), 'utf8')));
        if (parsed.ok) {
          entry.kind = parsed.value.kind;
          entry.triangles = parsed.value.stats.triangles;
        }
      } catch {
        // unreadable sidecar still listed
      }
      assets.push(entry);
    }
    return { ok: true, assets: assets.sort((a, b) => a.id.localeCompare(b.id)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
