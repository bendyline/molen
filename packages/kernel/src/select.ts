import type { ComponentMap, EntityId, JsonValue } from '@bendyline/molen-schema';
import { captureEntities } from './snapshot';
import type { World } from './world';

// Selector DSL (docs/03-data-formats.md §6): "#id", "tag:name", "has:component",
// space-separated conjunction, optional trailing value path like ".health.hp" or
// ".transform.pos[1]".

export interface ParsedSelector {
  predicates: Predicate[];
  /** Trailing value path tokens, e.g. ["health", "hp"] or ["transform", "pos", 1]. */
  valuePath: Array<string | number>;
}

type Predicate =
  | { kind: 'id'; id: string }
  | { kind: 'tag'; name: string }
  | { kind: 'has'; component: string };

export function parseSelector(selector: string): ParsedSelector {
  const trimmed = selector.trim();
  // Split off a value path: the first token starting with '.' begins the path.
  const dotIndex = trimmed.indexOf('.');
  const predicatePart = dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
  const pathPart = dotIndex === -1 ? '' : trimmed.slice(dotIndex);

  const predicates: Predicate[] = [];
  for (const token of predicatePart.split(/\s+/).filter((t) => t.length > 0)) {
    if (token.startsWith('#')) predicates.push({ kind: 'id', id: token.slice(1) });
    else if (token.startsWith('tag:')) predicates.push({ kind: 'tag', name: token.slice(4) });
    else if (token.startsWith('has:')) predicates.push({ kind: 'has', component: token.slice(4) });
    else throw new Error(`invalid selector token "${token}" (expected #id, tag:x, or has:comp)`);
  }
  return { predicates, valuePath: parseValuePath(pathPart) };
}

function parseValuePath(path: string): Array<string | number> {
  if (path === '') return [];
  const tokens: Array<string | number> = [];
  // Match ".name" segments and "[index]" segments.
  const re = /\.([A-Za-z_][\w-]*)|\[(\d+)\]/g;
  let m: RegExpExecArray | null = re.exec(path);
  while (m !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(Number(m[2]));
    m = re.exec(path);
  }
  return tokens;
}

/** A `tag` component with a `name` field marks an entity for `tag:` selection. */
function entityHasTag(components: ComponentMap, name: string): boolean {
  const tag = components.tag;
  if (tag === undefined) return false;
  return (tag as { name?: unknown }).name === name;
}

export interface SelectMatch {
  id: EntityId;
  components: ComponentMap;
  /** The resolved value at the selector's value path, if one was given. */
  value?: JsonValue;
}

/** Evaluate a selector against the world; returns matching entities (+ resolved value path). */
export function select(world: World, selector: string): SelectMatch[] {
  const parsed = parseSelector(selector);
  const entities = captureEntities(world);
  const out: SelectMatch[] = [];
  for (const id of Object.keys(entities)) {
    const components = entities[id] as ComponentMap;
    if (!matches(id, components, parsed.predicates)) continue;
    const match: SelectMatch = { id, components };
    if (parsed.valuePath.length > 0) {
      match.value = resolvePath(components, parsed.valuePath);
    }
    out.push(match);
  }
  return out;
}

function matches(id: EntityId, components: ComponentMap, predicates: Predicate[]): boolean {
  for (const p of predicates) {
    if (p.kind === 'id' && id !== p.id) return false;
    if (p.kind === 'has' && components[p.component] === undefined) return false;
    if (p.kind === 'tag' && !entityHasTag(components, p.name)) return false;
  }
  return true;
}

function resolvePath(
  components: ComponentMap,
  path: Array<string | number>,
): JsonValue | undefined {
  let cur: JsonValue | undefined = components as unknown as JsonValue;
  for (const seg of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    if (typeof seg === 'number') {
      cur = Array.isArray(cur) ? (cur[seg] as JsonValue | undefined) : undefined;
    } else {
      cur = (cur as { [k: string]: JsonValue | undefined })[seg];
    }
  }
  return cur ?? undefined;
}
