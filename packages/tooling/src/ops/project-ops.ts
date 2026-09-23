import {
  type NamespaceReservation,
  namespaceCovers,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { findProjectFile, loadProject, type ProjectContext, updateProjectFile } from '../project';
import { generateTypes } from './generate-types';

async function resolveProjectPath(input: {
  projectPath?: string;
  cwd?: string;
}): Promise<string | undefined> {
  return input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
}

// --- molen project info / get_project ---

export interface ProjectInfoInput {
  projectPath?: string;
  cwd?: string;
}

export interface ProjectInfoOutput {
  ok: boolean;
  path?: string;
  name?: string;
  scenes?: Record<string, string>;
  defaultScene?: string;
  typeIds?: string[];
  assets?: Record<string, string>;
  reservations?: NamespaceReservation[];
  setup?: string;
  issues?: ValidationIssue[];
  error?: string;
}

export async function projectInfo(input: ProjectInfoInput): Promise<ProjectInfoOutput> {
  try {
    const path = await resolveProjectPath(input);
    if (path === undefined) return { ok: false, error: 'no project.json found' };
    const project = await loadProject(path);
    return {
      ok: project.typeIssues.length === 0,
      path: project.path,
      name: project.manifest.name,
      scenes: project.manifest.scenes,
      ...(project.manifest.defaultScene !== undefined
        ? { defaultScene: project.manifest.defaultScene }
        : {}),
      typeIds: [...project.resolvedTypes.keys()].sort(),
      assets: project.manifest.assets,
      reservations: project.manifest.reservations,
      ...(project.manifest.setup !== undefined ? { setup: project.manifest.setup } : {}),
      ...(project.typeIssues.length > 0 ? { issues: project.typeIssues } : {}),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- molen types list / list_types ---

export interface ListTypesOutput {
  ok: boolean;
  types?: { id: string; doc?: string; extends?: string; source: string }[];
  error?: string;
}

export async function listTypes(input: ProjectInfoInput): Promise<ListTypesOutput> {
  try {
    const path = await resolveProjectPath(input);
    if (path === undefined) return { ok: false, error: 'no project.json found' };
    const project = await loadProject(path);
    const types = project.typesDocs
      .flatMap(({ doc, source }) =>
        Object.entries(doc.types).map(([id, def]) => ({
          id,
          ...(def.doc !== undefined ? { doc: def.doc } : {}),
          ...(def.extends !== undefined ? { extends: def.extends } : {}),
          source,
        })),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, types };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- molen types check / check_types ---

export interface CheckTypesOutput {
  ok: boolean;
  issues?: ValidationIssue[];
  codegenStale?: boolean;
  error?: string;
}

export async function checkTypesOp(input: ProjectInfoInput): Promise<CheckTypesOutput> {
  try {
    const path = await resolveProjectPath(input);
    if (path === undefined) return { ok: false, error: 'no project.json found' };
    const project: ProjectContext = await loadProject(path);
    const gen = await generateTypes({ projectPath: path, check: true });
    const codegenStale = gen.stale === true;
    const ok = project.typeIssues.length === 0 && !codegenStale;
    return {
      ok,
      issues: project.typeIssues,
      codegenStale,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- molen types reserve / reserve_type ---

export interface ReserveNamespaceInput {
  namespace: string;
  owner: string;
  note?: string;
  projectPath?: string;
  cwd?: string;
}

export interface ReserveNamespaceOutput {
  ok: boolean;
  /** True when the same owner already held the namespace (no-op). */
  alreadyReserved?: boolean;
  /** Set on conflict: who holds the overlapping namespace. */
  conflict?: NamespaceReservation;
  reservations?: NamespaceReservation[];
  error?: string;
}

export async function reserveNamespace(
  input: ReserveNamespaceInput,
): Promise<ReserveNamespaceOutput> {
  try {
    const path = await resolveProjectPath(input);
    if (path === undefined) return { ok: false, error: 'no project.json found' };
    let alreadyReserved = false;
    let conflict: NamespaceReservation | undefined;
    const updated = await updateProjectFile(path, (manifest) => {
      const overlapping = manifest.reservations.find(
        (r) =>
          namespaceCovers(r.namespace, input.namespace) ||
          namespaceCovers(input.namespace, r.namespace),
      );
      if (overlapping !== undefined) {
        if (overlapping.owner === input.owner) {
          alreadyReserved = true; // idempotent for the same owner
          return manifest;
        }
        conflict = overlapping;
        return manifest;
      }
      manifest.reservations.push({
        namespace: input.namespace,
        owner: input.owner,
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      return manifest;
    });
    if (conflict !== undefined) {
      return {
        ok: false,
        conflict,
        error: `namespace "${input.namespace}" conflicts with "${conflict.namespace}" held by ${conflict.owner}`,
      };
    }
    return { ok: true, alreadyReserved, reservations: updated.reservations };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
