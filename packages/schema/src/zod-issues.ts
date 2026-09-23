import { z } from 'zod';
import type { ValidationIssue } from './issues';

interface RawIssue {
  code?: string;
  path: PropertyKey[];
  message: string;
  expected?: unknown;
  values?: unknown[];
  keys?: string[];
  errors?: RawIssue[][];
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  format?: string;
}

/** Convert a ZodError into the engine's ValidationIssue model. */
export function zodErrorToIssues(
  error: z.ZodError,
  data: unknown,
  schema?: z.ZodType,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const issue of error.issues as unknown as RawIssue[]) {
    collect(issue, data, schema, out);
  }
  return out;
}

function collect(
  issue: RawIssue,
  data: unknown,
  schema: z.ZodType | undefined,
  out: ValidationIssue[],
): void {
  if (issue.code === 'invalid_union' && Array.isArray(issue.errors) && issue.errors.length > 0) {
    // Collapse to the branch whose issues reach deepest into the document instead of
    // dumping every branch's complaints.
    let best: RawIssue[] | undefined;
    let bestDepth = -1;
    for (const branch of issue.errors) {
      const depth = branch.reduce((d, i) => Math.max(d, i.path.length), 0);
      if (depth > bestDepth) {
        bestDepth = depth;
        best = branch;
      }
    }
    if (best !== undefined && bestDepth > 0) {
      for (const sub of best) {
        collect(prefixPath(sub, issue.path), data, schema, out);
      }
      return;
    }
  }
  out.push(toIssue(issue, data, schema));
}

function prefixPath(sub: RawIssue, parent: PropertyKey[]): RawIssue {
  // Union branch issue paths are relative to the union schema.
  if (parent.length === 0) return sub;
  return { ...sub, path: [...parent, ...sub.path] };
}

/** A format envelope id: `molen/scene@3`, `molen/component/transform@1`. */
const FORMAT_ENVELOPE = /^molen\/([a-z-]+(?:\/[a-z-]+)*)@(\d+)$/;

/**
 * The `format` envelope is the document's identity, not one more enum value. Reported as a
 * generic `invalid_value` it reads "expected \"molen/scene@3\"" + "did you mean
 * \"molen/scene@3\"?", which invites an agent to edit the version string and then meet the real
 * breaking changes one at a time. Say what the document claims to be, what this build reads,
 * and (via the kind's docsRef, filled in by validateByKind) where to look. This is not a
 * migration: a skewed document still fails.
 */
function formatEnvelopeIssue(
  pointer: string,
  issue: RawIssue,
  value: unknown,
): ValidationIssue | undefined {
  const values = issue.values ?? [];
  const expectedId = values.length === 1 ? values[0] : undefined;
  if (typeof expectedId !== 'string') return undefined;
  const want = FORMAT_ENVELOPE.exec(expectedId);
  if (want === null) return undefined;
  const wantKind = want[1] as string;
  const wantVersion = Number(want[2]);
  const expected = JSON.stringify(expectedId);
  if (value === undefined) {
    return {
      path: pointer,
      code: 'missing_format',
      message: `missing "format" envelope; every ${wantKind} document declares one`,
      expected,
      received: 'undefined (missing)',
      hint: `add "format": ${expected} as the first key — it is how every tool identifies the document`,
    };
  }
  if (typeof value !== 'string') return undefined;
  const got = FORMAT_ENVELOPE.exec(value);
  if (got === null) return undefined;
  const gotKind = got[1] as string;
  const gotVersion = Number(got[2]);
  const received = JSON.stringify(value);
  if (gotKind !== wantKind) {
    return {
      path: pointer,
      code: 'format_kind_mismatch',
      message: `document declares ${received}, which is a ${gotKind} document, not a ${wantKind}`,
      expected,
      received,
      hint: `validate it as a ${gotKind} (the kind is taken from "format"), or replace the envelope if this really is a ${wantKind}`,
    };
  }
  return {
    path: pointer,
    code: 'format_version_skew',
    message: `document declares ${received}; this build reads ${expected}`,
    expected,
    received,
    hint:
      gotVersion < wantVersion
        ? `${wantKind}@${wantVersion} is a different shape, not a renamed ${wantKind}@${gotVersion}: re-author the document against the current schema (\`molen schema get ${wantKind}\`) instead of bumping the version string`
        : `${wantKind}@${gotVersion} is newer than this build reads: upgrade @bendyline/molen-* to a version that ships ${wantKind}@${gotVersion}, or re-author the document as ${expected}`,
  };
}

function toIssue(issue: RawIssue, data: unknown, schema?: z.ZodType): ValidationIssue {
  // Zod reports unrecognized_keys at the parent object; point the pointer at the key itself.
  const effectivePath =
    issue.code === 'unrecognized_keys' && issue.keys?.length === 1 && issue.keys[0] !== undefined
      ? [...issue.path, issue.keys[0]]
      : issue.path;
  const pointer = toPointer(effectivePath);
  const value = getAtPath(data, issue.path);
  let message = issue.message;
  let expected: string | undefined;
  let hint: string | undefined;
  let received: string | undefined = renderValue(value);

  if (issue.code === 'invalid_value' && pointer === '/format' && issue.path.length === 1) {
    const envelope = formatEnvelopeIssue(pointer, issue, value);
    if (envelope !== undefined) return envelope;
  }

  switch (issue.code) {
    case 'invalid_type': {
      expected = String(issue.expected);
      if (value === undefined) received = 'undefined (missing)';
      break;
    }
    case 'invalid_value': {
      const values = issue.values ?? [];
      expected = `one of: ${values.map((v) => JSON.stringify(v)).join(', ')}`;
      if (typeof value === 'string') {
        const candidates = values.filter((v): v is string => typeof v === 'string');
        const near = nearest(value, candidates);
        if (near !== undefined) hint = `did you mean ${JSON.stringify(near)}?`;
      }
      break;
    }
    case 'unrecognized_keys': {
      const keys = issue.keys ?? [];
      message = `unknown key${keys.length > 1 ? 's' : ''}: ${keys.map((k) => JSON.stringify(k)).join(', ')}`;
      const valid = schemaKeysAt(schema, issue.path);
      if (valid !== undefined && valid.length > 0) {
        expected = `known keys: ${valid.join(', ')}`;
        if (keys.length === 1 && keys[0] !== undefined) {
          const near = nearest(keys[0], valid);
          if (near !== undefined) hint = `did you mean ${JSON.stringify(near)}?`;
        }
      }
      received = undefined;
      break;
    }
    case 'too_small': {
      expected = `${issue.origin ?? 'value'} of at least ${String(issue.minimum)}`;
      break;
    }
    case 'too_big': {
      expected = `${issue.origin ?? 'value'} of at most ${String(issue.maximum)}`;
      break;
    }
    case 'invalid_format': {
      expected = issue.format !== undefined ? `string matching ${issue.format}` : 'valid format';
      break;
    }
    default:
      break;
  }

  const result: ValidationIssue = { path: pointer, code: issue.code ?? 'invalid', message };
  if (expected !== undefined) result.expected = expected;
  if (received !== undefined) result.received = received;
  if (hint !== undefined) result.hint = hint;
  return result;
}

function toPointer(path: PropertyKey[]): string {
  if (path.length === 0) return '';
  return `/${path.map((seg) => String(seg).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function getAtPath(data: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = data;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[seg];
  }
  return cur;
}

const MAX_RENDER = 60;

function renderValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  let s: string;
  try {
    s = JSON.stringify(value) ?? String(value);
  } catch {
    s = String(value);
  }
  return s.length > MAX_RENDER ? `${s.slice(0, MAX_RENDER - 1)}…` : s;
}

/** The options of a (discriminated) union, or undefined for anything else. */
function unionOptions(schema: z.ZodType): z.ZodType[] | undefined {
  if (!(schema instanceof z.ZodUnion)) return undefined;
  const options = (schema as unknown as { options?: unknown }).options;
  return Array.isArray(options) ? (options as z.ZodType[]).map(unwrap) : undefined;
}

/**
 * Best-effort walk of a Zod schema to find the known object keys at a path. Union branches are
 * merged: `collider` is a discriminated union, and an unknown key there deserves the same
 * did-you-mean ("isstatic" → "isStatic") as an unknown key on a plain object.
 */
function schemaKeysAt(schema: z.ZodType | undefined, path: PropertyKey[]): string[] | undefined {
  if (schema === undefined) return undefined;
  try {
    let cur: z.ZodType | undefined = unwrap(schema);
    for (const seg of path) {
      if (cur === undefined) return undefined;
      const options = unionOptions(cur);
      if (options !== undefined) {
        // Descend into the first branch that knows the key (branches agree on shared fields).
        cur = options
          .map((o) =>
            o instanceof z.ZodObject
              ? (o.shape as Record<string, z.ZodType>)[String(seg)]
              : undefined,
          )
          .find((s) => s !== undefined);
      } else if (cur instanceof z.ZodObject) {
        cur = (cur.shape as Record<string, z.ZodType>)[String(seg)];
      } else if (cur instanceof z.ZodArray) {
        cur = cur.element as z.ZodType;
      } else if (cur instanceof z.ZodRecord) {
        cur = cur.valueType as z.ZodType;
      } else {
        return undefined;
      }
      cur = cur === undefined ? undefined : unwrap(cur);
    }
    if (cur instanceof z.ZodObject) return Object.keys(cur.shape);
    const options = cur === undefined ? undefined : unionOptions(cur);
    if (options !== undefined) {
      const keys = new Set<string>();
      for (const option of options) {
        if (!(option instanceof z.ZodObject)) return undefined;
        for (const key of Object.keys(option.shape)) keys.add(key);
      }
      return keys.size > 0 ? [...keys] : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function unwrap(schema: z.ZodType): z.ZodType {
  let cur = schema;
  for (let i = 0; i < 8; i++) {
    const candidate = cur as unknown as { unwrap?: () => z.ZodType };
    if (typeof candidate.unwrap === 'function') {
      cur = candidate.unwrap();
      continue;
    }
    return cur;
  }
  return cur;
}

/** Nearest candidate by Levenshtein distance, if close enough to be a likely typo. */
export function nearest(input: string, candidates: string[]): string | undefined {
  return nearestWithDistance(input, candidates)?.candidate;
}

/** Like `nearest`, but also reports the (case-insensitive) edit distance. */
export function nearestWithDistance(
  input: string,
  candidates: string[],
): { candidate: string; distance: number } | undefined {
  let best: string | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  const threshold = Math.max(2, Math.floor(input.length / 3));
  return best !== undefined && bestDist <= threshold
    ? { candidate: best, distance: bestDist }
    : undefined;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        (cur[j - 1] as number) + 1,
        (prev[j] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n] as number;
}
