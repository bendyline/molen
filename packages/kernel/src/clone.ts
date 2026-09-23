import type { JsonObject, JsonValue } from '@bendyline/molen-schema';

/** Structured deep clone of pure-JSON data. Used so stored components never alias caller data. */
export function cloneJson<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => cloneJson(v)) as T;
  // Null-prototype records preserve every legal JSON key, including "__proto__" and
  // "constructor", without invoking inherited setters.
  const out = Object.create(null) as Record<string, JsonValue>;
  for (const key of Object.keys(value)) {
    out[key] = cloneJson((value as Record<string, JsonValue>)[key] as JsonValue);
  }
  return out as T;
}

/** Deep-freeze pure-JSON data (dev mode) so in-place mutation throws instead of corrupting deltas. */
export function deepFreeze<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, JsonValue>)[key] as JsonValue);
  }
  Object.freeze(value);
  return value;
}

/**
 * Shallow-merge a partial patch into a clone of base (whole-component semantics at top level).
 * The result is a fresh null-prototype object, like every other stored component.
 */
export function patchJson<T extends JsonObject>(base: T, partial: Partial<T>): T {
  const out = cloneJson(base) as Record<string, JsonValue>;
  for (const key of Object.keys(partial)) {
    out[key] = cloneJson((partial as Record<string, JsonValue>)[key] as JsonValue);
  }
  return out as T;
}
