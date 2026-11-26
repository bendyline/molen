// Building a world from a data-only manifest: no script runtime, so nothing here loads SES.
// `scene.ts` adds buildWorld (setup modules and scripts) on top; `data.ts` is the scripts-free
// entry for hosts that run model-written or untrusted scenes.

import {
  blockingIssues,
  type ComponentMap,
  type ComponentRegistry,
  type ContentIdentity,
  commandPayloadValidator,
  createComponentRegistry,
  formatIssues,
  resolveEntityComponents,
  type SceneManifest,
  type SceneResolveOptions as SchemaSceneResolveOptions,
} from '@bendyline/molen-schema';
import { installCharacterController } from './character';
import { installGameplay } from './gameplay';
import { installGlass } from './glass';
import { installKinematics } from './kinematics';
import { installPlatformer } from './platformer';
import { installPlay } from './play';
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
  opts?: {
    devFreeze?: boolean;
    validateSpawn?: boolean;
    content?: ContentIdentity;
  } & SceneResolveOptions,
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
    ...(opts?.content !== undefined ? { content: opts.content } : {}),
  });
  if (opts?.gameplay !== false) installGameplay(world);
  installGlass(world);
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
  // Choreography and rules of play (cues, rules, path, mover, trigger, controller): after the
  // commands are declared, so controller and command-rule handlers attach to declared types.
  if (opts?.gameplay !== false) {
    installPlay(world, manifest, {
      spawnFromPrefab: (prefab) => resolveEntityComponents(manifest, { prefab }, opts),
    });
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
