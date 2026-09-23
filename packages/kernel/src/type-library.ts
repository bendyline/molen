import {
  buildTypeIndex,
  type ComponentMap,
  type JsonValue,
  type ResolvedTypes,
  resolveAllTypes,
  type TypesDoc,
  validate,
} from '@bendyline/molen-schema';
import { cloneJson } from './clone';
import { hashJson } from './hash';

// Entity type definitions as content: loaded from wherever the host keeps them (a pack, a
// bundled JSON import, a test fixture) and handed to the code that needs them, instead of being
// compiled into a package. Lookups stay synchronous; only the loading before this is async.

export interface TypeLibrary {
  /** Hash over every resolved type (components and scripts); the same for any document order. */
  readonly hash: string;
  /** The resolved registry; pass it as `types` to buildWorld. */
  readonly types: ResolvedTypes;
  /** Every type id, in document order. */
  ids(): string[];
  has(id: string): boolean;
  /** A type's resolved components (inherited ones included), as a fresh copy. */
  components(id: string): ComponentMap;
  /** One resolved component of a type, as a fresh copy; throws when the type lacks it. */
  component<T>(id: string, name: string): T;
  /** Ids of the types that have a component, in document order. */
  idsWith(name: string): string[];
}

export interface TypeLibraryOptions {
  /**
   * Script sources for types whose scripts use `path` refs, as a bundler's raw glob hands them
   * over (matched by path suffix). Types without scripts, or with inline `code`, need none.
   */
  scripts?: Readonly<Record<string, string>>;
  /** Names the content in errors, e.g. "molen.entities@0.0.1". */
  label?: string;
}

/** Find the one source key that ends with a script's declared `path`. */
export function scriptSourceFor(path: string, scripts: Readonly<Record<string, string>>): string {
  const direct = scripts[path];
  if (direct !== undefined) return direct;
  const matches = Object.keys(scripts).filter((key) => key.endsWith(`/${path}`));
  if (matches.length === 1) {
    const only = matches[0] as string;
    return scripts[only] as string;
  }
  const known = Object.keys(scripts).sort().join(', ');
  if (matches.length === 0) {
    throw new Error(
      `no source for script "${path}": none of the given keys end with it (have: ${known || 'none'})`,
    );
  }
  throw new Error(
    `ambiguous source for script "${path}": ${matches.sort().join(' and ')} both match. ` +
      'Narrow the glob, or key the sources by the exact path the scene declares.',
  );
}

/**
 * Validate molen/types@1 documents and resolve them into a registry. Script `path` refs are
 * inlined from `scripts` when it is given, and left as they are otherwise.
 */
export function resolveTypeDocuments(
  types: unknown,
  scripts?: Readonly<Record<string, string>>,
): ResolvedTypes {
  const docs = Array.isArray(types) ? types : [types];
  const parsed = docs.map((doc, i) => {
    const result = validate('types', doc);
    if (!result.ok) throw new Error(result.formatted);
    if (scripts !== undefined) {
      for (const def of Object.values(result.value.types)) {
        for (const script of def.scripts) {
          if (script.path === undefined) continue;
          script.code = scriptSourceFor(script.path, scripts);
          delete script.path;
        }
      }
    }
    return { doc: result.value as TypesDoc, source: `types[${i}]` };
  });
  const { index, issues } = buildTypeIndex(parsed);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join('; '));
  return resolveAllTypes(index);
}

/** Build a type library from molen/types@1 documents already in memory. */
export function createTypeLibrary(docs: unknown, options: TypeLibraryOptions = {}): TypeLibrary {
  const types = resolveTypeDocuments(docs, options.scripts);
  const label = options.label ?? 'the type library';
  const ids = [...types.keys()];
  const byId: Record<string, JsonValue> = {};
  for (const id of [...ids].sort()) {
    const resolved = types.get(id);
    byId[id] = { components: resolved?.components, scripts: resolved?.scripts } as JsonValue;
  }
  const hash = hashJson(byId as JsonValue);
  const resolved = (id: string): ComponentMap => {
    const type = types.get(id);
    if (type === undefined) throw new Error(`unknown entity type "${id}" in ${label}`);
    return type.components;
  };
  return {
    hash,
    types,
    ids: () => [...ids],
    has: (id) => types.has(id),
    components: (id) => cloneJson(resolved(id) as unknown as JsonValue) as unknown as ComponentMap,
    component: <T>(id: string, name: string): T => {
      const value = resolved(id)[name];
      if (value === undefined) throw new Error(`entity type "${id}" has no "${name}" component`);
      return cloneJson(value as JsonValue) as unknown as T;
    },
    idsWith: (name) => ids.filter((id) => resolved(id)[name] !== undefined),
  };
}
