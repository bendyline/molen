import { z } from 'zod';
import { formatIssues, type ValidationIssue } from './issues';
import type { JsonObject, JsonValue } from './json';
import { declaresPattern, unsafePatterns } from './regex-safety';
import { zodErrorToIssues } from './zod-issues';

// Scene-declared command payload shapes (scene@3 `commands: { <type>: { payload } }`). The
// payload is a JSON Schema document compiled to Zod once per world build; failures render
// through the same issue formatter every other validation surface uses, so a rejected command
// reads like a rejected scene: JSON Pointer, expected, received, did-you-mean.
//
// Supported subset (what z.fromJSONSchema handles reliably and what an authoring model needs):
// type object/array/number/integer/string/boolean/null, properties, required,
// additionalProperties, items/prefixItems, enum, const, minimum/maximum, minLength/maxLength,
// minItems/maxItems, anyOf/oneOf, description.
//
// A declared `pattern` is untrusted: it comes from the scene, it becomes a RegExp, and it runs
// against every command anyone submits. Patterns are structurally screened here (regex-safety.ts)
// and the strings they see are length-capped, so neither a hostile nor a careless pattern can
// stall the lockstep kernel.

/**
 * The longest string a declared pattern is tested against. A pattern check is only as bounded as
 * its input: even a linear regex is O(n) per test, and a megabyte of string arrives free over the
 * wire. Payloads that need more should carry a reference (an id, an asset path), not the bytes.
 */
const MAX_PATTERN_INPUT = 4096;

/** Result of a payload validator: `ok`, or a formatted, agent-facing reason. */
export type PayloadCheck = { ok: true } | { ok: false; message: string };

/**
 * Compile a JSON Schema payload shape to a Zod schema. Throws (with the converter's message)
 * when the document uses keywords the converter does not support, and refuses a `pattern` that
 * can backtrack catastrophically — `molen validate` reports the same patterns as issues, but a
 * host that builds a world straight from a scene file never gets to run one.
 */
export function compileCommandPayload(schema: JsonObject): z.ZodType {
  const unsafe = unsafePatterns(schema);
  const first = unsafe[0];
  if (first !== undefined) {
    throw new Error(
      `pattern ${JSON.stringify(first.pattern)} at "${first.pointer}" ${first.reason}`,
    );
  }
  return z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
}

/** JSON Pointer of the first string longer than the cap, with its length. */
function overlongString(
  value: JsonValue,
  pointer: string,
): { pointer: string; length: number } | undefined {
  if (typeof value === 'string') {
    return value.length > MAX_PATTERN_INPUT ? { pointer, length: value.length } : undefined;
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = overlongString(item as JsonValue, `${pointer}/${i}`);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== 'object') return undefined;
  for (const [key, item] of Object.entries(value)) {
    const segment = key.replaceAll('~', '~0').replaceAll('/', '~1');
    const found = overlongString(item as JsonValue, `${pointer}/${segment}`);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Build a command payload validator from a declared JSON Schema. The message on failure is the
 * standard formatted issue block, labelled `command "<type>" payload`.
 */
export function commandPayloadValidator(
  type: string,
  schema: JsonObject,
): (payload: JsonValue) => PayloadCheck {
  const zod = compileCommandPayload(schema);
  // Only patterns make string length a hazard, so only a schema that declares one pays for the
  // walk — and a payload without patterns keeps accepting the long strings it accepts today.
  const capped = declaresPattern(schema);
  return (payload) => {
    const long = capped ? overlongString(payload, '') : undefined;
    if (long !== undefined) {
      const issue: ValidationIssue = {
        path: long.pointer,
        code: 'payload_string_too_long',
        message: `string is ${long.length} characters; this payload declares a "pattern", so its strings are capped at ${MAX_PATTERN_INPUT}`,
        expected: `at most ${MAX_PATTERN_INPUT} characters`,
        received: `${long.length} characters`,
        hint: 'send a reference (an entity id, an asset id, a path) instead of inline text',
      };
      return { ok: false, message: formatIssues(`command "${type}" payload`, [issue]) };
    }
    const result = zod.safeParse(payload);
    if (result.success) return { ok: true };
    const issues = zodErrorToIssues(result.error, payload, zod);
    return { ok: false, message: formatIssues(`command "${type}" payload`, issues) };
  };
}
