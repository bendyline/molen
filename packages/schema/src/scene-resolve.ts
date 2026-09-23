import type { JsonObject } from './json';
import { deepMergeJson } from './merge';
import type { ComponentMap, SceneManifest, ScriptRef } from './types';

export interface ResolvedEntityType {
  components: ComponentMap;
  /** Ancestor-first behavior scripts, already source-inlined by the host loader. */
  scripts: ScriptRef[];
}
/** Pre-flattened project type registry. */
export type ResolvedTypes = ReadonlyMap<string, ResolvedEntityType>;

export interface SceneResolveOptions {
  /** Flattened registry types; required when the scene references `type` ids. */
  types?: ResolvedTypes;
}

function typeComponents(id: string | undefined, opts?: SceneResolveOptions): ComponentMap {
  if (id === undefined) return {};
  const type = opts?.types?.get(id);
  if (type === undefined) {
    throw new Error(`scene references unknown type "${id}" — is a project.json with types loaded?`);
  }
  return type.components;
}

/** Resolve a prefab's components: registry type <- `extends` chain <- own components. */
export function resolvePrefab(
  manifest: SceneManifest,
  name: string,
  opts?: SceneResolveOptions,
  seen: string[] = [],
): ComponentMap {
  if (seen.includes(name)) {
    throw new Error(`prefab inheritance cycle: ${[...seen, name].join(' → ')}`);
  }
  const prefab = manifest.prefabs[name];
  if (prefab === undefined) throw new Error(`scene references unknown prefab "${name}"`);
  const base =
    prefab.extends !== undefined
      ? resolvePrefab(manifest, prefab.extends, opts, [...seen, name])
      : (typeComponents(prefab.type, opts) as JsonObject);
  const withType =
    prefab.extends !== undefined && prefab.type !== undefined
      ? deepMergeJson(typeComponents(prefab.type, opts) as JsonObject, base as JsonObject)
      : base;
  return deepMergeJson(withType as JsonObject, prefab.components as JsonObject) as ComponentMap;
}

/** Resolve a scene entity's final components (type <- prefab <- components). */
export function resolveEntityComponents(
  manifest: SceneManifest,
  entity: {
    type?: string;
    prefab?: string;
    components?: ComponentMap;
  },
  opts?: SceneResolveOptions,
): ComponentMap {
  let components: ComponentMap = typeComponents(entity.type, opts);
  if (entity.prefab !== undefined) {
    components = deepMergeJson(
      components as JsonObject,
      resolvePrefab(manifest, entity.prefab, opts) as JsonObject,
    ) as ComponentMap;
  }
  if (entity.components !== undefined) {
    components = deepMergeJson(
      components as JsonObject,
      entity.components as JsonObject,
    ) as ComponentMap;
  }
  return components;
}
