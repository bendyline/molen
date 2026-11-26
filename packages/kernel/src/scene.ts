import type { ContentIdentity, JsonValue, SceneManifest } from '@bendyline/molen-schema';
import { createWorldFromScene, type SceneResolveOptions } from './scene-data';
import { installSceneScripts } from './scripting';
import type { World } from './world';

export type { ResolvedTypes, SceneResolveOptions } from './scene-data';
export {
  createWorldFromScene,
  resolveEntityComponents,
  resolvePrefab,
  spawnFromData,
} from './scene-data';

/** Convenience for tooling: a manifest plus a code setup step (systems + command handlers). */
export type WorldSetup = (world: World, manifest: SceneManifest) => void;

export interface BuildWorldOptions extends SceneResolveOptions {
  devFreeze?: boolean;
  validateSpawn?: boolean;
  /**
   * Which content the world is built from (see ContentIdentity), e.g. a type library's hash.
   * Recorded in keyframes and replays next to the state hash, never inside it.
   */
  content?: ContentIdentity;
  /**
   * Physics plugin hook (e.g. rapier), run after the data-declared systems and before `setup`.
   * May return script-api extension namespaces (`{ physics: rapierScriptApi(handle) }`).
   */
  physics?: (world: World, manifest: SceneManifest) => Record<string, object> | undefined;
  /**
   * Terrain ground field hook, run after physics and before `setup`. Same contract as `physics`:
   * returns script-api extensions (`{ terrain: terrainScriptApi(handle) }`).
   */
  terrain?: (world: World, manifest: SceneManifest) => Record<string, object> | undefined;
  /**
   * Capability hooks (figures, vehicles, …), run in order after terrain and before `setup`.
   * Same contract as `physics`: each may return script-api extension namespaces.
   */
  capabilities?: ((world: World, manifest: SceneManifest) => Record<string, object> | undefined)[];
  /** Extra script-api namespaces merged with whatever the hooks return. */
  scriptExtensions?: Record<string, object>;
  /** Install resolved type scripts followed by the manifest's `scripts` (default true). */
  scripts?: boolean;
}

/**
 * The one way every host builds a world from a scene — tooling ops, example workers, tests:
 *
 *   createWorldFromScene (gameplay → kinematics/character → commands → entities)
 *     → opts.physics?()  → opts.terrain?()  → opts.capabilities[]()  → setup?()
 *     → resolved type scripts → the manifest's scripts.
 *
 * Scripts install last so they see every declared command and every capability extension.
 * Type and manifest scripts must already be inline (`code`); resolve `path` refs first with
 * `inlineScriptSources` (browser) or the tooling scene loader (Node).
 */
export function buildWorld(
  manifest: SceneManifest,
  setup?: WorldSetup,
  opts?: BuildWorldOptions,
): World {
  const world = createWorldFromScene(manifest, opts);
  const extensions: Record<string, object> = { ...(opts?.scriptExtensions ?? {}) };
  const physicsExt = opts?.physics?.(world, manifest);
  if (physicsExt !== undefined) Object.assign(extensions, physicsExt);
  const terrainExt = opts?.terrain?.(world, manifest);
  if (terrainExt !== undefined) Object.assign(extensions, terrainExt);
  for (const capability of opts?.capabilities ?? []) {
    const ext = capability(world, manifest);
    if (ext !== undefined) Object.assign(extensions, ext);
  }
  setup?.(world, manifest);
  if (opts?.scripts !== false) {
    const typeScripts = [...(opts?.types?.entries() ?? [])].flatMap(([type, def]) =>
      def.scripts.map((script) => ({
        ...script,
        id: `type:${type}:${script.id}`,
        config: { ...script.config, type },
      })),
    );
    const scriptedManifest =
      typeScripts.length === 0
        ? manifest
        : { ...manifest, scripts: [...typeScripts, ...(manifest.scripts ?? [])] };
    installSceneScripts(world, scriptedManifest, { extensions, types: opts?.types });
  }
  return world;
}

/**
 * Replace every `path` script ref with inline `code` from `sources` (keyed by the exact `path`
 * string). Pure; returns a shallow copy of the manifest. Browsers use this with a bundler's raw
 * imports; the Node tooling loader reads the files itself.
 */
export function inlineScriptSources(
  manifest: SceneManifest,
  sources: Record<string, string>,
): SceneManifest {
  const scripts = (manifest.scripts ?? []).map((s) => {
    if (s.path === undefined) return s;
    const code = sources[s.path];
    if (code === undefined) {
      throw new Error(
        `script "${s.id}": no source for path "${s.path}" (known: ${Object.keys(sources).join(', ') || 'none'})`,
      );
    }
    const { path: _path, ...rest } = s;
    return { ...rest, code };
  });
  return { ...manifest, scripts };
}

// Re-export so callers can keep JsonValue handy when authoring setups.
export type { JsonValue };
