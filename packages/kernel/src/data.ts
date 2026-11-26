// @bendyline/molen-kernel/data — build and run a data-only scene without the script runtime.
// The package root loads SES (which locks down the host realm's intrinsics on import) for scene
// scripts; a host that runs scenes a model or a stranger wrote — films and games compiled by
// @bendyline/molen-stage — builds them here instead: no `eval`, no SES, no host authority. A
// manifest that carries scripts is refused rather than silently run without them.

import type { SceneManifest } from '@bendyline/molen-schema';
import { createWorldFromScene, type SceneResolveOptions } from './scene-data';
import type { World } from './world';

export type {
  ContentIdentity,
  JsonObject,
  JsonValue,
  SceneManifest,
} from '@bendyline/molen-schema';
export type { AssertContext, AssertionResult } from './assert';
export { formatAssertionResults, runAssertions } from './assert';
export { Transform } from './component';
export { hashJson } from './hash';
export type { PlayOptions } from './play';
export {
  Controller,
  Cues,
  installPlay,
  Mover,
  PATH_COMPLETE,
  Path,
  RULE_ERROR,
  Rules,
  TOUCH,
  Trigger,
  Vars,
} from './play';
export type { SceneResolveOptions } from './scene-data';
export { createWorldFromScene, spawnFromData } from './scene-data';
export { applyKeyframeTo, stateHash, takeKeyframe } from './snapshot';
export { World } from './world';

export interface DataWorldOptions extends SceneResolveOptions {
  devFreeze?: boolean;
  validateSpawn?: boolean;
  /**
   * Capability hooks (figures, terrain, physics plugins), run in order after the data-declared
   * systems. Their returned script extensions are ignored: there are no scripts here.
   */
  capabilities?: ((world: World, manifest: SceneManifest) => unknown)[];
}

/**
 * Build a world from a data-only manifest. Refuses a manifest with `scripts`, or one whose
 * resolved types carry scripts, so a scene never runs with part of its behavior missing.
 */
export function buildDataWorld(manifest: SceneManifest, opts?: DataWorldOptions): World {
  if ((manifest.scripts ?? []).length > 0) {
    throw new Error(
      `scene "${manifest.name}" has scripts; the data-only entry builds scenes without code (use buildWorld from @bendyline/molen-kernel to run scripts)`,
    );
  }
  for (const [type, def] of opts?.types?.entries() ?? []) {
    if (def.scripts.length > 0) {
      throw new Error(`type "${type}" has scripts; the data-only entry builds scenes without code`);
    }
  }
  const world = createWorldFromScene(manifest, opts);
  for (const capability of opts?.capabilities ?? []) capability(world, manifest);
  return world;
}
