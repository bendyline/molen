import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { detectKind, validateByKind } from '@bendyline/molen-schema';
import { findProjectFile, loadProject } from '../project';
import { parseJson } from './build';
import { guardOp } from './errors';

export interface ValidateInput {
  /** Path to a JSON document, or inline data. One of the two is required. */
  path?: string;
  inline?: unknown;
  /** Force a schema kind (any registered kind); otherwise detected from the envelope. */
  kind?: string;
  /** For terrain-package files, stream-check declared paths, sizes, and SHA-256 hashes. */
  verifyFiles?: boolean;
  /**
   * Explicit project.json giving a scene its registry types (default: discovered by walking up
   * from `path`). With a project, entity/prefab `type` references are checked too.
   */
  projectPath?: string;
}

export interface ValidateOutput {
  ok: boolean;
  kind?: string;
  /** Present when ok: the parsed (defaults-applied) value. */
  value?: unknown;
  /** Present when not ok: the agent-facing formatted error block. */
  formatted?: string;
  issues?: unknown[];
  verifiedFiles?: number;
}

interface TerrainPackageFiles {
  files: Array<{ path: string; sha256: string; bytes: number }>;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function verifyTerrainPackageFiles(
  manifestPath: string,
  pkg: TerrainPackageFiles,
): Promise<string[]> {
  const root = await realpath(dirname(resolve(manifestPath)));
  const errors: string[] = [];
  for (const file of pkg.files) {
    try {
      const target = await realpath(resolve(root, file.path));
      const fromRoot = relative(root, target);
      if (
        fromRoot === '..' ||
        fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
        isAbsolute(fromRoot)
      ) {
        errors.push(`${file.path}: resolves outside the terrain package directory`);
        continue;
      }
      const info = await stat(target);
      if (!info.isFile()) {
        errors.push(`${file.path}: expected a regular file`);
        continue;
      }
      if (info.size !== file.bytes) {
        errors.push(`${file.path}: size ${info.size} does not match manifest ${file.bytes}`);
        continue;
      }
      const actual = await sha256File(target);
      if (actual.toLowerCase() !== file.sha256.toLowerCase()) {
        errors.push(`${file.path}: SHA-256 ${actual} does not match manifest ${file.sha256}`);
      }
    } catch (error) {
      errors.push(`${file.path}: ${(error as Error).message}`);
    }
  }
  return errors;
}

/** Validate an asset document against its schema (kind auto-detected when omitted). */
export function validateAsset(input: ValidateInput): Promise<ValidateOutput> {
  return guardOp(
    (error) => ({ ok: false, formatted: `✖ ${input.path ?? 'validate'}: ${error}` }),
    () => validateAssetImpl(input),
  );
}

async function validateAssetImpl(input: ValidateInput): Promise<ValidateOutput> {
  let data: unknown = input.inline;
  if (input.path !== undefined) {
    let text: string;
    try {
      text = await readFile(input.path, 'utf8');
    } catch (e) {
      return {
        ok: false,
        formatted: `✖ ${input.path}: cannot read file — ${(e as Error).message}`,
      };
    }
    try {
      data = parseJson(text);
    } catch (e) {
      return {
        ok: false,
        formatted: `✖ ${input.path}: not valid JSON — ${(e as Error).message}`,
      };
    }
  }
  if (data === undefined) {
    return { ok: false, formatted: '✖ validate: provide either a path or inline data' };
  }

  const kind = input.kind ?? detectKind(data);
  if (kind === undefined) {
    return {
      ok: false,
      formatted:
        '✖ could not detect schema kind from the document envelope. ' +
        'Add a "format": "molen/<kind>@1" field or pass --kind.',
    };
  }

  const projectPath =
    input.projectPath ??
    (input.path !== undefined ? await findProjectFile(dirname(resolve(input.path))) : undefined);
  const project =
    projectPath !== undefined && kind !== 'project' ? await loadProject(projectPath) : undefined;
  const result = validateByKind(kind, data, {
    registry: project?.componentRegistry,
    types: project?.resolvedTypes,
  });
  if (result.ok) {
    if (input.verifyFiles === true) {
      if (kind !== 'terrain-package') {
        return {
          ok: false,
          kind,
          formatted: '✖ --verify-files currently applies only to terrain-package manifests',
        };
      }
      if (input.path === undefined) {
        return {
          ok: false,
          kind,
          formatted: '✖ terrain-package file verification requires a manifest path',
        };
      }
      const errors = await verifyTerrainPackageFiles(
        input.path,
        result.value as TerrainPackageFiles,
      );
      if (errors.length > 0) {
        return {
          ok: false,
          kind,
          formatted: `✖ terrain package file verification failed\n${errors.map((error) => `  - ${error}`).join('\n')}`,
        };
      }
      return {
        ok: true,
        kind,
        value: result.value,
        verifiedFiles: (result.value as TerrainPackageFiles).files.length,
      };
    }
    return { ok: true, kind, value: result.value };
  }
  return { ok: false, kind, formatted: result.formatted, issues: result.issues };
}
