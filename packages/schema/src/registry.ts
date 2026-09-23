import type { z } from 'zod';
import type { ValidationIssue } from './issues';
import type { JsonValue } from './json';

export interface SchemaMeta {
  /** Format envelope id, e.g. "molen/scene@1". */
  id: string;
  title: string;
  description: string;
  /** At least one valid example document; feeds error hints, docs, and tests. */
  examples: JsonValue[];
  docsRef?: string;
  /**
   * Optional post-parse, cross-field validation that Zod (and thus the emitted JSON Schema)
   * can't express — e.g. material-graph cycles, dangling node refs, pixel-grid row lengths.
   * Receives the parsed (defaults-applied) value; returns pinpoint issues (empty = valid).
   * Runs only on Zod-valid documents, so it never double-reports structural errors.
   */
  validate?: (data: unknown) => ValidationIssue[];
}

export interface LegacySchemaVersion {
  /** The legacy format envelope id, e.g. "molen/scene@1". */
  id: string;
  zod: z.ZodType;
  /** Pure upgrade from this version's parsed shape to the CURRENT version's shape. */
  upgrade: (legacyParsed: unknown) => unknown;
  /** At least one valid legacy example (feeds cross-validation tests and migrate docs). */
  examples: JsonValue[];
}

export interface SchemaEntry {
  kind: string;
  zod: z.ZodType;
  meta: SchemaMeta;
  /** Older accepted versions, newest first; validate() auto-upgrades them with a notice. */
  legacy: LegacySchemaVersion[];
}

export interface SchemaSummary {
  kind: string;
  id: string;
  title: string;
  description: string;
}

/**
 * Absolute base URI for the `$id` of every emitted JSON Schema (scripts/emit-schemas.mjs).
 * The docs site (molen.dev) serves them, so an authored document can carry a resolvable
 * `"$schema"` line and one emitted schema can `$ref` another. A bare relative `$id` like
 * `molen/scene@3` resolves against nothing, which is why the format envelope id (meta.id) and
 * the schema `$id` are deliberately different strings.
 */
export const SCHEMA_ID_BASE: string = 'https://molen.dev/schemas/';

/**
 * The absolute `$id` an emitted JSON Schema carries, derived from a format envelope id:
 * `molen/scene@3` → `https://molen.dev/schemas/scene@3.json`, and
 * `molen/component/transform@1` → `https://molen.dev/schemas/component/transform@1.json`.
 */
export function jsonSchemaId(formatId: string): string {
  return `${SCHEMA_ID_BASE}${formatId.replace(/^molen\//, '')}.json`;
}

const entries = new Map<string, SchemaEntry>();

/** Capability packages register their formats here; tooling sees one unified registry. */
export function registerSchema(kind: string, zod: z.ZodType, meta: SchemaMeta): void {
  if (entries.has(kind)) throw new Error(`schema kind "${kind}" is already registered`);
  if (meta.examples.length === 0) {
    throw new Error(`schema kind "${kind}" must provide at least one example`);
  }
  entries.set(kind, { kind, zod, meta, legacy: [] });
}

/**
 * Register a previous version of a kind. Documents carrying the legacy `format` id still
 * validate — against the legacy Zod, then upgraded to the current shape via `upgrade()` — and
 * the result carries a deprecation notice (see validateByKind). There is no migration command:
 * a legacy document is upgraded in memory on read, and a breaking change bumps the version.
 */
export function registerLegacySchema(kind: string, legacy: LegacySchemaVersion): void {
  const entry = entries.get(kind);
  if (entry === undefined) {
    throw new Error(`cannot register legacy version for unknown schema kind "${kind}"`);
  }
  if (entry.meta.id === legacy.id || entry.legacy.some((l) => l.id === legacy.id)) {
    throw new Error(`schema version "${legacy.id}" is already registered for kind "${kind}"`);
  }
  if (legacy.examples.length === 0) {
    throw new Error(`legacy schema "${legacy.id}" must provide at least one example`);
  }
  entry.legacy.push(legacy);
}

/** Find the legacy version entry (if any) whose id matches a document's `format`. */
export function getLegacySchema(kind: string, formatId: string): LegacySchemaVersion | undefined {
  return entries.get(kind)?.legacy.find((l) => l.id === formatId);
}

export function getSchema(kind: string): SchemaEntry | undefined {
  return entries.get(kind);
}

export function listSchemas(): SchemaSummary[] {
  return [...entries.values()].map((e) => ({
    kind: e.kind,
    id: e.meta.id,
    title: e.meta.title,
    description: e.meta.description,
  }));
}

export function schemaKinds(): string[] {
  return [...entries.keys()];
}
