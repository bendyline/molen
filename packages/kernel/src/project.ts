import {
  buildTypeIndex,
  type MessageLink,
  type ResolvedTypes,
  resolveAllTypes,
  type SceneManifest,
  type TypesDoc,
  validate,
} from '@bendyline/molen-schema';
import { KernelHost, type KernelHostOptions } from './host';
import { type BuildWorldOptions, buildWorld, inlineScriptSources, type WorldSetup } from './scene';
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

/** Find the one source key that ends with a script's declared `path`. */
function sourceFor(path: string, scripts: Readonly<Record<string, string>>): string {
  const direct = scripts[path];
  if (direct !== undefined) return direct;
  const matches = Object.keys(scripts).filter((key) => key.endsWith(`/${path}`));
  if (matches.length === 1) {
    const only = matches[0] as string;
    return scripts[only] as string;
  }
  const known = Object.keys(scripts).sort().join(', ');
  if (matches.length === 0) {
    throw new Error(
      `no source for script "${path}": none of the given keys end with it (have: ${known || 'none'})`,
    );
  }
  throw new Error(
    `ambiguous source for script "${path}": ${matches.sort().join(' and ')} both match. ` +
      'Narrow the glob, or key the sources by the exact path the scene declares.',
  );
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

  let types: ResolvedTypes | undefined;
  if (options.types !== undefined) {
    const docs = Array.isArray(options.types) ? options.types : [options.types];
    const parsed = docs.map((doc, i) => {
      const result = validate('types', doc);
      if (!result.ok) throw new Error(result.formatted);
      for (const def of Object.values(result.value.types)) {
        for (const script of def.scripts) {
          if (script.path === undefined) continue;
          const source = sourceFor(script.path, options.scripts ?? {});
          script.code = source;
          delete script.path;
        }
      }
      return { doc: result.value as TypesDoc, source: `types[${i}]` };
    });
    const { index, issues } = buildTypeIndex(parsed);
    if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join('; '));
    types = resolveAllTypes(index);
  }

  const scripts = options.scripts;
  const manifest =
    scripts === undefined
      ? parsedScene.value
      : inlineScriptSources(
          parsedScene.value,
          Object.fromEntries(
            (parsedScene.value.scripts ?? [])
              .filter((script): script is typeof script & { path: string } => script.path != null)
              .map((script) => [script.path, sourceFor(script.path, scripts)]),
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
