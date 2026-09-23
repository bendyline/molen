import {
  type MessageLink,
  type ResolvedTypes,
  type SceneManifest,
  validate,
} from '@bendyline/molen-schema';
import { KernelHost, type KernelHostOptions } from './host';
import { type BuildWorldOptions, buildWorld, inlineScriptSources, type WorldSetup } from './scene';
import { resolveTypeDocuments, scriptSourceFor } from './type-library';
import type { World } from './world';

// Every host repeats the same two blocks: validate the scene and its type registry and inline the
// script sources a bundler handed you, then build a world and wire it to the worker's message
// port. Both are mechanical, both are easy to get subtly wrong (a mis-stripped glob prefix leaves
// a script silently uninlined; forgetting keyframeInterval makes the page wait a scene's worth of
// ticks for its first frame), and neither is where an author's attention belongs. These two
// functions are that boilerplate, so a project's scene module and worker entry are a few lines.

export interface LoadProjectOptions {
  /** The scene document as imported JSON. Validated as `molen/scene@3`. */
  scene: unknown;
  /**
   * Entity type registry documents as imported JSON, one or several. Omit when the scene
   * declares no `type` refs.
   */
  types?: unknown;
  /**
   * Raw script sources, as a bundler's eager raw glob hands them over: module path to source
   * text. Keys are matched to each script's `path` by suffix, so the glob's own prefix
   * (`../scenes/`, `../`, wherever the module sits) does not have to be stripped by hand.
   */
  scripts?: Readonly<Record<string, string>>;
}

export interface LoadedProject {
  scene: SceneManifest;
  /** Present only when `types` documents were given; spreads straight into `buildWorld`. */
  types?: ResolvedTypes;
}

/**
 * Validate a project's documents and hand back what a host needs: the scene manifest with its
 * scripts inlined, and the resolved type registry. Throws with the validator's formatted error —
 * the same text `molen validate` prints — so a bad document fails at load with a pinpointed
 * message rather than somewhere inside the first tick.
 */
export function loadProject(options: LoadProjectOptions): LoadedProject {
  const parsedScene = validate('scene', options.scene);
  if (!parsedScene.ok) throw new Error(parsedScene.formatted);

  const types =
    options.types === undefined
      ? undefined
      : resolveTypeDocuments(options.types, options.scripts ?? {});

  const scripts = options.scripts;
  const manifest =
    scripts === undefined
      ? parsedScene.value
      : inlineScriptSources(
          parsedScene.value,
          Object.fromEntries(
            (parsedScene.value.scripts ?? [])
              .filter((script): script is typeof script & { path: string } => script.path != null)
              .map((script) => [script.path, scriptSourceFor(script.path, scripts)]),
          ),
        );

  return types === undefined ? { scene: manifest } : { scene: manifest, types };
}

export interface StartKernelWorkerOptions extends BuildWorldOptions {
  /** The manifest, scripts already inlined — `loadProject` returns one. */
  scene: SceneManifest;
  setup?: WorldSetup;
  /** Where to speak. Defaults to this worker's own global scope. */
  link?: MessageLink;
  /** Host options. `keyframeInterval` defaults to the scene's own. */
  host?: KernelHostOptions;
}

export interface KernelWorker {
  world: World;
  host: KernelHost;
}

/** The worker's global scope, if this really is a worker. */
function workerLink(): MessageLink {
  const scope = globalThis as unknown as Partial<MessageLink>;
  if (typeof scope.postMessage === 'function' && typeof scope.addEventListener === 'function') {
    return scope as MessageLink;
  }
  throw new Error(
    'startKernelWorker: this global scope is not a Worker (no postMessage/addEventListener). ' +
      'Pass `link` explicitly — a MessagePort, or a mock in tests.',
  );
}

/**
 * Build the world and serve it over the worker's message port: the whole body of a kernel
 * worker entry. Returns both, so a host that wants to step manually or dispose still can.
 *
 * `keyframeInterval` comes from the scene unless overridden, which is what makes a page's first
 * frame arrive promptly instead of after a full keyframe period.
 */
export function startKernelWorker(options: StartKernelWorkerOptions): KernelWorker {
  const { scene, setup, link, host, ...build } = options;
  const world = buildWorld(scene, setup, build);
  return {
    world,
    host: new KernelHost(world, link ?? workerLink(), {
      keyframeInterval: scene.keyframeInterval,
      ...host,
    }),
  };
}
