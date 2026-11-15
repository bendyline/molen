import {
  buildTypeIndex,
  type ComponentMap,
  formatIssues,
  getSchema,
  type JsonValue,
  type ResolvedTypes,
  resolveAllTypes,
  type TypeIndexEntry,
  type TypesDoc,
  type ValidationIssue,
  validate,
} from '@bendyline/molen-schema';
import { cloneJson } from './clone';
import { hashJson } from './hash';

// Entity type definitions as content: loaded from wherever the host keeps them (a pack, a
// bundled JSON import, a test fixture) and handed to the code that needs them, instead of being
// compiled into a package. Lookups stay synchronous; only the loading before this is async.

export interface TypeLibrary {
  /**
   * Hash over every resolved type (components and scripts); the same for any document order.
   * Computed when first read.
   */
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
  /**
   * How closely the documents are checked before they are resolved (default `'full'`).
   *
   * `'full'` validates every document against molen/types@1, base types' components included:
   * what tooling, editors and hand-written content need. It is most of the cost of building a
   * library: about 0.5 s of a page's main thread for the stock aircraft and vehicle types.
   *
   * `'structure'` is for content already validated where it was built, such as packs a host
   * builds, checks and serves itself. It checks only what resolving relies on: the document
   * envelope; each type's `components`, `assets`, `scripts` and `extends` shapes; ids inside the
   * namespace; script sources; and `extends` cycles. Component data is taken as it is, so a
   * field this version's schema does not know is kept rather than rejected. Missing
   * `components`, `assets` and `scripts` default to empty, as in the schema.
   */
  checks?: TypeChecks;
  /**
   * Leave out what fails instead of throwing, and report each omission here. A type that fails
   * its checks, repeats an id declared earlier, or extends a type that is missing or left out is
   * dropped on its own; a document whose envelope fails (format, namespace) is dropped whole.
   * Without it, the first problem throws.
   */
  onSkip?: (message: string) => void;
}

/** How closely `createTypeLibrary` checks its documents; see `TypeLibraryOptions.checks`. */
export type TypeChecks = 'full' | 'structure';

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

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const escapePointer = (segment: string): string =>
  segment.replaceAll('~', '~0').replaceAll('/', '~1');

const TYPE_PATH = /^\/types\/([^/]+)(?:\/|$)/;

/** Each type's issues, keyed by its id; undefined when any issue is about the document itself. */
function issuesByType(
  issues: readonly ValidationIssue[],
): Map<string, ValidationIssue[]> | undefined {
  const byType = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const match = TYPE_PATH.exec(issue.path);
    if (match === null) return undefined;
    const id = (match[1] as string).replaceAll('~1', '/').replaceAll('~0', '~');
    byType.set(id, [...(byType.get(id) ?? []), issue]);
  }
  return byType;
}

/**
 * The `'structure'` checks: what resolving relies on, with the schema's defaults filled in. The
 * envelope and each type definition are copied (script refs too, as inlining changes them);
 * component data is shared with the document, and resolving deep-copies it.
 */
function checkStructure(doc: unknown): { value?: TypesDoc; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push({ path, code: 'invalid_structure', message });
  };
  if (!isObject(doc)) {
    add('', 'a types document must be a JSON object');
    return { issues };
  }
  if (doc.format !== 'molen/types@1') add('/format', 'format must be "molen/types@1"');
  if (typeof doc.namespace !== 'string' || doc.namespace === '')
    add('/namespace', 'namespace must be a dotted id');
  if (doc.types !== undefined && !isObject(doc.types))
    add('/types', 'types must map type ids to definitions');
  if (issues.length > 0) return { issues };
  const types: Record<string, unknown> = {};
  for (const [id, def] of Object.entries((doc.types ?? {}) as Record<string, unknown>)) {
    const at = `/types/${escapePointer(id)}`;
    const before = issues.length;
    if (!isObject(def)) {
      add(at, 'a type definition must be an object');
      continue;
    }
    const { components = {}, assets = [], scripts = [] } = def;
    if (!isObject(components) || !Object.values(components).every(isObject))
      add(`${at}/components`, 'components must map component names to objects');
    if (!Array.isArray(assets) || !assets.every((asset) => typeof asset === 'string'))
      add(`${at}/assets`, 'assets must be a list of asset ids');
    if (
      !Array.isArray(scripts) ||
      !scripts.every((script) => isObject(script) && typeof script.id === 'string')
    )
      add(`${at}/scripts`, 'scripts must be a list of script refs with ids');
    if (def.extends !== undefined && typeof def.extends !== 'string')
      add(`${at}/extends`, 'extends must be a type id');
    if (issues.length > before) continue;
    const copies = (scripts as Record<string, unknown>[]).map((script) => ({ ...script }));
    types[id] = { ...def, components, assets, scripts: copies };
  }
  const value = { ...doc, types } as unknown as TypesDoc;
  // The schema's own document rules: ids inside the namespace, script sources, extends cycles.
  issues.push(...(getSchema('types')?.meta.validate?.(value) ?? []));
  return { value, issues };
}

/**
 * One document, checked as `checks` says. With `onSkip`, a type with problems is left out and
 * the rest checked again; a document whose problems are not all inside types is left out whole.
 */
function checkTypesDocument(
  doc: unknown,
  source: string,
  checks: TypeChecks,
  onSkip: ((message: string) => void) | undefined,
): TypesDoc | undefined {
  const run = (
    input: unknown,
  ): { value?: TypesDoc; issues: ValidationIssue[]; formatted?: string } => {
    if (checks === 'structure') return checkStructure(input);
    const result = validate('types', input);
    return result.ok
      ? { value: result.value as TypesDoc, issues: [] }
      : { issues: [...result.issues], formatted: result.formatted };
  };
  const first = run(doc);
  if (first.issues.length === 0 && first.value !== undefined) return first.value;
  const formatted = first.formatted ?? formatIssues(`types document ${source}`, first.issues);
  if (onSkip === undefined) throw new Error(formatted);
  const byType = issuesByType(first.issues);
  if (byType === undefined || !isObject(doc) || !isObject(doc.types)) {
    onSkip(`${source} left out: ${formatted}`);
    return undefined;
  }
  for (const [id, issues] of byType) {
    const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    onSkip(`entity type "${id}" left out (${source}): ${detail}`);
  }
  const kept = Object.fromEntries(Object.entries(doc.types).filter(([id]) => !byType.has(id)));
  const second = run({ ...doc, types: kept });
  if (second.issues.length === 0 && second.value !== undefined) return second.value;
  onSkip(
    `${source} left out: ${second.formatted ?? formatIssues(`types document ${source}`, second.issues)}`,
  );
  return undefined;
}

/** Drop (and report) types whose `extends` chain reaches a missing type or loops. */
function dropUnresolvable(
  index: Map<string, TypeIndexEntry>,
  onSkip: (message: string) => void,
): void {
  const broken = new Map<string, string>();
  for (const id of index.keys()) {
    const chain: string[] = [];
    for (let cur: string | undefined = id; cur !== undefined; cur = index.get(cur)?.def.extends) {
      if (chain.includes(cur)) {
        broken.set(id, `its extends chain loops: ${[...chain, cur].join(' → ')}`);
        break;
      }
      if (!index.has(cur)) {
        broken.set(id, `its extends chain reaches "${cur}", which is missing or was left out`);
        break;
      }
      chain.push(cur);
    }
  }
  for (const [id, why] of broken) {
    index.delete(id);
    onSkip(`entity type "${id}" left out: ${why}`);
  }
}

/**
 * Check molen/types@1 documents (fully, unless `options.checks` says otherwise) and resolve them
 * into a registry. Script `path` refs are inlined from `scripts` when it is given, and left as
 * they are otherwise. With `options.onSkip`, what fails is left out and reported, not thrown.
 */
export function resolveTypeDocuments(
  types: unknown,
  scripts?: Readonly<Record<string, string>>,
  options: Pick<TypeLibraryOptions, 'checks' | 'onSkip'> = {},
): ResolvedTypes {
  const docs = Array.isArray(types) ? types : [types];
  const { checks = 'full', onSkip } = options;
  const parsed: { doc: TypesDoc; source: string }[] = [];
  docs.forEach((doc, i) => {
    const source = `types[${i}]`;
    const value = checkTypesDocument(doc, source, checks, onSkip);
    if (value === undefined) return;
    if (scripts !== undefined) {
      for (const def of Object.values(value.types)) {
        for (const script of def.scripts) {
          if (script.path === undefined) continue;
          script.code = scriptSourceFor(script.path, scripts);
          delete script.path;
        }
      }
    }
    parsed.push({ doc: value, source });
  });
  const { index, issues } = buildTypeIndex(parsed);
  if (issues.length > 0) {
    if (onSkip === undefined) throw new Error(issues.map((issue) => issue.message).join('; '));
    // The index keeps the first declaration of a repeated id.
    for (const issue of issues) onSkip(`${issue.message}; the first is kept`);
  }
  if (onSkip !== undefined) dropUnresolvable(index, onSkip);
  return resolveAllTypes(index);
}

/** Build a type library from molen/types@1 documents already in memory. */
export function createTypeLibrary(docs: unknown, options: TypeLibraryOptions = {}): TypeLibrary {
  const types = resolveTypeDocuments(docs, options.scripts, options);
  const label = options.label ?? 'the type library';
  const ids = [...types.keys()];
  // Computed on first read: canonical JSON and SHA-256 over every resolved type took about 2 s
  // of a page's main thread for the vehicle and aircraft packs, before an Earth view could mount,
  // and the hash is for tooling and caches, not for building a world.
  let hash: string | undefined;
  const computeHash = (): string => {
    const byId: Record<string, JsonValue> = {};
    for (const id of [...ids].sort()) {
      const resolved = types.get(id);
      byId[id] = { components: resolved?.components, scripts: resolved?.scripts } as JsonValue;
    }
    return hashJson(byId as JsonValue);
  };
  const resolved = (id: string): ComponentMap => {
    const type = types.get(id);
    if (type === undefined) throw new Error(`unknown entity type "${id}" in ${label}`);
    return type.components;
  };
  return {
    get hash() {
      hash ??= computeHash();
      return hash;
    },
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
