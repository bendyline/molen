import {
  blockingIssues,
  type ComponentMap,
  type ComponentRegistry,
  commandPayloadValidator,
  createComponentRegistry,
  formatIssues,
  type JsonValue,
  resolveEntityComponents,
  type SceneManifest,
  type SceneResolveOptions as SchemaSceneResolveOptions,
} from '@bendyline/molen-schema';
import { installCharacterController } from './character';
import { installGameplay } from './gameplay';
import { installKinematics } from './kinematics';
import { installPlatformer } from './platformer';
import { installSceneScripts } from './scripting';
import { World, type WorldOptions } from './world';

export type { ResolvedTypes } from '@bendyline/molen-schema';
export interface SceneResolveOptions extends SchemaSceneResolveOptions {
  gameplay?: boolean;
  registry?: ComponentRegistry;
  defaults?: WorldOptions['defaults'];
}
export { resolveEntityComponents, resolvePrefab } from '@bendyline/molen-schema';

/**
 * Build a World from a validated scene manifest: applies tickRate/seed/lateCommands, installs
 * the data-declared systems (gameplay, kinematics + character when `physics` asks for them),
 * declares the scene's `commands` (with their payload validators) and custom `components`, and
 * instantiates entities (type/prefab/components) in manifest order, preserving authored ids.
 *
 * Code setup (systems, command handlers) and the manifest's own scripts are NOT installed here;
 * `buildWorld` layers those on top in the documented order.
 */
export function createWorldFromScene(
  manifest: SceneManifest,
  opts?: { devFreeze?: boolean; validateSpawn?: boolean } & SceneResolveOptions,
): World {
  const vocabulary = createComponentRegistry(manifest.components ?? {}, {
    base: opts?.registry,
    owner: 'scene',
  });
  const errors = blockingIssues(vocabulary.issues);
  if (errors.length > 0) throw new Error(formatIssues('scene components', errors));
  const world = new World({
    registry: vocabulary.registry,
    defaults: opts?.defaults,
    tickRate: manifest.tickRate,
    seed: manifest.seed,
    lateCommands: manifest.lateCommands,
    ...(opts?.devFreeze !== undefined ? { devFreeze: opts.devFreeze } : {}),
    ...(opts?.validateSpawn !== undefined ? { validateSpawn: opts.validateSpawn } : {}),
  });
  if (opts?.gameplay !== false) installGameplay(world);
  // Same-package physics installs automatically; rapier (a separate WASM package) is wired by
  // tooling/apps via the `physics` hook of buildWorld after `await initRapier()`.
  const physics = manifest.physics;
  if (physics?.engine === 'kinematics') {
    installKinematics(world, physics.ground !== undefined ? { ground: physics.ground } : {});
  }
  if (physics?.engine === 'platformer') installPlatformer(world);
  if (physics?.character === true && !['rapier', 'platformer'].includes(physics.engine)) {
    installCharacterController(world);
  }
  for (const [type, def] of Object.entries(manifest.commands ?? {})) {
    world.declareCommand(
      type,
      def.payload !== undefined
        ? { validatePayload: commandPayloadValidator(type, def.payload) }
        : {},
    );
  }
  for (const entity of manifest.entities) {
    const components = resolveEntityComponents(manifest, entity, opts);
    // Validate the complete merge after applying component defaults.
    world.spawn(components, { id: entity.id, validate: opts?.validateSpawn ?? true });
  }
  return world;
}

/**
 * Bind a data array to entities (the visualization building block): spawn one entity per item
 * via a template. With `idPrefix`, entities get stable ids (`prefix0`, `prefix1`, …) so later
 * systems can update them by index.
 */
export function spawnFromData<T>(
  world: World,
  data: readonly T[],
  template: (item: T, index: number) => ComponentMap,
  opts?: { idPrefix?: string },
): string[] {
  const ids: string[] = [];
  data.forEach((item, i) => {
    const id = opts?.idPrefix !== undefined ? `${opts.idPrefix}${i}` : undefined;
    ids.push(world.spawnRaw(template(item, i), id));
  });
  return ids;
}

/** Convenience for tooling: a manifest plus a code setup step (systems + command handlers). */
export type WorldSetup = (world: World, manifest: SceneManifest) => void;

export interface BuildWorldOptions extends SceneResolveOptions {
  devFreeze?: boolean;
  validateSpawn?: boolean;
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
