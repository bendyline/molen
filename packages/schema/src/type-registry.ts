import { componentMapIssues, createComponentRegistry } from './components';
import type { ValidationIssue } from './issues';
import { deepMergeJson } from './merge';
import type { ResolvedEntityType } from './scene-resolve';
import type {
  ComponentMap,
  EntityTypeDef,
  NamespaceReservation,
  ProjectManifest,
  SceneManifest,
  TypesDoc,
} from './types';
import { nearest } from './zod-issues';

// Pure helpers over the entity type registry (molen/types@1) and the project manifest's
// reservations. No filesystem access: tooling loads/validates the documents, these functions
// index, resolve, and cross-check them. The kernel consumes only the flattened output of
// resolveAllTypes — it never sees types files.

export interface TypeIndexEntry {
  id: string;
  def: EntityTypeDef;
  /** Which types document declared it (for error messages). */
  source?: string;
}

export interface TypeIndex {
  index: Map<string, TypeIndexEntry>;
  issues: ValidationIssue[];
}

/** Index type defs across documents; duplicate ids across files are issues. */
export function buildTypeIndex(docs: { doc: TypesDoc; source?: string }[]): TypeIndex {
  const index = new Map<string, TypeIndexEntry>();
  const issues: ValidationIssue[] = [];
  for (const { doc, source } of docs) {
    for (const [id, def] of Object.entries(doc.types)) {
      const existing = index.get(id);
      if (existing !== undefined) {
        issues.push({
          path: `/types/${id}`,
          code: 'duplicate_type_id',
          message: `type "${id}" is declared in both ${existing.source ?? 'another document'} and ${source ?? 'this document'}`,
          docsRef: 'schemas/types.md',
        });
        continue;
      }
      index.set(id, { id, def, ...(source !== undefined ? { source } : {}) });
    }
  }
  return { index, issues };
}

/**
 * Resolve a type's component map, following the `extends` chain ancestor-first (parent under
 * child). Throws on unknown ids and cycles — callers validate first via checkTypes.
 */
export function resolveType(
  index: Map<string, TypeIndexEntry>,
  id: string,
  seen: string[] = [],
): ComponentMap {
  if (seen.includes(id)) {
    throw new Error(`type extends cycle: ${[...seen, id].join(' → ')}`);
  }
  const entry = index.get(id);
  if (entry === undefined) throw new Error(`unknown type "${id}"`);
  const base =
    entry.def.extends !== undefined ? resolveType(index, entry.def.extends, [...seen, id]) : {};
  return deepMergeJson(base, entry.def.components) as ComponentMap;
}

/** Flatten every registered type to its final component map (the kernel-facing product). */
function resolveTypeScripts(
  index: Map<string, TypeIndexEntry>,
  id: string,
  seen: string[] = [],
): EntityTypeDef['scripts'] {
  if (seen.includes(id)) throw new Error(`type extends cycle: ${[...seen, id].join(' → ')}`);
  const entry = index.get(id);
  if (entry === undefined) throw new Error(`unknown type "${id}"`);
  const base =
    entry.def.extends === undefined
      ? []
      : resolveTypeScripts(index, entry.def.extends, [...seen, id]);
  return [...base, ...entry.def.scripts];
}

export function resolveAllTypes(
  index: Map<string, TypeIndexEntry>,
): Map<string, ResolvedEntityType> {
  const out = new Map<string, ResolvedEntityType>();
  for (const id of index.keys())
    out.set(id, { components: resolveType(index, id), scripts: resolveTypeScripts(index, id) });
  return out;
}

/** Does a reserved namespace cover an id? Dot-boundary prefix: "train" covers "train.car", not "trainer.x". */
export function namespaceCovers(ns: string, id: string): boolean {
  return id === ns || id.startsWith(`${ns}.`);
}

/** The longest (most specific) reservation covering an id, if any. */
export function findReservation(
  reservations: readonly NamespaceReservation[],
  id: string,
): NamespaceReservation | undefined {
  let best: NamespaceReservation | undefined;
  for (const r of reservations) {
    if (!namespaceCovers(r.namespace, id)) continue;
    if (best === undefined || r.namespace.length > best.namespace.length) best = r;
  }
  return best;
}

/**
 * Project-level cross-checks over all types documents: cross-file duplicates, dangling/cyclic
 * extends, namespace ownership vs reservations, and asset refs missing from project.assets.
 * (Per-file namespace containment and per-type component shapes are covered by `validate`.)
 */
export function checkTypes(
  project: ProjectManifest,
  docs: { doc: TypesDoc; source?: string }[],
): ValidationIssue[] {
  const { index, issues } = buildTypeIndex(docs);
  const registry = createComponentRegistry(project.components, { owner: 'project' }).registry;
  for (const { doc, source } of docs) {
    if (doc.owner === undefined) continue;
    const reservation = findReservation(project.reservations, doc.namespace);
    if (reservation !== undefined && reservation.owner !== doc.owner) {
      issues.push({
        path: '/namespace',
        code: 'namespace_not_owned',
        message: `${source ?? 'types document'} (owner ${doc.owner}) declares namespace "${doc.namespace}" reserved by ${reservation.owner}`,
        hint: `reserve a namespace of your own: molen types reserve <ns> --owner ${doc.owner}`,
        docsRef: 'schemas/project.md',
      });
    }
  }
  for (const entry of index.values()) {
    const ext = entry.def.extends;
    if (ext !== undefined && !index.has(ext)) {
      issues.push({
        path: `/types/${entry.id}/extends`,
        code: 'unknown_type_extends',
        message: `type "${entry.id}" extends unknown type "${ext}"`,
        docsRef: 'schemas/types.md',
      });
    }
    for (const assetId of entry.def.assets) {
      if (project.assets[assetId] === undefined) {
        issues.push({
          path: `/types/${entry.id}/assets`,
          code: 'unknown_asset_ref',
          message: `type "${entry.id}" references asset "${assetId}" not registered in project.assets`,
          hint: 'import it first: molen asset import <file> --id <asset-id>',
          docsRef: 'schemas/project.md',
        });
      }
    }
  }
  // Cross-file cycles (per-file cycles are caught by the document validator) + resolved-shape
  // component validation (extending types hold partial overrides, so only the flattened result
  // can be checked against the component registry).
  for (const entry of index.values()) {
    try {
      const resolved = resolveType(index, entry.id);
      if (entry.def.extends !== undefined) {
        issues.push(
          ...componentMapIssues(resolved, `/types/${entry.id}/components(resolved)`, { registry }),
        );
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('cycle')) {
        issues.push({
          path: `/types/${entry.id}/extends`,
          code: 'type_extends_cycle',
          message: msg,
          docsRef: 'schemas/types.md',
        });
      }
    }
  }
  return issues;
}

/**
 * Scene entities/prefabs that reference registry `type` ids the project does not define.
 * Pure: pass the ids the project resolved (e.g. `resolvedTypes.keys()`); the issues carry a
 * did-you-mean over them, so `molen validate` and the scene loader report a typo'd type with a
 * pointer instead of the kernel throwing "unknown type".
 */
export function sceneTypeRefIssues(
  manifest: SceneManifest,
  knownTypeIds: Iterable<string>,
): ValidationIssue[] {
  const known = [...knownTypeIds];
  const knownSet = new Set(known);
  const issues: ValidationIssue[] = [];
  const flag = (path: string, id: string, what: string): void => {
    const near = nearest(id, known);
    issues.push({
      path,
      code: 'unknown_type',
      message: `${what} references unknown registry type "${id}"`,
      expected:
        known.length > 0 ? `one of: ${known.join(', ')}` : 'a type from project.json "types"',
      ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
      docsRef: 'guide/project.md',
    });
  };
  manifest.entities.forEach((e, i) => {
    if (e.type !== undefined && !knownSet.has(e.type))
      flag(`/entities/${i}/type`, e.type, 'entity');
  });
  for (const [name, prefab] of Object.entries(manifest.prefabs)) {
    if (prefab.type !== undefined && !knownSet.has(prefab.type)) {
      flag(
        `/prefabs/${name.replaceAll('~', '~0').replaceAll('/', '~1')}/type`,
        prefab.type,
        `prefab "${name}"`,
      );
    }
  }
  return issues;
}
