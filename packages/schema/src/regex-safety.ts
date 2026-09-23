import type { JsonValue } from './json';

// Scene-declared JSON Schemas carry `pattern` keywords, and a pattern becomes a live RegExp that
// runs against every incoming command payload. A pattern with a quantifier inside a quantified
// group — `^(a+)+$` — backtracks catastrophically: ~1.4 s for a 26-character input, doubling per
// character after that. The scene author may be an LLM or anyone who can submit a document, so
// the pattern is untrusted input to the lockstep kernel and to the validating tool.
//
// This is the structural half of the defence (a `safe-regex`-style star-height check, written
// here rather than taken as a dependency — @bendyline/molen-schema depends on nothing but zod).
// The other half is the input cap in commands.ts: star height catches nested quantifiers, not
// ambiguous alternation like `(a|a)*`, and only a bounded input bounds the work either way.

/** The longest pattern accepted; a pathological pattern is usually also a long one. */
const MAX_PATTERN_LENGTH = 1000;

/** One rejected pattern: where it sits in the schema, its source, and why it was rejected. */
export interface UnsafePattern {
  /** JSON Pointer to the `pattern` keyword, relative to the schema document. */
  pointer: string;
  pattern: string;
  reason: string;
}

interface Quantifier {
  /** Index just past the quantifier (and its lazy `?`, if any). */
  end: number;
}

/** Read `*`, `+`, `?` or `{n,m}` (plus a lazy `?`) at `i`, if one is there. */
function readQuantifier(pattern: string, i: number): Quantifier | undefined {
  const ch = pattern[i];
  let end: number;
  if (ch === '*' || ch === '+' || ch === '?') {
    end = i + 1;
  } else if (ch === '{') {
    const counted = /^\{\d+(?:,\d*)?\}/.exec(pattern.slice(i));
    if (counted === null) return undefined;
    end = i + counted[0].length;
  } else {
    return undefined;
  }
  if (pattern[end] === '?') end += 1; // lazy: still one quantifier
  return { end };
}

/** Skip past a `(`, including a `(?:` / `(?=` / `(?!` / `(?<=` / `(?<!` / `(?<name>` opener. */
function skipGroupOpener(pattern: string, i: number): number {
  let j = i + 1;
  if (pattern[j] !== '?') return j;
  j += 1;
  if (pattern[j] === '<' && pattern[j + 1] !== '=' && pattern[j + 1] !== '!') {
    while (j < pattern.length && pattern[j] !== '>') j += 1;
    return j + 1;
  }
  if (pattern[j] === '<') return j + 2;
  if (pattern[j] === ':' || pattern[j] === '=' || pattern[j] === '!') return j + 1;
  return j;
}

/**
 * Why this pattern is unsafe to compile, or undefined when it is fine. Unsafe means star height
 * above 1: a quantifier nested inside a quantified group, the shape every catastrophic
 * backtracking example has. Deliberately conservative — `(\d{3}-){2}` is flagged too, and the
 * fix (flatten the repetition) costs the author one rewrite.
 */
export function patternRisk(pattern: string): string | undefined {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return `is ${pattern.length} characters long (limit ${MAX_PATTERN_LENGTH})`;
  }
  const frames: { hasQuantifier: boolean }[] = [{ hasQuantifier: false }];
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      i += 1;
      while (i < pattern.length && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1;
      i += 1;
      continue;
    }
    if (ch === '(') {
      frames.push({ hasQuantifier: false });
      i = skipGroupOpener(pattern, i);
      continue;
    }
    if (ch === ')') {
      const frame = frames.pop();
      const parent = frames[frames.length - 1];
      // Unbalanced: not our error to report — `new RegExp` rejects it where it is compiled.
      if (frame === undefined || parent === undefined) return undefined;
      i += 1;
      const quantified = readQuantifier(pattern, i);
      if (quantified !== undefined) {
        i = quantified.end;
        if (frame.hasQuantifier) {
          return 'nests a quantifier inside a quantified group, which backtracks catastrophically (e.g. "^(a+)+$" takes over a second on 26 characters and doubles per character after that)';
        }
        parent.hasQuantifier = true;
      } else if (frame.hasQuantifier) {
        parent.hasQuantifier = true; // an unquantified group still carries its quantifier up
      }
      continue;
    }
    const quantified = readQuantifier(pattern, i);
    if (quantified !== undefined) {
      const frame = frames[frames.length - 1];
      if (frame !== undefined) frame.hasQuantifier = true;
      i = quantified.end;
      continue;
    }
    i += 1;
  }
  return undefined;
}

// Keywords whose values are data, not subschemas: a `pattern` string inside one is a default or
// an example, not a regex the validator will ever run.
const DATA_KEYWORDS = new Set(['default', 'const', 'enum', 'examples']);

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Every unsafe `pattern` in a JSON Schema document, with a JSON Pointer to each. Returns an
 * empty array for a schema that declares no pattern at all (the common case).
 */
export function unsafePatterns(schema: JsonValue, basePointer = ''): UnsafePattern[] {
  const out: UnsafePattern[] = [];
  const walk = (node: JsonValue, pointer: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        walk(item as JsonValue, `${pointer}/${i}`);
      });
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (DATA_KEYWORDS.has(key)) continue;
      const childPointer = `${pointer}/${escapePointer(key)}`;
      if (key === 'pattern' && typeof value === 'string') {
        const reason = patternRisk(value);
        if (reason !== undefined) out.push({ pointer: childPointer, pattern: value, reason });
        continue;
      }
      walk(value as JsonValue, childPointer);
    }
  };
  walk(schema, basePointer);
  return out;
}

/** Whether a JSON Schema document declares any `pattern` (so its inputs need a length cap). */
export function declaresPattern(schema: JsonValue): boolean {
  if (Array.isArray(schema)) return schema.some((item) => declaresPattern(item as JsonValue));
  if (schema === null || typeof schema !== 'object') return false;
  for (const [key, value] of Object.entries(schema)) {
    if (DATA_KEYWORDS.has(key)) continue;
    if (key === 'pattern' && typeof value === 'string') return true;
    if (declaresPattern(value as JsonValue)) return true;
  }
  return false;
}
