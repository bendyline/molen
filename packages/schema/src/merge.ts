import type { JsonObject, JsonValue } from './json';

function cloneValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => cloneValue(v));
  // JSON records may legally contain keys such as "__proto__". A normal object would route
  // assignment through Object.prototype's setter instead of creating an own JSON property.
  const out = Object.create(null) as JsonObject;
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) out[k] = cloneValue(v);
  }
  return out;
}

/**
 * Deep-merge JSON objects (later sources win); arrays and primitives are replaced wholesale.
 * The one merge semantics used everywhere data layers stack: prefab `extends` chains, type
 * defaults under scene data, entity components under overrides. Inputs are never mutated.
 */
export function deepMergeJson(base: JsonObject, override: JsonObject): JsonObject {
  const out = cloneValue(base) as JsonObject;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (
      existing !== undefined &&
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = deepMergeJson(existing as JsonObject, value as JsonObject);
    } else {
      out[key] = cloneValue(value);
    }
  }
  return out;
}
